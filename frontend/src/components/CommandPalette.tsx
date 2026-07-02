import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { Skill } from '../lib/types'
import { LayoutDashboard, ListTodo, Bot, Brain, Zap, Clock, Settings, Activity, Search, Command, Users, Wallet, Lightbulb, Heart } from 'lucide-react'

const NAV_ITEMS = [
  { label: 'Command Center', path: '/', icon: LayoutDashboard },
  { label: 'Jobs', path: '/jobs', icon: ListTodo },
  { label: 'Agents', path: '/agents', icon: Bot },
  { label: 'Knowledge', path: '/knowledge', icon: Brain },
  { label: 'Skills', path: '/skills', icon: Zap },
  { label: 'Schedule', path: '/schedule', icon: Clock },
  { label: 'Workforce', path: '/workforce', icon: Users },
  { label: 'Budget', path: '/budget', icon: Wallet },
  { label: 'Insights', path: '/insights', icon: Lightbulb },
  { label: 'Life', path: '/life', icon: Heart },
  { label: 'Monitor', path: '/monitor', icon: Activity },
  { label: 'Settings', path: '/settings', icon: Settings },
]

const QUICK_COMMANDS = [
  { label: 'Morning Brief', cmd: 'morning brief' },
  { label: 'Daily Plan', cmd: 'daily plan' },
  { label: 'OLIVIA Status', cmd: 'olivia status' },
  { label: 'Weekly Synthesis', cmd: 'weekly synthesis' },
  { label: 'Build Knowledge', cmd: 'build knowledge' },
  { label: 'Wellbeing Check', cmd: 'wellbeing check' },
  { label: 'Wind Down', cmd: 'wind down' },
]

interface PaletteItem {
  type: 'nav' | 'skill' | 'command'
  label: string
  detail?: string
  action: () => void
}

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [skills, setSkills] = useState<Skill[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (open) {
      api.skills().then((d: any) => setSkills(d.skills || [])).catch(() => {})
      setQuery('')
      setActiveIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const items: PaletteItem[] = (() => {
    const q = query.toLowerCase()
    const result: PaletteItem[] = []

    for (const n of NAV_ITEMS) {
      if (!q || n.label.toLowerCase().includes(q))
        result.push({ type: 'nav', label: n.label, detail: n.path, action: () => { navigate(n.path); onClose() } })
    }

    for (const c of QUICK_COMMANDS) {
      if (!q || c.label.toLowerCase().includes(q) || c.cmd.includes(q))
        result.push({ type: 'command', label: c.label, detail: c.cmd, action: () => { api.sendCommand(c.cmd); onClose() } })
    }

    for (const sk of skills) {
      if (!q || sk.name.toLowerCase().includes(q) || sk.description?.toLowerCase().includes(q))
        result.push({ type: 'skill', label: sk.name, detail: sk.description, action: () => { api.createJob(sk.name); onClose() } })
    }

    return result
  })()

  const clampIdx = useCallback((idx: number) => Math.max(0, Math.min(items.length - 1, idx)), [items.length])

  useEffect(() => { setActiveIdx(0) }, [query])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => clampIdx(i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => clampIdx(i - 1)) }
    else if (e.key === 'Enter' && items[activeIdx]) { items[activeIdx].action() }
    else if (e.key === 'Escape') { onClose() }
  }

  const typeColor = (t: string) => {
    if (t === 'nav') return 'var(--gold)'
    if (t === 'command') return 'var(--cyan)'
    return 'var(--green-t)'
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-[540px] max-h-[60vh] overflow-hidden flex flex-col"
            style={{
              background: 'rgba(13,13,13,0.95)',
              backdropFilter: 'blur(30px)',
              border: '1px solid rgba(201,162,39,0.2)',
              boxShadow: '0 0 80px rgba(201,162,39,0.1), 0 25px 50px rgba(0,0,0,0.6)',
              borderRadius: '16px',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: '1px solid rgba(201,162,39,0.12)' }}>
              <Search size={16} style={{ color: 'var(--gold-d)' }} />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={onKey}
                placeholder="Search commands, skills, pages..."
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: 'var(--text-b)' }}
              />
              <span className="flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-d)' }}>
                <Command size={10} /> K
              </span>
            </div>

            {/* Results */}
            <div className="overflow-y-auto flex-1 py-1">
              {items.length === 0 ? (
                <div className="px-4 py-8 text-center text-[11px]" style={{ color: 'var(--text-d)' }}>
                  No results for "{query}"
                </div>
              ) : (
                items.map((item, i) => (
                  <div
                    key={`${item.type}-${item.label}`}
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors"
                    style={{
                      background: i === activeIdx ? 'rgba(201,162,39,0.08)' : 'transparent',
                      borderLeft: i === activeIdx ? '2px solid var(--gold)' : '2px solid transparent',
                    }}
                    onClick={item.action}
                    onMouseEnter={() => setActiveIdx(i)}
                  >
                    <span className="text-[8px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded"
                      style={{ background: `${typeColor(item.type)}15`, color: typeColor(item.type), minWidth: 48, textAlign: 'center' }}>
                      {item.type}
                    </span>
                    <span className="text-xs font-semibold flex-1" style={{ color: i === activeIdx ? 'var(--gold)' : 'var(--text-b)' }}>
                      {item.label}
                    </span>
                    {item.detail && (
                      <span className="text-[10px] font-mono truncate max-w-[200px]" style={{ color: 'var(--text-d)' }}>
                        {item.detail}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 px-4 py-2" style={{ borderTop: '1px solid rgba(201,162,39,0.08)' }}>
              <span className="text-[9px]" style={{ color: 'var(--text-d)' }}>
                <kbd className="font-mono px-1 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)' }}>↑↓</kbd> navigate
              </span>
              <span className="text-[9px]" style={{ color: 'var(--text-d)' }}>
                <kbd className="font-mono px-1 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)' }}>↵</kbd> select
              </span>
              <span className="text-[9px]" style={{ color: 'var(--text-d)' }}>
                <kbd className="font-mono px-1 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)' }}>esc</kbd> close
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
