'use client'

import { useState } from 'react'
import { DayPicker } from 'react-day-picker'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { parseDate } from '@/lib/dates'

interface Props {
  selectedDate: string
  onSelect: (date: string) => void
  availableDates: Set<string>
  minDate?: string
  maxDate?: string
  onClose: () => void
}

export function DateCalendarPicker({ selectedDate, onSelect, availableDates, minDate, maxDate, onClose }: Props) {
  const selected = parseDate(selectedDate)
  const [month, setMonth] = useState(selected)

  const fromDate = minDate ? parseDate(minDate) : undefined
  const toDate = maxDate ? parseDate(maxDate) : undefined

  function handleSelect(day: Date | undefined) {
    if (!day) return
    const y = day.getFullYear()
    const m = String(day.getMonth() + 1).padStart(2, '0')
    const d = String(day.getDate()).padStart(2, '0')
    const dateStr = `${y}-${m}-${d}`
    if (availableDates.has(dateStr)) {
      onSelect(dateStr)
      onClose()
    }
  }

  function isDisabled(day: Date): boolean {
    const y = day.getFullYear()
    const m = String(day.getMonth() + 1).padStart(2, '0')
    const d = String(day.getDate()).padStart(2, '0')
    return !availableDates.has(`${y}-${m}-${d}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/20" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-4 pb-8 sm:pb-4 w-full sm:w-auto sm:min-w-[320px] max-w-[360px] mx-auto">
        <DayPicker
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          month={month}
          onMonthChange={setMonth}
          fromDate={fromDate}
          toDate={toDate}
          disabled={isDisabled}
          showOutsideDays={false}
          components={{
            Chevron: ({ orientation }) =>
              orientation === 'left'
                ? <ChevronLeft size={16} className="text-charcoal/50" />
                : <ChevronRight size={16} className="text-charcoal/50" />,
          }}
          classNames={{
            root: 'font-sans text-charcoal',
            months: 'flex flex-col',
            month_caption: 'flex justify-center items-center h-10',
            caption_label: 'font-serif text-base text-charcoal',
            nav: 'flex items-center',
            button_previous: 'absolute left-2 top-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-charcoal/5',
            button_next: 'absolute right-2 top-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-charcoal/5',
            month_grid: 'w-full border-collapse',
            weekdays: 'flex',
            weekday: 'w-10 h-8 text-xs text-charcoal/40 font-medium flex items-center justify-center',
            week: 'flex',
            day: 'w-10 h-10 flex items-center justify-center',
            day_button: 'w-9 h-9 flex items-center justify-center rounded-full text-sm transition-colors hover:bg-gold/10',
            selected: '!bg-gold !text-white !font-medium hover:!bg-gold',
            disabled: '!text-charcoal/15 !cursor-default hover:!bg-transparent',
            today: 'font-bold',
            outside: 'text-charcoal/15',
          }}
        />
      </div>
    </div>
  )
}
