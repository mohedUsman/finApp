import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import api from '../../lib/apiClient'
import { queryClient } from '../../lib/queryClient'
import { useToast } from '../../shared/ToastContext'

const KINDS = ['bank', 'investment', 'cash', 'crypto', 'real_estate', 'gold', 'other']

const schema = z.object({
  name: z.string().min(1).max(80),
  kind: z.enum(['bank', 'investment', 'cash', 'crypto', 'real_estate', 'gold', 'other']),
  color: z.string().max(20).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().optional(),
})

export default function AssetCategoryForm({ cat, onDone }) {
  const isEdit = !!cat
  const toast = useToast()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: cat?.name ?? '',
      kind: cat?.kind ?? 'bank',
      color: cat?.color ?? '#3b82f6',
      isActive: cat?.isActive ?? true,
      sortOrder: cat?.sortOrder ?? 0,
    },
  })

  const mutation = useMutation({
    mutationFn: data => isEdit
      ? api.patch(`/asset-categories/${cat.id}`, data)
      : api.post('/asset-categories', { name: data.name, kind: data.kind, color: data.color }),
    onSuccess: () => {
      toast.success(isEdit ? 'Updated' : 'Created')
      queryClient.invalidateQueries({ queryKey: ['asset-categories'] })
      onDone()
    },
    onError: err => toast.error(err.response?.data?.message ?? 'Save failed'),
  })

  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Name</label>
        <input {...register('name')} type="text"
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg" />
        {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Kind</label>
          <select {...register('kind')} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg">
            {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Color</label>
          <input type="color" {...register('color')}
            className="w-full h-[38px] px-1 py-1 bg-slate-800 border border-slate-700 rounded-lg cursor-pointer" />
        </div>
      </div>

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
