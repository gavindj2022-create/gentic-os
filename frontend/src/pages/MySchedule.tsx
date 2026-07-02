import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { api } from '../lib/api'
import {
  Sun, TrendingUp, BarChart3, Dumbbell, Utensils, Droplets,
  BookOpen, Cpu, Moon, Clock, Check, Coffee, Home,
} from 'lucide-react'

const glass = {
  background: 'rgba(13,13,13,0.6)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(201,162,39,0.12)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 0 30px rgba(0,0,0,0.3)',
  borderRadius: '16px',
}

const ICONS: Record<string, typeof Sun> = {
  sun: Sun, 'trending-up': TrendingUp, 'bar-chart': BarChart3, dumbbell: Dumbbell,
  utensils: Utensils, droplets: Droplets, 'book-open': BookOpen, cpu: Cpu, moon: Moon,
}

interface Block { key: string; time: string; label: string; icon: string }
interface LifeData {
  today: string
  schedule: { date: string; blocks: Block[]; completed: string[]; is_rest_day: boolean }
  pools: { name: string; type: string }[]
}

const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export default function MySchedule() {
  const [data, setData] = useState<LifeData | null>(null)
  const [nowMin, setNowMin] = useState(() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() })

  const load = () => api.life().then((d: any) => setData(d)).catch(() => {})

  useEffect(() => { load() }, [])
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date()
      setNowMin(d.getHours() * 60 + d.getMinutes())
      load()
    }, 60000)
    return () => clearInterval(id)
  }, [])

  const blocks = data?.schedule.blocks || []
  const completed = new Set(data?.schedule.completed || [])
  const isRest = data?.schedule.is_rest_day

  // current block = latest block whose time has passed
  let currentIdx = -1
  blocks.forEach((b, i) => { if (toMinutes(b.time) <= nowMin) currentIdx = i })
  const nextBlock = blocks[currentIdx + 1]

  const doneCount = blocks.filter(b => completed.has(b.key)).length
  const dayPct = blocks.length ? Math.round((doneCount / blocks.length) * 100) : 0
  const nowLabel = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

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
        <h1 className="text-[11px] tracking-[3px] uppercase" style={{ color: 'var(--gold)' }}>My Schedule</h1>
        <span className="ml-2 text-[10px]" style={{ color: 'var(--text-d)' }}>{dateLabel}</span>
        {isRest && (
          <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(139,92,246,0.12)', color: '#8b5cf6' }}>
            <Coffee size={9} /> REST DAY
          </span>
        )}
        <div className="flex-1" />
        <span className="font-mono text-sm font-bold" style={{ color: 'var(--gold-b)' }}>{nowLabel}</span>
      </motion.div>

      {/* Now / Next summary */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <SummaryCard
          label="Now"
          value={currentIdx >= 0 ? blocks[currentIdx].label : 'Before start'}
          sub={currentIdx >= 0 ? blocks[currentIdx].time : '—'}
          color="var(--cyan)" delay={0}
        />
        <SummaryCard
          label="Up Next"
          value={nextBlock ? nextBlock.label : 'Day complete'}
          sub={nextBlock ? nextBlock.time : '—'}
          color="var(--gold)" delay={0.07}
        />
        <SummaryCard
          label="Progress"
          value={`${doneCount}/${blocks.length}`}
          sub={`${dayPct}% done`}
          color="var(--green-t)" delay={0.14}
        />
      </div>

      {/* Timeline */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] tracking-[2px] uppercase font-bold" style={{ color: 'var(--gold-d)' }}>Daily Timeline</span>
        <div className="flex-1 h-px" style={{ background: 'rgba(201,162,39,0.1)' }} />
      </div>

      <div className="relative pl-2">
        {/* vertical line */}
        <div className="absolute top-2 bottom-2 w-px" style={{ left: '46px', background: 'rgba(201,162,39,0.15)' }} />
        <div className="flex flex-col gap-2">
          {blocks.map((b, i) => {
            const Icon = ICONS[b.icon] || Clock
            const isDone = completed.has(b.key)
            const isCurrent = i === currentIdx && !isDone
            const isPast = toMinutes(b.time) <= nowMin
            const color = isDone ? 'var(--green-t)' : isCurrent ? 'var(--cyan)' : 'var(--gold)'
            return (
              <motion.div
                key={b.key}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.2 + i * 0.05 }}
                className="flex items-center gap-3"
              >
                {/* time */}
                <div className="w-9 text-right shrink-0">
                  <span className="font-mono text-[11px] font-bold" style={{ color: isPast ? 'var(--text-b)' : 'var(--text-d)' }}>{b.time}</span>
                </div>
                {/* node */}
                <div className="relative z-10 w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: isDone ? 'rgba(77,184,72,0.18)' : isCurrent ? 'rgba(0,200,200,0.18)' : 'rgba(13,13,13,0.9)',
                    border: `1.5px solid ${isDone ? 'rgba(77,184,72,0.5)' : isCurrent ? 'var(--cyan)' : 'rgba(201,162,39,0.25)'}`,
                    boxShadow: isCurrent ? '0 0 14px rgba(0,200,200,0.4)' : 'none',
                  }}>
                  {isDone ? <Check size={13} style={{ color: 'var(--green-t)' }} /> : <Icon size={13} style={{ color }} />}
                </div>
                {/* card */}
                <div className="flex-1 flex items-center gap-2 px-4 py-2.5"
                  style={{ ...glass, opacity: isDone ? 0.65 : isPast || isCurrent ? 1 : 0.85, border: `1px solid ${isCurrent ? 'rgba(0,200,200,0.25)' : 'rgba(201,162,39,0.12)'}` }}>
                  <span className="text-xs font-bold flex-1" style={{ color: isDone ? 'var(--text-d)' : 'var(--text-b)', textDecoration: isDone ? 'line-through' : 'none' }}>{b.label}</span>
                  {isCurrent && <span className="text-[8px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,200,200,0.15)', color: 'var(--cyan)' }}>● now</span>}
                  {isDone && <span className="text-[8px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: 'rgba(77,184,72,0.12)', color: 'var(--green-t)' }}>done</span>}
                </div>
              </motion.div>
            )
          })}
          {blocks.length === 0 && (
            <div className="p-10 text-center" style={glass}>
              <div className="text-sm" style={{ color: 'var(--text-d)' }}>Schedule unavailable — start OLIVIA for live data</div>
            </div>
          )}
        </div>
      </div>

      {/* Pool houses */}
      {data?.pools && data.pools.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-7 mb-3">
            <span className="text-[10px] tracking-[2px] uppercase font-bold" style={{ color: 'var(--gold-d)' }}>Pool Rounds</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(201,162,39,0.1)' }} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {data.pools.map((p, i) => (
              <motion.div key={p.name} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.07 }}
                className="flex items-center gap-3 p-4" style={glass}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,200,200,0.1)' }}>
                  {p.type === 'home' ? <Home size={16} style={{ color: 'var(--cyan)' }} /> : <Droplets size={16} style={{ color: 'var(--cyan)' }} />}
                </div>
                <div>
                  <div className="text-sm font-bold" style={{ color: 'var(--text-b)' }}>{p.name}</div>
                  <div className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--text-d)' }}>{p.type}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}


function SummaryCard({ label, value, sub, color, delay }: { label: string; value: string; sub: string; color: string; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay }} className="p-4" style={glass}>
      <div className="text-[9px] tracking-[1px] uppercase mb-1" style={{ color: 'var(--text-d)' }}>{label}</div>
      <div className="text-sm font-bold truncate" style={{ color }}>{value}</div>
      <div className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--text-d)' }}>{sub}</div>
    </motion.div>
  )
}
