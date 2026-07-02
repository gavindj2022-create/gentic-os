import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Hammer } from 'lucide-react'
import { api } from '../lib/api'
import type { SystemStatus, FearData, TokenData, ClaudeSession } from '../lib/types'
import { useWebSocket } from '../hooks/useWebSocket'
import AgentFace from '../components/AgentFace'
import FearGauge from '../components/FearGauge'
import { motion, AnimatePresence } from 'motion/react'

// ─── Glass style constants ───────────────────────────────────────────────
const glass = {
  background: 'rgba(13, 13, 13, 0.6)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(201,162,39,0.12)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 0 30px rgba(0,0,0,0.3)',
  borderRadius: '16px',
} as const

const popoutGlass = {
  background: 'rgba(13,13,13,0.9)',
  backdropFilter: 'blur(30px)',
  border: '1px solid rgba(201,162,39,0.2)',
  boxShadow: '0 0 60px rgba(201,162,39,0.12), 0 25px 50px rgba(0,0,0,0.5)',
  borderRadius: '20px',
} as const

function sessionBadge(s: ClaudeSession): { badge: string; badgeColor: string } {
  if (s.mode === 'planner') return { badge: '🧠 PLANNER', badgeColor: '#8b5cf6' }
  return { badge: '🔨 BUILDER', badgeColor: '#00d4ff' }
}

function sessionStatusStyle(s: ClaudeSession): { status: string; statusColor: string } {
  if (s.status === 'active') return { status: 'ACTIVE', statusColor: '#4db848' }
  if (s.status === 'thinking') return { status: 'THINKING', statusColor: '#8b5cf6' }
  return { status: 'IDLE', statusColor: '#666' }
}

// ═══════════════════════════════════════════════════════════════════════════
export default function CommandCenter() {
  const [system, setSystem] = useState<SystemStatus | null>(null)
  const [fear, setFear] = useState<FearData | null>(null)
  const [tokens, setTokens] = useState<TokenData | null>(null)
  const [sessions, setSessions] = useState<ClaudeSession[]>([])
  const [cmdInput, setCmdInput] = useState('')
  const [cmdStatus, setCmdStatus] = useState('')
  const [popout, setPopout] = useState<string | null>(null)
  const { on } = useWebSocket()

  const load = useCallback(async () => {
    const [sys, f, t, cs] = await Promise.all([
      api.system().catch(() => null),
      api.fear().catch(() => null),
      api.tokens().catch(() => null),
      api.claudeSessions().catch(() => null),
    ])
    if (sys) setSystem(sys as SystemStatus)
    if (f) setFear(f as FearData)
    if (t) setTokens(t as TokenData)
    if (cs) setSessions((cs as any).sessions || [])
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    return on('status_update', (data) => {
      setSystem(prev => prev ? {
        ...prev,
        olivia: { ...prev.olivia, ...(data as Record<string, unknown>), online: (data as Record<string, unknown>).system === 'online' }
      } : prev)
    })
  }, [on])
  useEffect(() => {
    return on('claude_sessions', (data: any) => {
      setSessions(data.sessions || [])
    })
  }, [on])

  const sendCmd = async (cmd: string) => {
    setCmdStatus(cmd)
    try { await api.sendCommand(cmd) } catch {}
    setTimeout(() => setCmdStatus(''), 3000)
  }

  const ais = system?.olivia?.available_ais || {}
  const agents = system?.olivia?.active_subagents || []
  const building = sessions.find(s => s.is_building) || sessions.find(s => s.status !== 'idle')

  return (
    <div className="space-y-5 pb-8">

      {/* ═══ TOP: 4 Hero Stat Cards ═══ */}
      <div className="grid grid-cols-4 gap-4">
        <HeroCard
          label="Conversations"
          value={system?.olivia?.conversation_count ?? 0}
          color="var(--cyan)"
          delay={0}
          onClick={() => setPopout('activity')}
        />
        <HeroCard
          label="Jobs Complete"
          value={tokens?.today?.calls ?? 0}
          color="var(--gold-b)"
          delay={0.05}
          onClick={() => setPopout('tokens')}
        />
        <HeroCard
          label="Fear Score"
          value={fear?.fear_score ?? '--'}
          color={getFearColor(fear?.fear_score)}
          delay={0.1}
          onClick={() => setPopout('fear')}
        />
        <HeroCard
          label="Active Agents"
          value={agents.length}
          color="var(--green-t)"
          delay={0.15}
          onClick={() => setPopout('agents')}
        />
      </div>

      {/* ═══ MIDDLE ROW ═══ */}
      <div className="grid grid-cols-3 gap-5">

        {/* ─── Left: Claude Code Sessions (col-span-2) ─── */}
        <motion.div
          className="col-span-2 p-6"
          style={glass}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <span className="text-[10px] tracking-[3px] uppercase font-bold" style={{ color: 'var(--gold-d)' }}>
              Claude Code Sessions
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(77,184,72,0.12)', color: '#4db848', border: '1px solid rgba(77,184,72,0.2)' }}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#4db848' }} />
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: '#4db848' }} />
              </span>
              LIVE
            </span>
          </div>

          {/* Now Building strip → links to Build Monitor */}
          {building && (
            <Link to="/build">
              <motion.div
                className="flex items-center gap-3 p-3 rounded-xl mb-4 cursor-pointer"
                style={{ background: 'rgba(201,162,39,0.06)', border: '1px solid rgba(201,162,39,0.18)' }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.01 }}
              >
                <motion.span
                  animate={building.is_building ? { rotate: [0, -20, 20, 0] } : {}}
                  transition={{ duration: 0.8, repeat: Infinity }}
                >
                  <Hammer size={16} style={{ color: 'var(--gold)' }} />
                </motion.span>
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] tracking-[2px] uppercase" style={{ color: 'var(--gold-d)' }}>Now Building</div>
                  <div className="text-[11px] truncate" style={{ color: 'var(--text-b)' }}>
                    {building.current_action || building.status} · {building.project}
                  </div>
                </div>
                <span className="text-[10px] font-bold whitespace-nowrap" style={{ color: 'var(--gold)' }}>Open Build →</span>
              </motion.div>
            </Link>
          )}

          {/* Session Cards */}
          <div className="space-y-3 mb-5">
            {sessions.length === 0 ? (
              <div className="p-6 rounded-xl text-center" style={{ background: 'rgba(20,20,20,0.5)' }}>
                <div className="text-[11px]" style={{ color: 'var(--text-d)' }}>No active Claude Code sessions</div>
              </div>
            ) : sessions.map((session, i) => {
              const { badge, badgeColor } = sessionBadge(session)
              const { status, statusColor } = sessionStatusStyle(session)
              return (
                <motion.div
                  key={session.id}
                  className="p-4 rounded-xl"
                  style={{
                    background: 'rgba(20,20,20,0.7)',
                    border: `1px solid ${badgeColor}18`,
                  }}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-b)' }}>{session.name}</span>
                      <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full"
                        style={{ background: `${badgeColor}18`, color: badgeColor, border: `1px solid ${badgeColor}30` }}>
                        {badge}
                      </span>
                    </div>
                    <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full"
                      style={{ background: `${statusColor}15`, color: statusColor }}>
                      {status}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden mb-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: badgeColor }}
                      initial={{ width: 0 }}
                      animate={{ width: `${session.progress}%` }}
                      transition={{ delay: 0.5 + i * 0.1, duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono" style={{ color: 'var(--text-d)' }}>{session.progress}%</span>
                    {session.duration && (
                      <span className="text-[9px] font-mono ml-1" style={{ color: 'var(--text-d)' }}>{session.duration}</span>
                    )}
                    <div className="flex gap-1.5 ml-2">
                      {(session.files || []).map(f => (
                        <span key={f} className="text-[9px] font-mono px-2 py-0.5 rounded"
                          style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-d)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Session Flow */}
          <motion.div
            className="p-4 rounded-xl"
            style={{ background: 'rgba(20,20,20,0.5)', border: '1px solid rgba(201,162,39,0.08)' }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="text-[9px] tracking-[2px] uppercase font-bold mb-4" style={{ color: 'var(--text-d)' }}>
              Session Flow
            </div>
            <div className="flex items-center justify-between gap-2">
              {[
                { label: 'PLANNER', agent: 'gemini' },
                { label: 'plan.md', agent: null },
                { label: 'BUILDER', agent: 'claude' },
                { label: 'verify', agent: null },
                { label: 'VERIFIER', agent: 'sentinel' },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  {step.agent ? (
                    <div className="flex flex-col items-center gap-1">
                      <AgentFace name={step.agent} size={32} active />
                      <span className="text-[8px] tracking-wider uppercase font-bold"
                        style={{ color: step.label === 'PLANNER' ? '#8b5cf6' : step.label === 'BUILDER' ? '#00d4ff' : '#c0281e' }}>
                        {step.label}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[9px] font-mono px-2 py-1 rounded"
                      style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-d)' }}>
                      {step.label}
                    </span>
                  )}
                  {i < 4 && (
                    <motion.span
                      className="text-sm font-mono"
                      style={{ color: 'var(--gold-d)' }}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                    >
                      →
                    </motion.span>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>

        {/* ─── Right column ─── */}
        <div className="col-span-1 space-y-5">

          {/* Core AI Fleet */}
          <motion.div
            className="p-5"
            style={glass}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <div className="text-[10px] tracking-[3px] uppercase font-bold mb-4" style={{ color: 'var(--gold-d)' }}>
              Core AI Fleet
            </div>
            <div className="grid grid-cols-2 gap-4">
              {(['claude', 'chatgpt', 'gemini', 'ollama'] as const).map((ai) => (
                <motion.div
                  key={ai}
                  className="flex flex-col items-center gap-2 py-3 rounded-xl cursor-pointer"
                  style={{ background: 'rgba(20,20,20,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}
                  whileHover={{ scale: 1.015, y: -1 }}
                  onClick={() => setPopout('agents')}
                >
                  <AgentFace name={ai} size={44} active={!!ais[ai]} />
                  <span className="text-[9px] tracking-[1px] uppercase font-bold"
                    style={{ color: ais[ai] ? 'var(--text-b)' : 'var(--text-d)' }}>
                    {ai}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Activity Feed */}
          <motion.div
            className="p-5"
            style={glass}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="text-[10px] tracking-[3px] uppercase font-bold mb-4" style={{ color: 'var(--gold-d)' }}>
              Activity Feed
            </div>
            <div className="space-y-2.5">
              {(system?.olivia?.recent_exchanges || []).length === 0 ? (
                <div className="px-3 py-4 text-center text-[10px]" style={{ color: 'var(--text-d)' }}>No recent activity</div>
              ) : (system?.olivia?.recent_exchanges || []).slice(0, 8).map((ex, i) => (
                <motion.div
                  key={i}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg"
                  style={{ background: 'rgba(20,20,20,0.4)' }}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.05 }}
                >
                  <AgentFace name={ex.role === 'olivia' ? 'olivia' : 'alfred'} size={22} />
                  <span className="text-[11px] flex-1 leading-snug truncate" style={{ color: 'var(--text-b)' }}>{ex.text}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[9px] font-mono" style={{ color: 'var(--text-d)' }}>{ex.time || ''}</span>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: ex.role === 'olivia' ? '#00c8c8' : '#c9a227' }} />
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ═══ BOTTOM: Quick Actions ═══ */}
      <motion.div
        className="p-6"
        style={glass}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="text-[10px] tracking-[3px] uppercase font-bold mb-4" style={{ color: 'var(--gold-d)' }}>
          Quick Actions
        </div>
        <div className="flex gap-2.5 mb-4">
          {[
            { cmd: 'morning brief', icon: '☀', label: 'Brief' },
            { cmd: 'daily plan', icon: '📋', label: 'Plan' },
            { cmd: 'olivia status', icon: '📡', label: 'Status' },
            { cmd: 'weekly synthesis', icon: '🧬', label: 'Synthesis' },
            { cmd: 'build knowledge', icon: '🧠', label: 'Knowledge' },
            { cmd: 'wellbeing check', icon: '💚', label: 'Wellbeing' },
            { cmd: 'wind down', icon: '🌙', label: 'Wind Down' },
            { cmd: 'olivia search', icon: '🔍', label: 'Search' },
          ].map((a) => (
            <motion.button
              key={a.cmd}
              onClick={() => sendCmd(a.cmd)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-xl cursor-pointer"
              style={{
                background: cmdStatus === a.cmd ? 'rgba(201,162,39,0.25)' : 'rgba(20,20,20,0.5)',
                border: `1px solid ${cmdStatus === a.cmd ? 'rgba(201,162,39,0.4)' : 'rgba(255,255,255,0.05)'}`,
                transition: 'background 0.2s, border 0.2s',
              }}
              whileTap={{ scale: 0.985 }}
              whileHover={{ scale: 1.015, y: -1 }}
            >
              <span className="text-base">{a.icon}</span>
              <span className="text-[11px] font-semibold"
                style={{ color: cmdStatus === a.cmd ? 'var(--gold)' : 'var(--text-b)' }}>
                {a.label}
              </span>
            </motion.button>
          ))}
        </div>
        {/* Command input */}
        <div className="flex gap-3">
          <input
            value={cmdInput}
            onChange={e => setCmdInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && cmdInput.trim()) { sendCmd(cmdInput.trim()); setCmdInput('') } }}
            placeholder="Custom command..."
            className="flex-1 px-4 py-3 rounded-xl text-xs outline-none"
            style={{
              background: 'rgba(20,20,20,0.6)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: 'var(--text-b)',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'rgba(201,162,39,0.3)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}
          />
          <motion.button
            onClick={() => { if (cmdInput.trim()) { sendCmd(cmdInput.trim()); setCmdInput('') } }}
            className="px-6 py-3 rounded-xl text-xs font-bold tracking-wider cursor-pointer"
            style={{ background: 'var(--gold)', color: '#000' }}
            whileTap={{ scale: 0.985 }}
            whileHover={{ scale: 1.03 }}
          >
            GO
          </motion.button>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ═══ POPOUTS (AnimatePresence) ════════════════════════════════════ */}
      {/* ═══════════════════════════════════════════════════════════════════ */}

      <AnimatePresence>
        {popout && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPopout(null)}
            />

            {/* Popout Panel */}
            <motion.div
              className="fixed z-50 p-8 overflow-y-auto"
              style={{
                ...popoutGlass,
                top: '50%',
                left: '50%',
                x: '-50%',
                y: '-50%',
                width: popout === 'activity' ? 600 : 540,
                maxHeight: '80vh',
              }}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              {/* Close button */}
              <button
                onClick={() => setPopout(null)}
                className="absolute top-4 right-5 text-xl cursor-pointer"
                style={{ color: 'var(--text-d)', lineHeight: 1 }}
              >
                ×
              </button>

              {/* ─── Activity Popout ─── */}
              {popout === 'activity' && (
                <>
                  <div className="text-[10px] tracking-[3px] uppercase font-bold mb-5" style={{ color: 'var(--gold)' }}>
                    Recent Activity
                  </div>
                  <div className="flex flex-col gap-1">
                    {(system?.olivia?.recent_exchanges || []).map((ex, i) => (
                      <div key={i} className="flex gap-3 py-2.5 rounded-lg px-3"
                        style={{ background: i % 2 === 0 ? 'rgba(20,20,20,0.5)' : 'transparent' }}>
                        <AgentFace name={ex.role === 'olivia' ? 'olivia' : 'alfred'} size={28} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-bold uppercase tracking-wide mb-0.5"
                            style={{ color: ex.role === 'olivia' ? 'var(--cyan)' : 'var(--gold)' }}>
                            {ex.role === 'olivia' ? 'OLIVIA' : 'GAV'}
                          </div>
                          <div className="text-xs leading-relaxed" style={{ color: 'var(--text-b)' }}>{ex.text}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ─── Fear Popout ─── */}
              {popout === 'fear' && (
                <>
                  <div className="text-[10px] tracking-[3px] uppercase font-bold mb-5" style={{ color: 'var(--gold)' }}>
                    Fear & Market Intelligence
                  </div>
                  <FearGauge score={fear?.fear_score ?? 0} level={fear?.fear_level ?? 'Unknown'} />
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <BigStat label="Fear Score" value={String(fear?.fear_score ?? 0)} color={getFearColor(fear?.fear_score)} />
                    <BigStat label="Fraud Score" value={String(fear?.fraud_score ?? 0)} color="var(--red)" />
                    <BigStat label="Trend" value={fear?.trend ?? 'Stable'} color="var(--text-b)" />
                    <BigStat label="Level" value={fear?.fear_level ?? 'Unknown'} color="var(--gold)" />
                  </div>
                  {fear?.recommendation && (
                    <div className="mt-4 p-4 rounded-xl" style={{ background: 'rgba(20,20,20,0.6)', borderLeft: '3px solid var(--gold)' }}>
                      <div className="text-[10px] tracking-[1px] uppercase mb-1" style={{ color: 'var(--gold-d)' }}>Recommendation</div>
                      <div className="text-xs leading-relaxed" style={{ color: 'var(--text-b)' }}>{fear.recommendation}</div>
                    </div>
                  )}
                </>
              )}

              {/* ─── Tokens Popout ─── */}
              {popout === 'tokens' && (
                <>
                  <div className="text-[10px] tracking-[3px] uppercase font-bold mb-5" style={{ color: 'var(--gold)' }}>
                    Token Usage
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <BigStat label="Input" value={formatNum(tokens?.total?.input_tokens)} color="var(--cyan)" />
                    <BigStat label="Output" value={formatNum(tokens?.total?.output_tokens)} color="var(--gold-b)" />
                    <BigStat label="Total Cost" value={`$${(tokens?.total?.cost ?? 0).toFixed(2)}`} color="var(--green-t)" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl p-4" style={{ background: 'rgba(20,20,20,0.5)' }}>
                      <div className="text-[10px] tracking-[1px] uppercase mb-2" style={{ color: 'var(--gold-d)' }}>Today</div>
                      <MiniRow label="Input" value={formatNum(tokens?.today?.input_tokens)} />
                      <MiniRow label="Output" value={formatNum(tokens?.today?.output_tokens)} />
                      <MiniRow label="Calls" value={String(tokens?.today?.calls ?? 0)} />
                      <MiniRow label="Cost" value={`$${(tokens?.today?.cost ?? 0).toFixed(2)}`} />
                    </div>
                    <div className="rounded-xl p-4" style={{ background: 'rgba(20,20,20,0.5)' }}>
                      <div className="text-[10px] tracking-[1px] uppercase mb-2" style={{ color: 'var(--gold-d)' }}>This Week</div>
                      <MiniRow label="Input" value={formatNum(tokens?.week?.input_tokens)} />
                      <MiniRow label="Output" value={formatNum(tokens?.week?.output_tokens)} />
                      <MiniRow label="Cost" value={`$${(tokens?.week?.cost ?? 0).toFixed(2)}`} />
                    </div>
                  </div>
                </>
              )}

              {/* ─── Agents Popout ─── */}
              {popout === 'agents' && (
                <>
                  <div className="text-[10px] tracking-[3px] uppercase font-bold mb-5" style={{ color: 'var(--gold)' }}>
                    Active Agents
                  </div>
                  <div className="text-[10px] tracking-[1px] uppercase mb-3" style={{ color: 'var(--gold-d)' }}>Core AI</div>
                  <div className="flex gap-4 mb-5">
                    {Object.entries(ais).map(([name, online]) => (
                      <div key={name} className="flex flex-col items-center gap-2 flex-1 py-3 rounded-xl"
                        style={{ background: 'rgba(20,20,20,0.5)' }}>
                        <AgentFace name={name} size={48} active={!!online} />
                        <span className="text-[10px] uppercase font-semibold"
                          style={{ color: online ? 'var(--text-b)' : 'var(--text-d)' }}>{name}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] tracking-[1px] uppercase mb-3" style={{ color: 'var(--gold-d)' }}>
                    Sub-Agents ({agents.length})
                  </div>
                  <div className="flex flex-col gap-2">
                    {agents.map((agent, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                        style={{ background: 'rgba(20,20,20,0.5)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <AgentFace name={agent} size={36} active />
                        <span className="text-xs flex-1" style={{ color: 'var(--text-b)' }}>{agent}</span>
                        <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: 'rgba(77,184,72,0.15)', color: 'var(--green-t)' }}>ACTIVE</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper Components
// ═══════════════════════════════════════════════════════════════════════════

function HeroCard({ label, value, color, delay, onClick }: {
  label: string; value: string | number; color: string; delay: number; onClick: () => void
}) {
  return (
    <motion.div
      onClick={onClick}
      className="p-5 cursor-pointer"
      style={glass}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ scale: 1.015, y: -1 }}
    >
      <div className="font-mono text-4xl font-bold mb-1" style={{ color }}>{value}</div>
      <div className="text-[10px] tracking-[2px] uppercase" style={{ color: 'var(--text-d)' }}>{label}</div>
    </motion.div>
  )
}

function BigStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(20,20,20,0.5)' }}>
      <div className="font-mono text-xl font-bold mb-1" style={{ color }}>{value}</div>
      <div className="text-[9px] tracking-[1px] uppercase" style={{ color: 'var(--text-d)' }}>{label}</div>
    </div>
  )
}

function MiniRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center py-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span className="text-[11px]" style={{ color: 'var(--text-d)' }}>{label}</span>
      <span className="font-mono text-[11px] font-semibold" style={{ color: color || 'var(--text-b)' }}>{value}</span>
    </div>
  )
}

function formatNum(n?: number): string {
  if (n == null) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function getFearColor(score?: number): string {
  if (score == null) return 'var(--text-d)'
  if (score < 30) return 'var(--green-t)'
  if (score < 60) return 'var(--gold-b)'
  return 'var(--red)'
}
