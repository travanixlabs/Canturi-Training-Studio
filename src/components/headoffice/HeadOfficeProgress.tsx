'use client'

import { useState, useMemo } from 'react'
import { ProgressBar } from '@/components/ui/ProgressBar'
import type { Boutique, User, Course, MenuItem, Completion, Plate, VisibleCourse } from '@/types'

interface Props {
  boutiques: Boutique[]
  allUsers: User[]
  categories: Course[]
  menuItems: MenuItem[]
  completions: Completion[]
  plates?: Plate[]
  visibleCategories?: VisibleCourse[]
}

export function HeadOfficeProgress({ boutiques, allUsers, categories, menuItems, completions, plates = [], visibleCategories = [] }: Props) {
  const [selectedBoutique, setSelectedBoutique] = useState<string | 'all'>('all')

  const employees = allUsers.filter(u => {
    if (u.role !== 'trainee') return false
    if (selectedBoutique !== 'all' && u.boutique_id !== selectedBoutique) return false
    return true
  })

  // Get assigned items for an employee (via plates or visible categories)
  const getAssignedItems = (userId: string) => {
    const plateItemIds = new Set(plates.filter(p => p.trainee_id === userId).map(p => p.menu_item_id))
    const visibleCatIds = new Set(visibleCategories.filter(v => v.user_id === userId).map(v => v.course_id))
    return menuItems.filter(m => plateItemIds.has(m.id) || visibleCatIds.has(m.course_id))
  }

  const getAssignedCategories = (userId: string) => {
    const assigned = getAssignedItems(userId)
    const catIds = new Set(assigned.map(m => m.course_id))
    return categories.filter(c => catIds.has(c.id))
  }

  const getCategoryProgress = (userId: string, categoryId: string) => {
    const assigned = getAssignedItems(userId)
    const categoryItems = assigned.filter(mi => mi.course_id === categoryId)
    if (categoryItems.length === 0) return { completed: 0, total: 0, pct: 0 }
    const completed = categoryItems.filter(mi =>
      completions.some(c => c.trainee_id === userId && c.menu_item_id === mi.id)
    ).length
    return { completed, total: categoryItems.length, pct: Math.round((completed / categoryItems.length) * 100) }
  }

  const getOverallProgress = (userId: string) => {
    const assigned = getAssignedItems(userId)
    if (assigned.length === 0) return 0
    const completed = assigned.filter(mi =>
      completions.some(c => c.trainee_id === userId && c.menu_item_id === mi.id)
    ).length
    return Math.round((completed / assigned.length) * 100)
  }

  const getBoutiqueName = (boutiqeId: string | null) => {
    if (!boutiqeId) return ''
    return boutiques.find(b => b.id === boutiqeId)?.city ?? ''
  }

  return (
    <div className="px-5 py-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-charcoal">Progress</h1>
        <p className="text-sm text-charcoal/40 mt-1">Track development across all boutiques</p>
      </div>

      {/* Boutique filter */}
      <div className="flex gap-2 flex-wrap mb-6">
        <button
          onClick={() => setSelectedBoutique('all')}
          className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
            selectedBoutique === 'all'
              ? 'border-gold bg-gold/10 text-gold'
              : 'border-charcoal/15 text-charcoal/50 hover:border-charcoal/30'
          }`}
        >
          All
        </button>
        {boutiques.map(b => (
          <button
            key={b.id}
            onClick={() => setSelectedBoutique(b.id)}
            className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
              selectedBoutique === b.id
                ? 'border-gold bg-gold/10 text-gold'
                : 'border-charcoal/15 text-charcoal/50 hover:border-charcoal/30'
            }`}
          >
            {b.city}
          </button>
        ))}
      </div>

      {/* Employee list */}
      {employees.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-charcoal/40 text-sm">
            No employees found{selectedBoutique !== 'all' && ` in ${getBoutiqueName(selectedBoutique)}`}.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {employees.map(user => {
            const overall = getOverallProgress(user.id)
            const assignedCats = getAssignedCategories(user.id)
            const assignedCount = getAssignedItems(user.id).length

            return (
              <div key={user.id} className="card p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center text-sm font-medium text-gold flex-shrink-0">
                    {user.avatar_initials}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-charcoal">{user.name}</p>
                    <p className="text-xs text-charcoal/40">{getBoutiqueName(user.boutique_id)} · {overall}% overall</p>
                  </div>
                  <p className="font-serif text-2xl text-gold">{overall}%</p>
                </div>

                {assignedCount === 0 ? (
                  <p className="text-xs text-charcoal/30">No categories assigned yet.</p>
                ) : (
                  <div className="space-y-2.5">
                    {assignedCats.map(cat => {
                      const { completed, total, pct } = getCategoryProgress(user.id, cat.id)
                      return (
                        <div key={cat.id}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-charcoal/60">
                              <span style={{ color: cat.colour_hex }}>{cat.icon}</span>{' '}
                              {cat.name}
                            </span>
                            <span className="text-charcoal/40">{completed}/{total}</span>
                          </div>
                          <ProgressBar percent={pct} colour={cat.colour_hex} showPercent={false} size="sm" />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
