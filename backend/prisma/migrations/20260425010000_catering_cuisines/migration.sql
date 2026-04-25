-- CreateEnum
CREATE TYPE "InventoryType" AS ENUM ('RAW_MATERIAL', 'KITCHEN_EQUIPMENT', 'OTHER');

-- AlterTable: tag inventory items
ALTER TABLE "InventoryItem" ADD COLUMN "type" "InventoryType" NOT NULL DEFAULT 'OTHER';

-- CreateTable Cuisine
CREATE TABLE "Cuisine" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "pricePerPlate" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cuisine_pkey" PRIMARY KEY ("id")
);

-- CreateTable CuisineProduct
CREATE TABLE "CuisineProduct" (
    "id" TEXT NOT NULL,
    "cuisineId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unit" TEXT,

    CONSTRAINT "CuisineProduct_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CuisineProduct_cuisineId_productId_key" ON "CuisineProduct"("cuisineId", "productId");
CREATE INDEX "CuisineProduct_productId_idx" ON "CuisineProduct"("productId");

ALTER TABLE "CuisineProduct" ADD CONSTRAINT "CuisineProduct_cuisineId_fkey" FOREIGN KEY ("cuisineId") REFERENCES "Cuisine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CuisineProduct" ADD CONSTRAINT "CuisineProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable OrderCuisine
CREATE TABLE "OrderCuisine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "cuisineId" TEXT NOT NULL,
    "plates" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "OrderCuisine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderCuisine_orderId_cuisineId_key" ON "OrderCuisine"("orderId", "cuisineId");
CREATE INDEX "OrderCuisine_cuisineId_idx" ON "OrderCuisine"("cuisineId");

ALTER TABLE "OrderCuisine" ADD CONSTRAINT "OrderCuisine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderCuisine" ADD CONSTRAINT "OrderCuisine_cuisineId_fkey" FOREIGN KEY ("cuisineId") REFERENCES "Cuisine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
