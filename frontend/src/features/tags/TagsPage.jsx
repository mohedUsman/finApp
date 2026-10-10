import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, Tag as TagIcon } from 'lucide-react'
import api from '../../lib/apiClient'
import { queryClient } from '../../lib/queryClient'
import { useToast } from '../../shared/ToastContext'
import Modal from '../../shared/Modal'

const tagSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a valid color'),
})

function TagForm({ tag, onDone }) {
  const toast = useToast()
  const isEdit = Boolean(tag)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(tagSchema),
    defaultValues: { name: tag?.name ?? '', color: tag?.color ?? '#64748b' },
  })

  const mutation = useMutation({
    mutationFn: data => isEdit
      ? api.patch(`/tags/${tag.id}`, data)
      : api.post('/tags', data),
    onSuccess: () => {
      toast.success(isEdit ? 'Tag updated' : 'Tag created')
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      onDone()
    },
    onError: err => toast.error(err.response?.data?.message ?? 'Save failed'),
  })

  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Name</label>
        <input {...register('name')}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg"
          placeholder="e.g. vacation" />
        {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Color</label>
        <div className="flex items-center gap-2">
          <input type="color" {...register('color')}
            className="w-10 h-9 bg-slate-800 border border-slate-700 rounded-lg cursor-pointer" />
          <input {...register('color')}
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg tabular-nums"
            placeholder="#64748b" />
        </div>
        {errors.color && <p className="text-red-400 text-xs mt-1">{errors.color.message}</p>}
      </div>
      <button type="submit" disabled={isSubmitting}
        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
        {isSubmitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Tag'}
      </button>
    </form>
  )
}

export default function TagsPage() {
  const [modal, setModal] = useState(null)
  const toast = useToast()

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ['tags'],
    queryFn: () => api.get('/tags').then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: id => api.delete(`/tags/${id}`),
    onSuccess: () => {
      toast.success('Tag deleted')
      queryClient.invalidateQueries({ queryKey: ['tags'] })
    },
    onError: () => toast.error('Delete failed'),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Tags</h1>
        <button
          onClick={() => setModal({ type: 'add' })}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-md transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> New tag
        </button>
      </div>

      {isLoading ? (
        <div className="text-slate-500 text-sm">Loading…</div>
      ) : tags.length === 0 ? (
        <div className="text-center py-12 text-slate-600">No tags yet. Create one to label transactions.</div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-lg divide-y divide-slate-800">
          {tags.map(t => (
            <div key={t.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium"
                  style={{ backgroundColor: `${t.color}22`, color: t.color }}
                >
                  <TagIcon className="w-3 h-3" /> {t.name}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setModal({ type: 'edit', tag: t })}
                  className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded" title="Edit">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => { if (confirm(`Delete tag "${t.name}"?`)) deleteMutation.mutate(t.id) }}
                  className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded" title="Delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal?.type === 'add' && (
        <Modal title="New Tag" onClose={() => setModal(null)} size="sm">
          <TagForm onDone={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'edit' && (
        <Modal title="Edit Tag" onClose={() => setModal(null)} size="sm">
          <TagForm tag={modal.tag} onDone={() => setModal(null)} />
        </Modal>
      )}
    </div>
  )
}
