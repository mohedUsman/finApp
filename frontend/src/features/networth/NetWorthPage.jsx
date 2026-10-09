import { useState, useMemo } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts'
import { Plus, Edit2, Trash2, Tags } from 'lucide-react'
import api from '../../lib/apiClient'
import { queryClient } from '../../lib/queryClient'
import { useToast } from '../../shared/ToastContext'
import { formatCurrency } from '../../lib/format'
import Modal from '../../shared/Modal'
import QueryState from '../../shared/QueryState'
import SnapshotForm from './SnapshotForm'
import AssetCategoryForm from './AssetCategoryForm'

// ── helpers ──────────────────────────────────────────────────────────────────

function parseBalances(raw) {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try { return JSON.parse(raw) } catch { return {} }
}

function sumBalances(balances) {
  return Object.values(balances).reduce((s, v) => s + Number(v), 0)
}

const inrExact = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 })
function fmtExact(minor) {
  if (minor == null) return '—'
  return inrExact.format(Number(minor) / 100)
}

function fmtCompact(minor) {
  if (minor == null) return '—'
  const abs = Math.abs(minor) / 100
  const sign = minor < 0 ? '-' : ''
  if (abs >= 10000000) return sign + '₹' + (abs / 10000000).toFixed(2) + 'Cr'
  if (abs >= 100000)   return sign + '₹' + (abs / 100000).toFixed(2) + 'L'
  if (abs >= 1000)     return sign + '₹' + (abs / 1000).toFixed(1) + 'K'
  return sign + '₹' + abs.toFixed(0)
}

function computeDerived(sortedSnapshots, stockCatId) {
  return sortedSnapshots.map((s, i) => {
    const balances    = parseBalances(s.balances)
    const prev        = i > 0 ? sortedSnapshots[i - 1] : null
    const prevBal     = prev ? parseBalances(prev.balances) : {}
    const total       = sumBalances(balances)
    const prevTotal   = sumBalances(prevBal)
    const surplus     = prev != null ? total - prevTotal : null
    const stock       = stockCatId ? Number(balances[stockCatId] ?? 0) : 0
    const prevStock   = stockCatId ? Number(prevBal[stockCatId] ?? 0) : 0
    const stockDelta  = prev != null ? stock - prevStock : null
    return { ...s, _bal: balances, _total: total, _surplus: surplus, _stockDelta: stockDelta }
  })
}

const KIND_LABEL = {
  bank: 'Bank', investment: 'Investment', cash: 'Cash',
  crypto: 'Crypto', real_estate: 'Real Estate', gold: 'Gold', other: 'Other',
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function NetWorthPage() {
  const [modal, setModal] = useState(null)
  const toast = useToast()

  const assetCatsQuery = useQuery({
    queryKey: ['asset-categories'],
    queryFn: () => api.get('/asset-categories').then(r => r.data),
  })

  const snapshotsQuery = useQuery({
    queryKey: ['net-worth-snapshots'],
    queryFn: () => api.get('/net-worth-snapshots').then(r => r.data),
  })

  const assetCats = assetCatsQuery.data ?? []
  const rawSnapshots = snapshotsQuery.data ?? []

  // Every figure on this page derives from these two queries. Showing the
  // page while either is pending or failed would render "₹0.00" as if it
  // were a real balance.
  const isLoading = assetCatsQuery.isLoading || snapshotsQuery.isLoading
  const isError = assetCatsQuery.isError || snapshotsQuery.isError
  const loadError = assetCatsQuery.error ?? snapshotsQuery.error

  const deleteSnapshotMutation = useMutation({
    mutationFn: id => api.delete(`/net-worth-snapshots/${id}`),
    onSuccess: () => {
      toast.success('Snapshot deleted')
      queryClient.invalidateQueries({ queryKey: ['net-worth-snapshots'] })
    },
    onError: () => toast.error('Delete failed'),
  })

  const deleteAssetMutation = useMutation({
    mutationFn: id => api.delete(`/asset-categories/${id}`),
    onSuccess: () => {
      toast.success('Asset category deleted')
      queryClient.invalidateQueries({ queryKey: ['asset-categories'] })
    },
    onError: err => toast.error(err.response?.data?.message ?? 'Delete failed'),
  })

  const activeAssets = useMemo(
    () => [...assetCats].filter(a => a.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [assetCats],
  )

  // Find "Stock" category for stock-delta computation
  const stockCatId = useMemo(
    () => assetCats.find(a => a.name.toLowerCase() === 'stock')?.id ?? null,
    [assetCats],
  )

  // API returns desc → sort asc for chart/computation
  const sortedAsc = useMemo(
    () => [...rawSnapshots].sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate)),
    [rawSnapshots],
  )

  const derived = useMemo(() => computeDerived(sortedAsc, stockCatId), [sortedAsc, stockCatId])

  const latest = derived[derived.length - 1]
  const prev   = derived[derived.length - 2]

  const latestTotal   = latest?._total ?? 0
  const prevTotal     = prev?._total ?? 0
  const monthDelta    = latestTotal - prevTotal
  const monthDeltaPct = prevTotal > 0 ? (monthDelta / prevTotal) * 100 : 0

  // Chart: one row per snapshot, total + one key per active asset
  const chartData = useMemo(() => derived.map(s => {
    const row = {
      label: new Date(s.snapshotDate + 'T00:00:00').toLocaleString('en-US', { month: 'short', year: '2-digit' }),
      total: s._total / 100,
    }
    activeAssets.forEach(a => { row[a.id] = Number(s._bal[a.id] ?? 0) / 100 })
    return row
  }), [derived, activeAssets])

  // Breakdown of latest snapshot for pie + balance list
  const breakdown = useMemo(() => {
    if (!latest) return []
    return activeAssets.map(a => ({
      id: a.id,
      name: a.name,
      color: a.color ?? '#64748b',
      kind: a.kind,
      amountMinor: Number(latest._bal[a.id] ?? 0),
      pct: latestTotal > 0 ? (Number(latest._bal[a.id] ?? 0) / latestTotal) * 100 : 0,
    })).sort((a, b) => b.amountMinor - a.amountMinor)
  }, [latest, activeAssets, latestTotal])

  const byKind = useMemo(() => {
    const map = {}
    breakdown.forEach(b => {
      if (!map[b.kind]) map[b.kind] = { kind: b.kind, total: 0 }
      map[b.kind].total += b.amountMinor
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [breakdown])

  return (
    <div className="space-y-4">

      {/* ── header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Net Worth</h1>
          <div className="text-xs text-slate-500">
            {rawSnapshots.length} monthly snapshots · {activeAssets.length} asset buckets
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setModal({ type: 'manage-assets' })}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-md transition-colors flex items-center gap-1.5"
          >
            <Tags className="w-4 h-4" /> Asset categories
          </button>
          <button
            onClick={() => setModal({ type: 'add-snapshot' })}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-md transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add snapshot
          </button>
        </div>
      </div>

      {(isLoading || isError) && (
        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={loadError}
          label="net worth"
          onRetry={() => { assetCatsQuery.refetch(); snapshotsQuery.refetch() }}
        />
      )}

      {!isLoading && !isError && (
      <>
      {/* ── hero KPIs ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">

        {/* Current Net Worth — large card */}
        <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-slate-900/50 border border-slate-800 rounded-lg p-5">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">Current Net Worth</div>
          <div className="text-4xl font-bold text-white tabular-nums mt-1">
            {formatCurrency(latestTotal)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            As of {latest ? latest.snapshotDate : '—'}
          </div>
          {prev && (
            <div className="mt-3 flex items-center gap-2">
              <span className={`text-sm font-semibold tabular-nums ${monthDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {monthDelta >= 0 ? '▲' : '▼'} {fmtCompact(Math.abs(monthDelta))}
              </span>
              <span className={`text-xs ${monthDelta >= 0 ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>
                ({monthDeltaPct >= 0 ? '+' : ''}{monthDeltaPct.toFixed(2)}%)
              </span>
              <span className="text-xs text-slate-500">vs last month</span>
            </div>
          )}
        </div>

        {/* Surplus */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Last Month Surplus</div>
          <div className={`text-2xl font-bold tabular-nums ${(latest?._surplus ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {latest?._surplus != null ? fmtCompact(latest._surplus) : '—'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Net worth change vs prev month</div>
        </div>

        {/* Stock Returns */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Stock Returns</div>
          <div className={`text-2xl font-bold tabular-nums ${(latest?._stockDelta ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {latest?._stockDelta != null ? fmtCompact(latest._stockDelta) : '—'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Stock balance change vs prev month</div>
        </div>
      </div>

      {/* ── net worth trend chart ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div className="text-sm font-semibold text-white mb-3">Net Worth Trend</div>
        {chartData.length === 1 && (
          <div className="mb-3 text-xs text-slate-500 text-center">
            Add a second snapshot to see the trend line — one data point draws only a dot.
          </div>
        )}
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} stroke="#334155" />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 10 }} stroke="#334155"
                tickFormatter={v =>
                  v >= 100000 ? `₹${(v / 100000).toFixed(1)}L`
                  : v >= 1000 ? `₹${(v / 1000).toFixed(0)}K`
                  : `₹${v}`
                }
              />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, fontSize: 12 }}
                formatter={(v, name) => [formatCurrency(v * 100), name]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="total" stroke="#ffffff" strokeWidth={3} dot={{ r: 4 }} name="Total Net Worth" />
              {activeAssets.map(a => (
                <Line
                  key={a.id} type="monotone" dataKey={a.id}
                  stroke={a.color ?? '#64748b'} strokeWidth={1.5} dot={{ r: 2 }} name={a.name}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-60 flex items-center justify-center text-xs text-slate-500">
            No snapshots yet — add one to see the trend
          </div>
        )}
      </div>

      {/* ── allocation pie + current balances ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

        {/* Donut pie */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-sm font-semibold text-white mb-1">Asset Allocation</div>
          <div className="text-xs text-slate-500 mb-3">Latest snapshot</div>
          {breakdown.filter(b => b.amountMinor > 0).length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={breakdown.filter(b => b.amountMinor > 0)}
                  dataKey="amountMinor" nameKey="name"
                  cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}
                >
                  {breakdown.filter(b => b.amountMinor > 0).map(b => (
                    <Cell key={b.id} fill={b.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, fontSize: 12 }}
                  formatter={v => formatCurrency(v)}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-xs text-slate-500">No data</div>
          )}
        </div>

        {/* Balance list + by-kind subtotals */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-sm font-semibold text-white mb-3">Current Balances</div>
          {breakdown.length > 0 ? (
            <>
              <div className="space-y-2 max-h-52 overflow-auto pr-1">
                {breakdown.map(b => (
                  <div key={b.id} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: b.color }} />
                    <div className="text-sm text-slate-200 flex-1 min-w-0 truncate">{b.name}</div>
                    <div className="text-xs text-slate-500 w-14 text-right tabular-nums">
                      {b.pct.toFixed(1)}%
                    </div>
                    <div className="text-sm font-semibold text-white tabular-nums w-28 text-right">
                      {fmtCompact(b.amountMinor)}
                    </div>
                    <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden shrink-0">
                      <div className="h-full rounded-full" style={{ width: `${b.pct}%`, background: b.color }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* By-kind subtotals */}
              {byKind.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-2">
                  {byKind.map(k => (
                    <div key={k.kind} className="text-xs">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                        {KIND_LABEL[k.kind] ?? k.kind}
                      </div>
                      <div className="text-sm font-semibold text-white tabular-nums">
                        {fmtCompact(k.total)}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {latestTotal > 0 ? ((k.total / latestTotal) * 100).toFixed(1) : 0}%
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-xs text-slate-500 py-4 text-center">No assets in latest snapshot</div>
          )}
        </div>
      </div>

      {/* ── monthly snapshots table ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="text-sm font-semibold text-white">Monthly Snapshots</div>
          <div className="text-xs text-slate-500">{rawSnapshots.length} entries</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-800">
                <th className="text-left py-2.5 px-4 font-medium whitespace-nowrap">Date</th>
                {activeAssets.map(a => (
                  <th
                    key={a.id}
                    className="text-right py-2.5 px-3 font-medium whitespace-nowrap"
                    style={{ color: a.color ?? '#64748b' }}
                  >
                    {a.name}
                  </th>
                ))}
                <th className="text-right py-2.5 px-3 font-medium text-white whitespace-nowrap">Total</th>
                <th className="text-right py-2.5 px-3 font-medium whitespace-nowrap">Surplus</th>
                <th className="text-right py-2.5 px-3 font-medium whitespace-nowrap">Stock Δ</th>
                <th className="text-right py-2.5 px-4 font-medium pr-4 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {derived.length === 0 && (
                <tr>
                  <td
                    colSpan={activeAssets.length + 5}
                    className="py-8 text-center text-xs text-slate-500"
                  >
                    No snapshots yet
                  </td>
                </tr>
              )}
              {[...derived].reverse().map(s => (
                <tr key={s.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="py-2 px-4 text-slate-200 tabular-nums whitespace-nowrap">
                    {s.snapshotDate}
                  </td>
                  {activeAssets.map(a => (
                    <td key={a.id} className="py-2 px-3 text-right text-slate-300 tabular-nums whitespace-nowrap">
                      {s._bal[a.id] ? fmtExact(Number(s._bal[a.id])) : '—'}
                    </td>
                  ))}
                  <td className="py-2 px-3 text-right text-white font-semibold tabular-nums whitespace-nowrap">
                    {fmtExact(s._total)}
                  </td>
                  <td className={`py-2 px-3 text-right tabular-nums whitespace-nowrap font-medium ${
                    (s._surplus ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {s._surplus != null ? fmtExact(s._surplus) : '—'}
                  </td>
                  <td className={`py-2 px-3 text-right tabular-nums whitespace-nowrap font-medium ${
                    (s._stockDelta ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {s._stockDelta != null ? fmtExact(s._stockDelta) : '—'}
                  </td>
                  <td className="py-2 px-4 text-right pr-4 whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setModal({ type: 'edit-snapshot', snapshot: s })}
                        className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { if (confirm('Delete snapshot?')) deleteSnapshotMutation.mutate(s.id) }}
                        className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      </>
      )}

      {/* ── modals ── */}
      {modal?.type === 'add-snapshot' && (
        <Modal title="New Monthly Snapshot" onClose={() => setModal(null)} size="lg">
          <SnapshotForm assetCats={activeAssets} onDone={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'edit-snapshot' && (
        <Modal title="Edit Snapshot" onClose={() => setModal(null)} size="lg">
          <SnapshotForm snapshot={modal.snapshot} assetCats={activeAssets} onDone={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'manage-assets' && (
        <Modal title="Asset Categories" onClose={() => setModal(null)} size="lg">
          <AssetManagerPanel
            assets={assetCats}
            onAddNew={() => setModal({ type: 'add-asset' })}
            onEdit={cat => setModal({ type: 'edit-asset', cat })}
            onDelete={cat => {
              if (cat.isDefault) {
                toast.error('Default assets can only be deactivated via edit')
                return
              }
              if (confirm(`Delete "${cat.name}"?`)) deleteAssetMutation.mutate(cat.id)
            }}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
      {modal?.type === 'add-asset' && (
        <Modal
          title="New Asset Category"
          onClose={() => setModal({ type: 'manage-assets' })}
        >
          <AssetCategoryForm onDone={() => setModal({ type: 'manage-assets' })} />
        </Modal>
      )}
      {modal?.type === 'edit-asset' && (
        <Modal
          title="Edit Asset Category"
          onClose={() => setModal({ type: 'manage-assets' })}
        >
          <AssetCategoryForm cat={modal.cat} onDone={() => setModal({ type: 'manage-assets' })} />
        </Modal>
      )}
    </div>
  )
}

// ── asset manager panel (rendered inside the manage-assets modal) ─────────────

function AssetManagerPanel({ assets, onAddNew, onEdit, onDelete, onClose }) {
  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-500">
        Manage buckets where your money sits. Default assets can be deactivated (via edit) but not deleted.
      </div>
      <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
        {assets.map(a => (
          <div
            key={a.id}
            className={`flex items-center gap-2 p-2.5 rounded border border-slate-800 ${!a.isActive ? 'opacity-50' : ''}`}
          >
            <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: a.color ?? '#64748b' }} />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-slate-200">{a.name}</div>
              <div className="text-[10px] text-slate-500">{KIND_LABEL[a.kind] ?? a.kind}</div>
            </div>
            {a.isDefault && (
              <span className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded">DEFAULT</span>
            )}
            {!a.isActive && (
              <span className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded">INACTIVE</span>
            )}
            <button
              onClick={() => onEdit(a)}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
              title="Edit"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            {!a.isDefault && (
              <button
                onClick={() => onDelete(a)}
                className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        onClick={onAddNew}
        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
      >
        <Plus className="w-4 h-4" /> New asset category
      </button>
      <div className="flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  )
}
