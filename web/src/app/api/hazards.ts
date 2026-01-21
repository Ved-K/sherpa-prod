import { api } from './client';

export type HazardCategory = {
  id: string;
  name: string;
  sortOrder?: number | null;
};

export type Hazard = {
  id: string;
  categoryId: string;
  code?: string | null;
  name: string;
  description?: string | null;
  sortOrder?: number | null;
  active?: boolean | null;
};

export function listHazardCategories() {
  return api<HazardCategory[]>('/hazard-categories');
}

export function listHazards(opts?: { categoryId?: string; q?: string }) {
  const qs = new URLSearchParams();
  if (opts?.categoryId) qs.set('categoryId', opts.categoryId);
  if (opts?.q) qs.set('q', opts.q);
  const q = qs.toString();
  return api<Hazard[]>(`/hazards${q ? `?${q}` : ''}`);
}
