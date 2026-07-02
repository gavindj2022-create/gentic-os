import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { api } from '../lib/api'
import type { Skill, SchedulerStatus } from '../lib/types'
import { useWebSocket } from '../hooks/useWebSocket'
import AgentFace from '../components/AgentFace'
import { Play, Trash2, Plus, Clock, Pause, Power } from 'lucide-react'

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

interface ScheduleItem {
  id: string; name: string; cron: string; skill: string
  enabled: number; last_run?: string; next_run?: string
  payload?: Record<string, unknown>
}

const CRON_PRESETS = [
  { label: 'Every 5 min', cron: '*/5 * * * *' },
  { label: 'Every 30 min', cron: '*/30 * * * *' },
  { label: 'Hourly', cron: '0 * * * *' },
  { label: 'Daily 7 AM', cron: '0 7 * * *' },
  { label: 'Daily 9 PM', cron: '0 21 * * *' },
  { label: 'Weekly Sun 9 PM', cron: '0 21 * * 0' },
]

export default function Schedule() {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null)
  const [skills, setSkills] = useState<Skill[]>([])
  const [selected, setSelected] = useState<ScheduleItem | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCron, setNewCron] = useState('')
  const [newSkill, setNewSkill] = useState('')
  const { on } = useWebSocket()

  const load = useCallback(async () => {
    const [sData, ssData, skData] = await Promise.all([
      api.schedules().catch(() => ({ schedules: [] })),
      api.schedulerStatus().catch(() => null),
      api.skills().catch(() => ({ skills: [] })),
    ])
    setSchedules((sData as any).schedules || [])
    if (ssData) setSchedulerStatus(ssData as SchedulerStatus)
    setSkills((skData as any).skills || [])
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    return on('schedule_created', () => { load() })
  }, [on, load])

  const active = schedules.filter(s => s.enabled)
  const paused = schedules.filter(s => !s.enabled)

  const toggle = async (s: ScheduleItem) => {
    await api.updateSchedule(s.id, { enabled: !s.enabled })
    load()
  }

  const runNow = async (s: ScheduleItem) => {
    await api.runScheduleNow(s.id)
    load()
  }

  const remove = async (s: ScheduleItem) => {
    await api.deleteSchedule(s.id)
    setSchedules(prev => prev.filter(x => x.id !== s.id))
    setSelected(null)
  }

  const create = async () => {
    if (!newName.trim() || !newCron.trim() || !newSkill) return
    await api.createSchedule(newName.trim(), newCron.trim(), newSkill)
    setShowCreate(false)
    setNewName('')
    setNewCron('')
    setNewSkill('')
    load()
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
        <h1 className="text-[11px] tracking-[3px] uppercase" style={{ color: 'var(--gold)' }}>Scheduled Tasks</h1>
        {schedulerStatus && (
          <span className="flex items-center gap-1.5 text-[10px] ml-2">
            <span className="w-2 h-2 rounded-full" style={{ background: schedulerStatus.running ? 'var(--green)' : 'var(--red)' }} />
            <span style={{ color: schedulerStatus.running ? 'var(--green-t)' : 'var(--red)' }}>
              {schedulerStatus.running ? 'SCHEDULER ACTIVE' : 'SCHEDULER STOPPED'}
            </span>
          </span>
        )}
        <div className="flex-1" />
        <motion.button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase cursor-pointer"
          style={{ background: 'var(--gold)', color: '#000' }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
        >
          <Plus size={12} /> New Schedule
        </motion.button>
        <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: 'var(--gold)', color: '#000', fontWeight: 700 }}>
          {schedules.length}
        </span>
      </motion.div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Active', value: active.length, color: 'var(--green-t)', icon: Power },
          { label: 'Paused', value: paused.length, color: 'var(--gold)', icon: Pause },
          { label: 'Total', value: schedules.length, color: 'var(--cyan)', icon: Clock },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.07 }}
            className="p-4 text-center"
            style={glass}
          >
            <stat.icon size={16} className="mx-auto mb-2" style={{ color: stat.color }} />
            <div className="font-mono text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
            <div className="text-[9px] tracking-[1px] uppercase mt-0.5" style={{ color: 'var(--text-d)' }}>{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Schedule list */}
      {schedules.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="p-12 text-center"
          style={glass}
        >
          <AgentFace name="default" size={64} active={false} />
          <div className="text-sm mt-4 mb-1" style={{ color: 'var(--text-d)' }}>No schedules yet</div>
          <div className="text-[10px] mb-4" style={{ color: 'var(--text-d)' }}>Create a schedule to automate skill execution</div>
          <motion.button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 rounded-lg text-xs font-bold cursor-pointer"
            style={{ background: 'var(--gold)', color: '#000' }}
            whileHover={{ scale: 1.05 }}
          >
            Create First Schedule
          </motion.button>
        </motion.div>
      ) : (
        <div className="flex flex-col gap-2">
          {schedules.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.28 + i * 0.05 }}
              whileHover={{ scale: 1.01 }}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer"
              style={{
                ...glass,
                border: `1px solid ${s.enabled ? 'rgba(77,184,72,0.2)' : 'rgba(201,162,39,0.08)'}`,
                ...(s.enabled ? { boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 0 30px rgba(0,0,0,0.3), 0 0 15px rgba(77,184,72,0.06)' } : {}),
              }}
              onClick={() => setSelected(s)}
            >
              {/* Toggle */}
              <motion.button
                onClick={(e) => { e.stopPropagation(); toggle(s) }}
                className="w-9 h-5 rounded-full flex items-center px-0.5 cursor-pointer shrink-0"
                style={{
                  background: s.enabled ? 'rgba(77,184,72,0.3)' : 'rgba(255,255,255,0.08)',
                  border: `1px solid ${s.enabled ? 'rgba(77,184,72,0.4)' : 'rgba(255,255,255,0.1)'}`,
                }}
                whileTap={{ scale: 0.95 }}
              >
                <motion.div
                  className="w-3.5 h-3.5 rounded-full"
                  style={{ background: s.enabled ? 'var(--green)' : 'var(--text-d)' }}
                  animate={{ x: s.enabled ? 14 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </motion.button>

              <AgentFace name={s.skill} size={36} active={!!s.enabled} />

              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold" style={{ color: 'var(--gold)' }}>{s.name}</div>
                <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-d)' }}>{s.skill}</div>
              </div>

              <span className="font-mono text-[10px] px-2 py-1 rounded" style={{ background: 'rgba(0,200,200,0.08)', color: 'var(--cyan)', border: '1px solid rgba(0,200,200,0.15)' }}>
                {s.cron}
              </span>

              {s.next_run && (
                <span className="text-[9px] font-mono" style={{ color: 'var(--text-d)' }}>
                  next: {new Date(s.next_run).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
                </span>
              )}

              <EnabledBadge enabled={!!s.enabled} />

              {/* Action buttons */}
              <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                <motion.button
                  onClick={() => runNow(s)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer"
                  style={{ background: 'rgba(0,200,200,0.1)', border: '1px solid rgba(0,200,200,0.2)' }}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  title="Run now"
                >
                  <Play size={12} style={{ color: 'var(--cyan)' }} />
                </motion.button>
                <motion.button
                  onClick={() => remove(s)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer"
                  style={{ background: 'rgba(192,40,30,0.1)', border: '1px solid rgba(192,40,30,0.2)' }}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  title="Delete"
                >
                  <Trash2 size={12} style={{ color: 'var(--red)' }} />
                </motion.button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Schedule Detail Popout */}
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
              className="w-[500px] max-h-[80vh] overflow-y-auto p-6"
              style={popoutGlass}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="text-[10px] tracking-[2px] uppercase font-bold" style={{ color: 'var(--gold-d)' }}>
                  Schedule Detail
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs cursor-pointer transition-all hover:scale-110"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-d)' }}
                >&#x2715;</button>
              </div>

              <div className="flex items-center gap-4 mb-5">
                <AgentFace name={selected.skill} size={64} active={!!selected.enabled} />
                <div>
                  <div className="text-lg font-bold" style={{ color: 'var(--gold)' }}>{selected.name}</div>
                  <EnabledBadge enabled={!!selected.enabled} />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <InfoRow label="ID" value={selected.id} />
                <InfoRow label="Skill" value={selected.skill} />
                <InfoRow label="Cron" value={selected.cron} />
                <InfoRow label="Status" value={selected.enabled ? 'Active' : 'Paused'} />
                {selected.last_run && <InfoRow label="Last Run" value={selected.last_run} />}
                {selected.next_run && <InfoRow label="Next Run" value={selected.next_run} />}
              </div>

              <div className="flex gap-2 mt-5">
                <motion.button
                  onClick={() => { toggle(selected); setSelected(null) }}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold tracking-wider cursor-pointer"
                  style={{ background: selected.enabled ? 'rgba(201,162,39,0.15)' : 'rgba(77,184,72,0.15)', color: selected.enabled ? 'var(--gold)' : 'var(--green-t)', border: `1px solid ${selected.enabled ? 'rgba(201,162,39,0.3)' : 'rgba(77,184,72,0.3)'}` }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {selected.enabled ? 'PAUSE' : 'ENABLE'}
                </motion.button>
                <motion.button
                  onClick={() => { runNow(selected); setSelected(null) }}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold tracking-wider cursor-pointer"
                  style={{ background: 'rgba(0,200,200,0.15)', color: 'var(--cyan)', border: '1px solid rgba(0,200,200,0.3)' }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  RUN NOW
                </motion.button>
                <motion.button
                  onClick={() => remove(selected)}
                  className="py-2.5 px-4 rounded-xl text-xs font-bold tracking-wider cursor-pointer"
                  style={{ background: 'rgba(192,40,30,0.15)', color: 'var(--red)', border: '1px solid rgba(192,40,30,0.3)' }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  DELETE
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Schedule Popout */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 24 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="w-[480px] max-h-[85vh] overflow-y-auto p-6"
              style={popoutGlass}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="text-sm font-bold tracking-[3px] uppercase" style={{ color: 'var(--gold)' }}>
                  New Schedule
                </div>
                <button
                  onClick={() => setShowCreate(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs cursor-pointer transition-all hover:scale-110"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-d)' }}
                >&#x2715;</button>
              </div>

              {/* Name */}
              <div className="mb-4">
                <label className="text-[10px] tracking-[1px] uppercase mb-2 block" style={{ color: 'var(--gold-d)' }}>Name</label>
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Morning Brief"
                  className="w-full px-4 py-3 rounded-xl text-xs outline-none"
                  style={{ background: 'rgba(20,20,20,0.6)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-b)' }}
                />
              </div>

              {/* Skill */}
              <div className="mb-4">
                <label className="text-[10px] tracking-[1px] uppercase mb-2 block" style={{ color: 'var(--gold-d)' }}>Skill</label>
                <select
                  value={newSkill}
                  onChange={e => setNewSkill(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-xs outline-none cursor-pointer"
                  style={{ background: 'rgba(20,20,20,0.6)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-b)' }}
                >
                  <option value="">Select skill...</option>
                  {skills.map(sk => (
                    <option key={sk.name} value={sk.name}>{sk.name}</option>
                  ))}
                </select>
              </div>

              {/* Cron */}
              <div className="mb-4">
                <label className="text-[10px] tracking-[1px] uppercase mb-2 block" style={{ color: 'var(--gold-d)' }}>Cron Expression</label>
                <input
                  value={newCron}
                  onChange={e => setNewCron(e.target.value)}
                  placeholder="*/5 * * * *"
                  className="w-full px-4 py-3 rounded-xl text-xs font-mono outline-none"
                  style={{ background: 'rgba(20,20,20,0.6)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-b)' }}
                />
              </div>

              {/* Cron presets */}
              <div className="mb-5">
                <label className="text-[10px] tracking-[1px] uppercase mb-2 block" style={{ color: 'var(--gold-d)' }}>Quick Presets</label>
                <div className="flex flex-wrap gap-1.5">
                  {CRON_PRESETS.map(p => (
                    <motion.button
                      key={p.cron}
                      onClick={() => setNewCron(p.cron)}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-mono cursor-pointer"
                      style={{
                        background: newCron === p.cron ? 'rgba(0,200,200,0.15)' : 'rgba(20,20,20,0.5)',
                        border: `1px solid ${newCron === p.cron ? 'rgba(0,200,200,0.3)' : 'rgba(255,255,255,0.06)'}`,
                        color: newCron === p.cron ? 'var(--cyan)' : 'var(--text-d)',
                      }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {p.label}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Create button */}
              <motion.button
                onClick={create}
                disabled={!newName.trim() || !newCron.trim() || !newSkill}
                className="w-full py-3 rounded-xl text-xs font-bold tracking-wider uppercase cursor-pointer"
                style={{
                  background: (newName.trim() && newCron.trim() && newSkill) ? 'var(--gold)' : 'rgba(201,162,39,0.2)',
                  color: (newName.trim() && newCron.trim() && newSkill) ? '#000' : 'var(--text-d)',
                }}
                whileHover={(newName.trim() && newCron.trim() && newSkill) ? { scale: 1.02 } : {}}
                whileTap={(newName.trim() && newCron.trim() && newSkill) ? { scale: 0.98 } : {}}
              >
                Create Schedule
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function EnabledBadge({ enabled }: { enabled: boolean }) {
  return (
    <span className="text-[10px] px-2.5 py-1 rounded-full font-bold uppercase" style={{
      background: enabled ? 'rgba(77,184,72,0.15)' : 'rgba(201,162,39,0.1)',
      color: enabled ? 'var(--green-t)' : 'var(--text-d)',
    }}>
      {enabled ? '● active' : 'paused'}
    </span>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1.5" style={{ borderBottom: '1px solid rgba(201,162,39,0.08)' }}>
      <span className="text-[11px]" style={{ color: 'var(--text-d)' }}>{label}</span>
      <span className="font-mono text-[11px]" style={{ color: 'var(--text-b)' }}>{value}</span>
    </div>
  )
}
