import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { contrastRatio } from '../scripts/color.ts'
import { findAccessibilityViolations } from './accessibility.ts'
import { createDisclosureExamples } from './fixtures/disclosure/server.tsx'

// Pages open with reduced motion, so panels move in 0s and every read sees
// the final state. The motion test opts back in.
async function open(t: TestContext, { reducedMotion = 'reduce' as 'reduce' | 'no-preference', hydrate = true } = {}) {
  let examples = await createDisclosureExamples()
  t.after(() => void examples.close())

  let server = await createTestServer(examples.fetch)
  let page = await t.serve(server)
  await page.emulateMedia({ colorScheme: 'light', reducedMotion })
  await page.goto('/')
  if (hydrate) await page.locator('html[data-ready]').waitFor({ state: 'attached' })
  return { page, server }
}

type Page = Awaited<ReturnType<typeof open>>['page']

async function withoutJavaScript(t: TestContext, page: Page, baseURL: string) {
  let context = await page.context().browser()!.newContext({ javaScriptEnabled: false, baseURL })
  t.after(() => context.close())
  let staticPage = await context.newPage()
  await staticPage.goto('/')
  return staticPage
}

function example(page: Page, title: string) {
  return page.locator(`[data-example="${title}"]`).first()
}

function expanded(page: Page, title: string) {
  return example(page, title)
    .locator('[aria-expanded="true"]')
    .evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim()))
}

function focusedText(page: Page) {
  return page.evaluate(() => document.activeElement?.textContent?.trim())
}

/** The states the server renders, which hydration must keep. */
function states(page: Page) {
  return page
    .locator('[aria-expanded], [role="tab"], [data-slot$="-content"]')
    .evaluateAll((nodes) =>
      nodes.map((node) =>
        [
          node.getAttribute('data-slot'),
          node.getAttribute('aria-expanded'),
          node.getAttribute('aria-selected'),
          node.getAttribute('hidden'),
        ].join(' '),
      ),
    )
}

/** Paints an element's text over its backgrounds on a canvas, as the browser composites them, and returns sRGB bytes. */
function paintColors(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((elements) => {
    let canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    let context = canvas.getContext('2d', { willReadFrequently: true })!
    let paint = (color: string) => {
      context.fillStyle = '#010203'
      context.fillStyle = color
      if (context.fillStyle === '#010203') throw new Error(`The canvas can't paint ${color}`)
      context.fillRect(0, 0, 1, 1)
    }
    let read = () => [...context.getImageData(0, 0, 1, 1).data]
    let isOpaque = (color: string) => {
      context.clearRect(0, 0, 1, 1)
      paint(color)
      return read()[3] === 255
    }

    return elements.map((element) => {
      let layers: string[] = []
      for (let node: Element | null = element; node; node = node.parentElement) {
        let background = getComputedStyle(node).backgroundColor
        layers.unshift(background)
        if (isOpaque(background)) break
      }
      context.clearRect(0, 0, 1, 1)
      for (let layer of layers) paint(layer)
      let background = read()
      paint(getComputedStyle(element).color)
      return { label: element.textContent?.trim() ?? '', background, text: read() }
    })
  })
}

const toRgba = ([r, g, b]: number[]) => ({ r: r / 255, g: g / 255, b: b / 255, alpha: 1 })

describe('Accordion, Collapsible, Tabs and Pagination examples', () => {
  it('open accordion items with Enter and Space, one at a time, and skip a disabled item with Tab', async (t) => {
    let { page } = await open(t)
    let basic = example(page, 'Basic')

    await basic.getByRole('button', { name: 'When is an invoice due?' }).focus()
    await page.keyboard.press('Enter')
    assert.deepEqual(await expanded(page, 'Basic'), ['When is an invoice due?'])
    await basic.getByRole('region', { name: 'When is an invoice due?' }).waitFor()

    await page.keyboard.press('Tab')
    assert.equal(await focusedText(page), 'Do customers get reminders?')
    await page.keyboard.press(' ')
    assert.deepEqual(await expanded(page, 'Basic'), ['Do customers get reminders?'])
    await page.keyboard.press(' ')
    assert.deepEqual(await expanded(page, 'Basic'), [])

    let disabled = example(page, 'With disabled')
    await disabled.getByRole('button', { name: 'Can I see past payments?' }).focus()
    await page.keyboard.press('Tab')
    assert.equal(await focusedText(page), 'How do I change the billing email?')
  })

  it('keep one answer open in the controlled example and say so', async (t) => {
    let { page } = await open(t)
    let controlled = example(page, 'Controlled')

    await controlled.getByRole('button', { name: 'Do customers get reminders?' }).click()
    await controlled.getByRole('status').getByText('Open: due, reminders.').waitFor()
    await controlled.getByRole('button', { name: 'When is an invoice due?' }).click()
    await controlled.getByRole('button', { name: 'Do customers get reminders?' }).click()

    await controlled.getByRole('status').getByText('One answer stays open.').waitFor()
    assert.deepEqual(await expanded(page, 'Controlled'), ['Do customers get reminders?'])
  })

  it('open folders with Enter and Space, inside each other', async (t) => {
    let { page } = await open(t)
    let tree = example(page, 'File tree')

    await tree.getByRole('button', { name: 'invoices' }).focus()
    await page.keyboard.press('Enter')
    await page.keyboard.press('Tab')
    assert.equal(await focusedText(page), 'templates')
    await page.keyboard.press(' ')
    await tree.getByRole('link', { name: 'credit-note.tsx' }).waitFor()
    assert.deepEqual(await expanded(page, 'File tree'), ['invoices', 'templates'])

    await tree.getByRole('button', { name: 'invoices' }).click()
    await tree.getByRole('link', { name: 'credit-note.tsx' }).waitFor({ state: 'detached' })
    assert.deepEqual(await expanded(page, 'File tree'), [])
  })

  it('show and hide the controlled settings fields, naming the trigger after its action', async (t) => {
    let { page } = await open(t)
    let settings = example(page, 'Settings')

    await settings.getByRole('button', { name: 'Show the bottom corners' }).click()
    await settings.getByLabel('Bottom right radius').fill('8')
    await settings.getByRole('button', { name: 'Hide the bottom corners' }).click()

    assert.equal(await settings.getByLabel('Bottom right radius').count(), 0)
  })

  it('move between tabs with the arrows, select with Enter or Space, and enter the list at the selected tab', async (t) => {
    let { page } = await open(t)
    let tabs = example(page, 'With content')
    let account = tabs.getByRole('tab', { name: 'Account' })

    await account.focus()
    await page.keyboard.press('ArrowRight')
    assert.equal(await focusedText(page), 'Password')
    assert.equal(await account.getAttribute('aria-selected'), 'true')
    await page.keyboard.press('Enter')
    await tabs.getByRole('tabpanel', { name: 'Password' }).waitFor()

    await page.keyboard.press('ArrowRight')
    await page.keyboard.press(' ')
    await tabs.getByRole('tabpanel', { name: 'Alerts' }).waitFor()

    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('Tab')
    assert.equal(await focusedText(page), 'Choose which payment alerts you get, and where.')
    await page.keyboard.press('Shift+Tab')
    assert.equal(await focusedText(page), 'Alerts')
  })

  it('select tabs as the arrows reach them in automatic mode, and use up and down in a vertical list', async (t) => {
    let { page } = await open(t)
    let automatic = example(page, 'Automatic')

    await automatic.getByRole('tab', { name: 'Open' }).focus()
    await page.keyboard.press('ArrowRight')
    await automatic.getByRole('tabpanel', { name: 'Paid' }).waitFor()
    await page.keyboard.press('End')
    await automatic.getByRole('tabpanel', { name: 'Overdue' }).waitFor()

    let vertical = example(page, 'Vertical')
    await vertical.getByRole('tab', { name: 'Account' }).focus()
    await page.keyboard.press('ArrowRight')
    assert.equal(await focusedText(page), 'Account')
    await page.keyboard.press('ArrowDown')
    assert.equal(await focusedText(page), 'Password')
  })

  it('swap the arrow keys in right-to-left text', async (t) => {
    let { page } = await open(t)
    let rtl = page.locator('[aria-labelledby="direction"]')

    await rtl.getByRole('tab', { name: 'Account' }).first().focus()
    await page.keyboard.press('ArrowLeft')

    assert.equal(await focusedText(page), 'Password')
  })

  it('render the first state without JavaScript, and keep it when they hydrate', async (t) => {
    let { page, server } = await open(t)
    let staticPage = await withoutJavaScript(t, page, server.baseUrl)

    assert.deepEqual(await states(staticPage), await states(page))
    assert.deepEqual(await expanded(staticPage, 'Rich content'), ['Which plans are there?'])
    await example(staticPage, 'Rich content').getByText('Yearly billing').waitFor()
    await example(staticPage, 'With content').getByRole('tabpanel', { name: 'Account' }).waitFor()
    assert.equal(
      await example(staticPage, 'Recovery keys').locator('[data-slot="collapsible-content"]').isHidden(),
      true,
    )
  })

  it('keep parts the page renders outside a client entry as the server rendered them', async (t) => {
    let { page } = await open(t)
    let serverOnly = example(page, 'Server only')

    await serverOnly.getByRole('button', { name: 'Which payment methods work?' }).click()
    await serverOnly.getByRole('tab', { name: 'Lines' }).click()

    assert.deepEqual(await expanded(page, 'Server only'), ['What are the payment terms?'])
    assert.equal(await serverOnly.getByRole('tab', { name: 'Summary' }).getAttribute('aria-selected'), 'true')
  })

  it('pair every trigger and tab with its panel through ids, after hydration too', async (t) => {
    let { page } = await open(t)
    await example(page, 'Basic').getByRole('button', { name: 'When is an invoice due?' }).click()
    await example(page, 'With content').getByRole('tab', { name: 'Password' }).click()

    let problems = await page.evaluate(() => {
      let found: string[] = []
      let ids = [...document.querySelectorAll('[id]')].map((node) => node.id)
      for (let id of new Set(ids)) if (ids.filter((other) => other === id).length > 1) found.push(`duplicate id ${id}`)
      for (let node of document.querySelectorAll('[aria-controls], [aria-labelledby]')) {
        for (let name of ['aria-controls', 'aria-labelledby']) {
          for (let id of (node.getAttribute(name) ?? '').split(/\s+/).filter(Boolean)) {
            if (!document.getElementById(id)) found.push(`${name}="${id}" points nowhere`)
          }
        }
      }
      for (let tab of document.querySelectorAll('[role="tab"][aria-controls]')) {
        let panel = document.getElementById(tab.getAttribute('aria-controls')!)
        if (panel?.getAttribute('aria-labelledby') !== tab.id) found.push(`${tab.id} and its panel disagree`)
      }
      return found
    })
    assert.deepEqual(problems, [])
    assert.ok(
      await example(page, 'With content').getByRole('tab', { name: 'Password' }).getAttribute('aria-controls'),
      'the selected tab names its panel once the panel is there',
    )
  })

  it("follow pagination links to the caller's URLs, without JavaScript too", async (t) => {
    let { page, server } = await open(t)
    let staticPage = await withoutJavaScript(t, page, server.baseUrl)

    for (let current of [staticPage, page]) {
      let basic = example(current, 'Pagination basic')
      assert.equal(await basic.getByRole('link', { name: '2' }).getAttribute('aria-current'), 'page')
      await basic.getByRole('link', { name: 'Go to next page' }).click()
      await current.waitForURL((url) => url.search === '?page=3')
      await example(current, 'Pagination basic').locator('[aria-current="page"]', { hasText: '3' }).waitFor()
    }

    let first = example(page, 'First page')
    let previous = first.locator('[data-slot="pagination-link"]').first()
    assert.equal(await previous.getAttribute('href'), null)
    assert.equal(await previous.getAttribute('aria-disabled'), 'true')
    assert.equal(await first.getByRole('link', { name: 'Go to previous page' }).count(), 1)
    await first.getByRole('link', { name: '1' }).focus()
    await page.keyboard.press('Shift+Tab')
    assert.notEqual(await focusedText(page), 'Previous', 'a turned-off link takes no focus')
  })

  it("pass axe's WCAG 2.2 A and AA rules in both color schemes, with panels open", async (t) => {
    let { page } = await open(t)
    await example(page, 'Basic').getByRole('button', { name: 'When is an invoice due?' }).click()
    await example(page, 'File tree').getByRole('button', { name: 'invoices' }).click()
    await example(page, 'Recovery keys').getByRole('button', { name: 'Recovery keys' }).click()

    for (let colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      assert.deepEqual(await findAccessibilityViolations(page), [], colorScheme)
    }
  })

  it('keep tab and trigger text at 4.5:1 or more, selected or not, in both themes', async (t) => {
    let { page } = await open(t)
    let failures: string[] = []

    for (let theme of ['light', 'dark']) {
      let selector = `[data-theme="${theme}"] :is([role="tab"]:not(:disabled), [data-slot="accordion-trigger"]:not(:disabled), [data-slot="pagination-link"]:not([aria-disabled]))`
      for (let { label, background, text } of await paintColors(page, selector)) {
        let ratio = contrastRatio(toRgba(text), toRgba(background))
        if (ratio < 4.5) failures.push(`${theme} ${label}: ${ratio.toFixed(2)}`)
      }
    }

    assert.deepEqual(failures, [], failures.join('\n'))
  })

  it('show a focus ring on triggers, tabs and links, also in forced colors, and mark the selected tab there', async (t) => {
    let { page } = await open(t)
    let ring = (selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((e) => [getComputedStyle(e).outlineStyle, getComputedStyle(e).outlineWidth])
    let parts = [
      '[data-example="Basic"] [data-slot="accordion-trigger"]',
      '[data-example="Line with content"] [role="tab"]',
      '[data-example="Pagination basic"] [data-slot="pagination-link"]',
    ]

    for (let forcedColors of ['none', 'active'] as const) {
      await page.emulateMedia({ forcedColors })
      for (let part of parts) {
        await page.locator(part).first().focus()
        await page.keyboard.press('Tab')
        await page.keyboard.press('Shift+Tab')
        assert.deepEqual(await ring(part), ['solid', '2px'], `${part}, forced colors ${forcedColors}`)
      }
    }

    // Forced colors drop the selected tab's background, so its line shows instead.
    let line = (name: string) =>
      example(page, 'With content')
        .getByRole('tab', { name })
        .evaluate((e) => getComputedStyle(e, '::after').opacity)
    if (await page.evaluate(() => matchMedia('(forced-colors: active)').matches)) {
      assert.deepEqual([await line('Account'), await line('Password')], ['1', '0'])
    }
  })

  it('skip a closing panel with Tab while it still shrinks', async (t) => {
    let { page } = await open(t, { reducedMotion: 'no-preference' })
    // A slow transition, so the panel is still on screen when Tab moves on.
    await page.evaluate(() => document.documentElement.style.setProperty('--duration-normal', '3s'))
    let rich = example(page, 'Rich content')

    await rich.getByRole('button', { name: 'Which plans are there?' }).focus()
    await page.keyboard.press('Enter')
    await page.keyboard.press('Tab')

    assert.equal(await rich.locator('[data-slot="accordion-content"][data-ending-style]').count(), 1)
    assert.equal(await focusedText(page), 'Can I change my plan?')
  })

  it('grow and shrink panels with the motion tokens, and not at all for reduced motion', async (t) => {
    let { page } = await open(t, { reducedMotion: 'no-preference' })
    let basic = example(page, 'Basic')

    await basic.getByRole('button', { name: 'When is an invoice due?' }).click()
    let panel = basic.locator('[data-slot="accordion-content"]')
    assert.equal(await panel.evaluate((e) => getComputedStyle(e).transitionDuration), '0.2s')
    await page.waitForFunction(() => !document.querySelector('[data-example="Basic"] [data-animating]'))

    await basic.getByRole('button', { name: 'When is an invoice due?' }).click()
    assert.equal(await panel.getAttribute('data-ending-style'), '')
    await panel.waitFor({ state: 'detached' })

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await basic.getByRole('button', { name: 'When is an invoice due?' }).click()
    assert.equal(await panel.evaluate((e) => getComputedStyle(e).transitionDuration), '0s')
  })

  it('mirror chevrons, page arrows and the vertical line in right-to-left text', async (t) => {
    let { page } = await open(t)
    let rtl = page.locator('[aria-labelledby="direction"]')

    let next = rtl.getByRole('link', { name: 'Go to next page' })
    let [arrow, text] = await Promise.all([next.locator('svg').boundingBox(), next.getByText('Next').boundingBox()])
    assert.ok(arrow && text && arrow.x < text.x, 'the onward arrow sits on the left')
    assert.equal(await next.locator('svg').evaluate((e) => getComputedStyle(e).transform), 'matrix(-1, 0, 0, 1, 0, 0)')

    let trigger = rtl.getByRole('button', { name: 'Is my data secure?' })
    let [chevron, label] = await Promise.all([trigger.locator('svg').boundingBox(), trigger.boundingBox()])
    assert.ok(chevron && label && chevron.x < label.x + label.width / 2, 'the chevron sits on the left')

    let vertical = rtl.locator('[data-orientation="vertical"][role="tab"]').first()
    let side = await vertical.evaluate((e) => {
      let style = getComputedStyle(e, '::after')
      return { left: style.left, borderLeft: style.borderLeftWidth }
    })
    assert.deepEqual(side, { left: '-4px', borderLeft: '2px' })
  })

  it('reflow to a 320px wide viewport without scrolling sideways, also with text at 200%', async (t) => {
    let { page } = await open(t)
    await page.setViewportSize({ width: 320, height: 640 })
    await example(page, 'File tree').getByRole('button', { name: 'invoices' }).click()

    for (let fontSize of ['', '32px']) {
      for (let colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme })
        await page.evaluate((size) => (document.documentElement.style.fontSize = size), fontSize)

        let { width, overflowing } = await page.evaluate(() => ({
          width: document.documentElement.scrollWidth,
          overflowing: [...document.body.querySelectorAll('*')]
            .filter((element) => element.getBoundingClientRect().right > innerWidth)
            .map((element) => `${element.localName}: ${element.textContent?.trim().slice(0, 40)}`)
            .at(-1),
        }))
        assert.equal(width, 320, `${colorScheme}, root font size ${fontSize || 'default'}: ${width}px, ${overflowing}`)
      }
    }
  })
})
