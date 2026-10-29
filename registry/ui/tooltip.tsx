// RemixCN Tooltip: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { attrs, createMixin, css, Fragment, ref } from 'remix/component'
import type { Handle, MixinDescriptor, Props, RemixElement, RemixNode } from 'remix/component'

import { anchorPosition } from '#remixcn/lib/anchor-position.ts'
import type { Align, AnchorTarget, Side } from '#remixcn/lib/anchor-position.ts'
import { hoverIntent } from '#remixcn/lib/hover-intent.ts'
import { dismissableLayer } from '#remixcn/lib/layer.ts'
import { mergeStyles, transition } from '#remixcn/lib/styles.ts'

// A tooltip describes its trigger: the trigger's aria-describedby points at
// the content, which stays in the document while hidden, so the description
// works before any script runs and while the tooltip is closed. Hover and
// keyboard focus open it, Escape and a press elsewhere close it, and touch
// never opens it. The content is a native manual popover, so it shows in the
// top layer, above everything and outside any box that clips its overflow.
//
// The parts run in the browser inside your client entry, like Button, so they
// take your mixins. On the server and until they run, the tooltip renders
// closed.

export type TooltipOpenChangeReason =
  | 'trigger-hover'
  | 'trigger-focus'
  | 'trigger-press'
  | 'focus-out'
  | 'escape-key'
  | 'outside-press'
  | 'parent-dismissed'
  | 'trigger-removed'
  | 'none'

export const tooltipOpenChangeType = 'remixcn:tooltip-open-change' as const

/**
 * Dispatched on the tooltip's content before it opens or closes. It doesn't
 * bubble, so a listener on the content hears only its own tooltip. `open` is
 * the next state and `reason` says what asked for it. Cancel it with
 * `preventDefault()` to keep the current state. It takes the place of Base
 * UI's `onOpenChange`.
 */
export class TooltipOpenChangeEvent extends Event {
  readonly open: boolean
  readonly reason: TooltipOpenChangeReason
  /** The event that asked for the change, if any. */
  readonly cause: Event | undefined

  constructor(open: boolean, reason: TooltipOpenChangeReason, cause?: Event) {
    super(tooltipOpenChangeType, { cancelable: true })
    this.open = open
    this.reason = reason
    this.cause = cause
  }
}

declare global {
  interface HTMLElementEventMap {
    [tooltipOpenChangeType]: TooltipOpenChangeEvent
  }
}

interface TooltipGroup {
  delay: number
  closeDelay: number
  timeout: number
  /** The tooltip of the group that is open now. */
  current: TooltipApi | null
  /** When the last one closed, from performance.now(). */
  closedAt: number
}

interface TooltipApi {
  open: boolean
  running: boolean
  disabled: boolean
  hoverable: boolean
  contentId: string
  group: TooltipGroup
  trigger: HTMLElement | null
  content: HTMLElement | null
  setOpen(open: boolean, reason: TooltipOpenChangeReason, cause?: Event): void
  attachTrigger(element: HTMLElement, signal: AbortSignal): void
  attachContent(element: HTMLElement, signal: AbortSignal): void
  /** Takes the id the content renders, for content the root's render can't see. */
  adoptContentId(id: string): void
}

function createGroup(): TooltipGroup {
  return { delay: 0, closeDelay: 0, timeout: 400, current: null, closedAt: -Infinity }
}

// Tooltips outside a provider share one group with the provider's defaults.
const defaultGroup = createGroup()

/** Whether a tooltip of the group is open, or just closed, so the next one may open at once. */
function isWarm(group: TooltipGroup, api: TooltipApi) {
  return (group.current !== null && group.current !== api) || performance.now() - group.closedAt < group.timeout
}

function isElement(node: unknown): node is RemixElement {
  return typeof node === 'object' && node !== null && '$rmx' in node
}

/** The props of the first `type` element among `node`, through host elements and fragments but not other components. */
function findProps<P>(node: unknown, type: unknown): P | undefined {
  if (Array.isArray(node)) {
    for (let child of node) {
      let found = findProps<P>(child, type)
      if (found) return found
    }
    return undefined
  }
  if (!isElement(node)) return undefined
  if (node.type === type) return node.props as P
  if (typeof node.type === 'string' || node.type === Fragment) return findProps<P>(node.props.children, type)
  return undefined
}

function useTooltip(handle: { context: { get(type: unknown): unknown } }, part: string) {
  let api = handle.context.get(Tooltip) as TooltipApi | undefined
  if (!api) throw new Error(`${part} must be inside a Tooltip`)
  return api
}

export interface TooltipProviderProps {
  /** Milliseconds before a tooltip opens on hover (defaults to `0`, as shadcn's provider sets it). */
  delay?: number
  /** Milliseconds before a tooltip closes once the pointer has left (defaults to `0`). */
  closeDelay?: number
  /** The next tooltip opens at once if the last one closed less than this many milliseconds ago (defaults to `400`). */
  timeout?: number
  children?: RemixNode
}

/**
 * Shares the delays of the tooltips inside it, and opens the next one at once
 * while one is open or just closed. Tooltips outside a provider share one
 * group with the same defaults. Put it inside your client entry: context
 * doesn't cross from the server page into a client entry.
 */
export function TooltipProvider(handle: Handle<TooltipProviderProps, TooltipGroup>) {
  let group = createGroup()
  handle.context.set(group)

  return () => {
    let { delay = 0, closeDelay = 0, timeout = 400, children } = handle.props
    Object.assign(group, { delay, closeDelay, timeout })
    return children
  }
}

export interface TooltipProps {
  /** Whether the tooltip is open, for a tooltip you control. Update it from `TooltipOpenChangeEvent`. */
  open?: boolean
  /** Whether the tooltip starts open. */
  defaultOpen?: boolean
  /** Whether hover and focus leave it closed. A disabled tooltip closes. */
  disabled?: boolean
  /** Whether it closes as the pointer leaves the trigger, instead of staying open while the pointer is on it. */
  disableHoverablePopup?: boolean
  children?: RemixNode
}

/** Groups a tooltip's trigger and content and holds whether it's open. It renders no element. */
export function Tooltip(handle: Handle<TooltipProps, TooltipApi>) {
  let uncontrolledOpen = handle.props.defaultOpen ?? false
  let renderedOpen = false
  let foundId: string | undefined

  let api: TooltipApi = {
    open: false,
    running: false,
    disabled: false,
    hoverable: true,
    contentId: `${handle.id}-content`,
    group: defaultGroup,
    trigger: null,
    content: null,
    setOpen(open, reason, cause) {
      if (handle.signal.aborted || (open && (!api.running || api.disabled))) return
      if (open === (handle.props.open ?? uncontrolledOpen)) return
      let event = new TooltipOpenChangeEvent(open, reason, cause)
      api.content?.dispatchEvent(event)
      if (event.defaultPrevented) return
      if (handle.props.open === undefined) uncontrolledOpen = open
      void handle.update()
    },
    attachTrigger(element, signal) {
      api.trigger = element
      signal.addEventListener('abort', () => {
        if (api.trigger !== element) return
        api.trigger = null
        // A keyed trigger that is replaced comes back before this runs; one that is gone closes the tooltip.
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
    adoptContentId(id) {
      if (foundId === id || handle.signal.aborted) return
      foundId = id
      void handle.update()
    },
  }
  handle.context.set(api)

  handle.signal.addEventListener('abort', () => {
    if (api.group.current === api) api.group.current = null
  })

  function syncGroup(open: boolean) {
    let { group } = api
    if (open) {
      if (group.current && group.current !== api) group.current.setOpen(false, 'none')
      group.current = api
    } else if (group.current === api) {
      group.current = null
      group.closedAt = performance.now()
    }
  }

  return () => {
    let { open, disabled = false, disableHoverablePopup = false, children } = handle.props
    // Tasks run only in the browser, after the first commit. Until then the tooltip renders closed.
    if (!api.running) {
      handle.queueTask(() => {
        api.running = true
        // Only one that starts open renders again.
        if (handle.props.open ?? uncontrolledOpen) void handle.update()
      })
    }

    api.group = (handle.context.get(TooltipProvider) as TooltipGroup | undefined) ?? defaultGroup
    api.disabled = disabled
    api.hoverable = !disableHoverablePopup
    api.contentId = findProps<{ id?: string }>(children, TooltipContent)?.id ?? foundId ?? `${handle.id}-content`
    api.open = api.running && !disabled && (open ?? uncontrolledOpen)
    if (api.open !== renderedOpen) {
      renderedOpen = api.open
      let opened = api.open
      handle.queueTask(() => syncGroup(opened))
    }

    return children
  }
}

export interface TooltipTriggerOptions {
  /** Milliseconds before the tooltip opens on hover (defaults to the provider's `delay`). Keyboard focus opens it at once. */
  delay?: number
  /** Milliseconds before it closes once the pointer has left (defaults to the provider's `closeDelay`). */
  closeDelay?: number
  /** Whether a click on the trigger closes the tooltip until the pointer or focus comes back (defaults to `true`). */
  closeOnClick?: boolean
}

const triggerMixin = createMixin<HTMLElement, [options: TooltipTriggerOptions]>((handle) => (options, props) => {
  let api = useTooltip(handle, 'tooltipTrigger()')
  let { delay, closeDelay, closeOnClick = true } = options
  let describedBy = [props['aria-describedby'], api.contentId].filter(Boolean).join(' ')

  return (
    <handle.element
      aria-describedby={describedBy}
      data-popup-open={api.open ? '' : undefined}
      data-trigger-disabled={api.disabled ? '' : undefined}
      mix={[
        attrs({ 'data-slot': 'tooltip-trigger' }),
        ref((node, signal) => api.attachTrigger(node, signal)),
        hoverIntent({
          open: api.open,
          disabled: api.disabled,
          closeOnClick,
          delay: () => (isWarm(api.group, api) ? 0 : (delay ?? api.group.delay)),
          closeDelay: closeDelay ?? api.group.closeDelay,
          popup: () => (api.hoverable ? api.content : null),
          onOpenChange: (open, reason, event) => api.setOpen(open, reason, event),
        }),
      ]}
    />
  )
})

/**
 * Makes any element the tooltip's trigger, such as a link or a Button that
 * stays focusable while disabled: `<a href="/terms" mix={tooltipTrigger()}>`.
 * It points the element's aria-describedby at the content, keeping yours, and
 * opens the tooltip on hover and keyboard focus. Use a focusable element.
 */
export function tooltipTrigger(
  options: TooltipTriggerOptions = {},
): MixinDescriptor<HTMLElement, [options: TooltipTriggerOptions]> {
  return triggerMixin(options)
}

export interface TooltipTriggerProps extends Props<'button'>, TooltipTriggerOptions {}

/** A native button that opens the tooltip on hover and keyboard focus. Give it `buttonVariants()` to look like a Button. */
export function TooltipTrigger(handle: Handle<TooltipTriggerProps>) {
  return () => {
    let { delay, closeDelay, closeOnClick, type = 'button', mix, ...props } = handle.props

    return (
      <button
        data-slot="tooltip-trigger"
        {...props}
        type={type}
        mix={[mix, tooltipTrigger({ delay, closeDelay, closeOnClick })]}
      />
    )
  }
}

export interface CollisionAvoidance {
  /** `'flip'` moves to the opposite side when the preferred one overflows (the default); `'none'` keeps it. */
  side?: 'flip' | 'none'
  /** `'shift'` slides along the edge to stay in view (the default); `'none'` keeps the alignment. */
  align?: 'shift' | 'none'
}

export interface TooltipContentProps extends Props<'div'> {
  /** The side of the trigger to show on (defaults to `'top'`). `'inline-start'` and `'inline-end'` follow the text direction. */
  side?: Side
  /** The gap to the trigger, in pixels (defaults to `4`). */
  sideOffset?: number
  /** How to align along that side (defaults to `'center'`). */
  align?: Align
  /** Shift away from the aligned edge, in pixels (defaults to `0`). */
  alignOffset?: number
  /** Space to keep from the edges of the viewport and `collisionBoundary`, in pixels (defaults to `5`). */
  collisionPadding?: number
  /** An element whose box also limits where the tooltip goes. */
  collisionBoundary?: Element | null
  /** How to stay in view: flip to the other side, shift along the edge, or neither. */
  collisionAvoidance?: CollisionAvoidance
  /** What to point at instead of the trigger: an element, a point, or a function that returns one when it opens. */
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
      width: 'fit-content',
      maxWidth: 'min(20rem, var(--available-width, 100%))',
      // A popover scrolls its overflow by default, which would clip the arrow.
      overflow: 'visible',
      paddingBlock: space(1.5),
      paddingInline: space(3),
      // A keyboard key at the end sits closer to the edge.
      '&:has([data-slot="kbd"])': { paddingInlineEnd: space(1.5) },
      border: 0,
      // An edge only in forced colors, where the background is gone. An outline,
      // so the arrow measures from the same edge as the anchor position.
      outline: '1px solid transparent',
      '@media (forced-colors: active)': { outlineColor: 'CanvasText' },
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'var(--foreground)',
      color: 'var(--background)',
      fontSize: 'var(--text-xs)',
      lineHeight: 'var(--text-xs--line-height)',
      overflowWrap: 'break-word',
      // Only while open: the browser hides a closed popover with display: none, which any display here would beat.
      '&:popover-open': { display: 'inline-flex', alignItems: 'center', gap: space(1.5) },
      // Fades in. A transform would move the box the positioning measures.
      '@starting-style': { opacity: 0 },
    },
    transition('opacity'),
  ),
)

// Keeps the arrow's center 10px from the corners, and on the anchor's center.
const arrowAt = (axis: 'x' | 'y') => `clamp(0.625rem, var(--anchor-center-${axis}, 50%), calc(100% - 0.625rem))`

const arrowStyles = css({
  position: 'absolute',
  width: '0.625rem',
  height: '0.625rem',
  borderRadius: '2px',
  backgroundColor: 'inherit',
  transform: 'translate(-50%, -50%) rotate(45deg)',
  pointerEvents: 'none',
  ':where([data-side="top"]) > &': { top: 'calc(100% - 2px)', left: arrowAt('x') },
  ':where([data-side="bottom"]) > &': { top: '2px', left: arrowAt('x') },
  ':where([data-side="left"]) > &': { top: arrowAt('y'), left: 'calc(100% - 2px)' },
  ':where([data-side="right"]) > &': { top: arrowAt('y'), left: '2px' },
  ':where(:not([data-side])) > &': { display: 'none' },
  // Forced colors drop its background, and a border would cross the tooltip's own.
  '@media (forced-colors: active)': { display: 'none' },
})

/**
 * The tooltip, with its arrow. Keep it to text: a tooltip only describes its
 * trigger, and nothing in it can take focus. Use a Popover for links or
 * buttons. It stays in the document while closed, hidden, so its text
 * describes the trigger at all times.
 */
export function TooltipContent(handle: Handle<TooltipContentProps>) {
  return () => {
    let api = useTooltip(handle, 'TooltipContent')
    let {
      side = 'top',
      sideOffset = 4,
      align = 'center',
      alignOffset = 0,
      collisionPadding = 5,
      collisionBoundary = null,
      collisionAvoidance = {},
      anchor,
      id,
      children,
      mix,
      ...props
    } = handle.props
    let { open } = api
    let contentId = id ?? api.contentId
    // The root can't see content inside another component, so it learns the id from each render.
    if (contentId !== api.contentId) handle.queueTask(() => api.adoptContentId(contentId))

    return (
      <div
        role="tooltip"
        data-slot="tooltip-content"
        {...props}
        id={contentId}
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
            onDismiss: ({ reason, event }) =>
              api.setOpen(false, reason === 'close-request' ? 'escape-key' : reason, event),
          }),
        ]}
      >
        {children}
        <span data-slot="tooltip-arrow" aria-hidden="true" mix={arrowStyles} />
      </div>
    )
  }
}
