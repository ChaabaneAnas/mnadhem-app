-- Renames the shipment vocabulary from French to English so the codebase speaks
-- one language and translation is left entirely to next-intl on the frontend.
--
-- Postgres renames enum values in place, preserving every existing row. Prisma's
-- generated diff instead creates a new type and casts through text, which does
-- not merely lose data — it raises "invalid input value for enum" on any row
-- still holding an old value, failing the migration and blocking the deploy.
ALTER TYPE "ShipmentStatus" RENAME VALUE 'EN_COURS' TO 'IN_TRANSIT';
ALTER TYPE "ShipmentStatus" RENAME VALUE 'LIVRE' TO 'DELIVERED';
ALTER TYPE "ShipmentStatus" RENAME VALUE 'RETOURNE' TO 'RETURNED';
ALTER TYPE "ShipmentStatus" RENAME VALUE 'HORS_ZONE' TO 'OUT_OF_ZONE';

-- WebhookEvent.eventType is a plain string carrying the same normalized
-- vocabulary, so historical audit rows move with it. Without this, a query for
-- 'DELIVERED' would silently miss every event recorded before this migration.
-- The courier's original wording is untouched inside `payload`.
UPDATE "WebhookEvent" SET "eventType" = 'IN_TRANSIT'  WHERE "eventType" = 'EN_COURS';
UPDATE "WebhookEvent" SET "eventType" = 'DELIVERED'   WHERE "eventType" = 'LIVRE';
UPDATE "WebhookEvent" SET "eventType" = 'RETURNED'    WHERE "eventType" = 'RETOURNE';
UPDATE "WebhookEvent" SET "eventType" = 'OUT_OF_ZONE' WHERE "eventType" = 'HORS_ZONE';
