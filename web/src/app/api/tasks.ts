// src/app/api/tasks.ts
import { api } from './client';
import type { ReviewStatus } from './lines';

export type CreateTaskInput = {
  name: string;
  description?: string;
  trainingLink?: string;
  categoryId?: string | null;
  phaseId?: string | null;
};

export type UpdateTaskInput = Partial<CreateTaskInput>;

export type Task = {
  id: string;
  machineId: string;
  name: string;
  description?: string | null;
  trainingLink?: string | null;
  categoryId?: string | null;
  phaseId?: string | null;
  status?: ReviewStatus | null;
};

export function listTasksForMachine(machineId: string) {
  return api<Task[]>(`/machines/${encodeURIComponent(machineId)}/tasks`);
}

export function createTask(machineId: string, body: CreateTaskInput) {
  return api<Task>(`/machines/${encodeURIComponent(machineId)}/tasks`, {
    method: 'POST',
    body, // ✅ object
  });
}

export function getTask(taskId: string) {
  return api<Task>(`/tasks/${encodeURIComponent(taskId)}`);
}

export function updateTask(taskId: string, body: UpdateTaskInput) {
  return api<Task>(`/tasks/${encodeURIComponent(taskId)}`, {
    method: 'PATCH',
    body, // ✅ object
  });
}

export function setTaskStatus(taskId: string, status: ReviewStatus) {
  return api<Task>(`/tasks/${encodeURIComponent(taskId)}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

export function deleteTask(taskId: string) {
  return api<void>(`/tasks/${encodeURIComponent(taskId)}`, {
    method: 'DELETE',
  });
}

// optional (you listed it)
export function cloneTask(
  taskId: string,
  body: { targetMachineId: string; name?: string; resetStatus?: boolean },
) {
  return api<Task>(`/tasks/${encodeURIComponent(taskId)}/clone`, {
    method: 'POST',
    body,
  });
}
