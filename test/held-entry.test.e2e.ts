import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { createHold } from './held-entry.ts'

// A page whose entry module marks it hydrated and keeps what was typed before it ran.
const html = `<!doctype html><html lang="en"><head><title>Held entry</title>
<script type="module" src="/entry.js"></script></head>
<body><label>Code <input id="code"></label></body></html>`
const entry = `document.documentElement.dataset.typed = document.getElementById('code').value
document.documentElement.dataset.ready = 'true'`

async function open(t: TestContext) {
  let server = await createTestServer(async (request) => {
    let { pathname } = new URL(request.url)
    if (pathname === '/entry.js') return new Response(entry, { headers: { 'Content-Type': 'text/javascript' } })
    return new Response(html, { headers: { 'Content-Type': 'text/html' } })
  })
  return t.serve(server)
}

/** Runs cleanups in order, as the runner does after a test, and says whether they finished within the bound. */
async function runCleanups(cleanups: Array<() => unknown>, boundMs: number) {
  let finished = (async () => {
    for (let cleanup of cleanups) await cleanup()
    return true
  })()
  let timer: ReturnType<typeof setTimeout> | undefined
  let bound = new Promise<boolean>((resolve) => (timer = setTimeout(() => resolve(false), boundMs)))
  let result = await Promise.race([finished, bound])
  clearTimeout(timer)
  return result
}

describe('Held entry', () => {
  it('keeps the module back while a person types, then lets it run', async (t) => {
    let steps: string[] = []
    let page = await open(t)
    let hold = createHold(t, { record: (step) => steps.push(step) })
    await hold.attach(page, '**/entry.js')
    await page.goto('/', { waitUntil: 'commit' })

    await page.locator('#code').click()
    await page.keyboard.type('1234')
    assert.equal(await page.locator('html[data-ready]').count(), 0, 'not hydrated while held')
    hold.release()
    await page.locator('html[data-ready]').waitFor({ state: 'attached' })

    assert.equal(await page.locator('html').getAttribute('data-typed'), '1234')
    assert.equal(hold.outcome, 'released')
    assert.deepEqual(steps, ['hold: /entry.js held', 'hold: /entry.js released'])
  })

  it('settles a request still held when its test ends before releasing it, before the page closes', async (t) => {
    let steps: string[] = []
    let page = await open(t)
    // The runner's cleanups after a test that failed before release(): the hold's comes first.
    let cleanups: Array<() => unknown> = []
    let hold = createHold({ after: (fn) => void cleanups.push(fn) }, { record: (step) => steps.push(step) })
    let failed = new Promise<string>((resolve) => page.on('requestfailed', (request) => resolve(request.url())))
    await hold.attach(page, '**/entry.js')
    await page.goto('/', { waitUntil: 'commit' })
    await page.locator('#code').click()
    await page.keyboard.type('12')
    while (!steps.includes('hold: /entry.js held')) await page.waitForTimeout(10)

    assert.equal(await runCleanups(cleanups, 2_000), true, 'teardown finishes')
    assert.equal(hold.outcome, 'teardown')
    assert.match(await failed, /\/entry\.js$/, 'the browser saw the held request end')
    assert.equal(page.isClosed(), false, 'settled before its page closes')
    assert.deepEqual(steps, ['hold: /entry.js held', 'hold: /entry.js still held at teardown, so it is aborted'])
  })

  it('gives up a hold that outlasts its limit, so the test fails at once instead of waiting', async (t) => {
    let steps: string[] = []
    let page = await open(t)
    let hold = createHold(t, { limitMs: 300, record: (step) => steps.push(step) })
    let closed = new Promise<void>((resolve) => page.once('close', () => resolve()))
    await hold.attach(page, '**/entry.js')
    await page.goto('/', { waitUntil: 'commit' })
    let started = performance.now()

    // As a test that never reaches release() would wait, here on a promise no limit bounds.
    let waited = await page
      .evaluate(() => new Promise(() => {}))
      .then(
        () => 'settled',
        (error: Error) => error.message,
      )

    assert.match(waited, /closed/i)
    // The wait may reject as the page starts closing, before it has closed.
    let timer: ReturnType<typeof setTimeout> | undefined
    let bound = new Promise<void>(
      (_, reject) => (timer = setTimeout(() => reject(new Error('page not closed')), 2_000)),
    )
    await Promise.race([closed, bound])
    clearTimeout(timer)
    assert.ok(performance.now() - started < 3_000, `${Math.round(performance.now() - started)} ms`)
    assert.equal(hold.outcome, 'expired')
    assert.equal(page.isClosed(), true)
    assert.deepEqual(steps, [
      'hold: /entry.js held',
      'hold: /entry.js still held after 0.3 s, so it is aborted and the page closed',
    ])
  })
})
