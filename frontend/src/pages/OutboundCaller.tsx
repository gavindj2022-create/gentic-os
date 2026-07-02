import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import {
  Activity, Ban, Building2, CalendarCheck2, CheckCircle2, ChevronDown, Clock,
  ClipboardList, Headphones, KeyRound, Link2, MoreVertical, Phone,
  PhoneOff, PhoneOutgoing, Power, Search, Settings2, SlidersHorizontal,
  Star, Users, Voicemail, Waves, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { api } from '../lib/api'
import { useWebSocket } from '../hooks/useWebSocket'
import './OutboundCaller.css'

const GOLD = '#c9a227'
const CYAN = '#00c8c8'
const GREEN = '#4db848'
const RED = '#e24b4a'

interface Lead {
  lead_id: string
  business: string
  lead_name?: string
  city?: string
  fit: number
  website?: string
  phone?: string
  phone_raw?: string
  best_time?: string
  skip_reason?: string
  verify_reason?: string
}

interface Leads {
  callable: Lead[]
  needs_verification: Lead[]
  skipped: Lead[]
  error: string | null
}

interface SheetSync {
  google_sheet_id?: string
  google_sheet_url?: string
  webhook_configured?: boolean
  pending_count?: number
  last_sync_at?: string
}

interface AgentSummary {
  key: string
  label: string
  caller_name: string
  voice_id: string
  from_number: string
  campaign: string
  price: string
  lead_source: string
  configured: boolean
  active: boolean
}

interface CallerStatus {
  campaign: string
  active_agent?: string
  agent_label?: string
  caller_name?: string
  voice_id?: string
  price?: string
  lead_source?: string
  agents?: AgentSummary[]
  kill_switch: boolean
  from_number: string
  demo_owner: string
  agent_configured: boolean
  retell_available: boolean
  has_api_key: boolean
  simulate: boolean
  calling_hours_ok: boolean
  dnc_count?: number
  sheet_sync?: SheetSync
}

interface Spend {
  estimated: boolean
  rate_per_min: number
  total_calls: number
  total_minutes: number
  total_cost: number
  today_calls: number
  today_minutes: number
  today_cost: number
  month_estimate: number
}

// Curated Retell voices for the picker (all real voice_ids).
const VOICES: Array<{ id: string; name: string }> = [
  { id: '11labs-Marissa', name: 'Marissa — warm female' },
  { id: '11labs-Jenny', name: 'Jenny — friendly female' },
  { id: '11labs-Lily', name: 'Lily — young female' },
  { id: '11labs-Merritt', name: 'Merritt — mature female' },
  { id: '11labs-Kate', name: 'Kate — pro female' },
  { id: 'cartesia-Cleo', name: 'Cleo — natural female' },
  { id: '11labs-Adrian', name: 'Adrian — confident male' },
  { id: 'openai-Nova', name: 'Nova — female' },
]

const RETELL_DASHBOARD = 'https://dashboard.retellai.com/'

interface VoiceCall {
  call_id: string
  retell_call_id?: string | null
  campaign?: string
  business?: string
  lead_name?: string
  phone?: string
  status: string
  transcript?: string
  disposition?: string | null
  recording_url?: string | null
  notes?: string
  simulated?: number | boolean
  created_at?: string
  ended_at?: string | null
  demo_booked_at?: string | null
}

interface CallerConfig {
  caller_name: string
  demo_owner: string
  callback_number: string
  from_number: string
  price: string
  google_sheet_id: string
  google_sheet_url: string
  sheet_webhook_url: string
}

const DISPOSITIONS: Array<{ label: string; icon: LucideIcon; tone: string }> = [
  { label: 'Demo booked', icon: CalendarCheck2, tone: GREEN },
  { label: 'Interested', icon: Star, tone: GOLD },
  { label: 'Callback', icon: Clock, tone: CYAN },
  { label: 'Voicemail', icon: Voicemail, tone: CYAN },
  { label: 'Not a fit', icon: Ban, tone: RED },
]

const STATUS_TONE: Record<string, string> = {
  dialing: GOLD,
  live: CYAN,
  ended: GREEN,
  error: RED,
  queued: '#87806d',
}

function Waveform({ small = false }: { small?: boolean }) {
  return (
    <span className={small ? 'caller-wave caller-wave-small' : 'caller-wave'} aria-hidden="true">
      {Array.from({ length: 18 }).map((_, i) => <i key={i} style={{ animationDelay: `${i * 55}ms` }} />)}
    </span>
  )
}

function Stars({ n }: { n: number }) {
  return <span className="caller-stars">{'*'.repeat(Math.max(1, n || 1))}</span>
}

// Backend timestamps are naive UTC (datetime.utcnow().isoformat()); browsers
// would parse them as LOCAL time, inflating a live call's elapsed by the TZ
// offset. Force UTC so the timer is correct.
function parseUTC(s?: string | null): number {
  if (!s) return NaN
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`
  return new Date(iso).getTime()
}

function formatElapsed(call: VoiceCall | null, now: number) {
  if (!call?.created_at) return '00:00'
  const start = parseUTC(call.created_at)
  const ended = call.status === 'ended' || call.status === 'error'
  const end = call.ended_at ? parseUTC(call.ended_at) : (ended ? start : now)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return '00:00'
  // Cap at 60 min so a not-yet-finalized call can never run away.
  const seconds = Math.min(3600, Math.max(0, Math.floor((end - start) / 1000)))
  const mins = String(Math.floor(seconds / 60)).padStart(2, '0')
  const secs = String(seconds % 60).padStart(2, '0')
  return `${mins}:${secs}`
}

// Mirror of the backend normalize_phone — keeps Quick Dial honest before we
// ever hit Retell (which rejects anything that isn't E.164).
function normalizeUS(raw: string): string | null {
  const d = (raw || '').replace(/\D/g, '')
  if (d.length === 10) return `+1${d}`
  if (d.length === 11 && d.startsWith('1')) return `+${d}`
  return null
}

function prettyUS(value: string): string {
  const d = (value || '').replace(/\D/g, '').replace(/^1/, '')
  if (d.length !== 10) return value
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

const AUTO_DIAL_DELAY = 8 // seconds between auto-dialed calls (time to disposition)

function mergeCall(list: VoiceCall[], update: VoiceCall) {
  const idx = list.findIndex(c => c.call_id === update.call_id)
  const next = idx === -1 ? [update, ...list] : list.map(c => c.call_id === update.call_id ? { ...c, ...update } : c)
  return next.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
}

function Transcript({ call }: { call: VoiceCall | null }) {
  const text = call?.transcript?.trim()
  const live = call?.status === 'live' || call?.status === 'dialing'
  if (!text) {
    return (
      <div className="caller-transcript-empty">
        {!call ? 'No transcript' : live ? 'Listening...' : 'Call ended — no transcript'}
      </div>
    )
  }

  return (
    <div className="caller-transcript-lines">
      {text.split(/\n+/).filter(Boolean).map((line, index) => {
        const [speaker, ...rest] = line.split(':')
        const body = rest.length ? rest.join(':').trim() : line
        const name = rest.length ? speaker.trim() : 'Transcript'
        const isAgent = /agent|assistant|alex/i.test(name)
        return (
          <div key={`${index}-${line.slice(0, 12)}`} className="caller-transcript-line">
            <div>
              <div className={isAgent ? 'caller-speaker caller-speaker-agent' : 'caller-speaker caller-speaker-lead'}>
                {isAgent ? 'AI Assistant' : name}
              </div>
              <p>{body}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string | number; tone: string }) {
  return (
    <div className="caller-stat">
      <span className="caller-stat-icon" style={{ color: tone, borderColor: `${tone}55`, background: `${tone}14` }}>
        <Icon size={18} />
      </span>
      <span>
        <strong>{label}</strong>
        <b>{value}</b>
      </span>
    </div>
  )
}

export default function OutboundCaller() {
  const [status, setStatus] = useState<CallerStatus | null>(null)
  const [leads, setLeads] = useState<Leads | null>(null)
  const [calls, setCalls] = useState<VoiceCall[]>([])
  const [spend, setSpend] = useState<Spend | null>(null)
  const [active, setActive] = useState<VoiceCall | null>(null)
  const [callModalOpen, setCallModalOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('next')
  const [dial, setDial] = useState({ name: '', number: '' })
  const [cfg, setCfg] = useState<CallerConfig>({
    caller_name: '',
    demo_owner: '',
    callback_number: '',
    from_number: '',
    price: '',
    google_sheet_id: '',
    google_sheet_url: '',
    sheet_webhook_url: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [syncMessage, setSyncMessage] = useState('')
  const [now, setNow] = useState(Date.now())
  const [autoDial, setAutoDial] = useState(false)
  const [autoCountdown, setAutoCountdown] = useState(0)
  const [notesOpen, setNotesOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [ending, setEnding] = useState(false)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const autoDialRef = useRef(false)
  const dialedSession = useRef<Set<string>>(new Set())
  const dialNextRef = useRef<() => void>(() => {})
  const runCallRef = useRef<(lead: Partial<Lead> & { phone?: string }) => void>(() => {})
  const leadsRef = useRef<Leads | null>(null)
  const { on } = useWebSocket()

  useEffect(() => { autoDialRef.current = autoDial }, [autoDial])
  useEffect(() => { leadsRef.current = leads }, [leads])

  const loadStatus = useCallback(() => {
    api.callerStatus().then(d => setStatus(d as CallerStatus)).catch(() => {})
  }, [])

  const loadCalls = useCallback(() => {
    api.callerCalls(100).then(d => {
      const next = ((d as { calls: VoiceCall[] }).calls || [])
      setCalls(next)
      setActive(prev => prev || next.find(c => c.status === 'live' || c.status === 'dialing') || null)
    }).catch(() => {})
  }, [])

  const loadLeads = useCallback(() => {
    api.callerLeads().then(d => setLeads(d as Leads)).catch(() => {})
  }, [])

  const loadSpend = useCallback(() => {
    api.callerSpend().then(d => setSpend(d as Spend)).catch(() => {})
  }, [])

  useEffect(() => {
    loadStatus()
    loadLeads()
    loadCalls()
    loadSpend()
    api.callerConfig().then(d => {
      const next = d as Partial<CallerConfig>
      setCfg(prev => ({ ...prev, ...next, sheet_webhook_url: '' }))
    }).catch(() => {})
  }, [loadCalls, loadLeads, loadStatus, loadSpend])

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const offCall = on('voice_call_update', raw => {
      const incoming = raw as VoiceCall
      setCalls(prev => mergeCall(prev, incoming))
      setActive(prev => {
        if (!prev || prev.call_id === incoming.call_id || incoming.status === 'dialing' || incoming.status === 'live') {
          return { ...(prev?.call_id === incoming.call_id ? prev : {}), ...incoming }
        }
        return prev
      })
      if (incoming.status === 'dialing' || incoming.status === 'live') setCallModalOpen(true)
      if (incoming.status === 'ended' || incoming.status === 'error') loadSpend()
    })
    const offStatus = on('caller_status', raw => setStatus(raw as CallerStatus))
    const offSheet = on('voice_sheet_sync', () => loadStatus())
    return () => {
      offCall?.()
      offStatus?.()
      offSheet?.()
    }
  }, [loadStatus, loadSpend, on])

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [active?.transcript])

  useEffect(() => {
    setNoteDraft(active?.notes || '')
    setNotesOpen(false)
  }, [active?.call_id])

  const queue = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = (leads?.callable || []).filter(l => !q || l.business.toLowerCase().includes(q) || (l.phone || '').includes(q))
    if (sort === 'name') return [...rows].sort((a, b) => a.business.localeCompare(b.business))
    if (sort === 'fit') return [...rows].sort((a, b) => b.fit - a.fit)
    return rows
  }, [leads?.callable, search, sort])

  const compactQueue = queue.slice(0, 9)
  const sheet = status?.sheet_sync
  const today = new Date().toISOString().slice(0, 10)
  const callsToday = calls.filter(c => (c.created_at || '').slice(0, 10) === today).length
  const booked = calls.filter(c => c.disposition === 'Demo booked' || c.demo_booked_at).length
  const activeCall = active || calls.find(c => c.status === 'live' || c.status === 'dialing') || null
  const callLive = !!activeCall && (activeCall.status === 'live' || activeCall.status === 'dialing')

  const runCall = async (lead: Partial<Lead> & { phone?: string }) => {
    if (busy) return
    setBusy(true)
    setError('')
    setSyncMessage('')
    try {
      const res = await api.placeCall(lead as Record<string, unknown>) as { call_id?: string; error?: string; simulated?: boolean }
      if (res.error) {
        setError(res.error)
        return
      }
      const next: VoiceCall = {
        call_id: res.call_id || crypto.randomUUID(),
        business: lead.business || lead.lead_name || 'Quick dial',
        lead_name: lead.lead_name || lead.business,
        phone: lead.phone,
        status: 'dialing',
        transcript: '',
        simulated: res.simulated,
        created_at: new Date().toISOString(),
      }
      setActive(next)
      setCalls(prev => mergeCall(prev, next))
      setCallModalOpen(true)
    } finally {
      setBusy(false)
    }
  }

  runCallRef.current = runCall

  const dialNormalized = normalizeUS(dial.number)
  const dialInvalid = dial.number.trim() !== '' && !dialNormalized

  const quickDial = () => {
    const e164 = normalizeUS(dial.number)
    if (!e164) {
      setError('Enter a valid 10-digit US phone number.')
      return
    }
    runCall({
      business: dial.name.trim() || 'Quick dial',
      lead_name: dial.name.trim() || 'there',
      city: 'Chicago',
      phone: e164,
    })
    setDial({ name: '', number: '' })
  }

  const endActiveCall = async () => {
    if (!activeCall || ending) return
    setEnding(true)
    try {
      await api.endCall(activeCall.call_id)
      const next = { ...activeCall, status: 'ended', ended_at: new Date().toISOString() }
      setActive(next)
      setCalls(prev => mergeCall(prev, next))
    } catch {
      setError('Could not end the call.')
    } finally {
      setEnding(false)
    }
  }

  const saveNote = async () => {
    if (!activeCall) return
    await api.saveNotes(activeCall.call_id, noteDraft)
    const next = { ...activeCall, notes: noteDraft }
    setActive(next)
    setCalls(prev => mergeCall(prev, next))
    setSyncMessage('Note saved.')
  }

  // ──── Auto-dial the queue ────
  const dialNext = useCallback(() => {
    if (status?.kill_switch) { setAutoDial(false); return }
    const list = leadsRef.current?.callable || []
    const next = list.find(l => !dialedSession.current.has(l.lead_id))
    if (!next) {
      setAutoDial(false)
      setSyncMessage('Auto-dial finished — queue exhausted.')
      return
    }
    dialedSession.current.add(next.lead_id)
    runCallRef.current(next)
  }, [status?.kill_switch])
  dialNextRef.current = dialNext

  const startAutoDial = () => {
    if (status?.kill_switch) { setError('Kill switch is on — turn it off to dial.'); return }
    dialedSession.current = new Set()
    setAutoDial(true)
    const live = activeCall && (activeCall.status === 'live' || activeCall.status === 'dialing')
    if (!live) window.setTimeout(() => dialNextRef.current(), 150)
  }

  const stopAutoDial = () => {
    setAutoDial(false)
    setAutoCountdown(0)
  }

  // Advance to the next lead a few seconds after each auto-dialed call ends.
  useEffect(() => {
    if (!autoDial || !activeCall) return
    if (activeCall.status !== 'ended' && activeCall.status !== 'error') return
    let remaining = AUTO_DIAL_DELAY
    setAutoCountdown(remaining)
    const tick = window.setInterval(() => {
      remaining -= 1
      setAutoCountdown(remaining)
      if (remaining <= 0) window.clearInterval(tick)
    }, 1000)
    const advance = window.setTimeout(() => {
      if (autoDialRef.current) dialNextRef.current()
    }, AUTO_DIAL_DELAY * 1000)
    return () => { window.clearInterval(tick); window.clearTimeout(advance) }
  }, [autoDial, activeCall?.status, activeCall?.call_id])

  const setDisposition = async (label: string) => {
    if (!activeCall) return
    await api.setDisposition(activeCall.call_id, label)
    const next = { ...activeCall, disposition: label }
    setActive(next)
    setCalls(prev => mergeCall(prev, next))
    loadStatus()
  }

  const toggleKill = async () => {
    if (!status) return
    await api.callerKillswitch(!status.kill_switch)
    loadStatus()
  }

  const switchAgent = async (key: string) => {
    if (!key || key === status?.active_agent) return
    stopAutoDial()
    await api.setActiveAgent(key)
    loadStatus()
    loadLeads()
    setSyncMessage('')
  }

  const changeVoice = async (voiceId: string) => {
    if (!status?.active_agent || !voiceId) return
    await api.setAgentVoice(status.active_agent, voiceId)
    loadStatus()
    setSyncMessage('Voice updated.')
  }

  const addToDnc = async (phone?: string) => {
    if (!phone) return
    await api.addDnc(phone)
    setSyncMessage(`${phone} added to Do-Not-Call.`)
    loadStatus()
    loadLeads()
  }

  const saveConfig = async () => {
    const payload: Record<string, unknown> = { ...cfg }
    if (!cfg.sheet_webhook_url.trim()) delete payload.sheet_webhook_url
    const res = await api.saveCallerConfig(payload) as { sheet_sync?: SheetSync }
    setStatus(prev => prev ? { ...prev, sheet_sync: res.sheet_sync || prev.sheet_sync } : prev)
    setConfigOpen(false)
    loadStatus()
  }

  const syncSheet = async () => {
    setSyncMessage('Syncing...')
    const res = await api.syncCallerSheet(200) as { pending_count?: number; flushed?: number; flush?: { flushed?: number; remaining?: number }; reason?: string }
    const flushed = res.flush?.flushed ?? res.flushed ?? 0
    const pending = res.flush?.remaining ?? res.pending_count ?? 0
    setSyncMessage(flushed ? `Synced ${flushed}; pending ${pending}` : `Queued for Sheet writer; pending ${pending}`)
    loadStatus()
  }

  const sheetUrl = sheet?.google_sheet_url || cfg.google_sheet_url
  const isLive = !status?.simulate && !status?.kill_switch
  const modalStatusColor = STATUS_TONE[activeCall?.status || 'queued'] || CYAN

  return (
    <div className="caller-os">
      <header className="caller-top">
        <div className="caller-brand">
          <Waveform small />
          <strong>VOICE CALLER</strong>
          <span className="caller-online"><i /> ONLINE</span>
        </div>
        <div className="caller-top-actions">
          <button className="caller-icon-button" title="Signal"><Activity size={18} /></button>
          <button className="caller-icon-button" title="Settings" onClick={() => setConfigOpen(true)}><Settings2 size={18} /></button>
          <button className={status?.kill_switch ? 'caller-icon-button caller-kill-on' : 'caller-icon-button'} title="Kill switch" onClick={toggleKill}>
            <Power size={18} />
          </button>
          <span className="caller-avatar">G</span>
          <span className="caller-user">Gav</span>
          <button className={status?.kill_switch ? 'caller-live-button caller-live-button-off' : 'caller-live-button'} onClick={() => activeCall && setCallModalOpen(true)}>
            <Waves size={16} />
            {status?.kill_switch ? 'KILLED' : isLive ? 'LIVE' : 'SIM'}
            <ChevronDown size={14} />
          </button>
        </div>
      </header>

      <section className="caller-subhead">
        <span>{status?.agent_label || 'Voice Caller'}</span>
        <b>{status?.simulate ? 'SIM' : 'LIVE'}</b>
        <span>from {status?.from_number || 'not set'}</span>
        <span>demos - {status?.demo_owner || 'Gav'}</span>
        {typeof status?.dnc_count === 'number' && status.dnc_count > 0 && (
          <span>DNC {status.dnc_count}</span>
        )}
        <a className={sheetUrl ? 'caller-sheet-chip' : 'caller-sheet-chip caller-sheet-chip-wait'} href={sheetUrl || undefined} target="_blank" rel="noreferrer">
          <Link2 size={13} />
          {sheetUrl ? (sheet?.webhook_configured ? 'Sheet live' : `Sheet queued ${sheet?.pending_count || 0}`) : 'Sheet missing'}
        </a>
      </section>

      <section className="caller-stats-row">
        <StatCard icon={Users} label="In queue" value={leads?.callable.length ?? '--'} tone={GOLD} />
        <StatCard icon={PhoneOutgoing} label="Calls today" value={callsToday} tone={CYAN} />
        <StatCard icon={CheckCircle2} label="Demos booked" value={booked} tone={GREEN} />
        <StatCard
          icon={Activity}
          label="Retell spend (est)"
          value={spend ? `$${spend.total_cost.toFixed(2)}` : '--'}
          tone={RED}
        />
      </section>

      {error && (
        <div className="caller-alert">
          <span>{error}</span>
          <button onClick={() => setError('')}><X size={15} /></button>
        </div>
      )}

      <main className="caller-grid">
        <aside className="caller-left">
          <section className="caller-panel caller-agent-pick">
            <h2>Caller Agent</h2>
            <label className="caller-agent-field">
              <span>Who's calling</span>
              <select value={status?.active_agent || ''} onChange={e => switchAgent(e.target.value)}>
                {(status?.agents || []).map(a => (
                  <option key={a.key} value={a.key} disabled={!a.configured}>
                    {a.label}{a.configured ? '' : ' (not set up)'}
                  </option>
                ))}
              </select>
            </label>
            <label className="caller-agent-field">
              <span>Voice</span>
              <select value={status?.voice_id || ''} onChange={e => changeVoice(e.target.value)}>
                {status?.voice_id && !VOICES.some(v => v.id === status.voice_id) && (
                  <option value={status.voice_id}>{status.voice_id}</option>
                )}
                {VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </label>
            <p className="caller-agent-meta">
              {status?.simulate ? 'Simulation mode' : 'Live calling'}
              {status?.price ? ` · ${status.price}` : ''}
            </p>
          </section>

          <section className="caller-panel caller-quick">
            <h2>Quick Dial</h2>
            <label>
              <Users size={16} />
              <input value={dial.name} onChange={e => setDial({ ...dial, name: e.target.value })} placeholder="Name (optional)" />
            </label>
            <label>
              <Phone size={16} />
              <input
                value={dial.number}
                onChange={e => setDial({ ...dial, number: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && quickDial()}
                placeholder="Phone number"
              />
            </label>
            {dial.number.trim() !== '' && (
              <small className={dialInvalid ? 'caller-dial-hint caller-dial-bad' : 'caller-dial-hint caller-dial-ok'}>
                {dialInvalid ? 'Enter a 10-digit US number' : `Will dial ${prettyUS(dialNormalized as string)}`}
              </small>
            )}
            <button className="caller-primary" onClick={quickDial} disabled={busy || status?.kill_switch || dialInvalid}>
              <Phone size={17} />
              Dial
            </button>
          </section>

          <section className="caller-panel caller-autodial">
            <h2>Auto-Dial Queue</h2>
            {autoDial ? (
              <>
                <p className="caller-autodial-on">
                  <Waveform small /> Running — {dialedSession.current.size} dialed
                  {autoCountdown > 0 ? ` · next in ${autoCountdown}s` : ''}
                </p>
                <button className="caller-secondary" onClick={stopAutoDial}>
                  <PhoneOff size={16} /> Stop session
                </button>
              </>
            ) : (
              <>
                <p className="caller-autodial-off">
                  Walk the broker queue hands-free — dials, then advances after {AUTO_DIAL_DELAY}s so you can disposition.
                </p>
                <button
                  className="caller-primary"
                  onClick={startAutoDial}
                  disabled={busy || status?.kill_switch || !leads?.callable.length}
                >
                  <PhoneOutgoing size={16} /> Start session
                </button>
              </>
            )}
          </section>

          <section className="caller-search">
            <h2>Broker Search</h2>
            <div className="caller-searchbox">
              <Search size={15} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search brokers..." />
              <button title="Filters"><SlidersHorizontal size={15} /></button>
            </div>
          </section>

          <section className="caller-panel caller-mini-queue">
            <h2>Broker Queue ({leads?.callable.length ?? 0})</h2>
            <div className="caller-mini-list">
              {compactQueue.map((lead, index) => (
                <button key={lead.lead_id} className="caller-mini-row" onClick={() => runCall(lead)} disabled={busy || status?.kill_switch}>
                  <span className="caller-rank">{index + 1}</span>
                  <span className="caller-mini-copy">
                    <b>{lead.business}</b>
                    <small><Stars n={lead.fit} /> {lead.phone} {lead.best_time || ''}</small>
                  </span>
                  <span className="caller-mini-call"><Phone size={13} /> Call</span>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="caller-center caller-panel">
          <div className="caller-section-head">
            <h2>Broker Queue</h2>
            <label className="caller-sort">
              Sort:
              <select value={sort} onChange={e => setSort(e.target.value)}>
                <option value="next">Next Up</option>
                <option value="fit">Fit Score</option>
                <option value="name">Name</option>
              </select>
            </label>
          </div>

          <div className="caller-table">
            <div className="caller-table-head caller-table-row">
              <span>#</span>
              <span>Broker</span>
              <span>Phone</span>
              <span>Window</span>
              <span>Status</span>
              <span />
            </div>
            {queue.map((lead, index) => (
              <div key={lead.lead_id} className={index === 0 ? 'caller-table-row caller-row-active' : 'caller-table-row'}>
                <span className="caller-rank">{index + 1}</span>
                <span className="caller-broker-name">
                  <b>{lead.business}</b>
                  <small><Stars n={lead.fit} /></small>
                </span>
                <span>{lead.phone}</span>
                <span>{lead.best_time || '9-11a / 4-6p'}</span>
                <span>
                  <button className={index === 0 ? 'caller-status-pill caller-status-next' : 'caller-status-pill'}>
                    {index === 0 ? 'Next up' : 'Pending'}
                  </button>
                </span>
                <span className="caller-row-actions">
                  <button title="Call" onClick={() => runCall(lead)} disabled={busy || status?.kill_switch}><Phone size={15} /></button>
                  <button title="More"><MoreVertical size={15} /></button>
                </span>
              </div>
            ))}
          </div>

          <footer className="caller-table-foot">
            <span>{queue.length} items</span>
            <span className="caller-page-dot">1</span>
          </footer>
        </section>

        <aside className="caller-right">
          <section className="caller-panel caller-live-card">
            <div className="caller-section-head">
              <h2>Live Call</h2>
              <button className="caller-icon-button" title="More"><MoreVertical size={16} /></button>
            </div>
            {activeCall ? (
              <>
                <div className="caller-live-main">
                  <span className="caller-building"><Building2 size={38} /></span>
                  <div>
                    <h3>{activeCall.business || activeCall.lead_name || 'Active call'}</h3>
                    <p>{activeCall.phone}</p>
                    <small><i style={{ background: modalStatusColor }} /> {activeCall.status === 'dialing' ? 'Connecting...' : activeCall.status}</small>
                  </div>
                  <b>{formatElapsed(activeCall, now)}</b>
                </div>
                <div className="caller-outcomes">
                  {DISPOSITIONS.map(item => (
                    <button key={item.label} onClick={() => setDisposition(item.label)} className={activeCall.disposition === item.label ? 'selected' : ''}>
                      <item.icon size={18} />
                      {item.label}
                    </button>
                  ))}
                </div>
                {activeCall.retell_call_id && !activeCall.simulated && (activeCall.status === 'live' || activeCall.status === 'dialing') && (
                  <a className="caller-secondary caller-listen-inline" href={RETELL_DASHBOARD} target="_blank" rel="noreferrer" title="Open Retell live monitoring to listen in">
                    <Headphones size={15} /> Listen live on Retell
                  </a>
                )}
                {(activeCall.status === 'live' || activeCall.status === 'dialing') && (
                  <button className="caller-secondary caller-end-inline" onClick={endActiveCall} disabled={ending}>
                    <PhoneOff size={15} /> {ending ? 'Ending…' : 'End call'}
                  </button>
                )}
              </>
            ) : (
              <div className="caller-empty-live">No active call</div>
            )}
          </section>

          <section className="caller-panel caller-transcript-panel">
            <div className="caller-section-head">
              <h2>Live Transcript</h2>
              {callLive && <span><Waveform small /> Listening...</span>}
            </div>
            <div ref={transcriptRef} className="caller-transcript-scroll">
              <Transcript call={activeCall} />
            </div>
            {activeCall?.recording_url && <audio controls src={activeCall.recording_url} />}
            {callLive && <div className="caller-realtime"><i /> Transcribing in real time</div>}
          </section>
        </aside>
      </main>

      {callModalOpen && activeCall && (
        <div className="caller-modal-backdrop" onClick={() => setCallModalOpen(false)}>
          <motion.section
            className="caller-call-modal"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            onClick={e => e.stopPropagation()}
          >
            <button className="caller-modal-close" onClick={() => setCallModalOpen(false)}><X size={18} /></button>
            <div className="caller-modal-head">
              <span className="caller-building caller-building-large"><Building2 size={42} /></span>
              <div>
                <h3>{activeCall.business || activeCall.lead_name || 'Active call'}</h3>
                <p>{activeCall.phone}</p>
              </div>
              <span className="caller-modal-live"><i style={{ background: modalStatusColor }} /> {activeCall.status}</span>
              <b>{formatElapsed(activeCall, now)}</b>
            </div>
            <Waveform />
            <div className="caller-modal-avatar">
              <Building2 size={96} />
            </div>
            <div className="caller-call-controls">
              <button title="Notes" onClick={() => setNotesOpen(o => !o)} className={notesOpen ? 'selected' : ''}><ClipboardList size={19} /><span>Notes</span></button>
              <button title="Copy number" onClick={() => activeCall.phone && navigator.clipboard?.writeText(activeCall.phone)}><KeyRound size={19} /><span>Copy #</span></button>
              <button title="Transcript" onClick={() => setCallModalOpen(false)}><Headphones size={19} /><span>Transcript</span></button>
              <button title="Not a fit" onClick={() => setDisposition('Not a fit')}><Ban size={19} /><span>Not a Fit</span></button>
              <button title="Add number to Do-Not-Call list" onClick={() => activeCall.phone && addToDnc(activeCall.phone)}><PhoneOff size={19} /><span>DNC</span></button>
              <button
                title="End call"
                onClick={endActiveCall}
                disabled={ending || activeCall.status === 'ended' || activeCall.status === 'error'}
                className="caller-end"
              >
                <PhoneOff size={20} /><span>{ending ? 'Ending…' : 'End'}</span>
              </button>
            </div>
            {notesOpen && (
              <div className="caller-notes">
                <textarea
                  value={noteDraft}
                  onChange={e => setNoteDraft(e.target.value)}
                  placeholder="Notes for this call…"
                  rows={3}
                />
                <button className="caller-secondary" onClick={saveNote}>Save note</button>
              </div>
            )}
            <div className="caller-modal-outcomes">
              {DISPOSITIONS.filter(d => d.label !== 'Demo booked' && d.label !== 'Not a fit').map(item => (
                <button key={item.label} onClick={() => setDisposition(item.label)}>
                  <item.icon size={21} />
                  {item.label}
                </button>
              ))}
            </div>
          </motion.section>
        </div>
      )}

      {configOpen && (
        <div className="caller-config-backdrop" onClick={() => setConfigOpen(false)}>
          <motion.section
            className="caller-config"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="caller-section-head">
              <h2>Caller Config</h2>
              <button className="caller-icon-button" onClick={() => setConfigOpen(false)}><X size={16} /></button>
            </div>
            {([
              ['AI caller name', 'caller_name'],
              ['Demo owner', 'demo_owner'],
              ['Callback number', 'callback_number'],
              ['From number', 'from_number'],
              ['Price line', 'price'],
              ['Google Sheet ID', 'google_sheet_id'],
              ['Google Sheet URL', 'google_sheet_url'],
              ['Sheet webhook', 'sheet_webhook_url'],
            ] as const).map(([label, key]) => (
              <label key={key} className="caller-config-field">
                <span>{label}</span>
                <input
                  value={cfg[key]}
                  type={key === 'sheet_webhook_url' ? 'password' : 'text'}
                  onChange={e => setCfg({ ...cfg, [key]: e.target.value })}
                  placeholder={key === 'sheet_webhook_url' && sheet?.webhook_configured ? 'Configured' : ''}
                />
              </label>
            ))}
            <div className="caller-config-status">
              <span>Pending sync</span>
              <b>{sheet?.pending_count || 0}</b>
            </div>
            <button className="caller-primary" onClick={saveConfig}>Save</button>
            <button className="caller-secondary" onClick={syncSheet}>Sync Sheet Now</button>
            {sheetUrl && <a className="caller-secondary caller-link-button" href={sheetUrl} target="_blank" rel="noreferrer">Open Google Sheet</a>}
            {syncMessage && <p className="caller-sync-message">{syncMessage}</p>}
          </motion.section>
        </div>
      )}
    </div>
  )
}
