import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import api from '../../lib/apiClient'
import { queryClient } from '../../lib/queryClient'
import { useToast } from '../../shared/ToastContext'

export default function ImportRulesPanel({ categories }) {
  const toast = useToast()
  const [keyword, setKeyword] = useState('')
  const [categoryId, setCategoryId] = useState('')

  const { data: rules = [] } = useQuery({
    queryKey: ['import-rules'],
    queryFn: () => api.get('/import/rules').then(r => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: body => api.put('/import/rules', body),
    onSuccess: () => {
      toast.success('Rule saved')
      setKeyword(''); setCategoryId('')
      queryClient.invalidateQueries({ queryKey: ['import-rules'] })
    },
    onError: err => toast.error(err.response?.data?.message ?? 'Save failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: id => api.delete(`/import/rules/${id}`),
    onSuccess: () => {
      toast.success('Rule removed')
      queryClient.invalidateQueries({ queryKey: ['import-rules'] })
    },
    onError: () => toast.error('Delete failed'),
  })

  const activeCats = categories.filter(c => c.isActive)

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
      <div>
        <div className="text-sm font-semibold text-white">Category rules</div>
        <div className="text-xs text-slate-500 mt-0.5">
          When a statement description contains a keyword, that category is suggested automatically.
          Longer keywords win, so a specific rule beats a broad one.
        </div>
      </div>

      {rules.length > 0 && (
        <div className="space-y-1.5">
          {rules.map(r => (
            <div key={r.id} className="flex items-center justify-between bg-slate-800/60 rounded-lg px-3 py-1.5">
              <div className="text-xs text-slate-300">
                <span className="text-slate-100">{r.keyword}</span>
                <span className="text-slate-600 mx-1.5">→</span>
                {r.categoryName}
              </div>
              <button
                onClick={() => deleteMutation.mutate(r.id)}
                className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                title="Remove"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 items-end pt-1">
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-400 mb-1">Keyword</label>
          <input
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder="e.g. SWIGGY"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-400 mb-1">Category</label>
          <select
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg"
          >
            <option value="">Select…</option>
            {activeCats.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type === 'INCOME' ? 'in' : 'ex'})</option>)}
          </select>
        </div>
        <button
          onClick={() => saveMutation.mutate({ keyword: keyword.trim(), categoryId })}
          disabled={!keyword.trim() || !categoryId || saveMutation.isPending}
          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-sm font-medium rounded-lg transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  )
}
