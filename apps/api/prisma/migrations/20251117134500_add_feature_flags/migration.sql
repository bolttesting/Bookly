-- CreateEnum
CREATE TYPE "FeatureFlagKey" AS ENUM ('PILATES_TOOLKIT', 'MEDICAL_COMPLIANCE', 'AGENCY_RETAINER', 'MARKETING_AUTOMATION', 'EMBED_WIDGETS');

-- AlterTable
-- CreateTable
CREATE TABLE "BusinessFeature" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "key" "FeatureFlagKey" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessFeature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessFeature_businessId_key_key" ON "BusinessFeature"("businessId", "key");

-- AddForeignKey
ALTER TABLE "BusinessFeature" ADD CONSTRAINT "BusinessFeature_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

