import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, AuditEntityType, ReviewStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class LinesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  list() {
    return this.prisma.line.findMany({ orderBy: { createdAt: 'desc' } });
  }

  create(name: string) {
    return this.prisma.line.create({
      data: { name, status: ReviewStatus.DRAFT },
    });
  }

  async get(lineId: string) {
    const line = await this.prisma.line.findUnique({ where: { id: lineId } });
    if (!line) throw new NotFoundException('Line not found');
    return line;
  }

  async update(lineId: string, data: { name?: string }, actor = 'anonymous') {
    const before = await this.get(lineId);
    const after = await this.prisma.line.update({
      where: { id: lineId },
      data,
    });

    if (this.audit.shouldAudit(before.status)) {
      await this.audit.log({
        entityType: AuditEntityType.LINE,
        entityId: lineId,
        action: AuditAction.UPDATE,
        actor,
        before,
        after,
      });
    }

    return after;
  }

  async setStatus(lineId: string, status: ReviewStatus, actor = 'anonymous') {
    const before = await this.get(lineId);
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

    const after = await this.prisma.line.update({
      where: { id: lineId },
      data,
    });

    await this.audit.log({
      entityType: AuditEntityType.LINE,
      entityId: lineId,
      action: AuditAction.STATUS_CHANGE,
      actor,
      before,
      after,
    });

    return after;
  }

  async remove(lineId: string, actor = 'anonymous') {
    const before = await this.get(lineId);

    // cascade: controls -> assessments -> steps -> tasks -> machines -> line
    await this.prisma.$transaction(async (tx) => {
      const machineIds = (
        await tx.machine.findMany({ where: { lineId }, select: { id: true } })
      ).map((m) => m.id);
      const taskIds = machineIds.length
        ? (
            await tx.task.findMany({
              where: { machineId: { in: machineIds } },
              select: { id: true },
            })
          ).map((t) => t.id)
        : [];
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
      if (machineIds.length) {
        await tx.machine.deleteMany({ where: { id: { in: machineIds } } });
      }

      await tx.line.delete({ where: { id: lineId } });
    });

    if (this.audit.shouldAudit(before.status)) {
      await this.audit.log({
        entityType: AuditEntityType.LINE,
        entityId: lineId,
        action: AuditAction.DELETE,
        actor,
        before,
        meta: { hardDelete: true },
      });
    }

    return { ok: true };
  }

  async getTree(lineId: string) {
    const line = await this.prisma.line.findUnique({
      where: { id: lineId },
      include: {
        machines: {
          orderBy: { createdAt: 'desc' },
          include: {
            tasks: {
              orderBy: { createdAt: 'desc' },
              include: {
                steps: {
                  orderBy: { stepNo: 'asc' },
                  include: {
                    assessments: {
                      orderBy: { createdAt: 'asc' },
                      include: {
                        hazard: { include: { category: true } },
                        controls: { orderBy: { createdAt: 'asc' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!line) throw new NotFoundException('Line not found');
    return line;
  }
}
