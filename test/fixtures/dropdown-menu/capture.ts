// Captures the Dropdown Menu theme picker in headless Chromium for UI reviews:
// the desktop and phone pages in both themes with a picker open and its check
// mark showing, the example open, keyboard focus on a choice the check isn't
// on in both themes, forced colors, right-to-left text, a picker at the
// window's edge on a phone, at 320px with text at 200%, and the native menu a
// page without JavaScript opens. Run `bun run capture:dropdown-menu-examples`.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'
import type { Page } from 'playwright'
import { createTestServer } from 'remix/node-fetch-server/test'

import { createDropdownMenuExamples } from './server.tsx'

interface Shot {
  name: string
  width: number
  colorScheme: 'light' | 'dark'
  forcedColors?: 'active'
  // The root font size, such as 32px for text at 200%.
  fontSize?: string
  javaScript?: boolean
  // Capture only this section or example, with the menus open inside it, after an optional interaction.
  section?: string
  example?: string
  // Capture the window as it is.
  viewport?: boolean
  prepare?: (page: Page) => Promise<void>
}

function trigger(page: Page, example: string, index = 0) {
  return page.locator(`[data-example="${example}"] [data-slot="dropdown-menu-trigger"]`).nth(index)
}

async function waitOpen(page: Page, example: string) {
  await page.locator(`[data-example="${example}"] [data-slot="dropdown-menu-content"][data-open]`).first().waitFor()
}

// A menu opened from the keyboard focuses its first choice on the next frame.
async function waitFocusIn(page: Page, example: string) {
  await page.locator(`[data-example="${example}"] [role="menuitemradio"]:focus`).waitFor()
}

async function openWithKeyboard(page: Page, example: string) {
  await trigger(page, example).focus()
  await page.keyboard.press('Enter')
  await waitOpen(page, example)
  await waitFocusIn(page, example)
}

const desktop = 1280
const phone = 390
const shots: Shot[] = [
  { name: 'desktop-light', width: desktop, colorScheme: 'light' },
  { name: 'desktop-dark', width: desktop, colorScheme: 'dark' },
  { name: 'phone-light', width: phone, colorScheme: 'light' },
  { name: 'phone-dark', width: phone, colorScheme: 'dark' },
  {
    name: 'theme-picker-open-light',
    width: desktop,
    colorScheme: 'light',
    example: 'theme',
    async prepare(page) {
      await trigger(page, 'theme').click()
      await waitOpen(page, 'theme')
    },
  },
  {
    name: 'theme-picker-open-dark',
    width: desktop,
    colorScheme: 'dark',
    example: 'theme',
    async prepare(page) {
      await trigger(page, 'theme').click()
      await waitOpen(page, 'theme')
    },
  },
  ...(['light', 'dark'] as const).map((colorScheme): Shot => ({
    name: `keyboard-focus-${colorScheme}`,
    width: desktop,
    colorScheme,
    example: 'theme',
    // Light takes focus with the ring, while the check stays on System.
    prepare: (page) => openWithKeyboard(page, 'theme'),
  })),
  {
    name: 'forced-colors',
    width: desktop,
    colorScheme: 'light',
    forcedColors: 'active',
    example: 'theme',
    async prepare(page) {
      await openWithKeyboard(page, 'theme')
      await page.keyboard.press('ArrowDown')
    },
  },
  {
    name: 'right-to-left-dark',
    width: desktop,
    colorScheme: 'dark',
    section: 'direction',
    async prepare(page) {
      await trigger(page, 'rtl').scrollIntoViewIfNeeded()
      await openWithKeyboard(page, 'rtl')
    },
  },
  {
    name: 'edge-phone-light',
    width: phone,
    colorScheme: 'light',
    viewport: true,
    async prepare(page) {
      await trigger(page, 'edges', 1).scrollIntoViewIfNeeded()
      await trigger(page, 'edges', 1).click()
      await waitOpen(page, 'edges')
    },
  },
  {
    name: 'picker-320-text-200-light',
    width: 320,
    colorScheme: 'light',
    fontSize: '32px',
    viewport: true,
    async prepare(page) {
      await trigger(page, 'edges', 1).scrollIntoViewIfNeeded()
      await trigger(page, 'edges', 1).click()
      await waitOpen(page, 'edges')
    },
  },
  {
    name: 'without-javascript-light',
    width: desktop,
    colorScheme: 'light',
    javaScript: false,
    viewport: true,
    async prepare(page) {
      await trigger(page, 'server-only').scrollIntoViewIfNeeded()
      await trigger(page, 'server-only').click()
      await page.locator('[data-example="server-only"] [data-slot="dropdown-menu-content"]:popover-open').waitFor()
    },
  },
]

const output = fileURLToPath(new URL('../../../docs/images/dropdown-menu/', import.meta.url))
mkdirSync(output, { recursive: true })

let examples = await createDropdownMenuExamples()
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

    // A viewport as tall as the page keeps every menu beside its trigger in the picture.
    // The page loads again at that height: a menu open from the start that flipped
    // above its trigger keeps that side while it fits, as CSS anchor positioning does.
    if (!shot.viewport) {
      let height = await page.evaluate(() => document.documentElement.scrollHeight)
      await page.setViewportSize({ width: shot.width, height })
      await page.reload()
      if (javaScript) await page.locator('html[data-ready]').waitFor({ state: 'attached' })
      if (shot.fontSize) {
        await page.locator('html').evaluate((html, size) => (html.style.fontSize = size), shot.fontSize)
      }
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
    process.stdout.write(`✓ docs/images/dropdown-menu/${shot.name}.png\n`)
  }
} finally {
  await browser.close()
  await server.close()
  await examples.close()
}
