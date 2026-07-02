import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { Variants } from 'motion/react'
import { api } from '../lib/api'
import type { SystemStatus } from '../lib/types'
import AgentFace from '../components/AgentFace'

const glass = {
  background: 'rgba(13,13,13,0.6)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(201,162,39,0.12)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 0 30px rgba(0,0,0,0.3)',
  borderRadius: '16px',
}

const popoutGlass = {
  background: 'rgba(13,13,13,0.9)',
  backdropFilter: 'blur(30px)',
  border: '1px solid rgba(201,162,39,0.2)',
  boxShadow: '0 0 60px rgba(201,162,39,0.12), 0 25px 50px rgba(0,0,0,0.5)',
  borderRadius: '20px',
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
}

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } },
}

export default function Agents() {
  const [system, setSystem] = useState<SystemStatus | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    api.system().then(d => setSystem(d as SystemStatus)).catch(() => {})
  }, [])

  const agents = system?.olivia?.active_subagents || []
  const ais = system?.olivia?.available_ais || {}
  const projects = system?.olivia?.active_projects || []

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center gap-2 mb-6 pb-2"
        style={{ borderBottom: '1px solid rgba(201,162,39,0.2)' }}
      >
        <div className="w-[3px] h-4 rounded-sm" style={{ background: 'var(--gold)' }} />
        <h1 className="text-[11px] tracking-[3px] uppercase font-semibold" style={{ color: 'var(--gold)' }}>
          Agents
        </h1>
        <span
          className="ml-auto text-xs font-mono px-2.5 py-0.5 rounded-full font-bold"
          style={{ background: 'var(--cyan)', color: '#000' }}
        >
          {agents.length + Object.keys(ais).length}
        </span>
      </motion.div>

      {/* Core AI Systems -- 4 large cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-4 gap-4 mb-6"
      >
        {Object.entries(ais).map(([name, online]) => (
          <motion.div
            key={name}
            variants={item}
            whileHover={{ scale: 1.05, boxShadow: '0 12px 40px rgba(0,0,0,0.5), inset 0 0 30px rgba(0,0,0,0.3)' }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setSelected(name)}
            className="p-6 flex flex-col items-center gap-3 cursor-pointer"
            style={{
              ...glass,
              borderColor: online ? 'rgba(77,184,72,0.25)' : 'rgba(201,162,39,0.12)',
            }}
          >
            <AgentFace name={name} size={64} active={!!online} />
            <span
              className="text-sm font-bold uppercase tracking-widest"
              style={{ color: online ? 'var(--text-b)' : 'var(--text-d)' }}
            >
              {name}
            </span>
            <div className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  background: online ? '#4db848' : '#c0281e',
                  boxShadow: online ? '0 0 8px rgba(77,184,72,0.6)' : 'none',
                }}
              />
              <span
                className="text-[9px] uppercase font-bold tracking-wider"
                style={{ color: online ? '#4db848' : '#c0281e' }}
              >
                {online ? 'Online' : 'Offline'}
              </span>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Sub-Agents -- 2-column grid with 40px faces */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="p-5 mb-6"
        style={glass}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] tracking-[2px] uppercase font-semibold" style={{ color: 'var(--gold-d)' }}>
            Active Sub-Agents
          </span>
          <span className="text-[10px] font-mono" style={{ color: 'var(--text-d)' }}>
            {agents.length} running
          </span>
        </div>
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 gap-3"
        >
          {agents.map((agent, i) => (
            <motion.div
              key={i}
              variants={item}
              whileHover={{ scale: 1.03, borderColor: 'rgba(201,162,39,0.25)' }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelected(agent)}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer"
              style={{
                background: 'rgba(20,20,20,0.5)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(201,162,39,0.08)',
                borderRadius: '12px',
              }}
            >
              <AgentFace name={agent} size={40} active />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate" style={{ color: 'var(--text-b)' }}>
                  {agent}
                </div>
              </div>
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  background: '#4db848',
                  boxShadow: '0 0 8px rgba(77,184,72,0.6)',
                  animation: 'pulse 2s ease-in-out infinite',
                }}
              />
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* Active Projects */}
      <AnimatePresence>
        {projects.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ delay: 0.45, duration: 0.5 }}
            className="p-5"
            style={glass}
          >
            <div className="text-[10px] tracking-[2px] uppercase font-semibold mb-4" style={{ color: 'var(--gold-d)' }}>
              Active Projects
            </div>
            <motion.div variants={container} initial="hidden" animate="show" className="space-y-2">
              {projects.map((p, i) => (
                <motion.div
                  key={i}
                  variants={item}
                  whileHover={{ scale: 1.02 }}
                  className="flex items-center gap-4 px-4 py-3.5"
                  style={{
                    background: 'rgba(20,20,20,0.5)',
                    backdropFilter: 'blur(12px)',
                    borderRadius: '12px',
                    borderLeft: '3px solid var(--gold)',
                  }}
                >
                  <AgentFace name="gentic" size={36} active />
                  <div>
                    <div className="text-sm font-bold" style={{ color: 'var(--gold)' }}>{p.name}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-d)' }}>{p.phase}</div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Agent Detail Popout */}
      <AnimatePresence>
        {selected && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setSelected(null)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(4px)',
                zIndex: 90,
              }}
            />
            {/* Popout panel */}
            <motion.div
              key="popout"
              initial={{ opacity: 0, scale: 0.92, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 30 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 420,
                maxHeight: '80vh',
                overflowY: 'auto',
                zIndex: 100,
                ...popoutGlass,
              }}
            >
              {/* Close button */}
              <button
                onClick={() => setSelected(null)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-d)' }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>

              <div className="flex flex-col items-center py-8 px-6">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 20 }}
                >
                  <AgentFace name={selected} size={80} active />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="text-lg font-bold mt-4 uppercase tracking-wider"
                  style={{ color: 'var(--gold)' }}
                >
                  {selected}
                </motion.div>

                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-[10px] px-3 py-1 rounded-full mt-2 font-bold uppercase tracking-wider"
                  style={{ background: 'rgba(77,184,72,0.15)', color: '#4db848' }}
                >
                  Active
                </motion.span>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="w-full mt-6 p-4"
                  style={{
                    background: 'rgba(20,20,20,0.5)',
                    backdropFilter: 'blur(12px)',
                    borderRadius: '12px',
                    border: '1px solid rgba(201,162,39,0.08)',
                  }}
                >
                  <div className="text-[10px] tracking-[1px] uppercase mb-2 font-semibold" style={{ color: 'var(--gold-d)' }}>
                    Status
                  </div>
                  <div className="text-xs leading-relaxed" style={{ color: 'var(--text-b)' }}>
                    Running and operational. Click skills to assign tasks to this agent.
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
