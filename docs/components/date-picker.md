# Date Picker

A Popover with a Calendar inside. There is no `DatePicker` part: the recipe composes Popover, Calendar, Field, and Input Group into pickers you copy and change. They show the picked day in words in the user's locale, and submit it as `YYYY-MM-DD`.

- Source: `registry/examples/date-picker.tsx`, a recipe. Needs `registry/ui/calendar.tsx`, `popover.tsx`, `button.tsx`, `field.tsx`, `input.tsx`, and `input-group.tsx`, and `registry/lib/civil-date.ts` and `icons.tsx`.
- Run the examples with `bun run calendar-examples`.
- Upstream: shadcn/ui's [Date Picker docs](https://ui.shadcn.com/docs/components/base/date-picker) and their [source](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/content/docs/components/base/date-picker.mdx), with the `date-picker-*` examples beside it.

## Usage

```tsx
// remixcn add date-picker installs it in your components directory.
import { DatePickerBasic, DatePickerInput } from './date-picker.tsx'

<form method="post">
  <DatePickerInput today={today} locale={locale} name="start" defaultValue="2026-06-01" required />
  <DatePickerBasic today={today} locale={locale} name="due" />
</form>
```

Each picker is a client entry. Pass `today`, worked out on the server in the user's time zone with `todayIn()`, and `locale`, so the server HTML and the browser agree.

The pieces:

```text
Field
├── FieldLabel
└── Popover
    ├── PopoverTrigger (a Button's look)
    └── PopoverContent (initialFocus: getCalendarFocusTarget)
        └── Calendar (name: the form value)
```

## The pickers

| Export | What it is | Props |
| --- | --- | --- |
| `DatePickerDemo` | shadcn's demo: an outline button with a chevron, and a calendar that stays open | `today`, `locale`, `name` |
| `DatePickerBasic` | A labelled field whose trigger shows a calendar icon and the day | `today`, `locale`, `name` |
| `DatePickerRange` | A range across two months, written the way the locale writes ranges, such as "Jan 20 – Feb 9, 2026" | `today`, `locale`, `name` |
| `DatePickerDateOfBirth` | Month and year dropdowns, no day after today, and a popover that closes once a day is picked | `today`, `locale`, `name` |
| `DatePickerInput` | A text field for `YYYY-MM-DD` with a calendar button and a clear button | `today`, `locale`, `name`, `defaultValue`, `required`, `label` |
| `DatePickerTime` | A day and a native time field side by side | `today`, `locale`, `name` (the time submits as `<name>-time`) |
| `DatePickerRtl` | Arabic or Hebrew, right to left | `today`, `name`, `language: 'ar' \| 'he'` |

## Behavior

- **Trigger.** It names itself from its label and the day it shows: `aria-labelledby` lists the label and the trigger, so a screen reader hears "Date, October 30, 2026". An empty one shows "Pick a date" in muted text.
- **Focus.** When the popover opens, focus moves to the picked day, else today, else the first available day, through `initialFocus={() => getCalendarFocusTarget(content)}`. The calendar's keys work as in [calendar.md](calendar.md). Escape and a press elsewhere close it, with focus back on the trigger. The date of birth, time, and text field pickers close once a day is picked.
- **Typed days.** `DatePickerInput` takes `YYYY-MM-DD` only. `03/04/2026` means March 4 in the United States and April 3 in most of Europe, so it is refused, not guessed. A typed day that doesn't exist, such as `2026-02-30`, is refused too: once you leave the field, it gets `aria-invalid="true"`, an error message linked by `aria-describedby`, and a custom validity that blocks the submit. While the text is a real day, the description repeats it in words, such as "Monday, June 1, 2026", and the calendar shows its month.
- **Arrow Down** in the text field opens the calendar. Picking a day writes it into the field and returns focus there. Clear empties the field and keeps focus in it.
- **Forms.** The pickers with a button submit through the calendar's hidden inputs: one value, or two for a range. The text field is the form value itself, so the browser submits, validates `required` and its `pattern`, and resets it, also without JavaScript. A form reset returns every picker to its default.
- **Without JavaScript.** The text field works, and its pattern catches other formats. A trigger opens its popover natively, but the calendar inside can't pick, and its days look disabled. Use the text field when a form must work without JavaScript.
- **Time zones.** Days are civil dates, so a browser in UTC+14 or UTC−11 submits the day it shows.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| Composition of `Popover` and `Calendar` | Same | `PopoverContent` gets `getCalendarFocusTarget` for its initial focus |
| `date-fns` `format(date, "PPP")` | `formatCivilDate(date, locale, { dateStyle: 'long' })` | The user's locale instead of English |
| `format(date, "LLL dd, y")` for ranges | `formatCivilDateRange(from, to, locale, { dateStyle: 'medium' })` | The locale's own range format |
| `date.toLocaleDateString()` | `formatCivilDate(date, locale, { dateStyle: 'medium' })` | The same text on server and browser |
| `lucide-react` icons | `CalendarIcon`, `ChevronDownIcon`, `XIcon` from `icons.tsx` | Drawn for RemixCN |
| `useState` and `onOpenChange` | Component state, `open`, and `popoverOpenChangeType` | |
| `date-picker-demo` | `DatePickerDemo` | |
| `date-picker-basic` | `DatePickerBasic` | Adds a calendar icon, as calendar-example's Date Picker Simple does |
| `date-picker-range` | `DatePickerRange` | |
| `date-picker-dob` | `DatePickerDateOfBirth` | Adds `max={today}` |
| `date-picker-input` | `DatePickerInput` | Takes `YYYY-MM-DD` instead of `new Date(text)`, which guesses; adds validation, a description in words, and a clear button |
| `date-picker-time` | `DatePickerTime` | |
| `date-picker-rtl` | `DatePickerRtl` | Arabic and Hebrew through `Intl` |
| `date-picker-natural-language` (`chrono-node`) | Not ported | It needs a parsing library, and it guesses; the brief asks for ISO entry |
| calendar-example's Date Picker with Dropdowns, with Range | `DatePickerDateOfBirth`, `DatePickerRange` | |

## Accessibility checks

Automated, in Chromium, Firefox, and WebKit (`bun run test:e2e`):

- Enter on a trigger opens the popover with focus on today; arrows, Home, End, Page Up and Page Down, with Shift too, move focus; Space picks; the trigger names the picked day; Escape closes it with focus back on the trigger; reopening lands on the picked day.
- A pointer picks a range across two months, and the date of birth picker picks a year and month from its dropdowns, keeps focus on the select, and closes with focus on the trigger.
- The text field takes a typed ISO day, refuses a day that doesn't exist and a numeric date in another order, opens on Arrow Down with focus on its day, writes the picked day back, and clears.
- A form reset returns every field to its default; an empty required field blocks the submit; the form submits the text field, the trigger's day, and both ends of a range.
- Without JavaScript the form submits and resets, the pattern catches another format, and the popover opens natively with its days dimmed.
- A browser in UTC+14 or UTC−11 submits the day it shows.
- axe-core finds no WCAG 2.2 A or AA violation, in both themes and before hydration.

Not checked, so not claimed:

- Screen readers weren't tested, nor Safari itself, nor Windows forced colors.
- This isn't an accessibility certification.
