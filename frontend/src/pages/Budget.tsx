import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { api } from '../lib/api'
import type { BudgetStatus } from '../lib/types'
import AgentFace from '../components/AgentFace'
import { Wallet, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

const glass = {
  background: 'rgba(13,13,13,0.6)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(201,162,39,0.12)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 0 30px rgba(0,0,0,0.3)',
  borderRadius: '16px',
}

const PROVIDER_META: Record<string, { color: string; face: string; label: string }> = {
  claude: { color: '#d4a574', face: 'claude', label: 'Claude (Anthropic)' },
  openai: { color: '#10a37f', face: 'chatgpt', label: 'OpenAI / GPT' },
  gemini: { color: '#8b5cf6', face: 'gemini', label: 'Gemini (Google)' },
  ollama: { color: '#64748b', face: 'ollama', label: 'Ollama (Local)' },
}

export default function Budget() {
  const [budgets, setBudgets] = useState<BudgetStatus[]>([])

  const load = () => {
    api.workforceBudgets().then((d: any) => setBudgets(d.budgets || [])).catch(() => {})
  }

  useEffect(() => { load() }, [])
  useEffect(() => { const id = setInterval(load, 10000); return () => clearInterval(id) }, [])

  const totalMonthly = budgets.reduce((s, b) => s + b.monthly_cost_used, 0)
  const totalDailyTokens = budgets.reduce((s, b) => s + b.daily_tokens_used, 0)

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
        <h1 className="text-[11px] tracking-[3px] uppercase" style={{ color: 'var(--gold)' }}>Budget</h1>
        <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold font-mono"
          style={{ background: 'rgba(234,179,8,0.1)', color: '#eab308' }}>
          ${totalMonthly.toFixed(4)} this month
        </span>
      </motion.div>

      {/* Summary Row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <SummaryCard label="Monthly Spend" value={`$${totalMonthly.toFixed(4)}`} color="var(--gold)" delay={0} />
        <SummaryCard label="Daily Tokens" value={totalDailyTokens.toLocaleString()} color="var(--cyan)" delay={0.07} />
        <SummaryCard label="Active Providers" value={String(budgets.filter(b => b.can_spend).length)} color="var(--green-t)" delay={0.14} />
      </div>

      {/* Provider Budget Cards */}
      <div className="grid grid-cols-2 gap-4">
        {budgets.map((b, i) => (
          <ProviderBudgetCard key={b.provider} budget={b} delay={0.2 + i * 0.08} onUpdate={load} />
        ))}
      </div>

      {budgets.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-12 text-center" style={glass}>
          <Wallet size={32} style={{ color: 'var(--text-d)', margin: '0 auto 8px' }} />
          <div className="text-xs" style={{ color: 'var(--text-d)' }}>No budget data — start the backend to initialize</div>
        </motion.div>
      )}
    </div>
  )
}


function SummaryCard({ label, value, color, delay }: { label: string; value: string; color: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="p-4 text-center"
      style={glass}
    >
      <div className="font-mono text-xl font-bold" style={{ color }}>{value}</div>
      <div className="text-[9px] tracking-[1px] uppercase mt-1" style={{ color: 'var(--text-d)' }}>{label}</div>
    </motion.div>
  )
}


function ProviderBudgetCard({ budget, delay }: { budget: BudgetStatus; delay: number; onUpdate?: () => void }) {
  const meta = PROVIDER_META[budget.provider] || { color: '#999', face: 'default', label: budget.provider }

  // Token usage gauge
  const tokenPct = budget.daily_tokens_limit > 0
    ? Math.min(100, (budget.daily_tokens_used / budget.daily_tokens_limit) * 100)
    : 0
  const costPct = budget.monthly_cost_limit > 0
    ? Math.min(100, (budget.monthly_cost_used / budget.monthly_cost_limit) * 100)
    : 0

  const tokenWarning = tokenPct >= 80
  const costWarning = costPct >= 80

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay }}
      className="p-5"
      style={{
        ...glass,
        border: `1px solid ${!budget.can_spend ? 'rgba(239,68,68,0.3)' : `${meta.color}20`}`,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <AgentFace name={meta.face} size={40} active={budget.can_spend} />
        <div className="flex-1">
          <div className="text-sm font-bold" style={{ color: meta.color }}>{meta.label}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {budget.can_spend ? (
              <>
                <CheckCircle size={10} style={{ color: 'var(--green-t)' }} />
                <span className="text-[9px]" style={{ color: 'var(--green-t)' }}>Active</span>
              </>
            ) : (
              <>
                <XCircle size={10} style={{ color: 'var(--red)' }} />
                <span className="text-[9px]" style={{ color: 'var(--red)' }}>Budget Exceeded</span>
              </>
            )}
          </div>
        </div>
        {budget.provider === 'ollama' && (
          <span className="text-[8px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(77,184,72,0.12)', color: 'var(--green-t)' }}>
            FREE
          </span>
        )}
      </div>

      {/* Daily Tokens */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[9px] tracking-wide uppercase" style={{ color: 'var(--text-d)' }}>Daily Tokens</span>
          <span className="text-[10px] font-mono font-bold" style={{ color: tokenWarning ? '#eab308' : 'var(--text-b)' }}>
            {budget.daily_tokens_used.toLocaleString()} / {budget.daily_tokens_limit.toLocaleString()}
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${tokenPct}%` }}
            transition={{ duration: 0.8, delay: delay + 0.2 }}
            className="h-full rounded-full"
            style={{
              background: tokenWarning
                ? 'linear-gradient(90deg, #eab308, #ef4444)'
                : `linear-gradient(90deg, ${meta.color}80, ${meta.color})`,
            }}
          />
        </div>
        {tokenWarning && (
          <div className="flex items-center gap-1 mt-1">
            <AlertTriangle size={9} style={{ color: '#eab308' }} />
            <span className="text-[8px]" style={{ color: '#eab308' }}>
              {tokenPct >= 100 ? 'Daily limit reached' : `${tokenPct.toFixed(0)}% of daily limit used`}
            </span>
          </div>
        )}
      </div>

      {/* Monthly Cost */}
      {budget.provider !== 'ollama' && (
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[9px] tracking-wide uppercase" style={{ color: 'var(--text-d)' }}>Monthly Cost</span>
            <span className="text-[10px] font-mono font-bold" style={{ color: costWarning ? '#eab308' : 'var(--text-b)' }}>
              ${budget.monthly_cost_used.toFixed(4)} / ${budget.monthly_cost_limit.toFixed(2)}
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${costPct}%` }}
              transition={{ duration: 0.8, delay: delay + 0.3 }}
              className="h-full rounded-full"
              style={{
                background: costWarning
                  ? 'linear-gradient(90deg, #eab308, #ef4444)'
                  : `linear-gradient(90deg, ${meta.color}80, ${meta.color})`,
              }}
            />
          </div>
          {costWarning && (
            <div className="flex items-center gap-1 mt-1">
              <AlertTriangle size={9} style={{ color: '#eab308' }} />
              <span className="text-[8px]" style={{ color: '#eab308' }}>
                {costPct >= 100 ? 'Monthly cap reached' : `${costPct.toFixed(0)}% of monthly cap used`}
              </span>
            </div>
          )}
        </div>
      )}

      {budget.provider === 'ollama' && (
        <div className="p-2 rounded-lg text-center" style={{ background: 'rgba(77,184,72,0.06)' }}>
          <div className="text-[9px]" style={{ color: 'var(--green-t)' }}>
            Local model — unlimited, no cost
          </div>
        </div>
      )}
    </motion.div>
  )
}
