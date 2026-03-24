'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setTimeout(() => router.push('/login'), 3000)
  }

  return (
    <div className="min-h-screen bg-ivory flex flex-col items-center justify-center px-4">
      <div className="mb-10 text-center">
        <p className="font-serif text-3xl tracking-[0.15em] text-charcoal uppercase">Canturi</p>
        <p className="text-sm text-charcoal/50 tracking-[0.25em] uppercase mt-1 font-light">Training Studio</p>
        <div className="mt-4 w-8 h-px bg-gold mx-auto" />
      </div>

      <div className="card w-full max-w-sm p-8">
        {success ? (
          <div className="text-center py-4">
            <p className="font-serif text-xl text-charcoal mb-3">Password updated</p>
            <p className="text-sm text-charcoal/50 leading-relaxed">
              Redirecting you to sign in…
            </p>
          </div>
        ) : (
          <>
            <h1 className="font-serif text-xl text-charcoal mb-2">Set new password</h1>
            <p className="text-sm text-charcoal/40 mb-6">Choose a new password for your account.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-charcoal/60 uppercase tracking-wider mb-1.5">
                  New password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input"
                  placeholder="••••••••"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-charcoal/60 uppercase tracking-wider mb-1.5">
                  Confirm password
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
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
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>

      <p className="mt-8 text-xs text-charcoal/30 tracking-wider">
        © {new Date().getFullYear()} Canturi
      </p>
    </div>
  )
}
