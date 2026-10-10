import { useQuery } from '@tanstack/react-query'
import { Menu } from 'lucide-react'
import api from '../lib/apiClient'
import { useAuth } from '../auth/AuthContext'

const CURRENCY_SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', AUD: '$', CAD: '$', SGD: '$', CHF: 'CHF ', AED: 'AED ' }

function fmtCompact(minor, currencyCode) {
  if (minor == null) return '—'
  const symbol = CURRENCY_SYMBOLS[currencyCode] ?? (currencyCode ? currencyCode + ' ' : '₹')
  const abs = Math.abs(minor) / 100
  const sign = minor < 0 ? '-' : ''
  // The Indian numbering suffixes (L/Cr) only make sense for INR; other
  // currencies fall back to the more familiar K/M.
  if (currencyCode && currencyCode !== 'INR') {
    if (abs >= 1000000) return sign + symbol + (abs / 1000000).toFixed(2) + 'M'
    if (abs >= 1000)    return sign + symbol + (abs / 1000).toFixed(1) + 'K'
    return sign + symbol + abs.toFixed(0)
  }
  if (abs >= 10000000) return sign + symbol + (abs / 10000000).toFixed(2) + 'Cr'
  if (abs >= 100000)   return sign + symbol + (abs / 100000).toFixed(2) + 'L'
  if (abs >= 1000)     return sign + symbol + (abs / 1000).toFixed(1) + 'K'
  return sign + symbol + abs.toFixed(0)
}

function QuickStat({ label, value, positive, negative }) {
  return (
    <div className="shrink-0">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider whitespace-nowrap">{label}</div>
      <div className={`text-sm font-semibold tabular-nums whitespace-nowrap ${
        positive ? 'text-emerald-400' : negative ? 'text-rose-400' : 'text-white'
      }`}>{value ?? '—'}</div>
    </div>
  )
}

export default function TopBar({ onMenuClick }) {
  const { user } = useAuth()
  const today = new Date()
  const year  = today.getFullYear()
  const month = today.getMonth() + 1

  const { data: report } = useQuery({
    queryKey: ['report', 'monthly', year, month],
    queryFn: () => api.get(`/reports/monthly?year=${year}&month=${month}`).then(r => r.data),
    staleTime: 60_000,
  })

  const periodLabel = today.toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const todayStr    = today.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const net         = report?.netActualMinor ?? null
  const baseCurrency = user?.baseCurrencyCode ?? 'INR'

  return (
    <div className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-3 sm:px-6 py-3 flex items-center gap-4 sm:gap-6 sticky top-0 z-10 overflow-x-auto">
      <button onClick={onMenuClick} className="sm:hidden text-slate-400 hover:text-white shrink-0">
        <Menu className="w-5 h-5" />
      </button>
      <div className="shrink-0">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider">Current Period</div>
        <div className="text-sm font-semibold text-white whitespace-nowrap">{periodLabel}</div>
      </div>
      <div className="h-8 w-px bg-slate-800 shrink-0 hidden sm:block" />
      <QuickStat label="Cash Income"  value={fmtCompact(report?.totalActualIncomeMinor, baseCurrency)}  positive />
      <QuickStat label="Cash Expense" value={fmtCompact(report?.totalActualExpenseMinor, baseCurrency)} negative />
      <QuickStat
        label="Net Cash"
        value={fmtCompact(net, baseCurrency)}
        positive={net != null && net >= 0}
        negative={net != null && net < 0}
      />
      <div className="h-8 w-px bg-slate-800 shrink-0 hidden sm:block" />
      <QuickStat label="Open Planned" value={report?.expectedTransactionCount ?? '—'} />
      <div className="ml-auto text-xs text-slate-500 whitespace-nowrap hidden md:block">{todayStr}</div>
    </div>
  )
}
