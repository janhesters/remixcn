import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { findAccessibilityViolations } from './accessibility.ts'
import { createCarouselExamples } from './fixtures/carousel/server.tsx'

// Pages open with reduced motion, so the carousel jumps instead of scrolling
// smoothly and every read sees the final position. Tests about motion opt back in.
// A paused clock runs the page's timers only in runFor, however long the steps before it take.
async function open(
  t: TestContext,
  { reducedMotion = 'reduce' as 'reduce' | 'no-preference', clock = false as boolean | 'paused', hydrate = true } = {},
) {
  let examples = await createCarouselExamples()
  t.after(() => void examples.close())

  let server = await createTestServer(examples.fetch)
  let page = await t.serve(server)
  let errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.emulateMedia({ colorScheme: 'light', reducedMotion })
  if (clock) await page.clock.install()
  if (clock === 'paused') await page.clock.pauseAt(Date.now() + 1000)
  await page.goto('/')
  if (hydrate) await page.locator('html[data-ready]').waitFor({ state: 'attached' })
  return { page, server, errors }
}

type Page = Awaited<ReturnType<typeof open>>['page']

function example(page: Page, title: string) {
  return page.locator(`[data-example="${title}"]`).first()
}

function carouselIn(page: Page, title: string) {
  return example(page, title).locator('[data-slot="carousel"]').first()
}

function engine(page: Page) {
  return page.context().browser()?.browserType().name()
}

/** The index of the first slide of the selected snap. */
async function selected(page: Page, title: string) {
  return carouselIn(page, title)
    .locator(':scope [data-slot="carousel-item"]')
    .evaluateAll((items) => items.findIndex((item) => item.hasAttribute('data-selected')))
}

async function eventually(
  check: () => Promise<boolean>,
  message: string | (() => Promise<string> | string),
  timeout = 5000,
) {
  let start = Date.now()
  while (!(await check())) {
    if (Date.now() - start > timeout) assert.fail(typeof message === 'string' ? message : await message())
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

async function waitForSelected(page: Page, title: string, index: number) {
  await eventually(
    async () => (await selected(page, title)) === index,
    async () => `${title}: slide ${index} never got selected, it is ${await selected(page, title)}`,
  )
}

interface Recording {
  selections: [index: number, reason: string][]
  announcements: string[]
  scrollEnds: number[]
  wheels: number[]
  touches: number[]
}

/**
 * Records what a carousel does from now on: the snaps it selects and why,
 * what its live region says, where its scrolls end, and where each wheel
 * and each move of a finger found it. Each scroll end is recorded after the
 * carousel handled it.
 */
function record(carousel: ReturnType<typeof carouselIn>) {
  return carousel.evaluate((root: HTMLElement & { recording?: Recording }) => {
    let viewport = root.querySelector<HTMLElement>('[data-slot="carousel-content"]')!
    let status = root.querySelector('[data-slot="carousel-status"]')!
    let recording: Recording = { selections: [], announcements: [], scrollEnds: [], wheels: [], touches: [] }
    root.recording = recording
    root.addEventListener('remixcn:carousel-select', (event) => {
      if (event.target === root) recording.selections.push([event.index, event.reason])
    })
    new MutationObserver(() => {
      if (status.textContent) recording.announcements.push(status.textContent)
    }).observe(status, { childList: true, characterData: true, subtree: true })
    viewport.addEventListener('scrollend', () => recording.scrollEnds.push(viewport.scrollLeft))
    viewport.addEventListener('wheel', () => recording.wheels.push(viewport.scrollLeft), { passive: true })
    viewport.addEventListener('touchmove', () => recording.touches.push(viewport.scrollLeft), { passive: true })
  })
}

function recorded(carousel: ReturnType<typeof carouselIn>) {
  return carousel.evaluate((root: HTMLElement & { recording?: Recording }) => root.recording!)
}

/** The distance from one snap to the next in an example: a slide and the 1rem gap after it. */
function slideStep(page: Page, title: string) {
  return example(page, title)
    .locator('[data-slot="carousel-item"]')
    .first()
    .evaluate((element) => element.getBoundingClientRect().width + 16)
}

/** A finger's swipe in three moves, as Chromium's input pipeline delivers it. Only Chromium has it. */
async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  let session = await page.context().newCDPSession(page)
  let touch = (type: 'touchStart' | 'touchMove', share: number) =>
    session.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: [
        { x: Math.round(from.x + (to.x - from.x) * share), y: Math.round(from.y + (to.y - from.y) * share) },
      ],
    })
  await touch('touchStart', 0)
  for (let move = 1; move <= 3; move++) await touch('touchMove', move / 3)
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

/**
 * Makes the Autoplay example's next rotation start as the next wheel reaches
 * the page, with the pointer resting on `target` in the carousel. Opened
 * with a paused clock, the page runs no rotation before.
 *
 * WebKit's smooth scroll lasts about 220ms however far it goes, and
 * Playwright's wheel reaches WebKit 50 to over 230ms after a rotation starts,
 * so a wheel sent after the rotation can miss it. Here the rotation's own
 * timer fires from a capturing wheel listener, before the carousel sees the
 * wheel, and the browser routes the wheel as it would. Starting the rotation
 * from its toggle wins over the hover, so it runs with the pointer inside.
 */
async function rotateOnWheel(page: Page, target: ReturnType<Page['locator']>) {
  let autoplay = carouselIn(page, 'Autoplay')
  await page.evaluate(() => {
    let schedule = window.setTimeout
    let rotation: (() => void) | undefined
    window.setTimeout = ((callback: TimerHandler, delay?: number, ...rest: unknown[]) => {
      if (delay === 2000 && typeof callback === 'function') rotation = callback as () => void
      return schedule(callback, delay, ...rest)
    }) as typeof window.setTimeout
    document.addEventListener('wheel', () => rotation?.(), { capture: true, once: true, passive: true })
  })
  await autoplay.getByRole('button', { name: 'Stop slide rotation' }).click()
  await autoplay.getByRole('button', { name: 'Start slide rotation' }).click()
  // WebKit can scroll the page to press a button, so the target is measured after.
  let box = (await target.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  assert.equal(await autoplay.getAttribute('data-autoplay'), 'running')
}

/** The logical scroll position of an example's first scroll container. */
function scrollStart(page: Page, title: string) {
  return example(page, title)
    .locator('[data-slot="carousel-content"]')
    .first()
    .evaluate((element) =>
      getComputedStyle(element).direction === 'rtl' ? -element.scrollLeft : element.scrollLeft || element.scrollTop,
    )
}

/** Focuses the scroll container with the keyboard, so it shows its focus ring. */
async function focusViewport(page: Page, title: string) {
  let viewport = example(page, title).locator('[data-slot="carousel-content"]').first()
  await viewport.focus()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')
  return viewport
}

/**
 * Presses a carousel button and records each scroll position, and the
 * behavior the carousel asked scrollTo() for, until the scroll has reached
 * the next slide, `step` pixels on, and stayed there for a moment. A busy
 * engine can pause a smooth scroll for longer than any quiet period, so the
 * end is the position, with ten seconds at most.
 */
function pressAndRecord(button: ReturnType<Page['locator']>, step: number) {
  return button.evaluate(async (element: HTMLElement, distance: number) => {
    let viewport = element
      .closest('[data-slot="carousel"]')!
      .querySelector<HTMLElement>('[data-slot="carousel-content"]')!
    let start = viewport.scrollLeft
    let target = start + distance
    let seen: number[] = []
    let behaviors: string[] = []
    let scrollTo = viewport.scrollTo.bind(viewport)
    viewport.scrollTo = ((options: ScrollToOptions) => {
      behaviors.push(options.behavior ?? 'auto')
      scrollTo(options)
    }) as typeof viewport.scrollTo
    let stop = new AbortController()
    let done = new Promise<void>((resolve) => {
      let limit = setTimeout(resolve, 10_000)
      let arrived: ReturnType<typeof setTimeout> | undefined
      viewport.addEventListener(
        'scroll',
        () => {
          seen.push(viewport.scrollLeft)
          clearTimeout(arrived)
          if (Math.abs(viewport.scrollLeft - target) >= 1) return
          arrived = setTimeout(() => {
            clearTimeout(limit)
            resolve()
          }, 300)
        },
        { signal: stop.signal },
      )
    })
    element.click()
    await done
    stop.abort()
    delete (viewport as { scrollTo?: unknown }).scrollTo
    return { start, seen, behaviors }
  }, step)
}

describe('Carousel examples', () => {
  it('hydrate without errors and pass the axe-core WCAG checks before and after, in both themes', async (t) => {
    let { page, server, errors } = await open(t)

    for (let colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      assert.deepEqual(await findAccessibilityViolations(page), [], colorScheme)
    }
    assert.deepEqual(errors, [])
    assert.equal(await page.locator('[data-slot="carousel"]:not([data-ready])').count(), 1, 'only the static one')

    // axe needs JavaScript in the page, so the page's own modules are blocked instead: it never hydrates.
    let context = await page.context().browser()!.newContext()
    t.after(() => context.close())
    let unhydrated = await context.newPage()
    await unhydrated.route(
      (url) => url.pathname.startsWith('/assets/') && !url.pathname.endsWith('.css'),
      (route) => route.abort(),
    )
    await unhydrated.goto(server.baseUrl)
    assert.equal(await unhydrated.locator('[data-slot="carousel"][data-ready]').count(), 0)
    assert.deepEqual(await findAccessibilityViolations(unhydrated), [], 'before hydration')
  })

  it('name the carousel, each slide by its position, and the buttons', async (t) => {
    let { page } = await open(t)
    let basic = carouselIn(page, 'Basic')

    assert.equal(await basic.getAttribute('role'), 'region')
    assert.equal(await basic.getAttribute('aria-roledescription'), 'carousel')
    assert.equal(await basic.getAttribute('aria-label'), 'Numbers')
    assert.deepEqual(
      await basic
        .locator('[data-slot="carousel-item"]')
        .evaluateAll((items) =>
          items.map((item) => [item.getAttribute('role'), item.getAttribute('aria-roledescription'), item.ariaLabel]),
        ),
      [1, 2, 3, 4, 5].map((position) => ['group', 'slide', `${position} of 5`]),
    )
    assert.equal(await basic.getByRole('button', { name: 'Previous slide' }).count(), 1)
    assert.equal(await basic.getByRole('button', { name: 'Next slide' }).count(), 1)
  })

  it('scroll natively without JavaScript, with a scrollbar and disabled buttons', async (t) => {
    let { page, server } = await open(t, { hydrate: false })
    let context = await page.context().browser()!.newContext({ javaScriptEnabled: false, baseURL: server.baseUrl })
    t.after(() => context.close())
    let unhydrated = await context.newPage()
    await unhydrated.goto('/')

    let basic = carouselIn(unhydrated, 'Basic')
    assert.equal(await basic.getByRole('button', { name: 'Next slide' }).isDisabled(), true)
    let viewport = basic.locator('[data-slot="carousel-content"]')
    assert.deepEqual(
      await viewport.evaluate((element) => [
        getComputedStyle(element).overflowX,
        getComputedStyle(element).scrollbarWidth === getComputedStyle(document.body).scrollbarWidth,
      ]),
      ['auto', true],
    )

    // The keyboard scrolls the focused container, and snapping stops at the next slide.
    await viewport.focus()
    await unhydrated.keyboard.press('ArrowRight')
    let width = await viewport.evaluate((element) => element.clientWidth)
    await eventually(
      () => viewport.evaluate((element, slide) => element.scrollLeft > slide / 2, width),
      async () => `never scrolled, scrollLeft ${await viewport.evaluate((element) => element.scrollLeft)}`,
    )
  })

  it('stay native and unhydrated where the page renders them outside a client entry', async (t) => {
    let { page } = await open(t)
    let staticCarousel = carouselIn(page, 'Without JavaScript')

    assert.equal(await staticCarousel.getAttribute('data-ready'), null)
    assert.equal(await staticCarousel.getByRole('button', { name: 'Next slide' }).isDisabled(), true)
  })

  it('move one slide with the buttons and the arrow keys, and announce each change once', async (t) => {
    let { page } = await open(t)
    let api = example(page, 'API')
    let count = api.locator('[data-carousel-count]')
    let status = api.locator('[data-slot="carousel-status"]')

    await api.getByRole('button', { name: 'Next slide' }).click()
    await waitForSelected(page, 'API', 1)
    assert.equal(await count.innerText(), 'Slide 2 of 5')
    await eventually(
      async () => (await status.textContent()) === 'Slide 2 of 5',
      async () => `status: ${await status.textContent()}`,
    )

    await focusViewport(page, 'API')
    await page.keyboard.press('ArrowRight')
    await waitForSelected(page, 'API', 2)
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    await waitForSelected(page, 'API', 0)
    assert.equal(await count.innerText(), 'Slide 1 of 5')

    // The slide picker scrolls with the API, and Previous keeps focus at the start.
    await api.getByRole('button', { name: 'Go to slide 5' }).click()
    await waitForSelected(page, 'API', 4)
    assert.equal(await api.getByRole('button', { name: 'Go to slide 5' }).getAttribute('aria-current'), 'true')
    let next = api.getByRole('button', { name: 'Next slide' })
    assert.equal(await next.getAttribute('aria-disabled'), 'true')
    await next.focus()
    await next.click({ force: true })
    assert.equal(await next.evaluate((element) => element === document.activeElement), true)
  })

  it('keep two instances apart', async (t) => {
    let { page } = await open(t)
    let light = page.locator('[data-panel="light"]')
    let dark = page.locator('[data-panel="dark"]')

    await light.getByRole('button', { name: 'Next slide' }).first().click()
    await eventually(
      async () => (await light.locator('[data-carousel-count]').innerText()) === 'Slide 2 of 5',
      'the light carousel never moved',
    )
    assert.equal(await dark.locator('[data-carousel-count]').innerText(), 'Slide 1 of 5')
    assert.equal(await example(page, 'API').locator('[data-carousel-count]').innerText(), 'Slide 1 of 5')
  })

  it('leave the arrow keys to a field in a slide, follow Tab into the next slide, and keep links working', async (t) => {
    let { page } = await open(t)
    let invoices = example(page, 'Links and fields')
    let note = invoices.getByRole('textbox', { name: 'Reminder note' }).first()

    await note.click()
    await page.keyboard.press('End')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.type('X')
    assert.equal(await note.inputValue(), 'Friendly remindXer')
    await page.keyboard.press('ArrowRight')
    assert.equal(await selected(page, 'Links and fields'), 0)

    // Tab moves on through the link to the next slide's field, which scrolls into view.
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    let second = invoices.getByRole('textbox', { name: 'Reminder note' }).nth(1)
    assert.equal(await second.evaluate((element) => element === document.activeElement), true)
    await waitForSelected(page, 'Links and fields', 1)

    await invoices.getByRole('link', { name: 'Open INV-2042' }).click()
    await eventually(
      async () => page.url().endsWith('#INV-2042'),
      () => `url ${page.url()}`,
    )
  })

  it('drag with a mouse, and keep a click on a link a click', async (t) => {
    let { page } = await open(t)
    let viewport = example(page, 'Basic').locator('[data-slot="carousel-content"]')
    await viewport.scrollIntoViewIfNeeded()
    let box = (await viewport.boundingBox())!
    let y = box.y + box.height / 2

    await page.mouse.move(box.x + box.width - 10, y)
    await page.mouse.down()
    for (let step = 1; step <= 6; step++) await page.mouse.move(box.x + box.width - 10 - step * 20, y)
    assert.equal(await carouselIn(page, 'Basic').getAttribute('data-dragging'), 'true')
    await page.mouse.up()
    await waitForSelected(page, 'Basic', 1)
    await eventually(
      async () => Math.abs((await scrollStart(page, 'Basic')) - (box.width + 16)) < 1,
      async () => `scroll ${await scrollStart(page, 'Basic')}`,
    )
    assert.equal(await carouselIn(page, 'Basic').getAttribute('data-dragging'), null)

    // A drag that starts on a link doesn't follow it; a plain click does.
    let invoices = example(page, 'Links and fields')
    let link = invoices.getByRole('link', { name: 'Open INV-2041' })
    await link.scrollIntoViewIfNeeded()
    let linkBox = (await link.boundingBox())!
    await page.mouse.move(linkBox.x + linkBox.width - 2, linkBox.y + linkBox.height / 2)
    await page.mouse.down()
    for (let step = 1; step <= 6; step++) {
      await page.mouse.move(linkBox.x + linkBox.width - 2 - step * 25, linkBox.y + linkBox.height / 2)
    }
    await page.mouse.up()
    await waitForSelected(page, 'Links and fields', 1)
    assert.equal(page.url().includes('#INV-2041'), false)
    await invoices.getByRole('link', { name: 'Open INV-2042' }).click()
    await eventually(
      async () => page.url().endsWith('#INV-2042'),
      () => `url ${page.url()}`,
    )
  })

  it('scroll by touch or wheel, and select the slide the scroll snaps to', async (t) => {
    let { page } = await open(t, { reducedMotion: 'no-preference' })
    let viewport = example(page, 'Loop').locator('[data-slot="carousel-content"]')
    await viewport.scrollIntoViewIfNeeded()
    let box = (await viewport.boundingBox())!
    let y = Math.round(box.y + box.height / 2)

    if (engine(page) === 'chromium') {
      // A finger's swipe, as Chromium's input pipeline delivers it.
      let session = await page.context().newCDPSession(page)
      let touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number) =>
        session.send('Input.dispatchTouchEvent', {
          type,
          touchPoints: type === 'touchEnd' ? [] : [{ x: Math.round(x), y }],
        })
      await touch('touchStart', box.x + box.width - 20)
      for (let step = 1; step <= 8; step++) await touch('touchMove', box.x + box.width - 20 - step * 20)
      await touch('touchEnd', box.x + 20)
    } else {
      // Playwright drives real touch only in Chromium. A sideways wheel scrolls the same way.
      await page.mouse.move(box.x + box.width / 2, y)
      await page.mouse.wheel(box.width * 0.6, 0)
    }

    await waitForSelected(page, 'Loop', 1)
    let status = example(page, 'Loop').locator('[data-slot="carousel-status"]')
    await eventually(
      async () => (await status.textContent()) === 'Slide 2 of 5',
      async () => `status: ${await status.textContent()}`,
    )
  })

  it('loop from the last slide to the first', async (t) => {
    let { page } = await open(t)
    let loop = carouselIn(page, 'Loop')

    assert.equal(await loop.getByRole('button', { name: 'Previous slide' }).getAttribute('aria-disabled'), null)
    await loop.getByRole('button', { name: 'Previous slide' }).click()
    await waitForSelected(page, 'Loop', 4)
    await loop.getByRole('button', { name: 'Next slide' }).click()
    await waitForSelected(page, 'Loop', 0)
  })

  it('take Up and Down in a column', async (t) => {
    let { page } = await open(t)

    await focusViewport(page, 'Orientation')
    await page.keyboard.press('ArrowDown')
    await waitForSelected(page, 'Orientation', 1)
    await page.keyboard.press('ArrowUp')
    await waitForSelected(page, 'Orientation', 0)

    let next = carouselIn(page, 'Orientation').getByRole('button', { name: 'Next slide' })
    let viewport = example(page, 'Orientation').locator('[data-slot="carousel-content"]')
    let [button, content] = [(await next.boundingBox())!, (await viewport.boundingBox())!]
    assert.ok(button.y > content.y + content.height, 'Next sits below the slides')
  })

  it('swap the buttons, the keys and the chevrons in right-to-left text', async (t) => {
    let { page } = await open(t)
    let rtl = carouselIn(page, 'من اليمين إلى اليسار')
    let viewport = rtl.locator('[data-slot="carousel-content"]')
    let next = rtl.getByRole('button', { name: 'الشريحة التالية' })
    let previous = rtl.getByRole('button', { name: 'الشريحة السابقة' })

    let [nextBox, previousBox, contentBox] = [
      (await next.boundingBox())!,
      (await previous.boundingBox())!,
      (await viewport.boundingBox())!,
    ]
    assert.ok(nextBox.x < contentBox.x, 'Next sits on the left')
    assert.ok(previousBox.x > contentBox.x + contentBox.width, 'Previous sits on the right')
    assert.equal(
      await next.locator('svg').evaluate((element) => getComputedStyle(element).transform),
      'matrix(-1, 0, 0, 1, 0, 0)',
    )

    await focusViewport(page, 'من اليمين إلى اليسار')
    await page.keyboard.press('ArrowLeft')
    await waitForSelected(page, 'من اليمين إلى اليسار', 1)
    assert.ok((await viewport.evaluate((element) => element.scrollLeft)) < 0)
    assert.equal(await rtl.locator('[data-slot="carousel-item"]').first().getAttribute('aria-label'), '١ من ٥')
  })
})

describe('Carousel autoplay', () => {
  it('rotates on its own, pauses on hover and focus, and stops with the toggle', async (t) => {
    let { page } = await open(t, { reducedMotion: 'no-preference', clock: true })
    let autoplay = carouselIn(page, 'Autoplay')

    assert.equal(await autoplay.getAttribute('data-autoplay'), 'running')
    await page.clock.runFor(2100)
    await waitForSelected(page, 'Autoplay', 1)
    // Automatic changes aren't announced.
    assert.equal(await autoplay.locator('[data-slot="carousel-status"]').textContent(), '')

    await autoplay.locator('[data-slot="carousel-item"]').nth(1).hover()
    await eventually(async () => (await autoplay.getAttribute('data-autoplay')) === 'paused', 'hover never paused it')
    await page.clock.runFor(5000)
    assert.equal(await selected(page, 'Autoplay'), 1)
    await page.mouse.move(0, 0)
    await eventually(async () => (await autoplay.getAttribute('data-autoplay')) === 'running', 'never resumed')

    let toggle = autoplay.getByRole('button', { name: 'Stop slide rotation' })
    await toggle.focus()
    assert.equal(await autoplay.getAttribute('data-autoplay'), 'paused')
    await page.keyboard.press('Enter')
    assert.equal(await autoplay.getAttribute('data-autoplay'), 'stopped')
    assert.equal(await autoplay.getByRole('button', { name: 'Start slide rotation' }).count(), 1)
    await page.clock.runFor(5000)
    assert.equal(await selected(page, 'Autoplay'), 1)
  })

  it('stays silent when the page runs its timers before the smooth scroll has moved', async (t) => {
    let { page } = await open(t, { reducedMotion: 'no-preference', clock: 'paused' })
    let autoplay = carouselIn(page, 'Autoplay')
    let step = await slideStep(page, 'Autoplay')
    await record(autoplay)

    // One runFor fires the rotation and, in the same moment, every timer of the
    // second after it. A test whose clock got a second ahead on a busy machine
    // ran them in this order, while the engine's smooth scroll hadn't moved yet.
    await page.clock.runFor(3100)
    await eventually(async () => (await recorded(autoplay)).scrollEnds.length > 0, 'the scroll never ended')

    let { selections, announcements, scrollEnds } = await recorded(autoplay)
    assert.ok(Math.abs((scrollEnds[0] ?? 0) - step) < 1, `the scroll ended at ${scrollEnds[0]}, not ${step}`)
    assert.deepEqual(selections, [[1, 'autoplay']], `selections ${JSON.stringify(selections)}`)
    assert.deepEqual(announcements, [], `announcements ${JSON.stringify(announcements)}`)
  })

  it('announces the slide a wheel takes it to while it scrolls on its own', async (t) => {
    let { page } = await open(t, { reducedMotion: 'no-preference', clock: 'paused' })
    let autoplay = carouselIn(page, 'Autoplay')
    let viewport = example(page, 'Autoplay').locator('[data-slot="carousel-content"]')
    let step = await slideStep(page, 'Autoplay')
    await viewport.scrollIntoViewIfNeeded()
    let box = (await viewport.boundingBox())!
    await rotateOnWheel(page, viewport)
    await record(autoplay)

    // The rotation starts its smooth scroll to slide 2 as a wheel turns it
    // back. The page's timers then run on, so a wheel that moved nothing settles.
    await page.mouse.wheel(-box.width, 0)
    await page.clock.runFor(500)

    // Engines differ in whether their smooth scroll goes on after a wheel:
    // Chromium's ends on slide 2, Firefox's on slide 1, and WebKit's on either.
    // The carousel announces the slide it rests on, which is the user's now.
    await eventually(
      async () => {
        let index = await selected(page, 'Autoplay')
        return (await recorded(autoplay)).announcements.at(-1) === `Slide ${index + 1} of 5`
      },
      async () => `never announced the selected slide: ${JSON.stringify(await recorded(autoplay))}`,
    )

    let { selections, wheels } = await recorded(autoplay)
    assert.ok((wheels[0] ?? step) < step - 1, `the wheel came at ${wheels[0]}, after the scroll arrived`)
    // Only the rotation's own selection is automatic; the wheel made the rest the user's.
    assert.deepEqual(selections[0], [1, 'autoplay'])
    assert.ok(
      selections.slice(1).every(([, reason]) => reason === 'user'),
      `selections ${JSON.stringify(selections)}`,
    )
  })

  it('stays silent through a swipe that scrolls the page, and one a slide cancels', async (t) => {
    let { page } = await open(t, { reducedMotion: 'no-preference', clock: 'paused' })
    // Touch input runs through Chromium's DevTools protocol only. The browser
    // tests cover these swipes, and wheels, in every engine.
    if (engine(page) !== 'chromium') return
    let autoplay = carouselIn(page, 'Autoplay')
    let viewport = example(page, 'Autoplay').locator('[data-slot="carousel-content"]')
    let step = await slideStep(page, 'Autoplay')
    let middle = async () => {
      let box = (await viewport.boundingBox())!
      return { x: box.x + box.width / 2, y: box.y + box.height * 0.8 }
    }
    let pageScroll = () => page.evaluate(() => window.scrollY)
    await viewport.scrollIntoViewIfNeeded()
    await record(autoplay)

    // While the first rotation scrolls, a finger moves up and scrolls the page.
    let before = await pageScroll()
    let { x, y } = await middle()
    await page.clock.runFor(2010)
    await swipe(page, { x, y }, { x, y: y - 60 })
    await eventually(async () => (await recorded(autoplay)).scrollEnds.length > 0, 'the first rotation never ended')
    assert.ok((await pageScroll()) > before, 'the page never scrolled')
    let firstSwipe = (await recorded(autoplay)).touches
    assert.ok((firstSwipe[0] ?? step) < step - 1, `the swipe came at ${firstSwipe[0]}, after the rotation arrived`)

    // While the second one scrolls, a slide cancels a swipe back along the carousel.
    await autoplay.locator('[data-slot="carousel-item"]').evaluateAll((items) => {
      for (let item of items) item.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false })
    })
    before = await pageScroll()
    ;({ x, y } = await middle())
    await page.clock.runFor(2010)
    await swipe(page, { x: x - 40, y }, { x: x + 40, y })
    await eventually(async () => (await recorded(autoplay)).scrollEnds.length > 1, 'the second rotation never ended')
    assert.equal(await pageScroll(), before, 'the cancelled swipe scrolled the page')

    let { selections, announcements, scrollEnds, touches } = await recorded(autoplay)
    let cancelled = touches[firstSwipe.length]
    assert.ok((cancelled ?? 2 * step) < 2 * step - 1, `the swipe came at ${cancelled}, after the rotation arrived`)
    assert.ok(Math.abs((scrollEnds.at(-1) ?? 0) - 2 * step) < 1, `the rotation ended at ${scrollEnds.at(-1)}`)
    assert.deepEqual(
      selections,
      [
        [1, 'autoplay'],
        [2, 'autoplay'],
      ],
      `selections ${JSON.stringify(selections)}`,
    )
    assert.deepEqual(announcements, [], `announcements ${JSON.stringify(announcements)}`)
  })

  for (let { name, overflow, width, scrolls } of [
    { name: 'a wheel that scrolls a scroll container in a slide', overflow: 'auto', width: '800px', scrolls: true },
    {
      name: 'a wheel over a contained box in a slide whose content fits',
      overflow: 'auto',
      width: '80px',
      scrolls: false,
    },
    {
      name: 'a wheel over a contained box in a slide that hides its overflow',
      overflow: 'hidden',
      width: '800px',
      scrolls: false,
    },
  ]) {
    it(`stays silent through ${name}`, async (t) => {
      let { page } = await open(t, { reducedMotion: 'no-preference', clock: 'paused' })
      let autoplay = carouselIn(page, 'Autoplay')
      let viewport = example(page, 'Autoplay').locator('[data-slot="carousel-content"]')
      let step = await slideStep(page, 'Autoplay')
      // A strip in the first slide that contains its gestures, such as a code block.
      await autoplay
        .locator('[data-slot="carousel-item"]')
        .first()
        .evaluate(
          (item, { overflow, width }) => {
            let strip = document.createElement('div')
            strip.setAttribute('data-test-strip', '')
            strip.style.cssText = `width: 100%; height: 80px; overflow-x: ${overflow}; overscroll-behavior-x: contain`
            let content = document.createElement('div')
            content.textContent = 'A line'
            content.style.cssText = `width: ${width}; height: 60px`
            strip.append(content)
            item.append(strip)
          },
          { overflow, width },
        )
      let strip = autoplay.locator('[data-test-strip]')
      let stripScroll = () => strip.evaluate((element) => element.scrollLeft)
      await viewport.scrollIntoViewIfNeeded()
      await rotateOnWheel(page, strip)
      await record(autoplay)

      // A wheel over the strip, while the rotation scrolls.
      await page.mouse.wheel(100, 0)
      await eventually(async () => (await recorded(autoplay)).scrollEnds.length > 0, 'the rotation never ended')
      let { wheels } = await recorded(autoplay)
      assert.ok((wheels[0] ?? step) < step - 1, `the wheel came at ${wheels[0]}, after the rotation arrived`)

      // Chromium keeps the wheel in the strip, as the CSS Overscroll spec says,
      // and so does WebKit, except that it sometimes gives it to the running
      // rotation instead. Playwright's Firefox passes it on past a contained
      // box that can't scroll. A wheel given to the carousel moves it on past
      // the rotation's target: the user's change, announced where it rests.
      let { selections, announcements, scrollEnds } = await recorded(autoplay)
      let rest = scrollEnds.at(-1) ?? 0
      let passedOn = engine(page) === 'firefox' ? !scrolls : engine(page) === 'webkit' && rest > step + 1
      if (passedOn) {
        assert.ok(rest > step + 1, `the wheel never moved the carousel past ${step}, it rests at ${rest}`)
        assert.equal(announcements.at(-1), `Slide ${(await selected(page, 'Autoplay')) + 1} of 5`)
        assert.deepEqual(selections[0], [1, 'autoplay'])
        assert.ok(
          selections.slice(1).every(([, reason]) => reason === 'user'),
          `selections ${JSON.stringify(selections)}`,
        )
        return
      }
      // WebKit may scroll the strip after the rotation ended.
      if (scrolls) await eventually(async () => (await stripScroll()) > 0, 'the strip never scrolled')
      else assert.equal(await stripScroll(), 0)
      assert.ok(Math.abs(rest - step) < 1, `the rotation ended at ${rest}`)
      assert.deepEqual(selections, [[1, 'autoplay']], `selections ${JSON.stringify(selections)}`)
      assert.deepEqual(announcements, [], `announcements ${JSON.stringify(announcements)}`)
    })
  }

  it('never runs with reduced motion', async (t) => {
    let { page } = await open(t, { clock: true })
    let autoplay = carouselIn(page, 'Autoplay')

    assert.equal(await autoplay.getAttribute('data-autoplay'), 'paused')
    await page.clock.runFor(10_000)
    assert.equal(await selected(page, 'Autoplay'), 0)

    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await eventually(async () => (await autoplay.getAttribute('data-autoplay')) === 'running', 'never started')
  })
})

describe('Carousel styles', () => {
  it('show a focus ring on the scroll container and the buttons, also in forced colors', async (t) => {
    let { page } = await open(t)
    let viewport = await focusViewport(page, 'Basic')
    let ring = () =>
      viewport.evaluate((element) => [getComputedStyle(element).outlineStyle, getComputedStyle(element).outlineWidth])

    assert.deepEqual(await ring(), ['solid', '2px'])
    await page.emulateMedia({ forcedColors: 'active' })
    assert.deepEqual(await ring(), ['solid', '2px'])
    let next = carouselIn(page, 'Basic').getByRole('button', { name: 'Next slide' })
    assert.equal(await next.evaluate((element) => getComputedStyle(element).borderTopStyle), 'solid')
  })

  it('jump with reduced motion, and scroll smoothly otherwise', async (t) => {
    let { page } = await open(t, { reducedMotion: 'no-preference' })
    let next = carouselIn(page, 'Basic').getByRole('button', { name: 'Next slide' })
    let step =
      (await example(page, 'Basic')
        .locator('[data-slot="carousel-item"]')
        .first()
        .evaluate((element) => element.getBoundingClientRect().width)) + 16

    // The carousel asks for a smooth scroll. How many frames it takes is the engine's business.
    let smooth = await pressAndRecord(next, step)
    let target = smooth.start + step
    assert.deepEqual(smooth.behaviors, ['smooth'])
    assert.ok(Math.abs((smooth.seen.at(-1) ?? 0) - target) < 1, `smooth ends at ${smooth.seen.at(-1)}`)

    // With reduced motion, the next press lands on the following slide at once. WebKit applies
    // the emulated preference at its next rendering step, so wait until the page sees it.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.waitForFunction(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
    let jump = await pressAndRecord(next, step)
    assert.deepEqual(jump.behaviors, ['instant'])
    assert.ok(jump.seen.length > 0, 'the jump never scrolled')
    assert.ok(
      jump.seen.every((position) => Math.abs(position - (jump.start + step)) < 1),
      `jump: ${jump.start} then ${jump.seen.join(', ')}`,
    )
  })

  it('reflow to a 320px wide viewport without scrolling sideways, also with text at 200%', async (t) => {
    let { page } = await open(t)
    await page.setViewportSize({ width: 320, height: 640 })

    for (let fontSize of ['', '32px']) {
      for (let colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme })
        await page.evaluate((size) => (document.documentElement.style.fontSize = size), fontSize)

        let width = await page.evaluate(() => document.documentElement.scrollWidth)
        assert.equal(width, 320, `${colorScheme}, root font size ${fontSize || 'default'}: ${width}px`)
      }
    }
  })
})
