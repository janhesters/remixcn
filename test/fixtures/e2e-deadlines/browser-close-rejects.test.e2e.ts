import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'

import { reportProcesses } from './processes.ts'

const html = () => new Response('<p>Invented page</p>', { headers: { 'Content-Type': 'text/html' } })

// Passes every test, but closing the browser the file ran in rejects. Only the
// runner's close at the end of the file can fail the file.
describe('browser close rejects', () => {
  it('passes, and makes its browser’s close reject', async (t) => {
    let server = await createTestServer(html)
    let page = await t.serve(server)
    reportProcesses([server.baseUrl])
    await page.goto('/')
    page.context().browser()!.close = () => Promise.reject(new Error('Invented close failure'))
  })

  it('passes after it', async (t) => {
    let page = await t.serve(await createTestServer(html))
    await page.goto('/')
  })
})
