import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useTelegram } from './hooks/useTelegram'
import { TabBar } from './components/layout/TabBar'
import { ClientsPage } from './pages/ClientsPage'
import { ClientDetailPage } from './pages/ClientDetailPage'
import { LeadsPage } from './pages/LeadsPage'
import { TasksPage } from './pages/TasksPage'
import './styles/global.css'

export default function App() {
  const { theme } = useTelegram()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/clients" replace />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/clients/:id" element={<ClientDetailPage />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/tasks" element={<TasksPage />} />
      </Routes>
      <TabBar />
    </BrowserRouter>
  )
}
