import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { findAccessibilityViolations } from './accessibility.ts'
import { createChartExamples } from './fixtures/chart/server.tsx'
import { contrastRatio } from '../scripts/color.ts'
import { paintColors, toRgba } from './paint.ts'

// Pages open with reduced motion, so bars and tooltips appear without a
// transition and every read sees the final style. The motion test opts back in.
async function open(
  t: TestContext,
  {
    reducedMotion = 'reduce' as 'reduce' | 'no-preference',
    hydrate = true,
    colorScheme = 'light' as 'light' | 'dark',
  } = {},
) {
  let examples = await createChartExamples()
  t.after(() => void examples.close())

  let server = await createTestServer(examples.fetch)
  let page = await t.serve(server)
  await page.emulateMedia({ colorScheme, reducedMotion })
  await page.goto('/')
  if (hydrate) await page.locator('html[data-ready]').waitFor({ state: 'attached' })
  return { page, server }
}

type Page = Awaited<ReturnType<typeof open>>['page']

function example(page: Page, name: string) {
  return page.locator(`[data-example="${name}"]`)
}

function surface(page: Page, name: string) {
  return example(page, name).locator('[data-slot="chart-surface"]').first()
}

/** Waits until every chart on the page drew at the size of its box. */
async function waitMeasured(page: Page) {
  await page.waitForFunction(() =>
    [...document.querySelectorAll<HTMLElement>('[data-slot="chart-surface"][role="application"]')].every((node) => {
      let viewBox = node.querySelector('svg')?.getAttribute('viewBox')?.split(' ').map(Number) ?? []
      return Math.abs(viewBox[2] - node.getBoundingClientRect().width) <= 1
    }),
  )
}

function tooltip(page: Page, name: string) {
  return example(page, name).locator('[data-slot="chart-tooltip"][data-open]')
}

function status(page: Page, name: string) {
  return example(page, name).locator('[data-slot="chart-status"]')
}

/** Moves the mouse to a fraction of the chart's box. */
async function pointAt(page: Page, name: string, x: number, y: number) {
  let target = surface(page, name)
  await target.scrollIntoViewIfNeeded()
  let box = (await target.boundingBox())!
  await page.mouse.move(box.x + box.width * x, box.y + box.height * y)
}

/** Moves the mouse to a point inside a shape of the chart, found with the shape's own hit test. */
async function pointInside(page: Page, name: string, selector: string) {
  let target = example(page, name).locator(selector).first()
  await target.scrollIntoViewIfNeeded()
  let point = await target.evaluate((shape) => {
    let path = shape as SVGGeometryElement
    let box = path.getBBox()
    let matrix = path.getScreenCTM()!
    for (let step = 0.1; step < 1; step += 0.05) {
      for (let across = 0.1; across < 1; across += 0.05) {
        let local = new DOMPoint(box.x + box.width * across, box.y + box.height * step)
        if (path.isPointInFill(local)) {
          let screen = local.matrixTransform(matrix)
          return { x: screen.x, y: screen.y }
        }
      }
    }
    throw new Error('no point inside the shape')
  })
  await page.mouse.move(point.x, point.y)
}

/** Clicks the example's card title, then tabs to the chart. */
async function tabInto(page: Page, name: string) {
  await example(page, name).locator('h3').first().click()
  await page.keyboard.press('Tab')
}

const families = ['area', 'bar', 'line', 'pie', 'radial', 'radar']

describe('Chart examples', () => {
  it('draw every family at the size of its box once hydrated, and pass axe in both themes', async (t) => {
    for (let colorScheme of ['light', 'dark'] as const) {
      let { page } = await open(t, { colorScheme })
      await waitMeasured(page)
      for (let name of families) {
        let chart = surface(page, name)
        assert.equal(await chart.getAttribute('role'), 'application', name)
        assert.equal(await chart.getAttribute('tabindex'), '0', name)
        let drawn = await chart.evaluate((node) => {
          let viewBox = node.querySelector('svg')!.getAttribute('viewBox')!.split(' ').map(Number)
          return {
            width: viewBox[2],
            box: Math.round(node.getBoundingClientRect().width),
            shapes: node.querySelectorAll('path').length,
          }
        })
        assert.ok(Math.abs(drawn.width - drawn.box) <= 1, `${name}: ${drawn.width} for ${drawn.box}`)
        assert.ok(drawn.shapes > 0, name)
      }
      assert.deepEqual(await findAccessibilityViolations(page), [], colorScheme)
    }
  })

  it('name each chart by its card title and describe it with a summary and a table', async (t) => {
    let { page } = await open(t)
    let bar = example(page, 'bar')
    let chart = page.getByRole('application', { name: 'Bar Chart - Multiple' })
    assert.equal(await chart.count(), 1)
    let described = await chart.evaluate((node) =>
      (node.getAttribute('aria-describedby') ?? '').split(' ').map((id) => document.getElementById(id)?.textContent),
    )
    assert.match(described[0] ?? '', /^Bar chart of Desktop and Mobile over 6 categories, from January to June\./)
    assert.match(described[1] ?? '', /arrow keys/)
    let table = bar.getByRole('table', { name: 'Bar Chart - Multiple' })
    assert.deepEqual(await table.getByRole('columnheader').allTextContents(), ['Month', 'Desktop', 'Mobile'])
    assert.deepEqual(await table.getByRole('row').nth(2).textContent(), 'February305200')
    // Every id a chart points at exists once on the page, though charts repeat in the themes.
    let duplicates = await page.evaluate(() => {
      let ids = [...document.querySelectorAll('[id]')].map((node) => node.id)
      return ids.filter((id, index) => ids.indexOf(id) !== index)
    })
    assert.deepEqual(duplicates, [])
  })

  it('read each value from the keyboard: focus shows the first row, arrows move, Escape hides, Tab leaves', async (t) => {
    let { page } = await open(t)
    await waitMeasured(page)
    await tabInto(page, 'bar')
    let chart = surface(page, 'bar')
    assert.equal(
      await chart.evaluate((node) => node === document.activeElement && node.matches(':focus-visible')),
      true,
    )
    await status(page, 'bar').filter({ hasText: 'January: Desktop 186, Mobile 80' }).waitFor()
    assert.equal(await tooltip(page, 'bar').textContent(), 'JanuaryDesktop186Mobile80')
    // The focus ring, the cursor band and the row's outlined bars, though the example turns the pointer's cursor off.
    assert.equal(await chart.evaluate((node) => getComputedStyle(node).outlineStyle), 'solid')
    assert.equal(await example(page, 'bar').locator('[data-slot="chart-cursor"]').count(), 1)
    assert.equal(await example(page, 'bar').locator('path[data-active]').count(), 2)

    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await status(page, 'bar').filter({ hasText: 'March: Desktop 237, Mobile 120' }).waitFor()
    await page.keyboard.press('End')
    await status(page, 'bar').filter({ hasText: 'June: Desktop 214, Mobile 140' }).waitFor()
    await page.keyboard.press('Escape')
    await tooltip(page, 'bar').waitFor({ state: 'detached' })
    assert.equal(await status(page, 'bar').textContent(), '')

    await page.keyboard.press('ArrowLeft')
    await status(page, 'bar').filter({ hasText: 'May' }).waitFor()
    await page.keyboard.press('Tab')
    await tooltip(page, 'bar').waitFor({ state: 'detached' })
    assert.equal(await chart.evaluate((node) => node === document.activeElement), false)
  })

  it('show the row, slice or spoke under the mouse, and close as it leaves', async (t) => {
    let { page } = await open(t)
    await waitMeasured(page)

    await pointAt(page, 'bar', 0.25, 0.5)
    await tooltip(page, 'bar').filter({ hasText: 'February' }).waitFor()
    assert.equal(await status(page, 'bar').textContent(), '', 'the pointer stays quiet')
    await page.mouse.move(0, 0)
    await tooltip(page, 'bar').waitFor({ state: 'detached' })

    await pointInside(page, 'pie', 'path[data-index="0"]')
    await tooltip(page, 'pie').filter({ hasText: 'Chrome275' }).waitFor()
    await pointInside(page, 'pie', 'path[data-index="3"]')
    await tooltip(page, 'pie').filter({ hasText: 'Edge173' }).waitFor()
    await pointAt(page, 'pie', 0.5, 0.45)
    await tooltip(page, 'pie').waitFor({ state: 'detached' })

    await pointAt(page, 'radar', 0.5, 0.15)
    await tooltip(page, 'radar').filter({ hasText: 'January' }).waitFor()
    assert.equal(await example(page, 'radar').locator('[data-slot="chart-active-dot"]').count(), 2)

    await pointAt(page, 'line', 0.98, 0.5)
    await tooltip(page, 'line').filter({ hasText: 'June' }).waitFor()
    assert.equal(await example(page, 'line').locator('[data-slot="chart-active-dot"]').count(), 2)
  })

  it('close the mouse’s tooltip with Escape while focus stays elsewhere, until the mouse moves to another row', async (t) => {
    let { page } = await open(t)
    await waitMeasured(page)
    await pointAt(page, 'bar', 0.25, 0.5)
    await tooltip(page, 'bar').filter({ hasText: 'February' }).waitFor()
    assert.equal(await page.evaluate(() => document.activeElement?.localName), 'body')

    await page.keyboard.press('Escape')
    await tooltip(page, 'bar').waitFor({ state: 'detached' })
    assert.equal(await page.evaluate(() => document.activeElement?.localName), 'body')
    await pointAt(page, 'bar', 0.27, 0.55)
    await page.waitForTimeout(100)
    assert.equal(await tooltip(page, 'bar').count(), 0, 'February stays closed')
    await pointAt(page, 'bar', 0.42, 0.5)
    await tooltip(page, 'bar').filter({ hasText: 'March' }).waitFor()
  })

  it('change the row once the mouse passes the tooltip along the line of its top edge', async (t) => {
    let { page } = await open(t)
    await waitMeasured(page)
    await pointAt(page, 'bar', 0.25, 0.7)
    await tooltip(page, 'bar').filter({ hasText: 'February' }).waitFor()
    let edge = (await tooltip(page, 'bar').boundingBox())!
    let chart = (await surface(page, 'bar').boundingBox())!
    let february = chart.x + chart.width * 0.25
    await page.mouse.move(february, edge.y)
    await page.waitForTimeout(100)
    assert.match((await tooltip(page, 'bar').textContent()) ?? '', /^February/)
    let june = chart.x + chart.width * 0.92
    assert.ok(june > edge.x + edge.width, 'June lies past the tooltip')
    await page.mouse.move(june, edge.y, { steps: 8 })
    await tooltip(page, 'bar').filter({ hasText: 'June' }).waitFor()
  })

  it('keep the row while the mouse moves onto its tooltip, across bars and a donut’s hole', async (t) => {
    let { page } = await open(t)
    await waitMeasured(page)

    await pointAt(page, 'bar', 0.25, 0.7)
    await tooltip(page, 'bar').filter({ hasText: 'February' }).waitFor()
    let box = (await tooltip(page, 'bar').boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 })
    await page.waitForTimeout(100)
    assert.match((await tooltip(page, 'bar').textContent()) ?? '', /^February/)

    await pointInside(page, 'pie', 'path[data-index="2"]')
    await tooltip(page, 'pie').filter({ hasText: 'Firefox287' }).waitFor()
    box = (await tooltip(page, 'pie').boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 })
    await page.waitForTimeout(100)
    assert.equal(await tooltip(page, 'pie').textContent(), 'Firefox287')
  })

  it('keep a tapped row on touch until focus moves elsewhere', async (t) => {
    let { page, server } = await open(t, { hydrate: false })
    let browser = page.context().browser()!
    let context = await browser.newContext({
      hasTouch: true,
      baseURL: server.baseUrl,
      viewport: { width: 1280, height: 720 },
    })
    t.after(() => context.close())
    let touch = await context.newPage()
    await touch.emulateMedia({ reducedMotion: 'reduce' })
    await touch.goto('/')
    await touch.locator('html[data-ready]').waitFor({ state: 'attached' })
    await waitMeasured(touch)
    let chart = surface(touch, 'bar')
    await chart.scrollIntoViewIfNeeded()
    let box = (await chart.boundingBox())!
    await touch.touchscreen.tap(box.x + box.width * 0.6, box.y + box.height * 0.5)
    await tooltip(touch, 'bar').filter({ hasText: 'April' }).waitFor()
    await touch.waitForTimeout(100)
    assert.equal(await tooltip(touch, 'bar').count(), 1, 'still shown after the finger lifts')
    await touch.touchscreen.tap(5, 5)
    await tooltip(touch, 'bar').waitFor({ state: 'detached' })
  })

  it('redraw one chart in place for new data: negative values, zeros, gaps and no rows', async (t) => {
    let { page } = await open(t)
    await waitMeasured(page)
    let changing = example(page, 'changing-data')
    let svg = await changing.locator('svg').elementHandle()
    let ticks = () => changing.locator('[data-slot="chart-y-axis"] text').allTextContents()
    let lines = () => changing.locator('[data-slot="chart-line"] path').count()

    await changing.getByRole('button', { name: 'negative' }).click()
    await page.waitForFunction((node) => node?.querySelectorAll('[data-slot="chart-line"] circle').length === 6, svg)
    assert.ok(
      (await ticks()).some((tick) => tick.startsWith('-')),
      'ticks below zero',
    )
    assert.ok((await ticks()).includes('0'))

    await changing.getByRole('button', { name: 'zero' }).click()
    await page.waitForFunction((node) => node?.querySelectorAll('[data-slot="chart-line"] circle').length === 4, svg)
    assert.deepEqual(await ticks(), ['0', '0.25', '0.5', '0.75', '1'])

    await changing.getByRole('button', { name: 'gap' }).click()
    await page.waitForFunction((node) => node?.querySelectorAll('[data-slot="chart-line"] circle').length === 6, svg)
    assert.equal(await lines(), 4, 'each line breaks at its gap')
    assert.match((await changing.locator('[data-slot="chart-table"]').textContent()) ?? '', /Tue–6/)

    await changing.getByRole('button', { name: 'empty' }).click()
    await changing.locator('[data-slot="chart-empty"]').waitFor()
    assert.equal(await changing.locator('[data-slot="chart-surface"]').getAttribute('tabindex'), null)
    assert.match(
      (await changing.locator('[data-slot="chart-summary"]').textContent()) ?? '',
      /Line chart with no data\./,
    )

    await changing.getByRole('button', { name: 'week' }).click()
    await changing.locator('[data-slot="chart-empty"]').waitFor({ state: 'detached' })
    assert.equal(await changing.locator('svg').evaluate((node, before) => node === before, svg), true, 'the same chart')
  })

  it('switch the series of the interactive example, keeping the chart and its row', async (t) => {
    let { page } = await open(t)
    await waitMeasured(page)
    let interactive = example(page, 'bar-interactive')
    await tabInto(page, 'bar-interactive')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await status(page, 'bar-interactive').filter({ hasText: 'Desktop 222' }).waitFor()
    await interactive.getByRole('button', { name: /^Mobile/ }).click()
    assert.equal(await interactive.getByRole('button', { name: /^Mobile/ }).getAttribute('aria-pressed'), 'true')
    await interactive.locator('[data-key="mobile"]').waitFor()
    assert.equal(await interactive.locator('[data-key="desktop"]').count(), 0)
    assert.deepEqual(await interactive.getByRole('columnheader').allTextContents(), ['Date', 'Mobile'])
  })

  it('redraw at the new size when the window narrows', async (t) => {
    let { page } = await open(t)
    await waitMeasured(page)
    let before = await surface(page, 'bar').evaluate((node) => node.querySelector('svg')!.getAttribute('viewBox'))
    await page.setViewportSize({ width: 500, height: 720 })
    await page.waitForFunction(
      (previous) => document.querySelector('[data-example="bar"] svg')?.getAttribute('viewBox') !== previous,
      before,
    )
    await waitMeasured(page)
  })

  it('work as plain HTML without JavaScript: drawn, named, summarized and tabled, but not focusable', async (t) => {
    let { page, server } = await open(t, { hydrate: false })
    let context = await page.context().browser()!.newContext({ javaScriptEnabled: false, baseURL: server.baseUrl })
    t.after(() => context.close())
    let plain = await context.newPage()
    await plain.goto('/')

    for (let name of [...families, 'server-bar']) {
      let chart = surface(plain, name)
      assert.equal(await chart.getAttribute('role'), 'img', name)
      assert.equal(await chart.getAttribute('tabindex'), null, name)
      assert.equal(await chart.locator('svg').getAttribute('viewBox'), '0 0 320 200', name)
      assert.ok((await example(plain, name).locator('[data-slot="chart-table"] tbody tr').count()) > 0, name)
    }
    let shown = await surface(plain, 'bar').locator('svg').boundingBox()
    assert.ok(shown && shown.width > 200 && shown.height > 100, 'scaled into its box')
  })

  it('pass axe before the script runs', async (t) => {
    let { page, server } = await open(t, { hydrate: false })
    let context = await page.context().browser()!.newContext({ baseURL: server.baseUrl })
    t.after(() => context.close())
    let before = await context.newPage()
    await before.route('**/assets/**', (route) =>
      route.request().url().endsWith('.css') ? route.continue() : route.abort(),
    )
    await before.goto('/')
    assert.equal(await surface(before, 'bar').getAttribute('role'), 'img')
    assert.deepEqual(await findAccessibilityViolations(before), [])
  })

  it('grow bars and fade series in only without reduced motion', async (t) => {
    let { page } = await open(t, { reducedMotion: 'no-preference' })
    let bar = example(page, 'bar').locator('[data-key="desktop"] path').first()
    let line = example(page, 'line').locator('[data-slot="chart-line"]').first()
    assert.equal(await bar.evaluate((node) => getComputedStyle(node).transitionProperty), 'transform')
    assert.equal(await bar.evaluate((node) => getComputedStyle(node).transitionDuration), '0.2s')
    assert.equal(await line.evaluate((node) => getComputedStyle(node).transitionDuration), '0.2s')

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.waitForFunction(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
    assert.equal(await bar.evaluate((node) => getComputedStyle(node).transitionDuration), '0s')
    assert.equal(await line.evaluate((node) => getComputedStyle(node).transitionDuration), '0s')
  })

  it('keep tick labels, legends and the tooltip at 4.5:1 in both themes', async (t) => {
    for (let colorScheme of ['light', 'dark'] as const) {
      let { page } = await open(t, { colorScheme })
      await waitMeasured(page)
      await tabInto(page, 'bar-stacked')
      await tooltip(page, 'bar-stacked').waitFor()
      let selectors = [
        '[data-example="bar-stacked"] [data-slot="chart-legend-item"]',
        '[data-example="bar-stacked"] [data-slot="chart-tooltip-name"]',
        '[data-example="bar-stacked"] [data-slot="chart-tooltip-value"]',
      ]
      for (let selector of selectors) {
        for (let { label, background, text } of await paintColors(page, selector)) {
          let ratio = contrastRatio(toRgba(text), toRgba(background))
          assert.ok(ratio >= 4.5, `${colorScheme} ${label}: ${ratio.toFixed(2)}`)
        }
      }
      // SVG text paints with fill, so compare the tick's fill with the card behind it.
      let ticks = await example(page, 'bar')
        .locator('[data-slot="chart-x-axis"] text')
        .first()
        .evaluate((node) => {
          let card = node.closest('[data-slot="card"]')!
          let canvas = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
          let read = (color: string) => {
            canvas.fillStyle = color
            canvas.fillRect(0, 0, 1, 1)
            return [...canvas.getImageData(0, 0, 1, 1).data]
          }
          return { fill: read(getComputedStyle(node).fill), card: read(getComputedStyle(card).backgroundColor) }
        })
      let ratio = contrastRatio(toRgba(ticks.fill), toRgba(ticks.card))
      assert.ok(ratio >= 4.5, `${colorScheme} tick: ${ratio.toFixed(2)}`)
    }
  })

  it('keep edges, the cursor, the focus ring and the active slice visible in forced colors', async (t) => {
    let { page } = await open(t)
    await page.emulateMedia({ forcedColors: 'active' })
    await page.waitForFunction(() => matchMedia('(forced-colors: active)').matches)
    await waitMeasured(page)
    let probe = await page.evaluate(() => {
      let span = document.createElement('span')
      span.style.color = 'CanvasText'
      document.body.append(span)
      let color = getComputedStyle(span).color
      span.style.color = 'Highlight'
      let highlight = getComputedStyle(span).color
      span.remove()
      return { text: color, highlight }
    })
    let stroke = (selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((node) => getComputedStyle(node).stroke)
    assert.equal(await stroke('[data-example="bar"] [data-key="desktop"] path'), probe.text)
    assert.equal(await stroke('[data-example="pie"] path[data-index]'), probe.text)

    await tabInto(page, 'pie')
    await tooltip(page, 'pie').waitFor()
    assert.equal(await stroke('[data-example="pie"] path[data-active]'), probe.highlight)
    assert.equal(
      await page
        .locator('[data-example="pie"] [data-slot="chart-tooltip-content"]')
        .evaluate((node) => getComputedStyle(node).borderColor),
      probe.text,
    )
    assert.notEqual(await surface(page, 'pie').evaluate((node) => getComputedStyle(node).outlineStyle), 'none')
  })

  it('run the categories and the arrows from right to left in the right-to-left example, in Arabic', async (t) => {
    let { page } = await open(t)
    await waitMeasured(page)
    let rtl = example(page, 'rtl')
    let january = (await rtl.locator('[data-key="desktop"] path').first().boundingBox())!
    let june = (await rtl.locator('[data-key="desktop"] path').last().boundingBox())!
    assert.ok(january.x > june.x, 'January on the right')
    let mobile = (await rtl.locator('[data-key="mobile"] path').first().boundingBox())!
    assert.ok(mobile.x < january.x, 'the second series to the left of the first')
    let items = await rtl
      .locator('[data-slot="chart-legend-item"]')
      .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().x))
    assert.ok(items[0] > items[1], 'the legend reads from the right')

    await tabInto(page, 'rtl')
    // Arabic digits and list punctuation, from the container's locale.
    await status(page, 'rtl')
      .filter({ hasText: /^يناير: سطح المكتب ١٨٦ والجوال ٨٠$/ })
      .waitFor()
    await page.keyboard.press('ArrowLeft')
    await status(page, 'rtl').filter({ hasText: 'فبراير' }).waitFor()
    assert.equal(
      await surface(page, 'rtl')
        .getAttribute('aria-describedby')
        .then((ids) => ids?.split(' ').length),
      2,
    )
    assert.match((await rtl.locator('[data-slot="chart-hint"]').textContent()) ?? '', /مفاتيح الأسهم/)
  })

  it('reflow to a 320px wide viewport without scrolling sideways, also with text at 200%', async (t) => {
    let { page } = await open(t)
    await page.setViewportSize({ width: 320, height: 640 })

    for (let fontSize of ['', '32px']) {
      for (let colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme })
        await page.evaluate((size) => (document.documentElement.style.fontSize = size), fontSize)
        await waitMeasured(page)

        let { width, overflowing } = await page.evaluate(() => ({
          width: document.documentElement.scrollWidth,
          overflowing: [...document.body.querySelectorAll('*')]
            .filter((element) => element.getBoundingClientRect().right > innerWidth)
            .map(
              (element) =>
                `${element.localName}.${element.getAttribute('data-slot')}: ${element.textContent?.trim().slice(0, 40)}`,
            )
            .at(-1),
        }))
        assert.equal(width, 320, `${colorScheme}, root font size ${fontSize || 'default'}: ${width}px, ${overflowing}`)
      }
    }

    // The long German labels wrap in the tooltip inside the chart's width.
    await page.evaluate(() => (document.documentElement.style.fontSize = ''))
    await waitMeasured(page)
    await tabInto(page, 'long-labels')
    let box = (await tooltip(page, 'long-labels').boundingBox())!
    let chart = (await surface(page, 'long-labels').boundingBox())!
    assert.ok(box.x >= chart.x - 0.5 && box.x + box.width <= chart.x + chart.width + 0.5, 'inside the chart')
    assert.match((await tooltip(page, 'long-labels').textContent()) ?? '', /Mobilgeräte, Tablets und Fernsehgeräte/)
  })
})
