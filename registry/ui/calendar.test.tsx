import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, tags, text } from '../../test/html.ts'
import { addToRange, Calendar, matchesDate } from './calendar.tsx'
import type { CalendarProps } from './calendar.tsx'

const today = '2026-10-30'

function render(props: Partial<CalendarProps> = {}) {
  return renderToString(<Calendar today={today} {...(props as CalendarProps)} />)
}

function days(html: string) {
  return tags(html, 'td').filter((tag) => tag.attributes.get('data-slot') === 'calendar-day')
}

function dayButtons(html: string) {
  return tags(html, 'button').filter((tag) => tag.attributes.get('data-slot') === 'calendar-day-button')
}

function button(html: string, date: string) {
  let found = dayButtons(html).filter((tag) => tag.attributes.get('data-day') === date)
  assert.ok(found.length > 0, `no button for ${date}`)
  return found[0].attributes
}

function cell(html: string, date: string, outside = false) {
  let found = days(html).find(
    (tag) => tag.attributes.get('data-day') === date && tag.attributes.has('data-outside') === outside,
  )
  assert.ok(found, `no cell for ${date}`)
  return found.attributes
}

function weekdayHeadings(html: string) {
  let headings = [...html.matchAll(/<th[^>]*data-slot="calendar-weekday"[^>]*>([^<]*)<\/th>/g)]
  return headings.map((match) => match[1])
}

function tabStops(html: string) {
  return dayButtons(html)
    .filter((tag) => tag.attributes.get('tabindex') === '0')
    .map((tag) => tag.attributes.get('data-day'))
}

function hiddenInputs(html: string) {
  return tags(html, 'input')
    .filter((tag) => tag.attributes.get('type') === 'hidden')
    .map((tag) => [tag.attributes.get('name'), tag.attributes.get('value')])
}

function inTimeZone<T>(timeZone: string, run: () => T): T {
  let previous = process.env.TZ
  process.env.TZ = timeZone
  try {
    return run()
  } finally {
    if (previous === undefined) delete process.env.TZ
    else process.env.TZ = previous
  }
}

describe('Calendar on the server', () => {
  it('renders the month of today as a grid of day buttons with one tab stop', async () => {
    let html = await render()
    let root = attributes(html, 'slot:calendar')
    let grid = attributes(html, 'table')

    assert.equal(root.get('lang'), 'en-US')
    assert.equal(root.get('data-mode'), 'single')
    assert.equal(grid.get('role'), 'grid')
    assert.equal(grid.get('aria-label'), 'October 2026')
    assert.equal(grid.has('aria-multiselectable'), false)
    assert.match(text(html), /October 2026/)
    assert.deepEqual(weekdayHeadings(html), ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
    assert.equal(attributes(html, 'thead').get('aria-hidden'), 'true')
    // September 27 to October 31: five weeks.
    assert.equal(days(html).length, 35)
    assert.equal(cell(html, '2026-09-27', true).has('data-outside'), true)
    assert.equal(cell(html, '2026-10-01').has('data-outside'), false)

    let friday = button(html, today)
    assert.equal(friday.get('type'), 'button')
    assert.equal(friday.get('aria-label'), 'Friday, October 30, 2026')
    assert.equal(friday.get('aria-current'), 'date')
    assert.equal(friday.has('data-today'), true)
    assert.equal(cell(html, today).has('data-today'), true)
    assert.deepEqual(tabStops(html), [today])
    assert.equal(button(html, '2026-10-29').get('tabindex'), '-1')

    assert.equal(attributes(html, 'slot:calendar-previous').get('aria-label'), 'Previous month')
    assert.equal(attributes(html, 'slot:calendar-next').get('aria-label'), 'Next month')
  })

  it('takes the weekday order, labels and digits from the locale', async () => {
    let german = await render({ locale: 'de-CH' })
    assert.deepEqual(weekdayHeadings(german), ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'])
    assert.equal(attributes(german, 'table').get('aria-label'), 'Oktober 2026')
    assert.equal(button(german, today).get('aria-label'), 'Freitag, 30. Oktober 2026')
    assert.equal(attributes(german, 'slot:calendar').get('lang'), 'de-CH')
    // September 28 to November 1.
    assert.equal(days(german)[0].attributes.get('data-day'), '2026-09-28')

    let persian = await render({ locale: 'fa-IR' })
    assert.equal(days(persian)[0].attributes.get('data-day'), '2026-09-26', 'weeks start on Saturday')

    let arabic = await render({ locale: 'ar-EG', dir: 'rtl' })
    assert.equal(attributes(arabic, 'slot:calendar').get('dir'), 'rtl')
    assert.match(text(arabic), /٣٠/, 'Arabic-Indic digits')
  })

  it('falls back to en-US for a locale Intl refuses, such as a raw Accept-Language header', async () => {
    let html = await render({ locale: 'de-CH,de;q=0.9' })
    assert.equal(attributes(html, 'slot:calendar').get('lang'), 'en-US')
    assert.equal(attributes(html, 'table').get('aria-label'), 'October 2026')
  })

  it('lets an explicit week start override the locale', async () => {
    let html = await render({ locale: 'en-US', weekStartsOn: 1 })
    assert.equal(weekdayHeadings(html)[0], 'Mon')
    assert.equal(days(html)[0].attributes.get('data-day'), '2026-09-28')

    let saturday = await render({ locale: 'de-CH', weekStartsOn: 6 })
    assert.equal(weekdayHeadings(saturday)[0], 'Sa')

    let iso = await render({ locale: 'en-US', ISOWeek: true, showWeekNumber: true })
    assert.equal(weekdayHeadings(iso)[0], 'Mon')
  })

  it('numbers the weeks in a column of row headers', async () => {
    let iso = await render({ locale: 'de-CH', showWeekNumber: true })
    let numbers = tags(iso, 'th').filter((tag) => tag.attributes.get('data-slot') === 'calendar-week-number')
    assert.deepEqual(
      numbers.map((tag) => tag.attributes.get('aria-label')),
      ['Week 40', 'Week 41', 'Week 42', 'Week 43', 'Week 44'],
    )
    assert.equal(numbers[0].attributes.get('role'), 'rowheader')
    assert.equal(attributes(iso, 'slot:calendar-week-number-header').get('aria-label'), 'Week')

    // Sunday weeks with January 1 in week one: the week of December 27, 2026 is 2027's first.
    let us = await render({ locale: 'en-US', showWeekNumber: true, defaultMonth: '2026-12-01' })
    let labels = tags(us, 'th')
      .filter((tag) => tag.attributes.get('data-slot') === 'calendar-week-number')
      .map((tag) => tag.attributes.get('aria-label'))
    assert.deepEqual(labels, ['Week 49', 'Week 50', 'Week 51', 'Week 52', 'Week 1'])

    let translated = await render({
      showWeekNumber: true,
      labels: { weekNumber: (week) => `Woche ${week}`, weekNumberHeader: 'Woche' },
    })
    assert.match(translated, /aria-label="Woche 44"/)
  })

  it('marks a picked day and starts on its month with the tab stop on it', async () => {
    let html = await render({ defaultValue: '2027-02-14' })
    assert.equal(attributes(html, 'table').get('aria-label'), 'February 2027')
    assert.equal(cell(html, '2027-02-14').get('aria-selected'), 'true')
    assert.equal(button(html, '2027-02-14').has('data-selected-single'), true)
    assert.deepEqual(tabStops(html), ['2027-02-14'])

    let controlled = await render({ value: '2026-10-12', defaultMonth: '2026-10-01' })
    assert.equal(cell(controlled, '2026-10-12').get('aria-selected'), 'true')
    assert.equal(cell(controlled, today).has('aria-selected'), false)
    assert.deepEqual(tabStops(controlled), ['2026-10-12'])
  })

  it('puts the tab stop on the first available day when neither a pick nor today shows', async () => {
    let html = await render({ defaultMonth: '2026-03-01', disabled: ['2026-03-01', '2026-03-02'] })
    assert.deepEqual(tabStops(html), ['2026-03-03'])
  })

  it('counts leap days', async () => {
    let leap = await render({ defaultMonth: '2024-02-10' })
    assert.equal(cell(leap, '2024-02-29').has('data-outside'), false)
    assert.equal(cell(leap, '2024-03-01', true).has('data-outside'), true)

    // February 2026 runs from a Sunday to a Saturday: four weeks, no outside days.
    let common = await render({ defaultMonth: '2026-02-10' })
    assert.equal(days(common).length, 28)
    assert.equal(days(common).at(-1)?.attributes.get('data-day'), '2026-02-28')
    assert.equal(
      days(common).some((tag) => tag.attributes.get('data-day') === '2026-02-29'),
      false,
    )
  })

  it('marks several picked days and submits each one', async () => {
    let html = await render({
      mode: 'multiple',
      name: 'days',
      defaultValue: ['2026-10-20', '2026-10-05', '2026-10-20', '2026-02-31' as never],
    })
    assert.equal(attributes(html, 'table').get('aria-multiselectable'), 'true')
    assert.equal(cell(html, '2026-10-05').get('aria-selected'), 'true')
    assert.equal(cell(html, '2026-10-20').get('aria-selected'), 'true')
    // Sorted, without the repeat or the day that doesn't exist.
    assert.deepEqual(hiddenInputs(html), [
      ['days', '2026-10-05'],
      ['days', '2026-10-20'],
    ])
    assert.equal(attributes(html, 'slot:calendar').get('data-mode'), 'multiple')
  })

  it('disables the other days once the most days are picked', async () => {
    let html = await render({ mode: 'multiple', maxSelected: 2, defaultValue: ['2026-10-05', '2026-10-06'] })
    assert.equal(button(html, '2026-10-07').has('disabled'), true)
    assert.equal(button(html, '2026-10-05').has('disabled'), false)
  })

  it('marks a range from its start through its middle to its end and submits both ends', async () => {
    let html = await render({ mode: 'range', name: 'stay', defaultValue: { from: '2026-10-12', to: '2026-10-15' } })
    assert.equal(button(html, '2026-10-12').has('data-range-start'), true)
    assert.equal(button(html, '2026-10-13').has('data-range-middle'), true)
    assert.equal(button(html, '2026-10-14').has('data-range-middle'), true)
    assert.equal(button(html, '2026-10-15').has('data-range-end'), true)
    for (let date of ['2026-10-12', '2026-10-13', '2026-10-15']) {
      assert.equal(cell(html, date).get('aria-selected'), 'true', date)
    }
    assert.equal(cell(html, '2026-10-16').has('aria-selected'), false)
    assert.equal(button(html, '2026-10-12').has('data-selected-single'), false)
    assert.deepEqual(hiddenInputs(html), [
      ['stay', '2026-10-12'],
      ['stay', '2026-10-15'],
    ])

    let reversed = await render({ mode: 'range', name: 'stay', value: { from: '2026-10-15', to: '2026-10-12' } })
    assert.deepEqual(hiddenInputs(reversed), [
      ['stay', '2026-10-12'],
      ['stay', '2026-10-15'],
    ])

    let open = await render({ mode: 'range', name: 'stay', value: { from: '2026-10-12' } })
    assert.equal(button(open, '2026-10-12').has('data-range-start'), true)
    assert.equal(button(open, '2026-10-12').has('data-range-end'), true)
    assert.deepEqual(hiddenInputs(open), [
      ['stay', '2026-10-12'],
      ['stay', ''],
    ])

    let oneDay = await render({ mode: 'range', name: 'stay', value: { from: '2026-10-12', to: '2026-10-12' } })
    assert.deepEqual(hiddenInputs(oneDay), [
      ['stay', '2026-10-12'],
      ['stay', '2026-10-12'],
    ])

    let empty = await render({ mode: 'range', name: 'stay' })
    assert.deepEqual(hiddenInputs(empty), [
      ['stay', ''],
      ['stay', ''],
    ])
  })

  it("reads a value in another mode's shape as the days it holds", async () => {
    let multiple = await render({ mode: 'multiple', name: 'days', value: '2026-10-05' as never })
    assert.deepEqual(hiddenInputs(multiple), [['days', '2026-10-05']])
    let range = await render({
      mode: 'range',
      name: 'stay',
      value: ['2026-10-09', '2026-10-05', '2026-10-07'] as never,
    })
    assert.deepEqual(hiddenInputs(range), [
      ['stay', '2026-10-05'],
      ['stay', '2026-10-09'],
    ])
    let single = await render({ name: 'due', value: { from: '2026-10-07', to: '2026-10-09' } as never })
    assert.deepEqual(hiddenInputs(single), [['due', '2026-10-07']])
  })

  it('submits one day, or nothing, under its name', async () => {
    assert.deepEqual(hiddenInputs(await render({ name: 'due', defaultValue: '2026-10-12' })), [['due', '2026-10-12']])
    assert.deepEqual(hiddenInputs(await render({ name: 'due' })), [['due', '']])
    assert.deepEqual(hiddenInputs(await render()), [])
    let html = await render({ name: 'due', form: 'invoice' })
    assert.equal(attributes(html, 'input').get('form'), 'invoice')
  })

  it('disables days by matcher, before min and after max', async () => {
    let html = await render({
      min: '2026-10-05',
      max: '2026-10-28',
      disabled: [{ dayOfWeek: [0, 6] }, { from: '2026-10-14', to: '2026-10-16' }, (date) => date === '2026-10-20'],
    })
    for (let date of ['2026-10-04', '2026-10-29', '2026-10-10', '2026-10-11', '2026-10-15', '2026-10-20']) {
      assert.equal(button(html, date).has('disabled'), true, date)
      assert.equal(cell(html, date).has('data-disabled'), true, date)
    }
    for (let date of ['2026-10-05', '2026-10-13', '2026-10-19', '2026-10-28']) {
      assert.equal(button(html, date).has('disabled'), false, date)
    }
    // min and max bound the months too.
    assert.equal(attributes(html, 'slot:calendar-previous').get('aria-disabled'), 'true')
    assert.equal(attributes(html, 'slot:calendar-next').get('aria-disabled'), 'true')
  })

  it('disables everything, its form value too, for disabled={true}', async () => {
    let html = await render({ disabled: true, name: 'due', defaultValue: '2026-10-12' })
    assert.equal(
      dayButtons(html).every((tag) => tag.attributes.has('disabled')),
      true,
    )
    assert.equal(attributes(html, 'slot:calendar-previous').get('aria-disabled'), 'true')
    assert.equal(attributes(html, 'input').has('disabled'), true)
    assert.equal(attributes(html, 'slot:calendar').has('data-disabled'), true)
    assert.deepEqual(tabStops(html), [])
  })

  it('leaves hidden days and, on request, outside days without a button', async () => {
    let html = await render({ hidden: '2026-10-13', showOutsideDays: false })
    assert.equal(cell(html, '2026-10-13').has('data-hidden'), true)
    assert.equal(
      dayButtons(html).some((tag) => tag.attributes.get('data-day') === '2026-10-13'),
      false,
    )
    assert.equal(cell(html, '2026-09-27', true).has('data-hidden'), true)
    assert.equal(dayButtons(html).length, 30)
  })

  it('shows six weeks with fixedWeeks', async () => {
    let html = await render({ fixedWeeks: true })
    assert.equal(days(html).length, 42)
    assert.equal(days(html).at(-1)?.attributes.get('data-day'), '2026-11-07')
  })

  it('shows several months side by side, within the months it may reach', async () => {
    let html = await render({ numberOfMonths: 2, startMonth: '2026-10-01', endMonth: '2026-12-31' })
    let grids = tags(html, 'table').map((tag) => tag.attributes.get('aria-label'))
    assert.deepEqual(grids, ['October 2026', 'November 2026'])
    assert.equal(attributes(html, 'slot:calendar-previous').get('aria-disabled'), 'true')
    assert.equal(attributes(html, 'slot:calendar-next').has('aria-disabled'), false)
    // One tab stop for both grids.
    assert.deepEqual(tabStops(html), [today])

    let atEnd = await render({ numberOfMonths: 2, defaultMonth: '2026-12-01', endMonth: '2026-12-31' })
    let shown = tags(atEnd, 'table').map((tag) => tag.attributes.get('aria-label'))
    assert.deepEqual(shown, ['November 2026', 'December 2026'], 'the last month stays in bounds')

    let reversed = await render({ numberOfMonths: 2, reverseMonths: true })
    assert.deepEqual(
      tags(reversed, 'table').map((tag) => tag.attributes.get('aria-label')),
      ['November 2026', 'October 2026'],
    )
  })

  it('offers month and year dropdowns from 100 years back to the end of this year', async () => {
    let html = await render({ captionLayout: 'dropdown' })
    let selects = tags(html, 'select')
    assert.deepEqual(
      selects.map((tag) => tag.attributes.get('aria-label')),
      ['Month', 'Year'],
    )
    let options = tags(html, 'option')
    let months = options.slice(0, 12)
    let years = options.slice(12)
    assert.equal(months.find((tag) => tag.attributes.has('selected'))?.attributes.get('value'), '10')
    assert.equal(years[0].attributes.get('value'), '1926')
    assert.equal(years.at(-1)?.attributes.get('value'), '2026')
    assert.equal(years.find((tag) => tag.attributes.has('selected'))?.attributes.get('value'), '2026')
    assert.match(text(html), /Oct/)
    // The grid keeps its name.
    assert.equal(attributes(html, 'table').get('aria-label'), 'October 2026')

    let bounded = await render({ captionLayout: 'dropdown', startMonth: '2026-03-01', endMonth: '2027-06-30' })
    let boundedMonths = tags(bounded, 'option').slice(0, 12)
    assert.equal(boundedMonths[1].attributes.has('disabled'), true, 'February 2026 is out of reach')
    assert.equal(boundedMonths[2].attributes.has('disabled'), false)

    let monthsOnly = await render({ captionLayout: 'dropdown-months' })
    assert.deepEqual(
      tags(monthsOnly, 'select').map((tag) => tag.attributes.get('aria-label')),
      ['Month'],
    )
    let yearsOnly = await render({ captionLayout: 'dropdown-years', labels: { year: 'Jahr' } })
    assert.deepEqual(
      tags(yearsOnly, 'select').map((tag) => tag.attributes.get('aria-label')),
      ['Jahr'],
    )
  })

  it('gives custom modifiers a data attribute and renders custom day content', async () => {
    let html = await render({
      modifiers: { booked: ['2026-10-12', '2026-10-13'], 'Not valid': true },
      renderDay: (day) => (
        <>
          {day.date.slice(8)}
          {day.outside ? null : <span>{day.modifiers.includes('booked') ? 'full' : 'open'}</span>}
        </>
      ),
    })
    assert.equal(cell(html, '2026-10-12').has('data-booked'), true)
    assert.equal(cell(html, '2026-10-14').has('data-booked'), false)
    assert.doesNotMatch(html, /data-Not/)
    assert.match(html, /12<span>full<\/span>/)
    assert.match(html, /14<span>open<\/span>/)
    // The name stays the date.
    assert.equal(button(html, '2026-10-12').get('aria-label'), 'Monday, October 12, 2026')
  })

  it('renders a footer in a polite live region', async () => {
    let html = await render({ footer: 'Pick a day.' })
    let footer = attributes(html, 'slot:calendar-footer')
    assert.equal(footer.get('role'), 'status')
    assert.equal(footer.get('aria-live'), 'polite')
  })

  it('renders the same HTML in every host time zone', async () => {
    let zones = ['UTC', 'Pacific/Kiritimati', 'Pacific/Pago_Pago', 'Asia/Kathmandu']
    let props = { mode: 'range', defaultValue: { from: '2026-10-31', to: '2026-11-01' }, numberOfMonths: 2 } as const
    let pages = []
    for (let zone of zones) pages.push(await inTimeZone(zone, () => render(props)))
    assert.equal(new Set(pages).size, 1)
    assert.equal(button(pages[0], '2026-10-31').has('data-range-start'), true)
  })

  it('works out today in the time zone it is given when it gets no today', async () => {
    let tokyo = await renderToString(<Calendar timeZone="Asia/Tokyo" />)
    let honolulu = await renderToString(<Calendar timeZone="Pacific/Honolulu" />)
    let todayIn = (html: string) =>
      cell(
        html,
        String(
          days(html)
            .find((tag) => tag.attributes.has('data-today'))
            ?.attributes.get('data-day'),
        ),
      )
    let tokyoToday = todayIn(tokyo).get('data-day')
    let honoluluToday = todayIn(honolulu).get('data-day')
    assert.ok(tokyoToday && honoluluToday)
    // Tokyo is 19 hours ahead of Honolulu: the same day or the next.
    assert.ok(tokyoToday >= honoluluToday)
  })
})

describe('matchesDate', () => {
  it('matches days, lists, intervals, sides, weekdays and functions', () => {
    assert.equal(matchesDate('2026-10-30', '2026-10-30'), true)
    assert.equal(matchesDate('2026-10-30', ['2026-10-29', '2026-10-30']), true)
    assert.equal(matchesDate('2026-10-30', { from: '2026-10-01', to: '2026-10-30' }), true)
    assert.equal(matchesDate('2026-10-30', { from: '2026-10-31', to: '2026-10-01' }), true)
    assert.equal(matchesDate('2026-10-31', { from: '2026-10-01', to: '2026-10-30' }), false)
    assert.equal(matchesDate('2026-10-30', { before: '2026-10-30' }), false)
    assert.equal(matchesDate('2026-10-29', { before: '2026-10-30' }), true)
    assert.equal(matchesDate('2026-10-31', { after: '2026-10-30' }), true)
    assert.equal(matchesDate('2026-10-31', { dayOfWeek: [6] }), true)
    assert.equal(
      matchesDate('2026-10-30', (date) => date.endsWith('30')),
      true,
    )
    assert.equal(matchesDate('2026-10-30', true), true)
    assert.equal(matchesDate('2026-10-30', false), false)
    assert.equal(matchesDate('2026-10-30', undefined), false)
  })
})

describe('addToRange', () => {
  it('starts a one-day range, then ends, moves and clears it', () => {
    assert.deepEqual(addToRange('2026-10-12', null), { from: '2026-10-12', to: '2026-10-12' })
    assert.deepEqual(addToRange('2026-10-15', { from: '2026-10-12', to: '2026-10-12' }), {
      from: '2026-10-12',
      to: '2026-10-15',
    })
    assert.deepEqual(addToRange('2026-10-10', { from: '2026-10-12', to: '2026-10-15' }), {
      from: '2026-10-10',
      to: '2026-10-15',
    })
    assert.deepEqual(addToRange('2026-10-20', { from: '2026-10-12', to: '2026-10-15' }), {
      from: '2026-10-12',
      to: '2026-10-20',
    })
    assert.deepEqual(addToRange('2026-10-13', { from: '2026-10-12', to: '2026-10-15' }), {
      from: '2026-10-12',
      to: '2026-10-13',
    })
    assert.deepEqual(addToRange('2026-10-12', { from: '2026-10-12', to: '2026-10-15' }), {
      from: '2026-10-12',
      to: '2026-10-12',
    })
    assert.deepEqual(addToRange('2026-10-15', { from: '2026-10-12', to: '2026-10-15' }), {
      from: '2026-10-15',
      to: '2026-10-15',
    })
    assert.equal(addToRange('2026-10-12', { from: '2026-10-12', to: '2026-10-12' }), null)
    assert.deepEqual(addToRange('2026-10-12', { from: '2026-10-12', to: '2026-10-12' }, { required: true }), {
      from: '2026-10-12',
      to: '2026-10-12',
    })
  })

  it('ends an open range on either side of its start', () => {
    assert.deepEqual(addToRange('2026-10-15', { from: '2026-10-12' }), { from: '2026-10-12', to: '2026-10-15' })
    assert.deepEqual(addToRange('2026-10-01', { from: '2026-10-12' }), { from: '2026-10-01', to: '2026-10-12' })
    assert.deepEqual(addToRange('2026-10-12', { from: '2026-10-12' }), { from: '2026-10-12', to: '2026-10-12' })
  })

  it('crosses months, years and leap days', () => {
    assert.deepEqual(addToRange('2025-01-02', { from: '2024-12-30', to: '2024-12-30' }), {
      from: '2024-12-30',
      to: '2025-01-02',
    })
    assert.deepEqual(addToRange('2024-03-01', { from: '2024-02-28' }, { maxDays: 3 }), {
      from: '2024-02-28',
      to: '2024-03-01',
    })
    assert.deepEqual(addToRange('2026-03-01', { from: '2026-02-26' }, { maxDays: 3 }), { from: '2026-03-01' })
  })

  it('starts over when a range is shorter or longer than allowed', () => {
    assert.deepEqual(addToRange('2026-10-12', null, { minDays: 3 }), { from: '2026-10-12' })
    assert.deepEqual(addToRange('2026-10-13', { from: '2026-10-12' }, { minDays: 3 }), { from: '2026-10-13' })
    assert.deepEqual(addToRange('2026-10-14', { from: '2026-10-12' }, { minDays: 3 }), {
      from: '2026-10-12',
      to: '2026-10-14',
    })
    assert.equal(addToRange('2026-10-12', { from: '2026-10-12' }, { minDays: 3 }), null)
    assert.deepEqual(addToRange('2026-10-12', { from: '2026-10-12' }, { minDays: 3, required: true }), {
      from: '2026-10-12',
    })
    assert.deepEqual(addToRange('2026-10-19', { from: '2026-10-12' }, { maxDays: 7 }), { from: '2026-10-19' })
    assert.deepEqual(addToRange('2026-10-18', { from: '2026-10-12' }, { maxDays: 7 }), {
      from: '2026-10-12',
      to: '2026-10-18',
    })
  })
})
