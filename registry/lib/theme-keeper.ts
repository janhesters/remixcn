// RemixCN Theme keeper: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md

// Light, dark, or the system's theme, chosen by the user and kept in the
// browser. theme.css follows the system through light-dark(), and
// data-theme="light" or "dark" on <html> overrides it. So a Light or Dark
// choice sets the attribute and System clears it, and CSS alone follows a
// device change. The choice lives in localStorage, so the head bootstrap
// applies it before the first paint without a request; nothing leaves the
// browser. Importing this module reads no browser global, so the server can
// render the bootstrap from it.
//
// Usage: put the bootstrap first in <head>, before stylesheets and scripts,
// then let a browser control read and set the choice:
//
//   <script innerHTML={unsafeHTML(themeScript)} />
//
//   let keeper = pageTheme()
//   keeper.addEventListener('change', () => handle.update(), { signal: handle.signal })
//   keeper.set('dark')

export const themeChoices = ['light', 'dark', 'system'] as const
export type ThemeChoice = (typeof themeChoices)[number]

/** The localStorage key of the choice. The RemixCN site uses it too, so its readers keep their choice. */
export const themeStorageKey = 'remixcn-theme'

/** The choices that set data-theme. System clears it. */
const attributeThemes = themeChoices.filter((choice) => choice !== 'system')

export type ThemeStorage = Pick<Storage, 'getItem' | 'setItem'>

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return themeChoices.includes(value as ThemeChoice)
}

/**
 * The bootstrap for <head>: it sets a saved Light or Dark choice on <html>
 * before the page paints, and leaves anything else, or a storage the browser
 * blocks, to the system's theme. Without scripting, the system's theme shows.
 * It holds no user input, so it's safe as inline script text.
 */
export const themeScript = `try{var t=localStorage.getItem(${JSON.stringify(themeStorageKey)});if(${attributeThemes
  .map((theme) => `t===${JSON.stringify(theme)}`)
  .join('||')})document.documentElement.setAttribute("data-theme",t)}catch(e){}`

/** Reads the saved choice: System when there is none, it's invalid, or the browser blocks the storage. */
export function readSavedTheme(storage: Pick<Storage, 'getItem'> | null): ThemeChoice {
  try {
    let saved = storage?.getItem(themeStorageKey)
    return isThemeChoice(saved) ? saved : 'system'
  } catch {
    return 'system'
  }
}

function apply(root: Element, choice: ThemeChoice) {
  if (choice === 'system') {
    if (root.hasAttribute('data-theme')) root.removeAttribute('data-theme')
  } else if (root.getAttribute('data-theme') !== choice) {
    root.setAttribute('data-theme', choice)
  }
}

export interface ThemeKeeper extends EventTarget {
  /** The user's choice, not the colors it resolves to: System leaves those to the device. */
  readonly choice: ThemeChoice
  /** Applies a choice and saves it. When the storage refuses it, it still holds for this page. */
  set(choice: ThemeChoice): void
}

/**
 * Keeps `root`'s data-theme on the saved choice until `signal` aborts, and
 * dispatches `change` whenever the choice changes.
 *
 * Remix's runtime diffs the attributes of <html> on an in-place document
 * update and drops the one the server never renders. A mutation observer
 * puts it back in the same task, before the next paint. A choice made in
 * another tab arrives through the storage event; a removed choice, or a
 * cleared storage, resets to System.
 */
export function createThemeKeeper(root: Element, storage: ThemeStorage | null, signal: AbortSignal): ThemeKeeper {
  let choice = readSavedTheme(storage)
  let keeper = new EventTarget() as ThemeKeeper

  let choose = (next: ThemeChoice) => {
    let changed = next !== choice
    choice = next
    apply(root, choice)
    if (changed) keeper.dispatchEvent(new Event('change'))
  }

  Object.defineProperty(keeper, 'choice', { get: () => choice })
  keeper.set = (next) => {
    try {
      storage?.setItem(themeStorageKey, next)
    } catch {
      // A blocked or full storage keeps the choice for this page only.
    }
    choose(next)
  }

  apply(root, choice)
  if (signal.aborted) return keeper

  let observer = new MutationObserver(() => apply(root, choice))
  observer.observe(root, { attributeFilter: ['data-theme'] })
  signal.addEventListener('abort', () => observer.disconnect(), { once: true })

  window.addEventListener(
    'storage',
    (event) => {
      if (event.storageArea && event.storageArea !== storage) return
      if (event.key === null) choose('system')
      else if (event.key === themeStorageKey) choose(isThemeChoice(event.newValue) ? event.newValue : 'system')
    },
    { signal },
  )

  return keeper
}

function localStorageOrNull(): ThemeStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

let pageKeeper: ThemeKeeper | undefined

/** The keeper of this page's <html>, made on first use. Call it in the browser only, such as from a client entry's task. */
export function pageTheme(): ThemeKeeper {
  pageKeeper ??= createThemeKeeper(document.documentElement, localStorageOrNull(), new AbortController().signal)
  return pageKeeper
}
