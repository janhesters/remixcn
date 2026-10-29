// Captures the Toast and Sonner examples in headless Chromium for UI reviews:
// desktop and narrow pages in both themes with a stack of toasts, the stack
// expanded under the pointer, a focused urgent toast in dark mode, Sonner's
// toasts, a focused toast in forced colors, right-to-left toasts, and the
// narrow stack with text at 200%. Run `bun run capture:toast-examples`.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'
import type { Page } from 'playwright'
import { createTestServer } from 'remix/node-fetch-server/test'

import { createToastExamples } from './server.tsx'

interface Shot {
  name: string
  width: number
  height?: number
  colorScheme: 'light' | 'dark'
  forcedColors?: 'active'
  // The root font size, such as 32px for text at 200%.
  fontSize?: string
  prepare: (page: Page) => Promise<void>
}

const desktop = 1280
const narrow = 390

function example(page: Page, title: string) {
  return page.locator(`[data-example="${title}"]`)
}

/** Presses an example's button. Open toasts may cover it, as they cover any page, so this skips the pointer. */
async function press(page: Page, title: string, name?: string) {
  let buttons = example(page, title).getByRole('button', name ? { name } : {})
  await buttons.first().dispatchEvent('click')
}

/** Shows three toasts in the page's Toaster: an action, a success and a basic one in front. */
async function showStack(page: Page) {
  await press(page, 'With action')
  await press(page, 'Types', 'Success')
  await press(page, 'Basic')
}

async function settle(page: Page) {
  // Reduced motion leaves no transition, but measuring and stacking take a frame or two.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

const shots: Shot[] = [
  { name: 'desktop-light', width: desktop, colorScheme: 'light', prepare: showStack },
  { name: 'desktop-dark', width: desktop, colorScheme: 'dark', prepare: showStack },
  { name: 'narrow-light', width: narrow, colorScheme: 'light', prepare: showStack },
  { name: 'narrow-dark', width: narrow, colorScheme: 'dark', prepare: showStack },
  {
    name: 'expanded-light',
    width: desktop,
    colorScheme: 'light',
    async prepare(page) {
      await showStack(page)
      await page.getByRole('region', { name: 'Notifications (F6)' }).getByRole('dialog').first().hover()
    },
  },
  {
    name: 'urgent-focus-dark',
    width: desktop,
    colorScheme: 'dark',
    async prepare(page) {
      await press(page, 'Basic')
      await press(page, 'Persistent')
      // F6 moves keyboard focus to the newest toast, which opens the stack.
      await page.keyboard.press('F6')
      await page.keyboard.press('Tab')
    },
  },
  {
    name: 'sonner-light',
    width: desktop,
    colorScheme: 'light',
    async prepare(page) {
      await press(page, 'Sonner with description')
      await press(page, 'Sonner types', 'Error')
      await press(page, 'Sonner with action')
      await press(page, 'Sonner custom')
      // The stack opens under the pointer, so the three newest show.
      await page.getByRole('region', { name: 'Notifications (Alt+T)' }).getByRole('dialog').first().hover()
    },
  },
  {
    name: 'focus-forced-colors',
    width: desktop,
    colorScheme: 'light',
    forcedColors: 'active',
    async prepare(page) {
      await showStack(page)
      await page.keyboard.press('F6')
    },
  },
  {
    name: 'right-to-left-dark',
    width: desktop,
    colorScheme: 'dark',
    async prepare(page) {
      await press(page, 'Right to left')
      await press(page, 'Own provider')
    },
  },
  {
    name: 'narrow-text-200-light',
    width: 320,
    colorScheme: 'light',
    fontSize: '32px',
    async prepare(page) {
      await showStack(page)
      await page.getByRole('region', { name: 'Notifications (F6)' }).getByRole('dialog').first().hover()
    },
  },
]

const output = fileURLToPath(new URL('../../../docs/images/toast/', import.meta.url))
mkdirSync(output, { recursive: true })

let examples = await createToastExamples()
let server = await createTestServer(examples.fetch)
let browser = await chromium.launch()

try {
  for (let shot of shots) {
    let page = await browser.newPage({ viewport: { width: shot.width, height: shot.height ?? 800 } })
    await page.emulateMedia({
      colorScheme: shot.colorScheme,
      forcedColors: shot.forcedColors ?? 'none',
      reducedMotion: 'reduce',
    })
    // A paused clock keeps every toast open until the picture is taken.
    await page.clock.install()
    await page.goto(server.baseUrl)
    await page.locator('html[data-ready]').waitFor({ state: 'attached' })
    if (shot.fontSize) await page.evaluate((size) => (document.documentElement.style.fontSize = size), shot.fontSize)
    await shot.prepare(page)
    await settle(page)

    // The toasts are fixed to the window, so the picture is the window.
    await page.screenshot({ path: `${output}${shot.name}.png` })
    await page.close()
    process.stdout.write(`✓ docs/images/toast/${shot.name}.png\n`)
  }
} finally {
  await browser.close()
  await server.close()
  await examples.close()
}
