// Captures the Dropdown Menu, Context Menu, Menubar and Navigation Menu
// examples in headless Chromium for UI reviews: a menu of each family open in
// both themes on desktop and narrow screens, a menu and its submenu opened
// from the keyboard, a context menu at the pointer, a menubar menu moved to
// with the arrows, a navigation panel under the pointer, forced colors,
// right-to-left text, a menu at 320px with text at 200%, and a navigation
// panel the browser opens natively without JavaScript.
// Run `bun run capture:menu-examples`.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'
import type { Page } from 'playwright'
import { createTestServer } from 'remix/node-fetch-server/test'

import { createMenuExamples } from './server.tsx'

interface Shot {
  name: string
  path?: string
  width: number
  colorScheme: 'light' | 'dark'
  forcedColors?: 'active'
  // The root font size, such as 32px for text at 200%.
  fontSize?: string
  javaScript?: boolean
  // Capture only this section or example, with the menus open inside it, after an optional interaction.
  section?: string
  example?: string
  // Capture the window as it is, such as a panel the browser centers in it.
  viewport?: boolean
  prepare?: (page: Page) => Promise<void>
}

/** Tabs from the example's heading to its first control. */
async function tabInto(page: Page, example: string) {
  await page.locator(`[data-example="${example}"] h3`).click()
  await page.keyboard.press('Tab')
}

async function waitOpen(page: Page, selector: string) {
  await page.waitForFunction(
    (selector) => [...document.querySelectorAll(selector)].some((element) => element.matches(':popover-open')),
    selector,
  )
}

const desktop = 1280
const narrow = 390
const shots: Shot[] = [
  { name: 'desktop-light', path: '/open', width: desktop, colorScheme: 'light' },
  { name: 'desktop-dark', path: '/open', width: desktop, colorScheme: 'dark' },
  { name: 'narrow-light', path: '/open', width: narrow, colorScheme: 'light', section: 'open' },
  { name: 'narrow-dark', path: '/open', width: narrow, colorScheme: 'dark', section: 'open' },
  {
    name: 'dropdown-submenu-keyboard-dark',
    width: desktop,
    colorScheme: 'dark',
    example: 'dropdown-submenu',
    async prepare(page) {
      // Enter opens it at the first item; the arrows reach the submenu and open it.
      await tabInto(page, 'dropdown-submenu')
      await page.keyboard.press('Enter')
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('ArrowRight')
      await waitOpen(page, '[data-example="dropdown-submenu"] [data-slot="dropdown-menu-sub-content"]')
      await page.keyboard.press('ArrowDown')
    },
  },
  {
    name: 'dropdown-checkboxes-light',
    width: desktop,
    colorScheme: 'light',
    example: 'dropdown-checkboxes',
    async prepare(page) {
      await page.locator('[data-example="dropdown-checkboxes"] [data-slot="dropdown-menu-trigger"]').click()
      await page.getByRole('menuitemcheckbox', { name: 'Panel' }).hover()
    },
  },
  {
    name: 'context-menu-right-click-light',
    width: desktop,
    colorScheme: 'light',
    example: 'context-icons',
    async prepare(page) {
      let area = page.locator('[data-example="context-icons"] [data-slot="context-menu-trigger"]')
      await area.click({ button: 'right', position: { x: 60, y: 30 } })
      await waitOpen(page, '[data-example="context-icons"] [data-slot="context-menu-content"]')
      await page.getByRole('menuitem', { name: 'Copy' }).hover()
    },
  },
  {
    name: 'menubar-keyboard-light',
    width: desktop,
    colorScheme: 'light',
    example: 'menubar-basic',
    async prepare(page) {
      // Arrow Down opens File; Arrow Right moves to Edit, then to View.
      await tabInto(page, 'menubar-basic')
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('ArrowRight')
      await page.keyboard.press('ArrowRight')
      await waitOpen(page, '[data-example="menubar-basic"] [data-slot="menubar-content"]')
    },
  },
  {
    name: 'navigation-menu-hover-light',
    width: desktop,
    colorScheme: 'light',
    example: 'navigation-basic',
    async prepare(page) {
      await page.locator('[data-example="navigation-basic"]').getByRole('button', { name: 'Reports' }).hover()
      await waitOpen(page, '[data-example="navigation-basic"] [data-slot="navigation-menu-content"]')
    },
  },
  {
    name: 'forced-colors',
    path: '/open',
    width: desktop,
    colorScheme: 'light',
    forcedColors: 'active',
    section: 'open',
  },
  { name: 'right-to-left-dark', path: '/open', width: desktop, colorScheme: 'dark', section: 'right-to-left' },
  {
    name: 'dropdown-320-text-200-light',
    width: 320,
    colorScheme: 'light',
    fontSize: '32px',
    viewport: true,
    async prepare(page) {
      await tabInto(page, 'dropdown-complex')
      await page.keyboard.press('Enter')
      await waitOpen(page, '[data-example="dropdown-complex"] [data-slot="dropdown-menu-content"]')
    },
  },
  {
    name: 'without-javascript-light',
    width: desktop,
    colorScheme: 'light',
    javaScript: false,
    viewport: true,
    async prepare(page) {
      let trigger = page.locator('[data-example="server-navigation"] [data-slot="navigation-menu-trigger"]')
      await trigger.scrollIntoViewIfNeeded()
      await trigger.click()
    },
  },
]

const output = fileURLToPath(new URL('../../../docs/images/menus/', import.meta.url))
mkdirSync(output, { recursive: true })

let examples = await createMenuExamples()
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
    await page.goto(new URL(shot.path ?? '/', server.baseUrl).href)
    if (javaScript) await page.locator('html[data-ready]').waitFor({ state: 'attached' })
    if (shot.fontSize) await page.locator('html').evaluate((html, size) => (html.style.fontSize = size), shot.fontSize)

    // A viewport as tall as the page keeps every menu beside its trigger in the picture.
    // The page loads again at that size, so menus open from the start find their room.
    if (!shot.viewport) {
      let height = await page.evaluate(() => document.documentElement.scrollHeight)
      await page.setViewportSize({ width: shot.width, height })
      await page.reload()
      if (javaScript) await page.locator('html[data-ready]').waitFor({ state: 'attached' })
      if (shot.fontSize)
        await page.locator('html').evaluate((html, size) => (html.style.fontSize = size), shot.fontSize)
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
      // The box of the target and of every menu open inside it, with a margin for focus rings.
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
    process.stdout.write(`✓ docs/images/menus/${shot.name}.png\n`)
  }
} finally {
  await browser.close()
  await server.close()
  await examples.close()
}
