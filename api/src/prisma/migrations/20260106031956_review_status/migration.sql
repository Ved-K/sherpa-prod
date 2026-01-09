-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('DRAFT', 'REVIEWED', 'FINAL');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('UPDATE', 'DELETE', 'CLONE', 'STATUS_CHANGE');

-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('LINE', 'MACHINE', 'TASK', 'STEP', 'ASSESSMENT', 'CONTROL');

-- AlterTable
ALTER TABLE "Line" ADD COLUMN     "finalizedAt" TIMESTAMP(3),
ADD COLUMN     "finalizedBy" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" TEXT,
ADD COLUMN     "status" "ReviewStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "Machine" ADD COLUMN     "finalizedAt" TIMESTAMP(3),
ADD COLUMN     "finalizedBy" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" TEXT,
ADD COLUMN     "status" "ReviewStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "Step" ADD COLUMN     "finalizedAt" TIMESTAMP(3),
ADD COLUMN     "finalizedBy" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" TEXT,
ADD COLUMN     "status" "ReviewStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "StepHazardAssessment" ADD COLUMN     "finalizedAt" TIMESTAMP(3),
ADD COLUMN     "finalizedBy" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" TEXT,
ADD COLUMN     "status" "ReviewStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "finalizedAt" TIMESTAMP(3),
ADD COLUMN     "finalizedBy" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" TEXT,
ADD COLUMN     "status" "ReviewStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "actor" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "before" JSONB,
    "after" JSONB,
    "meta" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
