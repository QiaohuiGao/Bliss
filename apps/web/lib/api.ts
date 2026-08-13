import type {
  Wedding, Module, Task, ModulesResponse, ModuleDetailResponse,
  DashboardResponse, OnboardingPayload, ModuleCelebration, Milestone,
  TaskPhoto, TaskVendor,
} from '@bliss/types'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...fetchOptions } = options
  const authToken = token || 'dev'
  const res = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
      ...fetchOptions.headers,
    },
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(error.error ?? `API error ${res.status}`)
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  // Wedding
  createWedding: (payload: OnboardingPayload, token: string) =>
    apiFetch<Wedding>('/weddings', { method: 'POST', body: JSON.stringify(payload), token }),

  getMyWedding: (token: string) =>
    apiFetch<Wedding>('/me/wedding', { token }),

  getDashboard: (weddingId: string, token: string) =>
    apiFetch<DashboardResponse>(`/weddings/${weddingId}/dashboard`, { token }),

  updateWedding: (weddingId: string, updates: Partial<OnboardingPayload>, token: string) =>
    apiFetch<Wedding>(`/weddings/${weddingId}`, { method: 'PATCH', body: JSON.stringify(updates), token }),

  joinWedding: (inviteToken: string, token: string) =>
    apiFetch<Wedding>('/weddings/join', { method: 'POST', body: JSON.stringify({ token: inviteToken }), token }),

  invitePartner: (weddingId: string, email: string, token: string) =>
    apiFetch<{ inviteUrl: string }>(`/weddings/${weddingId}/invite`, {
      method: 'POST', body: JSON.stringify({ email }), token
    }),

  // Modules
  getModules: (weddingId: string, token: string) =>
    apiFetch<ModulesResponse>(`/weddings/${weddingId}/modules`, { token }),

  getModuleDetail: (moduleId: string, token: string) =>
    apiFetch<ModuleDetailResponse>(`/modules/${moduleId}`, { token }),

  updateModule: (moduleId: string, updates: Record<string, any>, token: string) =>
    apiFetch<Module>(`/modules/${moduleId}`, { method: 'PATCH', body: JSON.stringify(updates), token }),

  unlockModule: (moduleId: string, token: string) =>
    apiFetch<Module>(`/modules/${moduleId}/unlock`, { method: 'PATCH', token }),

  startModule: (moduleId: string, token: string) =>
    apiFetch<Module>(`/modules/${moduleId}/start`, { method: 'PATCH', token }),

  createModule: (weddingId: string, data: { title: string; subtitle?: string }, token: string) =>
    apiFetch<Module>(`/weddings/${weddingId}/modules`, { method: 'POST', body: JSON.stringify(data), token }),

  deleteModule: (moduleId: string, token: string) =>
    apiFetch<void>(`/modules/${moduleId}`, { method: 'DELETE', token }),

  // Tasks
  updateTask: (taskId: string, updates: Record<string, any>, token: string) =>
    apiFetch<Task>(`/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(updates), token }),

  createTask: (subModuleId: string, data: { title: string; description?: string }, token: string) =>
    apiFetch<Task>(`/sub-modules/${subModuleId}/tasks`, { method: 'POST', body: JSON.stringify(data), token }),

  deleteTask: (taskId: string, token: string) =>
    apiFetch<void>(`/tasks/${taskId}`, { method: 'DELETE', token }),

  // Photos
  getTaskPhotos: (taskId: string, token: string) =>
    apiFetch<TaskPhoto[]>(`/tasks/${taskId}/photos`, { token }),

  addTaskPhoto: (taskId: string, data: { url: string; caption?: string }, token: string) =>
    apiFetch<TaskPhoto>(`/tasks/${taskId}/photos`, { method: 'POST', body: JSON.stringify(data), token }),

  deletePhoto: (photoId: string, token: string) =>
    apiFetch<void>(`/photos/${photoId}`, { method: 'DELETE', token }),

  // Vendors
  upsertVendor: (taskId: string, data: Partial<TaskVendor>, token: string) =>
    apiFetch<TaskVendor>(`/tasks/${taskId}/vendor`, { method: 'PUT', body: JSON.stringify(data), token }),

  deleteVendor: (taskId: string, token: string) =>
    apiFetch<void>(`/tasks/${taskId}/vendor`, { method: 'DELETE', token }),

  // Celebrations
  getPendingCelebrations: (weddingId: string, token: string) =>
    apiFetch<ModuleCelebration[]>(`/weddings/${weddingId}/celebrations/pending`, { token }),

  dismissCelebration: (id: string, token: string) =>
    apiFetch<ModuleCelebration>(`/celebrations/${id}/dismiss`, { method: 'PATCH', token }),

  getPendingMilestones: (weddingId: string, token: string) =>
    apiFetch<Milestone[]>(`/weddings/${weddingId}/milestones/pending`, { token }),

  dismissMilestone: (id: string, token: string) =>
    apiFetch<Milestone>(`/milestones/${id}/dismiss`, { method: 'PATCH', token }),
}
