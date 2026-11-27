import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'

import { reportProcesses } from './processes.ts'

// Stalls on purpose, as the Input Group check did in CI (#93): its server's
// close waits for a request that a browser context the test opened still
// holds, and the test closes that context only after the server. The runner's
// release closes the context, which lets the server's close finish, so the
// next test runs in the same worker.
describe('held connection', () => {
  it('closes its server while its own context still holds a request', async (t) => {
    let requested = Promise.withResolvers<void>()
    let server = await createTestServer((request) => {
      if (new URL(request.url).pathname !== '/held') {
        return new Response('<p>Invented page</p>', { headers: { 'Content-Type': 'text/html' } })
      }
      requested.resolve()
      return new Promise<Response>(() => {})
    })
    let page = await t.serve(server)
    reportProcesses([server.baseUrl])
    let held = await page.context().browser()!.newContext({ baseURL: server.baseUrl })
    t.after(() => held.close())
    let heldPage = await held.newPage()
    await heldPage.goto('/')
    await heldPage.evaluate(() => {
      void fetch('/held')
    })
    await requested.promise
  })

  it('runs after the held connection closed', async (t) => {
    let server = await createTestServer(
      () => new Response('<p>Invented page</p>', { headers: { 'Content-Type': 'text/html' } }),
    )
    let page = await t.serve(server)
    await page.goto('/')
  })
})
