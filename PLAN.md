# Mnadhem — Build Plan

## Architecture Decisions

| Decision | Choice | Notes |
|---|---|---|
| Auth | Auth.js v5 — JWT strategy | JWT issued by Next.js. NestJS validates same secret. No DB session models. Tenant ID stored in JWT custom claims, forwarded as `x-tenant-id` header. |
| Courier payloads | Normalized adapter layer | `ICourierWebhookPayload` interface. One adapter class per courier. State machine never touches raw payloads. |
| API communication | REST | NestJS exposes routes. `apps/web` calls them with `fetch` + Bearer token. |
| Real-time UI | Manual refresh for v1 | No SSE/WebSocket. Can layer on later. |
| shadcn/ui | Option A — install in `apps/web` | `npx shadcn init` runs inside `apps/web`. `packages/ui` stays as a thin re-export layer for truly shared primitives only. |
| Order stock reservation | Immediate (Option A) | Manual order creation atomically reserves stock. Cancel/soft-delete rolls back. EN_COURS webhook skips mutation if order is already `PENDING_FULFILLMENT`. |
| Storefront integration | Shell + Guardrail (Option B) | `storeType` on Tenant flags User A. Sync-warning modal implemented. Actual Shopify/WooCommerce OAuth is a future phase. |
| CSV import staging | Client-side (Option A) | PapaParse validates in browser, preview table shows errors inline, clean rows POSTed to bulk-create endpoint. No DB staging table needed. |
| Soft delete scope | Product, Variant, Order | `deletedAt DateTime?` added to these three models. Shipment excluded (already an immutable audit trail). Soft-deleting a `PENDING_FULFILLMENT` order triggers a stock rollback transaction. |

---

## UI Dictionary (Brand Terminology)

Never expose developer field names to merchants. All UI labels use these mappings:

| DB field | UI label | Description |
|---|---|---|
| `stockPhysical` | **In Warehouse** | Total physical units on the shelves |
| `stockReserved` | **Committed / Packed** | Units locked inside packages handed to couriers |
| `stockAvailable` | **Ready to Sell** | True remaining units safe to allocate |

---

## Order Status State Machine

`Order.status` is the merchant-facing business state. `Shipment.status` is the courier-facing logistics state. They run in parallel.

```
PENDING_FULFILLMENT  ←  manual order created; stock reserved immediately
       │
       ├──[courier EN_COURS webhook]──→  PROCESSING   (stock already reserved, no mutation)
       │                                      │
       │                          ┌───────────┴───────────┐
       │                    [LIVRE webhook]         [RETOURNE/HORS_ZONE]
       │                          ↓                        ↓
       │                      DELIVERED               RETURNED
       │                   (Physical--, Reserved--)  (Reserved--, Available++)
       │
       └──[merchant cancels]──→  CANCELLED  (Available++, Reserved--)
```

| `OrderStatus` | UI badge label | Badge color |
|---|---|---|
| `PENDING_FULFILLMENT` | En attente | Slate |
| `PROCESSING` | En cours | Amber |
| `DELIVERED` | Livré | Green |
| `RETURNED` | Retourné | Red |
| `CANCELLED` | Annulé | Slate / muted |

---

## Two User Tracks

| | User B — Social Commerce | User A — Storefront Connected |
|---|---|---|
| `storeType` | `MANUAL` | `SHOPIFY` / `WOOCOMMERCE` |
| Order entry | Manual form in dashboard | (Future: storefront webhook) |
| CRUD freedom | Ungoverned — standard confirmation dialogs | Governed — sync-warning modal on any edit/delete of synced items |
| Onboarding path | Store name + slug → dashboard | Store name + slug + "Beta Access" card → dashboard |

---

## Phase 1 — Foundation ✅ Complete

- [x] Delete `apps/docs` (unused Turborepo placeholder)
- [x] Scaffold `apps/api` — NestJS application (SWC builder, PrismaModule wired)
- [x] Configure `turbo.json` — already task-based, auto-discovers all workspaces
- [x] Export shared Prisma client from `packages/database/src/index.ts` (`@prisma/adapter-pg` + `Pool`)
- [x] Auth.js v5 in `apps/web` — JWT strategy, credentials provider, session carries `userId` + `activeTenantId`
- [x] Run `prisma migrate dev --name init` — migration `20260627182025_init` applied to `mnadhem_db`
- [x] Verify: sign-in page at `/sign-in`, dashboard at `/dashboard`, `tsc --noEmit` passes clean

**Notes:**
- Prisma 7 new TS client requires `{ adapter }` — using `@prisma/adapter-pg` with `pg.Pool` for standard PostgreSQL.
- NestJS uses SWC builder (handles `import.meta.url` in CJS, avoids webpack rootDir issues).
- Both `apps/api` and `packages/database` declare `@prisma/adapter-pg` + `pg` as dependencies.

---

## Phase 2 — Webhook Engine ✅ Complete

- [x] Define `ICourierWebhookPayload` normalized interface in `apps/api/src/webhooks/interfaces/`
- [x] Stub adapter classes: `YalidineAdapter`, `AramexAdapter`, `JexportAdapter` (status maps + validateSignature stubs)
- [x] `WebhooksController` — `POST /api/v1/webhooks/:tenantSlug/:courier`
  - Validates `x-api-key` header against tenant's stored courier key
  - Routes to correct adapter → normalizes to `ICourierWebhookPayload`
  - Calls `InventoryStateMachineService`
- [x] `InventoryStateMachineService` — all mutations inside `prisma.$transaction`:
  - `EN_COURS`   → `stockReserved++`, `stockAvailable--`
  - `LIVRE`      → `stockPhysical--`, `stockReserved--`, sets `collectedCash`
  - `RETOURNE`   → `stockReserved--`, `stockAvailable++`
  - `HORS_ZONE`  → same as `RETOURNE`
- [x] `WebhookEvent` audit record written on every transition (matched or unmatched)

---

## Phase 3 — Management REST API ✅ Complete

- [x] NestJS JWT Guard — validates Auth.js token, extracts `userId` + `tenantId`
- [x] Tenant-scope via `@TenantId()` decorator injected into every service call
- [x] Modules + controllers + services:
  - `TenantsModule` — create store, update courier API keys
  - `ProductsModule` — CRUD products (hard delete, to be upgraded in Checkpoint 3)
  - `VariantsModule` — CRUD variants, manual stock adjustment endpoint (in `$transaction`)
  - `OrdersModule` — create order with price capture, list/get orders (no stock reservation yet)
  - `ShipmentsModule` — create shipment (links tracking number to order)

---

## Phase 4 — Operational Engine & Dashboard (In Progress)

This phase completes the frontend dashboard and upgrades the API to support the full merchant workflow. Execution is strictly dependency-first.

### Checkpoint 0 — Schema Migration
**File:** `packages/database/prisma/schema.prisma`
**Migration name:** `add_order_status_soft_delete_store_type`

- [ ] Add enum `OrderStatus { PENDING_FULFILLMENT PROCESSING DELIVERED RETURNED CANCELLED }`
- [ ] Add enum `StoreType { MANUAL SHOPIFY WOOCOMMERCE }`
- [ ] `Tenant`: add `storeType StoreType @default(MANUAL)`
- [ ] `Order`: add `status OrderStatus @default(PENDING_FULFILLMENT)`
- [ ] `Order`: add `deletedAt DateTime?`
- [ ] `Product`: add `deletedAt DateTime?`
- [ ] `Variant`: add `deletedAt DateTime?`
- [ ] Run `prisma migrate dev` and verify generated client

---

### Checkpoint 1 — State Machine Extension
**File:** `apps/api/src/webhooks/inventory-state-machine.service.ts`

- [ ] Add `reserveForManualOrder(items: { variantId, quantity }[], tenantId, tx)`:
  - Fetches each variant inside the transaction (row-level lock)
  - Guards: throws `BadRequestException` if `stockAvailable < quantity` for any item
  - Mutates: `stockAvailable -= quantity`, `stockReserved += quantity` per item

- [ ] Add `releaseOrderReservation(orderId, tenantId, tx)`:
  - Loads `order.items` via the transaction client
  - For each item: `stockAvailable += quantity`, `stockReserved -= quantity`
  - Called by cancel and soft-delete paths

- [ ] Update `EN_COURS` handler:
  - After finding `Shipment`, load linked `Order`
  - If `order.status === PENDING_FULFILLMENT` → **skip stock mutation** (already reserved), update `Order.status → PROCESSING` and `Shipment.status → EN_COURS` only
  - Otherwise → execute original mutation (`stockAvailable--`, `stockReserved++`) then update statuses

- [ ] Update `LIVRE` handler:
  - After existing mutations, also update `Order.status → DELIVERED`

- [ ] Update `RETOURNE` / `HORS_ZONE` handler:
  - After existing mutations, also update `Order.status → RETURNED`

---

### Checkpoint 2 — Orders API: New Endpoints
**Files:** `apps/api/src/orders/orders.controller.ts`, `orders.service.ts`, `dto/create-manual-order.dto.ts`

- [ ] `POST /orders/manual`:
  - Accepts: `{ reference, customerName, customerPhone, wilaya, commune?, address?, codAmount, items: [{ variantId, quantity }] }`
  - Inside single `prisma.$transaction`: calls `reserveForManualOrder`, creates `Order` (`status: PENDING_FULFILLMENT`) and `OrderItem` records (unit price captured from variant)
  - Returns full order with items

- [ ] `PATCH /orders/:id/cancel`:
  - Guards: only allowed when `order.status === PENDING_FULFILLMENT`
  - Inside `prisma.$transaction`: calls `releaseOrderReservation`, sets `order.status → CANCELLED`

- [ ] `DELETE /orders/:id` (soft delete):
  - If `order.status === PENDING_FULFILLMENT` → calls `releaseOrderReservation` in same transaction
  - Sets `order.deletedAt = new Date()`
  - `PROCESSING` / `DELIVERED` orders: soft-deletes record only, stock not touched

- [ ] Update `findAll` and `findOne` to filter `deletedAt: null`

---

### Checkpoint 3 — Products & Variants: Soft Delete
**Files:** `apps/api/src/products/products.service.ts`, `apps/api/src/variants/variants.service.ts`

- [ ] `ProductsService.remove(id, tenantId)`:
  - Guards: throws `ConflictException` if any child variant has `stockReserved > 0`
  - Inside `prisma.$transaction`: soft-deletes all child `Variant` records (`updateMany`), then soft-deletes the `Product`

- [ ] `VariantsService.remove(id, tenantId)`:
  - Guards: throws `ConflictException` if `variant.stockReserved > 0`
  - Sets `variant.deletedAt = new Date()`

- [ ] Update all `findAll` / `findOne` queries across both services to add `deletedAt: null` to `where` clauses

---

### Checkpoint 4 — Bulk Create Endpoint
**Files:** `apps/api/src/products/products.controller.ts`, `products.service.ts`, `dto/bulk-create.dto.ts`

- [ ] `POST /products/bulk-create`:
  - Accepts: `{ rows: [{ sku, name, stockPhysical, variantName?, price }] }`
  - Inside single `prisma.$transaction`: upserts `Product` by `(tenantId, sku)`, creates `Variant` with `stockPhysical` and `stockAvailable` both set from the provided value
  - Returns: `{ created: N, skipped: M }` summary

---

### Checkpoint 5 — Onboarding Fork
**File:** `apps/web/app/onboarding/page.tsx`

Convert to a two-step client-side flow:

- [ ] **Step 1 — "How do you capture orders?"**
  - Two large selection cards:
    - "I sell via social media or phone" → `storeType: MANUAL`
    - "I have a website (Shopify / WooCommerce)" → `storeType: SHOPIFY`
  - Selection animates to Step 2

- [ ] **Step 2A (MANUAL):** Store name + slug form → server action creates tenant with `storeType: MANUAL` → redirect `/inventory`

- [ ] **Step 2B (SHOPIFY):** Store name + slug + a polished "Shopify Sync — Request Beta Access" card (email capture field) → server action creates tenant with `storeType: SHOPIFY` → redirect `/inventory`

---

### Checkpoint 6 — Inventory Page Overhaul
**Files:** `apps/web/app/(dashboard)/inventory/page.tsx` (server data-fetch shell) + `apps/web/components/inventory/inventory-client.tsx` (client component for CRUD)

- [ ] Rename column headers to brand terminology: Physical → **In Warehouse**, Reserved → **Committed / Packed**, Available → **Ready to Sell**

- [ ] Replace "Use the API" empty state with a merchant-friendly CTA: "Add your first product to start tracking your stock."

- [ ] `AddProductDialog` (shadcn `Dialog`): fields — Product Name, SKU (optional), Description → `POST /products`

- [ ] `AddVariantSheet` (shadcn `Sheet`, per product): fields — Variant name, Color, Size, SKU, Price, Initial Stock ("How many units are in your warehouse today?") → `POST /products/:id/variants`

- [ ] Row actions (three-dot menu per product and variant row):
  - Edit → pre-filled dialog → `PATCH /products/:id` or `PATCH /variants/:id`
  - Delete → confirmation dialog → `DELETE /products/:id` or `DELETE /variants/:id`
  - **Sync-Warning Modal** (fires before edit/delete when `tenant.storeType !== MANUAL`):
    > "This item is synced with [Shopify / WooCommerce]. Editing it here may desync your storefront. We recommend making changes inside your storefront dashboard instead."
    > Buttons: `Cancel` | `Proceed Anyway`

- [ ] Adjust Stock action (per variant): small modal with delta input (+/-) and optional reason → `PATCH /variants/:id/adjust`

- [ ] **Bulk Import** button → opens `Sheet`:
  - File input accepts `.csv` / `.xlsx`
  - PapaParse processes file client-side
  - Preview table shows all rows; rows with missing `sku`, missing `name`, or duplicate SKUs highlighted in red
  - "Confirm Import" button → `POST /products/bulk-create` → dismisses sheet, re-fetches table

---

### Checkpoint 7 — Orders Page Overhaul
**Files:** `apps/web/app/(dashboard)/orders/page.tsx` + `apps/web/components/orders/orders-client.tsx`

- [ ] Update status badges to use `OrderStatus` (see UI badge table above)

- [ ] Replace "Create orders via the API" empty state with: "No orders yet. Add your first order to start tracking your COD pipeline."

- [ ] **New Order button** → opens `CreateOrderSheet`:
  - Section 1 — Customer: Name, Phone, Wilaya (dropdown of all 58 Tunisian wilayas), Commune, Address
  - Section 2 — Items: searchable variant picker (by SKU or product name), quantity input, live "Ready to Sell" stock badge per item
  - Section 3 — Review: auto-calculated COD total, auto-generated reference or manual override
  - On submit → `POST /orders/manual` → immediate stock reservation

- [ ] Cancel action (only visible on `PENDING_FULFILLMENT` rows): confirmation dialog → `PATCH /orders/:id/cancel`

---

### Checkpoint 8 — Settings Page Overhaul
**File:** `apps/web/app/(dashboard)/settings/page.tsx`

- [ ] Load current tenant values on mount: `GET /tenants/me` → pre-populate all form fields

- [ ] Courier API keys section redesign — replace plain labels with branded rows:
  - **Yalidine** logo + name as section header
  - **Aramex** logo + name as section header
  - **Jexport** logo + name as section header
  - Each courier has a collapsible "How to find your key" section with numbered steps:
    - Yalidine: "1. Log in at yalidine.app → 2. Click Mon Profil → 3. Copy your Token d'accès"
    - Aramex: "1. Log in at aramex.com → 2. Go to API Access → 3. Copy your API Key"
    - Jexport: equivalent steps

---

## Execution Order

```
[0] Schema migration            ← blocks everything
[1] State machine extension     ← blocks orders API
[2] Orders API new endpoints    ← blocks orders UI
[3] Products/Variants soft delete ← blocks inventory CRUD
[4] Bulk create endpoint        ← blocks CSV import UI
[5] Onboarding fork UI          ← independent
[6] Inventory page overhaul     ← depends on 3, 4
[7] Orders page overhaul        ← depends on 2
[8] Settings page overhaul      ← independent
```

---

## Key File Map

| Path | Purpose |
|---|---|
| `packages/database/prisma/schema.prisma` | Single source of truth for all models |
| `packages/database/src/index.ts` | Exports shared `PrismaClient` instance |
| `apps/api/src/webhooks/inventory-state-machine.service.ts` | All stock mutations, manual reservation, rollback |
| `apps/api/src/webhooks/` | Courier adapters + state machine |
| `apps/api/src/common/guards/jwt.guard.ts` | Auth guard for all protected routes |
| `apps/api/src/common/decorators/user.decorator.ts` | `@TenantId()` decorator |
| `apps/web/app/(auth)/` | Sign-in / sign-up pages |
| `apps/web/app/(dashboard)/` | All protected dashboard pages |
| `apps/web/app/onboarding/` | Two-step onboarding fork |
| `apps/web/components/inventory/` | Inventory CRUD client components |
| `apps/web/components/orders/` | Orders CRUD client components |
| `apps/web/components/ui/` | shadcn/ui generated components |

---

## Constraints

- All inventory mutations (`stockPhysical`, `stockReserved`, `stockAvailable`) **must** use `prisma.$transaction`
- Manual order creation **must** call `InventoryStateMachineService.reserveForManualOrder` — never mutate stock directly in `OrdersService`
- Webhook `EN_COURS` handler **must** check `order.status` before deciding whether to mutate stock
- Soft-delete of a `PENDING_FULFILLMENT` order **must** roll back stock in the same transaction
- Webhook controllers **must** validate payloads before processing
- Never read schema or model field names from memory — always check `schema.prisma`
- One checkpoint at a time, one file at a time — await approval before proceeding
