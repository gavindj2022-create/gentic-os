export default function FearGauge({ score, level }: { score: number; level: string }) {
  const angle = -90 + (score / 100) * 180
  return (
    <div className="flex flex-col items-center py-2">
      <svg viewBox="0 0 200 110" className="w-[180px] h-[100px]">
        <defs>
          <linearGradient id="arc-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2d7a28" />
            <stop offset="40%" stopColor="#c9a227" />
            <stop offset="70%" stopColor="#c05a18" />
            <stop offset="100%" stopColor="#c0281e" />
          </linearGradient>
        </defs>
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#1e1e1e" strokeWidth="14" strokeLinecap="round" />
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#arc-grad)" strokeWidth="12" strokeLinecap="round"
          strokeDasharray="251" strokeDashoffset={251 - (score / 100) * 251} style={{ transition: 'stroke-dashoffset 1s ease' }} />
        <g transform={`rotate(${angle},100,100)`} style={{ transition: 'transform 1s ease' }}>
          <line x1="100" y1="100" x2="100" y2="28" stroke="#c9a227" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="100" cy="100" r="5" fill="#c9a227" />
        </g>
        <text x="20" y="108" fill="#3a3028" fontSize="9">0</text>
        <text x="92" y="24" fill="#3a3028" fontSize="9">50</text>
        <text x="172" y="108" fill="#3a3028" fontSize="9">100</text>
      </svg>
      <div className="font-mono text-2xl font-bold mt-1" style={{ color: 'var(--gold-b)' }}>{score}</div>
      <div className="text-[11px] tracking-[2px] uppercase" style={{ color: 'var(--text-d)' }}>{level}</div>
    </div>
  )
}
