Milestone 3 — Core Scheduling & Pilates Toolkit
==============================================

Purpose
-------
Deliver the core business functionality: CRUD for operational entities, advanced calendar experiences, Pilates-specific scheduling, and a basic client portal so early adopters can run their day-to-day on Bookly.

Scope Summary
-------------
1. CRUD APIs/UI for services, staff, customers, booking pages.
2. Calendar views with drag-and-drop, buffers, and live updates.
3. Booking wizard enhancements (service → staff → datetime → customer → confirmation).
4. Pilates toolkit (group/reformer classes, equipment allocation, session credits).
5. Client portal MVP (self-serve booking management).

Detailed Plan
-------------

### 3.1 CRUD Foundations (Services, Staff, Customers, Booking Pages)
- **Backend**
  - Endpoints: `GET/POST /api/services`, `GET/PUT/DELETE /api/services/:id`, similarly for staff and customers scoped by business. Booking pages manage slug + configuration JSON.
  - Validation with Zod + Prisma transactions to maintain business scoping and tenant isolation.
  - Permission checks: owner/staff with `MANAGE_SERVICES` or `MANAGE_STAFF`.
- **Frontend**
  - React Hook Form + Zod for forms, using shared `FormField` components (to be created in `packages/ui` later).
  - TanStack Query for data fetching/mutations with optimistic updates.
  - Status toasts for success/error.
- **Acceptance**
  - Owners can create/edit/delete services, staff (with invite placeholders), customers, and booking pages from dashboard UI.
  - API enforces tenant scoping; trying to access another business returns 404.

### 3.2 Calendar & Scheduling Engine *(detailed plan in `docs/m3-calendar-booking.md`)*
- **Views**: Day/Week/Month built atop React Big Calendar w/ custom theming.
- **Data Model**: `appointments` table storing business_id, staff_id, service_id, customer_id, start/end, buffers, status.
- **Interactions**
  - Drag-and-drop rescheduling with debounce updates.
  - Conflict detection: highlight overlaps using service/staff availability.
  - Live updates via WebSocket (Pusher or custom WS) to reflect new bookings/time-off.
- **Performance**: Virtualized events for large datasets, lazy load per range.
- **Acceptance**: Staff can drag appointments to new slots, conflicts are prevented with friendly UI prompts, and updates appear across clients in near-real time.

### 3.3 Booking Wizard Enhancements *(see `docs/m3-calendar-booking.md` for UX flow)*
- Steps reworked to include summary sidebar, progress indicator, and different flows for bookings with deposits vs. pay-later.
- Add service/staff filtering, slot auto-suggestion, and ability to collect customer notes/custom fields (configurable).
- Persist partially completed booking in local storage for guests.
- Acceptance: Public booking page allows selecting service/staff/time, entering customer info, and shows confirmation page with ICS attachment option.

### 3.4 Pilates Toolkit *(see `docs/m3-pilates-toolkit.md` for full plan)*
- **Group & Reformer Classes**
  - Support class templates with capacity, default instructors, and equipment requirements.
  - Allow booking multiple attendees in one slot; track waitlists.
- **Equipment & Room Allocation**
  - Model resources (rooms, reformers, props) and enforce availability when scheduling.
- **Session Credits**
  - Customer packages (e.g., 10-class pack) with auto-decrement per booking, expiry rules, and manual adjustments.
- Acceptance: Pilates studios can configure reformer classes, track equipment usage, and enforce credit usage before confirming bookings.

### 3.5 Client Portal MVP *(see `docs/m3-client-portal.md` for detailed scope)*
- Customer-facing area to:
  - View upcoming/past appointments.
  - Reschedule/cancel within policy windows.
  - See package balances and receipts.
  - Update profile/contact preferences.
- Authentication via magic link (email only) for now; future addition of passwordless login stored in `customer_portal_tokens`.
- Acceptance: Customers can self-manage bookings; actions trigger notifications and update the business calendar instantly.

Data Model Additions
--------------------
- `appointments`, `booking_pages`, `customer_packages`, `resources` (equipment/rooms), `resource_reservations`, `waitlist_entries`.
- Update Prisma schema accordingly and run migrations.

Dependencies & Considerations
-----------------------------
- Requires reliable time zone handling (use `date-fns-tz`).
- Need real-time channel provider (evaluate Pusher vs. self-hosted WS).
- Ensure ACL covers staff vs. owner access for sensitive data (customer notes, financials).
- Client portal links must be signed to prevent enumeration; consider short-lived tokens.

Checklist Reference
-------------------
- [x] 3.1 CRUD APIs/UI implemented. (`/api` services, staff, customers, booking pages + dashboard management screens)
- [x] 3.2 Calendar with drag-and-drop + conflicts live. (`apps/web/src/pages/calendar/CalendarPage.tsx`, SSE stream)
- [x] 3.3 Booking wizard upgraded and deployed to public booking page. (`apps/web/src/pages/public/BookingPage.tsx`, `/api/public/booking`)
- [ ] 3.4 Pilates toolkit features functional.
- [ ] 3.5 Client portal MVP available.

Update this document as each sub-task completes; sync with `PLAN.md`.

