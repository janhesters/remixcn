import { fileURLToPath } from 'node:url'

import { createAssetServer } from 'remix/assets'
import { ImportMap } from 'remix/component/server'
import { render } from 'remix/middleware/render'
import { createRouter } from 'remix/router'

import { invoices } from './invoices.ts'
import { Disclosure } from './public/disclosure.tsx'

// A Remix 3.0.0 app as `remix new` sets it up, reduced to one page: the
// end-to-end tests serve it locally and install components into it.
let assets = createAssetServer({
  basePath: '/assets',
  rootDir: fileURLToPath(new URL('..', import.meta.url)),
  // The fixture installs nothing itself: it uses the workspace's packages.
  mounts: { app: 'app', npm: '../../../node_modules' },
  allowFiles: ['app/**/public/**'],
  allowPackages: ['remix'],
})

let { href, importMap, preloads } = await assets.getScriptEntry('app/public/entry.ts')

function InvoicesPage() {
  return () => (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Invoices · Fixture Co.</title>
        <ImportMap value={importMap} />
        {preloads.map((preload) => (
          <link key={preload} rel="modulepreload" href={preload} />
        ))}
        <script type="module" src={href}></script>
      </head>
      <body>
        <main>
          <h1>Invoices</h1>
          <table>
            <caption>Open invoices</caption>
            <thead>
              <tr>
                <th scope="col">Invoice</th>
                <th scope="col">Customer</th>
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.number}>
                  <td>{invoice.number}</td>
                  <td>{invoice.customer}</td>
                  <td>{invoice.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Disclosure id="payment-terms" summary="Payment terms" details="Due within 30 days." />
        </main>
      </body>
    </html>
  )
}

export let router = createRouter({ middleware: [render({ assets })] })

router.get(
  '/assets/*path',
  async ({ request }) => (await assets.fetch(request)) ?? new Response('Not Found', { status: 404 }),
)
router.get('/', (context) => context.render(<InvoicesPage />))
