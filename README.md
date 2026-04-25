# POS — Business Management System

A three-part application for managing workers, attendance, salaries, inventory, orders, and customer purchases.

```
POS/
├── backend/       Node.js + Express + Prisma + PostgreSQL REST API
├── admin-panel/   React + Vite + Tailwind + React Query (web)
└── mobile-app/    Flutter + Riverpod + Dio + go_router (Android/iOS)
```

---

## 1. Prerequisites

- Node.js 20+
- PostgreSQL 14+ running locally (or a remote URL)
- Flutter 3.19+ with Android Studio or Xcode set up

---

## 2. Backend

```bash
cd backend
cp .env.example .env
# edit .env: set DATABASE_URL and a strong JWT_SECRET
npm install
npx prisma migrate dev --name init     # creates tables
npm run db:seed                         # creates demo accounts and products
npm run dev
```

API runs on `http://localhost:4000`. Health check: `curl http://localhost:4000/health`.

**Seed accounts:**

| Role     | Email                  | Password     |
|----------|------------------------|--------------|
| Admin    | admin@pos.local        | admin123     |
| Worker   | worker@pos.local       | worker123    |
| Customer | customer@pos.local     | customer123  |

---

## 3. Admin Panel (Web)

```bash
cd admin-panel
cp .env.example .env        # VITE_API_URL defaults to http://localhost:4000
npm install
npm run dev
```

Open `http://localhost:5173`. Sign in as admin. Pages: Dashboard, Workers, Attendance, Products, Orders, Inventory, Reports.

---

## 4. Mobile App (Flutter)

The Flutter project in `mobile-app/` contains `pubspec.yaml`, `lib/`, and `analysis_options.yaml` but **no platform-specific folders** (android/, ios/). Generate them once:

```bash
cd mobile-app
flutter create --project-name pos_app --org com.example .   # adds android/ ios/ + platform config
flutter pub get
```

Run on a device or simulator:

```bash
# Android emulator (API can be reached at 10.0.2.2 — default kApiBaseUrl)
flutter run

# iOS simulator / desktop — override API host
flutter run --dart-define=API_URL=http://localhost:4000

# Physical device — use your LAN IP
flutter run --dart-define=API_URL=http://192.168.1.42:4000
```

**Sign in as** `worker@pos.local` to see the worker flow (check-in/out, salary, attendance history), or `customer@pos.local` for the customer flow (browse products, add to cart, place order). Admin accounts are redirected to a "use the web panel" screen.

---

## 5. What's implemented

- Auth with JWT + role-based access (ADMIN / WORKER / CUSTOMER)
- Workers CRUD (admin) + self-view (worker)
- Attendance: check-in / check-out (worker), list view + per-worker history (admin)
- Products CRUD (admin) + public catalog
- Orders: create (customer), list & status transitions (admin/worker)
- Inventory CRUD with low-stock flag (admin)
- Reports: dashboard counters, sales totals, salary calculation (hourly & daily) from attendance

## 6. Known limitations / next steps

- No file upload yet (product images stored as URL)
- Notifications module is not wired (no push/SMS/email provider)
- No offline mode in Flutter
- No tests yet — add Jest for backend, Vitest/RTL for admin, flutter_test for mobile
- Multi-store support, audit log, barcode scanning are in the spec but not scaffolded
