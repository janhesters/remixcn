// Starts the page in the browser as an app's entry would: the theme keeper
// first, so it holds the choice on every page, then Remix's runtime, which
// hydrates the theme control and opens same-site links in place. data-ready
// on <html> tells the browser tests that hydration finished.
import { run } from 'remix/component'

import { pageTheme } from '#remixcn/lib/theme-keeper.ts'

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
