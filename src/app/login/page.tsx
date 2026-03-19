'use client'

import { useState } from 'react'
import { login } from './actions'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const result = await login(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
    // If no error, the server action redirects automatically
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
      </div>

      <p className="mt-8 text-xs text-charcoal/30 tracking-wider">
        © {new Date().getFullYear()} Canturi
      </p>
    </div>
  )
}
