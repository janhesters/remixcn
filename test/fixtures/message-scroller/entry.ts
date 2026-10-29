// The browser entry of the examples: it hydrates the client entries, as the
// entry of a `remix new` app does.
import { detectMultipleImportMapSupport, importModule, preloadShim } from 'remix/multiple-import-maps-polyfill'
import { run } from 'remix/component'

let app = run({
  async loadModule(moduleUrl, exportName) {
    let mod = await importModule(moduleUrl)
    let Component = mod[exportName]
    if (typeof Component !== 'function') throw new Error(`Unknown component: ${moduleUrl}#${exportName}`)
    return Component
  },
  async processClientEntryPreloads(preloads) {
    if (await detectMultipleImportMapSupport()) return preloads

    preloadShim(preloads)
    return []
  },
})

app.addEventListener('error', (event) => {
  console.error('Component error:', event.error)
})

await app.ready()
// Tests wait for this mark, so they never press a key before the client entries run.
document.documentElement.dataset.hydrated = 'true'
