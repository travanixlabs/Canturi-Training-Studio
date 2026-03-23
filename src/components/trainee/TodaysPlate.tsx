'use client'

import { useMemo } from 'react'
import { CATEGORY_COLOURS } from '@/types'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import type { Plate, Completion, User, Category, RecurringTaskCompletion } from '@/types'
import { useRouter } from 'next/navigation'
import { todayAEDT } from '@/lib/dates'

interface Props {
  plates: Plate[]
  overduePlates?: Plate[]
  completions: Completion[]
  shadowedToday?: Completion[]
  currentUser: User
  recurringCompletions?: RecurringTaskCompletion[]
}

export function TodaysPlate({ plates, overduePlates = [], completions, shadowedToday = [], currentUser, recurringCompletions = [] }: Props) {
  const router = useRouter()

  const today = new Date().toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  const getCompletion = (menuItemId: string) =>
    completions.find(c => c.menu_item_id === menuItemId) ?? null

  const getRecurringCount = (menuItemId: string) =>
    recurringCompletions.filter(rc => rc.menu_item_id === menuItemId && rc.trainee_id === currentUser.id).length

  const getRecurringBreakdown = (menuItemId: string) => {
    const rcs = recurringCompletions.filter(rc => rc.menu_item_id === menuItemId && rc.trainee_id === currentUser.id)
    const plateDates = plates.filter(p => p.menu_item_id === menuItemId && p.trainee_id === currentUser.id).map(p => p.date_assigned)
    const assigned = rcs.filter(rc => plateDates.includes(rc.completed_date)).length
    return { assigned, shadowed: rcs.length - assigned }
  }

  const todayStr = todayAEDT()
  const isDoneToday = (menuItemId: string) =>
    recurringCompletions.some(rc => rc.menu_item_id === menuItemId && rc.trainee_id === currentUser.id && rc.completed_date === todayStr)

  const completedPlates = plates.filter(p => getCompletion(p.menu_item_id))
  const recurringDoneTodayPlates = plates.filter(p =>
    !getCompletion(p.menu_item_id) && p.menu_item?.is_recurring && isDoneToday(p.menu_item_id)
  )
  const remainingPlates = plates.filter(p =>
    !getCompletion(p.menu_item_id) && !(p.menu_item?.is_recurring && isDoneToday(p.menu_item_id))
  )

  // Overdue: past-date plates, non-recurring, not completed, not already in today's plates
  const todayItemIds = new Set(plates.map(p => p.menu_item_id))
  const overdueItems = overduePlates.filter(p =>
    !getCompletion(p.menu_item_id) && !p.menu_item?.is_recurring && !todayItemIds.has(p.menu_item_id)
  )
  // Deduplicate by menu_item_id (keep earliest assigned date)
  const seenOverdue = new Set<string>()
  const uniqueOverdue = overdueItems.filter(p => {
    if (seenOverdue.has(p.menu_item_id)) return false
    seenOverdue.add(p.menu_item_id)
    return true
  })

  const totalItems = plates.length + shadowedToday.length
  const totalCompleted = completedPlates.length + recurringDoneTodayPlates.length + shadowedToday.length

  // Group plates by category
  const groupByCategory = (items: Plate[]) => {
    const groups: Record<string, { category: Category | null; colour: string; plates: Plate[] }> = {}
    for (const p of items) {
      const cat = p.menu_item?.category
      const key = cat?.id ?? 'uncategorised'
      if (!groups[key]) {
        groups[key] = {
          category: cat ?? null,
          colour: cat ? CATEGORY_COLOURS[cat.name] ?? cat.colour_hex : '#C9A96E',
          plates: [],
        }
      }
      groups[key].plates.push(p)
    }
    // Sort by category sort_order
    return Object.values(groups).sort((a, b) => (a.category?.sort_order ?? 99) - (b.category?.sort_order ?? 99))
  }

  // Group shadowed items by category
  const shadowedByCategory = useMemo(() => {
    const groups: Record<string, { category: Category | null; colour: string; completions: Completion[] }> = {}
    for (const c of shadowedToday) {
      const cat = c.menu_item?.category as Category | undefined
      const key = cat?.id ?? 'uncategorised'
      if (!groups[key]) {
        groups[key] = {
          category: cat ?? null,
          colour: cat ? CATEGORY_COLOURS[cat.name] ?? cat.colour_hex : '#C9A96E',
          completions: [],
        }
      }
      groups[key].completions.push(c)
    }
    return Object.values(groups)
  }, [shadowedToday])

  // Merge overdue items into remaining for a single "To complete" section
  const allRemaining = useMemo(() => {
    // Build overdue plate items with isOverdue flag
    const overdueWithFlag = uniqueOverdue.map(p => ({ ...p, _isOverdue: true as const }))
    const remainingWithFlag = remainingPlates.map(p => ({ ...p, _isOverdue: false as const }))
    return [...remainingWithFlag, ...overdueWithFlag]
  }, [remainingPlates, uniqueOverdue])

  const remainingGroups = useMemo(() => {
    const groups: Record<string, { category: Category | null; colour: string; plates: (Plate & { _isOverdue: boolean })[] }> = {}
    for (const p of allRemaining) {
      const cat = p.menu_item?.category
      const key = cat?.id ?? 'uncategorised'
      if (!groups[key]) {
        groups[key] = {
          category: cat ?? null,
          colour: cat ? CATEGORY_COLOURS[cat.name] ?? cat.colour_hex : '#C9A96E',
          plates: [],
        }
      }
      groups[key].plates.push(p)
    }
    return Object.values(groups).sort((a, b) => (a.category?.sort_order ?? 99) - (b.category?.sort_order ?? 99))
  }, [allRemaining])

  const completedGroups = useMemo(() => groupByCategory([...completedPlates, ...recurringDoneTodayPlates]), [completedPlates, recurringDoneTodayPlates])

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
    <div className="px-5 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-charcoal">Today&apos;s Plate</h1>
        <p className="text-sm text-charcoal/40 mt-1">{today}</p>
      </div>

      {/* Progress summary */}
      <div className="card p-4 mb-6">
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

      {/* To complete — grouped by category */}
      {remainingGroups.length > 0 && (
        <div className="mb-5">
          <h2 className="text-xs font-medium text-charcoal/40 uppercase tracking-widest mb-3">To complete</h2>
          <div className="space-y-3">
            {remainingGroups.map(group => (
              <CategoryGroup
                key={group.category?.id ?? 'none'}
                category={group.category}
                colour={group.colour}
                items={group.plates.map(p => {
                  const mi = p.menu_item
                  const isRec = mi?.is_recurring && !!mi?.recurring_amount
                  return {
                    id: p.menu_item_id,
                    title: mi?.title ?? '',
                    timeNeeded: mi?.time_needed ?? '',
                    trainerType: mi?.trainer_type ?? '',
                    completed: false,
                    assignedDate: p.date_assigned,
                    isOverdue: p._isOverdue,
                    isRecurring: isRec,
                    recurringDone: isRec ? getRecurringCount(p.menu_item_id) : undefined,
                    recurringBreakdown: isRec ? getRecurringBreakdown(p.menu_item_id) : undefined,
                    recurringTotal: isRec ? (mi?.recurring_amount ?? 0) : undefined,
                    recurringDoneToday: isRec ? isDoneToday(p.menu_item_id) : undefined,
                  }
                })}
                totalInCategory={group.plates.length}
                completedInCategory={0}
                onItemClick={(itemId) => router.push(`/trainee/course/${itemId}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed — grouped by category (merge plates + shadowed) */}
      {(completedGroups.length > 0 || shadowedByCategory.length > 0) && (() => {
        // Merge plate completions and shadowed into single category groups
        const merged: Record<string, { category: Category | null; colour: string; items: ItemInfo[] }> = {}

        for (const group of completedGroups) {
          const key = group.category?.id ?? 'none'
          if (!merged[key]) merged[key] = { category: group.category, colour: group.colour, items: [] }
          merged[key].items.push(...group.plates.map(p => {
            const mi = p.menu_item
            const isRec = mi?.is_recurring && !!mi?.recurring_amount
            const comp = getCompletion(p.menu_item_id)
            const shadowedEarly = !!(comp && p.date_assigned && comp.completed_date < p.date_assigned)
            return {
              id: p.menu_item_id,
              title: mi?.title ?? '',
              timeNeeded: mi?.time_needed ?? '',
              trainerType: mi?.trainer_type ?? '',
              completed: true,
              completedDate: comp?.completed_date,
              assignedDate: p.date_assigned,
              shadowedEarly,
              rating: comp?.trainee_rating ?? undefined,
              isRecurring: isRec,
              recurringDone: isRec ? getRecurringCount(p.menu_item_id) : undefined,
              recurringTotal: isRec ? (mi?.recurring_amount ?? 0) : undefined,
              recurringDoneToday: isRec ? isDoneToday(p.menu_item_id) : undefined,
            }
          }))
        }

        for (const group of shadowedByCategory) {
          const key = group.category?.id ?? 'none'
          if (!merged[key]) merged[key] = { category: group.category, colour: group.colour, items: [] }
          merged[key].items.push(...group.completions.map(c => ({
            id: c.menu_item_id,
            title: c.menu_item?.title ?? '',
            timeNeeded: c.menu_item?.time_needed ?? '',
            trainerType: c.menu_item?.trainer_type ?? '',
            completed: true,
            shadowed: true,
            rating: c.trainee_rating ?? undefined,
          })))
        }

        const mergedGroups = Object.values(merged).sort((a, b) => (a.category?.sort_order ?? 99) - (b.category?.sort_order ?? 99))

        return (
          <div>
            <h2 className="text-xs font-medium text-charcoal/40 uppercase tracking-widest mb-3">Completed</h2>
            <div className="space-y-3 opacity-60">
              {mergedGroups.map(group => (
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
        )
      })()}
    </div>
  )
}

interface ItemInfo {
  id: string
  title: string
  timeNeeded: string
  trainerType: string
  completed: boolean
  shadowed?: boolean
  shadowedEarly?: boolean
  completedDate?: string
  assignedDate?: string
  isOverdue?: boolean
  rating?: number
  isRecurring?: boolean
  recurringDone?: number
  recurringTotal?: number
  recurringDoneToday?: boolean
  recurringBreakdown?: { assigned: number; shadowed: number }
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
  items: ItemInfo[]
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
            const recurringInProgress = item.isRecurring && (item.recurringDone ?? 0) > 0 && !recurringFullyComplete
            const bgClass = item.isRecurring
              ? (recurringFullyComplete ? 'bg-green-50/50 hover:bg-green-50' : recurringInProgress && item.recurringDoneToday ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-charcoal/2')
              : (item.completed ? (item.shadowedEarly ? 'bg-blue-50/50 hover:bg-blue-50' : 'bg-green-50/50 hover:bg-green-50') : item.isOverdue ? 'bg-red-50/50 hover:bg-red-50' : 'hover:bg-charcoal/2')

            return (
              <button
                key={item.id}
                onClick={() => onItemClick(item.id)}
                className={`w-full px-5 py-3.5 flex items-center gap-3 text-left transition-colors ${bgClass}`}
              >
                <span
                  className={`w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center text-xs ${
                    item.isRecurring
                      ? (recurringFullyComplete ? 'border-transparent bg-green-500' : recurringInProgress ? 'border-transparent bg-blue-500' : 'border-charcoal/20')
                      : (item.completed ? (item.shadowedEarly ? 'border-transparent bg-blue-500' : 'border-transparent bg-green-500') : item.isOverdue ? 'border-red-300 bg-red-50' : 'border-charcoal/20')
                  }`}
                >
                  {(item.completed || recurringFullyComplete) && <span className="text-white text-[10px]">✓</span>}
                </span>
                <div className="flex-1">
                  <p className={`text-[14px] leading-snug ${
                    item.isRecurring
                      ? (recurringFullyComplete ? 'text-charcoal/40' : 'text-charcoal')
                      : (item.completed ? 'text-charcoal/40' : 'text-charcoal')
                  }`}>
                    {item.title}
                  </p>
                  {item.isRecurring ? (
                    <p className={`text-xs font-medium mt-0.5 ${recurringFullyComplete ? 'text-green-600' : recurringInProgress ? 'text-blue-600' : 'text-charcoal/40'}`}>
                      {item.recurringDone} out of {item.recurringTotal} sessions completed
                      {(item.recurringDone ?? 0) > 0 && item.recurringBreakdown && (
                        <span className="text-charcoal/30 ml-1">
                          | {item.recurringBreakdown.assigned > 0 && `${item.recurringBreakdown.assigned} assigned`}{item.recurringBreakdown.assigned > 0 && item.recurringBreakdown.shadowed > 0 && ' / '}{item.recurringBreakdown.shadowed > 0 && `${item.recurringBreakdown.shadowed} shadowed`}
                        </span>
                      )}
                    </p>
                  ) : item.completed && item.completedDate ? (
                    <p className="text-xs mt-0.5">
                      {item.shadowedEarly ? (
                        <span className="text-blue-600 font-medium">
                          Shadowed early on {new Date(item.completedDate + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })}
                        </span>
                      ) : (
                        <span className="text-green-600 font-medium">
                          Completed {new Date(item.completedDate + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })}
                        </span>
                      )}
                    </p>
                  ) : item.assignedDate ? (
                    <p className="text-xs mt-0.5">
                      <span className={`font-semibold ${item.isOverdue ? 'text-red-500' : 'text-charcoal/50'}`}>
                        {item.isOverdue ? 'Overdue — ' : ''}{new Date(item.assignedDate + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })}
                      </span>
                    </p>
                  ) : null}
                </div>
                {!item.completed && !recurringFullyComplete && <span className="text-charcoal/20 text-lg">›</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
