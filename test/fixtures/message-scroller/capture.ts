// Captures the Message Scroller examples in headless Chromium for UI reviews:
// the desktop and narrow pages in both themes, a new question held near the
// top while its reply streams, a transcript scrolled up with the jump button
// focused from the keyboard in dark mode, earlier messages loaded above, the
// outline marking the current question, the page in forced colors,
// right-to-left text, the chat at 200% text on a narrow screen, and the page
// without JavaScript. Run `bun run capture:message-scroller-examples`.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'
import type { Page } from 'playwright'
import { createTestServer } from 'remix/node-fetch-server/test'

import { createMessageScrollerExamples } from './server.tsx'

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

function example(page: Page, name: string) {
  return page.locator(`[data-example="${name}"]`)
}

function viewport(page: Page, name: string) {
  return example(page, name).locator('[data-slot="message-scroller-viewport"]')
}

// Sends the first scripted question and stops the clock while its reply streams.
async function streaming(page: Page) {
  await example(page, 'message-scroller-demo').getByRole('button', { name: 'Send' }).click()
  await example(page, 'message-scroller-demo').getByText('Status: streaming').waitFor()
  await page.waitForTimeout(250)
}

const desktop = 1280
const narrow = 390
const shots: Shot[] = [
  { name: 'desktop-light', width: desktop, colorScheme: 'light' },
  { name: 'desktop-dark', width: desktop, colorScheme: 'dark' },
  { name: 'narrow-light', width: narrow, colorScheme: 'light' },
  { name: 'narrow-dark', width: narrow, colorScheme: 'dark' },
  {
    name: 'new-turn-streaming-light',
    width: desktop,
    colorScheme: 'light',
    example: 'message-scroller-demo',
    prepare: streaming,
  },
  {
    name: 'scrolled-up-keyboard-focus-dark',
    width: desktop,
    colorScheme: 'dark',
    example: 'message-scroller-demo',
    async prepare(page) {
      await example(page, 'message-scroller-demo').getByRole('button', { name: 'Send' }).click()
      await example(page, 'message-scroller-demo').getByText('Status: ready').waitFor()
      // Back to the first message with the keyboard, then Tab to the button that returns to the end.
      await viewport(page, 'message-scroller-demo').focus()
      await page.keyboard.press('Home')
      await page.waitForTimeout(100)
      await page.keyboard.press('Tab')
    },
  },
  {
    name: 'history-loaded-light',
    width: desktop,
    colorScheme: 'light',
    example: 'message-scroller-history',
    async prepare(page) {
      let history = example(page, 'message-scroller-history')
      await viewport(page, 'message-scroller-history').evaluate((element) => (element.scrollTop = 0))
      await history.getByRole('button', { name: 'Load earlier messages' }).click()
      await history.getByText('16 messages loaded').waitFor()
    },
  },
  {
    name: 'outline-current-dark',
    width: desktop,
    colorScheme: 'dark',
    example: 'message-scroller-commands',
    async prepare(page) {
      await example(page, 'message-scroller-commands').getByRole('button', { name: 'Question 4' }).click()
      await example(page, 'message-scroller-commands')
        .locator('button[aria-current="true"]', { hasText: 'Question 4' })
        .waitFor()
    },
  },
  { name: 'forced-colors', width: desktop, colorScheme: 'light', forcedColors: 'active', prepare: streaming },
  { name: 'right-to-left-dark', width: narrow, colorScheme: 'dark', section: 'right-to-left' },
  { name: 'narrow-text-200-light', width: narrow, colorScheme: 'light', fontSize: '32px', section: 'chat' },
  { name: 'without-javascript-light', width: desktop, colorScheme: 'light', javaScript: false, section: 'chat' },
]

const output = fileURLToPath(new URL('../../../docs/images/message-scroller/', import.meta.url))
mkdirSync(output, { recursive: true })

let examples = await createMessageScrollerExamples()
let server = await createTestServer(examples.fetch)
// Playwright hides native scrollbars by default. Show them, as a reader sees them.
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

    // Full-page captures drop the scrollbars of inner scroll containers. A viewport
    // as tall as the page keeps them, and keeps every coordinate on the page.
    let height = await page.evaluate(() => document.documentElement.scrollHeight)
    await page.setViewportSize({ width: shot.width, height })

    let path = `${output}${shot.name}.png`
    let target = shot.section
      ? page.locator(`section[aria-labelledby="${shot.section}"]`)
      : shot.example
        ? example(page, shot.example)
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
    process.stdout.write(`✓ docs/images/message-scroller/${shot.name}.png\n`)
  }
} finally {
  await browser.close()
  await server.close()
  await examples.close()
}
