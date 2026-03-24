'use client'

import { useState, useMemo } from 'react'
import { CategoryBadge } from '@/components/ui/CategoryBadge'
import { TaskModal } from '@/components/ui/TaskModal'
import { StarRating } from '@/components/ui/StarRating'
import { useRouter } from 'next/navigation'
import type { User, Completion, MenuItem, Plate } from '@/types'

interface Props {
  manager: User
  trainees: User[]
  completions: Completion[]
  menuItems: MenuItem[]
  plates?: Plate[]
}

export function ManagerSignOff({ manager, trainees, completions: initialCompletions, menuItems, plates = [] }: Props) {
  const [selectedTrainee, setSelectedTrainee] = useState<User | null>(
    trainees.length === 1 ? trainees[0] : null
  )
  const [selectedCompletion, setSelectedCompletion] = useState<Completion | null>(null)
  const [completions, setCompletions] = useState(initialCompletions)
  const router = useRouter()

  const traineeCompletions = completions.filter(
    c => c.trainee_id === selectedTrainee?.id
  )

  const pendingSignOff = traineeCompletions.filter(c => !c.trainer_rating)
  const signedOff = traineeCompletions.filter(c => !!c.trainer_rating)

  // Find the plate for a completion (to show if shadowed early)
  const getPlateForCompletion = (completion: Completion) => {
    return plates.find(
      p => p.menu_item_id === completion.menu_item_id && p.trainee_id === completion.trainee_id
    )
  }

  function handleReassigned(completionId: string) {
    setCompletions(prev => prev.filter(c => c.id !== completionId))
    setSelectedCompletion(null)
    router.refresh()
  }

  return (
    <>
      <div className="px-5 py-6">
        <div className="mb-5">
          <h1 className="font-serif text-2xl text-charcoal">Sign Off Training</h1>
          <p className="text-sm text-charcoal/40 mt-1">Review and assess completed items</p>
        </div>

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
                      plate={getPlateForCompletion(completion)}
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
                      plate={getPlateForCompletion(completion)}
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

      {selectedCompletion?.menu_item && (
        <TaskModal
          item={selectedCompletion.menu_item}
          plate={null}
          existingCompletion={selectedCompletion}
          currentUser={manager}
          mode="manager"
          onClose={() => setSelectedCompletion(null)}
          onComplete={() => router.refresh()}
          onReassign={() => handleReassigned(selectedCompletion.id)}
        />
      )}
    </>
  )
}

function CompletionCard({
  completion,
  plate,
  onOpen,
  mode,
}: {
  completion: Completion
  plate?: Plate
  onOpen: () => void
  mode: 'pending' | 'done'
}) {
  const item = completion.menu_item
  if (!item) return null

  // Check if completed before assigned date
  const completedEarly = plate && completion.completed_date < plate.date_assigned
  const isShadowing = completion.is_shadowing_moment

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
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-xs text-charcoal/40">
              Completed {new Date(completion.completed_date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
            </p>
            {plate && (
              <p className="text-xs text-charcoal/30">
                Assigned for {new Date(plate.date_assigned + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
              </p>
            )}
            {completedEarly && (
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                Shadowed early
              </span>
            )}
            {isShadowing && !completedEarly && (
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                Shadowing moment
              </span>
            )}
          </div>
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
