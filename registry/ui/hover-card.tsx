// RemixCN Hover Card: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { attrs, createMixin, css, ref } from 'remix/component'
import type { Handle, MixinDescriptor, Props, RemixNode } from 'remix/component'

import { anchorPosition } from '#remixcn/lib/anchor-position.ts'
import type { Align, AnchorTarget, Side } from '#remixcn/lib/anchor-position.ts'
import { hoverIntent } from '#remixcn/lib/hover-intent.ts'
import { dismissableLayer } from '#remixcn/lib/layer.ts'
import { mergeStyles, transition } from '#remixcn/lib/styles.ts'

// A hover card previews what's behind a link for sighted pointer and
// keyboard users: it opens while the pointer rests on the link or the link
// has keyboard focus, and stays open while the pointer or focus is on the
// card, so its links work. The link works as always, also on the first tap:
// touch never opens the card. The card is a native manual popover in the top
// layer, and it stays in the document while hidden, after the link, so Tab
// reaches its links next.
//
// The parts run in the browser inside your client entry, like Button, so they
// take your mixins. On the server and until they run, the card renders closed.

export type HoverCardOpenChangeReason =
  | 'trigger-hover'
  | 'trigger-focus'
  | 'focus-out'
  | 'escape-key'
  | 'outside-press'
  | 'parent-dismissed'
  | 'trigger-removed'

export const hoverCardOpenChangeType = 'remixcn:hover-card-open-change' as const

/**
 * Dispatched on the card before it opens or closes. It doesn't bubble, so a
 * listener on the card hears only its own. `open` is the next state and
 * `reason` says what asked for it. Cancel it with `preventDefault()` to keep
 * the current state. It takes the place of Base UI's `onOpenChange`.
 */
export class HoverCardOpenChangeEvent extends Event {
  readonly open: boolean
  readonly reason: HoverCardOpenChangeReason
  /** The event that asked for the change, if any. */
  readonly cause: Event | undefined

  constructor(open: boolean, reason: HoverCardOpenChangeReason, cause?: Event) {
    super(hoverCardOpenChangeType, { cancelable: true })
    this.open = open
    this.reason = reason
    this.cause = cause
  }
}

declare global {
  interface HTMLElementEventMap {
    [hoverCardOpenChangeType]: HoverCardOpenChangeEvent
  }
}

interface HoverCardApi {
  open: boolean
  running: boolean
  trigger: HTMLElement | null
  content: HTMLElement | null
  /** Asks to open or close the card, and returns whether it changes. */
  setOpen(open: boolean, reason: HoverCardOpenChangeReason, cause?: Event): boolean
  attachTrigger(element: HTMLElement, signal: AbortSignal): void
  attachContent(element: HTMLElement, signal: AbortSignal): void
}

function useHoverCard(handle: { context: { get(type: unknown): unknown } }, part: string) {
  let api = handle.context.get(HoverCard) as HoverCardApi | undefined
  if (!api) throw new Error(`${part} must be inside a HoverCard`)
  return api
}

export interface HoverCardProps {
  /** Whether the card is open, for a card you control. Update it from `HoverCardOpenChangeEvent`. */
  open?: boolean
  /** Whether the card starts open. */
  defaultOpen?: boolean
  children?: RemixNode
}

/** Groups a hover card's trigger and content and holds whether it's open. It renders no element. */
export function HoverCard(handle: Handle<HoverCardProps, HoverCardApi>) {
  let uncontrolledOpen = handle.props.defaultOpen ?? false

  let api: HoverCardApi = {
    open: false,
    running: false,
    trigger: null,
    content: null,
    setOpen(open, reason, cause) {
      if (handle.signal.aborted || (open && !api.running)) return false
      if (open === (handle.props.open ?? uncontrolledOpen)) return false
      let event = new HoverCardOpenChangeEvent(open, reason, cause)
      api.content?.dispatchEvent(event)
      if (event.defaultPrevented) return false
      if (handle.props.open === undefined) uncontrolledOpen = open
      void handle.update()
      return true
    },
    attachTrigger(element, signal) {
      api.trigger = element
      signal.addEventListener('abort', () => {
        if (api.trigger !== element) return
        api.trigger = null
        // A keyed trigger that is replaced comes back before this runs; one that is gone closes the card.
        queueMicrotask(() => {
          if (!api.trigger && api.open) api.setOpen(false, 'trigger-removed')
        })
      })
    },
    attachContent(element, signal) {
      api.content = element
      signal.addEventListener('abort', () => {
        if (api.content === element) api.content = null
      })
    },
  }
  handle.context.set(api)

  return () => {
    // Tasks run only in the browser, after the first commit. Until then the card renders closed.
    if (!api.running) {
      handle.queueTask(() => {
        api.running = true
        // Only one that starts open renders again.
        if (handle.props.open ?? uncontrolledOpen) void handle.update()
      })
    }
    api.open = api.running && (handle.props.open ?? uncontrolledOpen)
    return handle.props.children
  }
}

export interface HoverCardTriggerOptions {
  /** Milliseconds the pointer rests on the trigger before the card opens (defaults to `600`). Keyboard focus opens it at once. */
  delay?: number
  /** Milliseconds before it closes once the pointer has left the trigger and the card (defaults to `300`). */
  closeDelay?: number
}

const triggerMixin = createMixin<HTMLElement, [options: HoverCardTriggerOptions]>((handle) => (options) => {
  let api = useHoverCard(handle, 'hoverCardTrigger()')
  let { delay = 600, closeDelay = 300 } = options

  return (
    <handle.element
      data-popup-open={api.open ? '' : undefined}
      mix={[
        attrs({ 'data-slot': 'hover-card-trigger' }),
        ref((node, signal) => api.attachTrigger(node, signal)),
        hoverIntent({
          open: api.open,
          delay,
          closeDelay,
          popup: () => api.content,
          onOpenChange: (open, reason, event) =>
            api.setOpen(open, reason === 'trigger-press' ? 'trigger-hover' : reason, event),
        }),
      ]}
    />
  )
})

/**
 * Makes any element the card's trigger, such as a Button:
 * `<button mix={[buttonVariants(), hoverCardTrigger()]}>`. Use a focusable element.
 */
export function hoverCardTrigger(
  options: HoverCardTriggerOptions = {},
): MixinDescriptor<HTMLElement, [options: HoverCardTriggerOptions]> {
  return triggerMixin(options)
}

export type HoverCardTriggerProps = Props<'a'> & HoverCardTriggerOptions

/** A native link that opens the card on hover and keyboard focus, and navigates as any link does. */
export function HoverCardTrigger(handle: Handle<HoverCardTriggerProps>) {
  return () => {
    let { delay, closeDelay, mix, ...props } = handle.props

    return <a data-slot="hover-card-trigger" {...props} mix={[mix, hoverCardTrigger({ delay, closeDelay })]} />
  }
}

export interface CollisionAvoidance {
  /** `'flip'` moves to the opposite side when the preferred one overflows (the default); `'none'` keeps it. */
  side?: 'flip' | 'none'
  /** `'shift'` slides along the edge to stay in view (the default); `'none'` keeps the alignment. */
  align?: 'shift' | 'none'
}

export interface HoverCardContentProps extends Props<'div'> {
  /** The side of the trigger to show on (defaults to `'bottom'`). `'inline-start'` and `'inline-end'` follow the text direction. */
  side?: Side
  /** The gap to the trigger, in pixels (defaults to `4`). */
  sideOffset?: number
  /** How to align along that side (defaults to `'center'`). */
  align?: Align
  /** Shift away from the aligned edge, in pixels (defaults to `4`, as in shadcn). */
  alignOffset?: number
  /** Space to keep from the edges of the viewport and `collisionBoundary`, in pixels (defaults to `5`). */
  collisionPadding?: number
  /** An element whose box also limits where the card goes. */
  collisionBoundary?: Element | null
  /** How to stay in view: flip to the other side, shift along the edge, or neither. */
  collisionAvoidance?: CollisionAvoidance
  /** What to place against instead of the trigger: an element, a point, or a function that returns one when it opens. */
  anchor?: AnchorTarget | (() => AnchorTarget)
}

// Shows the host in the top layer while open. The browser hides a closed popover.
const topLayer = createMixin<HTMLElement, [open: boolean]>(
  (handle) => (open) => {
    handle.queueTask((node) => {
      if (!node.isConnected || node.matches(':popover-open') === open) return
      if (open) node.showPopover()
      else node.hidePopover()
    })
    return handle.element
  },
  { ssr: false },
)

const space = (steps: number) => `calc(var(--spacing) * ${steps})`

const contentStyles = css(
  mergeStyles(
    {
      boxSizing: 'border-box',
      width: '16rem',
      // Never wider or taller than the room beside the trigger; a long card scrolls.
      maxWidth: 'var(--available-width, 100%)',
      maxHeight: 'var(--available-height, 100%)',
      overflow: 'auto',
      padding: space(4),
      // A border, not shadcn's ring, so forced colors keep the edge. Not every engine recolors it, so it's set there.
      border: '1px solid color-mix(in oklab, var(--foreground) 10%, transparent)',
      '@media (forced-colors: active)': { borderColor: 'CanvasText' },
      borderRadius: 'var(--radius-lg)',
      backgroundColor: 'var(--popover)',
      color: 'var(--popover-foreground)',
      boxShadow: 'var(--shadow-md)',
      fontSize: 'var(--text-sm)',
      lineHeight: 'var(--text-sm--line-height)',
      overflowWrap: 'break-word',
      // Fades in. A transform would move the box the positioning measures.
      '@starting-style': { opacity: 0 },
    },
    transition('opacity'),
  ),
)

/**
 * The card. It may hold links and buttons: the pointer and keyboard focus can
 * move onto it. It stays in the document while closed, hidden.
 */
export function HoverCardContent(handle: Handle<HoverCardContentProps>) {
  return () => {
    let api = useHoverCard(handle, 'HoverCardContent')
    let {
      side = 'bottom',
      sideOffset = 4,
      align = 'center',
      alignOffset = 4,
      collisionPadding = 5,
      collisionBoundary = null,
      collisionAvoidance = {},
      anchor,
      mix,
      ...props
    } = handle.props
    let { open } = api

    return (
      <div
        data-slot="hover-card-content"
        {...props}
        popover="manual"
        data-open={open ? '' : undefined}
        data-closed={open ? undefined : ''}
        mix={[
          contentStyles,
          mix,
          ref((node, signal) => api.attachContent(node, signal)),
          topLayer(open),
          anchorPosition({
            open,
            anchor: anchor ?? (() => api.trigger),
            side,
            sideOffset,
            align,
            alignOffset,
            collisionPadding,
            boundary: collisionBoundary,
            flip: collisionAvoidance.side !== 'none',
            shift: collisionAvoidance.align !== 'none',
          }),
          dismissableLayer({
            open,
            trigger: () => api.trigger,
            onDismiss: ({ reason, event }) => {
              let change = reason === 'close-request' ? 'escape-key' : reason
              let card = api.content
              let hadFocus = card !== null && card.contains(card.ownerDocument.activeElement)
              // Escape from a link in the card puts focus back on the trigger, before the card hides it.
              // Other dismissals leave focus where the press or Tab put it.
              if (api.setOpen(false, change, event) && change === 'escape-key' && hadFocus) api.trigger?.focus()
            },
          }),
        ]}
      />
    )
  }
}
