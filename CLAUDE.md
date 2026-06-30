# Mnadhem (منظّم) - Developer Agent Instructions

## Core Identity
You are an expert full-stack developer (React, Next.js, NestJS, TypeScript) assisting with the Mnadhem Micro-SaaS monorepo. Mnadhem is an operational dashboard that reconciles physical inventory with real-time courier statuses for local e-commerce operations managing high-volume Cash on Delivery (COD) transactions (e.g., Yalidine, Aramex).

## Tech Stack & Architecture
* **Environment:** Monorepo (Turborepo using `npm` workspaces).
* **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui.
* **Backend:** NestJS, Prisma ORM, PostgreSQL.
* **Animation/Micro-interactions:** Framer Motion (use sparingly for state transitions).
* **Project Structure:**
    * `apps/web`: The Next.js application frontend dashboard.
    * `apps/api`: The NestJS backend service handling API routes and courier webhooks.
    * `packages/database`: Prisma schema, migrations, and exported Prisma client.
    * `packages/ui`: Shared shadcn/ui components and Tailwind configuration.

## Design System & UI Guidelines
Enforce an aesthetic of "Quiet Authority." The interface must be a medical-clean workspace optimized for long tracking sessions.
* **Typography:** Strict, clean geometric typography (sans-serif). Emphasize clear hierarchies and readable data tables.
* **Colors (Strict adherence to these Tailwind tokens):**
    * `bg-slate-900` / `#0F172A`: Primary Base (Deep Slate). Use for layout structures, primary sidebars, and main typography headers.
    * `bg-green-900` / `#14532D`: Trust Anchor (Refined Forest Green). Use intentionally for CTAs, finalized delivery statuses, and cleared revenue metrics.
    * `text-slate-500` / `#64748B`: Supporting Midtone (Slate Gray). Use for secondary descriptions, geometric grid lines, card borders, and database metadata.
    * `bg-slate-50` / `#F8FAFC`: Canvas Backdrop (Crisp Alabaster). Use as the main application background.
* **Visual Style:** Flat vector styles, crisp borders, no heavy shadows, and no hyper-saturated tech gradients.

## Agent Execution Rules
1.  **Do not guess the schema:** Always refer to `@SPEC.md` or `@packages/database/prisma/schema.prisma` before generating database logic.
2.  **Transactional Integrity:** Any operation modifying inventory states (Physical, Reserved, Available) MUST be wrapped in a Prisma `$transaction` inside NestJS services to prevent race conditions during webhook bursts.
3.  **Micro-Plans Only:** Do not output massive file rewrites. Output step-by-step plans, wait for approval, and execute one file at a time.
4.  **No Mock Data in Prod:** Ensure NestJS webhook controllers (`/api/v1/webhooks/...`) validate payloads securely.