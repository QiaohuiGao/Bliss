import type {
  Wedding, Task, Guest, BudgetItem, StressCheckIn, Celebration,
  DashboardData, OnboardingPayload, BudgetSummary, GuestStats
} from '@bliss/types'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...fetchOptions } = options
  const res = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    apiFetch<DashboardData>(`/weddings/${weddingId}/dashboard`, { token }),

  updateWedding: (weddingId: string, updates: Partial<OnboardingPayload>, token: string) =>
    apiFetch<Wedding>(`/weddings/${weddingId}`, { method: 'PATCH', body: JSON.stringify(updates), token }),

  invitePartner: (weddingId: string, email: string, partnerName: string, token: string) =>
    apiFetch<{ sent: boolean }>(`/weddings/${weddingId}/invite`, {
      method: 'POST', body: JSON.stringify({ email, partnerName }), token
    }),

  joinWedding: (inviteToken: string, token: string) =>
    apiFetch<Wedding>('/weddings/join', { method: 'POST', body: JSON.stringify({ token: inviteToken }), token }),

  // Tasks
  getTasks: (weddingId: string, token: string, stage?: number) =>
    apiFetch<Task[]>(`/weddings/${weddingId}/tasks${stage ? `?stage=${stage}` : ''}`, { token }),

  getStages: (weddingId: string, token: string) =>
    apiFetch<any[]>(`/weddings/${weddingId}/stages`, { token }),

  updateTask: (taskId: string, updates: { status?: string; assignedTo?: string }, token: string) =>
    apiFetch<Task>(`/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(updates), token }),

  // Stress check-in
  getStressData: (weddingId: string, token: string) =>
    apiFetch<any>(`/weddings/${weddingId}/stress-checkins`, { token }),

  getStressResponse: (mood: string, context: string) =>
    apiFetch<any>(`/stress-checkins/response?mood=${mood}&context=${context}`),

  saveCheckIn: (weddingId: string, mood: string, contextTag: string, token: string) =>
    apiFetch<StressCheckIn>(`/weddings/${weddingId}/stress-checkins`, {
      method: 'POST', body: JSON.stringify({ mood, contextTag }), token
    }),

  // Celebrations
  getCelebrations: (weddingId: string, token: string) =>
    apiFetch<any[]>(`/weddings/${weddingId}/celebrations`, { token }),

  dismissCelebration: (celebrationId: string, token: string) =>
    apiFetch<any>(`/celebrations/${celebrationId}/dismiss`, { method: 'PATCH', token }),

  // Budget
  getBudget: (weddingId: string, token: string) =>
    apiFetch<BudgetSummary & { items: BudgetItem[]; tips: string[] }>(`/weddings/${weddingId}/budget`, { token }),

  addBudgetItem: (weddingId: string, item: Partial<BudgetItem>, token: string) =>
    apiFetch<BudgetItem>(`/weddings/${weddingId}/budget-items`, { method: 'POST', body: JSON.stringify(item), token }),

  updateBudgetItem: (id: string, updates: Partial<BudgetItem>, token: string) =>
    apiFetch<BudgetItem>(`/budget-items/${id}`, { method: 'PATCH', body: JSON.stringify(updates), token }),

  deleteBudgetItem: (id: string, token: string) =>
    apiFetch<void>(`/budget-items/${id}`, { method: 'DELETE', token }),

  // Guests
  getGuests: (weddingId: string, token: string) =>
    apiFetch<{ guests: Guest[]; stats: GuestStats }>(`/weddings/${weddingId}/guests`, { token }),

  addGuest: (weddingId: string, guest: Partial<Guest>, token: string) =>
    apiFetch<Guest>(`/weddings/${weddingId}/guests`, { method: 'POST', body: JSON.stringify(guest), token }),

  updateGuest: (id: string, updates: Partial<Guest>, token: string) =>
    apiFetch<Guest>(`/guests/${id}`, { method: 'PATCH', body: JSON.stringify(updates), token }),

  deleteGuest: (id: string, token: string) =>
    apiFetch<void>(`/guests/${id}`, { method: 'DELETE', token }),
}
