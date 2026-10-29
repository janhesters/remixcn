import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { contrastRatio } from '../scripts/color.ts'
import { findAccessibilityViolations } from './accessibility.ts'
import { createToastExamples } from './fixtures/toast/server.tsx'

// Pages open with reduced motion, so transitions take 0s and a closed toast
// leaves at once. The clock is paused, so time moves only with runFor.
async function open(
  t: TestContext,
  {
    reducedMotion = 'reduce' as 'reduce' | 'no-preference',
    clock = true,
    colorScheme = 'light' as 'light' | 'dark',
  } = {},
) {
  let examples = await createToastExamples()
  t.after(() => void examples.close())

  let server = await createTestServer(examples.fetch)
  let page = await t.serve(server)
  await page.emulateMedia({ colorScheme, reducedMotion })
  if (clock) await page.clock.install()
  await page.goto('/')
  await page.locator('html[data-ready]').waitFor({ state: 'attached' })
  if (clock) await page.clock.pauseAt(Date.now() + 60_000)
  return page
}

type Page = Awaited<ReturnType<typeof open>>

function example(page: Page, title: string) {
  return page.locator(`[data-example="${title}"]`)
}

/** Presses an example's button. Open toasts may cover it, as they cover any page, so this skips the pointer. */
async function press(page: Page, title: string, name?: string) {
  await example(page, title)
    .getByRole('button', name ? { name } : {})
    .first()
    .dispatchEvent('click')
}

/**
 * Waits until the page reports true. It polls from here, because the page's
 * own timers and animation frames stand still with the paused clock.
 */
async function until(page: Page, check: () => boolean, message: string) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (await page.evaluate(check)) return
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  assert.fail(message)
}

const region = (page: Page, name = 'Notifications (F6)') => page.getByRole('region', { name })
const toasts = (page: Page, name?: string) => region(page, name).locator('[data-slot="toast"]')
const titles = (page: Page, name?: string) => toasts(page, name).locator('[data-slot="toast-title"]').allInnerTexts()

describe('Toast examples', () => {
  it('show a toast from a hydrated button in the labelled region, and announce it once', async (t) => {
    let page = await open(t)

    await example(page, 'Basic').getByRole('button', { name: 'Show toast' }).click()

    let toast = region(page).getByRole('dialog', { name: 'Invoice sent' })
    await toast.waitFor()
    assert.equal(
      await toast.getAttribute('aria-describedby').then((id) => page.locator(`#${id}`).innerText()),
      'INV-0042 to Acme Labs, due Friday 14 November.',
    )
    assert.equal(await page.getByRole('status').filter({ hasText: 'Invoice sent' }).count(), 1)
    assert.equal(
      await page.locator('[data-slot="toast-announcer"] [role="status"] > *').count(),
      1,
      'one announcement for one toast',
    )
  })

  it('close after five seconds, but not while a pointer is over them', async (t) => {
    let page = await open(t)
    await press(page, 'Basic')
    await toasts(page).first().waitFor()

    await page.clock.runFor(4000)
    await toasts(page).first().hover()
    await page.clock.runFor(10_000)
    assert.deepEqual(await titles(page), ['Invoice sent'])
    assert.equal(await region(page).getAttribute('data-expanded'), '')

    await page.mouse.move(5, 5)
    await page.clock.runFor(900)
    assert.deepEqual(await titles(page), ['Invoice sent'])
    await page.clock.runFor(200)
    await toasts(page).first().waitFor({ state: 'detached' })
  })

  it('move keyboard focus to the newest toast with F6, pause and expand while it is there, and return with F6', async (t) => {
    let page = await open(t)
    let origin = example(page, 'Basic').getByRole('button')
    await press(page, 'With action')
    await press(page, 'Basic')
    await origin.focus()

    await page.keyboard.press('F6')
    assert.equal(
      await toasts(page)
        .first()
        .evaluate((toast) => document.activeElement === toast),
      true,
    )
    assert.equal(await region(page).getAttribute('data-expanded'), '')
    await page.clock.runFor(30_000)
    assert.deepEqual(await titles(page), ['Invoice sent', 'Invoice archived'])

    await page.keyboard.press('F6')
    assert.equal(await origin.evaluate((button) => document.activeElement === button), true)
    assert.equal(await region(page).getAttribute('data-expanded'), null)
    await page.clock.runFor(5100)
    assert.deepEqual(await titles(page), [])
  })

  it('take a closing toast out of keyboard reach during its exit, so its action never runs', async (t) => {
    let page = await open(t, { reducedMotion: 'no-preference', clock: false })
    await press(page, 'Basic')
    await press(page, 'With action')

    await page.keyboard.press('F6')
    await page.keyboard.press('Escape')
    let closing = region(page).locator('[data-ending-style]')
    assert.equal(await closing.count(), 1, 'the exit is running')
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Shift+Tab')
    assert.equal(await closing.evaluate((toast) => toast.contains(document.activeElement)), false)
    await page.keyboard.press('Enter')

    await closing.waitFor({ state: 'detached' })
    assert.equal(await region(page).getByRole('dialog', { name: 'INV-0042 is back in your invoices.' }).count(), 0)
  })

  it('close a focused toast with Escape, move focus to the next one, and run its action with Enter', async (t) => {
    let page = await open(t)
    await press(page, 'With action')
    await press(page, 'Basic')

    await page.keyboard.press('F6')
    await page.keyboard.press('Escape')
    assert.deepEqual(await titles(page), ['Invoice archived'])
    assert.equal(
      await toasts(page)
        .first()
        .evaluate((toast) => document.activeElement === toast),
      true,
    )

    await page.keyboard.press('Tab')
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Undo')
    await page.keyboard.press('Enter')
    await region(page).getByRole('dialog', { name: 'INV-0042 is back in your invoices.' }).waitFor()
    assert.equal(await region(page).getByRole('dialog', { name: 'Invoice archived' }).count(), 0)
  })

  it('close with the close button and with a swipe toward the edge', async (t) => {
    let page = await open(t)
    await press(page, 'Basic')
    await toasts(page).getByRole('button', { name: 'Close toast' }).click()
    await toasts(page).first().waitFor({ state: 'detached' })

    await press(page, 'Basic')
    let box = (await toasts(page).first().boundingBox())!
    let x = box.x + box.width / 3
    let y = box.y + box.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x, y + 20, { steps: 4 })
    await page.mouse.move(x, y + 60, { steps: 4 })
    await page.mouse.up()
    await toasts(page).first().waitFor({ state: 'detached' })
  })

  it('announce an urgent toast as an alert, keep it, and close it with Retry', async (t) => {
    let page = await open(t)
    await press(page, 'Persistent')

    let toast = region(page).getByRole('alertdialog', { name: 'Card declined' })
    await toast.waitFor()
    assert.equal(
      await page.getByRole('alert').filter({ hasText: 'Card declined' }).innerText(),
      'Card declined\nThe payment for INV-0040 failed. Nothing was charged.',
    )
    await page.clock.runFor(120_000)
    assert.equal(await toast.count(), 1)

    await toast.getByRole('button', { name: 'Retry' }).click()
    await toast.waitFor({ state: 'detached' })
  })

  it('show three toasts at once: an older one waits hidden and inert until a newer one closes', async (t) => {
    let page = await open(t)
    for (let name of ['Success', 'Info', 'Warning', 'Error']) await press(page, 'Types', name)

    let oldest = toasts(page).last()
    assert.equal(await toasts(page).count(), 4)
    assert.equal(await oldest.getAttribute('data-limited'), '')
    assert.equal(await oldest.evaluate((toast) => (toast as HTMLElement).inert), true)
    assert.equal(await oldest.evaluate((toast) => getComputedStyle(toast).opacity), '0')

    await toasts(page).first().getByRole('button', { name: 'Close toast' }).click()
    await until(page, () => document.querySelectorAll('[data-limited]').length === 0, 'the oldest toast shows again')
    assert.equal(await oldest.evaluate((toast) => (toast as HTMLElement).inert), false)
  })

  it('follow a promise from loading to success or error in one toast', async (t) => {
    let page = await open(t)
    await press(page, 'Promise')
    await press(page, 'Promise that fails')

    assert.deepEqual(await toasts(page).evaluateAll((items) => items.map((item) => item.getAttribute('data-type'))), [
      'loading',
      'loading',
    ])
    await page.clock.runFor(2000)
    await region(page).getByRole('dialog', { name: 'INV-0043 sent' }).waitFor()
    await region(page).getByRole('dialog', { name: 'Invoice not sent' }).waitFor()
    assert.deepEqual(await toasts(page).evaluateAll((items) => items.map((item) => item.getAttribute('data-type'))), [
      'error',
      'success',
    ])
  })

  it('update one toast with the same id instead of stacking copies', async (t) => {
    let page = await open(t)
    await press(page, 'Deduplicated')
    await press(page, 'Deduplicated')

    assert.deepEqual(await titles(page), ['Payment link copied'])
    assert.equal(await toasts(page).locator('[data-slot="toast-description"]').innerText(), 'Copied 2 times.')
    assert.equal(await page.locator('[data-slot="toast-announcer"] [role="status"] > *').count(), 1)
  })

  it("keep each provider's toasts in its own region", async (t) => {
    let page = await open(t)
    await press(page, 'Own provider')
    await press(page, 'Basic')

    assert.deepEqual(await titles(page, 'Editor notifications (Alt+E)'), ['Draft saved'])
    assert.deepEqual(await titles(page), ['Invoice sent'])

    await press(page, 'Dismiss all')
    await toasts(page).first().waitFor({ state: 'detached' })
    assert.deepEqual(await titles(page, 'Editor notifications (Alt+E)'), ['Draft saved'])
  })

  it('place right-to-left toasts at the start, on the right, with mirrored parts', async (t) => {
    let page = await open(t)
    await press(page, 'Right to left')

    let toast = toasts(page, 'الإشعارات (Alt+R)').first()
    let box = (await toast.boundingBox())!
    let width = await page.evaluate(() => document.documentElement.clientWidth)
    assert.ok(Math.abs(width - (box.x + box.width) - 16) <= 1, `${box.x + box.width} of ${width}`)
    let [close, action] = await Promise.all([
      toast.getByRole('button', { name: 'إغلاق' }).boundingBox(),
      toast.getByRole('button', { name: 'تراجع' }).boundingBox(),
    ])
    assert.ok(close!.x < action!.x, 'the close button sits at the end, on the left')
  })
})

describe('Sonner examples', () => {
  it("show toast() in Sonner's region, reach it with Alt+T, and close after an action", async (t) => {
    let page = await open(t)
    let sonner = 'Notifications (Alt+T)'
    await press(page, 'Sonner with description')
    await press(page, 'Sonner with action')

    assert.deepEqual(await titles(page, sonner), ['Event has been deleted', 'Event has been created'])
    assert.equal(await region(page, sonner).getAttribute('data-position'), 'top-center')

    await page.keyboard.press('Alt+t')
    assert.equal(
      await toasts(page, sonner)
        .first()
        .evaluate((toast) => document.activeElement === toast),
      true,
    )
    await toasts(page, sonner).first().getByRole('button', { name: 'Undo' }).press('Enter')
    await region(page, sonner).getByRole('dialog', { name: 'Event restored' }).waitFor()
    assert.deepEqual(await titles(page, sonner), ['Event restored', 'Event has been created'])

    // Focus moved on to the next toast, so the timers wait. Alt+T returns to the page.
    await page.clock.runFor(10_000)
    assert.equal(await toasts(page, sonner).count(), 2)
    await page.keyboard.press('Alt+t')
    assert.equal(await page.evaluate(() => document.activeElement === document.body), true)
    await page.clock.runFor(4100)
    assert.deepEqual(await titles(page, sonner), [])
  })
})

describe('Toast styles', () => {
  it('animate the exit, and drop every transition for reduced motion', async (t) => {
    let page = await open(t, { reducedMotion: 'no-preference', clock: false })
    await press(page, 'Basic')
    let toast = toasts(page).first()
    await toast.waitFor()
    assert.equal(await toast.evaluate((element) => getComputedStyle(element).transitionDuration.split(', ')[0]), '0.5s')

    await toast.getByRole('button', { name: 'Close toast' }).click()
    assert.equal(await toast.getAttribute('data-ending-style'), '')
    await toast.waitFor({ state: 'detached' })

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await press(page, 'Types', 'Loading')
    let loading = toasts(page).first()
    assert.equal(await loading.evaluate((element) => getComputedStyle(element).transitionDuration.split(', ')[0]), '0s')
    assert.equal(
      await loading.locator('[data-slot="toast-icon"] svg').evaluate((svg) => getComputedStyle(svg).animationName),
      'none',
    )
  })

  it('have no WCAG 2.2 A or AA violations with several toasts open, in both themes', async (t) => {
    for (let colorScheme of ['light', 'dark'] as const) {
      // axe waits on the page's timers, so the clock runs. A window in the
      // background pauses every toast, so none closes while axe reads them.
      let page = await open(t, { colorScheme, clock: false })
      await page.evaluate(() => window.dispatchEvent(new FocusEvent('blur')))
      await press(page, 'With action')
      await press(page, 'Persistent')
      await press(page, 'Types', 'Loading')
      await press(page, 'Own provider')
      await press(page, 'Sonner with action')
      await press(page, 'Sonner types', 'Error')
      await press(page, 'Sonner custom')

      assert.deepEqual(await findAccessibilityViolations(page), [], colorScheme)
    }
  })

  it('keep the description at 4.5:1 or more on the toast in both themes', async (t) => {
    let page = await open(t)
    await press(page, 'Basic')
    let failures: string[] = []

    for (let colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      let [text, background] = await toasts(page)
        .first()
        .evaluate((toast) => {
          let canvas = document.createElement('canvas')
          canvas.width = canvas.height = 1
          let context = canvas.getContext('2d', { willReadFrequently: true })!
          let read = (color: string) => {
            context.clearRect(0, 0, 1, 1)
            context.fillStyle = color
            context.fillRect(0, 0, 1, 1)
            return [...context.getImageData(0, 0, 1, 1).data]
          }
          let description = toast.querySelector('[data-slot="toast-description"]')!
          return [read(getComputedStyle(description).color), read(getComputedStyle(toast).backgroundColor)]
        })
      let rgba = ([r, g, b]: number[]) => ({ r: r / 255, g: g / 255, b: b / 255, alpha: 1 })
      let ratio = contrastRatio(rgba(text), rgba(background))
      if (ratio < 4.5) failures.push(`${colorScheme}: ${ratio.toFixed(2)}`)
    }

    assert.deepEqual(failures, [])
  })

  it('show the focus ring and the border in forced colors', async (t) => {
    let page = await open(t)
    await press(page, 'Basic')
    await page.keyboard.press('F6')
    await page.emulateMedia({ forcedColors: 'active' })

    let toast = toasts(page).first()
    assert.deepEqual(
      await toast.evaluate((element) => {
        let style = getComputedStyle(element)
        return [style.outlineStyle, style.outlineWidth, style.borderTopStyle]
      }),
      ['solid', '2px', 'solid'],
    )
  })

  it('fit a 320px wide viewport without scrolling sideways, also with text at 200%', async (t) => {
    let page = await open(t)
    await page.setViewportSize({ width: 320, height: 640 })
    await press(page, 'With action')
    await press(page, 'Persistent')
    await press(page, 'Sonner with action')

    for (let fontSize of ['', '32px']) {
      await page.evaluate((size) => (document.documentElement.style.fontSize = size), fontSize)
      let { width, outside } = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        outside: [...document.querySelectorAll('[data-slot="toast"], [data-slot="toast"] *')]
          .filter((element) => {
            let box = element.getBoundingClientRect()
            return box.width > 0 && (box.left < 0 || box.right > innerWidth)
          })
          .map((element) => {
            let box = element.getBoundingClientRect()
            return `${element.localName}.${element.getAttribute('data-slot')} ${Math.round(box.left)}..${Math.round(box.right)}`
          }),
      }))
      assert.equal(width, 320, `root font size ${fontSize || 'default'}`)
      assert.deepEqual(outside, [], `root font size ${fontSize || 'default'}: ${outside.join(', ')}`)
    }
  })
})
