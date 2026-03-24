'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDateLong } from '@/lib/dates'
import { DateCalendarPicker } from '@/components/ui/DateCalendarPicker'

interface Props {
  selectedDate: string
  onDateChange: (date: string) => void
  prevDate: string | null
  nextDate: string | null
  availableDates: string[]
  dateBounds: { min: string; max: string } | null
}

export function DateNavigation({ selectedDate, onDateChange, prevDate, nextDate, availableDates, dateBounds }: Props) {
  const [calendarOpen, setCalendarOpen] = useState(false)
  const availableSet = new Set(availableDates)

  return (
    <div className="flex items-center justify-between mb-6">
      <button
        onClick={() => prevDate && onDateChange(prevDate)}
        disabled={!prevDate}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
          prevDate ? 'hover:bg-charcoal/5 text-charcoal/50' : 'text-charcoal/15 cursor-default'
        }`}
      >
        <ChevronLeft size={20} />
      </button>

      <button
        onClick={() => setCalendarOpen(true)}
        className="text-center hover:bg-charcoal/3 px-4 py-1.5 rounded-lg transition-colors"
      >
        <h1 className="font-serif text-2xl text-charcoal">Day Plates</h1>
        <p className="text-sm text-gold font-medium mt-0.5">{formatDateLong(selectedDate)}</p>
      </button>

      <button
        onClick={() => nextDate && onDateChange(nextDate)}
        disabled={!nextDate}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
          nextDate ? 'hover:bg-charcoal/5 text-charcoal/50' : 'text-charcoal/15 cursor-default'
        }`}
      >
        <ChevronRight size={20} />
      </button>

      {calendarOpen && (
        <DateCalendarPicker
          selectedDate={selectedDate}
          onSelect={onDateChange}
          availableDates={availableSet}
          minDate={dateBounds?.min}
          maxDate={dateBounds?.max}
          onClose={() => setCalendarOpen(false)}
        />
      )}
    </div>
  )
}
