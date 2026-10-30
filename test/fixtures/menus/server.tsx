// Serves the Dropdown Menu, Context Menu, Menubar and Navigation Menu
// examples the way a Remix app would: the pages through the render
// middleware, which resolves client entries, and the stylesheets and browser
// modules through Remix's asset server. `/` shows every example, `/open` the
// menus open from the start. Run `bun run menu-examples`.
import * as http from 'node:http'
import { fileURLToPath } from 'node:url'

import { createAssetServer } from 'remix/assets'
import { createRequestListener } from 'remix/node-fetch-server'
import { render } from 'remix/middleware/render'
import { createRouter } from 'remix/router'

import { MenuExamples, OpenMenus } from './page.tsx'

const root = fileURLToPath(new URL('../../..', import.meta.url))

// theme.css comes first, so its @layer statement orders the layers.
const stylesheets = ['registry/lib/theme.css']
const entry = 'test/fixtures/menus/entry.ts'

export async function createMenuExamples() {
  let assets = createAssetServer({
    rootDir: root,
    basePath: '/assets',
    mounts: { registry: 'registry', fixture: 'test/fixtures/menus', npm: 'node_modules' },
    allowFiles: [...stylesheets, entry, 'test/fixtures/menus/open.tsx', 'registry/**'],
    allowPackages: ['remix'],
    denyFiles: ['**/*.test.*'],
    watch: false,
  })
  let hrefs = await Promise.all(stylesheets.map((file) => assets.getHref(file)))
  let script = await assets.getScriptEntry(entry)

  let router = createRouter({ middleware: [render({ assets })] })
  router.get('/', (context) => context.render(<MenuExamples stylesheets={hrefs} script={script} />))
  router.get('/open', (context) => context.render(<OpenMenus stylesheets={hrefs} script={script} />))
  router.get(
    '/assets/*',
    async ({ request }) => (await assets.fetch(request)) ?? new Response('Not found', { status: 404 }),
  )

  return { fetch: (request: Request) => router.fetch(request), close: () => assets.close() }
}

if (import.meta.main) {
  let port = Number(process.env.PORT ?? 4421)
  let examples = await createMenuExamples()

  http.createServer(createRequestListener(examples.fetch)).listen(port, 'localhost', () => {
    process.stdout.write(
      `RemixCN Dropdown Menu, Context Menu, Menubar and Navigation Menu examples: http://localhost:${port}/\n`,
    )
  })
}
