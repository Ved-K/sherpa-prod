// src/app/api/machines.ts
import { api } from './client';
import type { ReviewStatus } from './lines';

export type Machine = {
  id: string;
  lineId: string;
  name: string;
  status?: ReviewStatus | null;
};

export function listMachinesForLine(lineId: string) {
  return api<Machine[]>(`/lines/${encodeURIComponent(lineId)}/machines`);
}

export function getMachine(machineId: string) {
  return api<Machine>(`/machines/${encodeURIComponent(machineId)}`);
}

export function createMachine(lineId: string, body: { name: string }) {
  return api<Machine>(`/lines/${encodeURIComponent(lineId)}/machines`, {
    method: 'POST',
    body, // ✅ object (client JSON-ifies)
  });
}

export function updateMachine(machineId: string, patch: { name?: string }) {
  return api<Machine>(`/machines/${encodeURIComponent(machineId)}`, {
    method: 'PATCH',
    body: patch, // ✅ object
  });
}

export function setMachineStatus(machineId: string, status: ReviewStatus) {
  return api<Machine>(`/machines/${encodeURIComponent(machineId)}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

export function deleteMachine(machineId: string) {
  return api<void>(`/machines/${encodeURIComponent(machineId)}`, {
    method: 'DELETE',
  });
}
