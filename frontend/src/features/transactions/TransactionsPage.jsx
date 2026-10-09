import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, Check, Clock, CheckCircle2, Repeat, Download, ChevronDown, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import api from '../../lib/apiClient'
import { formatCurrency, formatDate, currentYearMonth, prevMonth, nextMonth, monthName } from '../../lib/format'
import Modal from '../../shared/Modal'
import QueryState from '../../shared/QueryState'
import { useToast } from '../../shared/ToastContext'
import { queryClient } from '../../lib/queryClient'
import TransactionForm from './TransactionForm'
import ConfirmForm from './ConfirmForm'
import { exportToExcel, exportToPdf } from './exportUtils'

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

function ExportDropdown({ txList, ym, typeFilter, statusFilter }) {
  const [open, setOpen]       = useState(false)
  const [exporting, setExporting] = useState(null) // null | 'excel' | 'pdf'
  const toast = useToast()
  const ref   = useRef(null)

  useEffect(() => {
    function onOutside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  async function doExport(format) {
    if (!txList.length) { toast.error('No transactions to export'); setOpen(false); return }
    setOpen(false)
    setExporting(format)
    await new Promise(r => setTimeout(r, 50)) // let spinner render before heavy sync work
    try {
      if (format === 'excel') { exportToExcel(txList, ym, typeFilter, statusFilter); toast.success('Excel file downloaded') }
      else                    { exportToPdf(txList, ym, typeFilter, statusFilter);   toast.success('PDF downloaded') }
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={!!exporting}
        className="px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg flex items-center gap-1.5 hover:bg-slate-700 disabled:opacity-50 transition-colors"
      >
        {exporting
          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Exporting…</>
          : <><Download className="w-3.5 h-3.5" /> Export <ChevronDown className="w-3 h-3 ml-0.5" /></>
        }
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-52 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl z-20 overflow-hidden">
          <button
            onClick={() => doExport('excel')}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
            Export as Excel (.xlsx)
          </button>
          <button
            onClick={() => doExport('pdf')}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <FileText className="w-4 h-4 text-rose-400 shrink-0" />
            Export as PDF
          </button>
        </div>
      )}
    </div>
  )
}

export default function TransactionsPage() {
  const [ym, setYm] = useState(currentYearMonth())
  const [modal, setModal] = useState(null) // null | { type: 'add'|'edit'|'confirm', tx? }
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const toast = useToast()

  // Reset category selection when month or type changes (categories differ per month/type)
  useEffect(() => { setCategoryFilter('') }, [ym.year, ym.month, typeFilter])

  const from = `${ym.year}-${String(ym.month).padStart(2, '0')}-01`
  const lastDay = new Date(ym.year, ym.month, 0).getDate()
  const to = `${ym.year}-${String(ym.month).padStart(2, '0')}-${lastDay}`

  const PAGE_SIZE = 200

  const txQuery = useQuery({
    queryKey: ['transactions', ym.year, ym.month, typeFilter, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams({ from, to, size: PAGE_SIZE })
      if (typeFilter) params.set('type', typeFilter)
      if (statusFilter) params.set('status', statusFilter)
      return api.get(`/transactions?${params}`).then(r => r.data)
    },
  })
  const data = txQuery.data
  const isLoading = txQuery.isLoading

  const deleteMutation = useMutation({
    mutationFn: id => api.delete(`/transactions/${id}`),
    onSuccess: () => {
      toast.success('Transaction deleted')
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['report'] })
    },
    onError: () => toast.error('Delete failed'),
  })

  const txList = data?.content ?? []
  // The page requests a single fixed-size page. If the month has more rows
  // than that, the tiles below would silently understate the real totals,
  // so say so rather than showing a confident wrong number.
  const totalElements = data?.totalElements ?? txList.length
  const isTruncated = totalElements > txList.length

  // Unique sorted category names for the dropdown (from API result before category filter)
  const categories = [...new Set(txList.map(t => t.categoryName).filter(Boolean))].sort()

  // Category filter applied client-side (type/status already filtered by API)
  const displayList = categoryFilter ? txList.filter(t => t.categoryName === categoryFilter) : txList

  const totalIncome  = displayList.filter(t => t.type === 'INCOME'  && t.status === 'ACTUAL').reduce((s, t) => s + Number(t.actualAmountMinor ?? 0), 0)
  const totalExpense = displayList.filter(t => t.type === 'EXPENSE' && t.status === 'ACTUAL').reduce((s, t) => s + Number(t.actualAmountMinor ?? 0), 0)
  const net = totalIncome - totalExpense

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setYm(p => prevMonth(p.year, p.month))}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 text-lg">‹</button>
          <h1 className="text-xl font-bold text-slate-100">{monthName(ym.month)} {ym.year}</h1>
          <button onClick={() => setYm(p => nextMonth(p.year, p.month))}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 text-lg">›</button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg">
            <option value="">All types</option>
            <option value="INCOME">Income</option>
            <option value="EXPENSE">Expense</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg">
            <option value="">All statuses</option>
            <option value="EXPECTED">Expected</option>
            <option value="ACTUAL">Actual</option>
          </select>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg max-w-[160px]">
            <option value="">All categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <ExportDropdown txList={displayList} ym={ym} typeFilter={typeFilter} statusFilter={statusFilter} />
          <button
            onClick={() => setModal({ type: 'add' })}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> New transaction
          </button>
        </div>
      </div>

      {txQuery.isError && (
        <QueryState
          isError
          error={txQuery.error}
          label="transactions"
          onRetry={() => txQuery.refetch()}
        />
      )}

      {isTruncated && (
        <div className="bg-amber-950/40 border border-amber-900/60 rounded-lg px-4 py-2.5 text-xs text-amber-300">
          Showing the first {txList.length} of {totalElements} transactions for this month.
          The totals below cover only these rows — narrow the filters to see accurate figures.
        </div>
      )}

      {!isLoading && displayList.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-3">
            <div className="text-xs text-slate-500 mb-1">Income</div>
            <div className="text-base font-bold text-emerald-400 tabular-nums">{formatCurrency(totalIncome)}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-3">
            <div className="text-xs text-slate-500 mb-1">Expense</div>
            <div className="text-base font-bold text-rose-400 tabular-nums">{formatCurrency(totalExpense)}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-3">
            <div className="text-xs text-slate-500 mb-1">Net</div>
            <div className={`text-base font-bold tabular-nums ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatCurrency(net)}
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-slate-500 text-sm">Loading…</div>
      ) : displayList.length === 0 ? (
        <div className="text-slate-600 text-sm py-10 text-center">
          {txList.length > 0 ? `No transactions match the selected filters.` : 'No transactions for this period.'}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Date</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Category</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Type</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Status</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">Planned</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">Actual</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Note</th>
                <th className="px-4 py-2.5 text-center text-xs font-medium text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayList.map(tx => (
                <tr key={tx.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                  <td className="px-4 py-2.5 text-slate-400 tabular-nums whitespace-nowrap">
                    {formatDate(tx.actualDate ?? tx.expectedDate)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-200">
                    <div className="flex items-center gap-1.5">
                      {tx.recurringRuleId && <Repeat className="w-3 h-3 text-cyan-400 shrink-0" />}
                      {tx.categoryName}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      tx.type === 'INCOME' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                    }`}>{tx.type === 'INCOME' ? 'IN' : 'EX'}</span>
                  </td>
                  <td className="px-4 py-2.5"><StatusPill status={tx.status} /></td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">
                    {formatCurrency(tx.expectedAmountMinor)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium text-slate-200">
                    {formatCurrency(tx.actualAmountMinor)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 max-w-[120px] truncate">{tx.note ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-center gap-1">
                      {tx.status === 'EXPECTED' && (
                        <button
                          onClick={() => setModal({ type: 'confirm', tx })}
                          className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors"
                          title="Confirm"
                        ><Check className="w-3.5 h-3.5" /></button>
                      )}
                      <button
                        onClick={() => setModal({ type: 'edit', tx })}
                        className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                        title="Edit"
                      ><Edit2 className="w-3.5 h-3.5" /></button>
                      <button
                        onClick={() => { if (confirm('Delete this transaction?')) deleteMutation.mutate(tx.id) }}
                        className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                        title="Delete"
                      ><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal?.type === 'add' && (
        <Modal title="Add Transaction" onClose={() => setModal(null)} size="md">
          <TransactionForm onDone={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'edit' && (
        <Modal title="Edit Transaction" onClose={() => setModal(null)} size="md">
          <TransactionForm tx={modal.tx} onDone={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'confirm' && (
        <Modal title="Confirm Transaction" onClose={() => setModal(null)} size="sm">
          <ConfirmForm tx={modal.tx} onDone={() => setModal(null)} />
        </Modal>
      )}
    </div>
  )
}
