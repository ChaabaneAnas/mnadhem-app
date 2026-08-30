-- Renamed rather than dropped/recreated: this column has always held in-transit
-- COD value, and the rename only makes that explicit now that a second money
-- metric sits beside it. Prisma's own diff emits DROP + ADD here, which would
-- silently discard every historical snapshot.
ALTER TABLE "MetricSnapshot" RENAME COLUMN "floatingCapital" TO "cashInTransit";

-- Cash the courier collected on delivery but has not yet remitted to the merchant.
ALTER TABLE "MetricSnapshot" ADD COLUMN "awaitingRemittance" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Backs the awaiting-remittance sum, which runs on every dashboard load.
CREATE INDEX "Shipment_status_remittedAt_idx" ON "Shipment"("status", "remittedAt");
