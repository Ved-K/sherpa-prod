import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, AuditEntityType, ReviewStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class MachinesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private async ensureLine(lineId: string) {
    const line = await this.prisma.line.findUnique({ where: { id: lineId } });
    if (!line) throw new NotFoundException('Line not found');
  }

  async listForLine(lineId: string) {
    await this.ensureLine(lineId);
    return this.prisma.machine.findMany({
      where: { lineId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createForLine(lineId: string, name: string) {
    await this.ensureLine(lineId);
    return this.prisma.machine.create({
      data: { lineId, name, status: ReviewStatus.DRAFT },
    });
  }

  async get(machineId: string) {
    const machine = await this.prisma.machine.findUnique({
      where: { id: machineId },
    });
    if (!machine) throw new NotFoundException('Machine not found');
    return machine;
  }

  async update(
    machineId: string,
    data: { name?: string },
    actor = 'anonymous',
  ) {
    const before = await this.get(machineId);
    const after = await this.prisma.machine.update({
      where: { id: machineId },
      data,
    });

    if (this.audit.shouldAudit(before.status)) {
      await this.audit.log({
        entityType: AuditEntityType.MACHINE,
        entityId: machineId,
        action: AuditAction.UPDATE,
        actor,
        before,
        after,
      });
    }

    return after;
  }

  async setStatus(
    machineId: string,
    status: ReviewStatus,
    actor = 'anonymous',
  ) {
    const before = await this.get(machineId);
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

    const after = await this.prisma.machine.update({
      where: { id: machineId },
      data,
    });

    await this.audit.log({
      entityType: AuditEntityType.MACHINE,
      entityId: machineId,
      action: AuditAction.STATUS_CHANGE,
      actor,
      before,
      after,
    });

    return after;
  }

  async remove(machineId: string, actor = 'anonymous') {
    const before = await this.get(machineId);

    // cascade: controls -> assessments -> steps -> tasks -> machine
    await this.prisma.$transaction(async (tx) => {
      const taskIds = (
        await tx.task.findMany({ where: { machineId }, select: { id: true } })
      ).map((t) => t.id);
      const stepIds = taskIds.length
        ? (
            await tx.step.findMany({
              where: { taskId: { in: taskIds } },
              select: { id: true },
            })
          ).map((s) => s.id)
        : [];
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
      if (taskIds.length) {
        await tx.task.deleteMany({ where: { id: { in: taskIds } } });
      }
      await tx.machine.delete({ where: { id: machineId } });
    });

    if (this.audit.shouldAudit(before.status)) {
      await this.audit.log({
        entityType: AuditEntityType.MACHINE,
        entityId: machineId,
        action: AuditAction.DELETE,
        actor,
        before,
        meta: { hardDelete: true },
      });
    }

    return { ok: true };
  }
}
