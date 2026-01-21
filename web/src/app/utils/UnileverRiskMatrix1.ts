// src/app/utils/unileverRiskMatrix1.ts
export type RiskBand =
  | 'VERY_LOW'
  | 'LOW'
  | 'MEDIUM'
  | 'MEDIUM_PLUS'
  | 'HIGH'
  | 'VERY_HIGH';

export const UNILEVER_SEVERITIES = [1, 2, 4, 6, 8, 10] as const;
export const UNILEVER_PROBABILITIES = [10, 8, 6, 4, 2, 1] as const;

const bandTable: Record<number, Record<number, RiskBand>> = {
  10: {
    1: 'LOW',
    2: 'HIGH',
    4: 'VERY_HIGH',
    6: 'VERY_HIGH',
    8: 'VERY_HIGH',
    10: 'VERY_HIGH',
  },
  8: {
    1: 'LOW',
    2: 'MEDIUM_PLUS',
    4: 'HIGH',
    6: 'VERY_HIGH',
    8: 'VERY_HIGH',
    10: 'VERY_HIGH',
  },
  6: {
    1: 'LOW',
    2: 'MEDIUM',
    4: 'MEDIUM_PLUS',
    6: 'HIGH',
    8: 'VERY_HIGH',
    10: 'VERY_HIGH',
  },
  4: {
    1: 'VERY_LOW',
    2: 'LOW',
    4: 'MEDIUM',
    6: 'MEDIUM_PLUS',
    8: 'HIGH',
    10: 'VERY_HIGH',
  },
  2: {
    1: 'VERY_LOW',
    2: 'VERY_LOW',
    4: 'LOW',
    6: 'MEDIUM',
    8: 'HIGH',
    10: 'HIGH',
  },
  1: {
    1: 'VERY_LOW',
    2: 'VERY_LOW',
    4: 'LOW',
    6: 'LOW',
    8: 'MEDIUM_PLUS',
    10: 'HIGH',
  },
};

export function unileverRating(severity?: number, probability?: number) {
  if (severity == null || probability == null) return null;
  if (!Number.isFinite(severity) || !Number.isFinite(probability)) return null;
  return Number(severity) * Number(probability);
}

export function unileverBand(
  severity?: number,
  probability?: number,
): RiskBand | null {
  if (severity == null || probability == null) return null;
  const s = Number(severity);
  const p = Number(probability);
  return bandTable?.[p]?.[s] ?? null;
}

export function bandChipColor(b: RiskBand) {
  // MUI Chip color categories
  if (b === 'VERY_LOW' || b === 'LOW') return 'success' as const;
  if (b === 'MEDIUM' || b === 'MEDIUM_PLUS') return 'warning' as const;
  return 'error' as const; // HIGH / VERY_HIGH
}
