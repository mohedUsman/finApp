import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import api from '../../lib/apiClient'
import { queryClient } from '../../lib/queryClient'
import { useToast } from '../../shared/ToastContext'
import { formatCurrency, formatDate } from '../../lib/format'
import { checkBudgetAlert } from '../../lib/budgetAlert'

const schema = z.object({
  actualAmountMinor: z.coerce.number().min(0),
  actualDate: z.string().min(1, 'Required'),
  note: z.string().max(500).optional(),
})

export default function ConfirmForm({ tx, onDone }) {
  const toast = useToast()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      actualAmountMinor: tx.expectedAmountMinor != null ? tx.expectedAmountMinor / 100 : '',
      actualDate: new Date().toISOString().slice(0, 10),
      note: tx.note ?? '',
    },
  })

  const mutation = useMutation({
    mutationFn: data => api.post(`/transactions/${tx.id}/confirm`, {
      actualAmountMinor: Math.round(data.actualAmountMinor * 100),
      actualDate: data.actualDate,
      note: data.note || null,
    }),
    onSuccess: () => {
      toast.success('Transaction confirmed')
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['report'] })
      if (tx.type === 'EXPENSE') checkBudgetAlert(tx.categoryId, toast)
      onDone()
    },
    onError: err => toast.error(err.response?.data?.message ?? 'Confirm failed'),
  })

  return (
    <div className="space-y-4">
      <div className="bg-slate-800/50 rounded-lg p-3 text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-slate-500">Category</span>
          <span className="text-slate-300">{tx.categoryName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Planned</span>
          <span className="text-slate-300">{formatCurrency(tx.expectedAmountMinor)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Expected Date</span>
          <span className="text-slate-300">{formatDate(tx.expectedDate)}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Actual Amount (₹)</label>
          <input type="number" step="0.01" {...register('actualAmountMinor')}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg" />
          {errors.actualAmountMinor && <p className="text-red-400 text-xs mt-1">{errors.actualAmountMinor.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Actual Date</label>
          <input type="date" {...register('actualDate')}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg" />
          {errors.actualDate && <p className="text-red-400 text-xs mt-1">{errors.actualDate.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Note</label>
          <input {...register('note')} type="text"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg"
            placeholder="Optional" />
        </div>
        <button type="submit" disabled={isSubmitting}
          className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
          {isSubmitting ? 'Confirming…' : 'Confirm Transaction'}
        </button>
      </form>
    </div>
  )
}
