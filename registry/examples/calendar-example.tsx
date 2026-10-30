// RemixCN Calendar examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { addDays, dateParts, dayOfWeek, formatCivilDate, todayIn, toCivilDate } from '#remixcn/lib/civil-date.ts'
import type { CivilDate } from '#remixcn/lib/civil-date.ts'
import { CalendarIcon, ClockIcon } from '#remixcn/lib/icons.tsx'
import { Button, buttonVariants } from '#remixcn/ui/button.tsx'
import { Calendar } from '#remixcn/ui/calendar.tsx'
import type { CalendarLabels, DateRange } from '#remixcn/ui/calendar.tsx'
import { Card, CardContent, CardFooter } from '#remixcn/ui/card.tsx'
import { Field, FieldGroup, FieldLabel } from '#remixcn/ui/field.tsx'
import { InputGroup, InputGroupAddon, InputGroupInput } from '#remixcn/ui/input-group.tsx'
import { Popover, PopoverContent, PopoverTrigger } from '#remixcn/ui/popover.tsx'

// Each example is a client entry, so its calendar runs in the browser. Pass
// `today` from the server, worked out in the user's time zone, so the server
// HTML and the browser agree on it. Without it, each works out its own.

export interface CalendarExampleProps {
  /** Today as YYYY-MM-DD. */
  today?: CivilDate
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const bordered = css({ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' })
const fitCard = css({ width: 'fit-content', maxWidth: '100%', marginInline: 'auto', paddingBlock: 0 })
const flushContent = css({ paddingInline: 0 })
const presetsStyles = css({ display: 'flex', flexWrap: 'wrap', gap: space(2), borderTop: '1px solid var(--border)' })
const presetStyles = css({ flex: '1 1 auto' })
const timeFooterStyles = css({ borderTop: '1px solid var(--border)', backgroundColor: 'var(--card)' })
// The clock addon says what the field is for, so the browser's own picker icon goes.
const timeInputStyles = css({
  appearance: 'none',
  '&::-webkit-calendar-picker-indicator': { display: 'none', appearance: 'none' },
})
const largeCells = css({
  '--cell-size': space(10),
  '@media (min-width: 48rem)': { '--cell-size': space(12) },
})
const booked = css({ textDecoration: 'line-through', opacity: 1 })
const flushPopover = css({ width: 'auto', padding: 0 })

function year(today: CivilDate) {
  return dateParts(today).year
}

function inThisMonth(today: CivilDate, day: number) {
  let { year: y, month } = dateParts(today)
  return toCivilDate({ year: y, month, day })
}

/** One day, with the border shadcn's docs give it. */
export const CalendarBasic = clientEntry(import.meta.url, function CalendarBasic(handle: Handle<CalendarExampleProps>) {
  return () => <Calendar today={handle.props.today} mix={bordered} />
})

/** One day the example controls, with month and year dropdowns. */
export const CalendarSingle = clientEntry(
  import.meta.url,
  function CalendarSingle(handle: Handle<CalendarExampleProps>) {
    let today = handle.props.today ?? todayIn()
    let date: CivilDate | null = inThisMonth(today, 12)

    return () => (
      <Card mix={fitCard}>
        <CardContent mix={flushContent}>
          <Calendar
            today={handle.props.today ?? today}
            value={date}
            onValueChange={(next) => {
              date = next
              void handle.update()
            }}
            captionLayout="dropdown"
          />
        </CardContent>
      </Card>
    )
  },
)

/** Any number of days. */
export const CalendarMultiple = clientEntry(
  import.meta.url,
  function CalendarMultiple(handle: Handle<CalendarExampleProps>) {
    return () => (
      <Card mix={fitCard}>
        <CardContent mix={flushContent}>
          <Calendar today={handle.props.today} mode="multiple" />
        </CardContent>
      </Card>
    )
  },
)

/** A column of week numbers. */
export const CalendarWeekNumbers = clientEntry(
  import.meta.url,
  function CalendarWeekNumbers(handle: Handle<CalendarExampleProps>) {
    let today = handle.props.today ?? todayIn()
    let date: CivilDate | null = toCivilDate({ year: year(today), month: 2, day: 3 })

    return () => (
      <Card mix={fitCard}>
        <CardContent mix={flushContent}>
          <Calendar
            today={handle.props.today ?? today}
            defaultMonth={date ?? undefined}
            value={date}
            onValueChange={(next) => {
              date = next
              void handle.update()
            }}
            showWeekNumber
          />
        </CardContent>
      </Card>
    )
  },
)

/** Booked days can't be picked and are struck through. */
export const CalendarBookedDates = clientEntry(
  import.meta.url,
  function CalendarBookedDates(handle: Handle<CalendarExampleProps>) {
    let today = handle.props.today ?? todayIn()
    let date: CivilDate | null = toCivilDate({ year: year(today), month: 2, day: 3 })
    let bookedDates = Array.from({ length: 15 }, (_, index) =>
      addDays(toCivilDate({ year: year(today), month: 2, day: 12 }), index),
    )

    return () => (
      <Card mix={fitCard}>
        <CardContent mix={flushContent}>
          <Calendar
            today={handle.props.today ?? today}
            defaultMonth={date ?? undefined}
            value={date}
            onValueChange={(next) => {
              date = next
              void handle.update()
            }}
            disabled={bookedDates}
            modifiers={{ booked: bookedDates }}
            modifierStyles={{ booked }}
          />
        </CardContent>
      </Card>
    )
  },
)

/** A range across two months, up to today. */
export const CalendarRange = clientEntry(import.meta.url, function CalendarRange(handle: Handle<CalendarExampleProps>) {
  let today = handle.props.today ?? todayIn()
  let from = toCivilDate({ year: year(today), month: 1, day: 12 })
  let range: DateRange | null = { from, to: addDays(from, 30) }

  return () => (
    <Card mix={fitCard}>
      <CardContent mix={flushContent}>
        <Calendar
          today={handle.props.today ?? today}
          mode="range"
          defaultMonth={from}
          value={range}
          onValueChange={(next) => {
            range = next
            void handle.update()
          }}
          numberOfMonths={2}
          disabled={[{ after: today }, { before: '1900-01-01' }]}
        />
      </CardContent>
    </Card>
  )
})

const spanishLabels: Partial<CalendarLabels> = {
  previousMonth: 'Mes anterior',
  nextMonth: 'Mes siguiente',
  month: 'Mes',
  year: 'Año',
  weekNumberHeader: 'Semana',
  weekNumber: (week) => `Semana ${week}`,
}

/** A range across three months in Spanish, six weeks each. */
export const CalendarRangeMultipleMonths = clientEntry(
  import.meta.url,
  function CalendarRangeMultipleMonths(handle: Handle<CalendarExampleProps>) {
    let today = handle.props.today ?? todayIn()
    let from = toCivilDate({ year: year(today), month: 4, day: 12 })
    let range: DateRange | null = { from, to: addDays(from, 60) }

    return () => (
      <Card mix={fitCard}>
        <CardContent mix={flushContent}>
          <Calendar
            today={handle.props.today ?? today}
            mode="range"
            defaultMonth={from}
            value={range}
            onValueChange={(next) => {
              range = next
              void handle.update()
            }}
            numberOfMonths={3}
            locale="es"
            labels={spanishLabels}
            fixedWeeks
          />
        </CardContent>
      </Card>
    )
  },
)

/** A day, and the times it starts and ends in native time fields. */
export const CalendarWithTime = clientEntry(
  import.meta.url,
  function CalendarWithTime(handle: Handle<CalendarExampleProps>) {
    let today = handle.props.today ?? todayIn()
    let date: CivilDate | null = inThisMonth(today, 12)
    let from = `${handle.id}-from`
    let to = `${handle.id}-to`

    return () => (
      <Card size="sm" mix={css({ width: 'fit-content', maxWidth: '100%', marginInline: 'auto' })}>
        <CardContent>
          <Calendar
            today={handle.props.today ?? today}
            value={date}
            onValueChange={(next) => {
              date = next
              void handle.update()
            }}
            mix={css({ padding: 0 })}
          />
        </CardContent>
        <CardFooter mix={timeFooterStyles}>
          <FieldGroup>
            <Field>
              <FieldLabel for={from}>Start time</FieldLabel>
              <InputGroup>
                <InputGroupInput id={from} type="time" step={1} defaultValue="10:30:00" mix={timeInputStyles} />
                <InputGroupAddon>
                  <ClockIcon />
                </InputGroupAddon>
              </InputGroup>
            </Field>
            <Field>
              <FieldLabel for={to}>End time</FieldLabel>
              <InputGroup>
                <InputGroupInput id={to} type="time" step={1} defaultValue="12:30:00" mix={timeInputStyles} />
                <InputGroupAddon>
                  <ClockIcon />
                </InputGroupAddon>
              </InputGroup>
            </Field>
          </FieldGroup>
        </CardFooter>
      </Card>
    )
  },
)

const presets = [
  { label: 'Today', days: 0 },
  { label: 'Tomorrow', days: 1 },
  { label: 'In 3 days', days: 3 },
  { label: 'In a week', days: 7 },
  { label: 'In 2 weeks', days: 14 },
]

/** Buttons that pick a day relative to today and show its month. */
export const CalendarWithPresets = clientEntry(
  import.meta.url,
  function CalendarWithPresets(handle: Handle<CalendarExampleProps>) {
    let today = handle.props.today ?? todayIn()
    let date: CivilDate | null = toCivilDate({ year: year(today), month: 2, day: 12 })
    let month: CivilDate = inThisMonth(today, 1)

    return () => (
      <Card size="sm" mix={css({ width: 'fit-content', maxWidth: 'min(100%, 300px)', marginInline: 'auto' })}>
        <CardContent>
          <Calendar
            today={handle.props.today ?? today}
            value={date}
            onValueChange={(next) => {
              date = next
              void handle.update()
            }}
            month={month}
            onMonthChange={(next) => {
              month = next
              void handle.update()
            }}
            fixedWeeks
            mix={css({ padding: 0, '--cell-size': space(9.5) })}
          />
        </CardContent>
        <CardFooter mix={presetsStyles}>
          {presets.map((preset) => (
            <Button
              key={preset.days}
              variant="outline"
              size="sm"
              mix={[
                presetStyles,
                on('click', () => {
                  date = addDays(today, preset.days)
                  month = date
                  void handle.update()
                }),
              ]}
            >
              {preset.label}
            </Button>
          ))}
        </CardFooter>
      </Card>
    )
  },
)

const dayNumber = (date: CivilDate) => formatCivilDate(date, 'en-US', { day: 'numeric' })
const price = (date: CivilDate) => ([0, 6].includes(dayOfWeek(date)) ? '$120' : '$100')

/** Larger cells with a price under each day of the month, and month and year dropdowns. */
export const CalendarCustomDays = clientEntry(
  import.meta.url,
  function CalendarCustomDays(handle: Handle<CalendarExampleProps>) {
    let today = handle.props.today ?? todayIn()
    let from = toCivilDate({ year: year(today), month: 12, day: 8 })
    let range: DateRange | null = { from, to: addDays(from, 10) }

    return () => (
      <Card mix={fitCard}>
        <CardContent mix={flushContent}>
          <Calendar
            today={handle.props.today ?? today}
            mode="range"
            defaultMonth={from}
            value={range}
            onValueChange={(next) => {
              range = next
              void handle.update()
            }}
            captionLayout="dropdown"
            endMonth={toCivilDate({ year: year(today) + 1, month: 12, day: 1 })}
            formatters={{
              monthDropdown: (month, locale) => formatCivilDate(month, locale, { month: 'long' }),
              // The name starts with what the button shows, so speech input finds it by its price too.
              dayLabel: (day, locale) => {
                let date = formatCivilDate(day.date, locale, { dateStyle: 'full' })
                return day.outside ? date : `${dayNumber(day.date)} ${price(day.date)}, ${date}`
              },
            }}
            renderDay={(day) => (
              <>
                {dayNumber(day.date)} {day.outside ? null : <span>{price(day.date)}</span>}
              </>
            )}
            mix={largeCells}
          />
        </CardContent>
      </Card>
    )
  },
)

/** A calendar in a card, which it leaves its background to. */
export const CalendarInCard = clientEntry(
  import.meta.url,
  function CalendarInCard(handle: Handle<CalendarExampleProps>) {
    return () => (
      <Card mix={fitCard}>
        <CardContent mix={flushContent}>
          <Calendar today={handle.props.today} />
        </CardContent>
      </Card>
    )
  },
)

/** A calendar in a popover. The Date Picker recipe builds on it. */
export const CalendarInPopover = clientEntry(
  import.meta.url,
  function CalendarInPopover(handle: Handle<CalendarExampleProps>) {
    return () => (
      <Popover>
        <PopoverTrigger mix={buttonVariants({ variant: 'outline' })}>
          <CalendarIcon data-icon="inline-start" />
          Open calendar
        </PopoverTrigger>
        <PopoverContent align="start" aria-label="Calendar" mix={flushPopover}>
          <Calendar today={handle.props.today} />
        </PopoverContent>
      </Popover>
    )
  },
)

const rtlLabels: Record<'ar' | 'he', Partial<CalendarLabels>> = {
  ar: {
    previousMonth: 'الشهر السابق',
    nextMonth: 'الشهر التالي',
    month: 'الشهر',
    year: 'السنة',
    weekNumberHeader: 'الأسبوع',
    weekNumber: (week) => `الأسبوع ${week}`,
  },
  he: {
    previousMonth: 'החודש הקודם',
    nextMonth: 'החודש הבא',
    month: 'חודש',
    year: 'שנה',
    weekNumberHeader: 'שבוע',
    weekNumber: (week) => `שבוע ${week}`,
  },
}

/** Right to left, in Arabic or Hebrew, with month and year dropdowns. */
export const CalendarRtl = clientEntry(
  import.meta.url,
  function CalendarRtl(handle: Handle<CalendarExampleProps & { language?: 'ar' | 'he' }>) {
    let today = handle.props.today ?? todayIn()
    let date: CivilDate | null = today

    return () => {
      let language = handle.props.language ?? 'ar'
      return (
        <Calendar
          today={handle.props.today ?? today}
          value={date}
          onValueChange={(next) => {
            date = next
            void handle.update()
          }}
          locale={language === 'ar' ? 'ar-SA' : 'he-IL'}
          labels={rtlLabels[language]}
          dir="rtl"
          captionLayout="dropdown"
          mix={[bordered, css({ '--cell-size': space(9) })]}
        />
      )
    }
  },
)
