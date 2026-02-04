// src/app/api/steps.ts
import { api } from './client';
import type { ReviewStatus } from './lines';

export type Step = {
  id: string;
  taskId: string;
  title: string;
  method?: string | null;
  stepNo: number;
  trainingLink?: string | null;
  status?: ReviewStatus | null;
};

export type StepCreateInput = {
  stepNo?: number;
  title: string;
  method?: string;
  trainingLink?: string;
};

export type StepBulkCreateItem = {
  title: string;
  method?: string;
  trainingLink?: string;
};

export function listStepsForTask(taskId: string) {
  return api<Step[]>(`/tasks/${encodeURIComponent(taskId)}/steps`);
}

export function getStep(stepId: string) {
  return api<Step>(`/steps/${encodeURIComponent(stepId)}`);
}

export function createStepForTask(taskId: string, body: StepCreateInput) {
  return api<Step>(`/tasks/${encodeURIComponent(taskId)}/steps`, {
    method: 'POST',
    body, // ✅ object
  });
}

export function bulkCreateStepsForTask(
  taskId: string,
  steps: StepBulkCreateItem[],
) {
  return api<Step[]>(`/tasks/${encodeURIComponent(taskId)}/steps/bulk`, {
    method: 'POST',
    body: { steps }, // ✅ object
  });
}

export function updateStep(stepId: string, body: Partial<StepCreateInput>) {
  return api<Step>(`/steps/${encodeURIComponent(stepId)}`, {
    method: 'PATCH',
    body, // ✅ object
  });
}

export function setStepStatus(stepId: string, status: ReviewStatus) {
  return api<Step>(`/steps/${encodeURIComponent(stepId)}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

export function deleteStep(stepId: string) {
  return api<void>(`/steps/${encodeURIComponent(stepId)}`, {
    method: 'DELETE',
  });
}
