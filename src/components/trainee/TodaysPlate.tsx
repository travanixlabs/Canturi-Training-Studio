'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { CATEGORY_COLOURS } from '@/types'
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

interface WorkshopPlateGroup {
  workshop: Workshop
  courseGroups: PlateGroup[]
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

  // Build lookup: menu_item_id -> workshop_id
  const itemToWorkshop = useMemo(() => {
    const map = new Map<string, string>()
    for (const wmi of workshopMenuItems) {
      map.set(wmi.menu_item_id, wmi.workshop_id)
    }
    return map
  }, [workshopMenuItems])

  const workshopMap = useMemo(() => {
    const map = new Map<string, Workshop>()
    for (const ws of workshops) map.set(ws.id, ws)
    return map
  }, [workshops])

  // Group PlateGroups into Workshop -> Course hierarchy
  function groupByWorkshop(groups: PlateGroup[]): WorkshopPlateGroup[] {
    const wsMap = new Map<string, PlateGroup[]>()

    for (const group of groups) {
      // Find which workshop this category belongs to by checking items
      const firstItem = group.items[0]
      if (!firstItem) continue
      const wsId = itemToWorkshop.get(firstItem.id)
      if (!wsId) continue

      if (!wsMap.has(wsId)) wsMap.set(wsId, [])
      wsMap.get(wsId)!.push(group)
    }

    return Array.from(wsMap.entries())
      .map(([wsId, courseGroups]) => ({
        workshop: workshopMap.get(wsId)!,
        courseGroups,
      }))
      .filter(g => g.workshop)
  }

  const remainingWorkshopGroups = useMemo(() => groupByWorkshop(remainingGroups), [remainingGroups, itemToWorkshop, workshopMap])
  const completedWorkshopGroups = useMemo(() => groupByWorkshop(completedGroups), [completedGroups, itemToWorkshop, workshopMap])

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
          {remainingWorkshopGroups.length > 0 && (
            <div className="mb-5">
              <h2 className="text-xs font-medium text-charcoal/40 uppercase tracking-widest mb-3">To complete</h2>
              <div className="space-y-3">
                {remainingWorkshopGroups.map(wsGroup => (
                  <WorkshopSection
                    key={wsGroup.workshop.id}
                    workshop={wsGroup.workshop}
                    courseGroups={wsGroup.courseGroups}
                    onItemClick={(itemId) => router.push(`/trainee/course/${itemId}`)}
                    section="remaining"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Completed */}
          {completedWorkshopGroups.length > 0 && (
            <div>
              <h2 className="text-xs font-medium text-charcoal/40 uppercase tracking-widest mb-3">Completed</h2>
              <div className="space-y-3 opacity-60">
                {completedWorkshopGroups.map(wsGroup => (
                  <WorkshopSection
                    key={wsGroup.workshop.id}
                    workshop={wsGroup.workshop}
                    courseGroups={wsGroup.courseGroups}
                    onItemClick={(itemId) => router.push(`/trainee/course/${itemId}`)}
                    section="completed"
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

function WorkshopSection({
  workshop,
  courseGroups,
  onItemClick,
  section,
}: {
  workshop: Workshop
  courseGroups: PlateGroup[]
  onItemClick: (itemId: string) => void
  section: 'remaining' | 'completed'
}) {
  const [expanded, setExpanded] = useState(false)
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set())
  const totalItems = courseGroups.reduce((sum, g) => sum + g.items.length, 0)
  const completedItems = courseGroups.reduce((sum, g) => sum + g.items.filter(i => i.completed || i.completedOnOtherDate).length, 0)

  const allCoursesExpanded = courseGroups.length > 0 && courseGroups.every(g => expandedCourses.has(g.category?.id ?? 'none'))

  function toggleExpandAll(e: React.MouseEvent) {
    e.stopPropagation()
    if (allCoursesExpanded) {
      setExpandedCourses(new Set())
    } else {
      setExpandedCourses(new Set(courseGroups.map(g => g.category?.id ?? 'none')))
    }
  }

  return (
    <div className="card overflow-hidden">
      {/* Workshop header */}
      <div className="flex items-center">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 px-5 py-4 flex items-center gap-3 text-left hover:bg-charcoal/2 transition-colors"
        >
          <span className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center text-sm flex-shrink-0 text-gold font-serif">
            W
          </span>
          <div className="flex-1">
            <p className="font-serif font-medium text-charcoal text-[16px]">{workshop.name}</p>
            <p className="text-xs text-charcoal/40 mt-0.5">
              {section === 'completed' ? `${totalItems} completed` : `${totalItems - completedItems} remaining`} · {courseGroups.length} course{courseGroups.length !== 1 ? 's' : ''}
            </p>
          </div>
          {expanded ? <ChevronUp size={16} className="text-charcoal/30" /> : <ChevronDown size={16} className="text-charcoal/30" />}
        </button>
        {expanded && (
          <button
            onClick={toggleExpandAll}
            className="mr-4 text-xs font-medium text-gold hover:text-gold/80 transition-colors whitespace-nowrap"
          >
            {allCoursesExpanded ? 'Collapse all' : 'Expand all'}
          </button>
        )}
      </div>

      {/* Courses inside workshop */}
      {expanded && (
        <div className="border-t border-black/5">
          {courseGroups.map(group => {
            const courseId = group.category?.id ?? 'none'
            return (
              <CourseGroup
                key={courseId}
                category={group.category}
                colour={group.colour}
                items={group.items}
                onItemClick={onItemClick}
                forceExpanded={expandedCourses.has(courseId)}
                onToggle={(isExpanded) => {
                  setExpandedCourses(prev => {
                    const next = new Set(prev)
                    if (isExpanded) next.add(courseId)
                    else next.delete(courseId)
                    return next
                  })
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function CourseGroup({
  category,
  colour,
  items,
  onItemClick,
  forceExpanded,
  onToggle,
}: {
  category: Category | null
  colour: string
  items: PlateItemInfo[]
  onItemClick: (itemId: string) => void
  forceExpanded?: boolean
  onToggle?: (expanded: boolean) => void
}) {
  const [localExpanded, setLocalExpanded] = useState(false)
  const expanded = forceExpanded ?? localExpanded

  function handleToggle() {
    const next = !expanded
    setLocalExpanded(next)
    onToggle?.(next)
  }
  const completedCount = items.filter(i => i.completed || i.completedOnOtherDate).length

  return (
    <div>
      {/* Course header */}
      <button
        onClick={handleToggle}
        className="w-full pl-8 pr-5 py-3 flex items-center gap-3 text-left hover:bg-charcoal/2 transition-colors border-b border-black/5"
      >
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0"
          style={{ backgroundColor: colour + '20', color: colour }}
        >
          {category?.icon ?? '◈'}
        </span>
        <div className="flex-1">
          <p className="font-medium text-charcoal text-[14px]">{category?.name ?? 'Other'}</p>
          <p className="text-xs text-charcoal/40 mt-0.5">{completedCount}/{items.length} complete</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-1 bg-charcoal/8 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${items.length > 0 ? (completedCount / items.length) * 100 : 0}%`,
                backgroundColor: colour,
              }}
            />
          </div>
          {expanded ? <ChevronUp size={14} className="text-charcoal/30" /> : <ChevronDown size={14} className="text-charcoal/30" />}
        </div>
      </button>

      {/* Categories (menu items) */}
      {expanded && (
        <div className="divide-y divide-black/5 bg-charcoal/[0.01]">
          {items.map(item => {
            const recurringFullyComplete = item.isRecurring && (item.recurringDone ?? 0) >= (item.recurringTotal ?? 0)
            const isShadowed = item.shadowedEarly || item.shadowed

            const bgClass = item.isRecurring
              ? (recurringFullyComplete ? 'bg-green-50/50 hover:bg-green-50' : 'hover:bg-charcoal/2')
              : item.completedOnOtherDate
                ? 'hover:bg-charcoal/2'
                : (item.completed ? (isShadowed ? 'bg-blue-50/50 hover:bg-blue-50' : 'bg-green-50/50 hover:bg-green-50') : item.isOverdue ? 'bg-yellow-50/50 hover:bg-yellow-50' : 'hover:bg-charcoal/2')

            const circleClass = item.isRecurring
              ? (recurringFullyComplete ? 'border-transparent bg-green-500' : 'border-charcoal/20')
              : item.completedOnOtherDate
                ? 'border-charcoal/20'
                : (item.completed ? (isShadowed ? 'border-transparent bg-blue-500' : 'border-transparent bg-green-500') : item.isOverdue ? 'border-yellow-400 bg-yellow-50' : 'border-charcoal/20')

            return (
              <button
                key={item.id}
                onClick={() => onItemClick(item.id)}
                className={`w-full pl-12 pr-5 py-3.5 flex items-center gap-3 text-left transition-colors ${bgClass}`}
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
                      {isShadowed ? (
                        <span className="text-blue-600 font-medium">
                          {item.shadowedEarly ? 'Shadowed early on' : 'Shadowed on'} {formatDateShort(item.completedDate)}
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
