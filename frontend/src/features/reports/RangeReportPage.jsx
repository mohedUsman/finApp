import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../../lib/apiClient'
import { formatCurrency, formatDate, varianceColor, todayISO } from '../../lib/format'
import KpiCard from '../../shared/KpiCard'

function daysAgoISO(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  const offsetMs = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 10)
}

const PRESETS = [
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Last 180 days', days: 180 },
  { label: 'This year', days: null },
]

export default function RangeReportPage() {
  const [from, setFrom] = useState(daysAgoISO(90))
  const [to, setTo] = useState(todayISO())

  const { data, isLoading, isError } = useQuery({
    queryKey: ['report', 'range', from, to],
    queryFn: () => api.get(`/reports/range?from=${from}&to=${to}`).then(r => r.data),
    enabled: !!from && !!to,
  })

  function applyPreset(p) {
    setTo(todayISO())
    if (p.days == null) {
      setFrom(`${new Date().getFullYear()}-01-01`)
    } else {
      setFrom(daysAgoISO(p.days))
    }
  }

  const trendData = data?.dailyActualTrend?.map(d => ({
    date: formatDate(d.date).slice(0, 6),
    net: (d.incomeMinor - d.expenseMinor) / 100,
  })) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-100">Custom Range Report</h1>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => applyPreset(p)}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-md transition-colors">
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isError && <div className="text-rose-400 text-sm">Could not load report for this range.</div>}

      {isLoading ? (
        <div className="text-slate-500 text-sm">Loading…</div>
      ) : data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Actual Income" value={formatCurrency(data.totalActualIncomeMinor)} color="green" />
            <KpiCard label="Actual Expense" value={formatCurrency(data.totalActualExpenseMinor)} color="red" />
            <KpiCard label="Net (Actual)" value={formatCurrency(data.netActualMinor)}
              color={data.netActualMinor >= 0 ? 'green' : 'red'} />
            <KpiCard label="Planned Net" value={formatCurrency(data.netExpectedMinor)}
              color={data.netExpectedMinor >= 0 ? 'blue' : 'amber'} />
          </div>

          {trendData.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <div className="text-sm font-medium text-slate-300 mb-4">Daily Net (Actual)</div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendData}>
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => formatCurrency(v * 100)} contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
                  <Line type="monotone" dataKey="net" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {data.byCategory?.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 text-sm font-medium text-slate-300">Category Breakdown</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
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
                    {data.byCategory.map(c => (
                      <tr key={c.categoryId} className="border-b border-slate-800/50">
                        <td className="px-4 py-2.5 text-slate-300">{c.categoryName}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            c.type === 'INCOME' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'
                          }`}>{c.type}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">{formatCurrency(c.expectedAmountMinor)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-200">{formatCurrency(c.actualAmountMinor)}</td>
                        <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${varianceColor(c.varianceMinor, c.type)}`}>
                          {formatCurrency(c.varianceMinor)}
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
