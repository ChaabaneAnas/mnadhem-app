-- DropIndex
DROP INDEX "Product_tenantId_sku_key";

-- DropIndex
DROP INDEX "Variant_productId_sku_key";

-- CreateIndex
CREATE INDEX "Product_tenantId_sku_idx" ON "Product"("tenantId", "sku");

-- CreateIndex
CREATE INDEX "Variant_productId_sku_idx" ON "Variant"("productId", "sku");

-- Partial unique index: SKU unique per tenant only among active (non-archived) products
CREATE UNIQUE INDEX "Product_tenantId_sku_key" ON "Product"("tenantId", "sku") WHERE "deletedAt" IS NULL;

-- Partial unique index: SKU unique per product only among active (non-archived) variants
CREATE UNIQUE INDEX "Variant_productId_sku_key" ON "Variant"("productId", "sku") WHERE "deletedAt" IS NULL;
