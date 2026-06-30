# Product Specification & Brand Blueprint: Mnadhem (منظّم)

## 1. The Core Vision & Concept
In the local retail and e-commerce ecosystem, Cash on Delivery (COD) accounts for over 70% of all online transactions, presenting high-friction operational hurdles. Between a 20%-40% delivery refusal rate and a 7-to-15 day cash remittance latency from couriers (Yalidine, Aramex, Jexport), merchants operate in a financial and operational black hole.

**The Problem:** When an order is placed, inventory is tied up. If refused, stock sits in a transit warehouse for weeks, invisible to the merchant, while the storefront shows "Out of Stock."

**The Solution:** Mnadhem is a specialized, multi-tenant Micro-SaaS operational dashboard. It acts as an intelligent layer between storefronts, local couriers, and physical inventory. By transforming passive tracking updates into automated database mutations, Mnadhem aligns a brand's real-time physical stock counts directly with the real-world state of their delivery pipeline.

## 2. Brand Identity & Narrative
**Name:** Mnadhem (منظّم) — "The Organizer" or "The Systematizer."
**Aesthetic:** "Quiet Authority." Tailored for professional operators who value clarity, speed, and absolute numbers.
**Logo Philosophy:** Clean, geometric typography with a signature brand mark of an Ordered Isometric Stack (multiple boxes/files fitting flawlessly into a single column).

### Visual Design Tokens
* **Primary Base (Deep Slate - #0F172A):** Foundational structure, headers, and sidebar navigation.
* **Trust Anchor (Refined Forest Green - #14532D):** Call-to-actions, financial growth, successful deliveries.
* **Supporting Midtone (Slate Gray - #64748B):** Geometric grid system, card borders, secondary text.
* **Canvas Backdrop (Crisp Alabaster - #F8FAFC):** Medical-clean workspace background.

## 3. Core Feature Blueprint & Architecture

### A. Advanced Multi-State Inventory Engine
Traditional platforms track static stock. Mnadhem splits Product Variants (Color/Size) into three database columns:
* `stockPhysical`: Actual physical units in the merchant's warehouse.
* `stockReserved`: Units packed and handed to couriers, currently in transit.
* `stockAvailable`: True units safe to sell online.
* **Formula:** `Available = Physical - Reserved`

### B. Webhook-Driven State Machine
Mnadhem exposes secure endpoints via the NestJS backend (`/api/v1/webhooks/courier/*`) that react instantly:
* **"En Cours" (Courier Confirmation):** Moves stock from Available to Reserved.
* **"Livré" (Delivered):** Drops `stockPhysical` and clears `stockReserved`. Marks sale as finalized.
* **"Retourné" (Refusal/Return):** Cancels reservation. `stockReserved` drops, `stockAvailable` increases immediately.

### C. The Floating Capital & Cash Hub
Because couriers hold collected cash for up to two weeks, this dashboard view tracks:
* **Total Floating Capital:** Exact sum of collected money not yet remitted to the merchant's bank.
* **Regional Risk Matrix:** Analytical chart displaying refusal/return rates grouped by Governorate, allowing merchants to adjust phone confirmation protocols for high-risk zones.

### D. Multi-Tenant Store Ecosystem
Users can create independent workspaces (Stores) under a single master account:
* Unique courier integration keys.
* Distinct inventory catalogs.
* Separate team member roles and permissions.

## 4. Proposed Database Schema Architecture (Prisma)
To achieve the above, the data layer must be structured across these core models:
* `Tenant / Store`: Manages workspace settings and courier API keys.
* `Product & Variant`: Holds the triple-state inventory (`physical`, `reserved`, `available`).
* `Order`: Tracks total COD value, customer details, and region.
* `Shipment`: Tracks the courier tracking number, specific courier (Yalidine, etc.), and current state.
* `WebhookEvent / AuditLog`: Immutable ledger of every state change triggered by courier webhooks to ensure traceability.