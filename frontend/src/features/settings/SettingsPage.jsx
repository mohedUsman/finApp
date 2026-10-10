import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Trash2, Save } from 'lucide-react'
import api from '../../lib/apiClient'
import { queryClient } from '../../lib/queryClient'
import { useToast } from '../../shared/ToastContext'
import { useAuth } from '../../auth/AuthContext'
import { CURRENCIES } from '../../lib/currencies'

export default function SettingsPage() {
  const { user, setUser } = useAuth()
  const toast = useToast()

  const [baseCurrency, setBaseCurrency] = useState(user?.baseCurrencyCode ?? 'INR')
  const [newRateCurrency, setNewRateCurrency] = useState('')
  const [newRateValue, setNewRateValue] = useState('')

  const { data: rates = [] } = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: () => api.get('/exchange-rates').then(r => r.data),
  })

  const baseMutation = useMutation({
    mutationFn: code => api.patch('/me', { baseCurrencyCode: code }),
    onSuccess: ({ data }) => {
      setUser(data)
      toast.success('Base currency updated')
      queryClient.invalidateQueries({ queryKey: ['report'] })
    },
    onError: err => toast.error(err.response?.data?.message ?? 'Update failed'),
  })

  const rateMutation = useMutation({
    mutationFn: ({ currencyCode, rateToBase }) => api.put('/exchange-rates', { currencyCode, rateToBase }),
    onSuccess: () => {
      toast.success('Exchange rate saved')
      queryClient.invalidateQueries({ queryKey: ['exchange-rates'] })
      queryClient.invalidateQueries({ queryKey: ['report'] })
      setNewRateCurrency('')
      setNewRateValue('')
    },
    onError: err => toast.error(err.response?.data?.message ?? 'Save failed'),
  })

  const deleteRateMutation = useMutation({
    mutationFn: id => api.delete(`/exchange-rates/${id}`),
    onSuccess: () => {
      toast.success('Exchange rate removed')
      queryClient.invalidateQueries({ queryKey: ['exchange-rates'] })
      queryClient.invalidateQueries({ queryKey: ['report'] })
    },
    onError: () => toast.error('Delete failed'),
  })

  const ratableCurrencies = CURRENCIES.filter(c => c !== baseCurrency && !rates.some(r => r.currencyCode === c))

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold text-slate-100">Settings</h1>

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
        <div>
          <div className="text-sm font-semibold text-white">Base Currency</div>
          <div className="text-xs text-slate-500 mt-0.5">
            Reports convert every transaction into this currency using the exchange rates below.
          </div>
        </div>
        <div className="flex gap-2">
          <select
            value={baseCurrency}
            onChange={e => setBaseCurrency(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg"
          >
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            onClick={() => baseMutation.mutate(baseCurrency)}
            disabled={baseMutation.isPending || baseCurrency === user?.baseCurrencyCode}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" /> Save
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-4">
        <div>
          <div className="text-sm font-semibold text-white">Exchange Rates</div>
          <div className="text-xs text-slate-500 mt-0.5">
            Entered manually — 1 unit of the currency equals this many units of your base currency ({baseCurrency}).
            There's no live FX feed, so update these as rates change.
          </div>
        </div>

        {rates.length > 0 && (
          <div className="space-y-2">
            {rates.map(r => (
              <div key={r.id} className="flex items-center justify-between bg-slate-800/60 rounded-lg px-3 py-2">
                <div className="text-sm text-slate-200 tabular-nums">
                  1 {r.currencyCode} = {r.rateToBase} {baseCurrency}
                </div>
                <button
                  onClick={() => deleteRateMutation.mutate(r.id)}
                  className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                  title="Remove"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {ratableCurrencies.length > 0 && (
          <div className="flex gap-2 items-end pt-2 border-t border-slate-800">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Currency</label>
              <select
                value={newRateCurrency}
                onChange={e => setNewRateCurrency(e.target.value)}
                className="px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg"
              >
                <option value="">Select…</option>
                {ratableCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Rate to {baseCurrency}</label>
              <input
                type="number" step="0.00000001" min="0"
                value={newRateValue}
                onChange={e => setNewRateValue(e.target.value)}
                className="w-32 px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg"
                placeholder="e.g. 83.25"
              />
            </div>
            <button
              onClick={() => rateMutation.mutate({ currencyCode: newRateCurrency, rateToBase: Number(newRateValue) })}
              disabled={!newRateCurrency || !newRateValue || rateMutation.isPending}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-sm font-medium rounded-lg transition-colors"
            >
              Add
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
