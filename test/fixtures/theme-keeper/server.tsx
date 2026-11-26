// Serves two pages that keep the user's theme the way an app that installs
// the theme keeper would: the bootstrap first in <head>, theme.css, and
// Remix's runtime, which opens the link between them in place. The page
// renders through the render middleware, which resolves the theme control's
// client entry, and the stylesheet and browser modules come from Remix's
// asset server. Run `node --import remix/node-tsx test/fixtures/theme-keeper/server.tsx`.
import * as http from 'node:http'
import { fileURLToPath } from 'node:url'

import { createAssetServer } from 'remix/assets'
import { createRequestListener } from 'remix/node-fetch-server'
import { render } from 'remix/middleware/render'
import { createRouter } from 'remix/router'

import { ThemePage } from './page.tsx'

const root = fileURLToPath(new URL('../../..', import.meta.url))

const stylesheets = ['registry/lib/theme.css']
const entry = 'test/fixtures/theme-keeper/entry.ts'
const control = 'test/fixtures/theme-keeper/theme-select.tsx'

export async function createThemeKeeperPages() {
  let assets = createAssetServer({
    rootDir: root,
    basePath: '/assets',
    mounts: { registry: 'registry', fixture: 'test/fixtures/theme-keeper', npm: 'node_modules' },
    allowFiles: [...stylesheets, entry, control, 'registry/**'],
    allowPackages: ['remix'],
    denyFiles: ['**/*.test.*'],
    watch: false,
  })
  let hrefs = await Promise.all(stylesheets.map((file) => assets.getHref(file)))
  let script = await assets.getScriptEntry(entry)

  let router = createRouter({ middleware: [render({ assets })] })
  router.get('/', (context) => context.render(<ThemePage page="home" stylesheets={hrefs} script={script} />))
  router.get('/other', (context) => context.render(<ThemePage page="other" stylesheets={hrefs} script={script} />))
  router.get(
    '/assets/*',
    async ({ request }) => (await assets.fetch(request)) ?? new Response('Not found', { status: 404 }),
  )

  return { fetch: (request: Request) => router.fetch(request), close: () => assets.close() }
}

if (import.meta.main) {
  let port = Number(process.env.PORT ?? 4432)
  let pages = await createThemeKeeperPages()

  http.createServer(createRequestListener(pages.fetch)).listen(port, 'localhost', () => {
    process.stdout.write(`RemixCN theme keeper pages: http://localhost:${port}/\n`)
  })
}
