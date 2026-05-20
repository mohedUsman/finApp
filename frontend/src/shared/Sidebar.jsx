import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { LayoutDashboard, Receipt, Repeat, Calendar, Wallet, Tags, LogOut } from 'lucide-react'

const nav = [
  { to: '/dashboard',    label: 'Dashboard',    Icon: LayoutDashboard },
  { to: '/networth',     label: 'Net Worth',    Icon: Wallet },
  { to: '/transactions', label: 'Transactions', Icon: Receipt },
  { to: '/recurring',    label: 'Recurring',    Icon: Repeat },
  { to: '/quarterly',    label: 'Quarterly',    Icon: Calendar },
  { to: '/categories',   label: 'Categories',   Icon: Tags },
]

export default function Sidebar() {
  const { user, logout } = useAuth()

  return (
    <aside className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shrink-0">
            <Wallet className="w-4 h-4 text-slate-900" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">FinTrack</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Personal Finance</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {nav.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="w-4 h-4 shrink-0" />
                <span>{label}</span>
                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-800">
        <div className="px-3 py-1 text-[10px] text-slate-600 truncate mb-1">{user?.email}</div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Logout
        </button>
      </div>
    </aside>
  )
}
