// Serves the Input Group and Input OTP examples the way a Remix app would:
// the page through the render middleware, which resolves client entries, and
// the stylesheets and browser modules through Remix's asset server. Forms
// send to /echo, which shows what the server received. Run
// `bun run input-group-examples`.
import * as http from 'node:http'
import { fileURLToPath } from 'node:url'

import { createAssetServer } from 'remix/assets'
import { createRequestListener } from 'remix/node-fetch-server'
import { render } from 'remix/middleware/render'
import { createRouter } from 'remix/router'

import { Echo, InputGroupExamples } from './page.tsx'

const root = fileURLToPath(new URL('../../..', import.meta.url))

// theme.css comes first, so its @layer statement orders the layers.
const stylesheets = ['registry/lib/theme.css', 'test/fixtures/input-group/app.css']
const entry = 'test/fixtures/input-group/entry.ts'
const islands = 'test/fixtures/input-group/islands.tsx'

async function fieldsOf(request: Request) {
  let data = request.method === 'GET' ? new URL(request.url).searchParams : await request.formData()
  return [...data].map(([name, value]) => [name, String(value)] as [string, string])
}

export async function createInputGroupExamples() {
  let assets = createAssetServer({
    rootDir: root,
    basePath: '/assets',
    mounts: { registry: 'registry', fixture: 'test/fixtures/input-group', npm: 'node_modules' },
    allowFiles: [...stylesheets, entry, islands, 'registry/**'],
    allowPackages: ['remix'],
    denyFiles: ['**/*.test.*'],
    watch: false,
  })
  let hrefs = await Promise.all(stylesheets.map((file) => assets.getHref(file)))
  let script = await assets.getScriptEntry(entry)

  let router = createRouter({ middleware: [render({ assets })] })
  router.get('/', (context) => context.render(<InputGroupExamples stylesheets={hrefs} script={script} />))
  router.get(
    '/assets/*',
    async ({ request }) => (await assets.fetch(request)) ?? new Response('Not found', { status: 404 }),
  )
  router.get('/echo', async (context) =>
    context.render(<Echo stylesheets={hrefs} fields={await fieldsOf(context.request)} />),
  )
  router.post('/echo', async (context) =>
    context.render(<Echo stylesheets={hrefs} fields={await fieldsOf(context.request)} />),
  )

  return { fetch: (request: Request) => router.fetch(request), close: () => assets.close() }
}

if (import.meta.main) {
  let port = Number(process.env.PORT ?? 4411)
  let examples = await createInputGroupExamples()

  http.createServer(createRequestListener(examples.fetch)).listen(port, 'localhost', () => {
    process.stdout.write(`RemixCN Input Group and Input OTP examples: http://localhost:${port}/\n`)
  })
}
