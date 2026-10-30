// Serves the Combobox examples the way a Remix app would: the page through
// the render middleware, which resolves client entries, and the stylesheets
// and browser modules through Remix's asset server. The forms send to
// /echo, which lists what it received. Run `bun run combobox-examples`.
import * as http from 'node:http'
import { fileURLToPath } from 'node:url'

import { createAssetServer } from 'remix/assets'
import { createRequestListener } from 'remix/node-fetch-server'
import { render } from 'remix/middleware/render'
import { createRouter } from 'remix/router'

import { Echo, ComboboxExamples } from './page.tsx'

const root = fileURLToPath(new URL('../../..', import.meta.url))

// theme.css comes first, so its @layer statement orders the layers.
const stylesheets = ['registry/lib/theme.css']
const entry = 'test/fixtures/combobox/entry.ts'

async function fieldsOf(request: Request) {
  let data = request.method === 'GET' ? new URL(request.url).searchParams : await request.formData()
  return [...data].map(([name, value]) => [name, String(value)] as [string, string])
}

export async function createComboboxExamples() {
  let assets = createAssetServer({
    rootDir: root,
    basePath: '/assets',
    mounts: { registry: 'registry', fixture: 'test/fixtures/combobox', npm: 'node_modules' },
    allowFiles: [...stylesheets, entry, 'registry/**'],
    allowPackages: ['remix'],
    denyFiles: ['**/*.test.*'],
    watch: false,
  })
  let hrefs = await Promise.all(stylesheets.map((file) => assets.getHref(file)))
  let script = await assets.getScriptEntry(entry)

  let router = createRouter({ middleware: [render({ assets })] })
  router.get('/', (context) => context.render(<ComboboxExamples stylesheets={hrefs} script={script} />))
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
  let port = Number(process.env.PORT ?? 4418)
  let examples = await createComboboxExamples()

  http.createServer(createRequestListener(examples.fetch)).listen(port, 'localhost', () => {
    process.stdout.write(`RemixCN Combobox examples: http://localhost:${port}/\n`)
  })
}
