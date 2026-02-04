// src/app/api/lines.ts
import { api } from './client';

export type ReviewStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';

export type Line = {
  id: string;
  name: string;
  status?: ReviewStatus | null;
};

export function listLines() {
  return api<Line[]>('/lines');
}

export function getLine(lineId: string) {
  return api<Line>(`/lines/${encodeURIComponent(lineId)}`);
}

export function getLineTree(lineId: string) {
  return api<any>(`/lines/${encodeURIComponent(lineId)}/tree`);
}

export function createLine(name: string) {
  return api<Line>('/lines', {
    method: 'POST',
    body: { name }, // ✅ object (client adds JSON header)
  });
}

export function updateLine(lineId: string, patch: { name?: string }) {
  return api<Line>(`/lines/${encodeURIComponent(lineId)}`, {
    method: 'PATCH',
    body: patch,
  });
}

export function setLineStatus(lineId: string, status: ReviewStatus) {
  return api<Line>(`/lines/${encodeURIComponent(lineId)}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

export function deleteLine(lineId: string) {
  return api<void>(`/lines/${encodeURIComponent(lineId)}`, {
    method: 'DELETE',
  });
}
