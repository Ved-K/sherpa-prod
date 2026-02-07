// src/app/api/controls.ts
import { api } from './client';

export type ControlPhase = 'EXISTING' | 'ADDITIONAL';
export type ControlType = 'ENGINEERING' | 'ADMIN' | 'PPE' | 'OTHER';

// ✅ this is ActionCategory in Prisma
export type ControlCategory = {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  sortOrder?: number;
  isActive?: boolean;
};

export type ControlStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'IMPLEMENTED'
  | 'VERIFIED'
  | 'CANCELLED';

export type Control = {
  id: string;
  assessmentId: string;

  phase: ControlPhase;
  type: ControlType;
  description: string;

  categoryId?: string | null;
  category?: ControlCategory | null; // ✅ backend includes category

  owner?: string | null;
  dueDate?: string | null; // ISO
  status?: ControlStatus;
  verifiedAt?: string | null;

  // ✅ backend returns computed field
  isVerified?: boolean;
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

// ✅ WAS /control-categories, but your backend is /action-categories
export function listControlCategories(opts?: { activeOnly?: boolean }) {
  const qs = new URLSearchParams();
  if (opts?.activeOnly) qs.set('activeOnly', 'true');
  const q = qs.toString();

  return api<ControlCategory[]>(`/action-categories${q ? `?${q}` : ''}`);
}

export function createControlCategory(name: string) {
  return api<ControlCategory>(
    `/action-categories`,
    withJson({ name }, { method: 'POST' }),
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
