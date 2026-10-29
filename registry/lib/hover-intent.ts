// RemixCN Hover intent: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { createMixin } from 'remix/component'
import type { MixinFactory } from 'remix/component'

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

function within(point: Point, rect: Rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height
}

/**
 * Whether a pointer at `point` is on its way between an anchor and its popup:
 * over either box, or over the gap between the sides they face, across the
 * width of both. Moving through it from the trigger to the popup, or back,
 * keeps a hoverable popup open.
 */
export function isInSafeArea(point: Point, anchor: Rect, floating: Rect): boolean {
  if (within(point, anchor) || within(point, floating)) return true

  let anchorRight = anchor.x + anchor.width
  let anchorBottom = anchor.y + anchor.height
  let floatingRight = floating.x + floating.width
  let floatingBottom = floating.y + floating.height
  let across = (start: number, end: number, low: number, high: number) =>
    start <= end && point.x >= low && point.x <= high && point.y >= start && point.y <= end
  let along = (start: number, end: number, low: number, high: number) =>
    start <= end && point.y >= low && point.y <= high && point.x >= start && point.x <= end
  let left = Math.min(anchor.x, floating.x)
  let right = Math.max(anchorRight, floatingRight)
  let top = Math.min(anchor.y, floating.y)
  let bottom = Math.max(anchorBottom, floatingBottom)

  if (floating.y >= anchorBottom) return across(anchorBottom, floating.y, left, right)
  if (floatingBottom <= anchor.y) return across(floatingBottom, anchor.y, left, right)
  if (floating.x >= anchorRight) return along(anchorRight, floating.x, top, bottom)
  if (floatingRight <= anchor.x) return along(floatingRight, anchor.x, top, bottom)
  return false
}

// Opens a popup while the pointer rests on its trigger or the trigger has
// keyboard focus, after a delay, and closes it once neither does, after a
// close delay. A hoverable popup stays open while the pointer is on it, or on
// its way there across the gap. Touch pointers never open it, so the first
// tap on a link still follows it. It only asks: the popup's owner decides and
// passes the new `open` state back with `update()`.

export type HoverIntentReason = 'trigger-hover' | 'trigger-focus' | 'trigger-press' | 'focus-out'

export interface HoverIntentOptions {
  /** Whether the popup is open now. Pass the new state with `update()` after each change. */
  open: boolean
  /** Asks to open or close the popup. */
  onOpenChange: (open: boolean, reason: HoverIntentReason, event?: Event) => void
  /** The popup. While the pointer or keyboard focus is on it, it stays open. Without it, the popup can't be hovered. */
  popup?: () => HTMLElement | null
  /** Milliseconds the pointer rests on the trigger before it opens, or a function read when the pointer arrives (defaults to `0`). Keyboard focus opens at once. */
  delay?: number | (() => number)
  /** Milliseconds before it closes once the pointer has left (defaults to `0`). Losing keyboard focus closes at once. */
  closeDelay?: number
  /** Whether a click on the trigger closes the popup until the pointer or focus comes back (defaults to `false`). */
  closeOnClick?: boolean
  /** Whether to ignore hover and focus, and cancel a pending change (defaults to `false`). */
  disabled?: boolean
}

export interface HoverIntent {
  /** Replaces the options, such as the new `open` state. A pending change that no longer applies stops. */
  update(options: HoverIntentOptions): void
  /** Removes every listener and timer. Safe to call twice. */
  release(): void
}

function contains(parent: Element | null | undefined, target: EventTarget | null) {
  return Boolean(parent && target instanceof Node && parent.contains(target))
}

function isFocusVisible(target: EventTarget | null) {
  return target instanceof Element && target.matches(':focus-visible')
}

/** Tracks hover and keyboard focus on `trigger` and its popup until `release()`. */
export function createHoverIntent(trigger: HTMLElement, initial: HoverIntentOptions): HoverIntent {
  let options = initial
  let document = trigger.ownerDocument
  let view = document.defaultView!
  let controller = new AbortController()
  let popupController: AbortController | null = null
  let moveController: AbortController | null = null
  let boundPopup: HTMLElement | null = null
  // What the owner was last asked for, until it passes its decision back.
  let assumedOpen: boolean | null = null
  let overTrigger = false
  let overPopup = false
  let bridging = false
  let focused = false
  let timer = 0
  let pending: { open: boolean; reason: HoverIntentReason; delay: number; event?: Event } | null = null

  let isOpen = () => assumedOpen ?? options.open
  let getPopup = () => options.popup?.() ?? null
  let wanted = () => !options.disabled && (overTrigger || overPopup || bridging || focused)

  function cancel() {
    view.clearTimeout(timer)
    pending = null
  }

  function request(open: boolean, reason: HoverIntentReason, event?: Event) {
    pending = null
    if (controller.signal.aborted || open === isOpen()) return
    assumedOpen = open
    options.onOpenChange(open, reason, event)
  }

  function start(next: NonNullable<typeof pending>) {
    view.clearTimeout(timer)
    pending = next
    timer = view.setTimeout(() => {
      // Ask only if the pointer and focus still want it.
      if (wanted() === next.open) request(next.open, next.reason, next.event)
      else pending = null
    }, next.delay)
  }

  function evaluate(reason: HoverIntentReason, event?: Event) {
    if (controller.signal.aborted) return
    bindPopup()
    let want = wanted()
    if (want === isOpen()) return cancel()

    if (!want) {
      if (pending?.open === false) return
      // Always after a task, so the pointer entering the popup right after leaving the trigger counts.
      start({ open: false, reason, delay: reason === 'focus-out' ? 0 : (options.closeDelay ?? 0), event })
      return
    }
    // Keyboard focus opens at once, also while a hover delay runs.
    let delay = reason === 'trigger-focus' ? 0 : resolveDelay()
    if (delay <= 0) {
      cancel()
      request(true, reason, event)
    } else if (!pending?.open) start({ open: true, reason, delay, event })
  }

  function resolveDelay() {
    let { delay = 0 } = options
    return typeof delay === 'function' ? delay() : delay
  }

  function updateBridge(event: PointerEvent) {
    let popup = getPopup()
    bridging =
      isOpen() &&
      popup !== null &&
      isInSafeArea(
        { x: event.clientX, y: event.clientY },
        trigger.getBoundingClientRect(),
        popup.getBoundingClientRect(),
      )
    if (bridging && !moveController) {
      moveController = new AbortController()
      document.addEventListener(
        'pointermove',
        (move) => {
          if (move.pointerType === 'touch') return
          updateBridge(move)
          if (!bridging) evaluate('trigger-hover', move)
        },
        { capture: true, passive: true, signal: AbortSignal.any([moveController.signal, controller.signal]) },
      )
    } else if (!bridging) stopBridge()
  }

  function stopBridge() {
    bridging = false
    moveController?.abort()
    moveController = null
  }

  /** Hover and focus on the popup or the trigger: `part` names the flag they set. */
  function listen(element: HTMLElement, part: 'trigger' | 'popup', signal: AbortSignal) {
    let other = () => (part === 'trigger' ? getPopup() : trigger)
    let setOver = (value: boolean) => (part === 'trigger' ? (overTrigger = value) : (overPopup = value))

    element.addEventListener(
      'pointerenter',
      (event) => {
        if (event.pointerType === 'touch') return
        setOver(true)
        stopBridge()
        evaluate('trigger-hover', event)
      },
      { signal },
    )
    element.addEventListener(
      'pointerleave',
      (event) => {
        if (event.pointerType === 'touch') return
        setOver(false)
        updateBridge(event)
        evaluate('trigger-hover', event)
      },
      { signal },
    )
    element.addEventListener(
      'focusin',
      (event) => {
        focused = isFocusVisible(event.target)
        evaluate('trigger-focus', event)
      },
      { signal },
    )
    element.addEventListener(
      'focusout',
      (event) => {
        // Focus moving between the trigger and the popup keeps it; the focusin that follows decides.
        if (contains(element, event.relatedTarget) || contains(other(), event.relatedTarget)) return
        focused = false
        evaluate('focus-out', event)
      },
      { signal },
    )
  }

  function bindPopup() {
    let popup = getPopup()
    if (popup === boundPopup) return
    popupController?.abort()
    popupController = null
    overPopup = false
    boundPopup = popup
    if (!popup) return
    popupController = new AbortController()
    listen(popup, 'popup', AbortSignal.any([popupController.signal, controller.signal]))
  }

  listen(trigger, 'trigger', controller.signal)
  trigger.addEventListener(
    'click',
    (event) => {
      if (!options.closeOnClick) return
      // Closed until the pointer comes back or focus returns.
      overTrigger = false
      focused = false
      stopBridge()
      cancel()
      request(false, 'trigger-press', event)
    },
    { signal: controller.signal },
  )
  bindPopup()

  return {
    update(next) {
      options = next
      assumedOpen = null
      if (controller.signal.aborted) return
      bindPopup()
      if (!pending) return
      if (next.disabled || pending.open === next.open) return cancel()
      // A changed delay restarts the wait from now.
      let delay = pending.open ? resolveDelay() : (next.closeDelay ?? 0)
      if (pending.reason !== 'focus-out' && pending.delay !== delay) start({ ...pending, delay })
    },
    release() {
      if (controller.signal.aborted) return
      controller.abort()
      cancel()
      stopBridge()
      popupController?.abort()
    },
  }
}

/**
 * Tracks hover and keyboard focus on the host with `createHoverIntent` while
 * it's mounted. Removing the host cancels every timer, so a delayed open can't
 * reach a popup that is gone.
 */
export const hoverIntent: MixinFactory<HTMLElement, [options: HoverIntentOptions]> = createMixin<
  HTMLElement,
  [options: HoverIntentOptions]
>(
  (handle) => {
    let options: HoverIntentOptions
    let intent: HoverIntent | null = null

    handle.addEventListener('insert', (event) => {
      intent = createHoverIntent(event.node, options)
    })

    handle.addEventListener('remove', () => {
      intent?.release()
      intent = null
    })

    return (nextOptions) => {
      options = nextOptions
      if (intent) handle.queueTask(() => intent?.update(options))
      return handle.element
    }
  },
  { ssr: false },
)
