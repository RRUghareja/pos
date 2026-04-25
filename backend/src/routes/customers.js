import { Router } from 'express';
import bcrypt from 'bcryptjs';
import asyncHandler from 'express-async-handler';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

function roleLabel(role) {
  if (role === 'WORKER') return 'a worker';
  if (role === 'CUSTOMER') return 'a customer';
  if (role === 'ADMIN') return 'an admin';
  return 'a user';
}

const customerCreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  phone: z.string().optional(),
  address: z.string().optional(),
});

const customerUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

router.get(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (_req, res) => {
    const customers = await prisma.customer.findMany({
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ customers });
  }),
);

router.post(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = customerCreateSchema.parse(req.body);

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
        role: 'CUSTOMER',
        passwordHash,
        customer: { create: { address: data.address } },
      },
      include: { customer: true },
    });
    res.status(201).json({
      customer: {
        ...user.customer,
        user: { id: user.id, email: user.email, name: user.name, phone: user.phone },
      },
    });
  }),
);

router.get(
  '/me',
  requireRole('CUSTOMER'),
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.findUnique({
      where: { userId: req.user.sub },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json({ customer });
  }),
);

router.patch(
  '/me',
  requireRole('CUSTOMER'),
  asyncHandler(async (req, res) => {
    const data = customerUpdateSchema.parse(req.body);
    const { name, phone, address } = data;
    const customer = await prisma.customer.update({
      where: { userId: req.user.sub },
      data: {
        ...(address !== undefined ? { address } : {}),
        ...(name || phone !== undefined
          ? { user: { update: { ...(name ? { name } : {}), ...(phone !== undefined ? { phone } : {}) } } }
          : {}),
      },
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
    });
    res.json({ customer });
  }),
);

router.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    await prisma.user.delete({ where: { id: customer.userId } });
    res.json({ ok: true });
  }),
);

export default router;
