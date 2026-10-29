// RemixCN Dismissable layer: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { createMixin } from 'remix/component'
import type { MixinFactory } from 'remix/component'

// A stack of open dismissable layers per document, such as dialogs, popovers
// and menus. The layer opened last is the topmost. A layer opened inside
// another layer, or from a trigger inside it, is that layer's child.
//
// - Escape dismisses only the topmost layer, unless the content already handled it.
// - A press outside dismisses every layer it lands outside of, topmost first.
//   A press counts only when it starts and ends outside the same layers, so a
//   drag out of a layer or a touch that scrolls dismisses nothing. Presses
//   inside a child layer count as inside its parents. Layers below a modal
//   layer ignore outside presses.
// - Releasing a layer dismisses the child layers it still owns.

export type DismissReason = 'escape-key' | 'outside-press' | 'close-request' | 'parent-dismissed'

export interface DismissRequest {
  reason: DismissReason
  /** The event that asked to dismiss, if any. */
  event?: Event
}

export interface LayerOptions {
  /** Called when the layer should close. Close it, for example by updating the open state. */
  onDismiss: (request: DismissRequest) => void
  /** The element that opened the layer. Presses on it count as inside, and a layer containing it becomes the parent. */
  trigger?: Element | null | (() => Element | null)
  /** Whether layers below this one ignore outside presses, as behind a modal (defaults to `false`). */
  modal?: boolean
  /** Whether Escape and close requests dismiss the layer (defaults to `true`). */
  dismissOnEscape?: boolean
  /** Whether outside presses dismiss the layer, or a function that decides per pressed element (defaults to `true`). */
  dismissOnOutsidePress?: boolean | ((target: Element) => boolean)
}

export interface Layer {
  readonly element: HTMLElement
  /** The layer that owns this one, or `null`. */
  readonly parent: Layer | null
  /** Whether this is the layer Escape would dismiss. */
  isTopmost(): boolean
  /** Replaces the options, such as a newer `onDismiss`. */
  update(options: LayerOptions): void
  /** Removes the layer from the stack and dismisses the child layers it owns. Safe to call twice. */
  release(): void
}

interface Entry {
  layer: Layer
  parent: Layer | null
  options: LayerOptions
}

interface Point {
  x: number
  y: number
}

interface Press {
  down: Element
  downPoint: Point
  up?: Element
  upPoint?: Point
  /** The layers open when the press began; layers opened during it ignore it. */
  entries: Entry[]
}

interface Stack {
  entries: Entry[]
  controller: AbortController
  press: Press | null
}

const stacks = new WeakMap<Document, Stack>()

function resolve<T>(value: T | (() => T)): T {
  return typeof value === 'function' ? (value as () => T)() : value
}

function getTarget(event: Event): Element | null {
  let target = event.composedPath()[0] ?? event.target
  return target instanceof Element ? target : null
}

function isInside(stack: Stack, entry: Entry, target: Element, point?: Point): boolean {
  let { element } = entry.layer
  // A modal dialog's backdrop belongs to the dialog element, outside its box.
  if (target === element && point && element instanceof HTMLDialogElement && element.matches(':modal')) {
    let rect = element.getBoundingClientRect()
    return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
  }
  if (element.contains(target) || resolve(entry.options.trigger)?.contains(target)) return true
  return stack.entries.some((child) => child.parent === entry.layer && isInside(stack, child, target, point))
}

function onKeyDown(stack: Stack, event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return

  let top = stack.entries.at(-1)
  if (!top) return
  // The layers own Escape, so a native dialog doesn't also close itself.
  event.preventDefault()
  if (top.options.dismissOnEscape !== false) top.options.onDismiss({ reason: 'escape-key', event })
}

function onClick(stack: Stack, event: MouseEvent) {
  let press = stack.press
  stack.press = null
  let target = getTarget(event)

  let down: Element, up: Element, downPoint: Point | undefined, upPoint: Point | undefined
  let entries = stack.entries
  if (press?.up) {
    ;({ down, up, downPoint, upPoint } = press as Required<Press>)
    entries = entries.filter((entry) => press.entries.includes(entry))
  } else if (event.detail === 0 && target) {
    // A click without a pointer, from the keyboard or assistive technology.
    down = up = target
  } else {
    // The press began before a layer opened, or the browser canceled it to scroll.
    return
  }

  if (entries.some((entry) => isInside(stack, entry, down, downPoint) !== isInside(stack, entry, up, upPoint))) return

  let modal = entries.findLastIndex((entry) => entry.options.modal)
  let outside = entries.slice(Math.max(modal, 0)).filter((entry) => {
    let allowed = entry.options.dismissOnOutsidePress ?? true
    if (typeof allowed === 'function') allowed = allowed(up)
    return allowed && !isInside(stack, entry, down, downPoint) && !isInside(stack, entry, up, upPoint)
  })

  for (let entry of outside.reverse()) entry.options.onDismiss({ reason: 'outside-press', event })
}

function createStack(document: Document): Stack {
  let stack: Stack = { entries: [], controller: new AbortController(), press: null }
  let capture = { capture: true, signal: stack.controller.signal }

  document.addEventListener('keydown', (event) => onKeyDown(stack, event), { signal: stack.controller.signal })
  document.addEventListener(
    'pointerdown',
    (event) => {
      let down = getTarget(event)
      stack.press = down ? { down, downPoint: { x: event.clientX, y: event.clientY }, entries: [...stack.entries] } : null
    },
    capture,
  )
  document.addEventListener(
    'pointerup',
    (event) => {
      if (!stack.press) return
      // Touch pointers stay captured to where they started, so find where this one ended.
      stack.press.up = document.elementFromPoint(event.clientX, event.clientY) ?? getTarget(event) ?? undefined
      stack.press.upPoint = { x: event.clientX, y: event.clientY }
    },
    capture,
  )
  document.addEventListener('pointercancel', () => (stack.press = null), capture)
  document.addEventListener('click', (event) => onClick(stack, event), capture)

  stacks.set(document, stack)
  return stack
}

/** The open layers of a document, oldest first. */
export function getOpenLayers(document: Document): readonly Layer[] {
  return stacks.get(document)?.entries.map((entry) => entry.layer) ?? []
}

/** Adds `element` to its document's layer stack as the topmost layer until `release()`. */
export function openLayer(element: HTMLElement, options: LayerOptions): Layer {
  let document = element.ownerDocument
  let stack = stacks.get(document) ?? createStack(document)
  let trigger = resolve(options.trigger)
  let parent =
    stack.entries.findLast(({ layer }) => layer.element.contains(element) || (trigger && layer.element.contains(trigger)))
      ?.layer ?? null

  let controller = new AbortController()
  let entry: Entry = {
    parent,
    options,
    layer: {
      element,
      get parent() {
        return entry.parent
      },
      isTopmost: () => stack.entries.at(-1) === entry,
      update(next) {
        entry.options = next
      },
      release() {
        let index = stack.entries.indexOf(entry)
        if (index === -1) return
        stack.entries.splice(index, 1)
        controller.abort()

        for (let child of stack.entries.filter((candidate) => candidate.parent === entry.layer)) {
          child.parent = entry.parent
          child.options.onDismiss({ reason: 'parent-dismissed' })
        }

        if (stack.entries.length === 0) {
          stack.controller.abort()
          stacks.delete(document)
        }
      },
    },
  }

  if (element instanceof HTMLDialogElement) {
    // Close requests that don't come from Escape, such as the Android back gesture.
    element.addEventListener(
      'cancel',
      (event) => {
        event.preventDefault()
        if (entry.layer.isTopmost() && entry.options.dismissOnEscape !== false) {
          entry.options.onDismiss({ reason: 'close-request', event })
        }
      },
      { signal: controller.signal },
    )
  }

  stack.entries.push(entry)
  return entry.layer
}

export interface DismissableLayerOptions extends LayerOptions {
  /** Whether the layer is open (defaults to `true`). Set it to the popup's open state. */
  open?: boolean
}

/**
 * Makes the host a dismissable layer while `open` isn't false, with
 * `openLayer`. It leaves the stack when the popup closes or unmounts.
 */
export const dismissableLayer: MixinFactory<HTMLElement, [options: DismissableLayerOptions]> = createMixin<
  HTMLElement,
  [options: DismissableLayerOptions]
>(
  (handle) => {
    let host: HTMLElement | null = null
    let options: DismissableLayerOptions
    let layer: Layer | null = null

    function sync() {
      let active = host !== null && options.open !== false
      if (active && !layer) layer = openLayer(host!, options)
      else if (!active && layer) {
        layer.release()
        layer = null
      } else layer?.update(options)
    }

    handle.addEventListener('insert', (event) => {
      host = event.node
      sync()
    })

    handle.addEventListener('remove', () => {
      host = null
      sync()
    })

    return (nextOptions) => {
      options = nextOptions
      if (host) handle.queueTask(sync)
      return handle.element
    }
  },
  { ssr: false },
)
