import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { findAccessibilityViolations } from './accessibility.ts'
import { createLayout } from './fixtures/layout/server.tsx'

interface OpenOptions {
  // Without JavaScript the page stays as the server rendered it.
  javaScript?: boolean
  reducedMotion?: 'reduce' | 'no-preference'
  width?: number
}

// Pages open with reduced motion, so transitions take 0s and every read sees
// the final style. The motion test opts back in.
async function open(t: TestContext, { javaScript = true, reducedMotion = 'reduce', width = 1280 }: OpenOptions = {}) {
  let layout = await createLayout()
  t.after(() => void layout.close())

  let page = await t.serve(await createTestServer(layout.fetch))
  let errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  if (!javaScript)
    await page.route('**/*', (route) =>
      route.request().resourceType() === 'script' ? route.abort() : route.continue(),
    )

  await page.setViewportSize({ width, height: 900 })
  await page.emulateMedia({ colorScheme: 'light', reducedMotion })
  await page.goto('/')
  if (javaScript) await page.locator('html[data-hydrated]').waitFor({ state: 'attached' })
  return Object.assign(page, { errors })
}

type Page = Awaited<ReturnType<typeof open>>
type Locator = ReturnType<Page['locator']>

function example(page: Page, name: string) {
  return page.locator(`[data-example="${name}"]`)
}

function handles(page: Page, name: string) {
  return example(page, name).locator('[data-slot="resizable-handle"]')
}

function panelSizes(page: Page, name: string) {
  return example(page, name)
    .locator('[data-slot="resizable-panel"]')
    .evaluateAll((panels) =>
      panels.map((panel) => Math.round(Number.parseFloat((panel as HTMLElement).style.flexGrow))),
    )
}

function viewport(page: Page, name: string) {
  return example(page, name).locator('[data-slot="scroll-area-viewport"]').first()
}

function computed(locator: Locator, property: string) {
  return locator.first().evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property)
}

async function center(locator: Locator) {
  let box = await locator.first().boundingBox()
  assert.ok(box)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function until(page: Page, condition: () => boolean | Promise<boolean>, message: string) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (await condition()) return
    await page.waitForTimeout(20)
  }
  assert.fail(message)
}

function engine(page: Page) {
  return page.context().browser()?.browserType().name() ?? 'chromium'
}

// The scrollbar width of an unstyled element. Playwright's Firefox reports
// none for every element, so compare with it instead of with auto.
function nativeScrollbarWidth(page: Page) {
  return page.evaluate(() => getComputedStyle(document.body).scrollbarWidth)
}

const scrollAreas = ['scroll-area-vertical', 'scroll-area-horizontal', 'scroll-area-both', 'rtl-scroll-area']

describe('Resizable and Scroll Area examples', () => {
  it('renders every layout and scrollable region before JavaScript, with static handles and native scrollbars', async (t) => {
    let page = await open(t, { javaScript: false })

    assert.deepEqual(await panelSizes(page, 'resizable-horizontal'), [25, 75])
    assert.deepEqual(await panelSizes(page, 'resizable-nested'), [50, 50, 25, 75])
    assert.equal(await page.locator('[data-slot="resizable-handle"][tabindex]').count(), 0)
    assert.equal(
      await page.locator('[data-slot="resizable-handle"][role="separator"]').count(),
      await page.locator('[data-slot="resizable-handle"]').count(),
    )

    for (let name of scrollAreas) {
      assert.equal(await example(page, name).locator('[data-scrollbars]').count(), 0, name)
      assert.equal(await computed(viewport(page, name), 'scrollbar-width'), await nativeScrollbarWidth(page), name)
      assert.equal(
        await computed(example(page, name).locator('[data-slot="scroll-area-scrollbar"]'), 'display'),
        'none',
        name,
      )
    }
    await page.getByRole('region', { name: 'Tags' }).focus()
    await page.keyboard.press('End')
    await until(
      page,
      async () => (await viewport(page, 'scroll-area-vertical').evaluate((v) => v.scrollTop)) > 0,
      'the keyboard scrolls without JavaScript',
    )
  })

  it('hydrates with the layouts the server rendered and turns on the handles and scrollbars, without errors', async (t) => {
    let page = await open(t)

    assert.deepEqual(await panelSizes(page, 'resizable-horizontal'), [25, 75])
    assert.deepEqual(await panelSizes(page, 'resizable-nested'), [50, 50, 25, 75])
    assert.equal(await page.locator('[data-slot="resizable-handle"]:not([tabindex="0"])').count(), 0)
    for (let name of scrollAreas) {
      assert.equal(
        await example(page, name).locator('[data-slot="scroll-area"]').first().getAttribute('data-scrollbars'),
        'custom',
        name,
      )
      assert.equal(await computed(viewport(page, name), 'scrollbar-width'), 'none', name)
    }
    assert.deepEqual(page.errors, [])
  })

  it('passes the axe-core WCAG checks before and after hydration, in both themes', async (t) => {
    let server = await open(t, { javaScript: false })
    assert.deepEqual(await findAccessibilityViolations(server), [])

    let page = await open(t)
    assert.deepEqual(await findAccessibilityViolations(page), [])
    await page.emulateMedia({ colorScheme: 'dark' })
    assert.deepEqual(await findAccessibilityViolations(page), [])
  })

  it('resizes with a mouse drag that may leave the handle, and leaves the other groups alone', async (t) => {
    let page = await open(t)
    let separator = handles(page, 'resizable-horizontal').first()
    let start = await center(separator)
    let group = await example(page, 'resizable-horizontal').locator('[data-slot="resizable-panel-group"]').boundingBox()
    assert.ok(group)

    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x + group.width * 0.1, start.y + 80, { steps: 4 })
    assert.equal(await separator.getAttribute('aria-valuenow'), '35')
    // Past the group, the drag goes on: the content panel has no minimum, so it closes.
    // The pointer stays in the window: Playwright's Firefox sends moves outside it at 0, 0.
    await page.mouse.move(group.x + group.width + 100, start.y + 150, { steps: 4 })
    await page.mouse.up()

    assert.equal(await separator.getAttribute('aria-valuenow'), '100')
    assert.deepEqual(await panelSizes(page, 'resizable-with-handle'), [25, 75])
    assert.deepEqual(page.errors, [])
  })

  it('resizes with a touch drag on the handle', async (t) => {
    let page = await open(t)
    let separator = handles(page, 'resizable-with-handle').first()
    let start = await center(separator)
    let group = await example(page, 'resizable-with-handle')
      .locator('[data-slot="resizable-panel-group"]')
      .boundingBox()
    assert.ok(group)
    assert.equal(await computed(separator, 'touch-action'), 'none')

    let end = start.x + group.width * 0.2
    if (engine(page) === 'chromium') {
      // Real touch input, which Playwright drives only through Chromium's CDP.
      let cdp = await page.context().newCDPSession(page)
      let touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number) =>
        cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: start.y }] })
      await touch('touchStart', start.x)
      for (let step = 1; step <= 4; step++) await touch('touchMove', start.x + (group.width * 0.2 * step) / 4)
      await touch('touchEnd', end)
    } else {
      // Elsewhere, the touch pointer events a finger sends.
      await separator.evaluate(
        (element, { x, y, end }) => {
          let send = (target: EventTarget, type: string, clientX: number) =>
            target.dispatchEvent(
              new PointerEvent(type, {
                pointerId: 2,
                pointerType: 'touch',
                isPrimary: true,
                buttons: type === 'pointerup' ? 0 : 1,
                clientX,
                clientY: y,
                bubbles: true,
                cancelable: true,
              }),
            )
          send(element, 'pointerdown', x)
          for (let step = 1; step <= 4; step++) send(document, 'pointermove', x + ((end - x) * step) / 4)
          send(document, 'pointerup', end)
        },
        { x: start.x, y: start.y, end },
      )
    }

    await until(
      page,
      async () => (await separator.getAttribute('aria-valuenow')) === '45',
      'the touch drag moves the handle',
    )
  })

  it('resizes from the keyboard, and the controlled example follows', async (t) => {
    let page = await open(t)

    await page.getByRole('heading', { name: 'Controlled' }).click()
    await page.keyboard.press('Tab')
    let separator = handles(page, 'resizable-controlled').first()
    assert.equal(await separator.evaluate((element) => element === document.activeElement), true)
    assert.equal(await separator.getAttribute('aria-label'), 'Resize the left panel')

    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    assert.equal(await example(page, 'resizable-controlled').getByText('40%').count(), 1)
    assert.equal(await example(page, 'resizable-controlled').getByText('60%').count(), 1)
    await page.keyboard.press('Home')
    assert.equal(await separator.getAttribute('aria-valuenow'), '20')
  })

  it('hides and shows the folders with the button, Enter on the handle, and a drag', async (t) => {
    let page = await open(t)
    let collapsible = example(page, 'resizable-collapsible')
    let folders = collapsible.locator('#mail-folders')
    let separator = handles(page, 'resizable-collapsible').first()

    await page.getByRole('button', { name: 'Hide folders' }).click()
    assert.equal(await folders.getAttribute('data-collapsed'), '')
    assert.equal(await folders.evaluate((element) => (element as HTMLElement).inert), true)
    assert.equal(await page.getByRole('button', { name: 'Show folders' }).getAttribute('aria-expanded'), 'false')

    await separator.focus()
    await page.keyboard.press('Enter')
    assert.equal(await folders.getAttribute('data-collapsed'), null)
    assert.equal(await separator.getAttribute('aria-valuenow'), '30')
    assert.equal(await page.getByRole('link', { name: 'Inbox' }).isVisible(), true)

    let start = await center(separator)
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x - 400, start.y, { steps: 4 })
    await page.mouse.up()
    assert.equal(await folders.getAttribute('data-collapsed'), '')
    assert.equal(await page.getByRole('button', { name: 'Show folders' }).count(), 1)
  })

  it('mirrors the arrow keys and puts the scrollbar on the left in right-to-left text', async (t) => {
    let page = await open(t)
    let separator = handles(page, 'rtl-resizable').first()

    await separator.focus()
    await page.keyboard.press('ArrowLeft')
    assert.equal(await separator.getAttribute('aria-valuenow'), '35')

    let area = viewport(page, 'rtl-scroll-area')
    let bar = example(page, 'rtl-scroll-area').locator('[data-slot="scroll-area-scrollbar"]').first()
    let [areaBox, barBox] = [await area.boundingBox(), await bar.boundingBox()]
    assert.ok(areaBox && barBox)
    assert.ok(barBox.x - areaBox.x < 2, 'the vertical scrollbar sits on the inline end, the left')
  })

  it('scrolls with the wheel', async (t) => {
    let page = await open(t)
    let tags = viewport(page, 'scroll-area-vertical')
    await tags.scrollIntoViewIfNeeded()
    let point = await center(tags)

    await page.mouse.move(point.x, point.y)
    await page.mouse.wheel(0, 200)
    await until(
      page,
      async () => (await tags.evaluate((element) => element.scrollTop)) > 0,
      'the wheel scrolls the viewport',
    )
  })

  // A page of its own: Firefox keeps a wheel on the element it last scrolled
  // for a moment, so a wheel right after another wouldn't reach the page.
  it('lets the page scroll on at the edge of a scroll area', async (t) => {
    let page = await open(t)
    let tags = viewport(page, 'scroll-area-vertical')
    await tags.scrollIntoViewIfNeeded()
    let point = await center(tags)
    let top = () => tags.evaluate((element) => element.scrollTop)
    let max = await tags.evaluate((element) => element.scrollHeight - element.clientHeight)

    await tags.evaluate((element) => (element.scrollTop = element.scrollHeight))
    await page.mouse.move(point.x, point.y)
    let pageBefore = await page.evaluate(() => window.scrollY)
    await page.mouse.wheel(0, 200)
    await until(
      page,
      async () => (await page.evaluate(() => window.scrollY)) > pageBefore,
      'the page scrolls at the edge',
    )
    assert.equal(await top(), max)
  })

  it('scrolls with touch, the keyboard, and focus moving into view', async (t) => {
    let page = await open(t)
    let tags = viewport(page, 'scroll-area-vertical')
    await tags.scrollIntoViewIfNeeded()
    let point = await center(tags)

    // A finger moving up the list scrolls it, and not the page. Playwright
    // drives real touch only through Chromium's CDP; the viewport is a native
    // scroller, so the other engines scroll it themselves.
    if (engine(page) === 'chromium') {
      let cdp = await page.context().newCDPSession(page)
      let pageTop = await page.evaluate(() => window.scrollY)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
      for (let step = 1; step <= 8; step++) {
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: point.x, y: point.y - step * 15 }],
        })
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await until(
        page,
        async () => (await tags.evaluate((element) => element.scrollTop)) > 0,
        'touch scrolls the viewport',
      )
      assert.equal(await page.evaluate(() => window.scrollY), pageTop)
    }

    await page.getByRole('region', { name: 'Tags' }).focus()
    await page.keyboard.press('End')
    await until(
      page,
      () => tags.evaluate((element) => element.scrollTop >= element.scrollHeight - element.clientHeight - 1),
      'End scrolls to the bottom',
    )

    let invoices = viewport(page, 'scroll-area-both')
    await page.getByRole('link', { name: 'INV-2026-015' }).focus()
    await until(
      page,
      async () => (await invoices.evaluate((element) => element.scrollTop)) > 0,
      'focus scrolls the link into view',
    )
    let thumb = example(page, 'scroll-area-both').locator(
      '[data-orientation="vertical"] [data-slot="scroll-area-thumb"]',
    )
    await until(
      page,
      async () =>
        Number.parseFloat(
          await thumb.evaluate((element) =>
            (element as HTMLElement).style.getPropertyValue('--scroll-area-thumb-offset'),
          ),
        ) > 0,
      'the thumb follows',
    )
  })

  it('drags a scrollbar thumb with the mouse', async (t) => {
    let page = await open(t)
    let tags = viewport(page, 'scroll-area-vertical')
    await tags.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    let thumb = example(page, 'scroll-area-vertical').locator('[data-slot="scroll-area-thumb"]')
    let track = await example(page, 'scroll-area-vertical').locator('[data-slot="scroll-area-scrollbar"]').boundingBox()
    assert.ok(track)
    let start = await center(thumb)

    // Past the end of the track, but inside the window, where Playwright's Firefox reports moves.
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x + 40, track.y + track.height + 40, { steps: 5 })
    await page.mouse.up()

    assert.equal(
      await tags.evaluate((element) => element.scrollTop === element.scrollHeight - element.clientHeight),
      true,
    )
    assert.equal(await tags.evaluate((element) => element === document.activeElement), false)
  })

  it('gives the scrollbars back to the system and keeps every line in forced colors', async (t) => {
    let page = await open(t)
    await page.emulateMedia({ forcedColors: 'active' })

    for (let name of scrollAreas) {
      assert.equal(await computed(viewport(page, name), 'scrollbar-width'), await nativeScrollbarWidth(page), name)
      assert.equal(
        await computed(example(page, name).locator('[data-slot="scroll-area-scrollbar"]'), 'display'),
        'none',
        name,
      )
    }
    let separator = handles(page, 'resizable-with-handle').first()
    assert.notEqual(await computed(separator, 'border-inline-start-color'), 'rgba(0, 0, 0, 0)')
    assert.equal(await computed(separator, 'border-inline-start-width'), '1px')
    let grip = example(page, 'resizable-with-handle').locator('[data-slot="resizable-handle-icon"]')
    assert.notEqual(await computed(grip, 'border-top-color'), 'rgba(0, 0, 0, 0)')
  })

  it('draws the handle line at 3:1 in both themes and shows a focus ring', async (t) => {
    let page = await open(t)
    let separator = handles(page, 'resizable-horizontal').first()

    assert.equal(await computed(separator, 'border-inline-start-color'), 'oklch(0.62 0 0)')
    await page.emulateMedia({ colorScheme: 'dark' })
    assert.equal(await computed(separator, 'border-inline-start-color'), 'oklch(0.556 0 0)')

    await page.getByRole('heading', { name: 'Horizontal' }).first().click()
    await page.keyboard.press('Tab')
    assert.equal(await computed(separator, 'outline-style'), 'solid')
    assert.equal(await computed(separator, 'outline-width'), '2px')
  })

  it('animates only with the motion tokens', async (t) => {
    let reduced = await open(t)
    assert.equal(await computed(handles(reduced, 'resizable-horizontal'), 'transition-duration'), '0s')

    let moving = await open(t, { reducedMotion: 'no-preference' })
    assert.equal(await computed(handles(moving, 'resizable-horizontal'), 'transition-duration'), '0.1s')
    assert.equal(
      await computed(
        example(moving, 'scroll-area-vertical').locator('[data-slot="scroll-area-thumb"]'),
        'transition-duration',
      ),
      '0.1s',
    )
  })

  it('fits 320px without scrolling sideways, also with text at 200%', async (t) => {
    let page = await open(t, { width: 320 })
    let overflow = () =>
      page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

    assert.equal(await overflow(), 0)
    await page.locator('html').evaluate((html) => (html.style.fontSize = '32px'))
    await page.waitForTimeout(50)
    assert.equal(await overflow(), 0)
    assert.deepEqual(await panelSizes(page, 'resizable-horizontal'), [25, 75])
  })
})
