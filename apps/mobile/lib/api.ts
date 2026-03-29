// Re-export the same API client logic for React Native
// (same as web but reads from env differently)
const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001'

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
  getMyWedding: (token: string) => apiFetch<any>('/me/wedding', { token }),
  getDashboard: (weddingId: string, token: string) => apiFetch<any>(`/weddings/${weddingId}/dashboard`, { token }),
  createWedding: (payload: any, token: string) => apiFetch<any>('/weddings', { method: 'POST', body: JSON.stringify(payload), token }),
  updateTask: (taskId: string, updates: any, token: string) => apiFetch<any>(`/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(updates), token }),
  getStages: (weddingId: string, token: string) => apiFetch<any[]>(`/weddings/${weddingId}/stages`, { token }),
  getBudget: (weddingId: string, token: string) => apiFetch<any>(`/weddings/${weddingId}/budget`, { token }),
  addBudgetItem: (weddingId: string, item: any, token: string) => apiFetch<any>(`/weddings/${weddingId}/budget-items`, { method: 'POST', body: JSON.stringify(item), token }),
  deleteBudgetItem: (id: string, token: string) => apiFetch<void>(`/budget-items/${id}`, { method: 'DELETE', token }),
  getGuests: (weddingId: string, token: string) => apiFetch<any>(`/weddings/${weddingId}/guests`, { token }),
  addGuest: (weddingId: string, guest: any, token: string) => apiFetch<any>(`/weddings/${weddingId}/guests`, { method: 'POST', body: JSON.stringify(guest), token }),
  updateGuest: (id: string, updates: any, token: string) => apiFetch<any>(`/guests/${id}`, { method: 'PATCH', body: JSON.stringify(updates), token }),
  deleteGuest: (id: string, token: string) => apiFetch<void>(`/guests/${id}`, { method: 'DELETE', token }),
  getStressData: (weddingId: string, token: string) => apiFetch<any>(`/weddings/${weddingId}/stress-checkins`, { token }),
  getStressResponse: (mood: string, context: string) => apiFetch<any>(`/stress-checkins/response?mood=${mood}&context=${context}`),
  saveCheckIn: (weddingId: string, mood: string, contextTag: string, token: string) => apiFetch<any>(`/weddings/${weddingId}/stress-checkins`, { method: 'POST', body: JSON.stringify({ mood, contextTag }), token }),
  getCelebrations: (weddingId: string, token: string) => apiFetch<any[]>(`/weddings/${weddingId}/celebrations`, { token }),
  dismissCelebration: (id: string, token: string) => apiFetch<any>(`/celebrations/${id}/dismiss`, { method: 'PATCH', token }),
  updateBudgetItem: (id: string, updates: any, token: string) => apiFetch<any>(`/budget-items/${id}`, { method: 'PATCH', body: JSON.stringify(updates), token }),
}
