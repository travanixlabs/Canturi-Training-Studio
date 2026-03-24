'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { Plate, Completion, User, Category, RecurringTaskCompletion, Workshop, WorkshopMenuItem } from '@/types'
import { useRouter } from 'next/navigation'
import { todayAEDT, formatDateShort } from '@/lib/dates'
import { useDatePlateView } from '@/lib/useDatePlateView'
import type { PlateItemInfo, PlateGroup } from '@/lib/useDatePlateView'
import { DateNavigation } from './DateNavigation'

interface Props {
  allPlates: Plate[]
  allCompletions: Completion[]
  allRecurringCompletions: RecurringTaskCompletion[]
  currentUser: User
  workshops?: Workshop[]
  workshopMenuItems?: WorkshopMenuItem[]
}

export function TodaysPlate({ allPlates, allCompletions, allRecurringCompletions, currentUser, workshops = [], workshopMenuItems = [] }: Props) {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState(todayAEDT())

  const {
    isToday,
    remainingGroups,
    completedGroups,
    progress,
    availableDates,
    prevDate,
    nextDate,
    dateBounds,
  } = useDatePlateView(allPlates, allCompletions, allRecurringCompletions, selectedDate, currentUser.id)

  const hasItems = remainingGroups.length > 0 || completedGroups.length > 0

  return (
    <div className="px-5 py-6">
      {/* Header with date navigation */}
      <DateNavigation
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        prevDate={prevDate}
        nextDate={nextDate}
        availableDates={availableDates}
        dateBounds={dateBounds}
      />

      {!hasItems ? (
        <div className="card p-8 text-center">
          <p className="text-4xl mb-4">◈</p>
          <p className="font-serif text-lg text-charcoal/60">
            {isToday ? 'Your plate is empty today.' : 'No training items on this date.'}
          </p>
          {isToday && (
            <p className="text-sm text-charcoal/40 mt-2">
              Your manager hasn&apos;t assigned any training yet — or check the Menu to self-log a shadowing moment.
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Progress summary */}
          <div className="card p-4 mb-6">
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-charcoal/60">{isToday ? "Today's Progress" : 'Day Progress'}</span>
              <span className="font-medium text-charcoal">{progress.completed}/{progress.total}</span>
            </div>
            <div className="h-2 bg-charcoal/8 rounded-full overflow-hidden">
              <div
                className="h-full bg-gold rounded-full transition-all duration-500"
                style={{ width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* To complete */}
          {remainingGroups.length > 0 && (
            <div className="mb-5">
              <h2 className="text-xs font-medium text-charcoal/40 uppercase tracking-widest mb-3">To complete</h2>
              <div className="space-y-3">
                {remainingGroups.map(group => (
                  <CategoryGroup
                    key={group.category?.id ?? 'none'}
                    category={group.category}
                    colour={group.colour}
                    items={group.items}
                    totalInCategory={group.items.length}
                    completedInCategory={0}
                    onItemClick={(itemId) => router.push(`/trainee/course/${itemId}`)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Completed */}
          {completedGroups.length > 0 && (
            <div>
              <h2 className="text-xs font-medium text-charcoal/40 uppercase tracking-widest mb-3">Completed</h2>
              <div className="space-y-3 opacity-60">
                {completedGroups.map(group => (
                  <CategoryGroup
                    key={group.category?.id ?? 'none'}
                    category={group.category}
                    colour={group.colour}
                    items={group.items}
                    totalInCategory={group.items.length}
                    completedInCategory={group.items.length}
                    onItemClick={(itemId) => router.push(`/trainee/course/${itemId}`)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function CategoryGroup({
  category,
  colour,
  items,
  totalInCategory,
  completedInCategory,
  onItemClick,
}: {
  category: Category | null
  colour: string
  items: PlateItemInfo[]
  totalInCategory: number
  completedInCategory: number
  onItemClick: (itemId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-charcoal/2 transition-colors"
      >
        <span
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
          style={{ backgroundColor: colour + '20', color: colour }}
        >
          {category?.icon ?? '◈'}
        </span>
        <div className="flex-1">
          <p className="font-medium text-charcoal text-[15px]">{category?.name ?? 'Other'}</p>
          <p className="text-xs text-charcoal/40 mt-0.5">{completedInCategory}/{totalInCategory} complete</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-16 h-1.5 bg-charcoal/8 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${totalInCategory > 0 ? (completedInCategory / totalInCategory) * 100 : 0}%`,
                backgroundColor: colour,
              }}
            />
          </div>
          {expanded ? <ChevronUp size={16} className="text-charcoal/30" /> : <ChevronDown size={16} className="text-charcoal/30" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-black/5 divide-y divide-black/5">
          {items.map(item => {
            const recurringFullyComplete = item.isRecurring && (item.recurringDone ?? 0) >= (item.recurringTotal ?? 0)

            // Background: green only for completed items in Completed section, yellow for overdue
            // completedOnOtherDate items stay in To Complete with NO formatting
            const bgClass = item.isRecurring
              ? (recurringFullyComplete ? 'bg-green-50/50 hover:bg-green-50' : 'hover:bg-charcoal/2')
              : item.completedOnOtherDate
                ? 'hover:bg-charcoal/2'
                : (item.completed ? (item.shadowedEarly ? 'bg-blue-50/50 hover:bg-blue-50' : 'bg-green-50/50 hover:bg-green-50') : item.isOverdue ? 'bg-yellow-50/50 hover:bg-yellow-50' : 'hover:bg-charcoal/2')

            // Circle: no green/blue for completedOnOtherDate
            const circleClass = item.isRecurring
              ? (recurringFullyComplete ? 'border-transparent bg-green-500' : 'border-charcoal/20')
              : item.completedOnOtherDate
                ? 'border-charcoal/20'
                : (item.completed ? (item.shadowedEarly ? 'border-transparent bg-blue-500' : 'border-transparent bg-green-500') : item.isOverdue ? 'border-yellow-400 bg-yellow-50' : 'border-charcoal/20')

            return (
              <button
                key={item.id}
                onClick={() => onItemClick(item.id)}
                className={`w-full px-5 py-3.5 flex items-center gap-3 text-left transition-colors ${bgClass}`}
              >
                <span className={`w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center text-xs ${circleClass}`}>
                  {(item.completed && !item.completedOnOtherDate) || recurringFullyComplete ? <span className="text-white text-[10px]">✓</span> : null}
                </span>
                <div className="flex-1">
                  <p className={`text-[14px] leading-snug ${
                    item.isRecurring
                      ? (recurringFullyComplete ? 'text-charcoal/40' : 'text-charcoal')
                      : (item.completed && !item.completedOnOtherDate ? 'text-charcoal/40' : 'text-charcoal')
                  }`}>
                    {item.title}
                  </p>
                  {item.isRecurring ? (
                    <p className={`text-xs font-medium mt-0.5 ${recurringFullyComplete ? 'text-green-600' : 'text-charcoal/40'}`}>
                      {item.recurringDone} out of {item.recurringTotal} sessions completed
                      {(item.recurringDone ?? 0) > 0 && item.recurringBreakdown && (
                        <span className="ml-1">
                          | {item.recurringBreakdown.shadowed > 0 && <span className="text-blue-600">{item.recurringBreakdown.shadowed} shadowed</span>}{item.recurringBreakdown.assigned > 0 && item.recurringBreakdown.shadowed > 0 && <span className="text-charcoal/30"> / </span>}{item.recurringBreakdown.assigned > 0 && <span className="text-green-600">{item.recurringBreakdown.assigned} completed</span>}
                        </span>
                      )}
                    </p>
                  ) : item.completedOnOtherDate ? (
                    <p className="text-xs mt-0.5 text-charcoal/50">
                      Completed {formatDateShort(item.completedOnOtherDate)}
                    </p>
                  ) : item.completed && item.completedDate ? (
                    <p className="text-xs mt-0.5">
                      {item.shadowedEarly ? (
                        <span className="text-blue-600 font-medium">
                          Shadowed early on {formatDateShort(item.completedDate)}
                        </span>
                      ) : (
                        <span className="text-green-600 font-medium">
                          Completed {formatDateShort(item.completedDate)}
                        </span>
                      )}
                    </p>
                  ) : item.assignedDate ? (
                    <p className="text-xs mt-0.5">
                      <span className={`font-semibold ${item.isOverdue ? 'text-yellow-600' : 'text-charcoal/50'}`}>
                        {item.isOverdue ? 'Overdue — ' : ''}{formatDateShort(item.assignedDate)}
                      </span>
                    </p>
                  ) : null}
                </div>
                {!item.completed && !recurringFullyComplete && !item.completedOnOtherDate && (
                  <span className="text-charcoal/20 text-lg">›</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
