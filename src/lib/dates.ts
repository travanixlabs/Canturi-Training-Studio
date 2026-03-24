const TIMEZONE = 'Australia/Sydney'

/** Returns today's date as YYYY-MM-DD in AEDT/AEST */
export function todayAEDT(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE })
}

/** Returns a Date object's date as YYYY-MM-DD in AEDT/AEST */
export function toDateStringAEDT(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
}

/** Parse a YYYY-MM-DD string to a Date (noon to avoid DST edge cases) */
export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

/** Format YYYY-MM-DD as "Tuesday 24 March" */
export function formatDateLong(dateStr: string): string {
  const date = parseDate(dateStr)
  return date.toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: TIMEZONE,
  })
}

/** Format YYYY-MM-DD as "24 March" */
export function formatDateShort(dateStr: string): string {
  const date = parseDate(dateStr)
  return date.toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', timeZone: TIMEZONE,
  })
}
