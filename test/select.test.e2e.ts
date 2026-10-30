import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { contrastRatio } from '../scripts/color.ts'
import { findAccessibilityViolations } from './accessibility.ts'
import { createSelectExamples } from './fixtures/select/server.tsx'
import { paintColors, toRgba } from './paint.ts'

interface OpenOptions {
  // off: the browser runs no script. never: scripting is on, but the page's scripts never load.
  javaScript?: 'on' | 'off' | 'never'
  // Holds the page's entry module, and with it hydration, until this settles.
  hold?: Promise<void>
  colorScheme?: 'light' | 'dark'
}

// Pages open with reduced motion, so the list shows without a fade and every read sees the final style.
async function open(t: TestContext, { javaScript = 'on', hold, colorScheme = 'light' }: OpenOptions = {}) {
  let examples = await createSelectExamples()
  t.after(() => void examples.close())

  let server = await createTestServer(examples.fetch)
  let page = await t.serve(server)
  if (javaScript === 'off') {
    let context = await page.context().browser()!.newContext({ javaScriptEnabled: false, baseURL: server.baseUrl })
    t.after(() => context.close())
    page = await context.newPage()
  }

  let errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
  if (javaScript === 'never') {
    await page.route('**/assets/**', (route) =>
      route.request().url().endsWith('.css') ? route.continue() : route.abort(),
    )
  }
  if (hold) {
    await page.route('**/entry.ts*', async (route) => {
      await hold
      await route.continue()
    })
  }
  await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
  // A held entry module also holds the load event, so such a page is read once it commits.
  await page.goto('/', { waitUntil: hold ? 'commit' : 'load' })
  if (javaScript === 'on' && !hold) await page.locator('html[data-ready]').waitFor({ state: 'attached' })
  return { page, server, errors }
}

type Page = Awaited<ReturnType<typeof open>>['page']

function example(page: Page, title: string) {
  return page.locator(`[data-example="${title}"]`)
}

function trigger(page: Page, title: string, index = 0) {
  return example(page, title).locator('[data-slot="select-trigger"]').nth(index)
}

function value(page: Page, title: string, index = 0) {
  return trigger(page, title, index).locator('[data-slot="select-value"]').innerText()
}

function content(page: Page, title: string, index = 0) {
  return example(page, title).locator('[data-slot="select-content"]').nth(index)
}

function isOpen(page: Page, title: string, index = 0) {
  return content(page, title, index).evaluate((element) => element.matches(':popover-open'))
}

/** Waits for the list to show or hide, after the render that follows an interaction. */
function waitOpen(page: Page, title: string, open = true, index = 0) {
  return page.waitForFunction(
    ([title, open, index]) =>
      document
        .querySelectorAll(`[data-example="${title}"] [data-slot="select-content"]`)
        [index]?.matches(':popover-open') === open,
    [title, open, index] as const,
    { timeout: 5000 },
  )
}

function waitHighlighted(page: Page, title: string, text: string) {
  return page.waitForFunction(
    ([title, text]) => {
      let button = document.querySelector(`[data-example="${title}"] [data-slot="select-trigger"]`)
      let id = button?.getAttribute('aria-activedescendant')
      return Boolean(id) && document.getElementById(id!)?.textContent?.trim() === text
    },
    [title, text] as const,
    { timeout: 5000 },
  )
}

async function echoed(page: Page) {
  await page.locator('[data-echo="fields"]').waitFor()
  return page
    .locator('[data-echo="fields"] > div')
    .evaluateAll((rows) =>
      rows.map((row) => [row.querySelector('dt')?.textContent, row.querySelector('dd')?.textContent]),
    )
}

describe('Select examples', () => {
  it('work as native selects without JavaScript: labels, required, submit and reset', async (t) => {
    let { page } = await open(t, { javaScript: 'off' })
    let form = example(page, 'Required')
    let country = form.getByLabel('Billing country')

    assert.equal(await form.locator('[data-slot="select-trigger"]').isVisible(), false)
    assert.equal(await country.evaluate((element) => element.tagName), 'SELECT')
    assert.equal(
      await country.getAttribute('aria-describedby'),
      await form.locator('p[id$="-hint"]').getAttribute('id'),
    )
    assert.equal(await country.evaluate((select: HTMLSelectElement) => select.validity.valueMissing), true)
    assert.deepEqual(
      await country.locator('optgroup').evaluateAll((groups) => groups.map((group) => group.getAttribute('label'))),
      ['Europe', 'Elsewhere'],
    )

    await form.getByRole('button', { name: 'Save' }).click()
    assert.equal(new URL(page.url()).pathname, '/', 'the browser blocks the empty required select')

    await country.selectOption('CH')
    await form.getByRole('button', { name: 'Reset' }).click()
    assert.equal(await country.inputValue(), '')
    await country.selectOption('JP')
    await form.getByRole('button', { name: 'Save' }).click()
    assert.deepEqual(await echoed(page), [['country', 'JP']])
  })

  it('keep the native select when the script never loads', async (t) => {
    let { page } = await open(t, { javaScript: 'never' })
    let basic = example(page, 'Basic')
    let native = basic.getByRole('combobox', { name: 'Fruit' })

    assert.equal(await native.evaluate((element) => element.tagName), 'SELECT')
    await native.selectOption('banana')
    assert.equal(await native.inputValue(), 'banana')
    assert.equal(await basic.locator('[data-slot="select-trigger"]').isVisible(), false)
  })

  it('keep a choice made in the native select before hydration', async (t) => {
    let release!: () => void
    let hold = new Promise<void>((resolve) => (release = resolve))
    let { page, errors } = await open(t, { hold })
    let form = example(page, 'Required')
    await form.getByLabel('Billing country').waitFor()

    await form.getByLabel('Billing country').selectOption('DE')
    await form.getByLabel('Billing country').focus()
    release()
    await page.locator('html[data-ready]').waitFor({ state: 'attached' })
    await trigger(page, 'Required').waitFor({ state: 'visible' })

    // Focus moves on from the native select, which hides, to the trigger.
    await page.waitForFunction(
      () => document.activeElement?.matches('[data-example="Required"] [data-slot="select-trigger"]'),
      undefined,
      { timeout: 5000 },
    )
    assert.equal(await value(page, 'Required'), 'Germany')
    assert.equal(await form.locator('select').inputValue(), 'DE')
    assert.equal(await form.getByLabel('Billing country').getAttribute('role'), 'combobox')
    assert.equal(
      await form.getByLabel('Billing country').evaluate((element) => element.tagName),
      'BUTTON',
      'the label names the trigger once it runs',
    )
    assert.deepEqual(errors, [])
  })

  it('leave focus elsewhere on the page where it is through hydration', async (t) => {
    let release!: () => void
    let hold = new Promise<void>((resolve) => (release = resolve))
    let { page } = await open(t, { hold })
    let search = example(page, 'Inline').getByRole('textbox', { name: 'Search' })
    await search.waitFor()

    await search.focus()
    release()
    await page.locator('html[data-ready]').waitFor({ state: 'attached' })
    await trigger(page, 'Required').waitFor({ state: 'visible' })
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 100)))

    assert.equal(await search.evaluate((element) => element === document.activeElement), true)
  })

  it('choose with the keyboard: open, move, type, choose, cancel and move on', async (t) => {
    let { page } = await open(t)
    await example(page, 'Groups').locator('h3').click()
    await page.keyboard.press('Tab')
    assert.equal(await trigger(page, 'Groups').evaluate((element) => element === document.activeElement), true)

    await page.keyboard.press('ArrowDown')
    await waitOpen(page, 'Groups')
    await waitHighlighted(page, 'Groups', 'Apple')
    await page.keyboard.press('ArrowDown')
    await waitHighlighted(page, 'Groups', 'Banana')
    await page.keyboard.type('sp')
    await waitHighlighted(page, 'Groups', 'Spinach')
    await page.keyboard.press('Enter')
    await waitOpen(page, 'Groups', false)
    assert.equal(await value(page, 'Groups'), 'Spinach')

    await page.keyboard.press('Enter')
    await waitOpen(page, 'Groups')
    await waitHighlighted(page, 'Groups', 'Spinach')
    await page.keyboard.press('Home')
    await waitHighlighted(page, 'Groups', 'Apple')
    await page.keyboard.press('Escape')
    await waitOpen(page, 'Groups', false)
    assert.equal(await value(page, 'Groups'), 'Spinach')

    // Tab closes without choosing and moves on, past the page the open list kept still.
    await page.keyboard.press('ArrowDown')
    await waitOpen(page, 'Groups')
    await page.keyboard.press('Tab')
    await waitOpen(page, 'Groups', false)
    await page.waitForFunction(() => document.activeElement?.getAttribute('data-slot') === 'select-trigger')
    assert.equal(await trigger(page, 'Icons').evaluate((element) => element === document.activeElement), true)
    assert.equal(await value(page, 'Groups'), 'Spinach')
    assert.equal(await page.locator('[inert]').count(), 0)
  })

  it('choose by typing on the closed trigger, as a native select does', async (t) => {
    let { page } = await open(t)
    await trigger(page, 'Groups').focus()

    await page.keyboard.type('b')
    await page.waitForFunction(() =>
      document.querySelector('[data-example="Groups"] [data-slot="select-value"]')?.textContent?.includes('Banana'),
    )
    assert.equal(await isOpen(page, 'Groups'), false)
  })

  it('choose with the pointer, by a click or by dragging from the trigger, and close on a click outside', async (t) => {
    let { page } = await open(t)

    await trigger(page, 'Groups').click()
    await waitOpen(page, 'Groups')
    await example(page, 'Groups').getByRole('option', { name: 'Carrot' }).click()
    await waitOpen(page, 'Groups', false)
    assert.equal(await value(page, 'Groups'), 'Carrot')
    assert.equal(await trigger(page, 'Groups').evaluate((element) => element === document.activeElement), true)

    // Mid-window, so the lined-up list has room below the trigger.
    await trigger(page, 'Sizes', 1).evaluate((element) => element.scrollIntoView({ block: 'center' }))
    let from = (await trigger(page, 'Sizes', 1).boundingBox())!
    await page.mouse.move(from.x + 20, from.y + from.height / 2)
    await page.mouse.down()
    await waitOpen(page, 'Sizes', true, 1)
    let banana = (await content(page, 'Sizes', 1).getByRole('option', { name: 'Banana' }).boundingBox())!
    await page.mouse.move(banana.x + 20, banana.y + banana.height / 2, { steps: 5 })
    await page.mouse.up()
    await waitOpen(page, 'Sizes', false, 1)
    assert.equal(await value(page, 'Sizes', 1), 'Banana')

    await trigger(page, 'Groups').click()
    await waitOpen(page, 'Groups')
    await page.mouse.click(5, 5)
    await waitOpen(page, 'Groups', false)
    assert.equal(await value(page, 'Groups'), 'Carrot')
  })

  it('line the chosen item up with the trigger, and place the list on every side', async (t) => {
    let { page } = await open(t)
    await page.setViewportSize({ width: 1280, height: 900 })

    await trigger(page, 'Item aligned').scrollIntoViewIfNeeded()
    await trigger(page, 'Item aligned').click()
    await waitOpen(page, 'Item aligned')
    assert.equal(await content(page, 'Item aligned').getAttribute('data-side'), 'none')
    let text = (await content(page, 'Item aligned')
      .getByRole('option', { name: 'Blueberry' })
      .locator('[data-slot="select-item-text"]')
      .boundingBox())!
    let shown = (await trigger(page, 'Item aligned').locator('[data-slot="select-value"]').boundingBox())!
    assert.ok(Math.abs(text.x - shown.x) <= 1, `text at ${text.x}, value at ${shown.x}`)
    assert.ok(Math.abs(text.y + text.height / 2 - (shown.y + shown.height / 2)) <= 1.5)
    await page.keyboard.press('Escape')

    for (let [index, side] of ['left', 'left', 'top', 'bottom', 'right', 'right'].entries()) {
      await trigger(page, 'Sides', index).click()
      await waitOpen(page, 'Sides', true, index)
      let list = (await content(page, 'Sides', index).boundingBox())!
      let button = (await trigger(page, 'Sides', index).boundingBox())!
      assert.equal(await content(page, 'Sides', index).getAttribute('data-side'), side)
      if (side === 'bottom') assert.ok(Math.abs(list.y - (button.y + button.height + 4)) <= 1)
      if (side === 'top') assert.ok(Math.abs(list.y + list.height + 4 - button.y) <= 1)
      if (side === 'left') assert.ok(Math.abs(list.x + list.width + 4 - button.x) <= 1)
      if (side === 'right') assert.ok(Math.abs(list.x - (button.x + button.width + 4)) <= 1)
      await page.keyboard.press('Escape')
      await waitOpen(page, 'Sides', false, index)
    }
  })

  it('send one value from the enhanced form, check required on the trigger, and reset', async (t) => {
    let { page } = await open(t)
    let form = example(page, 'Required')

    await form.getByRole('button', { name: 'Save' }).click()
    await page.waitForFunction(() =>
      document.querySelector('[data-example="Required"] [data-slot="select-trigger"]')?.matches(':focus'),
    )
    assert.equal(new URL(page.url()).pathname, '/')
    assert.equal(await trigger(page, 'Required').getAttribute('aria-invalid'), 'true')

    await page.keyboard.press('ArrowDown')
    await waitOpen(page, 'Required')
    await page.keyboard.type('sw')
    await waitHighlighted(page, 'Required', 'Switzerland')
    await page.keyboard.press('Enter')
    await waitOpen(page, 'Required', false)
    assert.equal(await trigger(page, 'Required').getAttribute('aria-invalid'), null)

    await form.getByRole('button', { name: 'Reset' }).click()
    await page.waitForFunction(() =>
      document
        .querySelector('[data-example="Required"] [data-slot="select-trigger"]')
        ?.hasAttribute('data-placeholder'),
    )
    await trigger(page, 'Required').click()
    await waitOpen(page, 'Required')
    await form.getByRole('option', { name: 'Canada' }).click()
    await waitOpen(page, 'Required', false)
    await form.getByRole('button', { name: 'Save' }).click()
    assert.deepEqual(await echoed(page), [['country', 'CA']])
  })

  it('keep the list open for several choices, and show the server’s select outside any client entry', async (t) => {
    let { page, errors } = await open(t)

    await trigger(page, 'Multiple').click()
    await waitOpen(page, 'Multiple')
    await content(page, 'Multiple').getByRole('option', { name: 'Apple', exact: true }).click()
    await content(page, 'Multiple').getByRole('option', { name: 'Grapes' }).click()
    await page.waitForFunction(
      () =>
        document.querySelector('[data-example="Multiple"] [data-slot="select-value"]')?.textContent ===
        '2 fruits selected',
    )
    assert.equal(await isOpen(page, 'Multiple'), true)
    assert.deepEqual(
      await example(page, 'Multiple')
        .locator('select')
        .evaluate((select: HTMLSelectElement) => [...select.selectedOptions].map((option) => option.value)),
      ['apple', 'grapes'],
    )
    await page.keyboard.press('Escape')

    let serverOnly = example(page, 'Server only')
    assert.equal(await serverOnly.locator('[data-slot="select-trigger"]').isVisible(), false)
    let native = serverOnly.getByRole('combobox', { name: 'Invoice status' })
    assert.equal(await native.evaluate((element) => element.tagName), 'SELECT')
    await native.selectOption('paid')
    assert.equal(await native.inputValue(), 'paid')
    assert.deepEqual(errors, [])
  })

  it('close only the list on Escape inside a dialog', async (t) => {
    let { page } = await open(t)

    await example(page, 'In a dialog').getByRole('button', { name: 'Open dialog' }).click()
    let dialog = page.getByRole('dialog', { name: 'Select example' })
    await dialog.waitFor()
    let inside = dialog.locator('[data-slot="select-trigger"]')
    await inside.click()
    await waitOpen(page, 'In a dialog')
    assert.ok(await content(page, 'In a dialog').evaluate((element) => element.getBoundingClientRect().height > 0))
    await page.keyboard.press('Escape')
    await waitOpen(page, 'In a dialog', false)
    assert.equal(await dialog.isVisible(), true)
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
  })

  it('pass axe-core before hydration, after it, with a list open, and in the dark theme', async (t) => {
    let { page: served, server } = await open(t)
    assert.deepEqual(await findAccessibilityViolations(served), [])

    await trigger(served, 'Groups').click()
    await waitOpen(served, 'Groups')
    assert.deepEqual(await findAccessibilityViolations(served), [], 'with the list open')
    await served.keyboard.press('Escape')
    await served.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
    assert.deepEqual(await findAccessibilityViolations(served), [], 'dark')

    let context = await served.context().browser()!.newContext({ baseURL: server.baseUrl })
    t.after(() => context.close())
    let page = await context.newPage()
    // Keep the module scripts from loading, so the page stays as the server rendered it.
    await page.route('**/assets/**', (route) =>
      route.request().url().endsWith('.css') ? route.continue() : route.abort(),
    )
    await page.goto('/')
    assert.deepEqual(await findAccessibilityViolations(page), [], 'before hydration')
  })

  it('keep 4.5:1 for the value, the placeholder, the items and the highlighted item in both themes', async (t) => {
    let { page } = await open(t)
    let check = (samples: Awaited<ReturnType<typeof paintColors>>, colorScheme: string) => {
      for (let { label, background, text } of samples) {
        let ratio = contrastRatio(toRgba(text), toRgba(background))
        assert.ok(ratio >= 4.5, `${colorScheme} ${label}: ${ratio.toFixed(2)}`)
      }
    }

    for (let colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
      // A hovered trigger that shows its placeholder.
      await trigger(page, 'Basic').hover()
      check(await paintColors(page, '[data-example="Basic"] [data-slot="select-trigger"]'), `${colorScheme} hovered`)
      check(
        [
          ...(await paintColors(page, '[data-example="Groups"] [data-slot="select-trigger"]')),
          ...(await paintColors(page, '[data-example="Controlled"] [data-slot="select-trigger"]')),
        ],
        colorScheme,
      )
    }

    await trigger(page, 'Groups').click()
    await waitOpen(page, 'Groups')
    await page.keyboard.press('ArrowDown')
    await waitHighlighted(page, 'Groups', 'Apple')
    for (let colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
      check(
        [
          ...(await paintColors(page, '[data-example="Groups"] [role=option]')),
          ...(await paintColors(page, '[data-example="Groups"] [data-slot="select-label"]')),
        ],
        colorScheme,
      )
    }
  })

  it('draw the focus ring, the highlighted item and the edges in forced colors', async (t) => {
    let { page } = await open(t)
    await trigger(page, 'Groups').focus()
    await page.keyboard.press('ArrowDown')
    await waitHighlighted(page, 'Groups', 'Apple')

    for (let forcedColors of ['none', 'active'] as const) {
      await page.emulateMedia({ colorScheme: 'light', forcedColors, reducedMotion: 'reduce' })
      if (forcedColors === 'active') await page.waitForFunction(() => matchMedia('(forced-colors: active)').matches)
      let styles = await example(page, 'Groups').evaluate((figure) => {
        let outline = (element: Element) => {
          let style = getComputedStyle(element)
          return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) }
        }
        let border = (element: Element) => {
          let style = getComputedStyle(element)
          return { style: style.borderTopStyle, width: parseFloat(style.borderTopWidth), color: style.borderTopColor }
        }
        return {
          trigger: outline(figure.querySelector('[data-slot="select-trigger"]')!),
          item: outline(figure.querySelector('[role=option][data-highlighted]')!),
          other: outline(figure.querySelector('[role=option]:not([data-highlighted])')!),
          content: border(figure.querySelector('[data-slot="select-content"]')!),
          triggerEdge: border(figure.querySelector('[data-slot="select-trigger"]')!),
        }
      })
      assert.equal(styles.trigger.style, 'solid', `${forcedColors} focus ring`)
      assert.ok(styles.trigger.width >= 2)
      assert.equal(styles.other.style, 'none', forcedColors)
      assert.equal(styles.content.style, 'solid', forcedColors)
      assert.equal(styles.triggerEdge.style, 'solid', forcedColors)
      if (forcedColors === 'active') {
        assert.equal(styles.item.style, 'solid', 'the highlighted item keeps an outline')
        assert.ok(styles.item.width >= 2)
      }
    }
  })

  it('show the list at once with reduced motion, and fade it in beside the trigger otherwise', async (t) => {
    let { page } = await open(t)
    let duration = () =>
      content(page, 'Sides', 3).evaluate((element) => getComputedStyle(element).transitionDuration.split(',')[0])

    assert.equal(await duration(), '0s')
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' })
    await page.waitForFunction(() => matchMedia('(prefers-reduced-motion: no-preference)').matches)
    assert.notEqual(await duration(), '0s')
    assert.equal(
      await content(page, 'Item aligned').evaluate((element) => getComputedStyle(element).transitionProperty),
      'none',
      'the list over the trigger shows at once, as in shadcn',
    )
  })

  it('mirror the chevron, the check and the lined-up list in right-to-left text', async (t) => {
    let { page } = await open(t)
    let rtl = 'الفواكه'
    let button = trigger(page, rtl)

    let chevron = (await button.locator('[data-slot="select-icon"]').boundingBox())!
    let shown = (await button.locator('[data-slot="select-value"]').boundingBox())!
    assert.ok(chevron.x < shown.x, 'the chevron sits on the left, at the end')

    await button.click()
    await waitOpen(page, rtl)
    let option = content(page, rtl).getByRole('option', { name: 'موز' })
    let check = (await option.locator('[data-slot="select-item-indicator"]').boundingBox())!
    let text = (await option.locator('[data-slot="select-item-text"]').boundingBox())!
    assert.ok(check.x < text.x, 'the check sits on the left')
    let value = (await button.locator('[data-slot="select-value"]').boundingBox())!
    assert.ok(Math.abs(text.x + text.width - (value.x + value.width)) <= 1.5, 'the text lines up on the right')
  })

  it('fit 320px without scrolling sideways, also with text at 200% and a list open', async (t) => {
    let { page } = await open(t)
    await page.setViewportSize({ width: 320, height: 640 })
    let overflow = () =>
      page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

    assert.equal(await overflow(), 0)
    await page.evaluate(() => (document.documentElement.style.fontSize = '32px'))
    assert.equal(await overflow(), 0)

    await trigger(page, 'Plan').scrollIntoViewIfNeeded()
    await trigger(page, 'Plan').click()
    await waitOpen(page, 'Plan')
    let fits = await content(page, 'Plan').evaluate((list) => {
      let box = list.getBoundingClientRect()
      let scroller = list.querySelector('[role=listbox]')!
      return {
        inside: box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight,
        sideways: scroller.scrollWidth - scroller.clientWidth,
      }
    })
    assert.deepEqual(fits, { inside: true, sideways: 0 })
    assert.equal(await overflow(), 0)
  })
})
