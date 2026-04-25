import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireRole('ADMIN'));

const itemSchema = z.object({
  productId: z.string().optional(),
  name: z.string().min(1),
  category: z.string().optional(),
  quantity: z.coerce.number().int().nonnegative().default(0),
  unit: z.string().default('piece'),
  minStockLevel: z.coerce.number().int().nonnegative().default(0),
  supplierName: z.string().optional(),
  costPrice: z.coerce.number().nonnegative().default(0),
  sellingPrice: z.coerce.number().nonnegative().default(0),
  type: z.enum(['RAW_MATERIAL', 'KITCHEN_EQUIPMENT', 'OTHER']).default('OTHER'),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { type } = req.query;
    const where = type ? { type: String(type) } : {};
    const items = await prisma.inventoryItem.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: { product: true },
    });
    const lowStock = items.filter((i) => i.quantity <= i.minStockLevel);
    res.json({ items, lowStock });
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = itemSchema.parse(req.body);
    const item = await prisma.inventoryItem.create({ data });
    res.status(201).json({ item });
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = itemSchema.partial().parse(req.body);
    const item = await prisma.inventoryItem.update({ where: { id: req.params.id }, data });
    res.json({ item });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await prisma.inventoryItem.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }),
);

router.get(
  '/:id/usage',
  asyncHandler(async (req, res) => {
    const item = await prisma.inventoryItem.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: 'Inventory item not found' });
    const usage = await prisma.orderInventoryItem.findMany({
      where: { inventoryItemId: req.params.id },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            scheduledFor: true,
            location: true,
            customer: { select: { user: { select: { name: true } } } },
          },
        },
      },
      orderBy: { order: { scheduledFor: 'asc' } },
    });
    const orders = usage.map((u) => ({
      orderId: u.order.id,
      orderNumber: u.order.orderNumber,
      status: u.order.status,
      scheduledFor: u.order.scheduledFor,
      location: u.order.location,
      customerName: u.order.customer?.user?.name || null,
      quantity: u.quantity,
    }));
    const activeQty = orders
      .filter((o) => o.status !== 'CANCELLED' && o.status !== 'DELIVERED')
      .reduce((s, o) => s + o.quantity, 0);
    res.json({
      item: { id: item.id, name: item.name, unit: item.unit, quantity: item.quantity },
      orders,
      summary: {
        bookedActive: activeQty,
        available: item.quantity - activeQty,
      },
    });
  }),
);

export default router;
