// Captures the Attachment, Bubble, Marker and Message examples in headless
// Chromium for UI reviews: the desktop page in both themes, the narrow page
// in both themes in three parts, and the important non-default states:
// picked files with local previews, a failed image, a canceled upload with
// keyboard focus, the preview dialog, a link trigger's focus ring in forced
// colors, copied and failed messages, right-to-left text, and long names on
// a narrow screen with text at 200%. Run `bun run capture:conversation-examples`.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'
import type { Page } from 'playwright'
import { createTestServer } from 'remix/node-fetch-server/test'

import { createConversationExamples } from './server.tsx'

interface Shot {
  name: string
  width: number
  colorScheme: 'light' | 'dark'
  forcedColors?: 'active'
  // The root font size, such as 32px for text at 200%.
  fontSize?: string
  // Capture only this element, after preparing its state.
  clip?: string
  // Capture the page from the top of one element to the top of another, or to the end.
  part?: { from: string; to?: string }
  // Capture only the viewport, such as with a modal dialog open.
  viewport?: boolean
  // What the clipboard answers: the screenshots never touch the real one.
  clipboard?: 'resolve' | 'reject'
  prepare?: (page: Page) => Promise<void>
}

const desktop = 1280
const narrow = 390
// The narrow page is too tall for one picture, so it comes in three parts.
const parts = [{ from: 'body', to: '#bubble' }, { from: '#bubble', to: '#message' }, { from: '#message' }]
const sketch = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#c4b5fd"/><circle cx="60" cy="60" r="28" fill="#4c1d95"/></svg>',
)

const example = (page: Page, id: string) => page.locator(`[data-example="${id}"]`)

const shots: Shot[] = [
  { name: 'desktop-light', width: desktop, colorScheme: 'light' },
  { name: 'desktop-dark', width: desktop, colorScheme: 'dark' },
  ...(['light', 'dark'] as const).flatMap((colorScheme) =>
    parts.map((part, index) => ({ name: `narrow-${colorScheme}-${index + 1}`, width: narrow, colorScheme, part })),
  ),
  {
    name: 'composer-previews-light',
    width: desktop,
    colorScheme: 'light',
    clip: '[data-example="attachment-composer"]',
    async prepare(page) {
      let composer = example(page, 'attachment-composer')
      await composer.getByLabel('Add files').setInputFiles([
        { name: 'circle-sketch.svg', mimeType: 'image/svg+xml', buffer: sketch },
        { name: 'meeting-notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Made-up meeting notes.') },
        {
          name: 'quarterly-revenue-reconciliation-for-every-region-final-v12.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from('region,total\nnorth,100\n'),
        },
      ])
      await composer.locator('[data-slot="attachment-image"][data-status="loaded"]').waitFor()
    },
  },
  {
    name: 'image-failed-dark',
    width: desktop,
    colorScheme: 'dark',
    clip: '[data-example="attachment-image-picker"]',
    async prepare(page) {
      let picker = example(page, 'attachment-image-picker')
      await picker.getByText('Preview: loaded.').waitFor()
      await picker.getByRole('button', { name: 'Use a broken link' }).click()
      await picker.getByText('Preview: error.').waitFor()
    },
  },
  {
    name: 'upload-canceled-focus-dark',
    width: desktop,
    colorScheme: 'dark',
    clip: '[data-example="attachment-upload"]',
    async prepare(page) {
      let upload = example(page, 'attachment-upload')
      await upload.getByRole('button', { name: 'Upload quarterly-report.pdf' }).focus()
      await page.keyboard.press('Enter')
      await page.clock.runFor(800)
      await page.keyboard.press('Enter')
      await upload.getByText('Upload canceled', { exact: true }).waitFor()
    },
  },
  {
    name: 'upload-progress-light',
    width: desktop,
    colorScheme: 'light',
    clip: '[data-example="attachment-upload"]',
    async prepare(page) {
      await example(page, 'attachment-upload').getByRole('button', { name: 'Upload quarterly-report.pdf' }).click()
      await page.clock.runFor(1200)
    },
  },
  {
    name: 'preview-dialog-light',
    width: desktop,
    colorScheme: 'light',
    viewport: true,
    async prepare(page) {
      await example(page, 'attachment-triggers').getByRole('button', { name: 'Preview research-summary.pdf' }).click()
      await page.getByRole('dialog').waitFor()
    },
  },
  {
    name: 'trigger-focus-forced-colors',
    width: desktop,
    colorScheme: 'light',
    forcedColors: 'active',
    clip: '[data-example="attachment-triggers"]',
    async prepare(page) {
      await example(page, 'attachment-triggers').getByRole('link', { name: 'Open contract-review.txt' }).focus()
      await page.keyboard.press('Shift+Tab')
      await page.keyboard.press('Tab')
    },
  },
  {
    name: 'message-actions-dark',
    width: desktop,
    colorScheme: 'dark',
    clipboard: 'resolve',
    clip: '[data-example="message-actions"]',
    async prepare(page) {
      let actions = example(page, 'message-actions')
      await actions.getByRole('button', { name: 'Copy reply' }).click()
      await actions.getByRole('button', { name: 'Copied' }).waitFor()
      await actions.getByRole('button', { name: 'Good response' }).click()
    },
  },
  {
    name: 'marker-status-light',
    width: desktop,
    colorScheme: 'light',
    clip: '[data-example="marker-status"]',
    async prepare(page) {
      await example(page, 'marker-status').getByRole('button', { name: 'Run again' }).click()
      await page.clock.runFor(1200)
    },
  },
  { name: 'right-to-left-dark', width: desktop, colorScheme: 'dark', clip: '#direction' },
  {
    name: 'narrow-text-200-light',
    width: narrow,
    colorScheme: 'light',
    fontSize: '32px',
    clip: '[data-example="attachment-files"]',
  },
]

const output = fileURLToPath(new URL('../../../docs/images/conversation/', import.meta.url))
mkdirSync(output, { recursive: true })

let examples = await createConversationExamples()
let server = await createTestServer(examples.fetch)
let browser = await chromium.launch()

/** The page coordinates of an element's box, with a margin that keeps a focus ring in the picture. */
function bounds(page: Page, selector: string, margin: number) {
  return page
    .locator(selector)
    .first()
    .evaluate((element, margin) => {
      let box = element.getBoundingClientRect()
      return {
        x: Math.max(0, box.x + window.scrollX - margin),
        y: Math.max(0, box.y + window.scrollY - margin),
        width: box.width + 2 * margin,
        height: box.height + 2 * margin,
      }
    }, margin)
}

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
    // A paused clock keeps uploads and statuses where a shot leaves them.
    await page.clock.install()
    await page.goto(server.baseUrl)
    await page.locator('html[data-ready]').waitFor({ state: 'attached' })
    if (shot.fontSize) await page.evaluate((size) => (document.documentElement.style.fontSize = size), shot.fontSize)
    // Previews are inline images; wait until each one loaded or failed.
    await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode().catch(() => {}))))
    await shot.prepare?.(page)

    let path = `${output}${shot.name}.png`
    if (shot.viewport) {
      await page.screenshot({ path })
    } else if (shot.clip) {
      // A full-page clip counts from the top of the page, not of the scrolled viewport.
      await page.screenshot({ path, clip: await bounds(page, shot.clip, 16), fullPage: true })
    } else if (shot.part) {
      let top = shot.part.from === 'body' ? 0 : (await bounds(page, shot.part.from, 0)).y
      let bottom = shot.part.to
        ? (await bounds(page, shot.part.to, 0)).y
        : await page.evaluate(() => document.documentElement.scrollHeight)
      await page.screenshot({ path, clip: { x: 0, y: top, width: shot.width, height: bottom - top }, fullPage: true })
    } else {
      await page.screenshot({ path, fullPage: true })
    }

    await page.close()
    process.stdout.write(`✓ docs/images/conversation/${shot.name}.png\n`)
  }
} finally {
  await browser.close()
  await server.close()
  await examples.close()
}
