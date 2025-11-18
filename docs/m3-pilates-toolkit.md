Pilates Toolkit Implementation Plan (Milestone 3.4)
==================================================

Objective
---------
Deliver Pilates-specific scheduling capabilities that go beyond generic appointment booking:
- Group/reformer classes with capacity management and waitlists.
- Equipment/room allocation awareness.
- Session credit packages with automatic deduction and expirations.
- Instructor substitution workflows with auditability.

Feature Breakdown
-----------------
1. **Class Templates & Schedules**
   - Define `ClassTemplate` entities (name, type: `MAT`, `REFORMER`, `TOWER`, duration, default instructor, default capacity, default resources).
   - Schedule recurring classes via `ClassSeries` (template_id, recurrence rule, start date, end date, exceptions).
   - Generate `ClassOccurrence` records for each actual session; these become bookable slots and integrate with the general `appointments` table (type=`CLASS`).

2. **Resource Management**
   - `Resource` model for rooms, reformers, props (fields: business_id, name, type, quantity, color).
   - `ResourceReservation` linking appointments/classes to specific resources or counts (e.g., 1 reformer). Supports both exclusive (reformer) and shared (props) resources.
   - Availability checks ensure resources aren’t oversubscribed; surfaces conflicts during scheduling.

3. **Session Credits & Packages**
   - `Package` entity (name, credits, price, expiry_days, applicable_service_ids/class_templates).
   - `CustomerPackage` to track purchases (remaining_credits, expiry_date, status).
   - Booking flow requires an available credit (or payment) for classes flagged as “credit required.”
   - Automatic decrement when booking, refund credit on cancellation based on policy (customizable: e.g., return credit if canceled 12h in advance).

4. **Waitlist & Substitution**
   - `WaitlistEntry` per class occurrence (customer_id, priority, created_at). When a seat frees up, system auto-promotes next customer and notifies them.
   - Instructor substitution flow: staff can assign a replacement, triggering notifications and optional resource adjustments.

5. **Analytics & Reporting**
   - KPIs: class fill rate, resource utilization, credit burn, member attendance streaks.
   - Expose APIs for dashboards and upcoming analytics milestone.

Data Model Additions (Prisma)
----------------------------
```prisma
enum ClassType {
  MAT
  REFORMER
  TOWER
  PRIVATE
}

model ClassTemplate {
  id              String     @id @default(cuid())
  business        Business   @relation(fields: [businessId], references: [id])
  businessId      String
  name            String
  type            ClassType
  durationMinutes Int
  defaultCapacity Int
  description     String?
  color           String?
  defaultInstructorId String?
  defaultResources Json?
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
}

model ClassSeries {
  id             String   @id @default(cuid())
  classTemplate  ClassTemplate @relation(fields: [templateId], references: [id])
  templateId     String
  recurrenceRule String // iCal RRULE
  startDate      DateTime
  endDate        DateTime?
  exceptions     Json?
  createdAt      DateTime @default(now())
}

model ClassOccurrence {
  id            String   @id @default(cuid())
  template      ClassTemplate @relation(fields: [templateId], references: [id])
  templateId    String
  startTime     DateTime
  endTime       DateTime
  capacity      Int
  bookedCount   Int      @default(0)
  waitlistCount Int      @default(0)
  status        String   @default("SCHEDULED")
  instructorId  String?
  resources     Json?
  createdAt     DateTime @default(now())
}

model Resource {
  id          String   @id @default(cuid())
  business    Business @relation(fields: [businessId], references: [id])
  businessId  String
  name        String
  type        String
  quantity    Int      @default(1)
  color       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model ResourceReservation {
  id             String   @id @default(cuid())
  resource       Resource @relation(fields: [resourceId], references: [id])
  resourceId     String
  appointmentId  String?
  classOccurrenceId String?
  quantity       Int      @default(1)
  createdAt      DateTime @default(now())
}

model Package {
  id            String   @id @default(cuid())
  business      Business @relation(fields: [businessId], references: [id])
  businessId    String
  name          String
  credits       Int
  price         Decimal  @db.Decimal(10,2)
  expiryDays    Int?
  applicableServices Json?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model CustomerPackage {
  id           String    @id @default(cuid())
  customer     Customer  @relation(fields: [customerId], references: [id])
  customerId   String
  package      Package   @relation(fields: [packageId], references: [id])
  packageId    String
  remainingCredits Int
  expiryDate   DateTime?
  status       String    @default("ACTIVE")
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}

model WaitlistEntry {
  id              String   @id @default(cuid())
  classOccurrence ClassOccurrence @relation(fields: [classOccurrenceId], references: [id])
  classOccurrenceId String
  customer        Customer @relation(fields: [customerId], references: [id])
  customerId      String
  position        Int
  createdAt       DateTime @default(now())
}
```

API Surface
-----------
- `/api/classes/templates` CRUD.
- `/api/classes/series` CRUD (creates occurrences in background job).
- `/api/classes/occurrences` list per date range, book/cancel seat.
- `/api/resources` CRUD + availability endpoint.
- `/api/packages` CRUD; `/api/customers/:id/packages` for assignment and credit adjustments.
- Waitlist endpoints: join, leave, promote.
- Automation hooks: when occurrence is full -> add to waitlist; when seat available -> auto-promote + notify via Resend/Twilio.

Frontend UX
-----------
- **Class Builder UI**: multi-step form (details → schedule → resources → pricing/credits) with live capacity preview.
- **Resource Dashboard**: timeline view of reformer usage, alerts for overbooking.
- **Customer Profile**: packages tab showing credits, expiry, history.
- **Calendar Integrations**: toggle to display class occurrences vs. 1:1 appointments, color-coded by template type.
- **Waitlist Management**: staff can reorder or manually promote waitlisted customers.

Notifications & Automation
--------------------------
- Emails/SMS for:
  - Class booking confirmation, seat promotion from waitlist, instructor change, upcoming class reminders (with credit balance).
- Webhook-style events to support future automation builder.

Testing Strategy
----------------
- Backend unit tests for credit deduction/refund logic, waitlist promotion, resource conflicts.
- Integration tests for class booking flows (create template → schedule → book multiple attendees → manage waitlist).
- Frontend Cypress specs for class creation wizard and customer package purchase.

Dependencies & Risks
--------------------
- Requires background job processor (Bull/Redis) to generate recurring occurrences and send notifications on promotions.
- Need Stripe integration for package purchases (tie-in with Milestone 6).
- Ensure timezone complexities handled for recurring classes (RRULE expansion).

Milestone Acceptance
--------------------
- Owners can create Pilates class templates/series with resources and capacities.
- Customers can book into classes using credits; waitlists auto-promote and notify.
- Resource utilization prevents double-booking equipment/rooms.
- Reports show class fill rate and credit burn at least in MVP dashboard cards.

