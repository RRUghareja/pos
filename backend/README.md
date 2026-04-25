# POS Backend

Node.js + Express + Prisma + PostgreSQL API.

## Quick start

```bash
cp .env.example .env   # edit DATABASE_URL / JWT_SECRET
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

API runs at `http://localhost:4000`. Health check: `GET /health`.

## Seed accounts

| Role     | Email                   | Password     |
|----------|-------------------------|--------------|
| Admin    | admin@pos.local         | admin123     |
| Worker   | worker@pos.local        | worker123    |
| Customer | customer@pos.local      | customer123  |

## Endpoints (high level)

- `POST /api/auth/register` — public (customer/worker)
- `POST /api/auth/login` — public
- `GET  /api/auth/me` — any authed user
- `GET/POST/PATCH/DELETE /api/workers` — admin
- `POST /api/attendance/check-in`, `/check-out`, `GET /me` — worker
- `GET /api/attendance` — admin list
- `GET/POST/PATCH/DELETE /api/products` — public GET, admin writes
- `GET/POST/PATCH /api/orders` — role-scoped
- `GET/POST/PATCH/DELETE /api/inventory` — admin
- `GET /api/reports/salary`, `/sales`, `/dashboard` — admin
