import { api } from './client';

export type DotColor = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

export type RiskCounts = {
  total: number;
  unassessed: number;
  veryHigh: number;
  high: number;
  mediumPlus: number;
  medium: number;
  low: number;
  veryLow: number;
};

export type LineDashboardItem = {
  id: string;
  name: string;
  counts: RiskCounts;
};

export type MachineDashboardItem = {
  id: string;
  name: string;
  counts: RiskCounts;
};

export type TaskDashboardItem = {
  id: string;
  name: string;
  counts: RiskCounts;
  categoryId?: string | null;
};

export type StepDashboardItem = {
  id: string;
  stepNo: number;
  title: string;
  counts: RiskCounts;
};

export function getLinesDashboard() {
  return api<LineDashboardItem[]>('/dashboard/lines');
}

export function getMachinesDashboard(lineId: string) {
  return api<MachineDashboardItem[]>(`/dashboard/lines/${lineId}/machines`);
}

export function getTasksDashboard(machineId: string) {
  return api<TaskDashboardItem[]>(`/dashboard/machines/${machineId}/tasks`);
}

export function getStepsDashboard(
  taskId: string,
  opts?: { dot?: DotColor; categoryId?: string },
) {
  const qs = new URLSearchParams();
  if (opts?.dot) qs.set('dot', opts.dot);
  if (opts?.categoryId) qs.set('categoryId', opts.categoryId);
  const q = qs.toString();
  return api<StepDashboardItem[]>(
    `/dashboard/tasks/${taskId}/steps${q ? `?${q}` : ''}`,
  );
}
