// Two synthetic pages that keep the user's theme, for the theme keeper's
// end-to-end tests. The home page has the theme control; the other page has
// none, so only the keeper the entry starts holds the theme there.
import { unsafeHTML } from 'remix/component'
import type { Handle } from 'remix/component'
import { ImportMap } from 'remix/component/server'
import type { ImportMapData } from 'remix/component/server'

import { themeScript } from '#remixcn/lib/theme-keeper.ts'

import { ThemeSelect } from './theme-select.tsx'

interface ScriptEntry {
  href: string
  importMap: ImportMapData
  preloads: readonly string[]
}

interface ThemePageProps {
  page: 'home' | 'other'
  stylesheets: string[]
  script: ScriptEntry
}

export function ThemePage(handle: Handle<ThemePageProps>) {
  return () => {
    let { page, stylesheets, script } = handle.props
    let home = page === 'home'

    return (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content="light dark" />
          <script innerHTML={unsafeHTML(themeScript)} />
          <title>{home ? 'Invoices' : 'Clients'}</title>
          {stylesheets.map((href) => (
            <link key={href} rel="stylesheet" href={href} />
          ))}
          <ImportMap value={script.importMap} />
          {script.preloads.map((href) => (
            <link key={href} rel="modulepreload" href={href} />
          ))}
          <script type="module" src={script.href}></script>
        </head>
        <body>
          <main>
            <h1>{home ? 'Invoices' : 'Clients'}</h1>
            <p>{home ? 'Invoice 2026-114 is due on 3 December.' : 'Northwind Traders has two open invoices.'}</p>
            {home ? <ThemeSelect /> : null}
            <a href={home ? '/other' : '/'}>{home ? 'Clients' : 'Invoices'}</a>
          </main>
        </body>
      </html>
    )
  }
}
