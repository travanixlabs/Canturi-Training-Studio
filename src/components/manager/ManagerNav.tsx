'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/manager/build-plate', label: 'Build Menu' },
]

export function ManagerNav() {
  const pathname = usePathname()

  return (
    <nav className="border-b border-black/5 bg-white sticky top-[65px] z-30">
      <div className="flex gap-0 px-5">
        {tabs.map(tab => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                active
                  ? 'border-gold text-gold'
                  : 'border-transparent text-charcoal/40 hover:text-charcoal/60'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
