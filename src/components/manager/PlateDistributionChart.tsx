'use client'

import { useMemo, useState, useCallback } from 'react'
import { CATEGORY_COLOURS } from '@/types'
import { todayAEDT, toDateStringAEDT } from '@/lib/dates'
import type { Plate, Category, MenuItem, Workshop, WorkshopMenuItem } from '@/types'

interface Props {
  plates: Plate[]
  categories: Category[]
  menuItems: MenuItem[]
  workshops: Workshop[]
  workshopMenuItems: WorkshopMenuItem[]
  traineeId: string
  onFilterChange?: (filter: { dates: Set<string>; courseIds: Set<string> }) => void
}

export function PlateDistributionChart({
  plates,
  categories,
  menuItems,
  workshops,
  workshopMenuItems,
  traineeId,
  onFilterChange,
}: Props) {
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set())
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set())

  // Build 14 dates: past 7 days + today + next 6 days
  const chartDates = useMemo(() => {
    const dates: string[] = []
    const now = new Date()
    for (let i = -7; i <= 6; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() + i)
      dates.push(toDateStringAEDT(d))
    }
    return dates
  }, [])

  const todayStr = todayAEDT()

  // Get all menu item -> category mapping
  const itemToCategoryId = useMemo(() => {
    const map = new Map<string, string>()
    for (const mi of menuItems) map.set(mi.id, mi.category_id)
    return map
  }, [menuItems])

  // Get trainee plates
  const traineePlates = useMemo(() =>
    plates.filter(p => p.trainee_id === traineeId),
    [plates, traineeId]
  )

  // Get active courses (categories that have items in any workshop)
  const activeCourses = useMemo(() => {
    const wsItemIds = new Set(workshopMenuItems.map(wmi => wmi.menu_item_id))
    const courseIds = new Set<string>()
    for (const mi of menuItems) {
      if (wsItemIds.has(mi.id)) courseIds.add(mi.category_id)
    }
    return categories
      .filter(c => courseIds.has(c.id))
      .sort((a, b) => a.sort_order - b.sort_order)
  }, [categories, menuItems, workshopMenuItems])

  // Build chart data: for each date, count items per course
  const chartData = useMemo(() => {
    return chartDates.map(date => {
      const datePlates = traineePlates.filter(p => p.date_assigned === date)
      const courseCounts: Record<string, number> = {}
      let total = 0

      for (const p of datePlates) {
        const catId = itemToCategoryId.get(p.menu_item_id)
        if (catId) {
          courseCounts[catId] = (courseCounts[catId] ?? 0) + 1
          total++
        }
      }

      return { date, courseCounts, total }
    })
  }, [chartDates, traineePlates, itemToCategoryId])

  const maxItems = Math.max(...chartData.map(d => d.total), 1)

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    if (dateStr === todayStr) return 'Today'
    return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric' })
  }

  const handleDateClick = useCallback((date: string, e: React.MouseEvent) => {
    setSelectedDates(prev => {
      const next = new Set(e.ctrlKey || e.metaKey ? prev : new Set<string>())
      if (prev.has(date) && !e.ctrlKey && !e.metaKey) {
        next.delete(date)
      } else if (prev.has(date)) {
        next.delete(date)
      } else {
        next.add(date)
      }
      // Notify parent
      setTimeout(() => onFilterChange?.({ dates: next, courseIds: selectedCourses }), 0)
      return next
    })
  }, [selectedCourses, onFilterChange])

  const handleCourseClick = useCallback((courseId: string, e: React.MouseEvent) => {
    setSelectedCourses(prev => {
      const next = new Set(e.ctrlKey || e.metaKey ? prev : new Set<string>())
      if (prev.has(courseId) && !e.ctrlKey && !e.metaKey) {
        next.delete(courseId)
      } else if (prev.has(courseId)) {
        next.delete(courseId)
      } else {
        next.add(courseId)
      }
      setTimeout(() => onFilterChange?.({ dates: selectedDates, courseIds: next }), 0)
      return next
    })
  }, [selectedDates, onFilterChange])

  const hasDateFilter = selectedDates.size > 0
  const hasCourseFilter = selectedCourses.size > 0

  return (
    <div>
      {/* Chart */}
      <div className="flex items-end gap-1.5" style={{ height: 120 }}>
        {chartData.map(({ date, courseCounts, total }) => {
          const isSelected = selectedDates.has(date)
          const isGreyed = hasDateFilter && !isSelected
          const isToday = date === todayStr

          return (
            <div
              key={date}
              className="flex-1 flex flex-col items-center cursor-pointer group"
              onClick={(e) => handleDateClick(date, e)}
            >
              {/* Stacked bar */}
              <div
                className={`w-full rounded-t-sm overflow-hidden flex flex-col-reverse transition-opacity ${
                  isGreyed ? 'opacity-20' : ''
                } ${isSelected ? 'ring-2 ring-gold ring-offset-1' : ''}`}
                style={{ height: total > 0 ? Math.max((total / maxItems) * 100, 8) : 4 }}
              >
                {total > 0 ? (
                  activeCourses.map(course => {
                    const count = courseCounts[course.id] ?? 0
                    if (count === 0) return null
                    const pct = (count / total) * 100
                    const colour = CATEGORY_COLOURS[course.name] ?? course.colour_hex
                    const isCourseGreyed = hasCourseFilter && !selectedCourses.has(course.id)

                    return (
                      <div
                        key={course.id}
                        style={{
                          height: `${pct}%`,
                          backgroundColor: colour,
                          opacity: isCourseGreyed ? 0.15 : 1,
                        }}
                        className="w-full transition-opacity"
                      />
                    )
                  })
                ) : (
                  <div className="w-full h-full bg-charcoal/5 rounded-sm" />
                )}
              </div>

              {/* Date label */}
              <p className={`text-[9px] mt-1 text-center leading-tight ${
                isToday ? 'font-bold text-gold' : isSelected ? 'font-semibold text-charcoal' : 'text-charcoal/40'
              }`}>
                {formatDateLabel(date)}
              </p>

              {/* Item count */}
              {total > 0 && (
                <p className={`text-[8px] ${isSelected ? 'text-charcoal/60' : 'text-charcoal/25'}`}>
                  {total}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-3">
        {activeCourses.map(course => {
          const colour = CATEGORY_COLOURS[course.name] ?? course.colour_hex
          const isSelected = selectedCourses.has(course.id)
          const isGreyed = hasCourseFilter && !isSelected

          return (
            <button
              key={course.id}
              onClick={(e) => handleCourseClick(course.id, e)}
              className={`flex items-center gap-1.5 text-[10px] transition-opacity ${
                isGreyed ? 'opacity-30' : ''
              } ${isSelected ? 'font-semibold' : 'text-charcoal/60'}`}
            >
              <span
                className={`w-2 h-2 rounded-sm flex-shrink-0 ${isSelected ? 'ring-1 ring-offset-1' : ''}`}
                style={{ backgroundColor: colour }}
              />
              {course.name}
            </button>
          )
        })}
      </div>

      {/* Active filters indicator */}
      {(hasDateFilter || hasCourseFilter) && (
        <button
          onClick={() => {
            setSelectedDates(new Set())
            setSelectedCourses(new Set())
            onFilterChange?.({ dates: new Set(), courseIds: new Set() })
          }}
          className="mt-2 text-[10px] text-gold hover:text-gold/80 transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
