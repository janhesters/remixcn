// Captures the Popover, Hover Card and Tooltip examples in headless Chromium
// for UI reviews: the desktop and narrow pages in both themes, a popover form
// opened from the keyboard, a hover card under the pointer, a tooltip on
// keyboard focus, nested popovers, forced colors, right-to-left text, the
// popover form at 320px with text at 200%, and a popover the browser opens
// natively without JavaScript. Run `bun run capture:overlays`.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'
import type { Page } from 'playwright'
import { createTestServer } from 'remix/node-fetch-server/test'

import { createOverlayExamples } from './server.tsx'

interface Shot {
  name: string
  width: number
  colorScheme: 'light' | 'dark'
  forcedColors?: 'active'
  // The root font size, such as 32px for text at 200%.
  fontSize?: string
  javaScript?: boolean
  // Capture only this section or example, with the popups open inside it, after an optional interaction.
  section?: string
  example?: string
  // Capture the window as it is, such as a popover the browser centers in it.
  viewport?: boolean
  prepare?: (page: Page) => Promise<void>
}

/** Tabs from the example's heading to its first control. */
async function tabInto(page: Page, example: string) {
  await page.locator(`[data-example="${example}"] h3`).click()
  await page.keyboard.press('Tab')
}

const desktop = 1280
const narrow = 390
const shots: Shot[] = [
  { name: 'desktop-light', width: desktop, colorScheme: 'light' },
  { name: 'desktop-dark', width: desktop, colorScheme: 'dark' },
  { name: 'narrow-light', width: narrow, colorScheme: 'light' },
  { name: 'narrow-dark', width: narrow, colorScheme: 'dark' },
  {
    name: 'popover-form-keyboard-dark',
    width: desktop,
    colorScheme: 'dark',
    example: 'popover-form',
    async prepare(page) {
      // Enter opens it and moves focus to the first field.
      await tabInto(page, 'popover-form')
      await page.keyboard.press('Enter')
      await page.keyboard.press('ArrowUp')
    },
  },
  {
    name: 'hover-card-hovered-light',
    width: desktop,
    colorScheme: 'light',
    example: 'hover-card-basic',
    async prepare(page) {
      await page.locator('[data-example="hover-card-basic"] a').first().hover()
      await page.locator('[data-example="hover-card-basic"] [data-slot="hover-card-content"][data-open]').waitFor()
    },
  },
  {
    name: 'tooltip-keyboard-focus-light',
    width: desktop,
    colorScheme: 'light',
    example: 'tooltip-keyboard',
    async prepare(page) {
      await tabInto(page, 'tooltip-keyboard')
      await page.locator('[data-example="tooltip-keyboard"] [data-slot="tooltip-content"][data-open]').waitFor()
    },
  },
  {
    name: 'nested-popovers-light',
    width: desktop,
    colorScheme: 'light',
    example: 'popover-nested',
    async prepare(page) {
      let example = page.locator('[data-example="popover-nested"]')
      await example.getByRole('button', { name: 'Filters' }).click()
      await example.getByRole('button', { name: 'Customer' }).click()
    },
  },
  { name: 'forced-colors', width: desktop, colorScheme: 'light', forcedColors: 'active', section: 'open' },
  { name: 'right-to-left-dark', width: desktop, colorScheme: 'dark', section: 'right-to-left' },
  {
    name: 'popover-form-320-text-200-light',
    width: 320,
    colorScheme: 'light',
    fontSize: '32px',
    example: 'popover-form',
    async prepare(page) {
      await tabInto(page, 'popover-form')
      await page.keyboard.press('Enter')
    },
  },
  {
    name: 'without-javascript-light',
    width: desktop,
    colorScheme: 'light',
    javaScript: false,
    viewport: true,
    async prepare(page) {
      let trigger = page.locator('[data-example="server-popover"] [data-slot="popover-trigger"]')
      await trigger.scrollIntoViewIfNeeded()
      await trigger.click()
    },
  },
]

const output = fileURLToPath(new URL('../../../docs/images/overlays/', import.meta.url))
mkdirSync(output, { recursive: true })

let examples = await createOverlayExamples()
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

    // A viewport as tall as the page keeps every popup beside its trigger in the picture.
    if (!shot.viewport) {
      let height = await page.evaluate(() => document.documentElement.scrollHeight)
      await page.setViewportSize({ width: shot.width, height })
    }
    await shot.prepare?.(page)
    // Two frames, for the positioning after a resize or an interaction. Without JavaScript nothing moves.
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
      // The box of the target and of every popup open inside it, with a margin for focus rings.
      let clip = await target.evaluate((element) => {
        let boxes = [element, ...element.querySelectorAll(':popover-open')].map((part) => part.getBoundingClientRect())
        let margin = 16
        let left = Math.max(0, Math.min(...boxes.map((box) => box.left)) - margin)
        let top = Math.max(0, Math.min(...boxes.map((box) => box.top)) - margin)
        let right = Math.min(document.documentElement.clientWidth, Math.max(...boxes.map((box) => box.right)) + margin)
        let bottom = Math.max(...boxes.map((box) => box.bottom)) + margin
        return { x: left, y: top, width: right - left, height: bottom - top }
      })
      await page.screenshot({ path, clip })
    } else {
      await page.screenshot({ path })
    }

    await page.close()
    process.stdout.write(`✓ docs/images/overlays/${shot.name}.png\n`)
  }
} finally {
  await browser.close()
  await server.close()
  await examples.close()
}
