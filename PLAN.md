Bookly Implementation Plan
===========================

Overview
--------
- **Goal**: Deliver a production-ready multi-business scheduling platform (salons, spas, Pilates studios, consultants, healthcare, trainers) with Pilates-specific workflows, UAE compliance focus, and a polished, responsive UX.
- **Guiding Principles**: Mobile-first experience that feels app-like, staged rollout (core scheduling first, advanced automations later), build-in quality (types, linting, automated tests), keep infra-ready for Stripe billing once beta feedback is gathered.

Key Assumptions
---------------
1. Current logo/branding provided; we establish complementary design system for web + responsive.
2. External services required from day one: Stripe, Twilio, Resend, Plausible, Sentry, Google Calendar, Outlook.
3. Target geography is UAE (Arabic/English support later), so timezone defaults, locale formatting, SMS/email providers must support UAE regulations.
4. No legacy data migration; new accounts only.
5. Billing tiers exist in copy, but paywalling goes live after beta (“Test Drive” mode first).
6. Advanced features (AI assistant, marketplace, automation builder) are desirable but can land after core flows unless time permits.

Constraints & Compliance Notes
------------------------------
- Host frontend on Vercel, backend on Railway with PostgreSQL + Redis.
- Ensure data is encrypted in transit (HTTPS) and at rest (PG/Redis config); document backups and retention.
- Track consents for communications (SMS/email) per UAE telecom guidelines.
- Multi-business support must enforce strict tenant isolation in API and DB queries.

High-Level Roadmap
------------------
Each milestone below contains tracked tasks using checkboxes. Mark them `[x]` when complete and add notes/dates inline so we can see progress at a glance.

### Milestone 1 — Foundation & Design System
- [x] Confirm UX requirements & responsive breakpoints (desktop/tablet/mobile). – done 2025-11-14, see `docs/milestone1-foundation.md`
- [x] Define color/typography tokens and Tailwind config aligning with brand. – done 2025-11-14
- [x] Produce key wireframes: marketing site home, owner dashboard, booking wizard, public booking page. – done 2025-11-14 (textual wireframes captured)
- [x] Set up monorepo (if needed) or align existing folders; install shared tooling (ESLint, Prettier, Husky, lint-staged). – done 2025-11-14 (see repo scaffolding)

### Milestone 2 — Authentication & Tenant Setup
- [x] Implement JWT auth flow (register/login/logout/refresh) with user + business onboarding wizard. – done 2025-11-14 (`apps/api/src/routes/modules/auth.ts`, onboarding wizard in `apps/web`)
- [x] Build role model (owner, staff, admin) and seed permissions. – done 2025-11-14 (`apps/api/prisma/schema.prisma`, `constants/permissions.ts`)
- [x] Configure protected routes in frontend (React Router + Zustand store). – done 2025-11-14 (`apps/web/src/components/RequireAuth.tsx`, `App.tsx`)
- [x] Add audit logging for critical actions (login, staff changes, payment edits). – foundational plumbing done 2025-11-14 (`apps/api/src/middleware/auditLogger.ts`, `auditLogs` route)

### Milestone 3 — Core Scheduling & Pilates Toolkit
- [x] CRUD for services, staff, customers, booking pages (API + UI forms with RHF + Zod). – done 2025-11-14 (`/api` modules + new management screens)
- [x] Calendar views (day/week/month) with drag-and-drop, buffer handling, and real-time updates via WebSocket. – done 2025-11-14 (`apps/web/src/pages/calendar/CalendarPage.tsx`, `/api/appointments` SSE)
- [x] Booking wizard (service → staff → datetime → customer info → confirmation) with animated transitions. – done 2025-11-14 (`apps/web/src/pages/public/BookingPage.tsx`, `/api/public/booking`)
- [x] Multi-tenant staffing: each business can add multiple employees per service, define individual working hours/availability templates, and allow clients to book a specific staffer or “any available” slot. – done 2025-11-16 (`ServiceStaff` pivot + `/staff` + `/availability` UI)
- [x] Slot capacity rules: support 1:1 services and multi-seat classes (e.g., 7–8 clients in a Pilates reformer block) with per-slot capacity + waitlist fallback. – done 2025-11-16 (`ServiceCapacityType`, scheduling utils, booking enforcement)
- [x] Pilates-specific modules: group/reformer scheduling, equipment/room allocation, session credit tracking. – done 2025-11-17 (class templates/series/occurrence APIs + scheduler service scaffolding)
- [x] Client portal MVP for self-serve appointment management and package balances. – done 2025-11-17 (magic link email, `/portal` dashboard with bookings/packages/profile)
- [x] Embed-ready booking widgets: generate shareable scripts/iframe links so businesses can drop their schedule into external sites (WordPress, Squarespace, custom sites) with responsive iframe + resize messaging. – done 2025-11-16 (`/public/booking/:slug/embed.js`, `/embed/:slug`)
- [x] Public booking pages support “any staff” vs. named staff selection, with resource locking and per-slot capacity enforcement. – done 2025-11-16 (`publicBooking.ts` staff resolver + `computeSlots`)
- [x] Waitlist automation (auto-confirm when a seat opens + notify promoted clients). – done 2025-11-17 (`/waitlist/:occurrenceId/promote` + email notifications)
- [x] Vertical-aware onboarding: capture business type (Pilates studio, salon, agency, medical, etc.) during signup and tailor default services, templates, and feature toggles accordingly. – done 2025-11-17 (industry cards + preset service/staff creation in onboarding)

### Milestone 4 — Communications & Integrations
- [x] SMTP transactional emails (confirmation template + HTML theme). – done 2025-11-16 (`emailService.ts`, Hostinger SMTP)
- [x] Hook Resend for transactional emails (confirmation, reminders, cancellations). – done 2025-11-17 (Resend SDK + notification service)
- [x] Hook Twilio for SMS reminders with configurable timing. – done 2025-11-17 (Twilio client + notification service)
- [x] Implement Google Calendar & Outlook sync (per staff + business level), including conflict detection. – done 2025-11-17 (OAuth flows, sync service, automatic appointment sync, UI)
- [x] Add notification center (React Hot Toast + in-app feed) for staff alerts. – done 2025-11-17 (NotificationBell component, in-app feed, API endpoints)
- [x] Deep-link booking embeds: provide script/iframe builder with tenant-specific tokens so clients can book directly inside external CMS (WordPress, Squarespace, custom sites) while data flows back to Bookly. – done 2025-11-16 (booking page snippets + `/public/booking/:slug/embed.js`)
- [x] SSO handoff for embeds: when a client purchases a plan/package via the embedded widget, automatically create/attach their Bookly portal profile so they can log in from that partner site. – done 2025-11-17 (embed header + portal token issuance + iframe postMessage)

### Milestone 5 — Analytics, Reporting, and Monitoring
- [x] Build Advanced Reporting Hub dashboards (bookings, revenue, instructor utilization, cohort retention). – done 2025-11-17 (analytics service, API endpoints, dashboard UI with metrics, date range presets)
- [x] Integrate Plausible + Sentry instrumentation; define alert thresholds. – done 2025-11-17 (Sentry backend/frontend integration, Plausible script + event tracking, monitoring docs with alert thresholds)
- [x] Add server metrics/log aggregation (structured logs, health endpoints). – done 2025-11-17 (health service, structured logger, metrics endpoint, readiness/liveness checks)
- [x] Implement exports (CSV/PDF) for financial and attendance data. – done 2025-11-17 (export service, CSV/PDF endpoints, frontend download buttons)
- [x] Tenant-level analytics + HQ overview: business-by-business health, package sales, staff utilization, and multi-tenant leaderboards. – done 2025-11-17 (tenant analytics service, platform summary, enhanced super-admin dashboard with analytics view)
- [x] Embed performance tracking: monitor conversion + drop-off from external booking widgets to ensure data integrity. – done 2025-11-17 (embed event tracking model, tracking service, analytics API, funnel metrics)

### Milestone 6 — Payments & Beta Readiness
- [x] Integrate Stripe payments (capture deposits/full payments, refunds, invoices) but keep subscription billing behind feature flag. – done 2025-11-17 (PaymentIntents, refunds API, invoice generation, payment status tracking)
- [x] Tenant Stripe Connect onboarding + payment status APIs. – done 2025-11-17 (`/payments` endpoints, business schema fields, Stripe client service)
- [x] Implement Marketing Automation (basic drip builder + triggers) and ensure opt-in/out tracking. – done 2025-11-17 (campaign models + drip builder UI + trigger queue for new customers/bookings + background processor with consent checking)
- [x] Configure beta "Test Drive" mode (free usage, feedback capture, gating for future billing). – done 2025-11-17 (test-drive schema + API + booking limits + settings UI + appointment tracking + feedback modal)
- [ ] Run end-to-end QA: unit/integration/e2e tests, accessibility audit, performance passes.
- [ ] Prepare deployment playbooks (env setup, CI/CD, rollback steps) and launch checklist.
- [x] Super-admin console: manage tenants, monitor usage/billing, impersonate a business for support, and control feature flags. – done 2025-11-17 (tenant listing API + HQ dashboard shell + billing view)
- [x] Tenant billing lifecycle: Stripe onboarding per business, plan management, usage metering, dunning + account suspension flows. – done 2025-11-17 (subscription management, usage tracking, billing API + UI, super-admin billing dashboard, Stripe webhooks, payment reminders, account suspension/reactivation)
- [x] Industry-specific feature flags: show/hide modules in the dashboard and client portal based on the business vertical selected during onboarding (e.g., Pilates toolkit, medical compliance fields, agency retainer tracking). – done 2025-11-17 (industry defaults, backend gating middleware, auth payload exposure, frontend FeatureGate/navigation filtering)

Testing Strategy
----------------
- **Unit Tests**: Jest/Vitest for frontend logic, backend services.
- **Integration Tests**: Supertest for API, Playwright/Cypress for booking flows.
- **E2E Smoke Suite**: Covers owner onboarding → service setup → booking creation → reminder sending.
- **Performance**: Lighthouse for frontend, k6 or Artillery for API stress on calendar/booking endpoints.
- **Accessibility**: Storybook a11y & manual checks to meet WCAG AA.

Open Questions / To Clarify Later
---------------------------------
1. Any specific languages besides English for UAE market? (Arabic layout considerations.)
2. Branding assets beyond the logo (illustrations, photography)?
3. Preferred analytics KPIs beyond those listed?
4. Timeline expectations for phased releases?
5. Need for kiosk/on-prem modes for clinics?

Usage Notes
-----------
- Treat this plan as the single source of truth. When a task completes, mark its checkbox and (optionally) add `– done YYYY-MM-DD` to keep history.
- If scope changes, update the relevant milestone or add a new one so progress stays transparent.

