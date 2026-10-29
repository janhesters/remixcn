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

await app.ready()
// Tests wait for this mark, so they never click before the client entries run.
document.documentElement.dataset.hydrated = 'true'
