-- CreateEnum
CREATE TYPE "RiskBand" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'EXTREME');

-- CreateEnum
CREATE TYPE "ControlPhase" AS ENUM ('EXISTING', 'ADDITIONAL');

-- CreateEnum
CREATE TYPE "ControlType" AS ENUM ('ENGINEERING', 'ADMIN', 'PPE', 'OTHER');

-- CreateTable
CREATE TABLE "Line" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "machineId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Step" (
    "id" TEXT NOT NULL,
    "stepNo" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "method" TEXT,
    "taskId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HazardCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HazardCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hazard" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hazard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskMatrix" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskMatrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskMatrixCell" (
    "id" TEXT NOT NULL,
    "matrixId" TEXT NOT NULL,
    "severity" INTEGER NOT NULL,
    "probability" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "band" "RiskBand" NOT NULL,

    CONSTRAINT "RiskMatrixCell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StepHazardAssessment" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "hazardId" TEXT NOT NULL,
    "matrixId" TEXT NOT NULL,
    "unsafeConditions" TEXT,
    "unsafeActs" TEXT,
    "potentialHarm" TEXT,
    "existingSeverity" INTEGER,
    "existingProbability" INTEGER,
    "existingRating" INTEGER,
    "existingBand" "RiskBand",
    "newSeverity" INTEGER,
    "newProbability" INTEGER,
    "newRating" INTEGER,
    "newBand" "RiskBand",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StepHazardAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentControl" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "phase" "ControlPhase" NOT NULL,
    "type" "ControlType" NOT NULL,
    "description" TEXT NOT NULL,
    "owner" TEXT,
    "dueDate" TIMESTAMP(3),
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentControl_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Machine_lineId_idx" ON "Machine"("lineId");

-- CreateIndex
CREATE INDEX "Task_machineId_idx" ON "Task"("machineId");

-- CreateIndex
CREATE INDEX "Step_taskId_idx" ON "Step"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "Step_taskId_stepNo_key" ON "Step"("taskId", "stepNo");

-- CreateIndex
CREATE UNIQUE INDEX "Hazard_code_key" ON "Hazard"("code");

-- CreateIndex
CREATE INDEX "Hazard_categoryId_idx" ON "Hazard"("categoryId");

-- CreateIndex
CREATE INDEX "RiskMatrixCell_matrixId_idx" ON "RiskMatrixCell"("matrixId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskMatrixCell_matrixId_severity_probability_key" ON "RiskMatrixCell"("matrixId", "severity", "probability");

-- CreateIndex
CREATE INDEX "StepHazardAssessment_stepId_idx" ON "StepHazardAssessment"("stepId");

-- CreateIndex
CREATE INDEX "StepHazardAssessment_hazardId_idx" ON "StepHazardAssessment"("hazardId");

-- CreateIndex
CREATE UNIQUE INDEX "StepHazardAssessment_stepId_hazardId_key" ON "StepHazardAssessment"("stepId", "hazardId");

-- CreateIndex
CREATE INDEX "AssessmentControl_assessmentId_idx" ON "AssessmentControl"("assessmentId");

-- CreateIndex
CREATE INDEX "AssessmentControl_phase_type_idx" ON "AssessmentControl"("phase", "type");

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "Line"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Step" ADD CONSTRAINT "Step_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hazard" ADD CONSTRAINT "Hazard_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "HazardCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskMatrixCell" ADD CONSTRAINT "RiskMatrixCell_matrixId_fkey" FOREIGN KEY ("matrixId") REFERENCES "RiskMatrix"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepHazardAssessment" ADD CONSTRAINT "StepHazardAssessment_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "Step"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepHazardAssessment" ADD CONSTRAINT "StepHazardAssessment_hazardId_fkey" FOREIGN KEY ("hazardId") REFERENCES "Hazard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepHazardAssessment" ADD CONSTRAINT "StepHazardAssessment_matrixId_fkey" FOREIGN KEY ("matrixId") REFERENCES "RiskMatrix"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentControl" ADD CONSTRAINT "AssessmentControl_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "StepHazardAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
