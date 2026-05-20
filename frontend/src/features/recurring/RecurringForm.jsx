import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../../lib/apiClient'
import { queryClient } from '../../lib/queryClient'
import { useToast } from '../../shared/ToastContext'

const schema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']),
  categoryId: z.string().uuid('Select a category'),
  defaultExpectedAmountMinor: z.coerce.number().min(0),
  noteTemplate: z.string().max(500).optional(),
  scheduleType: z.enum(['MONTHLY', 'WEEKLY', 'YEARLY']),
  dayOfMonth: z.coerce.number().min(1).max(31).optional(),
  dayOfWeek: z.coerce.number().min(1).max(7).optional(),
  yearMonth: z.coerce.number().min(1).max(12).optional(),
  yearDay: z.coerce.number().min(1).max(31).optional(),
  startDate: z.string().min(1, 'Required'),
  endDate: z.string().optional(),
})

function buildConfig(scheduleType, data) {
  if (scheduleType === 'MONTHLY') return JSON.stringify({ dayOfMonth: data.dayOfMonth ?? 1 })
  if (scheduleType === 'WEEKLY') return JSON.stringify({ dayOfWeek: data.dayOfWeek ?? 1 })
  if (scheduleType === 'YEARLY') return JSON.stringify({ month: data.yearMonth ?? 1, day: data.yearDay ?? 1 })
  return '{}'
}

export default function RecurringForm({ rule, onDone }) {
  const isEdit = !!rule
  const toast = useToast()

  let defaultConfig = {}
  if (rule?.scheduleConfig) {
    try { defaultConfig = JSON.parse(rule.scheduleConfig) } catch {}
  }

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      type: rule?.type ?? 'EXPENSE',
      categoryId: rule?.categoryId ?? '',
      defaultExpectedAmountMinor: rule ? rule.defaultExpectedAmountMinor / 100 : '',
      noteTemplate: rule?.noteTemplate ?? '',
      scheduleType: rule?.scheduleType ?? 'MONTHLY',
      dayOfMonth: defaultConfig.dayOfMonth ?? 1,
      dayOfWeek: defaultConfig.dayOfWeek ?? 1,
      yearMonth: defaultConfig.month ?? 1,
      yearDay: defaultConfig.day ?? 1,
      startDate: rule?.startDate ?? new Date().toISOString().slice(0, 10),
      endDate: rule?.endDate ?? '',
    },
  })

  const selectedType = watch('type')
  const scheduleType = watch('scheduleType')

  const { data: cats = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories?includeInactive=false').then(r => r.data),
  })

  const filteredCats = cats.filter(c => c.type === selectedType)

  const mutation = useMutation({
    mutationFn: data => {
      const scheduleConfig = buildConfig(data.scheduleType, data)
      const payload = {
        type: data.type,
        categoryId: data.categoryId,
        defaultExpectedAmountMinor: Math.round(data.defaultExpectedAmountMinor * 100),
        noteTemplate: data.noteTemplate || null,
        scheduleType: data.scheduleType,
        scheduleConfig,
        startDate: data.startDate,
        endDate: data.endDate || null,
      }
      return isEdit
        ? api.patch(`/recurring-rules/${rule.id}`, payload)
        : api.post('/recurring-rules', payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Rule updated' : 'Rule created')
      queryClient.invalidateQueries({ queryKey: ['recurring-rules'] })
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
          <label className="block text-xs font-medium text-slate-400 mb-1">Category</label>
          <select {...register('categoryId')} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg">
            <option value="">Select…</option>
            {filteredCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {errors.categoryId && <p className="text-red-400 text-xs mt-1">{errors.categoryId.message}</p>}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Default Amount (₹)</label>
        <input type="number" step="0.01" {...register('defaultExpectedAmountMinor')}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg" />
        {errors.defaultExpectedAmountMinor && <p className="text-red-400 text-xs mt-1">{errors.defaultExpectedAmountMinor.message}</p>}
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Schedule</label>
        <select {...register('scheduleType')} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg">
          <option value="MONTHLY">Monthly</option>
          <option value="WEEKLY">Weekly</option>
          <option value="YEARLY">Yearly</option>
        </select>
      </div>

      {scheduleType === 'MONTHLY' && (
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Day of Month (1–31)</label>
          <input type="number" min="1" max="31" {...register('dayOfMonth')}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg" />
        </div>
      )}
      {scheduleType === 'WEEKLY' && (
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Day of Week (1=Mon … 7=Sun)</label>
          <input type="number" min="1" max="7" {...register('dayOfWeek')}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg" />
        </div>
      )}
      {scheduleType === 'YEARLY' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Month (1–12)</label>
            <input type="number" min="1" max="12" {...register('yearMonth')}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Day (1–31)</label>
            <input type="number" min="1" max="31" {...register('yearDay')}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Start Date</label>
          <input type="date" {...register('startDate')}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg" />
          {errors.startDate && <p className="text-red-400 text-xs mt-1">{errors.startDate.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">End Date (optional)</label>
          <input type="date" {...register('endDate')}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Note Template</label>
        <input {...register('noteTemplate')} type="text"
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg"
          placeholder="e.g. Monthly EMI" />
      </div>

      <button type="submit" disabled={isSubmitting}
        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
        {isSubmitting ? 'Saving…' : isEdit ? 'Update Rule' : 'Create Rule'}
      </button>
    </form>
  )
}
