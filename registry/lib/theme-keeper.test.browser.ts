import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { createThemeKeeper, readSavedTheme, themeScript, themeStorageKey } from './theme-keeper.ts'

function memoryStorage(initial: Record<string, string> = {}) {
  let values = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    values,
  }
}

/** A storage that reads but refuses every write, as a full or read-only storage does. */
function readOnlyStorage(initial: Record<string, string> = {}) {
  let storage = memoryStorage(initial)
  return {
    getItem: storage.getItem,
    setItem() {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    },
  }
}

const blockedStorage = {
  getItem(): string | null {
    throw new DOMException('The operation is insecure.', 'SecurityError')
  },
  setItem() {
    throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
  },
}

function setup(t: TestContext) {
  let root = document.createElement('div')
  document.body.append(root)
  let controller = new AbortController()
  t.after(() => {
    controller.abort()
    root.remove()
  })
  return { root, signal: controller.signal }
}

function mutationsDelivered() {
  return new Promise((resolve) => setTimeout(resolve))
}

describe('readSavedTheme', () => {
  it('reads light or dark, and falls back to the system theme for anything else', () => {
    assert.equal(readSavedTheme(memoryStorage({ [themeStorageKey]: 'dark' })), 'dark')
    assert.equal(readSavedTheme(memoryStorage({ [themeStorageKey]: 'light' })), 'light')
    assert.equal(readSavedTheme(memoryStorage({ [themeStorageKey]: 'system' })), 'system')
    assert.equal(readSavedTheme(memoryStorage({ [themeStorageKey]: 'sepia' })), 'system')
    assert.equal(readSavedTheme(memoryStorage({ theme: 'dark' })), 'system')
    assert.equal(readSavedTheme(memoryStorage()), 'system')
    assert.equal(readSavedTheme(blockedStorage), 'system')
    assert.equal(readSavedTheme(null), 'system')
  })
})

describe('createThemeKeeper', () => {
  it('applies the saved choice to the root, and a new choice to the root and the storage', (t) => {
    let { root, signal } = setup(t)
    let storage = memoryStorage({ [themeStorageKey]: 'dark' })

    let keeper = createThemeKeeper(root, storage, signal)
    assert.equal(keeper.choice, 'dark')
    assert.equal(root.dataset.theme, 'dark')

    keeper.set('light')
    assert.equal(root.dataset.theme, 'light')
    assert.equal(storage.values.get(themeStorageKey), 'light')

    keeper.set('system')
    assert.equal(root.hasAttribute('data-theme'), false)
    assert.equal(storage.values.get(themeStorageKey), 'system')
  })

  it('starts in System when the storage is missing, holds an invalid value, or is blocked', (t) => {
    let { root, signal } = setup(t)

    for (let storage of [null, memoryStorage(), memoryStorage({ [themeStorageKey]: 'sepia' }), blockedStorage]) {
      root.dataset.theme = 'dark'
      let keeper = createThemeKeeper(root, storage, signal)
      assert.equal(keeper.choice, 'system')
      assert.equal(root.hasAttribute('data-theme'), false)
    }
  })

  it('keeps a choice for the page when the storage refuses it', (t) => {
    let { root, signal } = setup(t)

    let keeper = createThemeKeeper(root, blockedStorage, signal)
    keeper.set('dark')

    assert.equal(keeper.choice, 'dark')
    assert.equal(root.dataset.theme, 'dark')
  })

  it('keeps a choice the storage refused through a later document update', async (t) => {
    let { root, signal } = setup(t)
    let storage = readOnlyStorage({ [themeStorageKey]: 'light' })
    let keeper = createThemeKeeper(root, storage, signal)

    keeper.set('dark')
    assert.equal(storage.getItem(themeStorageKey), 'light')

    root.removeAttribute('data-theme')
    await mutationsDelivered()
    assert.equal(root.dataset.theme, 'dark')
    assert.equal(keeper.choice, 'dark')
  })

  it('tells the page once per change of the choice', (t) => {
    let { root, signal } = setup(t)
    let keeper = createThemeKeeper(root, memoryStorage(), signal)
    let changes: string[] = []
    keeper.addEventListener('change', () => changes.push(keeper.choice), { signal })

    keeper.set('dark')
    keeper.set('dark')
    keeper.set('system')

    assert.deepEqual(changes, ['dark', 'system'])
  })

  it('puts the attribute back when a document update drops or changes it, as an in-place navigation does', async (t) => {
    let { root, signal } = setup(t)
    let keeper = createThemeKeeper(root, memoryStorage(), signal)
    keeper.set('dark')

    root.removeAttribute('data-theme')
    await mutationsDelivered()
    assert.equal(root.dataset.theme, 'dark')

    root.dataset.theme = 'light'
    await mutationsDelivered()
    assert.equal(root.dataset.theme, 'dark')

    keeper.set('system')
    root.dataset.theme = 'light'
    await mutationsDelivered()
    assert.equal(root.hasAttribute('data-theme'), false)
  })

  it("follows another tab's choice and tells the page", (t) => {
    let { root, signal } = setup(t)
    let keeper = createThemeKeeper(root, memoryStorage(), signal)
    let changes: string[] = []
    keeper.addEventListener('change', () => changes.push(keeper.choice), { signal })

    window.dispatchEvent(new StorageEvent('storage', { key: themeStorageKey, newValue: 'dark' }))
    window.dispatchEvent(new StorageEvent('storage', { key: 'other', newValue: 'light' }))

    assert.equal(keeper.choice, 'dark')
    assert.equal(root.dataset.theme, 'dark')
    assert.deepEqual(changes, ['dark'])
  })

  it('resets to System when another tab removes the choice or clears the storage', (t) => {
    let { root, signal } = setup(t)
    let keeper = createThemeKeeper(root, memoryStorage({ [themeStorageKey]: 'dark' }), signal)

    window.dispatchEvent(new StorageEvent('storage', { key: themeStorageKey, oldValue: 'dark', newValue: null }))
    assert.equal(keeper.choice, 'system')
    assert.equal(root.hasAttribute('data-theme'), false)

    keeper.set('light')
    window.dispatchEvent(new StorageEvent('storage', { key: null }))
    assert.equal(keeper.choice, 'system')
    assert.equal(root.hasAttribute('data-theme'), false)

    keeper.set('light')
    window.dispatchEvent(new StorageEvent('storage', { key: themeStorageKey, newValue: 'sepia' }))
    assert.equal(keeper.choice, 'system')
  })

  it('ignores the same key in another storage, such as sessionStorage', (t) => {
    let { root, signal } = setup(t)
    let keeper = createThemeKeeper(root, localStorage, signal)
    let choice = keeper.choice

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: themeStorageKey,
        newValue: choice === 'dark' ? 'light' : 'dark',
        storageArea: sessionStorage,
      }),
    )

    assert.equal(keeper.choice, choice)
  })

  it('stops watching once its signal aborts', async (t) => {
    let { root } = setup(t)
    let controller = new AbortController()
    let keeper = createThemeKeeper(root, memoryStorage(), controller.signal)
    keeper.set('dark')
    controller.abort()

    root.removeAttribute('data-theme')
    window.dispatchEvent(new StorageEvent('storage', { key: themeStorageKey, newValue: 'light' }))
    await mutationsDelivered()

    assert.equal(root.hasAttribute('data-theme'), false)
    assert.equal(keeper.choice, 'dark')
  })
})

describe('themeScript', () => {
  it('applies a saved light or dark choice to the document before the page paints', (t) => {
    let saved = localStorage.getItem(themeStorageKey)
    let theme = document.documentElement.getAttribute('data-theme')
    t.after(() => {
      if (saved === null) localStorage.removeItem(themeStorageKey)
      else localStorage.setItem(themeStorageKey, saved)
      if (theme === null) document.documentElement.removeAttribute('data-theme')
      else document.documentElement.setAttribute('data-theme', theme)
    })

    localStorage.setItem(themeStorageKey, 'dark')
    new Function(themeScript)()
    assert.equal(document.documentElement.dataset.theme, 'dark')

    localStorage.setItem(themeStorageKey, '"><img src=x>')
    document.documentElement.removeAttribute('data-theme')
    new Function(themeScript)()
    assert.equal(document.documentElement.hasAttribute('data-theme'), false)
  })
})
