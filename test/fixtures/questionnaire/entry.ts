// Hydrates the examples' client entries, as a remix new app's entry does.
// data-ready on <html> tells the browser tests that hydration finished.
import { run } from 'remix/component'

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
