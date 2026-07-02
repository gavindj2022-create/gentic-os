import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Hammer, MonitorPlay, X } from 'lucide-react'
import AgentFace from '../components/AgentFace'
import { api } from '../lib/api'
import { useWebSocket } from '../hooks/useWebSocket'
import type { ClaudeSession, ClaudeSessionSummary } from '../lib/types'

/* ─── Glassmorphism Card ─── */
function GlassCard({ children, className = '', glow, delay = 0 }: {
  children: React.ReactNode; className?: string; glow?: string; delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, type: 'spring', stiffness: 100 }}
      className={`relative overflow-hidden rounded-2xl ${className}`}
      style={{
        background: 'rgba(13, 13, 13, 0.6)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(201, 162, 39, 0.15)',
        boxShadow: glow
          ? `0 0 30px ${glow}, inset 0 0 30px rgba(0,0,0,0.3)`
          : '0 8px 32px rgba(0,0,0,0.4), inset 0 0 30px rgba(0,0,0,0.3)',
      }}
    >
      <div className="relative z-10">{children}</div>
    </motion.div>
  )
}

/* ─── Pulsing Status Dot ─── */
function StatusDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <motion.div
        animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="w-2 h-2 rounded-full"
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
      />
      <span className="text-[10px] uppercase tracking-wider" style={{ color }}>{label}</span>
    </div>
  )
}

/* ─── Building Animation (hero) ─── */
function BuildingAnimation({ active }: { active: boolean }) {
  const bars = [0, 1, 2, 3, 4, 5, 6, 7]
  return (
    <div className="relative h-24 flex items-end justify-center gap-2 overflow-hidden">
      {/* Scanline */}
      {active && (
        <motion.div
          className="absolute left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, var(--cyan), transparent)' }}
          animate={{ top: ['0%', '100%', '0%'] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      {/* Assembling blocks */}
      {bars.map((i) => (
        <motion.div
          key={i}
          className="w-5 rounded-t-sm"
          style={{
            background: active
              ? `linear-gradient(180deg, var(--gold), rgba(201,162,39,0.3))`
              : 'rgba(255,255,255,0.06)',
            boxShadow: active ? '0 0 12px rgba(201,162,39,0.4)' : 'none',
          }}
          animate={active
            ? { height: [12, 40 + (i % 4) * 14, 20, 56 - (i % 3) * 10, 12] }
            : { height: 12 }}
          transition={active
            ? { duration: 1.6 + (i % 3) * 0.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.12 }
            : { duration: 0.4 }}
        />
      ))}
    </div>
  )
}

const MODE_COLOR = { planner: '#8b5cf6', builder: '#00c8c8' } as const

function timeAgo(ts?: string | null): string {
  if (!ts) return ''
  try {
    const d = new Date(ts)
    const sec = (Date.now() - d.getTime()) / 1000
    if (sec < 60) return `${Math.floor(sec)}s`
    if (sec < 3600) return `${Math.floor(sec / 60)}m`
    return `${Math.floor(sec / 3600)}h`
  } catch { return '' }
}

/* ─── Session detail (the active tab body) ─── */
function SessionDetail({ s }: { s: ClaudeSession }) {
  const modeColor = MODE_COLOR[s.mode] ?? '#00c8c8'
  const statusColor = s.status === 'active' ? '#4db848' : s.status === 'thinking' ? '#e8c04a' : '#5a5040'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AgentFace name="claude" size={36} active={s.status !== 'idle'} />
          <div>
            <div className="text-xs font-bold" style={{ color: modeColor }}>{s.name}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px] px-2 py-0.5 rounded-full uppercase font-bold"
                style={{ background: `${modeColor}20`, color: modeColor }}>
                {s.mode === 'planner' ? '🧠 Planner' : '🔨 Builder'}
              </span>
              <StatusDot color={statusColor} label={s.status} />
            </div>
          </div>
        </div>
        <span className="text-[10px] font-mono" style={{ color: 'var(--text-d)' }}>{s.duration}</span>
      </div>

      {/* Current action */}
      <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="text-[9px] tracking-[2px] uppercase mb-1" style={{ color: 'var(--text-d)' }}>Currently</div>
        <div className="flex items-center gap-2">
          {s.is_building && (
            <motion.span
              animate={{ rotate: [0, -20, 20, 0] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            >
              <Hammer size={14} style={{ color: 'var(--gold)' }} />
            </motion.span>
          )}
          <span className="text-sm font-medium" style={{ color: s.current_action ? 'var(--text)' : 'var(--text-d)' }}>
            {s.current_action || 'Idle'}
          </span>
        </div>
      </div>

      {/* Progress */}
      <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <motion.div
          animate={{ width: `${s.progress}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${modeColor}, ${modeColor}88)` }}
        />
      </div>

      {/* Files */}
      {s.files.length > 0 && (
        <div>
          <div className="text-[9px] tracking-[2px] uppercase mb-2" style={{ color: 'var(--text-d)' }}>Files Touched</div>
          <div className="flex flex-wrap gap-1.5">
            <AnimatePresence>
              {s.files.map((f) => (
                <motion.span
                  key={f}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="text-[10px] px-2 py-0.5 rounded-md font-mono"
                  style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-b)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  {f}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Recent actions feed */}
      {s.recent_actions && s.recent_actions.length > 0 && (
        <div>
          <div className="text-[9px] tracking-[2px] uppercase mb-2" style={{ color: 'var(--text-d)' }}>Activity</div>
          <div className="space-y-1">
            {[...s.recent_actions].reverse().map((a, i) => (
              <motion.div
                key={`${a.tool}-${a.target}-${i}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-2 py-1.5 px-3 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.02)' }}
              >
                <span className="text-[10px] font-bold w-16 shrink-0" style={{ color: 'var(--gold-d)' }}>{a.verb}</span>
                <span className="text-[11px] flex-1 font-mono truncate" style={{ color: 'var(--text)' }}>{a.target}</span>
                <span className="text-[9px] font-mono" style={{ color: 'var(--text-d)' }}>{timeAgo(a.ts)}</span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Last message */}
      {s.last_message && (
        <div className="rounded-xl p-3 italic" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
          <span className="text-[11px] leading-relaxed" style={{ color: 'var(--text-b)' }}>“{s.last_message}”</span>
        </div>
      )}
    </div>
  )
}

/* ─── MAIN BUILD PAGE ─── */
export default function Build() {
  const [sessions, setSessions] = useState<ClaudeSession[]>([])
  const [activeTab, setActiveTab] = useState(0)
  const [sharing, setSharing] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const { on } = useWebSocket()

  const load = useCallback(async () => {
    const cs = await api.claudeSessions().catch(() => null)
    if (cs) setSessions((cs as ClaudeSessionSummary).sessions || [])
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => on('claude_sessions', (data: any) => setSessions(data.sessions || [])), [on])

  // Keep activeTab in range as sessions change
  useEffect(() => {
    if (activeTab >= sessions.length) setActiveTab(Math.max(0, sessions.length - 1))
  }, [sessions.length, activeTab])

  const anyBuilding = sessions.some(s => s.is_building)
  const active = sessions.filter(s => s.status !== 'idle').length

  /* ── Screen share ── */
  const stopShare = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setSharing(false)
  }, [])

  const startShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      streamRef.current = stream
      stream.getVideoTracks()[0]?.addEventListener('ended', stopShare)
      setSharing(true)
    } catch {
      /* user cancelled the picker */
    }
  }, [stopShare])

  useEffect(() => {
    if (sharing && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [sharing])

  useEffect(() => () => stopShare(), [stopShare])

  const current = sessions[activeTab]

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="w-[3px] h-4 rounded-sm" style={{ background: 'var(--gold)' }} />
        <h1 className="text-xs tracking-[4px] uppercase font-bold" style={{ color: 'var(--gold)' }}>Build Monitor</h1>
        <div className="flex-1" />
        <StatusDot
          color={anyBuilding ? '#4db848' : active ? '#e8c04a' : '#5a5040'}
          label={anyBuilding ? 'Building' : active ? 'Active' : 'Idle'}
        />
        <button
          onClick={startShare}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-all cursor-pointer"
          style={{ background: 'rgba(0,200,200,0.08)', border: '1px solid rgba(0,200,200,0.25)' }}
        >
          <MonitorPlay size={13} style={{ color: 'var(--cyan)' }} />
          <span className="text-[10px] font-bold tracking-wide uppercase" style={{ color: 'var(--cyan)' }}>Watch Live</span>
        </button>
      </motion.div>

      {/* Hero: building animation */}
      <GlassCard delay={0.05} glow={anyBuilding ? 'rgba(201,162,39,0.12)' : undefined}>
        <div className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] tracking-[2px] uppercase font-bold" style={{ color: 'var(--gold-d)' }}>
              {anyBuilding ? 'Claude is building…' : active ? 'Claude is thinking…' : 'No active build'}
            </span>
            {anyBuilding && (
              <motion.span
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                style={{ background: 'rgba(77,184,72,0.15)', color: '#4db848' }}
              >
                ● LIVE
              </motion.span>
            )}
          </div>
          <BuildingAnimation active={anyBuilding} />
        </div>
      </GlassCard>

      {/* Sessions: tabs + detail */}
      {sessions.length === 0 ? (
        <GlassCard delay={0.1}>
          <div className="p-10 text-center">
            <AgentFace name="claude" size={48} active={false} />
            <div className="text-sm mt-3" style={{ color: 'var(--text-d)' }}>No active Claude Code sessions</div>
            <div className="text-[11px] mt-1" style={{ color: 'var(--text-d)' }}>Start a session in any project and it'll appear here live.</div>
          </div>
        </GlassCard>
      ) : (
        <GlassCard delay={0.1}>
          <div className="p-5">
            {/* Tabs */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {sessions.map((s, i) => {
                const modeColor = MODE_COLOR[s.mode] ?? '#00c8c8'
                const isActive = i === activeTab
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveTab(i)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                    style={{
                      background: isActive ? `${modeColor}18` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isActive ? `${modeColor}55` : 'rgba(255,255,255,0.06)'}`,
                      color: isActive ? modeColor : 'var(--text-d)',
                    }}
                  >
                    {s.is_building && (
                      <motion.span animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 1, repeat: Infinity }}
                        className="w-1.5 h-1.5 rounded-full" style={{ background: '#4db848' }} />
                    )}
                    <span className="truncate max-w-[140px]">{s.project}</span>
                  </button>
                )
              })}
            </div>
            {/* Detail */}
            <AnimatePresence mode="wait">
              {current && (
                <motion.div
                  key={current.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <SessionDetail s={current} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </GlassCard>
      )}

      {/* Screen-share popout */}
      <AnimatePresence>
        {sharing && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-8"
            style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
            onClick={stopShare}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative rounded-2xl overflow-hidden w-full max-w-5xl"
              style={{ border: '1px solid rgba(0,200,200,0.3)', boxShadow: '0 0 60px rgba(0,200,200,0.15)' }}
            >
              <div className="flex items-center justify-between px-4 py-2.5"
                style={{ background: 'rgba(13,13,13,0.9)', borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2">
                  <MonitorPlay size={14} style={{ color: 'var(--cyan)' }} />
                  <span className="text-[11px] tracking-[2px] uppercase font-bold" style={{ color: 'var(--cyan)' }}>Live Screen</span>
                </div>
                <button onClick={stopShare} className="p-1 rounded hover:bg-[var(--s3)] cursor-pointer">
                  <X size={16} style={{ color: 'var(--text-d)' }} />
                </button>
              </div>
              <video ref={videoRef} autoPlay muted playsInline className="w-full bg-black" style={{ maxHeight: '75vh' }} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
