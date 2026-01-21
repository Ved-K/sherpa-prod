import { api } from './client';

export type ActionCategory = {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  sortOrder?: number | null;
  isActive?: boolean | null;
};

export function listActionCategories(opts?: { activeOnly?: string }) {
  const qs = new URLSearchParams();
  if (opts?.activeOnly) qs.set('activeOnly', opts.activeOnly);
  const q = qs.toString();
  return api<ActionCategory[]>(`/action-categories${q ? `?${q}` : ''}`);
}
