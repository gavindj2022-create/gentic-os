import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { api } from '../lib/api'
import type { Skill } from '../lib/types'
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

export default function Skills() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [triggered, setTriggered] = useState<string | null>(null)
  const [selected, setSelected] = useState<Skill | null>(null)

  useEffect(() => {
    api.skills().then((d: any) => setSkills(d.skills || [])).catch(() => {})
  }, [])

  const trigger = async (skill: Skill) => {
    setTriggered(skill.name)
    try { await api.createJob(skill.name) } catch {}
    setTimeout(() => setTriggered(null), 2000)
  }

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center gap-2 mb-5 pb-2"
        style={{ borderBottom: '1px solid rgba(201,162,39,0.15)' }}
      >
        <div className="w-[3px] h-3.5 rounded-sm" style={{ background: 'var(--gold)' }} />
        <h1 className="text-[11px] tracking-[3px] uppercase" style={{ color: 'var(--gold)' }}>Skills</h1>
        <span className="ml-auto text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: 'var(--gold)', color: '#000', fontWeight: 700 }}>
          {skills.length}
        </span>
      </motion.div>

      {/* Skills grid */}
      {skills.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="p-12 text-center"
          style={glass}
        >
          <AgentFace name="default" size={64} active={false} />
          <div className="text-sm mt-4 mb-1" style={{ color: 'var(--text-d)' }}>No skills found</div>
          <div className="text-[10px]" style={{ color: 'var(--text-d)' }}>Skills load from ~/.claude/commands/</div>
        </motion.div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {skills.map((skill, i) => {
            const isActive = triggered === skill.name
            return (
              <motion.div
                key={skill.name}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.06 }}
                whileHover={{ scale: 1.015 }}
                className="p-4 cursor-pointer group"
                style={{
                  ...glass,
                  border: `1px solid ${isActive ? 'var(--gold)' : 'rgba(201,162,39,0.12)'}`,
                  ...(isActive ? { boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 0 30px rgba(0,0,0,0.3), 0 0 24px rgba(201,162,39,0.15)' } : {}),
                }}
                onClick={() => setSelected(skill)}
              >
                <div className="flex items-center gap-3 mb-3">
                  <AgentFace name={skill.name} size={36} active />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold truncate" style={{ color: 'var(--gold)' }}>{skill.name}</div>
                  </div>
                </div>

                <div className="text-[10px] leading-relaxed mb-3 line-clamp-2" style={{ color: 'var(--text-d)' }}>
                  {skill.description || 'No description'}
                </div>

                <div className="flex gap-2">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => { e.stopPropagation(); trigger(skill) }}
                    className="flex-1 py-2 rounded-lg text-[10px] font-bold tracking-wide cursor-pointer transition-colors"
                    style={{
                      background: isActive ? 'rgba(201,162,39,0.15)' : 'var(--gold)',
                      color: isActive ? 'var(--gold)' : '#000',
                      border: isActive ? '1px solid var(--gold)' : '1px solid transparent',
                    }}
                  >
                    {isActive ? '✓ QUEUED' : '▶ RUN'}
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => { e.stopPropagation(); setSelected(skill) }}
                    className="px-3 py-2 rounded-lg text-[10px] font-bold tracking-wide cursor-pointer transition-colors"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      color: 'var(--text-d)',
                      border: '1px solid rgba(201,162,39,0.1)',
                    }}
                  >
                    &middot;&middot;&middot;
                  </motion.button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Skill Detail Popout */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 24 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="w-[460px] p-6"
              style={popoutGlass}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Popout header */}
              <div className="flex items-center justify-between mb-5">
                <div className="text-[10px] tracking-[2px] uppercase font-bold" style={{ color: 'var(--gold-d)' }}>
                  {selected.name}
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs cursor-pointer transition-all hover:scale-110"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-d)' }}
                >
                  x
                </button>
              </div>

              <div className="flex items-center gap-4 mb-5">
                <AgentFace name={selected.name} size={64} active />
                <div>
                  <div className="text-lg font-bold" style={{ color: 'var(--gold)' }}>{selected.name}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-d)' }}>{selected.description || 'No description'}</div>
                </div>
              </div>

              <div className="p-4 rounded-lg mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,162,39,0.08)' }}>
                <div className="text-[10px] tracking-[1px] uppercase mb-2" style={{ color: 'var(--gold-d)' }}>File</div>
                <div className="text-[11px] font-mono break-all" style={{ color: 'var(--text-b)' }}>{selected.file}</div>
              </div>

              <motion.button
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.02 }}
                onClick={() => { trigger(selected); setSelected(null) }}
                className="w-full py-3.5 rounded-lg text-sm font-bold tracking-wide cursor-pointer"
                style={{ background: 'var(--gold)', color: '#000' }}
              >
                ▶ Run This Skill
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
