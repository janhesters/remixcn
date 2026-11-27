import { createTestServer } from 'remix/node-fetch-server/test'
import { afterAll, describe, it } from 'remix/test'

import { reportProcesses } from './processes.ts'

const html = () => new Response('<p>Invented page</p>', { headers: { 'Content-Type': 'text/html' } })

let closing = Promise.withResolvers<void>()

// Stalls on purpose, in the first afterAll hook to run, which resumes once
// the worker starts closing its browser. That close never settles, so the
// worker stays long enough to show that the hook queued behind the stalled one
// never starts.
describe('late afterAll', () => {
  afterAll(() => {
    console.log('late afterAll hook started')
  })

  afterAll(() => closing.promise)

  it('passes, and holds the browser open', async (t) => {
    let server = await createTestServer(html)
    let page = await t.serve(server)
    reportProcesses([server.baseUrl])
    await page.goto('/')
    page.context().browser()!.close = () => {
      closing.resolve()
      return new Promise<void>(() => {})
    }
  })
})
