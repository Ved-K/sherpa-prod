import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, AuditEntityType, ReviewStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class CloneService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private statusReset(reset: boolean) {
    if (!reset) return {};
    return {
      status: ReviewStatus.DRAFT,
      reviewedAt: null,
      reviewedBy: null,
      finalizedAt: null,
      finalizedBy: null,
    };
  }

  private async cloneTaskIntoMachineTx(
    tx: any,
    sourceTaskId: string,
    targetMachineId: string,
    name?: string,
    resetStatus = true,
  ) {
    const source = await tx.task.findUnique({
      where: { id: sourceTaskId },
      include: {
        steps: {
          orderBy: { stepNo: 'asc' },
          include: {
            assessments: { include: { controls: true } },
          },
        },
      },
    });
    if (!source) throw new NotFoundException('Task not found');

    const machine = await tx.machine.findUnique({
      where: { id: targetMachineId },
    });
    if (!machine) throw new NotFoundException('Target machine not found');

    const reset = this.statusReset(resetStatus);

    const newTask = await tx.task.create({
      data: {
        machineId: targetMachineId,
        name: name ?? `${source.name} (copy)`,
        description: source.description ?? undefined,
        ...(reset as any),
      },
    });

    for (const s of source.steps) {
      const newStep = await tx.step.create({
        data: {
          taskId: newTask.id,
          stepNo: s.stepNo,
          title: s.title,
          method: s.method ?? undefined,
          ...(reset as any),
        },
      });

      for (const a of s.assessments ?? []) {
        const newAssessment = await tx.stepHazardAssessment.create({
          data: {
            stepId: newStep.id,
            hazardId: a.hazardId,
            matrixId: a.matrixId,

            unsafeConditions: a.unsafeConditions,
            unsafeActs: a.unsafeActs,
            potentialHarm: a.potentialHarm,

            existingSeverity: a.existingSeverity,
            existingProbability: a.existingProbability,
            existingRating: a.existingRating,
            existingBand: a.existingBand,

            newSeverity: a.newSeverity,
            newProbability: a.newProbability,
            newRating: a.newRating,
            newBand: a.newBand,

            notes: a.notes,
            ...(reset as any),
          },
        });

        for (const c of a.controls ?? []) {
          await tx.assessmentControl.create({
            data: {
              assessmentId: newAssessment.id,
              phase: c.phase,
              type: c.type,
              description: c.description,
              owner: c.owner,
              dueDate: c.dueDate,
            },
          });
        }
      }
    }

    return newTask;
  }

  async cloneTask(
    taskId: string,
    targetMachineId: string,
    name: string | undefined,
    resetStatus: boolean,
    actor: string,
  ) {
    const created = await this.prisma.$transaction(async (tx) => {
      return this.cloneTaskIntoMachineTx(
        tx,
        taskId,
        targetMachineId,
        name,
        resetStatus,
      );
    });

    await this.audit.log({
      entityType: AuditEntityType.TASK,
      entityId: created.id,
      action: AuditAction.CLONE,
      actor,
      meta: { fromTaskId: taskId, targetMachineId, resetStatus },
    });

    return created;
  }

  async cloneMachine(
    machineId: string,
    targetLineId: string,
    name: string | undefined,
    resetStatus: boolean,
    actor: string,
  ) {
    const created = await this.prisma.$transaction(async (tx) => {
      const source = await tx.machine.findUnique({
        where: { id: machineId },
        include: { tasks: { select: { id: true } } },
      });
      if (!source) throw new NotFoundException('Machine not found');

      const line = await tx.line.findUnique({ where: { id: targetLineId } });
      if (!line) throw new NotFoundException('Target line not found');

      const reset = this.statusReset(resetStatus);

      const newMachine = await tx.machine.create({
        data: {
          lineId: targetLineId,
          name: name ?? `${source.name} (copy)`,
          ...(reset as any),
        },
      });

      for (const t of source.tasks) {
        await this.cloneTaskIntoMachineTx(
          tx,
          t.id,
          newMachine.id,
          undefined,
          resetStatus,
        );
      }

      return newMachine;
    });

    await this.audit.log({
      entityType: AuditEntityType.MACHINE,
      entityId: created.id,
      action: AuditAction.CLONE,
      actor,
      meta: { fromMachineId: machineId, targetLineId, resetStatus },
    });

    return created;
  }

  async cloneLine(
    lineId: string,
    name: string | undefined,
    resetStatus: boolean,
    actor: string,
  ) {
    const created = await this.prisma.$transaction(async (tx) => {
      const source = await tx.line.findUnique({
        where: { id: lineId },
        include: { machines: { select: { id: true } } },
      });
      if (!source) throw new NotFoundException('Line not found');

      const reset = this.statusReset(resetStatus);

      const newLine = await tx.line.create({
        data: {
          name: name ?? `${source.name} (copy)`,
          ...(reset as any),
        },
      });

      for (const m of source.machines) {
        // clone machine into newLine
        const newMachine = await tx.machine.create({
          data: { lineId: newLine.id, name: 'tmp', ...(reset as any) },
        });
        // overwrite tmp name after we fetch source machine name
        const srcM = await tx.machine.findUnique({ where: { id: m.id } });
        await tx.machine.update({
          where: { id: newMachine.id },
          data: { name: `${srcM?.name ?? 'Machine'} (copy)` },
        });

        const tasks = await tx.task.findMany({
          where: { machineId: m.id },
          select: { id: true },
        });
        for (const t of tasks) {
          await this.cloneTaskIntoMachineTx(
            tx,
            t.id,
            newMachine.id,
            undefined,
            resetStatus,
          );
        }
      }

      return newLine;
    });

    await this.audit.log({
      entityType: AuditEntityType.LINE,
      entityId: created.id,
      action: AuditAction.CLONE,
      actor,
      meta: { fromLineId: lineId, resetStatus },
    });

    return created;
  }
}
