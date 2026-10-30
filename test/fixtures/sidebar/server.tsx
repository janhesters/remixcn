// Serves the Sidebar examples the way a Remix app would: each example as a
// page through the render middleware, which resolves client entries, and the
// stylesheets and browser modules through Remix's asset server. `/` shows
// them all in frames, and `/<example>` shows one, such as `/icons`. Run
// `bun run sidebar-examples`.
import * as http from 'node:http'
import { fileURLToPath } from 'node:url'

import { createAssetServer } from 'remix/assets'
import { createRequestListener } from 'remix/node-fetch-server'
import { render } from 'remix/middleware/render'
import { createRouter } from 'remix/router'

import { ExamplePage, Gallery, isExampleName } from './page.tsx'

const root = fileURLToPath(new URL('../../..', import.meta.url))

// theme.css comes first, so its @layer statement orders the layers.
const stylesheets = ['registry/lib/theme.css']
const entry = 'test/fixtures/sidebar/entry.ts'

export async function createSidebarExamples() {
  let assets = createAssetServer({
    rootDir: root,
    basePath: '/assets',
    mounts: { registry: 'registry', fixture: 'test/fixtures/sidebar', npm: 'node_modules' },
    allowFiles: [...stylesheets, entry, 'registry/**'],
    allowPackages: ['remix'],
    denyFiles: ['**/*.test.*'],
    watch: false,
  })
  let hrefs = await Promise.all(stylesheets.map((file) => assets.getHref(file)))
  let script = await assets.getScriptEntry(entry)

  let router = createRouter({ middleware: [render({ assets })] })
  router.get('/', (context) => context.render(<Gallery stylesheets={hrefs} search={context.url.searchParams} />))
  router.get(
    '/assets/*',
    async ({ request }) => (await assets.fetch(request)) ?? new Response('Not found', { status: 404 }),
  )
  router.get('/:example', (context) => {
    let name = context.params.example
    if (!isExampleName(name)) return new Response('Not found', { status: 404 })
    return context.render(
      <ExamplePage name={name} search={context.url.searchParams} stylesheets={hrefs} script={script} />,
    )
  })

  return { fetch: (request: Request) => router.fetch(request), close: () => assets.close() }
}

if (import.meta.main) {
  let port = Number(process.env.PORT ?? 4426)
  let examples = await createSidebarExamples()

  http.createServer(createRequestListener(examples.fetch)).listen(port, 'localhost', () => {
    process.stdout.write(`RemixCN Sidebar examples: http://localhost:${port}/\n`)
  })
}
