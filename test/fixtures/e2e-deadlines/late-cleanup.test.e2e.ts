import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { afterEach, describe, it } from 'remix/test'

import { reportProcesses } from './processes.ts'

const html = () => new Response('<p>Invented page</p>', { headers: { 'Content-Type': 'text/html' } })

let resume = () => {}
let running = ''
let late: string[] = []

// Stalls on purpose, in a cleanup that resumes once the next test runs. The
// cleanup and hook queued behind it belong to the expired teardown, so
// neither may start then.
describe('late cleanup', () => {
  afterEach(() => {
    if (running) late.push(`afterEach hook during ${running}`)
  })

  it('registers a cleanup that resumes during the next test', async (t) => {
    let server = await createTestServer(html)
    let page = await t.serve(server)
    reportProcesses([server.baseUrl])
    await page.goto('/')
    let stalled = Promise.withResolvers<void>()
    resume = stalled.resolve
    t.after(() => stalled.promise)
    t.after(() => {
      if (running) late.push(`t.after() callback 2 during ${running}`)
    })
  })

  it('runs while the stalled cleanup resumes', async (t) => {
    let page = await t.serve(await createTestServer(html))
    running = 'the next test'
    resume()
    await page.goto('/')
    running = ''
    assert.deepEqual(late, [], `started late: ${late.join(', ')}`)
  })
})
