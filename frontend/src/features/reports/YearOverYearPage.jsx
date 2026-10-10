import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'
import api from '../../lib/apiClient'
import { formatCurrency, monthName, varianceColor } from '../../lib/format'
import KpiCard from '../../shared/KpiCard'

function pctChange(curr, prev) {
  if (!prev) return curr ? 100 : 0
  return ((curr - prev) / Math.abs(prev)) * 100
}

function ChangeBadge({ pct }) {
  if (!Number.isFinite(pct)) return null
  const up = pct > 0
  const color = pct === 0 ? 'text-slate-500' : up ? 'text-emerald-400' : 'text-rose-400'
  return (
    <span className={`text-xs font-medium tabular-nums ${color}`}>
      {pct === 0 ? '—' : `${up ? '+' : ''}${pct.toFixed(1)}%`}
    </span>
  )
}

export default function YearOverYearPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [currYear, setCurrYear] = useState(now.getFullYear())
  const prevYear = currYear - 1

  const currQuery = useQuery({
    queryKey: ['report', 'monthly', currYear, month],
    queryFn: () => api.get(`/reports/monthly?year=${currYear}&month=${month}`).then(r => r.data),
  })
  const prevQuery = useQuery({
    queryKey: ['report', 'monthly', prevYear, month],
    queryFn: () => api.get(`/reports/monthly?year=${prevYear}&month=${month}`).then(r => r.data),
  })

  const curr = currQuery.data
  const prev = prevQuery.data
  const isLoading = currQuery.isLoading || prevQuery.isLoading
  const isError = currQuery.isError || prevQuery.isError

  // Union of categories across both years so a category that only had
  // activity in one year still shows up (with the other side at zero)
  // rather than silently vanishing from the comparison.
  const categoryRows = (() => {
    if (!curr || !prev) return []
    const byName = new Map()
    curr.byCategory.forEach(c => byName.set(c.categoryName, { name: c.categoryName, type: c.type, currActual: c.actualAmountMinor, prevActual: 0 }))
    prev.byCategory.forEach(c => {
      const e = byName.get(c.categoryName)
      if (e) e.prevActual = c.actualAmountMinor
      else byName.set(c.categoryName, { name: c.categoryName, type: c.type, currActual: 0, prevActual: c.actualAmountMinor })
    })
    return [...byName.values()]
      .filter(c => c.currActual !== 0 || c.prevActual !== 0)
      .sort((a, b) => Math.abs(b.currActual - b.prevActual) - Math.abs(a.currActual - a.prevActual))
  })()

  const chartData = categoryRows.slice(0, 10).map(c => ({
    name: c.name.length > 12 ? c.name.slice(0, 12) + '…' : c.name,
    [prevYear]: c.prevActual / 100,
    [currYear]: c.currActual / 100,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-100">Year-over-Year Comparison</h1>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Month</label>
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            className="px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{monthName(m)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Comparing</label>
          <select value={currYear} onChange={e => setCurrYear(Number(e.target.value))}
            className="px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg">
            {Array.from({ length: 6 }, (_, i) => now.getFullYear() - i).map(y => (
              <option key={y} value={y}>{y} vs {y - 1}</option>
            ))}
          </select>
        </div>
      </div>

      {isError && <div className="text-rose-400 text-sm">Could not load report for one or both years.</div>}

      {isLoading ? (
        <div className="text-slate-500 text-sm">Loading…</div>
      ) : curr && prev && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Cash Income</div>
              <div className="text-lg font-bold text-emerald-400 tabular-nums">{formatCurrency(curr.totalActualIncomeMinor)}</div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] text-slate-600">vs {formatCurrency(prev.totalActualIncomeMinor)}</span>
                <ChangeBadge pct={pctChange(curr.totalActualIncomeMinor, prev.totalActualIncomeMinor)} />
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Cash Expense</div>
              <div className="text-lg font-bold text-rose-400 tabular-nums">{formatCurrency(curr.totalActualExpenseMinor)}</div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] text-slate-600">vs {formatCurrency(prev.totalActualExpenseMinor)}</span>
                <ChangeBadge pct={pctChange(curr.totalActualExpenseMinor, prev.totalActualExpenseMinor)} />
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Net Cash</div>
              <div className={`text-lg font-bold tabular-nums ${curr.netActualMinor >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatCurrency(curr.netActualMinor)}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] text-slate-600">vs {formatCurrency(prev.netActualMinor)}</span>
                <ChangeBadge pct={pctChange(curr.netActualMinor, prev.netActualMinor)} />
              </div>
            </div>
            <KpiCard label={`${monthName(month)} ${prevYear}`} value={formatCurrency(prev.netActualMinor)}
              color={prev.netActualMinor >= 0 ? 'green' : 'red'} sub="Net cash, same month" />
          </div>

          {chartData.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <div className="text-sm font-medium text-slate-300 mb-4">Top Categories by Change</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} barCategoryGap="30%" margin={{ top: 5, right: 5, bottom: 30, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} stroke="#334155" angle={-30} textAnchor="end" height={50} interval={0} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} stroke="#334155" tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                  <Tooltip formatter={v => formatCurrency(v * 100)} contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, fontSize: 12 }} />
                  <Bar dataKey={prevYear} fill="#475569" radius={[2, 2, 0, 0]} />
                  <Bar dataKey={currYear} fill="#06b6d4" radius={[2, 2, 0, 0]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {categoryRows.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 text-sm font-medium text-slate-300">
                Category Breakdown — {monthName(month)} {currYear} vs {prevYear}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Category</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Type</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">{prevYear}</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">{currYear}</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryRows.map(c => (
                      <tr key={c.name} className="border-b border-slate-800/50">
                        <td className="px-4 py-2.5 text-slate-300">{c.name}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            c.type === 'INCOME' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'
                          }`}>{c.type}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">{formatCurrency(c.prevActual)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-200">{formatCurrency(c.currActual)}</td>
                        <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${varianceColor(c.currActual - c.prevActual, c.type)}`}>
                          {formatCurrency(c.currActual - c.prevActual)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
