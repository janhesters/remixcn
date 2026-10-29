// Serves the style reference the way a Remix app would: the page through the
// component server renderer, and theme.css and app.css through Remix's asset
// server. Run `bun run style-reference` to open it locally.
import * as http from 'node:http'
import { fileURLToPath } from 'node:url'

import { createAssetServer } from 'remix/assets'
import { renderToString } from 'remix/component/server'
import { createRequestListener } from 'remix/node-fetch-server'
import { createHtmlResponse } from 'remix/response/html'
import { createRouter } from 'remix/router'

import { StyleReference } from './page.tsx'

const root = fileURLToPath(new URL('../../..', import.meta.url))

// theme.css comes first, so its @layer statement orders the layers.
const stylesheets = ['registry/lib/theme.css', 'test/fixtures/style-reference/app.css']

export async function createStyleReference() {
  let assets = createAssetServer({
    rootDir: root,
    basePath: '/assets',
    mounts: { registry: 'registry', fixture: 'test/fixtures/style-reference' },
    allowFiles: stylesheets,
    watch: false,
  })
  let hrefs = await Promise.all(stylesheets.map((file) => assets.getHref(file)))

  let router = createRouter()
  router.get('/', async () => createHtmlResponse(await renderToString(<StyleReference stylesheets={hrefs} />)))
  router.get('/assets/*', async ({ request }) => (await assets.fetch(request)) ?? new Response('Not found', { status: 404 }))

  return { fetch: (request: Request) => router.fetch(request), close: () => assets.close() }
}

if (import.meta.main) {
  let port = Number(process.env.PORT ?? 4400)
  let styleReference = await createStyleReference()

  http.createServer(createRequestListener(styleReference.fetch)).listen(port, 'localhost', () => {
    process.stdout.write(`RemixCN style reference: http://localhost:${port}/\n`)
  })
}
