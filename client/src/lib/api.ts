import type {
  AnalysisResult,
  AssignmentDto,
  AuthResponse,
  DependencyDto,
  HolidayDto,
  ProjectDto,
  ProjectSnapshot,
  ProjectSummaryDto,
  ResourceDto,
  TaskDto,
  UserDto,
} from 'shared';

const TOKEN_KEY = 'gantt.token';

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: { fields?: Record<string, string[]> };

  constructor(status: number, code: string, message: string, details?: ApiClientError['details']) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // localStorage bisa tidak tersedia (mode privat). Sesi hanya berlaku di memori.
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const errorBody = payload as { error?: { code?: string; message?: string; details?: ApiClientError['details'] } } | null;
    const message = errorBody?.error?.message ?? 'Permintaan gagal diproses. Coba lagi.';
    const code = errorBody?.error?.code ?? 'UNKNOWN_ERROR';
    if (response.status === 401) {
      setToken(null);
    }
    throw new ApiClientError(response.status, code, message, errorBody?.error?.details);
  }

  return payload as T;
}

export interface TaskMutationResult {
  task?: TaskDto;
  deletedId?: string;
  tasks: TaskDto[];
}

export interface DependencyMutationResult {
  dependency?: DependencyDto;
  deletedId?: string;
  tasks: TaskDto[];
}

export interface AssignmentMutationResult {
  assignment?: AssignmentDto;
  deletedId?: string;
  assignments: AssignmentDto[];
}

export interface ResourceMutationResult {
  resource?: ResourceDto;
  deletedId?: string;
  resources: ResourceDto[];
}

export interface CalendarMutationResult {
  project: ProjectDto;
  tasks: TaskDto[];
}

export interface HolidayMutationResult {
  holiday?: HolidayDto;
  deletedId?: string;
  holidays: HolidayDto[];
  tasks: TaskDto[];
}

export const api = {
  register: (body: { name: string; email: string; password: string }) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body }),
  login: (body: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body }),
  me: () => request<{ user: UserDto }>('/auth/me'),

  listProjects: () => request<{ projects: ProjectSummaryDto[] }>('/projects'),
  createProject: (body: {
    name: string;
    description?: string | null;
    startDate: string;
    weekendDays?: number[];
  }) => request<{ project: ProjectDto }>('/projects', { method: 'POST', body }),
  getProject: (projectId: string) => request<ProjectSnapshot>(`/projects/${projectId}`),
  updateProject: (
    projectId: string,
    body: { name?: string; description?: string | null; startDate?: string; weekendDays?: number[] },
  ) => request<CalendarMutationResult>(`/projects/${projectId}`, { method: 'PATCH', body }),
  deleteProject: (projectId: string) =>
    request<{ deletedId: string }>(`/projects/${projectId}`, { method: 'DELETE' }),

  createTask: (
    projectId: string,
    body: {
      parentId?: string | null;
      name: string;
      description?: string | null;
      durationDays?: number;
      startDate?: string;
      priority?: string;
      color?: string;
      progress?: number;
      optimisticDays?: number | null;
      pessimisticDays?: number | null;
    },
  ) => request<TaskMutationResult>(`/projects/${projectId}/tasks`, { method: 'POST', body }),
  updateTask: (taskId: string, body: Record<string, unknown>) =>
    request<TaskMutationResult>(`/tasks/${taskId}`, { method: 'PATCH', body }),
  deleteTask: (taskId: string) =>
    request<TaskMutationResult>(`/tasks/${taskId}`, { method: 'DELETE' }),
  moveTask: (taskId: string, body: { parentId: string | null; position: number }) =>
    request<TaskMutationResult>(`/tasks/${taskId}/move`, { method: 'POST', body }),

  createDependency: (
    taskId: string,
    body: { predecessorId: string; type: string; lagDays: number },
  ) => request<DependencyMutationResult>(`/tasks/${taskId}/dependencies`, { method: 'POST', body }),
  updateDependency: (dependencyId: string, body: { type?: string; lagDays?: number }) =>
    request<DependencyMutationResult>(`/dependencies/${dependencyId}`, { method: 'PATCH', body }),
  deleteDependency: (dependencyId: string) =>
    request<DependencyMutationResult>(`/dependencies/${dependencyId}`, { method: 'DELETE' }),

  listResources: (projectId: string) =>
    request<{ resources: ResourceDto[] }>(`/projects/${projectId}/resources`),
  createResource: (
    projectId: string,
    body: { name: string; email: string; role: string; salary: number },
  ) => request<ResourceMutationResult>(`/projects/${projectId}/resources`, { method: 'POST', body }),
  updateResource: (resourceId: string, body: Record<string, unknown>) =>
    request<ResourceMutationResult>(`/resources/${resourceId}`, { method: 'PATCH', body }),
  deleteResource: (resourceId: string) =>
    request<ResourceMutationResult>(`/resources/${resourceId}`, { method: 'DELETE' }),

  createAssignment: (taskId: string, body: { resourceId: string; allocationPercent: number }) =>
    request<AssignmentMutationResult>(`/tasks/${taskId}/assignments`, { method: 'POST', body }),
  updateAssignment: (assignmentId: string, body: { allocationPercent: number }) =>
    request<AssignmentMutationResult>(`/assignments/${assignmentId}`, {
      method: 'PATCH',
      body,
    }),
  deleteAssignment: (assignmentId: string) =>
    request<AssignmentMutationResult>(`/assignments/${assignmentId}`, { method: 'DELETE' }),

  updateCalendar: (projectId: string, weekendDays: number[]) =>
    request<CalendarMutationResult>(`/projects/${projectId}/calendar`, {
      method: 'PUT',
      body: { weekendDays },
    }),
  createHoliday: (projectId: string, body: { date: string; name: string }) =>
    request<HolidayMutationResult>(`/projects/${projectId}/holidays`, { method: 'POST', body }),
  deleteHoliday: (holidayId: string) =>
    request<HolidayMutationResult>(`/holidays/${holidayId}`, { method: 'DELETE' }),

  getAnalysis: (projectId: string) => request<AnalysisResult>(`/projects/${projectId}/analysis`),
};
