// The Calendar and Date Picker examples on one synthetic page, with a form
// that sends to /echo, other locales, both themes side by side, right-to-left
// text and a calendar the server renders outside any client entry. It is a
// test fixture for browser tests and UI reviews, not the public site.
import { css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'
import type { ImportMapData } from 'remix/component/server'

import {
  CalendarBasic,
  CalendarBookedDates,
  CalendarCustomDays,
  CalendarInCard,
  CalendarInPopover,
  CalendarMultiple,
  CalendarRange,
  CalendarRangeMultipleMonths,
  CalendarRtl,
  CalendarSingle,
  CalendarWeekNumbers,
  CalendarWithPresets,
  CalendarWithTime,
} from '../../../registry/examples/calendar-example.tsx'
import {
  DatePickerBasic,
  DatePickerDateOfBirth,
  DatePickerDemo,
  DatePickerInput,
  DatePickerRange,
  DatePickerRtl,
  DatePickerTime,
} from '../../../registry/examples/date-picker.tsx'
import type { CivilDate } from '#remixcn/lib/civil-date.ts'
import { buttonVariants } from '#remixcn/ui/button.tsx'
import { Calendar } from '#remixcn/ui/calendar.tsx'
import { FormRange, LocaleCalendar } from './islands.tsx'

interface ScriptEntry {
  href: string
  importMap: ImportMapData
  preloads: readonly string[]
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const shrinkingColumn = 'minmax(0, 1fr)'

const pageStyles = css({
  maxWidth: '76rem',
  marginInline: 'auto',
  padding: space(6),
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  gap: space(12),
  '@media (max-width: 40rem)': { padding: space(4), gap: space(10) },
})
const headerStyles = css({
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  gap: space(2),
  '& p': { margin: 0, maxWidth: '40rem', overflowWrap: 'anywhere' },
})
const titleStyles = css({
  margin: 0,
  fontSize: 'var(--text-3xl)',
  lineHeight: 'var(--text-3xl--line-height)',
  fontWeight: 600,
  letterSpacing: '-0.025em',
  overflowWrap: 'anywhere',
})
const sectionStyles = css({ display: 'grid', gridTemplateColumns: shrinkingColumn, gap: space(6) })
const sectionTitleStyles = css({
  margin: 0,
  fontSize: 'var(--text-xl)',
  lineHeight: 'var(--text-xl--line-height)',
  fontWeight: 600,
  overflowWrap: 'anywhere',
})
const gridStyles = css({
  display: 'grid',
  gap: space(6),
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 20rem), 1fr))',
})
const exampleStyles = css({
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  alignContent: 'start',
  justifyItems: 'start',
  gap: space(3),
  margin: 0,
  padding: space(5),
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  '& > h3': {
    margin: 0,
    fontSize: 'var(--text-base)',
    lineHeight: 'var(--text-base--line-height)',
    fontWeight: 600,
    overflowWrap: 'anywhere',
  },
  '@media (max-width: 40rem)': { padding: space(3) },
})
const wideStyles = css({ gridColumn: '1 / -1' })
const mutedStyles = css({
  margin: 0,
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  overflowWrap: 'anywhere',
})
const formStyles = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 18rem), 1fr))',
  alignItems: 'start',
  gap: space(6),
})
const actionsStyles = css({ display: 'flex', flexWrap: 'wrap', gap: space(2), gridColumn: '1 / -1' })
const themesStyles = css({
  display: 'grid',
  gap: space(6),
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 22rem), 1fr))',
})
const themePanelStyles = css({
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  justifyItems: 'start',
  gap: space(5),
  alignContent: 'start',
  padding: space(6),
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  backgroundColor: 'var(--background)',
  color: 'var(--foreground)',
  '& h3': { margin: 0, fontSize: 'var(--text-base)', fontWeight: 600 },
  '@media (max-width: 40rem)': { padding: space(3) },
})
const echoListStyles = css({
  display: 'grid',
  gridTemplateColumns: 'max-content minmax(0, 1fr)',
  gap: `${space(2)} ${space(4)}`,
  margin: 0,
  '& > div': { display: 'contents' },
  '& dt': { fontWeight: 600 },
  '& dd': { margin: 0, overflowWrap: 'anywhere' },
})
const bordered = css({ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' })

function Section(handle: Handle<{ id: string; title: string; description: string; children?: RemixNode }>) {
  return () => {
    let { id, title, description, children } = handle.props

    return (
      <section aria-labelledby={id} mix={sectionStyles}>
        <h2 id={id} mix={sectionTitleStyles}>
          {title}
        </h2>
        <p mix={mutedStyles}>{description}</p>
        {children}
      </section>
    )
  }
}

function Example(
  handle: Handle<{ title: string; name: string; description?: string; wide?: boolean; children?: RemixNode }>,
) {
  return () => {
    let { title, name, description, wide, children } = handle.props

    return (
      <figure mix={[exampleStyles, wide ? wideStyles : null]} data-example={name}>
        <h3>{title}</h3>
        {description ? <p mix={mutedStyles}>{description}</p> : null}
        {children}
      </figure>
    )
  }
}

function Document(
  handle: Handle<{ title: string; stylesheets: string[]; script?: ScriptEntry; children?: RemixNode }>,
) {
  return () => {
    let { title, stylesheets, script, children } = handle.props

    return (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content="light dark" />
          {stylesheets.map((href) => (
            <link key={href} rel="stylesheet" href={href} />
          ))}
          <title>{title}</title>
          {script ? <ImportMap value={script.importMap} /> : null}
          {script?.preloads.map((href) => (
            <link key={href} rel="modulepreload" href={href} />
          ))}
          {script ? <script type="module" src={script.href}></script> : null}
        </head>
        <body>{children}</body>
      </html>
    )
  }
}

function ThemePanel(handle: Handle<{ theme: 'light' | 'dark'; today: CivilDate }>) {
  return () => {
    let { theme, today } = handle.props

    return (
      <div data-theme={theme} mix={themePanelStyles} data-example={`${theme}-theme`}>
        <h3>{theme === 'light' ? 'Light' : 'Dark'}</h3>
        <FormRange today={today} name={`${theme}-stay`} from="2026-10-12" to="2026-10-16" />
        <DatePickerBasic today={today} />
      </div>
    )
  }
}

export function CalendarExamples(handle: Handle<{ stylesheets: string[]; script: ScriptEntry; today: CivilDate }>) {
  return () => {
    let { today } = handle.props

    return (
      <Document
        title="RemixCN Calendar and Date Picker examples"
        stylesheets={handle.props.stylesheets}
        script={handle.props.script}
      >
        <main mix={pageStyles}>
          <header mix={headerStyles}>
            <h1 mix={titleStyles}>Calendar and Date Picker</h1>
            <p>Every example from registry/examples, rendered on the server and hydrated as client entries.</p>
            <p mix={mutedStyles}>
              A synthetic test fixture with invented data, not the public site. Today is {today} on every example.
            </p>
          </header>

          <Section
            id="calendar"
            title="Calendar"
            description="Arrow keys move a day or a week, Home and End to the week's edges, Page Up and Page Down a month, with Shift a year."
          >
            <div mix={gridStyles}>
              <Example title="Basic" name="calendar-basic">
                <CalendarBasic today={today} />
              </Example>
              <Example title="Single" name="calendar-single" description="Month and year dropdowns.">
                <CalendarSingle today={today} />
              </Example>
              <Example title="Multiple" name="calendar-multiple">
                <CalendarMultiple today={today} />
              </Example>
              <Example title="Week numbers" name="calendar-week-numbers">
                <CalendarWeekNumbers today={today} />
              </Example>
              <Example title="Booked dates" name="calendar-booked" description="Booked days can't be picked.">
                <CalendarBookedDates today={today} />
              </Example>
              <Example title="In a card" name="calendar-in-card">
                <CalendarInCard today={today} />
              </Example>
              <Example title="With time" name="calendar-with-time">
                <CalendarWithTime today={today} />
              </Example>
              <Example title="With presets" name="calendar-presets">
                <CalendarWithPresets today={today} />
              </Example>
              <Example title="Custom days" name="calendar-custom-days" description="Larger cells with a price." wide>
                <CalendarCustomDays today={today} />
              </Example>
              <Example title="In a popover" name="calendar-in-popover">
                <CalendarInPopover today={today} />
              </Example>
              <Example title="Range" name="calendar-range" description="Two months, up to today." wide>
                <CalendarRange today={today} />
              </Example>
              <Example
                title="Range over three months"
                name="calendar-range-months"
                description="Spanish, six weeks each."
                wide
              >
                <CalendarRangeMultipleMonths today={today} />
              </Example>
            </div>
          </Section>

          <Section
            id="date-picker"
            title="Date Picker"
            description="A Popover with a Calendar inside. Focus moves to the picked day, today or the first day when it opens."
          >
            <div mix={gridStyles}>
              <Example title="Demo" name="date-picker-demo">
                <DatePickerDemo today={today} />
              </Example>
              <Example title="Basic" name="date-picker-basic">
                <DatePickerBasic today={today} />
              </Example>
              <Example title="Range" name="date-picker-range">
                <DatePickerRange today={today} />
              </Example>
              <Example title="Date of birth" name="date-picker-dob" description="Closes once a day is picked.">
                <DatePickerDateOfBirth today={today} />
              </Example>
              <Example title="Input" name="date-picker-input" description="Type YYYY-MM-DD, or press Arrow Down.">
                <DatePickerInput today={today} defaultValue="2026-06-01" />
              </Example>
              <Example title="Time" name="date-picker-time">
                <DatePickerTime today={today} />
              </Example>
            </div>
          </Section>

          <Section
            id="form"
            title="Form"
            description="The values go to /echo. Reset returns every field to its default, also without JavaScript."
          >
            <form method="post" action="/echo" mix={formStyles} data-example="form">
              <DatePickerInput
                today={today}
                name="subscription"
                label="Subscription date"
                defaultValue="2026-06-01"
                required
              />
              <DatePickerBasic today={today} name="due" />
              <FormRange today={today} name="stay" from="2026-10-12" to="2026-10-16" />
              <div mix={actionsStyles}>
                <button type="submit" mix={buttonVariants()}>
                  Send
                </button>
                <button type="reset" mix={buttonVariants({ variant: 'outline' })}>
                  Reset
                </button>
              </div>
            </form>
          </Section>

          <Section
            id="locales"
            title="Locales"
            description="Intl gives the labels, digits and the first day of the week."
          >
            <div mix={gridStyles}>
              <Example title="German, ISO weeks" name="locale-de">
                <LocaleCalendar today={today} locale="de-CH" showWeekNumber />
              </Example>
              <Example title="US English, Sunday weeks" name="locale-en-us">
                <LocaleCalendar today={today} locale="en-US" showWeekNumber />
              </Example>
              <Example title="Persian locale, Saturday weeks" name="locale-fa">
                <LocaleCalendar today={today} locale="fa-IR" dir="rtl" />
              </Example>
            </div>
          </Section>

          <Section id="themes" title="Themes" description="data-theme overrides the system preference inside it.">
            <div mix={themesStyles}>
              <ThemePanel theme="light" today={today} />
              <ThemePanel theme="dark" today={today} />
            </div>
          </Section>

          <Section
            id="right-to-left"
            title="Right to left"
            description="The grid, the navigation and the arrow keys mirror."
          >
            <div dir="rtl" mix={gridStyles}>
              <Example title="العربية" name="rtl-ar">
                <CalendarRtl today={today} language="ar" />
              </Example>
              <Example title="עברית" name="rtl-he">
                <CalendarRtl today={today} language="he" />
              </Example>
              <Example title="منتقي التاريخ" name="rtl-date-picker">
                <DatePickerRtl today={today} language="ar" />
              </Example>
            </div>
          </Section>

          <Section
            id="server-only"
            title="Server only"
            description="Rendered by the page, outside any client entry, so no calendar code runs in the browser."
          >
            <div mix={gridStyles}>
              <Example
                title="Calendar"
                name="server-calendar"
                description="It shows its month and picked day, and its buttons look disabled without JavaScript."
              >
                <Calendar today={today} defaultValue="2026-10-12" mix={bordered} />
              </Example>
            </div>
          </Section>
        </main>
      </Document>
    )
  }
}

export function Echo(handle: Handle<{ stylesheets: string[]; fields: Array<[string, string]> }>) {
  return () => {
    let { stylesheets, fields } = handle.props

    return (
      <Document title="Received" stylesheets={stylesheets}>
        <main mix={pageStyles}>
          <h1 mix={titleStyles}>Received</h1>
          <dl mix={echoListStyles} data-echo="fields">
            {fields.map(([name, value], index) => (
              <div key={`${name}-${index}`}>
                <dt>{name}</dt>
                <dd>{value === '' ? '(empty)' : value}</dd>
              </div>
            ))}
          </dl>
          <a href="/">Back to the examples</a>
        </main>
      </Document>
    )
  }
}
