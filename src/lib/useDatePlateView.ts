import { useMemo } from 'react'
import { todayAEDT } from '@/lib/dates'
import { CATEGORY_COLOURS } from '@/types'
import type { Plate, Completion, RecurringTaskCompletion, Category } from '@/types'

export interface PlateItemInfo {
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
  /** Item was completed on a different date — show text but no green formatting */
  completedOnOtherDate?: string
}

export interface PlateGroup {
  category: Category | null
  colour: string
  items: PlateItemInfo[]
}

export interface DatePlateView {
  isToday: boolean
  selectedDate: string
  remainingGroups: PlateGroup[]
  completedGroups: PlateGroup[]
  progress: { completed: number; total: number }
  availableDates: string[]
  prevDate: string | null
  nextDate: string | null
  dateBounds: { min: string; max: string } | null
}

export function useDatePlateView(
  allPlates: Plate[],
  allCompletions: Completion[],
  allRecurringCompletions: RecurringTaskCompletion[],
  selectedDate: string,
  userId: string,
): DatePlateView {
  const today = todayAEDT()
  const isToday = selectedDate === today

  // Collect all dates that have data
  const availableDates = useMemo(() => {
    const dateSet = new Set<string>()
    for (const p of allPlates) dateSet.add(p.date_assigned)
    for (const c of allCompletions) dateSet.add(c.completed_date)
    for (const rc of allRecurringCompletions) dateSet.add(rc.completed_date)
    return Array.from(dateSet).sort()
  }, [allPlates, allCompletions, allRecurringCompletions])

  const dateBounds = useMemo(() => {
    if (availableDates.length === 0) return null
    return { min: availableDates[0], max: availableDates[availableDates.length - 1] }
  }, [availableDates])

  // Prev/next available date
  const prevDate = useMemo(() => {
    for (let i = availableDates.length - 1; i >= 0; i--) {
      if (availableDates[i] < selectedDate) return availableDates[i]
    }
    return null
  }, [availableDates, selectedDate])

  const nextDate = useMemo(() => {
    for (let i = 0; i < availableDates.length; i++) {
      if (availableDates[i] > selectedDate) return availableDates[i]
    }
    return null
  }, [availableDates, selectedDate])

  // Helper: get completion for a menu item
  const getCompletion = (menuItemId: string) =>
    allCompletions.find(c => c.menu_item_id === menuItemId) ?? null

  // Helper: recurring completions for an item
  const getRecurringForItem = (menuItemId: string) =>
    allRecurringCompletions.filter(rc => rc.menu_item_id === menuItemId && rc.trainee_id === userId)

  // Helper: recurring count as of a date (snapshot)
  const getRecurringCountAsOf = (menuItemId: string, asOfDate: string) =>
    getRecurringForItem(menuItemId).filter(rc => rc.completed_date <= asOfDate).length

  // Helper: was a session done on a specific date
  const wasSessionDoneOn = (menuItemId: string, date: string) =>
    getRecurringForItem(menuItemId).some(rc => rc.completed_date === date)

  // Helper: recurring breakdown as of date
  const getRecurringBreakdownAsOf = (menuItemId: string, asOfDate: string) => {
    const rcsAsOf = getRecurringForItem(menuItemId).filter(rc => rc.completed_date <= asOfDate)
    const assignedDates = allPlates
      .filter(p => p.menu_item_id === menuItemId && p.trainee_id === userId)
      .map(p => p.date_assigned)
    const assigned = rcsAsOf.filter(rc => assignedDates.includes(rc.completed_date)).length
    return { assigned, shadowed: rcsAsOf.length - assigned }
  }

  // Helper: is recurring fully complete as of date
  const isFullyCompleteAsOf = (menuItemId: string, recurringAmount: number, asOfDate: string) =>
    getRecurringCountAsOf(menuItemId, asOfDate) >= recurringAmount

  // Build view for selected date
  const { remainingGroups, completedGroups, progress } = useMemo(() => {
    const remaining: PlateItemInfo[] = []
    const completed: PlateItemInfo[] = []

    // 1. Plates assigned on selected date
    const platesOnDate = allPlates.filter(p => p.date_assigned === selectedDate)

    for (const p of platesOnDate) {
      const mi = p.menu_item
      if (!mi) continue
      const isRec = mi.is_recurring && !!mi.recurring_amount

      if (isRec) {
        const recTotal = mi.recurring_amount ?? 0
        const recDoneAsOf = getRecurringCountAsOf(mi.id, selectedDate)
        const fullyComplete = recDoneAsOf >= recTotal
        const doneOnThisDate = wasSessionDoneOn(mi.id, selectedDate)
        const breakdown = getRecurringBreakdownAsOf(mi.id, selectedDate)

        const item: PlateItemInfo = {
          id: mi.id,
          title: mi.title,
          timeNeeded: mi.time_needed ?? '',
          trainerType: mi.trainer_type ?? '',
          completed: false,
          assignedDate: p.date_assigned,
          isRecurring: true,
          recurringDone: recDoneAsOf,
          recurringTotal: recTotal,
          recurringDoneToday: doneOnThisDate,
          recurringBreakdown: breakdown,
        }

        if (doneOnThisDate || fullyComplete) {
          completed.push({ ...item, completed: true })
        } else {
          remaining.push(item)
        }
      } else {
        // Non-recurring
        const comp = getCompletion(mi.id)
        const completedOnThisDate = comp?.completed_date === selectedDate
        const completedBeforeAssigned = !!(comp && p.date_assigned && comp.completed_date <= p.date_assigned)
        const isShadowedEarly = !!(comp && p.date_assigned && comp.completed_date < p.date_assigned)
        const isShadowingMoment = comp?.is_shadowing_moment ?? false

        if (completedOnThisDate || (comp && completedBeforeAssigned && selectedDate === p.date_assigned)) {
          // Completed on this date OR viewing the assigned date and it was completed before/on it
          // → show in Completed section with full formatting
          completed.push({
            id: mi.id,
            title: mi.title,
            timeNeeded: mi.time_needed ?? '',
            trainerType: mi.trainer_type ?? '',
            completed: true,
            completedDate: comp!.completed_date,
            assignedDate: p.date_assigned,
            shadowedEarly: isShadowedEarly,
            shadowed: isShadowingMoment,
            rating: comp!.trainee_rating ?? undefined,
          })
        } else if (comp && !completedBeforeAssigned) {
          // Completed on a later date — show in To Complete with neutral text
          remaining.push({
            id: mi.id,
            title: mi.title,
            timeNeeded: mi.time_needed ?? '',
            trainerType: mi.trainer_type ?? '',
            completed: false,
            assignedDate: p.date_assigned,
            completedOnOtherDate: comp.completed_date,
            shadowed: isShadowingMoment,
          })
        } else {
          // Not completed yet
          remaining.push({
            id: mi.id,
            title: mi.title,
            timeNeeded: mi.time_needed ?? '',
            trainerType: mi.trainer_type ?? '',
            completed: false,
            assignedDate: p.date_assigned,
          })
        }
      }
    }

    // 2. Completions on this date for items NOT assigned on this date (shadowed or completed on this date)
    const platesOnDateItemIds = new Set(platesOnDate.map(p => p.menu_item_id))

    // Non-recurring completions on selected date not already covered by plates
    for (const c of allCompletions) {
      if (c.completed_date !== selectedDate) continue
      if (platesOnDateItemIds.has(c.menu_item_id)) continue
      // Check if this item is recurring — if so, handled separately below
      const mi = c.menu_item
      if (mi?.is_recurring && mi?.recurring_amount) continue

      // Check if this item has an assigned date (plate on a different date) and was completed before it
      const assignedPlate = allPlates.find(p => p.menu_item_id === c.menu_item_id)
      const assignedDate = assignedPlate?.date_assigned
      const isShadowedEarly = !!(assignedDate && c.completed_date < assignedDate)

      completed.push({
        id: c.menu_item_id,
        title: mi?.title ?? '',
        timeNeeded: mi?.time_needed ?? '',
        trainerType: mi?.trainer_type ?? '',
        completed: true,
        shadowed: c.is_shadowing_moment,
        shadowedEarly: isShadowedEarly,
        completedDate: c.completed_date,
        assignedDate,
        rating: c.trainee_rating ?? undefined,
      })
    }

    // Recurring completions on selected date for items not assigned on this date
    const seenRecurring = new Set<string>()
    for (const rc of allRecurringCompletions) {
      if (rc.completed_date !== selectedDate) continue
      if (platesOnDateItemIds.has(rc.menu_item_id)) continue
      if (seenRecurring.has(rc.menu_item_id)) continue
      seenRecurring.add(rc.menu_item_id)

      // Find the menu_item from any plate that has it
      const refPlate = allPlates.find(p => p.menu_item_id === rc.menu_item_id)
      const mi = refPlate?.menu_item
      if (!mi) continue

      const recTotal = mi.recurring_amount ?? 0
      const recDoneAsOf = getRecurringCountAsOf(mi.id, selectedDate)
      const breakdown = getRecurringBreakdownAsOf(mi.id, selectedDate)

      completed.push({
        id: mi.id,
        title: mi.title,
        timeNeeded: mi.time_needed ?? '',
        trainerType: mi.trainer_type ?? '',
        completed: true,
        assignedDate: refPlate?.date_assigned,
        isRecurring: true,
        recurringDone: recDoneAsOf,
        recurringTotal: recTotal,
        recurringDoneToday: true,
        recurringBreakdown: breakdown,
      })
    }

    // 3. Overdue items — only when viewing today
    if (isToday) {
      const todayItemIds = new Set(platesOnDate.map(p => p.menu_item_id))
      const completedItemIds = new Set(completed.map(i => i.id))
      const remainingItemIds = new Set(remaining.map(i => i.id))

      for (const p of allPlates) {
        if (p.date_assigned >= today) continue
        const mi = p.menu_item
        if (!mi) continue
        if (todayItemIds.has(mi.id)) continue
        if (completedItemIds.has(mi.id)) continue
        if (remainingItemIds.has(mi.id)) continue

        const isRec = mi.is_recurring && !!mi.recurring_amount

        if (isRec) {
          const recTotal = mi.recurring_amount ?? 0
          if (isFullyCompleteAsOf(mi.id, recTotal, today)) continue
          if (todayItemIds.has(mi.id)) continue
          if (!wasSessionDoneOn(mi.id, p.date_assigned)) {
            // Session was due but not done on that date, no today assignment
            const recDoneAsOf = getRecurringCountAsOf(mi.id, today)
            const breakdown = getRecurringBreakdownAsOf(mi.id, today)
            remaining.push({
              id: mi.id,
              title: mi.title,
              timeNeeded: mi.time_needed ?? '',
              trainerType: mi.trainer_type ?? '',
              completed: false,
              assignedDate: p.date_assigned,
              isOverdue: true,
              isRecurring: true,
              recurringDone: recDoneAsOf,
              recurringTotal: recTotal,
              recurringBreakdown: breakdown,
            })
            remainingItemIds.add(mi.id)
          }
        } else {
          const comp = getCompletion(mi.id)
          if (comp) continue // completed — don't show as overdue
          remaining.push({
            id: mi.id,
            title: mi.title,
            timeNeeded: mi.time_needed ?? '',
            trainerType: mi.trainer_type ?? '',
            completed: false,
            assignedDate: p.date_assigned,
            isOverdue: true,
          })
          remainingItemIds.add(mi.id)
        }
      }

      // Also add past-assigned incomplete non-recurring items on current date
      for (const p of allPlates) {
        if (p.date_assigned >= today) continue
        const mi = p.menu_item
        if (!mi || (mi.is_recurring && mi.recurring_amount)) continue
        if (remainingItemIds.has(mi.id)) continue
        if (completedItemIds.has(mi.id)) continue
        if (todayItemIds.has(mi.id)) continue
        const comp = getCompletion(mi.id)
        if (comp) continue
        remaining.push({
          id: mi.id,
          title: mi.title,
          timeNeeded: mi.time_needed ?? '',
          trainerType: mi.trainer_type ?? '',
          completed: false,
          assignedDate: p.date_assigned,
          isOverdue: true,
        })
        remainingItemIds.add(mi.id)
      }
    }

    // Deduplicate by id (keep first occurrence)
    const dedup = (arr: PlateItemInfo[]) => {
      const seen = new Set<string>()
      return arr.filter(item => {
        if (seen.has(item.id)) return false
        seen.add(item.id)
        return true
      })
    }

    const dedupRemaining = dedup(remaining)
    const dedupCompleted = dedup(completed)

    // Group by category
    const groupItems = (items: PlateItemInfo[]): PlateGroup[] => {
      const groups: Record<string, PlateGroup> = {}
      for (const item of items) {
        // Find the category from allPlates or allCompletions
        const plate = allPlates.find(p => p.menu_item_id === item.id)
        const comp = allCompletions.find(c => c.menu_item_id === item.id)
        const cat = plate?.menu_item?.category ?? comp?.menu_item?.category ?? null
        const key = cat?.id ?? 'uncategorised'
        if (!groups[key]) {
          groups[key] = {
            category: cat,
            colour: cat ? CATEGORY_COLOURS[cat.name] ?? cat.colour_hex : '#C9A96E',
            items: [],
          }
        }
        groups[key].items.push(item)
      }
      return Object.values(groups).sort((a, b) => (a.category?.sort_order ?? 99) - (b.category?.sort_order ?? 99))
    }

    const totalItems = dedupRemaining.length + dedupCompleted.length
    const totalCompleted = dedupCompleted.length

    return {
      remainingGroups: groupItems(dedupRemaining),
      completedGroups: groupItems(dedupCompleted),
      progress: { completed: totalCompleted, total: totalItems },
    }
  }, [allPlates, allCompletions, allRecurringCompletions, selectedDate, userId, isToday, today])

  return {
    isToday,
    selectedDate,
    remainingGroups,
    completedGroups,
    progress,
    availableDates,
    prevDate,
    nextDate,
    dateBounds,
  }
}
