import * as assert from 'remix/assert'
// Loaded before the browser globals go away, as in any server app: only the helpers are under test.
import 'remix/component'
import { renderToString } from 'remix/component/server'
import { describe, it } from 'remix/test'

const helpers = ['anchor-position', 'composite', 'focus-scope', 'layer', 'modal']

const browserGlobals = [
  'window',
  'document',
  'navigator',
  'location',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'ResizeObserver',
  'MutationObserver',
  'CSS',
  'Element',
  'HTMLElement',
  'HTMLDialogElement',
  'visualViewport',
  'innerWidth',
  'innerHeight',
  'scrollTo',
]

/** Makes every browser global throw while `work` runs, and reports which ones it touched. */
async function withoutBrowserGlobals(work: () => Promise<void>) {
  let touched: string[] = []
  let saved = browserGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const)

  for (let name of browserGlobals) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      get() {
        touched.push(name)
        throw new ReferenceError(`${name} is not defined on the server`)
      },
    })
  }
  try {
    await work()
  } finally {
    for (let [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else delete (globalThis as Record<string, unknown>)[name]
    }
  }
  return touched
}

describe('registry/lib on the server', () => {
  it('imports and renders without touching window, document or other browser globals', async () => {
    let html = ''
    let touched = await withoutBrowserGlobals(async () => {
      // A query string gives fresh module instances, even when another test imported them.
      let modules = await Promise.all(
        helpers.map((name) => import(new URL(`./${name}.ts?server-render`, import.meta.url).href)),
      )
      let [{ anchorPosition }, { rovingFocus, activeDescendant }, { focusScope }, { dismissableLayer }, { modal }] =
        modules

      html = await renderToString(
        <main>
          <button type="button">Open</button>
          <div
            popover="manual"
            mix={[
              dismissableLayer({ onDismiss() {} }),
              focusScope(),
              modal(),
              anchorPosition({ anchor: { x: 0, y: 0 }, side: 'top' }),
            ]}
          >
            <div role="toolbar" mix={rovingFocus({ items: 'button' })}>
              <button type="button">Bold</button>
            </div>
            <input role="combobox" mix={activeDescendant({ items: () => [] })} />
          </div>
        </main>,
      )
    })

    assert.deepEqual(touched, [])
    assert.equal(
      html,
      '<main><button type="button">Open</button><div popover="manual"><div role="toolbar"><button type="button">Bold</button></div><input role="combobox" /></div></main>',
    )
  })
})
