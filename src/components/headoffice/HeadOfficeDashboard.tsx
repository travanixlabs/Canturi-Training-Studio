'use client'

import type { Boutique, User } from '@/types'

interface Props {
  boutiques: Boutique[]
  allUsers: User[]
}

export function HeadOfficeDashboard({ boutiques, allUsers }: Props) {
  const getManagers = (boutique: Boutique) =>
    allUsers.filter(u => u.boutique_id === boutique.id && u.role === 'manager')

  const getEmployees = (boutique: Boutique) =>
    allUsers.filter(u => u.boutique_id === boutique.id && u.role === 'trainee')

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

          return (
            <div key={boutique.id} className="card p-5">
              <p className="font-serif text-lg text-charcoal leading-tight mb-1">{boutique.city}</p>
              <p className="text-xs text-charcoal/40 mb-3">
                {managers.length > 0
                  ? managers.map(m => m.name.split(' ')[0]).join(', ')
                  : 'No manager'}
              </p>

              {employees.length === 0 ? (
                <p className="text-xs text-charcoal/30">No active employees</p>
              ) : (
                <div className="space-y-2">
                  {employees.map(emp => (
                    <div key={emp.id} className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-charcoal/8 flex items-center justify-center text-xs flex-shrink-0">
                        {emp.avatar_initials}
                      </div>
                      <span className="text-xs text-charcoal/70">{emp.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="card p-6 text-center">
        <p className="text-charcoal/40 text-sm">Progress tracking coming soon</p>
      </div>
    </div>
  )
}
