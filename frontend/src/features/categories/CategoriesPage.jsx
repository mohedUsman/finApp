import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, ChevronRight } from 'lucide-react'
import api from '../../lib/apiClient'
import { queryClient } from '../../lib/queryClient'
import { useToast } from '../../shared/ToastContext'
import Modal from '../../shared/Modal'
import CategoryForm from './CategoryForm'

function CategoryRow({ cat, onEdit, onDelete, children, isChild }) {
  return (
    <div>
      <div className={`flex items-center justify-between px-4 py-2 border-b border-slate-800/50 hover:bg-slate-800/30 ${isChild ? 'pl-8 bg-slate-900/50' : ''} ${!cat.isActive ? 'opacity-50' : ''}`}>
        <div className="flex items-center gap-2">
          {isChild && <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />}
          <span className={`text-sm ${isChild ? 'text-slate-300' : 'text-slate-200'}`}>{cat.name}</span>
          {cat.isDefault && <span className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded">DEFAULT</span>}
          {!cat.isActive && <span className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded">INACTIVE</span>}
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={() => onEdit(cat)}
            className="p-1 text-slate-500 hover:text-white rounded transition-colors" title="Edit">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          {!cat.isDefault && (
            <button onClick={() => onDelete(cat)}
              className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors" title="Delete">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      {children && <div>{children}</div>}
    </div>
  )
}

export default function CategoriesPage() {
  const [tab, setTab] = useState('EXPENSE')
  const [modal, setModal] = useState(null)
  const toast = useToast()

  const { data: cats = [], isLoading } = useQuery({
    queryKey: ['categories', 'all'],
    queryFn: () => api.get('/categories?includeInactive=true').then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: id => api.delete(`/categories/${id}`),
    onSuccess: () => {
      toast.success('Category deleted')
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
    onError: err => toast.error(err.response?.data?.message ?? 'Delete failed'),
  })

  const filtered = cats.filter(c => c.type === tab)
  const parents = filtered.filter(c => !c.parentId)
  const children = filtered.filter(c => c.parentId)

  function handleDelete(cat) {
    if (confirm(`Delete "${cat.name}"?`)) deleteMutation.mutate(cat.id)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Categories</h1>
        <button onClick={() => setModal({ type: 'add' })}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-md transition-colors flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> New category
        </button>
      </div>

      <div className="flex gap-2">
        {['EXPENSE', 'INCOME'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              tab === t ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:bg-slate-800'
            }`}>{t}</button>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-4 text-slate-500 text-sm">Loading…</div>
        ) : parents.length === 0 ? (
          <div className="p-8 text-center text-slate-600 text-sm">No categories</div>
        ) : (
          parents.map(parent => (
            <CategoryRow key={parent.id} cat={parent}
              onEdit={cat => setModal({ type: 'edit', cat })}
              onDelete={handleDelete}>
              {children.filter(c => c.parentId === parent.id).map(child => (
                <CategoryRow key={child.id} cat={child} isChild
                  onEdit={cat => setModal({ type: 'edit', cat })}
                  onDelete={handleDelete} />
              ))}
            </CategoryRow>
          ))
        )}
      </div>

      {modal?.type === 'add' && (
        <Modal title="Add Category" onClose={() => setModal(null)}>
          <CategoryForm defaultType={tab} onDone={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'edit' && (
        <Modal title="Edit Category" onClose={() => setModal(null)}>
          <CategoryForm cat={modal.cat} onDone={() => setModal(null)} />
        </Modal>
      )}
    </div>
  )
}
