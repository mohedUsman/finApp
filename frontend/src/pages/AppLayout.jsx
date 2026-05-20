import { Outlet } from 'react-router-dom'
import Sidebar from '../shared/Sidebar'
import TopBar from '../shared/TopBar'
import { ToastProvider } from '../shared/ToastContext'

export default function AppLayout() {
  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-slate-950" style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif' }}>
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
