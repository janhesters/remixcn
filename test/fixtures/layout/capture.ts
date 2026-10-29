// Captures the Resizable and Scroll Area examples in headless Chromium for UI
// reviews: the desktop and narrow pages in both themes, a handle moved and
// focused from the keyboard in dark mode, a collapsed panel, scrolled scroll
// areas with both scrollbars, the page in forced colors, right-to-left text,
// the examples at 200% text on a narrow screen, and the page before
// JavaScript runs. Run `bun run capture:layout`.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'
import type { Page } from 'playwright'
import { createTestServer } from 'remix/node-fetch-server/test'

import { createLayout } from './server.tsx'

interface Shot {
  name: string
  width: number
  colorScheme: 'light' | 'dark'
  forcedColors?: 'active'
  // The root font size, such as 32px for text at 200%.
  fontSize?: string
  javaScript?: boolean
  // Capture only this section, or this example, after an optional interaction.
  section?: string
  example?: string
  prepare?: (page: Page) => Promise<void>
}

async function scrollAreas(page: Page) {
  await page
    .locator('[data-example="scroll-area-vertical"] [data-slot="scroll-area-viewport"]')
    .evaluate((viewport) => {
      viewport.scrollTop = 360
    })
  await page
    .locator('[data-example="scroll-area-horizontal"] [data-slot="scroll-area-viewport"]')
    .evaluate((viewport) => {
      viewport.scrollLeft = 120
    })
  await page.locator('[data-example="scroll-area-both"] [data-slot="scroll-area-viewport"]').evaluate((viewport) => {
    viewport.scrollTop = 120
    viewport.scrollLeft = 80
  })
  await page.waitForTimeout(50)
}

const desktop = 1280
const narrow = 390
const shots: Shot[] = [
  { name: 'desktop-light', width: desktop, colorScheme: 'light' },
  { name: 'desktop-dark', width: desktop, colorScheme: 'dark' },
  { name: 'narrow-light', width: narrow, colorScheme: 'light' },
  { name: 'narrow-dark', width: narrow, colorScheme: 'dark' },
  {
    name: 'handle-keyboard-focus-dark',
    width: desktop,
    colorScheme: 'dark',
    example: 'resizable-with-handle',
    async prepare(page) {
      // Tab to the handle, then widen the sidebar by two steps of 5%.
      await page.getByRole('heading', { name: 'With handle' }).click()
      await page.keyboard.press('Tab')
      await page.keyboard.press('ArrowRight')
      await page.keyboard.press('ArrowRight')
    },
  },
  {
    name: 'panel-collapsed-light',
    width: desktop,
    colorScheme: 'light',
    example: 'resizable-collapsible',
    async prepare(page) {
      await page.getByRole('button', { name: 'Hide folders' }).click()
    },
  },
  {
    name: 'scroll-areas-scrolled-dark',
    width: desktop,
    colorScheme: 'dark',
    section: 'scroll-area',
    prepare: scrollAreas,
  },
  { name: 'forced-colors', width: desktop, colorScheme: 'light', forcedColors: 'active', prepare: scrollAreas },
  { name: 'right-to-left-dark', width: narrow, colorScheme: 'dark', section: 'right-to-left' },
  { name: 'narrow-text-200-light', width: narrow, colorScheme: 'light', fontSize: '32px', section: 'resizable' },
  { name: 'without-javascript-light', width: desktop, colorScheme: 'light', javaScript: false, section: 'scroll-area' },
]

const output = fileURLToPath(new URL('../../../docs/images/layout/', import.meta.url))
mkdirSync(output, { recursive: true })

let layout = await createLayout()
let server = await createTestServer(layout.fetch)
// Playwright hides native scrollbars by default. Show them, so the pictures
// without JavaScript and in forced colors show the system's scrollbars.
let browser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] })

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
    if (javaScript) await page.locator('html[data-hydrated]').waitFor({ state: 'attached' })
    if (shot.fontSize) await page.locator('html').evaluate((html, size) => (html.style.fontSize = size), shot.fontSize)
    await shot.prepare?.(page)

    // Full-page captures drop the scrollbars of inner scroll areas. A viewport
    // as tall as the page keeps them, and keeps every coordinate on the page.
    let height = await page.evaluate(() => document.documentElement.scrollHeight)
    await page.setViewportSize({ width: shot.width, height })

    let path = `${output}${shot.name}.png`
    let target = shot.section
      ? page.locator(`section[aria-labelledby="${shot.section}"]`)
      : shot.example
        ? page.locator(`[data-example="${shot.example}"]`)
        : undefined
    if (target) {
      // A margin keeps focus rings, which sit outside their controls, in the picture.
      let clip = await target.evaluate((element) => {
        let box = element.getBoundingClientRect()
        let margin = 16
        return {
          x: Math.max(0, box.x - margin),
          y: Math.max(0, box.y - margin),
          width: Math.min(box.width + 2 * margin, document.documentElement.clientWidth),
          height: box.height + 2 * margin,
        }
      })
      await page.screenshot({ path, clip })
    } else {
      await page.screenshot({ path })
    }

    await page.close()
    process.stdout.write(`✓ docs/images/layout/${shot.name}.png\n`)
  }
} finally {
  await browser.close()
  await server.close()
  await layout.close()
}
