// RemixCN Composite navigation: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from Base UI (MIT, Copyright (c) 2019 Material-UI SAS) and Remix (MIT, Copyright (c) 2025 Shopify Inc.).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { createMixin } from 'remix/component'
import type { MixinFactory } from 'remix/component'

// Keyboard navigation for composite widgets such as menus, listboxes, tabs,
// toolbars and radio groups. Pick one mode per control, as the WAI-ARIA
// Authoring Practices describe:
// - rovingFocus moves DOM focus between the items and keeps one in the tab order.
// - activeDescendant keeps focus on one owner element, such as a combobox input,
//   and points aria-activedescendant at the highlighted item.

export type Orientation = 'horizontal' | 'vertical' | 'both'
export type Direction = 'ltr' | 'rtl'

export interface NavigationOptions {
  /** Which arrow keys move between items (defaults to `'both'`). */
  orientation?: Orientation
  /** Text direction; right-to-left swaps ArrowLeft and ArrowRight (defaults to the host's computed direction). */
  dir?: Direction
  /** Whether moving past the last item wraps to the first (defaults to `true`). */
  loop?: boolean
}

function getStep(key: string, orientation: Orientation, dir: Direction): number | undefined {
  let vertical = orientation !== 'horizontal'
  let horizontal = orientation !== 'vertical'
  let forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
  let backward = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft'

  if (vertical && key === 'ArrowDown') return 1
  if (vertical && key === 'ArrowUp') return -1
  if (horizontal && key === forward) return 1
  if (horizontal && key === backward) return -1
}

/**
 * Returns the index a navigation key moves to, skipping disabled items, or
 * `undefined` when the key doesn't navigate. Home and End jump to the first and
 * last enabled item. Without `loop`, an arrow at either end stays put.
 */
export function getNextIndex(
  key: string,
  current: number,
  disabled: readonly boolean[],
  options: NavigationOptions = {},
): number | undefined {
  let { orientation = 'both', dir = 'ltr', loop = true } = options
  let enabled = disabled.flatMap((isDisabled, index) => (isDisabled ? [] : [index]))
  if (enabled.length === 0) return undefined

  if (key === 'Home') return enabled[0]
  if (key === 'End') return enabled[enabled.length - 1]

  let step = getStep(key, orientation, dir)
  if (step === undefined) return undefined
  if (current < 0) return step > 0 ? enabled[0] : enabled[enabled.length - 1]

  let count = disabled.length
  for (let offset = 1; offset < count; offset++) {
    let index = current + step * offset
    if (!loop && (index < 0 || index >= count)) return current
    index = (index + count) % count
    if (!disabled[index]) return index
  }
  return current
}

/**
 * Finds the item a typeahead query selects, or -1. A repeated letter cycles
 * through the items that start with it; longer text keeps the current item
 * while it still matches.
 */
export function findTypeaheadMatch(
  labels: readonly string[],
  query: string,
  current: number,
  disabled: readonly boolean[] = [],
): number {
  let text = query.toLowerCase()
  if (text === '') return -1

  let repeated = [...text].every((char) => char === text[0])
  let search = repeated ? text[0] : text
  let start = repeated ? current + 1 : Math.max(current, 0)

  for (let offset = 0; offset < labels.length; offset++) {
    let index = (start + offset) % labels.length
    if (disabled[index]) continue
    if (labels[index].trim().toLowerCase().startsWith(search)) return index
  }
  return -1
}

const typeaheadTimeout = 500

/**
 * Collects typed characters into a query that resets after a pause of half a
 * second, for a widget that matches items itself, such as a closed select.
 */
export function createTypeahead() {
  let query = ''
  let timer: ReturnType<typeof setTimeout> | undefined

  function reset() {
    clearTimeout(timer)
    query = ''
  }

  return {
    reset,
    /** Whether a query is still collecting, so a space belongs to it. */
    typing: () => query !== '',
    /** Adds the key to the query and returns it, or returns `undefined` when the key doesn't type. */
    type(event: KeyboardEvent): string | undefined {
      if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return undefined
      if (event.key === ' ' && query === '') return undefined

      clearTimeout(timer)
      query += event.key
      timer = setTimeout(reset, typeaheadTimeout)
      return query
    },
  }
}

let nextId = 0

/** Returns the element's id, assigning a unique one first when it has none. */
export function ensureId(element: Element, prefix = 'remixcn'): string {
  while (!element.id) {
    let id = `${prefix}-${++nextId}`
    if (!element.ownerDocument.getElementById(id)) element.id = id
  }
  return element.id
}

/** Whether the item is disabled through `disabled`, `aria-disabled="true"` or `data-disabled`. */
export function isDisabledItem(item: Element): boolean {
  return (
    item.matches(':disabled') || item.getAttribute('aria-disabled') === 'true' || item.hasAttribute('data-disabled')
  )
}

function getLabel(item: HTMLElement) {
  return item.dataset.label ?? item.textContent ?? ''
}

function getDirection(host: HTMLElement, dir: Direction | undefined): Direction {
  return dir ?? (getComputedStyle(host).direction === 'rtl' ? 'rtl' : 'ltr')
}

function isTextField(element: Element) {
  return (
    element instanceof HTMLTextAreaElement ||
    (element instanceof HTMLInputElement &&
      !['button', 'checkbox', 'radio', 'submit', 'reset'].includes(element.type)) ||
    (element instanceof HTMLElement && element.isContentEditable)
  )
}

type CompositeMode = 'roving focus' | 'active descendant'
// Keyed by the mixin handle id, which every mixin on one host shares.
const modes = new Map<string, CompositeMode>()

function claimMode(hostId: string, mode: CompositeMode) {
  let current = modes.get(hostId)
  if (current && current !== mode) {
    throw new Error(
      `This element already uses ${current}. Use either roving focus or active descendant on a control, not both.`,
    )
  }
  modes.set(hostId, mode)
}

const watchedAttributes = [
  'disabled',
  'aria-disabled',
  'data-disabled',
  'aria-selected',
  'aria-checked',
  'aria-pressed',
  'aria-current',
  'hidden',
  'inert',
  'style',
  'class',
]

const selectedItem =
  '[aria-selected="true"], [aria-checked="true"], [aria-pressed="true"], [aria-current]:not([aria-current="false"])'

/** Whether the item is rendered, visible and outside an inert subtree, so it can take focus at all. */
export function isFocusableItem(item: Element): boolean {
  return !item.closest('[inert]') && item.getClientRects().length > 0 && getComputedStyle(item).visibility === 'visible'
}

// Each roving focus host and its sync, so a group leaves the items of a group
// nested in it alone, and a nested group that starts tells its outer groups.
const rovingHosts = new WeakMap<Element, () => void>()

function isOwnItem(host: Element, item: Element) {
  for (let node = item.parentElement; node && node !== host; node = node.parentElement) {
    if (rovingHosts.has(node)) return false
  }
  return true
}

export interface RovingFocusOptions extends NavigationOptions {
  /** Selector for the items inside the host. */
  items: string
  /** Whether typing letters moves to the matching item (defaults to `false`). Items match on `data-label` or their text. */
  typeahead?: boolean
  /** Whether disabled items still take focus (defaults to `false`). */
  disabledItemsFocusable?: boolean
  /**
   * Whether the tab stop stays on the selected item while focus is outside the
   * group, and goes back to it when focus leaves (defaults to `false`), so Tab
   * enters a tab list at its selected tab.
   */
  resetOnLeave?: boolean
  /** Called when another item becomes the active one, through the keyboard or focus. */
  onActiveChange?: (item: HTMLElement) => void
}

/**
 * Roving tabindex: the active item has `tabindex="0"` and the others `-1`, so
 * Tab enters the group at the active item and the arrow keys, Home and End move
 * focus inside it. The active item starts as the selected, checked, pressed or
 * current item, or the first enabled one. Hidden and inert items never take
 * focus, and the items of a nested roving group belong to that group. The tab
 * stop follows changes to the items, and is checked again before Tab moves
 * focus, so a style sheet that hides the active item can't trap it. When the
 * focused item is removed or disabled, focus moves to the new active item, so
 * it stays in the group. Removing the mixin restores each item's original
 * tabindex.
 */
export const rovingFocus: MixinFactory<HTMLElement, [options: RovingFocusOptions]> = createMixin<
  HTMLElement,
  [options: RovingFocusOptions]
>(
  (handle) => {
    let options: RovingFocusOptions
    let host: HTMLElement | null = null
    let active: HTMLElement | null = null
    let originalTabIndex = new Map<HTMLElement, string | null>()
    let typeahead = createTypeahead()
    let observer: MutationObserver | undefined
    // The item that has focus, kept while it loses focus by leaving or being disabled.
    let focusedItem: HTMLElement | null = null

    function getItems() {
      let current = host
      return current
        ? [...current.querySelectorAll<HTMLElement>(options.items)].filter((item) => isOwnItem(current, item))
        : []
    }

    function isSkipped(item: HTMLElement) {
      return !isFocusableItem(item) || (!options.disabledItemsFocusable && isDisabledItem(item))
    }

    // Tab moves focus after its keydown, so a change no observer sees, such as
    // a style sheet hiding the active item, still moves the tab stop in time.
    function onDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === 'Tab') sync()
    }

    function setTabIndex(item: HTMLElement, value: string) {
      if (!originalTabIndex.has(item)) originalTabIndex.set(item, item.getAttribute('tabindex'))
      if (item.getAttribute('tabindex') !== value) item.setAttribute('tabindex', value)
    }

    function sync() {
      let items = getItems()
      // While focus is outside, the tab stop follows the selection, such as
      // when a controlled tab list selects another tab.
      if (options.resetOnLeave && host && !host.contains(host.ownerDocument.activeElement)) active = null
      if (!active || !items.includes(active) || isSkipped(active)) {
        active =
          items.find((item) => item.matches(selectedItem) && !isSkipped(item)) ??
          items.find((item) => !isSkipped(item)) ??
          null
      }
      for (let item of items) setTabIndex(item, item === active ? '0' : '-1')

      if (focusedItem && focusedItem !== active && (!focusedItem.isConnected || isSkipped(focusedItem))) {
        let current = focusedItem.ownerDocument.activeElement
        let lost = current === null || current === focusedItem || current === focusedItem.ownerDocument.body
        focusedItem = null
        if (lost && active) active.focus()
      }
    }

    function activate(item: HTMLElement, focus: boolean) {
      let changed = item !== active
      active = item
      sync()
      if (focus) item.focus()
      if (changed) options.onActiveChange?.(item)
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || !host) return

      let items = getItems()
      let current = items.findIndex((item) => item.contains(event.target as Node))
      if (current === -1) return

      let disabled = items.map(isSkipped)
      let next = getNextIndex(event.key, current, disabled, { ...options, dir: getDirection(host, options.dir) })

      if (next === undefined && options.typeahead) {
        let query = typeahead.type(event)
        if (query === undefined) return
        next = findTypeaheadMatch(items.map(getLabel), query, current, disabled)
        if (next === -1) return
      }
      if (next === undefined) return

      event.preventDefault()
      activate(items[next], true)
    }

    function onFocusIn(event: FocusEvent) {
      let item = getItems().find((candidate) => candidate === event.target)
      focusedItem = item ?? null
      if (item && !isSkipped(item)) activate(item, false)
    }

    function onFocusOut(event: FocusEvent) {
      let next = event.relatedTarget as Node | null
      if (next && host?.contains(next)) return
      if (next) {
        focusedItem = null
        if (options.resetOnLeave) {
          active = null
          sync()
        }
        return
      }
      // Focus went nowhere: the page lost it, or the item is leaving. Chromium
      // fires this while it removes the item, so decide once the removal is done.
      let item = event.target as HTMLElement
      queueMicrotask(() => {
        if (focusedItem === item && item.isConnected && !isSkipped(item)) focusedItem = null
      })
    }

    handle.addEventListener('insert', (event) => {
      host = event.node
      rovingHosts.set(host, sync)
      host.addEventListener('keydown', onKeyDown)
      host.addEventListener('focusin', onFocusIn)
      host.ownerDocument.addEventListener('keydown', onDocumentKeyDown, true)
      host.addEventListener('focusout', onFocusOut)
      observer = new MutationObserver(sync)
      observer.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: watchedAttributes })
      sync()
      // An outer group may have taken this group's items before it started.
      for (let node = host.parentElement; node; node = node.parentElement) rovingHosts.get(node)?.()
    })

    handle.addEventListener('remove', () => {
      typeahead.reset()
      observer?.disconnect()
      modes.delete(handle.id)
      if (host) {
        rovingHosts.delete(host)
        host.removeEventListener('keydown', onKeyDown)
        host.removeEventListener('focusin', onFocusIn)
        host.ownerDocument.removeEventListener('keydown', onDocumentKeyDown, true)
        host.removeEventListener('focusout', onFocusOut)
      }
      focusedItem = null
      for (let [item, value] of originalTabIndex) {
        if (value === null) item.removeAttribute('tabindex')
        else item.setAttribute('tabindex', value)
      }
      originalTabIndex.clear()
      host = null
      active = null
    })

    return (nextOptions) => {
      // After commit, so a mixin swapped out of this host has released its claim.
      handle.queueTask(() => claimMode(handle.id, 'roving focus'))
      options = nextOptions
      if (host) handle.queueTask(sync)
      return handle.element
    }
  },
  { ssr: false },
)

/** The item an owner's `aria-activedescendant` points at, if it is still in the document. */
export function getActiveDescendant(owner: Element): HTMLElement | null {
  let id = owner.getAttribute('aria-activedescendant')
  return id ? owner.ownerDocument.getElementById(id) : null
}

/**
 * Highlights an item for an active-descendant owner: points the owner's
 * `aria-activedescendant` at it, marks it `data-highlighted` and scrolls it into
 * view. Pass `null` to clear the highlight. Use it for pointer hover and
 * filtering; the `activeDescendant` mixin uses it for the keyboard.
 */
export function highlightItem(owner: Element, item: HTMLElement | null): void {
  let previous = getActiveDescendant(owner)
  if (previous && previous !== item) previous.removeAttribute('data-highlighted')

  if (!item) {
    owner.removeAttribute('aria-activedescendant')
    return
  }

  owner.setAttribute('aria-activedescendant', ensureId(item))
  item.setAttribute('data-highlighted', '')
  item.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
}

export interface ActiveDescendantOptions extends NavigationOptions {
  /** Selector for the items inside the host, or a function that lists them, such as the options of a popup listbox. */
  items: string | (() => Iterable<HTMLElement>)
  /** Whether typing letters highlights the matching item (defaults to `true`, but never on a text field). */
  typeahead?: boolean
  /** Whether disabled items can be highlighted (defaults to `false`). */
  disabledItemsFocusable?: boolean
  /**
   * Whether Home and End move the highlight to the first and last item
   * (defaults to `true`, but `false` on a text field, where they move the caret).
   */
  homeAndEnd?: boolean
  /**
   * Maps a key press to the navigation key it stands for, such as Ctrl+N to
   * `'ArrowDown'`, also with a modifier held. Return `undefined` to leave the
   * press as it is.
   */
  keyAliases?: (event: KeyboardEvent) => string | undefined
  /**
   * Moves the highlight to the item yourself, such as by rendering it from
   * your own state, in place of `highlightItem()`. The mixin then writes
   * nothing, and reads the current item from the host's
   * `aria-activedescendant`, so render it there.
   */
  highlight?: (item: HTMLElement) => void
  /** Called when the highlighted item changes through the keyboard. */
  onActiveChange?: (item: HTMLElement) => void
}

/**
 * Active descendant: DOM focus stays on the host, and the arrow keys, Home, End
 * and typeahead move a highlight between the items through
 * `aria-activedescendant`. On a text field, such as a combobox input, Home, End
 * and typing keep editing the text, unless `homeAndEnd` asks for them.
 * Removing the mixin clears the highlight.
 */
export const activeDescendant: MixinFactory<HTMLElement, [options: ActiveDescendantOptions]> = createMixin<
  HTMLElement,
  [options: ActiveDescendantOptions]
>(
  (handle) => {
    let options: ActiveDescendantOptions
    let host: HTMLElement | null = null
    let typeahead = createTypeahead()

    function getItems() {
      if (typeof options.items === 'function') return [...options.items()]
      return host ? [...host.querySelectorAll<HTMLElement>(options.items)] : []
    }

    function isSkipped(item: HTMLElement) {
      return !options.disabledItemsFocusable && isDisabledItem(item)
    }

    function onKeyDown(event: KeyboardEvent) {
      // Keys that pick a character in an input method belong to it (229 in older browsers).
      if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || !host) return
      let alias = options.keyAliases?.(event)
      if (alias === undefined && (event.ctrlKey || event.metaKey || event.altKey)) return
      let key = alias ?? event.key

      let textField = isTextField(host)
      let { homeAndEnd = !textField } = options
      // An alias is a key of its own, so only the real Home and End stay with the caret.
      if (alias === undefined && !homeAndEnd && (key === 'Home' || key === 'End')) return

      let items = getItems()
      let highlighted = getActiveDescendant(host)
      let current = highlighted ? items.indexOf(highlighted) : -1
      let disabled = items.map(isSkipped)
      let next = getNextIndex(key, current, disabled, { ...options, dir: getDirection(host, options.dir) })

      if (next === undefined && alias === undefined && !textField && options.typeahead !== false) {
        let query = typeahead.type(event)
        if (query === undefined) return
        next = findTypeaheadMatch(items.map(getLabel), query, current, disabled)
        if (next === -1) return
      }
      if (next === undefined) return

      event.preventDefault()
      if (next === current) return
      if (options.highlight) options.highlight(items[next])
      else highlightItem(host, items[next])
      options.onActiveChange?.(items[next])
    }

    handle.addEventListener('insert', (event) => {
      host = event.node
      host.addEventListener('keydown', onKeyDown)
    })

    handle.addEventListener('remove', () => {
      typeahead.reset()
      modes.delete(handle.id)
      if (host) {
        host.removeEventListener('keydown', onKeyDown)
        // An owner that renders the highlight clears its own.
        if (!options.highlight) highlightItem(host, null)
      }
      host = null
    })

    return (nextOptions) => {
      handle.queueTask(() => claimMode(handle.id, 'active descendant'))
      options = nextOptions
      return handle.element
    }
  },
  { ssr: false },
)
