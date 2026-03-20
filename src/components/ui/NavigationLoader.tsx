'use client'

import { Suspense, useEffect, useState, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

function NavigationLoaderInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const prevUrl = useRef(pathname)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // When URL changes, navigation is complete
  useEffect(() => {
    const currentUrl = pathname + searchParams.toString()
    if (currentUrl !== prevUrl.current && loading) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      setProgress(100)
      const timer = setTimeout(() => {
        setLoading(false)
        setProgress(0)
      }, 400)
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
      setProgress(5)

      if (intervalRef.current) clearInterval(intervalRef.current)

      let current = 5
      intervalRef.current = setInterval(() => {
        current += Math.random() * 15 + 5
        if (current >= 85) {
          current = 85
          if (intervalRef.current) clearInterval(intervalRef.current)
        }
        setProgress(Math.min(current, 85))
      }, 200)
    }

    document.addEventListener('click', handleClick, true)
    return () => {
      document.removeEventListener('click', handleClick, true)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [pathname])

  if (!loading) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
      <div className="absolute inset-0 bg-ivory/60 backdrop-blur-[2px]" />
      <div className="relative bg-white rounded-2xl shadow-xl px-8 py-6 min-w-[260px] text-center">
        <p className="font-serif text-lg text-charcoal mb-1">Loading</p>
        <p className="text-xs text-charcoal/40 mb-4">Please wait</p>
        <div className="h-2 bg-charcoal/8 rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-gold rounded-full transition-all duration-300 ease-out"
            style={{ width: `${Math.round(progress)}%` }}
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
