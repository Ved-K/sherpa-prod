-- AlterTable
ALTER TABLE "AssessmentControl" ADD COLUMN     "categoryId" TEXT;

-- CreateTable
CREATE TABLE "ActionCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActionCategory_name_key" ON "ActionCategory"("name");

-- CreateIndex
CREATE INDEX "AssessmentControl_categoryId_idx" ON "AssessmentControl"("categoryId");

-- CreateIndex
CREATE INDEX "AssessmentControl_phase_categoryId_idx" ON "AssessmentControl"("phase", "categoryId");

-- AddForeignKey
ALTER TABLE "AssessmentControl" ADD CONSTRAINT "AssessmentControl_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ActionCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
