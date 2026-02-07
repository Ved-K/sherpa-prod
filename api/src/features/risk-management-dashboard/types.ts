// src/modules/risk-management-dashboard/types.ts
export type RiskBandStr =
  | 'VERY_LOW'
  | 'LOW'
  | 'MEDIUM'
  | 'MEDIUM_PLUS'
  | 'HIGH'
  | 'VERY_HIGH';

export type DotColor = 'gray' | 'green' | 'yellow' | 'orange' | 'red';

export type RiskCounts = {
  total: number;
  unassessed: number;
  veryLow: number;
  low: number;
  medium: number;
  mediumPlus: number;
  high: number;
  veryHigh: number;
};

export type DotCounts = {
  gray: number;
  green: number;
  yellow: number;
  orange: number;
  red: number;
};

export type CategoryCounts = Record<string, number>;

export type ActionCategoryMeta = {
  id: string;
  name: string;
  color?: string | null;
  sortOrder?: number | null;
};

export type ScopeSummaryItem = {
  id: string;
  name: string;
  updatedAt?: Date;
  risk: RiskCounts;
  dots: DotCounts;

  // counts of steps that are HIGH/VH and have additional controls in these categories
  highRiskRecommendedCategoryCounts: CategoryCounts;

  // additional controls progress (all additional controls under this scope)
  additionalControls: {
    total: number;
    verified: number;
    overdue: number;
    open: number; // total - verified
  };
};

export type StepRow = {
  id: string;
  stepNo: number;
  title: string;
  method?: string | null;
  status?: string | null;
  updatedAt?: Date;

  currentBand?: RiskBandStr | null;
  predictedBand?: RiskBandStr | null;
  dot?: DotColor | null;

  recommendedActionCategoryIds?: string[];
};

export type StepsResponse = {
  actionCategories: ActionCategoryMeta[];
  steps: StepRow[];
};

export type RecommendationControlItem = {
  id: string;
  description: string;
  owner?: string | null;
  dueDate?: Date | null;
  isVerified: boolean;
  verifiedAt?: Date | null;

  assessmentId: string;
  step: { id: string; stepNo: number; title: string };
  task: { id: string; name: string };
  machine: { id: string; name: string };
  line: { id: string; name: string };
};

export type RecommendationsResponse = {
  actionCategories: ActionCategoryMeta[];
  groups: Array<{
    categoryId: string;
    categoryName: string;
    color?: string | null;
    total: number;
    verified: number;
    overdue: number;
    open: number;
    controls: RecommendationControlItem[];
  }>;
};

export type MetaResponse = {
  actionCategories: ActionCategoryMeta[];
  taskCategories: { id: string; name: string; sortOrder: number }[];
  taskPhases: { id: string; name: string; sortOrder: number }[];
};
