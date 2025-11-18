Calendar & Booking Implementation Plan (Milestone 3.2 / 3.3)
===========================================================

Goal
----
Ship production-ready scheduling UI/logic:
* Internal calendar (day/week/month) with drag, resize, conflict detection, and live sync.
* Public booking experience (service → staff → time → details → confirmation) with polished animations and deposit-ready UX.

Architecture Overview
---------------------
- **Data model expansions**
  - `appointments`: id, business_id, staff_id, service_id, customer_id, booking_page_id, start_time, end_time, status (`PENDING`, `CONFIRMED`, `CANCELLED`), notes, source (`internal`, `public`), created_at, updated_at.
  - `availability_blocks`: staff_id, day_of_week, start_time, end_time, overrides for holidays/time-off (ties into later Pilates features).
  - `appointment_activity`: audit trail for status changes (helps notification pipeline, analytics).
- **Sync strategy**
  - Use WebSocket channel (`/ws/calendar/:businessId`) to push appointment CRUD, status updates, and time-off changes.
  - Fallback to polling via TanStack Query refetch interval when WS unavailable.
- **Time handling**
  - Store UTC timestamps in DB, convert with `date-fns-tz`, respect business timezone (default Asia/Dubai but configurable).
  - Buffer enforcement handled server-side before commit to avoid race conditions.

Backend Tasks
-------------
1. **Appointment Controller**
   - Routes:
     - `GET /api/appointments?rangeStart&rangeEnd` scoped by business.
     - `POST /api/appointments` (create) with validations (service/staff availability, buffers, double-booking).
     - `PUT /api/appointments/:id` (update time/date/status, reassign staff).
     - `DELETE /api/appointments/:id`.
     - `PUT /api/appointments/:id/status` for quick confirm/cancel transitions.
   - Use Prisma transactions: lock staff + resource availability.
   - Emit WS events (`appointment.created`, `appointment.updated`, `appointment.deleted`).

2. **Availability & Conflicts**
   - Extend staff model with weekly availability `availabilityBlocks` relation.
   - Create helper `getAvailableSlots(serviceId, staffId, dateRange)` used by booking wizard.
   - Conflict detection rules:
     - Ensure (start-bufferBefore, end+bufferAfter) window doesn’t overlap existing appointments.
     - Honor staff time-off and resource reservations (Pilates toolkit will plug into same API later).

3. **Public Booking API**
   - `GET /api/public/booking/:slug/services` -> list services/staff combos for that booking page.
   - `GET /api/public/booking/:slug/availability?serviceId&staffId&date` -> returns slot grid.
   - `POST /api/public/booking/:slug/book` -> creates appointment (status `PENDING`), triggers confirmation email/SMS, handles deposit (Stripe) if configured.
   - Rate limiting + hCaptcha to prevent abuse.

Frontend Tasks
--------------
### Owner Calendar (apps/web)
- Stack: React Big Calendar + TanStack Query + Zustand for UI state.
- Views:
  - Day view (staff columns), Week view (multi-staff toggle), Month view (overview).
- Interactions:
  - Drag/resize via RBC DnD addon (wrap with `CalendarDnDBackend`).
  - Inline editor drawer (appointment details, status, staff reassignment).
  - Conflict UI: toast + revert on backend rejection; highlight conflict time ranges.
- Live updates:
  - WebSocket hook `useCalendarChannel(businessId)` to merge events into Query cache.
  - Show subtle pulse when remote updates arrive.

### Booking Wizard (public page)
- Pages: `/booking/:slug`.
- Steps & animations (Framer Motion):
  1. **Service Selection** – cards with filters (duration, staff specialization).
  2. **Staff Selection** – chips or toggle for “Any instructor”.
  3. **Date & Time** – responsive slot grid; infinite scroll for upcoming days.
  4. **Customer Details** – React Hook Form w/ validation, marketing opt-in.
  5. **Confirmation** – deposit summary, ICS download, share link.
- Persistence:
  - Use Zustand store `useBookingStore` with `persist` to keep progress across refresh.
  - On final step, show skeleton while API call + payment intent completes.
- Error handling:
  - If slot taken mid-booking, show conflict dialog and fetch fresh availability.
  - Payment failures surface actionable messages (retry, different method).

UI Specs & Responsiveness
-------------------------
- Calendar:
  - Desktop: multi-column layout; sticky header with filters (staff, service type, status).
  - Tablet: collapsible staff sidebar; pinch/zoom gestures.
  - Mobile (owner): condensed agenda list with create button.
- Booking Wizard:
  - Mobile-first cards, bottom sheet summary.
  - Desktop: dual-pane (content left, summary right) per earlier wireframe notes.

Testing & QA
------------
- **Backend**
  - Unit tests for availability utilities, conflict detection.
  - Integration tests for appointment lifecycle (create → drag update → cancel).
  - Contract tests for public booking endpoints (supertest).
- **Frontend**
  - Cypress flows: owner reschedules appointment; guest completes booking.
  - Storybook scenarios for slot grid edge cases (no availability, timezone difference).
  - Visual regression of wizard steps.

Milestone Deliverables
----------------------
- Calendar UI & endpoints live with drag/drop, conflict prevention, and WS updates. (3.2)
- Public booking wizard routes served from web app (or separate entry) with animated UX and deposit-ready checkout. (3.3)
- Documentation updates: user guide for scheduling, API reference for booking endpoints.

Next Actions
------------
1. Implement Prisma models (`appointments`, `availabilityBlocks`) + migrations.
2. Build appointment API + WebSocket infrastructure.
3. Integrate calendar UI skeleton and connect to API.
4. Implement public booking page + wizard store + API hooks.
5. QA + docs + update PLAN checkboxes.

