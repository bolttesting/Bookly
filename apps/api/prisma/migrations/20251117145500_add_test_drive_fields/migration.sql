-- CreateEnum
CREATE TYPE "TestDriveStatus" AS ENUM ('NONE', 'ACTIVE', 'EXPIRED', 'COMPLETED');

-- AlterTable
ALTER TABLE "Business"
  ADD COLUMN     "testDriveStatus" "TestDriveStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN     "testDriveActivatedAt" TIMESTAMP(3),
  ADD COLUMN     "testDriveEndsAt" TIMESTAMP(3);

