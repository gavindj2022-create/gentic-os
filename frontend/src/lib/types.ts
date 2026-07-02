export interface SystemStatus {
  olivia: {
    online: boolean
    ai_routing: string
    available_ais: Record<string, boolean>
    conversation_count: number
    active_subagents: string[]
    active_projects: { name: string; status: string; phase: string }[]
    hot_topics: [string, number][]
    last_sentiment: string
    last_query: string
    recent_exchanges: { role: string; text: string; time: string }[]
    muted: boolean
    sleeping: boolean
  }
  gentic: { version: string; status: string }
}

export interface FearData {
  fear_score: number
  fraud_score: number
  fear_level: string
  trend?: string
  recommendation?: string
  headlines?: string[]
  error?: string
}

export interface TokenData {
  total: { input_tokens?: number; output_tokens?: number; cost?: number }
  today: { input_tokens?: number; output_tokens?: number; cost?: number; calls?: number }
  week: { input_tokens?: number; output_tokens?: number; cost?: number }
  skills?: string[]
  error?: string
}

export interface Skill {
  name: string
  description: string
  file: string
}

export interface Job {
  id: string
  skill: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'retrying'
  priority: number
  payload: Record<string, unknown>
  result?: string
  error?: string
  triggered_by: string
  retries: number
  created_at: string
  started_at?: string
  completed_at?: string
}

export interface Todo {
  id: string
  title: string
  description: string
  status: 'todo' | 'in_progress' | 'blocked' | 'done'
  category: 'website' | 'business' | 'automation' | 'ai_agent' | 'content' | 'other'
  priority: number
  progress: number
  vault_path: string
  created_at: string
  updated_at: string
}

export interface KnowledgeTopic {
  title: string
  filename: string
  updated: string
  word_count: number
  summary: string
}

export interface SessionAction {
  tool: string
  verb: string
  target: string
  ts?: string | null
}

export interface ClaudeSession {
  id: string
  name: string
  mode: 'planner' | 'builder'
  status: 'active' | 'idle' | 'thinking'
  progress: number
  files: string[]
  duration: string
  project: string
  started_at: string | null
  message_count?: number
  current_action?: string
  recent_actions?: SessionAction[]
  last_message?: string
  is_building?: boolean
}

export interface ClaudeSessionSummary {
  total_sessions: number
  active_sessions: number
  sessions: ClaudeSession[]
}

export interface HealthData {
  cpu_percent: number
  memory_percent: number
  memory_used_gb: number
  memory_total_gb: number
  disk_percent: number
  disk_free_gb: number
  uptime_hours: number
  status: string
}

export interface ReceiptVaultUser {
  call_count: number
  total_cost: number
  input_tokens: number
  output_tokens: number
  last_call: string | null
}

export interface ReceiptVaultUsage {
  users: Record<string, ReceiptVaultUser>
  totals: {
    call_count: number
    total_cost: number
    input_tokens: number
    output_tokens: number
  }
}

export interface SchedulerStatus {
  running: boolean
  job_count: number
  jobs: Array<{
    id: string
    name: string
    next_run: string | null
    pending: boolean
  }>
}

// ──────────────────── Workforce (Phase 4) ────────────────────

export interface AgentWorker {
  id: string
  name: string
  provider: 'claude' | 'openai' | 'gemini' | 'ollama'
  model_name: string
  status: 'idle' | 'working' | 'paused' | 'offline' | 'budget_exceeded'
  current_task_id: string | null
  created_at: string
  config: Record<string, unknown>
}

export interface AgentTask {
  id: string
  title: string
  description: string
  project_path: string
  category: 'security' | 'expansion' | 'improvement' | 'revenue' | 'general'
  assigned_agent: string | null
  status: 'pending' | 'running' | 'completed' | 'failed'
  priority: number
  source: 'manual' | 'scan' | 'recommendation'
  result: string | null
  tokens_used: number
  cost_usd: number
  created_at: string
  started_at: string | null
  completed_at: string | null
}

export interface BudgetStatus {
  provider: string
  daily_tokens_used: number
  daily_tokens_limit: number
  monthly_cost_used: number
  monthly_cost_limit: number
  is_free_tier: boolean
  can_spend: boolean
}

export interface Recommendation {
  id: string
  project: string
  title: string
  description: string
  category: string
  priority: number
  suggested_agent: string | null
  status: 'pending' | 'assigned' | 'dismissed'
  created_at: string
}

export interface Insight {
  id: string
  task_id: string
  agent_id: string
  category: 'security' | 'expansion' | 'improvement' | 'revenue'
  title: string
  content: string
  confidence: number
  obsidian_path: string | null
  created_at: string
}

export interface WorkforceStatus {
  agents: AgentWorker[]
  active_tasks: AgentTask[]
  pending_tasks: AgentTask[]
  recent_completions: AgentTask[]
  budgets: BudgetStatus[]
  total_agents: number
  working_count: number
  idle_count: number
}
