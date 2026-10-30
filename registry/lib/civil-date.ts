// RemixCN Civil dates: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md

// Days as people write them on a calendar, YYYY-MM-DD, without a time or a
// time zone. Arithmetic counts days in the proleptic Gregorian calendar with
// integers, so no Date parses a string and no host time zone moves a day.
// Only todayIn() reads the clock, in the time zone you name, and the
// formatters hand Intl a UTC midnight that they also format in UTC.

/** A day as YYYY-MM-DD, such as '2026-10-30'. isCivilDate() and parseCivilDate() check that it exists. */
export type CivilDate = `${number}-${number}-${number}`

/** A day of the week: 0 is Sunday, 1 is Monday, through 6, Saturday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface DateParts {
  year: number
  /** 1 to 12. */
  month: number
  /** 1 to the last day of the month. */
  day: number
}

/** The first day these functions can write, and where arithmetic stops. */
export const minCivilDate: CivilDate = '0001-01-01'
/** The last day these functions can write, and where arithmetic stops. */
export const maxCivilDate: CivilDate = '9999-12-31'

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

const monthLengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/** The number of days in a month, 1 to 12, of a year. */
export function daysInMonth(year: number, month: number): number {
  return month === 2 && isLeapYear(year) ? 29 : monthLengths[month - 1]
}

const pattern = /^(\d{4})-(\d{2})-(\d{2})$/

function isRealDay({ year, month, day }: DateParts) {
  return (
    [year, month, day].every(Number.isInteger) &&
    year >= 1 &&
    year <= 9999 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month)
  )
}

/** Whether the value is a day that exists, written as YYYY-MM-DD with a year from 0001 to 9999. */
export function isCivilDate(value: unknown): value is CivilDate {
  if (typeof value !== 'string') return false
  let match = pattern.exec(value)
  return match !== null && isRealDay({ year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) })
}

/**
 * Reads a day someone typed: ISO 8601's YYYY-MM-DD, with spaces around it
 * allowed. Anything else is `undefined`, also numeric dates such as 03/04/2026
 * that mean different days in different locales, so no day is guessed.
 */
export function parseCivilDate(text: string): CivilDate | undefined {
  let trimmed = text.trim()
  return isCivilDate(trimmed) ? trimmed : undefined
}

const pad = (value: number, length: number) => String(value).padStart(length, '0')

/** Writes a day from its parts. Throws a RangeError for a day that doesn't exist. */
export function toCivilDate(parts: DateParts): CivilDate {
  if (!isRealDay(parts)) throw new RangeError(`Not a day: ${parts.year}-${parts.month}-${parts.day}`)
  return `${pad(parts.year, 4)}-${pad(parts.month, 2)}-${pad(parts.day, 2)}` as CivilDate
}

/** The year, month and day of a day. */
export function dateParts(date: CivilDate): DateParts {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)), day: Number(date.slice(8, 10)) }
}

// Days since 1970-01-01, and back, by Howard Hinnant's algorithms
// (https://howardhinnant.github.io/date_algorithms.html), which count
// 400-year eras so leap rules need no table.
function toDayNumber({ year, month, day }: DateParts): number {
  let y = month <= 2 ? year - 1 : year
  let era = Math.floor(y / 400)
  let yearOfEra = y - era * 400
  let dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1
  let dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear
  return era * 146097 + dayOfEra - 719468
}

function fromDayNumber(dayNumber: number): DateParts {
  let z = dayNumber + 719468
  let era = Math.floor(z / 146097)
  let dayOfEra = z - era * 146097
  let yearOfEra = Math.floor(
    (dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36524) - Math.floor(dayOfEra / 146096)) / 365,
  )
  let dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100))
  let shiftedMonth = Math.floor((5 * dayOfYear + 2) / 153)
  let day = dayOfYear - Math.floor((153 * shiftedMonth + 2) / 5) + 1
  let month = shiftedMonth < 10 ? shiftedMonth + 3 : shiftedMonth - 9
  return { year: yearOfEra + era * 400 + (month <= 2 ? 1 : 0), month, day }
}

const firstDayNumber = toDayNumber(dateParts(minCivilDate))
const lastDayNumber = toDayNumber(dateParts(maxCivilDate))

function fromClampedDayNumber(dayNumber: number): CivilDate {
  return toCivilDate(fromDayNumber(Math.min(Math.max(dayNumber, firstDayNumber), lastDayNumber)))
}

/** The day `days` later, or earlier for a negative number. */
export function addDays(date: CivilDate, days: number): CivilDate {
  return fromClampedDayNumber(toDayNumber(dateParts(date)) + Math.trunc(days))
}

/** The same day `months` later or earlier, or that month's last day when it is shorter: January 31 plus a month is February 28 or 29. */
export function addMonths(date: CivilDate, months: number): CivilDate {
  let { year, month, day } = dateParts(date)
  let index = year * 12 + (month - 1) + Math.trunc(months)
  let nextYear = Math.floor(index / 12)
  let nextMonth = index - nextYear * 12 + 1
  if (nextYear < 1) return minCivilDate
  if (nextYear > 9999) return maxCivilDate
  return toCivilDate({ year: nextYear, month: nextMonth, day: Math.min(day, daysInMonth(nextYear, nextMonth)) })
}

/** The same day `years` later or earlier; February 29 becomes February 28 outside leap years. */
export function addYears(date: CivilDate, years: number): CivilDate {
  return addMonths(date, Math.trunc(years) * 12)
}

/** -1 when `a` comes before `b`, 1 when after, and 0 for the same day. */
export function compareDates(a: CivilDate, b: CivilDate): -1 | 0 | 1 {
  // YYYY-MM-DD sorts as text.
  return a < b ? -1 : a > b ? 1 : 0
}

/** The number of days from `from` to `to`: negative when `to` comes first. */
export function daysBetween(from: CivilDate, to: CivilDate): number {
  return toDayNumber(dateParts(to)) - toDayNumber(dateParts(from))
}

/** The day, moved into the days from `min` to `max`. Either bound may be left out. */
export function clampDate(date: CivilDate, min?: CivilDate, max?: CivilDate): CivilDate {
  if (min && date < min) return min
  if (max && date > max) return max
  return date
}

/** The day of the week, from 0 for Sunday to 6 for Saturday. */
export function dayOfWeek(date: CivilDate): Weekday {
  // 1970-01-01 was a Thursday.
  return ((((toDayNumber(dateParts(date)) + 4) % 7) + 7) % 7) as Weekday
}

export function startOfMonth(date: CivilDate): CivilDate {
  return `${date.slice(0, 8)}01` as CivilDate
}

export function endOfMonth(date: CivilDate): CivilDate {
  let { year, month } = dateParts(date)
  return toCivilDate({ year, month, day: daysInMonth(year, month) })
}

/** The first day of the day's week, for weeks that start on `weekStartsOn`. */
export function startOfWeek(date: CivilDate, weekStartsOn: Weekday): CivilDate {
  return addDays(date, -((dayOfWeek(date) - weekStartsOn + 7) % 7))
}

/** The last day of the day's week, for weeks that start on `weekStartsOn`. */
export function endOfWeek(date: CivilDate, weekStartsOn: Weekday): CivilDate {
  return addDays(startOfWeek(date, weekStartsOn), 6)
}

export interface WeekNumbering {
  weekStartsOn: Weekday
  /**
   * The day of January that is always in week 1: 4 for ISO 8601 weeks, which
   * belong to the year of their Thursday, and 1 where the week holding
   * January 1 is week 1, as in the United States.
   */
  firstWeekContainsDate: 1 | 2 | 3 | 4 | 5 | 6 | 7
}

/** The number of the day's week in its week-numbering year, from 1 to 53. */
export function weekNumber(date: CivilDate, { weekStartsOn, firstWeekContainsDate }: WeekNumbering): number {
  // A week belongs to the year that holds its day number 8 - firstWeekContainsDate.
  let offset = 7 - firstWeekContainsDate
  let anchor = addDays(startOfWeek(date, weekStartsOn), offset)
  let januaryFirst = toCivilDate({ year: dateParts(anchor).year, month: 1, day: 1 })
  let anchorWeekday = (weekStartsOn + offset) % 7
  let firstAnchor = addDays(januaryFirst, (anchorWeekday - dayOfWeek(januaryFirst) + 7) % 7)
  return Math.floor(daysBetween(firstAnchor, anchor) / 7) + 1
}

interface WeekInfo {
  firstDay: number
}

interface LocaleWithWeekInfo extends Intl.Locale {
  getWeekInfo?(): WeekInfo
  weekInfo?: WeekInfo
}

/**
 * The day a week starts on in the locale, from Intl: Sunday in en-US, Monday
 * in de-CH, Saturday in fa-IR. Monday, as in ISO 8601, when the locale is
 * invalid or the engine can't tell.
 */
export function weekStartOf(locale: string): Weekday {
  try {
    let info = new Intl.Locale(locale) as LocaleWithWeekInfo
    let firstDay = (info.getWeekInfo?.() ?? info.weekInfo)?.firstDay
    // Intl counts 1 for Monday to 7 for Sunday.
    if (firstDay !== undefined && firstDay >= 1 && firstDay <= 7) return (firstDay % 7) as Weekday
  } catch {}
  return 1
}

/**
 * Today, in a time zone such as 'Europe/Zurich', or in the host's when you
 * leave it out. A server renders the user's today only when it knows their
 * time zone, so pass the day it worked out to the calendar.
 */
export function todayIn(timeZone?: string, now: Date = new Date()): CivilDate {
  let parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    calendar: 'gregory',
    numberingSystem: 'latn',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now)
  let part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((entry) => entry.type === type)?.value)
  return toCivilDate({ year: part('year'), month: part('month'), day: part('day') })
}

/** Midnight UTC at the start of the day, for APIs that take a Date. Format it in UTC too. */
export function toUTCDate(date: CivilDate): Date {
  let { year, month, day } = dateParts(date)
  let utc = new Date(0)
  // setUTCFullYear keeps years 1 to 99, which Date.UTC() moves to the 1900s.
  utc.setUTCFullYear(year, month - 1, day)
  return utc
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function getFormatter(locale: string, options: Intl.DateTimeFormatOptions) {
  let key = JSON.stringify([locale, options])
  let formatter = formatters.get(key)
  if (!formatter) {
    // The grid is Gregorian, so the labels are too, whatever calendar the locale prefers.
    formatter = new Intl.DateTimeFormat(locale, { ...options, calendar: 'gregory', timeZone: 'UTC' })
    formatters.set(key, formatter)
  }
  return formatter
}

// Engines disagree about spaces: Node's ICU puts thin spaces around a range's
// dash where browsers put plain ones. A server render must match hydration,
// so thin and narrow no-break spaces become plain spaces.
const odd = /[\u2009\u202f]/g
const plainSpaces = (text: string) => text.replace(odd, ' ')

/** Formats a day for people in the locale, such as { dateStyle: 'long' } for "October 30, 2026". */
export function formatCivilDate(date: CivilDate, locale: string, options: Intl.DateTimeFormatOptions): string {
  return plainSpaces(getFormatter(locale, options).format(toUTCDate(date)))
}

/** Formats the days from `from` to `to` the way the locale writes a range, such as "Jan 20 – Feb 9, 2026". */
export function formatCivilDateRange(
  from: CivilDate,
  to: CivilDate,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return plainSpaces(getFormatter(locale, options).formatRange(toUTCDate(from), toUTCDate(to)))
}
