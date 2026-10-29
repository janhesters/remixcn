// Serves the Accordion, Collapsible, Tabs and Pagination examples the way a
// Remix app would: the page through the render middleware, which resolves
// client entries, and the stylesheet and browser modules through Remix's
// asset server. ?page=N picks the current page of the Pagination example.
// Run `bun run disclosure-examples`.
import * as http from 'node:http'
import { fileURLToPath } from 'node:url'

import { createAssetServer } from 'remix/assets'
import { createRequestListener } from 'remix/node-fetch-server'
import { render } from 'remix/middleware/render'
import { createRouter } from 'remix/router'

import { DisclosureExamples } from './page.tsx'

const root = fileURLToPath(new URL('../../..', import.meta.url))

const stylesheets = ['registry/lib/theme.css']
const entry = 'test/fixtures/disclosure/entry.ts'

export async function createDisclosureExamples() {
  let assets = createAssetServer({
    rootDir: root,
    basePath: '/assets',
    mounts: { registry: 'registry', fixture: 'test/fixtures/disclosure', npm: 'node_modules' },
    allowFiles: [...stylesheets, entry, 'registry/**'],
    allowPackages: ['remix'],
    denyFiles: ['**/*.test.*'],
    watch: false,
  })
  let hrefs = await Promise.all(stylesheets.map((file) => assets.getHref(file)))
  let script = await assets.getScriptEntry(entry)

  let router = createRouter({ middleware: [render({ assets })] })
  router.get('/', (context) => {
    let page = Number(new URL(context.request.url).searchParams.get('page') ?? 2)
    return context.render(
      <DisclosureExamples stylesheets={hrefs} script={script} page={Number.isInteger(page) ? page : 2} />,
    )
  })
  router.get(
    '/assets/*',
    async ({ request }) => (await assets.fetch(request)) ?? new Response('Not found', { status: 404 }),
  )

  return { fetch: (request: Request) => router.fetch(request), close: () => assets.close() }
}

if (import.meta.main) {
  let port = Number(process.env.PORT ?? 4405)
  let examples = await createDisclosureExamples()

  http.createServer(createRequestListener(examples.fetch)).listen(port, 'localhost', () => {
    process.stdout.write(`RemixCN Accordion, Collapsible, Tabs and Pagination examples: http://localhost:${port}/\n`)
  })
}
