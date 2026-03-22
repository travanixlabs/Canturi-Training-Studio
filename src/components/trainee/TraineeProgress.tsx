'use client'

import { CATEGORY_COLOURS } from '@/types'
import type { Category, MenuItem, Completion } from '@/types'

interface Props {
  categories: Category[]
  menuItems: MenuItem[]
  completions: Completion[]
}

export function TraineeProgress({ categories, menuItems, completions }: Props) {
  const totalItems = menuItems.length
  const totalCompleted = completions.length
  const overallPercent = totalItems > 0 ? Math.round((totalCompleted / totalItems) * 100) : 0

  const shadowingCount = completions.filter(c => c.is_shadowing_moment).length

  return (
    <div className="px-5 py-6">
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-charcoal">My Progress</h1>
      </div>

      {/* Overall summary card */}
      <div className="card p-5 mb-6 bg-charcoal text-white">
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-white/50 text-xs uppercase tracking-widest mb-1">Overall completion</p>
            <p className="font-serif text-4xl text-gold">{overallPercent}%</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">{totalCompleted} <span className="text-white/40">of {totalItems}</span></p>
            <p className="text-xs text-white/40 mt-0.5">items completed</p>
          </div>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gold rounded-full transition-all duration-700"
            style={{ width: `${overallPercent}%` }}
          />
        </div>
        {shadowingCount > 0 && (
          <p className="text-xs text-white/40 mt-3">
            Including {shadowingCount} shadowing moment{shadowingCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Per-course breakdown */}
      <h2 className="text-xs font-medium text-charcoal/40 uppercase tracking-widest mb-3">By course</h2>
      <div className="space-y-3">
        {categories.map(category => {
          const items = menuItems.filter(i => i.category_id === category.id)
          const done = items.filter(i => completions.some(c => c.menu_item_id === i.id)).length
          const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0
          const colour = CATEGORY_COLOURS[category.name] ?? category.colour_hex

          return (
            <div key={category.id} className="card p-4">
              <div className="flex items-center gap-3 mb-3">
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                  style={{ backgroundColor: colour + '20', color: colour }}
                >
                  {category.icon}
                </span>
                <div className="flex-1">
                  <div className="flex justify-between items-baseline">
                    <p className="font-medium text-charcoal text-sm">{category.name}</p>
                    <p className="text-sm font-medium" style={{ color: colour }}>{pct}%</p>
                  </div>
                  <p className="text-xs text-charcoal/40 mt-0.5">{done} of {items.length} complete</p>
                </div>
              </div>
              <div className="h-2 bg-charcoal/8 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: colour }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
