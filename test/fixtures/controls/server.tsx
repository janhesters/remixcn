// Serves the Checkbox, Radio Group, Switch, Toggle and Toggle Group examples
// the way a `remix new` app would: the page through the render middleware,
// which hydrates their client entries, and the registry source, the examples
// and theme.css through Remix's asset server. Native forms submit to
// /submitted, which lists what the server received. Run `bun run controls`.
import * as http from 'node:http'
import { fileURLToPath } from 'node:url'

import { createAssetServer } from 'remix/assets'
import { render } from 'remix/middleware/render'
import { createRequestListener } from 'remix/node-fetch-server'
import { createRouter } from 'remix/router'

import { ControlsPage, SubmittedPage } from './page.tsx'

const root = fileURLToPath(new URL('../../..', import.meta.url))
const entry = 'test/fixtures/controls/entry.ts'

export async function createControls() {
  let assets = createAssetServer({
    rootDir: root,
    basePath: '/assets',
    mounts: { registry: 'registry', fixture: 'test/fixtures/controls', npm: 'node_modules' },
    // The browser reaches the registry source and examples, as it would once installed under app/**/public/.
    allowFiles: [entry, 'registry/**'],
    denyFiles: ['**/*.test.*'],
    allowPackages: ['remix'],
    watch: false,
  })
  let stylesheets = [await assets.getHref('registry/lib/theme.css')]
  let script = await assets.getScriptEntry(entry)

  let router = createRouter({ middleware: [render({ assets })] })
  router.get(
    '/assets/*path',
    async ({ request }) => (await assets.fetch(request)) ?? new Response('Not found', { status: 404 }),
  )
  router.get('/', (context) => context.render(<ControlsPage stylesheets={stylesheets} script={script} />))
  router.get('/submitted', (context) => {
    let entries = [...new URL(context.request.url).searchParams]
    return context.render(<SubmittedPage stylesheets={stylesheets} entries={entries} />)
  })

  return { fetch: (request: Request) => router.fetch(request), close: () => assets.close() }
}

if (import.meta.main) {
  let port = Number(process.env.PORT ?? 4403)
  let controls = await createControls()

  http.createServer(createRequestListener(controls.fetch)).listen(port, 'localhost', () => {
    process.stdout.write(`RemixCN controls: http://localhost:${port}/\n`)
  })
}
