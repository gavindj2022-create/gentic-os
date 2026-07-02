const AGENTS: Record<string, { color: string; bg: string; eye: string; mouth: string; shape: string }> = {
  alfred:   { color: '#c9a227', bg: '#1e1a08', eye: 'determined', mouth: 'flat',   shape: 'round' },
  olivia:   { color: '#00d4ff', bg: '#021a24', eye: 'friendly',  mouth: 'smile',  shape: 'round' },
  icarus:   { color: '#ff6b35', bg: '#241208', eye: 'alert',     mouth: 'open',   shape: 'round' },
  claude:   { color: '#d4a574', bg: '#1a1408', eye: 'calm',      mouth: 'slight', shape: 'round' },
  chatgpt:  { color: '#10a37f', bg: '#081a14', eye: 'friendly',  mouth: 'smile',  shape: 'round' },
  gemini:   { color: '#8b5cf6', bg: '#140824', eye: 'curious',   mouth: 'slight', shape: 'round' },
  ollama:   { color: '#64748b', bg: '#0a0e14', eye: 'sleepy',    mouth: 'flat',   shape: 'round' },
  gentic:   { color: '#e8c04a', bg: '#1e1a08', eye: 'determined',mouth: 'grin',   shape: 'hex' },
  worker:   { color: '#4db848', bg: '#0a1a08', eye: 'focused',   mouth: 'flat',   shape: 'round' },
  knowledge:{ color: '#00c8c8', bg: '#081a1a', eye: 'curious',   mouth: 'slight', shape: 'round' },
  sentinel: { color: '#c0281e', bg: '#1a0808', eye: 'alert',     mouth: 'flat',   shape: 'round' },
  default:  { color: '#9ca3af', bg: '#111111', eye: 'calm',      mouth: 'flat',   shape: 'round' },
}

function getAgentKey(name: string): string {
  const lower = name.toLowerCase()
  for (const key of Object.keys(AGENTS)) {
    if (lower.includes(key)) return key
  }
  if (lower.includes('frontend') || lower.includes('pwa')) return 'worker'
  if (lower.includes('backend') || lower.includes('api')) return 'claude'
  if (lower.includes('ocr') || lower.includes('tax')) return 'icarus'
  if (lower.includes('email') || lower.includes('automation')) return 'olivia'
  if (lower.includes('qa') || lower.includes('deploy') || lower.includes('test')) return 'sentinel'
  if (lower.includes('knowledge') || lower.includes('spreadsheet')) return 'knowledge'
  return 'default'
}

export default function AgentFace({ name, size = 48, active = true, onClick }: {
  name: string; size?: number; active?: boolean; onClick?: () => void
}) {
  const key = getAgentKey(name)
  const a = AGENTS[key] || AGENTS.default
  const s = size
  const cx = s / 2
  const cy = s / 2
  const r = s * 0.42

  return (
    <div
      onClick={onClick}
      className={`inline-flex flex-col items-center gap-1 ${onClick ? 'cursor-pointer' : ''} transition-transform ${onClick ? 'hover:scale-110' : ''}`}
      style={{ opacity: active ? 1 : 0.4 }}
    >
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
        {/* Glow */}
        <defs>
          <filter id={`glow-${key}-${s}`}>
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Body — Pac-man style circle with bite */}
        <circle cx={cx} cy={cy} r={r + 2} fill={a.bg} stroke={a.color} strokeWidth={1.5}
          filter={active ? `url(#glow-${key}-${s})` : undefined}
          style={{ transition: 'all 0.3s' }} />
        <circle cx={cx} cy={cy} r={r} fill={a.color} opacity={0.15} />

        {/* Eyes */}
        {renderEyes(a.eye, cx, cy, r, a.color)}

        {/* Mouth */}
        {renderMouth(a.mouth, cx, cy, r, a.color)}

        {/* Status dot */}
        {active && (
          <circle cx={s * 0.82} cy={s * 0.18} r={s * 0.07} fill="#4db848">
            <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
          </circle>
        )}
      </svg>
    </div>
  )
}

function renderEyes(type: string, cx: number, cy: number, r: number, color: string) {
  const ey = cy - r * 0.2
  const spread = r * 0.35
  const eyeR = r * 0.12

  switch (type) {
    case 'determined':
      return <>
        <circle cx={cx - spread} cy={ey} r={eyeR} fill={color} />
        <circle cx={cx + spread} cy={ey} r={eyeR} fill={color} />
        <line x1={cx - spread - eyeR} y1={ey - eyeR * 1.2} x2={cx - spread + eyeR} y2={ey - eyeR * 0.5} stroke={color} strokeWidth={1.2} strokeLinecap="round" />
        <line x1={cx + spread - eyeR} y1={ey - eyeR * 0.5} x2={cx + spread + eyeR} y2={ey - eyeR * 1.2} stroke={color} strokeWidth={1.2} strokeLinecap="round" />
      </>
    case 'friendly':
      return <>
        <circle cx={cx - spread} cy={ey} r={eyeR * 1.2} fill={color} />
        <circle cx={cx + spread} cy={ey} r={eyeR * 1.2} fill={color} />
        <circle cx={cx - spread + eyeR * 0.3} cy={ey - eyeR * 0.3} r={eyeR * 0.4} fill={color} opacity={0.5} />
        <circle cx={cx + spread + eyeR * 0.3} cy={ey - eyeR * 0.3} r={eyeR * 0.4} fill={color} opacity={0.5} />
      </>
    case 'alert':
      return <>
        <circle cx={cx - spread} cy={ey} r={eyeR * 1.3} fill="none" stroke={color} strokeWidth={1.5} />
        <circle cx={cx - spread} cy={ey} r={eyeR * 0.5} fill={color} />
        <circle cx={cx + spread} cy={ey} r={eyeR * 1.3} fill="none" stroke={color} strokeWidth={1.5} />
        <circle cx={cx + spread} cy={ey} r={eyeR * 0.5} fill={color} />
      </>
    case 'curious':
      return <>
        <circle cx={cx - spread} cy={ey} r={eyeR} fill={color} />
        <circle cx={cx + spread} cy={ey - eyeR * 0.5} r={eyeR * 1.3} fill={color} />
      </>
    case 'sleepy':
      return <>
        <line x1={cx - spread - eyeR} y1={ey} x2={cx - spread + eyeR} y2={ey} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
        <line x1={cx + spread - eyeR} y1={ey} x2={cx + spread + eyeR} y2={ey} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      </>
    case 'focused':
      return <>
        <rect x={cx - spread - eyeR} y={ey - eyeR * 0.6} width={eyeR * 2} height={eyeR * 1.2} rx={eyeR * 0.3} fill={color} />
        <rect x={cx + spread - eyeR} y={ey - eyeR * 0.6} width={eyeR * 2} height={eyeR * 1.2} rx={eyeR * 0.3} fill={color} />
      </>
    default: // calm
      return <>
        <circle cx={cx - spread} cy={ey} r={eyeR} fill={color} />
        <circle cx={cx + spread} cy={ey} r={eyeR} fill={color} />
      </>
  }
}

function renderMouth(type: string, cx: number, cy: number, r: number, color: string) {
  const my = cy + r * 0.25
  const w = r * 0.35

  switch (type) {
    case 'smile':
      return <path d={`M ${cx - w} ${my} Q ${cx} ${my + w * 0.8} ${cx + w} ${my}`} fill="none" stroke={color} strokeWidth={1.2} strokeLinecap="round" />
    case 'grin':
      return <path d={`M ${cx - w} ${my} Q ${cx} ${my + w} ${cx + w} ${my}`} fill={color} opacity={0.3} stroke={color} strokeWidth={1} />
    case 'open':
      return <ellipse cx={cx} cy={my + w * 0.2} rx={w * 0.5} ry={w * 0.4} fill={color} opacity={0.2} stroke={color} strokeWidth={1} />
    case 'slight':
      return <path d={`M ${cx - w * 0.6} ${my} Q ${cx} ${my + w * 0.4} ${cx + w * 0.6} ${my}`} fill="none" stroke={color} strokeWidth={1} strokeLinecap="round" />
    default: // flat
      return <line x1={cx - w * 0.6} y1={my} x2={cx + w * 0.6} y2={my} stroke={color} strokeWidth={1.2} strokeLinecap="round" />
  }
}

export function AgentBadge({ name, active = true }: { name: string; active?: boolean }) {
  const key = getAgentKey(name)
  const a = AGENTS[key] || AGENTS.default
  const shortName = name.length > 20 ? name.split(' ').slice(0, 3).join(' ') : name

  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all hover:scale-[1.02] cursor-pointer"
      style={{ background: a.bg, border: `1px solid ${a.color}30` }}>
      <AgentFace name={name} size={32} active={active} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold truncate" style={{ color: a.color }}>{shortName}</div>
      </div>
      <div className="w-2 h-2 rounded-full shrink-0"
        style={{ background: active ? '#4db848' : '#3a0808', boxShadow: active ? '0 0 6px #4db848' : 'none' }} />
    </div>
  )
}
