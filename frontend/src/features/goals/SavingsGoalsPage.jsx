import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, PiggyBank, Target } from 'lucide-react'
import api from '../../lib/apiClient'
import { queryClient } from '../../lib/queryClient'
import { useToast } from '../../shared/ToastContext'
import Modal from '../../shared/Modal'
import { formatCurrency, formatDate } from '../../lib/format'
import GoalForm from './GoalForm'

const contributeSchema = z.object({
  amount: z.coerce.number().refine(n => n !== 0, 'Enter a non-zero amount'),
})

function ContributeForm({ goal, onDone }) {
  const toast = useToast()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(contributeSchema),
    defaultValues: { amount: '' },
  })

  const mutation = useMutation({
    mutationFn: data => api.post(`/savings-goals/${goal.id}/contribute`, {
      amountMinor: Math.round(data.amount * 100),
    }),
    onSuccess: () => {
      toast.success('Contribution recorded')
      queryClient.invalidateQueries({ queryKey: ['savings-goals'] })
      onDone()
    },
    onError: err => toast.error(err.response?.data?.message ?? 'Contribution failed'),
  })

  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
      <p className="text-xs text-slate-500">Positive amount adds to savings, negative withdraws.</p>
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Amount (₹)</label>
        <input type="number" step="0.01" {...register('amount')}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg"
          placeholder="e.g. 5000 or -1000" />
        {errors.amount && <p className="text-red-400 text-xs mt-1">{errors.amount.message}</p>}
      </div>
      <button type="submit" disabled={isSubmitting}
        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
        {isSubmitting ? 'Saving…' : 'Record Contribution'}
      </button>
    </form>
  )
}

export default function SavingsGoalsPage() {
  const [modal, setModal] = useState(null)
  const toast = useToast()

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['savings-goals'],
    queryFn: () => api.get('/savings-goals').then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: id => api.delete(`/savings-goals/${id}`),
    onSuccess: () => {
      toast.success('Goal deleted')
      queryClient.invalidateQueries({ queryKey: ['savings-goals'] })
    },
    onError: () => toast.error('Delete failed'),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Savings Goals</h1>
        <button
          onClick={() => setModal({ type: 'add' })}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-md transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> New goal
        </button>
      </div>

      {isLoading ? (
        <div className="text-slate-500 text-sm">Loading…</div>
      ) : goals.length === 0 ? (
        <div className="text-center py-12 text-slate-600">No savings goals yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map(g => {
            const pct = g.targetAmountMinor > 0
              ? Math.min(100, Math.round((g.savedAmountMinor / g.targetAmountMinor) * 100))
              : 0
            const reached = g.savedAmountMinor >= g.targetAmountMinor
            return (
              <div key={g.id} className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${reached ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                      {reached ? <Target className="w-4 h-4" /> : <PiggyBank className="w-4 h-4" />}
                    </div>
                    <div className="text-sm font-semibold text-slate-100">{g.name}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setModal({ type: 'edit', goal: g })}
                      className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded" title="Edit">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { if (confirm('Delete this goal?')) deleteMutation.mutate(g.id) }}
                      className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 tabular-nums">{formatCurrency(g.savedAmountMinor)}</span>
                    <span className="text-slate-500 tabular-nums">of {formatCurrency(g.targetAmountMinor)}</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${reached ? 'bg-emerald-500' : 'bg-cyan-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>{pct}% funded</span>
                    {g.targetDate && <span>Target: {formatDate(g.targetDate)}</span>}
                  </div>
                </div>

                <button
                  onClick={() => setModal({ type: 'contribute', goal: g })}
                  className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-md transition-colors"
                >
                  Add / Withdraw
                </button>
              </div>
            )
          })}
        </div>
      )}

      {modal?.type === 'add' && (
        <Modal title="New Savings Goal" onClose={() => setModal(null)} size="md">
          <GoalForm onDone={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'edit' && (
        <Modal title="Edit Savings Goal" onClose={() => setModal(null)} size="md">
          <GoalForm goal={modal.goal} onDone={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'contribute' && (
        <Modal title={`Update "${modal.goal.name}"`} onClose={() => setModal(null)} size="sm">
          <ContributeForm goal={modal.goal} onDone={() => setModal(null)} />
        </Modal>
      )}
    </div>
  )
}
