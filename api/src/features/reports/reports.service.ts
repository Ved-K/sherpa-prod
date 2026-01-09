import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaProdService } from '../../prisma/prisma.prod.service';

type RiskBand =
  | 'LOW'
  | 'MEDIUM'
  | 'MEDIUM_PLUS'
  | 'HIGH'
  | 'VERY_HIGH'
  | 'EXTREME';
type DotColor = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

@Injectable()
export class ReportsService {
  constructor(private readonly prod: PrismaProdService) {}

  async linesOverview() {
    const lines = await this.prod.line.findMany({
      include: {
        machines: {
          include: {
            tasks: {
              include: {
                steps: {
                  include: {
                    assessments: {
                      select: {
                        existingBand: true,
                        newBand: true,
                        controls: {
                          select: {
                            phase: true,
                            type: true,
                            description: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return lines.map((line) => {
      const steps = line.machines.flatMap((m) =>
        m.tasks.flatMap((t) => t.steps),
      );

      const stepSummaries = steps.map((s) => summarizeStep(s.assessments));
      return {
        id: line.id,
        name: line.name,
        counts: rollupCounts(stepSummaries),
        dots: rollupDots(stepSummaries),
        trainingFixableHigh: stepSummaries.filter(
          (x) => x.isHighOrVeryHigh && x.hasTrainingRecommendation,
        ).length,
      };
    });
  }

  async machinesForLine(lineId: string) {
    const line = await this.prod.line.findUnique({
      where: { id: lineId },
      include: {
        machines: {
          include: {
            tasks: {
              include: {
                steps: {
                  include: {
                    assessments: {
                      select: {
                        existingBand: true,
                        newBand: true,
                        controls: {
                          select: {
                            phase: true,
                            type: true,
                            description: true,
                          },
                        },
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

    return line.machines.map((m) => {
      const stepSummaries = m.tasks
        .flatMap((t) => t.steps)
        .map((s) => summarizeStep(s.assessments));
      return {
        id: m.id,
        name: m.name,
        counts: rollupCounts(stepSummaries),
        dots: rollupDots(stepSummaries),
      };
    });
  }

  async tasksForMachine(machineId: string, trained?: string) {
    const machine = await this.prod.machine.findUnique({
      where: { id: machineId },
      include: {
        tasks: {
          include: {
            steps: {
              include: {
                assessments: {
                  select: {
                    existingBand: true,
                    newBand: true,
                    controls: {
                      select: { phase: true, type: true, description: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!machine) throw new NotFoundException('Machine not found');

    // NOTE: your current schema does NOT have trainingStatus on Task yet
    // so we expose the query param now, but only apply it once you add the field.
    // (Keeping this endpoint shape stable for frontend.)

    return machine.tasks.map((t) => {
      const stepSummaries = t.steps.map((s) => summarizeStep(s.assessments));
      return {
        id: t.id,
        name: t.name,
        description: t.description,
        // trainingStatus: t.trainingStatus, // when you add it
        counts: rollupCounts(stepSummaries),
        dots: rollupDots(stepSummaries),
      };
    });
  }

  async stepsForTask(taskId: string) {
    const task = await this.prod.task.findUnique({
      where: { id: taskId },
      include: {
        steps: {
          orderBy: { stepNo: 'asc' },
          include: {
            assessments: {
              include: { controls: true },
            },
          },
        },
      },
    });
    if (!task) throw new NotFoundException('Task not found');

    return task.steps.map((s) => {
      const summary = summarizeStep(s.assessments);
      return {
        id: s.id,
        stepNo: s.stepNo,
        title: s.title,
        method: s.method,
        risk: summary.worstExisting,
        predictedRisk: summary.worstNew,
        dot: summary.dot,
        trainingFixable:
          summary.isHighOrVeryHigh && summary.hasTrainingRecommendation,
      };
    });
  }
}

function score(band?: RiskBand | null): number {
  if (!band) return 0;
  // supports future enum values without breaking
  const map: Record<string, number> = {
    LOW: 1,
    MEDIUM: 2,
    MEDIUM_PLUS: 3,
    HIGH: 4,
    VERY_HIGH: 5,
    EXTREME: 5,
  };
  return map[band] ?? 0;
}

function maxBand(bands: (RiskBand | null | undefined)[]): RiskBand | null {
  let best: RiskBand | null = null;
  let bestScore = 0;
  for (const b of bands) {
    const s = score(b ?? null);
    if (s > bestScore) {
      bestScore = s;
      best = (b ?? null) as any;
    }
  }
  return best;
}

function isHighOrVeryHigh(b?: RiskBand | null) {
  return (b === 'HIGH' || b === 'VERY_HIGH' || b === 'EXTREME') ?? false;
}

function summarizeStep(assessments: any[]) {
  const worstExisting = maxBand(assessments.map((a) => a.existingBand)) ?? null;
  const worstNew = maxBand(assessments.map((a) => a.newBand)) ?? null;

  const high = isHighOrVeryHigh(worstExisting);
  const reducedToMediumOrLower =
    score(worstNew) > 0 && score(worstNew) <= score('MEDIUM');

  const dot: DotColor =
    high && reducedToMediumOrLower
      ? 'ORANGE'
      : high
        ? 'RED'
        : worstExisting === 'LOW'
          ? 'GREEN'
          : 'YELLOW';

  const hasTrainingRecommendation = assessments.some((a) =>
    (a.controls ?? []).some((c: any) => {
      const desc = (c.description ?? '').toString().toLowerCase();
      const looksLikeTraining =
        desc.includes('train') || desc.includes('training');
      const typeIsTraining = (c.type as any) === 'TRAINING';
      return c.phase === 'ADDITIONAL' && (typeIsTraining || looksLikeTraining);
    }),
  );

  return {
    worstExisting,
    worstNew,
    dot,
    isHighOrVeryHigh: high,
    hasTrainingRecommendation,
  };
}

function rollupCounts(stepSummaries: any[]) {
  const out = { MEDIUM: 0, MEDIUM_PLUS: 0, HIGH: 0, VERY_HIGH: 0 };
  for (const s of stepSummaries) {
    if (s.worstExisting === 'MEDIUM') out.MEDIUM++;
    if (s.worstExisting === 'MEDIUM_PLUS') out.MEDIUM_PLUS++;
    if (s.worstExisting === 'HIGH') out.HIGH++;
    if (s.worstExisting === 'VERY_HIGH' || s.worstExisting === 'EXTREME')
      out.VERY_HIGH++;
  }
  return out;
}

function rollupDots(stepSummaries: any[]) {
  const out = { GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0 };
  for (const s of stepSummaries) out[s.dot]++;
  return out;
}
