// RemixCN Trace: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css, ref } from 'remix/component'
import type { Handle, Props } from 'remix/component'

import { ChevronRightIcon } from '#remixcn/lib/icons.tsx'
import { disabledState, mergeStyles, shimmer, transition, visuallyHidden } from '#remixcn/lib/styles.ts'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '#remixcn/ui/collapsible.tsx'
import type { CollapsibleContentProps, CollapsibleProps, CollapsibleTriggerProps } from '#remixcn/ui/collapsible.tsx'

export const traceStatuses = ['running', 'error', 'pending'] as const

export type TraceStatus = (typeof traceStatuses)[number]

/**
 * The words assistive technology hears after the title of a line with a
 * status, so the status never rests on color or motion alone.
 */
export const traceStatusLabels: Record<TraceStatus, string> = {
  running: 'in progress',
  error: 'failed',
  pending: 'not started',
}

export interface TraceProps extends Props<'div'> {
  /**
   * Announces each status change of the lines inside through a polite live
   * region: the line's title and status, once the change renders. Off by
   * default, so a busy list stays quiet. A nested Trace follows its parent's
   * setting unless it sets its own.
   */
  announce?: boolean
}

export interface TraceLineProps extends Props<'span'> {
  /** The state of the work the line reports. Leave it out for work that is done. */
  status?: TraceStatus
  /**
   * The words assistive technology hears for the status, after the title.
   * Defaults to traceStatusLabels. Pass '' when the title already says it.
   */
  statusLabel?: string
}

export interface TraceCollapsibleProps extends CollapsibleProps {}

export interface TraceCollapsibleTriggerProps extends CollapsibleTriggerProps {}

export interface TraceCollapsibleContentProps extends CollapsibleContentProps {}

interface TraceContext {
  /** Queues words for the nearest announcing list, or is missing when no list announces. */
  announce?: (message: string) => void
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const line = '[data-slot="trace-line"]'
const hiddenRule = css(visuallyHidden)

const traceRule = css({
  display: 'flex',
  flexDirection: 'column',
  gap: space(2),
  width: '100%',
  minWidth: 0,
  // A link or a trigger, such as a dialog's, that wraps a line becomes a row
  // of text that fits its line. :where() keeps these rules weaker than the
  // element's own, so a caller's look wins.
  [`& > :where(:has(> ${line}))`]: {
    display: 'flex',
    width: 'fit-content',
    maxWidth: '100%',
    minWidth: 0,
    borderRadius: 'var(--radius-md)',
    color: 'inherit',
    textAlign: 'start',
    textDecoration: 'none',
  },
  [`& > :where(button:has(> ${line}))`]: {
    margin: 0,
    padding: 0,
    border: 0,
    backgroundColor: 'transparent',
    font: 'inherit',
    cursor: 'pointer',
  },
})

/** The text a screen reader reads for an element: its text without the parts hidden from assistive technology. */
function spokenText(element: Element) {
  let copy = element.cloneNode(true) as Element
  for (let hidden of copy.querySelectorAll('[aria-hidden="true"]')) hidden.remove()
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * A list of lines, such as the steps an agent takes. It adds no role: each
 * line reads as text, or as the link or trigger that wraps it. Lines that
 * change together are announced in one message when `announce` is set.
 */
export function Trace(handle: Handle<TraceProps, TraceContext>) {
  let region: HTMLElement | undefined
  let queued: string[] = []

  function flush() {
    let message = queued.join('. ')
    queued = []
    if (!region || !message) return
    // The same words again must still change the text, or nothing is read.
    region.textContent = region.textContent === message ? `${message}\u00a0` : message
  }

  function announce(message: string) {
    if (!message) return
    if (queued.length === 0) queueMicrotask(flush)
    queued.push(message)
  }

  return () => {
    let { announce: announcing, children, mix, ...props } = handle.props
    // Inside its own render, context.get(Trace) is the nearest outer list.
    let outer = handle.context.get(Trace) as TraceContext | undefined
    let own = announcing === true

    handle.context.set({ announce: announcing === undefined ? outer?.announce : own ? announce : undefined })

    return (
      <div data-slot="trace" {...props} mix={[traceRule, mix]}>
        {children}
        {own ? (
          <span
            data-slot="trace-announcer"
            role="status"
            mix={[
              hiddenRule,
              ref<HTMLSpanElement>((node, signal) => {
                region = node
                signal.addEventListener('abort', () => {
                  if (region === node) region = undefined
                })
              }),
            ]}
          />
        ) : null}
      </div>
    )
  }
}

const lineRule = css(
  mergeStyles(
    {
      display: 'flex',
      // A description and a trailing icon move under a long title instead of squeezing it.
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      columnGap: space(2),
      width: 'fit-content',
      maxWidth: '100%',
      minWidth: 0,
      color: 'var(--muted-foreground)',
      fontSize: 'var(--text-sm)',
      lineHeight: 'var(--text-sm--line-height)',
      ':where(a[href], button:enabled) &': { cursor: 'pointer' },
      ':where(a[href]:hover, button:enabled:hover) &': { color: 'var(--foreground)' },
      // Stronger than the hover rule, so a failed line stays red.
      '&[data-status="error"]': { color: 'var(--destructive)' },
    },
    transition('color'),
  ),
)

/**
 * One line: an icon, a title, and maybe a description and a trailing icon.
 * It's a span, so it's neither a button nor a tab stop: wrap it in a
 * trigger or a link to make it do something. A status adds its words in
 * hidden text after the title.
 */
export function TraceLine(handle: Handle<TraceLineProps>) {
  let node: HTMLElement | undefined
  // The status of the last render, so a change is announced once, and the first render never is.
  let shown = handle.props.status

  return () => {
    let { status, statusLabel, children, mix, ...props } = handle.props
    let label = status ? (statusLabel ?? traceStatusLabels[status]) : ''

    if (status !== shown) {
      shown = status
      let trace = handle.context.get(Trace) as TraceContext | undefined
      let announce = trace?.announce
      if (announce) handle.queueTask(() => node && announce(spokenText(node)))
    }

    return (
      <span
        data-slot="trace-line"
        {...props}
        data-status={status}
        mix={[
          lineRule,
          ref<HTMLSpanElement>((element, signal) => {
            node = element
            signal.addEventListener('abort', () => {
              if (node === element) node = undefined
            })
          }),
          mix,
        ]}
      >
        {children}
        {label ? (
          <span data-slot="trace-status" mix={hiddenRule}>
            {` (${label})`}
          </span>
        ) : null}
      </span>
    )
  }
}

const iconRule = css({
  display: 'inline-flex',
  flexShrink: 0,
  alignItems: 'center',
  justifyContent: 'center',
  width: '1rem',
  // One line high, so the icon sits on the first line of a title that wraps.
  height: '1lh',
  '& :where(svg)': { width: '1rem', height: '1rem', pointerEvents: 'none' },
  // An indicator after the title sits closer to it.
  [`[data-slot="trace-title"] ~ &`]: { marginInlineStart: space(-1) },
  // A step that hasn't started dims its icons. Its text keeps its contrast.
  [`:where(${line}[data-status="pending"]) &`]: { opacity: 0.6 },
})

/** A decorative icon, hidden from assistive technology. Before the title it names the action; after it, it's the indicator. */
export function TraceIcon(handle: Handle<Props<'span'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <span data-slot="trace-icon" aria-hidden="true" {...props} mix={[iconRule, mix]} />
  }
}

// The icons are 1rem wide. The leading one sits a gap away, the trailing one
// a gap less a step.
const leadingIcon = `(1rem + ${space(2)})`
const trailingIcon = `(1rem + ${space(1)})`
const icon = '[data-slot="trace-icon"]'

const titleRule = css(
  mergeStyles(
    {
      minWidth: 0,
      maxWidth: '100%',
      overflowWrap: 'break-word',
      // A long title keeps the room the icons beside it leave, and wraps there.
      [`${icon} ~ &`]: { maxWidth: `calc(100% - ${leadingIcon})` },
      [`&:has(~ ${icon})`]: { maxWidth: `calc(100% - ${trailingIcon})` },
      [`${icon} ~ &:has(~ ${icon})`]: { maxWidth: `calc(100% - ${leadingIcon} - ${trailingIcon})` },
    },
    // Still for reduced motion, and plain text in forced colors.
    shimmer(`:where(${line}[data-status="running"]) &`),
  ),
)

/**
 * The step, as a sentence that says what happened, such as "Edited
 * trace.tsx". It names the line. It wraps instead of truncating, and
 * shimmers while the line runs.
 */
export function TraceTitle(handle: Handle<Props<'span'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <span data-slot="trace-title" {...props} mix={[titleRule, mix]} />
  }
}

const descriptionRule = css({
  minWidth: 0,
  color: 'var(--muted-foreground)',
  fontVariantNumeric: 'tabular-nums',
  overflowWrap: 'anywhere',
})

/** Secondary text after the title, such as a count, a duration or a diff stat. */
export function TraceDescription(handle: Handle<Props<'span'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <span data-slot="trace-description" {...props} mix={[descriptionRule, mix]} />
  }
}

const collapsibleRule = css({ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 })

/**
 * A row that expands: RemixCN's Collapsible, with its props and change
 * event. It runs in the browser inside your client entry. Before that, it
 * shows the state it starts in.
 */
export function TraceCollapsible(handle: Handle<TraceCollapsibleProps>) {
  return () => {
    let { mix, ...props } = handle.props

    return <Collapsible data-slot="trace-collapsible" {...props} mix={[collapsibleRule, mix]} />
  }
}

const triggerRule = css(
  mergeStyles(
    {
      display: 'flex',
      alignItems: 'flex-start',
      gap: space(1),
      width: 'fit-content',
      maxWidth: '100%',
      minWidth: 0,
      margin: 0,
      padding: 0,
      border: 0,
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'transparent',
      color: 'var(--muted-foreground)',
      fontSize: 'var(--text-sm)',
      lineHeight: 'var(--text-sm--line-height)',
      textAlign: 'start',
      cursor: 'pointer',
      '&:enabled:hover': { color: 'var(--foreground)' },
      [`&:has(> ${line}[data-status="error"])`]: { color: 'var(--destructive)' },
    },
    transition('color'),
    disabledState,
  ),
)

// The square icon turns, not its box, which is a line high: a turned box
// would stick out sideways and could make a narrow page scroll.
const chevronRule = css({
  '& > svg': {
    transitionProperty: 'transform',
    transitionDuration: 'var(--duration-normal)',
    transitionTimingFunction: 'var(--ease-out)',
  },
  ':where([aria-expanded="true"]) > & > svg': { transform: 'rotate(90deg)' },
  // It points onward, so it mirrors in right-to-left text, and still points down when open.
  '&:dir(rtl) > svg': { transform: 'scaleX(-1)' },
  ':where([aria-expanded="true"]) > &:dir(rtl) > svg': { transform: 'scaleX(-1) rotate(90deg)' },
})

/**
 * The native button that opens and closes the row. Put a TraceLine in it.
 * It adds a chevron after the line that turns down while the row is open.
 */
export function TraceCollapsibleTrigger(handle: Handle<TraceCollapsibleTriggerProps>) {
  return () => {
    let { children, mix, ...props } = handle.props

    return (
      <CollapsibleTrigger data-slot="trace-collapsible-trigger" {...props} mix={[triggerRule, mix]}>
        {children}
        <TraceIcon mix={chevronRule}>
          <ChevronRightIcon />
        </TraceIcon>
      </CollapsibleTrigger>
    )
  }
}

const contentRule = css({ minWidth: 0 })

const innerRule = css({
  minWidth: 0,
  marginBlockStart: space(2),
  marginBlockEnd: space(1),
  // The line runs under the middle of the trigger's first icon.
  marginInlineStart: `calc(${space(2)} - 1px)`,
  paddingInlineStart: space(4),
  paddingInlineEnd: space(1),
  borderInlineStart: '1px solid var(--border)',
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 1.625,
  overflowWrap: 'break-word',
})

/**
 * The detail of a row, with a line down its start edge. Your class and
 * mixins style the detail's inner wrapper; other props reach the panel, such
 * as keepMounted, which keeps nested rows' state while the row is closed.
 */
export function TraceCollapsibleContent(handle: Handle<TraceCollapsibleContentProps>) {
  return () => {
    let { children, class: className, mix, ...props } = handle.props

    return (
      <CollapsibleContent data-slot="trace-collapsible-content" {...props} mix={contentRule}>
        <div data-slot="trace-collapsible-content-inner" class={className} mix={[innerRule, mix]}>
          {children}
        </div>
      </CollapsibleContent>
    )
  }
}
