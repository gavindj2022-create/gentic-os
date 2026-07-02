import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { api } from '../lib/api'
import type { AgentWorker, AgentTask, Recommendation, WorkforceStatus } from '../lib/types'
import { useWebSocket } from '../hooks/useWebSocket'
import AgentFace from '../components/AgentFace'
import { GlassPopout } from '../components/GlassCard'
import { Plus, Search, Play, Pause, Zap, Shield, Rocket, TrendingUp, DollarSign } from 'lucide-react'

const glass = {
  background: 'rgba(13,13,13,0.6)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(201,162,39,0.12)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 0 30px rgba(0,0,0,0.3)',
  borderRadius: '16px',
}

const PROVIDER_COLORS: Record<string, string> = {
  claude: '#d4a574',
  openai: '#10a37f',
  gemini: '#8b5cf6',
  ollama: '#64748b',
}

const CATEGORY_CONFIG: Record<string, { icon: typeof Shield; color: string; emoji: string }> = {
  security: { icon: Shield, color: '#ef4444', emoji: '🔒' },
  expansion: { icon: Rocket, color: '#3b82f6', emoji: '🚀' },
  improvement: { icon: TrendingUp, color: '#22c55e', emoji: '⚡' },
  revenue: { icon: DollarSign, color: '#eab308', emoji: '💰' },
  general: { icon: Zap, color: '#64748b', emoji: '⚙️' },
}

function agentFaceName(provider: string) {
  if (provider === 'openai') return 'chatgpt'
  return provider
}

export default function Workforce() {
  const [status, setStatus] = useState<WorkforceStatus | null>(null)
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [scanning, setScanning] = useState(false)
  const [showNewTask, setShowNewTask] = useState(false)
  const [showAssign, setShowAssign] = useState<Recommendation | null>(null)
  const { on } = useWebSocket()

  const load = () => {
    api.workforceStatus().then((d: any) => setStatus(d)).catch(() => {})
    api.getRecommendations('pending').then((d: any) => setRecs(d.recommendations || [])).catch(() => {})
  }

  useEffect(() => { load() }, [])
  useEffect(() => { const id = setInterval(load, 8000); return () => clearInterval(id) }, [])

  useEffect(() => {
    const unsub1 = on('agent_status', () => load())
    const unsub2 = on('task_completed', () => load())
    const unsub3 = on('workforce_task_created', () => load())
    return () => { unsub1(); unsub2(); unsub3() }
  }, [on])

  const agents = status?.agents || []
  const activeTasks = status?.active_tasks || []
  const recentCompletions = status?.recent_completions || []

  const handleScan = async () => {
    setScanning(true)
    try {
      const d: any = await api.scanProjects()
      setRecs(d.recommendations || [])
    } catch {}
    setScanning(false)
  }

  const handlePauseResume = async (agent: AgentWorker) => {
    const action = agent.status === 'paused' ? 'resume' : 'pause'
    await api.updateWorkforceAgent(agent.id, { action }).catch(() => {})
    load()
  }

  const handleAssignRec = async (rec: Recommendation, agentId: string) => {
    await api.assignRecommendation(rec.id, agentId).catch(() => {})
    setShowAssign(null)
    load()
  }

  const handleDismiss = async (recId: string) => {
    await api.dismissRecommendation(recId).catch(() => {})
    setRecs(prev => prev.filter(r => r.id !== recId))
  }

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 mb-5 pb-2"
        style={{ borderBottom: '1px solid rgba(201,162,39,0.15)' }}
      >
        <div className="w-[3px] h-3.5 rounded-sm" style={{ background: 'var(--gold)' }} />
        <h1 className="text-[11px] tracking-[3px] uppercase" style={{ color: 'var(--gold)' }}>AI Workforce</h1>
        <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(0,200,200,0.12)', color: 'var(--cyan)' }}>
          {status?.working_count || 0} working
        </span>
        <div className="flex-1" />
        <button onClick={() => setShowNewTask(true)}
          className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-all hover:scale-105"
          style={{ background: 'var(--gold-m)', color: 'var(--gold)', border: '1px solid rgba(201,162,39,0.2)' }}>
          <Plus size={12} /> New Task
        </button>
        <button onClick={handleScan} disabled={scanning}
          className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-all hover:scale-105"
          style={{ background: 'rgba(0,200,200,0.08)', color: 'var(--cyan)', border: '1px solid rgba(0,200,200,0.2)' }}>
          <Search size={12} className={scanning ? 'animate-spin' : ''} /> Scan Projects
        </button>
      </motion.div>

      {/* Agent Cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {agents.map((agent, i) => (
          <AgentCard key={agent.id} agent={agent} delay={i * 0.07}
            task={activeTasks.find(t => t.assigned_agent === agent.id)}
            onPauseResume={() => handlePauseResume(agent)} />
        ))}
        {agents.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-4 p-8 text-center" style={glass}>
            <AgentFace name="default" size={48} active={false} />
            <div className="text-xs mt-2" style={{ color: 'var(--text-d)' }}>No agents registered. Start the backend to seed defaults.</div>
          </motion.div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Active Tasks — 2 cols */}
        <div className="col-span-2">
          <SectionHeader title="Active & Pending Tasks" count={activeTasks.length + (status?.pending_tasks?.length || 0)} />
          <div className="flex flex-col gap-2">
            {[...activeTasks, ...(status?.pending_tasks || [])].slice(0, 10).map((task, i) => (
              <TaskRow key={task.id} task={task} agents={agents} delay={i * 0.04} />
            ))}
            {activeTasks.length === 0 && (status?.pending_tasks?.length || 0) === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 text-center text-xs" style={{ ...glass, color: 'var(--text-d)' }}>
                No active tasks — assign a recommendation or create a task
              </motion.div>
            )}
          </div>
        </div>

        {/* Recommendations — 1 col */}
        <div>
          <SectionHeader title="Recommendations" count={recs.length} />
          <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
            {recs.map((rec, i) => (
              <RecCard key={rec.id} rec={rec} delay={i * 0.04}
                onAssign={() => setShowAssign(rec)}
                onDismiss={() => handleDismiss(rec.id)} />
            ))}
            {recs.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 text-center text-[10px]" style={{ ...glass, color: 'var(--text-d)' }}>
                Click "Scan Projects" to find work
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Completions */}
      <div className="mt-5">
        <SectionHeader title="Recent Completions" count={recentCompletions.length} />
        <div className="flex flex-col gap-2">
          {recentCompletions.slice(0, 8).map((task, i) => (
            <CompletionRow key={task.id} task={task} agents={agents} delay={i * 0.04} />
          ))}
          {recentCompletions.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 text-center text-[10px]" style={{ ...glass, color: 'var(--text-d)' }}>
              No completed tasks yet
            </motion.div>
          )}
        </div>
      </div>

      {/* New Task Popout */}
      <GlassPopout open={showNewTask} onClose={() => setShowNewTask(false)} title="New Task" width={480}>
        <NewTaskForm agents={agents} onCreated={() => { setShowNewTask(false); load() }} />
      </GlassPopout>

      {/* Assign Recommendation Popout */}
      <GlassPopout open={!!showAssign} onClose={() => setShowAssign(null)} title="Assign Recommendation" width={420}>
        {showAssign && (
          <div>
            <div className="mb-4 p-3 rounded-lg" style={{ background: 'rgba(201,162,39,0.06)', borderLeft: `3px solid ${CATEGORY_CONFIG[showAssign.category]?.color || '#666'}` }}>
              <div className="text-xs font-bold" style={{ color: 'var(--gold)' }}>{showAssign.title}</div>
              <div className="text-[10px] mt-1" style={{ color: 'var(--text-d)' }}>{showAssign.description}</div>
            </div>
            <div className="text-[10px] mb-2 tracking-wide uppercase" style={{ color: 'var(--text-d)' }}>Assign to agent:</div>
            <div className="flex flex-col gap-2">
              {agents.map(a => (
                <button key={a.id} onClick={() => handleAssignRec(showAssign, a.id)}
                  className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all hover:scale-[1.02]"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,162,39,0.08)' }}>
                  <AgentFace name={agentFaceName(a.provider)} size={28} />
                  <div className="flex-1 text-left">
                    <div className="text-xs font-bold" style={{ color: PROVIDER_COLORS[a.provider] }}>{a.name}</div>
                    <div className="text-[9px]" style={{ color: 'var(--text-d)' }}>{a.model_name}</div>
                  </div>
                  <StatusBadge status={a.status} />
                </button>
              ))}
            </div>
          </div>
        )}
      </GlassPopout>
    </div>
  )
}


function AgentCard({ agent, task, delay, onPauseResume }: {
  agent: AgentWorker; task?: AgentTask; delay: number; onPauseResume: () => void
}) {
  const color = PROVIDER_COLORS[agent.provider] || '#999'
  const isWorking = agent.status === 'working'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="p-4"
      style={{
        ...glass,
        border: `1px solid ${isWorking ? color + '40' : 'rgba(201,162,39,0.12)'}`,
        boxShadow: isWorking
          ? `0 8px 32px rgba(0,0,0,0.4), inset 0 0 30px rgba(0,0,0,0.3), 0 0 20px ${color}15`
          : glass.boxShadow,
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <AgentFace name={agentFaceName(agent.provider)} size={36} active={agent.status !== 'offline' && agent.status !== 'paused'} />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold truncate" style={{ color }}>{agent.name}</div>
          <div className="text-[9px] font-mono" style={{ color: 'var(--text-d)' }}>{agent.model_name}</div>
        </div>
        <button onClick={onPauseResume} className="p-1 rounded cursor-pointer transition-all hover:scale-110"
          style={{ background: 'rgba(255,255,255,0.05)' }}>
          {agent.status === 'paused' ? <Play size={12} style={{ color: 'var(--green-t)' }} /> : <Pause size={12} style={{ color: 'var(--text-d)' }} />}
        </button>
      </div>

      <StatusBadge status={agent.status} />

      {task && (
        <div className="mt-2 p-2 rounded-lg" style={{ background: 'rgba(0,200,200,0.04)' }}>
          <div className="text-[9px] truncate" style={{ color: 'var(--cyan)' }}>
            {task.title}
          </div>
          {task.tokens_used > 0 && (
            <div className="text-[8px] font-mono mt-0.5" style={{ color: 'var(--text-d)' }}>
              {task.tokens_used.toLocaleString()} tokens
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}


function TaskRow({ task, agents, delay }: { task: AgentTask; agents: AgentWorker[]; delay: number }) {
  const agent = agents.find(a => a.id === task.assigned_agent)
  const catCfg = CATEGORY_CONFIG[task.category] || CATEGORY_CONFIG.general

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay }}
      className="flex items-center gap-3 px-4 py-3"
      style={{
        ...glass,
        border: `1px solid ${task.status === 'running' ? 'rgba(0,200,200,0.2)' : 'rgba(201,162,39,0.12)'}`,
      }}
    >
      {agent && <AgentFace name={agentFaceName(agent.provider)} size={28} active={task.status === 'running'} />}
      <span className="text-[10px]" title={task.category}>{catCfg.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold truncate" style={{ color: 'var(--gold)' }}>{task.title}</div>
        {task.description && <div className="text-[9px] truncate" style={{ color: 'var(--text-d)' }}>{task.description}</div>}
      </div>
      <span className="text-[9px] font-mono" style={{ color: 'var(--text-d)' }}>P{task.priority}</span>
      <StatusBadge status={task.status} />
    </motion.div>
  )
}


function RecCard({ rec, delay, onAssign, onDismiss }: {
  rec: Recommendation; delay: number; onAssign: () => void; onDismiss: () => void
}) {
  const catCfg = CATEGORY_CONFIG[rec.category] || CATEGORY_CONFIG.general

  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay }}
      className="p-3"
      style={{ ...glass, borderLeft: `3px solid ${catCfg.color}` }}
    >
      <div className="flex items-start gap-2">
        <span className="text-xs">{catCfg.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold truncate" style={{ color: 'var(--text-b)' }}>{rec.title}</div>
          <div className="text-[9px] mt-0.5" style={{ color: 'var(--text-d)' }}>{rec.project}</div>
        </div>
      </div>
      <div className="flex gap-2 mt-2">
        <button onClick={onAssign}
          className="flex-1 text-[9px] font-bold py-1 rounded cursor-pointer transition-all hover:scale-105"
          style={{ background: 'var(--gold-m)', color: 'var(--gold)' }}>
          Assign
        </button>
        <button onClick={onDismiss}
          className="text-[9px] px-2 py-1 rounded cursor-pointer transition-all hover:scale-105"
          style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-d)' }}>
          ✕
        </button>
      </div>
    </motion.div>
  )
}


function CompletionRow({ task, agents, delay }: { task: AgentTask; agents: AgentWorker[]; delay: number }) {
  const agent = agents.find(a => a.id === task.assigned_agent)
  const catCfg = CATEGORY_CONFIG[task.category] || CATEGORY_CONFIG.general

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="flex items-center gap-3 px-4 py-2.5"
      style={{ ...glass, border: '1px solid rgba(77,184,72,0.15)' }}
    >
      {agent && <AgentFace name={agentFaceName(agent.provider)} size={24} />}
      <span className="text-[10px]">{catCfg.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold truncate" style={{ color: 'var(--text-b)' }}>{task.title}</div>
        {task.result && <div className="text-[9px] truncate mt-0.5" style={{ color: 'var(--text-d)' }}>{task.result}</div>}
      </div>
      <div className="text-right shrink-0">
        <div className="text-[9px] font-mono" style={{ color: 'var(--green-t)' }}>
          {task.tokens_used > 0 ? `${task.tokens_used.toLocaleString()} tok` : '✓'}
        </div>
        {task.cost_usd > 0 && (
          <div className="text-[8px] font-mono" style={{ color: 'var(--text-d)' }}>${task.cost_usd.toFixed(4)}</div>
        )}
      </div>
    </motion.div>
  )
}


function NewTaskForm({ agents, onCreated }: { agents: AgentWorker[]; onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [category, setCategory] = useState('general')
  const [priority, setPriority] = useState(5)
  const [agentId, setAgentId] = useState('')

  const submit = async () => {
    if (!title.trim()) return
    await api.createWorkforceTask({
      title: title.trim(),
      description: desc.trim(),
      category,
      priority,
      assigned_agent: agentId || undefined,
    }).catch(() => {})
    onCreated()
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(201,162,39,0.12)',
    borderRadius: '8px',
    color: 'var(--text-b)',
  }

  return (
    <div className="flex flex-col gap-3">
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title..."
        className="px-3 py-2 text-xs outline-none" style={inputStyle} />
      <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)..."
        className="px-3 py-2 text-xs outline-none resize-none h-20" style={inputStyle} />
      <div className="grid grid-cols-2 gap-3">
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="px-3 py-2 text-xs outline-none" style={inputStyle}>
          <option value="general">General</option>
          <option value="security">🔒 Security</option>
          <option value="expansion">🚀 Expansion</option>
          <option value="improvement">⚡ Improvement</option>
          <option value="revenue">💰 Revenue</option>
        </select>
        <select value={priority} onChange={e => setPriority(Number(e.target.value))}
          className="px-3 py-2 text-xs outline-none" style={inputStyle}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(p => (
            <option key={p} value={p}>Priority {p}{p <= 2 ? ' (Critical)' : p >= 8 ? ' (Low)' : ''}</option>
          ))}
        </select>
      </div>
      <select value={agentId} onChange={e => setAgentId(e.target.value)}
        className="px-3 py-2 text-xs outline-none" style={inputStyle}>
        <option value="">Auto-assign (unassigned)</option>
        {agents.map(a => (
          <option key={a.id} value={a.id}>{a.name} ({a.model_name})</option>
        ))}
      </select>
      <button onClick={submit}
        className="mt-1 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all hover:scale-[1.02]"
        style={{ background: 'var(--gold)', color: '#000' }}>
        Create Task
      </button>
    </div>
  )
}


function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    working: { bg: 'rgba(0,200,200,0.15)', color: 'var(--cyan)' },
    running: { bg: 'rgba(0,200,200,0.15)', color: 'var(--cyan)' },
    idle: { bg: 'rgba(77,184,72,0.12)', color: 'var(--green-t)' },
    pending: { bg: 'var(--gold-m)', color: 'var(--gold)' },
    paused: { bg: 'rgba(255,255,255,0.05)', color: 'var(--text-d)' },
    completed: { bg: 'rgba(77,184,72,0.15)', color: 'var(--green-t)' },
    failed: { bg: 'var(--red-d)', color: 'var(--red)' },
    budget_exceeded: { bg: 'rgba(234,179,8,0.12)', color: '#eab308' },
    offline: { bg: 'rgba(255,255,255,0.03)', color: 'var(--text-d)' },
  }
  const s = styles[status] || styles.idle
  return (
    <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase whitespace-nowrap" style={{ background: s.bg, color: s.color }}>
      {(status === 'working' || status === 'running') && '● '}{status.replace('_', ' ')}
    </span>
  )
}


function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-[2px] h-3 rounded-sm" style={{ background: 'var(--gold-d)' }} />
      <span className="text-[10px] tracking-[2px] uppercase font-bold" style={{ color: 'var(--gold-d)' }}>{title}</span>
      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full" style={{ background: 'var(--gold-m)', color: 'var(--gold)' }}>{count}</span>
    </div>
  )
}
