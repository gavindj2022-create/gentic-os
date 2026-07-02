import { useEffect, useState, useCallback } from 'react'
import { motion } from 'motion/react'
import { api } from '../lib/api'
import {
  Sun, TrendingUp, BarChart3, Dumbbell, UtensilsCrossed,
  Droplets, BookOpen, Cpu, Moon, Heart, Wine, Cigarette,
  Leaf, Thermometer, GlassWater, CheckCircle2, Circle,
  Clock, AlertTriangle, Waves,
} from 'lucide-react'

const glass = {
  background: 'rgba(13, 13, 13, 0.6)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(201,162,39,0.12)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 0 30px rgba(0,0,0,0.3)',
  borderRadius: '16px',
}

const glassInner = {
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(201,162,39,0.06)',
  borderRadius: '12px',
}

interface ScheduleBlock {
  key: string
  time: string
  label: string
  icon: string
}

interface PoolHouse {
  name: string
  type: 'airbnb' | 'home'
}

interface HealthData {
  alcohol?: number | string
  weed?: boolean
  nicotine?: boolean
  allergies?: number | string
  meals?: string
  water?: number | string
}

interface LifeData {
  today: string
  schedule: {
    date: string
    blocks: ScheduleBlock[]
    completed: string[]
    is_rest_day: boolean
    trading_journal?: string
    ai_shipped?: string
    awaiting_reply?: string | null
  }
  pools: PoolHouse[]
  health_today: HealthData
  health_week: Record<string, HealthData>
  health_trends: {
    alcohol_days: number
    weed_days: number
    nic_days: number
    avg_allergy: number
    days_tracked: number
  }
  london_alerts: Array<{ time: string; keywords: string[]; content: string }>
}

const BLOCK_ICONS: Record<string, typeof Sun> = {
  'morning_brief': Sun,
  'ny_open_reminder': TrendingUp,
  'trading_wrapup': BarChart3,
  'gym_reminder': Dumbbell,
  'nutrition_checkin': UtensilsCrossed,
  'pool_rounds': Droplets,
  'learning_digest': BookOpen,
  'ai_checkin': Cpu,
  'eod_recap': Moon,
}

function ProgressRing({ percent, size = 80, stroke = 6, color = 'var(--gold)' }: { percent: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (percent / 100) * circ
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(201,162,39,0.1)" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />
    </svg>
  )
}

function HeroStat({ label, value, sub, color, delay }: { label: string; value: string | number; sub?: string; color: string; delay: number }) {
  return (
    <motion.div className="p-4" style={glass}
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <div className="text-[9px] tracking-[2px] uppercase mb-2" style={{ color: 'var(--text-d)' }}>{label}</div>
      <div className="text-2xl font-bold" style={{ color, textShadow: `0 0 20px ${color}40` }}>{value}</div>
      {sub && <div className="text-[10px] mt-1" style={{ color: 'var(--text-d)' }}>{sub}</div>}
    </motion.div>
  )
}

export default function Life() {
  const [data, setData] = useState<LifeData | null>(null)
  const [now, setNow] = useState(new Date())

  const load = useCallback(() => {
    api.life().then((d: any) => setData(d)).catch(() => {})
  }, [])

  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id) }, [load])
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(id) }, [])

  const completed = data?.schedule?.completed?.length ?? 0
  const total = data?.schedule?.blocks?.length ?? 9
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' })
  const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const isRestDay = data?.schedule?.is_rest_day ?? false
  const trends = data?.health_trends ?? { alcohol_days: 0, weed_days: 0, nic_days: 0, avg_allergy: 0, days_tracked: 0 }
  const currentTime = now.toTimeString().slice(0, 5)

  return (
    <div className="space-y-5 pb-8">
      {/* Page header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-1 pb-2"
        style={{ borderBottom: '1px solid rgba(201,162,39,0.15)' }}>
        <div className="flex items-center gap-2">
          <div className="w-[3px] h-3.5 rounded-sm" style={{ background: 'var(--gold)' }} />
          <h1 className="text-[11px] tracking-[3px] uppercase" style={{ color: 'var(--gold)' }}>Life</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] tracking-wide" style={{ color: 'var(--text-d)' }}>{dayName}, {dateStr}</span>
          {isRestDay && (
            <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }}>
              REST DAY
            </span>
          )}
        </div>
      </motion.div>

      {/* Hero stats row */}
      <div className="grid grid-cols-4 gap-4">
        <HeroStat label="Day Score" value={`${pct}%`} sub={`${completed}/${total} blocks`} color="var(--gold)" delay={0} />
        <HeroStat label="Health Streak" value={`${trends.days_tracked}d`} sub="tracked this week" color="var(--cyan)" delay={0.05} />
        <HeroStat label="Clean Days" value={`${trends.days_tracked - trends.alcohol_days}`} sub={`of ${trends.days_tracked} (alcohol)`} color="var(--green-t)" delay={0.1} />
        <HeroStat label="Avg Allergies" value={trends.avg_allergy || '—'} sub="out of 10" color={trends.avg_allergy > 5 ? 'var(--red)' : 'var(--cyan)'} delay={0.15} />
      </div>

      {/* Main grid: Schedule + Sidebar */}
      <div className="grid grid-cols-3 gap-5">
        {/* LEFT: Schedule timeline (2 cols) */}
        <motion.div className="col-span-2 p-5" style={glass}
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock size={14} style={{ color: 'var(--gold)' }} />
              <span className="text-[10px] tracking-[2px] uppercase font-bold" style={{ color: 'var(--gold)' }}>Daily Schedule</span>
            </div>
            <div className="flex items-center gap-2">
              <ProgressRing percent={pct} size={36} stroke={3} />
              <span className="text-xs font-bold" style={{ color: 'var(--gold)' }}>{pct}%</span>
            </div>
          </div>

          <div className="space-y-1">
            {data?.schedule?.blocks?.map((block, i) => {
              const done = data.schedule.completed.includes(block.key)
              const Icon = BLOCK_ICONS[block.key] || Circle
              const isPast = block.time < currentTime
              const isCurrent = !done && isPast && (i === data.schedule.blocks.length - 1 || data.schedule.blocks[i + 1].time > currentTime)
              const isAwaiting = data.schedule.awaiting_reply === block.key

              return (
                <motion.div key={block.key}
                  initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.04 }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
                  style={{
                    ...glassInner,
                    borderLeft: isCurrent ? '3px solid var(--cyan)' : done ? '3px solid var(--green-t)' : '3px solid transparent',
                    background: isCurrent ? 'rgba(0,200,200,0.06)' : done ? 'rgba(45,122,40,0.06)' : 'rgba(0,0,0,0.2)',
                    opacity: !isPast && !done ? 0.5 : 1,
                  }}>
                  <div className="w-8 text-center">
                    {done ? (
                      <CheckCircle2 size={16} style={{ color: 'var(--green-t)' }} />
                    ) : isCurrent ? (
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
                        <Icon size={16} style={{ color: 'var(--cyan)' }} />
                      </motion.div>
                    ) : (
                      <Icon size={16} style={{ color: 'var(--text-d)' }} />
                    )}
                  </div>
                  <span className="text-[10px] font-mono w-12 shrink-0" style={{ color: done ? 'var(--green-t)' : isCurrent ? 'var(--cyan)' : 'var(--text-d)' }}>
                    {block.time}
                  </span>
                  <span className="text-xs flex-1" style={{ color: done ? 'var(--text-b)' : isCurrent ? 'var(--cyan)' : 'var(--text-d)', fontWeight: isCurrent ? 700 : 400 }}>
                    {block.label}
                    {block.key === 'gym_reminder' && isRestDay && (
                      <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>REST</span>
                    )}
                  </span>
                  {isAwaiting && (
                    <span className="text-[8px] font-bold tracking-wider px-2 py-0.5 rounded-full animate-pulse"
                      style={{ background: 'rgba(201,162,39,0.15)', color: 'var(--gold)', border: '1px solid rgba(201,162,39,0.3)' }}>
                      AWAITING REPLY
                    </span>
                  )}
                  {done && (
                    <span className="text-[8px] tracking-wider" style={{ color: 'var(--green-t)' }}>DONE</span>
                  )}
                </motion.div>
              )
            })}
          </div>
        </motion.div>

        {/* RIGHT SIDEBAR */}
        <div className="space-y-5">
          {/* Pool Status */}
          <motion.div className="p-4" style={glass}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="flex items-center gap-2 mb-3">
              <Waves size={14} style={{ color: 'var(--cyan)' }} />
              <span className="text-[10px] tracking-[2px] uppercase font-bold" style={{ color: 'var(--cyan)' }}>Pool Rounds</span>
            </div>
            {data?.pools?.map((pool) => (
              <div key={pool.name} className="flex items-center gap-2 py-2 px-2 rounded-lg mb-1" style={glassInner}>
                <Droplets size={12} style={{ color: pool.type === 'home' ? 'var(--gold)' : 'var(--cyan)' }} />
                <span className="text-xs flex-1" style={{ color: 'var(--text-b)' }}>{pool.name}</span>
                <span className="text-[8px] tracking-wider px-1.5 py-0.5 rounded"
                  style={{
                    background: pool.type === 'home' ? 'rgba(201,162,39,0.1)' : 'rgba(0,200,200,0.1)',
                    color: pool.type === 'home' ? 'var(--gold-d)' : 'rgba(0,200,200,0.7)',
                  }}>
                  {pool.type === 'home' ? 'HOME' : 'AIRBNB'}
                </span>
              </div>
            ))}
            <div className="text-[9px] mt-2" style={{ color: 'var(--text-d)' }}>
              pH 7.2-7.6 · Cl 1-3ppm · Alk 80-120ppm
            </div>
          </motion.div>

          {/* Health Today */}
          <motion.div className="p-4" style={glass}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <div className="flex items-center gap-2 mb-3">
              <Heart size={14} style={{ color: '#ef4444' }} />
              <span className="text-[10px] tracking-[2px] uppercase font-bold" style={{ color: 'var(--gold)' }}>Health Today</span>
            </div>
            {data?.health_today && Object.keys(data.health_today).length > 0 ? (
              <div className="space-y-2">
                <HealthRow icon={Wine} label="Alcohol" value={data.health_today.alcohol === 0 ? 'None' : String(data.health_today.alcohol ?? '—')}
                  color={!data.health_today.alcohol || data.health_today.alcohol === 0 ? 'var(--green-t)' : 'var(--red)'} />
                <HealthRow icon={Leaf} label="Weed" value={data.health_today.weed ? 'Yes' : 'No'}
                  color={data.health_today.weed ? '#f59e0b' : 'var(--green-t)'} />
                <HealthRow icon={Cigarette} label="Nicotine" value={data.health_today.nicotine ? 'Yes' : 'No'}
                  color={data.health_today.nicotine ? 'var(--red)' : 'var(--green-t)'} />
                <HealthRow icon={Thermometer} label="Allergies" value={`${data.health_today.allergies ?? '—'}/10`}
                  color={typeof data.health_today.allergies === 'number' && data.health_today.allergies > 5 ? 'var(--red)' : 'var(--cyan)'} />
                <HealthRow icon={GlassWater} label="Water" value={`${data.health_today.water ?? '—'} glasses`} color="var(--cyan)" />
              </div>
            ) : (
              <div className="text-[10px] py-3 text-center" style={{ color: 'var(--text-d)' }}>
                Health check-in at 7 PM
              </div>
            )}
          </motion.div>

          {/* London Session */}
          <motion.div className="p-4" style={glass}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={14} style={{ color: '#8b5cf6' }} />
              <span className="text-[10px] tracking-[2px] uppercase font-bold" style={{ color: '#8b5cf6' }}>London Session</span>
              <span className="text-[8px] font-mono" style={{ color: 'var(--text-d)' }}>1-4 AM CT</span>
            </div>
            {data?.london_alerts && data.london_alerts.length > 0 ? (
              <div className="space-y-2">
                {data.london_alerts.slice(0, 3).map((alert, i) => (
                  <div key={i} className="px-2 py-2 rounded-lg" style={glassInner}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-mono" style={{ color: '#8b5cf6' }}>{alert.time}</span>
                      <div className="flex gap-1 flex-wrap">
                        {alert.keywords.slice(0, 3).map(kw => (
                          <span key={kw} className="text-[7px] tracking-wider px-1 py-0.5 rounded"
                            style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>
                            {kw.toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-[9px] leading-relaxed" style={{ color: 'var(--text-d)' }}>
                      {alert.content.slice(0, 120)}...
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[10px] py-2 text-center" style={{ color: 'var(--text-d)' }}>
                No alerts overnight
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Bottom row: Weekly health trends */}
      <motion.div className="p-5" style={glass}
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <div className="flex items-center gap-2 mb-4">
          <Heart size={14} style={{ color: 'var(--gold)' }} />
          <span className="text-[10px] tracking-[2px] uppercase font-bold" style={{ color: 'var(--gold)' }}>7-Day Health Trends</span>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => {
            const d = new Date()
            d.setDate(d.getDate() - (6 - i))
            const dateKey = d.toISOString().slice(0, 10)
            const dayData = data?.health_week?.[dateKey]
            const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' })
            const hasData = !!dayData

            return (
              <div key={dateKey} className="text-center px-1 py-3 rounded-lg" style={glassInner}>
                <div className="text-[9px] font-bold mb-2" style={{ color: hasData ? 'var(--text-b)' : 'var(--text-d)' }}>
                  {dayLabel}
                </div>
                <div className="text-[8px] mb-1" style={{ color: 'var(--text-d)' }}>
                  {d.getDate()}
                </div>
                {hasData ? (
                  <div className="space-y-1 mt-2">
                    <Dot color={!dayData.alcohol || dayData.alcohol === 0 ? 'var(--green-t)' : 'var(--red)'} label="A" />
                    <Dot color={dayData.weed ? '#f59e0b' : 'var(--green-t)'} label="W" />
                    <Dot color={dayData.nicotine ? 'var(--red)' : 'var(--green-t)'} label="N" />
                    <div className="text-[8px] font-mono mt-1" style={{ color: typeof dayData.allergies === 'number' && dayData.allergies > 5 ? 'var(--red)' : 'var(--cyan)' }}>
                      {dayData.allergies ?? '—'}
                    </div>
                  </div>
                ) : (
                  <div className="text-[9px] mt-4" style={{ color: 'var(--text-d)' }}>—</div>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex gap-6 mt-3 pt-2" style={{ borderTop: '1px solid rgba(201,162,39,0.08)' }}>
          <span className="text-[9px] flex items-center gap-1.5" style={{ color: 'var(--text-d)' }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--green-t)' }} /> Clean
          </span>
          <span className="text-[9px] flex items-center gap-1.5" style={{ color: 'var(--text-d)' }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--red)' }} /> Used
          </span>
          <span className="text-[9px] flex items-center gap-1.5" style={{ color: 'var(--text-d)' }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#f59e0b' }} /> Weed
          </span>
          <span className="text-[9px]" style={{ color: 'var(--text-d)' }}>A = Alcohol · W = Weed · N = Nicotine</span>
        </div>
      </motion.div>
    </div>
  )
}

function HealthRow({ icon: Icon, label, value, color }: { icon: typeof Heart; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={glassInner}>
      <Icon size={12} style={{ color }} />
      <span className="text-[10px] flex-1" style={{ color: 'var(--text-d)' }}>{label}</span>
      <span className="text-[10px] font-bold" style={{ color }}>{value}</span>
    </div>
  )
}

function Dot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center justify-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: color, boxShadow: `0 0 4px ${color}` }} />
      <span className="text-[7px]" style={{ color: 'var(--text-d)' }}>{label}</span>
    </div>
  )
}
