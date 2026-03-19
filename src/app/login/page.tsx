'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Incorrect email or password. Please try again.')
      setLoading(false)
      return
    }

    if (data.user) {
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user.id)
        .single()

      const role = profile?.role
      // Full browser redirect — ensures cookies are sent with the new request
      if (role === 'trainee') window.location.href = '/trainee'
      else if (role === 'manager') window.location.href = '/manager'
      else if (role === 'head_office') window.location.href = '/head-office'
      else window.location.href = '/trainee'
    }
  }

  return (
    <div className="min-h-screen bg-ivory flex flex-col items-center justify-center px-4">
      {/* Logo / wordmark */}
      <div className="mb-10 text-center">
        <p className="font-serif text-3xl tracking-[0.15em] text-charcoal uppercase">Canturi</p>
        <p className="text-sm text-charcoal/50 tracking-[0.25em] uppercase mt-1 font-light">Training Studio</p>
        <div className="mt-4 w-8 h-px bg-gold mx-auto" />
      </div>

      {/* Card */}
      <div className="card w-full max-w-sm p-8">
        <h1 className="font-serif text-xl text-charcoal mb-6">Sign in</h1>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-charcoal/60 uppercase tracking-wider mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="input"
              placeholder="your@email.com"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-charcoal/60 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-gold w-full mt-2"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>

      <p className="mt-8 text-xs text-charcoal/30 tracking-wider">
        © {new Date().getFullYear()} Canturi
      </p>
    </div>
  )
}
