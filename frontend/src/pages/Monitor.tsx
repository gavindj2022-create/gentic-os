import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { api } from '../lib/api'
import { useWebSocket } from '../hooks/useWebSocket'
import AgentFace from '../components/AgentFace'
import type { HealthData, ClaudeSession, ReceiptVaultUsage } from '../lib/types'

/* ─── Glass styling constants ─── */
const glass = {
  background: 'rgba(13, 13, 13, 0.6)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(201, 162, 39, 0.12)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 0 30px rgba(0,0,0,0.3)',
  borderRadius: '16px',
}

/* ─── Activity Entry ─── */
interface ActivityEntry {
  id: string
  icon: string
  text: string
  time: string
  color: string
  type: string
}

export default function Monitor() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [sessions, setSessions] = useState<ClaudeSession[]>([])
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [scheduler, setScheduler] = useState<any>(null)
  const [rvUsage, setRvUsage] = useState<ReceiptVaultUsage | null>(null)
  const { on } = useWebSocket()

  const loadHealth = useCallback(() => {
    api.health().then((d: any) => setHealth(d)).catch(() => {})
  }, [])

  const loadSessions = useCallback(() => {
    api.claudeSessions().then((d: any) => setSessions(d.sessions || [])).catch(() => {})
  }, [])

  const loadScheduler = useCallback(() => {
    api.schedulerStatus().then((d: any) => setScheduler(d)).catch(() => {})
  }, [])

  const loadReceiptVault = useCallback(() => {
    api.receiptvaultUsage().then((d: any) => setRvUsage(d)).catch(() => {})
  }, [])

  useEffect(() => {
    loadHealth()
    loadSessions()
    loadScheduler()
    loadReceiptVault()
    const interval = setInterval(() => { loadHealth(); loadScheduler() }, 15000)
    return () => clearInterval(interval)
  }, [loadHealth, loadSessions, loadScheduler, loadReceiptVault])

  // Listen for real-time events to build activity timeline
  useEffect(() => {
    const unsub1 = on('job_update', (data: any) => {
      const icon = data.status === 'completed' ? '✅' : data.status === 'failed' ? '❌' : data.status === 'running' ? '⚡' : '📋'
      const color = data.status === 'completed' ? '#4db848' : data.status === 'failed' ? '#c0281e' : '#00c8c8'
      addActivity(icon, `Job #${data.id} ${data.status}${data.skill ? `: ${data.skill}` : ''}`, color, 'job')
    })
    const unsub2 = on('job_created', (data: any) => {
      addActivity('📋', `Job created: ${data.skill || data.id}`, '#e8c04a', 'job')
    })
    const unsub3 = on('schedule_fired', (data: any) => {
      addActivity('⏰', `Schedule fired: ${data.skill}`, '#8b5cf6', 'schedule')
    })
    const unsub4 = on('claude_sessions', (data: any) => {
      setSessions(data.sessions || [])
    })
    const unsub5 = on('status_update', () => {
      addActivity('📡', 'System status updated', '#00c8c8', 'system')
    })
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5() }
  }, [on])

  function addActivity(icon: string, text: string, color: string, type: string) {
    const entry: ActivityEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      icon, text, color, type,
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }
    setActivity(prev => [entry, ...prev].slice(0, 50))
  }

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3">
        <div className="w-[3px] h-4 rounded-sm" style={{ background: 'var(--gold)' }} />
        <h1 className="text-xs tracking-[4px] uppercase font-bold" style={{ color: 'var(--gold)' }}>System Monitor</h1>
        <div className="flex-1" />
        <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 2, repeat: Infinity }}
          className="text-[9px] px-2.5 py-1 rounded-full font-bold"
          style={{ background: 'rgba(77,184,72,0.15)', color: '#4db848' }}>● LIVE</motion.span>
      </motion.div>

      {/* System Health Cards */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'CPU', value: health ? `${health.cpu_percent}%` : '--', color: getHealthColor(health?.cpu_percent) },
          { label: 'Memory', value: health ? `${health.memory_percent}%` : '--', color: getHealthColor(health?.memory_percent) },
          { label: 'RAM Used', value: health ? `${health.memory_used_gb}GB` : '--', color: 'var(--cyan)' },
          { label: 'Disk Free', value: health ? `${health.disk_free_gb}GB` : '--', color: 'var(--gold)' },
          { label: 'Uptime', value: health ? `${health.uptime_hours}h` : '--', color: 'var(--text-b)' },
        ].map((stat, i) => (
          <motion.div key={stat.label}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, type: 'spring', stiffness: 120 }}
            className="rounded-2xl p-4 text-center" style={glass}>
            <div className="font-mono text-2xl font-black" style={{ color: stat.color }}>{stat.value}</div>
            <div className="text-[9px] tracking-[2px] uppercase mt-1" style={{ color: 'var(--text-d)' }}>{stat.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Claude Code Sessions — Left 2 cols */}
        <div className="col-span-2 space-y-3">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="flex items-center gap-2">
            <span className="text-[10px] tracking-[2px] uppercase font-bold" style={{ color: 'var(--gold-d)' }}>
              Claude Code Sessions
            </span>
            <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 2, repeat: Infinity }}
              className="text-[9px] px-2 py-0.5 rounded-full font-bold"
              style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}>● LIVE</motion.span>
            <span className="text-[10px] font-mono ml-auto" style={{ color: 'var(--text-d)' }}>
              {sessions.length} session{sessions.length !== 1 ? 's' : ''}
            </span>
          </motion.div>

          {sessions.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
              className="rounded-2xl p-8 text-center" style={glass}>
              <AgentFace name="claude" size={48} active={false} />
              <div className="text-sm mt-3" style={{ color: 'var(--text-d)' }}>No active Claude Code sessions</div>
              <div className="text-[10px] mt-1" style={{ color: 'var(--text-d)' }}>Sessions appear when Claude Code is running</div>
            </motion.div>
          ) : (
            sessions.map((session, i) => (
              <motion.div key={session.id}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 + i * 0.05 }}
                className="rounded-2xl p-5" style={{
                  ...glass,
                  boxShadow: session.status === 'active'
                    ? `0 0 20px ${session.mode === 'planner' ? 'rgba(139,92,246,0.15)' : 'rgba(0,200,200,0.15)'}, ${glass.boxShadow}`
                    : glass.boxShadow,
                }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <AgentFace name="claude" size={32} active={session.status !== 'idle'} />
                    <div>
                      <div className="text-xs font-bold" style={{ color: session.mode === 'planner' ? '#8b5cf6' : '#00c8c8' }}>
                        {session.name}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] px-2 py-0.5 rounded-full uppercase font-bold"
                          style={{ background: `${session.mode === 'planner' ? '#8b5cf6' : '#00c8c8'}20`, color: session.mode === 'planner' ? '#8b5cf6' : '#00c8c8' }}>
                          {session.mode === 'planner' ? '🧠 Planner' : '🔨 Builder'}
                        </span>
                        <StatusDot color={session.status === 'active' ? '#4db848' : session.status === 'thinking' ? '#e8c04a' : '#5a5040'} label={session.status} />
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono" style={{ color: 'var(--text-d)' }}>{session.duration}</span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-1.5 rounded-full mb-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(session.progress, 95)}%` }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${session.mode === 'planner' ? '#8b5cf6' : '#00c8c8'}, ${session.mode === 'planner' ? '#8b5cf688' : '#00c8c888'})` }} />
                </div>
                {/* Files */}
                <div className="flex flex-wrap gap-1">
                  {session.files.map((f, fi) => (
                    <motion.span key={f} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 * fi }}
                      className="text-[9px] px-2 py-0.5 rounded-md font-mono"
                      style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-d)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      {f}
                    </motion.span>
                  ))}
                </div>
              </motion.div>
            ))
          )}

          {/* Scheduler Status */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] tracking-[2px] uppercase font-bold" style={{ color: 'var(--gold-d)' }}>Scheduler</span>
              <StatusDot color={scheduler?.running ? '#4db848' : '#c0281e'} label={scheduler?.running ? 'Running' : 'Stopped'} />
            </div>
            <div className="rounded-2xl p-4" style={glass}>
              {scheduler?.jobs?.length > 0 ? (
                <div className="space-y-2">
                  {scheduler.jobs.map((job: any) => (
                    <div key={job.id} className="flex items-center gap-3 py-2 px-3 rounded-lg"
                      style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <span className="text-sm">⏰</span>
                      <span className="text-[11px] flex-1 font-semibold" style={{ color: 'var(--text)' }}>{job.name}</span>
                      <span className="text-[9px] font-mono" style={{ color: 'var(--text-d)' }}>
                        {job.next_run ? new Date(job.next_run).toLocaleTimeString() : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-[11px]" style={{ color: 'var(--text-d)' }}>No scheduled tasks</div>
              )}
            </div>
          </motion.div>

          {/* ReceiptVault Cost Tracker */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] tracking-[2px] uppercase font-bold" style={{ color: 'var(--gold-d)' }}>ReceiptVault API Cost</span>
              <span className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                style={{ background: 'rgba(77,184,72,0.15)', color: '#4db848' }}>
                {rvUsage ? `$${rvUsage.totals.total_cost.toFixed(4)}` : '--'}
              </span>
            </div>
            <div className="rounded-2xl p-4" style={glass}>
              {rvUsage && Object.keys(rvUsage.users).length > 0 ? (
                <div className="space-y-1">
                  {/* Header */}
                  <div className="flex items-center gap-3 px-3 pb-2 mb-1"
                    style={{ borderBottom: '1px solid rgba(201,162,39,0.08)' }}>
                    <span className="text-[9px] tracking-[1px] uppercase font-bold flex-1" style={{ color: 'var(--text-d)' }}>User</span>
                    <span className="text-[9px] tracking-[1px] uppercase font-bold w-12 text-right" style={{ color: 'var(--text-d)' }}>Calls</span>
                    <span className="text-[9px] tracking-[1px] uppercase font-bold w-20 text-right" style={{ color: 'var(--text-d)' }}>Tokens</span>
                    <span className="text-[9px] tracking-[1px] uppercase font-bold w-16 text-right" style={{ color: 'var(--text-d)' }}>Cost</span>
                  </div>
                  {Object.entries(rvUsage.users).map(([uid, u]) => (
                    <div key={uid} className="flex items-center gap-3 py-2 px-3 rounded-lg"
                      style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <span className="text-[11px] flex-1 font-semibold capitalize" style={{ color: 'var(--text)' }}>{uid}</span>
                      <span className="text-[10px] font-mono w-12 text-right" style={{ color: 'var(--cyan)' }}>{u.call_count}</span>
                      <span className="text-[10px] font-mono w-20 text-right" style={{ color: 'var(--text-d)' }}>
                        {(u.input_tokens + u.output_tokens).toLocaleString()}
                      </span>
                      <span className="text-[10px] font-mono w-16 text-right font-bold" style={{ color: 'var(--gold-b)' }}>
                        ${u.total_cost.toFixed(4)}
                      </span>
                    </div>
                  ))}
                  {/* Totals row */}
                  <div className="flex items-center gap-3 py-2 px-3 mt-1 rounded-lg"
                    style={{ background: 'rgba(201,162,39,0.05)', borderTop: '1px solid rgba(201,162,39,0.1)' }}>
                    <span className="text-[10px] flex-1 font-bold tracking-[1px] uppercase" style={{ color: 'var(--gold)' }}>Total</span>
                    <span className="text-[10px] font-mono w-12 text-right font-bold" style={{ color: 'var(--cyan)' }}>
                      {rvUsage.totals.call_count}
                    </span>
                    <span className="text-[10px] font-mono w-20 text-right font-bold" style={{ color: 'var(--text)' }}>
                      {(rvUsage.totals.input_tokens + rvUsage.totals.output_tokens).toLocaleString()}
                    </span>
                    <span className="text-[10px] font-mono w-16 text-right font-bold" style={{ color: 'var(--gold)' }}>
                      ${rvUsage.totals.total_cost.toFixed(4)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-[11px]" style={{ color: 'var(--text-d)' }}>No receipt processing data yet</div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Activity Timeline — Right col */}
        <div className="space-y-3">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <span className="text-[10px] tracking-[2px] uppercase font-bold" style={{ color: 'var(--gold-d)' }}>
              Activity Timeline
            </span>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="rounded-2xl overflow-hidden" style={{ ...glass, maxHeight: 'calc(100vh - 280px)' }}>
            <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
              {activity.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-sm" style={{ color: 'var(--text-d)' }}>Watching for activity...</div>
                  <div className="text-[10px] mt-1" style={{ color: 'var(--text-d)' }}>Events appear in real-time</div>
                </div>
              ) : (
                <AnimatePresence>
                  <div className="space-y-1.5">
                    {activity.map((entry) => (
                      <motion.div key={entry.id}
                        initial={{ opacity: 0, x: -20, height: 0 }}
                        animate={{ opacity: 1, x: 0, height: 'auto' }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2.5 py-2 px-3 rounded-lg"
                        style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <span className="text-sm shrink-0">{entry.icon}</span>
                        <span className="text-[10px] flex-1 leading-tight" style={{ color: 'var(--text)' }}>{entry.text}</span>
                        <span className="text-[8px] font-mono shrink-0" style={{ color: 'var(--text-d)' }}>{entry.time}</span>
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: entry.color }} />
                      </motion.div>
                    ))}
                  </div>
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

/* ─── Helpers ─── */
function StatusDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <motion.div animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      <span className="text-[9px] uppercase tracking-wider" style={{ color }}>{label}</span>
    </div>
  )
}

function getHealthColor(value?: number): string {
  if (value == null) return 'var(--text-d)'
  if (value < 50) return '#4db848'
  if (value < 80) return '#e8c04a'
  return '#c0281e'
}
