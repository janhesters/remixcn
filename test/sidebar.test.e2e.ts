import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { findAccessibilityViolations } from './accessibility.ts'
import { createSidebarExamples } from './fixtures/sidebar/server.tsx'

interface OpenOptions {
  /** `'off'` turns JavaScript off; `'never'` keeps it on but no script ever loads. */
  javaScript?: 'on' | 'off' | 'never'
  width?: number
  colorScheme?: 'light' | 'dark'
  reducedMotion?: 'reduce' | 'no-preference'
}

/**
 * Opens a page and waits until it hydrated. Firefox fires load only after the entry's top-level `await app.ready()`,
 * so waiting for load there would time hydration against the 10s navigation limit, and Chromium against the 5s action
 * limit. The navigation waits for the document, and hydration gets its own limit.
 */
async function visit(page: import('playwright').Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await page.locator('html[data-ready]').waitFor({ state: 'attached', timeout: 30_000 })
}

// Pages open with reduced motion, so the sidebar moves at once and every read sees the final style.
async function open(
  t: TestContext,
  path: string,
  { javaScript = 'on', width = 1280, colorScheme = 'light', reducedMotion = 'reduce' }: OpenOptions = {},
) {
  let examples = await createSidebarExamples()
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
  if (javaScript === 'never') {
    await page.route('**/assets/**', (route) =>
      route.request().resourceType() === 'script' ? route.abort() : route.continue(),
    )
  }
  await page.setViewportSize({ width, height: 720 })
  await page.emulateMedia({ colorScheme, reducedMotion })
  if (javaScript === 'on') await visit(page, path)
  else await page.goto(path)
  t.after(() => assert.deepEqual(errors, []))
  return { page, server }
}

type Page = Awaited<ReturnType<typeof open>>['page']

const sidebar = '[data-slot="sidebar"]'
const sheet = 'dialog[data-slot="sidebar"]'

function state(page: Page) {
  return page.locator(sidebar).first().getAttribute('data-state')
}

function waitState(page: Page, value: 'expanded' | 'collapsed') {
  return page.waitForFunction(
    ([selector, value]) => document.querySelector(selector!)?.getAttribute('data-state') === value,
    [sidebar, value],
    { timeout: 5000 },
  )
}

/** Waits until the element with this accessible text, or this selector, has focus. */
function waitFocused(page: Page, name: string) {
  return page.waitForFunction(
    (name) => {
      let active = document.activeElement
      if (!active || active === document.body) return false
      return active.matches(name) || active.textContent?.trim() === name || active.getAttribute('aria-label') === name
    },
    name,
    { timeout: 5000 },
  )
}

/** Whether the element shows on screen, inside the window. */
function onScreen(page: Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((element) => {
      let box = element.getBoundingClientRect()
      return (
        element.checkVisibility({ visibilityProperty: true }) && box.width > 0 && box.right > 0 && box.left < innerWidth
      )
    })
}

function box(page: Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((element) => {
      let { left, right, top, bottom } = element.getBoundingClientRect()
      return { left: Math.round(left), right: Math.round(right), top: Math.round(top), bottom: Math.round(bottom) }
    })
}

function scrollWidth(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth)
}

describe('Sidebar examples', () => {
  it('keep their navigation without JavaScript at 320px, above the page, with the current page marked', async (t) => {
    let { page } = await open(t, '/docs', { javaScript: 'off', width: 320 })

    assert.ok(await onScreen(page, '[data-slot="sidebar-container"]'))
    assert.ok(!(await onScreen(page, '[data-slot="sidebar-trigger"]')), 'the trigger shows, but nothing runs it')
    let nav = await box(page, '[data-slot="sidebar-container"]')
    let main = await box(page, 'main')
    assert.ok(nav.bottom <= main.top, 'the sidebar sits above the page')
    assert.equal(await scrollWidth(page), 320)

    await page.getByRole('link', { name: 'Caching' }).click()
    await page.waitForURL(/page=caching/)
    assert.equal(await page.locator('h1').textContent(), 'Caching')
    assert.equal(await page.getByRole('link', { name: 'Caching' }).getAttribute('aria-current'), 'page')
  })

  it('show a sidebar collapsed off canvas expanded without JavaScript, where nothing could open it', async (t) => {
    let { page } = await open(t, '/docs?open=false', { javaScript: 'off' })

    assert.equal(await state(page), 'collapsed')
    assert.ok(await onScreen(page, '[data-slot="sidebar-inner"]'))
    assert.ok(await page.getByRole('link', { name: 'Routing' }).isVisible())
  })

  it('show the parts above the page two seconds after a script that never loads, on a narrow screen', async (t) => {
    let { page } = await open(t, '/icons', { javaScript: 'never', width: 390 })

    assert.ok(!(await onScreen(page, '[data-slot="sidebar-inner"]')), 'the parts show before the fallback')
    assert.ok(await page.getByRole('heading', { name: 'Inbox' }).isVisible())
    await page.waitForFunction(
      () => document.querySelector('[data-slot="sidebar-inner"]')?.checkVisibility({ visibilityProperty: true }),
      undefined,
      { timeout: 4000 },
    )
    assert.ok(await page.getByRole('link', { name: 'Invoices' }).isVisible())
    assert.equal(await scrollWidth(page), 390)
  })

  it('toggle on a wide screen with the trigger, the rail and Ctrl+B, and keep Tab out of a sidebar off the screen', async (t) => {
    let { page } = await open(t, '/docs')
    let trigger = page.locator('[data-slot="sidebar-trigger"]')

    assert.equal(await trigger.getAttribute('aria-expanded'), 'true')
    await trigger.click()
    await waitState(page, 'collapsed')
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false')
    assert.ok(!(await onScreen(page, '[data-slot="sidebar-inner"]')))

    // Tab from the trigger reaches the page, never the links off the screen.
    await trigger.focus()
    for (let step = 0; step < 3; step++) {
      await page.keyboard.press('Tab')
      assert.ok(
        await page.evaluate(() => !document.activeElement?.closest('[data-slot="sidebar"]')),
        `Tab ${step + 1} reached the hidden sidebar`,
      )
    }

    await page.keyboard.press('ControlOrMeta+b')
    await waitState(page, 'expanded')
    await page.locator('[data-slot="sidebar-rail"]').click()
    await waitState(page, 'collapsed')
    // The rail stays on the screen's edge, so a click there opens the sidebar again.
    assert.ok(await onScreen(page, '[data-slot="sidebar-rail"]'))
    await page.locator('[data-slot="sidebar-rail"]').click()
    await waitState(page, 'expanded')
  })

  it('move focus from a link of a sidebar that slides away to the trigger', async (t) => {
    let { page } = await open(t, '/docs')

    await page.getByRole('link', { name: 'Routing' }).focus()
    await page.keyboard.press('ControlOrMeta+b')
    await waitState(page, 'collapsed')
    await waitFocused(page, 'Toggle Sidebar')
  })

  it('collapse to icons whose labels show in tooltips on hover and keyboard focus', async (t) => {
    let { page } = await open(t, '/icons')

    await page.keyboard.press('ControlOrMeta+b')
    await waitState(page, 'collapsed')
    let rail = await box(page, '[data-slot="sidebar-container"]')
    assert.ok(rail.right - rail.left <= 49, `the icon column is ${rail.right - rail.left}px wide`)
    assert.ok(!(await page.locator('[data-slot="sidebar-menu-badge"]').isVisible()))
    assert.ok(!(await page.locator('[data-slot="sidebar-group-action"]').isVisible()))

    await page.getByRole('link', { name: 'Invoices' }).hover()
    let tip = page.locator('[data-slot="tooltip-content"]:popover-open')
    await tip.waitFor()
    assert.equal(await tip.textContent(), 'Invoices')
    let row = await box(page, '[data-slot="sidebar-menu-button"][href="?page=invoices"]')
    assert.ok((await box(page, '[data-slot="tooltip-content"]:popover-open')).left >= row.right)

    await page.mouse.move(700, 600)
    await page.getByRole('link', { name: 'Customers' }).focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    await page.waitForFunction(
      () => document.querySelector('[data-slot="tooltip-content"]:popover-open')?.textContent === 'Customers',
      undefined,
      { timeout: 5000 },
    )

    await page.keyboard.press('ControlOrMeta+b')
    await waitState(page, 'expanded')
    await page.getByRole('link', { name: 'Reports' }).hover()
    await page.waitForTimeout(300)
    assert.equal(await page.locator('[data-slot="tooltip-content"]:popover-open').count(), 0)
  })

  it('add and remove menu items, with focus on the row that takes the removed one’s place', async (t) => {
    let { page } = await open(t, '/icons')

    await page.getByRole('button', { name: 'Add project' }).click()
    await page.getByRole('link', { name: 'Project 4' }).waitFor()
    await page.getByRole('status').filter({ hasText: 'Added Project 4.' }).waitFor({ state: 'attached' })

    await page.getByRole('link', { name: 'Borealis' }).hover()
    assert.ok(await page.getByRole('button', { name: 'Remove Borealis' }).isVisible())
    await page.getByRole('button', { name: 'Remove Borealis' }).click()
    await page.getByRole('link', { name: 'Borealis' }).waitFor({ state: 'detached' })
    await waitFocused(page, 'Cygnus')

    for (let name of ['Atlas', 'Cygnus', 'Project 4']) {
      await page.getByRole('link', { name }).focus()
      await page.keyboard.press('Tab')
      await page.getByRole('button', { name: `Remove ${name}` }).press('Enter')
      await page.getByRole('link', { name }).waitFor({ state: 'detached' })
    }
    await waitFocused(page, 'Add project')
  })

  it('name each added project anew after any mix of additions and removals', async (t) => {
    let { page } = await open(t, '/icons')
    let add = () => page.getByRole('button', { name: 'Add project' }).click({ timeout: 5000 })
    let remove = (name: string) =>
      page.getByRole('button', { name: `Remove ${name}`, exact: true }).dispatchEvent('click', {}, { timeout: 5000 })
    let projects = () =>
      page.locator('[aria-labelledby="northwind-projects"] [data-slot="sidebar-menu-button"]').allTextContents()

    await add()
    await add()
    await remove('Atlas')
    await add()
    await remove('Borealis')
    await remove('Cygnus')
    await add()

    await page.getByRole('status').filter({ hasText: 'Added Project 7.' }).waitFor({ state: 'attached', timeout: 5000 })
    assert.deepEqual(await projects(), ['Project 4', 'Project 5', 'Project 6', 'Project 7'])
  })

  it('open a modal sheet on a narrow screen that keeps Tab inside, and Escape returns focus to the trigger', async (t) => {
    let { page } = await open(t, '/docs', { width: 390 })
    let trigger = page.getByRole('button', { name: 'Toggle Sidebar' })

    assert.equal(await page.locator('[data-slot="sidebar-container"]').count(), 0)
    assert.equal(await trigger.getAttribute('aria-haspopup'), 'dialog')
    await trigger.click()
    await page.locator(`${sheet}[open]`).waitFor()
    assert.ok(await page.locator(sheet).evaluate((dialog) => dialog.matches(':modal')))
    assert.equal(await page.getByRole('dialog', { name: 'Sidebar' }).count(), 1)
    await page.waitForFunction((selector) => document.querySelector(selector)?.contains(document.activeElement), sheet)

    await page.keyboard.press('Shift+Tab')
    assert.ok(
      await page.evaluate((selector) => document.querySelector(selector)?.contains(document.activeElement), sheet),
    )
    let box = await page.locator(sheet).boundingBox()
    assert.ok(box && box.width <= 288 && box.x === 0, `the sheet is ${box?.width}px wide at ${box?.x}`)

    await page.keyboard.press('Escape')
    await page.locator(`${sheet}:not([open])`).waitFor({ state: 'attached' })
    await waitFocused(page, 'Toggle Sidebar')
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false')
  })

  it('close the sheet as a link in it navigates in place, and mark the new page', async (t) => {
    let { page } = await open(t, '/docs', { width: 390 })

    await page.getByRole('button', { name: 'Toggle Sidebar' }).click()
    await page.locator(`${sheet}[open]`).waitFor()
    await page.getByRole('link', { name: 'Caching' }).click()

    await page.getByRole('heading', { name: 'Caching' }).waitFor()
    await page.locator(`${sheet}:not([open])`).waitFor({ state: 'attached' })
    assert.ok(await page.evaluate(() => !document.querySelector('[inert]')))
    await page.locator('[data-slot="sidebar-trigger"]').click()
    await page.locator(`${sheet}[open]`).waitFor()
    assert.equal(await page.getByRole('link', { name: 'Caching' }).getAttribute('aria-current'), 'page')
  })

  it('move between the column and the sheet as the window resizes, keeping focus on the trigger', async (t) => {
    let { page } = await open(t, '/icons')

    await page.getByRole('link', { name: 'Reports' }).focus()
    await page.setViewportSize({ width: 390, height: 720 })
    await page.locator(sheet).waitFor({ state: 'attached' })
    await waitFocused(page, 'Toggle Sidebar')

    await page.keyboard.press('Enter')
    await page.locator(`${sheet}[open]`).waitFor()
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.locator(sheet).waitFor({ state: 'detached' })
    await waitFocused(page, 'Toggle Sidebar')
    assert.equal(await state(page), 'expanded')
    assert.ok(
      await page.evaluate(
        () => !document.querySelector('[inert]') && getComputedStyle(document.body).overflow !== 'hidden',
      ),
    )
  })

  it('sit on their side in either direction, with the page beside them', async (t) => {
    let { page } = await open(t, '/floating')
    let right = await box(page, '[data-slot="sidebar-container"]')
    let main = await box(page, 'main')
    assert.equal(right.right, 1280)
    assert.ok(main.right <= right.left, 'the page runs under a right sidebar')
    // The panel in the trigger's icon sits on the right too.
    assert.match(
      await page.locator('[data-slot="sidebar-trigger"] svg').evaluate((svg) => getComputedStyle(svg).transform),
      /matrix\(-1/,
    )

    await visit(page, '/docs?dir=rtl')
    let left = await box(page, '[data-slot="sidebar-container"]')
    let rtlMain = await box(page, 'main')
    assert.equal(left.left, 0)
    assert.ok(rtlMain.left >= left.right, 'the page runs under a left sidebar in right-to-left text')
    assert.equal(
      await page
        .locator('[data-slot="sidebar-menu-button"]')
        .nth(1)
        .evaluate((row) => getComputedStyle(row).textAlign),
      'start',
    )
  })

  it('give the inset variant a rounded page beside the sidebar', async (t) => {
    let { page } = await open(t, '/inset')
    let main = page.locator('main')

    assert.equal(await main.evaluate((element) => getComputedStyle(element).marginLeft), '0px')
    assert.notEqual(await main.evaluate((element) => getComputedStyle(element).borderTopLeftRadius), '0px')
    await page.keyboard.press('ControlOrMeta+b')
    await waitState(page, 'collapsed')
    assert.equal(await main.evaluate((element) => getComputedStyle(element).marginLeft), '8px')
  })

  it('follow a controlled state, with the shortcut off', async (t) => {
    let { page } = await open(t, '/controlled')
    let status = page.getByRole('status')

    await page.keyboard.press('ControlOrMeta+b')
    await page.waitForTimeout(200)
    assert.equal(await state(page), 'expanded')
    assert.equal(
      await page
        .locator('[data-slot="sidebar-container"]')
        .evaluate((element) => element.getBoundingClientRect().width),
      320,
    )

    await page.getByLabel('Show sidebar').click()
    await waitState(page, 'collapsed')
    assert.match((await status.textContent()) ?? '', /collapsed, changed by switch/)
    await page.locator('[data-slot="sidebar-trigger"]').click()
    await waitState(page, 'expanded')
    assert.match((await status.textContent()) ?? '', /expanded, changed by trigger-press/)
    assert.ok(await page.getByLabel('Show sidebar').isChecked())
  })

  it('animate only without reduced motion, and draw the current row and focus in forced colors', async (t) => {
    let { page } = await open(t, '/docs', { reducedMotion: 'no-preference' })
    let container = page.locator('[data-slot="sidebar-container"]')

    assert.equal(await container.evaluate((element) => getComputedStyle(element).transitionDuration), '0.2s')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    assert.equal(await container.evaluate((element) => getComputedStyle(element).transitionDuration), '0s')

    await page.emulateMedia({ forcedColors: 'active' })
    let current = page.locator('[aria-current="page"]')
    assert.equal(await current.evaluate((element) => getComputedStyle(element).outlineStyle), 'solid')
    await page.getByRole('link', { name: 'Routing' }).focus()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Shift+Tab')
    assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement!).outlineWidth), '2px')
  })

  for (let path of ['/docs', '/icons', '/floating', '/inset', '/controlled', '/settings']) {
    it(`reflow ${path} to a 320px wide window without scrolling sideways, also with text at 200%`, async (t) => {
      let { page } = await open(t, path, { width: 320 })

      for (let fontSize of ['', '32px']) {
        await page.evaluate((size) => (document.documentElement.style.fontSize = size), fontSize)
        let trigger = page.locator('[data-slot="sidebar-trigger"]')
        if ((await trigger.count()) > 0) {
          await trigger.click()
          await page.locator(`${sheet}[open]`).waitFor()
          let sheetWidth = await page.locator(sheet).evaluate((dialog) => dialog.scrollWidth - dialog.clientWidth)
          assert.equal(sheetWidth, 0, `${path} at ${fontSize || 'the default size'}: the sheet scrolls sideways`)
          await page.keyboard.press('Escape')
          await page.locator(`${sheet}:not([open])`).waitFor({ state: 'attached' })
        }
        let { width, overflowing } = await page.evaluate(() => ({
          width: document.documentElement.scrollWidth,
          overflowing: [...document.body.querySelectorAll('*')]
            .filter((element) => element.getBoundingClientRect().right > innerWidth)
            .map((element) => `${element.localName}: ${element.textContent?.trim().slice(0, 40)}`)
            .at(-1),
        }))
        assert.equal(width, 320, `${path}, root font size ${fontSize || 'default'}: ${width}px, ${overflowing}`)
      }
    })
  }

  for (let colorScheme of ['light', 'dark'] as const) {
    it(`pass axe-core's WCAG 2.2 A and AA rules in the ${colorScheme} theme, expanded, collapsed and as a sheet`, async (t) => {
      let { page } = await open(t, '/icons', { colorScheme })
      let check = async (label: string) => {
        let violations = await findAccessibilityViolations(page)
        assert.deepEqual(violations, [], `${label}: ${violations.join('\n')}`)
      }

      for (let path of ['/docs', '/floating', '/inset', '/controlled', '/settings']) {
        await visit(page, path)
        await check(path)
      }
      await visit(page, '/icons')
      await check('expanded')
      await page.keyboard.press('ControlOrMeta+b')
      await waitState(page, 'collapsed')
      await page.getByRole('link', { name: 'Invoices' }).hover()
      await page.locator('[data-slot="tooltip-content"]:popover-open').waitFor()
      await check('collapsed to icons with a tooltip')

      await page.setViewportSize({ width: 390, height: 720 })
      await page.locator(sheet).waitFor({ state: 'attached' })
      await page.locator('[data-slot="sidebar-trigger"]').click()
      await page.locator(`${sheet}[open]`).waitFor()
      await check('the sheet')
    })
  }

  it("pass axe-core's rules before the scripts run", async (t) => {
    let { page } = await open(t, '/docs')
    let held = await page
      .context()
      .browser()!
      .newContext({ baseURL: new URL(page.url()).origin })
    t.after(() => held.close())
    let before = await held.newPage()
    await before.route('**/assets/**', (route) =>
      route.request().resourceType() === 'stylesheet' ? route.continue() : route.abort(),
    )
    await before.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
    for (let path of ['/docs', '/icons?open=false']) {
      await before.goto(path)
      assert.deepEqual(await findAccessibilityViolations(before), [], path)
    }
  })
})
