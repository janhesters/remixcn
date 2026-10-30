import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { contrastRatio } from '../scripts/color.ts'
import { findAccessibilityViolations } from './accessibility.ts'
import { createCalendarExamples, fixtureToday } from './fixtures/calendar/server.tsx'
import { paintColors, toRgba } from './paint.ts'

interface OpenOptions {
  colorScheme?: 'light' | 'dark'
  reducedMotion?: 'reduce' | 'no-preference'
  javaScriptEnabled?: boolean
  /** The browser's time zone, such as 'Pacific/Kiritimati'. */
  timezoneId?: string
  /** Whether to wait for hydration; false keeps the module scripts from loading at all. */
  hydrate?: boolean
}

// Pages open with reduced motion, so transitions take 0s and every read sees the final style.
async function open(t: TestContext, options: OpenOptions = {}) {
  let {
    colorScheme = 'light',
    reducedMotion = 'reduce',
    javaScriptEnabled = true,
    timezoneId,
    hydrate = true,
  } = options
  let examples = await createCalendarExamples()
  t.after(() => void examples.close())

  let server = await createTestServer(examples.fetch)
  let page = await t.serve(server)
  if (!javaScriptEnabled || timezoneId || !hydrate) {
    let context = await page.context().browser()!.newContext({ javaScriptEnabled, timezoneId, baseURL: server.baseUrl })
    t.after(() => context.close())
    page = await context.newPage()
  }
  if (!hydrate) {
    // Keep the module scripts from loading, so the page stays as the server rendered it.
    await page.route('**/assets/**', (route) =>
      route.request().url().endsWith('.css') ? route.continue() : route.abort(),
    )
  }

  let errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
  await page.emulateMedia({ colorScheme, reducedMotion })
  await page.goto('/')
  if (javaScriptEnabled && hydrate) await page.locator('html[data-ready]').waitFor({ state: 'attached' })
  return { page, server, errors }
}

type Page = Awaited<ReturnType<typeof open>>['page']

function example(page: Page, name: string) {
  return page.locator(`[data-example="${name}"]`)
}

function dayIn(page: Page, scope: string, date: string) {
  return page.locator(`${scope} [data-slot="calendar-day"][data-day="${date}"]:not([data-outside]) > button`)
}

/** Waits until the day button of `date` has focus: focus moves a frame after a popover opens. */
async function waitFocusedDay(page: Page, date: string) {
  await page.waitForFunction((date) => document.activeElement?.getAttribute('data-day') === date, date, {
    timeout: 5000,
  })
}

function focusedDay(page: Page) {
  return page.evaluate(() => document.activeElement?.getAttribute('data-day') ?? document.activeElement?.tagName)
}

async function waitFocused(page: Page, selector: string) {
  await page.waitForFunction((selector) => document.activeElement === document.querySelector(selector), selector)
}

function isOpen(page: Page, selector: string) {
  return page.locator(selector).evaluate((element) => element.matches(':popover-open'))
}

async function echoed(page: Page) {
  await page.locator('[data-echo="fields"]').waitFor()
  return page
    .locator('[data-echo="fields"] > div')
    .evaluateAll((rows) =>
      rows.map((row) => [row.querySelector('dt')?.textContent, row.querySelector('dd')?.textContent]),
    )
}

/** Each calendar's grids, today and picked days, as the page shows them now. */
function calendarState(page: Page) {
  return page.locator('[data-slot="calendar"]').evaluateAll((calendars) =>
    calendars.map((calendar) => ({
      grids: [...calendar.querySelectorAll('[data-slot="calendar-grid"]')].map((grid) =>
        grid.getAttribute('aria-label'),
      ),
      today: [...calendar.querySelectorAll('[data-slot="calendar-day"][data-today]')].map((cell) =>
        cell.getAttribute('data-day'),
      ),
      selected: [...calendar.querySelectorAll('[data-slot="calendar-day"][aria-selected="true"]')].map((cell) =>
        cell.getAttribute('data-day'),
      ),
      tabStop: calendar.querySelector('[data-slot="calendar-day-button"][tabindex="0"]')?.getAttribute('data-day'),
      inputs: [...calendar.querySelectorAll<HTMLInputElement>('input[type="hidden"]')].map((input) => input.value),
    })),
  )
}

describe('Calendar and Date Picker examples', () => {
  it('hydrate every example without errors and pass axe in both themes', async (t) => {
    for (let colorScheme of ['light', 'dark'] as const) {
      let { page, errors } = await open(t, { colorScheme })
      let violations = await findAccessibilityViolations(page)
      assert.deepEqual(violations, [], `${colorScheme}: ${violations.join('\n')}`)
      assert.deepEqual(errors, [], errors.join('\n'))
    }
  })

  it('pass axe before hydration, and hydrate to the grids the server rendered', async (t) => {
    let { page: unhydrated } = await open(t, { hydrate: false })
    let violations = await findAccessibilityViolations(unhydrated)
    assert.deepEqual(violations, [], violations.join('\n'))
    let server = await calendarState(unhydrated)

    let { page } = await open(t)
    assert.deepEqual(await calendarState(page), server)
    assert.ok(server.length > 20)
  })

  for (let timezoneId of ['Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
    it(`keep today and every picked day in a browser in ${timezoneId}`, async (t) => {
      let { page: unhydrated } = await open(t, { hydrate: false })
      let server = await calendarState(unhydrated)
      let { page } = await open(t, { timezoneId })
      assert.deepEqual(await calendarState(page), server)
      assert.equal(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone), timezoneId)

      // A day picked near the year's end submits as itself.
      let form = example(page, 'form')
      await form.locator('[data-slot="popover-trigger"]').click()
      await waitFocusedDay(page, fixtureToday)
      await page.keyboard.press('ArrowRight')
      await page.keyboard.press('Enter')
      assert.match((await form.locator('[data-slot="popover-trigger"]').textContent()) ?? '', /October 31, 2026/)
      await page.keyboard.press('Escape')
      await form.getByRole('button', { name: 'Send' }).click()
      let fields = await echoed(page)
      assert.deepEqual(
        fields.filter(([name]) => name === 'due'),
        [['due', '2026-10-31']],
      )
    })
  }

  it('open a date picker from the keyboard on today, move by day, week and month, pick, and return focus', async (t) => {
    let { page } = await open(t)
    let basic = '[data-example="date-picker-basic"]'
    let trigger = page.locator(`${basic} [data-slot="popover-trigger"]`)
    let content = `${basic} [data-slot="popover-content"]`

    await example(page, 'date-picker-basic').locator('h3').click()
    await page.keyboard.press('Tab')
    assert.equal(await trigger.evaluate((element) => element === document.activeElement), true)
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false')
    await page.keyboard.press('Enter')
    await waitFocusedDay(page, fixtureToday)
    assert.equal(await isOpen(page, content), true)
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true')

    await page.keyboard.press('ArrowLeft')
    assert.equal(await focusedDay(page), '2026-10-29')
    await page.keyboard.press('ArrowDown')
    await waitFocusedDay(page, '2026-11-05')
    assert.equal(
      await page.locator(`${content} [data-slot="calendar-grid"]`).getAttribute('aria-label'),
      'November 2026',
    )
    await page.keyboard.press('PageUp')
    await waitFocusedDay(page, '2026-10-05')
    await page.keyboard.press('Home')
    assert.equal(await focusedDay(page), '2026-10-04')
    await page.keyboard.press('End')
    assert.equal(await focusedDay(page), '2026-10-10')
    await page.keyboard.press('Shift+PageDown')
    await waitFocusedDay(page, '2027-10-10')
    await page.keyboard.press('Shift+PageUp')
    await waitFocusedDay(page, '2026-10-10')
    await page.keyboard.press('Space')
    assert.equal(await trigger.evaluate((element) => element.textContent?.trim()), 'October 10, 2026')
    // The trigger names itself from its label and the day it shows.
    assert.equal(
      await example(page, 'date-picker-basic').getByRole('button', { name: 'Date October 10, 2026' }).count(),
      1,
    )
    assert.equal(
      await dayIn(page, content, '2026-10-10').evaluate((button) =>
        button.parentElement?.getAttribute('aria-selected'),
      ),
      'true',
    )

    // The basic picker stays open; Escape closes it and focus returns to the trigger.
    await page.keyboard.press('Escape')
    await page.waitForFunction((selector) => !document.querySelector(selector)?.matches(':popover-open'), content)
    await waitFocused(page, `${basic} [data-slot="popover-trigger"]`)

    // Opening again lands on the picked day.
    await page.keyboard.press('Enter')
    await waitFocusedDay(page, '2026-10-10')
    // Tab moves on to the next control and keeps one tab stop in the grid.
    let stops = await page.locator(`${content} [data-slot="calendar-day-button"][tabindex="0"]`).count()
    assert.equal(stops, 1)
  })

  it('close the date-of-birth picker once a day is picked with the pointer, and pick a year from its dropdown', async (t) => {
    let { page } = await open(t)
    let dob = example(page, 'date-picker-dob')
    let trigger = dob.locator('[data-slot="popover-trigger"]')
    let content = '[data-example="date-picker-dob"] [data-slot="popover-content"]'
    await trigger.click()
    await waitFocusedDay(page, fixtureToday)

    let year = page.locator(`${content} select[aria-label="Year"]`)
    await year.selectOption('1990')
    let month = page.locator(`${content} select[aria-label="Month"]`)
    let before = await month.elementHandle()
    await month.focus()
    await month.selectOption('4')
    assert.equal(await page.locator(`${content} [data-slot="calendar-grid"]`).getAttribute('aria-label'), 'April 1990')
    // The same select stays, with focus, once the grid moved.
    assert.equal(await before!.evaluate((select) => select.isConnected && select === document.activeElement), true)
    await dayIn(page, content, '1990-04-17').click()

    await page.waitForFunction((selector) => !document.querySelector(selector)?.matches(':popover-open'), content)
    assert.equal(await trigger.textContent(), 'Apr 17, 1990')
    await waitFocused(page, '[data-example="date-picker-dob"] [data-slot="popover-trigger"]')
    // Days after today can't be picked.
    await trigger.click()
    await waitFocusedDay(page, '1990-04-17')
  })

  it('pick a range across two months with the pointer and write it the way the locale writes ranges', async (t) => {
    let { page } = await open(t)
    let range = example(page, 'date-picker-range')
    let trigger = range.locator('[data-slot="popover-trigger"]')
    let content = '[data-example="date-picker-range"] [data-slot="popover-content"]'
    assert.match((await trigger.textContent()) ?? '', /Jan 20\s–\sFeb 9, 2026/)
    await trigger.click()
    await waitFocusedDay(page, '2026-01-20')
    // A day before the start moves the start; a day after it moves the end.
    await dayIn(page, content, '2026-01-27').click()
    assert.match((await trigger.textContent()) ?? '', /Jan 20\s–\s27, 2026/)
    await dayIn(page, content, '2026-01-14').click()
    assert.match((await trigger.textContent()) ?? '', /Jan 14\s–\s27, 2026/)
    await dayIn(page, content, '2026-02-03').click()
    assert.match((await trigger.textContent()) ?? '', /Jan 14\s–\sFeb 3, 2026/)
    let selected = await page
      .locator(`${content} [data-slot="calendar-day"][aria-selected="true"]:not([data-outside])`)
      .evaluateAll((cells) => cells.map((cell) => cell.getAttribute('data-day')))
    assert.equal(selected.length, 21)
    assert.equal(selected[0], '2026-01-14')
    assert.equal(selected.at(-1), '2026-02-03')
    await page.locator(`${content} [data-slot="calendar-next"]`).click()
    assert.deepEqual(
      await page
        .locator(`${content} [data-slot="calendar-grid"]`)
        .evaluateAll((grids) => grids.map((grid) => grid.getAttribute('aria-label'))),
      ['February 2026', 'March 2026'],
    )
  })

  it('take a typed ISO day, refuse one that does not exist, open from Arrow Down and write the picked day', async (t) => {
    let { page } = await open(t)
    let field = example(page, 'date-picker-input')
    let input = field.getByRole('textbox', { name: 'Subscription date' })
    let content = '[data-example="date-picker-input"] [data-slot="popover-content"]'

    assert.equal(await input.inputValue(), '2026-06-01')
    assert.match((await field.locator('[data-slot="field-description"]').textContent()) ?? '', /Monday, June 1, 2026/)

    await input.fill('2026-02-29')
    await input.press('Tab')
    assert.equal(await input.getAttribute('aria-invalid'), 'true')
    assert.match((await field.getByRole('alert').textContent()) ?? '', /Enter a day that exists/)
    assert.equal(await input.evaluate((element: HTMLInputElement) => element.validity.valid), false)
    assert.match((await input.getAttribute('aria-describedby')) ?? '', /error/)

    // A numeric date in another order is refused, not guessed.
    await input.fill('03/04/2026')
    await input.press('Tab')
    assert.equal(await input.getAttribute('aria-invalid'), 'true')

    await input.fill('2024-02-29')
    assert.equal(await input.getAttribute('aria-invalid'), null)
    assert.match(
      (await field.locator('[data-slot="field-description"]').textContent()) ?? '',
      /Thursday, February 29, 2024/,
    )

    await input.press('ArrowDown')
    await waitFocusedDay(page, '2024-02-29')
    assert.equal(
      await page.locator(`${content} [data-slot="calendar-grid"]`).getAttribute('aria-label'),
      'February 2024',
    )
    await page.keyboard.press('ArrowRight')
    await waitFocusedDay(page, '2024-03-01')
    await page.keyboard.press('Enter')
    await page.waitForFunction((selector) => !document.querySelector(selector)?.matches(':popover-open'), content)
    assert.equal(await input.inputValue(), '2024-03-01')
    await waitFocused(page, '[data-example="date-picker-input"] input')

    await field.getByRole('button', { name: 'Clear date' }).click()
    assert.equal(await input.inputValue(), '')
    assert.equal(await input.evaluate((element) => element === document.activeElement), true)
    assert.equal(await field.getByRole('button', { name: 'Clear date' }).count(), 0)
  })

  it('reset every field of the form to its default, and submit what it shows', async (t) => {
    let { page } = await open(t)
    let form = example(page, 'form')
    let input = form.getByRole('textbox', { name: 'Subscription date' })
    let rangeScope = '[data-example="form"] [role="group"][aria-label="Stay"]'

    await input.fill('2026-07-15')
    await form.locator('[data-slot="popover-trigger"]').click()
    await waitFocusedDay(page, fixtureToday)
    await page.keyboard.press('Enter')
    await page.keyboard.press('Escape')
    await dayIn(page, rangeScope, '2026-10-20').click()

    await form.getByRole('button', { name: 'Reset' }).click()
    await page.waitForFunction(
      () => document.querySelector('[data-example="form"] input[name="subscription"]') !== null,
    )
    await page.waitForFunction(
      (scope) =>
        [...document.querySelectorAll<HTMLInputElement>(`${scope} input[type="hidden"]`)].map((i) => i.value).join() ===
        '2026-10-12,2026-10-16',
      rangeScope,
    )
    assert.equal(await input.inputValue(), '2026-06-01')
    assert.equal(
      await form
        .locator('[data-slot="popover-trigger"]')
        .textContent()
        .then((text) => text?.trim()),
      'Pick a date',
    )
    assert.match((await form.locator('[data-slot="field-description"]').textContent()) ?? '', /June 1, 2026/)

    // An empty required field blocks the submit.
    await input.fill('')
    await form.getByRole('button', { name: 'Send' }).click()
    assert.equal(await page.locator('[data-echo]').count(), 0)
    assert.equal(await input.evaluate((element: HTMLInputElement) => element.validity.valueMissing), true)

    await input.fill('2026-12-24')
    await dayIn(page, rangeScope, '2026-10-20').click()
    await form.getByRole('button', { name: 'Send' }).click()
    assert.deepEqual(await echoed(page), [
      ['subscription', '2026-12-24'],
      ['due', '(empty)'],
      ['stay', '2026-10-12'],
      ['stay', '2026-10-20'],
    ])
  })

  it('submit and reset the form without JavaScript, through the typed field and the default values', async (t) => {
    let { page } = await open(t, { javaScriptEnabled: false })
    let form = example(page, 'form')
    let input = form.getByRole('textbox', { name: 'Subscription date' })
    assert.equal(await form.getByRole('button', { name: 'Clear date' }).isVisible(), false, 'clearing needs the script')

    // The native pattern catches a typed day in another format.
    await input.fill('1.6.2026')
    assert.equal(await input.evaluate((element: HTMLInputElement) => element.validity.patternMismatch), true)
    await form.getByRole('button', { name: 'Reset' }).click()
    assert.equal(await input.inputValue(), '2026-06-01')

    // The calendar's popover opens natively; its days look disabled and pick nothing.
    let trigger = form.locator('[data-slot="popover-trigger"]')
    let content = `[id="${await trigger.getAttribute('aria-controls')}"]`
    await trigger.click()
    assert.equal(await isOpen(page, content), true)
    let opacity = await dayIn(page, content, '2026-10-12').evaluate((button) => getComputedStyle(button).opacity)
    assert.equal(opacity, '0.5')
    await page.keyboard.press('Escape')

    await input.fill('2026-09-01')
    await form.getByRole('button', { name: 'Send' }).click()
    assert.deepEqual(await echoed(page), [
      ['subscription', '2026-09-01'],
      ['due', '(empty)'],
      ['stay', '2026-10-12'],
      ['stay', '2026-10-16'],
    ])
  })

  it('mirror the arrow keys and the navigation in right-to-left text', async (t) => {
    let { page } = await open(t)
    let scope = '[data-example="rtl-he"]'
    await dayIn(page, scope, fixtureToday).focus()
    await page.keyboard.press('ArrowLeft')
    assert.equal(await focusedDay(page), '2026-10-31')
    await page.keyboard.press('ArrowRight')
    assert.equal(await focusedDay(page), fixtureToday)

    let previous = await page.locator(`${scope} [data-slot="calendar-previous"]`).boundingBox()
    let next = await page.locator(`${scope} [data-slot="calendar-next"]`).boundingBox()
    assert.ok(previous && next && previous.x > next.x, 'previous sits on the right')
    let firstWeekday = await page.locator(`${scope} [data-slot="calendar-weekday"]`).first().boundingBox()
    let lastWeekday = await page.locator(`${scope} [data-slot="calendar-weekday"]`).last().boundingBox()
    assert.ok(firstWeekday && lastWeekday && firstWeekday.x > lastWeekday.x, 'the week runs from the right')
  })

  it('fit 320px without scrolling the page sideways, also with text at 200%', async (t) => {
    let { page } = await open(t)
    await page.setViewportSize({ width: 320, height: 800 })
    let overflow = () =>
      page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.equal(await overflow(), 0)

    await page.evaluate(() => (document.documentElement.style.fontSize = '32px'))
    assert.equal(await overflow(), 0)
    // The month grid needs both dimensions, so it scrolls inside the calendar.
    let calendar = page.locator('[data-example="calendar-basic"] [data-slot="calendar"]')
    let scrolls = await calendar.evaluate((element) => element.scrollWidth > element.clientWidth)
    assert.equal(scrolls, true)
    await dayIn(page, '[data-example="calendar-basic"]', '2026-10-31').focus()
    let visible = await calendar.evaluate((element) => {
      let day = element.querySelector('[data-day="2026-10-31"]:not([data-outside]) button')!.getBoundingClientRect()
      let box = element.getBoundingClientRect()
      return day.left >= box.left - 1 && day.right <= box.right + 1
    })
    assert.equal(visible, true, 'focus scrolls the day into view')
  })

  it('keep 4.5:1 for picked, today, range, outside and weekday text in both themes', async (t) => {
    let { page } = await open(t)
    for (let colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
      let scope = '[data-example="calendar-range"]'
      let samples = [
        ...(await paintColors(page, `${scope} [data-range-start] > button`)),
        ...(await paintColors(page, `${scope} [data-range-middle] > button`)),
        ...(await paintColors(page, `${scope} [data-outside] > button`)),
        ...(await paintColors(page, `${scope} [data-slot="calendar-weekday"]`)),
        ...(await paintColors(page, '[data-example="calendar-basic"] [data-today] > button')),
        ...(await paintColors(page, '[data-example="calendar-single"] [data-selected] > button')),
      ]
      assert.ok(samples.length > 10)
      for (let { label, background, text } of samples) {
        let ratio = contrastRatio(toRgba(text), toRgba(background))
        assert.ok(ratio >= 4.5, `${colorScheme} ${label}: ${ratio.toFixed(2)}`)
      }
    }
  })

  it('edge the picked days in forced colors and mark today by more than color', async (t) => {
    let { page } = await open(t)
    await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' })
    let border = (selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((button) => {
          let style = getComputedStyle(button)
          return `${style.borderTopStyle} ${style.borderTopWidth}`
        })
    let scope = '[data-example="calendar-range"]'
    assert.equal(await border(`${scope} [data-range-start] > button`), 'solid 2px')
    assert.equal(await border(`${scope} [data-range-middle] > button`), 'dashed 1px')
    assert.match(await border(`${scope} [data-slot="calendar-day"]:not([data-selected]) > button`), /^none/)
    let today = await page
      .locator('[data-example="calendar-basic"] [data-today] > button')
      .evaluate((button) => [getComputedStyle(button).fontWeight, getComputedStyle(button).textDecorationLine])
    assert.deepEqual(today, ['600', 'underline'])
  })

  it('fade the day fills only without reduced motion', async (t) => {
    let { page } = await open(t, { reducedMotion: 'no-preference' })
    let duration = () =>
      page
        .locator('[data-example="calendar-basic"] [data-slot="calendar-day-button"]')
        .first()
        .evaluate((button) => getComputedStyle(button).transitionDuration)
    assert.notEqual(await duration(), '0s')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    assert.equal(await duration(), '0s')
  })
})
