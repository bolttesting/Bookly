Milestone 2 — Authentication & Tenant Setup
===========================================

Purpose
-------
Establish secure authentication, tenancy, and onboarding foundations so every subsequent feature operates within the right business context. This covers user registration/login, business creation, role enforcement, protected UI flows, and audit trails.

Scope Summary
-------------
1. **JWT Auth Flow**: Email/password auth with refresh tokens and device/session awareness.
2. **Business Onboarding Wizard**: Guide new owners through business profile, hours, and first service/staff entries.
3. **Role & Permissions**: Owner, Staff, Admin (internal) with fine-grained capability matrix.
4. **Protected Routes & State**: React Router guards, Zustand auth store, TanStack Query hydration.
5. **Audit Logging**: Track sensitive changes (auth events, staff/service edits, payment configuration).

Tech Stack Decisions
--------------------
- **Backend**: Node + Express + TypeScript using JWT (access 15m, refresh 7d). Password hashing via `argon2id`. Redis for refresh token blacklisting (device sessions).
- **Database Entities (new)**:
  - `sessions`: id, user_id, refresh_token_hash, user_agent, ip_address, last_used_at.
  - `audit_logs`: id, business_id, user_id, action, metadata (JSON), created_at.
- **Frontend**: React 18, React Router DOM 6.23, Zustand store `useAuthStore`, Query client persists tokens via HttpOnly cookies (REST) or Bearer headers (web sockets).
- **Security**: Enforce rate limiting on auth endpoints, CAPTCHA optional for suspicious attempts, email verification via Resend.

Task Breakdown & Acceptance Criteria
------------------------------------
### 2.1 Implement JWT Auth Flow (API + Frontend)
- Backend endpoints: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/refresh-token`, `GET /api/auth/me`.
- Use HttpOnly cookies for refresh token (for browser clients) and return access token in response body.
- Store refresh tokens hashed in `sessions` table; support multi-device management and manual revocation.
- Frontend: build `authService` hook + TanStack Query mutation wrappers; handle optimistic UI during login.
- Acceptance: user can register, verify email, log in/out, refresh tokens, and see session list under account settings.

### 2.2 Business Onboarding Wizard
- After registration, redirect owners into a 3-step wizard:
  1. Business basics (name, industry, timezone, currency, contact info).
  2. Hours & services (default working hours, first service creation).
  3. Staff invite (owner profile confirmation, optional staff invite email).
- Persist partial progress (local storage + backend `onboarding_state` column).
- Acceptance: owner cannot access dashboard until onboarding complete; wizard is resumable and mobile-friendly.

### 2.3 Role Model & Permissions
- Roles:
  - `owner`: full access to business settings, billing, staff.
  - `staff`: limited to calendar, customer notes, personal availability.
  - `admin`: Bookly internal support role (impersonate for troubleshooting, read-only finance).
- Create `permissions` enum to gate API controllers (e.g., `can_manage_services`, `can_view_financials`).
- Seed default role-permission mapping; allow future per-staff overrides.
- Acceptance: API middleware enforces permissions; unauthorized calls return 403 with structured error.

### 2.4 Frontend Protected Routes & Layout
- Implement auth-aware router:
  - Public routes: marketing, login, register, public booking.
  - Protected routes: dashboard, calendar, management pages.
- `RequireAuth` component fetches `/api/auth/me`, handles loading skeleton, redirect to `/login` if needed.
- Zustand `useAuthStore` keeps `user`, `business`, `isAuthenticated`, `isLoading`, `sessions`.
- Acceptance: direct navigation to protected route when logged out results in friendly redirect; refresh maintains session without flicker.

### 2.5 Audit Logging
- Middleware attaches `requestContext` (user_id, business_id, ip) and writes entries to `audit_logs`.
- Events to capture initially: login success/fail, logout, password change, staff CRUD, service CRUD, payment settings updates.
- Provide backend endpoint `GET /api/audit-logs` (owner only) with filters.
- Acceptance: modifications visible in dashboard audit tab; logs paginated with search.

Implementation Notes
--------------------
- Use Zod schemas for payload validation on both client and server.
- Introduce `@bookly/config` package to share constants (permissions list, API URLs).
- Add `.env.example` entries: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `RESEND_API_KEY`, `TWILIO_*`, `REDIS_URL`.
- Write Jest tests for auth services and Cypress specs for onboarding flow.

Dependencies & Risks
--------------------
- Need environmental secrets provisioned before end-to-end testing.
- Email verification requires domain setup in Resend; may need sandbox mode initially.
- Rate limiting & CAPTCHA integration depends on chosen provider (e.g., Cloudflare Turnstile).

Checklist Reference
-------------------
- [x] 2.1 Auth flow implemented end-to-end. (`apps/api/src/routes/modules/auth.ts`, `apps/web/src/pages/auth/*`)
- [x] 2.2 Onboarding wizard completed. (`apps/web/src/pages/onboarding/OnboardingWizard.tsx`)
- [x] 2.3 Role/permissions enforced. (`apps/api/src/constants/permissions.ts`, middleware + guards)
- [x] 2.4 Frontend guards wired. (`apps/web/src/components/RequireAuth.tsx`, `PrivateLayout.tsx`)
- [x] 2.5 Audit logging live with UI visibility. (`recordAuditLog`, `/api/audit-logs`, dashboard view TBD)

Update this document as tasks progress; mirror completion in `PLAN.md`.

