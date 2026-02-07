/*
  Warnings:

  - You are about to drop the column `isVerified` on the `AssessmentControl` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ControlStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'IMPLEMENTED', 'VERIFIED', 'CANCELLED');

-- AlterTable
ALTER TABLE "AssessmentControl" DROP COLUMN "isVerified",
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "completedBy" TEXT,
ADD COLUMN     "evidenceUrl" TEXT,
ADD COLUMN     "status" "ControlStatus" NOT NULL DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE "StepHazardAssessment" ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedBand" "RiskBand",
ADD COLUMN     "verifiedBy" TEXT,
ADD COLUMN     "verifiedProbability" INTEGER,
ADD COLUMN     "verifiedRating" INTEGER,
ADD COLUMN     "verifiedSeverity" INTEGER;
