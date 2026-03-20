'use client'

import { useState } from 'react'
import { CategoryBadge } from '@/components/ui/CategoryBadge'
import { TaskModal } from '@/components/ui/TaskModal'
import { StarRating } from '@/components/ui/StarRating'
import { useRouter } from 'next/navigation'
import type { User, Completion, MenuItem } from '@/types'

interface Props {
  manager: User
  trainees: User[]
  completions: Completion[]
  menuItems: MenuItem[]
}

export function ManagerSignOff({ manager, trainees, completions, menuItems }: Props) {
  const [selectedTrainee, setSelectedTrainee] = useState<User | null>(
    trainees.length === 1 ? trainees[0] : null
  )
  const [selectedCompletion, setSelectedCompletion] = useState<Completion | null>(null)
  const router = useRouter()

  const traineeCompletions = completions.filter(
    c => c.trainee_id === selectedTrainee?.id
  )

  const pendingSignOff = traineeCompletions.filter(c => !c.trainer_rating)
  const signedOff = traineeCompletions.filter(c => !!c.trainer_rating)

  return (
    <>
      <div className="px-5 py-6">
        <div className="mb-5">
          <h1 className="font-serif text-2xl text-charcoal">Sign Off Training</h1>
          <p className="text-sm text-charcoal/40 mt-1">Review and assess completed items</p>
        </div>

        {/* Trainee selector */}
        {trainees.length > 1 && (
          <div className="mb-5">
            <p className="text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-2">Employee</p>
            <div className="flex gap-2 flex-wrap">
              {trainees.map(trainee => (
                <button
                  key={trainee.id}
                  onClick={() => setSelectedTrainee(trainee)}
                  className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                    selectedTrainee?.id === trainee.id
                      ? 'border-gold bg-gold/10 text-gold'
                      : 'border-charcoal/15 text-charcoal/60'
                  }`}
                >
                  {trainee.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {!selectedTrainee && trainees.length === 0 && (
          <div className="card p-6 text-center">
            <p className="text-charcoal/40 text-sm">No employees in your boutique.</p>
          </div>
        )}

        {selectedTrainee && (
          <>
            {/* Pending sign-off */}
            {pendingSignOff.length > 0 && (
              <div className="mb-5">
                <h2 className="text-xs font-medium text-charcoal/40 uppercase tracking-widest mb-3">
                  Awaiting your assessment ({pendingSignOff.length})
                </h2>
                <div className="space-y-2">
                  {pendingSignOff.map(completion => (
                    <CompletionCard
                      key={completion.id}
                      completion={completion}
                      onOpen={() => setSelectedCompletion(completion)}
                      mode="pending"
                    />
                  ))}
                </div>
              </div>
            )}

            {pendingSignOff.length === 0 && (
              <div className="card p-5 text-center mb-5">
                <p className="text-2xl mb-2">✦</p>
                <p className="text-sm text-charcoal/40">All completed items have been assessed.</p>
              </div>
            )}

            {/* Already signed off */}
            {signedOff.length > 0 && (
              <div>
                <h2 className="text-xs font-medium text-charcoal/40 uppercase tracking-widest mb-3">
                  Assessed ({signedOff.length})
                </h2>
                <div className="space-y-2 opacity-60">
                  {signedOff.map(completion => (
                    <CompletionCard
                      key={completion.id}
                      completion={completion}
                      onOpen={() => setSelectedCompletion(completion)}
                      mode="done"
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Task modal (manager mode) */}
      {selectedCompletion?.menu_item && (
        <TaskModal
          item={selectedCompletion.menu_item}
          plate={null}
          existingCompletion={selectedCompletion}
          currentUser={manager}
          mode="manager"
          onClose={() => setSelectedCompletion(null)}
          onComplete={() => router.refresh()}
        />
      )}
    </>
  )
}

function CompletionCard({
  completion,
  onOpen,
  mode,
}: {
  completion: Completion
  onOpen: () => void
  mode: 'pending' | 'done'
}) {
  const item = completion.menu_item
  if (!item) return null

  return (
    <button
      onClick={onOpen}
      className="card w-full text-left p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1">
          {item.category && (
            <CategoryBadge categoryName={item.category.name} icon={item.category.icon} />
          )}
          <p className="font-medium text-charcoal text-[15px] mt-1.5 leading-snug">{item.title}</p>
          <p className="text-xs text-charcoal/40 mt-1">{completion.completed_date}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {completion.trainee_rating && (
            <StarRating value={completion.trainee_rating} readonly size="sm" />
          )}
          {mode === 'pending' ? (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Needs assessment</span>
          ) : (
            <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Assessed</span>
          )}
        </div>
      </div>
    </button>
  )
}
