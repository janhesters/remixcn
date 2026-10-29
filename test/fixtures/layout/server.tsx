// Serves the Resizable and Scroll Area examples the way a `remix new` app
// would: the page through the render middleware, which hydrates its client
// entries, and the registry source, the examples and theme.css through Remix's
// asset server. Run `bun run layout` to open it locally.
import * as http from 'node:http'
import { fileURLToPath } from 'node:url'

import { createAssetServer } from 'remix/assets'
import { render } from 'remix/middleware/render'
import { createRequestListener } from 'remix/node-fetch-server'
import { createRouter } from 'remix/router'

import { LayoutPage } from './page.tsx'

const root = fileURLToPath(new URL('../../..', import.meta.url))

export async function createLayout() {
  let assets = createAssetServer({
    rootDir: root,
    basePath: '/assets',
    mounts: { registry: 'registry', fixture: 'test/fixtures/layout', npm: 'node_modules' },
    // The browser reaches the registry source and the examples, as it would once installed under app/**/public/.
    allowFiles: ['registry/**', 'test/fixtures/layout/entry.ts'],
    denyFiles: ['**/*.test.*'],
    allowPackages: ['remix'],
    watch: false,
  })
  let stylesheets = [await assets.getHref('registry/lib/theme.css')]
  let script = await assets.getScriptEntry('test/fixtures/layout/entry.ts')

  let router = createRouter({ middleware: [render({ assets })] })
  router.get(
    '/assets/*path',
    async ({ request }) => (await assets.fetch(request)) ?? new Response('Not found', { status: 404 }),
  )
  router.get('/', (context) => context.render(<LayoutPage stylesheets={stylesheets} script={script} />))

  return { fetch: (request: Request) => router.fetch(request), close: () => assets.close() }
}

if (import.meta.main) {
  let port = Number(process.env.PORT ?? 4402)
  let layout = await createLayout()

  http.createServer(createRequestListener(layout.fetch)).listen(port, 'localhost', () => {
    process.stdout.write(`RemixCN Resizable and Scroll Area: http://localhost:${port}/\n`)
  })
}
