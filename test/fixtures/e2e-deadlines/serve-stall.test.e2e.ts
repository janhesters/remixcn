import type { Browser } from 'playwright'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'

import { reportProcesses } from './processes.ts'

const html = () => new Response('<p>Invented page</p>', { headers: { 'Content-Type': 'text/html' } })

let browser: Browser | undefined
let stalledServer = ''

// Stalls on purpose, while t.serve() opens a page for a server that already
// listens. The runner must close that server before the next test.
describe('serve stall', () => {
  it('opens a page, so the next test can reach the browser', async (t) => {
    let page = await t.serve(await createTestServer(html))
    browser = page.context().browser()!
  })

  it('stalls while t.serve() opens its page', async (t) => {
    t.mock.method(browser!, 'newPage', () => new Promise(() => {}))
    let server = await createTestServer(html)
    stalledServer = server.baseUrl
    reportProcesses([server.baseUrl])
    await t.serve(server)
  })

  it('finds the stalled test’s server closed', async () => {
    await assert.rejects(fetch(stalledServer, { signal: AbortSignal.timeout(2_000) }))
  })
})
