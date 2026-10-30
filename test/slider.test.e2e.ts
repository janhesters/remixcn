import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { contrastRatio, parseColor } from '../scripts/color.ts'
import { findAccessibilityViolations } from './accessibility.ts'
import { createSliderExamples } from './fixtures/slider/server.tsx'

// Pages open with reduced motion, so the thumb's halo takes 0s and every read
// sees the final style.
async function open(t: TestContext, { javaScriptEnabled = true } = {}) {
  let examples = await createSliderExamples()
  t.after(() => void examples.close())

  let server = await createTestServer(examples.fetch)
  let page = await t.serve(server)
  if (!javaScriptEnabled) {
    let context = await page.context().browser()!.newContext({ javaScriptEnabled: false, baseURL: server.baseUrl })
    t.after(() => context.close())
    page = await context.newPage()
  }

  let errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await page.goto('/')
  if (javaScriptEnabled) await page.locator('html[data-ready]').waitFor({ state: 'attached' })
  return { page, errors }
}

type Page = Awaited<ReturnType<typeof open>>['page']

function example(page: Page, title: string) {
  return page.locator(`[data-example="${title}"]`)
}

function thumb(page: Page, title: string, name: string) {
  return example(page, title).getByRole('slider', { name, exact: true })
}

/** The screen position of a fraction of a slider's track, where a thumb's center sits. */
async function spot(page: Page, title: string, fraction: number, index = 0) {
  let control = example(page, title).locator('[data-slot="slider-control"]').nth(index)
  await control.scrollIntoViewIfNeeded()
  let box = (await control.boundingBox())!
  if (box.height > box.width)
    return { x: box.x + box.width / 2, y: box.y + box.height - 8 - fraction * (box.height - 16) }
  return { x: box.x + 8 + fraction * (box.width - 16), y: box.y + box.height / 2 }
}

function engine(page: Page) {
  return page.context().browser()?.browserType().name()
}

function computed(page: Page, selector: string, property: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property)
}

describe('Slider examples', () => {
  it('renders native thumbs on the server and hydrates them without errors', async (t) => {
    let { page, errors } = await open(t)
    let html = await (await fetch(new URL('/', page.url()))).text()

    assert.match(html, /<input[^>]*type="range"[^>]*data-slot="slider-thumb"/)
    assert.equal(await page.getByRole('slider').count(), 30)
    assert.equal(await thumb(page, 'Basic', 'Volume').inputValue(), '50')

    await thumb(page, 'Basic', 'Volume').focus()
    await page.keyboard.press('End')
    assert.equal(await thumb(page, 'Basic', 'Volume').inputValue(), '100')
    assert.match(
      (await example(page, 'Basic').locator('[data-slot="slider"]').getAttribute('style')) ?? '',
      /--slider-end: 1;?$/,
    )
    assert.deepEqual(errors, [])
  })

  it("passes axe-core's WCAG 2.2 A and AA rules", async (t) => {
    let { page } = await open(t)
    // axe sizes each thumb by its input, which spans the whole track, and
    // sees the inputs of a range as overlapping targets. They take no
    // pointer: the control takes every press. The next test checks the real
    // targets, and any other element still fails target size.
    let thumbs = { rule: 'target-size', selector: 'input[data-slot="slider-thumb"]' }

    assert.deepEqual(await findAccessibilityViolations(page, { except: [thumbs] }), [])
  })

  it('gives every thumb a pointer target of at least 24 by 24 pixels', async (t) => {
    let { page } = await open(t)
    let targets = await page.locator('[data-slot="slider-control"]').evaluateAll((controls) =>
      controls.map((control) => {
        let vertical = control.getAttribute('data-orientation') === 'vertical'
        let band = control.getBoundingClientRect()
        let inputs = [...control.querySelectorAll('input')]
        let thumb = vertical ? inputs[0].getBoundingClientRect().width : inputs[0].getBoundingClientRect().height
        let length = vertical ? band.height : band.width
        let centers = inputs.map((input) => {
          let fraction = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min))
          return thumb / 2 + fraction * (length - thumb)
        })
        // A press moves the nearest thumb, so each thumb takes the band up to
        // halfway to its neighbours.
        let spans = centers.map((center, index) => {
          let from = index > 0 ? (centers[index - 1] + center) / 2 : 0
          let to = index < centers.length - 1 ? (center + centers[index + 1]) / 2 : length
          return to - from
        })
        return {
          name: inputs.map((input) => input.getAttribute('aria-label')).join(', '),
          across: vertical ? band.width : band.height,
          along: Math.min(...spans),
          pointer: inputs.map((input) => getComputedStyle(input).pointerEvents),
        }
      }),
    )

    assert.equal(targets.length, 19)
    for (let { name, across, along, pointer } of targets) {
      assert.ok(across >= 24, `${name}: ${across}px across`)
      assert.ok(along >= 24, `${name}: ${along}px along`)
      assert.ok(
        pointer.every((value) => value === 'none'),
        `${name}: the inputs take the pointer`,
      )
    }

    // A press beside the 16px thumb, on the band's edge, still moves it.
    let control = example(page, 'Basic').locator('[data-slot="slider-control"]')
    let band = (await control.boundingBox())!
    await page.mouse.click(band.x + 8 + 0.8 * (band.width - 16), band.y + 1)
    assert.equal(await thumb(page, 'Basic', 'Volume').inputValue(), '80')
  })

  it('keeps a value the user set before hydration', async (t) => {
    let examples = await createSliderExamples()
    t.after(() => void examples.close())
    let page = await t.serve(await createTestServer(examples.fetch))
    let release!: () => void
    let held = new Promise<void>((resolve) => (release = resolve))
    await page.route(/entry\.ts/, async (route) => {
      await held
      await route.continue()
    })
    // A module script holds DOMContentLoaded, so wait for the server's HTML instead.
    await page.goto('/', { waitUntil: 'commit' })
    await thumb(page, 'Basic', 'Volume').waitFor()

    await thumb(page, 'Basic', 'Volume').focus()
    await page.keyboard.press('End')
    assert.equal(await thumb(page, 'Basic', 'Volume').inputValue(), '100', 'before hydration')
    release()
    await page.locator('html[data-ready]').waitFor({ state: 'attached' })

    assert.equal(await thumb(page, 'Basic', 'Volume').inputValue(), '100', 'after hydration')
    await page.waitForFunction(() =>
      document
        .querySelector('[data-example="Basic"] [data-slot="slider"]')
        ?.getAttribute('style')
        ?.includes('--slider-end: 1'),
    )
    await page.keyboard.press('ArrowLeft')
    assert.equal(await thumb(page, 'Basic', 'Volume').inputValue(), '99')
  })

  it('drags a thumb with the mouse, also past the end of the track, and keeps the drag after leaving it', async (t) => {
    let { page } = await open(t)
    let start = await spot(page, 'Controlled', 0.3)

    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x - 400, start.y + 120, { steps: 6 })
    await page.mouse.up()

    assert.equal(await thumb(page, 'Controlled', 'Lowest temperature').inputValue(), '0')
    assert.equal(await page.locator('[data-value="temperature"]').textContent(), '0, 0.7')
    assert.equal(
      await thumb(page, 'Controlled', 'Lowest temperature').evaluate((input) => input === document.activeElement),
      true,
    )
  })

  it('moves a thumb with a tap and returns it when the browser cancels the touch', async (t) => {
    let { page } = await open(t)
    // Only Chromium lets a test send real touches and cancel them, through
    // CDP. The component tests cover touch pointers and cancel in every engine.
    if (engine(page) !== 'chromium') return
    let session = await page.context().newCDPSession(page)
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
    let touch = (type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel', point?: { x: number; y: number }) =>
      session.send('Input.dispatchTouchEvent', { type, touchPoints: point ? [point] : [] })
    let volume = thumb(page, 'Basic', 'Volume')

    await touch('touchStart', await spot(page, 'Basic', 0.8))
    await touch('touchEnd')
    assert.equal(await volume.inputValue(), '80')

    await page.evaluate(() => {
      let log: string[] = ((window as any).commits = [])
      document.addEventListener('remixcn:slider-commit', (event) => log.push(String((event as any).values)))
      // Chromium answers a touch start, move or end once the page handled it, but a touch cancel at once: nothing
      // can prevent a cancel, so the browser doesn't wait. The page notes when the cancel arrives.
      document.addEventListener('pointercancel', () => ((window as any).canceled = true), { capture: true })
    })
    await touch('touchStart', await spot(page, 'Basic', 0.2))
    await touch('touchMove', await spot(page, 'Basic', 0.3))
    assert.equal(await volume.inputValue(), '30')
    await touch('touchCancel')
    await page.waitForFunction(() => (window as any).canceled === true, undefined, { timeout: 5000 })

    assert.equal(await volume.inputValue(), '80')
    assert.deepEqual(await page.evaluate(() => (window as any).commits), [])
  })

  it('submits one value per thumb, in order, and resets both thumbs and the summary', async (t) => {
    let { page } = await open(t)
    let summary = page.locator('[data-value="price"]')

    await thumb(page, 'Form', 'Minimum price').focus()
    await page.keyboard.press('PageUp')
    await page.keyboard.press('ArrowRight')
    assert.equal(await summary.textContent(), 'Set your budget range ($310 – $800).')
    assert.equal(await thumb(page, 'Form', 'Minimum price').getAttribute('aria-valuetext'), '$310')

    await page.getByRole('button', { name: 'Reset' }).click()
    await page.waitForFunction(() => document.querySelector('[data-value="price"]')?.textContent?.includes('$200'))
    assert.equal(await thumb(page, 'Form', 'Minimum price').inputValue(), '200')

    await thumb(page, 'Form', 'Maximum price').focus()
    await page.keyboard.press('Home')
    await page.getByRole('button', { name: 'Apply' }).click()
    await page.locator('[data-echo="fields"]').waitFor()
    assert.deepEqual(await page.locator('[data-echo="fields"] dd').allTextContents(), ['200', '250'])
  })

  it('works as native range inputs without JavaScript', async (t) => {
    let { page } = await open(t, { javaScriptEnabled: false })

    await thumb(page, 'Form', 'Maximum price').focus()
    await page.keyboard.press('ArrowLeft')
    await page.getByRole('button', { name: 'Apply' }).click()
    await page.locator('[data-echo="fields"]').waitFor()

    assert.deepEqual(await page.locator('[data-echo="fields"] dd').allTextContents(), ['200', '790'])
  })

  it('reads a right-to-left track from the right and a vertical track from the bottom', async (t) => {
    let { page } = await open(t)
    let rtl = thumb(page, 'مستوى الصوت', 'مستوى الصوت')

    let left = await spot(page, 'مستوى الصوت', 0.1)
    await page.mouse.click(left.x, left.y)
    assert.equal(await rtl.inputValue(), '90')
    await page.keyboard.press('ArrowRight')
    assert.equal(await rtl.inputValue(), '89')

    let top = await spot(page, 'Vertical', 0.9)
    await page.mouse.click(top.x, top.y)
    assert.equal(await thumb(page, 'Vertical', 'Bass').inputValue(), '90')
  })

  it("tells screen readers each thumb's bounds, which follow its neighbour", async (t) => {
    let { page } = await open(t)
    let from = thumb(page, 'Brand color', 'From')
    let to = thumb(page, 'Brand color', 'To')
    let attributes = async () =>
      Promise.all(
        [from, to].map(async (input) => [
          await input.getAttribute('aria-valuemin'),
          await input.getAttribute('aria-valuemax'),
        ]),
      )

    assert.deepEqual(await attributes(), [
      [null, '60'],
      ['20', null],
    ])
    await to.focus()
    await page.keyboard.press('PageUp')
    assert.deepEqual(await attributes(), [
      [null, '70'],
      ['20', null],
    ])

    // Only Chromium lets a test read the accessibility tree, through CDP.
    if (engine(page) !== 'chromium') return
    await page.keyboard.press('PageDown')
    let session = await page.context().newCDPSession(page)
    let bounds = async () => {
      let { nodes } = await session.send('Accessibility.getFullAXTree')
      let read = (name: string) => {
        let node = nodes.find((item) => item.role?.value === 'slider' && item.name?.value === name)
        let property = (key: string) => node?.properties?.find((item) => item.name === key)?.value.value
        return [property('valuemin'), property('valuemax')]
      }
      return [read('From'), read('To')]
    }

    assert.deepEqual(await bounds(), [
      [0, 60],
      [20, 100],
    ])
    await thumb(page, 'Brand color', 'To').focus()
    await page.keyboard.press('PageUp')
    assert.deepEqual(await bounds(), [
      [0, 70],
      [20, 100],
    ])
  })

  it('draws the thumb and the range at 3:1 or more against their surface, in every theme', async (t) => {
    let { page } = await open(t)
    let measure = async (scope: string) => {
      let range = parseColor(await computed(page, `${scope} [data-slot="slider-range"]`, 'background-color'))
      let surface = parseColor(await computed(page, scope, 'background-color'))
      return contrastRatio(range, surface)
    }

    for (let scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
      for (let scope of ['html', '[data-panel="light"]', '[data-panel="dark"]']) {
        let ratio = await measure(scope)
        assert.ok(ratio >= 3, `${scheme} ${scope}: ${ratio.toFixed(2)}:1`)
      }
    }
  })

  it('shows a focus ring on the thumb that has keyboard focus, also in forced colors', async (t) => {
    let { page } = await open(t)
    let control = example(page, 'Range').locator('[data-slot="slider-control"]')
    let maximum = thumb(page, 'Range', 'Maximum price')

    for (let forcedColors of ['none', 'active'] as const) {
      await page.emulateMedia({ colorScheme: 'light', forcedColors, reducedMotion: 'reduce' })
      // A key press marks keyboard focus in every engine. WebKit doesn't move
      // focus to a range input with Tab by default.
      await maximum.focus()
      await page.keyboard.press('ArrowLeft')
      assert.equal(
        await maximum.evaluate((input) => input === document.activeElement && input.matches(':focus-visible')),
        true,
      )
      let focused = await control.screenshot()
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
      let blurred = await control.screenshot()

      assert.notDeepEqual(focused, blurred, forcedColors)
    }
  })

  it('keeps the track and the range visible in forced colors', async (t) => {
    let { page } = await open(t)
    await page.emulateMedia({ colorScheme: 'light', forcedColors: 'active', reducedMotion: 'reduce' })
    // WebKit has no forced colors mode, so there is nothing to keep visible.
    if (!(await page.evaluate(() => matchMedia('(forced-colors: active)').matches))) return
    let highlight = await page.evaluate(() => {
      let probe = document.createElement('div')
      probe.style.backgroundColor = 'Highlight'
      document.body.append(probe)
      let color = getComputedStyle(probe).backgroundColor
      probe.remove()
      return color
    })

    assert.equal(
      await computed(page, '[data-example="Basic"] [data-slot="slider-range"]', 'background-color'),
      highlight,
    )
    assert.equal(await computed(page, '[data-example="Basic"] [data-slot="slider-track"]', 'border-top-style'), 'solid')
  })

  it('takes no time to animate with reduced motion', async (t) => {
    let { page } = await open(t)

    assert.equal((await computed(page, '[data-slot="slider-thumb"]', '--duration-fast')).trim(), '0s')
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    assert.notEqual((await computed(page, '[data-slot="slider-thumb"]', '--duration-fast')).trim(), '0s')
  })

  it('fits 320px without scrolling sideways, also with text at 200%', async (t) => {
    let { page } = await open(t)
    await page.setViewportSize({ width: 320, height: 800 })
    let overflow = () =>
      page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

    assert.equal(await overflow(), 0)
    await page.evaluate(() => (document.documentElement.style.fontSize = '32px'))
    assert.equal(await overflow(), 0)
  })
})
