import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '../../lib/apiClient'
import { queryClient } from '../../lib/queryClient'
import { useToast } from '../../shared/ToastContext'

const schema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']),
  categoryId: z.string().uuid(),
  status: z.enum(['EXPECTED', 'ACTUAL']),
  expectedAmountMinor: z.coerce.number().min(0).optional().nullable(),
  expectedDate: z.string().optional().nullable(),
  actualAmountMinor: z.coerce.number().min(0).optional().nullable(),
  actualDate: z.string().optional().nullable(),
  note: z.string().max(500).optional(),
})

export default function TransactionForm({ tx, onDone }) {
  const toast = useToast()
  const isEdit = !!tx

  const { data: cats } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories?includeInactive=false').then(r => r.data),
  })

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      type: tx?.type ?? 'EXPENSE',
      categoryId: tx?.categoryId ?? '',
      status: tx?.status ?? 'ACTUAL',
      expectedAmountMinor: tx?.expectedAmountMinor != null ? tx.expectedAmountMinor / 100 : null,
      expectedDate: tx?.expectedDate ?? '',
      actualAmountMinor: tx?.actualAmountMinor != null ? tx.actualAmountMinor / 100 : null,
      actualDate: tx?.actualDate ?? '',
      note: tx?.note ?? '',
    },
  })

  const selectedType = watch('type')
  const selectedStatus = watch('status')

  const filteredCats = cats?.filter(c => c.type === selectedType && c.isActive) ?? []

  const mutation = useMutation({
    mutationFn: data => {
      const payload = {
        ...data,
        expectedAmountMinor: data.expectedAmountMinor != null ? Math.round(data.expectedAmountMinor * 100) : null,
        actualAmountMinor: data.actualAmountMinor != null ? Math.round(data.actualAmountMinor * 100) : null,
        expectedDate: data.expectedDate || null,
        actualDate: data.actualDate || null,
        note: data.note || null,
      }
      return isEdit
        ? api.patch(`/transactions/${tx.id}`, payload)
        : api.post('/transactions', payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Transaction updated' : 'Transaction added')
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['report'] })
      onDone()
    },
    onError: err => toast.error(err.response?.data?.message ?? 'Save failed'),
  })

  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Type</label>
          <select {...register('type')} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg">
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
          <select {...register('status')} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg">
            <option value="ACTUAL">Actual</option>
            <option value="EXPECTED">Expected</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Category</label>
        <select {...register('categoryId')} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg">
          <option value="">Select category…</option>
          {filteredCats.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {errors.categoryId && <p className="text-red-400 text-xs mt-1">{errors.categoryId.message}</p>}
      </div>

      {(selectedStatus === 'ACTUAL' || selectedStatus === 'EXPECTED') && (
        <div className="grid grid-cols-2 gap-3">
          {selectedStatus === 'EXPECTED' || isEdit ? (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Planned Amount (₹)
                </label>
                <input type="number" step="0.01" {...register('expectedAmountMinor')}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Planned Date</label>
                <input type="date" {...register('expectedDate')}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg" />
              </div>
            </>
          ) : null}
          {selectedStatus === 'ACTUAL' || isEdit ? (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Actual Amount (₹)
                </label>
                <input type="number" step="0.01" {...register('actualAmountMinor')}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Actual Date</label>
                <input type="date" {...register('actualDate')}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg" />
              </div>
            </>
          ) : null}
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Note</label>
        <input {...register('note')} type="text"
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg"
          placeholder="Optional note" />
      </div>

      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={isSubmitting}
          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
          {isSubmitting ? 'Saving…' : isEdit ? 'Update' : 'Add Transaction'}
        </button>
      </div>
    </form>
  )
}
