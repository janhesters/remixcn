// RemixCN Focus scope: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { createMixin } from 'remix/component'
import type { MixinFactory } from 'remix/component'

// Initial and return focus for popups. A native modal <dialog> already moves
// focus inside and keeps it there; this fills the gaps: popups that aren't
// dialogs, an explicit initial focus target, and a trigger that was removed or
// disabled while the popup was open, where the browser would drop focus on
// <body>.

const focusableSelector = [
  'a[href]',
  'area[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'iframe',
  'summary',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]',
].join(', ')

function isVisible(element: Element) {
  return typeof element.checkVisibility === 'function'
    ? element.checkVisibility({ visibilityProperty: true })
    : element.getClientRects().length > 0
}

/** Whether the element can take focus now: connected, enabled, visible and not inert. */
export function isFocusable(element: Element | null | undefined): element is HTMLElement {
  return (
    element instanceof HTMLElement &&
    element.isConnected &&
    element.matches(focusableSelector) &&
    !element.matches(':disabled') &&
    !element.closest('[inert]') &&
    isVisible(element)
  )
}

/** The elements inside `root` that Tab reaches, in document order. */
export function getTabbableElements(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll(focusableSelector)].filter(
    (element): element is HTMLElement => isFocusable(element) && element.tabIndex >= 0,
  )
}

type FocusTarget = HTMLElement | null | (() => HTMLElement | null)

export interface FocusScopeOptions {
  /** What to focus on open, or `false` to leave focus alone. By default: focus that is already inside stays, else the first `[autofocus]` or tabbable element, else the container. */
  initialFocus?: FocusTarget | false
  /** What to focus on close, or `false` to leave focus alone (defaults to the element focused when the scope started). */
  returnFocus?: FocusTarget | false
  /** What to focus on close when the return target was removed, disabled or hidden. By default, the first tabbable element in its closest remaining ancestor, up to `<body>`. */
  fallbackFocus?: () => HTMLElement | null
}

function resolve(target: FocusTarget | undefined): HTMLElement | null {
  return typeof target === 'function' ? target() : (target ?? null)
}

function getFocused(document: Document) {
  let active = document.activeElement
  return active instanceof HTMLElement && active !== document.body ? active : null
}

/**
 * Moves focus into `container` on the next animation frame, once a popup that
 * just opened is visible, and returns a function that ends the scope. Ending
 * it returns focus, unless the user already moved focus somewhere outside the
 * container.
 */
export function createFocusScope(container: HTMLElement, options: FocusScopeOptions = {}): () => void {
  let document = container.ownerDocument
  let view = document.defaultView!
  let focused = getFocused(document)
  let returnTarget = (options.returnFocus === false ? null : resolve(options.returnFocus)) ?? focused
  if (returnTarget && container.contains(returnTarget)) returnTarget = null
  // From the closest wrapper up to <body>, which stays when every wrapper is gone.
  let ancestors: Element[] = []
  for (let parent = returnTarget?.parentElement; parent; parent = parent.parentElement) {
    ancestors.push(parent)
    if (parent === document.body) break
  }
  let addedTabIndex = false
  let released = false

  let frame = view.requestAnimationFrame(() => {
    if (options.initialFocus === false) return
    let explicit = resolve(options.initialFocus)
    let active = getFocused(document)
    if (!explicit && active && container.contains(active)) return

    let target =
      explicit ??
      [...container.querySelectorAll('[autofocus]')].find(isFocusable) ??
      getTabbableElements(container)[0] ??
      container
    if (target === container && !container.hasAttribute('tabindex')) {
      container.tabIndex = -1
      addedTabIndex = true
    }
    target.focus()
  })

  function getReturnTarget() {
    let target = options.returnFocus === undefined ? returnTarget : resolve(options.returnFocus || null)
    if (isFocusable(target)) return target

    let fallback = options.fallbackFocus?.()
    if (isFocusable(fallback)) return fallback

    let ancestor = ancestors.find((element) => element.isConnected)
    return ancestor ? getTabbableElements(ancestor).find((element) => !container.contains(element)) : undefined
  }

  return () => {
    if (released) return
    released = true
    view.cancelAnimationFrame(frame)
    if (addedTabIndex) container.removeAttribute('tabindex')
    if (options.returnFocus === false) return

    // Wait for the popup to close, so a closing modal dialog no longer blocks the target.
    queueMicrotask(() => {
      let active = getFocused(document)
      if (active && !container.contains(active)) return
      getReturnTarget()?.focus()
    })
  }
}

export interface FocusScopeMixinOptions extends FocusScopeOptions {
  /** Whether the popup is open (defaults to `true`). Set it to the popup's open state. */
  open?: boolean
}

/**
 * Runs a focus scope on the host while `open` isn't false. It remembers the
 * focused element when the popup starts to open, before the browser or a
 * native dialog moves focus, and returns focus when the popup closes or
 * unmounts.
 */
export const focusScope: MixinFactory<HTMLElement, [options?: FocusScopeMixinOptions]> = createMixin<
  HTMLElement,
  [options?: FocusScopeMixinOptions]
>(
  (handle) => {
    let host: HTMLElement | null = null
    let options: FocusScopeMixinOptions = {}
    let opener: HTMLElement | null = null
    let release: (() => void) | null = null

    function sync() {
      let active = host !== null && options.open !== false
      if (active && !release) {
        release = createFocusScope(host!, { ...options, returnFocus: options.returnFocus ?? opener })
      } else if (!active && release) {
        release()
        release = null
      }
    }

    handle.addEventListener('insert', (event) => {
      host = event.node
      sync()
    })

    handle.addEventListener('remove', () => {
      host = null
      sync()
    })

    return (nextOptions = {}) => {
      // Renders run before the commit that opens the popup, so focus is still on the opener.
      if (nextOptions.open !== false && (!release || options.open === false)) opener = getFocused(document)
      options = nextOptions
      if (host) handle.queueTask(sync)
      return handle.element
    }
  },
  { ssr: false },
)
