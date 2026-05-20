import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'
import { RefreshCw, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import api from '../../lib/apiClient'
import { formatCurrency, monthName, currentYearMonth, prevMonth, nextMonth } from '../../lib/format'
import KpiCard from '../../shared/KpiCard'
import { queryClient } from '../../lib/queryClient'
import { useToast } from '../../shared/ToastContext'

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16']

function fmt(v) { return formatCurrency(v) }

export default function DashboardPage() {
  const [ym, setYm] = useState(currentYearMonth())
  const toast = useToast()

  const { data: report, isLoading } = useQuery({
    queryKey: ['report', 'monthly', ym.year, ym.month],
    queryFn: () => api.get(`/reports/monthly?year=${ym.year}&month=${ym.month}`).then(r => r.data),
  })

  const generateMutation = useMutation({
    mutationFn: () => api.post('/recurring/generate'),
    onSuccess: ({ data }) => {
      toast.success(`Generated ${data.generatedCount} transactions`)
      queryClient.invalidateQueries({ queryKey: ['report'] })
    },
    onError: () => toast.error('Generation failed'),
  })

  const expensePieData = report?.byCategory
    .filter(c => c.type === 'EXPENSE' && c.actualAmountMinor > 0)
    .map(c => ({ name: c.categoryName, value: c.actualAmountMinor })) ?? []

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

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Daily Trend */}
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

            {/* Expense Mix Donut */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <div className="text-sm font-medium text-slate-300 mb-4">Expense Mix</div>
              {expensePieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={expensePieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                      innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {expensePieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={v => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-slate-600 text-sm">No expense data</div>
              )}
            </div>
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
