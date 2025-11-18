-- CreateEnum
CREATE TYPE "PaymentConnectionStatus" AS ENUM ('NOT_CONNECTED', 'PENDING', 'ACTIVE');

-- AlterTable
ALTER TABLE "Business"
  ADD COLUMN     "paymentConnectionStatus" "PaymentConnectionStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
  ADD COLUMN     "stripeAccountId" TEXT,
  ADD COLUMN     "stripeChargesEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN     "stripePayoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN     "stripeOnboardingCompletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Appointment"
  ADD COLUMN     "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN     "stripePaymentIntentId" TEXT;

