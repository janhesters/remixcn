// Serves the Slider examples the way a Remix app would: the page through the
// render middleware, which resolves client entries, and the stylesheets and
// browser modules through Remix's asset server. Forms send to /echo, which
// shows what the server received. Run `bun run slider-examples`.
import * as http from 'node:http'
import { fileURLToPath } from 'node:url'

import { createAssetServer } from 'remix/assets'
import { createRequestListener } from 'remix/node-fetch-server'
import { render } from 'remix/middleware/render'
import { createRouter } from 'remix/router'

import { Echo, SliderExamples } from './page.tsx'

const root = fileURLToPath(new URL('../../..', import.meta.url))

// theme.css comes first, so its @layer statement orders the layers.
const stylesheets = ['registry/lib/theme.css', 'test/fixtures/slider/app.css']
const entry = 'test/fixtures/slider/entry.ts'

export async function createSliderExamples() {
  let assets = createAssetServer({
    rootDir: root,
    basePath: '/assets',
    mounts: { registry: 'registry', fixture: 'test/fixtures/slider', npm: 'node_modules' },
    allowFiles: [...stylesheets, entry, 'registry/**'],
    allowPackages: ['remix'],
    denyFiles: ['**/*.test.*'],
    watch: false,
  })
  let hrefs = await Promise.all(stylesheets.map((file) => assets.getHref(file)))
  let script = await assets.getScriptEntry(entry)

  let router = createRouter({ middleware: [render({ assets })] })
  router.get('/', (context) => context.render(<SliderExamples stylesheets={hrefs} script={script} />))
  router.get(
    '/assets/*',
    async ({ request }) => (await assets.fetch(request)) ?? new Response('Not found', { status: 404 }),
  )
  router.get('/echo', (context) => {
    let url = new URL(context.request.url)
    return context.render(<Echo stylesheets={hrefs} fields={[...url.searchParams]} />)
  })

  return { fetch: (request: Request) => router.fetch(request), close: () => assets.close() }
}

if (import.meta.main) {
  let port = Number(process.env.PORT ?? 4410)
  let examples = await createSliderExamples()

  http.createServer(createRequestListener(examples.fetch)).listen(port, 'localhost', () => {
    process.stdout.write(`RemixCN Slider examples: http://localhost:${port}/\n`)
  })
}
