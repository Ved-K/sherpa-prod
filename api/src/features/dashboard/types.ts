export type RiskBandStr =
  | 'VERY_LOW'
  | 'LOW'
  | 'MEDIUM'
  | 'MEDIUM_PLUS'
  | 'HIGH'
  | 'VERY_HIGH';

export type DotColor = 'gray' | 'green' | 'yellow' | 'orange' | 'red';

export interface RiskCounts {
  total: number;
  unassessed: number;
  veryLow: number;
  low: number;
  medium: number;
  mediumPlus: number;
  high: number;
  veryHigh: number;
  green: number;
  yellow: number;
  red: number;
  orange: number;
}

export type CategoryCounts = Record<string, number>;
