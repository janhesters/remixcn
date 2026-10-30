import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { contrastRatio } from '../scripts/color.ts'
import { findAccessibilityViolations } from './accessibility.ts'
import { contractText, createConversationExamples } from './fixtures/conversation/server.tsx'

type Clipboard = 'resolve' | 'reject'

// Pages open with reduced motion, so transitions take 0s and animations stay
// still. The motion test opts back in. The clipboard answers as the test says
// and records what it was asked to write, and the page records the object
// URLs it creates and releases.
async function open(
  t: TestContext,
  {
    reducedMotion = 'reduce' as 'reduce' | 'no-preference',
    clock = false,
    hydrate = true,
    clipboard = 'resolve' as Clipboard,
  } = {},
) {
  let examples = await createConversationExamples()
  t.after(() => void examples.close())

  let server = await createTestServer(examples.fetch)
  let page = await t.serve(server)
  await page.emulateMedia({ colorScheme: 'light', reducedMotion })
  await page.addInitScript((answer) => {
    let writes: string[] = []
    let created: string[] = []
    let revoked: string[] = []
    Object.assign(window, { clipboardWrites: writes, objectUrls: { created, revoked } })
    navigator.clipboard.writeText = async (text: string) => {
      writes.push(text)
      if (answer === 'reject') throw new DOMException('Write permission denied.', 'NotAllowedError')
    }
    let { createObjectURL, revokeObjectURL } = URL
    URL.createObjectURL = (object: Blob | MediaSource) => {
      let url = createObjectURL(object)
      created.push(url)
      return url
    }
    URL.revokeObjectURL = (url: string) => {
      revoked.push(url)
      revokeObjectURL(url)
    }
  }, clipboard)
  // A script that runs from untrusted text would open a dialog; record any.
  let dialogs: string[] = []
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message())
    void dialog.dismiss()
  })
  if (clock) await page.clock.install()
  await page.goto('/')
  if (hydrate) await page.locator('html[data-ready]').waitFor({ state: 'attached' })
  return { page, server, dialogs }
}

type Page = Awaited<ReturnType<typeof open>>['page']
type Locator = ReturnType<Page['locator']>

function example(page: Page, id: string) {
  return page.locator(`[data-example="${id}"]`).first()
}

function style(locator: Locator, property: string) {
  return locator.first().evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property)
}

function focusedLabel(page: Page) {
  return page.evaluate(() => {
    let element = document.activeElement
    return element?.getAttribute('aria-label') ?? element?.textContent?.trim() ?? null
  })
}

/** Moves keyboard focus onto an element, so :focus-visible matches in every engine. */
async function focusWithKeyboard(page: Page, locator: Locator) {
  await locator.focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
}

/** Reads what the echo page says the server received. */
async function received(page: Page) {
  await page.locator('[data-echo="request"]').waitFor()
  let request = await page.locator('[data-echo="request"]').innerText()
  let fields = await page
    .locator('[data-echo="fields"] > div')
    .evaluateAll((rows) =>
      rows.map((row) => `${row.querySelector('dt')?.textContent}=${row.querySelector('dd')?.textContent}`),
    )
  return { request, fields }
}

/** Paints each element's background and text on a canvas, as the browser composites them, and returns sRGB bytes. */
function paintColors(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((elements) => {
    let canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    let context = canvas.getContext('2d', { willReadFrequently: true })!
    let paint = (color: string) => {
      // A canvas that can't parse a color keeps its previous fill, so fail instead of measuring that.
      context.fillStyle = '#010203'
      context.fillStyle = color
      if (context.fillStyle === '#010203') throw new Error(`The canvas can't paint ${color}`)
      context.fillRect(0, 0, 1, 1)
    }
    let read = () => [...context.getImageData(0, 0, 1, 1).data]
    let isOpaque = (color: string) => {
      context.clearRect(0, 0, 1, 1)
      paint(color)
      return read()[3] === 255
    }

    return elements.map((element) => {
      let layers: string[] = []
      for (let node: Element | null = element; node; node = node.parentElement) {
        let background = getComputedStyle(node).backgroundColor
        layers.unshift(background)
        if (isOpaque(background)) break
      }
      context.clearRect(0, 0, 1, 1)
      for (let layer of layers) paint(layer)
      let background = read()
      paint(getComputedStyle(element).color)
      return {
        label: `${element.getAttribute('data-slot')}: ${element.textContent?.trim().slice(0, 30)}`,
        background,
        text: read(),
      }
    })
  })
}

const toRgba = ([r, g, b]: number[]) => ({ r: r / 255, g: g / 255, b: b / 255, alpha: 1 })

const sketch = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="teal"/></svg>',
)

describe('Attachment, Bubble, Marker and Message examples', () => {
  it('pass axe-core WCAG 2.2 A and AA checks, in both color schemes', async (t) => {
    let { page } = await open(t)

    for (let colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      let violations = await findAccessibilityViolations(page)
      assert.deepEqual(violations, [], `${colorScheme}:\n${violations.join('\n')}`)
    }
  })

  it('render untrusted names, text and URLs as plain text, without a link, and run nothing', async (t) => {
    let { page, dialogs } = await open(t)
    let attachment = example(page, 'attachment-untrusted')
    let message = example(page, 'message-untrusted')

    assert.equal(await attachment.locator('img, script, a').count(), 0)
    assert.equal(await message.locator('img, script, b, i').count(), 0)
    assert.equal(
      await attachment.locator('[data-slot="attachment-title"]').innerText(),
      '"><img src=x onerror="alert(1)">.pdf',
    )
    await attachment.getByText('No link: the URL was not safe').waitFor()
    assert.match(
      await message.locator('[data-slot="bubble-content"]').innerText(),
      /<script>alert\("owned"\)<\/script>/,
    )
    assert.deepEqual(dialogs, [])
  })

  it('serve safe HTML without JavaScript: escaped text, image previews, and a composer form that posts files', async (t) => {
    let { page, server, dialogs } = await open(t, { hydrate: false })
    let context = await page.context().browser()!.newContext({ javaScriptEnabled: false, baseURL: server.baseUrl })
    t.after(() => context.close())
    let plain = await context.newPage()
    await plain.goto('/')

    assert.equal(await plain.locator('[data-example="attachment-untrusted"] img').count(), 0)
    let harbor = plain.locator('[data-example="attachment-images"] img[data-slot="attachment-image"]').first()
    assert.match((await harbor.getAttribute('src')) ?? '', /^data:image\/svg\+xml,/)
    assert.equal(await harbor.getAttribute('alt'), 'Drawing of green hills under a pale blue sky')
    // Buttons that never submit a form, also before JavaScript runs.
    for (let type of await plain
      .locator('[data-slot="attachment-action"], [data-slot="attachment-trigger"]')
      .evaluateAll((elements) =>
        elements.filter((element) => element.localName === 'button').map((element) => element.getAttribute('type')),
      )) {
      assert.equal(type, 'button')
    }

    let composer = plain.locator('[data-example="attachment-composer"]')
    await composer
      .getByLabel('Add files')
      .setInputFiles([{ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('made-up notes') }])
    await composer.getByRole('button', { name: 'Send' }).click()
    let { request, fields } = await received(plain)
    assert.equal(request, 'POST /echo')
    assert.deepEqual(fields, ['files=notes.txt (13 bytes)', 'intent=send-files'])
    assert.deepEqual(dialogs, [])
  })

  it('remove a file and move focus to the next one, then to Restore, and restore every file', async (t) => {
    let { page } = await open(t)
    let files = example(page, 'attachment-files')

    await files.getByRole('button', { name: 'Remove customer-import.csv' }).click()
    assert.equal(await focusedLabel(page), 'Remove message-renderer.tsx')
    await page.keyboard.press('Enter')
    assert.equal(await focusedLabel(page), 'Remove sales-dashboard.pdf')
    await page.keyboard.press('Enter')
    assert.equal(await focusedLabel(page), 'Restore files')
    assert.equal(await files.locator('[data-slot="attachment"]').count(), 0)

    await page.keyboard.press('Enter')
    assert.equal(await files.locator('[data-slot="attachment"]').count(), 3)
    assert.equal(await focusedLabel(page), 'Remove sales-dashboard.pdf')
  })

  it('show the icon for a failed image, and follow a replaced one without stale results', async (t) => {
    let { page } = await open(t)
    let missing = example(page, 'attachment-images').locator('[data-slot="attachment-image"]').nth(2)
    let picker = example(page, 'attachment-image-picker')

    await page.waitForFunction((image) => image?.getAttribute('data-status') === 'error', await missing.elementHandle())
    assert.equal(await missing.isHidden(), true)
    assert.equal(
      await example(page, 'attachment-images').locator('[data-slot="attachment-media"] svg').nth(2).isVisible(),
      true,
    )

    await picker.getByText('Preview: loaded.').waitFor()
    await picker.getByRole('button', { name: 'Use a broken link' }).click()
    await picker.getByText('Preview: error.').waitFor()
    await picker.getByText('Preview unavailable').waitFor()
    assert.equal(await picker.locator('[data-slot="attachment-image"]').isHidden(), true)
    await picker.getByRole('button', { name: 'Meadow' }).click()
    await picker.getByText('Preview: loaded.').waitFor()
    assert.equal(await picker.locator('[data-slot="attachment-image"]').isVisible(), true)
  })

  it('open a file from a link trigger that covers the card, while its actions stay their own controls', async (t) => {
    let { page } = await open(t)
    let triggers = example(page, 'attachment-triggers')
    let link = triggers.getByRole('link', { name: 'Open contract-review.txt' })
    let card = triggers.locator('[data-slot="attachment"]').first()

    assert.equal(await link.getAttribute('href'), '/files/contract-review.txt')
    assert.equal(
      await triggers.getByRole('link', { name: 'Download contract-review.txt' }).getAttribute('download'),
      'contract-review.txt',
    )

    // Keyboard focus on the trigger draws the ring around the whole card, also in forced colors.
    for (let forcedColors of ['none', 'active'] as const) {
      await page.emulateMedia({ forcedColors })
      await focusWithKeyboard(page, link)
      assert.equal(await style(card, 'outline-style'), 'solid', `forced colors ${forcedColors}`)
      assert.equal(await style(card, 'outline-width'), '2px')
    }
    await page.emulateMedia({ forcedColors: 'none' })

    await triggers.getByRole('button', { name: 'Remove contract-review.txt' }).click()
    assert.equal(await focusedLabel(page), 'Restore attachment')
    await page.keyboard.press('Enter')
    assert.equal(await focusedLabel(page), 'Remove contract-review.txt')

    // A click on the title lands on the trigger, which opens the file.
    let title = (await triggers.getByText('contract-review.txt', { exact: true }).boundingBox())!
    let [response] = await Promise.all([
      page.waitForResponse('**/files/contract-review.txt'),
      page.mouse.click(title.x + title.width / 2, title.y + title.height / 2),
    ])
    assert.equal(await response.text(), contractText)
    await page.waitForURL('**/files/contract-review.txt')
  })

  it('open a Dialog from a trigger that covers the card, and return focus to it when the dialog closes', async (t) => {
    let { page } = await open(t)
    let triggers = example(page, 'attachment-triggers')
    let trigger = triggers.getByRole('button', { name: 'Preview research-summary.pdf' })
    let card = triggers
      .locator('[data-slot="attachment"]')
      .filter({ has: page.getByRole('button', { name: 'Preview research-summary.pdf' }) })

    assert.equal(await trigger.getAttribute('data-slot'), 'attachment-trigger')
    assert.equal(await trigger.getAttribute('aria-haspopup'), 'dialog')
    await focusWithKeyboard(page, trigger)
    assert.equal(await style(card, 'outline-style'), 'solid')
    await page.keyboard.press('Enter')
    let dialog = page.getByRole('dialog', { name: 'research-summary.pdf' })
    await dialog.waitFor()
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true')
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
    await page.waitForFunction(
      () => document.activeElement?.getAttribute('aria-label') === 'Preview research-summary.pdf',
    )

    await trigger.click()
    await dialog.getByRole('button', { name: 'Done' }).click()
    await dialog.waitFor({ state: 'hidden' })
  })

  it('cancel a simulated upload, retry it to the end, and stop every timer when it is removed', async (t) => {
    let { page } = await open(t, { clock: true })
    let upload = example(page, 'attachment-upload')
    let card = upload.locator('[data-slot="attachment"]')
    let status = upload.getByRole('status')

    await upload.getByRole('button', { name: 'Upload quarterly-report.pdf' }).click()
    assert.equal(await card.getAttribute('data-state'), 'uploading')
    assert.equal(await focusedLabel(page), 'Cancel upload of quarterly-report.pdf')
    await page.clock.runFor(800)
    await upload.getByText('Uploading · 40%').waitFor()

    await page.keyboard.press('Enter')
    assert.equal(await card.getAttribute('data-state'), 'error')
    await status.getByText('quarterly-report.pdf: Upload canceled').waitFor()
    assert.equal(await focusedLabel(page), 'Retry upload of quarterly-report.pdf')
    // The canceled upload makes no more progress.
    await page.clock.runFor(5000)
    assert.equal(await card.getAttribute('data-state'), 'error')

    await page.keyboard.press('Enter')
    await page.clock.runFor(2000)
    assert.equal(await card.getAttribute('data-state'), 'processing')
    await page.clock.runFor(800)
    assert.equal(await card.getAttribute('data-state'), 'done')
    await upload.getByText('PDF · 3.2 MB · Uploaded').waitFor()
    assert.equal(await focusedLabel(page), 'Remove quarterly-report.pdf')

    // Removed in the middle of an upload, it never comes back on its own.
    await page.keyboard.press('Enter')
    await upload.getByRole('button', { name: 'Restore quarterly-report.pdf' }).click()
    await upload.getByRole('button', { name: 'Upload quarterly-report.pdf' }).click()
    await upload.getByRole('button', { name: 'Remove quarterly-report.pdf' }).waitFor({ state: 'detached' })
    await page.clock.runFor(400)
    await page.keyboard.press('Shift+Tab')
    await upload.getByRole('button', { name: 'Cancel upload of quarterly-report.pdf' }).click()
    await upload.getByRole('button', { name: 'Remove quarterly-report.pdf' }).click()
    await page.clock.runFor(10_000)
    assert.equal(await card.count(), 0)
    assert.equal(await focusedLabel(page), 'Restore quarterly-report.pdf')
  })

  it('preview picked files locally, release a removed preview, and send or clear the rest with the form', async (t) => {
    let { page } = await open(t)
    let composer = example(page, 'attachment-composer')
    let input = composer.getByLabel('Add files')

    await input.setInputFiles([
      { name: 'sketch.svg', mimeType: 'image/svg+xml', buffer: sketch },
      { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('made-up notes') },
    ])
    await composer.getByRole('status').getByText('2 files ready to send').waitFor()
    let preview = composer.locator('[data-slot="attachment-image"]')
    await page.waitForFunction(
      (image) => image?.getAttribute('data-status') === 'loaded',
      await preview.elementHandle(),
    )
    assert.match((await preview.getAttribute('src')) ?? '', /^blob:/)
    assert.deepEqual(
      await composer
        .locator('[data-slot="attachment"]')
        .evaluateAll((cards) =>
          cards.map((card) => [
            card.getAttribute('data-state'),
            card.querySelector('[data-slot="attachment-description"]')?.textContent,
          ]),
        ),
      [
        ['idle', `SVG · ${sketch.length} B · Ready to send`],
        ['idle', 'TXT · 13 B · Ready to send'],
      ],
    )

    let url = await preview.getAttribute('src')
    await composer.getByRole('button', { name: 'Remove sketch.svg' }).click()
    assert.equal(await focusedLabel(page), 'Remove notes.txt')
    await page.waitForFunction((url) => (window as any).objectUrls.revoked.includes(url), url)
    assert.deepEqual(
      await input.evaluate((element: HTMLInputElement) => [...element.files!].map((file) => file.name)),
      ['notes.txt'],
    )

    await composer.getByRole('button', { name: 'Clear' }).click()
    assert.equal(await composer.locator('[data-slot="attachment"]').count(), 0)
    await input.setInputFiles([{ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('made-up notes') }])
    await composer.getByRole('button', { name: 'Send' }).click()
    let { fields } = await received(page)
    assert.deepEqual(fields, ['files=notes.txt (13 bytes)', 'intent=send-files'])
  })

  it('toggle reactions and replies from bubbles that are buttons, and show more of a long bubble', async (t) => {
    let { page } = await open(t)
    let reactions = example(page, 'bubble-reaction-buttons')
    let links = example(page, 'bubble-links-and-buttons')
    let more = example(page, 'bubble-show-more')

    await reactions.getByRole('button', { name: 'Thumbs up, 1 person' }).click()
    assert.equal(
      await reactions.getByRole('button', { name: 'Thumbs up, 2 people including you' }).getAttribute('aria-pressed'),
      'true',
    )

    await focusWithKeyboard(page, links.getByRole('button', { name: 'I forgot my password' }))
    await page.keyboard.press('Enter')
    await links.getByRole('status').getByText('You picked: I forgot my password').waitFor()
    assert.equal(await links.getByRole('link', { name: 'Read the export guide' }).getAttribute('href'), '#bubble-help')

    let content = more.locator('[data-slot="bubble-content"]')
    let collapsed = (await content.boundingBox())!.height
    await more.getByRole('button', { name: 'Show more' }).click()
    assert.equal(await more.getByRole('button', { name: 'Show less' }).getAttribute('aria-expanded'), 'true')
    assert.ok((await content.boundingBox())!.height > collapsed * 1.5)
  })

  it('announce a running status with a marker, shimmer only without reduced motion, and toggle steps from a marker button', async (t) => {
    let { page } = await open(t, { clock: true, reducedMotion: 'no-preference' })
    let status = example(page, 'marker-status')
    let shimmering = example(page, 'marker-shimmer').locator('[data-slot="marker-content"]').first()

    assert.match(await style(shimmering, 'animation-name'), /remixcn-shimmer/)
    assert.equal(await style(shimmering, '-webkit-text-fill-color'), 'rgba(0, 0, 0, 0)')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    assert.equal(await style(shimmering, 'animation-name'), 'none')
    assert.notEqual(await style(shimmering, '-webkit-text-fill-color'), 'rgba(0, 0, 0, 0)')

    await status.getByRole('button', { name: 'Run again' }).click()
    await status.getByRole('status').getByText('Searching the invoices…').waitFor()
    assert.equal(await status.getByRole('button', { name: 'Run again' }).getAttribute('aria-disabled'), 'true')
    await page.clock.runFor(1200)
    await status.getByRole('status').getByText('Reading 4 files…').waitFor()
    await page.clock.runFor(1200)
    await status.getByRole('status').getByText('Explored 4 files').waitFor()

    let links = example(page, 'marker-links-and-buttons')
    let steps = links.getByRole('list')
    assert.equal(await steps.isHidden(), true)
    await links.getByRole('button', { name: 'Show the 3 steps' }).click()
    assert.equal(await steps.isVisible(), true)
    assert.equal(await links.getByRole('button', { name: 'Hide the 3 steps' }).getAttribute('aria-expanded'), 'true')
  })

  it('copy a message and confirm it, toggle feedback per message, and retry a failed send', async (t) => {
    let { page } = await open(t, { clock: true })
    let actions = example(page, 'message-actions')

    await actions.getByRole('button', { name: 'Copy reply' }).click()
    await actions.getByRole('button', { name: 'Copied' }).waitFor()
    assert.deepEqual(await page.evaluate(() => (window as any).clipboardWrites), [
      'The install failure comes from the workspace package. I can open the log line or retry the deployment.',
    ])

    let good = actions.getByRole('button', { name: 'Good response' })
    let bad = actions.getByRole('button', { name: 'Bad response' })
    await good.click()
    assert.deepEqual(
      [await good.getAttribute('aria-pressed'), await bad.getAttribute('aria-pressed')],
      ['true', 'false'],
    )
    await bad.click()
    assert.deepEqual(
      [await good.getAttribute('aria-pressed'), await bad.getAttribute('aria-pressed')],
      ['false', 'true'],
    )
    // Another instance of the same example keeps its own state.
    let other = page.locator('[data-theme="dark"]').getByRole('button', { name: 'Bad response' })
    assert.equal(await other.getAttribute('aria-pressed'), 'false')

    let delivery = actions.getByRole('status').filter({ hasText: /send|Sending|Delivered/ })
    await delivery.getByText('Failed to send').waitFor()
    await actions.getByRole('button', { name: 'Retry' }).click()
    await delivery.getByText('Sending…').waitFor()
    await page.clock.runFor(1000)
    await delivery.getByText('Delivered').waitFor()
  })

  it('report a refused copy in the button and in a status', async (t) => {
    let { page } = await open(t, { clipboard: 'reject' })
    let actions = example(page, 'message-actions')

    await actions.getByRole('button', { name: 'Copy message' }).click()
    await actions.getByRole('button', { name: "Couldn't copy" }).waitFor()
    await actions.getByRole('status').getByText("Couldn't copy").waitFor()
  })

  it('keep shimmering text at 4.5:1 or more through the whole sweep, in both color schemes', async (t) => {
    let { page } = await open(t, { reducedMotion: 'no-preference' })
    let failures: string[] = []

    for (let colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      // With motion on, backgrounds fade to the new scheme; measure once they're done.
      await page.evaluate(() =>
        Promise.all(
          document
            .getAnimations()
            .filter((animation) => animation instanceof CSSTransition)
            .map((animation) => animation.finished.catch(() => {})),
        ),
      )
      // The sweep paints the text with a gradient from its color to the
      // highlight and back, so both ends must reach 4.5:1 on the background.
      let results = await page.evaluate(() => {
        let canvas = document.createElement('canvas')
        canvas.width = canvas.height = 1
        let context = canvas.getContext('2d', { willReadFrequently: true })!
        let paint = (color: string) => {
          context.fillStyle = '#010203'
          context.fillStyle = color
          if (context.fillStyle === '#010203') throw new Error(`The canvas can't paint ${color}`)
          context.fillRect(0, 0, 1, 1)
        }
        let read = () => [...context.getImageData(0, 0, 1, 1).data]
        let isOpaque = (color: string) => {
          context.clearRect(0, 0, 1, 1)
          paint(color)
          return read()[3] === 255
        }
        let over = (background: number[], color: string) => {
          context.clearRect(0, 0, 1, 1)
          paint(`rgb(${background[0]} ${background[1]} ${background[2]})`)
          paint(color)
          return read()
        }

        return [...document.querySelectorAll<HTMLElement>('[data-slot]')]
          .filter((element) => getComputedStyle(element).animationName.includes('remixcn-shimmer'))
          .map((element) => {
            let layers: string[] = []
            for (let node: Element | null = element; node; node = node.parentElement) {
              let background = getComputedStyle(node).backgroundColor
              layers.unshift(background)
              if (isOpaque(background)) break
            }
            context.clearRect(0, 0, 1, 1)
            for (let layer of layers) paint(layer)
            let background = read()

            let exposed = getComputedStyle(element).getPropertyValue('--remixcn-shimmer-highlight').trim() !== ''
            let probe = document.createElement('span')
            probe.style.color = 'var(--remixcn-shimmer-highlight)'
            element.append(probe)
            let highlight = getComputedStyle(probe).color
            probe.remove()

            return {
              label: `${element.getAttribute('data-slot')}: ${element.textContent?.trim().slice(0, 30)}`,
              exposed,
              background,
              text: over(background, getComputedStyle(element).color),
              highlight: over(background, highlight),
            }
          })
      })

      assert.ok(results.length >= 4, `${colorScheme}: ${results.length} shimmering parts`)
      for (let { label, exposed, background, text, highlight } of results) {
        if (!exposed) failures.push(`${colorScheme} ${label}: no --remixcn-shimmer-highlight`)
        for (let [part, color] of [
          ['text', text],
          ['highlight', highlight],
        ] as const) {
          let ratio = contrastRatio(toRgba(color), toRgba(background))
          if (ratio < 4.5) failures.push(`${colorScheme} ${label}, ${part}: ${ratio.toFixed(2)}`)
        }
      }
    }

    assert.deepEqual(failures, [], failures.join('\n'))
  })

  it('keep text at 4.5:1 or more on its own background, in both themes', async (t) => {
    let { page } = await open(t)
    let parts = [
      'bubble-content',
      'message-header',
      'message-footer',
      'marker',
      'attachment-title',
      'attachment-description',
    ]
    let failures: string[] = []

    for (let theme of ['light', 'dark']) {
      let selector = parts.map((part) => `[data-theme="${theme}"] [data-slot="${part}"]`).join(', ')
      for (let { label, background, text } of await paintColors(page, selector)) {
        let ratio = contrastRatio(toRgba(text), toRgba(background))
        if (ratio < 4.5) failures.push(`${theme} ${label}: ${ratio.toFixed(2)}`)
      }
    }

    assert.deepEqual(failures, [], failures.join('\n'))
  })

  it('keep bubble frames, attachment borders and separator lines visible in forced colors', async (t) => {
    let { page } = await open(t)
    await page.emulateMedia({ forcedColors: 'active' })
    let light = page.locator('[data-theme="light"]')

    let frame = light.locator('[data-slot="bubble"][data-variant="secondary"] > [data-slot="bubble-content"]')
    assert.equal(await style(frame, 'border-top-style'), 'solid')
    assert.notEqual(await style(frame, 'border-top-color'), await style(light, 'background-color'))
    let separator = light.locator('[data-slot="marker"][data-variant="separator"]')
    assert.equal(
      await separator.first().evaluate((element) => getComputedStyle(element, '::before').borderTopStyle),
      'solid',
    )
    assert.equal(
      await style(light.locator('[data-slot="attachment"][data-state="idle"]'), 'border-top-style'),
      'dashed',
    )
    // The shimmer leaves the title readable.
    let title = light.locator('[data-slot="attachment"][data-state="uploading"] [data-slot="attachment-title"]')
    assert.notEqual(await style(title, '-webkit-text-fill-color'), 'rgba(0, 0, 0, 0)')
  })

  it('mirror avatars, bubbles, reactions, actions and lines in right-to-left text', async (t) => {
    let { page } = await open(t)
    let box = async (locator: Locator) => (await locator.first().boundingBox())!

    let attachment = example(page, 'attachment-rtl').locator('[data-slot="attachment"]').first()
    let card = await box(attachment)
    assert.ok((await box(attachment.locator('[data-slot="attachment-actions"]'))).x < card.x + card.width / 2)
    assert.ok((await box(attachment.locator('[data-slot="attachment-media"]'))).x > card.x + card.width / 2)

    let message = example(page, 'message-rtl').locator('[data-slot="message"]').first()
    let row = await box(message)
    let avatar = await box(message.locator('[data-slot="message-avatar"]'))
    assert.ok(avatar.x + avatar.width >= row.x + row.width - 1, 'the start avatar sits on the right')

    let bubble = example(page, 'bubble-rtl').locator('[data-slot="bubble"][data-align="end"]')
    let reactions = await box(bubble.locator('[data-slot="bubble-reactions"]'))
    let surface = await box(bubble)
    assert.equal(Math.round(reactions.x - surface.x), 12, 'reactions sit 12px from the left end')
  })

  it('line each avatar up with the bubble above its footer, also when the footer wraps at 320px with text at 200%', async (t) => {
    let { page } = await open(t)
    let offsets = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('[data-slot="message"]')].flatMap((message) => {
          let avatar = message.querySelector(':scope > [data-slot="message-avatar"]')
          let footer = message.querySelector(':scope > [data-slot="message-content"] > [data-slot="message-footer"]')
          let above = footer?.previousElementSibling
          if (!avatar || !footer || !above) return []
          return [
            {
              label: `${message.textContent?.trim().slice(0, 30)} (${Math.round(footer.getBoundingClientRect().height)}px footer)`,
              offset: Math.round(above.getBoundingClientRect().bottom - avatar.getBoundingClientRect().bottom),
            },
          ]
        }),
      )

    for (let [width, fontSize] of [
      [1280, ''],
      [320, '32px'],
    ] as const) {
      await page.setViewportSize({ width, height: 640 })
      await page.evaluate((size) => (document.documentElement.style.fontSize = size), fontSize)
      await page.waitForFunction(() => new Promise((resolve) => requestAnimationFrame(() => resolve(true))))
      let measured = await offsets()
      assert.ok(measured.length >= 2, `${measured.length} messages with an avatar and a footer`)
      let wrong = measured.filter(({ offset }) => Math.abs(offset) > 1)
      assert.deepEqual(wrong, [], `${width}px, root font size ${fontSize || 'default'}`)
    }
  })

  it('reflow to a 320px wide viewport without scrolling sideways, also with text at 200%', async (t) => {
    let { page } = await open(t)
    await page.setViewportSize({ width: 320, height: 640 })

    for (let fontSize of ['', '32px']) {
      for (let colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme })
        await page.evaluate((size) => (document.documentElement.style.fontSize = size), fontSize)

        let { width, overflowing, hiddenActions } = await page.evaluate(() => ({
          width: document.documentElement.scrollWidth,
          overflowing: [...document.body.querySelectorAll('*')]
            // A group of attachments scrolls inside itself.
            .filter((element) => !element.closest('[data-slot="attachment-group"]'))
            .filter((element) => element.getBoundingClientRect().right > innerWidth)
            .map(
              (element) =>
                `${element.localName}.${element.getAttribute('data-slot')}: ${element.textContent?.trim().slice(0, 40)}`,
            )
            .at(-1),
          // Every remove action outside a scrolling group stays inside its card.
          hiddenActions: [...document.querySelectorAll('[data-slot="attachment-action"]')]
            .filter((action) => !action.closest('[data-slot="attachment-group"]'))
            .filter((action) => {
              let card = action.closest('[data-slot="attachment"]')!.getBoundingClientRect()
              let box = action.getBoundingClientRect()
              return box.right > card.right + 0.5 || box.left < card.left - 0.5
            })
            .map((action) => action.getAttribute('aria-label')),
        }))
        let label = `${colorScheme}, root font size ${fontSize || 'default'}`
        assert.equal(width, 320, `${label}: ${width}px, ${overflowing}`)
        assert.deepEqual(hiddenActions, [], label)
      }
    }
  })
})
