import { motion, AnimatePresence } from 'motion/react'
import { type ReactNode } from 'react'

interface GlassCardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  glow?: string
  delay?: number
  noPad?: boolean
}

export default function GlassCard({ children, className = '', onClick, glow, delay = 0, noPad }: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, type: 'spring', stiffness: 120, damping: 20 }}
      whileHover={{ scale: 1.015, y: -1 }}
      whileTap={onClick ? { scale: 0.985 } : undefined}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{
        background: 'rgba(13, 13, 13, 0.6)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(201, 162, 39, 0.12)',
        boxShadow: glow
          ? `0 0 30px ${glow}, 0 8px 32px rgba(0,0,0,0.4), inset 0 0 30px rgba(0,0,0,0.3)`
          : '0 8px 32px rgba(0,0,0,0.4), inset 0 0 30px rgba(0,0,0,0.3)',
      }}
    >
      <div className={noPad ? '' : 'p-5'}>{children}</div>
    </motion.div>
  )
}

export function GlassPopout({ open, onClose, title, children, width = 520 }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; width?: number
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 200, damping: 22 }}
            onClick={e => e.stopPropagation()}
            className="max-h-[85vh] overflow-auto rounded-2xl"
            style={{
              width,
              background: 'rgba(13, 13, 13, 0.9)',
              backdropFilter: 'blur(30px)',
              border: '1px solid rgba(201,162,39,0.2)',
              boxShadow: '0 0 60px rgba(201,162,39,0.12), 0 25px 50px rgba(0,0,0,0.5)',
            }}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-bold tracking-[3px] uppercase" style={{ color: 'var(--gold)' }}>{title}</h2>
                <button onClick={onClose}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs cursor-pointer transition-all hover:scale-110"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-d)' }}>&#x2715;</button>
              </div>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
