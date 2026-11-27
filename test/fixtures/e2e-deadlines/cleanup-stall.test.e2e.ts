import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'

import { reportProcesses } from './processes.ts'

const html = () => new Response('<p>Invented page</p>', { headers: { 'Content-Type': 'text/html' } })

// Stalls on purpose, in a cleanup that never settles. The runner closes what
// the test opened and goes on with the next test.
describe('cleanup stall', () => {
  it('registers a cleanup that never settles', async (t) => {
    let server = await createTestServer(html)
    let page = await t.serve(server)
    reportProcesses([server.baseUrl])
    await page.goto('/')
    t.after(() => new Promise<void>(() => {}))
  })

  it('runs after the stalled cleanup', async (t) => {
    let page = await t.serve(await createTestServer(html))
    await page.goto('/')
  })
})
