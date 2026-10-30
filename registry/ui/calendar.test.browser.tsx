import { renderToString } from 'remix/component/server'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import type { CivilDate } from '#remixcn/lib/civil-date.ts'
import { Calendar, getCalendarFocusTarget } from './calendar.tsx'
import type { CalendarChangeDetails, CalendarSingleProps, DateRange } from './calendar.tsx'

const today = '2026-10-30'
const frame = 'font-size: 16px; --spacing: 0.25rem; --text-sm: 0.875rem; --text-xs: 0.75rem'

function mount(t: TestContext, node: RemixNode) {
  let result = render(<div style={frame}>{node}</div>)
  t.after(result.cleanup)
  return result
}

function day(container: HTMLElement, date: string) {
  let button = container.querySelector<HTMLButtonElement>(
    `[data-slot="calendar-day"][data-day="${date}"]:not([data-outside]) > button`,
  )
  assert.ok(button, `no day ${date}`)
  return button
}

function grids(container: HTMLElement) {
  return [...container.querySelectorAll('[data-slot="calendar-grid"]')].map((grid) => grid.getAttribute('aria-label'))
}

function selected(container: HTMLElement) {
  return [...container.querySelectorAll('[data-slot="calendar-day"][aria-selected="true"]:not([data-outside])')].map(
    (cell) => cell.getAttribute('data-day'),
  )
}

function tabStops(container: HTMLElement) {
  return [...container.querySelectorAll('[data-slot="calendar-day-button"][tabindex="0"]')].map((button) =>
    button.getAttribute('data-day'),
  )
}

function focusedDay() {
  return document.activeElement?.getAttribute('data-day') ?? document.activeElement?.tagName
}

function key(target: Element, key: string, init: KeyboardEventInit = {}) {
  let event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

/** Presses a key on the focused day and waits until focus has moved. */
async function press(act: (fn: () => unknown) => Promise<void>, name: string, init: KeyboardEventInit = {}) {
  let target = document.activeElement
  assert.ok(target instanceof HTMLElement, 'nothing focused')
  await act(() => key(target, name, init))
  // The calendar moves focus once its update committed.
  await new Promise((resolve) => setTimeout(resolve))
}

function hiddenValues(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLInputElement>('input[type="hidden"]')].map((input) => input.value)
}

interface Change {
  value: unknown
  details: CalendarChangeDetails
}

describe('Calendar in the browser', () => {
  it('picks a day with a press and unpicks it with another, telling the owner', async (t) => {
    let changes: Change[] = []
    let { container, act } = mount(
      t,
      <Calendar today={today} onValueChange={(value, details) => changes.push({ value, details })} />,
    )

    await act(() => day(container, '2026-10-12').click())
    assert.deepEqual(selected(container), ['2026-10-12'])
    assert.deepEqual(changes, [{ value: '2026-10-12', details: { date: '2026-10-12', reason: 'day-press' } }])
    assert.equal(day(container, '2026-10-12').hasAttribute('data-selected-single'), true)

    await act(() => day(container, '2026-10-12').click())
    assert.deepEqual(selected(container), [])
    assert.equal(changes.at(-1)?.value, null)
  })

  it('keeps a required day picked', async (t) => {
    let { container, act } = mount(t, <Calendar today={today} required defaultValue="2026-10-12" />)
    await act(() => day(container, '2026-10-12').click())
    assert.deepEqual(selected(container), ['2026-10-12'])
  })

  it('shows only the value a controlling owner renders', async (t) => {
    let changes: Change[] = []
    function Owner(handle: Handle<{ accept: boolean }>) {
      let value: CivilDate | null = '2026-10-05'
      return () => (
        <Calendar
          today={today}
          value={value}
          onValueChange={(next, details) => {
            changes.push({ value: next, details })
            if (!handle.props.accept) return
            value = next
            void handle.update()
          }}
        />
      )
    }
    let declining = mount(t, <Owner accept={false} />)
    await declining.act(() => day(declining.container, '2026-10-12').click())
    assert.deepEqual(selected(declining.container), ['2026-10-05'])
    assert.equal(changes.at(-1)?.value, '2026-10-12')

    let accepting = mount(t, <Owner accept />)
    await accepting.act(() => day(accepting.container, '2026-10-12').click())
    assert.deepEqual(selected(accepting.container), ['2026-10-12'])
  })

  it('follows changed props: value, locale, week start, month and disabled days', async (t) => {
    let { container, act, root } = mount(t, <Calendar today={today} value="2026-10-05" month="2026-10-01" />)
    let update = (props: Partial<CalendarSingleProps>) =>
      act(() => root.render(<Calendar today={today} value="2026-10-20" {...props} />))
    let firstWeekday = () => container.querySelector('[data-slot="calendar-weekday"]')?.textContent

    assert.deepEqual(selected(container), ['2026-10-05'])
    await update({ month: '2026-10-01' })
    assert.deepEqual(selected(container), ['2026-10-20'])
    await update({ month: '2026-10-01', locale: 'de-CH' })
    assert.deepEqual(grids(container), ['Oktober 2026'])
    assert.equal(firstWeekday(), 'Mo')
    await update({ month: '2026-10-01', locale: 'de-CH', weekStartsOn: 0 })
    assert.equal(firstWeekday(), 'So')
    await update({ month: '2027-02-01' })
    assert.deepEqual(grids(container), ['February 2027'])
    await update({ month: '2026-10-01', disabled: '2026-10-21' })
    assert.equal(day(container, '2026-10-21').disabled, true)
    await update({ month: '2026-10-01', numberOfMonths: 2 })
    assert.deepEqual(grids(container), ['October 2026', 'November 2026'])
  })

  it('toggles several days, within the fewest and most allowed', async (t) => {
    let { container, act } = mount(
      t,
      <Calendar today={today} mode="multiple" minSelected={1} maxSelected={3} defaultValue={['2026-10-05']} />,
    )
    await act(() => day(container, '2026-10-05').click())
    assert.deepEqual(selected(container), ['2026-10-05'], 'the last one stays')
    await act(() => day(container, '2026-10-08').click())
    await act(() => day(container, '2026-10-02').click())
    assert.deepEqual(selected(container), ['2026-10-02', '2026-10-05', '2026-10-08'])
    assert.equal(day(container, '2026-10-20').disabled, true, 'the most are picked')
    await act(() => day(container, '2026-10-05').click())
    assert.deepEqual(selected(container), ['2026-10-02', '2026-10-08'])
    assert.equal(day(container, '2026-10-20').disabled, false)
  })

  it('picks a range with two presses and starts over past a disabled day when asked', async (t) => {
    let ranges: Array<DateRange | null> = []
    let { container, act } = mount(
      t,
      <Calendar
        today={today}
        mode="range"
        disabled="2026-10-14"
        excludeDisabled
        onValueChange={(value) => ranges.push(value)}
      />,
    )
    await act(() => day(container, '2026-10-05').click())
    await act(() => day(container, '2026-10-09').click())
    assert.deepEqual(selected(container), ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'])
    assert.equal(day(container, '2026-10-07').hasAttribute('data-range-middle'), true)
    await act(() => day(container, '2026-10-16').click())
    assert.deepEqual(ranges.at(-1), { from: '2026-10-16' })
    assert.deepEqual(selected(container), ['2026-10-16'])
  })

  it('moves focus by day, week, week edge, month and year, into new months', async (t) => {
    let months: CivilDate[] = []
    let { container, act } = mount(
      t,
      <Calendar today={today} defaultValue="2026-10-30" onMonthChange={(month) => months.push(month)} />,
    )
    day(container, '2026-10-30').focus()

    await press(act, 'ArrowRight')
    assert.equal(focusedDay(), '2026-10-31')
    await press(act, 'ArrowRight')
    assert.equal(focusedDay(), '2026-11-01')
    assert.deepEqual(grids(container), ['November 2026'], 'focus follows into the next month')
    assert.deepEqual(months, ['2026-11-01'])
    assert.deepEqual(tabStops(container), ['2026-11-01'])

    await press(act, 'ArrowLeft')
    assert.equal(focusedDay(), '2026-10-31')
    assert.deepEqual(grids(container), ['October 2026'])
    await press(act, 'ArrowUp')
    assert.equal(focusedDay(), '2026-10-24')
    await press(act, 'ArrowDown')
    assert.equal(focusedDay(), '2026-10-31')
    await press(act, 'Home')
    assert.equal(focusedDay(), '2026-10-25')
    await press(act, 'End')
    assert.equal(focusedDay(), '2026-10-31')
    await press(act, 'PageDown')
    assert.equal(focusedDay(), '2026-11-30', 'the month is shorter, so the last day')
    await press(act, 'PageUp')
    assert.equal(focusedDay(), '2026-10-30')
    await press(act, 'PageUp', { shiftKey: true })
    assert.equal(focusedDay(), '2025-10-30')
    assert.deepEqual(grids(container), ['October 2025'])
    await press(act, 'PageDown', { shiftKey: true })
    assert.equal(focusedDay(), '2026-10-30')
  })

  it('crosses year ends and leap days with the keyboard', async (t) => {
    let { container, act } = mount(t, <Calendar today={today} defaultMonth="2024-02-01" defaultValue="2024-02-28" />)
    day(container, '2024-02-28').focus()
    await press(act, 'ArrowRight')
    assert.equal(focusedDay(), '2024-02-29')
    await press(act, 'PageDown', { shiftKey: true })
    assert.equal(focusedDay(), '2025-02-28')
    await press(act, 'ArrowDown')
    await press(act, 'ArrowDown')
    await press(act, 'ArrowDown')
    await press(act, 'ArrowDown')
    await press(act, 'ArrowDown')
    assert.equal(focusedDay(), '2025-04-04')
    await press(act, 'PageDown', { shiftKey: true })
    await press(act, 'PageDown')
    await press(act, 'PageDown')
    await press(act, 'PageDown')
    await press(act, 'PageDown')
    await press(act, 'PageDown')
    await press(act, 'PageDown')
    await press(act, 'PageDown')
    await press(act, 'PageDown')
    assert.equal(focusedDay(), '2026-12-04')
    await press(act, 'ArrowDown')
    await press(act, 'ArrowDown')
    await press(act, 'ArrowDown')
    assert.equal(focusedDay(), '2026-12-25')
    await press(act, 'ArrowDown')
    assert.equal(focusedDay(), '2027-01-01')
    assert.deepEqual(grids(container), ['January 2027'])
  })

  it('mirrors the left and right arrows in right-to-left text', async (t) => {
    let { container, act } = mount(t, <Calendar today={today} dir="rtl" locale="ar-EG" defaultValue="2026-10-15" />)
    day(container, '2026-10-15').focus()
    await press(act, 'ArrowLeft')
    assert.equal(focusedDay(), '2026-10-16')
    await press(act, 'ArrowRight')
    await press(act, 'ArrowRight')
    assert.equal(focusedDay(), '2026-10-14')

    // An inherited direction counts too.
    let inherited = mount(
      t,
      <div dir="rtl">
        <Calendar today={today} defaultValue="2026-10-15" />
      </div>,
    )
    day(inherited.container, '2026-10-15').focus()
    await press(inherited.act, 'ArrowLeft')
    assert.equal(focusedDay(), '2026-10-16')
  })

  it('skips disabled and hidden days and stops at the months it may reach', async (t) => {
    let { container, act } = mount(
      t,
      <Calendar
        today={today}
        defaultValue="2026-10-13"
        disabled={['2026-10-14', '2026-10-15', '2026-10-20']}
        hidden="2026-10-16"
        startMonth="2026-10-01"
        endMonth="2026-10-31"
      />,
    )
    day(container, '2026-10-13').focus()
    await press(act, 'ArrowRight')
    assert.equal(focusedDay(), '2026-10-17')
    await press(act, 'ArrowLeft')
    assert.equal(focusedDay(), '2026-10-13')
    await press(act, 'ArrowDown')
    assert.equal(focusedDay(), '2026-10-27', 'the week below is disabled, so the next one')
    await press(act, 'PageDown')
    assert.equal(focusedDay(), '2026-10-31', 'the last day it may reach')
    await press(act, 'ArrowRight')
    assert.equal(focusedDay(), '2026-10-31')
    assert.deepEqual(grids(container), ['October 2026'])
    let event = key(day(container, '2026-10-31'), 'Tab')
    assert.equal(event.defaultPrevented, false, 'Tab leaves')
  })

  it('keeps focus when an owner keeps its month', async (t) => {
    let { container, act } = mount(t, <Calendar today={today} month="2026-10-01" defaultValue="2026-10-31" />)
    day(container, '2026-10-31').focus()
    await press(act, 'ArrowRight')
    assert.equal(focusedDay(), '2026-10-31')
    assert.deepEqual(grids(container), ['October 2026'])
  })

  it('moves the tab stop with focus and back to the picked day once focus leaves', async (t) => {
    let { container, act } = mount(
      t,
      <>
        <Calendar today={today} defaultValue="2026-10-12" />
        <button type="button" id="after">
          After
        </button>
      </>,
    )
    assert.deepEqual(tabStops(container), ['2026-10-12'])
    await act(() => day(container, '2026-10-12').focus())
    await press(act, 'ArrowRight')
    assert.deepEqual(tabStops(container), ['2026-10-13'])
    await act(() => container.querySelector<HTMLElement>('#after')?.focus())
    await new Promise((resolve) => setTimeout(resolve))
    await act(() => {})
    assert.deepEqual(tabStops(container), ['2026-10-12'])
    assert.equal(getCalendarFocusTarget(container), day(container, '2026-10-12'))
  })

  it('changes months with its buttons, by one or by every shown month, and stops at the ends', async (t) => {
    let { container, act } = mount(
      t,
      <Calendar today={today} numberOfMonths={2} startMonth="2026-09-01" endMonth="2027-02-28" pagedNavigation />,
    )
    let next = container.querySelector<HTMLButtonElement>('[data-slot="calendar-next"]')!
    let previous = container.querySelector<HTMLButtonElement>('[data-slot="calendar-previous"]')!
    assert.deepEqual(grids(container), ['October 2026', 'November 2026'])
    await act(() => next.click())
    assert.deepEqual(grids(container), ['December 2026', 'January 2027'])
    await act(() => next.click())
    assert.deepEqual(grids(container), ['January 2027', 'February 2027'], 'the last month stays in bounds')
    assert.equal(next.getAttribute('aria-disabled'), 'true')
    await act(() => next.click())
    assert.deepEqual(grids(container), ['January 2027', 'February 2027'])
    await act(() => previous.click())
    await act(() => previous.click())
    assert.deepEqual(grids(container), ['September 2026', 'October 2026'])
    assert.equal(previous.getAttribute('aria-disabled'), 'true')
  })

  it('moves to the month and year picked in its dropdowns', async (t) => {
    let months: CivilDate[] = []
    let { container, act } = mount(
      t,
      <Calendar today={today} captionLayout="dropdown" onMonthChange={(month) => months.push(month)} />,
    )
    let [month, year] = [...container.querySelectorAll<HTMLSelectElement>('select')]
    await act(() => {
      month.value = '3'
      month.dispatchEvent(new Event('change', { bubbles: true }))
    })
    assert.deepEqual(grids(container), ['March 2026'], JSON.stringify(grids(container)))
    // The same select, so keyboard focus stays on it.
    assert.equal(container.querySelector('select'), month)
    await act(() => {
      year.value = '1990'
      year.dispatchEvent(new Event('change', { bubbles: true }))
    })
    assert.deepEqual(grids(container), ['March 1990'], JSON.stringify(grids(container)))
    assert.deepEqual(months, ['2026-03-01', '1990-03-01'], JSON.stringify(months))
    assert.equal(month.value, '3')
    assert.equal(year.value, '1990')
  })

  it('writes its value into hidden inputs and returns to the default on a form reset', async (t) => {
    let changes: Change[] = []
    let { container, act } = mount(
      t,
      <form>
        <Calendar
          today={today}
          name="due"
          defaultValue="2026-10-05"
          onValueChange={(value, details) => changes.push({ value, details })}
        />
        <button type="reset">Reset</button>
      </form>,
    )
    let form = container.querySelector('form')!
    await act(() => day(container, '2026-10-12').click())
    assert.equal(new FormData(form).get('due'), '2026-10-12')

    await act(() => form.reset())
    await new Promise((resolve) => setTimeout(resolve, 10))
    await act(() => {})
    assert.equal(new FormData(form).get('due'), '2026-10-05')
    assert.deepEqual(selected(container), ['2026-10-05'])
    assert.deepEqual(changes.at(-1), { value: '2026-10-05', details: { date: undefined, reason: 'reset' } })
  })

  it('returns to its default days on a reset after every day was unpicked', async (t) => {
    let { container, act } = mount(
      t,
      <form id="days-form">
        <Calendar today={today} mode="multiple" name="days" defaultValue={['2026-10-05']} />
      </form>,
    )
    let form = container.querySelector('form')!
    await act(() => day(container, '2026-10-05').click())
    assert.deepEqual(new FormData(form).getAll('days'), [])
    await act(() => form.reset())
    await new Promise((resolve) => setTimeout(resolve, 10))
    await act(() => {})
    assert.deepEqual(new FormData(form).getAll('days'), ['2026-10-05'])
    assert.deepEqual(selected(container), ['2026-10-05'])
  })

  it('follows a reset of the form it names from outside it', async (t) => {
    let { container, act } = mount(
      t,
      <>
        <form id="outside-form"></form>
        <Calendar today={today} name="due" form="outside-form" defaultValue="2026-10-05" />
      </>,
    )
    let form = container.querySelector('form')!
    await act(() => day(container, '2026-10-12').click())
    assert.equal(new FormData(form).get('due'), '2026-10-12')
    await act(() => form.reset())
    await new Promise((resolve) => setTimeout(resolve, 10))
    await act(() => {})
    assert.equal(new FormData(form).get('due'), '2026-10-05')
  })

  it('keeps its value when a listener cancels the reset', async (t) => {
    let { container, act } = mount(
      t,
      <form>
        <Calendar today={today} name="due" defaultValue="2026-10-05" />
      </form>,
    )
    let form = container.querySelector('form')!
    form.addEventListener('reset', (event) => event.preventDefault())
    await act(() => day(container, '2026-10-12').click())
    await act(() => form.reset())
    await new Promise((resolve) => setTimeout(resolve, 10))
    assert.deepEqual(hiddenValues(container), ['2026-10-12'])
  })

  it('submits a range as two values and several days as one each', async (t) => {
    let { container, act } = mount(
      t,
      <form>
        <Calendar today={today} mode="range" name="stay" />
        <Calendar today={today} mode="multiple" name="days" />
      </form>,
    )
    let form = container.querySelector('form')!
    let [range, multiple] = [...container.querySelectorAll<HTMLElement>('[data-slot="calendar"]')]
    assert.deepEqual(new FormData(form).getAll('stay'), ['', ''])
    await act(() => day(range, '2026-10-05').click())
    await act(() => day(range, '2026-10-08').click())
    await act(() => day(multiple, '2026-10-09').click())
    await act(() => day(multiple, '2026-10-02').click())
    assert.deepEqual(new FormData(form).getAll('stay'), ['2026-10-05', '2026-10-08'])
    assert.deepEqual(new FormData(form).getAll('days'), ['2026-10-02', '2026-10-09'])
  })

  it('moves a later month to the year picked in its own dropdown, within the months it may reach', async (t) => {
    let months: CivilDate[] = []
    let { container, act } = mount(
      t,
      <Calendar
        today={today}
        numberOfMonths={2}
        captionLayout="dropdown"
        defaultMonth="2025-11-01"
        endMonth="2026-12-01"
        onMonthChange={(month) => months.push(month)}
      />,
    )
    let selects = () => [...container.querySelectorAll<HTMLSelectElement>('select')]
    let options = (select: HTMLSelectElement) =>
      [...select.options].filter((option) => !option.disabled).map((option) => option.value)
    assert.deepEqual(grids(container), ['November 2025', 'December 2025'])

    // The second grid's year: its December stays December.
    let [, , , secondYear] = selects()
    await act(() => {
      secondYear.value = '2026'
      secondYear.dispatchEvent(new Event('change', { bubbles: true }))
    })
    assert.deepEqual(grids(container), ['November 2026', 'December 2026'])
    assert.deepEqual(months, ['2026-11-01'])

    // At the end, the first grid can't show December, and the second grid can.
    let [firstMonth, , secondMonth] = selects()
    assert.equal(options(firstMonth).includes('12'), false)
    assert.equal(options(secondMonth).includes('12'), true)
    assert.equal(options(secondMonth).includes('1'), true)

    // The second grid's month: the first grid shows the month before it.
    await act(() => {
      secondMonth.value = '3'
      secondMonth.dispatchEvent(new Event('change', { bubbles: true }))
    })
    assert.deepEqual(grids(container), ['February 2026', 'March 2026'])
    assert.deepEqual(months, ['2026-11-01', '2026-02-01'])
  })

  it('keeps its own value through a change of mode, then picks and resets in the new one', async (t) => {
    let changes: Change[] = []
    let onValueChange = (value: unknown, details: CalendarChangeDetails) => changes.push({ value, details })
    let { container, act, root } = mount(
      t,
      <form>
        <Calendar today={today} name="due" defaultValue="2026-10-05" onValueChange={onValueChange} />
      </form>,
    )
    let form = container.querySelector('form')!
    let as = (props: Record<string, unknown>) =>
      act(() =>
        root.render(
          <div style={frame}>
            <form>
              <Calendar today={today} name="due" onValueChange={onValueChange} {...(props as object)} />
            </form>
          </div>,
        ),
      )
    await act(() => day(container, '2026-10-12').click())

    await as({ mode: 'multiple' })
    form = container.querySelector('form')!
    assert.deepEqual(selected(container), ['2026-10-12'])
    await act(() => day(container, '2026-10-14').click())
    assert.deepEqual(new FormData(form).getAll('due'), ['2026-10-12', '2026-10-14'])
    assert.deepEqual(changes.at(-1)?.value, ['2026-10-12', '2026-10-14'])

    await as({ mode: 'range' })
    assert.deepEqual(selected(container), ['2026-10-12', '2026-10-13', '2026-10-14'])
    await act(() => day(container, '2026-10-20').click())
    assert.deepEqual(new FormData(form).getAll('due'), ['2026-10-12', '2026-10-20'])

    await as({})
    assert.deepEqual(selected(container), ['2026-10-12'])
    await act(() => day(container, '2026-10-12').click())
    assert.deepEqual(selected(container), [])

    // The reset returns to the first default, in the shape of the mode now.
    await as({ mode: 'multiple' })
    await act(() => form.reset())
    await new Promise((resolve) => setTimeout(resolve, 10))
    await act(() => {})
    assert.deepEqual(new FormData(form).getAll('due'), ['2026-10-05'])
    assert.deepEqual(changes.at(-1), { value: ['2026-10-05'], details: { date: undefined, reason: 'reset' } })
  })

  it('keeps several calendars apart', async (t) => {
    let { container, act } = mount(
      t,
      <>
        <Calendar today={today} defaultValue="2026-10-05" />
        <Calendar today={today} defaultValue="2026-10-06" />
      </>,
    )
    let [first, second] = [...container.querySelectorAll<HTMLElement>('[data-slot="calendar"]')]
    await act(() => day(first, '2026-10-20').click())
    assert.deepEqual(selected(first), ['2026-10-20'])
    assert.deepEqual(selected(second), ['2026-10-06'])
    day(second, '2026-10-06').focus()
    await press(act, 'PageDown')
    assert.deepEqual(grids(second), ['November 2026'])
    assert.deepEqual(grids(first), ['October 2026'])
  })

  it('stops listening for resets once it is gone', async (t) => {
    let changes: Change[] = []
    let form = document.createElement('form')
    document.body.append(form)
    t.after(() => form.remove())
    let result = render(
      <Calendar
        today={today}
        name="due"
        defaultValue="2026-10-05"
        onValueChange={(value, details) => changes.push({ value, details })}
      />,
      { container: form },
    )
    await result.act(() => day(form, '2026-10-12').click())
    result.cleanup()
    form.reset()
    await new Promise((resolve) => setTimeout(resolve, 10))
    assert.equal(changes.length, 1)
  })

  it('hydrates its server HTML in place without changing it', async (t) => {
    let node = (
      <Calendar
        today={today}
        mode="range"
        defaultValue={{ from: '2026-10-12', to: '2026-10-14' }}
        showWeekNumber
        name="stay"
      />
    )
    let container = document.createElement('div')
    document.body.append(container)
    t.after(() => container.remove())
    container.innerHTML = (await renderToString(node)).replace(/<head>[\s\S]*?<\/head>/, '')
    let before = container.querySelector('[data-slot="calendar"]')!.outerHTML.replace(/ class="[^"]*"/g, '')
    let button = day(container, '2026-10-20')

    let mutations: MutationRecord[] = []
    let observer = new MutationObserver((records) => mutations.push(...records))
    observer.observe(container, {
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      childList: true,
      characterData: true,
    })
    let result = render(node, { container })
    t.after(result.cleanup)
    await result.act(() => {})
    observer.disconnect()

    assert.equal(day(container, '2026-10-20'), button, 'hydrated in place')
    // Hydration writes every attribute again; only a new value counts.
    let changed = mutations.filter(
      (record) =>
        record.type !== 'attributes' ||
        (record.target as Element).getAttribute(record.attributeName!) !== record.oldValue,
    )
    let summary = changed.map(
      (record) =>
        `${record.type} ${record.attributeName ?? ''} ${(record.target as Element).outerHTML?.slice(0, 80) ?? record.target.textContent} ${record.oldValue ?? ''} added:${[...record.addedNodes].map((node) => node.nodeName)} removed:${[...record.removedNodes].map((node) => node.nodeName)}`,
    )
    assert.deepEqual(summary, [], summary.slice(0, 5).join('\n'))
    assert.equal(container.querySelector('[data-slot="calendar"]')!.outerHTML.replace(/ class="[^"]*"/g, ''), before)

    await result.act(() => day(container, '2026-10-20').click())
    assert.deepEqual(hiddenValues(container), ['2026-10-12', '2026-10-20'])
  })
})
