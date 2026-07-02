import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import CommandCenter from './pages/CommandCenter'
import Jobs from './pages/Jobs'
import Agents from './pages/Agents'
import Knowledge from './pages/Knowledge'
import Skills from './pages/Skills'
import Schedule from './pages/Schedule'
import MySchedule from './pages/MySchedule'
import SettingsPage from './pages/SettingsPage'
import Monitor from './pages/Monitor'
import Build from './pages/Build'
import Workforce from './pages/Workforce'
import Budget from './pages/Budget'
import Insights from './pages/Insights'
import Life from './pages/Life'
import Outbound from './pages/Outbound'
import OutboundCaller from './pages/OutboundCaller'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<CommandCenter />} />
          <Route path="build" element={<Build />} />
          <Route path="jobs" element={<Jobs />} />
          <Route path="outbound" element={<Outbound />} />
          <Route path="caller" element={<OutboundCaller />} />
          <Route path="agents" element={<Agents />} />
          <Route path="knowledge" element={<Knowledge />} />
          <Route path="skills" element={<Skills />} />
          <Route path="schedule" element={<MySchedule />} />
          <Route path="automations" element={<Schedule />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="monitor" element={<Monitor />} />
          <Route path="workforce" element={<Workforce />} />
          <Route path="budget" element={<Budget />} />
          <Route path="insights" element={<Insights />} />
          <Route path="life" element={<Life />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
