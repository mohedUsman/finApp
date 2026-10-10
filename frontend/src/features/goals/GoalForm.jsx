import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import api from '../../lib/apiClient'
import { queryClient } from '../../lib/queryClient'
import { useToast } from '../../shared/ToastContext'

const schema = z.object({
  name: z.string().min(1, 'Required').max(100),
  targetAmountMinor: z.coerce.number().min(0, 'Must be 0 or more'),
  savedAmountMinor: z.coerce.number().min(0).optional(),
  targetDate: z.string().optional(),
})

export default function GoalForm({ goal, onDone }) {
  const isEdit = !!goal
  const toast = useToast()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: goal?.name ?? '',
      targetAmountMinor: goal ? goal.targetAmountMinor / 100 : '',
      savedAmountMinor: goal ? goal.savedAmountMinor / 100 : 0,
      targetDate: goal?.targetDate ?? '',
    },
  })

  const mutation = useMutation({
    mutationFn: data => {
      const payload = {
        name: data.name,
        targetAmountMinor: Math.round(data.targetAmountMinor * 100),
        savedAmountMinor: data.savedAmountMinor != null ? Math.round(data.savedAmountMinor * 100) : 0,
        targetDate: data.targetDate || null,
      }
      return isEdit
        ? api.patch(`/savings-goals/${goal.id}`, payload)
        : api.post('/savings-goals', payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Goal updated' : 'Goal created')
      queryClient.invalidateQueries({ queryKey: ['savings-goals'] })
      onDone()
    },
    onError: err => toast.error(err.response?.data?.message ?? 'Save failed'),
  })

  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Goal Name</label>
        <input {...register('name')} type="text"
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg"
          placeholder="e.g. Emergency Fund" />
        {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Target Amount (₹)</label>
          <input type="number" step="0.01" {...register('targetAmountMinor')}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg" />
          {errors.targetAmountMinor && <p className="text-red-400 text-xs mt-1">{errors.targetAmountMinor.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Saved So Far (₹)</label>
          <input type="number" step="0.01" {...register('savedAmountMinor')}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Target Date (optional)</label>
        <input type="date" {...register('targetDate')}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg" />
      </div>

      <button type="submit" disabled={isSubmitting}
        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
        {isSubmitting ? 'Saving…' : isEdit ? 'Update Goal' : 'Create Goal'}
      </button>
    </form>
  )
}
