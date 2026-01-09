import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CategoryCounts, DotColor, RiskBandStr, RiskCounts } from './types';

// 1–6 numeric rank for RiskBands (consistent with Unilever matrix)
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
  const entries = Object.entries(BAND_RANK);
  const found = entries.find(([_, r]) => r === rank);
  return found ? (found[0] as RiskBandStr) : null;
}

/**
 * Dot color logic (final visual band):
 * - Very Low → green
 * - Low / Medium / Medium+ → yellow
 * - High / Very High → red
 * - If high/very high reduced to ≤ medium → orange
 */
function dotOf(curRank: number, predRank: number): DotColor {
  if (curRank <= 0) return 'gray';

  // direct color logic by severity
  if (curRank <= 1) return 'green'; // VERY_LOW
  if (curRank <= 4) return 'yellow'; // LOW → MEDIUM_PLUS

  // HIGH / VERY_HIGH → check if predicted drops significantly
  if (predRank > 0 && predRank <= 3) return 'orange';
  return 'red';
}

function emptyCounts(): RiskCounts {
  return {
    total: 0,
    unassessed: 0,
    veryLow: 0,
    low: 0,
    medium: 0,
    mediumPlus: 0,
    high: 0,
    veryHigh: 0,
    green: 0,
    yellow: 0,
    red: 0,
    orange: 0,
  };
}

function bumpRiskCounts(counts: RiskCounts, curRank: number, dot: DotColor) {
  counts.total += 1;

  switch (curRank) {
    case 0:
      counts.unassessed++;
      break;
    case 1:
      counts.veryLow++;
      break;
    case 2:
      counts.low++;
      break;
    case 3:
      counts.medium++;
      break;
    case 4:
      counts.mediumPlus++;
      break;
    case 5:
      counts.high++;
      break;
    case 6:
      counts.veryHigh++;
      break;
  }

  counts[dot] = (counts[dot] ?? 0) + 1;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureLine(lineId: string) {
    const line = await this.prisma.line.findUnique({ where: { id: lineId } });
    if (!line) throw new NotFoundException('Line not found');
    return line;
  }

  private async ensureMachine(machineId: string) {
    const machine = await this.prisma.machine.findUnique({
      where: { id: machineId },
    });
    if (!machine) throw new NotFoundException('Machine not found');
    return machine;
  }

  private async ensureTask(taskId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  // Fetch all active action categories (for grouping)
  private async getAllCategoriesMeta() {
    return this.prisma.actionCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, color: true, sortOrder: true },
    });
  }

  // Map stepId -> Set(categoryIds)
  private async getAdditionalCategoryMapForStepIds(stepIds: string[]) {
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

  private bumpCategoryCounts(
    catCounts: CategoryCounts,
    stepCats?: Set<string>,
  ) {
    if (!stepCats) return;
    for (const id of stepCats) {
      catCounts[id] = (catCounts[id] ?? 0) + 1;
    }
  }

  // ----- LEVEL 1: Lines -----
  async getLinesDashboard() {
    const categoriesMeta = await this.getAllCategoriesMeta();
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
    const stepCats = await this.getAdditionalCategoryMapForStepIds(stepIds);

    const byLineRisk: Record<string, RiskCounts> = {};
    const byLineCats: Record<string, CategoryCounts> = {};
    for (const l of lines) {
      byLineRisk[l.id] = emptyCounts();
      byLineCats[l.id] = {};
    }

    for (const s of steps) {
      const lineId = s.task.machine.lineId;
      const risk = byLineRisk[lineId];
      const cats = byLineCats[lineId];
      if (!risk || !cats) continue;

      const curRank = Math.max(
        ...s.assessments.map((a) => rankOf(a.existingBand as any)),
        0,
      );
      const predRank = Math.max(
        ...s.assessments.map((a) => rankOf(a.newBand as any)),
        0,
      );
      const dot = dotOf(curRank, predRank);

      bumpRiskCounts(risk, curRank, dot);
      if (curRank >= 5) this.bumpCategoryCounts(cats, stepCats.get(s.id));
    }

    return lines.map((l) => ({
      id: l.id,
      name: l.name,
      updatedAt: l.updatedAt,
      counts: byLineRisk[l.id],
      actionCategories: categoriesMeta,
      highRiskRecommendedCategoryCounts: byLineCats[l.id],
    }));
  }

  // ----- LEVEL 2: Machines -----
  async getMachinesDashboard(lineId: string) {
    await this.ensureLine(lineId);
    const categoriesMeta = await this.getAllCategoriesMeta();

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
    const stepCats = await this.getAdditionalCategoryMapForStepIds(stepIds);

    const byMachineRisk: Record<string, RiskCounts> = {};
    const byMachineCats: Record<string, CategoryCounts> = {};
    for (const m of machines) {
      byMachineRisk[m.id] = emptyCounts();
      byMachineCats[m.id] = {};
    }

    for (const s of steps) {
      const mid = s.task.machineId;
      const risk = byMachineRisk[mid];
      const cats = byMachineCats[mid];
      if (!risk) continue;

      const curRank = Math.max(
        ...s.assessments.map((a) => rankOf(a.existingBand as any)),
        0,
      );
      const predRank = Math.max(
        ...s.assessments.map((a) => rankOf(a.newBand as any)),
        0,
      );
      const dot = dotOf(curRank, predRank);

      bumpRiskCounts(risk, curRank, dot);
      if (curRank >= 5) this.bumpCategoryCounts(cats, stepCats.get(s.id));
    }

    return machines.map((m) => ({
      id: m.id,
      name: m.name,
      updatedAt: m.updatedAt,
      counts: byMachineRisk[m.id],
      actionCategories: categoriesMeta,
      highRiskRecommendedCategoryCounts: byMachineCats[m.id],
    }));
  }

  // ----- LEVEL 3: Tasks -----
  async getTasksDashboard(machineId: string) {
    await this.ensureMachine(machineId);
    const categoriesMeta = await this.getAllCategoriesMeta();

    const tasks = await this.prisma.task.findMany({
      where: { machineId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, updatedAt: true },
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
    const stepCats = await this.getAdditionalCategoryMapForStepIds(stepIds);

    const byTaskRisk: Record<string, RiskCounts> = {};
    const byTaskCats: Record<string, CategoryCounts> = {};
    for (const t of tasks) {
      byTaskRisk[t.id] = emptyCounts();
      byTaskCats[t.id] = {};
    }

    for (const s of steps) {
      const risk = byTaskRisk[s.taskId];
      const cats = byTaskCats[s.taskId];
      if (!risk) continue;

      const curRank = Math.max(
        ...s.assessments.map((a) => rankOf(a.existingBand as any)),
        0,
      );
      const predRank = Math.max(
        ...s.assessments.map((a) => rankOf(a.newBand as any)),
        0,
      );
      const dot = dotOf(curRank, predRank);

      bumpRiskCounts(risk, curRank, dot);
      if (curRank >= 5) this.bumpCategoryCounts(cats, stepCats.get(s.id));
    }

    return tasks.map((t) => ({
      id: t.id,
      name: t.name,
      updatedAt: t.updatedAt,
      counts: byTaskRisk[t.id],
      actionCategories: categoriesMeta,
      highRiskRecommendedCategoryCounts: byTaskCats[t.id],
    }));
  }

  // ----- LEVEL 4: Steps -----
  async getStepsDashboard(
    taskId: string,
    filters: { dot?: DotColor; categoryId?: string },
  ) {
    await this.ensureTask(taskId);
    const categoriesMeta = await this.getAllCategoriesMeta();

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
    const stepCats = await this.getAdditionalCategoryMapForStepIds(stepIds);

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
      const catIds = Array.from(stepCats.get(s.id) ?? []);

      if (filters.dot && dot !== filters.dot) continue;
      if (filters.categoryId && !catIds.includes(filters.categoryId)) continue;

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

    return { actionCategories: categoriesMeta, steps: out };
  }
}
