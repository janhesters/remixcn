import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'

import { reportProcesses } from './processes.ts'

const html = () => new Response('<p>Invented page</p>', { headers: { 'Content-Type': 'text/html' } })

// Stalls on purpose. Playwright gives an evaluation no timeout of its own, so
// only the runner's deadline ends the first test.
describe('body stall', () => {
  it('waits on a page script that never settles', async (t) => {
    let server = await createTestServer(html)
    let page = await t.serve(server)
    reportProcesses([server.baseUrl])
    await page.goto('/')
    await page.evaluate(() => new Promise(() => {}))
  })

  it('runs after the stalled test', async (t) => {
    let page = await t.serve(await createTestServer(html))
    await page.goto('/')
  })
})
