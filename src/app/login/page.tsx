'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'reset'>('login')
  const [resetSent, setResetSent] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string

    if (mode === 'reset') {
      const supabase = createClient()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      })
      if (resetError) {
        setError(resetError.message)
      } else {
        setResetSent(true)
      }
      setLoading(false)
      return
    }

    const password = formData.get('password') as string

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Login failed.')
      setLoading(false)
      return
    }

    window.location.href = data.redirectTo
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
        {mode === 'login' ? (
          <>
            <h1 className="font-serif text-xl text-charcoal mb-6">Sign in</h1>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-charcoal/60 uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
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
                  name="password"
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

            <button
              onClick={() => { setMode('reset'); setError(null); setResetSent(false) }}
              className="w-full mt-4 text-xs text-charcoal/40 hover:text-gold transition-colors"
            >
              Forgot password?
            </button>
          </>
        ) : resetSent ? (
          <div className="text-center py-4">
            <p className="font-serif text-xl text-charcoal mb-3">Check your email</p>
            <p className="text-sm text-charcoal/50 leading-relaxed mb-6">
              We&apos;ve sent a password reset link to your email address.
            </p>
            <button
              onClick={() => { setMode('login'); setResetSent(false); setError(null) }}
              className="text-xs text-gold hover:text-gold/80 transition-colors"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            <h1 className="font-serif text-xl text-charcoal mb-2">Reset password</h1>
            <p className="text-sm text-charcoal/40 mb-6">Enter your email and we&apos;ll send you a link to reset your password.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-charcoal/60 uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  className="input"
                  placeholder="your@email.com"
                  required
                  autoFocus
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
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>

            <button
              onClick={() => { setMode('login'); setError(null) }}
              className="w-full mt-4 text-xs text-charcoal/40 hover:text-gold transition-colors"
            >
              Back to sign in
            </button>
          </>
        )}
      </div>

      <p className="mt-8 text-xs text-charcoal/30 tracking-wider">
        © {new Date().getFullYear()} Canturi
      </p>
    </div>
  )
}
