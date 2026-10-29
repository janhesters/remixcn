import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { findAccessibilityViolations } from './accessibility.ts'
import { createOverlayExamples } from './fixtures/overlays/server.tsx'

// Pages open with reduced motion, so popups appear without a fade and every
// read sees the final style. The motion test opts back in.
async function open(
  t: TestContext,
  {
    reducedMotion = 'reduce' as 'reduce' | 'no-preference',
    hydrate = true,
    colorScheme = 'light' as 'light' | 'dark',
  } = {},
) {
  let examples = await createOverlayExamples()
  t.after(() => void examples.close())

  let server = await createTestServer(examples.fetch)
  let page = await t.serve(server)
  await page.emulateMedia({ colorScheme, reducedMotion })
  await page.goto('/')
  if (hydrate) await page.locator('html[data-ready]').waitFor({ state: 'attached' })
  return { page, server }
}

type Page = Awaited<ReturnType<typeof open>>['page']

function example(page: Page, name: string) {
  return page.locator(`[data-example="${name}"]`)
}

/** Clicks the example's heading, which closes the popups open on load, then tabs to its first control. */
async function tabInto(page: Page, name: string) {
  await example(page, name).locator('h3').click()
  await page.keyboard.press('Tab')
}

function isOpen(page: Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((element) => element.matches(':popover-open'))
}

function box(page: Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((element) => {
      let { left, top, right, bottom } = element.getBoundingClientRect()
      return { left: Math.round(left), top: Math.round(top), right: Math.round(right), bottom: Math.round(bottom) }
    })
}

/** Waits for the popup to be shown or hidden, after the render that follows an interaction. */
function waitOpen(page: Page, selector: string, open = true) {
  return page.waitForFunction(
    ([selector, open]) => document.querySelector(selector as string)?.matches(':popover-open') === open,
    [selector, open] as const,
  )
}

/** Waits for focus on, or inside, the element. */
function waitFocusIn(page: Page, selector: string) {
  return page.waitForFunction(
    (selector) => document.querySelector(selector)?.contains(document.activeElement) === true,
    selector,
  )
}

/** Waits until the element named `name` has focus: focus moves a frame after a popover opens, and after it closes. */
async function waitFocused(page: Page, name: string) {
  await page.waitForFunction((name) => {
    let active = document.activeElement
    return (active?.getAttribute('aria-label') ?? active?.textContent?.trim() ?? '') === name
  }, name)
}

function focused(page: Page) {
  return page.evaluate(() => {
    let active = document.activeElement
    return active?.getAttribute('aria-label') ?? active?.textContent?.trim() ?? ''
  })
}

describe('Popover, Hover Card and Tooltip examples', () => {
  it('show one of each open in the top layer beside its trigger, and pass axe in both themes', async (t) => {
    for (let colorScheme of ['light', 'dark'] as const) {
      let { page } = await open(t, { colorScheme })
      let open_ = example(page, 'open-popover')

      for (let [name, part, side] of [
        ['open-popover', 'popover', 'bottom'],
        ['open-hover-card', 'hover-card', 'bottom'],
        ['open-tooltip', 'tooltip', 'top'],
      ] as const) {
        let content = `[data-example="${name}"] [data-slot="${part}-content"]`
        assert.equal(await isOpen(page, content), true, `${name} is closed`)
        assert.equal(await page.locator(content).getAttribute('data-side'), side)
      }
      let trigger = await box(page, '[data-example="open-popover"] [data-slot="popover-trigger"]')
      let content = await box(page, '[data-example="open-popover"] [data-slot="popover-content"]')
      assert.equal(content.top, trigger.bottom + 4)
      assert.equal(await open_.getByRole('button', { name: 'Reminder schedule' }).getAttribute('aria-expanded'), 'true')

      assert.deepEqual(await findAccessibilityViolations(page), [], colorScheme)
    }
  })

  it('open a popover from the keyboard with focus inside, keep what you typed, and return focus on Escape', async (t) => {
    let { page } = await open(t)
    let form = example(page, 'popover-form')
    let trigger = form.getByRole('button', { name: 'Reminder schedule' })

    await tabInto(page, 'popover-form')
    assert.equal(await focused(page), 'Reminder schedule')
    await page.keyboard.press('Enter')
    let dialog = page
      .getByRole('dialog', { name: 'Reminder schedule' })
      .filter({ has: page.getByLabel('Repeat every') })
    await dialog.waitFor()
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true')
    // Focus moves to the first field on the frame after the popover shows.
    let days = dialog.getByLabel('Days after due')
    await page.waitForFunction((field) => document.activeElement === field, await days.elementHandle())
    assert.equal(await days.evaluate((field) => field === document.activeElement), true)
    assert.equal(await days.inputValue(), '3')

    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.type('30')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    assert.equal(await focused(page), 'Save')
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
    await waitFocused(page, 'Reminder schedule')
    assert.equal(await focused(page), 'Reminder schedule')
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false')

    await page.keyboard.press('Enter')
    await dialog.waitFor()
    assert.equal(await dialog.getByLabel('Days after due').inputValue(), '30')
  })

  it('close a popover on a click outside and on Tab out, and its close button returns focus', async (t) => {
    let { page } = await open(t)
    let basic = example(page, 'popover-basic')
    let trigger = basic.getByRole('button', { name: 'Payment terms' })
    let content = '[data-example="popover-basic"] [data-slot="popover-content"]'

    await trigger.click()
    await waitOpen(page, content)
    await page.locator('h1').click()
    await waitOpen(page, content, false)

    await trigger.click()
    // Focus moves to the popover itself on the next frame, as it holds no control; Tab then leaves it.
    await waitFocusIn(page, content)
    await page.keyboard.press('Tab')
    await waitOpen(page, content, false)
    assert.equal(await page.locator(content).evaluate((element) => element.contains(document.activeElement)), false)

    let form = example(page, 'popover-form')
    await form.getByRole('button', { name: 'Reminder schedule' }).click()
    await form.getByRole('button', { name: 'Save' }).click()
    await waitOpen(page, '[data-example="popover-form"] [data-slot="popover-content"]', false)
    await waitFocused(page, 'Reminder schedule')
    assert.equal(await focused(page), 'Reminder schedule')
  })

  it('close a popover when Shift+Tab leaves through its trigger', async (t) => {
    let { page } = await open(t)
    let content = '[data-example="popover-form"] [data-slot="popover-content"]'

    await tabInto(page, 'popover-form')
    await page.keyboard.press('Enter')
    await waitFocusIn(page, content)
    await page.keyboard.press('Shift+Tab')
    assert.equal(await focused(page), 'Reminder schedule')
    assert.equal(await isOpen(page, content), true)

    await page.keyboard.press('Shift+Tab')
    await waitOpen(page, content, false)
    assert.equal(await focused(page), 'End')
  })

  it('keep the outer popover open for a nested one, and Escape closes them one at a time', async (t) => {
    let { page } = await open(t)
    let nested = example(page, 'popover-nested')
    let outer = '[data-example="popover-nested"] [data-slot="popover-content"]'

    await nested.getByRole('button', { name: 'Filters' }).click()
    await nested.getByRole('button', { name: 'Customer' }).click()
    let customer = page.getByRole('dialog', { name: 'Customer' })
    await customer.waitFor()
    await customer.getByRole('button', { name: 'Globex' }).hover()
    assert.equal(await isOpen(page, outer), true)

    await page.keyboard.press('Escape')
    await customer.waitFor({ state: 'hidden' })
    assert.equal(await isOpen(page, outer), true)
    await waitFocused(page, 'Customer')
    assert.equal(await focused(page), 'Customer')

    await page.keyboard.press('Escape')
    await waitOpen(page, outer, false)
    await waitFocused(page, 'Filters')
    assert.equal(await focused(page), 'Filters')
  })

  it('make the page wait behind a modal popover until it closes', async (t) => {
    let { page } = await open(t)
    await example(page, 'popover-modal').getByRole('button', { name: 'Void invoice' }).click()
    await page.getByRole('dialog', { name: 'Void INV-0042?' }).waitFor()
    let waiting = () =>
      page.evaluate(() => [
        getComputedStyle(document.documentElement).overflowY === 'hidden',
        document.querySelector('h1')!.closest('[inert]') !== null,
      ])

    // The page waits from the commit that shows the popover until the one that hides it.
    await page.waitForFunction(() => document.querySelector('h1')!.closest('[inert]') !== null)
    assert.deepEqual(await waiting(), [true, true])

    await page.getByRole('button', { name: 'Keep' }).click()
    await page.waitForFunction(() => document.querySelector('h1')!.closest('[inert]') === null)
    assert.deepEqual(await waiting(), [false, false])
  })

  it('follow the open state a caller controls, and say why it changed', async (t) => {
    let { page } = await open(t)
    let controlled = example(page, 'popover-controlled')
    let status = controlled.getByRole('status')

    await controlled.getByRole('button', { name: 'Show overdue' }).click()
    await page.getByRole('dialog', { name: '3 overdue invoices' }).waitFor()
    assert.equal(await status.innerText(), 'Opened by the other button.')

    await page.keyboard.press('Escape')
    await page.getByRole('dialog', { name: '3 overdue invoices' }).waitFor({ state: 'hidden' })
    assert.equal(await status.innerText(), 'Closed by Escape.')
  })

  it('open a hover card under a resting pointer, keep it while the pointer crosses to its link, and close it after', async (t) => {
    let { page } = await open(t)
    let basic = example(page, 'hover-card-basic')
    let content = '[data-example="hover-card-basic"] [data-slot="hover-card-content"]'
    let link = basic.getByRole('link', { name: '@acme-labs' })
    let trigger = await box(page, '[data-example="hover-card-basic"] [data-slot="hover-card-trigger"]')

    await link.hover()
    await page.locator(`${content}[data-open]`).waitFor()

    // Down out of the link, across the gap, to the link in the card.
    let card = await box(page, content)
    let x = Math.round((trigger.left + trigger.right) / 2)
    await page.mouse.move(x, card.top + 2, { steps: 4 })
    let invoices = page.getByRole('link', { name: 'Open invoices' })
    await invoices.hover()
    assert.equal(await isOpen(page, content), true)
    await invoices.click()
    assert.equal(new URL(page.url()).hash, '#acme-labs-invoices')

    await page.mouse.move(5, 5)
    await page.locator(`${content}[data-closed]`).waitFor({ state: 'attached' })
    assert.equal(await isOpen(page, content), false)
  })

  it('put focus back on the hover card link when Escape closes the card from inside', async (t) => {
    let { page } = await open(t)
    let content = '[data-example="hover-card-basic"] [data-slot="hover-card-content"]'

    await tabInto(page, 'hover-card-basic')
    assert.equal(await focused(page), '@acme-labs')
    await waitOpen(page, content)
    await page.keyboard.press('Tab')
    assert.equal(await focused(page), 'Open invoices')

    await page.keyboard.press('Escape')
    await waitOpen(page, content, false)
    assert.equal(await focused(page), '@acme-labs')
  })

  it('open a tooltip on hover and keyboard focus, close it on Escape, and describe the trigger', async (t) => {
    let { page } = await open(t)
    let basic = example(page, 'tooltip-basic')
    let trigger = basic.getByRole('button', { name: 'Show tooltip' })
    let content = '[data-example="tooltip-basic"] [data-slot="tooltip-content"]'

    let description = await trigger.evaluate((element) =>
      element
        .getAttribute('aria-describedby')!
        .split(' ')
        .map((id) => document.getElementById(id)?.textContent)
        .join(' '),
    )
    assert.equal(description, 'Add to the reminder list')

    await trigger.hover()
    await page.locator(`${content}[data-open]`).waitFor()
    await page.keyboard.press('Escape')
    await waitOpen(page, content, false)

    await page.mouse.move(5, 5)
    await tabInto(page, 'tooltip-basic')
    await page.locator(`${content}[data-open]`).waitFor()
    assert.equal(await page.locator(content).getAttribute('data-side'), 'top')
  })

  it('show the tooltip of a disabled button that keeps focus', async (t) => {
    let { page } = await open(t)
    await tabInto(page, 'tooltip-disabled')

    assert.equal(await focused(page), 'Refund')
    await page.locator('[data-example="tooltip-disabled"] [data-slot="tooltip-content"][data-open]').waitFor()
  })

  it('open the next tooltip of a toolbar at once', async (t) => {
    let { page } = await open(t)
    let toolbar = example(page, 'tooltip-toolbar')
    let contents = toolbar.locator('[data-slot="tooltip-content"]')

    await toolbar.getByRole('button', { name: 'Archive' }).hover()
    await contents.nth(0).and(page.locator('[data-open]')).waitFor()
    await toolbar.getByRole('button', { name: 'Send' }).hover()
    // Faster than the provider's 400ms delay, which the first one waited for.
    await contents.nth(1).and(page.locator('[data-open]')).waitFor({ timeout: 200 })
    assert.equal(await contents.nth(0).evaluate((element) => element.matches(':popover-open')), false)
  })

  it('follow a link on the first tap, opening no hover card or tooltip on touch', async (t) => {
    let { page, server } = await open(t, { hydrate: false })
    let context = await page.context().browser()!.newContext({ hasTouch: true, baseURL: server.baseUrl })
    t.after(() => context.close())
    let touch = await context.newPage()
    await touch.goto('/')
    await touch.locator('html[data-ready]').waitFor({ state: 'attached' })

    await example(touch, 'hover-card-basic').getByRole('link', { name: '@acme-labs' }).tap()
    assert.equal(new URL(touch.url()).hash, '#acme-labs')
    assert.equal(await isOpen(touch, '[data-example="hover-card-basic"] [data-slot="hover-card-content"]'), false)

    await example(touch, 'tooltip-link').getByRole('link', { name: 'Payment terms' }).tap()
    assert.equal(new URL(touch.url()).hash, '#payment-terms')
    assert.equal(await isOpen(touch, '[data-example="tooltip-link"] [data-slot="tooltip-content"]'), false)
  })

  it('open a popover natively without JavaScript, and from the server outside a client entry', async (t) => {
    let { page, server } = await open(t)
    let context = await page.context().browser()!.newContext({ javaScriptEnabled: false, baseURL: server.baseUrl })
    t.after(() => context.close())
    let static_ = await context.newPage()
    await static_.goto('/')

    for (let current of [static_, page]) {
      let serverOnly = example(current, 'server-popover')
      let content = '[data-example="server-popover"] [data-slot="popover-content"]'
      await serverOnly.getByRole('button', { name: 'Payment terms' }).click()
      assert.equal(await isOpen(current, content), true)
      // The browser centers it in the viewport.
      let { left, right } = await box(current, content)
      let width = await current.evaluate(() => document.documentElement.clientWidth)
      assert.ok(Math.abs(left + right - width) <= 2, `${left} to ${right} in ${width}`)

      await current.getByRole('button', { name: 'Close' }).click()
      assert.equal(await isOpen(current, content), false)
      await serverOnly.getByRole('button', { name: 'Payment terms' }).click()
      await current.keyboard.press('Escape')
      assert.equal(await isOpen(current, content), false)
    }

    let tooltip = example(static_, 'server-tooltip').getByRole('button', { name: 'Archive' })
    let id = await tooltip.getAttribute('aria-describedby')
    assert.equal(await static_.locator(`[id="${id}"]`).textContent(), 'Moves the invoice to the archive')
  })

  it('keep a popover the browser opened before the script ran, now beside its trigger', async (t) => {
    let examples = await createOverlayExamples()
    t.after(() => void examples.close())
    let server = await createTestServer(examples.fetch)
    let page = await t.serve(server)
    let release!: () => void
    let released = new Promise<void>((resolve) => (release = resolve))
    await page.route(
      (url) => /\.(ts|tsx|js)$/.test(url.pathname),
      async (route) => {
        await released
        await route.continue()
      },
    )
    // The module scripts wait, so the page never reaches DOMContentLoaded until they're released.
    await page.goto('/', { waitUntil: 'commit' })

    let basic = example(page, 'popover-basic')
    let content = '[data-example="popover-basic"] [data-slot="popover-content"]'
    await basic.getByRole('button', { name: 'Payment terms' }).click()
    assert.equal(await isOpen(page, content), true)

    release()
    await page.locator('html[data-ready]').waitFor({ state: 'attached' })
    await page.locator(`${content}[data-open][data-side="bottom"]`).waitFor({ state: 'attached' })
    assert.equal(await isOpen(page, content), true)
    assert.equal(await basic.getByRole('button', { name: 'Payment terms' }).getAttribute('aria-expanded'), 'true')
    let trigger = await box(page, '[data-example="popover-basic"] [data-slot="popover-trigger"]')
    assert.equal((await box(page, content)).top, trigger.bottom + 4)
  })

  it('fit an open popover into 320px with text at 200%, without scrolling sideways', async (t) => {
    let { page } = await open(t)
    await page.setViewportSize({ width: 320, height: 640 })
    await page.evaluate(() => (document.documentElement.style.fontSize = '32px'))

    await example(page, 'popover-form').getByRole('button', { name: 'Reminder schedule' }).click()
    let content = '[data-example="popover-form"] [data-slot="popover-content"]'
    await page.locator(`${content}[data-open]`).waitFor()
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    let { left, right, bottom } = await box(page, content)

    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320)
    assert.ok(left >= 5 && right <= 315, `${left} to ${right}`)
    assert.ok(bottom <= 635, `ends at ${bottom}`)
    // What doesn't fit scrolls inside it.
    assert.ok(await page.locator(content).evaluate((element) => element.scrollHeight >= element.clientHeight))
  })

  it('fade in only without reduced motion', async (t) => {
    for (let [reducedMotion, duration] of [
      ['reduce', '0s'],
      ['no-preference', '0.1s'],
    ] as const) {
      let { page } = await open(t, { reducedMotion })
      let duration_ = await page
        .locator('[data-example="open-popover"] [data-slot="popover-content"]')
        .evaluate((element) => getComputedStyle(element).transitionDuration)
      assert.equal(duration_, duration, reducedMotion)
    }
  })

  it('draw their edges in the system text color in forced colors', async (t) => {
    let { page } = await open(t)
    await page.emulateMedia({ forcedColors: 'active' })
    let styles = await page.evaluate(() => {
      // The engine's own CanvasText, which a visible edge in forced colors uses.
      let probe = document.createElement('div')
      probe.style.color = 'CanvasText'
      document.body.append(probe)
      let canvasText = getComputedStyle(probe).color
      probe.remove()
      let popover = document.querySelector('[data-example="open-popover"] [data-slot="popover-content"]')!
      let card = document.querySelector('[data-example="open-hover-card"] [data-slot="hover-card-content"]')!
      let tooltip = document.querySelector('[data-example="open-tooltip"] [data-slot="tooltip-content"]')!
      return {
        forced: matchMedia('(forced-colors: active)').matches,
        canvasText,
        popover: [getComputedStyle(popover).borderTopStyle, getComputedStyle(popover).borderTopColor],
        card: [getComputedStyle(card).borderTopStyle, getComputedStyle(card).borderTopColor],
        tooltip: [getComputedStyle(tooltip).outlineStyle, getComputedStyle(tooltip).outlineColor],
      }
    })

    assert.equal(styles.forced, true)
    assert.notEqual(styles.canvasText, 'rgba(0, 0, 0, 0)')
    assert.deepEqual(styles.popover, ['solid', styles.canvasText])
    assert.deepEqual(styles.card, ['solid', styles.canvasText])
    assert.deepEqual(styles.tooltip, ['solid', styles.canvasText])
  })

  it('mirror start alignment and inline sides in right-to-left text', async (t) => {
    let { page } = await open(t)
    // A popup hides while its trigger is scrolled out of view.
    await example(page, 'rtl-popover').scrollIntoViewIfNeeded()
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    let trigger = await box(page, '[data-example="rtl-popover"] [data-slot="popover-trigger"]')
    let content = await box(page, '[data-example="rtl-popover"] [data-slot="popover-content"]')
    assert.equal(content.right, trigger.right)

    let sides = example(page, 'rtl-tooltip-sides')
    await sides.getByRole('button', { name: 'inline start' }).hover()
    let tooltip = sides.locator('[data-slot="tooltip-content"][data-open]')
    await tooltip.waitFor()
    assert.equal(await tooltip.getAttribute('data-side'), 'right')
  })
})
