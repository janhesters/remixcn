// Serves the Field, Input, Label, Native Select and Textarea examples the way
// a Remix app would: the page through the render middleware, which resolves
// client entries, and the stylesheets and browser modules through Remix's
// asset server. The invoice form posts to /invoices, which validates it on
// the server and renders the page again with its errors, or shows what it
// received. Other forms send to /echo. Run `bun run field-examples`.
import * as http from 'node:http'
import { fileURLToPath } from 'node:url'

import { createAssetServer } from 'remix/assets'
import { createRequestListener } from 'remix/node-fetch-server'
import { render } from 'remix/middleware/render'
import { createRouter } from 'remix/router'

import type { FieldErrorEntry } from '../../../registry/ui/field.tsx'
import { Echo, FieldExamples } from './page.tsx'
import type { InvoiceResult } from './page.tsx'

const root = fileURLToPath(new URL('../../..', import.meta.url))

// theme.css comes first, so its @layer statement orders the layers.
const stylesheets = ['registry/lib/theme.css', 'test/fixtures/field/app.css']
const entry = 'test/fixtures/field/entry.ts'

/**
 * The server's own rules for an invoice. The browser checks the required
 * fields, the email type and the minimum amount; the server checks them
 * again and adds what only it knows: the approval limit is a field error,
 * and a closed customer account refuses the whole operation.
 */
export function validateInvoice(values: Record<string, string>): Omit<InvoiceResult, 'values'> {
  let errors: Record<string, FieldErrorEntry[]> = {}
  let amount = Number(values.amount)

  if (!values.customer?.trim()) errors.customer = [{ message: 'Enter the customer.' }]
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email ?? '')) {
    errors.email = [{ message: 'Enter an email address like name@example.com.' }]
  }
  if (!values.amount || !Number.isFinite(amount) || amount < 1) {
    errors.amount = [{ message: 'Enter an amount of at least 1.' }]
  } else if (amount > 10_000) {
    errors.amount = [{ message: 'Invoices over 10,000 need a second approver.' }]
  }
  if (!values.due) errors.due = [{ message: 'Enter the due date.' }]

  if (Object.keys(errors).length > 0) return { errors }
  if (/closed/i.test(values.customer)) {
    return {
      formError: `${values.customer.trim()} has a closed account, so nothing was saved. Reopen the account or choose another customer.`,
    }
  }
  return {}
}

async function fieldsOf(request: Request) {
  let data = request.method === 'GET' ? new URL(request.url).searchParams : await request.formData()
  return [...data].map(([name, value]) => [name, String(value)] as [string, string])
}

export async function createFieldExamples() {
  let assets = createAssetServer({
    rootDir: root,
    basePath: '/assets',
    mounts: { registry: 'registry', fixture: 'test/fixtures/field', npm: 'node_modules' },
    allowFiles: [...stylesheets, entry, 'registry/**'],
    allowPackages: ['remix'],
    denyFiles: ['**/*.test.*'],
    watch: false,
  })
  let hrefs = await Promise.all(stylesheets.map((file) => assets.getHref(file)))
  let script = await assets.getScriptEntry(entry)

  let router = createRouter({ middleware: [render({ assets })] })
  router.get('/', (context) => context.render(<FieldExamples stylesheets={hrefs} script={script} />))
  router.get(
    '/assets/*',
    async ({ request }) => (await assets.fetch(request)) ?? new Response('Not found', { status: 404 }),
  )
  router.post('/invoices', async (context) => {
    let fields = await fieldsOf(context.request)
    let values = Object.fromEntries(fields)
    let result = validateInvoice(values)
    if (!result.errors && !result.formError) return context.render(<Echo stylesheets={hrefs} fields={fields} />)

    return context.render(<FieldExamples stylesheets={hrefs} script={script} invoice={{ values, ...result }} />, {
      status: 422,
    })
  })
  router.get('/echo', async (context) =>
    context.render(<Echo stylesheets={hrefs} fields={await fieldsOf(context.request)} />),
  )
  router.post('/echo', async (context) =>
    context.render(<Echo stylesheets={hrefs} fields={await fieldsOf(context.request)} />),
  )

  return { fetch: (request: Request) => router.fetch(request), close: () => assets.close() }
}

if (import.meta.main) {
  let port = Number(process.env.PORT ?? 4408)
  let examples = await createFieldExamples()

  http.createServer(createRequestListener(examples.fetch)).listen(port, 'localhost', () => {
    process.stdout.write(
      `RemixCN Field, Input, Label, Native Select and Textarea examples: http://localhost:${port}/\n`,
    )
  })
}
