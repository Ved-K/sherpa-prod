// src/app/api/controls.ts
import { api } from './client';

export type ControlPhase = 'EXISTING' | 'ADDITIONAL';
export type ControlType = 'ENGINEERING' | 'ADMIN' | 'PPE' | 'OTHER';

export type Control = {
  id: string;
  assessmentId: string;

  phase: ControlPhase;
  type: ControlType;
  description: string;

  categoryId?: string | null;
  owner?: string | null;
  dueDate?: string | null; // ISO
  isVerified?: boolean | null;
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

export function listControls(
  assessmentId: string,
  opts?: { phase?: ControlPhase },
) {
  const qs = new URLSearchParams();
  if (opts?.phase) qs.set('phase', opts.phase);
  const q = qs.toString();

  return api<Control[]>(
    `/assessments/${assessmentId}/controls${q ? `?${q}` : ''}`,
  );
}

export function createControl(
  assessmentId: string,
  body: {
    phase: ControlPhase;
    type: ControlType;
    description: string;
    categoryId?: string | null;
    owner?: string;
    dueDate?: string;
    isVerified?: boolean;
  },
) {
  return api<Control>(
    `/assessments/${assessmentId}/controls`,
    withJson(body, { method: 'POST' }),
  );
}

export function patchControl(id: string, patch: Partial<Control>) {
  return api<Control>(`/controls/${id}`, withJson(patch, { method: 'PATCH' }));
}

export function deleteControl(id: string) {
  return api<void>(`/controls/${id}`, { method: 'DELETE' });
}
