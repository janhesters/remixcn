// Serves the Button and Button Group examples the way a Remix app would: the
// page through the render middleware, which resolves client entries, and the
// stylesheets and browser modules through Remix's asset server. Forms post to
// /echo, which shows what the server received. Run `bun run button-examples`.
import * as http from 'node:http'
import { fileURLToPath } from 'node:url'

import { createAssetServer } from 'remix/assets'
import { createRequestListener } from 'remix/node-fetch-server'
import { render } from 'remix/middleware/render'
import { createRouter } from 'remix/router'

import { ButtonExamples, Echo } from './page.tsx'

const root = fileURLToPath(new URL('../../..', import.meta.url))

// theme.css comes first, so its @layer statement orders the layers.
const stylesheets = ['registry/lib/theme.css', 'test/fixtures/button/app.css']
const entry = 'test/fixtures/button/entry.ts'

export async function createButtonExamples() {
  let assets = createAssetServer({
    rootDir: root,
    basePath: '/assets',
    mounts: { registry: 'registry', fixture: 'test/fixtures/button', npm: 'node_modules' },
    allowFiles: [...stylesheets, entry, 'registry/**'],
    allowPackages: ['remix'],
    denyFiles: ['**/*.test.*'],
    watch: false,
  })
  let hrefs = await Promise.all(stylesheets.map((file) => assets.getHref(file)))
  let script = await assets.getScriptEntry(entry)

  let router = createRouter({ middleware: [render({ assets })] })
  router.get('/', (context) => context.render(<ButtonExamples stylesheets={hrefs} script={script} />))
  router.get(
    '/assets/*',
    async ({ request }) => (await assets.fetch(request)) ?? new Response('Not found', { status: 404 }),
  )

  for (let path of ['/echo', '/echo/draft']) {
    let echo = async (context: { request: Request; render: (node: JSX.Element) => Response | Promise<Response> }) => {
      let { request } = context
      let url = new URL(request.url)
      let fields = request.method === 'GET' ? [...url.searchParams] : [...(await request.formData())]
      let received = fields.map(([name, value]) => [name, String(value)] as [string, string])
      return context.render(<Echo stylesheets={hrefs} method={request.method} path={url.pathname} fields={received} />)
    }
    router.get(path, echo)
    router.post(path, echo)
  }

  return { fetch: (request: Request) => router.fetch(request), close: () => assets.close() }
}

if (import.meta.main) {
  let port = Number(process.env.PORT ?? 4401)
  let examples = await createButtonExamples()

  http.createServer(createRequestListener(examples.fetch)).listen(port, 'localhost', () => {
    process.stdout.write(`RemixCN Button examples: http://localhost:${port}/\n`)
  })
}
