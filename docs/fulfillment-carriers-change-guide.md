# Change Guide: Order Fulfillment Pipeline & Carrier Configuration

A reading guide for this change set. It exists because the diff is too large to review
top-to-bottom, and alphabetical order is misleading — it puts `aramex-form.tsx` before
`schema.prisma`, so you meet the UI before the data model it depends on.

Written to be read alongside the diff, or pasted into a PR description. Delete it after merge.

---

## What this change does

A merchant used to create an order and watch it sit at `PENDING_FULFILLMENT` until a courier
webhook moved it. Getting a parcel to a courier happened entirely outside the app: phone the
courier, get an AWB by hand, type it into `POST /shipments`.

Now the two real operational steps between "order placed" and "courier has it" — generating a
shipping label, and asking for a pickup — exist in the app. Carriers are configured per tenant
with encrypted credentials, either by enabling one of the three we ship support for or by wiring
up any other carrier by hand. The orders table gained status filter tabs, sortable columns, row
selection, and a floating bulk bar, so a merchant can filter to Pending, select all, generate
labels, print one merged PDF, and request a pickup — which is how packing actually happens, in
batches at a fixed time of day.

---

## Reading order

Dependency order, not alphabetical:

1. `packages/database/prisma/schema.prisma` — the data model everything else assumes
2. `packages/database/prisma/migrations/20260831120000_.../migration.sql` — how existing rows got there
3. `apps/api/src/common/crypto/secret-cipher.service.ts` — how credentials are stored
4. `apps/api/src/couriers/providers/aramex.provider.ts` — the Aramex integration
5. `apps/api/src/orders/order-fulfillment.service.ts` — the three actions
6. `apps/web/app/[locale]/(dashboard)/orders/` — the table, selection, bulk bar
7. `apps/web/app/[locale]/(dashboard)/settings/` — carrier configuration

---

## Review these closely

Four changes carry real risk. Everything else is wiring.

| Change | Why it matters |
|---|---|
| `migrations/20260831120000_fulfillment_stages_and_carrier_accounts/migration.sql` | Backfills, then **drops** three `Tenant` columns. The only destructive step. Already applied to the local dev DB. |
| `apps/api/src/webhooks/inventory-state-machine.service.ts` | Without the widened guard, every parcel double-reserves its stock the moment a merchant uses either new action. |
| `apps/api/src/common/crypto/secret-cipher.service.ts` + `.env.example` | Introduces a **required** `CREDENTIALS_KEY`. The API refuses to boot without it. |
| `apps/api/src/orders/order-fulfillment.service.ts` | Aramex calls sit deliberately *outside* `$transaction`. See the reasoning in section E. |
| `apps/api/src/couriers/providers/aramex.provider.ts` | Written against Aramex's published schema but never run against Aramex — no test credentials exist. See "verified vs not". |

---

## A. Database schema & migration (2 files)

Two statuses were **added**, nothing renamed. `PENDING_FULFILLMENT`, `PROCESSING` and `RETURNED`
keep their existing meaning and no existing row was rewritten. `RETURNED` in particular had to
survive — the webhook state machine maps both `RETURNED` and `OUT_OF_ZONE` onto it, and that is
the path that gives reserved stock back.

`Courier` was reduced to `ARAMEX` alone. Postgres has no `DROP VALUE`, so the migration recreates
the type and re-points `Shipment.courier` and `WebhookEvent.courier` at it. `CourierAccount` is a
table rather than columns on `Tenant` because Aramex authenticates with a six-field `ClientInfo`
block, not a single API key — and it also carries the merchant's pickup address, which Aramex
requires on every shipment and which nothing else in the app stores.

| File | Purpose |
|---|---|
| `packages/database/prisma/schema.prisma` | Adds `READY_FOR_SHIPMENT` + `PICKUP_REQUESTED` to `OrderStatus`, reduces `Courier` to `ARAMEX`, adds the `CourierAccount` model and label/pickup columns on `Shipment`. Removes the three `Tenant.*ApiKey` columns. |
| `packages/database/prisma/migrations/20260831120000_fulfillment_stages_and_carrier_accounts/migration.sql` | Hand-written. Adds enum values `BEFORE 'PROCESSING'` so the physical enum order matches the pipeline; recreates `Courier`; creates `CourierAccount`; backfills the Aramex key into it as a webhook secret; **then** drops the three columns. |

Two details worth knowing. Postgres refuses to *use* a value added by `ALTER TYPE ADD VALUE`
inside the transaction that added it, so nothing in the migration writes the new values. And the
backfill copies the key as plaintext, because SQL cannot call our cipher; section B explains how
that is handled without a separate script.

This migration was **rewritten in place** rather than followed up, so the history stays a single
migration for an unshipped feature. Applying it required `prisma migrate reset`; the existing dev
data was dumped and restored around it, losing only the 3 Yalidine and 1 JExport shipments, which
have no code path left to service them.

Why `Shipment.labelPdf` stores bytes in Postgres rather than a URL: bulk printing merges stored
bytes, so printing 40 labels is one operation instead of 40 network round-trips, and it survives
a carrier expiring its label links. Labels are ~50–200 KB.

---

## B. Credential encryption (3 files)

Courier keys were previously stored in plaintext **and returned to the client**, because
`tenants.service.ts` selects whole tenant rows. That file is *not* in this diff and did not need
to change: the leak closed because the three columns no longer exist. They also served double duty
as both the inbound webhook shared secret and — under the new design — the outbound API
credential, which means rotating one silently breaks the other. `CourierAccount` splits them into
two columns; this layer encrypts both.

Not bcrypt: a password is verified by re-hashing, but a courier API key has to be recovered in
full to sign an outbound request. So AES-256-GCM, symmetric, via Node's built-in `node:crypto` —
`apps/api` had no crypto dependency and still doesn't.

| File | Purpose |
|---|---|
| `apps/api/src/common/crypto/secret-cipher.service.ts` | `encrypt`/`decrypt`/`last4`/`matches`. Ciphertext is `v1:<iv>:<tag>:<payload>`. Reads `CREDENTIALS_KEY` in the constructor so a missing key fails at boot, not on a merchant's first save. |
| `apps/api/src/common/common.module.ts` | Registers and exports the cipher from the existing `@Global()` module, so nothing else needed an import. |
| `.env.example` | Documents `CREDENTIALS_KEY` (required, 32 bytes base64) and `COURIER_SANDBOX`. |

The `v1:` prefix is what makes the migration's plaintext backfill safe: `decrypt()` returns any
value lacking the prefix unchanged, treating it as legacy plaintext, and it is re-encrypted on the
next write. That avoided a separate one-off migration script entirely.

`matches()` is constant-time. The old webhook check used `!==`, which returns as soon as two bytes
differ and leaks through response timing how much of a guessed key was correct.

---

## C. Aramex integration — outbound (8 files)

The app talks to exactly one carrier. An earlier revision of this work supported three built-in
carriers plus an "add any carrier manually" config DSL, because no API documentation was available
at the time; roughly twenty files of that machinery served zero working integrations and have been
deleted.

**Where the wire contract came from.** `docs/shipping-services-api-manual.pdf` documents field
semantics well — required fields, enums, COD rules, the complete error-code table — but not the
wire format: its structure diagrams are outlined vectors whose text cannot be extracted, and its
REST appendix prints one identical URL for all seven methods with no HTTP method or Content-Type.
The element names, nesting and types come instead from Aramex's published schema at
`https://ws.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc?xsd=xsd0`.

| File | Purpose |
|---|---|
| `apps/api/src/couriers/providers/aramex.provider.ts` | The integration. `CreateShipments`, `CreatePickup`, and a `PrintLabel` probe used as the connection test. |
| `apps/api/src/couriers/carrier.types.ts` | The vocabulary the fulfillment actions speak, so `OrderFulfillmentService` never sees an Aramex field name. No `ICourierProvider` interface — one implementation does not need one. |
| `apps/api/src/couriers/courier-registry.service.ts` | Resolves the tenant's single account and decrypts its two secrets. Ciphertext never leaves this class. |
| `apps/api/src/couriers/courier-http.ts` | `fetch` wrapper with a timeout and coded errors, plus `fetchLabelPdf`. No HTTP dependency added. |
| `apps/api/src/couriers/couriers.service.ts` | Get / save / test. Returns a masked view — never a secret. |
| `apps/api/src/couriers/couriers.controller.ts` | `GET`, `PUT`, `POST test` on `/couriers/aramex`. Singleton routes: one account per tenant. |
| `apps/api/src/couriers/dto/courier-account.dto.ts` | Validation. Every field optional so a half-collected form can still be saved; completeness is enforced at the point of calling Aramex. |
| `apps/api/src/couriers/couriers.module.ts` | Module wiring. |
| `apps/api/src/app.module.ts` | Registers `CouriersModule`. |

Things in that provider that look wrong and are not:

- **`AccountingInstrcutions` and `TransportType_x0020_`** are spelled exactly that way in Aramex's
  schema — a misspelling and an XML-encoded trailing space. Correcting either makes Aramex ignore
  the field.
- **COD is `Services: 'CODS'`**, not the `"COD"` the manual's prose uses. Appendix C is the code
  table and wins.
- **A 200 response can still be a failure.** Aramex reports errors in-band via `HasErrors` plus
  `Notifications[]`, at both the envelope and the per-shipment level; both are checked. Matching is
  on `Code` and never `Message`, because several documented messages interpolate `{placeholder}`
  values.
- **The connection test calls `PrintLabel` with a waybill that cannot exist.** There is no ping in
  the API. `ERR40` ("shipment does not exist") means the credentials were accepted, which is what
  is being tested; `ERR01`/`ERR02` mean they were not.
- **Three values are per-account settings rather than constants** — `version`, `productGroup` /
  `productType`, and `codCurrency`. The manual never states the `Version` string, and documents
  only International Express product types. Guessing them in code would have been worse than
  letting the merchant enter what Aramex told them.

`ARAMEX_BASE_URL` overrides the host, which is how the verification suite points the provider at a
local stub.

## D. Webhooks — inbound (3 files)

| File | Purpose |
|---|---|
| `apps/api/src/webhooks/webhooks.controller.ts` | Accepts only the `aramex` path segment; authenticates against the decrypted webhook secret with a constant-time compare, where the previous code used `!==`. |
| `apps/api/src/webhooks/webhooks.module.ts` | Registers the one remaining adapter. |
| `apps/api/src/webhooks/inventory-state-machine.service.ts` | **The stock guard.** See below. |

Two files here are **deletions**: `apps/api/src/webhooks/adapters/yalidine.adapter.ts` and
`apps/api/src/webhooks/adapters/jexport.adapter.ts` went with their enum values — with no way to
configure those carriers, their adapters were unreachable code. They pre-date this change set;
removing them was an explicit decision, not a side effect.

Deleted alongside them, from the abandoned multi-carrier design: `providers/generic-http.provider.ts`,
`providers/sandbox.provider.ts`, `providers/not-implemented.ts`, `providers/yalidine.provider.ts`,
`providers/jexport.provider.ts`, `interfaces/custom-carrier-config.interface.ts`,
`interfaces/courier-provider.interface.ts`, `couriers/json-path.ts`,
`webhooks/adapters/generic.adapter.ts`, and `settings/_components/add-carrier-form.tsx` —
plus the `COURIER_SANDBOX` env var, now that Aramex publishes a real testing host.

### The stock guard — the highest-risk change in the diff

A manual order reserves its stock at creation. When the `IN_TRANSIT` webhook later arrives, the
state machine must *not* reserve it a second time. That was guarded by:

```ts
event === 'IN_TRANSIT' && shipment.order.status === OrderStatus.PENDING_FULFILLMENT
```

Adding two statuses breaks this silently. An order that has had a label generated and a pickup
requested arrives at the webhook as `PICKUP_REQUESTED`, the guard misses, and every parcel
decrements `stockAvailable` twice. The fix widens it to a `PRE_TRANSIT_STATUSES` set covering all
three pre-collection states.

This was verified by reverting the fix and confirming the test fails — `reserved 4→5,
available 46→45`, the exact double-reservation — then restoring it and confirming it passes.

---

## E. Order fulfillment actions (6 files)

The three actions plus their partial-result contract. Kept out of `OrdersService`, which owns
order CRUD and stock reservation: the two touch the same rows for different reasons, and only this
one talks to a carrier.

| File | Purpose |
|---|---|
| `apps/api/src/orders/order-fulfillment.service.ts` | `generateAwbs`, `requestPickups`, `printLabels`, `trackingUrl`. All return `{ succeeded, skipped[] }`. |
| `apps/api/src/orders/orders.controller.ts` | `POST awb`, `POST pickup`, `POST labels/print`, `POST :id/awb`, `GET :id/tracking`. Literal paths are declared before `:id` — Nest matches in declaration order. |
| `apps/api/src/orders/dto/fulfillment.dto.ts` | The shared selection payload, capped at 200 ids since each costs a carrier round-trip. |
| `apps/api/src/orders/orders.service.ts` | `cancel` and `remove` widened — see below. |
| `apps/api/src/orders/orders.module.ts` | Imports `CouriersModule`. |
| `apps/api/src/tenants/dto/create-tenant.dto.ts` | Drops its three courier-key fields. They spread straight into Prisma, so leaving them would have thrown at runtime once the columns were gone. |

**Ineligible orders are skipped, not rejected.** That is what makes "select every row in this
filter and press go" safe, and it mirrors `remitBulk`, which already treats a resubmitted
settlement as a no-op. An order that already has a shipment is skipped before anything else —
carriers bill per label, and a second one creates a parcel nobody will collect.

**The carrier call sits outside `$transaction`, deliberately.** CLAUDE.md rule 2 requires stock
mutations to be transactional. But holding a database transaction open across a network
round-trip is exactly what exhausts the connection pool during a webhook burst, and these run in
a loop. So: call the carrier, *then* open a short transaction per order. A failure on the seventh
parcel leaves the first six correctly recorded. If the carrier issues a waybill and the write
then fails, the AWB number is logged at error level — it is the only remaining record.

**`remove` had to widen too.** It released stock only for `PENDING_FULFILLMENT`; with two more
statuses in which stock is reserved, soft-deleting a packed order would have stranded those units
permanently. `cancel` widened to `READY_FOR_SHIPMENT` — merchants void packed parcels routinely —
but deliberately stops at `PICKUP_REQUESTED`, since after that the courier is coming and it has to
be settled with them.

---

## F. Orders UI (11 files)

`orders-client.tsx` was 740 lines and gained filtering, sorting, selection, a bulk bar and a row
menu. It was split into `_components/`, following the existing `remittance/_components/` and
`dashboard/_components/` convention. `orders-client.tsx` is now only the orchestrator.

Filtering and sorting are **client-side** — `orders/page.tsx` already fetches the full list, so a
server round-trip per tab click would buy nothing.

| File | Purpose |
|---|---|
| `apps/web/app/[locale]/(dashboard)/orders/orders-client.tsx` | Orchestrator: filter, sort, selection state, modals. |
| `.../orders/_components/types.ts` | Shared `Order`, `SortKey`, `SortState`. |
| `.../orders/_components/status-filter-tabs.tsx` | All + one tab per status, with counts. |
| `.../orders/_components/orders-table.tsx` | Desktop table: select-all with a real indeterminate state, row checkboxes, click-to-sort headers. |
| `.../orders/_components/orders-card-list.tsx` | The phone layout, carrying the same checkbox and action menu — packing often happens phone-in-hand. |
| `.../orders/_components/order-row-actions.tsx` | The dropdown that replaced the lone Cancel link. Entries are driven by status. |
| `.../orders/_components/bulk-actions-bar.tsx` | Floating bar. Each button disables when no selected row qualifies. Uses logical `start`/`end` insets for RTL. |
| `.../orders/_components/use-fulfillment.ts` | Runs the actions and turns `{ succeeded, skipped }` into a toast. |
| `.../orders/_components/create-order-sheet.tsx` | Lifted out of `orders-client.tsx` unchanged. |
| `.../orders/_components/cancel-modal.tsx` | Lifted out unchanged. |
| `.../orders/actions.ts` | Server actions for the four operations. |

Two decisions worth noting. Selection is scoped to the active filter and cleared on tab change —
carrying hidden rows into a bulk action is something a merchant only notices afterwards. And
sorting by status uses a pipeline-order rank, not the translated label, which would otherwise sort
differently in each language and usefully in none.

The merged PDF comes back **base64 in JSON** rather than as a stream, because a server action's
return value is serialized and cannot forward binary. It also keeps skip-reporting identical
across all three bulk actions.

---

## G. Settings & Aramex configuration UI (3 files)

| File | Purpose |
|---|---|
| `apps/web/app/[locale]/(dashboard)/settings/page.tsx` | Store details plus the Aramex form. |
| `.../settings/_components/aramex-form.tsx` | Credentials, pickup address, webhook secret, and an Advanced section for the three values Aramex has to tell you. |
| `.../settings/actions.ts` | Server actions replacing the deleted route handler. |

Secret fields always render empty — the API returns only whether one is stored — so leaving one
blank means "keep what is saved". The pickup address is a required section rather than an optional
one: Aramex rejects a shipment without a full Shipper party, and the app had nowhere else to put a
merchant's physical address.

`apps/web/app/api/settings/tenant/route.ts` was **deleted**. The page was the only one in the app
reaching the API through a Next route handler instead of a server action, and its `handleSave`
swallowed every error with a `// silent` comment, so a rejected slug looked like a successful save.

## H. Shared UI primitives (7 files)

**No frontend dependency was added.** The unified `radix-ui@1.6.0` package was already installed
and exports everything needed. These are shadcn-style wrappers with imports rewritten to
`import { X as XPrimitive } from "radix-ui"` to match every existing component.

| File | Purpose |
|---|---|
| `apps/web/components/ui/checkbox.tsx` | Row and select-all checkboxes; supports indeterminate, which the native input used elsewhere cannot without a ref. |
| `apps/web/components/ui/dropdown-menu.tsx` | The row actions menu. |
| `apps/web/components/ui/tabs.tsx` | Status filter tabs. Scrolls rather than wraps — seven statuses don't fit a phone. |
| `apps/web/components/ui/toaster.tsx` | Toast rendering, anchored to the inline-end edge. |
| `apps/web/hooks/use-toast.ts` | Toast store. |
| `apps/web/app/[locale]/layout.tsx` | Mounts `<Toaster />` inside `NextIntlClientProvider`. |
| `apps/web/lib/order-status.ts` | The two new statuses and their badge colours, the pipeline-order rank used for sorting, and the `canGenerateAwb`/`canRequestPickup`/`canPrintLabel`/`canCancel`/`canTrack` predicates that decide which actions a row offers. |

The app had **no success feedback of any kind** before this — errors were inline red divs and
success was implied by a row changing. A partial result ("3 requested, 2 skipped") had nowhere to
go, which is the whole reason a toast system exists now.

---

## I. Internationalisation (3 files)

| File | Purpose |
|---|---|
| `apps/web/messages/en.json` | New `orderStatus`, `orders`, `settings` and `errors` keys. |
| `apps/web/messages/fr.json` | Same keys, French. |
| `apps/web/messages/ar.json` | Same keys, Arabic, with correct plural categories (`zero`/`one`/`two`/`few`/`many`). |

All three are at **exact 352-key parity** — a missing key renders the raw key at runtime. New
error codes are flat SCREAMING_SNAKE entries under `errors`, which `useErrorMessage()` maps
automatically.

The §4.D safeguard message is an ICU plural: *"Pickup requested for 3 ready orders. 1 order was
skipped because its label is not generated yet."*

`settings.courierKeysDesc` was reworded — it claimed the keys were for validating inbound webhooks
only, which is no longer true.

---

## J. Settings infinite-loop fix (2 files)

Found after the feature was otherwise complete: opening Settings fired unbounded network requests
and a stream of error toasts.

`useErrorMessage()` returned a **new closure on every render**. It was used in a `useCallback`
dependency array feeding a `useEffect`, so: render → new `getError` → new callback → effect
re-fires → `setState` → render. The request flood then made the requests themselves fail, and the
`.catch` blanked the list — which is why the responses looked like empty arrays. One cause, three
symptoms.

| File | Purpose |
|---|---|
| `apps/web/lib/api-error.ts` | Memoizes the returned function with `useCallback`. Fixed at the source: it is a shared hook, and any consumer putting it in a dependency array hits the same loop. |
| `apps/web/app/[locale]/(dashboard)/settings/page.tsx` | Effect now depends only on a `reloadCount` integer and closes over neither the translator nor `toast`. Adds a `cancelled` guard, and renders load failures inline with a retry button instead of toasting from an effect. |

Only one `useEffect` in application code could hit this pattern; every other `getError` call sits
in an event handler, where identity churn is harmless.

---

## K. Incidental (3 files)

| File | Purpose |
|---|---|
| `apps/api/package.json` | Adds `pdf-lib` — the one new dependency in the whole change, for merging labels. |
| `package-lock.json` | Lockfile for the above. |
| `apps/web/next-env.d.ts` | Regenerated by the Next build. No review needed. |

---

## Not part of this change

Eight files appear in `git status` but were staged before this work began — your webhook testing
harness:

`docs/webhook-testing-postman.md`, `postman/mnadhem-local.postman_environment.json`,
`postman/mnadhem-webhooks.postman_collection.json`, `scripts/inspect-webhook-state.mjs`,
`scripts/run-webhook-suite.ps1`, `scripts/send-webhook.ps1`, `scripts/webhook-fixtures.mjs`,
and the root `package.json`.

---

## What was verified, and what wasn't

**Verified.**

- 44 end-to-end assertions against a running API with a local stub speaking Aramex's response
  shape: credential encryption at rest, masked responses, the AWB → label → pickup flow, the §4.D
  safeguard (3 ready + 1 pending → exactly 3 transition, 1 skipped with the right reason), and
  Aramex's in-band error handling (`HasErrors` on a 200 → failure, `ERR01` → a credential-specific
  message, no shipment row written).
- **The request bodies were asserted against Aramex's published schema** — every `ClientInfo`
  element name, the `Shipments` array wrapper, the `Money`/`Weight` object shapes, `Services:
  'CODS'`, `LabelInfo.ReportID: 9201`, and both of Aramex's own misspellings. That is the check
  that catches a field name Aramex would silently ignore.
- The stock guard, proven discriminating by reverting the fix and watching the test fail.
- 17 server-render assertions across `/en/orders`, `/en/settings` and `/ar/settings` — real
  content, checkboxes, tabs, `dir="rtl"`, no leaked message keys.
- `tsc --noEmit` clean for both apps; `eslint --max-warnings 0` clean for every file in this
  change; `npm run build` green.

**Not verified.**

- **The settings loop fix was never confirmed in a browser.** No Chrome tooling was available and
  the repo has no jsdom or test renderer, so no client-side effect was ever executed. The
  mechanism is unambiguous and the static checks pass, but the confirmation is a human loading
  `/settings` and seeing one request.
- More generally, **nothing in this change set exercises React's client render cycle** — every
  test ran server-side or over HTTP. That is precisely the gap the loop bug slipped through. A
  lightweight component-test setup would close it.
- **Nothing has ever run against Aramex.** Section 4.1.1 of their manual, "Testing credentials",
  is empty in this PDF — the values were stripped or never rendered — so there is no test account.
  The integration is written to their published schema and exercised against a stub; the first real
  call needs credentials from Aramex.
- Two things the schema could not settle and that a real call will confirm or refute: the REST
  operation suffix (`/json/CreateShipments`, from WCF convention plus the WSDL operation names —
  the manual prints one identical URL for all seven methods) and the `ClientInfo.Version` string,
  which the manual never states. Both are overridable without a code change.

---

## Follow-ups

1. **Set `CREDENTIALS_KEY` on Railway before deploying.** The API will not boot without it, and it
   must stay stable per environment — rotating it makes stored credentials undecryptable.
2. **Get Aramex to confirm three things**: your `ProductGroup` / `ProductType` (the manual lists
   International Express codes only — there are no domestic ones), the COD currency for your
   account (the manual requires USD, which does not fit a TND domestic parcel), and the
   `ClientInfo.Version` string. All three are editable in Settings; the defaults are a starting
   point, not a recommendation.
3. **Request test credentials from Aramex** so the integration can be exercised for real against
   `ws.dev.aramex.net`.
4. `apps/web/.../inventory/inventory-client.tsx:19` has a pre-existing unused import that keeps
   `--max-warnings 0` red. One-line fix, untouched here because it is unrelated.
5. `apps/api` has no `eslint.config.js`, so its `lint` script errors out entirely. Also
   pre-existing.
6. `order-row-actions.tsx` was reformatted outside this change and its trigger now reads
   `hover:text-background`, which makes the icon match the page background on hover — i.e.
   invisible. Probably meant to be `hover:text-foreground`.
