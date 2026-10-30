// Serves the Attachment, Bubble, Marker and Message examples the way a Remix
// app would: the page through the render middleware, which resolves client
// entries, and the stylesheets and browser modules through Remix's asset
// server. Forms post to /echo, which shows what the server received, files
// by name and size. /files/ serves one made-up text file for the download
// and link examples. Run `bun run conversation-examples`.
import * as http from 'node:http'
import { fileURLToPath } from 'node:url'

import { createAssetServer } from 'remix/assets'
import { createRequestListener } from 'remix/node-fetch-server'
import { render } from 'remix/middleware/render'
import { createRouter } from 'remix/router'

import { ConversationExamples, Echo } from './page.tsx'

const root = fileURLToPath(new URL('../../..', import.meta.url))

// theme.css comes first, so its @layer statement orders the layers.
const stylesheets = ['registry/lib/theme.css']
const entry = 'test/fixtures/conversation/entry.ts'

export const contractText = 'A made-up contract for the RemixCN examples. Nothing in it is real.\n'

function describe(value: FormDataEntryValue) {
  if (typeof value === 'string') return value
  return value.name ? `${value.name} (${value.size} bytes)` : '(no file)'
}

export async function createConversationExamples() {
  let assets = createAssetServer({
    rootDir: root,
    basePath: '/assets',
    mounts: { registry: 'registry', fixture: 'test/fixtures/conversation', npm: 'node_modules' },
    allowFiles: [...stylesheets, entry, 'registry/**'],
    allowPackages: ['remix'],
    denyFiles: ['**/*.test.*'],
    watch: false,
  })
  let hrefs = await Promise.all(stylesheets.map((file) => assets.getHref(file)))
  let script = await assets.getScriptEntry(entry)

  let router = createRouter({ middleware: [render({ assets })] })
  router.get('/', (context) => context.render(<ConversationExamples stylesheets={hrefs} script={script} />))
  router.get(
    '/assets/*',
    async ({ request }) => (await assets.fetch(request)) ?? new Response('Not found', { status: 404 }),
  )
  router.get(
    '/files/contract-review.txt',
    () => new Response(contractText, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }),
  )

  let echo = async (context: { request: Request; render: (node: JSX.Element) => Response | Promise<Response> }) => {
    let { request } = context
    let url = new URL(request.url)
    let fields = request.method === 'GET' ? [...url.searchParams] : [...(await request.formData())]
    let received = fields.map(([name, value]) => [name, describe(value)] as [string, string])
    return context.render(<Echo stylesheets={hrefs} method={request.method} path={url.pathname} fields={received} />)
  }
  router.get('/echo', echo)
  router.post('/echo', echo)

  return { fetch: (request: Request) => router.fetch(request), close: () => assets.close() }
}

if (import.meta.main) {
  let port = Number(process.env.PORT ?? 4427)
  let examples = await createConversationExamples()

  http.createServer(createRequestListener(examples.fetch)).listen(port, 'localhost', () => {
    process.stdout.write(`RemixCN Attachment, Bubble, Marker and Message examples: http://localhost:${port}/\n`)
  })
}
