import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { api } from '../lib/api'
import type { Insight } from '../lib/types'
import AgentFace from '../components/AgentFace'
import { GlassPopout } from '../components/GlassCard'
import { Search, Shield, Rocket, TrendingUp, DollarSign, Lightbulb, Sparkles } from 'lucide-react'

const glass = {
  background: 'rgba(13,13,13,0.6)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(201,162,39,0.12)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 0 30px rgba(0,0,0,0.3)',
  borderRadius: '16px',
}

const CATEGORIES = [
  { key: '', label: 'All', icon: Sparkles, color: 'var(--gold)' },
  { key: 'security', label: 'Security', icon: Shield, color: '#ef4444', emoji: '🔒' },
  { key: 'expansion', label: 'Expansion', icon: Rocket, color: '#3b82f6', emoji: '🚀' },
  { key: 'improvement', label: 'Improvement', icon: TrendingUp, color: '#22c55e', emoji: '⚡' },
  { key: 'revenue', label: 'Revenue', icon: DollarSign, color: '#eab308', emoji: '💰' },
]

const CATEGORY_COLOR: Record<string, string> = {
  security: '#ef4444',
  expansion: '#3b82f6',
  improvement: '#22c55e',
  revenue: '#eab308',
}

const PROVIDER_FACE: Record<string, string> = {
  claude: 'claude',
  openai: 'chatgpt',
  gemini: 'gemini',
  ollama: 'ollama',
}

export default function Insights() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Insight | null>(null)

  const load = () => {
    const params: Record<string, string> = {}
    if (filter) params.category = filter
    api.getInsights(params).then((d: any) => setInsights(d.insights || [])).catch(() => {})
  }

  useEffect(() => { load() }, [filter])

  const filtered = search
    ? insights.filter(i => i.title.toLowerCase().includes(search.toLowerCase()) || i.content.toLowerCase().includes(search.toLowerCase()))
    : insights

  const totalCount = insights.length
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const weekCount = insights.filter(i => i.created_at > weekAgo).length
  const topCategory = Object.entries(
    insights.reduce((acc, i) => { acc[i.category] = (acc[i.category] || 0) + 1; return acc }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1])[0]

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
        <h1 className="text-[11px] tracking-[3px] uppercase" style={{ color: 'var(--gold)' }}>Insights</h1>
        <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold"
          style={{ background: 'rgba(139,92,246,0.12)', color: '#8b5cf6' }}>
          {totalCount} total
        </span>
      </motion.div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }} className="p-4 text-center" style={glass}>
          <div className="font-mono text-2xl font-bold" style={{ color: 'var(--gold)' }}>{totalCount}</div>
          <div className="text-[9px] tracking-[1px] uppercase mt-0.5" style={{ color: 'var(--text-d)' }}>Total Insights</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }} className="p-4 text-center" style={glass}>
          <div className="font-mono text-2xl font-bold" style={{ color: 'var(--cyan)' }}>{weekCount}</div>
          <div className="text-[9px] tracking-[1px] uppercase mt-0.5" style={{ color: 'var(--text-d)' }}>This Week</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="p-4 text-center" style={glass}>
          <div className="font-mono text-lg font-bold capitalize" style={{ color: topCategory ? CATEGORY_COLOR[topCategory[0]] || 'var(--text-b)' : 'var(--text-d)' }}>
            {topCategory ? topCategory[0] : '—'}
          </div>
          <div className="text-[9px] tracking-[1px] uppercase mt-0.5" style={{ color: 'var(--text-d)' }}>Top Category</div>
        </motion.div>
      </div>

      {/* Category Tabs + Search */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex items-center gap-2 mb-4"
      >
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setFilter(cat.key)}
            className="text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-all hover:scale-105"
            style={{
              background: filter === cat.key ? `${cat.color}15` : 'rgba(255,255,255,0.03)',
              color: filter === cat.key ? cat.color : 'var(--text-d)',
              border: `1px solid ${filter === cat.key ? `${cat.color}30` : 'rgba(255,255,255,0.05)'}`,
            }}
          >
            {cat.label}
          </button>
        ))}
        <div className="flex-1" />
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,162,39,0.08)' }}>
          <Search size={12} style={{ color: 'var(--text-d)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search insights..."
            className="bg-transparent text-[10px] outline-none w-36" style={{ color: 'var(--text-b)' }} />
        </div>
      </motion.div>

      {/* Insight Cards */}
      <div className="grid grid-cols-2 gap-3">
        {filtered.map((ins, i) => (
          <InsightCard key={ins.id} insight={ins} delay={0.25 + i * 0.04} onClick={() => setSelected(ins)} />
        ))}
      </div>

      {filtered.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-12 text-center" style={glass}>
          <Lightbulb size={32} style={{ color: 'var(--text-d)', margin: '0 auto 8px' }} />
          <div className="text-xs" style={{ color: 'var(--text-d)' }}>
            {search ? `No insights matching "${search}"` : 'No insights yet — complete tasks to generate insights'}
          </div>
        </motion.div>
      )}

      {/* Insight Detail Popout */}
      <GlassPopout open={!!selected} onClose={() => setSelected(null)} title="Insight Detail" width={520}>
        {selected && <InsightDetail insight={selected} />}
      </GlassPopout>
    </div>
  )
}


function InsightCard({ insight, delay, onClick }: { insight: Insight; delay: number; onClick: () => void }) {
  const color = CATEGORY_COLOR[insight.category] || '#666'
  const catEmoji = CATEGORIES.find(c => c.key === insight.category)?.emoji || '⚙️'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      whileHover={{ scale: 1.01 }}
      onClick={onClick}
      className="p-4 cursor-pointer"
      style={{ ...glass, borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-start gap-2 mb-2">
        <span className="text-sm">{catEmoji}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold truncate" style={{ color: 'var(--text-b)' }}>{insight.title}</div>
          <div className="text-[10px] mt-1 line-clamp-2" style={{ color: 'var(--text-d)' }}>{insight.content}</div>
        </div>
      </div>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          <AgentFace name={PROVIDER_FACE[insight.agent_id] || 'default'} size={16} />
          <span className="text-[8px] font-mono" style={{ color: 'var(--text-d)' }}>{insight.agent_id}</span>
        </div>
        <ConfidenceBar confidence={insight.confidence} />
      </div>
    </motion.div>
  )
}


function InsightDetail({ insight }: { insight: Insight }) {
  const color = CATEGORY_COLOR[insight.category] || '#666'
  const catEmoji = CATEGORIES.find(c => c.key === insight.category)?.emoji || '⚙️'

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xl">{catEmoji}</span>
        <div>
          <div className="text-sm font-bold" style={{ color: 'var(--text-b)' }}>{insight.title}</div>
          <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase mt-1 inline-block"
            style={{ background: `${color}15`, color }}>
            {insight.category}
          </span>
        </div>
      </div>

      <div className="p-4 rounded-lg mb-4" style={{ background: `${color}08`, borderLeft: `3px solid ${color}` }}>
        <div className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-b)' }}>
          {insight.content}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <InfoRow label="Confidence" value={`${(insight.confidence * 100).toFixed(0)}%`} />
        <InfoRow label="Agent" value={insight.agent_id} />
        <InfoRow label="Task ID" value={insight.task_id} />
        <InfoRow label="Created" value={new Date(insight.created_at).toLocaleString()} />
        {insight.obsidian_path && <InfoRow label="Obsidian" value={insight.obsidian_path} />}
      </div>
    </div>
  )
}


function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  const color = pct >= 70 ? 'var(--green-t)' : pct >= 40 ? '#eab308' : 'var(--red)'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[8px] font-mono" style={{ color }}>{pct}%</span>
    </div>
  )
}


function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1.5" style={{ borderBottom: '1px solid rgba(201,162,39,0.08)' }}>
      <span className="text-[11px]" style={{ color: 'var(--text-d)' }}>{label}</span>
      <span className="font-mono text-[11px] truncate max-w-[280px]" style={{ color: 'var(--text-b)' }}>{value}</span>
    </div>
  )
}
