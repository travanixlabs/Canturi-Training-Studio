'use client'

import { Suspense, useEffect, useState, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

function NavigationLoaderInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [fadeOut, setFadeOut] = useState(false)
  const prevUrl = useRef(pathname)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // When URL changes, content is ready — dismiss immediately
  useEffect(() => {
    const currentUrl = pathname + searchParams.toString()
    if (currentUrl !== prevUrl.current && loading) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      setProgress(100)
      setFadeOut(true)
      // Quick fade out (150ms) then clean up
      const timer = setTimeout(() => {
        setLoading(false)
        setFadeOut(false)
        setProgress(0)
      }, 150)
      prevUrl.current = currentUrl
      return () => clearTimeout(timer)
    }
    prevUrl.current = currentUrl
  }, [pathname, searchParams, loading])

  // Detect navigation start from link clicks
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('http') || href.startsWith('#')) return
      if (href === pathname) return

      setLoading(true)
      setFadeOut(false)
      setProgress(5)

      if (intervalRef.current) clearInterval(intervalRef.current)

      let current = 5
      intervalRef.current = setInterval(() => {
        // Slow down as it approaches 95 — never reaches 100 until content loads
        const remaining = 95 - current
        current += remaining * 0.08 + Math.random() * 3
        if (current >= 95) current = 95
        setProgress(current)
      }, 150)
    }

    document.addEventListener('click', handleClick, true)
    return () => {
      document.removeEventListener('click', handleClick, true)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [pathname])

  if (!loading) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none"
      style={{
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 150ms ease-out',
      }}
    >
      <div className="absolute inset-0 bg-ivory/60 backdrop-blur-[2px]" />
      <div className="relative bg-white rounded-2xl shadow-xl px-8 py-6 min-w-[260px] text-center">
        <p className="font-serif text-lg text-charcoal mb-1">Loading</p>
        <p className="text-xs text-charcoal/40 mb-4">Please wait</p>
        <div className="h-2 bg-charcoal/8 rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-gold rounded-full"
            style={{
              width: `${Math.round(progress)}%`,
              transition: fadeOut ? 'width 100ms ease-out' : 'width 200ms ease-out',
            }}
          />
        </div>
        <p className="text-xs text-gold font-medium">{Math.round(progress)}%</p>
      </div>
    </div>
  )
}

export function NavigationLoader() {
  return (
    <Suspense fallback={null}>
      <NavigationLoaderInner />
    </Suspense>
  )
}
