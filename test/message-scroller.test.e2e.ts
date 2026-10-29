import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { findAccessibilityViolations } from './accessibility.ts'
import { createMessageScrollerExamples } from './fixtures/message-scroller/server.tsx'

interface OpenOptions {
  // off: the browser runs no script. never: scripting is on, but the page's script never loads.
  javaScript?: 'on' | 'off' | 'never'
  reducedMotion?: 'reduce' | 'no-preference'
  width?: number
}

// Pages open with reduced motion, so transitions take 0s and every read sees
// the final style. The motion test opts back in.
async function open(t: TestContext, { javaScript = 'on', reducedMotion = 'reduce', width = 1280 }: OpenOptions = {}) {
  let examples = await createMessageScrollerExamples()
  t.after(() => void examples.close())

  let server = await createTestServer(examples.fetch)
  let served = await t.serve(server)
  let page = served
  if (javaScript === 'off') {
    let browser = served.context().browser()
    assert.ok(browser)
    let context = await browser.newContext({ javaScriptEnabled: false, baseURL: server.baseUrl })
    t.after(() => context.close())
    page = await context.newPage()
  }

  let errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  if (javaScript === 'never')
    await page.route('**/*', (route) =>
      route.request().resourceType() === 'script' ? route.abort() : route.continue(),
    )

  await page.setViewportSize({ width, height: 900 })
  await page.emulateMedia({ colorScheme: 'light', reducedMotion })
  await page.goto('/')
  if (javaScript === 'on') await page.locator('html[data-hydrated]').waitFor({ state: 'attached' })
  return Object.assign(page, { errors })
}

type Page = Awaited<ReturnType<typeof open>>
type Locator = ReturnType<Page['locator']>

const names = [
  'message-scroller-demo',
  'message-scroller-history',
  'message-scroller-opening',
  'message-scroller-commands',
  'message-scroller-rtl',
]

function example(page: Page, name: string) {
  return page.locator(`[data-example="${name}"]`)
}

function viewport(page: Page, name: string) {
  return example(page, name).locator('[data-slot="message-scroller-viewport"]')
}

function endButton(page: Page, name: string) {
  return example(page, name).locator('[data-slot="message-scroller-button"][data-direction="end"]')
}

function scrollTop(locator: Locator) {
  return locator.evaluate((element) => element.scrollTop)
}

function atEnd(locator: Locator) {
  return locator.evaluate((element) => Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop) <= 1)
}

// A row's top inside the visible part of its viewport.
function rowTop(page: Page, name: string, id: string) {
  return viewport(page, name).evaluate(
    (element, messageId) =>
      Math.round(
        (element.querySelector(`[data-message-id="${messageId}"]`)?.getBoundingClientRect().top ?? NaN) -
          element.getBoundingClientRect().top,
      ),
    id,
  )
}

function computed(locator: Locator, property: string) {
  return locator.first().evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property)
}

async function until(page: Page, condition: () => boolean | Promise<boolean>, message: string, attempts = 100) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (await condition()) return
    await page.waitForTimeout(30)
  }
  assert.fail(message)
}

async function center(locator: Locator) {
  let box = await locator.boundingBox()
  assert.ok(box)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

describe('Message Scroller examples', () => {
  it('shows every message at once without JavaScript, at the top, with the jump buttons out of the way', async (t) => {
    let page = await open(t, { javaScript: 'off' })

    for (let name of names) {
      assert.equal(await computed(viewport(page, name), 'visibility'), 'visible', name)
      assert.equal(await scrollTop(viewport(page, name)), 0, name)
      for (let button of await example(page, name).locator('[data-slot="message-scroller-button"]').all()) {
        assert.equal(await button.getAttribute('data-active'), 'false', name)
        assert.equal(await computed(button, 'opacity'), '0', name)
      }
    }
    assert.ok(await page.getByText('Summarize the open payments for the quarterly report.').isVisible())

    await viewport(page, 'message-scroller-history').focus()
    await page.keyboard.press('End')
    await until(
      page,
      () => atEnd(viewport(page, 'message-scroller-history')),
      'the keyboard scrolls without JavaScript',
    )
  })

  it("shows the transcripts after two seconds when the page's script never loads", async (t) => {
    let page = await open(t, { javaScript: 'never' })
    let opening = viewport(page, 'message-scroller-opening')

    assert.equal(await computed(opening, 'visibility'), 'hidden')
    await until(page, async () => (await computed(opening, 'visibility')) === 'visible', 'the fail-safe shows it', 120)
    assert.equal(await scrollTop(opening), 0)
  })

  it('hydrates each transcript at its opening position, without errors', async (t) => {
    let page = await open(t)

    for (let name of names) {
      assert.equal(await viewport(page, name).getAttribute('data-pending-scroll'), null, name)
      assert.equal(await computed(viewport(page, name), 'visibility'), 'visible', name)
    }
    assert.ok(await atEnd(viewport(page, 'message-scroller-history')))
    // The last question sits below the content's padding, with 64px of the marker before it in view.
    assert.equal(await rowTop(page, 'message-scroller-opening', 's4'), 16 + 64)
    assert.equal(await scrollTop(viewport(page, 'message-scroller-commands')), 0)
    assert.equal(await scrollTop(viewport(page, 'message-scroller-rtl')), 0)
    assert.equal(await endButton(page, 'message-scroller-history').getAttribute('data-active'), 'false')
    assert.equal(await endButton(page, 'message-scroller-commands').getAttribute('data-active'), 'true')
    assert.deepEqual(page.errors, [])
  })

  it('passes the axe-core WCAG checks before and after hydration, in both themes', async (t) => {
    // axe needs scripting, so the server HTML is checked with the page's own script held back, once the
    // fail-safe has shown the transcripts.
    let server = await open(t, { javaScript: 'never' })
    await until(
      server,
      async () => (await computed(viewport(server, 'message-scroller-opening'), 'visibility')) === 'visible',
      'the fail-safe shows the transcripts',
      120,
    )
    assert.deepEqual(await findAccessibilityViolations(server), [])

    let page = await open(t)
    assert.deepEqual(await findAccessibilityViolations(page), [])
    await page.emulateMedia({ colorScheme: 'dark' })
    assert.deepEqual(await findAccessibilityViolations(page), [])
  })

  it('starts a sent question near the top, streams the reply below it, then follows it to the end', async (t) => {
    let page = await open(t)
    let demo = example(page, 'message-scroller-demo')
    let transcript = viewport(page, 'message-scroller-demo')

    await demo.getByRole('button', { name: 'Send' }).click()
    await demo.getByText('Status: thinking').waitFor()
    assert.equal(await rowTop(page, 'message-scroller-demo', 'q1'), 16 + 64)
    assert.equal(await endButton(page, 'message-scroller-demo').getAttribute('data-active'), 'false')
    // Once the reply fills the room below the question, the view follows it.
    await demo.getByText('Status: streaming').waitFor()

    await demo.getByText('Status: ready').waitFor()
    assert.ok(await atEnd(transcript), 'the long reply ends at the bottom of the view')
    assert.equal(await endButton(page, 'message-scroller-demo').getAttribute('data-active'), 'false')
    assert.deepEqual(page.errors, [])
  })

  it('stays where the reader scrolled with the wheel while the reply streams, and comes back from the button', async (t) => {
    let page = await open(t)
    let demo = example(page, 'message-scroller-demo')
    let transcript = viewport(page, 'message-scroller-demo')
    let history = await scrollTop(viewport(page, 'message-scroller-history'))

    await demo.getByRole('button', { name: 'Send' }).click()
    await demo.getByText('Status: streaming').waitFor()
    let { x, y } = await center(transcript)
    await page.mouse.move(x, y)
    await page.mouse.wheel(0, -120)
    await until(page, async () => (await scrollTop(transcript)) < 100, 'the wheel scrolls up')
    await page.waitForTimeout(100)
    let reading = await scrollTop(transcript)

    await demo.getByText('Status: ready').waitFor()
    assert.ok(Math.abs((await scrollTop(transcript)) - reading) <= 1, 'the view stays while the reply streams')
    let button = endButton(page, 'message-scroller-demo')
    await until(page, async () => (await button.getAttribute('data-active')) === 'true', 'the end button appears')
    // The other transcripts on the page don't move.
    assert.equal(await scrollTop(viewport(page, 'message-scroller-history')), history)

    await button.click()
    await until(page, () => atEnd(transcript), 'the button scrolls to the end')
    await until(page, async () => (await button.getAttribute('data-active')) === 'false', 'the button goes away')
    assert.equal(await button.getAttribute('inert'), '')
  })

  it('scrolls with the keyboard, which pauses following, and returns with the end button from the keyboard', async (t) => {
    let page = await open(t)
    let demo = example(page, 'message-scroller-demo')
    let transcript = viewport(page, 'message-scroller-demo')
    let frame = demo.locator('[data-slot="message-scroller"]')

    await demo.getByRole('button', { name: 'Send' }).click()
    await demo.getByText('Status: ready').waitFor()

    // Tab from the heading into the transcript, as a keyboard user does.
    await demo.getByRole('heading', { name: 'How can I help you today?' }).click()
    await page.keyboard.press('Tab')
    assert.equal(await transcript.evaluate((element) => element === document.activeElement), true)
    assert.equal(await computed(frame, 'outline-style'), 'solid')
    assert.equal(await computed(frame, 'outline-offset'), '-2px')

    await page.keyboard.press('Home')
    await until(page, async () => (await scrollTop(transcript)) === 0, 'Home scrolls to the top')
    let button = endButton(page, 'message-scroller-demo')
    await until(page, async () => (await button.getAttribute('data-active')) === 'true', 'the end button appears')

    await page.keyboard.press('Tab')
    assert.equal(await button.evaluate((element) => element === document.activeElement), true)
    assert.equal(await computed(button, 'outline-style'), 'solid')
    await page.keyboard.press('Enter')
    await until(page, () => atEnd(transcript), 'Enter on the button scrolls to the end')
    assert.equal(await transcript.evaluate((element) => element === document.activeElement), true)
  })

  it('keeps the message the reader sees in place when earlier messages load above it', async (t) => {
    let page = await open(t)
    let history = example(page, 'message-scroller-history')
    let transcript = viewport(page, 'message-scroller-history')

    await transcript.focus()
    await page.keyboard.press('Home')
    await until(page, async () => (await scrollTop(transcript)) === 0, 'Home reaches the top')
    let before = await rowTop(page, 'message-scroller-history', 'h32')

    await history.getByRole('button', { name: 'Load earlier messages' }).click()
    await history.getByText('16 messages loaded').waitFor()
    await page.waitForTimeout(50)
    assert.equal(await rowTop(page, 'message-scroller-history', 'h32'), before)
    assert.ok((await scrollTop(transcript)) > 0)
  })

  it('jumps from controls outside the frame and marks the question in view', async (t) => {
    let page = await open(t)
    let commands = example(page, 'message-scroller-commands')
    let transcript = viewport(page, 'message-scroller-commands')
    let current = commands.locator('button[aria-current="true"]')

    await until(
      page,
      async () => (await current.textContent()) === 'Question 1',
      'the outline marks the first question',
    )
    await commands.getByRole('button', { name: 'Question 4' }).click()
    await until(page, async () => (await rowTop(page, 'message-scroller-commands', 't3q')) === 16, 'the jump lands')
    await until(page, async () => (await current.textContent()) === 'Question 4', 'the outline follows the jump')

    await commands.getByRole('button', { name: 'Latest message' }).click()
    await until(page, () => atEnd(transcript), 'the toolbar reaches the end')
    await commands.getByText('At the latest message').waitFor()

    await commands.getByRole('button', { name: 'First message' }).click()
    await until(page, async () => (await scrollTop(transcript)) === 0, 'the toolbar reaches the start')
    await commands.getByText('More below').waitFor()
  })

  it('centers the jump button in right-to-left text, with its own label', async (t) => {
    let page = await open(t)
    let button = endButton(page, 'message-scroller-rtl')

    assert.equal(await button.getAttribute('data-active'), 'true')
    assert.equal(await button.getAttribute('aria-label'), 'انتقل إلى آخر رسالة')
    let frame = await example(page, 'message-scroller-rtl').locator('[data-slot="message-scroller"]').boundingBox()
    let box = await button.boundingBox()
    assert.ok(frame && box)
    assert.ok(Math.abs(box.x + box.width / 2 - (frame.x + frame.width / 2)) <= 1)
  })

  it('fades the bottom edge only while there is more below, and drops the fade in forced colors', async (t) => {
    let page = await open(t)
    let commands = viewport(page, 'message-scroller-commands')

    assert.match(await computed(commands, 'mask-image'), /linear-gradient/)
    assert.equal(await computed(viewport(page, 'message-scroller-history'), 'mask-image'), 'none')

    await page.emulateMedia({ forcedColors: 'active' })
    assert.equal(await computed(commands, 'mask-image'), 'none')
    let button = endButton(page, 'message-scroller-commands')
    assert.equal(await computed(button, 'border-top-width'), '1px')
    assert.notEqual(await computed(button, 'border-top-color'), 'rgba(0, 0, 0, 0)')
  })

  it('animates the jump buttons only with the motion tokens, and scrolls at once for reduced motion', async (t) => {
    let reduced = await open(t)
    assert.equal(await computed(endButton(reduced, 'message-scroller-commands'), 'transition-duration'), '0s')
    await example(reduced, 'message-scroller-commands').getByRole('button', { name: 'Latest message' }).click()
    assert.ok(await atEnd(viewport(reduced, 'message-scroller-commands')), 'no smooth scrolling')

    let moving = await open(t, { reducedMotion: 'no-preference' })
    assert.equal(await computed(endButton(moving, 'message-scroller-commands'), 'transition-duration'), '0.2s')
  })

  it('fits 320px without scrolling sideways or clipping a transcript, also with text at 200%', async (t) => {
    let page = await open(t, { width: 320 })
    let overflow = () =>
      page.evaluate(() => {
        let page = document.documentElement.scrollWidth - document.documentElement.clientWidth
        let cards = [...document.querySelectorAll('[data-example] section')].map(
          (card) => card.scrollWidth - card.clientWidth,
        )
        return Math.max(page, ...cards)
      })

    assert.equal(await overflow(), 0)
    await page.locator('html').evaluate((html) => (html.style.fontSize = '32px'))
    await page.waitForTimeout(50)
    assert.equal(await overflow(), 0)
  })
})
