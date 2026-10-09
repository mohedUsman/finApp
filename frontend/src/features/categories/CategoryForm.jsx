import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '../../lib/apiClient'
import { queryClient } from '../../lib/queryClient'
import { useToast } from '../../shared/ToastContext'

const createSchema = z.object({
  name: z.string().min(1, 'Required').max(80),
  type: z.enum(['INCOME', 'EXPENSE']),
  parentId: z.string().optional(),
})

const editSchema = z.object({
  name: z.string().min(1, 'Required').max(80).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().optional(),
  monthlyBudgetMinor: z.coerce.number().min(0).optional().nullable(),
})

export default function CategoryForm({ cat, defaultType = 'EXPENSE', onDone }) {
  const isEdit = !!cat
  const toast = useToast()

  const { data: cats = [] } = useQuery({
    queryKey: ['categories', 'all'],
    queryFn: () => api.get('/categories?includeInactive=true').then(r => r.data),
  })

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(isEdit ? editSchema : createSchema),
    defaultValues: isEdit
      ? {
          name: cat.name,
          isActive: cat.isActive,
          sortOrder: cat.sortOrder,
          monthlyBudgetMinor: cat.monthlyBudgetMinor != null ? cat.monthlyBudgetMinor / 100 : null,
        }
      : { type: defaultType, name: '', parentId: '' },
  })

  const selectedType = watch('type') ?? cat?.type

  const parentOptions = cats.filter(c =>
    c.type === selectedType && !c.parentId && c.id !== cat?.id
  )

  const mutation = useMutation({
    mutationFn: data => {
      if (isEdit) {
        const payload = {}
        if (data.name) payload.name = data.name
        if (data.isActive !== undefined) payload.isActive = data.isActive
        if (data.sortOrder !== undefined) payload.sortOrder = data.sortOrder
        if (data.monthlyBudgetMinor == null || data.monthlyBudgetMinor === '') {
          payload.clearBudget = true
        } else {
          payload.monthlyBudgetMinor = Math.round(data.monthlyBudgetMinor * 100)
        }
        return api.patch(`/categories/${cat.id}`, payload)
      }
      return api.post('/categories', {
        name: data.name,
        type: data.type,
        parentId: data.parentId || null,
      })
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Category updated' : 'Category created')
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      onDone()
    },
    onError: err => toast.error(err.response?.data?.message ?? 'Save failed'),
  })

  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
      {!isEdit && (
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Type</label>
          <select {...register('type')} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg">
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
          </select>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Name</label>
        <input {...register('name')} type="text"
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg"
          placeholder="Category name" />
        {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
      </div>

      {!isEdit && parentOptions.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Parent (optional)</label>
          <select {...register('parentId')} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg">
            <option value="">None (top-level)</option>
            {parentOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {isEdit && cat.type === 'EXPENSE' && (
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Monthly Budget (₹)</label>
          <input type="number" step="0.01" {...register('monthlyBudgetMinor')}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg"
            placeholder="No budget set" />
          {errors.monthlyBudgetMinor && <p className="text-red-400 text-xs mt-1">{errors.monthlyBudgetMinor.message}</p>}
          <p className="text-slate-600 text-[11px] mt-1">Leave blank to remove the budget. Compared against confirmed spend each month on the Dashboard.</p>
        </div>
      )}

      {isEdit && (
        <div className="flex items-center gap-3">
          <input type="checkbox" {...register('isActive')} id="isActive"
            className="w-4 h-4 rounded accent-emerald-500" />
          <label htmlFor="isActive" className="text-sm text-slate-300">Active</label>
        </div>
      )}

      <button type="submit" disabled={isSubmitting}
        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
        {isSubmitting ? 'Saving…' : isEdit ? 'Update' : 'Create'}
      </button>
    </form>
  )
}
