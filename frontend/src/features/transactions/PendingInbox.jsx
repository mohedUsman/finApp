import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Clock } from 'lucide-react'
import api from '../../lib/apiClient'
import { formatCurrency, formatDate } from '../../lib/format'
import Modal from '../../shared/Modal'
import ConfirmForm from './ConfirmForm'
import { queryClient } from '../../lib/queryClient'

/**
 * Recurring generation and manual entry both leave EXPECTED rows behind once
 * their date passes, and nothing else surfaces them — they just sit silently
 * skewing variance until the user remembers to go find them. This is that
 * reminder: the planned transactions that are overdue or coming due soon,
 * with a one-click path to confirm each.
 */
export default function PendingInbox() {
  const [confirmTx, setConfirmTx] = useState(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['transactions', 'pending'],
    queryFn: () => api.get('/transactions/pending?upcomingDays=7').then(r => r.data),
  })

  if (isLoading || isError) return null

  const overdue = data?.overdue ?? []
  const upcoming = data?.upcoming ?? []

  if (overdue.length === 0 && upcoming.length === 0) return null

  const Row = ({ tx, overdueRow }) => (
    <div className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg hover:bg-slate-800/50">
      <div className="min-w-0">
        <div className="text-sm text-slate-200 truncate">{tx.categoryName}</div>
        <div className="text-xs text-slate-500">
          {overdueRow ? 'Was due ' : 'Due '}{formatDate(tx.expectedDate)}
          {tx.note ? ` · ${tx.note}` : ''}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`text-sm font-medium tabular-nums ${tx.type === 'INCOME' ? 'text-emerald-400' : 'text-rose-400'}`}>
          {formatCurrency(tx.expectedAmountMinor)}
        </span>
        <button
          onClick={() => setConfirmTx(tx)}
          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-md transition-colors whitespace-nowrap"
        >
          Confirm
        </button>
      </div>
    </div>
  )

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
      {overdue.length > 0 && (
        <div>
          <div className="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2 bg-amber-950/30">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-400">
              {overdue.length} overdue {overdue.length === 1 ? 'transaction needs' : 'transactions need'} confirmation
            </span>
          </div>
          <div className="px-2 py-1 divide-y divide-slate-800/50">
            {overdue.map(tx => <Row key={tx.id} tx={tx} overdueRow />)}
          </div>
        </div>
      )}
      {upcoming.length > 0 && (
        <div className={overdue.length > 0 ? 'border-t border-slate-800' : ''}>
          <div className="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-300">Coming up in the next 7 days</span>
          </div>
          <div className="px-2 py-1 divide-y divide-slate-800/50">
            {upcoming.map(tx => <Row key={tx.id} tx={tx} />)}
          </div>
        </div>
      )}

      {confirmTx && (
        <Modal title="Confirm Transaction" onClose={() => setConfirmTx(null)} size="sm">
          <ConfirmForm
            tx={confirmTx}
            onDone={() => {
              setConfirmTx(null)
              queryClient.invalidateQueries({ queryKey: ['transactions'] })
            }}
          />
        </Modal>
      )}
    </div>
  )
}
