// Captures the Accordion, Collapsible, Tabs and Pagination examples in
// headless Chromium for UI reviews: desktop and narrow pages in both themes,
// then open and focused states: an open accordion item with keyboard focus
// in dark mode, an expanded file tree, a focused line tab in forced colors,
// right-to-left text in dark mode, and the Tabs section on a narrow screen
// with text at 200%. Run `bun run capture:disclosure-examples`.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'
import type { Page } from 'playwright'
import { createTestServer } from 'remix/node-fetch-server/test'

import { createDisclosureExamples } from './server.tsx'

interface Shot {
  name: string
  width: number
  colorScheme: 'light' | 'dark'
  forcedColors?: 'active'
  // The root font size, such as 32px for text at 200%.
  fontSize?: string
  // Capture only this element, after preparing its state.
  clip?: string
  prepare?: (page: Page) => Promise<void>
}

const desktop = 1280
const narrow = 390

function example(page: Page, title: string) {
  return page.locator(`[data-example="${title}"]`).first()
}

const shots: Shot[] = [
  { name: 'desktop-light', width: desktop, colorScheme: 'light' },
  { name: 'desktop-dark', width: desktop, colorScheme: 'dark' },
  { name: 'narrow-light', width: narrow, colorScheme: 'light' },
  { name: 'narrow-dark', width: narrow, colorScheme: 'dark' },
  {
    name: 'accordion-open-focus-dark',
    width: desktop,
    colorScheme: 'dark',
    clip: '[data-example="With borders"]',
    async prepare(page) {
      let trigger = example(page, 'With borders').getByRole('button', { name: 'Is my data secure?' })
      await trigger.focus()
      await page.keyboard.press('Enter')
      await page.keyboard.press('Tab')
      await page.keyboard.press('Shift+Tab')
    },
  },
  {
    name: 'file-tree-expanded-light',
    width: desktop,
    colorScheme: 'light',
    clip: '[data-example="File tree"]',
    async prepare(page) {
      let tree = example(page, 'File tree')
      await tree.getByRole('button', { name: 'invoices' }).click()
      await tree.getByRole('button', { name: 'templates' }).click()
      await tree.getByRole('button', { name: 'payments' }).click()
    },
  },
  {
    name: 'tabs-focus-forced-colors',
    width: desktop,
    colorScheme: 'light',
    forcedColors: 'active',
    clip: '[data-example="Line with content"]',
    async prepare(page) {
      let tabs = example(page, 'Line with content')
      await tabs.getByRole('tab', { name: 'Account' }).focus()
      await page.keyboard.press('ArrowRight')
    },
  },
  {
    name: 'right-to-left-dark',
    width: desktop,
    colorScheme: 'dark',
    clip: '[aria-labelledby="direction"]',
    async prepare(page) {
      let direction = page.locator('[aria-labelledby="direction"]')
      await direction.getByRole('button', { name: 'Is my data secure?' }).click()
      await direction.getByRole('tab', { name: 'Password' }).first().click()
    },
  },
  {
    name: 'narrow-text-200-light',
    width: narrow,
    colorScheme: 'light',
    fontSize: '32px',
    clip: '[aria-labelledby="tabs"]',
  },
]

const output = fileURLToPath(new URL('../../../docs/images/disclosure/', import.meta.url))
mkdirSync(output, { recursive: true })

let examples = await createDisclosureExamples()
let server = await createTestServer(examples.fetch)
let browser = await chromium.launch()

try {
  for (let shot of shots) {
    let page = await browser.newPage({ viewport: { width: shot.width, height: 900 } })
    await page.emulateMedia({
      colorScheme: shot.colorScheme,
      forcedColors: shot.forcedColors ?? 'none',
      reducedMotion: 'reduce',
    })
    await page.goto(server.baseUrl)
    await page.locator('html[data-ready]').waitFor({ state: 'attached' })
    if (shot.fontSize) await page.evaluate((size) => (document.documentElement.style.fontSize = size), shot.fontSize)
    await shot.prepare?.(page)

    let path = `${output}${shot.name}.png`
    if (shot.clip) {
      // A margin keeps the focus ring, which sits outside the part, in the picture.
      // A full-page clip counts from the top of the page, not of the scrolled viewport.
      let clip = await page
        .locator(shot.clip)
        .first()
        .evaluate((element) => {
          let box = element.getBoundingClientRect()
          let margin = 16
          return {
            x: Math.max(0, box.x + window.scrollX - margin),
            y: Math.max(0, box.y + window.scrollY - margin),
            width: box.width + 2 * margin,
            height: box.height + 2 * margin,
          }
        })
      await page.screenshot({ path, clip, fullPage: true })
    } else {
      await page.screenshot({ path, fullPage: true })
    }

    await page.close()
    process.stdout.write(`✓ docs/images/disclosure/${shot.name}.png\n`)
  }
} finally {
  await browser.close()
  await server.close()
  await examples.close()
}
