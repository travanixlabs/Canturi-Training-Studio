'use client'

import { useState } from 'react'
import { ProgressBar } from '@/components/ui/ProgressBar'
import type { Boutique, User, Category, MenuItem, Completion } from '@/types'

interface Props {
  boutiques: Boutique[]
  allUsers: User[]
  categories: Category[]
  menuItems: MenuItem[]
  completions: Completion[]
}

export function HeadOfficeProgress({ boutiques, allUsers, categories, menuItems, completions }: Props) {
  const [selectedBoutique, setSelectedBoutique] = useState<string | 'all'>('all')
  const [viewRole, setViewRole] = useState<'trainee' | 'manager'>('trainee')

  const filteredUsers = allUsers.filter(u => {
    if (u.role !== viewRole) return false
    if (selectedBoutique !== 'all' && u.boutique_id !== selectedBoutique) return false
    return true
  })

  const getCategoryProgress = (userId: string, categoryId: string) => {
    const categoryItems = menuItems.filter(mi => mi.category_id === categoryId)
    if (categoryItems.length === 0) return 0
    const completed = categoryItems.filter(mi =>
      completions.some(c => c.trainee_id === userId && c.menu_item_id === mi.id)
    ).length
    return Math.round((completed / categoryItems.length) * 100)
  }

  const getOverallProgress = (userId: string) => {
    if (menuItems.length === 0) return 0
    const completed = completions.filter(c => c.trainee_id === userId).length
    return Math.round((completed / menuItems.length) * 100)
  }

  const getBoutiqueName = (boutiqeId: string | null) => {
    if (!boutiqeId) return ''
    const b = boutiques.find(b => b.id === boutiqeId)
    return b?.city ?? ''
  }

  return (
    <div className="px-5 py-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-charcoal">Progress</h1>
        <p className="text-sm text-charcoal/40 mt-1">Track development across all boutiques</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        {/* Role toggle */}
        <div className="flex rounded-xl border border-charcoal/15 overflow-hidden">
          <button
            onClick={() => setViewRole('trainee')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              viewRole === 'trainee' ? 'bg-gold text-white' : 'text-charcoal/50 hover:text-charcoal'
            }`}
          >
            Employees
          </button>
          <button
            onClick={() => setViewRole('manager')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              viewRole === 'manager' ? 'bg-gold text-white' : 'text-charcoal/50 hover:text-charcoal'
            }`}
          >
            Managers
          </button>
        </div>

        {/* Boutique filter */}
        <div className="flex gap-2 flex-wrap">
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
      </div>

      {/* User list */}
      {filteredUsers.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-charcoal/40 text-sm">
            No {viewRole === 'trainee' ? 'employees' : 'managers'} found
            {selectedBoutique !== 'all' && ` in ${getBoutiqueName(selectedBoutique)}`}.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredUsers.map(user => {
            const overall = getOverallProgress(user.id)

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

                {/* Per-category progress */}
                <div className="space-y-2.5">
                  {categories.map(cat => {
                    const pct = getCategoryProgress(user.id, cat.id)
                    const categoryItems = menuItems.filter(mi => mi.category_id === cat.id)
                    const completed = categoryItems.filter(mi =>
                      completions.some(c => c.trainee_id === user.id && c.menu_item_id === mi.id)
                    ).length

                    return (
                      <div key={cat.id}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-charcoal/60">
                            <span style={{ color: cat.colour_hex }}>{cat.icon}</span>{' '}
                            {cat.name}
                          </span>
                          <span className="text-charcoal/40">{completed}/{categoryItems.length}</span>
                        </div>
                        <ProgressBar percent={pct} colour={cat.colour_hex} showPercent={false} size="sm" />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
