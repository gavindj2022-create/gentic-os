const BASE = '/api'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`)
  return res.json()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`)
  return res.json()
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`)
  return res.json()
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`)
  return res.json()
}

export const api = {
  system: () => get('/system'),
  status: () => get('/status'),
  fear: () => get('/fear'),
  tokens: () => get('/tokens'),
  digest: () => get('/digest'),
  carbiz: () => get('/carbiz'),
  knowledge: () => get('/knowledge'),
  skills: () => get('/skills'),
  jobs: (status?: string) => get(`/jobs${status ? `?status=${status}` : ''}`),
  schedules: () => get('/schedules'),
  vaultStats: () => get('/vault/stats'),
  sendCommand: (command: string) => post('/command', { command }),
  createJob: (skill: string, payload = {}, priority = 5) =>
    post('/jobs', { skill, payload, priority }),
  todos: (status?: string) => get(`/todos${status ? `?status=${status}` : ''}`),
  createTodo: (data: { title: string; description?: string; status?: string; category?: string; priority?: number; progress?: number; vault_path?: string }) =>
    post('/todos', data),
  updateTodo: (id: string, body: Record<string, unknown>) => put(`/todos/${id}`, body),
  deleteTodo: (id: string) => del(`/todos/${id}`),
  createSchedule: (name: string, cron: string, skill: string, payload = {}) =>
    post('/schedules', { name, cron, skill, payload }),
  deleteSchedule: (id: string) => del(`/schedules/${id}`),
  schedulerStatus: () => get('/scheduler/status'),
  claudeSessions: () => get('/claude/sessions'),
  health: () => get('/health'),
  updateSchedule: (id: string, body: Record<string, unknown>) => fetch(`${BASE}/schedules/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
  runScheduleNow: (id: string) => fetch(`${BASE}/schedules/${id}/run`, { method: 'POST' }).then(r => r.json()),
  receiptvaultUsage: () => get('/receiptvault/usage'),
  life: () => get('/life'),

  // ──── Workforce (Phase 4) ────
  workforceStatus: () => get('/workforce/status'),
  workforceAgents: () => get('/workforce/agents'),
  createWorkforceAgent: (data: { name: string; provider: string; model_name: string }) =>
    post('/workforce/agents', data),
  updateWorkforceAgent: (id: string, body: Record<string, unknown>) =>
    put(`/workforce/agents/${id}`, body),
  deleteWorkforceAgent: (id: string) => del(`/workforce/agents/${id}`),

  workforceTasks: (params?: { status?: string; agent?: string }) => {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : ''
    return get(`/workforce/tasks${qs}`)
  },
  createWorkforceTask: (data: { title: string; description?: string; project_path?: string; category?: string; priority?: number; assigned_agent?: string }) =>
    post('/workforce/tasks', data),
  updateWorkforceTask: (id: string, body: Record<string, unknown>) =>
    put(`/workforce/tasks/${id}`, body),
  assignTask: (taskId: string, agentId: string) =>
    post(`/workforce/tasks/${taskId}/assign`, { agent_id: agentId }),

  workforceBudgets: () => get('/workforce/budgets'),
  updateBudget: (provider: string, data: { monthly_cap?: number; daily_token_limit?: number }) =>
    put(`/workforce/budgets/${provider}`, data),

  scanProjects: () => get('/workforce/scan'),
  getRecommendations: (status?: string) =>
    get(`/workforce/recommendations${status ? `?status=${status}` : ''}`),
  assignRecommendation: (recId: string, agentId: string) =>
    post(`/workforce/recommendations/${recId}/assign`, { agent_id: agentId }),
  dismissRecommendation: (recId: string) =>
    post(`/workforce/recommendations/${recId}/dismiss`, {}),

  getInsights: (params?: { category?: string; limit?: number }) => {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : ''
    return get(`/workforce/insights${qs}`)
  },
  getInsightDetail: (id: string) => get(`/workforce/insights/${id}`),

  outboundStats: (track?: string) => get(`/outbound/stats${track && track !== 'all' ? `?track=${track}` : ''}`),
  outboundPipeline: (track?: string) => get(`/outbound/pipeline${track && track !== 'all' ? `?track=${track}` : ''}`),
  outboundAgents: () => get('/outbound/agents'),
  outboundKillswitch: (active: boolean) => post('/outbound/killswitch', { active }),
  outboundConfig: () => get('/outbound/config'),
  saveOutboundConfig: (data: { sheet_id?: string; n8n_url?: string; n8n_api_key?: string }) =>
    post('/outbound/config', data),

  // ──── Voice Caller (autonomous outbound AI calls) ────
  callerStatus: () => get('/caller/status'),
  callerLeads: () => get('/caller/leads'),
  placeCall: (lead: Record<string, unknown>, override_hours = false) =>
    post('/caller/call', { lead, override_hours }),
  callerCalls: (limit = 50) => get(`/caller/calls?limit=${limit}`),
  callerCall: (id: string) => get(`/caller/calls/${id}`),
  setDisposition: (id: string, disposition: string) =>
    post(`/caller/calls/${id}/disposition`, { disposition }),
  endCall: (id: string) => post(`/caller/calls/${id}/end`, {}),
  saveNotes: (id: string, notes: string) => post(`/caller/calls/${id}/notes`, { notes }),
  callerSpend: () => get('/caller/spend'),
  callerAgents: () => get('/caller/agents'),
  setActiveAgent: (key: string) => post('/caller/active-agent', { key }),
  setAgentVoice: (key: string, voice_id: string) => post('/caller/agent-voice', { key, voice_id }),
  callerDnc: () => get('/caller/dnc'),
  addDnc: (phone: string) => post('/caller/dnc', { phone }),
  removeDnc: (phone: string) => post('/caller/dnc/remove', { phone }),
  callerKillswitch: (active: boolean) => post('/caller/killswitch', { active }),
  callerConfig: () => get('/caller/config'),
  saveCallerConfig: (data: Record<string, unknown>) => post('/caller/config', data),
  callerSheet: () => get('/caller/sheet'),
  syncCallerSheet: (limit = 200) => post(`/caller/sync-sheet?limit=${limit}`, {}),
} as const
