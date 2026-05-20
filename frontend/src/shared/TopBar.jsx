import { useQuery } from '@tanstack/react-query'
import api from '../lib/apiClient'

function fmtCompact(minor) {
  if (minor == null) return '—'
  const abs = Math.abs(minor) / 100
  const sign = minor < 0 ? '-' : ''
  if (abs >= 10000000) return sign + '₹' + (abs / 10000000).toFixed(2) + 'Cr'
  if (abs >= 100000)   return sign + '₹' + (abs / 100000).toFixed(2) + 'L'
  if (abs >= 1000)     return sign + '₹' + (abs / 1000).toFixed(1) + 'K'
  return sign + '₹' + abs.toFixed(0)
}

function QuickStat({ label, value, positive, negative }) {
  return (
    <div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${
        positive ? 'text-emerald-400' : negative ? 'text-rose-400' : 'text-white'
      }`}>{value ?? '—'}</div>
    </div>
  )
}

export default function TopBar() {
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

  return (
    <div className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-3 flex items-center gap-6 sticky top-0 z-10">
      <div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider">Current Period</div>
        <div className="text-sm font-semibold text-white">{periodLabel}</div>
      </div>
      <div className="h-8 w-px bg-slate-800" />
      <QuickStat label="Cash Income"  value={fmtCompact(report?.totalActualIncomeMinor)}  positive />
      <QuickStat label="Cash Expense" value={fmtCompact(report?.totalActualExpenseMinor)} negative />
      <QuickStat
        label="Net Cash"
        value={fmtCompact(net)}
        positive={net != null && net >= 0}
        negative={net != null && net < 0}
      />
      <div className="h-8 w-px bg-slate-800" />
      <QuickStat label="Open Planned" value={report?.expectedTransactionCount ?? '—'} />
      <div className="ml-auto text-xs text-slate-500">{todayStr}</div>
    </div>
  )
}
