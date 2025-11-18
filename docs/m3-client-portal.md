Client Portal MVP Plan (Milestone 3.5)
=====================================

Objective
---------
Provide customers with a secure, branded portal to self-manage bookings, packages, and preferences—reducing staff workload while keeping experiences polished on mobile and desktop.

Scope
-----
1. Authentication (magic link / passwordless) and session management.
2. Dashboard for upcoming/past appointments with reschedule/cancel flows.
3. Package & payment visibility (session credits, receipts).
4. Profile management (contact info, consent, timezone).
5. Notifications and audit logging.

Architecture Overview
---------------------
- **Separate Auth Boundary**: Client portal uses customer-centric auth (no shared tokens with owner dashboard). Introduce `/api/client-portal/*` namespace.
- **Magic Link Flow**:
  - Customer enters email/phone on portal login page.
  - Backend generates short-lived token stored in `customer_portal_tokens` (token hash, customer_id, expires_at, one_time_use).
  - Send link via Resend or SMS via Twilio.
  - Link hits `/portal/auth/callback?token=...`, exchange for JWT (customer-scoped).
- **Session Storage**: HTTP-only cookie `portalRefreshToken` + short-lived access token similar to owner flow but scoped to customer.
- **Tenant Isolation**: All queries gate by customer_id + business_id to ensure cross-tenant data is safe.

Data Model Additions
--------------------
```prisma
model CustomerPortalToken {
  id          String   @id @default(cuid())
  customer    Customer @relation(fields: [customerId], references: [id])
  customerId  String
  tokenHash   String
  expiresAt   DateTime
  used        Boolean  @default(false)
  createdAt   DateTime @default(now())
}

model CustomerNotificationPreference {
  id          String   @id @default(cuid())
  customer    Customer @relation(fields: [customerId], references: [id])
  customerId  String
  smsOptIn    Boolean  @default(true)
  emailOptIn  Boolean  @default(true)
  timezone    String   @default("Asia/Dubai")
  locale      String   @default("en")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

API Endpoints
-------------
**Auth**
- `POST /api/client-portal/auth/request-link` → send login link/SMS.
- `POST /api/client-portal/auth/verify` → verify token + set refresh cookie.
- `POST /api/client-portal/auth/logout`
- `GET /api/client-portal/me` → return customer profile, packages, default booking page slug.

**Bookings**
- `GET /api/client-portal/appointments?status=upcoming|past`
- `POST /api/client-portal/appointments/:id/cancel` (checks policy windows).
- `POST /api/client-portal/appointments/:id/reschedule` (requires new slot selection).
- `GET /api/client-portal/availability?...` (same engine as public booking but pre-filtered to the customer’s studio preferences).

**Packages & Payments**
- `GET /api/client-portal/packages` → purchased packages + remaining credits.
- `GET /api/client-portal/receipts` → Stripe payment intents/invoices filtered by customer.

**Profile & Preferences**
- `GET /api/client-portal/profile`
- `PUT /api/client-portal/profile` (name, phone, timezone).
- `PUT /api/client-portal/preferences` (notifications, marketing consent).

Frontend UX
-----------
Stack: React (same app), but served under `/portal`. Consider separate route tree with its own layout.

Pages:
1. **Login**: clean magic-link request UI, confirm channel (email/SMS). Show success state with copy link button.
2. **Dashboard**: hero with greeting, upcoming class card, quick actions (Book again, View member card).
3. **Appointments**:
   - Upcoming tab: cards with service, instructor, status, quick reschedule/cancel CTAs.
   - Past tab: add “Book again” and “Rate experience” placeholders for future expansions.
4. **Packages**: list of bundles with progress (credits left, expiry). CTA to purchase once payments enabled.
5. **Profile & Preferences**: forms for contact details, timezone, language, toggles for SMS/email reminders.

Responsive Behavior:
- Mobile-first bottom navigation (Dashboard, Bookings, Packages, Profile).
- Desktop uses left sidebar with portal branding (business logo + theme). Ensure theming inherits from booking page settings (colors, fonts).

Policy Enforcement
------------------
- Cancellation/reschedule windows defined per service/booking page (e.g., 12h). Portal respects these rules and surfaces human-readable messaging (e.g., “Contact studio to cancel within 6 hours”).
- Credits refunds follow package policy (auto or manual approval).
- Reschedule flow reuses booking wizard steps but preselects previous service/staff and filters available slots.

Security
--------
- Tokens hashed/encrypted in DB, expire within 30 minutes.
- Rate limit login requests per email/IP.
- Audit log entries for login, logout, reschedules, cancellations, profile updates (extend existing `audit_logs` with `customerId` field).
- CORS limited to portal domain(s); ensure cookies use SameSite and secure flags.

Notifications
-------------
- Email/SMS on:
  - Successful login.
  - Booking changes.
  - Credit low/expiring soon.
- Use templated messages with personalization (class name, instructor, location).

Testing
-------
- Backend: unit tests for token issuance, policy enforcement, credit refunds.
- Frontend: Cypress flows (request link → login → reschedule), visual tests for dashboard.
- Security: test token reuse, expired token handling, cross-tenant access attempts.

Acceptance Criteria
-------------------
- Customers log in via magic link and stay authenticated across sessions (refresh token) until logout/expiry.
- They can view, reschedule, or cancel bookings within allowed windows, with UI feedback.
- Packages/credits reflect accurate balances; no booking allowed when credits exhausted (unless pay-per-visit).
- Profile updates sync to backend, and notification preferences respected.
- Audit log + notifications triggered for major actions.

