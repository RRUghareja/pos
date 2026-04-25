import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = (p) => bcrypt.hashSync(p, 10);

  await prisma.user.upsert({
    where: { email: 'admin@pos.local' },
    update: {},
    create: {
      email: 'admin@pos.local',
      name: 'Admin',
      role: 'ADMIN',
      passwordHash: hash('admin123'),
    },
  });

  await prisma.user.upsert({
    where: { email: 'worker@pos.local' },
    update: {},
    create: {
      email: 'worker@pos.local',
      name: 'Sam Worker',
      role: 'WORKER',
      passwordHash: hash('worker123'),
      worker: { create: { salaryType: 'HOURLY', salaryRate: 20, department: 'Production' } },
    },
  });

  await prisma.user.upsert({
    where: { email: 'customer@pos.local' },
    update: {},
    create: {
      email: 'customer@pos.local',
      name: 'Casey Customer',
      role: 'CUSTOMER',
      passwordHash: hash('customer123'),
      customer: { create: { address: '123 Main St' } },
    },
  });

  const products = [
    { id: 'seed-espresso', name: 'Espresso', price: 3.5, category: 'Drinks', stock: 100 },
    { id: 'seed-latte', name: 'Latte', price: 4.5, category: 'Drinks', stock: 80 },
    { id: 'seed-croissant', name: 'Croissant', price: 2.75, category: 'Bakery', stock: 40 },
    { id: 'seed-sandwich', name: 'Sandwich', price: 6.5, category: 'Food', stock: 25 },
  ];
  for (const p of products) {
    await prisma.product.upsert({ where: { id: p.id }, update: {}, create: p });
  }

  await prisma.inventoryItem.upsert({
    where: { id: 'seed-inv-beans' },
    update: {},
    create: {
      id: 'seed-inv-beans',
      name: 'Coffee Beans',
      category: 'Raw Material',
      quantity: 50,
      unit: 'kg',
      minStockLevel: 10,
      supplierName: 'Bean Co',
      costPrice: 12,
      sellingPrice: 20,
    },
  });

  console.log('Seed complete.');
  console.log('Admin:    admin@pos.local    / admin123');
  console.log('Worker:   worker@pos.local   / worker123');
  console.log('Customer: customer@pos.local / customer123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
