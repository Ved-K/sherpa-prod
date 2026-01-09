import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, AuditEntityType, ReviewStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private async ensureMachine(machineId: string) {
    const machine = await this.prisma.machine.findUnique({
      where: { id: machineId },
    });
    if (!machine) throw new NotFoundException('Machine not found');
  }

  async listForMachine(machineId: string) {
    await this.ensureMachine(machineId);
    return this.prisma.task.findMany({
      where: { machineId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createForMachine(
    machineId: string,
    name: string,
    description?: string,
    trainingLink?: string,
    categoryId?: string,
    phaseId?: string,
  ) {
    await this.ensureMachine(machineId);
    return this.prisma.task.create({
      data: {
        machineId,
        name,
        description,
        trainingLink,
        status: ReviewStatus.DRAFT,
        categoryId,
        phaseId,
      },
    });
  }

  async get(taskId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async update(
    taskId: string,
    data: {
      name?: string;
      description?: string;
      trainingLink?: string;
      categoryId?: string;
      phaseId?: string;
    },
    actor = 'anonymous',
  ) {
    const before = await this.get(taskId);
    const after = await this.prisma.task.update({
      where: { id: taskId },
      data,
    });

    if (this.audit.shouldAudit(before.status)) {
      await this.audit.log({
        entityType: AuditEntityType.TASK,
        entityId: taskId,
        action: AuditAction.UPDATE,
        actor,
        before,
        after,
      });
    }

    return after;
  }

  async setStatus(taskId: string, status: ReviewStatus, actor = 'anonymous') {
    const before = await this.get(taskId);
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

    const after = await this.prisma.task.update({
      where: { id: taskId },
      data,
    });

    await this.audit.log({
      entityType: AuditEntityType.TASK,
      entityId: taskId,
      action: AuditAction.STATUS_CHANGE,
      actor,
      before,
      after,
    });

    return after;
  }

  async remove(taskId: string, actor = 'anonymous') {
    const before = await this.get(taskId);

    // cascade: controls -> assessments -> steps -> task
    await this.prisma.$transaction(async (tx) => {
      const stepIds = (
        await tx.step.findMany({ where: { taskId }, select: { id: true } })
      ).map((s) => s.id);
      const assessmentIds = stepIds.length
        ? (
            await tx.stepHazardAssessment.findMany({
              where: { stepId: { in: stepIds } },
              select: { id: true },
            })
          ).map((a) => a.id)
        : [];

      if (assessmentIds.length) {
        await tx.assessmentControl.deleteMany({
          where: { assessmentId: { in: assessmentIds } },
        });
      }

      if (stepIds.length) {
        await tx.stepHazardAssessment.deleteMany({
          where: { stepId: { in: stepIds } },
        });
        await tx.step.deleteMany({ where: { id: { in: stepIds } } });
      }

      await tx.task.delete({ where: { id: taskId } });
    });

    if (this.audit.shouldAudit(before.status)) {
      await this.audit.log({
        entityType: AuditEntityType.TASK,
        entityId: taskId,
        action: AuditAction.DELETE,
        actor,
        before,
        meta: { hardDelete: true },
      });
    }

    return { ok: true };
  }
}
