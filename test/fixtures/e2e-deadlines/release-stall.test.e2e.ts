import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'

import { reportProcesses } from './processes.ts'

const html = () => new Response('<p>Invented page</p>', { headers: { 'Content-Type': 'text/html' } })

// Passes its body and cleanups, but leaves a browser context open whose close
// never settles. Only the runner's release can find it, and it can't finish.
describe('release stall', () => {
  it('leaves a context open that never closes', async (t) => {
    let server = await createTestServer(html)
    let page = await t.serve(server)
    reportProcesses([server.baseUrl])
    let context = await page.context().browser()!.newContext()
    context.close = () => new Promise<void>(() => {})
  })

  it('never runs once its worker retires', () => {})
})
