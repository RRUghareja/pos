import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireRole('ADMIN'));

function hoursBetween(a, b, breakMins = 0) {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(0, ms / 1000 / 60 / 60 - breakMins / 60);
}

router.get(
  '/salary',
  asyncHandler(async (req, res) => {
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 30 * 86400000);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();

    const workers = await prisma.worker.findMany({
      where: { status: 'ACTIVE' },
      include: {
        user: { select: { name: true, email: true } },
        attendances: {
          where: { checkIn: { gte: from, lte: to }, checkOut: { not: null } },
        },
      },
    });

    const rows = workers.map((w) => {
      let totalHours = 0;
      const daySet = new Set();
      for (const a of w.attendances) {
        if (!a.checkOut) continue;
        totalHours += hoursBetween(a.checkIn, a.checkOut, a.breakMins);
        daySet.add(new Date(a.checkIn).toISOString().slice(0, 10));
      }
      const rate = Number(w.salaryRate);
      const salary = w.salaryType === 'HOURLY' ? totalHours * rate : daySet.size * rate;
      return {
        workerId: w.id,
        name: w.user.name,
        email: w.user.email,
        salaryType: w.salaryType,
        salaryRate: rate,
        totalHours: Number(totalHours.toFixed(2)),
        daysWorked: daySet.size,
        salary: Number(salary.toFixed(2)),
      };
    });

    res.json({ from, to, rows });
  }),
);

router.get(
  '/sales',
  asyncHandler(async (req, res) => {
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 30 * 86400000);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();

    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
      select: { id: true, total: true, status: true, createdAt: true },
    });
    const totalRevenue = orders.reduce((s, o) => s + Number(o.total), 0);
    res.json({
      from,
      to,
      orderCount: orders.length,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      orders,
    });
  }),
);

router.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const [workerCount, customerCount, productCount, pendingOrders, inventoryItems] = await Promise.all([
      prisma.worker.count({ where: { status: 'ACTIVE' } }),
      prisma.customer.count(),
      prisma.product.count({ where: { isActive: true } }),
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.inventoryItem.findMany({ select: { quantity: true, minStockLevel: true } }),
    ]);
    const lowStockCount = inventoryItems.filter((i) => i.quantity <= i.minStockLevel).length;
    res.json({ workerCount, customerCount, productCount, pendingOrders, lowStockCount });
  }),
);

export default router;
