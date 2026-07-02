import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { api } from '../lib/api'
import type { Job, Todo } from '../lib/types'
import { useWebSocket } from '../hooks/useWebSocket'
import AgentFace from '../components/AgentFace'
import { Plus, Trash2, Globe, Briefcase, Cpu, Bot, Film, Folder, CheckCircle2, Circle, Loader, AlertOctagon } from 'lucide-react'

const glass = {
  background: 'rgba(13,13,13,0.6)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(201,162,39,0.12)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 0 30px rgba(0,0,0,0.3)',
  borderRadius: '16px',
}

const popoutGlass = {
  background: 'rgba(13,13,13,0.9)',
  backdropFilter: 'blur(30px)',
  border: '1px solid rgba(201,162,39,0.2)',
  boxShadow: '0 0 60px rgba(201,162,39,0.12), 0 25px 50px rgba(0,0,0,0.5)',
  borderRadius: '20px',
}

const CATEGORY_META: Record<string, { color: string; icon: typeof Globe; label: string }> = {
  website: { color: '#3b82f6', icon: Globe, label: 'Website' },
  business: { color: '#eab308', icon: Briefcase, label: 'Business' },
  automation: { color: '#22c55e', icon: Cpu, label: 'Automation' },
  ai_agent: { color: '#8b5cf6', icon: Bot, label: 'AI Agent' },
  content: { color: '#ec4899', icon: Film, label: 'Content' },
  other: { color: '#64748b', icon: Folder, label: 'Other' },
}

const STATUS_META: Record<string, { color: string; label: string; icon: typeof Circle }> = {
  todo: { color: '#64748b', label: 'To Do', icon: Circle },
  in_progress: { color: 'var(--cyan)', label: 'In Progress', icon: Loader },
  blocked: { color: 'var(--red)', label: 'Blocked', icon: AlertOctagon },
  done: { color: 'var(--green-t)', label: 'Done', icon: CheckCircle2 },
}

const STATUS_CYCLE = ['todo', 'in_progress', 'blocked', 'done']
const CATEGORIES = ['website', 'business', 'automation', 'ai_agent', 'content', 'other']

export default function Jobs() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [selected, setSelected] = useState<Todo | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [hideDone, setHideDone] = useState(false)
  const { on } = useWebSocket()

  const loadTodos = () => api.todos().then((d: any) => setTodos(d.todos || [])).catch(() => {})
  const loadJobs = () => api.jobs().then((d: any) => setJobs(d.jobs || [])).catch(() => {})

  useEffect(() => { loadTodos(); loadJobs() }, [])

  useEffect(() => on('todo_created', loadTodos), [on])
  useEffect(() => on('todo_updated', loadTodos), [on])
  useEffect(() => on('job_update', loadJobs), [on])
  useEffect(() => on('job_created', loadJobs), [on])

  const visibleTodos = hideDone ? todos.filter(t => t.status !== 'done') : todos
  const active = todos.filter(t => t.status === 'in_progress').length
  const blocked = todos.filter(t => t.status === 'blocked').length
  const done = todos.filter(t => t.status === 'done').length
  const todo = todos.filter(t => t.status === 'todo').length

  const cycleStatus = async (t: Todo) => {
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(t.status) + 1) % STATUS_CYCLE.length] as Todo['status']
    const progress = next === 'done' ? 100 : t.progress
    setTodos(prev => prev.map(x => x.id === t.id ? { ...x, status: next, progress } : x))
    await api.updateTodo(t.id, { status: next, progress }).catch(() => {})
    loadTodos()
  }

  const patch = async (id: string, body: Record<string, unknown>) => {
    setTodos(prev => prev.map(x => x.id === id ? { ...x, ...body } as Todo : x))
    if (selected?.id === id) setSelected(s => s ? { ...s, ...body } as Todo : s)
    await api.updateTodo(id, body).catch(() => {})
    loadTodos()
  }

  const remove = async (id: string) => {
    setTodos(prev => prev.filter(x => x.id !== id))
    setSelected(null)
    await api.deleteTodo(id).catch(() => {})
  }

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center gap-2 mb-5 pb-2"
        style={{ borderBottom: '1px solid rgba(201,162,39,0.15)' }}
      >
        <div className="w-[3px] h-3.5 rounded-sm" style={{ background: 'var(--gold)' }} />
        <h1 className="text-[11px] tracking-[3px] uppercase" style={{ color: 'var(--gold)' }}>Jobs &amp; Projects</h1>
        <div className="flex-1" />
        <button
          onClick={() => setHideDone(v => !v)}
          className="text-[9px] tracking-wide uppercase px-2.5 py-1 rounded-lg cursor-pointer"
          style={{ background: hideDone ? 'rgba(0,200,200,0.12)' : 'rgba(255,255,255,0.03)', color: hideDone ? 'var(--cyan)' : 'var(--text-d)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          {hideDone ? 'Showing active' : 'Hide done'}
        </button>
        <motion.button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase cursor-pointer"
          style={{ background: 'var(--gold)', color: '#000' }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
        >
          <Plus size={12} /> New To-Do
        </motion.button>
      </motion.div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'To Do', value: todo, color: '#64748b' },
          { label: 'In Progress', value: active, color: 'var(--cyan)' },
          { label: 'Blocked', value: blocked, color: 'var(--red)' },
          { label: 'Done', value: done, color: 'var(--green-t)' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.07 }}
            className="p-4 text-center"
            style={glass}
          >
            <div className="font-mono text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
            <div className="text-[9px] tracking-[1px] uppercase mt-0.5" style={{ color: 'var(--text-d)' }}>{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Section label */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] tracking-[2px] uppercase font-bold" style={{ color: 'var(--gold-d)' }}>Ongoing Projects</span>
        <span className="text-[9px] px-2 py-0.5 rounded-full font-mono" style={{ background: 'var(--gold-m)', color: 'var(--gold)' }}>{visibleTodos.length}</span>
        <div className="flex-1 h-px" style={{ background: 'rgba(201,162,39,0.1)' }} />
      </div>

      {/* Project / To-Do cards */}
      {visibleTodos.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-10 text-center mb-6" style={glass}>
          <div className="text-sm" style={{ color: 'var(--text-d)' }}>No projects — add one to get started</div>
        </motion.div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-7">
          {visibleTodos.map((t, i) => (
            <TodoCard key={t.id} todo={t} delay={i * 0.04} onOpen={() => setSelected(t)} onCycle={() => cycleStatus(t)} />
          ))}
        </div>
      )}

      {/* Agent queue (existing job orchestrator) */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] tracking-[2px] uppercase font-bold" style={{ color: 'var(--gold-d)' }}>Agent Queue</span>
        <span className="text-[9px] px-2 py-0.5 rounded-full font-mono" style={{ background: 'var(--gold-m)', color: 'var(--gold)' }}>{jobs.length}</span>
        <div className="flex-1 h-px" style={{ background: 'rgba(201,162,39,0.1)' }} />
      </div>

      {jobs.length === 0 ? (
        <div className="p-6 text-center" style={glass}>
          <div className="text-[10px]" style={{ color: 'var(--text-d)' }}>No agent jobs queued — run a skill to create one</div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {jobs.map((job, i) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              className="flex items-center gap-3 px-4 py-3"
              style={{ ...glass, border: `1px solid ${jobBorder(job.status)}` }}
            >
              <AgentFace name={job.skill} size={32} active={job.status === 'running'} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold" style={{ color: 'var(--gold)' }}>{job.skill}</div>
                {job.result && <div className="text-[10px] truncate mt-0.5" style={{ color: 'var(--text-d)' }}>{job.result}</div>}
              </div>
              <span className="text-[10px] font-mono" style={{ color: 'var(--text-d)' }}>#{job.id}</span>
              <JobBadge status={job.status} />
            </motion.div>
          ))}
        </div>
      )}

      {/* Detail popout */}
      <AnimatePresence>
        {selected && (
          <Backdrop onClose={() => setSelected(null)}>
            <TodoDetail todo={selected} onPatch={patch} onRemove={remove} onClose={() => setSelected(null)} />
          </Backdrop>
        )}
      </AnimatePresence>

      {/* Create popout */}
      <AnimatePresence>
        {showCreate && (
          <Backdrop onClose={() => setShowCreate(false)}>
            <CreateTodo onClose={() => setShowCreate(false)} onCreated={loadTodos} />
          </Backdrop>
        )}
      </AnimatePresence>
    </div>
  )
}


function TodoCard({ todo, delay, onOpen, onCycle }: { todo: Todo; delay: number; onOpen: () => void; onCycle: () => void }) {
  const cat = CATEGORY_META[todo.category] || CATEGORY_META.other
  const st = STATUS_META[todo.status] || STATUS_META.todo
  const CatIcon = cat.icon
  const StIcon = st.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      whileHover={{ scale: 1.012 }}
      onClick={onOpen}
      className="p-4 cursor-pointer flex flex-col"
      style={{ ...glass, borderLeft: `3px solid ${cat.color}`, opacity: todo.status === 'done' ? 0.6 : 1 }}
    >
      <div className="flex items-start gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${cat.color}15` }}>
          <CatIcon size={13} style={{ color: cat.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold leading-snug" style={{ color: 'var(--text-b)', textDecoration: todo.status === 'done' ? 'line-through' : 'none' }}>{todo.title}</div>
          <div className="text-[10px] mt-1 line-clamp-2 leading-relaxed" style={{ color: 'var(--text-d)' }}>{todo.description}</div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onCycle() }}
          className="flex items-center gap-1 px-2 py-1 rounded-full shrink-0 cursor-pointer"
          style={{ background: `${st.color}15`, border: `1px solid ${st.color}30` }}
          title="Click to advance status"
        >
          <StIcon size={10} style={{ color: st.color }} />
          <span className="text-[8px] font-bold uppercase" style={{ color: st.color }}>{st.label}</span>
        </button>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2 mt-1">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div className="h-full rounded-full" style={{ width: `${todo.progress}%`, background: `linear-gradient(90deg, ${cat.color}80, ${cat.color})` }} />
        </div>
        <span className="text-[9px] font-mono" style={{ color: 'var(--text-d)' }}>{todo.progress}%</span>
      </div>
    </motion.div>
  )
}


function TodoDetail({ todo, onPatch, onRemove, onClose }: { todo: Todo; onPatch: (id: string, b: Record<string, unknown>) => void; onRemove: (id: string) => void; onClose: () => void }) {
  const cat = CATEGORY_META[todo.category] || CATEGORY_META.other
  const CatIcon = cat.icon
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="text-[10px] tracking-[2px] uppercase font-bold" style={{ color: 'var(--gold-d)' }}>Project Detail</div>
        <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-xs cursor-pointer hover:scale-110 transition-all" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-d)' }}>&#x2715;</button>
      </div>

      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${cat.color}15` }}>
          <CatIcon size={18} style={{ color: cat.color }} />
        </div>
        <div className="flex-1">
          <div className="text-base font-bold leading-snug" style={{ color: 'var(--text-b)' }}>{todo.title}</div>
          <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase mt-1 inline-block" style={{ background: `${cat.color}15`, color: cat.color }}>{cat.label}</span>
        </div>
      </div>

      <div className="p-4 rounded-lg mb-4" style={{ background: `${cat.color}08`, borderLeft: `3px solid ${cat.color}` }}>
        <div className="text-[9px] tracking-[1px] uppercase mb-1.5" style={{ color: 'var(--gold-d)' }}>What's Left</div>
        <div className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-b)' }}>{todo.description}</div>
      </div>

      {/* Status buttons */}
      <div className="mb-4">
        <div className="text-[9px] tracking-[1px] uppercase mb-2" style={{ color: 'var(--gold-d)' }}>Status</div>
        <div className="grid grid-cols-4 gap-1.5">
          {STATUS_CYCLE.map(s => {
            const m = STATUS_META[s]
            const Icon = m.icon
            const active = todo.status === s
            return (
              <button key={s} onClick={() => onPatch(todo.id, { status: s, ...(s === 'done' ? { progress: 100 } : {}) })}
                className="flex flex-col items-center gap-1 py-2 rounded-lg cursor-pointer"
                style={{ background: active ? `${m.color}18` : 'rgba(255,255,255,0.03)', border: `1px solid ${active ? `${m.color}40` : 'rgba(255,255,255,0.05)'}` }}>
                <Icon size={13} style={{ color: active ? m.color : 'var(--text-d)' }} />
                <span className="text-[8px] font-bold uppercase" style={{ color: active ? m.color : 'var(--text-d)' }}>{m.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Progress slider */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[9px] tracking-[1px] uppercase" style={{ color: 'var(--gold-d)' }}>Progress</span>
          <span className="text-[11px] font-mono font-bold" style={{ color: cat.color }}>{todo.progress}%</span>
        </div>
        <input type="range" min={0} max={100} step={5} value={todo.progress}
          onChange={e => onPatch(todo.id, { progress: Number(e.target.value) })}
          className="w-full cursor-pointer" style={{ accentColor: cat.color }} />
      </div>

      {todo.vault_path && (
        <div className="flex justify-between items-center py-1.5 mb-2" style={{ borderBottom: '1px solid rgba(201,162,39,0.08)' }}>
          <span className="text-[11px]" style={{ color: 'var(--text-d)' }}>Vault</span>
          <span className="font-mono text-[10px] truncate max-w-[300px]" style={{ color: 'var(--text-b)' }}>{todo.vault_path}</span>
        </div>
      )}

      <button onClick={() => onRemove(todo.id)} className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl text-[10px] font-bold tracking-wider uppercase cursor-pointer mt-2"
        style={{ background: 'rgba(192,40,30,0.12)', color: 'var(--red)', border: '1px solid rgba(192,40,30,0.25)' }}>
        <Trash2 size={12} /> Delete
      </button>
    </div>
  )
}


function CreateTodo({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('other')
  const [priority, setPriority] = useState(3)

  const submit = async () => {
    if (!title.trim()) return
    await api.createTodo({ title: title.trim(), description: description.trim(), category, priority }).catch(() => {})
    onCreated()
    onClose()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="text-sm font-bold tracking-[3px] uppercase" style={{ color: 'var(--gold)' }}>New To-Do</div>
        <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-xs cursor-pointer hover:scale-110 transition-all" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-d)' }}>&#x2715;</button>
      </div>

      <div className="mb-4">
        <label className="text-[10px] tracking-[1px] uppercase mb-2 block" style={{ color: 'var(--gold-d)' }}>Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Finish landing page" autoFocus
          className="w-full px-4 py-3 rounded-xl text-xs outline-none" style={{ background: 'rgba(20,20,20,0.6)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-b)' }} />
      </div>

      <div className="mb-4">
        <label className="text-[10px] tracking-[1px] uppercase mb-2 block" style={{ color: 'var(--gold-d)' }}>What's Left</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Remaining work to make it done / sellable…" rows={3}
          className="w-full px-4 py-3 rounded-xl text-xs outline-none resize-none" style={{ background: 'rgba(20,20,20,0.6)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-b)' }} />
      </div>

      <div className="mb-4">
        <label className="text-[10px] tracking-[1px] uppercase mb-2 block" style={{ color: 'var(--gold-d)' }}>Category</label>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map(c => {
            const m = CATEGORY_META[c]
            const active = category === c
            return (
              <button key={c} onClick={() => setCategory(c)} className="px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer"
                style={{ background: active ? `${m.color}18` : 'rgba(20,20,20,0.5)', border: `1px solid ${active ? `${m.color}40` : 'rgba(255,255,255,0.06)'}`, color: active ? m.color : 'var(--text-d)' }}>
                {m.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mb-5">
        <label className="text-[10px] tracking-[1px] uppercase mb-2 block" style={{ color: 'var(--gold-d)' }}>Priority (1 = highest)</label>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map(p => (
            <button key={p} onClick={() => setPriority(p)} className="flex-1 py-2 rounded-lg text-xs font-bold font-mono cursor-pointer"
              style={{ background: priority === p ? 'var(--gold-m)' : 'rgba(20,20,20,0.5)', border: `1px solid ${priority === p ? 'rgba(201,162,39,0.4)' : 'rgba(255,255,255,0.06)'}`, color: priority === p ? 'var(--gold)' : 'var(--text-d)' }}>
              {p}
            </button>
          ))}
        </div>
      </div>

      <motion.button onClick={submit} disabled={!title.trim()}
        className="w-full py-3 rounded-xl text-xs font-bold tracking-wider uppercase cursor-pointer"
        style={{ background: title.trim() ? 'var(--gold)' : 'rgba(201,162,39,0.2)', color: title.trim() ? '#000' : 'var(--text-d)' }}
        whileHover={title.trim() ? { scale: 1.02 } : {}} whileTap={title.trim() ? { scale: 0.98 } : {}}>
        Add To-Do
      </motion.button>
    </div>
  )
}


function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 24 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="w-[500px] max-h-[85vh] overflow-y-auto p-6"
        style={popoutGlass}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}


function JobBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    running: { bg: 'rgba(0,200,200,0.15)', color: 'var(--cyan)' },
    queued: { bg: 'var(--gold-m)', color: 'var(--gold)' },
    completed: { bg: 'rgba(77,184,72,0.15)', color: 'var(--green-t)' },
    failed: { bg: 'var(--red-d)', color: 'var(--red)' },
    retrying: { bg: 'var(--gold-m)', color: 'var(--gold)' },
  }
  const s = styles[status] || styles.queued
  return (
    <span className="text-[10px] px-2.5 py-1 rounded-full font-bold uppercase" style={{ background: s.bg, color: s.color }}>
      {status === 'running' && '● '}{status}
    </span>
  )
}

function jobBorder(s: string) {
  if (s === 'running') return 'rgba(0,200,200,0.25)'
  if (s === 'completed') return 'rgba(77,184,72,0.2)'
  if (s === 'failed') return 'rgba(192,40,30,0.25)'
  return 'rgba(201,162,39,0.12)'
}
