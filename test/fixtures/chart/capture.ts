// Captures the Chart examples in headless Chromium for UI reviews: the
// desktop and narrow pages in both themes, a bar chart read from the
// keyboard, a donut slice under the pointer, forced colors, right-to-left
// text, the long labels at 320px with text at 200%, and the charts as the
// server draws them without JavaScript. Run `bun run capture:chart-examples`.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'
import type { Page } from 'playwright'
import { createTestServer } from 'remix/node-fetch-server/test'

import { createChartExamples } from './server.tsx'

interface Shot {
  name: string
  width: number
  colorScheme: 'light' | 'dark'
  forcedColors?: 'active'
  // The root font size, such as 32px for text at 200%.
  fontSize?: string
  javaScript?: boolean
  // Capture only this section or example, after an optional interaction.
  section?: string
  example?: string
  prepare?: (page: Page) => Promise<void>
}

/** Clicks the example's card title, then tabs to the chart. */
async function tabInto(page: Page, example: string) {
  await page.locator(`[data-example="${example}"] h3`).first().click()
  await page.keyboard.press('Tab')
  await page.locator(`[data-example="${example}"] [data-slot="chart-tooltip"][data-open]`).waitFor()
}

/** Moves the mouse into a shape of the example's chart, found with the shape's own hit test. */
async function pointInside(page: Page, example: string, selector: string) {
  let point = await page
    .locator(`[data-example="${example}"] ${selector}`)
    .first()
    .evaluate((shape) => {
      let path = shape as SVGGeometryElement
      let box = path.getBBox()
      let matrix = path.getScreenCTM()!
      for (let step = 0.1; step < 1; step += 0.05) {
        for (let across = 0.1; across < 1; across += 0.05) {
          let local = new DOMPoint(box.x + box.width * across, box.y + box.height * step)
          if (path.isPointInFill(local)) return local.matrixTransform(matrix)
        }
      }
      throw new Error('no point inside the shape')
    })
  await page.mouse.move(point.x, point.y)
  await page.locator(`[data-example="${example}"] [data-slot="chart-tooltip"][data-open]`).waitFor()
}

const desktop = 1280
const narrow = 390
const shots: Shot[] = [
  { name: 'desktop-light', width: desktop, colorScheme: 'light' },
  { name: 'desktop-dark', width: desktop, colorScheme: 'dark' },
  { name: 'narrow-light', width: narrow, colorScheme: 'light' },
  { name: 'narrow-dark', width: narrow, colorScheme: 'dark' },
  {
    name: 'bar-keyboard-light',
    width: desktop,
    colorScheme: 'light',
    example: 'bar',
    async prepare(page) {
      await tabInto(page, 'bar')
      await page.keyboard.press('ArrowRight')
      await page.keyboard.press('ArrowRight')
    },
  },
  {
    name: 'pie-pointer-dark',
    width: desktop,
    colorScheme: 'dark',
    example: 'pie',
    prepare: (page) => pointInside(page, 'pie', 'path[data-index="2"]'),
  },
  {
    name: 'line-pointer-light',
    width: desktop,
    colorScheme: 'light',
    example: 'line',
    async prepare(page) {
      let box = (await page.locator('[data-example="line"] [data-slot="chart-surface"]').boundingBox())!
      await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.4)
      await page.locator('[data-example="line"] [data-slot="chart-tooltip"][data-open]').waitFor()
    },
  },
  {
    name: 'forced-colors',
    width: desktop,
    colorScheme: 'light',
    forcedColors: 'active',
    section: 'families',
    prepare: (page) => tabInto(page, 'pie'),
  },
  {
    name: 'right-to-left-dark',
    width: desktop,
    colorScheme: 'dark',
    example: 'rtl',
    async prepare(page) {
      await tabInto(page, 'rtl')
      await page.keyboard.press('ArrowLeft')
    },
  },
  { name: 'stacked-negative-interactive-light', width: desktop, colorScheme: 'light', section: 'more' },
  {
    name: 'long-labels-320-text-200-light',
    width: 320,
    colorScheme: 'light',
    fontSize: '32px',
    example: 'long-labels',
    prepare: (page) => tabInto(page, 'long-labels'),
  },
  { name: 'without-javascript-light', width: desktop, colorScheme: 'light', javaScript: false, section: 'families' },
]

const output = fileURLToPath(new URL('../../../docs/images/chart/', import.meta.url))
mkdirSync(output, { recursive: true })

let examples = await createChartExamples()
let server = await createTestServer(examples.fetch)
let browser = await chromium.launch()

try {
  for (let shot of shots) {
    let javaScript = shot.javaScript ?? true
    let page = await browser.newPage({ viewport: { width: shot.width, height: 900 }, javaScriptEnabled: javaScript })
    await page.emulateMedia({
      colorScheme: shot.colorScheme,
      forcedColors: shot.forcedColors ?? 'none',
      reducedMotion: 'reduce',
    })
    await page.goto(server.baseUrl)
    if (javaScript) await page.locator('html[data-ready]').waitFor({ state: 'attached' })
    if (shot.fontSize) await page.locator('html').evaluate((html, size) => (html.style.fontSize = size), shot.fontSize)

    // A viewport as tall as the page draws every chart at its final size.
    let height = await page.evaluate(() => document.documentElement.scrollHeight)
    await page.setViewportSize({ width: shot.width, height })
    // Two frames, for the measurement after a resize. Without JavaScript nothing moves.
    if (javaScript) {
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    }
    await shot.prepare?.(page)
    if (javaScript) {
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    }

    let path = `${output}${shot.name}.png`
    let target = shot.section
      ? page.locator(`section[aria-labelledby="${shot.section}"]`)
      : shot.example
        ? page.locator(`[data-example="${shot.example}"]`)
        : undefined
    if (target) {
      // The box of the target with a margin for focus rings.
      let clip = await target.evaluate((element) => {
        let box = element.getBoundingClientRect()
        let margin = 16
        let left = Math.max(0, box.left - margin)
        let top = Math.max(0, box.top - margin)
        let right = Math.min(document.documentElement.clientWidth, box.right + margin)
        return { x: left, y: top, width: right - left, height: box.bottom + margin - top }
      })
      await page.screenshot({ path, clip })
    } else {
      await page.screenshot({ path })
    }

    await page.close()
    process.stdout.write(`✓ docs/images/chart/${shot.name}.png\n`)
  }
} finally {
  await browser.close()
  await server.close()
  await examples.close()
}
