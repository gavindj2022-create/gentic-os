import { useEffect, useState, useCallback } from 'react'
import { motion } from 'motion/react'
import { Send, Mail, MessageSquare, Rocket, DollarSign, Users, Power, Settings2, RefreshCw, Bot, ShieldCheck } from 'lucide-react'
import GlassCard, { GlassPopout } from '../components/GlassCard'
import { api } from '../lib/api'
import { useWebSocket } from '../hooks/useWebSocket'

interface OutboundKpis {
  leads_total: number; contacted: number; sends_today: number; sends_total: number
  replies: number; reply_rate: number; positive: number; pilots: number
  paying: number; mrr: number; opted_out: number
}
interface OutboundStats {
  configured: boolean; error: string | null; last_poll: string | null
  sender_active: boolean | null; kpis: OutboundKpis
  by_status: Record<string, number>
  daily_series: { date: string; sends: number; replies: number }[]
  touches: Record<string, number>
  recent_sends: Record<string, string>[]
  recent_replies: Record<string, string>[]
  invoices: Record<string, string>[]
}
interface PipelineLead {
  lead_id: string; business: string; city: string; email: string
  touch_stage: string; last_sent: string
}
interface OutboundAgent {
  name: string; role: string; category: string; human_in_loop: boolean
  status: string; last_action: string; awaiting_review: number
}

const GOLD = '#c9a227'
const CYAN = '#00c8c8'
const TRACKS: { key: string; label: string; tagline: string }[] = [
  { key: 'all', label: 'All', tagline: 'Both offers across every niche' },
  { key: 'receptionists', label: 'Receptionists', tagline: 'Bella AI receptionist · free pilot → $147/mo' },
  { key: 'websites', label: 'Websites', tagline: 'Done-for-you site builds · free mockup first' },
]
const CAT_COLOR: Record<string, string> = {
  security: '#e24b4a', revenue: '#6bbf59', expansion: '#5b9bd5',
  improvement: CYAN, general: '#8a8a8a',
}
const STAGE_META: { key: string; label: string; color: string }[] = [
  { key: 'queued', label: 'Queued', color: '#8a8a8a' },
  { key: 'in_sequence', label: 'Contacted', color: '#5b9bd5' },
  { key: 'replied', label: 'Replied', color: GOLD },
  { key: 'pilot', label: 'Pilot', color: CYAN },
  { key: 'paying', label: 'Paying', color: '#6bbf59' },
]

function Kpi({ icon: Icon, label, value, sub, color, delay }: {
  icon: typeof Mail; label: string; value: string | number; sub?: string; color: string; delay: number
}) {
  return (
    <GlassCard delay={delay} glow={`${color}22`}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${color}1a`, border: `1px solid ${color}44` }}>
          <Icon size={16} style={{ color }} />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[2px]" style={{ color: 'var(--text-d)' }}>{label}</div>
          <div className="text-xl font-bold leading-tight" style={{ color: 'var(--text)' }}>{value}</div>
          {sub && <div className="text-[10px]" style={{ color: 'var(--text-d)' }}>{sub}</div>}
        </div>
      </div>
    </GlassCard>
  )
}

function Sparkline({ series }: { series: OutboundStats['daily_series'] }) {
  const data = series.slice(-14)
  const max = Math.max(1, ...data.map(d => d.sends))
  const W = 100 / Math.max(1, data.length)
  return (
    <svg viewBox="0 0 100 40" className="w-full h-24" preserveAspectRatio="none">
      {data.map((d, i) => (
        <g key={d.date}>
          <rect x={i * W + W * 0.15} y={40 - (d.sends / max) * 36} width={W * 0.45} height={(d.sends / max) * 36}
            rx="0.8" fill={GOLD} opacity="0.85" />
          <rect x={i * W + W * 0.62} y={40 - (d.replies / max) * 36} width={W * 0.25} height={Math.max(0.5, (d.replies / max) * 36)}
            rx="0.8" fill={CYAN} opacity="0.95" />
        </g>
      ))}
    </svg>
  )
}

export default function Outbound() {
  const [stats, setStats] = useState<OutboundStats | null>(null)
  const [pipeline, setPipeline] = useState<Record<string, PipelineLead[]>>({})
  const [agents, setAgents] = useState<OutboundAgent[]>([])
  const [track, setTrack] = useState('all')
  const [configOpen, setConfigOpen] = useState(false)
  const [killBusy, setKillBusy] = useState(false)
  const [cfg, setCfg] = useState({ sheet_id: '', n8n_url: 'https://gavvro.app.n8n.cloud', n8n_api_key: '' })
  const { on } = useWebSocket()

  const load = useCallback(() => {
    api.outboundStats(track).then((d: unknown) => setStats(d as OutboundStats)).catch(() => {})
    api.outboundPipeline(track).then((d: unknown) => setPipeline((d as { stages: Record<string, PipelineLead[]> }).stages || {})).catch(() => {})
    api.outboundAgents().then((d: unknown) => setAgents((d as { agents: OutboundAgent[] }).agents || [])).catch(() => {})
  }, [track])

  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    const off = on('outbound_update', () => load())
    return () => { clearInterval(t); off?.() }
  }, [load, on])

  const toggleKill = async () => {
    if (!stats || killBusy) return
    setKillBusy(true)
    try { await api.outboundKillswitch(!(stats.sender_active ?? false)); load() }
    finally { setKillBusy(false) }
  }

  const saveCfg = async () => {
    await api.saveOutboundConfig(cfg)
    setConfigOpen(false)
    load()
  }

  const k = stats?.kpis
  const active = stats?.sender_active

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-[4px] uppercase" style={{ color: GOLD }}>Outbound</h1>
          <p className="text-xs" style={{ color: 'var(--text-d)' }}>
            {TRACKS.find(t => t.key === track)?.tagline}
            {stats?.last_poll && <span> · synced {stats.last_poll.slice(11, 16)}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setConfigOpen(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all hover:scale-105"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,162,39,0.15)', color: 'var(--text-d)' }}>
            <Settings2 size={15} />
          </button>
          <motion.button whileTap={{ scale: 0.96 }} onClick={toggleKill} disabled={killBusy || active === null}
            className="flex items-center gap-2 px-4 h-9 rounded-xl text-xs font-bold uppercase tracking-[2px] cursor-pointer transition-all"
            style={active
              ? { background: 'rgba(0,200,200,0.12)', border: `1px solid ${CYAN}66`, color: CYAN, boxShadow: `0 0 18px ${CYAN}33` }
              : { background: 'rgba(226,75,74,0.12)', border: '1px solid rgba(226,75,74,0.5)', color: '#e24b4a' }}>
            <Power size={14} className={killBusy ? 'animate-spin' : ''} />
            {active === null ? 'n8n offline' : active ? 'Sender live — kill' : 'Sender killed — arm'}
          </motion.button>
        </div>
      </div>

      {/* Track toggle */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl w-fit"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,162,39,0.12)' }}>
        {TRACKS.map(t => (
          <button key={t.key} onClick={() => setTrack(t.key)}
            className="px-3.5 h-8 rounded-lg text-[11px] font-bold uppercase tracking-[2px] cursor-pointer transition-all"
            style={track === t.key
              ? { background: 'rgba(201,162,39,0.16)', border: `1px solid ${GOLD}55`, color: GOLD }
              : { background: 'transparent', border: '1px solid transparent', color: 'var(--text-d)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Unconfigured / error state */}
      {stats && !stats.configured && (
        <GlassCard glow="rgba(201,162,39,0.15)">
          <div className="flex items-center gap-3">
            <RefreshCw size={16} style={{ color: GOLD }} />
            <div className="text-sm" style={{ color: 'var(--text)' }}>
              Tracker not connected yet — hit the gear and paste the Google Sheet ID once Gav converts the tracker.
              <span className="block text-xs mt-1" style={{ color: 'var(--text-d)' }}>{stats.error}</span>
            </div>
          </div>
        </GlassCard>
      )}

      {/* KPI hero */}
      {k && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <Kpi icon={Send} label="Sent today" value={k.sends_today} sub={`${k.sends_total} total`} color={GOLD} delay={0} />
          <Kpi icon={Users} label="Leads" value={k.leads_total} sub={`${k.contacted} contacted`} color="#5b9bd5" delay={0.05} />
          <Kpi icon={MessageSquare} label="Replies" value={k.replies} sub={`${k.reply_rate}% rate`} color={CYAN} delay={0.1} />
          <Kpi icon={Mail} label="Positive" value={k.positive} sub={`${k.opted_out} opt-outs`} color="#9fe1cb" delay={0.15} />
          <Kpi icon={Rocket} label="Pilots" value={k.pilots} sub="free trials live" color={CYAN} delay={0.2} />
          <Kpi icon={DollarSign} label="MRR" value={`$${k.mrr}`} sub={`${k.paying} paying`} color="#6bbf59" delay={0.25} />
        </div>
      )}

      {/* Pipeline kanban */}
      <GlassCard delay={0.3} noPad>
        <div className="p-5 pb-3">
          <h2 className="text-xs font-bold tracking-[3px] uppercase" style={{ color: GOLD }}>Pipeline</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-px px-3 pb-4">
          {STAGE_META.map(s => (
            <div key={s.key} className="px-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-[2px]" style={{ color: s.color }}>{s.label}</span>
                <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>{(pipeline[s.key] || []).length}</span>
              </div>
              <div className="space-y-1.5 max-h-56 overflow-auto pr-1">
                {(pipeline[s.key] || []).slice(0, 30).map(l => (
                  <div key={l.lead_id || l.business} className="rounded-lg px-2.5 py-1.5"
                    style={{ background: 'rgba(255,255,255,0.03)', borderLeft: `2px solid ${s.color}` }}>
                    <div className="text-[11px] font-medium truncate" style={{ color: 'var(--text)' }}>{l.business}</div>
                    <div className="text-[9px] truncate" style={{ color: 'var(--text-d)' }}>
                      {l.city}{l.touch_stage && Number(l.touch_stage) <= 3 ? ` · touch ${l.touch_stage}/3` : ''}
                    </div>
                  </div>
                ))}
                {!(pipeline[s.key] || []).length && (
                  <div className="text-[10px] py-3 text-center" style={{ color: 'var(--text-d)' }}>—</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Daily activity */}
        <GlassCard delay={0.35}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold tracking-[3px] uppercase" style={{ color: GOLD }}>Daily sends & replies</h2>
            <div className="flex items-center gap-3 text-[9px]" style={{ color: 'var(--text-d)' }}>
              <span><span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ background: GOLD }} />sends</span>
              <span><span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ background: CYAN }} />replies</span>
            </div>
          </div>
          {stats?.daily_series.length
            ? <Sparkline series={stats.daily_series} />
            : <div className="h-24 flex items-center justify-center text-xs" style={{ color: 'var(--text-d)' }}>No sends yet — the machine is warming up</div>}
          {/* Touch performance */}
          {stats && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(['1', '2', '3'] as const).map(t => (
                <div key={t} className="rounded-lg px-3 py-2 text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div className="text-[9px] uppercase tracking-[2px]" style={{ color: 'var(--text-d)' }}>Touch {t}</div>
                  <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>{stats.touches[t] ?? 0}</div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Activity feed */}
        <GlassCard delay={0.4}>
          <h2 className="text-xs font-bold tracking-[3px] uppercase mb-3" style={{ color: GOLD }}>Live feed</h2>
          <div className="space-y-2 max-h-64 overflow-auto pr-1">
            {(stats?.recent_replies || []).map((r, i) => (
              <div key={`r${i}`} className="flex items-start gap-2.5">
                <MessageSquare size={12} className="mt-0.5 shrink-0" style={{ color: r.sentiment === 'positive' ? '#6bbf59' : r.sentiment === 'optout' ? '#e24b4a' : CYAN }} />
                <div className="min-w-0">
                  <span className="text-[11px] font-medium" style={{ color: 'var(--text)' }}>{r.business}</span>
                  <span className="text-[10px] ml-1.5" style={{ color: 'var(--text-d)' }}>replied ({r.sentiment})</span>
                  <div className="text-[10px] truncate" style={{ color: 'var(--text-d)' }}>{r.snippet}</div>
                </div>
              </div>
            ))}
            {(stats?.recent_sends || []).map((s, i) => (
              <div key={`s${i}`} className="flex items-center gap-2.5">
                <Send size={11} className="shrink-0" style={{ color: GOLD }} />
                <span className="text-[11px] truncate" style={{ color: 'var(--text)' }}>{s.business}</span>
                <span className="text-[10px] shrink-0" style={{ color: 'var(--text-d)' }}>touch {s.touch} · {String(s.timestamp || '').slice(11, 16)}</span>
              </div>
            ))}
            {!stats?.recent_sends?.length && !stats?.recent_replies?.length && (
              <div className="text-xs py-6 text-center" style={{ color: 'var(--text-d)' }}>Nothing yet — feed lights up when sending starts</div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Agent team */}
      {!!agents.length && (
        <GlassCard delay={0.42} noPad>
          <div className="p-5 pb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold tracking-[3px] uppercase flex items-center gap-2" style={{ color: GOLD }}>
              <Bot size={13} /> Agent team
            </h2>
            {agents.reduce((n, a) => n + (a.awaiting_review || 0), 0) > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                style={{ background: 'rgba(201,162,39,0.15)', color: GOLD }}>
                {agents.reduce((n, a) => n + (a.awaiting_review || 0), 0)} awaiting Gav
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 px-4 pb-4">
            {agents.map((a, i) => {
              const c = CAT_COLOR[a.category] || '#8a8a8a'
              const working = a.status === 'working'
              const blocked = a.status === 'blocked'
              return (
                <motion.div key={a.name} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * i }} className="rounded-xl px-3 py-2.5"
                  style={{ background: 'rgba(255,255,255,0.03)', borderLeft: `2px solid ${blocked ? '#e24b4a' : c}` }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
                      {a.category === 'security' && <ShieldCheck size={11} style={{ color: c }} />}
                      {a.name}
                      {a.human_in_loop && <span className="text-[8px] px-1 py-px rounded"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-d)' }}>review</span>}
                    </span>
                    <span className="flex items-center gap-1 text-[9px] uppercase tracking-[1px]"
                      style={{ color: blocked ? '#e24b4a' : working ? CYAN : 'var(--text-d)' }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: blocked ? '#e24b4a' : working ? CYAN : '#555' }} />
                      {a.status}
                    </span>
                  </div>
                  <div className="text-[10px] mt-1 truncate" style={{ color: 'var(--text-d)' }}>
                    {a.last_action || a.role}
                  </div>
                  {a.awaiting_review > 0 && (
                    <div className="text-[9px] mt-1 font-bold" style={{ color: GOLD }}>{a.awaiting_review} awaiting review</div>
                  )}
                </motion.div>
              )
            })}
          </div>
        </GlassCard>
      )}

      {/* Invoices strip */}
      {!!stats?.invoices?.length && (
        <GlassCard delay={0.45} glow="rgba(107,191,89,0.12)">
          <h2 className="text-xs font-bold tracking-[3px] uppercase mb-3" style={{ color: '#6bbf59' }}>Invoices</h2>
          <div className="space-y-1.5">
            {stats.invoices.map((inv, i) => (
              <div key={i} className="flex items-center justify-between text-[11px]">
                <span style={{ color: 'var(--text)' }}>{inv.client} — {inv.item}</span>
                <span className="font-bold" style={{ color: inv.status === 'paid' ? '#6bbf59' : GOLD }}>${inv.amount} · {inv.status}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Config popout */}
      <GlassPopout open={configOpen} onClose={() => setConfigOpen(false)} title="Outbound Config">
        <div className="space-y-3">
          {([
            ['Google Sheet ID (from tracker URL)', 'sheet_id'],
            ['n8n base URL', 'n8n_url'],
            ['n8n API key', 'n8n_api_key'],
          ] as const).map(([label, key]) => (
            <div key={key}>
              <label className="text-[10px] uppercase tracking-[2px] block mb-1" style={{ color: 'var(--text-d)' }}>{label}</label>
              <input value={cfg[key]} onChange={e => setCfg({ ...cfg, [key]: e.target.value })}
                type={key === 'n8n_api_key' ? 'password' : 'text'}
                className="w-full rounded-lg px-3 py-2 text-xs outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(201,162,39,0.2)', color: 'var(--text)' }} />
            </div>
          ))}
          <button onClick={saveCfg}
            className="w-full py-2 rounded-lg text-xs font-bold uppercase tracking-[2px] cursor-pointer transition-all hover:scale-[1.01]"
            style={{ background: 'rgba(201,162,39,0.15)', border: `1px solid ${GOLD}55`, color: GOLD }}>
            Save & sync
          </button>
        </div>
      </GlassPopout>
    </div>
  )
}
