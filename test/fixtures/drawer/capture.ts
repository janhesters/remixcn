// Captures the Drawer examples in headless Chromium for UI reviews: the page
// and an open drawer at desktop and narrow widths in both themes, the other
// edges with their swipe handles, a drag in progress, both snap points,
// nested drawers, a drawer beside the page, keyboard focus in forced colors,
// a narrow screen with text at 200%, and right-to-left text.
// Run `bun run capture:drawer-examples`.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'
import type { Page } from 'playwright'
import { createTestServer } from 'remix/node-fetch-server/test'

import { createDrawerExamples } from './server.tsx'

interface Shot {
  name: string
  width: number
  colorScheme: 'light' | 'dark'
  forcedColors?: 'active'
  // The root font size, such as 32px for text at 200%.
  fontSize?: string
  // Capture the whole page instead of the viewport with the open drawer.
  fullPage?: boolean
  prepare?: (page: Page) => Promise<void>
}

const desktop = 1280
const narrow = 390

/** Opens the trigger named `name` in the example titled `example`, and waits until focus moved inside. */
function openFrom(example: string, name: string, { keyboard = false, section = 'drawer' } = {}) {
  return async (page: Page) => {
    let trigger = page
      .locator(`section[aria-labelledby="${section}"] [data-example="${example}"]`)
      .getByRole('button', { name, exact: true })
    if (keyboard) {
      await trigger.focus()
      await page.keyboard.press('Enter')
    } else {
      await trigger.click()
    }
    await page.waitForFunction(() => document.activeElement?.closest('dialog[open]'))
  }
}

async function handleCenter(page: Page) {
  let box = await page.locator('dialog[open] [data-slot="drawer-swipe-handle"]').last().boundingBox()
  if (!box) throw new Error('no swipe handle on the screen')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

const shots: Shot[] = [
  { name: 'page-desktop-light', width: desktop, colorScheme: 'light', fullPage: true },
  { name: 'page-desktop-dark', width: desktop, colorScheme: 'dark', fullPage: true },
  { name: 'page-narrow-light', width: narrow, colorScheme: 'light', fullPage: true },
  { name: 'page-narrow-dark', width: narrow, colorScheme: 'dark', fullPage: true },
  { name: 'drawer-desktop-light', width: desktop, colorScheme: 'light', prepare: openFrom('Demo', 'Pay invoice') },
  { name: 'drawer-desktop-dark', width: desktop, colorScheme: 'dark', prepare: openFrom('With form', 'Edit customer') },
  { name: 'drawer-narrow-light', width: narrow, colorScheme: 'light', prepare: openFrom('With form', 'Edit customer') },
  { name: 'drawer-narrow-dark', width: narrow, colorScheme: 'dark', prepare: openFrom('Demo', 'Pay invoice') },
  {
    name: 'right-handle-desktop-light',
    width: desktop,
    colorScheme: 'light',
    prepare: openFrom('Swipe handle', 'Right'),
  },
  { name: 'left-narrow-dark', width: narrow, colorScheme: 'dark', prepare: openFrom('Swipe handle', 'Left') },
  { name: 'up-desktop-dark', width: desktop, colorScheme: 'dark', prepare: openFrom('Scrollable content', 'Up') },
  {
    name: 'dragging-narrow-light',
    width: narrow,
    colorScheme: 'light',
    async prepare(page) {
      await openFrom('Swipe handle', 'Down')(page)
      let handle = await handleCenter(page)
      await page.mouse.move(handle.x, handle.y)
      await page.mouse.down()
      await page.mouse.move(handle.x, handle.y + 160, { steps: 16 })
    },
  },
  {
    name: 'snap-peek-narrow-light',
    width: narrow,
    colorScheme: 'light',
    prepare: openFrom('Snap points', 'Open invoices'),
  },
  {
    name: 'snap-full-narrow-dark',
    width: narrow,
    colorScheme: 'dark',
    async prepare(page) {
      await openFrom('Snap points', 'Open invoices')(page)
      await page.locator('dialog[open]').getByRole('button', { name: 'Full height' }).click()
      await page.waitForFunction(() => document.querySelector('dialog[open]')?.hasAttribute('data-expanded'))
    },
  },
  {
    name: 'snap-peek-desktop-dark',
    width: desktop,
    colorScheme: 'dark',
    prepare: openFrom('Snap points', 'Open invoices'),
  },
  {
    name: 'nested-desktop-dark',
    width: desktop,
    colorScheme: 'dark',
    async prepare(page) {
      await openFrom('Nested', 'Down')(page)
      await page.locator('dialog[open]').last().getByRole('button', { name: 'Open payment' }).click()
      await page.locator('dialog[open]').last().getByRole('button', { name: 'Open transfer' }).click()
      await page.waitForFunction(() => document.querySelectorAll('dialog[open]').length === 3)
    },
  },
  {
    name: 'nested-right-narrow-light',
    width: narrow,
    colorScheme: 'light',
    async prepare(page) {
      await openFrom('Nested', 'Right')(page)
      await page.locator('dialog[open]').last().getByRole('button', { name: 'Open payment' }).click()
      await page.waitForFunction(() => document.querySelectorAll('dialog[open]').length === 2)
    },
  },
  {
    name: 'not-modal-desktop-light',
    width: desktop,
    colorScheme: 'light',
    prepare: openFrom('Not modal', 'Not modal'),
  },
  {
    name: 'drawer-focus-forced-colors',
    width: desktop,
    colorScheme: 'light',
    forcedColors: 'active',
    async prepare(page) {
      await openFrom('Swipe handle', 'Down', { keyboard: true })(page)
      await page.keyboard.press('Tab')
    },
  },
  {
    name: 'drawer-narrow-text-200-light',
    width: narrow,
    colorScheme: 'light',
    fontSize: '32px',
    prepare: openFrom('With form', 'Edit customer'),
  },
  {
    name: 'rtl-right-desktop-light',
    width: desktop,
    colorScheme: 'light',
    prepare: openFrom('درج', 'Right', { section: 'direction' }),
  },
  {
    name: 'rtl-snap-narrow-dark',
    width: narrow,
    colorScheme: 'dark',
    prepare: openFrom('نقاط', 'Open invoices', { section: 'direction' }),
  },
]

const output = fileURLToPath(new URL('../../../docs/images/drawer/', import.meta.url))
mkdirSync(output, { recursive: true })

let examples = await createDrawerExamples()
let server = await createTestServer(examples.fetch)
let browser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] })

try {
  for (let shot of shots) {
    let page = await browser.newPage({ viewport: { width: shot.width, height: 820 } })
    await page.emulateMedia({
      colorScheme: shot.colorScheme,
      forcedColors: shot.forcedColors ?? 'none',
      reducedMotion: 'reduce',
    })
    await page.goto(server.baseUrl)
    await page.locator('html[data-ready]').waitFor({ state: 'attached' })
    if (shot.fontSize) await page.evaluate((size) => (document.documentElement.style.fontSize = size), shot.fontSize)
    await shot.prepare?.(page)

    await page.screenshot({ path: `${output}${shot.name}.png`, fullPage: shot.fullPage ?? false })
    await page.close()
    process.stdout.write(`✓ docs/images/drawer/${shot.name}.png\n`)
  }
} finally {
  await browser.close()
  await server.close()
  await examples.close()
}
