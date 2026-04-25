import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import authRoutes from './routes/auth.js';
import workerRoutes from './routes/workers.js';
import attendanceRoutes from './routes/attendance.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import inventoryRoutes from './routes/inventory.js';
import customerRoutes from './routes/customers.js';
import reportRoutes from './routes/reports.js';
import cuisineRoutes from './routes/cuisines.js';
import { errorHandler } from './middleware/error.js';

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? '*', credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/cuisines', cuisineRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

export default app;
