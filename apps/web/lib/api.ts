import type {
  Wedding, Module, Task, ModulesResponse, ModuleDetailResponse,
  DashboardResponse, OnboardingPayload, ModuleCelebration, Milestone,
  TaskPhoto, TaskVendor,
  PlanningThread, ThreadMessage, DecisionProposal, AttireAgentRunResult,
  QuestScopingOverview, QuestProgress, QuestWorkspaceSnapshot, ApproveDecisionProposalResult,
  ConfirmDecisionResult,
  MemoryProfile, MemoryProfileClaim, BlissMoment, MomentAsset,
  ExternalAction, ApprovedActionResult, AgentFeedback,
  MarriageLicenseLookupResponse,
  MediaUploadIntent,
} from '@bliss/types'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...fetchOptions } = options
  const authToken = token || 'dev'
  const headers = new Headers(fetchOptions.headers)
  headers.set('Authorization', `Bearer ${authToken}`)
  if (fetchOptions.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers,
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

  createPartnerInvite: (weddingId: string, token: string) =>
    apiFetch<{ inviteUrl: string }>(`/weddings/${weddingId}/invite`, {
      method: 'POST', token
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

  // Agent planning
  createPlanningThread: (
    weddingId: string,
    token: string,
    questKey: 'attire_beauty' | 'vendor_team' | 'foundation' | 'venue_date' | 'wedding_party' | 'guests_stationery' | 'guest_experience' | 'food_beverage' | 'design_flowers' | 'ceremony' | 'registry_rings_honeymoon' | 'legal' | 'pre_wedding_events' | 'final_30_and_day_of' = 'attire_beauty',
    questionKey?: string,
  ) =>
    apiFetch<PlanningThread>(`/weddings/${weddingId}/threads`, {
      method: 'POST',
      body: JSON.stringify({ questKey, questionKey }),
      token,
    }),

  getPlanningThreads: (weddingId: string, token: string) =>
    apiFetch<PlanningThread[]>(`/weddings/${weddingId}/threads`, { token }),

  getQuestProgress: (weddingId: string, token: string) =>
    apiFetch<QuestProgress[]>(`/weddings/${weddingId}/quest-progress`, { token }),

  getQuestScoping: (weddingId: string, questKey: string, token: string) =>
    apiFetch<QuestScopingOverview>(`/weddings/${weddingId}/quests/${questKey}/scoping`, { token }),

  getQuestWorkspace: (weddingId: string, questKey: string, token: string, questionKey?: string) =>
    apiFetch<QuestWorkspaceSnapshot>(
      `/weddings/${weddingId}/quests/${questKey}/workspace${questionKey ? `?questionKey=${encodeURIComponent(questionKey)}` : ''}`,
      { token },
    ),

  getMarriageLicense: (weddingId: string, token: string, county?: string) =>
    apiFetch<MarriageLicenseLookupResponse>(
      `/weddings/${weddingId}/legal/marriage-license${county ? `?county=${encodeURIComponent(county)}` : ''}`,
      { token },
    ),

  getThreadMessages: (weddingId: string, threadId: string, token: string) =>
    apiFetch<ThreadMessage[]>(`/weddings/${weddingId}/threads/${threadId}/messages`, { token }),

  createThreadMessage: (weddingId: string, threadId: string, content: string, token: string) =>
    apiFetch<ThreadMessage>(`/weddings/${weddingId}/threads/${threadId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
      token,
    }),

  runAttireAgent: (weddingId: string, threadId: string, token: string) =>
    apiFetch<AttireAgentRunResult>(`/weddings/${weddingId}/threads/${threadId}/attire/run`, {
      method: 'POST',
      token,
    }),

  runPhotographerAgent: (weddingId: string, threadId: string, token: string) =>
    apiFetch<AttireAgentRunResult>(`/weddings/${weddingId}/threads/${threadId}/photographer/run`, {
      method: 'POST',
      token,
    }),

  runQuestScopingAgent: (weddingId: string, threadId: string, token: string) =>
    apiFetch<AttireAgentRunResult>(`/weddings/${weddingId}/threads/${threadId}/scoping/run`, {
      method: 'POST',
      token,
    }),

  getLatestDecisionProposal: (weddingId: string, threadId: string, token: string) =>
    apiFetch<DecisionProposal>(
      `/weddings/${weddingId}/threads/${threadId}/decision-proposals/latest`,
      { token },
    ),

  confirmDecisionProposal: (
    weddingId: string,
    proposalId: string,
    idempotencyKey: string,
    token: string,
  ) => apiFetch<ConfirmDecisionResult>(
    `/weddings/${weddingId}/decision-proposals/${proposalId}/confirm`,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      token,
    },
  ),

  approveDecisionProposal: (
    weddingId: string,
    proposalId: string,
    token: string,
  ) => apiFetch<ApproveDecisionProposalResult>(
    `/weddings/${weddingId}/decision-proposals/${proposalId}/approve`,
    { method: 'POST', token },
  ),

  // Memory and Moments
  getMemoryProfile: (weddingId: string, token: string) =>
    apiFetch<MemoryProfile>(`/weddings/${weddingId}/memory`, { token }),

  correctMemoryClaim: (
    weddingId: string,
    claimId: string,
    value: unknown,
    reason: string,
    token: string,
  ) => apiFetch<MemoryProfileClaim>(`/weddings/${weddingId}/memory/${claimId}/correct`, {
    method: 'POST',
    body: JSON.stringify({ value, reason }),
    token,
  }),

  setIntakeMemoryClaim: (
    weddingId: string,
    key: 'feeling' | 'date_horizon' | 'place' | 'guest_shape' | 'support_style',
    value: string,
    reason: string,
    token: string,
  ) => apiFetch<MemoryProfileClaim>(`/weddings/${weddingId}/memory/intake/${key}`, {
    method: 'PUT',
    body: JSON.stringify({ value, reason }),
    token,
  }),

  getMoments: (weddingId: string, token: string) =>
    apiFetch<BlissMoment[]>(`/weddings/${weddingId}/moments`, { token }),

  createMediaUploadIntent: (
    weddingId: string,
    data: {
      purpose: 'moment'
      contentType: MediaUploadIntent['contentType']
      sizeBytes: number
      originalFilename: string
    },
    token: string,
  ) => apiFetch<MediaUploadIntent>(`/weddings/${weddingId}/uploads/intents`, {
    method: 'POST',
    body: JSON.stringify(data),
    token,
  }),

  updateMoment: (
    weddingId: string,
    momentId: string,
    status: BlissMoment['status'],
    token: string,
  ) => apiFetch<BlissMoment>(`/weddings/${weddingId}/moments/${momentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
    token,
  }),

  addMomentAsset: (
    weddingId: string,
    momentId: string,
    data: { kind?: MomentAsset['kind']; uploadIntentId: string; caption?: string | null },
    token: string,
  ) => apiFetch<MomentAsset>(`/weddings/${weddingId}/moments/${momentId}/assets`, {
    method: 'POST',
    body: JSON.stringify(data),
    token,
  }),

  deleteMomentAsset: (weddingId: string, assetId: string, token: string) =>
    apiFetch<void>(`/weddings/${weddingId}/moment-assets/${assetId}`, {
      method: 'DELETE',
      token,
    }),

  // Approved actions
  getActions: (weddingId: string, token: string) =>
    apiFetch<ExternalAction[]>(`/weddings/${weddingId}/actions`, { token }),

  approveAction: (
    weddingId: string,
    actionId: string,
    idempotencyKey: string,
    token: string,
  ) => apiFetch<ApprovedActionResult>(`/weddings/${weddingId}/actions/${actionId}/approve`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    token,
  }),

  cancelAction: (weddingId: string, actionId: string, token: string) =>
    apiFetch<ExternalAction>(`/weddings/${weddingId}/actions/${actionId}/cancel`, {
      method: 'POST',
      token,
    }),

  submitAgentFeedback: (
    weddingId: string,
    runId: string,
    dimension: AgentFeedback['dimension'],
    rating: AgentFeedback['rating'],
    token: string,
  ) => apiFetch<AgentFeedback>(`/weddings/${weddingId}/agent-feedback`, {
    method: 'POST',
    body: JSON.stringify({ runId, dimension, rating }),
    token,
  }),
}
