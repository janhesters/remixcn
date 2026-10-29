// RemixCN Popover: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn), Base UI (MIT, Copyright (c) 2019 Material-UI SAS) and Remix (MIT, Copyright (c) 2025 Shopify Inc.).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { attrs, createMixin, css, Fragment, on, ref } from 'remix/component'
import type { Handle, MixinFactory, Props, RemixElement, RemixNode } from 'remix/component'

import { anchorPosition } from '#remixcn/lib/anchor-position.ts'
import type { Align, AnchorTarget, Side } from '#remixcn/lib/anchor-position.ts'
import { focusScope } from '#remixcn/lib/focus-scope.ts'
import type { FocusScopeOptions } from '#remixcn/lib/focus-scope.ts'
import { dismissableLayer } from '#remixcn/lib/layer.ts'
import { modal as modalMixin } from '#remixcn/lib/modal.ts'
import { mergeStyles, transition } from '#remixcn/lib/styles.ts'

// A popover is a non-modal dialog next to its trigger. A click on the
// trigger opens it and moves focus inside; Escape, a press elsewhere, Tab
// out of it and its close button close it and return focus to the trigger.
// The content is a native popover in the top layer, above everything and
// outside any box that clips its overflow.
//
// Until the browser runs it, and on a page without JavaScript, the trigger
// opens the popover natively with popovertarget: the browser shows it in the
// middle of the screen, and Escape or a click elsewhere closes it. Once it
// runs, it places the popover next to the trigger and handles focus. The
// parts run in the browser inside your client entry, like Button, so they
// take your mixins.

export type PopoverOpenChangeReason =
  | 'trigger-press'
  | 'close-press'
  | 'escape-key'
  | 'outside-press'
  | 'focus-out'
  | 'parent-dismissed'
  | 'trigger-removed'

export const popoverOpenChangeType = 'remixcn:popover-open-change' as const

/**
 * Dispatched on the popover's content before it opens or closes. It doesn't
 * bubble, so a listener on the content hears only its own popover, not one
 * nested inside it. `open` is the next state and `reason` says what asked for
 * it. Cancel it with `preventDefault()` to keep the current state. It takes
 * the place of Base UI's `onOpenChange`.
 */
export class PopoverOpenChangeEvent extends Event {
  readonly open: boolean
  readonly reason: PopoverOpenChangeReason
  /** The event that asked for the change, if any. */
  readonly cause: Event | undefined

  constructor(open: boolean, reason: PopoverOpenChangeReason, cause?: Event) {
    super(popoverOpenChangeType, { cancelable: true })
    this.open = open
    this.reason = reason
    this.cause = cause
  }
}

declare global {
  interface HTMLElementEventMap {
    [popoverOpenChangeType]: PopoverOpenChangeEvent
  }
}

type Label = 'title' | 'description'

interface PopoverApi {
  open: boolean
  running: boolean
  modal: boolean
  contentId: string
  titleId: string
  descriptionId: string
  /** Label ids found in the browser, for parts the render couldn't see. */
  labels: Partial<Record<Label, string>>
  /** Whether the content's render found each label part. */
  rendered: Record<Label, boolean>
  trigger: HTMLElement | null
  content: HTMLElement | null
  setOpen(open: boolean, reason: PopoverOpenChangeReason, cause?: Event): void
  /** Closes a non-modal popover once focus leaves both the trigger and the content. */
  focusOut(event: FocusEvent): void
  attachTrigger(element: HTMLElement, signal: AbortSignal): void
  attachContent(element: HTMLElement, signal: AbortSignal): void
  /** Takes the id the content renders, for content the root's render can't see. */
  adoptContentId(id: string): void
  /** Takes the id a title or description renders, for one the content's render can't see. */
  adoptLabel(label: Label, id: string): void
  attachLabel(label: Label, element: HTMLElement, signal: AbortSignal): void
}

function isElement(node: unknown): node is RemixElement {
  return typeof node === 'object' && node !== null && '$rmx' in node
}

/**
 * The props of the first `type` element among `node`, through host elements,
 * fragments and the components in `through`, but not other components.
 */
function findProps<P>(node: unknown, type: unknown, through: unknown[] = []): P | undefined {
  if (Array.isArray(node)) {
    for (let child of node) {
      let found = findProps<P>(child, type, through)
      if (found) return found
    }
    return undefined
  }
  if (!isElement(node)) return undefined
  if (node.type === type) return node.props as P
  if (typeof node.type === 'string' || node.type === Fragment || through.includes(node.type)) {
    return findProps<P>(node.props.children, type, through)
  }
  return undefined
}

function usePopover(handle: { context: { get(type: unknown): unknown } }, part: string) {
  let api = handle.context.get(Popover) as PopoverApi | undefined
  if (!api) throw new Error(`${part} must be inside a Popover`)
  return api
}

export interface PopoverProps {
  /** Whether the popover is open, for a popover you control. Update it from `PopoverOpenChangeEvent`. */
  open?: boolean
  /** Whether the popover starts open. */
  defaultOpen?: boolean
  /**
   * Whether the rest of the page waits while it's open: it can't be scrolled
   * or used, and focus stays in the popover and its trigger. Defaults to `false`.
   */
  modal?: boolean
  children?: RemixNode
}

/** Groups a popover's trigger and content and holds whether it's open. It renders no element. */
export function Popover(handle: Handle<PopoverProps, PopoverApi>) {
  let uncontrolledOpen = handle.props.defaultOpen ?? false
  let foundContentId: string | undefined

  let api: PopoverApi = {
    open: false,
    running: false,
    modal: false,
    contentId: `${handle.id}-content`,
    titleId: `${handle.id}-title`,
    descriptionId: `${handle.id}-description`,
    labels: {},
    rendered: { title: false, description: false },
    trigger: null,
    content: null,
    setOpen(open, reason, cause) {
      if (handle.signal.aborted || !api.running) return
      if (open === (handle.props.open ?? uncontrolledOpen)) return
      let event = new PopoverOpenChangeEvent(open, reason, cause)
      api.content?.dispatchEvent(event)
      if (event.defaultPrevented) return
      if (handle.props.open === undefined) uncontrolledOpen = open
      void handle.update()
    },
    focusOut(event) {
      // Without a next element, the window lost focus or a press elsewhere moved it: the layer decides.
      let next = event.relatedTarget
      let document = next instanceof Node ? next.ownerDocument : null
      if (api.modal || !api.open || !document) return
      let inside = (node: Node | null) => Boolean(node && (api.content?.contains(node) || api.trigger?.contains(node)))
      if (inside(next as Node)) return
      // Once the browser has moved focus: closing while it moves leaves no focused element,
      // and the focus scope would put focus back on the trigger.
      document.defaultView?.setTimeout(() => {
        if (!inside(document.activeElement)) api.setOpen(false, 'focus-out', event)
      })
    },
    attachTrigger(element, signal) {
      api.trigger = element
      signal.addEventListener('abort', () => {
        if (api.trigger !== element) return
        api.trigger = null
        // A keyed trigger that is replaced comes back before this runs; one that is gone closes the popover.
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
      if (foundContentId === id || handle.signal.aborted) return
      foundContentId = id
      void handle.update()
    },
    adoptLabel(label, id) {
      if (api.labels[label] === id || handle.signal.aborted) return
      api.labels[label] = id
      if (!api.rendered[label]) void handle.update()
    },
    attachLabel(label, element, signal) {
      signal.addEventListener('abort', () => {
        if (api.labels[label] !== element.id) return
        delete api.labels[label]
        // After the commit that removed it, which may have removed the popover too.
        queueMicrotask(() => {
          if (!api.rendered[label] && !handle.signal.aborted) void handle.update()
        })
      })
    },
  }
  handle.context.set(api)

  return () => {
    let { open, modal = false, children } = handle.props
    // Tasks run only in the browser, after the first commit. Until then the popover renders closed.
    if (!api.running) {
      handle.queueTask(() => {
        // One the browser already opened natively stays open, now next to its trigger.
        if (handle.props.open === undefined && api.content?.matches(':popover-open')) uncontrolledOpen = true
        api.running = true
        void handle.update()
      })
    }

    api.modal = modal
    api.contentId = findProps<{ id?: string }>(children, PopoverContent)?.id ?? foundContentId ?? `${handle.id}-content`
    api.open = api.running && (open ?? uncontrolledOpen)
    return children
  }
}

const triggerMixin = createMixin<HTMLElement>((handle, type) => {
  // Only a button can open a popover natively.
  let native = type === 'button'

  return () => {
    let api = usePopover(handle, 'popoverTrigger()')

    return (
      <handle.element
        aria-haspopup="dialog"
        aria-controls={api.contentId}
        // Until it runs, the browser reports the state of a popovertarget button itself.
        aria-expanded={api.running ? String(api.open) : undefined}
        data-popup-open={api.open ? '' : undefined}
        popovertarget={native && !api.running ? api.contentId : undefined}
        mix={[
          attrs({ 'data-slot': 'popover-trigger' }),
          ref((node, signal) => api.attachTrigger(node, signal)),
          on('click', (event) => {
            if (!event.defaultPrevented) api.setOpen(!api.open, 'trigger-press', event)
          }),
          // Focus that leaves through the trigger leaves the popover too.
          on('focusout', (event) => api.focusOut(event)),
        ]}
      />
    )
  }
})

/**
 * Makes any element the popover's trigger, such as a styled button:
 * `<button type="button" mix={[buttonVariants({ variant: 'outline' }), popoverTrigger()]}>`.
 * On a native button, it opens the popover before the browser runs it too.
 */
export const popoverTrigger: MixinFactory<HTMLElement, []> = triggerMixin

/** A native button that opens and closes the popover. Give it `buttonVariants()` to look like a Button. */
export function PopoverTrigger(handle: Handle<Props<'button'>>) {
  return () => {
    let { type = 'button', mix, ...props } = handle.props

    return <button data-slot="popover-trigger" {...props} type={type} mix={[mix, popoverTrigger()]} />
  }
}

export interface CollisionAvoidance {
  /** `'flip'` moves to the opposite side when the preferred one overflows (the default); `'none'` keeps it. */
  side?: 'flip' | 'none'
  /** `'shift'` slides along the edge to stay in view (the default); `'none'` keeps the alignment. */
  align?: 'shift' | 'none'
}

export interface PopoverContentProps extends Props<'div'> {
  /** The side of the trigger to show on (defaults to `'bottom'`). `'inline-start'` and `'inline-end'` follow the text direction. */
  side?: Side
  /** The gap to the trigger, in pixels (defaults to `4`). */
  sideOffset?: number
  /** How to align along that side (defaults to `'center'`). */
  align?: Align
  /** Shift away from the aligned edge, in pixels (defaults to `0`). */
  alignOffset?: number
  /** Space to keep from the edges of the viewport and `collisionBoundary`, in pixels (defaults to `5`). */
  collisionPadding?: number
  /** An element whose box also limits where the popover goes. */
  collisionBoundary?: Element | null
  /** How to stay in view: flip to the other side, shift along the edge, or neither. */
  collisionAvoidance?: CollisionAvoidance
  /** What to place against instead of the trigger: an element, a point, or a function that returns one when it opens. */
  anchor?: AnchorTarget | (() => AnchorTarget)
  /**
   * What to focus when it opens, or `false` to leave focus on the trigger. By
   * default, the first `[autofocus]` or tabbable element inside, else the popover.
   */
  initialFocus?: FocusScopeOptions['initialFocus']
  /**
   * What to focus when it closes, or `false` to leave focus alone. By default,
   * the trigger, unless focus already moved elsewhere, or a neighbor once the
   * trigger is gone.
   */
  finalFocus?: FocusScopeOptions['returnFocus']
}

// Shows the host in the top layer while open, and leaves it alone while
// `open` is null. The browser hides a closed popover.
const topLayer = createMixin<HTMLElement, [open: boolean | null]>(
  (handle) => (open) => {
    handle.queueTask((node) => {
      if (open === null || !node.isConnected || node.matches(':popover-open') === open) return
      if (open) node.showPopover()
      else node.hidePopover()
    })
    return handle.element
  },
  { ssr: false },
)

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const textSm = { fontSize: 'var(--text-sm)', lineHeight: 'var(--text-sm--line-height)' }

const contentStyles = css(
  mergeStyles(
    {
      ...textSm,
      boxSizing: 'border-box',
      width: '18rem',
      // Never wider or taller than the room beside the trigger; a long popover scrolls.
      maxWidth: 'var(--available-width, 100%)',
      maxHeight: 'var(--available-height, 100%)',
      overflow: 'auto',
      padding: space(4),
      // A border, not shadcn's ring, so forced colors keep the edge. Not every engine recolors it, so it's set there.
      border: '1px solid color-mix(in oklab, var(--foreground) 10%, transparent)',
      '@media (forced-colors: active)': { borderColor: 'CanvasText' },
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'var(--popover)',
      color: 'var(--popover-foreground)',
      boxShadow: 'var(--shadow-md)',
      overflowWrap: 'break-word',
      // Only while open: the browser hides a closed popover with display: none, which any display here would beat.
      '&:popover-open': { display: 'flex', flexDirection: 'column', gap: space(4) },
      // Fades in. A transform would move the box the positioning measures.
      '@starting-style': { opacity: 0 },
    },
    transition('opacity'),
  ),
)

/**
 * The popover: a dialog its title and description name and describe. It stays
 * in the document while closed, hidden, so the trigger's aria-controls always
 * points at it and what you type in it stays.
 */
export function PopoverContent(handle: Handle<PopoverContentProps>) {
  return () => {
    let api = usePopover(handle, 'PopoverContent')
    let {
      side = 'bottom',
      sideOffset = 4,
      align = 'center',
      alignOffset = 0,
      collisionPadding = 5,
      collisionBoundary = null,
      collisionAvoidance = {},
      anchor,
      initialFocus,
      finalFocus,
      id,
      children,
      mix,
      ...props
    } = handle.props
    let { open, modal } = api
    let title = findProps<{ id?: string }>(children, PopoverTitle, [PopoverHeader])
    let description = findProps<{ id?: string }>(children, PopoverDescription, [PopoverHeader])
    api.rendered = { title: title !== undefined, description: description !== undefined }
    let contentId = id ?? api.contentId
    // The root can't see content inside another component, so it learns the id from each render.
    if (contentId !== api.contentId) handle.queueTask(() => api.adoptContentId(contentId))

    return (
      <div
        role="dialog"
        data-slot="popover-content"
        aria-labelledby={title ? (title.id ?? api.titleId) : api.labels.title}
        aria-describedby={description ? (description.id ?? api.descriptionId) : api.labels.description}
        {...props}
        id={contentId}
        popover={api.running ? 'manual' : 'auto'}
        data-open={open ? '' : undefined}
        data-closed={open ? undefined : ''}
        mix={[
          contentStyles,
          mix,
          ref((node, signal) => api.attachContent(node, signal)),
          // Until it runs, the browser may have opened it natively; the root keeps it open once it runs.
          topLayer(api.running ? open : null),
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
            modal,
            trigger: () => api.trigger,
            onDismiss: ({ reason, event }) =>
              api.setOpen(false, reason === 'close-request' ? 'escape-key' : reason, event),
          }),
          focusScope({ open, initialFocus, returnFocus: finalFocus ?? (() => api.trigger) }),
          modalMixin({ open: open && modal, keep: () => [api.trigger] }),
          // Tab out of a non-modal popover closes it. Focus inside a nested popover is still inside.
          on('focusout', (event) => api.focusOut(event)),
        ]}
      >
        {children}
      </div>
    )
  }
}

const headerStyles = css({ ...textSm, display: 'flex', flexDirection: 'column', gap: space(1) })
const titleStyles = css({ margin: 0, fontSize: 'inherit', lineHeight: 'inherit', fontWeight: 500 })
const descriptionStyles = css({ margin: 0, color: 'var(--muted-foreground)' })

// The content can't see a title or description inside another component, so
// the label tells it its id from each render.
function useLabelId(handle: Handle<Props<'h2'>> | Handle<Props<'p'>>, api: PopoverApi, label: Label, id: string) {
  if (api.labels[label] !== id) handle.queueTask(() => api.adoptLabel(label, id))
  return id
}

/** Stacks the title and description. */
export function PopoverHeader(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props
    return <div data-slot="popover-header" {...props} mix={[headerStyles, mix]} />
  }
}

/** The popover's heading, which names the dialog. */
export function PopoverTitle(handle: Handle<Props<'h2'>>) {
  return () => {
    let api = usePopover(handle, 'PopoverTitle')
    let { id, mix, ...props } = handle.props
    let labelId = useLabelId(handle, api, 'title', id ?? api.titleId)
    return (
      <h2
        data-slot="popover-title"
        {...props}
        id={labelId}
        mix={[titleStyles, mix, ref((node, signal) => api.attachLabel('title', node, signal))]}
      />
    )
  }
}

/** A sentence that describes the dialog. */
export function PopoverDescription(handle: Handle<Props<'p'>>) {
  return () => {
    let api = usePopover(handle, 'PopoverDescription')
    let { id, mix, ...props } = handle.props
    let labelId = useLabelId(handle, api, 'description', id ?? api.descriptionId)
    return (
      <p
        data-slot="popover-description"
        {...props}
        id={labelId}
        mix={[descriptionStyles, mix, ref((node, signal) => api.attachLabel('description', node, signal))]}
      />
    )
  }
}

/**
 * A native button that closes the popover and returns focus to the trigger.
 * Until the browser runs it, it closes the popover natively.
 */
export function PopoverClose(handle: Handle<Props<'button'>>) {
  return () => {
    let api = usePopover(handle, 'PopoverClose')
    let { type = 'button', mix, ...props } = handle.props
    let native = !api.running

    return (
      <button
        data-slot="popover-close"
        {...props}
        type={type}
        popovertarget={native ? api.contentId : undefined}
        popovertargetaction={native ? 'hide' : undefined}
        mix={[
          mix,
          on('click', (event) => {
            if (!event.defaultPrevented) api.setOpen(false, 'close-press', event)
          }),
        ]}
      />
    )
  }
}
