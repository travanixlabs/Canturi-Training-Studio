const TIMEZONE = 'Australia/Sydney'

/** Returns today's date as YYYY-MM-DD in AEDT/AEST */
export function todayAEDT(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE })
}

/** Returns a Date object's date as YYYY-MM-DD in AEDT/AEST */
export function toDateStringAEDT(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
}
