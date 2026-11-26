import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { readSavedTheme, themeScript, themeStorageKey } from './theme-keeper.ts'

const browserGlobals = ['window', 'document', 'localStorage', 'sessionStorage', 'matchMedia', 'MutationObserver']

/** Runs the head bootstrap against a stored value, or a storage that throws, and returns the data-theme it sets. */
function runBootstrap(stored: string | null | Error) {
  let attributes = new Map<string, string>()
  let localStorage = {
    getItem(key: string) {
      assert.equal(key, themeStorageKey)
      if (stored instanceof Error) throw stored
      return stored
    },
  }
  let document = { documentElement: { setAttribute: (name: string, value: string) => attributes.set(name, value) } }
  new Function('localStorage', 'document', themeScript)(localStorage, document)
  return attributes.get('data-theme') ?? null
}

describe('theme-keeper on the server', () => {
  it('imports without reading a browser global', async (t) => {
    let reads: string[] = []
    for (let name of browserGlobals) {
      let original = Object.getOwnPropertyDescriptor(globalThis, name)
      Object.defineProperty(globalThis, name, {
        configurable: true,
        get() {
          reads.push(name)
          return undefined
        },
      })
      t.after(() => {
        if (original) Object.defineProperty(globalThis, name, original)
        else Reflect.deleteProperty(globalThis, name)
      })
    }

    let module: typeof import('./theme-keeper.ts') = await import(`./theme-keeper.ts?server-import=${Date.now()}`)

    assert.deepEqual(reads, [])
    assert.ok(module.themeScript.includes(JSON.stringify(themeStorageKey)))
    assert.equal(module.readSavedTheme(null), 'system')
  })
})

describe('themeScript', () => {
  it('sets data-theme exactly for the saved choices the keeper reads as Light or Dark', () => {
    let blocked = new DOMException('The operation is insecure.', 'SecurityError')
    let stored = ['light', 'dark', 'system', 'Dark', 'sepia', '', '"><img src=x>', null, blocked]

    for (let value of stored) {
      let expected = readSavedTheme({
        getItem() {
          if (value instanceof Error) throw value
          return value
        },
      })
      assert.equal(runBootstrap(value), expected === 'system' ? null : expected, `stored ${String(value)}`)
    }
  })
})
