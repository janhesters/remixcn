// The reader's theme: light, dark, or the system's. registry/lib/theme.css
// follows the system through light-dark(), and data-theme on <html>
// overrides it. The choice lives in localStorage, so it holds across pages
// and visits; nothing leaves the browser.

export const themeChoices = ['light', 'dark', 'system'] as const
export type ThemeChoice = (typeof themeChoices)[number]
export const themeStorageKey = 'remixcn-theme'

type ThemeStorage = Pick<Storage, 'getItem' | 'setItem'>

/**
 * Runs in <head> before the page paints, so a saved light or dark theme
 * shows from the first frame. Without scripting, the system's theme shows.
 */
export const themeScript = `try{var t=localStorage.getItem(${JSON.stringify(themeStorageKey)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`

function isThemeChoice(value: unknown): value is ThemeChoice {
  return themeChoices.includes(value as ThemeChoice)
}

/** Reads the saved choice: the system's theme when there is none, or the browser blocks the storage. */
export function readSavedTheme(storage: Pick<Storage, 'getItem'> | null): ThemeChoice {
  try {
    let saved = storage?.getItem(themeStorageKey)
    return isThemeChoice(saved) ? saved : 'system'
  } catch {
    return 'system'
  }
}

function apply(root: HTMLElement, choice: ThemeChoice) {
  if (choice === 'system') {
    if (root.hasAttribute('data-theme')) root.removeAttribute('data-theme')
  } else if (root.getAttribute('data-theme') !== choice) {
    root.setAttribute('data-theme', choice)
  }
}

export interface ThemeKeeper extends EventTarget {
  readonly choice: ThemeChoice
  set(choice: ThemeChoice): void
}

/**
 * Keeps `root`'s data-theme on the reader's choice until `signal` aborts.
 * Remix's runtime diffs the attributes of <html> on an in-place navigation
 * and drops the one the server never renders; a mutation observer puts it
 * back before the next paint. A choice in another tab arrives through the
 * storage event. Each change of the choice dispatches `change`.
 */
export function createThemeKeeper(root: HTMLElement, storage: ThemeStorage | null, signal: AbortSignal): ThemeKeeper {
  let choice = readSavedTheme(storage)
  let keeper = new EventTarget() as ThemeKeeper

  let choose = (next: ThemeChoice) => {
    choice = next
    apply(root, choice)
    keeper.dispatchEvent(new Event('change'))
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
      if (event.key === themeStorageKey) choose(isThemeChoice(event.newValue) ? event.newValue : 'system')
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

/** The keeper of this page's <html>, made on first use in the browser. */
export function pageTheme(): ThemeKeeper {
  pageKeeper ??= createThemeKeeper(document.documentElement, localStorageOrNull(), new AbortController().signal)
  return pageKeeper
}
