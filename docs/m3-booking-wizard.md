Booking Wizard Integration Plan (Milestone 3.3 / cal-4)
======================================================

Objectives
----------
- Wire the public booking experience (`/booking/:slug`) to real backend availability & appointment APIs.
- Support deposits/pay-later paths, customer info capture, and confirmation states aligned with Milestone 3 goals.
- Reuse logic for client portal reschedules later.

Key Flows
---------
1. **Fetch booking page configuration**
   - `GET /api/public/booking/:slug` returns business branding, available services, staff filters, policies (cancel window, deposit amount).
2. **Availability lookup**
   - `GET /api/public/booking/:slug/availability?serviceId=&staffId=&date=` returning slot arrays (15/30-min granularity).
3. **Customer info & validation**
   - React Hook Form with zod schema (name, email, phone, marketing consent, notes).
4. **Payment/deposit**
   - If booking page requires deposit, call `POST /api/payments/create-intent` to create Stripe PaymentIntent before appointment creation.
5. **Booking creation**
   - `POST /api/public/booking/:slug/book`:
     - Payload: serviceId, staffId (optional), startTime, customer info, paymentIntentId (optional).
     - Response: appointment summary, ICS link, portal invite link placeholder.
6. **Confirmation + reminder opt-in**
   - Show success view with animated checkmark, share link, add-to-calendar, portal CTA (if available).

Frontend Tasks
--------------
1. **Booking store updates**
   - Extend Zustand store with service/staff lists, slot matrix, deposit info, payment state.
   - Add actions `setService`, `setStaff`, `setSlot`, `reset`.
2. **API hooks**
   - `useBookingPage(slug)` – fetch config & prefetch services/staff.
   - `useAvailability(params)` – React Query per service/staff/date.
   - `useCreateBooking()` – handles booking mutation with optimistic UI and error states (slot taken).
3. **Wizard steps**
   - Step components already scaffolded; connect them to real data:
     - `ServiceSelection`: list from API, filter by duration/instructor tags.
     - `DateTimeSelection`: show availability grid (grouped by day) with skeleton states.
     - `PaymentStep`: conditionally rendered when deposit enabled; integrate Stripe Elements or redirect to hosted checkout (depending on later decisions).
   - Add “Change selection” summary panel.
4. **Error handling**
   - Slot conflict: display toast, refresh availability, move user back to time step.
   - Network issues: inline messages with retry buttons.
5. **Styling**
   - Align with earlier animation specs (Framer Motion variants).
   - Mobile bottom sheet summary, desktop side panel.

Backend Follow-up
-----------------
- Ensure public booking routes exist (`docs spec` indicated earlier). If not implemented yet, create in API:
  - `booking-public.ts` router that reads booking page slug, ensures page active, provides availability via services/staff/appointments data.
  - Booking endpoint writes to `appointments` table with `source = PUBLIC`, status `PENDING`.
  - Enqueue emails/SMS via background job (future milestone).

Testing
-------
- Cypress: entire booking flow (service selection → payment skip for now → confirmation).
- Jest: booking store reducers, API hook error states.
- Manual: deposit scenarios, slot conflicts, mobile responsiveness.

Deliverables
------------
- Functional booking wizard at `/booking/:slug` pulling live data.
- Stripe deposit gating stubbed (front + API skeleton).
- Updated docs/PLAN with milestone status once done.

