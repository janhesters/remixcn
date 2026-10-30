// Client entries of the fixture, not examples to copy: a range calendar for
// the form, and calendars in other locales and week numberings.
import { clientEntry, css } from 'remix/component'
import type { Handle } from 'remix/component'

import type { CivilDate } from '#remixcn/lib/civil-date.ts'
import { Calendar } from '#remixcn/ui/calendar.tsx'

const bordered = css({ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' })

/** A range the form submits as two values under its name. */
export const FormRange = clientEntry(
  import.meta.url,
  function FormRange(handle: Handle<{ today: CivilDate; name: string; from: CivilDate; to: CivilDate }>) {
    return () => {
      let { today, name, from, to } = handle.props
      return (
        <Calendar
          today={today}
          mode="range"
          name={name}
          defaultValue={{ from, to }}
          role="group"
          aria-label="Stay"
          mix={bordered}
        />
      )
    }
  },
)

/** A calendar in a locale, optionally with week numbers or another week start. */
export const LocaleCalendar = clientEntry(
  import.meta.url,
  function LocaleCalendar(
    handle: Handle<{
      today: CivilDate
      locale: string
      dir?: 'ltr' | 'rtl'
      showWeekNumber?: boolean
      weekStartsOn?: 0 | 1 | 6
    }>,
  ) {
    return () => {
      let { today, locale, dir, showWeekNumber, weekStartsOn } = handle.props
      return (
        <Calendar
          today={today}
          locale={locale}
          dir={dir}
          showWeekNumber={showWeekNumber}
          weekStartsOn={weekStartsOn}
          defaultValue="2026-10-12"
          mix={bordered}
        />
      )
    }
  },
)
