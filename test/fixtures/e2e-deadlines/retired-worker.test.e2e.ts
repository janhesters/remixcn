import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'

import { reportProcesses } from './processes.ts'

const html = () => new Response('<p>Invented page</p>', { headers: { 'Content-Type': 'text/html' } })

// Stalls on purpose, first in its body, then in closing a server that never
// closes and keeps listening. Only retiring the worker frees it.
describe('stall that retires its worker', () => {
  it('stalls in its body, then in closing its server', async (t) => {
    let server = await createTestServer(html)
    let page = await t.serve({ baseUrl: server.baseUrl, close: () => new Promise<void>(() => {}) })
    reportProcesses([server.baseUrl])
    await page.goto('/')
    await page.evaluate(() => new Promise(() => {}))
  })

  it('never runs once its worker retires', () => {})
})
