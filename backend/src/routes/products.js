import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.coerce.number().nonnegative(),
  category: z.string().optional(),
  imageUrl: z.string().url().optional(),
  stock: z.coerce.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { category, q } = req.query;
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        ...(category ? { category: String(category) } : {}),
        ...(q ? { name: { contains: String(q), mode: 'insensitive' } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ products });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ product });
  }),
);

router.post(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = productSchema.parse(req.body);
    const product = await prisma.product.create({ data });
    res.status(201).json({ product });
  }),
);

router.patch(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = productSchema.partial().parse(req.body);
    const product = await prisma.product.update({ where: { id: req.params.id }, data });
    res.json({ product });
  }),
);

router.delete(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    await prisma.product.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }),
);

router.get(
  '/:id/usage',
  requireAuth,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const recipes = await prisma.cuisineProduct.findMany({
      where: { productId: req.params.id },
      include: { cuisine: { select: { id: true, name: true, pricePerPlate: true, isActive: true } } },
    });
    const cuisines = recipes.map((r) => ({
      cuisineId: r.cuisine.id,
      name: r.cuisine.name,
      pricePerPlate: r.cuisine.pricePerPlate,
      isActive: r.cuisine.isActive,
      quantity: r.quantity,
      unit: r.unit,
    }));

    // Orders that use this product, either:
    //   - directly via OrderItem (legacy), OR
    //   - indirectly via a cuisine recipe that includes this product
    const cuisineIds = recipes.map((r) => r.cuisine.id);
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { items: { some: { productId: req.params.id } } },
          ...(cuisineIds.length
            ? [{ cuisines: { some: { cuisineId: { in: cuisineIds } } } }]
            : []),
        ],
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        scheduledFor: true,
        location: true,
        customer: { select: { user: { select: { name: true } } } },
        items: {
          where: { productId: req.params.id },
          select: { quantity: true },
        },
        cuisines: {
          where: cuisineIds.length ? { cuisineId: { in: cuisineIds } } : undefined,
          select: { plates: true, cuisineId: true },
        },
      },
      orderBy: { scheduledFor: 'asc' },
    });

    const recipeQty = new Map(
      recipes.map((r) => [r.cuisine.id, Number(r.quantity)]),
    );

    const ordersOut = orders.map((o) => {
      const directQty = o.items.reduce((s, i) => s + i.quantity, 0);
      const viaCuisines = o.cuisines.reduce(
        (s, c) => s + (recipeQty.get(c.cuisineId) || 0) * c.plates,
        0,
      );
      return {
        orderId: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        scheduledFor: o.scheduledFor,
        location: o.location,
        customerName: o.customer?.user?.name || null,
        directQty,
        viaCuisinesQty: viaCuisines,
      };
    });

    res.json({ cuisines, orders: ordersOut });
  }),
);

export default router;
