import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import api from '../../lib/apiClient'
import { queryClient } from '../../lib/queryClient'
import { useToast } from '../../shared/ToastContext'

export default function SnapshotForm({ snapshot, assetCats, onDone }) {
  const isEdit = !!snapshot
  const toast = useToast()

  let existingBalances = {}
  if (snapshot?.balances) {
    try { existingBalances = JSON.parse(snapshot.balances) } catch {}
  }

  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: {
      snapshotDate: snapshot?.snapshotDate ?? new Date().toISOString().slice(0, 10),
      note: snapshot?.note ?? '',
      ...Object.fromEntries(assetCats.map(a => [
        `bal_${a.id}`,
        existingBalances[a.id] != null ? Number(existingBalances[a.id]) / 100 : ''
      ])),
    },
  })

  const mutation = useMutation({
    mutationFn: data => {
      const balances = {}
      assetCats.forEach(a => {
        const raw = data[`bal_${a.id}`]
        if (raw !== '' && raw != null) {
          balances[a.id] = Math.round(Number(raw) * 100)
        }
      })
      const payload = {
        snapshotDate: data.snapshotDate,
        balances: JSON.stringify(balances),
        note: data.note || null,
      }
      return isEdit
        ? api.patch(`/net-worth-snapshots/${snapshot.id}`, payload)
        : api.post('/net-worth-snapshots', payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Snapshot updated' : 'Snapshot saved')
      queryClient.invalidateQueries({ queryKey: ['net-worth-snapshots'] })
      onDone()
    },
    onError: err => toast.error(err.response?.data?.message ?? 'Save failed'),
  })

  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Snapshot Date</label>
        <input type="date" {...register('snapshotDate')}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg" />
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-slate-400">Balances (₹)</div>
        {assetCats.filter(a => a.isActive).map(a => (
          <div key={a.id} className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: a.color ?? '#64748b' }} />
            <label className="text-sm text-slate-300 w-40 truncate">{a.name}</label>
            <input type="number" step="0.01" {...register(`bal_${a.id}`)}
              className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg"
              placeholder="0.00" />
          </div>
        ))}
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Note</label>
        <input {...register('note')} type="text"
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg"
          placeholder="Optional" />
      </div>

      <button type="submit" disabled={isSubmitting}
        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
        {isSubmitting ? 'Saving…' : isEdit ? 'Update Snapshot' : 'Save Snapshot'}
      </button>
    </form>
  )
}
