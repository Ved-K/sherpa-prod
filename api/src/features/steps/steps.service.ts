import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, AuditEntityType, ReviewStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class StepsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private async ensureTask(taskId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
  }

  async listForTask(taskId: string) {
    await this.ensureTask(taskId);
    return this.prisma.step.findMany({
      where: { taskId },
      orderBy: { stepNo: 'asc' },
    });
  }

  private async nextStepNo(taskId: string): Promise<number> {
    const last = await this.prisma.step.findFirst({
      where: { taskId },
      orderBy: { stepNo: 'desc' },
      select: { stepNo: true },
    });
    return (last?.stepNo ?? 0) + 1;
  }

  async createForTask(
    taskId: string,
    title: string,
    method?: string,
    stepNo?: number,
    trainingLink?: string,
  ) {
    await this.ensureTask(taskId);
    const assignedNo = stepNo ?? (await this.nextStepNo(taskId));

    try {
      return this.prisma.step.create({
        data: {
          taskId,
          stepNo: assignedNo,
          title,
          method,
          trainingLink,
          status: ReviewStatus.DRAFT,
        },
      });
    } catch {
      throw new BadRequestException('stepNo already exists for this task');
    }
  }

  async get(stepId: string) {
    const step = await this.prisma.step.findUnique({ where: { id: stepId } });
    if (!step) throw new NotFoundException('Step not found');
    return step;
  }

  async update(
    stepId: string,
    data: {
      stepNo?: number;
      title?: string;
      method?: string;
      trainingLink?: string;
    },
    actor = 'anonymous',
  ) {
    const before = await this.get(stepId);

    try {
      const after = await this.prisma.step.update({
        where: { id: stepId },
        data,
      });

      if (this.audit.shouldAudit(before.status)) {
        await this.audit.log({
          entityType: AuditEntityType.STEP,
          entityId: stepId,
          action: AuditAction.UPDATE,
          actor,
          before,
          after,
        });
      }

      return after;
    } catch {
      throw new BadRequestException(
        'Invalid update (stepNo may be duplicated)',
      );
    }
  }

  async setStatus(stepId: string, status: ReviewStatus, actor = 'anonymous') {
    const before = await this.get(stepId);
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

    const after = await this.prisma.step.update({
      where: { id: stepId },
      data,
    });

    await this.audit.log({
      entityType: AuditEntityType.STEP,
      entityId: stepId,
      action: AuditAction.STATUS_CHANGE,
      actor,
      before,
      after,
    });

    return after;
  }

  async remove(stepId: string, actor = 'anonymous') {
    const before = await this.get(stepId);

    // cascade: controls -> assessments -> step
    await this.prisma.$transaction(async (tx) => {
      const assessmentIds = (
        await tx.stepHazardAssessment.findMany({
          where: { stepId },
          select: { id: true },
        })
      ).map((a) => a.id);

      if (assessmentIds.length) {
        await tx.assessmentControl.deleteMany({
          where: { assessmentId: { in: assessmentIds } },
        });
      }

      await tx.stepHazardAssessment.deleteMany({ where: { stepId } });
      await tx.step.delete({ where: { id: stepId } });
    });

    if (this.audit.shouldAudit(before.status)) {
      await this.audit.log({
        entityType: AuditEntityType.STEP,
        entityId: stepId,
        action: AuditAction.DELETE,
        actor,
        before,
        meta: { hardDelete: true },
      });
    }

    return { ok: true };
  }

  async bulkCreateForTask(
    taskId: string,
    items: { title: string; method?: string; trainingLink?: string }[],
  ) {
    await this.ensureTask(taskId);

    const last = await this.prisma.step.findFirst({
      where: { taskId },
      orderBy: { stepNo: 'desc' },
      select: { stepNo: true },
    });

    let nextNo = (last?.stepNo ?? 0) + 1;

    return this.prisma.$transaction(async (tx) => {
      const created = [];
      for (const item of items) {
        const step = await tx.step.create({
          data: {
            taskId,
            stepNo: nextNo++,
            title: item.title,
            method: item.method,
            trainingLink: item.trainingLink,
            status: ReviewStatus.DRAFT,
          },
        });
        created.push(step);
      }
      return created;
    });
  }
}
