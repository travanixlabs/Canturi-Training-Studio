'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname } from 'next/navigation'

export function NavigationLoader() {
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [prevPath, setPrevPath] = useState(pathname)

  useEffect(() => {
    if (pathname !== prevPath) {
      // Page has finished loading
      setProgress(100)
      const timer = setTimeout(() => {
        setLoading(false)
        setProgress(0)
      }, 300)
      setPrevPath(pathname)
      return () => clearTimeout(timer)
    }
  }, [pathname, prevPath])

  // Intercept link clicks to detect navigation start
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('http') || href.startsWith('#') || href === pathname) return

      setLoading(true)
      setProgress(0)

      // Simulate progress
      let current = 0
      const interval = setInterval(() => {
        current += Math.random() * 25 + 10
        if (current >= 90) {
          current = 90
          clearInterval(interval)
        }
        setProgress(Math.min(current, 90))
      }, 150)

      // Cleanup interval when component unmounts or navigation completes
      const cleanup = () => clearInterval(interval)
      window.addEventListener('beforeunload', cleanup, { once: true })
      setTimeout(cleanup, 5000) // safety timeout
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [pathname])

  if (!loading) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
      {/* Subtle backdrop */}
      <div className="absolute inset-0 bg-ivory/60 backdrop-blur-[2px]" />

      {/* Loading card */}
      <div className="relative bg-white rounded-2xl shadow-xl px-8 py-6 min-w-[260px] text-center">
        <p className="font-serif text-lg text-charcoal mb-1">Loading</p>
        <p className="text-xs text-charcoal/40 mb-4">Please wait</p>

        {/* Progress bar */}
        <div className="h-2 bg-charcoal/8 rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-gold rounded-full transition-all duration-200 ease-out"
            style={{ width: `${Math.round(progress)}%` }}
          />
        </div>
        <p className="text-xs text-gold font-medium">{Math.round(progress)}%</p>
      </div>
    </div>
  )
}
