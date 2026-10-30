// A page with a text box, for the probed fixture tests that test/phases.test.e2e.ts runs.
import { createTestServer } from 'remix/node-fetch-server/test'
import type { TestContext } from 'remix/test'

import { traceOnFailure, watchPage } from '../../phases.ts'

const html = `<!doctype html><html lang="en"><head><title>Phases</title></head>
<body><label>Code <input id="code"></label></body></html>`

const serveHtml = () => new Response(html, { headers: { 'Content-Type': 'text/html' } })

/** Opens the page. With `serverNeverCloses`, the runner's own cleanup never finishes closing its server. */
export async function open(t: TestContext, { serverNeverCloses = false } = {}) {
  let trace = traceOnFailure(t)
  let server = await createTestServer(serveHtml)
  // The test that uses it stops the runner, and the server with it.
  if (serverNeverCloses) server = { baseUrl: server.baseUrl, close: () => new Promise<void>(() => {}) } as typeof server
  let page = watchPage(t, await t.serve(server))
  await trace.start(page)
  await page.goto('/')
  return page
}

/** Opens the page again in a context of its own, traced as `label`. */
export async function openSecond(t: TestContext, page: Awaited<ReturnType<typeof open>>, label: string) {
  let trace = traceOnFailure(t, { label })
  let context = await page
    .context()
    .browser()!
    .newContext({ baseURL: new URL(page.url()).origin })
  t.after(() => context.close())
  let second = watchPage(t, await context.newPage(), { label })
  await trace.start(second)
  await second.goto('/')
  return second
}
