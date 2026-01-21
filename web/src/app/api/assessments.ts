// src/app/api/assessments.ts
import { api } from './client';

export type ReviewStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';

export type Assessment = {
  id: string;
  stepId: string;
  hazardId: string;

  unsafeConditions?: string | null;
  unsafeActs?: string | null;
  potentialHarm?: string | null;

  existingSeverity?: number | null;
  existingProbability?: number | null;
  newSeverity?: number | null;
  newProbability?: number | null;

  notes?: string | null;
  status?: ReviewStatus | null;
};

function withJson(body: unknown, init?: RequestInit): RequestInit {
  return {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    body: JSON.stringify(body),
  };
}

export function listAssessmentsForStep(stepId: string) {
  return api<Assessment[]>(`/steps/${stepId}/assessments`);
}

export function createAssessment(stepId: string, hazardId: string) {
  return api<Assessment>(
    `/steps/${stepId}/assessments`,
    withJson({ hazardId }, { method: 'POST' }),
  );
}

export function bulkCreateAssessments(stepId: string, hazardIds: string[]) {
  return api<void>(
    `/steps/${stepId}/assessments/bulk`,
    withJson({ hazardIds }, { method: 'POST' }),
  );
}

export function patchAssessment(
  assessmentId: string,
  patch: Partial<Omit<Assessment, 'id' | 'stepId' | 'hazardId'>>,
  opts?: { actor?: string },
) {
  const headers = opts?.actor ? { 'x-actor': opts.actor } : undefined;

  return api<Assessment>(
    `/assessments/${assessmentId}`,
    withJson(patch, { method: 'PATCH', headers }),
  );
}

export function deleteAssessment(
  assessmentId: string,
  opts?: { actor?: string },
) {
  return api<void>(`/assessments/${assessmentId}`, {
    method: 'DELETE',
    headers: opts?.actor ? { 'x-actor': opts.actor } : undefined,
  });
}
