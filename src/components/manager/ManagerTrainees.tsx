'use client'

import { useState, useMemo } from 'react'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { CATEGORY_COLOURS } from '@/types'
import type { User, Category, MenuItem, Completion, Plate, VisibleCategory } from '@/types'

interface Props {
  trainees: User[]
  categories: Category[]
  menuItems: MenuItem[]
  completions: Completion[]
  plates?: Plate[]
  visibleCategories?: VisibleCategory[]
}

export function ManagerTrainees({ trainees, categories, menuItems, completions, plates = [], visibleCategories = [] }: Props) {
  const [selected, setSelected] = useState<User | null>(trainees[0] ?? null)

  // Get menu items assigned to this trainee (via plates or visible categories)
  const assignedItems = useMemo(() => {
    if (!selected) return []

    // Items on any plate for this trainee
    const plateItemIds = new Set(
      plates.filter(p => p.trainee_id === selected.id).map(p => p.menu_item_id)
    )

    // Categories visible to this trainee
    const visibleCatIds = new Set(
      visibleCategories.filter(v => v.user_id === selected.id).map(v => v.category_id)
    )

    // Items either on a plate OR in a visible category
    return menuItems.filter(m =>
      plateItemIds.has(m.id) || visibleCatIds.has(m.category_id)
    )
  }, [selected, menuItems, plates, visibleCategories])

  // Only show categories that have assigned items
  const assignedCategories = useMemo(() => {
    const catIds = new Set(assignedItems.map(m => m.category_id))
    return categories.filter(c => catIds.has(c.id))
  }, [assignedItems, categories])

  const totalItems = assignedItems.length

  const traineeCompletions = (traineeId: string) =>
    completions.filter(c => c.trainee_id === traineeId && assignedItems.some(m => m.id === c.menu_item_id))

  const overallPct = (traineeId: string) => {
    const done = traineeCompletions(traineeId).length
    return totalItems > 0 ? Math.round((done / totalItems) * 100) : 0
  }

  const categoryPct = (traineeId: string, categoryId: string) => {
    const catItems = assignedItems.filter(m => m.category_id === categoryId)
    const done = catItems.filter(m =>
      traineeCompletions(traineeId).some(c => c.menu_item_id === m.id)
    ).length
    return catItems.length > 0 ? Math.round((done / catItems.length) * 100) : 0
  }

  if (trainees.length === 0) {
    return (
      <div className="px-5 py-6">
        <h1 className="font-serif text-2xl text-charcoal mb-4">Employees</h1>
        <div className="card p-6 text-center">
          <p className="text-charcoal/40 text-sm">No active employees in your boutique.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-5 py-6">
      <div className="mb-5">
        <h1 className="font-serif text-2xl text-charcoal">Employees</h1>
      </div>

      {/* Trainee tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {trainees.map(trainee => (
          <button
            key={trainee.id}
            onClick={() => setSelected(trainee)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium flex-shrink-0 transition-all ${
              selected?.id === trainee.id
                ? 'border-gold bg-gold/10 text-gold'
                : 'border-charcoal/15 text-charcoal/60'
            }`}
          >
            <span className="w-6 h-6 rounded-full bg-charcoal/8 flex items-center justify-center text-xs">
              {trainee.avatar_initials}
            </span>
            {trainee.name}
          </button>
        ))}
      </div>

      {selected && (
        <>
          {totalItems === 0 ? (
            <div className="card p-6 text-center">
              <p className="text-charcoal/40 text-sm">No categories assigned to {selected.name.split(' ')[0]} yet.</p>
            </div>
          ) : (
            <>
              {/* Overall */}
              <div className="card p-5 mb-4 bg-charcoal text-white">
                <div className="flex items-end justify-between mb-3">
                  <div>
                    <p className="text-white/50 text-xs uppercase tracking-widest mb-1">Overall</p>
                    <p className="font-serif text-4xl text-gold">{overallPct(selected.id)}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{traineeCompletions(selected.id).length} <span className="text-white/40">of {totalItems}</span></p>
                    <p className="text-xs text-white/40 mt-0.5">completed</p>
                  </div>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gold rounded-full transition-all"
                    style={{ width: `${overallPct(selected.id)}%` }}
                  />
                </div>
              </div>

              {/* By category */}
              <h2 className="text-xs font-medium text-charcoal/40 uppercase tracking-widest mb-3">By course</h2>
              <div className="space-y-3">
                {assignedCategories.map(cat => {
                  const pct = categoryPct(selected.id, cat.id)
                  const colour = CATEGORY_COLOURS[cat.name] ?? cat.colour_hex
                  const catItems = assignedItems.filter(m => m.category_id === cat.id)
                  const done = catItems.filter(m =>
                    traineeCompletions(selected.id).some(c => c.menu_item_id === m.id)
                  ).length

                  return (
                    <div key={cat.id} className="card p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <span
                          className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                          style={{ backgroundColor: colour + '20', color: colour }}
                        >
                          {cat.icon}
                        </span>
                        <div className="flex-1">
                          <div className="flex justify-between items-baseline">
                            <p className="font-medium text-charcoal text-sm">{cat.name}</p>
                            <p className="text-sm font-medium" style={{ color: colour }}>{pct}%</p>
                          </div>
                          <p className="text-xs text-charcoal/40 mt-0.5">{done} of {catItems.length}</p>
                        </div>
                      </div>
                      <div className="h-1.5 bg-charcoal/8 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: colour }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
