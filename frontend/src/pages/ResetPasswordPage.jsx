import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { useState } from 'react'

const schema = z.object({
  password: z.string().min(12, 'At least 12 characters').max(128, 'Too long'),
})

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')
  const [done, setDone] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data) {
    setServerError('')
    try {
      await axios.post('/api/v1/auth/reset-password', { token, password: data.password })
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 2000)
    } catch (err) {
      setServerError(err.response?.data?.message ?? 'Reset failed — the link may be invalid or expired')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-xl p-8">
        <div className="text-center mb-8">
          <div className="text-2xl font-bold text-emerald-400 mb-1">FinTrack</div>
          <div className="text-slate-500 text-sm">Choose a new password</div>
        </div>

        {!token && (
          <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
            Missing reset token. Use the link from your reset email.
          </div>
        )}

        {done ? (
          <div className="bg-emerald-900/30 border border-emerald-800 text-emerald-400 text-sm rounded-lg px-4 py-3">
            Password updated. Redirecting to sign in…
          </div>
        ) : (
          <>
            {serverError && (
              <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">New password</label>
                <input
                  {...register('password')}
                  type="password"
                  className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="••••••••"
                />
                {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !token}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors"
              >
                {isSubmitting ? 'Resetting…' : 'Reset password'}
              </button>
            </form>
          </>
        )}

        <p className="text-center text-sm text-slate-500 mt-6">
          <Link to="/login" className="text-emerald-400 hover:text-emerald-300">Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
