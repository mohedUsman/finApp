import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import api from '../../lib/apiClient'
import { formatCurrency, monthName, varianceColor } from '../../lib/format'
import KpiCard from '../../shared/KpiCard'

export default function QuarterlyPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [quarter, setQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3))

  const { data, isLoading } = useQuery({
    queryKey: ['report', 'quarterly', year, quarter],
    queryFn: () => api.get(`/reports/quarterly?year=${year}&quarter=${quarter}`).then(r => r.data),
  })

  const monthBarData = data?.monthBreakdown.map(m => ({
    month: monthName(m.month),
    'Actual Income': m.actualIncomeMinor / 100,
    'Actual Expense': m.actualExpenseMinor / 100,
    'Planned Income': m.expectedIncomeMinor / 100,
    'Planned Expense': m.expectedExpenseMinor / 100,
  })) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-100">Quarterly Report</h1>
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg">
            {[now.getFullYear() - 1, now.getFullYear()].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select value={quarter} onChange={e => setQuarter(Number(e.target.value))}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg">
            <option value={1}>Q1 (Jan–Mar)</option>
            <option value={2}>Q2 (Apr–Jun)</option>
            <option value={3}>Q3 (Jul–Sep)</option>
            <option value={4}>Q4 (Oct–Dec)</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-slate-500 text-sm">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Actual Income" value={formatCurrency(data?.totalActualIncomeMinor)} color="green" />
            <KpiCard label="Actual Expense" value={formatCurrency(data?.totalActualExpenseMinor)} color="red" />
            <KpiCard label="Net (Actual)" value={formatCurrency(data?.netActualMinor)}
              color={data?.netActualMinor >= 0 ? 'green' : 'red'} />
            <KpiCard label="Planned Net" value={formatCurrency(data?.netExpectedMinor)}
              color={data?.netExpectedMinor >= 0 ? 'blue' : 'amber'} />
          </div>

          {/* Month Breakdown Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <div className="text-sm font-medium text-slate-300 mb-4">Monthly Breakdown</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthBarData} barCategoryGap="25%">
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => formatCurrency(v * 100)} contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
                <Legend />
                <Bar dataKey="Planned Income" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Actual Income" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Planned Expense" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Actual Expense" fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Month Breakdown Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 text-sm font-medium text-slate-300">Month Breakdown</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Month</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Actual Income</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Actual Expense</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Net</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Planned Net</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.monthBreakdown.map(m => (
                    <tr key={m.month} className="border-b border-slate-800/50">
                      <td className="px-4 py-2.5 text-slate-300 font-medium">{monthName(m.month)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-emerald-400">{formatCurrency(m.actualIncomeMinor)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-red-400">{formatCurrency(m.actualExpenseMinor)}</td>
                      <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${m.netActualMinor >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatCurrency(m.netActualMinor)}
                      </td>
                      <td className={`px-4 py-2.5 text-right tabular-nums ${m.netExpectedMinor >= 0 ? 'text-blue-400' : 'text-amber-400'}`}>
                        {formatCurrency(m.netExpectedMinor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Category Breakdown */}
          {data?.byCategoryQtd?.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 text-sm font-medium text-slate-300">Category Breakdown (QTD)</div>
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
                    {data.byCategoryQtd.map(c => (
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
