import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { findAccessibilityViolations } from './accessibility.ts'
import { createDrawerExamples } from './fixtures/drawer/server.tsx'

// Pages open with reduced motion, so transitions take 0s and every read sees
// the final style. The motion test opts back in.
async function open(
  t: TestContext,
  { reducedMotion = 'reduce' as 'reduce' | 'no-preference', path = '/', hydrate = true } = {},
) {
  let examples = await createDrawerExamples()
  t.after(() => void examples.close())

  let server = await createTestServer(examples.fetch)
  let page = await t.serve(server)
  await page.emulateMedia({ colorScheme: 'light', reducedMotion })
  await page.goto(path)
  if (hydrate) await page.locator('html[data-ready]').waitFor({ state: 'attached' })
  return { page, server }
}

type Page = Awaited<ReturnType<typeof open>>['page']

/** The example titled `title` in a section of the page. */
function example(page: Page, title: string, section = 'drawer') {
  return page.locator(`section[aria-labelledby="${section}"] [data-example="${title}"]`)
}

const openDrawer = (page: Page) => page.locator('dialog[open]').last()

/** Whether the engine runs invoker commands (commandfor and command), which open and close dialogs without a script. */
function hasInvokerCommands(page: Page) {
  return page.evaluate(() => 'command' in HTMLButtonElement.prototype)
}

/** Opens the drawer of the trigger named `name` in an example, and waits until it took focus. */
async function openFrom(page: Page, title: string, name: string, { keyboard = false, section = 'drawer' } = {}) {
  let trigger = example(page, title, section).getByRole('button', { name, exact: true })
  if (keyboard) {
    await trigger.focus()
    await page.keyboard.press('Enter')
  } else {
    await trigger.click()
  }
  await page.waitForFunction(() => document.activeElement?.closest('dialog[open]'))
  return trigger
}

async function closed(page: Page) {
  await page.waitForFunction(() => document.querySelectorAll('dialog[open]').length === 0)
}

/** The open drawer's translation along its axis, in px. */
function translation(page: Page) {
  return openDrawer(page).evaluate((dialog) => {
    let [x = '0px', y = '0px'] = getComputedStyle(dialog).translate.split(' ')
    let value = dialog.dataset.swipeAxis === 'x' ? x : y
    return value === 'none' ? 0 : Number.parseFloat(value)
  })
}

async function center(page: Page, selector: string) {
  let box = await openDrawer(page).locator(selector).first().boundingBox()
  assert.ok(box, `${selector} is on the screen`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/**
 * A real mouse drag, in steps 16ms apart, as a person makes it. Without the
 * pauses, an engine may send the moves at once, which reads as a fast flick.
 */
async function mouseDrag(page: Page, from: { x: number; y: number }, dx: number, dy: number, steps = 20) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  for (let step = 1; step <= steps; step++) {
    await page.mouse.move(from.x + (dx * step) / steps, from.y + (dy * step) / steps)
    await page.waitForTimeout(16)
  }
  await page.mouse.up()
}

const isChromium = (page: Page) => page.context().browser()?.browserType().name() === 'chromium'

/** A real touch drag through Chromium's input pipeline, so touch-action and native scrolling apply. */
async function touchDrag(page: Page, from: { x: number; y: number }, dx: number, dy: number, steps = 12) {
  let cdp = await page.context().newCDPSession(page)
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] })
    for (let step = 1; step <= steps; step++) {
      let point = { x: from.x + (dx * step) / steps, y: from.y + (dy * step) / steps }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] })
      await page.waitForTimeout(16)
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  } finally {
    await cdp.detach()
  }
}

describe('Drawer examples', () => {
  it('follow a mouse drag of the swipe handle, slide back after a short one, and close after a long one', async (t) => {
    let { page } = await open(t)
    let trigger = await openFrom(page, 'Swipe handle', 'Down')
    let handle = await center(page, '[data-slot="drawer-swipe-handle"]')

    await mouseDrag(page, handle, 0, 40, 40)
    await page.waitForTimeout(100)
    assert.equal(await page.locator('dialog[open]').count(), 1, 'a short, slow drag keeps it open')
    assert.equal(await translation(page), 0)

    let height = await openDrawer(page).evaluate((dialog) => (dialog as HTMLElement).offsetHeight)
    await mouseDrag(page, handle, 0, height * 0.7)
    await closed(page)
    await page.waitForFunction(() => document.activeElement?.textContent === 'Down')
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false')
  })

  it('close on each edge when dragged toward it', async (t) => {
    let { page } = await open(t)
    for (let [name, dx, dy] of [
      ['Up', 0, -1],
      ['Right', 1, 0],
      ['Left', -1, 0],
    ] as const) {
      await openFrom(page, 'Swipe handle', name)
      let handle = await center(page, '[data-slot="drawer-swipe-handle"]')
      let size = await openDrawer(page).evaluate((dialog) => [
        (dialog as HTMLElement).offsetWidth,
        (dialog as HTMLElement).offsetHeight,
      ])
      await mouseDrag(page, handle, dx * size[0] * 0.7, dy * size[1] * 0.7)
      await closed(page)
    }
  })

  it('follow a touch from the header, and leave a scroll region to the browser until it reaches its top', async (t) => {
    let { page } = await open(t)
    if (!isChromium(page)) return // Touch input runs through Chromium's DevTools protocol only.

    await openFrom(page, 'Scrollable content', 'Down')
    let region = openDrawer(page).getByRole('region', { name: 'History' })
    let inRegion = await center(page, '[role="region"]')

    await touchDrag(page, inRegion, 0, -120)
    await page.waitForTimeout(100)
    let scrolled = await region.evaluate((element) => element.scrollTop)
    assert.ok(scrolled > 40, `the region scrolled: ${scrolled}`)
    assert.equal(await page.locator('dialog[open]').count(), 1)
    assert.equal(await translation(page), 0, 'the drawer stayed')

    await touchDrag(page, inRegion, 0, 40)
    await page.waitForTimeout(100)
    assert.ok((await region.evaluate((element) => element.scrollTop)) < scrolled, 'a swipe down scrolls back first')
    assert.equal(await page.locator('dialog[open]').count(), 1)

    await region.evaluate((element) => (element.scrollTop = 0))
    await page.waitForTimeout(100)
    // DevTools touches arrive slowly, so each swipe goes past half the drawer to close it.
    let height = await openDrawer(page).evaluate((dialog) => (dialog as HTMLElement).offsetHeight)
    let directional = await page.evaluate(() => CSS.supports('touch-action', 'pan-down'))
    if (directional) {
      let top = await region.boundingBox()
      await touchDrag(page, { x: inRegion.x, y: top!.y + 20 }, 0, height * 0.7)
      await closed(page)
    } else {
      await page.keyboard.press('Escape')
    }

    await openFrom(page, 'Scrollable content', 'Down')
    await touchDrag(page, await center(page, '[data-slot="drawer-header"]'), 0, height * 0.7)
    await closed(page)
  })

  it('scroll a list by touch at the peek after the full height, where it fit', async (t) => {
    let { page } = await open(t)
    if (!isChromium(page)) return // Touch input runs through Chromium's DevTools protocol only.
    // Tall enough that all 16 invoices fit at the full height.
    await page.setViewportSize({ width: 1280, height: 1500 })
    await openFrom(page, 'Snap points', 'Open invoices')
    let drawer = openDrawer(page)
    let list = drawer.getByRole('list')
    let fits = () => list.evaluate((element) => element.scrollHeight <= element.clientHeight)

    await drawer.getByRole('button', { name: 'Full height' }).click()
    await page.waitForFunction(() => document.querySelector('dialog[open]')?.hasAttribute('data-expanded'))
    assert.equal(await fits(), true, 'the list fits at the full height')
    // A resize, such as turning the phone, has the drawer look at its scroll regions at this height.
    await page.setViewportSize({ width: 1280, height: 1480 })
    await page.waitForTimeout(100)
    assert.equal(await list.evaluate((element) => element.style.touchAction), 'pan-x pinch-zoom')

    await drawer.getByRole('button', { name: 'Peek' }).click()
    await page.waitForFunction(() => !document.querySelector('dialog[open]')?.hasAttribute('data-expanded'))
    assert.equal(await fits(), false, 'the list overflows at the peek')

    let box = await list.boundingBox()
    await touchDrag(page, { x: box!.x + box!.width / 2, y: box!.y + box!.height - 20 }, 0, -120)
    await page.waitForTimeout(100)
    let scrolled = await list.evaluate((element) => element.scrollTop)
    assert.ok(scrolled > 40, `a swipe up scrolls the list: ${scrolled}`)
    assert.equal(await page.locator('dialog[open]').count(), 1)
  })

  it('move between snap points with the keyboard, and keep every item reachable at the peek', async (t) => {
    let { page } = await open(t)
    let trigger = await openFrom(page, 'Snap points', 'Open invoices', { keyboard: true })
    let drawer = openDrawer(page)
    assert.equal(await page.evaluate(() => document.activeElement?.localName), 'dialog', 'it focuses itself at once')
    let shown = () => drawer.evaluate((dialog) => Math.round(innerHeight - dialog.getBoundingClientRect().top))
    assert.equal(await shown(), 320, 'it opens at the 20rem peek')

    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    let full = drawer.getByRole('button', { name: 'Full height' })
    assert.equal(await full.evaluate((element) => element === document.activeElement), true)
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => document.querySelector('dialog[open]')?.hasAttribute('data-expanded'))
    assert.equal(await full.getAttribute('aria-pressed'), 'true')
    assert.ok((await shown()) > 320)

    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Space')
    await page.waitForFunction(() => !document.querySelector('dialog[open]')?.hasAttribute('data-expanded'))
    assert.equal(await shown(), 320)

    let last = drawer.getByRole('link', { name: 'INV-0058' })
    await last.focus()
    let bottom = await last.evaluate((element) => element.getBoundingClientRect().bottom)
    assert.ok(bottom <= (await page.evaluate(() => innerHeight)), `the last invoice shows at the peek: ${bottom}`)

    await page.keyboard.press('Escape')
    await closed(page)
    assert.equal(await trigger.evaluate((element) => element === document.activeElement), true)
  })

  it('settle on the snap point a mouse drag ends closest to', async (t) => {
    let { page } = await open(t)
    await openFrom(page, 'Snap points', 'Open invoices')
    let offset = await translation(page)
    assert.ok(offset > 100, `it starts at the peek: ${offset}`)

    await mouseDrag(page, await center(page, '[data-slot="drawer-swipe-handle"]'), 0, -offset * 0.8, 40)
    await page.waitForFunction(() => document.querySelector('dialog[open]')?.hasAttribute('data-expanded'))
    assert.ok(Math.abs(await translation(page)) < 1)

    await mouseDrag(page, await center(page, '[data-slot="drawer-swipe-handle"]'), 0, offset * 0.8, 40)
    await page.waitForFunction(() => !document.querySelector('dialog[open]')?.hasAttribute('data-expanded'))
    assert.ok(Math.abs((await translation(page)) - offset) < 1)
  })

  it('submit the fields of a drawer with the form around it', async (t) => {
    let { page } = await open(t)
    await openFrom(page, 'With form', 'Edit customer')
    await openDrawer(page).getByLabel('Name').fill('Acme Labs AG')
    await openDrawer(page).getByRole('button', { name: 'Save changes' }).click()
    await page.locator('[data-echo="fields"]').waitFor()
    assert.deepEqual(await page.locator('[data-echo="fields"] dd').allInnerTexts(), [
      'Acme Labs AG',
      'billing@acme.example',
    ])
  })

  it('open and close natively without JavaScript, with Escape and the close buttons, and still submit', async (t) => {
    let { page, server } = await open(t, { hydrate: false })
    let context = await page.context().browser()!.newContext({ javaScriptEnabled: false, baseURL: server.baseUrl })
    t.after(() => context.close())
    let static_ = await context.newPage()
    await static_.emulateMedia({ reducedMotion: 'reduce' })
    await static_.goto('/')
    assert.equal(await static_.locator('dialog[open]').count(), 0)

    let trigger = example(static_, 'With form').getByRole('button', { name: 'Edit customer' })
    await trigger.click()
    if (!(await hasInvokerCommands(page))) {
      // Without invoker commands, the trigger waits for the script, and nothing hidden becomes reachable.
      assert.equal(await static_.locator('dialog[open]').count(), 0)
      return
    }
    let drawer = openDrawer(static_)
    assert.equal(await drawer.evaluate((dialog) => dialog.matches(':modal')), true)
    let edge = await drawer.evaluate((dialog) => Math.round(innerHeight - dialog.getBoundingClientRect().bottom))
    assert.equal(edge, 0, 'it sits on the bottom edge')
    await static_.keyboard.press('Escape')
    assert.equal(await static_.locator('dialog[open]').count(), 0)

    await trigger.click()
    await openDrawer(static_).getByRole('button', { name: 'Cancel' }).click()
    assert.equal(await static_.locator('dialog[open]').count(), 0)

    await trigger.click()
    await openDrawer(static_).getByRole('button', { name: 'Save changes' }).click()
    await static_.locator('[data-echo="fields"]').waitFor()
    assert.deepEqual(await static_.locator('[data-echo="fields"] dt').allInnerTexts(), ['name', 'email'])
  })

  it('keep snap buttons disabled until the drawer runs', async (t) => {
    let { page, server } = await open(t, { hydrate: false })
    let context = await page.context().browser()!.newContext({ javaScriptEnabled: false, baseURL: server.baseUrl })
    t.after(() => context.close())
    let static_ = await context.newPage()
    await static_.goto('/')
    let buttons = example(static_, 'Snap points').locator('[data-slot="drawer-snap-point-button"]')
    assert.deepEqual(await buttons.evaluateAll((all) => all.map((button) => (button as HTMLButtonElement).disabled)), [
      true,
      true,
    ])

    await page.locator('html[data-ready]').waitFor({ state: 'attached' })
    let live = example(page, 'Snap points').locator('[data-slot="drawer-snap-point-button"]')
    assert.deepEqual(await live.evaluateAll((all) => all.map((button) => (button as HTMLButtonElement).disabled)), [
      false,
      false,
    ])
  })

  it('run natively when the page renders them outside a client entry', async (t) => {
    let { page } = await open(t)
    await example(page, 'Server only').getByRole('button', { name: 'Open native drawer' }).click()
    if (!(await hasInvokerCommands(page))) return assert.equal(await page.locator('dialog[open]').count(), 0)
    assert.equal(await openDrawer(page).evaluate((dialog) => dialog.matches(':modal')), true)
    await openDrawer(page).getByRole('button', { name: 'Close' }).click()
    assert.equal(await page.locator('dialog[open]').count(), 0)
  })

  it('read a drawer that starts open before any script runs, and make it modal once hydrated', async (t) => {
    let { page, server } = await open(t, { path: '/starts-open' })
    let context = await page.context().browser()!.newContext({ javaScriptEnabled: false, baseURL: server.baseUrl })
    t.after(() => context.close())
    let static_ = await context.newPage()
    await static_.goto('/starts-open')
    assert.equal(await static_.getByRole('heading', { name: 'New payment terms' }).isVisible(), true)
    assert.equal(await openDrawer(static_).evaluate((dialog) => dialog.matches(':modal')), false)

    assert.equal(await openDrawer(page).evaluate((dialog) => dialog.matches(':modal')), true)
    await page.waitForFunction(() => document.activeElement?.localName === 'dialog')
    await page.keyboard.press('Escape')
    await closed(page)
    await page.waitForFunction(() => document.activeElement?.textContent === 'Show notice')
  })

  it('work beside the page when not modal, and stay open on presses outside', async (t) => {
    let { page } = await open(t)
    await openFrom(page, 'Not modal', 'Not modal')
    assert.equal(await openDrawer(page).evaluate((dialog) => dialog.matches(':modal')), false)

    await page.getByRole('heading', { name: 'Drawer', level: 1 }).click()
    assert.equal(await page.locator('dialog[open]').count(), 1)
    await example(page, 'With form').getByRole('button', { name: 'Edit customer' }).focus()
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Edit customer')
  })

  it('report why a controlled drawer and its snap point changed', async (t) => {
    let { page } = await open(t)
    let status = example(page, 'Controlled').locator('[data-reason]')
    await openFrom(page, 'Controlled', 'Open controlled drawer')
    assert.equal(await status.getAttribute('data-reason'), 'trigger-press')

    await openDrawer(page).getByRole('button', { name: 'Full height' }).click()
    assert.deepEqual(
      [await status.getAttribute('data-reason'), await status.getAttribute('data-snap-point')],
      ['snap-point-press', '1'],
    )

    await page.keyboard.press('Escape')
    await closed(page)
    assert.deepEqual(
      [await status.getAttribute('data-reason'), await status.getAttribute('data-snap-point')],
      ['escape-key', '20rem'],
    )
  })

  it('show a dialog on a wide screen and a drawer on a narrow one in the responsive example', async (t) => {
    let { page } = await open(t)
    await openFrom(page, 'Responsive', 'Edit contact')
    assert.equal(await openDrawer(page).getAttribute('data-slot'), 'dialog-content')
    await page.keyboard.press('Escape')
    await closed(page)

    await page.setViewportSize({ width: 390, height: 720 })
    await page.waitForFunction(() => !matchMedia('(min-width: 48rem)').matches)
    await openFrom(page, 'Responsive', 'Edit contact')
    assert.equal(await openDrawer(page).getAttribute('data-slot'), 'drawer-popup')
  })

  it('stack nested drawers behind the frontmost, and close only the frontmost on Escape', async (t) => {
    let { page } = await open(t)
    await openFrom(page, 'Nested', 'Down')
    await openDrawer(page).getByRole('button', { name: 'Open payment' }).click()
    await openDrawer(page).getByRole('button', { name: 'Open transfer' }).waitFor()
    await openDrawer(page).getByRole('button', { name: 'Open transfer' }).click()
    await page.waitForFunction(() => document.querySelectorAll('dialog[open]').length === 3)

    let stack = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].map((dialog) => ({
        nested: dialog.style.getPropertyValue('--nested-drawers'),
        scale: Number.parseFloat(getComputedStyle(dialog).scale) || 1,
        top: Math.round(dialog.getBoundingClientRect().top),
      })),
    )
    assert.deepEqual(
      stack.map((drawer) => drawer.nested),
      ['2', '1', ''],
    )
    assert.ok(stack[0].scale < stack[1].scale && stack[1].scale < stack[2].scale, JSON.stringify(stack))
    assert.ok(
      stack[0].top < stack[1].top && stack[1].top < stack[2].top,
      `each one peeks out: ${JSON.stringify(stack)}`,
    )

    await page.keyboard.press('Escape')
    await page.waitForFunction(() => document.querySelectorAll('dialog[open]').length === 2)
    assert.equal(await openDrawer(page).getByRole('heading').innerText(), 'Payment of CHF 600.00')
  })
})

describe('Drawer styles', () => {
  it('pass axe-core while open, in both themes', async (t) => {
    let { page } = await open(t)

    for (let colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      for (let [title, name] of [
        ['Demo', 'Pay invoice'],
        ['Snap points', 'Open invoices'],
        ['Swipe handle', 'Right'],
        ['Scrollable content', 'Up'],
        ['Demo', 'Footer'],
      ] as const) {
        await openFrom(page, title, name)
        assert.deepEqual(await findAccessibilityViolations(page), [], `${colorScheme}: ${title} › ${name}`)
        await page.keyboard.press('Escape')
        await closed(page)
      }
    }
  })

  it('show the focus ring and the drawer edge, also in forced colors', async (t) => {
    let { page } = await open(t)
    await openFrom(page, 'Swipe handle', 'Down', { keyboard: true })
    let close = openDrawer(page).getByRole('button', { name: 'Close' })
    await close.focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')

    for (let forcedColors of ['none', 'active'] as const) {
      await page.emulateMedia({ forcedColors })
      assert.deepEqual(
        await close.evaluate((element) => [
          getComputedStyle(element).outlineStyle,
          getComputedStyle(element).outlineWidth,
        ]),
        ['solid', '2px'],
      )
      let edges = await openDrawer(page).evaluate((dialog) => {
        let probe = document.createElement('div')
        probe.style.color = 'CanvasText'
        document.body.append(probe)
        let canvasText = getComputedStyle(probe).color
        probe.remove()
        let pill = getComputedStyle(dialog.querySelector('[data-slot="drawer-swipe-handle"]')!, '::after')
        return {
          border: getComputedStyle(dialog).borderTopStyle,
          pill: pill.borderTopWidth !== '0px' && pill.borderTopStyle === 'solid',
          pillIsCanvasText: pill.borderTopColor === canvasText,
        }
      })
      assert.equal(edges.border, 'solid')
      assert.equal(edges.pill, true)
      if (forcedColors === 'active') assert.equal(edges.pillIsCanvasText, true, 'the handle shows in forced colors')
    }
  })

  it('slide with the motion tokens, and not at all for reduced motion', async (t) => {
    let { page } = await open(t, { reducedMotion: 'no-preference' })
    await openFrom(page, 'Demo', 'Pay invoice')
    let durations = () => openDrawer(page).evaluate((dialog) => getComputedStyle(dialog).transitionDuration)

    assert.ok(
      (await durations()).split(', ').every((duration) => duration === '0.4s'),
      await durations(),
    )
    await page.emulateMedia({ reducedMotion: 'reduce' })
    assert.ok(
      (await durations()).split(', ').every((duration) => duration === '0s'),
      await durations(),
    )
  })

  it('keep a right drawer on the right and align the text to the right in right-to-left text', async (t) => {
    let { page } = await open(t)
    await openFrom(page, 'درج', 'Right', { section: 'direction' })
    let { right, width, title } = await openDrawer(page).evaluate((dialog) => ({
      right: Math.round(innerWidth - dialog.getBoundingClientRect().right),
      width: innerWidth,
      title: getComputedStyle(dialog.querySelector('[data-slot="drawer-title"]')!).textAlign,
    }))
    assert.equal(right, 0, `the drawer sits on the right edge of ${width}px`)
    assert.equal(title, 'start')
  })

  it('reflow to a 320px wide viewport without scrolling sideways, also with text at 200%', async (t) => {
    let { page } = await open(t)
    await page.setViewportSize({ width: 320, height: 640 })

    for (let fontSize of ['', '32px']) {
      await page.evaluate((size) => (document.documentElement.style.fontSize = size), fontSize)
      for (let [title, name] of [
        ['Demo', 'Pay invoice'],
        ['Sides', 'Left'],
        ['Snap points', 'Open invoices'],
        ['With form', 'Edit customer'],
      ] as const) {
        await openFrom(page, title, name)
        let overflow = await openDrawer(page).evaluate((dialog) => {
          let content = dialog.querySelector<HTMLElement>('[data-slot="drawer-content"]')!
          return {
            page: document.documentElement.scrollWidth,
            content: content.scrollWidth - content.clientWidth,
            left: Math.round(dialog.getBoundingClientRect().left),
            right: Math.round(dialog.getBoundingClientRect().right),
          }
        })
        let label = `${title} at ${fontSize || 'default'}: ${JSON.stringify(overflow)}`
        assert.equal(overflow.page, 320, label)
        assert.ok(overflow.content <= 0 && overflow.left >= 0 && overflow.right <= 320, label)
        await page.keyboard.press('Escape')
        await closed(page)
      }
    }
  })
})
