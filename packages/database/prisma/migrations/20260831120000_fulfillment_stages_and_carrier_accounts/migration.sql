-- Fulfillment pipeline stages + per-tenant Aramex credentials.

-- AlterEnum: two pre-transit fulfillment stages, sitting between "order placed"
-- and "courier has it". Purely additive: every existing Order row keeps its
-- current status and no row is rewritten. BEFORE 'PROCESSING' keeps the physical
-- enum ordering aligned with the pipeline, so ORDER BY status stays meaningful.
--
-- Postgres refuses to *use* a value added by ALTER TYPE ADD VALUE inside the
-- transaction that added it, so nothing below writes these two values.
ALTER TYPE "OrderStatus" ADD VALUE 'READY_FOR_SHIPMENT' BEFORE 'PROCESSING';
ALTER TYPE "OrderStatus" ADD VALUE 'PICKUP_REQUESTED' BEFORE 'PROCESSING';

-- Reduce Courier to the one carrier that is actually implemented. Postgres has
-- no DROP VALUE, so the type is recreated and its two dependent columns are
-- re-pointed.
--
-- DESTRUCTIVE: shipments and webhook events on a retired courier are deleted
-- first. They would otherwise fail the cast below and abort the migration —
-- and since docker-entrypoint.sh runs `prisma migrate deploy` under `set -e`,
-- an aborted migration crashloops the API rather than failing quietly. There is
-- no longer any code that can track, print or collect those parcels, so the
-- rows are unrecoverable in the application sense either way.
DELETE FROM "WebhookEvent"
WHERE "shipmentId" IN (SELECT "id" FROM "Shipment" WHERE "courier" <> 'ARAMEX');
DELETE FROM "WebhookEvent" WHERE "courier" <> 'ARAMEX';
DELETE FROM "Shipment" WHERE "courier" <> 'ARAMEX';

ALTER TYPE "Courier" RENAME TO "Courier_old";
CREATE TYPE "Courier" AS ENUM ('ARAMEX');

ALTER TABLE "Shipment"
    ALTER COLUMN "courier" TYPE "Courier" USING ("courier"::text::"Courier");
ALTER TABLE "WebhookEvent"
    ALTER COLUMN "courier" TYPE "Courier" USING ("courier"::text::"Courier");

DROP TYPE "Courier_old";

-- CreateTable: Aramex authenticates with a six-field ClientInfo block, not a
-- single API key, which is why this is a table rather than columns on Tenant.
CREATE TABLE "CourierAccount" (
    "id" TEXT NOT NULL,
    "courier" "Courier" NOT NULL DEFAULT 'ARAMEX',
    "enabled" BOOLEAN NOT NULL DEFAULT false,

    "username" TEXT,
    "passwordCipher" TEXT,
    "accountNumber" TEXT,
    "accountPinCipher" TEXT,
    "accountEntity" TEXT,
    "accountCountryCode" TEXT,
    "version" TEXT NOT NULL DEFAULT 'v1.0',

    "productGroup" TEXT NOT NULL DEFAULT 'EXP',
    "productType" TEXT NOT NULL DEFAULT 'PPX',
    "codCurrency" TEXT NOT NULL DEFAULT 'USD',

    "testMode" BOOLEAN NOT NULL DEFAULT true,

    -- Aramex requires a full Shipper party on CreateShipments and the same
    -- details again as PickupAddress/PickupContact on CreatePickup. Nothing else
    -- in the app holds a merchant's physical address.
    "shipperCompany" TEXT,
    "shipperContactName" TEXT,
    "shipperPhone" TEXT,
    "shipperCellPhone" TEXT,
    "shipperEmail" TEXT,
    "shipperLine1" TEXT,
    "shipperCity" TEXT,
    "shipperStateCode" TEXT,
    "shipperPostCode" TEXT,
    "shipperCountryCode" TEXT,

    "webhookSecretCipher" TEXT,

    "lastTestedAt" TIMESTAMP(3),
    "lastTestOk" BOOLEAN,
    "lastTestError" TEXT,

    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourierAccount_pkey" PRIMARY KEY ("id")
);

-- One carrier per tenant, which is why there is no "default carrier" flag.
CREATE UNIQUE INDEX "CourierAccount_tenantId_key" ON "CourierAccount"("tenantId");

-- AddForeignKey
ALTER TABLE "CourierAccount" ADD CONSTRAINT "CourierAccount_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: a tenant that had an Aramex key gets an account carrying it as the
-- *inbound webhook secret*, which is all that column ever was. It is copied as
-- plaintext because SQL cannot call our cipher; SecretCipherService treats any
-- value without the "v1:" prefix as legacy plaintext and re-encrypts it on the
-- next write, which is why no separate backfill script is needed.
--
-- `enabled` stays false: a webhook secret is not an outbound credential, so the
-- account cannot book a parcel until the merchant enters its ClientInfo fields.
INSERT INTO "CourierAccount" ("id", "courier", "enabled", "webhookSecretCipher", "tenantId", "createdAt", "updatedAt")
SELECT "id" || '_aramex', 'ARAMEX'::"Courier", false,
       "aramexApiKey", "id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Tenant" WHERE "aramexApiKey" IS NOT NULL;

-- AlterTable: label and pickup results, populated by the on-demand fulfillment
-- actions. trackingNumber already holds what Aramex calls the AWB number, so no
-- new column for it.
ALTER TABLE "Shipment"
    ADD COLUMN "courierAccountId" TEXT,
    ADD COLUMN "labelPdf" BYTEA,
    ADD COLUMN "labelPdfUrl" TEXT,
    ADD COLUMN "awbGeneratedAt" TIMESTAMP(3),
    ADD COLUMN "pickupReference" TEXT,
    ADD COLUMN "pickupScheduledAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_courierAccountId_fkey"
    FOREIGN KEY ("courierAccountId") REFERENCES "CourierAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DropColumn: superseded by CourierAccount, which splits the inbound webhook
-- secret from the outbound credentials. These three columns conflated the two,
-- so rotating either one silently broke the other. Dropped only after the
-- backfill above has copied the Aramex value.
ALTER TABLE "Tenant"
    DROP COLUMN "yalidineApiKey",
    DROP COLUMN "aramexApiKey",
    DROP COLUMN "jexportApiKey";
