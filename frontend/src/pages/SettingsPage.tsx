import { useEffect, useState, useCallback } from 'react'
import { motion } from 'motion/react'
import { api } from '../lib/api'
import type { HealthData, SchedulerStatus } from '../lib/types'
import { useWebSocket } from '../hooks/useWebSocket'
import { Cpu, HardDrive, MemoryStick, Wifi, WifiOff, Server } from 'lucide-react'

const glass = {
  background: 'rgba(13,13,13,0.6)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(201,162,39,0.12)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 0 30px rgba(0,0,0,0.3)',
  borderRadius: '16px',
}

export default function SettingsPage() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [scheduler, setScheduler] = useState<SchedulerStatus | null>(null)
  const [oliviaOnline, setOliviaOnline] = useState(false)
  const { connected } = useWebSocket()

  const load = useCallback(async () => {
    const [h, ss, sys] = await Promise.all([
      api.health().catch(() => null),
      api.schedulerStatus().catch(() => null),
      api.system().catch(() => null),
    ])
    if (h) setHealth(h as HealthData)
    if (ss) setScheduler(ss as SchedulerStatus)
    if (sys) setOliviaOnline((sys as any).olivia?.online ?? false)
  }, [])

  useEffect(() => { load() }, [load])

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
        <h1 className="text-[11px] tracking-[3px] uppercase" style={{ color: 'var(--gold)' }}>Settings</h1>
      </motion.div>

      <div className="grid grid-cols-2 gap-4">
        {/* System Info */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
          className="p-5"
          style={glass}
        >
          <div className="text-[10px] tracking-[2px] uppercase font-bold mb-4" style={{ color: 'var(--gold-d)' }}>
            System Info
          </div>
          <InfoRow label="GenTIC OS Version" value="0.3.0" />
          <InfoRow label="Phase" value="3 — Full Dashboard" />
          <InfoRow label="Architecture" value="FastAPI + React + SQLite" />
          <InfoRow label="Backend Port" value="7777" />
          <InfoRow label="OLIVIA Port" value="5555" />
          <InfoRow label="Obsidian REST API" value="27124" />
        </motion.div>

        {/* Connection Status */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.07 }}
          className="p-5"
          style={glass}
        >
          <div className="text-[10px] tracking-[2px] uppercase font-bold mb-4" style={{ color: 'var(--gold-d)' }}>
            Connections
          </div>
          <ConnectionRow label="OLIVIA" online={oliviaOnline} />
          <ConnectionRow label="WebSocket" online={connected} />
          <ConnectionRow label="Scheduler" online={scheduler?.running ?? false} />
          <ConnectionRow label="Backend" online={health?.status === 'healthy' || health?.status === 'degraded'} />
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(201,162,39,0.08)' }}>
            <div className="flex justify-between items-center">
              <span className="text-[11px]" style={{ color: 'var(--text-d)' }}>Scheduled Jobs</span>
              <span className="font-mono text-[11px] font-semibold" style={{ color: 'var(--cyan)' }}>
                {scheduler?.job_count ?? 0}
              </span>
            </div>
          </div>
        </motion.div>

        {/* System Health */}
        {health && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14 }}
            className="p-5 col-span-2"
            style={glass}
          >
            <div className="text-[10px] tracking-[2px] uppercase font-bold mb-4" style={{ color: 'var(--gold-d)' }}>
              System Health
            </div>
            <div className="grid grid-cols-4 gap-4">
              <HealthBar
                icon={Cpu}
                label="CPU"
                value={health.cpu_percent}
                detail={`${health.cpu_percent.toFixed(1)}%`}
              />
              <HealthBar
                icon={MemoryStick}
                label="Memory"
                value={health.memory_percent}
                detail={`${health.memory_used_gb}/${health.memory_total_gb} GB`}
              />
              <HealthBar
                icon={HardDrive}
                label="Disk"
                value={health.disk_percent}
                detail={`${health.disk_free_gb} GB free`}
              />
              <div className="text-center">
                <Server size={20} className="mx-auto mb-2" style={{ color: 'var(--gold)' }} />
                <div className="font-mono text-lg font-bold" style={{ color: 'var(--gold-b)' }}>
                  {health.uptime_hours.toFixed(0)}h
                </div>
                <div className="text-[9px] tracking-[1px] uppercase" style={{ color: 'var(--text-d)' }}>Uptime</div>
                <div className="mt-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase" style={{
                    background: health.status === 'healthy' ? 'rgba(77,184,72,0.15)' : 'rgba(201,162,39,0.15)',
                    color: health.status === 'healthy' ? 'var(--green-t)' : 'var(--gold)',
                  }}>
                    {health.status}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1.5" style={{ borderBottom: '1px solid rgba(201,162,39,0.08)' }}>
      <span className="text-[11px]" style={{ color: 'var(--text-d)' }}>{label}</span>
      <span className="font-mono text-[11px] font-semibold" style={{ color: 'var(--text-b)' }}>{value}</span>
    </div>
  )
}

function ConnectionRow({ label, online }: { label: string; online: boolean }) {
  return (
    <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid rgba(201,162,39,0.08)' }}>
      <div className="flex items-center gap-2">
        {online ? <Wifi size={12} style={{ color: 'var(--green-t)' }} /> : <WifiOff size={12} style={{ color: 'var(--red)' }} />}
        <span className="text-[11px]" style={{ color: 'var(--text-d)' }}>{label}</span>
      </div>
      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase" style={{
        background: online ? 'rgba(77,184,72,0.15)' : 'rgba(192,40,30,0.15)',
        color: online ? 'var(--green-t)' : 'var(--red)',
      }}>
        {online ? 'connected' : 'offline'}
      </span>
    </div>
  )
}

function HealthBar({ icon: Icon, label, value, detail }: { icon: any; label: string; value: number; detail: string }) {
  const color = value < 60 ? 'var(--green-t)' : value < 85 ? 'var(--gold)' : 'var(--red)'
  return (
    <div className="text-center">
      <Icon size={20} className="mx-auto mb-2" style={{ color }} />
      <div className="font-mono text-lg font-bold" style={{ color }}>{value.toFixed(0)}%</div>
      <div className="text-[9px] tracking-[1px] uppercase" style={{ color: 'var(--text-d)' }}>{label}</div>
      <div className="w-full h-1.5 rounded-full mt-2 overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
        />
      </div>
      <div className="text-[9px] font-mono mt-1" style={{ color: 'var(--text-d)' }}>{detail}</div>
    </div>
  )
}
