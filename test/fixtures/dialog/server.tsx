// Serves the Dialog, Alert Dialog and Sheet examples the way a Remix app
// would: the page through the render middleware, which resolves client
// entries, and the stylesheets and browser modules through Remix's asset
// server. Forms post to /echo, which shows what the server received, and
// /starts-open renders a dialog that is open before any script runs.
// Run `bun run dialog-examples`.
import * as http from 'node:http'
import { fileURLToPath } from 'node:url'

import { createAssetServer } from 'remix/assets'
import { createRequestListener } from 'remix/node-fetch-server'
import { render } from 'remix/middleware/render'
import { createRouter } from 'remix/router'

import { DialogExamples, Echo, StartsOpen } from './page.tsx'

const root = fileURLToPath(new URL('../../..', import.meta.url))

// theme.css comes first, so its @layer statement orders the layers.
const stylesheets = ['registry/lib/theme.css']
const entry = 'test/fixtures/dialog/entry.ts'

export async function createDialogExamples() {
  let assets = createAssetServer({
    rootDir: root,
    basePath: '/assets',
    mounts: { registry: 'registry', fixture: 'test/fixtures/dialog', npm: 'node_modules' },
    allowFiles: [...stylesheets, entry, 'registry/**'],
    allowPackages: ['remix'],
    denyFiles: ['**/*.test.*'],
    watch: false,
  })
  let hrefs = await Promise.all(stylesheets.map((file) => assets.getHref(file)))
  let script = await assets.getScriptEntry(entry)

  let router = createRouter({ middleware: [render({ assets })] })
  router.get('/', (context) => context.render(<DialogExamples stylesheets={hrefs} script={script} />))
  router.get('/starts-open', (context) => context.render(<StartsOpen stylesheets={hrefs} script={script} />))
  router.get(
    '/assets/*',
    async ({ request }) => (await assets.fetch(request)) ?? new Response('Not found', { status: 404 }),
  )
  router.post('/echo', async (context) => {
    let fields = [...(await context.request.formData())].map(
      ([name, value]) => [name, String(value)] as [string, string],
    )
    return context.render(<Echo stylesheets={hrefs} fields={fields} />)
  })

  return { fetch: (request: Request) => router.fetch(request), close: () => assets.close() }
}

if (import.meta.main) {
  let port = Number(process.env.PORT ?? 4413)
  let examples = await createDialogExamples()

  http.createServer(createRequestListener(examples.fetch)).listen(port, 'localhost', () => {
    process.stdout.write(`RemixCN Dialog, Alert Dialog and Sheet examples: http://localhost:${port}/\n`)
  })
}
