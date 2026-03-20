'use client'

import { Suspense, useEffect, useState, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

function NavigationLoaderInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [fadeOut, setFadeOut] = useState(false)
  const prevUrl = useRef(pathname)

  // When URL changes, content is ready — dismiss
  useEffect(() => {
    const currentUrl = pathname + searchParams.toString()
    if (currentUrl !== prevUrl.current && loading) {
      setFadeOut(true)
      const timer = setTimeout(() => {
        setLoading(false)
        setFadeOut(false)
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
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
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
      <div className="relative bg-white rounded-2xl shadow-xl px-8 py-6 min-w-[220px] text-center">
        <p className="font-serif text-lg text-charcoal mb-1">Loading</p>
        <p className="text-xs text-charcoal/40 mb-3">Please wait</p>
        <div className="flex justify-center">
          <div className="w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
        </div>
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
