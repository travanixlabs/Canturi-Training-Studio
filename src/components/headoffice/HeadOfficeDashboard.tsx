'use client'

import type { Boutique, User, MenuItem, Completion, Plate, VisibleCategory } from '@/types'

interface Props {
  boutiques: Boutique[]
  allUsers: User[]
  menuItems: MenuItem[]
  completions: Completion[]
  plates?: Plate[]
  visibleCategories?: VisibleCategory[]
}

export function HeadOfficeDashboard({ boutiques, allUsers, menuItems, completions, plates = [], visibleCategories = [] }: Props) {
  const getUsersForBoutique = (boutique: Boutique) =>
    allUsers.filter(u => u.boutique_id === boutique.id)

  const getManagers = (boutique: Boutique) =>
    getUsersForBoutique(boutique).filter(u => u.role === 'manager')

  const getEmployees = (boutique: Boutique) =>
    getUsersForBoutique(boutique).filter(u => u.role === 'trainee')

  // Get assigned items for an employee (via plates or visible categories)
  const getAssignedItems = (userId: string) => {
    const plateItemIds = new Set(plates.filter(p => p.trainee_id === userId).map(p => p.menu_item_id))
    const visibleCatIds = new Set(visibleCategories.filter(v => v.user_id === userId).map(v => v.category_id))
    return menuItems.filter(m => plateItemIds.has(m.id) || visibleCatIds.has(m.category_id))
  }

  const personPct = (userId: string) => {
    const assigned = getAssignedItems(userId)
    if (assigned.length === 0) return 0
    const done = assigned.filter(m => completions.some(c => c.trainee_id === userId && c.menu_item_id === m.id)).length
    return Math.round((done / assigned.length) * 100)
  }

  const boutiquePct = (boutique: Boutique) => {
    const employees = getEmployees(boutique)
    if (employees.length === 0) return 0
    const total = employees.reduce((sum, e) => sum + personPct(e.id), 0)
    return Math.round(total / employees.length)
  }

  const recentActivity = completions.slice(0, 20)

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (hours < 1) return 'Just now'
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  return (
    <div className="px-5 py-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-charcoal">Overview</h1>
        <p className="text-sm text-charcoal/40 mt-1">Across all boutiques</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {boutiques.map(boutique => {
          const managers = getManagers(boutique)
          const employees = getEmployees(boutique)
          const pct = boutiquePct(boutique)

          return (
            <div key={boutique.id} className="card p-5">
              <div className="flex items-start justify-between mb-1">
                <p className="font-serif text-lg text-charcoal leading-tight">{boutique.city}</p>
                <p className="font-serif text-2xl text-gold">{pct}%</p>
              </div>

              <p className="text-xs text-charcoal/40 mb-3">
                {managers.length > 0
                  ? managers.map(m => m.name.split(' ')[0]).join(', ')
                  : 'No manager'}
              </p>

              <div className="h-1.5 bg-charcoal/8 rounded-full overflow-hidden mb-3">
                <div className="h-full bg-gold rounded-full" style={{ width: `${pct}%` }} />
              </div>

              {employees.length === 0 ? (
                <p className="text-xs text-charcoal/30">No active employees</p>
              ) : (
                <div className="space-y-2">
                  {employees.map(emp => {
                    const empPct = personPct(emp.id)
                    return (
                      <div key={emp.id} className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-charcoal/8 flex items-center justify-center text-xs flex-shrink-0">
                          {emp.avatar_initials}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="text-charcoal/70">{emp.name}</span>
                            <span className="text-charcoal/40">{empPct}%</span>
                          </div>
                          <div className="h-1 bg-charcoal/8 rounded-full overflow-hidden">
                            <div className="h-full bg-gold/60 rounded-full" style={{ width: `${empPct}%` }} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <h2 className="text-xs font-medium text-charcoal/40 uppercase tracking-widest mb-3">Recent completions</h2>

      {recentActivity.length === 0 ? (
        <div className="card p-5 text-center">
          <p className="text-charcoal/40 text-sm">No completions yet.</p>
        </div>
      ) : (
        <div className="card divide-y divide-black/5">
          {recentActivity.map(completion => {
            const trainee = completion.trainee as unknown as User | undefined
            const item = completion.menu_item as unknown as (MenuItem & { category?: { name: string } }) | undefined
            const boutique = boutiques.find(b => b.id === trainee?.boutique_id)

            return (
              <div key={completion.id} className="px-5 py-3.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-xs text-gold flex-shrink-0">
                  {completion.is_shadowing_moment ? '◈' : '✓'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-charcoal font-medium truncate">{item?.title ?? 'Unknown item'}</p>
                  <p className="text-xs text-charcoal/40 mt-0.5">
                    {trainee?.name ?? 'Unknown'} · {boutique?.city ?? ''}
                    {completion.is_shadowing_moment && ' · shadowing'}
                  </p>
                </div>
                <span className="text-xs text-charcoal/30 flex-shrink-0">{timeAgo(completion.created_at)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
