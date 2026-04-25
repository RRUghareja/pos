import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const recipeItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().positive().default(1),
  unit: z.string().optional(),
});

const cuisineSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  pricePerPlate: z.coerce.number().nonnegative(),
  isActive: z.boolean().default(true),
  imageUrl: z.string().url().optional(),
  recipe: z.array(recipeItemSchema).optional().default([]),
});

const fullInclude = {
  recipe: { include: { product: true } },
};

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { q, category, activeOnly } = req.query;
    const where = {
      ...(activeOnly === 'true' ? { isActive: true } : {}),
      ...(category ? { category: String(category) } : {}),
      ...(q ? { name: { contains: String(q), mode: 'insensitive' } } : {}),
    };
    const cuisines = await prisma.cuisine.findMany({
      where,
      include: fullInclude,
      orderBy: { name: 'asc' },
    });
    res.json({ cuisines });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const cuisine = await prisma.cuisine.findUnique({
      where: { id: req.params.id },
      include: fullInclude,
    });
    if (!cuisine) return res.status(404).json({ error: 'Cuisine not found' });
    res.json({ cuisine });
  }),
);

router.post(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = cuisineSchema.parse(req.body);
    if (data.recipe.length) {
      const found = await prisma.product.findMany({
        where: { id: { in: data.recipe.map((r) => r.productId) } },
        select: { id: true },
      });
      if (found.length !== new Set(data.recipe.map((r) => r.productId)).size) {
        return res.status(400).json({ error: 'One or more recipe products not found' });
      }
    }
    const cuisine = await prisma.cuisine.create({
      data: {
        name: data.name,
        description: data.description,
        category: data.category,
        pricePerPlate: data.pricePerPlate,
        isActive: data.isActive,
        imageUrl: data.imageUrl,
        recipe: {
          create: data.recipe.map((r) => ({
            productId: r.productId,
            quantity: r.quantity,
            unit: r.unit,
          })),
        },
      },
      include: fullInclude,
    });
    res.status(201).json({ cuisine });
  }),
);

router.patch(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = cuisineSchema.partial().parse(req.body);
    const tx = [];
    const updateData = {};
    for (const k of ['name', 'description', 'category', 'pricePerPlate', 'isActive', 'imageUrl']) {
      if (data[k] !== undefined) updateData[k] = data[k];
    }
    if (data.recipe) {
      tx.push(prisma.cuisineProduct.deleteMany({ where: { cuisineId: req.params.id } }));
      if (data.recipe.length) {
        tx.push(
          prisma.cuisineProduct.createMany({
            data: data.recipe.map((r) => ({
              cuisineId: req.params.id,
              productId: r.productId,
              quantity: r.quantity,
              unit: r.unit,
            })),
          }),
        );
      }
    }
    tx.push(prisma.cuisine.update({ where: { id: req.params.id }, data: updateData }));
    await prisma.$transaction(tx);
    const cuisine = await prisma.cuisine.findUnique({
      where: { id: req.params.id },
      include: fullInclude,
    });
    res.json({ cuisine });
  }),
);

router.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const used = await prisma.orderCuisine.findFirst({ where: { cuisineId: req.params.id } });
    if (used) {
      return res.status(409).json({
        error: 'This cuisine is used by one or more orders. Mark it inactive instead.',
      });
    }
    await prisma.cuisine.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }),
);

router.get(
  '/:id/usage',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const cuisine = await prisma.cuisine.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, pricePerPlate: true },
    });
    if (!cuisine) return res.status(404).json({ error: 'Cuisine not found' });

    const lines = await prisma.orderCuisine.findMany({
      where: { cuisineId: req.params.id },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            scheduledFor: true,
            location: true,
            notes: true,
            total: true,
            customer: {
              select: { user: { select: { name: true, email: true, phone: true } } },
            },
            workers: {
              select: { worker: { select: { user: { select: { name: true } } } } },
            },
          },
        },
      },
      orderBy: { order: { scheduledFor: 'asc' } },
    });

    const orders = lines.map((l) => ({
      orderId: l.order.id,
      orderNumber: l.order.orderNumber,
      status: l.order.status,
      scheduledFor: l.order.scheduledFor,
      location: l.order.location,
      notes: l.order.notes,
      total: l.order.total,
      plates: l.plates,
      unitPrice: l.unitPrice,
      lineTotal: Number(l.unitPrice) * l.plates,
      customerName: l.order.customer?.user?.name || null,
      customerPhone: l.order.customer?.user?.phone || null,
      customerEmail: l.order.customer?.user?.email || null,
      workers: l.order.workers.map((w) => w.worker.user.name),
    }));

    const summary = {
      totalOrders: orders.length,
      totalPlates: orders.reduce((s, o) => s + o.plates, 0),
      activePlates: orders
        .filter((o) => o.status !== 'CANCELLED' && o.status !== 'DELIVERED')
        .reduce((s, o) => s + o.plates, 0),
    };

    res.json({ cuisine, orders, summary });
  }),
);

export default router;
