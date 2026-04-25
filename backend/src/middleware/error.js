import { ZodError } from 'zod';

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Validation failed', details: err.errors });
  }
  if (err?.code === 'P2002') {
    const target = err.meta?.target;
    const fields = Array.isArray(target) ? target : target ? [target] : [];
    const labels = fields.map((f) => {
      if (f === 'email') return 'email';
      if (f === 'phone') return 'phone number';
      return f;
    });
    const message = labels.length
      ? `This ${labels.join(' and ')} is already in use.`
      : 'This value is already in use.';
    return res.status(409).json({ error: message, field: fields[0] });
  }
  if (err?.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found' });
  }
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
}
