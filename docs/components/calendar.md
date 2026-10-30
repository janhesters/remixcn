# Calendar

A month grid to pick one day, several days, or a range. It counts days as `YYYY-MM-DD` civil dates, so no time zone moves a picked day, and takes its labels, weekday order, and digits from `Intl` in the locale you pass. It ports shadcn's Calendar without react-day-picker or date-fns.

- Source: `registry/ui/calendar.tsx`. Needs `registry/lib/theme.css`, `styles.ts`, `icons.tsx`, `civil-date.ts`, and `registry/ui/button.tsx`.
- Examples: `registry/examples/calendar-example.tsx`. Run them with `bun run calendar-examples`.
- Upstream: shadcn/ui [`calendar.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/calendar.tsx), its [examples](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/examples/calendar-example.tsx), its [docs](https://ui.shadcn.com/docs/components/base/calendar), and [React DayPicker](https://react-day-picker.js.org) for the behavior.

## Usage

```tsx
import { clientEntry } from 'remix/component'
import type { Handle } from 'remix/component'

import type { CivilDate } from '#remixcn/lib/civil-date.ts'
import { Calendar } from '#remixcn/ui/calendar.tsx'

export const DueDate = clientEntry(import.meta.url, function DueDate(handle: Handle<{ today: CivilDate }>) {
  let date: CivilDate | null = null

  return () => (
    <Calendar
      today={handle.props.today}
      locale="en-US"
      value={date}
      onValueChange={(next) => {
        date = next
        void handle.update()
      }}
    />
  )
})
```

Render it on the server with the user's today and locale:

```tsx
import { todayIn } from '#remixcn/lib/civil-date.ts'

<DueDate today={todayIn(user.timeZone)} />
```

The calendar runs in the browser inside your client entry, like Button, so it takes your functions and mixins. The server HTML and the browser match as long as both get the same `today` and `locale`. Without `today`, each works out today on its own clock, and they can disagree around midnight.

## Dates

A civil date is a string such as `'2026-10-30'`, typed `CivilDate`. `registry/lib/civil-date.ts` does the arithmetic with integers in the Gregorian calendar, so no `Date` parses a string and no host time zone moves a day:

| Function | What it does |
| --- | --- |
| `isCivilDate(value)`, `parseCivilDate(text)` | Accept only real days written `YYYY-MM-DD`, years 0001 to 9999. `parseCivilDate` trims spaces and refuses every other format, such as `03/04/2026`, instead of guessing which day it means |
| `toCivilDate({ year, month, day })`, `dateParts(date)` | Build and split a day. `toCivilDate` throws a `RangeError` for a day that doesn't exist |
| `addDays`, `addMonths`, `addYears` | Move a day. A month later than January 31 is February 28 or 29. Results stop at 0001-01-01 and 9999-12-31 |
| `compareDates`, `daysBetween`, `clampDate` | Compare, count, and bound days |
| `dayOfWeek`, `startOfWeek`, `endOfWeek`, `startOfMonth`, `endOfMonth`, `daysInMonth`, `isLeapYear` | Find the week and month of a day |
| `weekNumber(date, { weekStartsOn, firstWeekContainsDate })` | The week's number: ISO 8601 with Monday and 4, the United States' with Sunday and 1 |
| `weekStartOf(locale)` | The locale's first day of the week, from `Intl.Locale`'s week info. Monday when the engine can't tell |
| `todayIn(timeZone?, now?)` | Today in a time zone, the only function that reads the clock |
| `formatCivilDate`, `formatCivilDateRange`, `toUTCDate` | Format a day or a range for people with `Intl`, in UTC and the Gregorian calendar, so the host's zone and the locale's preferred calendar change nothing |

Node's ICU and the browsers' disagree about some spaces: Node puts thin spaces around a range's dash. The formatters write plain spaces, so the server text matches hydration.

## API

### `Calendar`

A `<div data-slot="calendar">` with the previous and next buttons, a caption and a grid per month, and hidden inputs for the form. It takes every `div` prop and `mix`. `mode` picks the value's shape:

| Mode | `value`, `defaultValue` | `onValueChange(value, details)` | Form entries under `name` |
| --- | --- | --- | --- |
| `'single'` (default) | `CivilDate \| null` | the day, or `null` once it's unpicked | one, `''` when empty |
| `'multiple'` | `CivilDate[]`, sorted | the sorted days | one per day |
| `'range'` | `{ from, to? } \| null` | the range, `to` missing while it's being picked | two: from and to, `''` for a missing end |

`details` is `{ date, reason }`: the day pressed, by pointer or keyboard (`'day-press'`), or `undefined` for a form reset (`'reset'`). A calendar with `value` shows only that value. Without it, the calendar keeps its own, starting from `defaultValue`.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `locale` | `string` | `'en-US'` | The BCP 47 locale of the labels, weekday order, and digits. It also sets `lang` on the root |
| `dir` | `'ltr' \| 'rtl'` | inherited | The direction. It mirrors the layout and the left and right arrow keys |
| `today` | `CivilDate` | today in `timeZone` | The day it marks and opens on |
| `timeZone` | `string` | the host's | The zone of today when you pass no `today` |
| `month`, `defaultMonth` | `CivilDate` | the first picked day's month, else today's | Any day of the first month shown. Update `month` from `onMonthChange` |
| `onMonthChange` | `(month) => void` | | Called with the first day of the new first month |
| `numberOfMonths` | `number` | `1` | Months side by side, stacked below 48rem |
| `pagedNavigation` | `boolean` | `false` | Whether previous and next move by every shown month |
| `reverseMonths` | `boolean` | `false` | Whether the latest month comes first |
| `startMonth`, `endMonth` | `CivilDate` | `min` and `max`, or 100 years back to this December with a year dropdown | The months navigation reaches |
| `min`, `max` | `CivilDate` | | The earliest and latest day that can be picked |
| `disabled` | `CalendarMatcher` | | Days that can't be picked. `true` disables the whole calendar and its form value |
| `hidden` | `CalendarMatcher` | | Days that don't show |
| `required` | `boolean` | `false` | Whether a picked value can't become empty again |
| `minSelected`, `maxSelected` | `number` | | Multiple mode: the fewest days that stay picked, and the most. Once the most are picked, the other days are disabled |
| `minDays`, `maxDays` | `number` | | Range mode: the fewest and most days a range spans, both ends counted. A range outside them starts over at the pressed day |
| `excludeDisabled` | `boolean` | `false` | Range mode: a range that would hold a disabled day starts over at the pressed day |
| `modifiers` | `Record<string, CalendarMatcher>` | | Custom states. Each matching day's cell gets `data-<name>`. Names are lowercase letters, digits, and hyphens |
| `modifierStyles` | `Record<string, MixValue>` | | Mixins for the day buttons of each custom state |
| `showOutsideDays` | `boolean` | `true` | Whether days of the neighboring months fill the first and last weeks |
| `fixedWeeks` | `boolean` | `false` | Whether every month shows six weeks |
| `showWeekNumber` | `boolean` | `false` | Whether a column numbers the weeks |
| `hideWeekdays` | `boolean` | `false` | Whether the weekday row is left out |
| `weekStartsOn` | `0`–`6` | the locale's | The first day of the week, 0 for Sunday |
| `firstWeekContainsDate` | `1`–`7` | `4` for Monday weeks, else `1` | The day of January always in week 1 |
| `ISOWeek` | `boolean` | `false` | Monday weeks numbered as in ISO 8601, whatever the locale |
| `captionLayout` | `'label' \| 'dropdown' \| 'dropdown-months' \| 'dropdown-years'` | `'label'` | A label, or native selects for the month, the year, or both |
| `hideNavigation`, `disableNavigation` | `boolean` | `false` | Leave out the previous and next buttons, or keep the months, also for the keyboard |
| `buttonVariant` | `ButtonVariant` | `'ghost'` | The look of the previous and next buttons |
| `labels` | `Partial<CalendarLabels>` | English | The text it adds: `previousMonth`, `nextMonth`, `month`, `year`, `weekNumberHeader`, and `weekNumber(week)` |
| `formatters` | `Partial<CalendarFormatters>` | `Intl` | How it writes the `caption`, `monthDropdown`, `yearDropdown`, `weekday`, `day`, `dayLabel`, and `weekNumber`. Each gets the locale |
| `renderDay` | `(day: CalendarDay) => RemixNode` | the day's number | What a day's button shows |
| `footer` | `RemixNode` | | Text below the months, in a polite live region |
| `name`, `form` | `string` | | The form field name and the id of a form outside it |

A `CalendarMatcher` is a day, `{ from, to }` with both ends, `{ before }`, `{ after }`, `{ dayOfWeek: [0, 6] }`, a function `(date) => boolean`, `true`, or a list of them. `matchesDate(date, matcher)` tests one.

Each day is a `CalendarDay`: its `date`, the `month` of its grid, and `outside`, `today`, `selected`, `disabled`, `hidden`, `rangeStart`, `rangeEnd`, `rangeMiddle`, and its `modifiers`.

The root renders `data-mode` and `data-disabled`. Each month is a `<table role="grid">` named by its month, with `aria-multiselectable` in multiple and range mode. Each day's cell is a `gridcell` with `data-day`, `aria-selected`, and `data-outside`, `data-today`, `data-selected`, `data-disabled`, `data-hidden`, `data-range-start`, `data-range-middle`, and `data-range-end`. The CSS variables `--cell-size` and `--cell-radius` size the cells. Set them on the calendar or an ancestor.

### `CalendarDayButton`

The `<button>` of one day, which the calendar renders in each cell. It takes a `day` and every button prop. It renders `data-day`, `data-today`, `data-outside`, `data-selected-single`, `data-range-start`, `data-range-middle`, `data-range-end`, `aria-current="date"` for today, and `disabled`. Use it for days outside a calendar that should look the same.

### `getCalendarFocusTarget(root)`

Returns the day button that is in the tab order inside `root`: the focused, a picked, today's, or the first available day. Pass it to a popover's `initialFocus`, as the Date Picker does.

### `addToRange(date, range, options)`

The range after a press on `date`, as the calendar picks it. Exported for your own controls.

### Also exported

The types `CalendarProps`, `CalendarSingleProps`, `CalendarMultipleProps`, `CalendarRangeProps`, `CalendarMode`, `DateRange`, `CalendarMatcher`, `CalendarDay`, `CalendarCaptionLayout`, `CalendarLabels`, `CalendarFormatters`, `CalendarChangeDetails`, `CalendarChangeReason`, `CalendarDayButtonProps`, and `RangeOptions`.

## Behavior

- **Keyboard.** One day is in the tab order. Arrow keys move a day or a week, Home and End to the edges of the week, Page Up and Page Down a month, and with Shift a year. Enter and Space pick. Focus follows into the next month and stops at the months navigation reaches. Moves skip disabled and hidden days; Home and End take the nearest available day in the week. In right-to-left text, the left arrow moves forward.
- **Tab stop.** Once focus leaves the grid, the tab stop returns to the first picked day, else today, else the first available day of the first month.
- **Ranges.** The first press starts a range of one day, or an open one with `minDays` over 1. A later day ends it; an earlier one moves its start; a day inside it moves its end; its start or end makes it one day long; a press on a one-day range clears it, unless it's `required`. This follows react-day-picker 9's `addToRange`.
- **Controlled month.** A calendar with `month` shows only that month. If you keep it when the keyboard asks for another, focus stays on its day.
- **Dropdowns.** The month and year are native selects over a label. Picking one moves the grid and keeps focus on the select. In a later month, the first month moves so that grid shows the pick, and each grid offers only the months it can show within the bounds.
- **Changing the mode.** A calendar that keeps its own value converts it when `mode` changes, and so does the value a form reset returns to: one day becomes a list of one or a one-day range, a list keeps its first day or spans its days, and a range keeps its start or lists its ends. A `value` in another mode's shape is read the same way.
- **Forms.** With `name`, hidden inputs hold the value, and `form` names a form outside it. A form reset returns the calendar to `defaultValue`, or the value a controlled calendar first rendered, after any listener could cancel it, and calls `onValueChange` with `reason: 'reset'`. `disabled={true}` disables the inputs, so the form leaves the value out.
- **Without JavaScript.** The server renders the months, today, and the picked days, and the form submits the default value. Days can't be picked, so under `@media (scripting: none)` the buttons and selects look disabled and take no pointer. Use the Date Picker's text field for a form that must work without JavaScript.
- **Locales.** `Intl` writes the labels, digits, and weekday names. Where the short weekday names are whole words, such as in Arabic, Hebrew, and Persian, the headings use the narrow ones, so they fit a cell. The grid is always Gregorian.
- **Custom content.** A day's button is named by its full date. When `renderDay` adds visible text, add it to the name with `formatters.dayLabel`, so the name holds what the button shows, as the Custom days example does.
- **Narrow screens.** Cells stay at least `--cell-size` wide. A month needs both dimensions, so where it doesn't fit, such as at 320px with text at 200%, the calendar scrolls sideways inside itself and the page doesn't.
- **Several calendars** keep their own state and form values.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `Calendar` on react-day-picker's `DayPicker` | `Calendar` | A Remix component; no react-day-picker or date-fns |
| `Date` values | `CivilDate` strings | `YYYY-MM-DD`, so no time zone shifts a day |
| `mode` `'single'`, `'multiple'`, `'range'` | Same | |
| `selected`, `onSelect` | `value`, `defaultValue`, `onValueChange` | `details` replaces the event and modifiers arguments |
| `required` | Same | |
| `min`, `max` for multiple | `minSelected`, `maxSelected` | Unpicked days are disabled at the maximum |
| `min`, `max` for range | `minDays`, `maxDays` | Count days, both ends included, instead of nights |
| `excludeDisabled` | Same | |
| `month`, `defaultMonth`, `onMonthChange` | Same | The default month is the first picked day's, else today's |
| `startMonth`, `endMonth` | Same, plus `min` and `max` | `fromYear`, `toYear`, and the other deprecated bounds aren't ported |
| `numberOfMonths`, `pagedNavigation`, `reverseMonths` | Same | |
| `disabled`, `hidden`, `modifiers` | Same | Matchers take civil dates |
| `modifiersClassNames`, `modifiersStyles`, `classNames`, `styles` | `modifierStyles` and `mix` | Mixins instead of Tailwind classes |
| `showOutsideDays` (shadcn default `true`), `fixedWeeks`, `showWeekNumber`, `hideWeekdays` | Same | |
| `weekStartsOn`, `firstWeekContainsDate`, `ISOWeek` | Same | The default week start comes from `Intl.Locale` |
| `captionLayout` | Same | `'dropdown'` lists the months of the shown year and the years navigation reaches |
| `hideNavigation`, `disableNavigation` | Same | `navLayout` and `animate` aren't ported |
| `locale` (a date-fns `Locale`) | `locale`, a BCP 47 string | `Intl` replaces the locale data |
| `dir` | Same | |
| `today`, `timeZone` | Same | `timeZone` only places today; days have no zone |
| `labels` | `labels` | Plain strings for the previous and next buttons, dropdowns, and week numbers. The day name comes from `formatters.dayLabel` |
| `formatters` | `formatters` | `caption`, `monthDropdown`, `yearDropdown`, `weekday`, `day`, `dayLabel`, `weekNumber`. shadcn's short month dropdown stays the default |
| `footer` | Same | A polite live region |
| `components` (`DayButton`, `Chevron`, `WeekNumber`, and the rest) | `renderDay`, `CalendarDayButton`, `formatters` | Content and look are props; the parts aren't replaceable components |
| `CalendarDayButton` | Same | Takes a `CalendarDay` instead of `day` and `modifiers` |
| `buttonVariant` | Same | |
| `autoFocus` | `getCalendarFocusTarget()` | Pass it to a popover's `initialFocus` |
| `onDayClick`, `onDayFocus`, `onDayKeyDown`, `onNextClick`, `onPrevClick`, and the other day handlers | Not ported | Use `onValueChange`, `onMonthChange`, or your own `mix` on the root |
| `numerals`, `broadcastCalendar`, `useAdditionalWeekYearTokens`, `useAdditionalDayOfYearTokens` | Not ported | The locale's `-u-nu-` extension picks the digits |
| Persian, Hijri, and Jalali calendars (`react-day-picker/persian`) | Not ported | The grid is Gregorian. Other calendars need their own arithmetic |
| `data-day` on the button, a locale date string | `data-day`, `YYYY-MM-DD` | The same on server and browser |
| `aria-label` "Today, …, selected" on day buttons | The full date, `aria-current="date"`, and `aria-selected` on the cell | Today and the pick come from ARIA states |
| `<nav aria-label="Navigation bar">` | A plain `div` | Several calendars on a page would each add a landmark |
| Classes in `style-vega.css`: `p-3`, `--cell-size` 2rem, `--cell-radius`, the dropdown border | Same measures and colors | Today also gets a heavier weight; picked days get edges in forced colors |
| `rtl:**:[.rdp-button_next>svg]:rotate-180` | Chevrons mirror in right-to-left text | |
| Examples: Single, Multiple, Week Numbers, Booked Dates, Range, Range Multiple Months, With Time, With Presets, Custom Days, In Card, In Popover | `CalendarSingle`, `CalendarMultiple`, `CalendarWeekNumbers`, `CalendarBookedDates`, `CalendarRange`, `CalendarRangeMultipleMonths`, `CalendarWithTime`, `CalendarWithPresets`, `CalendarCustomDays`, `CalendarInCard`, `CalendarInPopover` | Dates follow `today` instead of `new Date()` |
| Docs: Basic, Month and Year Selector, RTL | `CalendarBasic`, `CalendarSingle`, `CalendarRtl` | |
| Docs: Persian / Hijri / Jalali Calendar | Not ported | See above |
| Docs: Selected Date (With TimeZone) | `today` and `todayIn()` | A civil date can't shift, so no zone is needed for the pick |
| Example: Date Picker Simple, With Dropdowns, With Range | The Date Picker recipe | See [date-picker.md](date-picker.md) |

## Accessibility checks

Automated, in Chromium, Firefox, and WebKit (`bun run test`, `test:browser`, `test:e2e`):

- The server HTML has a grid per month named by its month, a `gridcell` per day with `aria-selected`, day buttons named by their full date, `aria-current="date"` on today, and one day in the tab order.
- Arrow keys, Home, End, Page Up, Page Down, and Shift with them move focus as described, across month, year, and leap-day boundaries; focus follows into the next month; disabled and hidden days are skipped; bounds stop it; right-to-left text mirrors the arrows.
- A press picks and unpicks in each mode; a controlled calendar shows only its value; changed props (value, locale, week start, month, disabled days, months shown) render at once.
- Forms submit the value under `name`, and a form reset returns to the default unless a listener cancels it.
- Server HTML hydrates in place without a changed attribute or text; a browser in UTC+14 or UTC−11 keeps today and every picked day, and submits the day it shows.
- axe-core finds no WCAG 2.2 A or AA violation on the examples, in both themes and before hydration.
- Text keeps 4.5:1 for picked, today, range, outside, and weekday text in both themes.
- The page fits 320px without scrolling sideways, also with text at 200%; the calendar scrolls inside itself and focus scrolls a day into view.
- Picked days get solid edges and range days dashed ones in forced colors, and today a heavier, underlined number; the fills fade only without reduced motion.

Not checked, so not claimed:

- Screen readers (NVDA, JAWS, VoiceOver, TalkBack) weren't tested.
- Safari itself wasn't run, only Playwright's WebKit. Forced colors were emulated in Chromium, not tested in Windows.
- This isn't an accessibility certification.
