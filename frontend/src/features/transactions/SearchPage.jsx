import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search as SearchIcon, CheckCircle2, Clock } from 'lucide-react'
import api from '../../lib/apiClient'
import { formatCurrency, formatDate } from '../../lib/format'

function StatusPill({ status }) {
  return status === 'ACTUAL' ? (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium bg-emerald-500/10 text-emerald-400">
      <CheckCircle2 className="w-2.5 h-2.5" /> ACTUAL
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium bg-amber-500/10 text-amber-400">
      <Clock className="w-2.5 h-2.5" /> EXPECTED
    </span>
  )
}

export default function SearchPage() {
  const [note, setNote] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [submitted, setSubmitted] = useState(null)

  function runSearch() {
    setSubmitted({ note, from, to, minAmount, maxAmount, type, status })
  }

  const query = useQuery({
    queryKey: ['transactions', 'search', submitted],
    queryFn: () => {
      const params = new URLSearchParams({ size: 200 })
      if (submitted.note) params.set('note', submitted.note)
      if (submitted.from) params.set('from', submitted.from)
      if (submitted.to) params.set('to', submitted.to)
      if (submitted.minAmount) params.set('minAmount', Math.round(Number(submitted.minAmount) * 100))
      if (submitted.maxAmount) params.set('maxAmount', Math.round(Number(submitted.maxAmount) * 100))
      if (submitted.type) params.set('type', submitted.type)
      if (submitted.status) params.set('status', submitted.status)
      return api.get(`/transactions/search?${params}`).then(r => r.data)
    },
    enabled: !!submitted,
  })

  const results = query.data?.content ?? []

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-100">Search Transactions</h1>

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Note contains</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runSearch()}
              placeholder="e.g. groceries"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">From date</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">To date</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Min amount (₹)</label>
            <input type="number" step="0.01" value={minAmount} onChange={e => setMinAmount(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Max amount (₹)</label>
            <input type="number" step="0.01" value={maxAmount} onChange={e => setMaxAmount(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Type</label>
            <select value={type} onChange={e => setType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg">
              <option value="">All types</option>
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg">
            <option value="">All statuses</option>
            <option value="EXPECTED">Expected</option>
            <option value="ACTUAL">Actual</option>
          </select>
          <button onClick={runSearch}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5">
            <SearchIcon className="w-4 h-4" /> Search
          </button>
        </div>
      </div>

      {query.isLoading && <div className="text-slate-500 text-sm">Searching…</div>}

      {submitted && !query.isLoading && (
        results.length === 0 ? (
          <div className="text-slate-600 text-sm py-10 text-center">No transactions match your search.</div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-x-auto">
            <div className="px-4 py-2.5 text-xs text-slate-500 border-b border-slate-800">
              {results.length} result{results.length === 1 ? '' : 's'}
              {query.data?.totalElements > results.length && ` (of ${query.data.totalElements} — narrow your filters)`}
            </div>
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Date</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Category</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Type</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Status</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">Planned</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">Actual</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Note</th>
                </tr>
              </thead>
              <tbody>
                {results.map(tx => (
                  <tr key={tx.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                    <td className="px-4 py-2.5 text-slate-400 tabular-nums whitespace-nowrap">
                      {formatDate(tx.actualDate ?? tx.expectedDate)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-200">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {tx.categoryName}
                        {tx.tags?.map(t => (
                          <span key={t.id}
                            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: `${t.color}22`, color: t.color }}
                          >{t.name}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        tx.type === 'INCOME' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                      }`}>{tx.type === 'INCOME' ? 'IN' : 'EX'}</span>
                    </td>
                    <td className="px-4 py-2.5"><StatusPill status={tx.status} /></td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">{formatCurrency(tx.expectedAmountMinor)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium text-slate-200">{formatCurrency(tx.actualAmountMinor)}</td>
                    <td className="px-4 py-2.5 text-slate-500 max-w-[200px] truncate">{tx.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}
