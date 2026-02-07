import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ControlStatus } from '@prisma/client';

type RiskBandStr =
  | 'VERY_LOW'
  | 'LOW'
  | 'MEDIUM'
  | 'MEDIUM_PLUS'
  | 'HIGH'
  | 'VERY_HIGH';

type DotColor = 'gray' | 'green' | 'yellow' | 'orange' | 'red';

const BAND_RANK: Record<RiskBandStr, number> = {
  VERY_LOW: 1,
  LOW: 2,
  MEDIUM: 3,
  MEDIUM_PLUS: 4,
  HIGH: 5,
  VERY_HIGH: 6,
};

function rankOf(band: RiskBandStr | null | undefined): number {
  return band ? (BAND_RANK[band] ?? 0) : 0;
}
function bandOf(rank: number): RiskBandStr | null {
  if (rank <= 0) return null;
  const found = Object.entries(BAND_RANK).find(([, r]) => r === rank);
  return found ? (found[0] as RiskBandStr) : null;
}
function dotOf(curRank: number, predRank: number): DotColor {
  if (curRank <= 0) return 'gray';
  if (curRank <= 1) return 'green';
  if (curRank <= 4) return 'yellow';
  if (predRank > 0 && predRank <= 3) return 'orange';
  return 'red';
}

type RiskCounts = {
  total: number;
  unassessed: number;
  veryLow: number;
  low: number;
  medium: number;
  mediumPlus: number;
  high: number;
  veryHigh: number;
};

type DotCounts = {
  gray: number;
  green: number;
  yellow: number;
  orange: number;
  red: number;
};
type CategoryCounts = Record<string, number>;

function emptyRisk(): RiskCounts {
  return {
    total: 0,
    unassessed: 0,
    veryLow: 0,
    low: 0,
    medium: 0,
    mediumPlus: 0,
    high: 0,
    veryHigh: 0,
  };
}
function emptyDots(): DotCounts {
  return { gray: 0, green: 0, yellow: 0, orange: 0, red: 0 };
}
function bump(r: RiskCounts, d: DotCounts, curRank: number, dot: DotColor) {
  r.total += 1;
  d[dot] += 1;

  switch (curRank) {
    case 0:
      r.unassessed++;
      break;
    case 1:
      r.veryLow++;
      break;
    case 2:
      r.low++;
      break;
    case 3:
      r.medium++;
      break;
    case 4:
      r.mediumPlus++;
      break;
    case 5:
      r.high++;
      break;
    case 6:
      r.veryHigh++;
      break;
  }
}

/**
 * We treat "VERIFIED" as "IMPLEMENTED" for now (no DB schema change).
 * If you later introduce ControlStatus.IMPLEMENTED, this already supports it.
 */
const STATUS_IMPLEMENTED = ((ControlStatus as any).IMPLEMENTED ??
  (ControlStatus as any).VERIFIED) as ControlStatus;

const STATUS_OPEN = ((ControlStatus as any).OPEN ??
  (ControlStatus as any).DRAFT ??
  (ControlStatus as any).PENDING) as ControlStatus;

function computeIsImplemented(x: {
  status: ControlStatus;
  verifiedAt: Date | null;
}) {
  return x.status === STATUS_IMPLEMENTED || !!x.verifiedAt;
}

@Injectable()
export class RiskManagementDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureLine(lineId: string) {
    const x = await this.prisma.line.findUnique({ where: { id: lineId } });
    if (!x) throw new NotFoundException('Line not found');
  }
  private async ensureMachine(machineId: string) {
    const x = await this.prisma.machine.findUnique({
      where: { id: machineId },
    });
    if (!x) throw new NotFoundException('Machine not found');
  }
  private async ensureTask(taskId: string) {
    const x = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!x) throw new NotFoundException('Task not found');
  }

  private async getActionCategoriesMeta() {
    return this.prisma.actionCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, color: true, sortOrder: true },
    });
  }

  async meta() {
    const [actionCategories, taskCategories, taskPhases] = await Promise.all([
      this.getActionCategoriesMeta(),
      this.prisma.taskCategory.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, sortOrder: true },
      }),
      this.prisma.taskPhase.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, sortOrder: true },
      }),
    ]);
    return { actionCategories, taskCategories, taskPhases };
  }

  /**
   * ✅ NEW: checkbox toggle support
   * Marks an ADDITIONAL control as implemented/unimplemented.
   * Under the hood uses status + verifiedAt.
   */
  async setControlImplemented(
    controlId: string,
    implemented: boolean,
    actor?: string,
  ) {
    const existing = await this.prisma.assessmentControl.findUnique({
      where: { id: controlId },
      select: { id: true, phase: true },
    });
    if (!existing) throw new NotFoundException('Control not found');

    if (existing.phase !== 'ADDITIONAL') {
      throw new BadRequestException(
        'Only ADDITIONAL controls can be marked implemented.',
      );
    }

    const now = new Date();

    const updated = await this.prisma.assessmentControl.update({
      where: { id: controlId },
      data: implemented
        ? {
            status: STATUS_IMPLEMENTED,
            verifiedAt: now, // used as "implementedAt" in API
            // if you later add a field (implementedBy/verifiedBy), set it here using `actor`
          }
        : {
            status: STATUS_OPEN,
            verifiedAt: null,
          },
      select: {
        id: true,
        status: true,
        verifiedAt: true,
        dueDate: true,
        description: true,
        owner: true,
        assessmentId: true,
      },
    });

    return {
      ...updated,
      isImplemented: computeIsImplemented({
        status: updated.status,
        verifiedAt: updated.verifiedAt,
      }),
      implementedAt: updated.verifiedAt,
      // backwards compat:
      isVerified: computeIsImplemented({
        status: updated.status,
        verifiedAt: updated.verifiedAt,
      }),
      verifiedAt: updated.verifiedAt,
    };
  }

  // stepId -> Set(actionCategoryIds) for ADDITIONAL controls
  private async additionalCategoryMap(stepIds: string[]) {
    const map = new Map<string, Set<string>>();
    if (stepIds.length === 0) return map;

    const rows = await this.prisma.assessmentControl.findMany({
      where: {
        phase: 'ADDITIONAL',
        categoryId: { not: null },
        assessment: { stepId: { in: stepIds } },
      },
      select: { categoryId: true, assessment: { select: { stepId: true } } },
    });

    for (const r of rows) {
      const sid = r.assessment.stepId;
      if (!map.has(sid)) map.set(sid, new Set());
      map.get(sid)!.add(r.categoryId!);
    }
    return map;
  }

  private bumpCategoryCounts(dst: CategoryCounts, cats?: Set<string>) {
    if (!cats) return;
    for (const id of cats) dst[id] = (dst[id] ?? 0) + 1;
  }

  /**
   * ✅ UPDATED: fast counts (no fetching thousands of rows)
   * Returns BOTH implemented + verified for compatibility.
   */
  private async additionalControlsProgress(where: any) {
    const now = new Date();
    const baseWhere = { phase: 'ADDITIONAL', ...where };

    const doneOr = [
      { status: STATUS_IMPLEMENTED },
      { verifiedAt: { not: null } },
    ];

    const [total, implemented, overdue] = await Promise.all([
      this.prisma.assessmentControl.count({ where: baseWhere }),
      this.prisma.assessmentControl.count({
        where: { ...baseWhere, OR: doneOr },
      }),
      this.prisma.assessmentControl.count({
        where: {
          ...baseWhere,
          dueDate: { lt: now },
          NOT: { OR: doneOr },
        },
      }),
    ]);

    const open = total - implemented;

    return {
      total,
      implemented,
      overdue,
      open,

      // backwards compat fields (your existing UI uses these names)
      verified: implemented,
    };
  }

  async lines() {
    const lines = await this.prisma.line.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, updatedAt: true },
    });

    const steps = await this.prisma.step.findMany({
      select: {
        id: true,
        task: { select: { machine: { select: { lineId: true } } } },
        assessments: { select: { existingBand: true, newBand: true } },
      },
    });

    const stepIds = steps.map((s) => s.id);
    const catsByStep = await this.additionalCategoryMap(stepIds);

    const byLineRisk: Record<string, RiskCounts> = {};
    const byLineDots: Record<string, DotCounts> = {};
    const byLineCats: Record<string, CategoryCounts> = {};
    for (const l of lines) {
      byLineRisk[l.id] = emptyRisk();
      byLineDots[l.id] = emptyDots();
      byLineCats[l.id] = {};
    }

    for (const s of steps) {
      const lineId = s.task.machine.lineId;
      const risk = byLineRisk[lineId];
      const dots = byLineDots[lineId];
      const catCounts = byLineCats[lineId];
      if (!risk || !dots || !catCounts) continue;

      const curRank = Math.max(
        ...s.assessments.map((a) => rankOf(a.existingBand as any)),
        0,
      );
      const predRank = Math.max(
        ...s.assessments.map((a) => rankOf(a.newBand as any)),
        0,
      );
      const dot = dotOf(curRank, predRank);

      bump(risk, dots, curRank, dot);
      if (curRank >= 5)
        this.bumpCategoryCounts(catCounts, catsByStep.get(s.id));
    }

    // ✅ parallelise progress queries (faster)
    const progressByLine = await Promise.all(
      lines.map((l) =>
        this.additionalControlsProgress({
          assessment: { step: { task: { machine: { lineId: l.id } } } },
        }),
      ),
    );

    return lines.map((l, i) => ({
      id: l.id,
      name: l.name,
      updatedAt: l.updatedAt,
      risk: byLineRisk[l.id],
      dots: byLineDots[l.id],
      highRiskRecommendedCategoryCounts: byLineCats[l.id],
      additionalControls: progressByLine[i],
    }));
  }

  async machines(lineId: string) {
    await this.ensureLine(lineId);

    const machines = await this.prisma.machine.findMany({
      where: { lineId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, updatedAt: true },
    });

    const steps = await this.prisma.step.findMany({
      where: { task: { machine: { lineId } } },
      select: {
        id: true,
        task: { select: { machineId: true } },
        assessments: { select: { existingBand: true, newBand: true } },
      },
    });

    const stepIds = steps.map((s) => s.id);
    const catsByStep = await this.additionalCategoryMap(stepIds);

    const byRisk: Record<string, RiskCounts> = {};
    const byDots: Record<string, DotCounts> = {};
    const byCats: Record<string, CategoryCounts> = {};
    for (const m of machines) {
      byRisk[m.id] = emptyRisk();
      byDots[m.id] = emptyDots();
      byCats[m.id] = {};
    }

    for (const s of steps) {
      const mid = s.task.machineId;
      const risk = byRisk[mid];
      const dots = byDots[mid];
      const catCounts = byCats[mid];
      if (!risk || !dots || !catCounts) continue;

      const curRank = Math.max(
        ...s.assessments.map((a) => rankOf(a.existingBand as any)),
        0,
      );
      const predRank = Math.max(
        ...s.assessments.map((a) => rankOf(a.newBand as any)),
        0,
      );
      const dot = dotOf(curRank, predRank);

      bump(risk, dots, curRank, dot);
      if (curRank >= 5)
        this.bumpCategoryCounts(catCounts, catsByStep.get(s.id));
    }

    const progressByMachine = await Promise.all(
      machines.map((m) =>
        this.additionalControlsProgress({
          assessment: { step: { task: { machineId: m.id } } },
        }),
      ),
    );

    return machines.map((m, i) => ({
      id: m.id,
      name: m.name,
      updatedAt: m.updatedAt,
      risk: byRisk[m.id],
      dots: byDots[m.id],
      highRiskRecommendedCategoryCounts: byCats[m.id],
      additionalControls: progressByMachine[i],
    }));
  }

  async tasks(
    machineId: string,
    filters?: { taskCategoryId?: string; taskPhaseId?: string },
  ) {
    await this.ensureMachine(machineId);

    const tasks = await this.prisma.task.findMany({
      where: {
        machineId,
        ...(filters?.taskCategoryId
          ? { categoryId: filters.taskCategoryId }
          : {}),
        ...(filters?.taskPhaseId ? { phaseId: filters.taskPhaseId } : {}),
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        updatedAt: true,
        categoryId: true,
        phaseId: true,
      },
    });

    const steps = await this.prisma.step.findMany({
      where: { task: { machineId } },
      select: {
        id: true,
        taskId: true,
        assessments: { select: { existingBand: true, newBand: true } },
      },
    });

    const stepIds = steps.map((s) => s.id);
    const catsByStep = await this.additionalCategoryMap(stepIds);

    const byRisk: Record<string, RiskCounts> = {};
    const byDots: Record<string, DotCounts> = {};
    const byCats: Record<string, CategoryCounts> = {};
    for (const t of tasks) {
      byRisk[t.id] = emptyRisk();
      byDots[t.id] = emptyDots();
      byCats[t.id] = {};
    }

    for (const s of steps) {
      const risk = byRisk[s.taskId];
      const dots = byDots[s.taskId];
      const catCounts = byCats[s.taskId];
      if (!risk || !dots || !catCounts) continue;

      const curRank = Math.max(
        ...s.assessments.map((a) => rankOf(a.existingBand as any)),
        0,
      );
      const predRank = Math.max(
        ...s.assessments.map((a) => rankOf(a.newBand as any)),
        0,
      );
      const dot = dotOf(curRank, predRank);

      bump(risk, dots, curRank, dot);
      if (curRank >= 5)
        this.bumpCategoryCounts(catCounts, catsByStep.get(s.id));
    }

    const progressByTask = await Promise.all(
      tasks.map((t) =>
        this.additionalControlsProgress({
          assessment: { step: { taskId: t.id } },
        }),
      ),
    );

    return tasks.map((t, i) => ({
      id: t.id,
      name: t.name,
      updatedAt: t.updatedAt,
      categoryId: t.categoryId,
      phaseId: t.phaseId,
      risk: byRisk[t.id],
      dots: byDots[t.id],
      highRiskRecommendedCategoryCounts: byCats[t.id],
      additionalControls: progressByTask[i],
    }));
  }

  async steps(
    taskId: string,
    filters: { dot?: DotColor; actionCategoryId?: string },
  ) {
    await this.ensureTask(taskId);
    const actionCategories = await this.getActionCategoriesMeta();

    const steps = await this.prisma.step.findMany({
      where: { taskId },
      orderBy: { stepNo: 'asc' },
      select: {
        id: true,
        stepNo: true,
        title: true,
        method: true,
        status: true,
        updatedAt: true,
        assessments: { select: { existingBand: true, newBand: true } },
      },
    });

    const stepIds = steps.map((s) => s.id);
    const catsByStep = await this.additionalCategoryMap(stepIds);

    const out = [];
    for (const s of steps) {
      const curRank = Math.max(
        ...s.assessments.map((a) => rankOf(a.existingBand as any)),
        0,
      );
      const predRank = Math.max(
        ...s.assessments.map((a) => rankOf(a.newBand as any)),
        0,
      );
      const dot = dotOf(curRank, predRank);
      const catIds = Array.from(catsByStep.get(s.id) ?? []);

      if (filters.dot && dot !== filters.dot) continue;
      if (
        filters.actionCategoryId &&
        !catIds.includes(filters.actionCategoryId)
      )
        continue;

      out.push({
        id: s.id,
        stepNo: s.stepNo,
        title: s.title,
        method: s.method,
        status: s.status,
        updatedAt: s.updatedAt,
        currentBand: bandOf(curRank),
        predictedBand: bandOf(predRank),
        dot,
        recommendedActionCategoryIds: catIds,
      });
    }

    return { actionCategories, steps: out };
  }

  async recommendations(scope: {
    lineId?: string;
    machineId?: string;
    taskId?: string;
    limit?: number;
  }) {
    const actionCategories = await this.getActionCategoriesMeta();
    const limit = Math.min(Math.max(scope.limit ?? 200, 1), 500);
    const now = new Date();

    const where: any = { phase: 'ADDITIONAL', categoryId: { not: null } };

    if (scope.taskId) {
      where.assessment = { step: { taskId: scope.taskId } };
    } else if (scope.machineId) {
      where.assessment = { step: { task: { machineId: scope.machineId } } };
    } else if (scope.lineId) {
      where.assessment = {
        step: { task: { machine: { lineId: scope.lineId } } },
      };
    }

    const rows = await this.prisma.assessmentControl.findMany({
      where,
      take: limit,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      include: {
        category: { select: { id: true, name: true, color: true } },
        assessment: {
          select: {
            id: true,
            step: {
              select: {
                id: true,
                stepNo: true,
                title: true,
                task: {
                  select: {
                    id: true,
                    name: true,
                    machine: {
                      select: {
                        id: true,
                        name: true,
                        line: { select: { id: true, name: true } },
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

    const groups = new Map<string, any>();

    for (const r of rows) {
      const cat = r.category;
      if (!cat) continue;

      const catId = cat.id;
      if (!groups.has(catId)) {
        groups.set(catId, {
          categoryId: catId,
          categoryName: cat.name,
          color: cat.color ?? null,
          total: 0,
          implemented: 0,
          overdue: 0,
          open: 0,
          controls: [],
          // backwards compat
          verified: 0,
        });
      }

      const g = groups.get(catId);

      const implemented = computeIsImplemented({
        status: r.status,
        verifiedAt: r.verifiedAt,
      });

      g.total += 1;
      if (implemented) {
        g.implemented += 1;
        g.verified += 1; // backwards compat
      }
      if (!implemented && r.dueDate && r.dueDate < now) g.overdue += 1;

      const step = r.assessment?.step;
      const task = step?.task;
      const machine = task?.machine;
      const line = machine?.line;

      g.controls.push({
        id: r.id,
        description: r.description,
        owner: r.owner,
        dueDate: r.dueDate,
        status: r.status,

        // new naming (frontend should use these)
        isImplemented: implemented,
        implementedAt: r.verifiedAt,

        // backwards compat
        isVerified: implemented,
        verifiedAt: r.verifiedAt,

        assessmentId: r.assessmentId,
        createdAt: r.createdAt,

        step: step
          ? { id: step.id, stepNo: step.stepNo, title: step.title }
          : null,
        task: task ? { id: task.id, name: task.name } : null,
        machine: machine ? { id: machine.id, name: machine.name } : null,
        line: line ? { id: line.id, name: line.name } : null,
      });
    }

    const out = Array.from(groups.values()).map((g) => ({
      ...g,
      open: g.total - g.implemented,
    }));

    // order by ActionCategory sortOrder
    const idx = new Map(actionCategories.map((c, i) => [c.id, i]));
    out.sort(
      (a, b) =>
        (idx.get(a.categoryId) ?? 9999) - (idx.get(b.categoryId) ?? 9999),
    );

    return { actionCategories, groups: out };
  }
}
