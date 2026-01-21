// src/app/api/steps.ts
import { api } from './client';

export type Step = {
  id: string;
  taskId: string;
  title: string;
  method?: string | null;
  stepNo: number;
  trainingLink?: string | null;
};

// Matches CreateStepDto
export type StepCreateInput = {
  stepNo?: number; // optional
  title: string;
  method?: string;
  trainingLink?: string;
};

// Matches BulkCreateStepsDto / StepCreateItemDto (NO stepNo)
export type StepBulkCreateItem = {
  title: string;
  method?: string;
  trainingLink?: string;
};

export function listStepsForTask(taskId: string) {
  return api<Step[]>(`/tasks/${taskId}/steps`);
}

export function createStepForTask(taskId: string, body: StepCreateInput) {
  return api<Step>(`/tasks/${taskId}/steps`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function bulkCreateStepsForTask(
  taskId: string,
  steps: StepBulkCreateItem[],
) {
  return api<Step[]>(`/tasks/${taskId}/steps/bulk`, {
    method: 'POST',
    body: JSON.stringify({ steps }),
  });
}

// Matches UpdateStepDto (PATCH /steps/:stepId)
export function updateStep(stepId: string, body: Partial<StepCreateInput>) {
  return api<Step>(`/steps/${stepId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteStep(stepId: string) {
  return api<void>(`/steps/${stepId}`, { method: 'DELETE' });
}
