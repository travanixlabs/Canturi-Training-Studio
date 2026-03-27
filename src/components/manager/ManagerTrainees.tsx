'use client'

import type { User } from '@/types'

interface Props {
  trainees: User[]
}

export function ManagerTrainees({ trainees }: Props) {
  if (trainees.length === 0) {
    return (
      <div className="px-5 py-6">
        <h1 className="font-serif text-2xl text-charcoal mb-4">Progress</h1>
        <div className="card p-6 text-center">
          <p className="text-charcoal/40 text-sm">No active employees in your boutique.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-5 py-6">
      <div className="mb-5">
        <h1 className="font-serif text-2xl text-charcoal">Progress</h1>
      </div>

      <div className="card p-6 mb-4 text-center">
        <p className="text-charcoal/40 text-sm">Progress tracking coming soon</p>
      </div>

      <h2 className="text-xs font-medium text-charcoal/40 uppercase tracking-widest mb-3">Team members</h2>
      <div className="space-y-2">
        {trainees.map(trainee => (
          <div key={trainee.id} className="card p-4 flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-charcoal/8 flex items-center justify-center text-sm flex-shrink-0 font-medium">
              {trainee.avatar_initials}
            </span>
            <div className="flex-1">
              <p className="font-medium text-charcoal text-[15px]">{trainee.name}</p>
              <p className="text-xs text-charcoal/40">{trainee.email}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
