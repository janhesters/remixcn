// RemixCN Modal inertness and scroll lock: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from Base UI (MIT, Copyright (c) 2019 Material-UI SAS) and Remix (MIT, Copyright (c) 2025 Shopify Inc.).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { createMixin } from 'remix/component'
import type { MixinFactory } from 'remix/component'

// Modal behavior for popups that aren't native modal dialogs, such as a modal
// menu or a sheet: page scrolling stops and everything outside the popup
// becomes inert. A <dialog> opened with showModal() is inert-modal already, so
// it only needs the scroll lock. Both helpers track every open modal, and the
// last release restores exactly the earlier state.

interface ScrollLock {
  count: number
  restore: () => void
}

const scrollLocks = new WeakMap<Document, ScrollLock>()

/** Stops the document from scrolling until every returned unlock function has run. */
export function lockScroll(document: Document = globalThis.document): () => void {
  let view = document.defaultView
  if (!view) return () => {}

  let lock = scrollLocks.get(document)
  if (!lock) {
    let root = document.documentElement
    let { scrollX, scrollY } = view
    let scrollbarWidth = view.innerWidth - root.clientWidth
    let saved = ['overflow-x', 'overflow-y', 'scrollbar-gutter'].map(
      (property) => [property, root.style.getPropertyValue(property), root.style.getPropertyPriority(property)] as const,
    )

    // Keep the space of a classic scrollbar, so the page doesn't shift sideways.
    if (scrollbarWidth > 0 && getComputedStyle(root).scrollbarGutter === 'auto') {
      root.style.setProperty('scrollbar-gutter', 'stable')
    }
    root.style.setProperty('overflow-x', 'hidden')
    root.style.setProperty('overflow-y', 'hidden')

    lock = {
      count: 0,
      restore() {
        for (let [property, value, priority] of saved) {
          if (value) root.style.setProperty(property, value, priority)
          else root.style.removeProperty(property)
        }
        view.scrollTo(scrollX, scrollY)
      },
    }
    scrollLocks.set(document, lock)
  }

  let current = lock
  current.count++
  let unlocked = false

  return () => {
    if (unlocked) return
    unlocked = true
    if (--current.count > 0) return
    scrollLocks.delete(document)
    current.restore()
  }
}

interface InertScope {
  keep: Set<Element>
}

interface InertState {
  /** Open scopes, oldest first. Only the newest one applies. */
  scopes: InertScope[]
  /** The elements this helper made inert, with whether they were inert before. */
  marked: Map<Element, boolean>
  /** The elements whose children the newest scope decides about: <body> and the kept elements' ancestors. */
  parents: Set<Element>
  observer: MutationObserver
}

const inertStates = new WeakMap<Document, InertState>()
const skippedTags = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'LINK', 'META', 'NOSCRIPT'])

/** Applies the newest scope: everything beside the kept elements and their ancestors becomes inert. */
function reconcile(state: InertState, document: Document) {
  let keep = state.scopes.at(-1)?.keep ?? new Set<Element>()
  // A kept element inside another one is covered by it, so walk only from the outermost.
  let outermost = [...keep].filter((element) => ![...keep].some((other) => other !== element && other.contains(element)))
  let parents = new Set<Element>()
  for (let element of outermost) {
    for (let parent = element.parentElement; parent; parent = parent.parentElement) parents.add(parent)
  }

  let wanted = new Set<Element>()
  if (keep.size > 0) {
    for (let parent of parents) {
      if (parent !== document.body && !document.body.contains(parent)) continue
      for (let child of parent.children) {
        if (!keep.has(child) && !parents.has(child) && !skippedTags.has(child.tagName)) wanted.add(child)
      }
    }
  }

  for (let [element, wasInert] of state.marked) {
    if (wanted.has(element)) continue
    state.marked.delete(element)
    if (!wasInert) element.removeAttribute('inert')
  }
  for (let element of wanted) {
    if (state.marked.has(element)) continue
    let wasInert = element.hasAttribute('inert')
    state.marked.set(element, wasInert)
    if (!wasInert) element.setAttribute('inert', '')
  }
  state.parents = parents
}

/**
 * Makes everything in the document outside `keep` inert: the siblings of each
 * kept element and of its ancestors, also when content is added later. Only
 * the newest call applies, so a modal opened from another modal, even in a
 * sibling portal, stays interactive; closing it applies the one below again.
 * Returns a function that undoes it; elements that were inert before stay inert.
 */
export function inertOthers(keep: Iterable<Element>): () => void {
  let kept = new Set(keep)
  let first = kept.values().next().value
  if (!first) return () => {}

  let document = first.ownerDocument
  let state = inertStates.get(document)
  if (!state) {
    let created: InertState = {
      scopes: [],
      marked: new Map(),
      parents: new Set(),
      observer: new MutationObserver((records) => {
        if (records.some((record) => created.parents.has(record.target as Element))) reconcile(created, document)
      }),
    }
    created.observer.observe(document.body, { childList: true, subtree: true })
    inertStates.set(document, created)
    state = created
  }

  let current = state
  let scope: InertScope = { keep: kept }
  current.scopes.push(scope)
  reconcile(current, document)

  return () => {
    let index = current.scopes.indexOf(scope)
    if (index === -1) return
    current.scopes.splice(index, 1)
    reconcile(current, document)
    if (current.scopes.length === 0) {
      current.observer.disconnect()
      inertStates.delete(document)
    }
  }
}

export interface ModalOptions {
  /** Whether the popup is open (defaults to `true`). Set it to the popup's open state. */
  open?: boolean
  /** Whether page scrolling stops while open (defaults to `true`). */
  lockScroll?: boolean
  /** More elements that stay interactive, such as the trigger or a toast region. */
  keep?: () => Iterable<Element | null>
}

/**
 * Makes the host modal while `open` isn't false: page scrolling stops and,
 * unless the host is a native <dialog>, everything outside it becomes inert.
 * Closing or unmounting the popup restores the earlier state.
 */
export const modal: MixinFactory<HTMLElement, [options?: ModalOptions]> = createMixin<HTMLElement, [options?: ModalOptions]>(
  (handle) => {
    let host: HTMLElement | null = null
    let options: ModalOptions = {}
    let releases: Array<() => void> | null = null

    function sync() {
      let active = host !== null && options.open !== false
      if (active && !releases) {
        releases = []
        if (options.lockScroll !== false) releases.push(lockScroll(host!.ownerDocument))
        if (!(host instanceof HTMLDialogElement)) {
          let extra = [...(options.keep?.() ?? [])].filter((element): element is Element => element !== null)
          releases.push(inertOthers([host!, ...extra]))
        }
      } else if (!active && releases) {
        for (let release of releases) release()
        releases = null
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
      options = nextOptions
      if (host) handle.queueTask(sync)
      return handle.element
    }
  },
  { ssr: false },
)
