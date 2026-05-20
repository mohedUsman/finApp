import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../auth/AuthContext'
import { useState } from 'react'

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(12, 'At least 12 characters').max(128),
  phone: z.string().max(20).optional().or(z.literal('')),
})

export default function SignupPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data) {
    setServerError('')
    try {
      const payload = { email: data.email, password: data.password }
      if (data.phone) payload.phone = data.phone
      const res = await axios.post('/api/v1/auth/register', payload, { withCredentials: true })
      login(res.data.user, res.data.accessToken)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setServerError(err.response?.data?.message ?? 'Registration failed')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-xl p-8">
        <div className="text-center mb-8">
          <div className="text-2xl font-bold text-emerald-400 mb-1">FinTrack</div>
          <div className="text-slate-500 text-sm">Create your account</div>
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
              placeholder="Min 12 characters"
            />
            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Phone <span className="text-slate-500">(optional)</span>
            </label>
            <input
              {...register('phone')}
              type="tel"
              className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="+91 98765 43210"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors"
          >
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          Have an account?{' '}
          <Link to="/login" className="text-emerald-400 hover:text-emerald-300">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
