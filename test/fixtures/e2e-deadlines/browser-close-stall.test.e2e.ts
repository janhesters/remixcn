import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'

import { reportProcesses } from './processes.ts'

const html = () => new Response('<p>Invented page</p>', { headers: { 'Content-Type': 'text/html' } })

// Passes every test, but the browser the file ran in never closes. Only the
// runner's deadline for closing it at the end of the file can fail the file.
describe('browser close stall', () => {
  it('passes, and keeps its browser from closing', async (t) => {
    let server = await createTestServer(html)
    let page = await t.serve(server)
    reportProcesses([server.baseUrl])
    await page.goto('/')
    page.context().browser()!.close = () => new Promise<void>(() => {})
  })

  it('passes after it', async (t) => {
    let page = await t.serve(await createTestServer(html))
    await page.goto('/')
  })
})
