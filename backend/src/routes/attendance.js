import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

async function getMyWorker(userId) {
  return prisma.worker.findUnique({ where: { userId } });
}

function hoursOf(att) {
  if (!att.checkOut) return 0;
  const ms = new Date(att.checkOut) - new Date(att.checkIn);
  return Math.max(0, ms / 3600000 - (att.breakMins || 0) / 60);
}

router.post(
  '/check-in',
  requireRole('WORKER'),
  asyncHandler(async (req, res) => {
    const worker = await getMyWorker(req.user.sub);
    if (!worker) return res.status(404).json({ error: 'Worker profile not found' });
    const open = await prisma.attendance.findFirst({
      where: { workerId: worker.id, checkOut: null },
    });
    if (open) return res.status(409).json({ error: 'Already checked in', attendance: open });
    const attendance = await prisma.attendance.create({
      data: { workerId: worker.id, checkIn: new Date() },
    });
    res.status(201).json({ attendance });
  }),
);

const checkOutSchema = z.object({
  breakMins: z.coerce.number().int().nonnegative().optional(),
  notes: z.string().optional(),
});

router.post(
  '/check-out',
  requireRole('WORKER'),
  asyncHandler(async (req, res) => {
    const worker = await getMyWorker(req.user.sub);
    if (!worker) return res.status(404).json({ error: 'Worker profile not found' });
    const open = await prisma.attendance.findFirst({
      where: { workerId: worker.id, checkOut: null },
      orderBy: { checkIn: 'desc' },
    });
    if (!open) return res.status(404).json({ error: 'No open check-in' });
    const body = checkOutSchema.parse(req.body ?? {});
    const attendance = await prisma.attendance.update({
      where: { id: open.id },
      data: { checkOut: new Date(), breakMins: body.breakMins ?? 0, notes: body.notes },
    });
    res.json({ attendance });
  }),
);

router.get(
  '/me',
  requireRole('WORKER'),
  asyncHandler(async (req, res) => {
    const worker = await getMyWorker(req.user.sub);
    if (!worker) return res.status(404).json({ error: 'Worker profile not found' });
    const attendances = await prisma.attendance.findMany({
      where: { workerId: worker.id },
      orderBy: { checkIn: 'desc' },
      take: 50,
    });
    res.json({ worker, attendances });
  }),
);

router.get(
  '/summary',
  requireRole('WORKER'),
  asyncHandler(async (req, res) => {
    const worker = await getMyWorker(req.user.sub);
    if (!worker) return res.status(404).json({ error: 'Worker profile not found' });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const attendances = await prisma.attendance.findMany({
      where: { workerId: worker.id, checkIn: { gte: startOfMonth } },
      orderBy: { checkIn: 'desc' },
    });

    let todayHours = 0;
    let weekHours = 0;
    let monthHours = 0;
    const weekDays = new Set();
    const monthDays = new Set();

    for (const a of attendances) {
      const h = hoursOf(a);
      const day = new Date(a.checkIn).toISOString().slice(0, 10);
      if (new Date(a.checkIn) >= startOfToday) todayHours += h;
      if (new Date(a.checkIn) >= startOfWeek) {
        weekHours += h;
        weekDays.add(day);
      }
      monthHours += h;
      monthDays.add(day);
    }

    const rate = Number(worker.salaryRate);
    const isHourly = worker.salaryType === 'HOURLY';
    const earn = (h, d) => (isHourly ? h * rate : d * rate);

    const open = attendances.find((a) => !a.checkOut) || null;

    res.json({
      worker: {
        salaryType: worker.salaryType,
        salaryRate: rate,
        department: worker.department,
      },
      openAttendance: open,
      today: {
        hours: Number(todayHours.toFixed(2)),
        earnings: Number(earn(todayHours, open ? 0 : 1).toFixed(2)),
      },
      week: {
        hours: Number(weekHours.toFixed(2)),
        days: weekDays.size,
        earnings: Number(earn(weekHours, weekDays.size).toFixed(2)),
      },
      month: {
        hours: Number(monthHours.toFixed(2)),
        days: monthDays.size,
        earnings: Number(earn(monthHours, monthDays.size).toFixed(2)),
      },
    });
  }),
);

router.get(
  '/worker/:workerId',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const attendances = await prisma.attendance.findMany({
      where: { workerId: req.params.workerId },
      orderBy: { checkIn: 'desc' },
      take: 200,
    });
    res.json({ attendances });
  }),
);

const adminCreateSchema = z
  .object({
    workerId: z.string().min(1),
    checkIn: z.coerce.date(),
    checkOut: z.coerce.date().nullable().optional(),
    breakMins: z.coerce.number().int().nonnegative().optional(),
    notes: z.string().optional(),
  })
  .refine((d) => !d.checkOut || d.checkOut >= d.checkIn, {
    path: ['checkOut'],
    message: 'Check-out must be after check-in',
  });

const adminUpdateSchema = z.object({
  checkIn: z.coerce.date().optional(),
  checkOut: z.coerce.date().nullable().optional(),
  breakMins: z.coerce.number().int().nonnegative().optional(),
  notes: z.string().nullable().optional(),
});

router.post(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = adminCreateSchema.parse(req.body);
    const worker = await prisma.worker.findUnique({ where: { id: data.workerId } });
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    const attendance = await prisma.attendance.create({
      data: {
        workerId: data.workerId,
        checkIn: data.checkIn,
        checkOut: data.checkOut ?? null,
        breakMins: data.breakMins ?? 0,
        notes: data.notes,
      },
      include: { worker: { include: { user: { select: { name: true, email: true } } } } },
    });
    res.status(201).json({ attendance });
  }),
);

router.patch(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = adminUpdateSchema.parse(req.body);
    const existing = await prisma.attendance.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Attendance not found' });
    const checkIn = data.checkIn ?? existing.checkIn;
    const checkOut = data.checkOut === undefined ? existing.checkOut : data.checkOut;
    if (checkOut && checkOut < checkIn) {
      return res.status(400).json({ error: 'Check-out must be after check-in', field: 'checkOut' });
    }
    const attendance = await prisma.attendance.update({
      where: { id: req.params.id },
      data: {
        ...(data.checkIn !== undefined ? { checkIn: data.checkIn } : {}),
        ...(data.checkOut !== undefined ? { checkOut: data.checkOut } : {}),
        ...(data.breakMins !== undefined ? { breakMins: data.breakMins } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
      include: { worker: { include: { user: { select: { name: true, email: true } } } } },
    });
    res.json({ attendance });
  }),
);

router.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    await prisma.attendance.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }),
);

router.get(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { from, to, workerId } = req.query;
    const where = {};
    if (workerId) where.workerId = String(workerId);
    if (from || to) {
      where.checkIn = {};
      if (from) where.checkIn.gte = new Date(String(from));
      if (to) where.checkIn.lte = new Date(String(to));
    }
    const attendances = await prisma.attendance.findMany({
      where,
      include: { worker: { include: { user: { select: { name: true, email: true } } } } },
      orderBy: { checkIn: 'desc' },
      take: 200,
    });
    res.json({ attendances });
  }),
);

export default router;
