import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export default function Popout({ open, onClose, title, children, width = 480 }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; width?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div ref={ref} onClick={e => e.stopPropagation()}
        className="relative rounded-xl overflow-hidden fade-in"
        style={{ width, maxWidth: '90vw', maxHeight: '85vh', background: 'var(--s1)', border: '1px solid var(--gold-d)', boxShadow: '0 0 40px rgba(201,162,39,0.15)' }}>
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-xs tracking-[2px] uppercase font-semibold" style={{ color: 'var(--gold)' }}>{title}</span>
          <button onClick={onClose} className="p-1 rounded transition-colors hover:bg-[var(--s3)] cursor-pointer">
            <X size={16} style={{ color: 'var(--text-d)' }} />
          </button>
        </div>
        <div className="overflow-y-auto p-5" style={{ maxHeight: 'calc(85vh - 52px)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
