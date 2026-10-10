import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { LayoutDashboard, Receipt, Repeat, Calendar, Wallet, Tags, LogOut, Trash2, X, PiggyBank, Search, CalendarRange, Hash, GitCompare, Settings } from 'lucide-react'
import DeleteAccountModal from './DeleteAccountModal'

const nav = [
  { to: '/dashboard',       label: 'Dashboard',      Icon: LayoutDashboard },
  { to: '/networth',        label: 'Net Worth',      Icon: Wallet },
  { to: '/transactions',    label: 'Transactions',   Icon: Receipt },
  { to: '/search',          label: 'Search',         Icon: Search },
  { to: '/recurring',       label: 'Recurring',      Icon: Repeat },
  { to: '/savings-goals',   label: 'Savings Goals',  Icon: PiggyBank },
  { to: '/quarterly',       label: 'Quarterly',      Icon: Calendar },
  { to: '/reports/range',   label: 'Custom Range',   Icon: CalendarRange },
  { to: '/reports/yoy',     label: 'Year over Year', Icon: GitCompare },
  { to: '/categories',      label: 'Categories',     Icon: Tags },
  { to: '/tags',            label: 'Tags',           Icon: Hash },
  { to: '/settings',        label: 'Settings',       Icon: Settings },
]

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth()
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  return (
    <>
      {/* Mobile scrim */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/60 sm:hidden" onClick={onClose} />
      )}

      <aside className={`
        w-56 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 h-screen
        fixed sm:sticky top-0 z-40 transition-transform duration-200
        ${open ? 'translate-x-0' : '-translate-x-full'} sm:translate-x-0
      `}>
        <div className="px-5 py-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4 text-slate-900" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">FinTrack</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Personal Finance</div>
            </div>
          </div>
          <button onClick={onClose} className="sm:hidden text-slate-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
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
          <button
            onClick={() => setShowDeleteModal(true)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-600 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            Delete Account
          </button>
        </div>

        {showDeleteModal && <DeleteAccountModal onClose={() => setShowDeleteModal(false)} />}
      </aside>
    </>
  )
}
