'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@/types'

interface Props {
  users: User[]
}

export function ImpersonateUsers({ users }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const roleLabel = (role: string) =>
    role === 'head_office' ? 'Head Office' : role === 'manager' ? 'Manager' : 'Trainee'

  const roleColour = (role: string) =>
    role === 'head_office' ? 'bg-gold/10 text-gold' : role === 'manager' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'

  const filtered = users.filter(u => {
    const q = search.toLowerCase().trim()
    if (!q) return true
    return [u.name, u.email, u.role, u.boutique?.name].some(s => s && s.toLowerCase().includes(q))
  })

  // Group by role
  const grouped = {
    manager: filtered.filter(u => u.role === 'manager'),
    trainee: filtered.filter(u => u.role === 'trainee'),
    head_office: filtered.filter(u => u.role === 'head_office'),
  }

  async function handleImpersonate(userId: string) {
    setLoading(userId)
    try {
      const res = await fetch('/api/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (data.success && data.token_hash) {
        // Verify the OTP client-side to set the session
        const { error } = await supabase.auth.verifyOtp({
          token_hash: data.token_hash,
          type: 'magiclink',
        })
        if (error) {
          alert('Failed to sign in: ' + error.message)
        } else {
          window.location.href = data.redirectTo
        }
      } else {
        alert('Failed to sign in: ' + (data.error || 'Unknown error'))
      }
    } catch {
      alert('Failed to sign in')
    }
    setLoading(null)
  }

  return (
    <div className="px-5 py-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-charcoal">View As</h1>
          <p className="text-sm text-charcoal/40 mt-1">Sign in as any user to see their view</p>
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search users..."
          className="input py-2 px-4 text-sm w-64"
        />
      </div>

      {(['manager', 'trainee', 'head_office'] as const).map(role => {
        const items = grouped[role]
        if (items.length === 0) return null
        return (
          <div key={role} className="mb-8">
            <h2 className="text-xs font-medium text-charcoal/40 uppercase tracking-wider mb-3">{roleLabel(role)}s</h2>
            <div className="space-y-2">
              {items.map(user => (
                <div
                  key={user.id}
                  className="card p-4 flex items-center gap-4 hover:shadow-md transition-shadow"
                >
                  <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-medium text-gold">{user.avatar_initials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-charcoal">{user.name}</p>
                    <p className="text-xs text-charcoal/40">{user.email}</p>
                    {user.boutique && <p className="text-[10px] text-charcoal/30 mt-0.5">{(user.boutique as { name: string }).name}</p>}
                  </div>
                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${roleColour(user.role)}`}>{roleLabel(user.role)}</span>
                  <button
                    onClick={() => handleImpersonate(user.id)}
                    disabled={loading !== null}
                    className="px-4 py-2 text-sm font-medium text-gold hover:text-white hover:bg-gold rounded-xl border border-gold/30 transition-all disabled:opacity-50"
                  >
                    {loading === user.id ? 'Signing in...' : 'View As'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
