import { api } from './client';

export type DotColor = 'gray' | 'green' | 'yellow' | 'orange' | 'red';

export type RiskBand =
  | 'VERY_LOW'
  | 'LOW'
  | 'MEDIUM'
  | 'MEDIUM_PLUS'
  | 'HIGH'
  | 'VERY_HIGH';

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

export type ActionCategoryMeta = {
  id: string;
  name: string;
  color?: string | null;
  sortOrder?: number | null;
};

export type TaskCategoryMeta = {
  id: string;
  name: string;
  sortOrder?: number | null;
};

export type TaskPhaseMeta = {
  id: string;
  name: string;
  sortOrder?: number | null;
};

export type RiskMetaResponse = {
  actionCategories: ActionCategoryMeta[];
  taskCategories: TaskCategoryMeta[];
  taskPhases: TaskPhaseMeta[];
};

/**
 * Backend now returns implemented counts (and provides verified as alias).
 */
export type AdditionalControlsProgress = {
  total: number;

  // ✅ new canonical naming (use this in UI)
  implemented: number;

  overdue: number;
  open: number;

  // ✅ backwards compat (service returns this too)
  verified?: number;
};

export type LineRiskItem = {
  id: string;
  name: string;
  updatedAt?: string;
  risk: RiskCounts;
  dots: DotCounts;

  highRiskRecommendedCategoryCounts: Record<string, number>;
  additionalControls: AdditionalControlsProgress;
};

export type MachineRiskItem = {
  id: string;
  name: string;
  updatedAt?: string;
  risk: RiskCounts;
  dots: DotCounts;
  highRiskRecommendedCategoryCounts: Record<string, number>;
  additionalControls: AdditionalControlsProgress;
};

export type TaskRiskItem = {
  id: string;
  name: string;
  updatedAt?: string;
  categoryId?: string | null;
  phaseId?: string | null;

  risk: RiskCounts;
  dots: DotCounts;
  highRiskRecommendedCategoryCounts: Record<string, number>;
  additionalControls: AdditionalControlsProgress;
};

export type StepRiskItem = {
  id: string;
  stepNo: number;
  title: string;
  method?: string | null;
  status?: string | null;
  updatedAt?: string;

  currentBand?: RiskBand | null;
  predictedBand?: RiskBand | null;
  dot?: DotColor | null;

  recommendedActionCategoryIds?: string[];
};

export type StepsRiskResponse = {
  actionCategories: ActionCategoryMeta[];
  steps: StepRiskItem[];
};

export type RecommendationControl = {
  id: string;
  description: string;
  owner?: string | null;
  dueDate?: string | null;

  // ✅ from Prisma model AssessmentControl
  status?: string | null;
  completedAt?: string | null;
  completedBy?: string | null;

  // (if you still keep verified logic)
  verifiedAt?: string | null;

  // convenience flags (optional if your UI uses them)
  isImplemented?: boolean;
  implementedAt?: string | null;

  assessmentId: string;

  step: { id: string; stepNo: number; title: string } | null;
  task: { id: string; name: string } | null;
  machine: { id: string; name: string } | null;
  line: { id: string; name: string } | null;
};

export type RecommendationsGroup = {
  categoryId: string;
  categoryName: string;
  color?: string | null;

  total: number;

  // ✅ new canonical naming
  implemented: number;

  overdue: number;
  open: number;

  // ✅ legacy alias (backend may send this too)
  verified?: number;

  controls: RecommendationControl[];
};

export type RecommendationsResponse = {
  actionCategories: ActionCategoryMeta[];
  groups: RecommendationsGroup[];
};

// -------------------- API calls --------------------

export function getRiskMeta() {
  return api<RiskMetaResponse>('/risk/meta');
}

export function getRiskLines() {
  return api<LineRiskItem[]>('/risk/lines');
}

export function getRiskMachines(lineId: string) {
  return api<MachineRiskItem[]>(`/risk/lines/${lineId}/machines`);
}

export function getRiskTasks(
  machineId: string,
  opts?: { taskCategoryId?: string; taskPhaseId?: string },
) {
  const qs = new URLSearchParams();
  if (opts?.taskCategoryId) qs.set('taskCategoryId', opts.taskCategoryId);
  if (opts?.taskPhaseId) qs.set('taskPhaseId', opts.taskPhaseId);
  const q = qs.toString();
  return api<TaskRiskItem[]>(
    `/risk/machines/${machineId}/tasks${q ? `?${q}` : ''}`,
  );
}

export function getRiskSteps(
  taskId: string,
  opts?: { dot?: DotColor; actionCategoryId?: string },
) {
  const qs = new URLSearchParams();
  if (opts?.dot) qs.set('dot', opts.dot);
  if (opts?.actionCategoryId) qs.set('actionCategoryId', opts.actionCategoryId);
  const q = qs.toString();
  return api<StepsRiskResponse>(
    `/risk/tasks/${taskId}/steps${q ? `?${q}` : ''}`,
  );
}

export function getRiskRecommendations(opts?: {
  lineId?: string;
  machineId?: string;
  taskId?: string;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (opts?.lineId) qs.set('lineId', opts.lineId);
  if (opts?.machineId) qs.set('machineId', opts.machineId);
  if (opts?.taskId) qs.set('taskId', opts.taskId);
  if (typeof opts?.limit === 'number') qs.set('limit', String(opts.limit));
  const q = qs.toString();
  return api<RecommendationsResponse>(
    `/risk/recommendations${q ? `?${q}` : ''}`,
  );
}

/**
 * ✅ NEW: toggle implemented checkbox
 * PATCH /risk/controls/:controlId/implemented
 */
export function setRiskControlImplemented(
  controlId: string,
  implemented: boolean,
  actor?: string,
) {
  return api<RecommendationControl>(`/risk/controls/${controlId}/implemented`, {
    method: 'PATCH',
    body: { implemented, actor },
  });
}
