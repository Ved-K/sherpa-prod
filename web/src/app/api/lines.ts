import { api } from './client';

export type Line = { id: string; name: string };

export async function createLine(name: string) {
  return api<Line>(`/lines`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}
