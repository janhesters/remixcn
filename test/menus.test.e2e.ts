import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { findAccessibilityViolations } from './accessibility.ts'
import { createMenuExamples } from './fixtures/menus/server.tsx'

// Pages open with reduced motion, so menus appear without a fade and every
// read sees the final style.
async function open(t: TestContext, { path = '/', hydrate = true, colorScheme = 'light' as 'light' | 'dark' } = {}) {
  let examples = await createMenuExamples()
  t.after(() => void examples.close())

  let server = await createTestServer(examples.fetch)
  let page = await t.serve(server)
  await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
  await page.goto(path)
  if (hydrate) await page.locator('html[data-ready]').waitFor({ state: 'attached' })
  return { page, server }
}

type Page = Awaited<ReturnType<typeof open>>['page']

function example(page: Page, name: string) {
  return page.locator(`[data-example="${name}"]`)
}

/** Clicks the example's heading, then tabs to its first control. */
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

function waitOpen(page: Page, selector: string, open = true) {
  return page.waitForFunction(
    ([selector, open]) => document.querySelector(selector as string)?.matches(':popover-open') === open,
    [selector, open] as const,
  )
}

/** Waits until the element named `name` has focus: focus moves a frame after a menu opens. */
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

describe('Dropdown Menu, Context Menu, Menubar and Navigation Menu examples', () => {
  it('show a menu of each family open beside its trigger, nested menus too, and pass axe in both themes', async (t) => {
    for (let colorScheme of ['light', 'dark'] as const) {
      let { page } = await open(t, { path: '/open', colorScheme })
      let dropdown = '[data-example="open-dropdown"] [data-slot="dropdown-menu-content"]'
      let sub = '[data-example="open-dropdown"] [data-slot="dropdown-menu-sub-content"]'
      await waitOpen(page, sub)
      assert.equal(await isOpen(page, dropdown), true)
      assert.equal(await isOpen(page, '[data-example="open-menubar"] [data-slot="menubar-content"]'), true)
      assert.equal(await isOpen(page, '[data-example="open-navigation"] [data-slot="navigation-menu-content"]'), true)
      let trigger = await box(page, '[data-example="open-dropdown"] [data-slot="dropdown-menu-trigger"]')
      assert.equal((await box(page, dropdown)).top, trigger.bottom + 4)
      // Beside its item, over the menu's padding, as in shadcn.
      let item = await box(page, '[data-example="open-dropdown"] [data-slot="dropdown-menu-sub-trigger"]')
      assert.equal((await box(page, sub)).left, item.right)

      assert.deepEqual(await findAccessibilityViolations(page), [], colorScheme)
    }
  })

  it('pass axe with a menu, a context menu and a navigation panel open on the examples page', async (t) => {
    let { page } = await open(t)
    await example(page, 'dropdown-complex').getByRole('button', { name: 'Complex menu' }).click()
    await waitOpen(page, '[data-example="dropdown-complex"] [data-slot="dropdown-menu-content"]')
    assert.deepEqual(await findAccessibilityViolations(page), [], 'dropdown')
    await page.keyboard.press('Escape')
    await waitOpen(page, '[data-example="dropdown-complex"] [data-slot="dropdown-menu-content"]', false)

    await example(page, 'context-groups').locator('[data-slot="context-menu-trigger"]').click({ button: 'right' })
    await waitOpen(page, '[data-example="context-groups"] [data-slot="context-menu-content"]')
    assert.deepEqual(await findAccessibilityViolations(page), [], 'context menu')
    await page.keyboard.press('Escape')
    await waitOpen(page, '[data-example="context-groups"] [data-slot="context-menu-content"]', false)

    await example(page, 'navigation-basic').getByRole('button', { name: 'Getting started' }).click()
    await waitOpen(page, '[data-example="navigation-basic"] [data-slot="navigation-menu-content"]')
    assert.deepEqual(await findAccessibilityViolations(page), [], 'navigation menu')
  })

  it('open a dropdown from the keyboard, run an item with Enter and return focus to the trigger', async (t) => {
    let { page } = await open(t)
    let complex = example(page, 'dropdown-complex')
    let trigger = complex.getByRole('button', { name: 'Complex menu' })

    await tabInto(page, 'dropdown-complex')
    assert.equal(await focused(page), 'Complex menu')
    await page.keyboard.press('Enter')
    await waitFocused(page, 'Profile⇧⌘P')
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true')
    await page.keyboard.press('ArrowDown')
    assert.equal(await focused(page), 'Billing⌘B')
    await page.keyboard.press('s')
    assert.equal(await focused(page), 'Sidebar', 'typing moves to the matching item')

    await page.keyboard.press('Home')
    await page.keyboard.press('Enter')
    await waitFocused(page, 'Complex menu')
    assert.equal(await complex.getByRole('status').textContent(), 'Last chosen: Profile')
    assert.equal(await isOpen(page, '[data-example="dropdown-complex"] [data-slot="dropdown-menu-content"]'), false)
  })

  it('close a dropdown on Tab and move focus on from its trigger, as from a native select', async (t) => {
    let { page } = await open(t)
    let content = '[data-example="dropdown-icons"] [data-slot="dropdown-menu-content"]'

    await tabInto(page, 'dropdown-icons')
    await page.keyboard.press('ArrowDown')
    await waitFocused(page, 'Profile⇧⌘P')
    // The menu moves focus on once it has closed.
    let movesTo = (name: string) =>
      page.waitForFunction((name) => document.activeElement?.closest(`[data-example="${name}"]`) !== null, name)
    await page.keyboard.press('Tab')
    await waitOpen(page, content, false)
    await movesTo('dropdown-submenu')
    assert.equal(await focused(page), 'Invoice INV-2041', 'focus moved on to the next example')

    await page.keyboard.press('Shift+Tab')
    assert.equal(await focused(page), 'Account')
    await page.keyboard.press('ArrowUp')
    await waitFocused(page, 'Sign out⇧⌘Q')
    await page.keyboard.press('Shift+Tab')
    await waitOpen(page, content, false)
    await movesTo('dropdown-sides')
    assert.equal(await focused(page), 'inline end', 'and back to the one before')
  })

  it('open a submenu under the resting pointer, choose in it, and keep the page behind waiting', async (t) => {
    let { page } = await open(t)
    let complex = example(page, 'dropdown-complex')
    await complex.getByRole('button', { name: 'Complex menu' }).click()
    let content = '[data-example="dropdown-complex"] [data-slot="dropdown-menu-content"]'
    let sub = '[data-example="dropdown-complex"] [data-slot="dropdown-menu-sub-content"]'
    await waitOpen(page, content)
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflow), 'hidden')

    await page.getByRole('menuitem', { name: 'Export' }).hover()
    await waitOpen(page, sub)
    await page.getByRole('menuitem', { name: 'CSV' }).hover()
    assert.equal(await focused(page), 'CSV', 'the pointer highlights the item under it')
    await page.getByRole('menuitem', { name: 'CSV' }).click()
    await waitOpen(page, content, false)
    assert.equal(await complex.getByRole('status').textContent(), 'Last chosen: Export as CSV')
  })

  it('check items with Space and keep the menu open, and choose a radio item', async (t) => {
    let { page } = await open(t)
    let content = '[data-example="dropdown-checkboxes"] [data-slot="dropdown-menu-content"]'

    await tabInto(page, 'dropdown-checkboxes')
    await page.keyboard.press('Enter')
    await waitFocused(page, 'Status bar')
    await page.keyboard.press(' ')
    let status = page.getByRole('menuitemcheckbox', { name: 'Status bar' })
    await page.waitForFunction(() =>
      [...document.querySelectorAll('[role="menuitemcheckbox"]')].some(
        (item) => item.textContent === 'Status bar' && item.getAttribute('aria-checked') === 'false',
      ),
    )
    assert.equal(await status.getAttribute('aria-checked'), 'false')
    assert.equal(await isOpen(page, content), true)
    await page.keyboard.press('ArrowDown')
    assert.equal(await focused(page), 'Panel', 'skips the disabled item')
    await page.keyboard.press('Escape')

    let radio = example(page, 'dropdown-radio')
    await radio.getByRole('button', { name: 'Panel: bottom' }).click()
    await page.getByRole('menuitemradio', { name: 'Top' }).click()
    await radio.getByRole('button', { name: 'Panel: top' }).waitFor()
    assert.equal(await page.getByRole('menuitemradio', { name: 'Top' }).getAttribute('aria-checked'), 'true')
  })

  it('close a menu inside a dialog first, then the dialog, with Escape', async (t) => {
    let { page } = await open(t)
    let dialog = example(page, 'dropdown-dialog')
    await dialog.getByRole('button', { name: 'Open dialog' }).click()
    let actions = page.getByRole('button', { name: 'Invoice actions' })
    await actions.click()
    let content = '[data-example="dropdown-dialog"] [data-slot="dropdown-menu-content"]'
    await waitOpen(page, content)

    await page.keyboard.press('Escape')
    await waitOpen(page, content, false)
    assert.equal(
      await page.locator('[data-example="dropdown-dialog"] dialog').evaluate((dialog) => dialog.hasAttribute('open')),
      true,
    )
    await waitFocused(page, 'Invoice actions')
    await page.keyboard.press('Escape')
    await page.waitForFunction(
      () => !document.querySelector('[data-example="dropdown-dialog"] dialog')?.hasAttribute('open'),
    )
  })

  it('open a context menu at the pointer on a right click, and at the focused area with Shift+F10', async (t) => {
    let { page } = await open(t)
    let area = example(page, 'context-icons').locator('[data-slot="context-menu-trigger"]')
    let content = '[data-example="context-icons"] [data-slot="context-menu-content"]'
    await area.scrollIntoViewIfNeeded()
    let areaBox = await area.boundingBox()
    assert.ok(areaBox)

    await page.mouse.click(areaBox.x + 40, areaBox.y + 30, { button: 'right' })
    await waitOpen(page, content)
    let menu = await box(page, content)
    assert.ok(Math.abs(menu.left - (areaBox.x + 40)) <= 1)
    assert.ok(Math.abs(menu.top - (areaBox.y + 34)) <= 1)
    await page.keyboard.press('ArrowDown')
    assert.equal(await focused(page), 'Cut⌘X')
    await page.keyboard.press('Escape')
    await waitOpen(page, content, false)

    await area.focus()
    await page.keyboard.press('Shift+F10')
    await waitOpen(page, content)
    await waitFocused(page, 'Cut⌘X')
    menu = await box(page, content)
    assert.ok(Math.abs(menu.left - areaBox.x) <= 1, 'at the start of the area')
    await page.keyboard.press('Escape')
    await waitFocused(page, 'Right-click here, press Shift+F10, or touch and hold')
  })

  it('move an open context menu to the next right click in its area, and run a row action', async (t) => {
    let { page } = await open(t)
    let rows = example(page, 'context-rows')
    let row = rows.getByRole('row', { name: /INV-2042/ })
    await row.click({ button: 'right', position: { x: 20, y: 10 } })
    let content = '[data-example="context-rows"] tr:nth-child(2) [data-slot="context-menu-content"]'
    await waitOpen(page, content)
    let first = await box(page, content)

    await row.click({ button: 'right', position: { x: 200, y: 10 }, force: true })
    await page.waitForFunction(
      ([selector, left]) =>
        Math.round(document.querySelector(selector as string)!.getBoundingClientRect().left) !== left,
      [content, first.left] as const,
    )
    await page.locator(content).getByRole('menuitem', { name: 'Send reminder' }).click()
    await waitOpen(page, content, false)
    assert.equal(await rows.getByRole('status').textContent(), 'Last chosen: Send reminder: INV-2042')
  })

  it('move through a menubar and between its menus with the arrows, and switch menus under the pointer', async (t) => {
    let { page } = await open(t)
    let menubar = example(page, 'menubar-basic')
    let open_ = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('[data-example="menubar-basic"] [data-slot="menubar-content"]:popover-open')].map(
          (content) => document.getElementById(content.getAttribute('aria-labelledby')!)?.textContent,
        ),
      )

    await tabInto(page, 'menubar-basic')
    assert.equal(await focused(page), 'File')
    await page.keyboard.press('ArrowRight')
    assert.equal(await focused(page), 'Edit')
    await page.keyboard.press('ArrowDown')
    await waitFocused(page, 'Undo ⌘Z')
    await page.keyboard.press('ArrowRight')
    await waitFocused(page, 'Due date')
    assert.deepEqual(await open_(), ['View'])
    await page.keyboard.press('ArrowRight')
    await waitFocused(page, 'New invoice ⌘N')
    assert.deepEqual(await open_(), ['File'], 'wraps around, past the disabled menu')
    await page.keyboard.press('Escape')
    await waitFocused(page, 'File')

    await menubar.getByRole('menuitem', { name: 'File', exact: true }).click()
    await menubar.getByRole('menuitem', { name: 'Edit', exact: true }).hover()
    await page.waitForFunction(
      () =>
        document.querySelector('[data-example="menubar-basic"] [data-slot="menubar-trigger"][aria-expanded="true"]')
          ?.textContent === 'Edit',
    )
    assert.deepEqual(await open_(), ['Edit'])
    await page.getByRole('menuitem', { name: 'Redo ⇧⌘Z' }).click()
    assert.equal(await menubar.getByRole('status').textContent(), 'Last chosen: Redo. Currency: EUR.')
  })

  it('open navigation panels on hover and keys, switch between them, and follow their links', async (t) => {
    let { page } = await open(t)
    let navigation = example(page, 'navigation-basic')
    let panel = (name: string) =>
      page.evaluate(
        (name) =>
          [...document.querySelectorAll('[data-example="navigation-basic"] [data-slot="navigation-menu-content"]')]
            .filter((content) => content.matches(':popover-open'))
            .map((content) => document.getElementById(content.id.replace(/-content$/, '-trigger'))?.textContent)
            .includes(name),
        name,
      )

    await navigation.getByRole('button', { name: 'Getting started' }).hover()
    await page.waitForFunction(() => document.querySelector('[data-example="navigation-basic"] [aria-expanded="true"]'))
    assert.equal(await panel('Getting started'), true)
    await navigation.getByRole('button', { name: 'Reports' }).hover()
    await page.waitForFunction(() =>
      document
        .querySelector('[data-example="navigation-basic"] [data-slot="navigation-menu-trigger"][aria-expanded="true"]')
        ?.textContent?.startsWith('Reports'),
    )
    assert.equal(await panel('Getting started'), false)

    await page.getByRole('link', { name: /^Tax/ }).click()
    assert.equal(new URL(page.url()).hash, '#tax')

    await page.mouse.move(5, 5)
    await tabInto(page, 'navigation-basic')
    assert.equal(await focused(page), 'Getting started')
    await page.keyboard.press('ArrowRight')
    assert.equal(await focused(page), 'Reports')
    await page.keyboard.press('ArrowDown')
    await page.waitForFunction(() => document.activeElement?.closest('[data-slot="navigation-menu-content"]'))
    assert.match(await focused(page), /^Revenue/)
    await page.keyboard.press('Escape')
    await waitFocused(page, 'Reports')
    assert.equal(await navigation.locator('a[href="#introduction"]').getAttribute('aria-current'), 'page')
  })

  it('open a context menu on a held touch, and follow a link on a tap', async (t) => {
    let { page, server } = await open(t, { hydrate: false })
    let context = await page.context().browser()!.newContext({ hasTouch: true, baseURL: server.baseUrl })
    t.after(() => context.close())
    let touch = await context.newPage()
    await touch.goto('/')
    await touch.locator('html[data-ready]').waitFor({ state: 'attached' })

    // A tap on a navigation link follows it, and opens no panel.
    await example(touch, 'navigation-basic').getByRole('link', { name: 'Documentation' }).tap()
    assert.equal(new URL(touch.url()).hash, '#documentation')

    // Only Chromium sends a held touch through Playwright; the browser tests hold one in every engine.
    if (touch.context().browser()?.browserType().name() !== 'chromium') return
    let area = example(touch, 'context-basic').locator('[data-slot="context-menu-trigger"]')
    await area.scrollIntoViewIfNeeded()
    let areaBox = (await area.boundingBox())!
    let cdp = await touch.context().newCDPSession(touch)
    let point = { x: areaBox.x + 30, y: areaBox.y + 20 }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
    let content = '[data-example="context-basic"] [data-slot="context-menu-content"]'
    await waitOpen(touch, content)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    assert.ok(Math.abs((await box(touch, content)).left - point.x) <= 1)
  })

  it('open menus natively without JavaScript, where the links work', async (t) => {
    let { page, server } = await open(t)
    let context = await page.context().browser()!.newContext({ javaScriptEnabled: false, baseURL: server.baseUrl })
    t.after(() => context.close())
    let static_ = await context.newPage()
    await static_.goto('/')

    for (let current of [static_, page]) {
      let dropdown = example(current, 'server-dropdown')
      await dropdown.getByRole('button', { name: 'Help' }).click()
      let content = '[data-example="server-dropdown"] [data-slot="dropdown-menu-content"]'
      assert.equal(await isOpen(current, content), true)
      await current.keyboard.press('Escape')
      assert.equal(await isOpen(current, content), false)

      let navigation = example(current, 'server-navigation')
      await navigation.getByRole('button', { name: 'Reports' }).click()
      let panel = '[data-example="server-navigation"] [data-slot="navigation-menu-content"]'
      assert.equal(await isOpen(current, panel), true)
      await current.locator(panel).getByRole('link', { name: 'Tax' }).click()
      assert.equal(new URL(current.url()).hash, '#tax')
    }

    // Examples before their script runs: a dropdown trigger opens its menu, whose link works.
    await example(static_, 'dropdown-basic').getByRole('button', { name: 'Open' }).click()
    await static_.getByRole('menuitem', { name: 'Help center' }).click()
    assert.equal(new URL(static_.url()).hash, '#help')
  })

  it('keep a menu the browser opened before the script ran, now below its trigger', async (t) => {
    let examples = await createMenuExamples()
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
    await page.goto('/', { waitUntil: 'commit' })

    let content = '[data-example="dropdown-basic"] [data-slot="dropdown-menu-content"]'
    await example(page, 'dropdown-basic').getByRole('button', { name: 'Open' }).click()
    assert.equal(await isOpen(page, content), true)

    release()
    await page.locator('html[data-ready]').waitFor({ state: 'attached' })
    await page.locator(`${content}[data-open][data-side="bottom"]`).waitFor({ state: 'attached' })
    let trigger = await box(page, '[data-example="dropdown-basic"] [data-slot="dropdown-menu-trigger"]')
    assert.equal((await box(page, content)).top, trigger.bottom + 4)
    await page.keyboard.press('ArrowDown')
    assert.equal(await focused(page), 'Profile', 'and the keys work in it')
  })

  it('fit an open menu into 320px with text at 200%, without scrolling sideways', async (t) => {
    let { page } = await open(t)
    await page.setViewportSize({ width: 320, height: 640 })
    await page.evaluate(() => (document.documentElement.style.fontSize = '32px'))

    let content = '[data-example="dropdown-complex"] [data-slot="dropdown-menu-content"]'
    await example(page, 'dropdown-complex').getByRole('button', { name: 'Complex menu' }).click()
    await page.locator(`${content}[data-open]`).waitFor()
    await frames(page)
    let { left, right, top, bottom } = await box(page, content)

    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320)
    assert.ok(left >= 5 && right <= 315, `${left} to ${right}`)
    assert.ok(top >= 5 && bottom <= 635, `${top} to ${bottom}`)
    // What doesn't fit scrolls inside it.
    assert.ok(await page.locator(content).evaluate((element) => element.scrollHeight > element.clientHeight))
  })

  it('draw edges and the highlight in system colors in forced colors', async (t) => {
    let { page } = await open(t, { path: '/open' })
    await page.emulateMedia({ forcedColors: 'active' })
    await page.waitForFunction(() => matchMedia('(forced-colors: active)').matches)
    let styles = await page.evaluate(() => {
      let probe = document.createElement('div')
      probe.style.color = 'CanvasText'
      document.body.append(probe)
      let canvasText = getComputedStyle(probe).color
      probe.remove()
      let menu = document.querySelector('[data-example="open-dropdown"] [data-slot="dropdown-menu-content"]')!
      let open = document.querySelector('[data-example="open-dropdown"] [data-slot="dropdown-menu-sub-trigger"]')!
      return {
        canvasText,
        menu: [getComputedStyle(menu).borderTopStyle, getComputedStyle(menu).borderTopColor],
        highlight: getComputedStyle(open).outlineStyle,
      }
    })

    assert.deepEqual(styles.menu, ['solid', styles.canvasText])
    assert.equal(styles.highlight, 'solid', 'the open submenu item keeps a visible mark')
  })

  it('open submenus and context menus to the left in right-to-left text', async (t) => {
    let { page } = await open(t)
    await example(page, 'rtl-dropdown-submenu').scrollIntoViewIfNeeded()
    await example(page, 'rtl-dropdown-submenu').getByRole('button', { name: 'Invoice INV-2041' }).click()
    let content = '[data-example="rtl-dropdown-submenu"] [data-slot="dropdown-menu-content"]'
    let sub = '[data-example="rtl-dropdown-submenu"] [data-slot="dropdown-menu-sub-content"]'
    await waitOpen(page, content)
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowLeft')
    await waitOpen(page, sub)
    await frames(page)
    assert.equal(await page.locator(sub).first().getAttribute('data-side'), 'left')
    let item = await box(page, '[data-example="rtl-dropdown-submenu"] [data-slot="dropdown-menu-sub-trigger"]')
    assert.equal((await box(page, sub)).right, item.left)
    await page.keyboard.press('ArrowRight')
    await waitOpen(page, sub, false)
    await page.keyboard.press('Escape')
    // The page scrolls back where it was once the menu lets it go.
    await waitOpen(page, content, false)

    let area = example(page, 'rtl-context-basic').locator('[data-slot="context-menu-trigger"]')
    await area.scrollIntoViewIfNeeded()
    let areaBox = (await area.boundingBox())!
    await page.mouse.click(areaBox.x + areaBox.width - 20, areaBox.y + 20, { button: 'right' })
    let menu = '[data-example="rtl-context-basic"] [data-slot="context-menu-content"]'
    await waitOpen(page, menu)
    let placed = await box(page, menu)
    let x = areaBox.x + areaBox.width - 20
    assert.ok(Math.abs(placed.right - x) <= 1, `ends at ${placed.right}, not at the pointer at ${x}`)
  })
})
