import { useMemo } from 'react'
import { todayAEDT } from '@/lib/dates'
import { COURSE_COLOURS } from '@/types'
import type { Plate, Completion, Course } from '@/types'

export interface PlateItemInfo {
  id: string
  title: string
  trainerType: string
  completed: boolean
  shadowed?: boolean
  shadowedEarly?: boolean
  completedDate?: string
  assignedDate?: string
  isOverdue?: boolean
  rating?: number
  /** Item was completed on a different date — show text but no green formatting */
  completedOnOtherDate?: string
}

export interface PlateGroup {
  course: Course | null
  colour: string
  items: PlateItemInfo[]
}

export interface DatePlateView {
  isToday: boolean
  selectedDate: string
  remainingGroups: PlateGroup[]
  completedGroups: PlateGroup[]
  progress: { completed: number; shadowed: number; remaining: number; total: number }
  availableDates: string[]
  prevDate: string | null
  nextDate: string | null
  dateBounds: { min: string; max: string } | null
}

export function useDatePlateView(
  allPlates: Plate[],
  allCompletions: Completion[],
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
    return Array.from(dateSet).sort()
  }, [allPlates, allCompletions])

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
  const getCompletion = (categoryItemId: string) =>
    allCompletions.find(c => c.category_id === categoryItemId) ?? null

  // Build view for selected date
  const { remainingGroups, completedGroups, progress } = useMemo(() => {
    const remaining: PlateItemInfo[] = []
    const completed: PlateItemInfo[] = []

    // 1. Plates assigned on selected date
    const platesOnDate = allPlates.filter(p => p.date_assigned === selectedDate)

    for (const p of platesOnDate) {
      const mi = p.category
      if (!mi) continue

      const comp = getCompletion(mi.id)
      const completedOnThisDate = comp?.completed_date === selectedDate
      const completedBeforeAssigned = !!(comp && p.date_assigned && comp.completed_date <= p.date_assigned)
      const isShadowedEarly = !!(comp && p.date_assigned && comp.completed_date < p.date_assigned)

      if (completedOnThisDate || (comp && completedBeforeAssigned && selectedDate === p.date_assigned)) {
        completed.push({
          id: mi.id,
          title: mi.title,
          trainerType: mi.trainer_type ?? '',
          completed: true,
          completedDate: comp!.completed_date,
          assignedDate: p.date_assigned,
          shadowedEarly: isShadowedEarly,
          shadowed: isShadowedEarly,
          rating: comp!.trainee_rating ?? undefined,
        })
      } else if (comp && !completedBeforeAssigned) {
        remaining.push({
          id: mi.id,
          title: mi.title,
          trainerType: mi.trainer_type ?? '',
          completed: false,
          assignedDate: p.date_assigned,
          completedOnOtherDate: comp.completed_date,
          shadowed: comp.is_shadowing_moment,
        })
      } else {
        remaining.push({
          id: mi.id,
          title: mi.title,
          trainerType: mi.trainer_type ?? '',
          completed: false,
          assignedDate: p.date_assigned,
        })
      }
    }

    // 2. Completions on this date for items NOT assigned on this date (shadowed or completed on this date)
    const platesOnDateItemIds = new Set(platesOnDate.map(p => p.category_id))

    for (const c of allCompletions) {
      if (c.completed_date !== selectedDate) continue
      if (platesOnDateItemIds.has(c.category_id)) continue
      const mi = c.category

      const assignedPlate = allPlates.find(p => p.category_id === c.category_id && p.trainee_id === userId)
      const assignedDate = assignedPlate?.date_assigned
      const isShadowedEarly = !!(assignedDate && c.completed_date < assignedDate)

      completed.push({
        id: c.category_id,
        title: mi?.title ?? '',
        trainerType: mi?.trainer_type ?? '',
        completed: true,
        shadowed: isShadowedEarly,
        shadowedEarly: isShadowedEarly,
        completedDate: c.completed_date,
        assignedDate,
        rating: c.trainee_rating ?? undefined,
      })
    }

    // 3. Overdue items — only when viewing today
    if (isToday) {
      const todayItemIds = new Set(platesOnDate.map(p => p.category_id))
      const completedItemIds = new Set(completed.map(i => i.id))
      const remainingItemIds = new Set(remaining.map(i => i.id))

      for (const p of allPlates) {
        if (p.date_assigned >= today) continue
        const mi = p.category
        if (!mi) continue
        if (todayItemIds.has(mi.id)) continue
        if (completedItemIds.has(mi.id)) continue
        if (remainingItemIds.has(mi.id)) continue

        const comp = getCompletion(mi.id)
        if (comp) continue // completed — don't show as overdue
        remaining.push({
          id: mi.id,
          title: mi.title,
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
        const plate = allPlates.find(p => p.category_id === item.id)
        const comp = allCompletions.find(c => c.category_id === item.id)
        const cat = plate?.category?.course ?? comp?.category?.course ?? null
        const key = cat?.id ?? 'uncategorised'
        if (!groups[key]) {
          groups[key] = {
            course: cat,
            colour: cat ? COURSE_COLOURS[cat.name] ?? cat.colour_hex : '#C9A96E',
            items: [],
          }
        }
        groups[key].items.push(item)
      }
      return Object.values(groups).sort((a, b) => (a.course?.sort_order ?? 99) - (b.course?.sort_order ?? 99))
    }

    const totalItems = dedupRemaining.length + dedupCompleted.length
    const shadowedCount = dedupCompleted.filter(i => i.shadowed || i.shadowedEarly).length
    const completedCount = dedupCompleted.length - shadowedCount
    const remainingCount = dedupRemaining.length

    return {
      remainingGroups: groupItems(dedupRemaining),
      completedGroups: groupItems(dedupCompleted),
      progress: { completed: completedCount, shadowed: shadowedCount, remaining: remainingCount, total: totalItems },
    }
  }, [allPlates, allCompletions, selectedDate, userId, isToday, today])

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
