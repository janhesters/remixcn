// Starts the site in the browser: the reader's theme, then Remix's runtime,
// which hydrates the client entries and opens same-site links in place.
// data-ready on <html> tells the browser tests that the first page hydrated.
import { run } from 'remix/component'

import { pageTheme } from './theme.ts'

pageTheme()

let app = run({
  async loadModule(moduleUrl, exportName) {
    let module = await import(moduleUrl)
    let Component = module[exportName]
    if (typeof Component !== 'function') throw new Error(`Unknown component: ${moduleUrl}#${exportName}`)
    return Component
  },
})

app.addEventListener('error', (event) => console.error('Component error:', event.error))

await app.ready()
document.documentElement.dataset.ready = 'true'
