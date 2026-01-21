import { api } from './client';

export type Machine = { id: string; lineId: string; name: string };

export async function createMachine(lineId: string, name: string) {
  return api<Machine>(`/lines/${lineId}/machines`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function updateMachine(machineId: string, name: string) {
  return api<Machine>(`/machines/${machineId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export async function deleteMachine(machineId: string) {
  return api<void>(`/machines/${machineId}`, { method: 'DELETE' });
}
