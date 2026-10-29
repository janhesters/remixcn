// Captures the Code Block examples in headless Chromium for UI reviews:
// desktop and narrow pages in both themes, a copy button that copied while it
// has keyboard focus in dark mode, a refused copy, the floating actions on
// hover, the marked lines and a focused block in forced colors, the content on
// a narrow screen with text at 200%, and right-to-left text in dark mode.
// Run `bun run capture:code-block-examples`.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'
import type { Page } from 'playwright'
import { createTestServer } from 'remix/node-fetch-server/test'

import { createCodeBlockExamples } from './server.tsx'

interface Shot {
  name: string
  width: number
  colorScheme: 'light' | 'dark'
  forcedColors?: 'active'
  // The root font size, such as 32px for text at 200%.
  fontSize?: string
  // What the clipboard answers: the screenshots never touch the real one.
  clipboard?: 'resolve' | 'reject'
  // Capture only this element, after preparing its state.
  clip?: string
  prepare?: (page: Page) => Promise<void>
}

const desktop = 1280
const narrow = 390

function example(page: Page, title: string) {
  return page.locator(`[data-example="${title}"]`).first()
}

/** Focuses a copy button with the keyboard, so it shows its focus ring, and presses Enter. */
async function copyWithKeyboard(page: Page, title: string) {
  let button = example(page, title).locator('[data-slot="code-block-copy-button"]')
  await button.focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
}

const shots: Shot[] = [
  { name: 'desktop-light', width: desktop, colorScheme: 'light' },
  { name: 'desktop-dark', width: desktop, colorScheme: 'dark' },
  { name: 'narrow-light', width: narrow, colorScheme: 'light' },
  { name: 'narrow-dark', width: narrow, colorScheme: 'dark' },
  {
    name: 'copied-focus-dark',
    width: desktop,
    colorScheme: 'dark',
    clipboard: 'resolve',
    clip: '[data-example="Header"]',
    async prepare(page) {
      await copyWithKeyboard(page, 'Header')
      await example(page, 'Header').getByRole('status').getByText('Copied').waitFor()
    },
  },
  {
    name: 'copy-failed-light',
    width: desktop,
    colorScheme: 'light',
    clipboard: 'reject',
    clip: '[data-example="Floating actions"]',
    async prepare(page) {
      await copyWithKeyboard(page, 'Floating actions')
      await example(page, 'Floating actions').getByRole('status').getByText("Couldn't copy").waitFor()
    },
  },
  {
    name: 'floating-hover-light',
    width: desktop,
    colorScheme: 'light',
    clip: '[data-example="Header edges"]',
    async prepare(page) {
      await example(page, 'Header edges').locator('[data-slot="code-block"]').nth(1).hover()
    },
  },
  {
    name: 'lines-focus-forced-colors',
    width: desktop,
    colorScheme: 'light',
    forcedColors: 'active',
    clip: '[aria-labelledby="lines"]',
    async prepare(page) {
      await example(page, 'Diff').locator('pre').focus()
      await page.keyboard.press('Shift+Tab')
      await page.keyboard.press('Tab')
    },
  },
  {
    name: 'narrow-text-200-light',
    width: narrow,
    colorScheme: 'light',
    fontSize: '32px',
    clip: '[aria-labelledby="actions"]',
  },
  { name: 'right-to-left-dark', width: desktop, colorScheme: 'dark', clip: '[aria-labelledby="direction"]' },
]

const output = fileURLToPath(new URL('../../../docs/images/code-block/', import.meta.url))
mkdirSync(output, { recursive: true })

let examples = await createCodeBlockExamples()
let server = await createTestServer(examples.fetch)
// Playwright hides scrollbars by default. Showing them shows which code scrolls.
let browser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] })

try {
  for (let shot of shots) {
    let page = await browser.newPage({ viewport: { width: shot.width, height: 900 } })
    await page.emulateMedia({
      colorScheme: shot.colorScheme,
      forcedColors: shot.forcedColors ?? 'none',
      reducedMotion: 'reduce',
    })
    if (shot.clipboard) {
      await page.addInitScript((answer) => {
        navigator.clipboard.writeText = () =>
          answer === 'resolve' ? Promise.resolve() : Promise.reject(new DOMException('Denied', 'NotAllowedError'))
      }, shot.clipboard)
    }
    // A paused clock keeps the copied state until the picture is taken.
    await page.clock.install()
    await page.goto(server.baseUrl)
    await page.locator('html[data-ready]').waitFor({ state: 'attached' })
    if (shot.fontSize) await page.evaluate((size) => (document.documentElement.style.fontSize = size), shot.fontSize)
    await shot.prepare?.(page)

    // A full-page screenshot drops the scrollbars of inner scrollers, so the
    // viewport grows to the page's height instead, and a clip counts from its top.
    let height = await page.evaluate(() => document.documentElement.scrollHeight)
    await page.setViewportSize({ width: shot.width, height })
    let path = `${output}${shot.name}.png`
    if (shot.clip) {
      // A margin keeps the focus ring, which sits outside the part, in the picture.
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
      await page.screenshot({ path, clip })
    } else {
      await page.screenshot({ path })
    }

    await page.close()
    process.stdout.write(`✓ docs/images/code-block/${shot.name}.png\n`)
  }
} finally {
  await browser.close()
  await server.close()
  await examples.close()
}
