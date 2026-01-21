import { api } from './client';
import type { DotColor } from './dashboard';

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
};

// matches GET /machines/:machineId/tasks
export function listTasksForMachine(machineId: string) {
  return api<Task[]>(`/machines/${machineId}/tasks`);
}

// matches POST /machines/:machineId/tasks
export function createTask(machineId: string, body: CreateTaskInput) {
  return api<Task>(`/machines/${machineId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// matches GET /tasks/:taskId
export function getTask(taskId: string) {
  return api<Task>(`/tasks/${taskId}`);
}

// matches PATCH /tasks/:taskId
export function updateTask(taskId: string, body: UpdateTaskInput) {
  return api<Task>(`/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

// matches PATCH /tasks/:taskId/status
export function setTaskStatus(
  taskId: string,
  status: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED',
) {
  return api<Task>(`/tasks/${taskId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// matches DELETE /tasks/:taskId
export function deleteTask(taskId: string) {
  return api<void>(`/tasks/${taskId}`, { method: 'DELETE' });
}
