import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { contrastRatio } from '../scripts/color.ts'
import { findAccessibilityViolations } from './accessibility.ts'
import { createComboboxExamples } from './fixtures/combobox/server.tsx'
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
  let examples = await createComboboxExamples()
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
  // Firefox holds load until the entry hydrated every client entry, so a hydrated page is read once
  // its DOM is in, and a held entry module also holds the load event.
  if (javaScript === 'on') {
    await page.goto('/', { waitUntil: hold ? 'commit' : 'domcontentloaded' })
    if (!hold) await page.locator('html[data-ready]').waitFor({ state: 'attached', timeout: 30_000 })
  } else await page.goto('/')
  return { page, server, errors }
}

type Page = Awaited<ReturnType<typeof open>>['page']

function example(page: Page, title: string) {
  return page.locator(`[data-example="${title}"]`)
}

function input(page: Page, title: string, index = 0) {
  return example(page, title).locator('input[role="combobox"]').nth(index)
}

function content(page: Page, title: string, index = 0) {
  return example(page, title).locator('[data-slot="combobox-content"]').nth(index)
}

/** Waits for the list to show or hide, after the render that follows an interaction. */
function waitOpen(page: Page, title: string, open = true, index = 0) {
  return page.waitForFunction(
    ([title, open, index]) =>
      document
        .querySelectorAll(`[data-example="${title}"] [data-slot="combobox-content"]`)
        [index]?.matches(':popover-open') === open,
    [title, open, index] as const,
    { timeout: 5000 },
  )
}

/** Waits until the input's aria-activedescendant points at the one shown option with this text, or at none. */
function waitHighlighted(page: Page, title: string, text: string | null, index = 0) {
  return page.waitForFunction(
    ([title, text, index]) => {
      let field = document.querySelectorAll(`[data-example="${title}"] input[role="combobox"]`)[index]
      let id = field?.getAttribute('aria-activedescendant')
      if (text === null) return field !== undefined && !id
      let options = id ? document.querySelectorAll(`[id="${id}"]`) : []
      let option = options[0]
      return (
        options.length === 1 &&
        option.getAttribute('role') === 'option' &&
        option.getClientRects().length > 0 &&
        option.textContent?.trim() === text
      )
    },
    [title, text, index] as const,
    { timeout: 5000 },
  )
}

function shownItems(page: Page, title: string, index = 0) {
  return content(page, title, index)
    .locator('[role="option"]')
    .evaluateAll((options) => options.map((option) => option.textContent?.trim()))
}

async function echoed(page: Page) {
  await page.locator('[data-echo="fields"]').waitFor()
  return page
    .locator('[data-echo="fields"] > div')
    .evaluateAll((rows) =>
      rows.map((row) => [row.querySelector('dt')?.textContent, row.querySelector('dd')?.textContent]),
    )
}

function chipTexts(page: Page, title: string) {
  return example(page, title)
    .locator('[data-slot="combobox-chip"]')
    .evaluateAll((chips) => chips.map((chip) => chip.textContent?.trim()))
}

function isFocused(locator: ReturnType<Page['locator']>) {
  return locator.evaluate((element) => element === document.activeElement)
}

describe('Combobox examples', () => {
  it('work as native selects without JavaScript: labels, required, submit and reset', async (t) => {
    let { page } = await open(t, { javaScript: 'off' })
    let form = example(page, 'Required')
    let framework = form.getByLabel('Framework')

    assert.equal(await form.locator('[data-slot="combobox-input"]').isVisible(), false)
    assert.equal(await framework.evaluate((element) => element.tagName), 'SELECT')
    assert.equal(
      await framework.getAttribute('aria-describedby'),
      await form.locator('p[id$="-hint"]').getAttribute('id'),
    )
    assert.equal(await framework.evaluate((select: HTMLSelectElement) => select.validity.valueMissing), true)

    await form.getByRole('button', { name: 'Submit' }).click()
    assert.equal(new URL(page.url()).pathname, '/', 'the browser blocks the empty required select')

    await framework.selectOption('Astro')
    await form.getByRole('button', { name: 'Reset' }).click()
    assert.equal(await framework.inputValue(), '')
    await framework.selectOption('Remix')
    await form.getByRole('button', { name: 'Submit' }).click()
    assert.deepEqual(await echoed(page), [['framework', 'Remix']])
  })

  it('keep the native selects, single and multiple, when the script never loads', async (t) => {
    let { page } = await open(t, { javaScript: 'never' })
    let basic = example(page, 'Basic')
    let native = basic.getByRole('combobox', { name: 'Framework' })

    assert.equal(await native.evaluate((element) => element.tagName), 'SELECT')
    await native.selectOption('Remix')
    assert.equal(await native.inputValue(), 'Remix')
    assert.equal(await basic.locator('[data-slot="combobox-input"]').isVisible(), false)

    let multiple = example(page, 'Multiple').getByRole('listbox', { name: 'Frameworks' })
    assert.equal(await multiple.evaluate((element) => element.tagName), 'SELECT')
    assert.deepEqual(
      await multiple.evaluate((select: HTMLSelectElement) => [...select.selectedOptions].map((option) => option.value)),
      ['Next.js'],
    )
    assert.equal(await example(page, 'Multiple').locator('[data-slot="combobox-chips"]').isVisible(), false)
  })

  it('keep a choice made in the native select before hydration, and move its focus to the input', async (t) => {
    let release!: () => void
    let hold = new Promise<void>((resolve) => (release = resolve))
    let { page, errors } = await open(t, { hold })
    let form = example(page, 'Required')
    await form.getByLabel('Framework').waitFor()

    await form.getByLabel('Framework').selectOption('Astro')
    await form.getByLabel('Framework').focus()
    release()
    await page.locator('html[data-ready]').waitFor({ state: 'attached', timeout: 30_000 })
    await input(page, 'Required').waitFor({ state: 'visible' })

    await page.waitForFunction(
      () => document.activeElement?.matches('[data-example="Required"] input[role="combobox"]'),
      undefined,
      { timeout: 5000 },
    )
    assert.equal(await input(page, 'Required').inputValue(), 'Astro')
    assert.equal(await form.locator('select').inputValue(), 'Astro')
    assert.equal(
      await form.getByRole('combobox', { name: 'Framework' }).evaluate((element) => element.tagName),
      'INPUT',
      'the label names the input once it runs',
    )
    assert.deepEqual(errors, [])
  })

  it('filter as you type, choose with the keys, and send the chosen value, not the typed text', async (t) => {
    let { page, errors } = await open(t)
    let form = example(page, 'Required')
    let field = input(page, 'Required')

    await field.click()
    await waitOpen(page, 'Required')
    await page.keyboard.type('ux')
    await page.waitForFunction(
      () => document.querySelectorAll('[data-example="Required"] [role="option"]').length === 1,
      undefined,
      { timeout: 5000 },
    )
    assert.deepEqual(await shownItems(page, 'Required'), ['Nuxt.js'])
    await page.keyboard.press('ArrowDown')
    await waitHighlighted(page, 'Required', 'Nuxt.js')
    await page.keyboard.press('Enter')
    await waitOpen(page, 'Required', false)
    assert.equal(await field.inputValue(), 'Nuxt.js')

    // Typed text that isn't chosen goes back to the chosen label.
    await page.keyboard.press('Backspace')
    await page.keyboard.press('Backspace')
    await page.keyboard.type('xyz')
    await waitOpen(page, 'Required')
    assert.ok(await example(page, 'Required').getByText('No items found.').isVisible())
    await page.keyboard.press('Escape')
    await waitOpen(page, 'Required', false)
    assert.equal(await field.inputValue(), 'Nuxt.js')

    await form.getByRole('button', { name: 'Submit' }).click()
    assert.deepEqual(await echoed(page), [['framework', 'Nuxt.js']])
    assert.deepEqual(errors, [])
  })

  it('pass through the input between the last and first item, skip disabled items, and choose with a click', async (t) => {
    let { page } = await open(t)
    let field = input(page, 'Disabled items')

    await field.focus()
    await page.keyboard.press('ArrowDown')
    await waitHighlighted(page, 'Disabled items', 'Next.js')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await waitHighlighted(page, 'Disabled items', 'Astro', 0)
    await page.keyboard.press('ArrowDown')
    await waitHighlighted(page, 'Disabled items', null)
    await page.keyboard.press('ArrowUp')
    await waitHighlighted(page, 'Disabled items', 'Astro')

    await content(page, 'Disabled items').getByRole('option', { name: 'Remix' }).click({ force: true })
    assert.equal(await field.inputValue(), '', 'a disabled item is never chosen')
    await content(page, 'Disabled items').getByRole('option', { name: 'SvelteKit' }).click()
    await waitOpen(page, 'Disabled items', false)
    assert.equal(await field.inputValue(), 'SvelteKit')
    assert.ok(await isFocused(field))
  })

  it('keep the list beside its input, also flipped above it, through the renders the keys cause', async (t) => {
    let { page } = await open(t)
    let field = input(page, 'Groups')
    // At the window's bottom, so the list has no room below and flips above the input.
    await field.evaluate((element) => element.scrollIntoView({ block: 'end' }))
    await field.click()
    await waitOpen(page, 'Groups')
    for (let step = 0; step < 3; step++) await page.keyboard.press('ArrowDown')
    await waitHighlighted(page, 'Groups', '(GMT-6) Chicago')

    let boxes = await example(page, 'Groups').evaluate((figure) => {
      let group = figure.querySelector('[data-slot="combobox-input"]')!.getBoundingClientRect()
      let list = figure.querySelector('[data-slot="combobox-content"]')!.getBoundingClientRect()
      return { side: figure.querySelector('[data-slot="combobox-content"]')!.getAttribute('data-side'), group, list }
    })
    assert.equal(boxes.side, 'top')
    assert.ok(
      Math.abs(boxes.list.bottom - (boxes.group.top - 6)) < 1.5,
      `${boxes.list.bottom} ends 6px above ${boxes.group.top}`,
    )
    assert.ok(Math.abs(boxes.list.left - boxes.group.left) < 1.5, `${boxes.list.left} starts at ${boxes.group.left}`)
  })

  it('remove chips with real keys and buttons, and keep focus in the combobox', async (t) => {
    let { page } = await open(t)
    let chips = () => chipTexts(page, 'Multiple invalid')
    let field = example(page, 'Multiple invalid').getByRole('combobox', { name: 'Frameworks', exact: true })

    await field.focus()
    assert.deepEqual(await chips(), ['Next.js', 'SvelteKit', 'Next.js', 'SvelteKit', 'Nuxt.js'])
    await page.keyboard.press('Backspace')
    await page.waitForFunction(
      () => document.querySelectorAll('[data-example="Multiple invalid"] [data-slot="combobox-chip"]').length === 4,
    )
    await page.keyboard.press('ArrowLeft')
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), 'SvelteKit')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('Delete')
    await page.waitForFunction(
      () => document.querySelectorAll('[data-example="Multiple invalid"] [data-slot="combobox-chip"]').length === 3,
    )
    // The chip that took the removed one's place has focus, in the same task as the removal.
    assert.deepEqual(
      await page.evaluate(() => [
        document.activeElement?.getAttribute('data-slot'),
        document.activeElement?.textContent?.trim(),
      ]),
      ['combobox-chip', 'SvelteKit'],
      'focus moves to the chip that took its place',
    )
    await page.keyboard.press('ArrowRight')
    await page.keyboard.type('a')
    await waitOpen(page, 'Multiple invalid', true, 1)

    let multiple = example(page, 'Multiple')
    await multiple.getByRole('button', { name: 'Remove Next.js' }).click()
    await page.waitForFunction(
      () => document.querySelectorAll('[data-example="Multiple"] [data-slot="combobox-chip"]').length === 0,
    )
    let chipInput = multiple.locator('input[role="combobox"]')
    await page.waitForFunction(
      () => document.activeElement?.matches('[data-example="Multiple"] input[role="combobox"]'),
      undefined,
      { timeout: 5000 },
    )
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    assert.deepEqual(await chipTexts(page, 'Multiple'), ['Next.js', 'SvelteKit'])
    assert.ok(await isFocused(chipInput))
  })

  it('search once an input method commits its text', async (t) => {
    let { page } = await open(t)
    if (page.context().browser()?.browserType().name() !== 'chromium') return
    let field = input(page, 'Auto highlight')
    await field.focus()
    let session = await page.context().newCDPSession(page)

    await session.send('Input.imeSetComposition', { text: 'r', selectionStart: 1, selectionEnd: 1 })
    await session.send('Input.imeSetComposition', { text: 're', selectionStart: 2, selectionEnd: 2 })
    assert.equal(await field.inputValue(), 're', 'the composing text stays')
    assert.equal(await shownItems(page, 'Auto highlight').then((items) => items.length), 5, 'no search while composing')
    await session.send('Input.insertText', { text: 'rem' })
    await waitHighlighted(page, 'Auto highlight', 'Remix')
    assert.deepEqual(await shownItems(page, 'Auto highlight'), ['Remix'])
  })

  it('drop the answer to an older search that arrives late', async (t) => {
    let { page } = await open(t)
    let field = input(page, 'Async results')
    let async = example(page, 'Async results')

    await field.click()
    // A one-letter search would answer after 500ms, a two-letter one after 350ms.
    await page.keyboard.type('h')
    await page.keyboard.type('a')
    await async.getByText('Searching…').waitFor()
    await page.waitForFunction(
      () => document.querySelectorAll('[data-example="Async results"] [role="option"]').length > 0,
      undefined,
      { timeout: 5000 },
    )
    let names = () =>
      content(page, 'Async results')
        .locator('[role="option"] > span > span:first-child')
        .evaluateAll((spans) => spans.map((span) => span.textContent))
    assert.deepEqual(await names(), ['Dmitri Halvorsen', 'Hana Sorensen'])
    // Long after the answer to “h” would have come, the list still holds the answer to “ha”.
    await page.waitForTimeout(400)
    assert.deepEqual(await names(), ['Dmitri Halvorsen', 'Hana Sorensen'])
    assert.equal(await async.getByText('Searching…').count(), 0)
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await waitOpen(page, 'Async results', false)
    assert.equal(await field.inputValue(), 'Dmitri Halvorsen')
  })

  it('open a popup with a search from its trigger, and give focus back on a choice', async (t) => {
    let { page } = await open(t)
    let popup = example(page, 'In a popup')
    let trigger = popup.getByRole('combobox', { name: 'Country' })

    await trigger.focus()
    await page.keyboard.press('Enter')
    await waitOpen(page, 'In a popup')
    let search = popup.locator('[data-slot="combobox-content"] input')
    await page.waitForFunction(
      () => document.activeElement?.matches('[data-example="In a popup"] [data-slot="combobox-content"] input'),
      undefined,
      { timeout: 5000 },
    )
    assert.equal(await page.getByRole('dialog', { name: 'Country' }).count(), 1)
    await page.keyboard.type('ja')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await waitOpen(page, 'In a popup', false)
    assert.equal(await trigger.innerText(), 'Japan')
    assert.ok(await isFocused(trigger))
    assert.equal(await search.inputValue(), '')
  })

  it('close only the list on Escape inside a dialog', async (t) => {
    let { page } = await open(t)

    await example(page, 'In a dialog').getByRole('button', { name: 'Open dialog' }).click()
    let dialog = page.getByRole('dialog', { name: 'Select framework' })
    await dialog.waitFor()
    await dialog.getByRole('combobox', { name: 'Framework' }).click()
    await waitOpen(page, 'In a dialog')
    assert.ok(await content(page, 'In a dialog').evaluate((element) => element.getBoundingClientRect().height > 0))
    await page.keyboard.press('Escape')
    await waitOpen(page, 'In a dialog', false)
    assert.equal(await dialog.isVisible(), true)
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
  })

  it('leave the combobox the page renders outside any client entry a native select', async (t) => {
    let { page, errors } = await open(t)
    let native = example(page, 'Server only').getByRole('combobox', { name: 'Invoice status' })

    assert.equal(await native.evaluate((element) => element.tagName), 'SELECT')
    await native.selectOption('Paid')
    assert.equal(await native.inputValue(), 'Paid')
    assert.deepEqual(errors, [])
  })

  it('pass axe-core before hydration, after it, with lists open, and in the dark theme', async (t) => {
    let { page: served, server } = await open(t)
    assert.deepEqual(await findAccessibilityViolations(served), [])

    await input(served, 'Groups').click()
    await served.keyboard.type('o')
    await waitOpen(served, 'Groups')
    await served.keyboard.press('ArrowDown')
    assert.deepEqual(await findAccessibilityViolations(served), [], 'with the list open')
    await served.keyboard.press('Escape')
    await input(served, 'Multiple').click()
    await waitOpen(served, 'Multiple')
    await served.keyboard.type('zz')
    assert.deepEqual(await findAccessibilityViolations(served), [], 'with no results')
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

  it('keep 4.5:1 for the text, the placeholder, the chips, the items and the highlighted item in both themes', async (t) => {
    let { page } = await open(t)
    let check = (samples: Awaited<ReturnType<typeof paintColors>>, colorScheme: string) => {
      for (let { label, background, text } of samples) {
        let ratio = contrastRatio(toRgba(text), toRgba(background))
        assert.ok(ratio >= 4.5, `${colorScheme} ${label}: ${ratio.toFixed(2)}`)
      }
    }
    for (let colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
      check(
        [
          ...(await paintColors(page, '[data-example="Controlled"] input[role="combobox"]')),
          ...(await paintColors(page, '[data-example="Multiple"] [data-slot="combobox-chip"]')),
        ],
        colorScheme,
      )
    }

    // The list opens below its input. Flipped above it, it is placed through a position-try
    // fallback, and Firefox's getComputedStyle then keeps reporting that element's background from
    // before a color scheme change, also seconds later, while the page paints the new one. Its items
    // report the new colors at once, so a flipped list measures stale contrast that nobody sees.
    await input(page, 'Groups').evaluate((element) => element.scrollIntoView({ block: 'start' }))
    await input(page, 'Groups').click()
    await page.keyboard.press('ArrowDown')
    await waitHighlighted(page, 'Groups', '(GMT-5) New York')
    assert.equal(await content(page, 'Groups').getAttribute('data-side'), 'bottom')
    for (let colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
      check(
        [
          ...(await paintColors(page, '[data-example="Groups"] [role=option]')),
          ...(await paintColors(page, '[data-example="Groups"] [data-slot="combobox-label"]')),
        ],
        colorScheme,
      )
    }
    await page.keyboard.type('zz')
    for (let colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
      check(await paintColors(page, '[data-example="Groups"] [data-slot="combobox-empty"]'), `${colorScheme} empty`)
    }
  })

  it('draw the focus ring, the highlighted item, the chips and the edges in forced colors', async (t) => {
    let { page } = await open(t)
    // The list hides while its anchor is out of view, so the box comes into view first.
    await input(page, 'Multiple').scrollIntoViewIfNeeded()
    await input(page, 'Multiple').focus()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await waitHighlighted(page, 'Multiple', 'SvelteKit')

    for (let forcedColors of ['none', 'active'] as const) {
      await page.emulateMedia({ colorScheme: 'light', forcedColors, reducedMotion: 'reduce' })
      if (forcedColors === 'active') await page.waitForFunction(() => matchMedia('(forced-colors: active)').matches)
      let styles = await example(page, 'Multiple').evaluate((figure) => {
        let outline = (element: Element) => {
          let style = getComputedStyle(element)
          return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) }
        }
        let border = (element: Element) => {
          let style = getComputedStyle(element)
          return { style: style.borderTopStyle, width: parseFloat(style.borderTopWidth) }
        }
        return {
          box: outline(figure.querySelector('[data-slot="combobox-chips"]')!),
          item: outline(figure.querySelector('[role=option][data-highlighted]')!),
          other: outline(figure.querySelector('[role=option]:not([data-highlighted])')!),
          content: border(figure.querySelector('[data-slot="combobox-content"]')!),
          edge: border(figure.querySelector('[data-slot="combobox-chips"]')!),
          chip: border(figure.querySelector('[data-slot="combobox-chip"]')!),
        }
      })
      assert.equal(styles.box.style, 'solid', `${forcedColors} focus ring`)
      assert.ok(styles.box.width >= 2)
      assert.equal(styles.other.style, 'none', forcedColors)
      assert.equal(styles.content.style, 'solid', forcedColors)
      assert.equal(styles.edge.style, 'solid', forcedColors)
      if (forcedColors === 'active') {
        assert.equal(styles.item.style, 'solid', 'the highlighted item keeps an outline')
        assert.ok(styles.item.width >= 2)
        assert.equal(styles.chip.style, 'solid', 'a chip keeps its edge')
      }
    }
  })

  it('show the list at once with reduced motion, and fade it in otherwise', async (t) => {
    let { page } = await open(t)
    let duration = () =>
      content(page, 'Basic').evaluate((element) => getComputedStyle(element).transitionDuration.split(',')[0])

    assert.equal(await duration(), '0s')
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' })
    await page.waitForFunction(() => matchMedia('(prefers-reduced-motion: no-preference)').matches)
    assert.notEqual(await duration(), '0s')
  })

  it('mirror the chevron, the checks and the chips’ keys in right-to-left text', async (t) => {
    let { page } = await open(t)
    let rtl = 'الفواكه'
    let field = input(page, rtl)

    let chevron = (await example(page, rtl).locator('[data-slot="combobox-trigger"]').first().boundingBox())!
    let box = (await field.boundingBox())!
    assert.ok(chevron.x < box.x, 'the chevron sits on the left, at the end')

    await field.click()
    await waitOpen(page, rtl)
    let option = content(page, rtl).getByRole('option', { name: 'موز' })
    let check = (await option.locator('[data-slot="combobox-item-indicator"]').boundingBox())!
    let text = (await option.boundingBox())!
    assert.ok(check.x < text.x + text.width / 2, 'the check sits on the left')
    await page.keyboard.press('Escape')

    let chipsInput = input(page, rtl, 1)
    await chipsInput.focus()
    // The chips come before the input, on its right: ArrowRight reaches them.
    await page.keyboard.press('ArrowRight')
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-slot')), 'combobox-chip')
    await page.keyboard.press('ArrowLeft')
    assert.ok(await isFocused(chipsInput))
  })

  it('fit 320px without scrolling sideways, also with text at 200% and a list open', async (t) => {
    let { page } = await open(t)
    await page.setViewportSize({ width: 320, height: 640 })
    let overflow = () =>
      page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

    assert.equal(await overflow(), 0)
    await page.evaluate(() => (document.documentElement.style.fontSize = '32px'))
    assert.equal(await overflow(), 0)

    for (let title of ['Custom items', 'Multiple']) {
      await input(page, title).scrollIntoViewIfNeeded()
      await input(page, title).click()
      await waitOpen(page, title)
      let fits = await content(page, title).evaluate((popup) => {
        let box = popup.getBoundingClientRect()
        let scroller = popup.querySelector('[role=listbox]')!
        return {
          inside: box.left >= 0 && box.right <= innerWidth + 0.5,
          sideways: scroller.scrollWidth - scroller.clientWidth,
        }
      })
      assert.deepEqual(fits, { inside: true, sideways: 0 }, title)
      assert.equal(await overflow(), 0, title)
      await page.keyboard.press('Escape')
      await waitOpen(page, title, false)
    }
  })
})
