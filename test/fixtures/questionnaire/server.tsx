// Serves the Questionnaire examples the way a Remix app would: the page
// through the render middleware, which resolves client entries, and the
// stylesheets and browser modules through Remix's asset server. The native
// form posts to /echo, which lists what it received. Run
// `bun run questionnaire-examples`.
import * as http from 'node:http'
import { fileURLToPath } from 'node:url'

import { createAssetServer } from 'remix/assets'
import { createRequestListener } from 'remix/node-fetch-server'
import { render } from 'remix/middleware/render'
import { createRouter } from 'remix/router'

import { Echo, QuestionnaireExamples } from './page.tsx'

const root = fileURLToPath(new URL('../../..', import.meta.url))

// theme.css comes first, so its @layer statement orders the layers.
const stylesheets = ['registry/lib/theme.css', 'test/fixtures/questionnaire/app.css']
const entry = 'test/fixtures/questionnaire/entry.ts'

async function fieldsOf(request: Request) {
  let data = request.method === 'GET' ? new URL(request.url).searchParams : await request.formData()
  return [...data].map(([name, value]) => [name, String(value)] as [string, string])
}

export async function createQuestionnaireExamples() {
  let assets = createAssetServer({
    rootDir: root,
    basePath: '/assets',
    mounts: { registry: 'registry', fixture: 'test/fixtures/questionnaire', npm: 'node_modules' },
    allowFiles: [...stylesheets, entry, 'registry/**'],
    allowPackages: ['remix'],
    denyFiles: ['**/*.test.*'],
    watch: false,
  })
  let hrefs = await Promise.all(stylesheets.map((file) => assets.getHref(file)))
  let script = await assets.getScriptEntry(entry)

  let router = createRouter({ middleware: [render({ assets })] })
  router.get('/', (context) => context.render(<QuestionnaireExamples stylesheets={hrefs} script={script} />))
  router.get(
    '/assets/*',
    async ({ request }) => (await assets.fetch(request)) ?? new Response('Not found', { status: 404 }),
  )
  router.get('/echo', async (context) =>
    context.render(<Echo stylesheets={hrefs} fields={await fieldsOf(context.request)} />),
  )
  router.post('/echo', async (context) =>
    context.render(<Echo stylesheets={hrefs} fields={await fieldsOf(context.request)} />),
  )

  return { fetch: (request: Request) => router.fetch(request), close: () => assets.close() }
}

if (import.meta.main) {
  let port = Number(process.env.PORT ?? 4431)
  let examples = await createQuestionnaireExamples()

  http.createServer(createRequestListener(examples.fetch)).listen(port, 'localhost', () => {
    process.stdout.write(`RemixCN Questionnaire examples: http://localhost:${port}/\n`)
  })
}
