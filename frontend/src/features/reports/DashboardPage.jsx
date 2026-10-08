import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'
import { RefreshCw, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import api from '../../lib/apiClient'
import { formatCurrency, monthName, currentYearMonth, prevMonth, nextMonth } from '../../lib/format'
import KpiCard from '../../shared/KpiCard'
import { queryClient } from '../../lib/queryClient'
import { useToast } from '../../shared/ToastContext'


function fmt(v) { return formatCurrency(v) }


export default function DashboardPage() {
  const [ym, setYm] = useState(currentYearMonth())
  const toast = useToast()

  const from    = `${ym.year}-${String(ym.month).padStart(2, '0')}-01`
  const lastDay = new Date(ym.year, ym.month, 0).getDate()
  const to      = `${ym.year}-${String(ym.month).padStart(2, '0')}-${lastDay}`

  const { data: report, isLoading } = useQuery({
    queryKey: ['report', 'monthly', ym.year, ym.month],
    queryFn: () => api.get(`/reports/monthly?year=${ym.year}&month=${ym.month}`).then(r => r.data),
  })

  // Fetch raw transactions so we can aggregate ALL categories that had cash flow,
  // including ACTUAL-only entries that have no expected_date and are invisible in byCategory.
  const { data: txData } = useQuery({
    queryKey: ['transactions', ym.year, ym.month],
    queryFn: () => api.get(`/transactions?from=${from}&to=${to}&size=500`).then(r => r.data),
  })

  const generateMutation = useMutation({
    mutationFn: () => api.post('/recurring/generate'),
    onSuccess: ({ data }) => {
      toast.success(`Generated ${data.generatedCount} transactions`)
      queryClient.invalidateQueries({ queryKey: ['report'] })
    },
    onError: () => toast.error('Generation failed'),
  })

  // Aggregate ALL categories from raw transactions (both plan-lens and cash-lens),
  // so categories with only actual_date (no expected_date) are included.
  const monthlySummary = (() => {
    const txList = txData?.content ?? []
    const map = new Map()
    txList.forEach(tx => {
      const key = tx.categoryName ?? 'Unknown'
      if (!map.has(key)) map.set(key, { name: key, type: tx.type, actual: 0, planned: 0 })
      const e = map.get(key)
      if (tx.status === 'ACTUAL')    e.actual  += Number(tx.actualAmountMinor   ?? 0)
      if (tx.status === 'EXPECTED')  e.planned += Number(tx.expectedAmountMinor ?? 0)
    })
    return [...map.values()]
      .filter(c => c.actual + c.planned > 0)
      .sort((a, b) => (b.actual || b.planned) - (a.actual || a.planned))
  })()

  const varianceData = report?.byCategory
    .slice(0, 10)
    .map(c => ({
      name: c.categoryName.length > 14 ? c.categoryName.slice(0, 14) + '…' : c.categoryName,
      expected: c.expectedAmountMinor / 100,
      actual: c.actualAmountMinor / 100,
    })) ?? []

  const trendData = report?.dailyActualTrend.map(d => ({
    date: d.date.slice(8),
    income: d.incomeMinor / 100,
    expense: d.expenseMinor / 100,
  })) ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setYm(p => prevMonth(p.year, p.month))}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400">‹</button>
          <h1 className="text-xl font-bold text-slate-100">
            {monthName(ym.month)} {ym.year}
          </h1>
          <button onClick={() => setYm(p => nextMonth(p.year, p.month))}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400">›</button>
        </div>
        <button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-md transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          <RefreshCw className="w-4 h-4" /> Generate Recurring
        </button>
      </div>

      {isLoading ? (
        <div className="text-slate-500 text-sm">Loading…</div>
      ) : (
        <>
          {/* KPI Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Planned Income"  value={fmt(report?.totalExpectedIncomeMinor)}  icon={ArrowUpRight}   color="emerald" muted sub="By expected date" />
            <KpiCard label="Cash Income"     value={fmt(report?.totalActualIncomeMinor)}    icon={TrendingUp}     color="emerald"       sub="By actual date" />
            <KpiCard label="Planned Expense" value={fmt(report?.totalExpectedExpenseMinor)} icon={ArrowDownRight} color="rose"    muted sub="By expected date" />
            <KpiCard label="Cash Expense"    value={fmt(report?.totalActualExpenseMinor)}   icon={TrendingDown}   color="rose"          sub="By actual date" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <KpiCard label="Net Planned" value={fmt(report?.netExpectedMinor)}
              color={(report?.netExpectedMinor ?? 0) >= 0 ? 'emerald' : 'rose'} muted sub="Plan minus plan" />
            <KpiCard label="Net Cash" value={fmt(report?.netActualMinor)}
              color={(report?.netActualMinor ?? 0) >= 0 ? 'emerald' : 'rose'} sub="Actual minus actual" />
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Status Summary</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs text-slate-400 mb-1">Open</div>
                  <div className="text-xl font-bold text-white tabular-nums">{report?.expectedTransactionCount ?? 0}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">Confirmed</div>
                  <div className="text-xl font-bold text-white tabular-nums">{report?.actualTransactionCount ?? 0}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Summary */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-medium text-slate-300">Monthly Summary</span>
              <div className="flex items-center gap-5 text-xs tabular-nums">
                <span className="text-slate-500">Cash in&nbsp;
                  <span className="text-emerald-400 font-semibold">{fmt(report?.totalActualIncomeMinor)}</span>
                </span>
                <span className="text-slate-700">|</span>
                <span className="text-slate-500">Cash out&nbsp;
                  <span className="text-rose-400 font-semibold">{fmt(report?.totalActualExpenseMinor)}</span>
                </span>
                <span className="text-slate-700">|</span>
                <span className="text-slate-500">Net&nbsp;
                  <span className={`font-semibold ${(report?.netActualMinor ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {fmt(report?.netActualMinor)}
                  </span>
                </span>
              </div>
            </div>

            {(() => {
              const actual = monthlySummary.filter(c => c.actual > 0)
              if (!actual.length) return (
                <div className="py-10 text-center text-slate-600 text-sm">No confirmed transactions this month</div>
              )
              const expenses = actual.filter(c => c.type === 'EXPENSE').sort((a, b) => b.actual - a.actual)
              const income   = actual.filter(c => c.type === 'INCOME').sort((a, b) => b.actual - a.actual)
              const EXP_PAL  = ['#ef4444','#f97316','#f59e0b','#ec4899','#8b5cf6','#06b6d4','#84cc16','#6366f1','#a78bfa','#3b82f6']
              const INC_PAL  = ['#10b981','#34d399','#059669','#22d3ee','#a3e635','#047857']
              const expTotal = expenses.reduce((s, c) => s + c.actual, 0)
              const incTotal = income.reduce((s, c)   => s + c.actual, 0)

              const CategoryRows = ({ items, palette, total }) => (
                <div className="space-y-4">
                  {items.map((c, i) => {
                    const pct = total > 0 ? (c.actual / total) * 100 : 0
                    const color = palette[i % palette.length]
                    return (
                      <div key={c.name}>
                        <div className="flex items-center justify-between mb-1.5 gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                            <span className="text-xs text-slate-400 truncate" title={c.name}>{c.name}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-medium text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full tabular-nums">
                              {pct.toFixed(0)}%
                            </span>
                            <span className="text-sm font-bold tabular-nums" style={{ color }}>{fmt(c.actual)}</span>
                          </div>
                        </div>
                        <div className="h-2 bg-slate-800/60 rounded-full overflow-hidden ml-4">
                          <div className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: `linear-gradient(to right, ${color}66, ${color})` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )

              return (
                <div className="px-4 py-4 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800 gap-0">
                  {/* Income */}
                  <div className={`${income.length && expenses.length ? 'pb-4 lg:pb-0 lg:pr-6' : ''}`}>
                    {income.length > 0 ? (
                      <>
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                              <span className="text-[11px] font-bold tracking-widest uppercase text-emerald-400">Income</span>
                            </div>
                            <span className="text-[10px] text-slate-600 ml-4">{income.length} {income.length === 1 ? 'source' : 'sources'}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold tabular-nums text-emerald-400 leading-none">{fmt(incTotal)}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">cash in</div>
                          </div>
                        </div>
                        <CategoryRows items={income} palette={INC_PAL} total={incTotal} />
                      </>
                    ) : (
                      <div className="py-4 text-center text-slate-600 text-xs">No income confirmed this month</div>
                    )}
                  </div>

                  {/* Expenses */}
                  <div className={`${income.length && expenses.length ? 'pt-4 lg:pt-0 lg:pl-6' : ''}`}>
                    {expenses.length > 0 ? (
                      <>
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                              <span className="text-[11px] font-bold tracking-widest uppercase text-rose-400">Expenses</span>
                            </div>
                            <span className="text-[10px] text-slate-600 ml-4">{expenses.length} {expenses.length === 1 ? 'category' : 'categories'}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold tabular-nums text-rose-400 leading-none">{fmt(expTotal)}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">cash out</div>
                          </div>
                        </div>
                        <CategoryRows items={expenses} palette={EXP_PAL} total={expTotal} />
                      </>
                    ) : (
                      <div className="py-4 text-center text-slate-600 text-xs">No expenses confirmed this month</div>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Daily Cash Flow */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <div className="text-sm font-medium text-slate-300 mb-4">Daily Cash Flow</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} stroke="#334155" />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} stroke="#334155" tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                <Tooltip formatter={(v) => fmt(v * 100)} contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, fontSize: 12 }} />
                <Line type="monotone" dataKey="income" stroke="#10b981" dot={false} strokeWidth={2} name="Cash Income" />
                <Line type="monotone" dataKey="expense" stroke="#ef4444" dot={false} strokeWidth={2} name="Cash Expense" />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Category Variance */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <div className="text-sm font-medium text-slate-300 mb-4">Planned vs Actual by Category</div>
            {varianceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={varianceData} barCategoryGap="30%" margin={{ top: 5, right: 5, bottom: 30, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} stroke="#334155" angle={-30} textAnchor="end" height={50} interval={0} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} stroke="#334155" tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                  <Tooltip formatter={v => fmt(v * 100)} contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, fontSize: 12 }} />
                  <Bar dataKey="expected" fill="#475569" name="Planned" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="actual" fill="#06b6d4" name="Actual" radius={[2, 2, 0, 0]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-slate-600 text-sm">No data for this month</div>
            )}
          </div>

          {/* Category Breakdown Table */}
          {report?.byCategory.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800">
                <span className="text-sm font-medium text-slate-300">Category Breakdown</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Category</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Type</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Planned</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Actual</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byCategory.map(c => (
                    <tr key={c.categoryId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="px-4 py-2.5 text-slate-300">{c.categoryName}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          c.type === 'INCOME' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-red-900/50 text-red-400'
                        }`}>{c.type}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">{fmt(c.expectedAmountMinor)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-200">{fmt(c.actualAmountMinor)}</td>
                      <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${
                        c.varianceMinor >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>{fmt(c.varianceMinor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
