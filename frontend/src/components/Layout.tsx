import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { LayoutDashboard, ListTodo, Bot, Brain, Zap, Settings, Activity, Users, Wallet, Lightbulb, Heart, Hammer, CalendarDays, Repeat, Send, PhoneCall } from 'lucide-react'
import { useState, useEffect } from 'react'
import AgentFace from './AgentFace'
import CommandPalette from './CommandPalette'

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Command Center', section: 'Command' },
  { to: '/build', icon: Hammer, label: 'Build', section: 'Command' },
  { to: '/jobs', icon: ListTodo, label: 'Jobs', section: 'Command' },
  { to: '/outbound', icon: Send, label: 'Outbound', section: 'Command' },
  { to: '/caller', icon: PhoneCall, label: 'Caller', section: 'Command' },
  { to: '/agents', icon: Bot, label: 'Agents', section: 'Intel' },
  { to: '/knowledge', icon: Brain, label: 'Knowledge', section: 'Intel' },
  { to: '/skills', icon: Zap, label: 'Skills', section: 'Execute' },
  { to: '/automations', icon: Repeat, label: 'Automations', section: 'Execute' },
  { to: '/schedule', icon: CalendarDays, label: 'Schedule', section: 'Life' },
  { to: '/workforce', icon: Users, label: 'Workforce', section: 'Workforce' },
  { to: '/budget', icon: Wallet, label: 'Budget', section: 'Workforce' },
  { to: '/insights', icon: Lightbulb, label: 'Insights', section: 'Workforce' },
  { to: '/life', icon: Heart, label: 'Life', section: 'Life' },
  { to: '/monitor', icon: Activity, label: 'Monitor', section: 'System' },
  { to: '/settings', icon: Settings, label: 'Settings', section: 'System' },
]

export default function Layout() {
  const location = useLocation()
  const [clock, setClock] = useState('')
  const [cmdPalette, setCmdPalette] = useState(false)

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-US', { hour12: false }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setCmdPalette(prev => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const sections = [...new Set(nav.map(n => n.section))]
  const callerMode = location.pathname.startsWith('/caller')

  if (callerMode) {
    return (
      <div className="h-screen overflow-hidden">
        <Outlet />
        <CommandPalette open={cmdPalette} onClose={() => setCmdPalette(false)} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      {/* TOP BAR */}
      <header className="h-12 flex items-center gap-4 px-5 shrink-0"
        style={{ background: 'rgba(13,13,13,0.4)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(201,162,39,0.12)' }}>
        <div className="flex items-center gap-3 shrink-0">
          <AgentFace name="gentic" size={28} />
          <span className="text-base font-bold tracking-[3px]" style={{ color: 'var(--gold)', textShadow: '0 0 12px rgba(201,162,39,0.4)' }}>
            GENTIC OS
          </span>
        </div>
        <div className="w-px h-6" style={{ background: 'var(--border)' }} />
        <div className="flex items-center gap-1.5 text-xs">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--green)', boxShadow: '0 0 8px var(--green)' }}>
            <div className="w-full h-full rounded-full pulse" style={{ background: 'var(--green)' }} />
          </div>
          <span className="font-bold tracking-wide" style={{ color: 'var(--green-t)' }}>ONLINE</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 px-3 py-1 rounded-full" style={{ background: 'rgba(0,200,200,0.08)', border: '1px solid rgba(0,200,200,0.2)' }}>
          <Activity size={12} style={{ color: 'var(--cyan)' }} />
          <span className="text-[10px] font-bold tracking-wide" style={{ color: 'var(--cyan)' }}>LIVE</span>
        </div>
        <div className="w-px h-6" style={{ background: 'var(--border)' }} />
        <span className="font-mono text-sm font-bold" style={{ color: 'var(--gold-b)' }}>{clock}</span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
        <nav className="w-[180px] shrink-0 flex flex-col overflow-hidden"
          style={{ background: 'rgba(13,13,13,0.4)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRight: '1px solid rgba(201,162,39,0.08)' }}>
          {sections.map(section => (
            <div key={section} className="py-1.5">
              <div className="px-4 py-1.5 text-[9px] tracking-[2px] uppercase" style={{ color: 'var(--text-d)' }}>
                {section}
              </div>
              {nav.filter(n => n.section === section).map(item => (
                <NavLink key={item.to} to={item.to} end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-4 py-2.5 text-xs tracking-wide border-l-2 transition-all cursor-pointer ${
                      isActive ? 'border-l-[var(--gold)]' : 'border-l-transparent hover:bg-[rgba(201,162,39,0.04)]'
                    }`
                  }
                  style={({ isActive }) => ({
                    color: isActive ? 'var(--gold)' : 'var(--text-d)',
                    background: isActive ? 'var(--gold-m)' : undefined,
                    fontWeight: isActive ? 700 : 400,
                  })}
                >
                  <item.icon size={14} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}

          {/* Bottom avatar area */}
          <div className="mt-auto p-4 flex items-center gap-3"
            style={{ borderTop: '1px solid var(--border)' }}>
            <AgentFace name="olivia" size={32} />
            <div>
              <div className="text-[10px] font-bold tracking-wide" style={{ color: 'var(--cyan)' }}>OLIVIA</div>
              <div className="text-[9px]" style={{ color: 'var(--text-d)' }}>Listening</div>
            </div>
          </div>
        </nav>

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto p-5">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={cmdPalette} onClose={() => setCmdPalette(false)} />

      {/* BOTTOM TICKER */}
      <footer className="h-7 flex items-center shrink-0 overflow-hidden"
        style={{ background: 'rgba(13,13,13,0.4)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderTop: '1px solid rgba(201,162,39,0.12)' }}>
        <div className="px-3 text-[9px] tracking-[2px] shrink-0 font-bold" style={{ color: 'var(--gold-d)', borderRight: '1px solid var(--border)' }}>
          GENTIC
        </div>
        <div className="flex gap-8 px-4 text-[10px] whitespace-nowrap" style={{ color: 'var(--text-d)' }}>
          <span>v0.4.0</span>
          <span>Port <span style={{ color: 'var(--text-b)' }}>7777</span></span>
          <span>Phase <span style={{ color: 'var(--gold)' }}>4</span></span>
        </div>
      </footer>
    </div>
  )
}
