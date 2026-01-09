import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, AuditEntityType, ReviewStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AssessmentsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private async ensureStep(stepId: string) {
    const step = await this.prisma.step.findUnique({ where: { id: stepId } });
    if (!step) throw new NotFoundException('Step not found');
  }

  private async ensureHazard(hazardId: string) {
    const hazard = await this.prisma.hazard.findUnique({
      where: { id: hazardId },
    });
    if (!hazard) throw new NotFoundException('Hazard not found');
  }

  private async ensureActiveMatrixId(): Promise<string> {
    const active = await this.prisma.riskMatrix.findFirst({
      where: { isActive: true },
    });
    if (!active)
      throw new BadRequestException('No active RiskMatrix configured');
    return active.id;
  }

  async listForStep(stepId: string) {
    await this.ensureStep(stepId);
    return this.prisma.stepHazardAssessment.findMany({
      where: { stepId },
      orderBy: { createdAt: 'asc' },
      include: {
        hazard: { include: { category: true } },
        controls: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  async attachHazard(stepId: string, hazardId: string) {
    await this.ensureStep(stepId);
    await this.ensureHazard(hazardId);

    const matrixId = await this.ensureActiveMatrixId();

    try {
      return await this.prisma.stepHazardAssessment.create({
        data: { stepId, hazardId, matrixId, status: ReviewStatus.DRAFT },
      });
    } catch {
      throw new BadRequestException('Hazard already attached to this step');
    }
  }

  async bulkAttach(stepId: string, hazardIds: string[]) {
    await this.ensureStep(stepId);
    const matrixId = await this.ensureActiveMatrixId();

    // validate hazards exist
    const found = await this.prisma.hazard.findMany({
      where: { id: { in: hazardIds } },
      select: { id: true },
    });
    const foundSet = new Set(found.map((h) => h.id));
    const missing = hazardIds.filter((id) => !foundSet.has(id));
    if (missing.length)
      throw new NotFoundException(`Hazards not found: ${missing.join(', ')}`);

    const created = [];
    for (const hazardId of hazardIds) {
      try {
        created.push(
          await this.prisma.stepHazardAssessment.create({
            data: { stepId, hazardId, matrixId, status: ReviewStatus.DRAFT },
          }),
        );
      } catch {
        // ignore duplicates
      }
    }
    return created;
  }

  private async resolveCell(
    matrixId: string,
    severity: number,
    probability: number,
  ) {
    const cell = await this.prisma.riskMatrixCell.findUnique({
      where: {
        matrixId_severity_probability: { matrixId, severity, probability },
      },
    });
    if (!cell) throw new BadRequestException('Invalid risk matrix cell');
    return { rating: cell.rating, band: cell.band };
  }

  async get(assessmentId: string) {
    const a = await this.prisma.stepHazardAssessment.findUnique({
      where: { id: assessmentId },
    });
    if (!a) throw new NotFoundException('Assessment not found');
    return a;
  }

  async update(assessmentId: string, dto: any, actor = 'anonymous') {
    const before = await this.get(assessmentId);

    const data: any = {
      unsafeConditions: dto.unsafeConditions,
      unsafeActs: dto.unsafeActs,
      potentialHarm: dto.potentialHarm,
      notes: dto.notes,
      existingSeverity: dto.existingSeverity,
      existingProbability: dto.existingProbability,
      newSeverity: dto.newSeverity,
      newProbability: dto.newProbability,
    };

    // existing rating calc
    const nextExistingSeverity =
      dto.existingSeverity ?? before.existingSeverity;
    const nextExistingProbability =
      dto.existingProbability ?? before.existingProbability;
    if (
      dto.existingSeverity !== undefined ||
      dto.existingProbability !== undefined
    ) {
      if (nextExistingSeverity && nextExistingProbability) {
        const r = await this.resolveCell(
          before.matrixId,
          nextExistingSeverity,
          nextExistingProbability,
        );
        data.existingRating = r.rating;
        data.existingBand = r.band;
      } else {
        data.existingRating = null;
        data.existingBand = null;
      }
    }

    // new rating calc
    const nextNewSeverity = dto.newSeverity ?? before.newSeverity;
    const nextNewProbability = dto.newProbability ?? before.newProbability;
    if (dto.newSeverity !== undefined || dto.newProbability !== undefined) {
      if (nextNewSeverity && nextNewProbability) {
        const r = await this.resolveCell(
          before.matrixId,
          nextNewSeverity,
          nextNewProbability,
        );
        data.newRating = r.rating;
        data.newBand = r.band;
      } else {
        data.newRating = null;
        data.newBand = null;
      }
    }

    const after = await this.prisma.stepHazardAssessment.update({
      where: { id: assessmentId },
      data,
    });

    if (this.audit.shouldAudit(before.status)) {
      await this.audit.log({
        entityType: AuditEntityType.ASSESSMENT,
        entityId: assessmentId,
        action: AuditAction.UPDATE,
        actor,
        before,
        after,
      });
    }

    return after;
  }

  async setStatus(
    assessmentId: string,
    status: ReviewStatus,
    actor = 'anonymous',
  ) {
    const before = await this.get(assessmentId);
    const now = new Date();

    const data =
      status === ReviewStatus.DRAFT
        ? {
            status,
            reviewedAt: null,
            reviewedBy: null,
            finalizedAt: null,
            finalizedBy: null,
          }
        : status === ReviewStatus.REVIEWED
          ? {
              status,
              reviewedAt: before.reviewedAt ?? now,
              reviewedBy: before.reviewedBy ?? actor,
              finalizedAt: null,
              finalizedBy: null,
            }
          : {
              status,
              reviewedAt: before.reviewedAt ?? now,
              reviewedBy: before.reviewedBy ?? actor,
              finalizedAt: before.finalizedAt ?? now,
              finalizedBy: before.finalizedBy ?? actor,
            };

    const after = await this.prisma.stepHazardAssessment.update({
      where: { id: assessmentId },
      data,
    });

    await this.audit.log({
      entityType: AuditEntityType.ASSESSMENT,
      entityId: assessmentId,
      action: AuditAction.STATUS_CHANGE,
      actor,
      before,
      after,
    });

    return after;
  }

  async remove(assessmentId: string, actor = 'anonymous') {
    const before = await this.get(assessmentId);

    await this.prisma.$transaction(async (tx) => {
      await tx.assessmentControl.deleteMany({ where: { assessmentId } });
      await tx.stepHazardAssessment.delete({ where: { id: assessmentId } });
    });

    if (this.audit.shouldAudit(before.status)) {
      await this.audit.log({
        entityType: AuditEntityType.ASSESSMENT,
        entityId: assessmentId,
        action: AuditAction.DELETE,
        actor,
        before,
        meta: { hardDelete: true },
      });
    }

    return { ok: true };
  }
}
