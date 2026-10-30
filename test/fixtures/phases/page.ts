// A page with a text box, for the probed fixture tests that test/phases.test.e2e.ts runs.
import { createTestServer } from 'remix/node-fetch-server/test'
import type { TestContext } from 'remix/test'

import { traceOnFailure, watchPage } from '../../phases.ts'

const html = `<!doctype html><html lang="en"><head><title>Phases</title></head>
<body><label>Code <input id="code"></label></body></html>`

export async function open(t: TestContext) {
  let trace = traceOnFailure(t)
  let server = await createTestServer(() => new Response(html, { headers: { 'Content-Type': 'text/html' } }))
  let page = watchPage(t, await t.serve(server))
  await trace.start(page)
  await page.goto('/')
  return page
}
