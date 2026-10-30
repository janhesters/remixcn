import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { findAccessibilityViolations } from './accessibility.ts'
import { createControls } from './fixtures/controls/server.tsx'
import { suppressValidationMessages } from './validation.ts'

interface OpenOptions {
  // Without JavaScript the page stays as the server rendered it.
  javaScript?: boolean
  reducedMotion?: 'reduce' | 'no-preference'
}

// Pages open with reduced motion, so transitions take 0s and every read sees
// the final style. The motion test opts back in.
async function open(t: TestContext, { javaScript = true, reducedMotion = 'reduce' }: OpenOptions = {}) {
  let controls = await createControls()
  t.after(() => void controls.close())

  let page = await t.serve(await createTestServer(controls.fetch))
  let errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  if (!javaScript)
    await page.route('**/*', (route) =>
      route.request().resourceType() === 'script' ? route.abort() : route.continue(),
    )

  await page.emulateMedia({ colorScheme: 'light', reducedMotion })
  await page.goto('/')
  if (javaScript) await page.locator('html[data-hydrated]').waitFor({ state: 'attached' })
  return Object.assign(page, { errors })
}

type Page = Awaited<ReturnType<typeof open>>

function example(page: Page, title: string) {
  return page.locator(`[data-example="${title}"]`).first()
}

function section(page: Page, id: string) {
  return page.locator(`section[aria-labelledby="${id}"]`)
}

function computed(locator: ReturnType<Page['locator']>, property: string) {
  return locator.first().evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property)
}

// The states assistive technology reads, from the accessibility tree.
async function states(page: Page) {
  let checkbox = section(page, 'checkbox')
  let switches = section(page, 'switch')
  let radios = section(page, 'radio-group')
  let toggles = section(page, 'toggle')
  let groups = section(page, 'toggle-group')

  return {
    terms: await checkbox.getByRole('checkbox', { name: 'Accept terms and conditions' }).first().isChecked(),
    described: await example(page, 'With description').getByRole('checkbox').isChecked(),
    invalid: await example(page, 'Invalid').getByRole('checkbox').getAttribute('aria-invalid'),
    disabled: await example(page, 'Disabled').getByRole('checkbox').isDisabled(),
    rows: await checkbox
      .getByRole('checkbox', { name: /^Select / })
      .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).checked)),
    comfortable: await radios.getByRole('radio', { name: 'Comfortable' }).isChecked(),
    bluetooth: await switches.getByRole('switch', { name: 'Bluetooth' }).isChecked(),
    airplane: await switches.getByRole('switch', { name: 'Airplane mode' }).isChecked(),
    bold: await toggles.getByRole('button', { name: 'Bold', exact: true }).first().getAttribute('aria-pressed'),
    italic: await toggles.getByRole('button', { name: 'Italic', exact: true }).first().getAttribute('aria-pressed'),
    calls: await groups
      .getByRole('group', { name: 'Calls' })
      .getByRole('button')
      .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-pressed'))),
  }
}

const serverStates = {
  terms: false,
  described: true,
  invalid: 'true',
  disabled: true,
  rows: [false, true, false, true, false],
  comfortable: true,
  bluetooth: true,
  airplane: false,
  bold: 'true',
  italic: 'false',
  calls: ['true', 'false'],
}

describe('controls', () => {
  it('names every control and gives it the right state before the browser runs any script', async (t) => {
    let page = await open(t, { javaScript: false })

    assert.deepEqual(await states(page), serverStates)
    assert.equal(await page.locator('html[data-hydrated]').count(), 0)

    // Every toggle group item stays in the tab order until the script runs.
    let tabIndexes = await page
      .locator('[data-slot="toggle-group-item"]')
      .evaluateAll((items) => items.map((item) => (item as HTMLElement).tabIndex))
    assert.ok(tabIndexes.every((index) => index === 0))
  })

  it('keeps those states once hydrated, without hydration errors, and adds the mixed state', async (t) => {
    let page = await open(t)

    assert.deepEqual(await states(page), serverStates)
    assert.deepEqual(page.errors, [])
    assert.match(await page.getByRole('table').ariaSnapshot(), /checkbox "Select all" \[checked=mixed\]/)
  })

  it("passes axe's WCAG 2.2 A and AA rules before and after the browser runs the page", async (t) => {
    let server = await open(t, { javaScript: false })
    assert.deepEqual(await findAccessibilityViolations(server), [])

    let hydrated = await open(t)
    assert.deepEqual(await findAccessibilityViolations(hydrated), [])
  })

  it('checks boxes and switches from their labels and with Space', async (t) => {
    let page = await open(t)
    let terms = section(page, 'checkbox').getByRole('checkbox', { name: 'Accept terms and conditions' }).first()
    let airplane = page.getByRole('switch', { name: 'Airplane mode' })

    await example(page, 'Basic').getByText('Accept terms and conditions').click()
    assert.equal(await terms.isChecked(), true)
    await terms.press('Space')
    assert.equal(await terms.isChecked(), false)

    await page.getByText('Airplane mode').click()
    assert.equal(await airplane.isChecked(), true)
    await airplane.press('Space')
    assert.equal(await airplane.isChecked(), false)

    // A disabled box ignores its label. Playwright waits for a label's control
    // to be enabled, so the click is forced.
    await example(page, 'Disabled').getByText('Enable notifications').click({ force: true })
    assert.equal(await example(page, 'Disabled').getByRole('checkbox').isChecked(), false)
  })

  it('moves the selection of a radio group with the arrow keys and selects with Space', async (t) => {
    let page = await open(t)
    let group = page.getByRole('radiogroup', { name: 'Density' })
    let checked = () =>
      group
        .getByRole('radio')
        .evaluateAll((radios) =>
          radios
            .filter((radio) => (radio as HTMLInputElement).checked)
            .map((radio) => (radio as HTMLInputElement).value),
        )

    let focused = () => page.evaluate(() => (document.activeElement as HTMLInputElement).value)

    await group.getByRole('radio', { name: 'Comfortable' }).focus()
    await page.keyboard.press('ArrowDown')
    assert.deepEqual([await checked(), await focused()], [['compact'], 'compact'])
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('ArrowUp')
    assert.deepEqual([await checked(), await focused()], [['default'], 'default'])

    // At the ends the arrows follow the engine's own radios: Chromium and
    // Firefox wrap around, WebKit stays put. Either way one radio stays
    // selected and focused.
    let wraps = page.context().browser()?.browserType().name() !== 'webkit'
    await page.keyboard.press('ArrowUp')
    let end = wraps ? 'compact' : 'default'
    assert.deepEqual([await checked(), await focused()], [[end], end])

    // Tab leaves the group at once: it holds one tab stop.
    await page.keyboard.press('Tab')
    assert.equal(await page.evaluate(() => (document.activeElement as HTMLInputElement).name), 'plan')

    // In a group with nothing selected, Space selects the focused radio.
    let notify = page.getByRole('radio', { name: 'SMS only' })
    await notify.focus()
    await page.keyboard.press('Space')
    assert.equal(await notify.isChecked(), true)
  })

  it("moves a toggle group's tab stop off an item a style sheet hides, so Tab still enters the group", async (t) => {
    let page = await open(t)
    // An app's own rule hides the pressed Bold item from outside the group.
    await page.addStyleTag({ content: '.no-bold [aria-label="Text formatting"] [value="bold"] { visibility: hidden }' })
    await page.evaluate(() => document.body.classList.add('no-bold'))

    await section(page, 'toggle-group').getByRole('heading', { name: 'Multiple' }).click()
    await page.keyboard.press('Tab')

    assert.equal(await page.evaluate(() => (document.activeElement as HTMLButtonElement).value), 'italic')
  })

  it('presses toggles with Space and Enter, and moves through a toggle group with the arrow keys', async (t) => {
    let page = await open(t)
    let italic = section(page, 'toggle').getByRole('button', { name: 'Italic', exact: true }).first()

    await italic.press('Space')
    assert.equal(await italic.getAttribute('aria-pressed'), 'true')
    await italic.press('Enter')
    assert.equal(await italic.getAttribute('aria-pressed'), 'false')

    let group = section(page, 'toggle-group').getByRole('group', { name: 'Text formatting' })
    let focused = () => page.evaluate(() => (document.activeElement as HTMLButtonElement).value)
    await section(page, 'toggle-group').getByRole('heading', { name: 'Multiple' }).click()
    await page.keyboard.press('Tab')
    assert.equal(await focused(), 'bold')
    await page.keyboard.press('ArrowRight')
    assert.equal(await focused(), 'italic')
    await page.keyboard.press('Space')
    await page.keyboard.press('End')
    assert.equal(await focused(), 'underline')
    await page.keyboard.press('ArrowRight')
    assert.equal(await focused(), 'bold')

    let pressed = await group
      .getByRole('button')
      .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-pressed')))
    assert.deepEqual(pressed, ['true', 'true', 'false'])

    // Tab leaves the group in one step, and Shift+Tab comes back to the last item used.
    await page.keyboard.press('Tab')
    assert.equal(
      await page.evaluate(() =>
        document.activeElement?.closest('[data-slot="toggle-group"]')?.getAttribute('aria-label'),
      ),
      'Calls',
    )
    await page.keyboard.press('Shift+Tab')
    assert.equal(await focused(), 'bold')
  })

  it('selects all rows from a mixed box, clears them, and turns mixed again', async (t) => {
    let page = await open(t)
    let table = page.getByRole('table')
    let selectAll = table.getByRole('checkbox', { name: 'Select all' })
    let status = example(page, 'Select all').getByRole('status')

    await selectAll.click()
    assert.match(await table.ariaSnapshot(), /checkbox "Select all" \[checked\]/)
    assert.equal(await status.innerText(), '4 of 4 selected')

    await selectAll.click()
    assert.equal(await selectAll.isChecked(), false)
    assert.equal(await status.innerText(), '0 of 4 selected')

    await table.getByRole('checkbox', { name: 'Select Priya Patel' }).click()
    assert.match(await table.ariaSnapshot(), /checkbox "Select all" \[checked=mixed\]/)
    assert.equal(
      await computed(example(page, 'Select all').locator('[data-slot="checkbox-mixed-indicator"]'), 'display'),
      'grid',
    )
  })

  it('follows each controlled example', async (t) => {
    let page = await open(t)

    await page.getByRole('radio', { name: 'Yearly, two months free' }).click()
    assert.equal(await example(page, 'Controlled').first().getByRole('status').innerText(), 'Billing: yearly')

    await page.getByRole('switch', { name: 'Pay invoices automatically' }).click()
    assert.equal(await section(page, 'switch').getByRole('status').innerText(), 'Automatic payment is off.')

    let filter = page.getByRole('group', { name: 'Invoice status' })
    await filter.getByRole('button', { name: 'Open' }).click()
    assert.equal(await example(page, 'Filter').getByRole('status').innerText(), 'Showing 2 of 4 invoices')
    await filter.getByRole('button', { name: 'Open' }).click()
    assert.equal(await filter.getByRole('button', { name: 'All' }).getAttribute('aria-pressed'), 'true')

    await page.getByRole('button', { name: 'Underline' }).nth(1).click()
    assert.equal(await example(page, 'Formatting').getByRole('status').innerText(), 'Formatting: bold, underline')
  })

  it('submits the native values, but no toggle, and blocks submission until required fields are set', async (t) => {
    let page = await open(t)
    let form = section(page, 'native-form')

    await form.getByText('SMS').click()
    await form.getByText('Pro').click()
    await form.getByRole('switch', { name: 'Pay automatically' }).click()
    await form.getByRole('button', { name: 'Italic' }).click()
    assert.equal(new URL(page.url()).pathname, '/')

    // WebKit's own message would starve the next click of frames (see validation.ts).
    let invalidControls = await suppressValidationMessages(page)
    await form.getByRole('button', { name: 'Save' }).click()
    assert.equal(new URL(page.url()).pathname, '/')
    assert.deepEqual(await invalidControls(), ['terms'])
    assert.equal(
      await form
        .getByRole('checkbox', { name: 'I accept the terms' })
        .evaluate((input) => (input as HTMLInputElement).validity.valueMissing),
      true,
    )

    await form.getByText('I accept the terms').click()
    await form.getByRole('button', { name: 'Save' }).click()
    await page.getByRole('heading', { name: 'Submitted values' }).waitFor()

    let submitted = await page.getByRole('list', { name: 'Submitted values' }).getByRole('listitem').allInnerTexts()
    assert.deepEqual(submitted, ['reminders=email', 'reminders=sms', 'plan=pro', 'autopay=yes', 'terms=accepted'])
  })

  it('resets native controls to their defaults', async (t) => {
    let page = await open(t)
    let form = section(page, 'native-form')
    let values = () =>
      form
        .locator('form')
        .evaluate((element) => [...new FormData(element as HTMLFormElement)].map((pair) => pair.join('=')))

    await form.getByText('Email').click()
    await form.getByText('Pro').click()
    await form.getByRole('switch', { name: 'Pay automatically' }).click()
    assert.deepEqual(await values(), ['plan=pro', 'autopay=yes'])

    await form.getByRole('button', { name: 'Reset' }).click()
    assert.deepEqual(await values(), ['reminders=email', 'plan=free'])
  })

  it("fills checked controls with each theme's primary color", async (t) => {
    let page = await open(t)
    let box = example(page, 'With description').getByRole('checkbox')
    let radio = page.getByRole('radio', { name: 'Comfortable' })
    let track = page.getByRole('switch', { name: 'Bluetooth' })

    // Engines write oklch() colors differently, so compare with the engine's
    // own --primary: the native form's Save button is filled with it.
    let save = page.getByRole('button', { name: 'Save' })
    let primaries: string[] = []

    for (let scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme })
      let primary = await computed(save, 'background-color')
      primaries.push(primary)
      assert.equal(await computed(box, 'background-color'), primary, scheme)
      assert.equal(await computed(radio, 'background-color'), primary, scheme)
      assert.equal(await computed(track, 'background-color'), primary, scheme)
    }
    assert.notEqual(primaries[0], primaries[1])
  })

  it('shows the focus ring on every control, also in forced colors', async (t) => {
    let page = await open(t)
    let controls = [
      section(page, 'checkbox').getByRole('checkbox', { name: 'Accept terms and conditions' }).first(),
      page.getByRole('radio', { name: 'Comfortable' }),
      page.getByRole('switch', { name: 'Bluetooth' }),
      section(page, 'toggle').getByRole('button', { name: 'Bold', exact: true }).first(),
    ]

    for (let forcedColors of ['none', 'active'] as const) {
      await page.emulateMedia({ forcedColors })
      for (let control of controls) {
        // Reach each control with the keyboard, so every engine treats the focus as visible.
        await control.focus()
        await page.keyboard.press('Tab')
        await page.keyboard.press('Shift+Tab')
        let ring = await control.evaluate((element) => {
          let style = getComputedStyle(element)
          return [style.outlineStyle, style.outlineWidth, element.matches(':focus-visible')]
        })
        assert.deepEqual(
          ring,
          ['solid', '2px', true],
          `${(await control.getAttribute('aria-label')) ?? 'control'}, forced colors ${forcedColors}`,
        )
      }
    }
  })

  it('hands boxes and radios to the system in forced colors, and keeps switches and pressed toggles visible', async (t) => {
    let page = await open(t)
    await page.emulateMedia({ forcedColors: 'active' })

    let box = example(page, 'With description').getByRole('checkbox')
    assert.equal(await computed(box, 'appearance'), 'auto')
    assert.equal(
      await computed(example(page, 'With description').locator('[data-slot="checkbox-indicator"]'), 'display'),
      'none',
    )
    assert.equal(await computed(page.getByRole('radio', { name: 'Comfortable' }), 'appearance'), 'auto')

    let track = page.getByRole('switch', { name: 'Bluetooth' })
    let thumb = example(page, 'With label').locator('[data-slot="switch-thumb"]')
    assert.equal(await computed(track, 'border-top-style'), 'solid')
    assert.notEqual(await computed(track, 'border-top-color'), 'rgba(0, 0, 0, 0)')
    assert.equal(await computed(thumb, 'border-top-width'), '1px')
    let off = page.getByRole('switch', { name: 'Airplane mode' })
    assert.notEqual(await computed(track, 'border-top-color'), await computed(off, 'border-top-color'))

    // Forced colors draw a backplate behind text, so a pressed toggle keeps its
    // text colors and shows its state with a thick highlight border instead.
    let pressed = section(page, 'toggle').getByRole('button', { name: 'Bold', exact: true }).first()
    let released = section(page, 'toggle').getByRole('button', { name: 'Italic', exact: true }).first()
    assert.equal(await computed(pressed, 'border-bottom-width'), '3px')
    assert.equal(await computed(released, 'border-bottom-width'), '1px')
    assert.equal(await computed(pressed, 'color'), await computed(released, 'color'))
  })

  it('animates the switch thumb only without reduced motion', async (t) => {
    let page = await open(t, { reducedMotion: 'no-preference' })
    let thumb = example(page, 'With label').locator('[data-slot="switch-thumb"]')

    assert.equal(await computed(thumb, 'transition-duration'), '0.1s')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    assert.equal(await computed(thumb, 'transition-duration'), '0s')
  })

  it('follows the text direction: thumbs, joined corners and arrow keys mirror', async (t) => {
    let page = await open(t)
    let rtl = page.locator('[data-rtl]')

    let { thumb, track } = await rtl.evaluate((panel) => {
      let input = panel.querySelector('[role="switch"]') as HTMLElement
      let knob = panel.querySelector('[data-slot="switch-thumb"]') as HTMLElement
      return { thumb: knob.getBoundingClientRect(), track: input.getBoundingClientRect() }
    })
    // A checked switch in right-to-left text has its thumb at the left end.
    assert.ok(thumb.left - track.left < 3, `thumb ${thumb.left}, track ${track.left}`)

    let first = rtl.locator('[data-slot="toggle-group-item"]').first()
    assert.equal(await computed(first, 'border-top-right-radius'), '4px')
    assert.equal(await computed(first, 'border-top-left-radius'), '0px')

    await first.focus()
    await page.keyboard.press('ArrowLeft')
    assert.equal(await page.evaluate(() => (document.activeElement as HTMLButtonElement).value), 'center')
  })

  it('reflows to a 320px wide viewport without scrolling sideways, also with text at 200%', async (t) => {
    let page = await open(t)
    await page.setViewportSize({ width: 320, height: 640 })

    for (let fontSize of ['', '32px']) {
      for (let colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme })
        await page.evaluate((size) => (document.documentElement.style.fontSize = size), fontSize)

        let width = await page.evaluate(() => document.documentElement.scrollWidth)
        assert.equal(width, 320, `${colorScheme}, root font size ${fontSize || 'default'}`)
      }
    }
  })
})
