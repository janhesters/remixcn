import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { afterEach, describe, it } from 'remix/test'

import { reportProcesses } from './processes.ts'

const html = () => new Response('<p>Invented page</p>', { headers: { 'Content-Type': 'text/html' } })
const realSetTimeout = globalThis.setTimeout
const invoice = { status: () => 'original' }

let resume = () => {}
let resumed = Promise.withResolvers<void>()
let running = ''
let late: string[] = []

const state = () => [invoice.status(), globalThis.setTimeout === realSetTimeout ? 'real timers' : 'fake timers']

// Stalls on purpose, in a cleanup queued ahead of a method mock and fake
// timers, and resumes once the next test runs. The runner still restores
// both before the next test starts. The cleanup and hook queued behind them
// belong to the expired teardown, so neither may start then.
describe('restore after stall', () => {
  afterEach(() => {
    if (running) late.push(`afterEach hook during ${running}`)
  })

  it('mocks a method and fakes timers behind a stalled cleanup', (t) => {
    let stalled = Promise.withResolvers<void>()
    resume = stalled.resolve
    t.after(async () => {
      await stalled.promise
      resumed.resolve()
    })
    t.mock.method(invoice, 'status', () => 'mocked')
    t.useFakeTimers()
    t.after(() => {
      if (running) late.push(`t.after() callback 2 during ${running}`)
    })
    assert.deepEqual(state(), ['mocked', 'fake timers'])
  })

  it('starts with the original method and real timers', async (t) => {
    let before = state()
    let server = await createTestServer(html)
    let page = await t.serve(server)
    reportProcesses([server.baseUrl])
    running = 'the next test'
    resume()
    await resumed.promise
    await page.goto('/')
    running = ''
    assert.deepEqual(
      { before, after: state(), late },
      { before: ['original', 'real timers'], after: ['original', 'real timers'], late: [] },
    )
  })
})
