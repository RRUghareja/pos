import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const orderItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
});

const orderCuisineSchema = z.object({
  cuisineId: z.string().min(1),
  plates: z.coerce.number().int().positive(),
});

const orderInventorySchema = z.object({
  inventoryItemId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
});

const orderCreateSchema = z
  .object({
    items: z.array(orderItemSchema).optional().default([]),
    cuisines: z.array(orderCuisineSchema).optional().default([]),
    inventoryItems: z.array(orderInventorySchema).optional().default([]),
    workerIds: z.array(z.string()).optional().default([]),
    customerId: z.string().optional().nullable(),
    notes: z.string().optional(),
    location: z.string().optional(),
    scheduledFor: z.coerce.date().optional().nullable(),
  })
  .refine((d) => d.items.length > 0 || d.cuisines.length > 0, {
    message: 'Order must include at least one cuisine or product',
    path: ['cuisines'],
  });

const orderUpdateSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'DELIVERED', 'CANCELLED']).optional(),
  workerIds: z.array(z.string()).optional(),
  items: z.array(orderItemSchema).optional(),
  cuisines: z.array(orderCuisineSchema).optional(),
  inventoryItems: z.array(orderInventorySchema).optional(),
  customerId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  scheduledFor: z.coerce.date().nullable().optional(),
});

function genOrderNumber() {
  return `ORD-${Date.now().toString(36).toUpperCase()}`;
}

const fullOrderInclude = {
  items: { include: { product: true } },
  cuisines: { include: { cuisine: true } },
  customer: { include: { user: { select: { name: true, email: true, phone: true } } } },
  workers: { include: { worker: { include: { user: { select: { id: true, name: true } } } } } },
  inventoryUsage: { include: { inventoryItem: true } },
};

async function priceItems(items) {
  if (!items.length) return { itemsData: [], total: 0 };
  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  if (products.length !== new Set(productIds).size) {
    const found = new Set(products.map((p) => p.id));
    const missing = productIds.find((id) => !found.has(id));
    const err = new Error(`Product not found: ${missing}`);
    err.status = 400;
    throw err;
  }
  const priceMap = new Map(products.map((p) => [p.id, Number(p.price)]));
  let total = 0;
  const itemsData = items.map((i) => {
    const unitPrice = priceMap.get(i.productId) ?? 0;
    total += unitPrice * i.quantity;
    return { productId: i.productId, quantity: i.quantity, unitPrice };
  });
  return { itemsData, total };
}

async function priceCuisines(cuisines) {
  if (!cuisines.length) return { cuisinesData: [], total: 0 };
  const ids = cuisines.map((c) => c.cuisineId);
  const found = await prisma.cuisine.findMany({ where: { id: { in: ids } } });
  if (found.length !== new Set(ids).size) {
    const ok = new Set(found.map((c) => c.id));
    const missing = ids.find((id) => !ok.has(id));
    const err = new Error(`Cuisine not found: ${missing}`);
    err.status = 400;
    throw err;
  }
  const priceMap = new Map(found.map((c) => [c.id, Number(c.pricePerPlate)]));
  let total = 0;
  const cuisinesData = cuisines.map((c) => {
    const unitPrice = priceMap.get(c.cuisineId) ?? 0;
    total += unitPrice * c.plates;
    return { cuisineId: c.cuisineId, plates: c.plates, unitPrice };
  });
  return { cuisinesData, total };
}

async function validateInventory(inventoryItems) {
  if (!inventoryItems.length) return;
  const ids = inventoryItems.map((i) => i.inventoryItemId);
  const found = await prisma.inventoryItem.findMany({ where: { id: { in: ids } } });
  if (found.length !== new Set(ids).size) {
    const ok = new Set(found.map((i) => i.id));
    const missing = ids.find((id) => !ok.has(id));
    const err = new Error(`Inventory item not found: ${missing}`);
    err.status = 400;
    throw err;
  }
}

function scrubForWorker(order) {
  if (!order) return order;
  const stripped = { ...order, total: undefined };
  if (stripped.items) {
    stripped.items = stripped.items.map((i) => ({
      ...i,
      unitPrice: undefined,
      product: i.product ? { ...i.product, price: undefined } : i.product,
    }));
  }
  if (stripped.cuisines) {
    stripped.cuisines = stripped.cuisines.map((c) => ({
      ...c,
      unitPrice: undefined,
      cuisine: c.cuisine ? { ...c.cuisine, pricePerPlate: undefined } : c.cuisine,
    }));
  }
  if (stripped.inventoryUsage) {
    stripped.inventoryUsage = stripped.inventoryUsage.map((u) => ({
      ...u,
      inventoryItem: u.inventoryItem
        ? { ...u.inventoryItem, costPrice: undefined, sellingPrice: undefined }
        : u.inventoryItem,
    }));
  }
  return stripped;
}

async function validateWorkers(workerIds) {
  if (!workerIds.length) return;
  const found = await prisma.worker.findMany({ where: { id: { in: workerIds } } });
  if (found.length !== new Set(workerIds).size) {
    const ok = new Set(found.map((w) => w.id));
    const missing = workerIds.find((id) => !ok.has(id));
    const err = new Error(`Worker not found: ${missing}`);
    err.status = 400;
    throw err;
  }
}

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = orderCreateSchema.parse(req.body);

    let customerId = data.customerId ?? null;
    if (req.user.role === 'CUSTOMER') {
      const c = await prisma.customer.findUnique({ where: { userId: req.user.sub } });
      if (!c) return res.status(404).json({ error: 'Customer profile not found' });
      customerId = c.id;
    }

    const workerIds = req.user.role === 'CUSTOMER' ? [] : [...new Set(data.workerIds)];
    await validateWorkers(workerIds);
    await validateInventory(data.inventoryItems);
    const { itemsData, total: itemsTotal } = await priceItems(data.items);
    const { cuisinesData, total: cuisinesTotal } = await priceCuisines(data.cuisines);
    const total = itemsTotal + cuisinesTotal;

    const order = await prisma.order.create({
      data: {
        orderNumber: genOrderNumber(),
        customerId,
        createdById: req.user.sub,
        notes: data.notes,
        location: data.location,
        scheduledFor: data.scheduledFor ?? null,
        total,
        items: { create: itemsData },
        cuisines: { create: cuisinesData },
        workers: { create: workerIds.map((workerId) => ({ workerId })) },
        inventoryUsage: {
          create: data.inventoryItems.map((i) => ({
            inventoryItemId: i.inventoryItemId,
            quantity: i.quantity,
          })),
        },
      },
      include: fullOrderInclude,
    });
    res.status(201).json({ order });
  }),
);

// Conflict detection: which workers/inventory are already booked for a given scheduledFor (±2h window)
router.get(
  '/conflicts/check',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { scheduledFor, excludeOrderId } = req.query;
    if (!scheduledFor) return res.json({ workerIds: [], inventoryUsage: {} });
    const target = new Date(String(scheduledFor));
    const windowMs = 2 * 60 * 60 * 1000;
    const overlapping = await prisma.order.findMany({
      where: {
        id: excludeOrderId ? { not: String(excludeOrderId) } : undefined,
        status: { not: 'CANCELLED' },
        scheduledFor: {
          gte: new Date(target.getTime() - windowMs),
          lte: new Date(target.getTime() + windowMs),
        },
      },
      include: {
        workers: { select: { workerId: true } },
        inventoryUsage: { select: { inventoryItemId: true, quantity: true } },
      },
    });
    const workerIds = new Set();
    const inventoryUsage = {};
    for (const o of overlapping) {
      o.workers.forEach((w) => workerIds.add(w.workerId));
      o.inventoryUsage.forEach((u) => {
        inventoryUsage[u.inventoryItemId] = (inventoryUsage[u.inventoryItemId] || 0) + u.quantity;
      });
    }
    res.json({ workerIds: Array.from(workerIds), inventoryUsage });
  }),
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, from, to } = req.query;
    let where = {};
    if (req.user.role === 'CUSTOMER') {
      const c = await prisma.customer.findUnique({ where: { userId: req.user.sub } });
      where = { customerId: c?.id ?? '__none__' };
    } else if (req.user.role === 'WORKER') {
      const w = await prisma.worker.findUnique({ where: { userId: req.user.sub } });
      where = { workers: { some: { workerId: w?.id ?? '__none__' } } };
    }
    if (status) where.status = String(status);
    if (from || to) {
      where.scheduledFor = {};
      if (from) where.scheduledFor.gte = new Date(String(from));
      if (to) where.scheduledFor.lte = new Date(String(to));
    }
    const orders = await prisma.order.findMany({
      where,
      include: fullOrderInclude,
      orderBy: [{ scheduledFor: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
    const out = req.user.role === 'WORKER' ? orders.map(scrubForWorker) : orders;
    res.json({ orders: out });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: fullOrderInclude,
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (req.user.role === 'CUSTOMER') {
      const c = await prisma.customer.findUnique({ where: { userId: req.user.sub } });
      if (order.customerId !== c?.id) return res.status(403).json({ error: 'Forbidden' });
    } else if (req.user.role === 'WORKER') {
      const w = await prisma.worker.findUnique({ where: { userId: req.user.sub } });
      const isAssigned = order.workers.some((ow) => ow.workerId === w?.id);
      if (!isAssigned) return res.status(403).json({ error: 'Forbidden' });
    }
    res.json({ order: req.user.role === 'WORKER' ? scrubForWorker(order) : order });
  }),
);

// --- Order messages (chat / complaints / suggestions) ---

const messageSchema = z.object({
  type: z.enum(['CHAT', 'COMPLAINT', 'SUGGESTION']).default('CHAT'),
  body: z.string().min(1).max(2000),
});

async function ensureOrderAccess(req) {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      customerId: true,
      workers: { select: { workerId: true } },
    },
  });
  if (!order) return { ok: false, status: 404, error: 'Order not found' };
  if (req.user.role === 'ADMIN') return { ok: true };
  if (req.user.role === 'CUSTOMER') {
    const c = await prisma.customer.findUnique({ where: { userId: req.user.sub } });
    if (order.customerId !== c?.id) return { ok: false, status: 403, error: 'Forbidden' };
    return { ok: true, asCustomer: true };
  }
  if (req.user.role === 'WORKER') {
    const w = await prisma.worker.findUnique({ where: { userId: req.user.sub } });
    if (!order.workers.some((ow) => ow.workerId === w?.id)) {
      return { ok: false, status: 403, error: 'Forbidden' };
    }
    return { ok: true, asWorker: true };
  }
  return { ok: false, status: 403, error: 'Forbidden' };
}

router.get(
  '/:id/messages',
  asyncHandler(async (req, res) => {
    const access = await ensureOrderAccess(req);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const messages = await prisma.orderMessage.findMany({
      where: { orderId: req.params.id },
      include: { author: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ messages });
  }),
);

router.post(
  '/:id/messages',
  asyncHandler(async (req, res) => {
    const access = await ensureOrderAccess(req);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const data = messageSchema.parse(req.body);
    if (access.asCustomer && data.type === 'CHAT') {
      // customers can post complaints / suggestions, but their default channel is feedback
      data.type = 'COMPLAINT';
    }
    const message = await prisma.orderMessage.create({
      data: { orderId: req.params.id, authorId: req.user.sub, type: data.type, body: data.body },
      include: { author: { select: { id: true, name: true, role: true } } },
    });
    res.status(201).json({ message });
  }),
);

router.delete(
  '/:id/messages/:messageId',
  asyncHandler(async (req, res) => {
    const msg = await prisma.orderMessage.findUnique({ where: { id: req.params.messageId } });
    if (!msg || msg.orderId !== req.params.id) {
      return res.status(404).json({ error: 'Message not found' });
    }
    if (req.user.role !== 'ADMIN' && msg.authorId !== req.user.sub) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }
    await prisma.orderMessage.delete({ where: { id: msg.id } });
    res.json({ ok: true });
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { workers: true },
    });
    if (!existing) return res.status(404).json({ error: 'Order not found' });

    const data = orderUpdateSchema.parse(req.body);

    if (req.user.role === 'WORKER') {
      const w = await prisma.worker.findUnique({ where: { userId: req.user.sub } });
      const isAssigned = existing.workers.some((ow) => ow.workerId === w?.id);
      if (!isAssigned) {
        return res.status(403).json({ error: 'You can only update orders assigned to you' });
      }
      // Workers can only update status + notes on their own orders.
      const allowed = {};
      if (data.status !== undefined) allowed.status = data.status;
      if (data.notes !== undefined) allowed.notes = data.notes;
      const order = await prisma.order.update({
        where: { id: req.params.id },
        data: allowed,
        include: fullOrderInclude,
      });
      return res.json({ order });
    }

    if (req.user.role === 'CUSTOMER') {
      const c = await prisma.customer.findUnique({ where: { userId: req.user.sub } });
      if (existing.customerId !== c?.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      if (data.status && data.status !== 'CANCELLED') {
        return res.status(403).json({ error: 'Customers can only cancel their own orders' });
      }
      if (data.status === 'CANCELLED' && existing.status !== 'PENDING') {
        return res.status(400).json({ error: 'Only PENDING orders can be cancelled' });
      }
      const order = await prisma.order.update({
        where: { id: req.params.id },
        data: { status: data.status },
        include: fullOrderInclude,
      });
      return res.json({ order });
    }

    // ADMIN: full edit, including line items / workers / inventory.
    if (data.workerIds) await validateWorkers(data.workerIds);
    if (data.inventoryItems) await validateInventory(data.inventoryItems);

    const tx = [];
    const updateData = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.customerId !== undefined) updateData.customerId = data.customerId;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.scheduledFor !== undefined) updateData.scheduledFor = data.scheduledFor;

    let totalChanged = false;
    let runningTotal = 0;
    if (data.items || data.cuisines) {
      // recompute the full total from the final state
      const finalItems = data.items ?? null;
      const finalCuisines = data.cuisines ?? null;
      let itemsTotal = 0;
      let cuisinesTotal = 0;

      if (finalItems !== null) {
        const { itemsData, total } = await priceItems(finalItems);
        itemsTotal = total;
        tx.push(prisma.orderItem.deleteMany({ where: { orderId: req.params.id } }));
        if (itemsData.length) {
          tx.push(
            prisma.orderItem.createMany({
              data: itemsData.map((i) => ({ ...i, orderId: req.params.id })),
            }),
          );
        }
      } else {
        const existingItems = await prisma.orderItem.findMany({
          where: { orderId: req.params.id },
        });
        itemsTotal = existingItems.reduce(
          (s, i) => s + Number(i.unitPrice) * i.quantity,
          0,
        );
      }

      if (finalCuisines !== null) {
        const { cuisinesData, total } = await priceCuisines(finalCuisines);
        cuisinesTotal = total;
        tx.push(prisma.orderCuisine.deleteMany({ where: { orderId: req.params.id } }));
        if (cuisinesData.length) {
          tx.push(
            prisma.orderCuisine.createMany({
              data: cuisinesData.map((c) => ({ ...c, orderId: req.params.id })),
            }),
          );
        }
      } else {
        const existingCuisines = await prisma.orderCuisine.findMany({
          where: { orderId: req.params.id },
        });
        cuisinesTotal = existingCuisines.reduce(
          (s, c) => s + Number(c.unitPrice) * c.plates,
          0,
        );
      }

      runningTotal = itemsTotal + cuisinesTotal;
      totalChanged = true;
    }
    if (totalChanged) updateData.total = runningTotal;

    if (data.workerIds) {
      const unique = [...new Set(data.workerIds)];
      tx.push(prisma.orderWorker.deleteMany({ where: { orderId: req.params.id } }));
      if (unique.length) {
        tx.push(
          prisma.orderWorker.createMany({
            data: unique.map((workerId) => ({ orderId: req.params.id, workerId })),
          }),
        );
      }
    }

    if (data.inventoryItems) {
      tx.push(prisma.orderInventoryItem.deleteMany({ where: { orderId: req.params.id } }));
      if (data.inventoryItems.length) {
        tx.push(
          prisma.orderInventoryItem.createMany({
            data: data.inventoryItems.map((i) => ({
              orderId: req.params.id,
              inventoryItemId: i.inventoryItemId,
              quantity: i.quantity,
            })),
          }),
        );
      }
    }

    tx.push(
      prisma.order.update({
        where: { id: req.params.id },
        data: updateData,
      }),
    );

    await prisma.$transaction(tx);

    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: fullOrderInclude,
    });
    res.json({ order });
  }),
);

router.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    await prisma.order.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }),
);

export default router;
