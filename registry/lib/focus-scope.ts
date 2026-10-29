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

/** Whether `element` is a radio button of a named group, which Tab treats as one stop. */
function isGroupedRadio(element: Element | null): element is HTMLInputElement {
  return element instanceof HTMLInputElement && element.type === 'radio' && element.name !== ''
}

/** Whether Tab treats `a` and `b` as one stop: the same element, or two radios of one group. */
function isSameStop(a: Element | null, b: Element | null = null) {
  if (a === b) return true
  if (!isGroupedRadio(a) || !isGroupedRadio(b)) return false
  return a.name === b.name && a.form === b.form
}

/**
 * The elements inside `root` that Tab reaches, in document order. A named
 * radio group with a checked radio is one stop, the checked radio, as in the
 * browser. Without a checked radio, Tab enters the group at its first radio
 * and Shift+Tab at its last, so all of them stay.
 */
export function getTabbableElements(root: ParentNode): HTMLElement[] {
  let candidates = [...root.querySelectorAll(focusableSelector)].filter(
    (element): element is HTMLElement => isFocusable(element) && element.tabIndex >= 0,
  )
  return candidates.filter(
    (element) =>
      !isGroupedRadio(element) ||
      element.checked ||
      !candidates.some(
        (other) => other !== element && isSameStop(other, element) && (other as HTMLInputElement).checked,
      ),
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
  /**
   * Whether Tab on the last tabbable element and Shift+Tab on the first wrap
   * around inside the container (defaults to `false`). A native modal dialog
   * makes the page inert but lets Tab move on to the browser's toolbar, and
   * Firefox doesn't bring it back; this keeps focus in the dialog, as the
   * APG dialog pattern asks.
   */
  trapFocus?: boolean
}

function resolve(target: FocusTarget | undefined): HTMLElement | null {
  return typeof target === 'function' ? target() : (target ?? null)
}

function getFocused(document: Document) {
  let active = document.activeElement
  return active instanceof HTMLElement && active !== document.body ? active : null
}

/** A running focus scope: call it to end it, or update the options that matter while it runs. */
export interface FocusScope {
  /** Ends the scope and returns focus. Safe to call twice. */
  (): void
  /**
   * Replaces `trapFocus`, `returnFocus` and `fallbackFocus` while the scope
   * runs, such as when a dialog becomes modal. Focus stays where it is.
   */
  update(options: FocusScopeOptions): void
}

/**
 * Moves focus into `container` on the next animation frame, once a popup that
 * just opened is visible, and returns the scope: a function that ends it.
 * Ending it returns focus, unless the user already moved focus somewhere
 * outside the container.
 */
export function createFocusScope(container: HTMLElement, options: FocusScopeOptions = {}): FocusScope {
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
  let current = options

  // At the last stop, Tab wraps to the first one, and Shift+Tab the other way.
  // A radio group is one stop, wherever in it focus is.
  function wrapTab(event: KeyboardEvent) {
    if (!current.trapFocus) return
    if (event.key !== 'Tab' || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
    let tabbable = getTabbableElements(container)
    let edge = event.shiftKey ? tabbable[0] : tabbable.at(-1)
    let active = document.activeElement
    if (tabbable.length > 0 && !isSameStop(active, edge) && active !== container) return
    event.preventDefault()
    ;(event.shiftKey ? tabbable.at(-1) : tabbable[0])?.focus()
  }
  container.addEventListener('keydown', wrapTab)

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
    let target = current.returnFocus === undefined ? returnTarget : resolve(current.returnFocus || null)
    if (isFocusable(target)) return target

    let fallback = current.fallbackFocus?.()
    if (isFocusable(fallback)) return fallback

    let ancestor = ancestors.find((element) => element.isConnected)
    return ancestor ? getTabbableElements(ancestor).find((element) => !container.contains(element)) : undefined
  }

  function release() {
    if (released) return
    released = true
    view.cancelAnimationFrame(frame)
    container.removeEventListener('keydown', wrapTab)
    if (addedTabIndex) container.removeAttribute('tabindex')
    if (current.returnFocus === false) return

    // Wait for the popup to close, so a closing modal dialog no longer blocks the target.
    queueMicrotask(() => {
      let active = getFocused(document)
      if (active && !container.contains(active)) return
      getReturnTarget()?.focus()
    })
  }

  return Object.assign(release, {
    update(next: FocusScopeOptions) {
      current = {
        ...current,
        trapFocus: next.trapFocus,
        returnFocus: next.returnFocus,
        fallbackFocus: next.fallbackFocus,
      }
    },
  })
}

export interface FocusScopeMixinOptions extends FocusScopeOptions {
  /** Whether the popup is open (defaults to `true`). Set it to the popup's open state. */
  open?: boolean
}

/**
 * Runs a focus scope on the host while `open` isn't false. It remembers the
 * focused element when the popup starts to open, before the browser or a
 * native dialog moves focus, and returns focus when the popup closes or
 * unmounts. Changing `trapFocus`, `returnFocus` or `fallbackFocus` while it's
 * open updates the running scope.
 */
export const focusScope: MixinFactory<HTMLElement, [options?: FocusScopeMixinOptions]> = createMixin<
  HTMLElement,
  [options?: FocusScopeMixinOptions]
>(
  (handle) => {
    let host: HTMLElement | null = null
    let options: FocusScopeMixinOptions = {}
    let opener: HTMLElement | null = null
    let release: FocusScope | null = null

    function sync() {
      let active = host !== null && options.open !== false
      // The opener stays the return target while the options change, such as the trap.
      let scopeOptions = { ...options, returnFocus: options.returnFocus ?? opener }
      if (active && !release) {
        release = createFocusScope(host!, scopeOptions)
      } else if (active && release) {
        release.update(scopeOptions)
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
