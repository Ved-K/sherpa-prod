/*
  Warnings:

  - The values [EXTREME] on the enum `RiskBand` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'APPLIED');

-- CreateEnum
CREATE TYPE "ChangeScope" AS ENUM ('LINE_TREE', 'MACHINE_TREE', 'TASK_TREE', 'STEP_TREE', 'ASSESSMENT', 'HAZARD_LIBRARY', 'RISK_MATRIX');

-- AlterEnum
BEGIN;
CREATE TYPE "RiskBand_new" AS ENUM ('LOW', 'MEDIUM', 'MEDIUM_PLUS', 'HIGH', 'VERY_HIGH');
ALTER TABLE "RiskMatrixCell" ALTER COLUMN "band" TYPE "RiskBand_new" USING ("band"::text::"RiskBand_new");
ALTER TABLE "StepHazardAssessment" ALTER COLUMN "existingBand" TYPE "RiskBand_new" USING ("existingBand"::text::"RiskBand_new");
ALTER TABLE "StepHazardAssessment" ALTER COLUMN "newBand" TYPE "RiskBand_new" USING ("newBand"::text::"RiskBand_new");
ALTER TYPE "RiskBand" RENAME TO "RiskBand_old";
ALTER TYPE "RiskBand_new" RENAME TO "RiskBand";
DROP TYPE "RiskBand_old";
COMMIT;

-- CreateTable
CREATE TABLE "AppUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "entraOid" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeRequest" (
    "id" TEXT NOT NULL,
    "scope" "ChangeScope" NOT NULL,
    "rootId" TEXT NOT NULL,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "submittedBy" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reason" TEXT,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "ChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_email_key" ON "AppUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_entraOid_key" ON "AppUser"("entraOid");
