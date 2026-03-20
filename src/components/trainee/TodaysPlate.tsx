'use client'

import { useState } from 'react'
import { CategoryBadge } from '@/components/ui/CategoryBadge'
import { TaskModal } from '@/components/ui/TaskModal'
import { StarRating } from '@/components/ui/StarRating'
import { CATEGORY_COLOURS } from '@/types'
import { Clock } from 'lucide-react'
import type { Plate, Completion, User } from '@/types'
import { useRouter } from 'next/navigation'

interface Props {
  plates: Plate[]
  completions: Completion[]
  shadowedToday?: Completion[]
  currentUser: User
}

export function TodaysPlate({ plates, completions, shadowedToday = [], currentUser }: Props) {
  const [selectedPlate, setSelectedPlate] = useState<Plate | null>(null)
  const router = useRouter()

  const today = new Date().toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  const getCompletion = (menuItemId: string) =>
    completions.find(c => c.menu_item_id === menuItemId) ?? null

  const completed = plates.filter(p => getCompletion(p.menu_item_id))
  const remaining = plates.filter(p => !getCompletion(p.menu_item_id))

  const totalItems = plates.length + shadowedToday.length
  const totalCompleted = completed.length + shadowedToday.length

  if (plates.length === 0 && shadowedToday.length === 0) {
    return (
      <div className="px-5 py-8">
        <div className="mb-6">
          <h1 className="font-serif text-2xl text-charcoal">Today&apos;s Plate</h1>
          <p className="text-sm text-charcoal/40 mt-1">{today}</p>
        </div>
        <div className="card p-8 text-center">
          <p className="text-4xl mb-4">◈</p>
          <p className="font-serif text-lg text-charcoal/60">Your plate is empty today.</p>
          <p className="text-sm text-charcoal/40 mt-2">Your manager hasn&apos;t assigned any training yet — or check the Menu to self-log a shadowing moment.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="px-5 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-serif text-2xl text-charcoal">Today&apos;s Plate</h1>
          <p className="text-sm text-charcoal/40 mt-1">{today}</p>
        </div>

        {/* Progress summary */}
        <div className="card p-4 mb-6 flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-charcoal/60">Today&apos;s progress</span>
              <span className="font-medium text-charcoal">{totalCompleted}/{totalItems}</span>
            </div>
            <div className="h-2 bg-charcoal/8 rounded-full overflow-hidden">
              <div
                className="h-full bg-gold rounded-full transition-all duration-500"
                style={{ width: `${totalItems > 0 ? (totalCompleted / totalItems) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Remaining */}
        {remaining.length > 0 && (
          <div className="mb-5">
            <h2 className="text-xs font-medium text-charcoal/40 uppercase tracking-widest mb-3">To complete</h2>
            <div className="space-y-3">
              {remaining.map(plate => (
                <PlateCard
                  key={plate.id}
                  plate={plate}
                  completed={false}
                  onOpen={() => setSelectedPlate(plate)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Completed */}
        {(completed.length > 0 || shadowedToday.length > 0) && (
          <div>
            <h2 className="text-xs font-medium text-charcoal/40 uppercase tracking-widest mb-3">Completed</h2>
            <div className="space-y-3 opacity-60">
              {completed.map(plate => (
                <PlateCard
                  key={plate.id}
                  plate={plate}
                  completed
                  completion={getCompletion(plate.menu_item_id)!}
                  onOpen={() => setSelectedPlate(plate)}
                />
              ))}
              {shadowedToday.map(completion => (
                <ShadowedCard key={completion.id} completion={completion} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Task modal */}
      {selectedPlate?.menu_item && (
        <TaskModal
          item={selectedPlate.menu_item}
          plate={selectedPlate}
          existingCompletion={getCompletion(selectedPlate.menu_item_id)}
          currentUser={currentUser}
          mode="trainee"
          onClose={() => setSelectedPlate(null)}
          onComplete={() => router.refresh()}
        />
      )}
    </>
  )
}

function PlateCard({
  plate,
  completed,
  completion,
  onOpen,
}: {
  plate: Plate
  completed: boolean
  completion?: Completion
  onOpen: () => void
}) {
  const item = plate.menu_item
  if (!item) return null

  const colour = item.category ? CATEGORY_COLOURS[item.category.name] ?? '#C9A96E' : '#C9A96E'

  return (
    <button
      onClick={onOpen}
      className="card w-full text-left p-4 hover:shadow-md transition-shadow active:scale-[0.99]"
    >
      <div
        className="w-1 absolute left-0 top-4 bottom-4 rounded-r-full"
        style={{ backgroundColor: colour }}
      />
      <div className="pl-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            {item.category && (
              <CategoryBadge categoryName={item.category.name} icon={item.category.icon} />
            )}
            <p className="font-medium text-charcoal mt-1.5 text-[15px] leading-snug">{item.title}</p>
          </div>
          {completed && completion?.trainee_rating && (
            <StarRating value={completion.trainee_rating} readonly size="sm" />
          )}
          {!completed && (
            <span className="text-charcoal/20 text-xl mt-0.5">›</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-2 text-xs text-charcoal/40">
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {item.time_needed}
          </span>
          <span>{item.trainer_type}</span>
        </div>
        {completed && (
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-green-600 text-xs">✓</span>
            <span className="text-xs text-green-600">Complete</span>
          </div>
        )}
      </div>
    </button>
  )
}

function ShadowedCard({ completion }: { completion: Completion }) {
  const item = completion.menu_item
  if (!item) return null

  const colour = item.category ? CATEGORY_COLOURS[item.category.name] ?? '#C9A96E' : '#C9A96E'

  return (
    <div className="card w-full text-left p-4">
      <div
        className="w-1 absolute left-0 top-4 bottom-4 rounded-r-full"
        style={{ backgroundColor: colour }}
      />
      <div className="pl-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            {item.category && (
              <CategoryBadge categoryName={item.category.name} icon={item.category.icon} />
            )}
            <p className="font-medium text-charcoal mt-1.5 text-[15px] leading-snug">
              {item.title}
            </p>
          </div>
          {completion.trainee_rating && (
            <StarRating value={completion.trainee_rating} readonly size="sm" />
          )}
        </div>
        <div className="flex items-center gap-3 mt-2 text-xs text-charcoal/40">
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {item.time_needed}
          </span>
          <span>{item.trainer_type}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-2">
          <span className="text-green-600 text-xs">✓</span>
          <span className="text-xs text-green-600">Complete</span>
          <span className="text-xs text-gold bg-gold/10 px-2 py-0.5 rounded-full ml-1">Shadowed</span>
        </div>
      </div>
    </div>
  )
}
