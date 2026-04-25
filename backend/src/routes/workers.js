import { Router } from 'express';
import bcrypt from 'bcryptjs';
import asyncHandler from 'express-async-handler';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

function roleLabel(role) {
  if (role === 'WORKER') return 'a worker';
  if (role === 'CUSTOMER') return 'a customer';
  if (role === 'ADMIN') return 'an admin';
  return 'a user';
}

const workerCreateSchema = z.object({
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(6),
  name: z.string().min(1),
  address: z.string().optional(),
  salaryType: z.enum(['HOURLY', 'DAILY']).default('HOURLY'),
  salaryRate: z.coerce.number().nonnegative().default(0),
  department: z.string().optional(),
});

const workerUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  salaryType: z.enum(['HOURLY', 'DAILY']).optional(),
  salaryRate: z.coerce.number().nonnegative().optional(),
  department: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

router.use(requireAuth);

router.get(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (_req, res) => {
    const workers = await prisma.worker.findMany({
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ workers });
  }),
);

router.get(
  '/:id',
  requireRole('ADMIN', 'WORKER'),
  asyncHandler(async (req, res) => {
    const worker = await prisma.worker.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
    });
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    if (req.user.role === 'WORKER' && worker.userId !== req.user.sub) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json({ worker });
  }),
);

router.post(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = workerCreateSchema.parse(req.body);

    const existingByEmail = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingByEmail) {
      return res.status(409).json({
        error: `This email is already registered as ${roleLabel(existingByEmail.role)}.`,
        field: 'email',
      });
    }
    if (data.phone) {
      const existingByPhone = await prisma.user.findUnique({ where: { phone: data.phone } });
      if (existingByPhone) {
        return res.status(409).json({
          error: `This phone number is already registered as ${roleLabel(existingByPhone.role)}.`,
          field: 'phone',
        });
      }
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        email: data.email,
        phone: data.phone,
        name: data.name,
        role: 'WORKER',
        passwordHash,
        worker: {
          create: {
            address: data.address,
            salaryType: data.salaryType,
            salaryRate: data.salaryRate,
            department: data.department,
          },
        },
      },
      include: { worker: true },
    });
    res.status(201).json({ worker: { ...user.worker, user: { id: user.id, email: user.email, name: user.name, phone: user.phone } } });
  }),
);

router.patch(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = workerUpdateSchema.parse(req.body);
    const { name, phone, ...workerData } = data;
    const worker = await prisma.worker.update({
      where: { id: req.params.id },
      data: {
        ...workerData,
        ...(name || phone
          ? { user: { update: { ...(name ? { name } : {}), ...(phone ? { phone } : {}) } } }
          : {}),
      },
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
    });
    res.json({ worker });
  }),
);

router.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const worker = await prisma.worker.findUnique({ where: { id: req.params.id } });
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    await prisma.user.delete({ where: { id: worker.userId } });
    res.json({ ok: true });
  }),
);

router.get(
  '/:id/orders',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const worker = await prisma.worker.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { name: true } } },
    });
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    const assignments = await prisma.orderWorker.findMany({
      where: { workerId: req.params.id },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            scheduledFor: true,
            location: true,
            customer: { select: { user: { select: { name: true } } } },
            cuisines: { select: { plates: true } },
          },
        },
      },
      orderBy: { order: { scheduledFor: 'asc' } },
    });
    const orders = assignments.map((a) => ({
      orderId: a.order.id,
      orderNumber: a.order.orderNumber,
      status: a.order.status,
      scheduledFor: a.order.scheduledFor,
      location: a.order.location,
      customerName: a.order.customer?.user?.name || null,
      plates: a.order.cuisines.reduce((s, c) => s + c.plates, 0),
    }));
    res.json({
      worker: { id: worker.id, name: worker.user.name },
      orders,
    });
  }),
);

export default router;
