import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, RefreshCw, AlertCircle } from 'lucide-react'
import api from '../../lib/apiClient'
import { queryClient } from '../../lib/queryClient'
import { useToast } from '../../shared/ToastContext'
import Modal from '../../shared/Modal'
import { formatCurrency, formatDate } from '../../lib/format'
import RecurringForm from './RecurringForm'

function formatSchedule(rule) {
  try {
    const cfg = typeof rule.scheduleConfig === 'string' ? JSON.parse(rule.scheduleConfig) : rule.scheduleConfig
    if (rule.scheduleType === 'MONTHLY') return `Monthly · Day ${cfg.dayOfMonth}`
    if (rule.scheduleType === 'WEEKLY') {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      return `Weekly · ${days[cfg.dayOfWeek] ?? cfg.dayOfWeek}`
    }
    if (rule.scheduleType === 'YEARLY') return `Yearly · ${cfg.month}/${cfg.day}`
  } catch {}
  return rule.scheduleType
}

export default function RecurringPage() {
  const [modal, setModal] = useState(null)
  const toast = useToast()

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['recurring-rules'],
    queryFn: () => api.get('/recurring-rules').then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: id => api.delete(`/recurring-rules/${id}`),
    onSuccess: () => {
      toast.success('Rule deleted')
      queryClient.invalidateQueries({ queryKey: ['recurring-rules'] })
    },
    onError: () => toast.error('Delete failed'),
  })

  const generateMutation = useMutation({
    mutationFn: () => api.post('/recurring/generate'),
    onSuccess: ({ data }) => {
      toast.success(`Generated ${data.generatedCount} transactions`)
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['report'] })
    },
    onError: () => toast.error('Generation failed'),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }) => api.patch(`/recurring-rules/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-rules'] })
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Recurring Rules</h1>
        <div className="flex gap-2">
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-md disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" /> Generate now
          </button>
          <button
            onClick={() => setModal({ type: 'add' })}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-md transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> New rule
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-slate-500 text-sm">Loading…</div>
      ) : rules.length === 0 ? (
        <div className="text-center py-12 text-slate-600">No recurring rules yet.</div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Category</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Type</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Schedule</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">Amount</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Next Run</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Status</th>
                <th className="px-4 py-2.5 text-center text-xs font-medium text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(r => (
                <tr key={r.id} className={`border-b border-slate-800/50 hover:bg-slate-800/20 ${!r.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-2.5 text-slate-300">{r.categoryName}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      r.type === 'INCOME' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                    }`}>{r.type === 'INCOME' ? 'IN' : 'EX'}</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-300 text-xs">{formatSchedule(r)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-200 font-medium">
                    {formatCurrency(r.defaultExpectedAmountMinor)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 tabular-nums">{formatDate(r.nextRunDate)}</td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => toggleMutation.mutate({ id: r.id, isActive: !r.isActive })}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        r.isActive ? 'bg-emerald-900/40 text-emerald-400' : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {r.isActive ? 'Active' : 'Paused'}
                    </button>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setModal({ type: 'edit', rule: r })}
                        className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded" title="Edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { if (confirm('Delete this rule?')) deleteMutation.mutate(r.id) }}
                        className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 flex gap-3 text-xs text-slate-500">
        <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="text-slate-300 font-medium">How it works</div>
          <div>Rules generate <span className="text-white">EXPECTED</span> transactions using occurrence keys — duplicates are impossible. Day-31 rules clamp to month-end. Click <span className="text-white">Generate now</span> to create transactions through today.</div>
        </div>
      </div>

      {modal?.type === 'add' && (
        <Modal title="Add Recurring Rule" onClose={() => setModal(null)} size="lg">
          <RecurringForm onDone={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'edit' && (
        <Modal title="Edit Recurring Rule" onClose={() => setModal(null)} size="lg">
          <RecurringForm rule={modal.rule} onDone={() => setModal(null)} />
        </Modal>
      )}
    </div>
  )
}
