import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '../../lib/apiClient'
import { queryClient } from '../../lib/queryClient'
import { todayISO } from '../../lib/format'
import { useToast } from '../../shared/ToastContext'
import { checkBudgetAlert } from '../../lib/budgetAlert'
import { CURRENCIES } from '../../lib/currencies'

const schema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']),
  categoryId: z.string().uuid('Pick a category'),
  status: z.enum(['EXPECTED', 'ACTUAL']),
  currencyCode: z.string().length(3),
  expectedAmountMinor: z.coerce.number().min(0).optional().nullable(),
  expectedDate: z.string().optional().nullable(),
  actualAmountMinor: z.coerce.number().min(0).optional().nullable(),
  actualDate: z.string().optional().nullable(),
  note: z.string().max(500).optional(),
}).superRefine((data, ctx) => {
  // Mirror the server's rules so a missing amount/date is an inline field
  // error, not a round-trip that comes back as a generic "Save failed" toast.
  const required = data.status === 'EXPECTED'
    ? [['expectedAmountMinor', 'Planned amount is required'], ['expectedDate', 'Planned date is required']]
    : [['actualAmountMinor', 'Actual amount is required'], ['actualDate', 'Actual date is required']]

  for (const [field, message] of required) {
    const value = data[field]
    if (value == null || value === '' || Number.isNaN(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message })
    }
  }
})

/**
 * The category a user picks is highly repetitive, and the list is 16+ items
 * long, so remembering the last one per type turns a scroll-and-pick into a
 * confirm. Scoped per type because income and expense categories are disjoint.
 */
const LAST_CATEGORY_KEY = 'fintrack:lastCategoryId'

function readLastCategory(type) {
  try {
    return JSON.parse(localStorage.getItem(LAST_CATEGORY_KEY) ?? '{}')[type] ?? ''
  } catch {
    return ''
  }
}

function writeLastCategory(type, categoryId) {
  try {
    const all = JSON.parse(localStorage.getItem(LAST_CATEGORY_KEY) ?? '{}')
    localStorage.setItem(LAST_CATEGORY_KEY, JSON.stringify({ ...all, [type]: categoryId }))
  } catch {
    // Private mode or disabled storage — the convenience is optional.
  }
}

export default function TransactionForm({ tx, onDone }) {
  const toast = useToast()
  const isEdit = !!tx

  const { data: cats } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories?includeInactive=false').then(r => r.data),
  })

  const { data: allTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: () => api.get('/tags').then(r => r.data),
  })

  const [selectedTagIds, setSelectedTagIds] = useState(() => (tx?.tags ?? []).map(t => t.id))
  const toggleTag = id => setSelectedTagIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const initialType = tx?.type ?? 'EXPENSE'
  const initialStatus = tx?.status ?? 'ACTUAL'

  const { register, handleSubmit, watch, reset, setFocus, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      type: initialType,
      categoryId: tx?.categoryId ?? (isEdit ? '' : readLastCategory(initialType)),
      status: initialStatus,
      currencyCode: tx?.currencyCode ?? 'INR',
      expectedAmountMinor: tx?.expectedAmountMinor != null ? tx.expectedAmountMinor / 100 : null,
      // Today is overwhelmingly the right date for a new entry, and it was
      // previously the one field the user retyped every single time.
      expectedDate: tx?.expectedDate ?? (isEdit ? '' : todayISO()),
      actualAmountMinor: tx?.actualAmountMinor != null ? tx.actualAmountMinor / 100 : null,
      actualDate: tx?.actualDate ?? (isEdit ? '' : todayISO()),
      note: tx?.note ?? '',
    },
  })

  // Land the cursor on the amount — type/status/date/category are all
  // pre-filled, so the amount is the only field that always needs typing.
  const amountField = initialStatus === 'EXPECTED' ? 'expectedAmountMinor' : 'actualAmountMinor'
  useEffect(() => {
    setFocus(amountField)
    // Only on mount: re-focusing when the user switches status would yank
    // the cursor mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedType = watch('type')
  const selectedStatus = watch('status')

  // Set by the "Save & add another" button just before submit, so onSuccess
  // knows whether to reset the form or close the modal.
  const [addAnother, setAddAnother] = useState(false)

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
        tagIds: selectedTagIds,
      }
      return isEdit
        ? api.patch(`/transactions/${tx.id}`, payload)
        : api.post('/transactions', payload)
    },
    onSuccess: (_res, variables) => {
      toast.success(isEdit ? 'Transaction updated' : 'Transaction added')
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['report'] })

      if (variables.type === 'EXPENSE' && variables.status === 'ACTUAL') {
        checkBudgetAlert(variables.categoryId, toast)
      }

      if (!isEdit) writeLastCategory(variables.type, variables.categoryId)

      if (addAnother && !isEdit) {
        // Keep the context the user is working in (type, status, category,
        // date) and clear only what differs per entry.
        reset({
          ...variables,
          expectedAmountMinor: null,
          actualAmountMinor: null,
          note: '',
        })
        setFocus(variables.status === 'EXPECTED' ? 'expectedAmountMinor' : 'actualAmountMinor')
        setSelectedTagIds([])
        return
      }
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
        <label className="block text-xs font-medium text-slate-400 mb-1">Currency</label>
        <select {...register('currencyCode')} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg">
          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
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
                {errors.expectedAmountMinor && <p className="text-red-400 text-xs mt-1">{errors.expectedAmountMinor.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Planned Date</label>
                <input type="date" {...register('expectedDate')}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg" />
                {errors.expectedDate && <p className="text-red-400 text-xs mt-1">{errors.expectedDate.message}</p>}
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
                {errors.actualAmountMinor && <p className="text-red-400 text-xs mt-1">{errors.actualAmountMinor.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Actual Date</label>
                <input type="date" {...register('actualDate')}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg" />
                {errors.actualDate && <p className="text-red-400 text-xs mt-1">{errors.actualDate.message}</p>}
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

      {allTags.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Tags</label>
          <div className="flex flex-wrap gap-1.5">
            {allTags.map(t => {
              const active = selectedTagIds.includes(t.id)
              return (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => toggleTag(t.id)}
                  className="px-2 py-1 rounded-full text-xs font-medium border transition-colors"
                  style={active
                    ? { backgroundColor: `${t.color}33`, color: t.color, borderColor: t.color }
                    : { backgroundColor: 'transparent', color: '#94a3b8', borderColor: '#334155' }}
                >
                  {t.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={isSubmitting}
          onClick={() => setAddAnother(false)}
          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
          {isSubmitting ? 'Saving…' : isEdit ? 'Update' : 'Add Transaction'}
        </button>
        {!isEdit && (
          <button type="submit" disabled={isSubmitting}
            onClick={() => setAddAnother(true)}
            title="Save and keep the form open for the next entry"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-sm font-medium rounded-lg transition-colors whitespace-nowrap">
            Save &amp; add another
          </button>
        )}
      </div>
    </form>
  )
}
