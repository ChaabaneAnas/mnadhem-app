-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_FULFILLMENT', 'PROCESSING', 'DELIVERED', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StoreType" AS ENUM ('MANUAL', 'SHOPIFY', 'WOOCOMMERCE');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_FULFILLMENT';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "storeType" "StoreType" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "Variant" ADD COLUMN     "deletedAt" TIMESTAMP(3);
