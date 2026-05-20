import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Plus, Edit2, Trash2, Tags } from 'lucide-react'
import api from '../../lib/apiClient'
import { queryClient } from '../../lib/queryClient'
import { useToast } from '../../shared/ToastContext'
import { formatCurrency, formatDate } from '../../lib/format'
import Modal from '../../shared/Modal'
import SnapshotForm from './SnapshotForm'
import AssetCategoryForm from './AssetCategoryForm'

export default function NetWorthPage() {
  const [modal, setModal] = useState(null)
  const toast = useToast()

  const { data: assetCats = [] } = useQuery({
    queryKey: ['asset-categories'],
    queryFn: () => api.get('/asset-categories').then(r => r.data),
  })

  const { data: snapshots = [] } = useQuery({
    queryKey: ['net-worth-snapshots'],
    queryFn: () => api.get('/net-worth-snapshots').then(r => r.data),
  })

  const deleteSnapshotMutation = useMutation({
    mutationFn: id => api.delete(`/net-worth-snapshots/${id}`),
    onSuccess: () => {
      toast.success('Snapshot deleted')
      queryClient.invalidateQueries({ queryKey: ['net-worth-snapshots'] })
    },
    onError: () => toast.error('Delete failed'),
  })

  const deleteAssetCatMutation = useMutation({
    mutationFn: id => api.delete(`/asset-categories/${id}`),
    onSuccess: () => {
      toast.success('Asset category deleted')
      queryClient.invalidateQueries({ queryKey: ['asset-categories'] })
    },
    onError: err => toast.error(err.response?.data?.message ?? 'Delete failed'),
  })

  // Compute net worth trend from snapshots
  const trendData = [...snapshots].reverse().map(s => {
    let balances = {}
    try { balances = JSON.parse(s.balances) } catch {}
    const total = Object.values(balances).reduce((sum, v) => sum + Number(v), 0)
    return { date: s.snapshotDate, totalMinor: total }
  })

  // Latest snapshot balances
  const latestSnapshot = snapshots[0]
  let latestBalances = {}
  if (latestSnapshot?.balances) {
    try { latestBalances = JSON.parse(latestSnapshot.balances) } catch {}
  }
  const totalNetWorth = Object.values(latestBalances).reduce((sum, v) => sum + Number(v), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Net Worth</h1>
          {latestSnapshot && (
            <div className="text-3xl font-bold text-emerald-400 tabular-nums mt-1">
              {formatCurrency(totalNetWorth)}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setModal({ type: 'add-cat' })}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-md transition-colors flex items-center gap-1.5">
            <Tags className="w-4 h-4" /> Asset categories
          </button>
          <button onClick={() => setModal({ type: 'add-snapshot' })}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-md transition-colors flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add snapshot
          </button>
        </div>
      </div>

      {/* Net Worth Trend */}
      {trendData.length > 1 && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-sm font-medium text-slate-300 mb-4">Net Worth Trend</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData}>
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => `₹${(v/100000).toFixed(1)}L`} />
              <Tooltip formatter={v => formatCurrency(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
              <Line type="monotone" dataKey="totalMinor" stroke="#10b981" dot={false} strokeWidth={2} name="Net Worth" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Asset Categories */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">Asset Categories</span>
          </div>
          {assetCats.length === 0 ? (
            <div className="p-6 text-center text-slate-600 text-sm">No asset categories</div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {assetCats.map(a => (
                <div key={a.id} className={`flex items-center justify-between px-4 py-2.5 ${!a.isActive ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: a.color ?? '#64748b' }} />
                    <span className="text-sm text-slate-300">{a.name}</span>
                    <span className="text-xs text-slate-500">{a.kind}</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => setModal({ type: 'edit-cat', cat: a })}
                      className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded" title="Edit">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {!a.isDefault && (
                      <button onClick={() => { if (confirm(`Delete "${a.name}"?`)) deleteAssetCatMutation.mutate(a.id) }}
                        className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Latest Snapshot Breakdown */}
        {latestSnapshot && Object.keys(latestBalances).length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800">
              <span className="text-sm font-medium text-slate-300">Latest Snapshot</span>
              <span className="text-xs text-slate-500 ml-2">({formatDate(latestSnapshot.snapshotDate)})</span>
            </div>
            <div className="divide-y divide-slate-800/50">
              {assetCats.map(a => {
                const bal = latestBalances[a.id] ?? 0
                if (!bal) return null
                return (
                  <div key={a.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: a.color ?? '#64748b' }} />
                      <span className="text-sm text-slate-300">{a.name}</span>
                    </div>
                    <span className="text-sm tabular-nums font-medium text-slate-200">{formatCurrency(Number(bal))}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Snapshot History */}
      {snapshots.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 text-sm font-medium text-slate-300">Snapshot History</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Date</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Total Net Worth</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Note</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map(s => {
                let bal = {}
                try { bal = JSON.parse(s.balances) } catch {}
                const total = Object.values(bal).reduce((sum, v) => sum + Number(v), 0)
                return (
                  <tr key={s.id} className="border-b border-slate-800/50">
                    <td className="px-4 py-2.5 text-slate-300">{formatDate(s.snapshotDate)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium text-emerald-400">{formatCurrency(total)}</td>
                    <td className="px-4 py-2.5 text-slate-500">{s.note ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setModal({ type: 'edit-snapshot', snapshot: s })}
                          className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded" title="Edit">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => { if (confirm('Delete snapshot?')) deleteSnapshotMutation.mutate(s.id) }}
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal?.type === 'add-snapshot' && (
        <Modal title="Add Net Worth Snapshot" onClose={() => setModal(null)} size="lg">
          <SnapshotForm assetCats={assetCats} onDone={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'edit-snapshot' && (
        <Modal title="Edit Snapshot" onClose={() => setModal(null)} size="lg">
          <SnapshotForm snapshot={modal.snapshot} assetCats={assetCats} onDone={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'add-cat' && (
        <Modal title="Add Asset Category" onClose={() => setModal(null)}>
          <AssetCategoryForm onDone={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'edit-cat' && (
        <Modal title="Edit Asset Category" onClose={() => setModal(null)}>
          <AssetCategoryForm cat={modal.cat} onDone={() => setModal(null)} />
        </Modal>
      )}
    </div>
  )
}
