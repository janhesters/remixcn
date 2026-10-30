// RemixCN Calendar: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css, on, ref } from 'remix/component'
import type { Handle, MixValue, Props, RemixNode } from 'remix/component'

import {
  addDays,
  addMonths,
  addYears,
  clampDate,
  dateParts,
  dayOfWeek,
  daysBetween,
  endOfMonth,
  endOfWeek,
  formatCivilDate,
  isCivilDate,
  startOfMonth,
  startOfWeek,
  todayIn,
  toCivilDate,
  weekNumber,
  weekStartOf,
} from '#remixcn/lib/civil-date.ts'
import type { CivilDate, Weekday } from '#remixcn/lib/civil-date.ts'
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from '#remixcn/lib/icons.tsx'
import { disabledState, mergeStyles, transition } from '#remixcn/lib/styles.ts'
import type { Styles } from '#remixcn/lib/styles.ts'
import { buttonVariants } from '#remixcn/ui/button.tsx'
import type { ButtonVariant } from '#remixcn/ui/button.tsx'

// A month grid of days to pick one day, several, or a range from. It counts
// days as YYYY-MM-DD civil dates, so no time zone moves a day, and takes its
// labels, weekday order and digits from Intl in the locale you pass. The
// server renders the same grid the browser does, as long as both get the
// same locale and today.
//
// The days are buttons in an ARIA grid with one tab stop: arrow keys move a
// day or a week, Home and End to the start or end of the week, Page Up and
// Page Down a month, with Shift a year, and focus follows into the next
// month. A name puts the value in hidden inputs, which a form submits and a
// form reset returns to the default. The calendar runs in the browser inside
// your client entry, like Button, so it takes your functions and mixins.
// Without JavaScript it shows its months and submits its default value, and
// its buttons look disabled.

export type CalendarMode = 'single' | 'multiple' | 'range'

/** A range of days from `from` to `to`, both included. `to` is missing while the range is being picked. */
export interface DateRange {
  from: CivilDate
  to?: CivilDate
}

/**
 * Days to match: a day, a list, an interval with both ends included, the
 * days before or after a day, weekdays, a function, `true` for every day, or
 * a list of any of them.
 */
export type CalendarMatcher =
  | boolean
  | CivilDate
  | { from: CivilDate; to: CivilDate }
  | { before: CivilDate }
  | { after: CivilDate }
  | { dayOfWeek: readonly Weekday[] }
  | ((date: CivilDate) => boolean)
  | readonly CalendarMatcher[]

/** Whether the day matches the matcher. */
export function matchesDate(date: CivilDate, matcher: CalendarMatcher | undefined): boolean {
  if (matcher === undefined || matcher === false) return false
  if (matcher === true) return true
  if (typeof matcher === 'string') return matcher === date
  if (typeof matcher === 'function') return matcher(date)
  if (Array.isArray(matcher)) return matcher.some((entry) => matchesDate(date, entry))
  let found = false
  if ('from' in matcher && 'to' in matcher) {
    let [from, to] = matcher.from <= matcher.to ? [matcher.from, matcher.to] : [matcher.to, matcher.from]
    found ||= date >= from && date <= to
  }
  if ('before' in matcher) found ||= date < matcher.before
  if ('after' in matcher) found ||= date > matcher.after
  if ('dayOfWeek' in matcher) found ||= matcher.dayOfWeek.includes(dayOfWeek(date))
  return found
}

export interface RangeOptions {
  /** Whether the range can't become empty again. */
  required?: boolean
  /** The fewest days a range spans, both ends included. A shorter range starts over at the pressed day. */
  minDays?: number
  /** The most days a range spans, both ends included. A longer range starts over at the pressed day. */
  maxDays?: number
}

/**
 * The range after a press on `date`, as react-day-picker picks it: the first
 * press starts a range of one day, or an open one when `minDays` asks for
 * more; a later day ends it; an earlier day moves its start; a press on its
 * start or end moves the other end there; and a press on a range of one day
 * clears it, unless it's required.
 */
export function addToRange(date: CivilDate, range: DateRange | null | undefined, options: RangeOptions = {}) {
  let { required = false, minDays = 0, maxDays = 0 } = options
  let from = range?.from
  let to = range?.to
  let open = minDays > 1
  let next: DateRange | null

  if (!from) {
    next = open ? { from: date } : { from: date, to: date }
  } else if (!to) {
    if (date === from) next = open ? (required ? { from } : null) : { from, to: date }
    else if (date < from) next = { from: date, to: from }
    else next = { from, to: date }
  } else if (date === from && date === to) {
    next = required ? { from, to } : null
  } else if (date === from) {
    next = open ? { from: date } : { from: date, to: date }
  } else if (date === to) {
    next = open ? { from: date } : { from: date, to: date }
  } else if (date < from) {
    next = { from: date, to }
  } else {
    next = { from, to: date }
  }

  if (next?.to) {
    let days = daysBetween(next.from, next.to) + 1
    if ((maxDays > 0 && days > maxDays) || (minDays > 1 && days < minDays)) next = { from: date }
  }
  return next
}

/** What a day is: its date, the month whose grid shows it, and its states. */
export interface CalendarDay {
  date: CivilDate
  /** The first day of the month whose grid shows this cell. */
  month: CivilDate
  /** Whether the day belongs to the month before or after the grid's own. */
  outside: boolean
  today: boolean
  selected: boolean
  disabled: boolean
  hidden: boolean
  rangeStart: boolean
  rangeEnd: boolean
  rangeMiddle: boolean
  /** The names of the custom modifiers the day matches. */
  modifiers: string[]
}

export type CalendarCaptionLayout = 'label' | 'dropdown' | 'dropdown-months' | 'dropdown-years'

/** The text the calendar adds for assistive technology. Pass translations with `labels`. */
export interface CalendarLabels {
  previousMonth: string
  nextMonth: string
  /** The month dropdown's name. */
  month: string
  /** The year dropdown's name. */
  year: string
  /** The name of the week number column. */
  weekNumberHeader: string
  /** The name of a week number cell, such as "Week 44". */
  weekNumber: (week: number) => string
}

/** How the calendar writes dates. Each gets the locale and returns text. */
export interface CalendarFormatters {
  /** The month above a grid, "October 2026" by default. It also names the grid. */
  caption: (month: CivilDate, locale: string) => string
  /** A month in the month dropdown, "Oct" by default. */
  monthDropdown: (month: CivilDate, locale: string) => string
  /** A year in the year dropdown, "2026" by default. */
  yearDropdown: (year: CivilDate, locale: string) => string
  /** A weekday heading: "Fri" by default, or the narrow form where the short one is a word, such as in Arabic. */
  weekday: (date: CivilDate, locale: string) => string
  /** The number on a day, "30" by default, in the locale's digits. */
  day: (date: CivilDate, locale: string) => string
  /** The name of a day's button, "Friday, October 30, 2026" by default. */
  dayLabel: (day: CalendarDay, locale: string) => string
  /** A week number, in the locale's digits. */
  weekNumber: (week: number, locale: string) => string
}

/** Why the value changed: a press on a day, by pointer or keyboard, or a form reset. */
export type CalendarChangeReason = 'day-press' | 'reset'

export interface CalendarChangeDetails {
  /** The day pressed, or `undefined` for a reset. */
  date: CivilDate | undefined
  reason: CalendarChangeReason
}

interface CalendarCommonProps extends Omit<Props<'div'>, 'children' | 'dir' | 'hidden' | 'defaultValue'> {
  /** The BCP 47 locale of the labels, weekday order and digits, such as 'de-CH'. Defaults to 'en-US' on the server and in the browser alike. */
  locale?: string
  /** The text direction. It mirrors the layout and the left and right arrow keys. Inherited when left out. */
  dir?: 'ltr' | 'rtl'
  /**
   * Today, which the calendar marks and opens on. Pass the day the server
   * worked out for the user, such as todayIn(userTimeZone), so the server
   * HTML and the browser agree. Defaults to today in `timeZone`.
   */
  today?: CivilDate
  /** The time zone today is in when you don't pass `today`, such as 'Europe/Zurich'. Defaults to the host's. */
  timeZone?: string
  /** Any day of the first month shown, for a calendar whose month you control. Update it from `onMonthChange`. */
  month?: CivilDate
  /** Any day of the first month shown at first. Defaults to the first selected day's month, else today's. */
  defaultMonth?: CivilDate
  /** Called with the first day of the new first month when the shown months change. */
  onMonthChange?: (month: CivilDate) => void
  /** How many months show side by side (defaults to 1). */
  numberOfMonths?: number
  /** Whether next and previous move by all the shown months instead of one. */
  pagedNavigation?: boolean
  /** Whether the months show from the latest to the earliest. */
  reverseMonths?: boolean
  /** Any day of the earliest month to navigate to. Defaults to `min`'s month, or 100 years back with a year dropdown. */
  startMonth?: CivilDate
  /** Any day of the latest month to navigate to. Defaults to `max`'s month, or the end of this year with a year dropdown. */
  endMonth?: CivilDate
  /** The earliest day that can be picked. */
  min?: CivilDate
  /** The latest day that can be picked. */
  max?: CivilDate
  /** Days that can't be picked, or `true` to disable the whole calendar and its form value. */
  disabled?: CalendarMatcher
  /** Days that don't show at all. */
  hidden?: CalendarMatcher
  /** Custom states by name, such as { booked: [...] }. Each matching day gets a data-<name> attribute. */
  modifiers?: Record<string, CalendarMatcher>
  /** Mixins for the day buttons of each custom modifier, such as { booked: css({ textDecoration: 'line-through' }) }. */
  modifierStyles?: Record<string, MixValue>
  /** Whether the days of the months before and after fill the first and last weeks (defaults to `true`). */
  showOutsideDays?: boolean
  /** Whether every month shows six weeks, so its height doesn't change. */
  fixedWeeks?: boolean
  /** Whether a column numbers the weeks. */
  showWeekNumber?: boolean
  /** Whether the weekday headings are left out. */
  hideWeekdays?: boolean
  /** The first day of the week, 0 for Sunday to 6 for Saturday. Defaults to the locale's, from Intl. */
  weekStartsOn?: Weekday
  /** The day of January that is always in week 1: 4 for ISO weeks. Defaults to 4 when weeks start on Monday, else 1. */
  firstWeekContainsDate?: 1 | 2 | 3 | 4 | 5 | 6 | 7
  /** Whether weeks start on Monday and are numbered as in ISO 8601, whatever the locale. */
  ISOWeek?: boolean
  /** A label above each month, or dropdowns to choose its month, year or both. */
  captionLayout?: CalendarCaptionLayout
  /** Whether the previous and next buttons are left out. */
  hideNavigation?: boolean
  /** Whether the shown months stay put, also for the keyboard. */
  disableNavigation?: boolean
  /** The Button variant of the previous and next buttons (defaults to `'ghost'`). */
  buttonVariant?: ButtonVariant
  /** Translations of the labels the calendar adds. */
  labels?: Partial<CalendarLabels>
  /** How dates are written. */
  formatters?: Partial<CalendarFormatters>
  /** What a day's button shows. Defaults to its number. Its name stays the full date. */
  renderDay?: (day: CalendarDay) => RemixNode
  /** Text below the months, in a polite live region, such as the picked day. */
  footer?: RemixNode
  /** The form field name. A form submits the value under it: see the docs for each mode. */
  name?: string
  /** The id of the form the value belongs to, when the calendar sits outside it. */
  form?: string
  /** Whether the selection can't become empty again once there is one. */
  required?: boolean
}

export interface CalendarSingleProps extends CalendarCommonProps {
  /** One day (the default). */
  mode?: 'single'
  /** The picked day, for a calendar you control: `null` for none. Update it from `onValueChange`. */
  value?: CivilDate | null
  /** The day picked at first, and again after a form reset. */
  defaultValue?: CivilDate | null
  onValueChange?: (value: CivilDate | null, details: CalendarChangeDetails) => void
}

export interface CalendarMultipleProps extends CalendarCommonProps {
  /** Any number of days. */
  mode: 'multiple'
  /** The picked days, for a calendar you control. Update them from `onValueChange`. */
  value?: readonly CivilDate[]
  /** The days picked at first, and again after a form reset. */
  defaultValue?: readonly CivilDate[]
  onValueChange?: (value: CivilDate[], details: CalendarChangeDetails) => void
  /** The fewest days that stay picked: a press won't unpick below it. */
  minSelected?: number
  /** The most days that can be picked. Once reached, the other days are disabled. */
  maxSelected?: number
}

export interface CalendarRangeProps extends CalendarCommonProps {
  /** A range of days. */
  mode: 'range'
  /** The picked range, for a calendar you control: `null` for none. Update it from `onValueChange`. */
  value?: DateRange | null
  /** The range picked at first, and again after a form reset. */
  defaultValue?: DateRange | null
  onValueChange?: (value: DateRange | null, details: CalendarChangeDetails) => void
  /** The fewest days a range spans, both ends included. */
  minDays?: number
  /** The most days a range spans, both ends included. */
  maxDays?: number
  /** Whether a range that would hold a disabled day starts over at the pressed day instead. */
  excludeDisabled?: boolean
}

export type CalendarProps = CalendarSingleProps | CalendarMultipleProps | CalendarRangeProps

type CalendarValue = CivilDate | null | CivilDate[] | DateRange

// Every mode's props in one shape, for reading them without narrowing.
type AnyCalendarProps = CalendarCommonProps & {
  mode?: CalendarMode
  value?: unknown
  defaultValue?: unknown
  onValueChange?: (value: never, details: CalendarChangeDetails) => void
  minSelected?: number
  maxSelected?: number
  minDays?: number
  maxDays?: number
  excludeDisabled?: boolean
}

const defaultLabels: CalendarLabels = {
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  month: 'Month',
  year: 'Year',
  weekNumberHeader: 'Week',
  weekNumber: (week) => `Week ${week}`,
}

const numberFormats = new Map<string, Intl.NumberFormat>()

const weekdayWidths = new Map<string, 'short' | 'narrow'>()

// A column is one cell wide. The short names fit in most locales, such as
// "Mon" or "Mo", but are whole words in others, such as Arabic, Hebrew and
// Persian, which then get the narrow ones. Intl decides on the server and
// in the browser alike.
function weekdayWidth(locale: string) {
  let width = weekdayWidths.get(locale)
  if (!width) {
    let names = Array.from({ length: 7 }, (_, index) =>
      formatCivilDate(addDays('2026-01-04', index), locale, { weekday: 'short' }),
    )
    width = names.every((name) => [...name].length <= 4) ? 'short' : 'narrow'
    weekdayWidths.set(locale, width)
  }
  return width
}

const defaultFormatters: CalendarFormatters = {
  caption: (month, locale) => formatCivilDate(month, locale, { month: 'long', year: 'numeric' }),
  monthDropdown: (month, locale) => formatCivilDate(month, locale, { month: 'short' }),
  yearDropdown: (year, locale) => formatCivilDate(year, locale, { year: 'numeric' }),
  weekday: (date, locale) => formatCivilDate(date, locale, { weekday: weekdayWidth(locale) }),
  day: (date, locale) => formatCivilDate(date, locale, { day: 'numeric' }),
  dayLabel: (day, locale) => formatCivilDate(day.date, locale, { dateStyle: 'full' }),
  weekNumber: (week, locale) => {
    let format = numberFormats.get(locale)
    if (!format) numberFormats.set(locale, (format = new Intl.NumberFormat(locale)))
    return format.format(week)
  },
}

// A locale Intl refuses, such as a raw Accept-Language header, would throw
// while rendering, so the calendar falls back to en-US.
function validLocale(locale: string | undefined) {
  if (!locale) return 'en-US'
  try {
    return new Intl.Locale(locale).toString()
  } catch {
    return 'en-US'
  }
}

function validDate(value: unknown): CivilDate | undefined {
  return isCivilDate(value) ? value : undefined
}

// The days a value of any mode holds: one day, a list, or a range's ends.
function datesOf(value: unknown): CivilDate[] {
  if (isCivilDate(value)) return [value]
  if (Array.isArray(value)) return value.filter(isCivilDate)
  if (typeof value === 'object' && value !== null) {
    let { from, to } = value as Partial<DateRange>
    return [from, to].filter(isCivilDate)
  }
  return []
}

/**
 * The value in the shape of `mode`, from a value of any mode, so a calendar
 * whose mode changes keeps its days: a single day becomes a list of one or a
 * one-day range, a list keeps its first day or spans its days as a range,
 * and a range keeps its start or lists its ends. A range with one end stays
 * open. Days that don't exist are dropped.
 */
function normalizeValue(mode: CalendarMode, value: unknown): CalendarValue {
  let dates = [...new Set(datesOf(value))].sort()
  if (mode === 'multiple') return dates
  if (mode === 'single') return dates[0] ?? null
  if (dates.length === 0) return null
  // Only a range with one end stays open, being picked.
  let range = typeof value === 'object' && value !== null && !Array.isArray(value)
  if (range && datesOf(value).length === 1) return { from: dates[0] }
  return { from: dates[0], to: dates[dates.length - 1] }
}

function sameValue(a: CalendarValue, b: CalendarValue) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function firstSelected(value: CalendarValue): CivilDate | undefined {
  if (value === null) return undefined
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value[0]
  return value.from
}

/** The weeks of a month's grid, each a list of seven days, from its first week to its last, or six weeks. */
function monthWeeks(month: CivilDate, weekStartsOn: Weekday, fixedWeeks: boolean): CivilDate[][] {
  let first = startOfWeek(month, weekStartsOn)
  let last = endOfWeek(endOfMonth(month), weekStartsOn)
  let count = fixedWeeks ? 6 : (daysBetween(first, last) + 1) / 7
  return Array.from({ length: count }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => addDays(first, week * 7 + day)),
  )
}

type Move = { by: 'day' | 'week' | 'month' | 'year'; step: 1 | -1 } | { by: 'week-start' | 'week-end'; step: 1 | -1 }

function moveFor(event: KeyboardEvent, rtl: boolean): Move | undefined {
  let forward = rtl ? 'ArrowLeft' : 'ArrowRight'
  let backward = rtl ? 'ArrowRight' : 'ArrowLeft'
  if (event.altKey || event.ctrlKey || event.metaKey) return undefined
  switch (event.key) {
    case forward:
      return { by: 'day', step: 1 }
    case backward:
      return { by: 'day', step: -1 }
    case 'ArrowDown':
      return { by: 'week', step: 1 }
    case 'ArrowUp':
      return { by: 'week', step: -1 }
    case 'Home':
      return { by: 'week-start', step: 1 }
    case 'End':
      return { by: 'week-end', step: -1 }
    case 'PageDown':
      return { by: event.shiftKey ? 'year' : 'month', step: 1 }
    case 'PageUp':
      return { by: event.shiftKey ? 'year' : 'month', step: -1 }
  }
  return undefined
}

function applyMove(date: CivilDate, move: Move, weekStartsOn: Weekday): CivilDate {
  switch (move.by) {
    case 'day':
      return addDays(date, move.step)
    case 'week':
      return addDays(date, move.step * 7)
    case 'month':
      return addMonths(date, move.step)
    case 'year':
      return addYears(date, move.step)
    case 'week-start':
      return startOfWeek(date, weekStartsOn)
    case 'week-end':
      return endOfWeek(date, weekStartsOn)
  }
}

/**
 * The day a key moves focus to, skipping days that can't take it, or
 * `undefined` when there is none before the bounds. Home and End look for
 * the nearest available day inside the week.
 */
function nextFocusDate(
  from: CivilDate,
  move: Move,
  weekStartsOn: Weekday,
  bounds: { start?: CivilDate; end?: CivilDate },
  unavailable: (date: CivilDate) => boolean,
): CivilDate | undefined {
  let candidate = clampDate(applyMove(from, move, weekStartsOn), bounds.start, bounds.end)
  // Home and End land on the week's edge, then walk back toward the day.
  let walk: Move = move.by === 'week-start' || move.by === 'week-end' ? { by: 'day', step: move.step } : move
  for (let attempt = 0; attempt < 366; attempt++) {
    if (candidate === from) return undefined
    if (!unavailable(candidate)) return candidate
    let next = clampDate(applyMove(candidate, walk, weekStartsOn), bounds.start, bounds.end)
    if (next === candidate) return undefined
    candidate = next
  }
  return undefined
}

/** The day button that takes focus when keyboard focus enters the calendar: the focused, a picked, today's or the first available day. */
export function getCalendarFocusTarget(root: ParentNode): HTMLElement | null {
  return root.querySelector<HTMLElement>('[data-slot="calendar-day-button"][tabindex="0"]')
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const cell = 'var(--cell-size, calc(var(--spacing) * 8))'
const cellRadius = 'var(--cell-radius, var(--radius-md))'
const textSm: Styles = { fontSize: 'var(--text-sm)', lineHeight: 'var(--text-sm--line-height)' }
const small: Styles = { fontSize: '0.8rem', fontWeight: 400, color: 'var(--muted-foreground)' }
// Without JavaScript, nothing can be picked, so the controls look disabled.
const inertWithoutScript: Styles = {
  '@media (scripting: none)': { cursor: 'not-allowed', opacity: 0.5, pointerEvents: 'none' },
}
const hoverFill = 'light-dark(var(--muted), color-mix(in oklab, var(--muted) 50%, transparent))'

const rootStyles = css({
  ...textSm,
  boxSizing: 'border-box',
  width: 'fit-content',
  maxWidth: '100%',
  // A month is a grid that needs both dimensions: on a narrow screen with
  // large text, the calendar scrolls sideways inside itself, never the page.
  overflowX: 'auto',
  padding: space(3),
  backgroundColor: 'var(--background)',
  color: 'var(--foreground)',
  ':where([data-slot="card-content"], [data-slot="popover-content"]) &': { backgroundColor: 'transparent' },
})
const monthsStyles = css({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  gap: space(4),
  // Never narrower than the grids, so the captions and arrows scroll with them.
  minWidth: 'max-content',
  '@media (min-width: 48rem)': { flexDirection: 'row' },
})
const navStyles = css({
  position: 'absolute',
  insetInline: 0,
  top: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: space(1),
  // The buttons take presses; the row between them lets them reach the caption below.
  pointerEvents: 'none',
})

// One rule per variant, so each renders right after Button's own rule for it
// and its size wins over Button's (see AGENTS.md, Layers and overrides).
const navButtonRules = new Map<ButtonVariant, MixValue>()
function navButtonStyles(variant: ButtonVariant) {
  let rule = navButtonRules.get(variant)
  if (!rule) {
    let styles: Styles = {}
    styles[`&[data-variant="${variant}"]`] = mergeStyles(
      {
        width: cell,
        height: cell,
        padding: 0,
        pointerEvents: 'auto',
        userSelect: 'none',
        '&[aria-disabled="true"]': { opacity: 0.5, cursor: 'not-allowed' },
        '&:dir(rtl) svg': { transform: 'scaleX(-1)' },
      },
      inertWithoutScript,
    )
    rule = css(styles)
    navButtonRules.set(variant, rule)
  }
  return rule
}

const monthStyles = css({ display: 'flex', flexDirection: 'column', gap: space(4) })
const captionStyles = css({
  boxSizing: 'border-box',
  display: 'flex',
  minHeight: cell,
  width: '100%',
  alignItems: 'center',
  justifyContent: 'center',
  paddingInline: cell,
})
const captionLabelStyles = css({ ...textSm, fontWeight: 500, userSelect: 'none', overflowWrap: 'anywhere' })
const dropdownsStyles = css({
  ...textSm,
  display: 'flex',
  flexWrap: 'wrap',
  minHeight: cell,
  width: '100%',
  alignItems: 'center',
  justifyContent: 'center',
  gap: space(1.5),
  fontWeight: 500,
})
const dropdownRootStyles = css({
  position: 'relative',
  border: '1px solid var(--input)',
  borderRadius: cellRadius,
  boxShadow: 'var(--shadow-xs)',
  '&:has(select:focus-visible)': { outline: '2px solid var(--ring)', outlineOffset: '2px' },
  '@media (forced-colors: active)': { borderColor: 'CanvasText' },
})
const dropdownStyles = css(
  mergeStyles(
    {
      position: 'absolute',
      inset: 0,
      width: '100%',
      margin: 0,
      opacity: 0,
      font: 'inherit',
      cursor: 'pointer',
      backgroundColor: 'var(--popover)',
      color: 'var(--popover-foreground)',
      '&:disabled': { cursor: 'not-allowed' },
    },
    inertWithoutScript,
  ),
)
const dropdownLabelStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: space(1),
  height: space(8),
  paddingInlineStart: space(2),
  paddingInlineEnd: space(1),
  borderRadius: cellRadius,
  whiteSpace: 'nowrap',
  userSelect: 'none',
  '& svg': { width: '0.875rem', height: '0.875rem', color: 'var(--muted-foreground)' },
  ':where([data-slot="calendar-dropdown-root"]:has(select:disabled)) &': { opacity: 0.5 },
})
const gridStyles = css({ display: 'flex', flexDirection: 'column', width: '100%', borderCollapse: 'collapse' })
const rowGroupStyles = css({ display: 'flex', flexDirection: 'column' })
const weekdaysStyles = css({ display: 'flex' })
const weekdayStyles = css({
  ...small,
  flex: '1 1 0%',
  minWidth: cell,
  padding: 0,
  overflow: 'hidden',
  borderRadius: cellRadius,
  textAlign: 'center',
  userSelect: 'none',
})
const weekStyles = css({ display: 'flex', width: '100%', marginTop: space(2) })
const weekNumberStyles = css({
  ...small,
  flex: '1 1 0%',
  minWidth: cell,
  padding: 0,
  userSelect: 'none',
  textAlign: 'center',
  '& > span': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    aspectRatio: '1 / 1',
  },
})
const startCorners = { borderStartStartRadius: cellRadius, borderEndStartRadius: cellRadius }
const endCorners = { borderStartEndRadius: cellRadius, borderEndEndRadius: cellRadius }
const dayStyles = css({
  position: 'relative',
  flex: '1 1 0%',
  minWidth: cell,
  padding: 0,
  textAlign: 'center',
  userSelect: 'none',
  borderRadius: 0,
  // The band between a range's ends.
  '&[data-range-middle], &[data-range-start]:not([data-range-end]), &[data-range-end]:not([data-range-start])': {
    backgroundColor: 'var(--muted)',
  },
  '&[data-range-start]': startCorners,
  '&[data-range-end]': endCorners,
  '&[data-range-middle]:first-of-type': startCorners,
  '&[data-range-middle]:last-child': endCorners,
  '&[data-hidden]': { visibility: 'hidden' },
})

const dayButtonStyles = css(
  mergeStyles(
    {
      ...textSm,
      position: 'relative',
      isolation: 'isolate',
      zIndex: 1,
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space(1),
      width: '100%',
      minWidth: cell,
      aspectRatio: '1 / 1',
      margin: 0,
      padding: 0,
      // No edge, also in forced colors, which paints transparent borders. Picked days get one there.
      border: 'none',
      borderRadius: cellRadius,
      backgroundColor: 'transparent',
      color: 'inherit',
      font: 'inherit',
      fontWeight: 400,
      lineHeight: 1,
      cursor: 'pointer',
      '& > span': { fontSize: 'var(--text-xs)', opacity: 0.7 },
      '&:hover:not(:disabled)': { backgroundColor: hoverFill, color: 'var(--foreground)' },
      '&:focus-visible': { zIndex: 2 },
      // Today also stands out in weight, not only in fill.
      '&[data-today]': { backgroundColor: 'var(--muted)', color: 'var(--foreground)', fontWeight: 600 },
      '&[data-outside]': { color: 'var(--muted-foreground)' },
      '&[data-range-middle]': { borderRadius: 0, backgroundColor: 'var(--muted)', color: 'var(--foreground)' },
      '&[data-selected-single], &[data-range-start], &[data-range-end]': {
        backgroundColor: 'var(--primary)',
        color: 'var(--primary-foreground)',
      },
      '&[data-selected-single]:hover:not(:disabled), &[data-range-start]:hover:not(:disabled), &[data-range-end]:hover:not(:disabled)':
        { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' },
      '&:disabled': { color: 'var(--muted-foreground)' },
      '@media (forced-colors: active)': {
        '&[data-selected-single], &[data-range-start], &[data-range-end]': { border: '2px solid Highlight' },
        '&[data-range-middle]': { border: '1px dashed Highlight' },
        '&[data-today]': { textDecoration: 'underline' },
      },
    },
    transition('background-color', 'color'),
    disabledState,
    inertWithoutScript,
  ),
)
const footerStyles = css({ ...textSm, marginTop: space(3) })

export interface CalendarDayButtonProps extends Omit<Props<'button'>, 'children'> {
  /** The day the button picks, with its states. */
  day: CalendarDay
  children?: RemixNode
}

/**
 * The button of one day, which the Calendar renders in each cell: shadcn's
 * day button, with its data attributes. Use it for days outside a Calendar
 * that should look the same, such as a strip of upcoming days.
 */
export function CalendarDayButton(handle: Handle<CalendarDayButtonProps>) {
  return () => {
    let { day, type = 'button', mix, children, ...props } = handle.props
    let single = day.selected && !day.rangeStart && !day.rangeEnd && !day.rangeMiddle

    return (
      <button
        data-slot="calendar-day-button"
        data-day={day.date}
        data-today={day.today ? '' : undefined}
        data-outside={day.outside ? '' : undefined}
        data-selected-single={single ? '' : undefined}
        data-range-start={day.rangeStart ? '' : undefined}
        data-range-end={day.rangeEnd ? '' : undefined}
        data-range-middle={day.rangeMiddle ? '' : undefined}
        disabled={day.disabled}
        aria-current={day.today ? 'date' : undefined}
        {...props}
        type={type}
        mix={[dayButtonStyles, mix]}
      >
        {children}
      </button>
    )
  }
}

const calendarPropNames = new Set<string>([
  'mode',
  'value',
  'defaultValue',
  'onValueChange',
  'minSelected',
  'maxSelected',
  'minDays',
  'maxDays',
  'excludeDisabled',
  'locale',
  'dir',
  'today',
  'timeZone',
  'month',
  'defaultMonth',
  'onMonthChange',
  'numberOfMonths',
  'pagedNavigation',
  'reverseMonths',
  'startMonth',
  'endMonth',
  'min',
  'max',
  'disabled',
  'hidden',
  'modifiers',
  'modifierStyles',
  'showOutsideDays',
  'fixedWeeks',
  'showWeekNumber',
  'hideWeekdays',
  'weekStartsOn',
  'firstWeekContainsDate',
  'ISOWeek',
  'captionLayout',
  'hideNavigation',
  'disableNavigation',
  'buttonVariant',
  'labels',
  'formatters',
  'renderDay',
  'footer',
  'name',
  'form',
  'required',
  'lang',
  'mix',
])

// The props that reach the root element: yours, without the calendar's own.
function withoutCalendarProps(props: AnyCalendarProps): Props<'div'> {
  return Object.fromEntries(Object.entries(props).filter(([key]) => !calendarPropNames.has(key))) as Props<'div'>
}

interface View {
  mode: CalendarMode
  value: CalendarValue
  months: CivilDate[]
  first: CivilDate
  count: number
  weekStartsOn: Weekday
  focusBounds: { start?: CivilDate; end?: CivilDate }
  unavailable: (date: CivilDate) => boolean
  dir: 'ltr' | 'rtl' | undefined
}

/**
 * shadcn's Calendar without react-day-picker: one month or several, for one
 * day, several days or a range, with outside days, week numbers, month and
 * year dropdowns, and disabled, hidden and custom days.
 */
export function Calendar(handle: Handle<CalendarProps>) {
  let props = () => handle.props as AnyCalendarProps
  let started = false
  // The mode the calendar's own value and reset value are in.
  let stateMode: CalendarMode = 'single'
  let uncontrolledValue: CalendarValue = null
  let resetValue: CalendarValue = null
  let uncontrolledMonth: CivilDate | undefined
  let initialMonth: CivilDate | undefined
  // The day with keyboard focus, and the grid it is in, while focus is on a day.
  let focused: { date: CivilDate; month: CivilDate } | null = null
  let root: HTMLElement | null = null
  let view: View

  function isControlled() {
    return props().value !== undefined
  }

  function setValue(next: CalendarValue, details: CalendarChangeDetails) {
    if (sameValue(next, view.value)) return
    if (!isControlled()) uncontrolledValue = next
    props().onValueChange?.(next as never, details)
    void handle.update()
  }

  function setMonth(month: CivilDate) {
    let next = startOfMonth(month)
    if (next === view.first) return
    if (props().month === undefined) uncontrolledMonth = next
    props().onMonthChange?.(next)
    void handle.update()
  }

  function press(day: CalendarDay) {
    let { mode, value } = view
    if (day.disabled) return
    let { required = false, minSelected = 0, maxSelected = 0, minDays, maxDays, excludeDisabled, disabled } = props()
    let next: CalendarValue
    if (mode === 'multiple') {
      let dates = value as CivilDate[]
      if (dates.includes(day.date)) {
        if (dates.length <= Math.max(minSelected, required ? 1 : 0)) return
        next = dates.filter((date) => date !== day.date)
      } else {
        if (maxSelected > 0 && dates.length >= maxSelected) return
        next = [...dates, day.date].sort()
      }
    } else if (mode === 'range') {
      next = addToRange(day.date, value as DateRange | null, { required, minDays, maxDays })
      if (excludeDisabled && next?.to) {
        let length = daysBetween(next.from, next.to)
        for (let offset = 0; offset <= length; offset++) {
          if (matchesDate(addDays(next.from, offset), disabled)) {
            next = { from: day.date }
            break
          }
        }
      }
    } else {
      next = value === day.date ? (required ? value : null) : day.date
    }
    setValue(next, { date: day.date, reason: 'day-press' })
  }

  function findDayButton(date: CivilDate) {
    return root?.querySelector<HTMLElement>(
      `[data-slot="calendar-day"][data-day="${date}"]:not([data-outside]) > [data-slot="calendar-day-button"]`,
    )
  }

  async function moveFocus(event: KeyboardEvent, day: CalendarDay) {
    let rtl = (view.dir ?? (root && getComputedStyle(root).direction)) === 'rtl'
    let move = moveFor(event, rtl)
    if (!move) return
    event.preventDefault()
    let next = nextFocusDate(day.date, move, view.weekStartsOn, view.focusBounds, view.unavailable)
    if (!next) return

    let month = startOfMonth(next)
    let last = addMonths(view.first, view.count - 1)
    if (month < view.first) setMonth(month)
    else if (month > last) setMonth(addMonths(month, 1 - view.count))
    let previous = focused
    focused = { date: next, month }
    await handle.update()
    let button = findDayButton(next)
    if (button) button.focus()
    // An owner that keeps its month leaves the day out of view: focus stays.
    else focused = previous
  }

  function focusIn(day: CalendarDay) {
    if (focused?.date === day.date && focused.month === day.month) return
    focused = { date: day.date, month: day.month }
    void handle.update()
  }

  function focusOut(event: FocusEvent) {
    let next = event.relatedTarget
    if (next instanceof Element && next.closest('[data-slot="calendar-day-button"]') && root?.contains(next)) return
    // Decide once the browser moved focus: a day that a new month removes blurs on its way out.
    queueMicrotask(() => {
      let active = root?.ownerDocument.activeElement
      if (active?.closest('[data-slot="calendar-day-button"]') && root?.contains(active)) return
      if (!focused) return
      focused = null
      void handle.update()
    })
  }

  // The form its value belongs to: the one `form` names, else the one around it.
  function ownForm() {
    let { name, form } = props()
    if (!name || !root) return null
    let found = form ? root.ownerDocument.getElementById(form) : root.closest('form')
    return found instanceof HTMLFormElement ? found : null
  }

  // A form reset returns the hidden inputs' form to its defaults. The
  // calendar follows once the reset has finished, since a listener may still
  // cancel it, and tells an owner that controls the value.
  function onReset(event: Event) {
    let form = ownForm()
    if (!form || event.target !== form) return
    let timer = setTimeout(() => {
      if (handle.signal.aborted || event.defaultPrevented) return
      if (props().month === undefined && initialMonth) uncontrolledMonth = initialMonth
      if (sameValue(resetValue, view.value)) return void handle.update()
      setValue(resetValue, { date: undefined, reason: 'reset' })
    })
    handle.signal.addEventListener('abort', () => clearTimeout(timer), { once: true })
  }

  handle.queueTask(() => {
    document.addEventListener('reset', onReset, { capture: true, signal: handle.signal })
  })

  return () => {
    let {
      mode = 'single',
      value: valueProp,
      defaultValue,
      maxSelected = 0,
      locale: localeProp,
      dir,
      today: todayProp,
      timeZone,
      month: monthProp,
      defaultMonth,
      numberOfMonths = 1,
      pagedNavigation = false,
      reverseMonths = false,
      startMonth,
      endMonth,
      min,
      max,
      disabled,
      hidden,
      modifiers = {},
      modifierStyles = {},
      showOutsideDays = true,
      fixedWeeks = false,
      showWeekNumber = false,
      hideWeekdays = false,
      weekStartsOn: weekStartsOnProp,
      firstWeekContainsDate: firstWeekProp,
      ISOWeek = false,
      captionLayout = 'label',
      hideNavigation = false,
      disableNavigation = false,
      buttonVariant = 'ghost',
      labels: labelsProp,
      formatters: formattersProp,
      renderDay,
      footer,
      name,
      form,
      lang,
      mix,
    } = handle.props as AnyCalendarProps
    let rootProps = withoutCalendarProps(handle.props as AnyCalendarProps)
    let locale = validLocale(localeProp)
    let labels = { ...defaultLabels, ...labelsProp }
    let format = { ...defaultFormatters, ...formattersProp }
    let count = Math.max(1, Math.floor(numberOfMonths))
    let today = validDate(todayProp) ?? todayIn(timeZone)
    let allDisabled = disabled === true

    if (started && mode !== stateMode) {
      uncontrolledValue = normalizeValue(mode, uncontrolledValue)
      resetValue = normalizeValue(mode, resetValue)
    }
    stateMode = mode

    let value: CalendarValue
    if (valueProp !== undefined) {
      value = normalizeValue(mode, valueProp)
      if (!started) resetValue = value
    } else {
      if (!started) uncontrolledValue = resetValue = normalizeValue(mode, defaultValue)
      value = uncontrolledValue
    }

    let weekStartsOn: Weekday = ISOWeek ? 1 : (weekStartsOnProp ?? weekStartOf(locale))
    let firstWeekContainsDate = ISOWeek ? 4 : (firstWeekProp ?? (weekStartsOn === 1 ? 4 : 1))

    // The months navigation can reach. Year dropdowns need an end on both sides.
    let dropdown = captionLayout !== 'label'
    let { year } = dateParts(today)
    let navStart = validDate(startMonth) ?? validDate(min)
    let navEnd = validDate(endMonth) ?? validDate(max)
    if (dropdown) {
      navStart ??= toCivilDate({ year: Math.max(1, year - 100), month: 1, day: 1 })
      navEnd ??= toCivilDate({ year, month: 12, day: 1 })
    }
    navStart = navStart && startOfMonth(navStart)
    navEnd = navEnd && startOfMonth(navEnd)
    let lastFirst = navEnd && addMonths(navEnd, 1 - count)
    let clampMonth = (month: CivilDate) => {
      let first = startOfMonth(month)
      if (lastFirst && first > lastFirst) first = lastFirst
      if (navStart && first < navStart) first = navStart
      return first
    }

    if (!started) {
      initialMonth = clampMonth(validDate(defaultMonth) ?? firstSelected(value) ?? today)
      uncontrolledMonth = initialMonth
    }
    let first = clampMonth(validDate(monthProp) ?? uncontrolledMonth ?? today)
    let months = Array.from({ length: count }, (_, index) => addMonths(first, index))
    let last = months[count - 1]
    let canGoBack = !disableNavigation && !allDisabled && (!navStart || first > navStart)
    let canGoForward = !disableNavigation && !allDisabled && (!lastFirst || first < lastFirst)
    let step = pagedNavigation ? count : 1

    let selectedSet = new Set(Array.isArray(value) ? value : [])
    let range = mode === 'range' ? (value as DateRange | null) : null
    let maxReached = mode === 'multiple' && maxSelected > 0 && selectedSet.size >= maxSelected
    let isSelected = (date: CivilDate) => {
      if (mode === 'multiple') return selectedSet.has(date)
      if (mode === 'range')
        return Boolean(range && (range.to ? date >= range.from && date <= range.to : date === range.from))
      return value === date
    }
    let isHidden = (date: CivilDate) => matchesDate(date, hidden)
    let isDisabled = (date: CivilDate) =>
      allDisabled ||
      matchesDate(date, disabled) ||
      Boolean(min && date < min) ||
      Boolean(max && date > max) ||
      (maxReached && !selectedSet.has(date))
    let unavailable = (date: CivilDate) => isDisabled(date) || isHidden(date)
    let modifierNames = Object.keys(modifiers).filter((key) => /^[a-z][a-z0-9-]*$/.test(key))

    let dayOf = (date: CivilDate, month: CivilDate): CalendarDay => {
      let outside = startOfMonth(date) !== month
      let selected = isSelected(date)
      let rangeEnds = Boolean(range && selected)
      return {
        date,
        month,
        outside,
        today: date === today,
        selected,
        disabled: isDisabled(date),
        hidden: isHidden(date) || (outside && !showOutsideDays),
        rangeStart: rangeEnds && date === range!.from,
        rangeEnd: rangeEnds && date === (range!.to ?? range!.from),
        rangeMiddle: rangeEnds && date !== range!.from && date !== (range!.to ?? range!.from),
        modifiers: modifierNames.filter((key) => matchesDate(date, modifiers[key])),
      }
    }

    let grids = months.map((month) => ({
      month,
      weeks: monthWeeks(month, weekStartsOn, fixedWeeks).map((week) => week.map((date) => dayOf(date, month))),
    }))
    let reachable = (day: CalendarDay) => !day.outside && !day.hidden && !day.disabled
    let inView = grids.flatMap((grid) => grid.weeks.flat().filter(reachable))
    // One day is in the tab order: the focused one, else a picked one, today, or the first available.
    let target =
      (focused && grids.some((grid) => grid.month === focused!.month) && !unavailable(focused.date) && focused) ||
      [inView.find((day) => day.selected), inView.find((day) => day.today), inView[0]].find(Boolean)
    if (focused && target !== focused) focused = null

    view = {
      mode,
      value,
      months,
      first,
      count,
      weekStartsOn,
      dir,
      unavailable,
      focusBounds: disableNavigation
        ? { start: first, end: endOfMonth(last) }
        : { start: navStart, end: navEnd && endOfMonth(navEnd) },
    }
    started = true

    // The months grid `index` can show: the first grid's bounds, moved by its place.
    let gridBounds = (index: number) => ({
      start: navStart && addMonths(navStart, index),
      end: lastFirst && addMonths(lastFirst, index),
    })
    let monthOptions = (month: CivilDate, index: number) => {
      let { year: shownYear } = dateParts(month)
      let { start, end } = gridBounds(index)
      return Array.from({ length: 12 }, (_, offset) => {
        let option = toCivilDate({ year: shownYear, month: offset + 1, day: 1 })
        let outOfBounds = Boolean((start && option < start) || (end && option > end))
        return { option, outOfBounds }
      })
    }
    let yearOptions = (index: number) => {
      let { start, end } = gridBounds(index)
      let from = start ? dateParts(start).year : year - 100
      let to = end ? dateParts(end).year : year
      return Array.from({ length: to - from + 1 }, (_, offset) =>
        toCivilDate({ year: from + offset, month: 1, day: 1 }),
      )
    }
    // A dropdown shows the month or year of its own grid: the first grid moves
    // so that grid shows the pick, then stays within the months it may reach.
    let pick = (index: number, next: CivilDate) => setMonth(clampMonth(addMonths(next, -index)))

    let caption = (month: CivilDate, index: number) => {
      let text = format.caption(month, locale)
      if (!dropdown) {
        return (
          <span data-slot="calendar-caption-label" aria-live="polite" mix={captionLabelStyles}>
            {text}
          </span>
        )
      }
      let { year: shownYear, month: shownMonth } = dateParts(month)
      let monthSelect =
        captionLayout === 'dropdown' || captionLayout === 'dropdown-months' ? (
          <span data-slot="calendar-dropdown-root" mix={dropdownRootStyles}>
            <select
              data-slot="calendar-dropdown"
              aria-label={labels.month}
              disabled={allDisabled || disableNavigation}
              mix={[
                dropdownStyles,
                on('change', (event) =>
                  pick(index, toCivilDate({ year: shownYear, month: Number(event.currentTarget.value), day: 1 })),
                ),
              ]}
            >
              {monthOptions(month, index).map(({ option, outOfBounds }) => (
                <option
                  key={option}
                  value={String(dateParts(option).month)}
                  selected={option === month}
                  disabled={outOfBounds}
                >
                  {format.monthDropdown(option, locale)}
                </option>
              ))}
            </select>
            <span data-slot="calendar-caption-label" aria-hidden="true" mix={dropdownLabelStyles}>
              {format.monthDropdown(month, locale)}
              <ChevronDownIcon />
            </span>
          </span>
        ) : (
          <span mix={captionLabelStyles}>{format.monthDropdown(month, locale)}</span>
        )
      let yearSelect =
        captionLayout === 'dropdown' || captionLayout === 'dropdown-years' ? (
          <span data-slot="calendar-dropdown-root" mix={dropdownRootStyles}>
            <select
              data-slot="calendar-dropdown"
              aria-label={labels.year}
              disabled={allDisabled || disableNavigation}
              mix={[
                dropdownStyles,
                on('change', (event) => {
                  let nextYear = Number(event.currentTarget.value)
                  let next = toCivilDate({ year: nextYear, month: shownMonth, day: 1 })
                  pick(index, next)
                }),
              ]}
            >
              {yearOptions(index).map((option) => (
                <option
                  key={option}
                  value={String(dateParts(option).year)}
                  selected={dateParts(option).year === shownYear}
                >
                  {format.yearDropdown(option, locale)}
                </option>
              ))}
            </select>
            <span data-slot="calendar-caption-label" aria-hidden="true" mix={dropdownLabelStyles}>
              {format.yearDropdown(month, locale)}
              <ChevronDownIcon />
            </span>
          </span>
        ) : (
          <span mix={captionLabelStyles}>{format.yearDropdown(month, locale)}</span>
        )
      return (
        <div data-slot="calendar-dropdowns" mix={dropdownsStyles}>
          {monthSelect}
          {yearSelect}
        </div>
      )
    }

    let weekdays = monthWeeks(first, weekStartsOn, false)[0]
    let shown = reverseMonths ? [...grids].reverse() : grids
    let hiddenInputs: { name: string; value: string }[] = []
    if (name) {
      if (mode === 'multiple') hiddenInputs = (value as CivilDate[]).map((date) => ({ name, value: date }))
      else if (mode === 'range')
        hiddenInputs = [range?.from ?? '', range?.to ?? ''].map((date) => ({ name, value: date }))
      else hiddenInputs = [{ name, value: (value as CivilDate | null) ?? '' }]
    }

    return (
      <div
        data-slot="calendar"
        data-mode={mode}
        data-disabled={allDisabled ? '' : undefined}
        dir={dir}
        lang={lang ?? locale}
        {...rootProps}
        mix={[rootStyles, mix, ref((node) => (root = node))]}
      >
        <div data-slot="calendar-months" mix={monthsStyles}>
          {hideNavigation ? null : (
            <div data-slot="calendar-nav" mix={navStyles}>
              <button
                type="button"
                data-slot="calendar-previous"
                aria-label={labels.previousMonth}
                aria-disabled={canGoBack ? undefined : 'true'}
                mix={[
                  buttonVariants({ variant: buttonVariant, size: 'icon' }),
                  navButtonStyles(buttonVariant),
                  on('click', () => {
                    if (canGoBack) setMonth(clampMonth(addMonths(first, -step)))
                  }),
                ]}
              >
                <ChevronLeftIcon />
              </button>
              <button
                type="button"
                data-slot="calendar-next"
                aria-label={labels.nextMonth}
                aria-disabled={canGoForward ? undefined : 'true'}
                mix={[
                  buttonVariants({ variant: buttonVariant, size: 'icon' }),
                  navButtonStyles(buttonVariant),
                  on('click', () => {
                    if (canGoForward) setMonth(clampMonth(addMonths(first, step)))
                  }),
                ]}
              >
                <ChevronRightIcon />
              </button>
            </div>
          )}
          {shown.map(({ month, weeks }) => {
            let index = months.indexOf(month)
            return (
              <div key={index} data-slot="calendar-month" data-month={month.slice(0, 7)} mix={monthStyles}>
                <div data-slot="calendar-caption" mix={captionStyles}>
                  {caption(month, index)}
                </div>
                <table
                  role="grid"
                  data-slot="calendar-grid"
                  aria-label={format.caption(month, locale)}
                  aria-multiselectable={mode === 'single' ? undefined : 'true'}
                  mix={gridStyles}
                >
                  {hideWeekdays ? null : (
                    <thead aria-hidden="true" mix={rowGroupStyles}>
                      <tr data-slot="calendar-weekdays" mix={weekdaysStyles}>
                        {showWeekNumber ? (
                          <th
                            data-slot="calendar-week-number-header"
                            aria-label={labels.weekNumberHeader}
                            mix={weekdayStyles}
                          ></th>
                        ) : null}
                        {weekdays.map((date) => (
                          <th key={date} data-slot="calendar-weekday" scope="col" mix={weekdayStyles}>
                            {format.weekday(date, locale)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody role="rowgroup" mix={rowGroupStyles}>
                    {weeks.map((week) => {
                      let week1 = weekNumber(week[0].date, { weekStartsOn, firstWeekContainsDate })
                      return (
                        <tr key={week[0].date} role="row" data-slot="calendar-week" mix={weekStyles}>
                          {showWeekNumber ? (
                            <th
                              role="rowheader"
                              scope="row"
                              data-slot="calendar-week-number"
                              aria-label={labels.weekNumber(week1)}
                              mix={weekNumberStyles}
                            >
                              <span>{format.weekNumber(week1, locale)}</span>
                            </th>
                          ) : null}
                          {week.map((day) => {
                            let tabbable =
                              target !== undefined && day.date === target.date && day.month === target.month
                            return (
                              <td
                                key={day.date}
                                role="gridcell"
                                data-slot="calendar-day"
                                data-day={day.date}
                                data-outside={day.outside ? '' : undefined}
                                data-today={day.today ? '' : undefined}
                                data-selected={day.selected ? '' : undefined}
                                data-disabled={day.disabled ? '' : undefined}
                                data-hidden={day.hidden ? '' : undefined}
                                data-range-start={day.rangeStart ? '' : undefined}
                                data-range-end={day.rangeEnd ? '' : undefined}
                                data-range-middle={day.rangeMiddle ? '' : undefined}
                                aria-selected={day.selected ? 'true' : undefined}
                                {...Object.fromEntries(day.modifiers.map((key) => [`data-${key}`, '']))}
                                mix={dayStyles}
                              >
                                {day.hidden ? null : (
                                  <CalendarDayButton
                                    day={day}
                                    tabIndex={tabbable ? 0 : -1}
                                    aria-label={format.dayLabel(day, locale)}
                                    mix={[
                                      day.modifiers.map((key) => modifierStyles[key]),
                                      on('click', () => press(day)),
                                      on('keydown', (event) => void moveFocus(event, day)),
                                      on('focus', () => focusIn(day)),
                                      on('focusout', (event) => focusOut(event)),
                                    ]}
                                  >
                                    {renderDay ? renderDay(day) : format.day(day.date, locale)}
                                  </CalendarDayButton>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
        {footer === undefined ? null : (
          <div data-slot="calendar-footer" role="status" aria-live="polite" mix={footerStyles}>
            {footer}
          </div>
        )}
        {hiddenInputs.map((entry, index) => (
          <input key={index} type="hidden" name={entry.name} value={entry.value} form={form} disabled={allDisabled} />
        ))}
      </div>
    )
  }
}
