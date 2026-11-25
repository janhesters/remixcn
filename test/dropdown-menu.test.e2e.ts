import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { contrastRatio } from '../scripts/color.ts'
import { findAccessibilityViolations } from './accessibility.ts'
import { createDropdownMenuExamples } from './fixtures/dropdown-menu/server.tsx'

// Pages open with reduced motion, so menus appear without a fade and every
// read sees the final style. The motion test opts back in.
async function open(
  t: TestContext,
  {
    reducedMotion = 'reduce' as 'reduce' | 'no-preference',
    hydrate = true,
    colorScheme = 'light' as 'light' | 'dark',
  } = {},
) {
  let examples = await createDropdownMenuExamples()
  t.after(() => void examples.close())

  let server = await createTestServer(examples.fetch)
  let page = await t.serve(server)
  await page.emulateMedia({ colorScheme, reducedMotion })
  // Firefox holds the load event until every client entry hydrated, so wait
  // for the document, then for hydration with room for a long page.
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  if (hydrate) await waitRunning(page)
  return { page, server }
}

// A hydrated menu starts handling keys a task after its first render, when its
// trigger gains aria-expanded. The server-only picker never runs.
async function waitRunning(page: Awaited<ReturnType<TestContext['serve']>>) {
  await page.locator('html[data-ready]').waitFor({ state: 'attached', timeout: 30_000 })
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[data-slot="dropdown-menu-trigger"]')]
      .filter((trigger) => !trigger.closest('[data-example="server-only"]'))
      .every((trigger) => trigger.hasAttribute('aria-expanded')),
  )
}

type Page = Awaited<ReturnType<typeof open>>['page']

function example(page: Page, name: string) {
  return page.locator(`[data-example="${name}"]`)
}

function trigger(page: Page, name: string, index = 0) {
  return example(page, name).locator('[data-slot="dropdown-menu-trigger"]').nth(index)
}

function content(name: string) {
  return `[data-example="${name}"] [data-slot="dropdown-menu-content"]`
}

// WebKit's focus() leaves a trigger below the window out of view. The menu
// then opens hidden, beside an anchor it can't see, and no choice takes focus.
async function focusTrigger(locator: ReturnType<typeof trigger>) {
  await locator.scrollIntoViewIfNeeded()
  await locator.focus()
}

function isOpen(page: Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((element) => element.matches(':popover-open'))
}

/** Waits for the menu to be shown or hidden, after the render that follows an interaction. */
function waitOpen(page: Page, selector: string, open = true) {
  return page.waitForFunction(
    ([selector, open]) => document.querySelector(selector as string)?.matches(':popover-open') === open,
    [selector, open] as const,
  )
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

/** Waits until the element named `name` has focus: focus moves a frame after a menu opens, and after it closes. */
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

function frames(page: Page) {
  return page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

/** Paints the focused element's outline over the menu's background and returns both as sRGB bytes. */
function ringColors(page: Page) {
  return page.evaluate(() => {
    let item = document.activeElement!
    let menu = item.closest('[data-slot="dropdown-menu-content"]')!
    let canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    let context = canvas.getContext('2d', { willReadFrequently: true })!
    context.fillStyle = getComputedStyle(menu).backgroundColor
    context.fillRect(0, 0, 1, 1)
    let background = [...context.getImageData(0, 0, 1, 1).data]
    let style = getComputedStyle(item)
    context.fillStyle = style.outlineColor
    context.fillRect(0, 0, 1, 1)
    return {
      focusVisible: item.matches(':focus-visible'),
      style: style.outlineStyle,
      width: style.outlineWidth,
      background,
      ring: [...context.getImageData(0, 0, 1, 1).data],
    }
  })
}

const toRgba = ([r, g, b]: number[]) => ({ r: r / 255, g: g / 255, b: b / 255, alpha: 1 })

describe('Dropdown Menu examples', () => {
  it('show a picker open beside its trigger with the chosen theme checked, and pass axe in both themes', async (t) => {
    for (let colorScheme of ['light', 'dark'] as const) {
      let { page } = await open(t, { colorScheme })
      let menu = content(`open-${colorScheme}`)
      assert.equal(await isOpen(page, menu), true)
      let anchor = await box(page, `[data-example="open-${colorScheme}"] [data-slot="dropdown-menu-trigger"]`)
      let popup = await box(page, menu)
      assert.equal(popup.top, anchor.bottom + 4)
      assert.equal(popup.left, anchor.left)

      let panel = example(page, `open-${colorScheme}`)
      assert.equal(await panel.getByRole('button', { name: 'Theme' }).getAttribute('aria-expanded'), 'true')
      let group = panel.getByRole('group', { name: 'Theme' })
      assert.equal(await group.getByRole('menuitemradio', { name: 'Dark', checked: true }).count(), 1)
      assert.equal(await group.getByRole('menuitemradio', { checked: false }).count(), 2)
      assert.equal(
        await panel.locator('[data-checked] [data-slot="dropdown-menu-radio-item-indicator"] svg').count(),
        1,
      )

      assert.deepEqual(await findAccessibilityViolations(page), [], colorScheme)
    }
  })

  it('open on a click, focus a choice under the pointer, report it once, and return focus to the trigger', async (t) => {
    let { page } = await open(t)
    let two = example(page, 'two')
    let editor = trigger(page, 'two', 0)
    let menu = `${content('two')}[aria-labelledby="${await editor.getAttribute('id')}"]`
    let status = two.locator('[data-status]').first()

    await editor.click()
    await waitOpen(page, menu)
    assert.equal(await editor.getAttribute('aria-expanded'), 'true')
    let choice = page.locator(menu).getByRole('menuitemradio', { name: 'Dark' })
    await choice.hover()
    assert.equal(await focused(page), 'Dark')

    await choice.click()
    await waitOpen(page, menu, false)
    await waitFocused(page, 'Editor theme')
    assert.equal(await editor.getAttribute('aria-expanded'), 'false')
    assert.deepEqual(
      [await status.getAttribute('data-status'), await status.getAttribute('data-reports')],
      ['dark', '1'],
    )

    // The current choice again closes the menu and reports nothing.
    await editor.click()
    await waitOpen(page, menu)
    assert.equal(await page.locator(menu).getByRole('menuitemradio', { name: 'Dark', checked: true }).count(), 1)
    await page.locator(menu).getByRole('menuitemradio', { name: 'Dark' }).click()
    await waitOpen(page, menu, false)
    await waitFocused(page, 'Editor theme')
    assert.equal(await status.getAttribute('data-reports'), '1')

    // A press elsewhere closes it too.
    await editor.click()
    await waitOpen(page, menu)
    await page.mouse.click(5, 5)
    await waitOpen(page, menu, false)
  })

  it('work from the keyboard: Enter, Space, arrows, Home, End, typeahead and Escape', async (t) => {
    let { page } = await open(t)
    let theme = example(page, 'theme')
    await focusTrigger(trigger(page, 'theme'))

    await page.keyboard.press('Enter')
    await waitOpen(page, content('theme'))
    await waitFocused(page, 'Light')
    await page.keyboard.press('ArrowDown')
    assert.equal(await focused(page), 'Dark')
    await page.keyboard.press('End')
    assert.equal(await focused(page), 'System')
    await page.keyboard.press('ArrowDown')
    assert.equal(await focused(page), 'Light', 'the arrows loop')
    await page.keyboard.press('ArrowUp')
    assert.equal(await focused(page), 'System')
    await page.keyboard.press('Home')
    assert.equal(await focused(page), 'Light')
    await page.keyboard.type('da')
    assert.equal(await focused(page), 'Dark')
    await page.keyboard.press('Escape')
    await waitOpen(page, content('theme'), false)
    await waitFocused(page, 'Theme: System')
    assert.equal(await theme.getByText('Theme: System').count(), 1, 'Escape chooses nothing')

    await page.keyboard.press(' ')
    await waitFocused(page, 'Light')
    await page.keyboard.press('Escape')
    await waitFocused(page, 'Theme: System')

    // ArrowUp opens at the last choice; Space chooses the focused one.
    await page.keyboard.press('ArrowUp')
    await waitFocused(page, 'System')
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press(' ')
    await waitOpen(page, content('theme'), false)
    await waitFocused(page, 'Theme: Dark')
    await theme.getByText('Theme: Dark').waitFor()

    // Enter chooses too.
    await page.keyboard.press('ArrowDown')
    await waitFocused(page, 'Light')
    await page.keyboard.press('Enter')
    await waitOpen(page, content('theme'), false)
    await waitFocused(page, 'Theme: Light')
    await theme.getByText('Theme: Light').waitFor()
  })

  it('close on Tab and move focus on from the trigger, or back with Shift', async (t) => {
    let { page } = await open(t)
    await focusTrigger(trigger(page, 'two', 0))
    await page.keyboard.press('ArrowDown')
    await waitFocused(page, 'Light')

    await page.keyboard.press('Tab')
    await waitFocused(page, 'Preview theme')
    assert.equal(await page.locator(`${content('two')}:popover-open`).count(), 0)

    await page.keyboard.press('ArrowDown')
    await waitFocused(page, 'Light')
    await page.keyboard.press('Shift+Tab')
    await waitFocused(page, 'Editor theme')
    assert.equal(await page.locator(`${content('two')}:popover-open`).count(), 0)
  })

  it('draw a visible focus ring on the focused choice in both themes, apart from the check on another', async (t) => {
    for (let colorScheme of ['light', 'dark'] as const) {
      let { page } = await open(t, { colorScheme })
      await focusTrigger(trigger(page, 'theme'))
      await page.keyboard.press('Enter')
      await waitFocused(page, 'Light')
      assert.equal(
        await example(page, 'theme').getByRole('menuitemradio', { name: 'System', checked: true }).count(),
        1,
      )

      let ring = await ringColors(page)
      let ratio = contrastRatio(toRgba(ring.ring), toRgba(ring.background))
      assert.deepEqual([ring.focusVisible, ring.style, ring.width], [true, 'solid', '2px'], colorScheme)
      assert.ok(ratio >= 3, `${colorScheme}: ${ratio.toFixed(2)}`)
    }
  })

  it('open, choose and close on touch', async (t) => {
    let { page, server } = await open(t, { hydrate: false })
    let context = await page.context().browser()!.newContext({ hasTouch: true, baseURL: server.baseUrl })
    t.after(() => context.close())
    let touch = await context.newPage()
    await touch.emulateMedia({ reducedMotion: 'reduce' })
    await touch.goto('/', { waitUntil: 'domcontentloaded' })
    await waitRunning(touch)

    await trigger(touch, 'theme').tap()
    await waitOpen(touch, content('theme'))
    await example(touch, 'theme').getByRole('menuitemradio', { name: 'Dark' }).tap()
    await waitOpen(touch, content('theme'), false)
    await example(touch, 'theme').getByText('Theme: Dark').waitFor()

    await trigger(touch, 'theme').tap()
    await waitOpen(touch, content('theme'))
    await touch.touchscreen.tap(5, 5)
    await waitOpen(touch, content('theme'), false)
    assert.equal(await example(touch, 'theme').getByText('Theme: Dark').count(), 1)

    // A tap on another button behind the open, modal menu only closes the menu.
    let [start, end] = [trigger(touch, 'edges', 0), trigger(touch, 'edges', 1)]
    await end.scrollIntoViewIfNeeded()
    await start.tap()
    await waitOpen(touch, content('edges'))
    let target = (await end.boundingBox())!
    await touch.touchscreen.tap(target.x + target.width / 2, target.y + target.height / 2)
    await waitOpen(touch, content('edges'), false)
    await touch.evaluate(() => new Promise((resolve) => setTimeout(resolve, 300)))
    assert.equal(await touch.locator(`${content('edges')}:popover-open`).count(), 0)
    assert.equal(await end.getAttribute('aria-expanded'), 'false')
  })

  it('keep two pickers apart, each with its own choice', async (t) => {
    let { page } = await open(t)
    let statuses = example(page, 'two').locator('[data-status]')

    await trigger(page, 'two', 1).click()
    await page
      .locator(`${content('two')}[data-open]`)
      .getByRole('menuitemradio', { name: 'System' })
      .click()
    await waitFocused(page, 'Preview theme')
    assert.deepEqual(await statuses.evaluateAll((all) => all.map((one) => one.getAttribute('data-status'))), [
      'light',
      'system',
    ])
    assert.deepEqual(await statuses.evaluateAll((all) => all.map((one) => one.getAttribute('data-reports'))), [
      '0',
      '1',
    ])

    await trigger(page, 'two', 0).click()
    let editor = page.locator(`${content('two')}[data-open]`)
    assert.equal(await editor.getByRole('menuitemradio', { name: 'Light', checked: true }).count(), 1)
    assert.equal(await page.locator(`${content('two')}[data-open]`).count(), 1)

    let ids = await page
      .locator('[data-slot="dropdown-menu-content"]')
      .evaluateAll((menus) => menus.map((menu) => menu.id))
    assert.equal(new Set(ids).size, ids.length)
  })

  it('send no form from the trigger or a choice, with and without JavaScript', async (t) => {
    let { page, server } = await open(t)
    let context = await page.context().browser()!.newContext({ javaScriptEnabled: false, baseURL: server.baseUrl })
    t.after(() => context.close())
    let static_ = await context.newPage()
    await static_.goto('/')

    for (let current of [static_, page]) {
      let form = example(current, 'form')
      await form.getByRole('button', { name: 'Note theme' }).click()
      await waitOpen(current, content('form'))
      await current.locator(content('form')).getByRole('menuitemradio', { name: 'Dark' }).click()
      assert.equal(new URL(current.url()).pathname, '/')
      if (await isOpen(current, content('form'))) {
        await current.keyboard.press('Escape')
        await waitOpen(current, content('form'), false)
      }

      await form.getByRole('button', { name: 'Save' }).click()
      await current.locator('[data-echo="fields"]').waitFor()
      assert.deepEqual(
        await current.locator('[data-echo="fields"] dt').allTextContents(),
        ['note'],
        'only the note is sent',
      )
    }
  })

  it('open natively in the middle of the screen without JavaScript, from a picker no script runs', async (t) => {
    let { page, server } = await open(t, { hydrate: false })
    let context = await page.context().browser()!.newContext({ javaScriptEnabled: false, baseURL: server.baseUrl })
    t.after(() => context.close())
    let static_ = await context.newPage()
    await static_.goto('/')

    for (let current of [static_, page]) {
      if (current === page) await waitRunning(page)
      let serverOnly = example(current, 'server-only')
      await serverOnly.getByRole('button', { name: 'Theme' }).click()
      await waitOpen(current, content('server-only'))
      let menu = current.locator(content('server-only'))
      assert.equal(await menu.getByRole('menuitemradio', { name: 'Light', checked: true }).count(), 1)
      await current.keyboard.press('Escape')
      await waitOpen(current, content('server-only'), false)
    }
  })

  it('stay beside a trigger at either edge of a phone screen', async (t) => {
    let { page } = await open(t)
    await page.setViewportSize({ width: 390, height: 800 })

    for (let index of [0, 1]) {
      let anchor = trigger(page, 'edges', index)
      await anchor.scrollIntoViewIfNeeded()
      await anchor.click()
      let menu = `${content('edges')}[data-open]`
      await page.locator(menu).waitFor()
      await frames(page)
      let popup = await box(page, menu)
      let button = await anchor.evaluate((element) => {
        let { left, right, bottom } = element.getBoundingClientRect()
        return { left: Math.round(left), right: Math.round(right), bottom: Math.round(bottom) }
      })
      assert.equal(popup.top, button.bottom + 4)
      assert.ok(popup.left >= 5 && popup.right <= 385, `${popup.left} to ${popup.right}`)
      if (index === 0) assert.equal(popup.left, button.left)
      else assert.equal(popup.right, button.right)
      await page.keyboard.press('Escape')
      await page.locator(menu).waitFor({ state: 'detached' })
    }
  })

  it('fit an open picker into 320px with text at 200%, without scrolling sideways', async (t) => {
    let { page } = await open(t)
    await page.setViewportSize({ width: 320, height: 640 })
    await page.evaluate(() => (document.documentElement.style.fontSize = '32px'))

    let anchor = trigger(page, 'edges', 1)
    await anchor.scrollIntoViewIfNeeded()
    await anchor.click()
    await page.locator(`${content('edges')}[data-open]`).waitFor()
    await frames(page)
    let { left, right, top, bottom } = await box(page, `${content('edges')}[data-open]`)

    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320)
    assert.ok(left >= 5 && right <= 315, `${left} to ${right}`)
    assert.ok(top >= 5 && bottom <= 635, `${top} to ${bottom}`)
  })

  it('fade in only without reduced motion', async (t) => {
    for (let [reducedMotion, duration] of [
      ['reduce', '0s'],
      ['no-preference', '0.1s'],
    ] as const) {
      let { page } = await open(t, { reducedMotion })
      let duration_ = await page
        .locator(content('open-light'))
        .evaluate((element) => getComputedStyle(element).transitionDuration)
      assert.equal(duration_, duration, reducedMotion)
    }
  })

  it('draw the edge and the focused choice in system colors in forced colors', async (t) => {
    let { page } = await open(t)
    await page.emulateMedia({ forcedColors: 'active' })
    await focusTrigger(trigger(page, 'theme'))
    await page.keyboard.press('ArrowDown')
    await waitFocused(page, 'Light')

    let styles = await page.evaluate(() => {
      let probe = document.createElement('div')
      document.body.append(probe)
      probe.style.color = 'CanvasText'
      let canvasText = getComputedStyle(probe).color
      probe.style.color = 'Highlight'
      let highlight = getComputedStyle(probe).color
      probe.remove()
      let menu = document.querySelector('[data-example="theme"] [data-slot="dropdown-menu-content"]')!
      let item = document.activeElement!
      return {
        forced: matchMedia('(forced-colors: active)').matches,
        canvasText,
        highlight,
        edge: [getComputedStyle(menu).borderTopStyle, getComputedStyle(menu).borderTopColor],
        focus: [getComputedStyle(item).outlineStyle, getComputedStyle(item).outlineColor],
      }
    })

    assert.equal(styles.forced, true)
    assert.deepEqual(styles.edge, ['solid', styles.canvasText])
    assert.deepEqual(styles.focus, ['solid', styles.highlight])
  })

  it('line up with the start of the line and put the check at its end in right-to-left text', async (t) => {
    let { page } = await open(t)
    let anchor = trigger(page, 'rtl')
    await anchor.scrollIntoViewIfNeeded()
    await anchor.focus()
    await page.keyboard.press('ArrowDown')
    await waitFocused(page, 'فاتح')
    await frames(page)

    let button = await box(page, '[data-example="rtl"] [data-slot="dropdown-menu-trigger"]')
    let menu = await box(page, content('rtl'))
    assert.equal(menu.right, button.right)
    let checked = page.locator(`${content('rtl')} [data-checked]`)
    let row = await checked.evaluate((element) => element.getBoundingClientRect().left)
    let mark = await checked
      .locator('[data-slot="dropdown-menu-radio-item-indicator"]')
      .evaluate((element) => element.getBoundingClientRect().left)
    assert.ok(mark - row < 16, `the check sits at the left end: ${mark - row}px in`)

    await page.keyboard.press('Escape')
    await waitFocused(page, 'المظهر')
  })
})
