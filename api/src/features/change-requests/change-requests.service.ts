import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaProdService } from '../../prisma/prisma.prod.service';
import { ChangeScope } from './dto';

type ChangeRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'APPLIED';

@Injectable()
export class ChangeRequestsService {
  constructor(
    private readonly staging: PrismaService,
    private readonly prod: PrismaProdService,
  ) {}

  async list(status?: string) {
    const where = status ? { status: status as any } : {};
    return this.staging.changeRequest.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
    });
  }

  async get(id: string) {
    const cr = await this.staging.changeRequest.findUnique({ where: { id } });
    if (!cr) throw new NotFoundException('ChangeRequest not found');
    return cr;
  }

  async create(
    scope: ChangeScope,
    rootId: string,
    submittedBy: string,
    reason?: string,
  ) {
    const snapshot = await this.buildSnapshot(scope, rootId);
    return this.staging.changeRequest.create({
      data: {
        scope: scope as any,
        rootId,
        status: 'PENDING' as any,
        submittedBy,
        reason,
        snapshot,
      },
    });
  }

  async approve(id: string, reviewerEmail: string) {
    const cr = await this.get(id);
    if (cr.status !== ('PENDING' as ChangeRequestStatus))
      throw new BadRequestException('Only PENDING requests can be approved');
    if (cr.submittedBy === reviewerEmail)
      throw new ForbiddenException(
        'Peer approval required (reviewer must differ)',
      );

    // Apply snapshot into PROD
    await this.applySnapshotToProd(cr.scope as any, cr.rootId, cr.snapshot);

    // Update status
    const updated = await this.staging.changeRequest.update({
      where: { id },
      data: {
        status: 'APPLIED' as any,
        reviewedBy: reviewerEmail,
        reviewedAt: new Date(),
      },
    });

    // Audit in PROD
    await this.prod.auditLog.create({
      data: {
        entityType: 'LINE' as any, // meta is authoritative, entityType is for quick filtering
        entityId: cr.rootId,
        action: 'STATUS_CHANGE' as any,
        actor: reviewerEmail,
        meta: { changeRequestId: id, scope: cr.scope, status: 'APPLIED' },
      },
    });

    return updated;
  }

  async reject(id: string, reviewerEmail: string) {
    const cr = await this.get(id);
    if (cr.status !== ('PENDING' as ChangeRequestStatus))
      throw new BadRequestException('Only PENDING requests can be rejected');
    if (cr.submittedBy === reviewerEmail)
      throw new ForbiddenException(
        'Peer review required (reviewer must differ)',
      );

    return this.staging.changeRequest.update({
      where: { id },
      data: {
        status: 'REJECTED' as any,
        reviewedBy: reviewerEmail,
        reviewedAt: new Date(),
      },
    });
  }

  // -------- snapshot builders (STAGING) --------

  private async buildSnapshot(scope: ChangeScope, rootId: string) {
    switch (scope) {
      case 'LINE_TREE':
        return this.buildLineTree(rootId);
      case 'MACHINE_TREE':
        return this.buildMachineTree(rootId);
      case 'TASK_TREE':
        return this.buildTaskTree(rootId);
      case 'STEP_TREE':
        return this.buildStepTree(rootId);
      case 'ASSESSMENT':
        return this.buildAssessment(rootId);
      case 'HAZARD_LIBRARY':
        return this.buildHazardLibrary();
      case 'RISK_MATRIX':
        return this.buildRiskMatrices();
      default:
        throw new BadRequestException('Unsupported scope');
    }
  }

  private async buildLineTree(lineId: string) {
    const line = await this.staging.line.findUnique({
      where: { id: lineId },
      include: {
        machines: {
          include: {
            tasks: {
              include: {
                steps: {
                  include: {
                    assessments: {
                      include: { controls: true },
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
    return { line };
  }

  private async buildMachineTree(machineId: string) {
    const machine = await this.staging.machine.findUnique({
      where: { id: machineId },
      include: {
        tasks: {
          include: {
            steps: {
              include: {
                assessments: { include: { controls: true } },
              },
            },
          },
        },
        line: true,
      },
    });
    if (!machine) throw new NotFoundException('Machine not found');
    return { machine };
  }

  private async buildTaskTree(taskId: string) {
    const task = await this.staging.task.findUnique({
      where: { id: taskId },
      include: {
        steps: { include: { assessments: { include: { controls: true } } } },
        machine: { include: { line: true } },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    return { task };
  }

  private async buildStepTree(stepId: string) {
    const step = await this.staging.step.findUnique({
      where: { id: stepId },
      include: {
        assessments: { include: { controls: true } },
        task: { include: { machine: { include: { line: true } } } },
      },
    });
    if (!step) throw new NotFoundException('Step not found');
    return { step };
  }

  private async buildAssessment(assessmentId: string) {
    const assessment = await this.staging.stepHazardAssessment.findUnique({
      where: { id: assessmentId },
      include: { controls: true, step: true },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    return { assessment };
  }

  private async buildHazardLibrary() {
    const categories = await this.staging.hazardCategory.findMany({
      include: { hazards: true },
      orderBy: { sortOrder: 'asc' },
    });
    return { categories };
  }

  private async buildRiskMatrices() {
    const matrices = await this.staging.riskMatrix.findMany({
      include: { cells: true },
      orderBy: { createdAt: 'asc' },
    });
    return { matrices };
  }

  // -------- PROD appliers --------

  private async applySnapshotToProd(
    scope: ChangeScope,
    rootId: string,
    snapshot: any,
  ) {
    switch (scope) {
      case 'LINE_TREE':
        return this.applyLineTree(rootId, snapshot);
      case 'MACHINE_TREE':
        return this.applyMachineTree(rootId, snapshot);
      case 'TASK_TREE':
        return this.applyTaskTree(rootId, snapshot);
      case 'STEP_TREE':
        return this.applyStepTree(rootId, snapshot);
      case 'ASSESSMENT':
        return this.applyAssessment(rootId, snapshot);
      case 'HAZARD_LIBRARY':
        return this.applyHazardLibrary(snapshot);
      case 'RISK_MATRIX':
        return this.applyRiskMatrices(snapshot);
      default:
        throw new BadRequestException('Unsupported scope');
    }
  }

  private async applyLineTree(lineId: string, snapshot: any) {
    const line = snapshot?.line;
    if (!line) throw new BadRequestException('Invalid snapshot');

    return this.prod.$transaction(async (tx) => {
      // wipe subtree
      await tx.assessmentControl.deleteMany({
        where: { assessment: { step: { task: { machine: { lineId } } } } },
      });
      await tx.stepHazardAssessment.deleteMany({
        where: { step: { task: { machine: { lineId } } } },
      });
      await tx.step.deleteMany({ where: { task: { machine: { lineId } } } });
      await tx.task.deleteMany({ where: { machine: { lineId } } });
      await tx.machine.deleteMany({ where: { lineId } });

      // upsert line itself
      await tx.line.upsert({
        where: { id: line.id },
        create: {
          ...pick(line, [
            'id',
            'name',
            'status',
            'reviewedAt',
            'reviewedBy',
            'finalizedAt',
            'finalizedBy',
          ]),
        },
        update: {
          ...pick(line, [
            'name',
            'status',
            'reviewedAt',
            'reviewedBy',
            'finalizedAt',
            'finalizedBy',
          ]),
        },
      });

      // recreate children
      for (const m of line.machines ?? []) {
        await tx.machine.create({
          data: {
            ...pick(m, [
              'id',
              'name',
              'lineId',
              'status',
              'reviewedAt',
              'reviewedBy',
              'finalizedAt',
              'finalizedBy',
            ]),
          },
        });

        for (const t of m.tasks ?? []) {
          await tx.task.create({
            data: {
              ...pick(t, [
                'id',
                'name',
                'description',
                'machineId',
                'status',
                'reviewedAt',
                'reviewedBy',
                'finalizedAt',
                'finalizedBy',
              ]),
            },
          });

          for (const s of t.steps ?? []) {
            await tx.step.create({
              data: {
                ...pick(s, [
                  'id',
                  'taskId',
                  'stepNo',
                  'title',
                  'method',
                  'status',
                  'reviewedAt',
                  'reviewedBy',
                  'finalizedAt',
                  'finalizedBy',
                ]),
              },
            });

            for (const a of s.assessments ?? []) {
              await tx.stepHazardAssessment.create({
                data: {
                  ...pick(a, [
                    'id',
                    'stepId',
                    'hazardId',
                    'matrixId',
                    'unsafeConditions',
                    'unsafeActs',
                    'potentialHarm',
                    'existingSeverity',
                    'existingProbability',
                    'existingRating',
                    'existingBand',
                    'newSeverity',
                    'newProbability',
                    'newRating',
                    'newBand',
                    'notes',
                    'status',
                    'reviewedAt',
                    'reviewedBy',
                    'finalizedAt',
                    'finalizedBy',
                  ]),
                },
              });

              for (const c of a.controls ?? []) {
                await tx.assessmentControl.create({
                  data: {
                    ...pick(c, [
                      'id',
                      'assessmentId',
                      'phase',
                      'type',
                      'description',
                      'owner',
                      'dueDate',
                      'isVerified',
                      'verifiedAt',
                    ]),
                  },
                });
              }
            }
          }
        }
      }
    });
  }

  private async applyMachineTree(machineId: string, snapshot: any) {
    // easiest: treat as task subtree replacement inside machine
    const machine = snapshot?.machine;
    if (!machine) throw new BadRequestException('Invalid snapshot');

    return this.prod.$transaction(async (tx) => {
      await tx.assessmentControl.deleteMany({
        where: { assessment: { step: { task: { machineId } } } },
      });
      await tx.stepHazardAssessment.deleteMany({
        where: { step: { task: { machineId } } },
      });
      await tx.step.deleteMany({ where: { task: { machineId } } });
      await tx.task.deleteMany({ where: { machineId } });

      await tx.machine.upsert({
        where: { id: machine.id },
        create: {
          ...pick(machine, [
            'id',
            'name',
            'lineId',
            'status',
            'reviewedAt',
            'reviewedBy',
            'finalizedAt',
            'finalizedBy',
          ]),
        },
        update: {
          ...pick(machine, [
            'name',
            'lineId',
            'status',
            'reviewedAt',
            'reviewedBy',
            'finalizedAt',
            'finalizedBy',
          ]),
        },
      });

      for (const t of machine.tasks ?? []) {
        await tx.task.create({
          data: {
            ...pick(t, [
              'id',
              'name',
              'description',
              'machineId',
              'status',
              'reviewedAt',
              'reviewedBy',
              'finalizedAt',
              'finalizedBy',
            ]),
          },
        });
        for (const s of t.steps ?? []) {
          await tx.step.create({
            data: {
              ...pick(s, [
                'id',
                'taskId',
                'stepNo',
                'title',
                'method',
                'status',
                'reviewedAt',
                'reviewedBy',
                'finalizedAt',
                'finalizedBy',
              ]),
            },
          });
          for (const a of s.assessments ?? []) {
            await tx.stepHazardAssessment.create({
              data: {
                ...pick(a, [
                  'id',
                  'stepId',
                  'hazardId',
                  'matrixId',
                  'unsafeConditions',
                  'unsafeActs',
                  'potentialHarm',
                  'existingSeverity',
                  'existingProbability',
                  'existingRating',
                  'existingBand',
                  'newSeverity',
                  'newProbability',
                  'newRating',
                  'newBand',
                  'notes',
                  'status',
                  'reviewedAt',
                  'reviewedBy',
                  'finalizedAt',
                  'finalizedBy',
                ]),
              },
            });
            for (const c of a.controls ?? []) {
              await tx.assessmentControl.create({
                data: {
                  ...pick(c, [
                    'id',
                    'assessmentId',
                    'phase',
                    'type',
                    'description',
                    'owner',
                    'dueDate',
                    'isVerified',
                    'verifiedAt',
                  ]),
                },
              });
            }
          }
        }
      }
    });
  }

  private async applyTaskTree(taskId: string, snapshot: any) {
    const task = snapshot?.task;
    if (!task) throw new BadRequestException('Invalid snapshot');

    return this.prod.$transaction(async (tx) => {
      await tx.assessmentControl.deleteMany({
        where: { assessment: { step: { taskId } } },
      });
      await tx.stepHazardAssessment.deleteMany({ where: { step: { taskId } } });
      await tx.step.deleteMany({ where: { taskId } });

      await tx.task.upsert({
        where: { id: task.id },
        create: {
          ...pick(task, [
            'id',
            'name',
            'description',
            'machineId',
            'status',
            'reviewedAt',
            'reviewedBy',
            'finalizedAt',
            'finalizedBy',
          ]),
        },
        update: {
          ...pick(task, [
            'name',
            'description',
            'machineId',
            'status',
            'reviewedAt',
            'reviewedBy',
            'finalizedAt',
            'finalizedBy',
          ]),
        },
      });

      for (const s of task.steps ?? []) {
        await tx.step.create({
          data: {
            ...pick(s, [
              'id',
              'taskId',
              'stepNo',
              'title',
              'method',
              'status',
              'reviewedAt',
              'reviewedBy',
              'finalizedAt',
              'finalizedBy',
            ]),
          },
        });
        for (const a of s.assessments ?? []) {
          await tx.stepHazardAssessment.create({
            data: {
              ...pick(a, [
                'id',
                'stepId',
                'hazardId',
                'matrixId',
                'unsafeConditions',
                'unsafeActs',
                'potentialHarm',
                'existingSeverity',
                'existingProbability',
                'existingRating',
                'existingBand',
                'newSeverity',
                'newProbability',
                'newRating',
                'newBand',
                'notes',
                'status',
                'reviewedAt',
                'reviewedBy',
                'finalizedAt',
                'finalizedBy',
              ]),
            },
          });
          for (const c of a.controls ?? []) {
            await tx.assessmentControl.create({
              data: {
                ...pick(c, [
                  'id',
                  'assessmentId',
                  'phase',
                  'type',
                  'description',
                  'owner',
                  'dueDate',
                  'isVerified',
                  'verifiedAt',
                ]),
              },
            });
          }
        }
      }
    });
  }

  private async applyStepTree(stepId: string, snapshot: any) {
    const step = snapshot?.step;
    if (!step) throw new BadRequestException('Invalid snapshot');

    return this.prod.$transaction(async (tx) => {
      await tx.assessmentControl.deleteMany({
        where: { assessment: { stepId } },
      });
      await tx.stepHazardAssessment.deleteMany({ where: { stepId } });

      await tx.step.upsert({
        where: { id: step.id },
        create: {
          ...pick(step, [
            'id',
            'taskId',
            'stepNo',
            'title',
            'method',
            'status',
            'reviewedAt',
            'reviewedBy',
            'finalizedAt',
            'finalizedBy',
          ]),
        },
        update: {
          ...pick(step, [
            'taskId',
            'stepNo',
            'title',
            'method',
            'status',
            'reviewedAt',
            'reviewedBy',
            'finalizedAt',
            'finalizedBy',
          ]),
        },
      });

      for (const a of step.assessments ?? []) {
        await tx.stepHazardAssessment.create({
          data: {
            ...pick(a, [
              'id',
              'stepId',
              'hazardId',
              'matrixId',
              'unsafeConditions',
              'unsafeActs',
              'potentialHarm',
              'existingSeverity',
              'existingProbability',
              'existingRating',
              'existingBand',
              'newSeverity',
              'newProbability',
              'newRating',
              'newBand',
              'notes',
              'status',
              'reviewedAt',
              'reviewedBy',
              'finalizedAt',
              'finalizedBy',
            ]),
          },
        });
        for (const c of a.controls ?? []) {
          await tx.assessmentControl.create({
            data: {
              ...pick(c, [
                'id',
                'assessmentId',
                'phase',
                'type',
                'description',
                'owner',
                'dueDate',
                'isVerified',
                'verifiedAt',
              ]),
            },
          });
        }
      }
    });
  }

  private async applyAssessment(assessmentId: string, snapshot: any) {
    const assessment = snapshot?.assessment;
    if (!assessment) throw new BadRequestException('Invalid snapshot');

    return this.prod.$transaction(async (tx) => {
      await tx.assessmentControl.deleteMany({ where: { assessmentId } });
      await tx.stepHazardAssessment.deleteMany({ where: { id: assessmentId } });

      await tx.stepHazardAssessment.create({
        data: {
          ...pick(assessment, [
            'id',
            'stepId',
            'hazardId',
            'matrixId',
            'unsafeConditions',
            'unsafeActs',
            'potentialHarm',
            'existingSeverity',
            'existingProbability',
            'existingRating',
            'existingBand',
            'newSeverity',
            'newProbability',
            'newRating',
            'newBand',
            'notes',
            'status',
            'reviewedAt',
            'reviewedBy',
            'finalizedAt',
            'finalizedBy',
          ]),
        },
      });

      for (const c of assessment.controls ?? []) {
        await tx.assessmentControl.create({
          data: {
            ...pick(c, [
              'id',
              'assessmentId',
              'phase',
              'type',
              'description',
              'owner',
              'dueDate',
              'isVerified',
              'verifiedAt',
            ]),
          },
        });
      }
    });
  }

  private async applyHazardLibrary(snapshot: any) {
    const categories = snapshot?.categories;
    if (!Array.isArray(categories))
      throw new BadRequestException('Invalid snapshot');

    return this.prod.$transaction(async (tx) => {
      // wipe and replace (simple + deterministic)
      await tx.hazard.deleteMany({});
      await tx.hazardCategory.deleteMany({});

      for (const cat of categories) {
        await tx.hazardCategory.create({
          data: { ...pick(cat, ['id', 'name', 'sortOrder']) },
        });
        for (const hz of cat.hazards ?? []) {
          await tx.hazard.create({
            data: {
              ...pick(hz, [
                'id',
                'categoryId',
                'code',
                'name',
                'description',
                'active',
                'sortOrder',
              ]),
            },
          });
        }
      }
    });
  }

  private async applyRiskMatrices(snapshot: any) {
    const matrices = snapshot?.matrices;
    if (!Array.isArray(matrices))
      throw new BadRequestException('Invalid snapshot');

    return this.prod.$transaction(async (tx) => {
      await tx.riskMatrixCell.deleteMany({});
      await tx.riskMatrix.deleteMany({});

      for (const m of matrices) {
        await tx.riskMatrix.create({
          data: { ...pick(m, ['id', 'name', 'isActive']) },
        });
        for (const cell of m.cells ?? []) {
          await tx.riskMatrixCell.create({
            data: {
              ...pick(cell, [
                'id',
                'matrixId',
                'severity',
                'probability',
                'rating',
                'band',
              ]),
            },
          });
        }
      }
    });
  }
}

function pick<T extends Record<string, any>>(obj: T, keys: (keyof T)[]) {
  const out: any = {};
  for (const k of keys) out[k] = obj[k];
  return out;
}
