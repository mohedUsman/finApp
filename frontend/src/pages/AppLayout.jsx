import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../shared/Sidebar'
import TopBar from '../shared/TopBar'
import { ToastProvider } from '../shared/ToastContext'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-slate-950" style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif' }}>
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-auto p-4 sm:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
