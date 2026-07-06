import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertTriangle } from 'lucide-react'
import Modal from './Modal'
import api from '../lib/apiClient'
import { useAuth } from '../auth/AuthContext'

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
})

export default function DeleteAccountModal({ onClose }) {
  const { logout } = useAuth()
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data) {
    setServerError('')
    try {
      await api.delete('/me', { data })
      await logout()
    } catch (err) {
      setServerError(err.response?.data?.message ?? 'Failed to delete account. Please try again.')
    }
  }

  return (
    <Modal title="Delete Account" onClose={onClose} size="sm">
      <div className="space-y-4">
        <div className="flex gap-3 p-3 bg-rose-950/40 border border-rose-900/60 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <p className="text-xs text-rose-300 leading-relaxed">
            This permanently deletes your account and all data — transactions, categories,
            recurring rules, and net worth history. This cannot be undone.
          </p>
        </div>

        {serverError && (
          <div className="bg-red-900/30 border border-red-800 text-red-400 text-xs rounded-lg px-3 py-2">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Confirm Email</label>
            <input
              {...register('email')}
              type="email"
              autoComplete="email"
              className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 text-sm focus:outline-none focus:border-rose-500 transition-colors"
              placeholder="you@example.com"
            />
            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Confirm Password</label>
            <input
              {...register('password')}
              type="password"
              autoComplete="current-password"
              className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 text-sm focus:outline-none focus:border-rose-500 transition-colors"
              placeholder="••••••••"
            />
            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2 bg-rose-700 hover:bg-rose-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {isSubmitting ? 'Deleting…' : 'Delete Account'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  )
}
