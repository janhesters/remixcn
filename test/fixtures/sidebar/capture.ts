// Captures the Sidebar examples in headless Chromium for UI reviews: the
// gallery of every example in both themes, the documentation sidebar on a
// wide and a narrow screen in both themes, its sheet open, the app sidebar
// collapsed to icons with a label's tooltip, the variants, right-to-left
// text, forced colors, the sheet at 320px with text at 200%, and the narrow
// page without JavaScript. Run `bun run capture:sidebar-examples`.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'
import type { Page } from 'playwright'
import { createTestServer } from 'remix/node-fetch-server/test'

import { createSidebarExamples } from './server.tsx'

interface Shot {
  name: string
  path: string
  width: number
  height?: number
  colorScheme: 'light' | 'dark'
  forcedColors?: 'active'
  // The root font size, such as 32px for text at 200%.
  fontSize?: string
  javaScript?: boolean
  // The whole page instead of the window, for the gallery and the page without JavaScript.
  fullPage?: boolean
  prepare?: (page: Page) => Promise<void>
}

async function openSheet(page: Page) {
  await page.locator('[data-slot="sidebar-trigger"]').click()
  await page.locator('dialog[data-slot="sidebar"][open]').waitFor()
}

async function collapseWithTooltip(page: Page) {
  await page.keyboard.press('Control+b')
  await page.locator('[data-slot="sidebar"][data-state="collapsed"]').waitFor({ state: 'attached' })
  await page.getByRole('link', { name: 'Invoices' }).hover()
  await page.locator('[data-slot="tooltip-content"]:popover-open').waitFor()
}

const desktop = 1280
const narrow = 390
const shots: Shot[] = [
  { name: 'gallery-light', path: '/', width: desktop, colorScheme: 'light', fullPage: true },
  { name: 'gallery-dark', path: '/?theme=dark', width: desktop, colorScheme: 'dark', fullPage: true },
  { name: 'docs-desktop-light', path: '/docs', width: desktop, colorScheme: 'light' },
  { name: 'docs-desktop-dark', path: '/docs', width: desktop, colorScheme: 'dark' },
  { name: 'docs-narrow-light', path: '/docs', width: narrow, colorScheme: 'light' },
  { name: 'docs-narrow-dark', path: '/docs', width: narrow, colorScheme: 'dark' },
  { name: 'docs-sheet-narrow-light', path: '/docs', width: narrow, colorScheme: 'light', prepare: openSheet },
  { name: 'docs-sheet-narrow-dark', path: '/docs', width: narrow, colorScheme: 'dark', prepare: openSheet },
  {
    name: 'icons-collapsed-tooltip-light',
    path: '/icons',
    width: desktop,
    colorScheme: 'light',
    prepare: collapseWithTooltip,
  },
  {
    name: 'icons-collapsed-tooltip-dark',
    path: '/icons',
    width: desktop,
    colorScheme: 'dark',
    prepare: collapseWithTooltip,
  },
  {
    name: 'icons-keyboard-focus-light',
    path: '/icons?page=projects/atlas',
    width: desktop,
    colorScheme: 'light',
    async prepare(page) {
      // Focus on a project row shows its hidden action; the badge and the submenu's chevron stay in place.
      await page.getByRole('link', { name: 'Customers' }).focus()
      await page.keyboard.press('Tab')
      await page.keyboard.press('Shift+Tab')
      await page.getByRole('link', { name: 'Atlas' }).focus()
      await page.keyboard.press('Tab')
    },
  },
  { name: 'floating-right-light', path: '/floating', width: desktop, colorScheme: 'light' },
  { name: 'inset-dark', path: '/inset', width: desktop, colorScheme: 'dark' },
  {
    name: 'controlled-collapsed-light',
    path: '/controlled',
    width: desktop,
    colorScheme: 'light',
    async prepare(page) {
      await page.getByLabel('Show sidebar').click()
      await page.locator('[data-slot="sidebar"][data-state="collapsed"]').waitFor({ state: 'attached' })
    },
  },
  { name: 'settings-light', path: '/settings', width: desktop, colorScheme: 'light' },
  { name: 'right-to-left-dark', path: '/icons?dir=rtl', width: desktop, colorScheme: 'dark' },
  {
    name: 'forced-colors',
    path: '/icons',
    width: desktop,
    colorScheme: 'light',
    forcedColors: 'active',
    async prepare(page) {
      await page.getByRole('link', { name: 'Customers' }).focus()
      await page.keyboard.press('Tab')
      await page.keyboard.press('Shift+Tab')
    },
  },
  {
    name: 'sheet-320-text-200-light',
    path: '/icons',
    width: 320,
    height: 640,
    colorScheme: 'light',
    fontSize: '32px',
    prepare: openSheet,
  },
  {
    name: 'without-javascript-narrow-light',
    path: '/icons',
    width: narrow,
    colorScheme: 'light',
    javaScript: false,
    fullPage: true,
  },
]

const output = fileURLToPath(new URL('../../../docs/images/sidebar/', import.meta.url))
mkdirSync(output, { recursive: true })

let examples = await createSidebarExamples()
let server = await createTestServer(examples.fetch)
let browser = await chromium.launch()

try {
  for (let shot of shots) {
    let javaScript = shot.javaScript ?? true
    let page = await browser.newPage({
      viewport: { width: shot.width, height: shot.height ?? 800 },
      javaScriptEnabled: javaScript,
    })
    await page.emulateMedia({
      colorScheme: shot.colorScheme,
      forcedColors: shot.forcedColors ?? 'none',
      reducedMotion: 'reduce',
    })
    await page.goto(new URL(shot.path, server.baseUrl).href)
    if (javaScript && shot.path !== '/' && !shot.path.startsWith('/?')) {
      await page.locator('html[data-ready]').waitFor({ state: 'attached' })
    }
    if (shot.path === '/' || shot.path.startsWith('/?')) {
      // Every frame's page hydrated.
      await page.waitForFunction(() =>
        [...document.querySelectorAll('iframe')].every(
          (frame) => frame.contentDocument?.documentElement.dataset.ready === 'true',
        ),
      )
    }
    if (shot.fontSize) await page.locator('html').evaluate((html, size) => (html.style.fontSize = size), shot.fontSize)
    // Keeps the pointer off the rail at the window's corner.
    if (javaScript) await page.mouse.move(shot.width - 1, 1)
    await shot.prepare?.(page)
    if (javaScript) {
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    }

    await page.screenshot({ path: `${output}${shot.name}.png`, fullPage: shot.fullPage ?? false })
    await page.close()
    process.stdout.write(`✓ docs/images/sidebar/${shot.name}.png\n`)
  }
} finally {
  await browser.close()
  await server.close()
  await examples.close()
}
