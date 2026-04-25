-- CreateTable: OrderWorker (created before column drop so we can copy data)
CREATE TABLE "OrderWorker" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderWorker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderWorker_workerId_idx" ON "OrderWorker"("workerId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderWorker_orderId_workerId_key" ON "OrderWorker"("orderId", "workerId");

-- AddForeignKey
ALTER TABLE "OrderWorker" ADD CONSTRAINT "OrderWorker_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderWorker" ADD CONSTRAINT "OrderWorker_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing single-worker assignments into the new join table
INSERT INTO "OrderWorker" ("id", "orderId", "workerId", "assignedAt")
SELECT
    'ow_' || substr(md5(random()::text || "id"), 1, 22),
    "id",
    "assignedWorkerId",
    NOW()
FROM "Order"
WHERE "assignedWorkerId" IS NOT NULL;

-- Now drop the legacy column
ALTER TABLE "Order" DROP CONSTRAINT "Order_assignedWorkerId_fkey";
ALTER TABLE "Order" DROP COLUMN "assignedWorkerId";

-- AlterTable: add new optional fields
ALTER TABLE "Order" ADD COLUMN "location" TEXT;
ALTER TABLE "Order" ADD COLUMN "scheduledFor" TIMESTAMP(3);

-- CreateTable: OrderInventoryItem
CREATE TABLE "OrderInventoryItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "OrderInventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderInventoryItem_inventoryItemId_idx" ON "OrderInventoryItem"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderInventoryItem_orderId_inventoryItemId_key" ON "OrderInventoryItem"("orderId", "inventoryItemId");

-- AddForeignKey
ALTER TABLE "OrderInventoryItem" ADD CONSTRAINT "OrderInventoryItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderInventoryItem" ADD CONSTRAINT "OrderInventoryItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
