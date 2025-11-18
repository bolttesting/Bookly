# Missing and Broken Features Audit

## 🔴 Critical Issues (Broken Features)

### 1. Google Calendar Integration - Redirect URI Issue
**Status**: FIXED ✅
**Issue**: The `getGoogleAuthClient()` function was using `process.env` directly instead of the `env` config object, which could cause redirect URI mismatches.
**Location**: `apps/api/src/services/calendarSyncService.ts`
**Fix Applied**: Updated to use `env` config object with fallback redirect URI.

### 2. Outlook Calendar Integration - Environment Variables
**Status**: FIXED ✅
**Issue**: Similar issue - using `process.env` directly instead of `env` config.
**Location**: `apps/api/src/services/calendarSyncService.ts`
**Fix Applied**: Updated to use `env` config object.

### 3. Welcome Emails Not Sending
**Status**: FIXED ✅
**Issue**: Function returned `null` silently when Resend wasn't configured, hiding errors.
**Location**: `apps/api/src/services/notificationService.ts`
**Fix Applied**: Now throws error with clear message if Resend is not configured.

### 4. Password Reset Not Working
**Status**: FIXED ✅
**Issue**: Insufficient error handling and logging.
**Location**: `apps/api/src/routes/modules/auth.ts`
**Fix Applied**: Added better error handling, logging, and validation.

### 5. Stripe Connect Onboarding Missing UI
**Status**: FIXED ✅
**Issue**: Backend endpoints existed but no frontend UI to trigger onboarding.
**Location**: `apps/web/src/pages/settings/BillingPage.tsx`
**Fix Applied**: Added complete Stripe Connect onboarding UI with status indicators.

---

## 🟡 Incomplete Features

### 1. Client Portal - Reschedule Functionality
**Status**: FIXED ✅
**Issue**: The portal mentions "Reschedule or cancel" but only cancel was implemented.
**Location**: `apps/web/src/pages/portal/PortalDashboardPage.tsx`, `apps/api/src/routes/modules/clientPortal.ts`
**Fix Applied**: 
- Added `POST /api/client-portal/appointments/:id/reschedule` endpoint
- Added `GET /api/client-portal/appointments/:id/availability` endpoint
- Created `RescheduleModal` component with date/time selection
- Added reschedule button to portal dashboard
- Enforces 2-hour minimum advance notice policy
- Syncs rescheduled appointments to calendar

### 2. Client Portal - Receipts View
**Status**: FIXED ✅
**Issue**: Packages were shown but receipts/payment history was not implemented.
**Location**: `apps/api/src/routes/modules/clientPortal.ts`, `apps/web/src/pages/portal/PortalDashboardPage.tsx`
**Fix Applied**:
- Added `GET /api/client-portal/receipts` endpoint
- Added receipts section to portal dashboard
- Displays payment history with service names, dates, and amounts

### 3. Calendar Sync - Automatic Refresh Token
**Status**: FIXED ✅
**Issue**: Google Calendar refresh token logic existed but wasn't called automatically when tokens expired.
**Location**: `apps/api/src/services/calendarSyncService.ts`
**Fix Applied**:
- Updated `getGoogleCalendarClient` to check token expiration (5 minutes before expiry)
- Automatically refreshes tokens when needed
- Improved error handling with clear error messages
- All calendar sync functions now use the improved token refresh

### 4. Calendar Sync - Two-Way Sync
**Status**: PARTIALLY FIXED ⚠️
**Issue**: Outlook is still one-way; Google now listens for inbound changes.
**Location**: `apps/api/src/services/calendarSyncService.ts`, `apps/api/src/routes/modules/webhooks.ts`
**Progress**:
- ✅ Google watch channels + `/api/webhooks/google-calendar`
- ✅ Stored webhook metadata per connection
- ✅ Process incoming Google notifications and update Bookly appointments when events move/cancel
- ✅ Mirror external events into `ExternalCalendarEvent` table
- ✅ Outlook Graph subscriptions + `/api/webhooks/outlook-calendar`
- ✅ Outlook delta sync to pull external edits/cancellations
- ⏳ Background job to renew/monitor webhook subscriptions (Google + Outlook expiry)
- ⏳ Conflict detection / UI feedback for externally edited events

### 5. Appointment Updates - Calendar Sync
**Status**: FIXED ✅
**Issue**: Calendar sync happened on create, but didn't always happen on update/delete.
**Location**: `apps/api/src/routes/modules/appointments.ts`
**Fix Applied**:
- Added calendar sync to `PUT /appointments/:id` endpoint
- Added calendar sync to `PUT /appointments/:id/status` endpoint
- Calendar sync now happens on all appointment updates and status changes
- Sync errors are logged but don't fail the request

---

## 🟢 Missing Features (Not Started)

### 1. Email Verification Required
**Status**: FIXED ✅
**Issue**: Email verification tokens were generated but login wasn't blocked for unverified emails.
**Location**: `apps/api/src/routes/modules/auth.ts`, `apps/web/src/pages/auth/LoginPage.tsx`
**Fix Applied**:
- Added email verification check in login endpoint
- Returns 403 with `requiresVerification: true` for unverified users
- Super admins can bypass verification
- Frontend displays appropriate error message

### 2. SMS Reminders Configuration
**Status**: BACKEND ONLY ⚠️
**Issue**: SMS sending is implemented but no UI to configure reminder timing.
**Location**: Missing UI in settings
**What's Missing**:
- Settings page for SMS reminder timing
- Per-service reminder configuration
- Test SMS sending functionality

### 3. Email Reminders Configuration
**Status**: BACKEND ONLY ⚠️
**Issue**: Email sending is implemented but no UI to configure reminder timing.
**Location**: Missing UI in settings
**What's Missing**:
- Settings page for email reminder timing
- Per-service reminder configuration
- Email template customization

### 4. Staff Availability - Recurring Patterns
**Status**: BASIC IMPLEMENTATION ⚠️
**Issue**: Availability blocks exist but may not support complex recurring patterns.
**Location**: `apps/api/src/routes/modules/staff.ts`
**What to Check**:
- Support for "every Monday" type patterns
- Support for exceptions (holidays, time-off)
- UI for managing recurring availability

### 5. Waitlist - Auto-Promotion
**Status**: PARTIALLY FIXED ⚠️
**Issue**: Waitlist promotion endpoint existed but wasn't automatically triggered.
**Location**: `apps/api/src/routes/modules/appointments.ts`
**Fix Applied**:
- Added automatic waitlist promotion when appointments are deleted
- Checks for class occurrences and promotes next waitlist entry
- Runs asynchronously to not block appointment deletion
**Note**: Currently only triggers on appointment deletion. A background job for periodic checks could be added for more comprehensive coverage.

### 6. Analytics - Export Functionality
**Status**: PARTIALLY IMPLEMENTED ⚠️
**Issue**: CSV/PDF export endpoints exist but may not be fully tested.
**Location**: `apps/api/src/routes/modules/analytics.ts`
**What to Check**:
- CSV export formatting
- PDF generation quality
- Large dataset handling

### 7. Super Admin - Impersonation
**Status**: UNKNOWN ⚠️
**Issue**: Impersonation may be mentioned but not fully implemented.
**Location**: Check `apps/api/src/routes/modules/auth.ts` and super admin dashboard
**What to Check**:
- Impersonation endpoint
- UI for impersonating businesses
- Security checks for impersonation

### 8. Test Drive Mode - Limits Enforcement
**Status**: PARTIALLY IMPLEMENTED ⚠️
**Issue**: Test drive tracking exists but limits may not be enforced.
**Location**: `apps/api/src/services/testDriveService.ts`
**What to Check**:
- Appointment count limits
- Feature restrictions
- Upgrade prompts

---

## 📋 Environment Configuration Issues

### Required Environment Variables
Make sure these are set in `apps/api/.env`:

**Email (Resend)**:
- `RESEND_API_KEY` - Required for welcome emails, password reset, email verification
- `EMAIL_FROM` - Optional, defaults to "Bookly <no-reply@bookly.app>"

**Google Calendar**:
- `GOOGLE_CLIENT_ID` - Required for Google Calendar OAuth
- `GOOGLE_CLIENT_SECRET` - Required for Google Calendar OAuth
- `GOOGLE_REDIRECT_URI` - Optional, defaults to `${APP_BASE_URL}/api/calendars/google/callback`
- `GOOGLE_CALENDAR_WEBHOOK_URL` - Required for two-way sync (public HTTPS endpoint for Google push notifications)

**Outlook Calendar**:
- `OUTLOOK_CLIENT_ID` - Required for Outlook Calendar OAuth
- `OUTLOOK_CLIENT_SECRET` - Required for Outlook Calendar OAuth
- `OUTLOOK_REDIRECT_URI` - Optional, defaults to `${APP_BASE_URL}/api/calendars/outlook/callback`
- `OUTLOOK_CALENDAR_WEBHOOK_URL` - Required for Outlook two-way sync (public HTTPS endpoint for Microsoft Graph notifications)

**Stripe Connect**:
- `STRIPE_SECRET_KEY` - Required for Stripe operations
- `STRIPE_CONNECT_CLIENT_ID` - Required for Stripe Connect onboarding
- `STRIPE_WEBHOOK_SECRET` - Required for webhook verification

---

## 🔧 Recommended Next Steps

### Priority 1 (Critical):
1. ✅ Fix Google Calendar redirect URI issue
2. ✅ Fix welcome email sending
3. ✅ Fix password reset
4. ✅ Add Stripe Connect UI

### Priority 2 (Important):
1. Implement client portal reschedule functionality
2. Add email verification enforcement
3. Add calendar two-way sync
4. Add SMS/Email reminder configuration UI

### Priority 3 (Nice to Have):
1. Add receipts view to client portal
2. Implement waitlist auto-promotion
3. Add staff availability recurring patterns UI
4. Test and improve analytics exports

---

## 🧪 Testing Checklist

- [ ] Test Google Calendar OAuth flow end-to-end
- [ ] Test Outlook Calendar OAuth flow end-to-end
- [ ] Test appointment creation syncs to calendar
- [ ] Test appointment update syncs to calendar
- [ ] Test appointment deletion removes from calendar
- [ ] Test welcome email sending
- [ ] Test password reset flow
- [ ] Test Stripe Connect onboarding
- [ ] Test client portal cancel functionality
- [ ] Test client portal reschedule (if implemented)

---

## 📝 Notes

- Most features are implemented but may need configuration (env variables)
- Some features are backend-only and need frontend UI
- Some features are one-way and need two-way sync
- Calendar sync works but may need better error handling for expired tokens

