'use client'

import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@/types'

interface Props {
  user: User
  title?: string
}

export function AppHeader({ user, title }: Props) {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const roleLabel = user.role === 'head_office' ? 'Head Office' : user.role === 'manager' ? 'Manager' : 'Employee'

  return (
    <header className="bg-charcoal text-white px-5 py-4 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <Image
          src="/canturi-logo-white.jpg"
          alt="Canturi"
          width={120}
          height={32}
          className="h-7 w-auto object-contain"
          priority
        />
        {title && (
          <span className="text-xs text-white/50 tracking-widest uppercase border-l border-white/20 pl-4">{title}</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium leading-none">{user.name}</p>
          <p className="text-xs text-white/50 mt-0.5">{roleLabel}</p>
        </div>
        <div className="w-9 h-9 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center">
          <span className="text-sm font-medium text-gold">{user.avatar_initials}</span>
        </div>
        <button
          onClick={handleSignOut}
          className="text-white/40 hover:text-white/70 text-xs tracking-wider uppercase transition-colors ml-1"
        >
          Log Out
        </button>
      </div>
    </header>
  )
}
