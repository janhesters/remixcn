// RemixCN Date Picker: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on, ref } from 'remix/component'
import type { Handle } from 'remix/component'

import {
  addDays,
  dateParts,
  formatCivilDate,
  formatCivilDateRange,
  parseCivilDate,
  todayIn,
  toCivilDate,
} from '#remixcn/lib/civil-date.ts'
import type { CivilDate } from '#remixcn/lib/civil-date.ts'
import { CalendarIcon, ChevronDownIcon, XIcon } from '#remixcn/lib/icons.tsx'
import { buttonVariants } from '#remixcn/ui/button.tsx'
import { Calendar, getCalendarFocusTarget } from '#remixcn/ui/calendar.tsx'
import type { CalendarLabels, DateRange } from '#remixcn/ui/calendar.tsx'
import { describedBy, Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '#remixcn/ui/field.tsx'
import { Input } from '#remixcn/ui/input.tsx'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '#remixcn/ui/input-group.tsx'
import { Popover, PopoverContent, popoverOpenChangeType, PopoverTrigger, popoverTrigger } from '#remixcn/ui/popover.tsx'

// A date picker is a Popover with a Calendar inside: there is no DatePicker
// part. Each picker here is a client entry. Pass `today` and `locale` from
// the server, so the server HTML and the browser agree on them.
//
// A trigger shows the picked day in words, in the user's locale, and the
// calendar's `name` puts its value, YYYY-MM-DD, into the form. A text field
// takes typed days as YYYY-MM-DD only: a date such as 03/04/2026 means
// different days in different countries, so it is refused, not guessed. The
// text field submits and resets natively, also without JavaScript, when the
// popover can't open and its calendar can't pick.

export interface DatePickerProps {
  /** Today as YYYY-MM-DD. */
  today?: CivilDate
  /** The locale of the labels, such as 'de-CH' (defaults to 'en-US'). */
  locale?: string
  /** The form field name of the value, YYYY-MM-DD. */
  name?: string
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const fieldWidth = (rem: number) => css({ width: `min(100%, ${rem}rem)` })
const triggerStyles = css({
  justifyContent: 'flex-start',
  fontWeight: 400,
  '&[data-empty]': { color: 'var(--muted-foreground)' },
})
const spreadTriggerStyles = css({
  justifyContent: 'space-between',
  fontWeight: 400,
  textAlign: 'start',
  '&[data-empty]': { color: 'var(--muted-foreground)' },
})
const flushPopover = css({ width: 'auto', padding: 0, overflow: 'hidden' })
// Clearing needs the script; without it, select the text and delete it. The rule beats Button's display.
const scriptOnly = css({ '@media (scripting: none)': { display: 'none !important' } })
const rowStyles = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  gap: space(4),
  width: 'min(100%, 20rem)',
  '& > *': { flex: '1 1 8rem' },
})
const timeInputStyles = css({
  appearance: 'none',
  backgroundColor: 'var(--background)',
  '&::-webkit-calendar-picker-indicator': { display: 'none', appearance: 'none' },
})

/** Focus goes to the picked day, today or the first day when a popover with a calendar opens. */
function calendarIn(contentId: string) {
  return () => {
    let content = document.getElementById(contentId)
    return content && getCalendarFocusTarget(content)
  }
}

function longDate(date: CivilDate, locale: string) {
  return formatCivilDate(date, locale, { dateStyle: 'long' })
}

// A trigger names itself from its label and the day it shows, such as "Date
// October 30, 2026": aria-labelledby lists the label and the trigger itself.
function ids(handle: Handle<unknown>) {
  return {
    label: `${handle.id}-label`,
    trigger: `${handle.id}-trigger`,
    content: `${handle.id}-content`,
  }
}

/** A button that shows the picked day, and a calendar in a popover. */
export const DatePickerDemo = clientEntry(import.meta.url, function DatePickerDemo(handle: Handle<DatePickerProps>) {
  let date: CivilDate | null = null
  let id = ids(handle)

  return () => {
    let { today, locale = 'en-US', name } = handle.props
    return (
      <Popover>
        <PopoverTrigger
          id={id.trigger}
          data-empty={date ? undefined : ''}
          mix={[buttonVariants({ variant: 'outline' }), spreadTriggerStyles, fieldWidth(13.25)]}
        >
          {date ? longDate(date, locale) : <span>Pick a date</span>}
          <ChevronDownIcon data-icon="inline-end" />
        </PopoverTrigger>
        <PopoverContent
          id={id.content}
          align="start"
          aria-label="Choose a date"
          initialFocus={calendarIn(id.content)}
          mix={flushPopover}
        >
          <Calendar
            today={today}
            locale={locale}
            name={name}
            value={date}
            defaultMonth={date ?? undefined}
            onValueChange={(next) => {
              date = next
              void handle.update()
            }}
          />
        </PopoverContent>
      </Popover>
    )
  }
})

/** A labelled field whose trigger opens a calendar that stays open while you pick. */
export const DatePickerBasic = clientEntry(import.meta.url, function DatePickerBasic(handle: Handle<DatePickerProps>) {
  let date: CivilDate | null = null
  let id = ids(handle)

  return () => {
    let { today, locale = 'en-US', name } = handle.props
    return (
      <Field mix={fieldWidth(15)}>
        <FieldLabel id={id.label} for={id.trigger}>
          Date
        </FieldLabel>
        <Popover>
          <PopoverTrigger
            id={id.trigger}
            aria-labelledby={`${id.label} ${id.trigger}`}
            data-empty={date ? undefined : ''}
            mix={[buttonVariants({ variant: 'outline' }), triggerStyles]}
          >
            <CalendarIcon data-icon="inline-start" />
            {date ? longDate(date, locale) : <span>Pick a date</span>}
          </PopoverTrigger>
          <PopoverContent
            id={id.content}
            align="start"
            aria-label="Choose a date"
            initialFocus={calendarIn(id.content)}
            mix={flushPopover}
          >
            <Calendar
              today={today}
              locale={locale}
              name={name}
              value={date}
              onValueChange={(next) => {
                date = next
                void handle.update()
              }}
            />
          </PopoverContent>
        </Popover>
      </Field>
    )
  }
})

/** A range across two months, written the way the locale writes a range. */
export const DatePickerRange = clientEntry(import.meta.url, function DatePickerRange(handle: Handle<DatePickerProps>) {
  let today = handle.props.today ?? todayIn()
  let from = toCivilDate({ year: dateParts(today).year, month: 1, day: 20 })
  let range: DateRange | null = { from, to: addDays(from, 20) }
  let id = ids(handle)

  return () => {
    let { locale = 'en-US', name } = handle.props
    let label = range
      ? formatCivilDateRange(range.from, range.to ?? range.from, locale, { dateStyle: 'medium' })
      : undefined
    return (
      <Field mix={fieldWidth(16)}>
        <FieldLabel id={id.label} for={id.trigger}>
          Stay
        </FieldLabel>
        <Popover>
          <PopoverTrigger
            id={id.trigger}
            aria-labelledby={`${id.label} ${id.trigger}`}
            data-empty={range ? undefined : ''}
            mix={[buttonVariants({ variant: 'outline' }), triggerStyles]}
          >
            <CalendarIcon data-icon="inline-start" />
            {label ?? <span>Pick a date</span>}
          </PopoverTrigger>
          <PopoverContent
            id={id.content}
            align="start"
            aria-label="Choose dates"
            initialFocus={calendarIn(id.content)}
            mix={flushPopover}
          >
            <Calendar
              today={handle.props.today ?? today}
              locale={locale}
              name={name}
              mode="range"
              defaultMonth={from}
              value={range}
              onValueChange={(next) => {
                range = next
                void handle.update()
              }}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </Field>
    )
  }
})

/**
 * A popover you control, which closes once a day is picked, so focus returns
 * to the trigger. Month and year dropdowns reach a birth date quickly.
 */
export const DatePickerDateOfBirth = clientEntry(
  import.meta.url,
  function DatePickerDateOfBirth(handle: Handle<DatePickerProps>) {
    let date: CivilDate | null = null
    let open = false
    let id = ids(handle)

    return () => {
      let { today, locale = 'en-US', name } = handle.props
      return (
        <Field mix={fieldWidth(11)}>
          <FieldLabel id={id.label} for={id.trigger}>
            Date of birth
          </FieldLabel>
          <Popover open={open}>
            <PopoverTrigger
              id={id.trigger}
              aria-labelledby={`${id.label} ${id.trigger}`}
              mix={[buttonVariants({ variant: 'outline' }), triggerStyles]}
            >
              {date ? formatCivilDate(date, locale, { dateStyle: 'medium' }) : 'Select date'}
            </PopoverTrigger>
            <PopoverContent
              id={id.content}
              align="start"
              aria-label="Choose a date"
              initialFocus={calendarIn(id.content)}
              mix={[
                flushPopover,
                on(popoverOpenChangeType, (event) => {
                  open = event.open
                  void handle.update()
                }),
              ]}
            >
              <Calendar
                today={today}
                locale={locale}
                name={name}
                value={date}
                defaultMonth={date ?? undefined}
                max={today}
                captionLayout="dropdown"
                onValueChange={(next) => {
                  date = next
                  open = false
                  void handle.update()
                }}
              />
            </PopoverContent>
          </Popover>
        </Field>
      )
    }
  },
)

export interface DatePickerInputProps extends DatePickerProps {
  /** The day the field starts with, and returns to on a form reset. */
  defaultValue?: CivilDate
  /** Whether the form needs a day before it submits. */
  required?: boolean
  /** The field's label (defaults to "Subscription date"). */
  label?: string
}

const invalidMessage = 'Enter a day that exists, as YYYY-MM-DD, such as 2026-06-01.'

/**
 * A text field for a day as YYYY-MM-DD, with a button that opens a calendar.
 * Arrow Down in the field opens it too. The field is the form value, so it
 * submits, validates and resets natively, also without JavaScript; the
 * description repeats the day in words, and a day that doesn't exist is an
 * error, not a guess. Clear empties it.
 */
export const DatePickerInput = clientEntry(
  import.meta.url,
  function DatePickerInput(handle: Handle<DatePickerInputProps>) {
    let inputId = `${handle.id}-input`
    let hintId = `${handle.id}-hint`
    let errorId = `${handle.id}-error`
    let contentId = `${handle.id}-content`
    let input: HTMLInputElement | null = null
    let open = false
    let date = parseCivilDate(handle.props.defaultValue ?? '') ?? null
    let month: CivilDate | undefined = date ?? undefined
    let filled = date !== null
    let invalid = false

    // Reads what the field holds now: typed, autofilled, reset or written by the calendar.
    function read(showError: boolean) {
      if (!input) return
      let text = input.value
      let parsed = parseCivilDate(text)
      let wrong = text.trim() !== '' && !parsed
      input.setCustomValidity(wrong ? invalidMessage : '')
      date = parsed ?? null
      filled = text !== ''
      if (parsed) month = parsed
      if (showError || !wrong) invalid = wrong
      void handle.update()
    }

    function write(next: CivilDate | null) {
      if (!input) return
      input.value = next ?? ''
      read(true)
    }

    // A form reset puts the field back to its default once the reset finished.
    handle.queueTask(() => {
      document.addEventListener(
        'reset',
        (event) => {
          if (!input?.form || event.target !== input.form) return
          setTimeout(() => {
            if (!handle.signal.aborted && !event.defaultPrevented) read(false)
          })
        },
        { capture: true, signal: handle.signal },
      )
      // What someone typed before the script ran counts.
      read(false)
    })

    return () => {
      let { today, locale = 'en-US', name, required, label = 'Subscription date', defaultValue } = handle.props
      let description =
        date && !invalid
          ? formatCivilDate(date, locale, { dateStyle: 'full' })
          : 'Year, month and day, such as 2026-06-01.'

      return (
        <Field invalid={invalid} mix={fieldWidth(16)}>
          <FieldLabel for={inputId}>{label}</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id={inputId}
              name={name}
              required={required}
              defaultValue={defaultValue}
              placeholder="YYYY-MM-DD"
              pattern="\d{4}-\d{2}-\d{2}"
              autocomplete="off"
              spellcheck="false"
              aria-invalid={invalid ? 'true' : undefined}
              aria-describedby={describedBy(hintId, invalid && errorId)}
              mix={[
                ref((node) => (input = node)),
                on('input', () => read(false)),
                on('change', () => read(true)),
                on('keydown', (event) => {
                  if (event.key !== 'ArrowDown' || event.altKey || open) return
                  event.preventDefault()
                  open = true
                  void handle.update()
                }),
              ]}
            />
            <InputGroupAddon align="inline-end">
              {filled ? (
                <InputGroupButton
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Clear date"
                  mix={[
                    scriptOnly,
                    on('click', () => {
                      write(null)
                      input?.focus()
                    }),
                  ]}
                >
                  <XIcon />
                </InputGroupButton>
              ) : null}
              <Popover open={open}>
                <InputGroupButton size="icon-xs" variant="ghost" aria-label="Choose a date" mix={popoverTrigger()}>
                  <CalendarIcon />
                </InputGroupButton>
                <PopoverContent
                  id={contentId}
                  align="end"
                  alignOffset={-8}
                  sideOffset={10}
                  aria-label="Choose a date"
                  initialFocus={calendarIn(contentId)}
                  finalFocus={() => input}
                  mix={[
                    flushPopover,
                    on(popoverOpenChangeType, (event) => {
                      open = event.open
                      void handle.update()
                    }),
                  ]}
                >
                  <Calendar
                    today={today}
                    locale={locale}
                    value={date}
                    month={month}
                    onMonthChange={(next) => {
                      month = next
                      void handle.update()
                    }}
                    onValueChange={(next) => {
                      open = false
                      write(next)
                    }}
                  />
                </PopoverContent>
              </Popover>
            </InputGroupAddon>
          </InputGroup>
          <FieldDescription id={hintId}>{description}</FieldDescription>
          {invalid ? <FieldError id={errorId}>{invalidMessage}</FieldError> : null}
        </Field>
      )
    }
  },
)

/** A day from a popover that closes once it is picked, and a native time field beside it. */
export const DatePickerTime = clientEntry(import.meta.url, function DatePickerTime(handle: Handle<DatePickerProps>) {
  let date: CivilDate | null = null
  let open = false
  let id = ids(handle)
  let timeId = `${handle.id}-time`

  return () => {
    let { today, locale = 'en-US', name } = handle.props
    return (
      <FieldGroup mix={rowStyles}>
        <Field>
          <FieldLabel id={id.label} for={id.trigger}>
            Date
          </FieldLabel>
          <Popover open={open}>
            <PopoverTrigger
              id={id.trigger}
              aria-labelledby={`${id.label} ${id.trigger}`}
              mix={[buttonVariants({ variant: 'outline' }), spreadTriggerStyles]}
            >
              {date ? formatCivilDate(date, locale, { dateStyle: 'medium' }) : 'Select date'}
              <ChevronDownIcon data-icon="inline-end" />
            </PopoverTrigger>
            <PopoverContent
              id={id.content}
              align="start"
              aria-label="Choose a date"
              initialFocus={calendarIn(id.content)}
              mix={[
                flushPopover,
                on(popoverOpenChangeType, (event) => {
                  open = event.open
                  void handle.update()
                }),
              ]}
            >
              <Calendar
                today={today}
                locale={locale}
                name={name}
                value={date}
                defaultMonth={date ?? undefined}
                captionLayout="dropdown"
                endMonth={today && toCivilDate({ year: dateParts(today).year + 5, month: 12, day: 1 })}
                onValueChange={(next) => {
                  date = next
                  open = false
                  void handle.update()
                }}
              />
            </PopoverContent>
          </Popover>
        </Field>
        <Field>
          <FieldLabel for={timeId}>Time</FieldLabel>
          <Input
            type="time"
            id={timeId}
            name={name ? `${name}-time` : undefined}
            step={1}
            defaultValue="10:30:00"
            mix={timeInputStyles}
          />
        </Field>
      </FieldGroup>
    )
  }
})

const rtl: Record<
  'ar' | 'he',
  { locale: string; placeholder: string; choose: string; labels: Partial<CalendarLabels> }
> = {
  ar: {
    locale: 'ar-SA',
    placeholder: 'اختر تاريخًا',
    choose: 'اختر تاريخًا',
    labels: { previousMonth: 'الشهر السابق', nextMonth: 'الشهر التالي', month: 'الشهر', year: 'السنة' },
  },
  he: {
    locale: 'he-IL',
    placeholder: 'בחר תאריך',
    choose: 'בחר תאריך',
    labels: { previousMonth: 'החודש הקודם', nextMonth: 'החודש הבא', month: 'חודש', year: 'שנה' },
  },
}

/** Right to left, in Arabic or Hebrew: the trigger, the popover and the calendar mirror. */
export const DatePickerRtl = clientEntry(
  import.meta.url,
  function DatePickerRtl(handle: Handle<Omit<DatePickerProps, 'locale'> & { language?: 'ar' | 'he' }>) {
    let date: CivilDate | null = null
    let id = ids(handle)

    return () => {
      let { today, name, language = 'ar' } = handle.props
      let text = rtl[language]
      return (
        <Popover>
          <PopoverTrigger
            id={id.trigger}
            dir="rtl"
            lang={text.locale}
            data-empty={date ? undefined : ''}
            mix={[buttonVariants({ variant: 'outline' }), spreadTriggerStyles, fieldWidth(13.25)]}
          >
            {date ? longDate(date, text.locale) : <span>{text.placeholder}</span>}
            <ChevronDownIcon data-icon="inline-end" />
          </PopoverTrigger>
          <PopoverContent
            id={id.content}
            dir="rtl"
            align="start"
            aria-label={text.choose}
            initialFocus={calendarIn(id.content)}
            mix={flushPopover}
          >
            <Calendar
              today={today}
              locale={text.locale}
              labels={text.labels}
              dir="rtl"
              name={name}
              value={date}
              defaultMonth={date ?? undefined}
              onValueChange={(next) => {
                date = next
                void handle.update()
              }}
            />
          </PopoverContent>
        </Popover>
      )
    }
  },
)
