import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../auth/AuthContext'
import { useState } from 'react'

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Required'),
})

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data) {
    setServerError('')
    try {
      const res = await axios.post('/api/v1/auth/login', data, { withCredentials: true })
      login(res.data.user, res.data.accessToken)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setServerError(err.response?.data?.message ?? 'Login failed')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-xl p-8">
        <div className="text-center mb-8">
          <div className="text-2xl font-bold text-emerald-400 mb-1">FinTrack</div>
          <div className="text-slate-500 text-sm">Sign in to your account</div>
        </div>

        {serverError && (
          <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
            <input
              {...register('email')}
              type="email"
              className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="you@example.com"
            />
            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
            <input
              {...register('password')}
              type="password"
              className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="••••••••"
            />
            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
            <div className="text-right mt-1.5">
              <Link to="/forgot-password" className="text-xs text-slate-500 hover:text-emerald-400">Forgot password?</Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          No account?{' '}
          <Link to="/signup" className="text-emerald-400 hover:text-emerald-300">Sign up</Link>
        </p>
      </div>
    </div>
  )
}
