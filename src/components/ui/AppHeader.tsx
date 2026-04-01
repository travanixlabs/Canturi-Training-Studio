'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User, UserNotification } from '@/types'

interface Props {
  user: User
  title?: string
}

export function AppHeader({ user, title }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [notifications, setUserNotifications] = useState<UserNotification[]>([])
  const [showPanel, setShowPanel] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter(n => !n.read_at).length

  // Fetch notifications
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (data) setUserNotifications(data as UserNotification[])
    }
    load()

    // Poll every 30 seconds for new notifications
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [user.id])

  // Close panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowPanel(false)
      }
    }
    if (showPanel) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showPanel])

  async function markAsRead(id: string) {
    await supabase.from('user_notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
    setUserNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
  }

  async function markAllAsRead() {
    const unreadIds = notifications.filter(n => !n.read_at).map(n => n.id)
    if (unreadIds.length === 0) return
    await supabase.from('user_notifications').update({ read_at: new Date().toISOString() }).in('id', unreadIds)
    setUserNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })))
  }

  function handleUserNotificationClick(n: UserNotification) {
    if (!n.read_at) markAsRead(n.id)
    setShowPanel(false)
    if (n.link) router.push(n.link)
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHrs = Math.floor(diffMins / 60)
    if (diffHrs < 24) return `${diffHrs}h ago`
    const diffDays = Math.floor(diffHrs / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  }

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
          width={180}
          height={60}
          className="h-full max-h-[60px] -my-4 w-auto object-contain"
          priority
        />
        {title && (
          <span className="text-xs text-white/50 tracking-widest uppercase border-l border-white/20 pl-4">{title}</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* UserNotification bell */}
        <div className="relative" ref={panelRef}>
          <button
            onClick={() => setShowPanel(!showPanel)}
            className="relative w-9 h-9 rounded-full flex items-center justify-center text-white/50 hover:text-white/80 transition-colors"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 min-w-[18px] rounded-full bg-red-500 text-[10px] font-medium text-white flex items-center justify-center px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* UserNotification panel */}
          {showPanel && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-black/5 overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-black/5 flex items-center justify-between">
                <h3 className="text-sm font-medium text-charcoal">UserNotifications</h3>
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="text-[10px] text-gold hover:text-gold/80 font-medium">
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-xs text-charcoal/30">No notifications yet</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <button
                      key={n.id}
                      onClick={() => handleUserNotificationClick(n)}
                      className={`w-full text-left px-4 py-3 border-b border-black/5 last:border-0 hover:bg-charcoal/[0.02] transition-colors ${
                        !n.read_at ? 'bg-gold/[0.03]' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {!n.read_at && <span className="w-1.5 h-1.5 rounded-full bg-gold flex-shrink-0 mt-1.5" />}
                        <div className={`flex-1 min-w-0 ${n.read_at ? 'ml-3.5' : ''}`}>
                          <p className="text-xs font-medium text-charcoal leading-snug">{n.title}</p>
                          <p className="text-[10px] text-charcoal/50 mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-[9px] text-charcoal/30 mt-1">{formatTime(n.created_at)}</p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

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
