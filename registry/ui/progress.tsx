// RemixCN Progress: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { Fragment, css } from 'remix/component'
import type { Handle, Props, RemixNode } from 'remix/component'

import { mergeStyles, transition } from '#remixcn/lib/styles.ts'

export type ProgressStatus = 'indeterminate' | 'progressing' | 'complete'

export interface ProgressProps extends Props<'div'> {
  /** The current value. The bar is indeterminate when it is null, or not a finite number. */
  value: number | null
  /** The value at the empty end. 0 by default. */
  min?: number
  /** The value at the full end. 100 by default. */
  max?: number
  /** Formats the value with Intl.NumberFormat. Without it, the value shows as a percentage of the range. */
  format?: Intl.NumberFormatOptions
  /** The locale that formats the value. The runtime's locale by default. */
  locale?: Intl.LocalesArgument
  /** Returns the text assistive technology reads for the value, such as "Step 3 of 4". */
  getAriaValueText?: (formattedValue: string, value: number | null) => string
}

export interface ProgressValueProps extends Omit<Props<'span'>, 'children'> {
  /** Renders the value yourself. Gets the formatted value, "indeterminate" while there is none, and the raw value. */
  children?: (formattedValue: string, value: number | null) => RemixNode
}

interface ProgressState {
  status: ProgressStatus
  value: number | null
  percentage: number | null
  formatted: string
  /** The id a label without one of its own takes. */
  labelId: string
  /** Tells the bar, in the browser, about a label with an id of its own that it can't find among its children. */
  claimLabel(id: string): void
  releaseLabel(id: string): void
}

/** Puts the value-driven width before the caller's style, in either form, so the caller's own declarations still win. */
function withWidth(width: string, style: Props<'div'>['style']) {
  return typeof style === 'string' ? `width: ${width}; ${style}` : { width, ...style }
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

/** Works out the status, the clamped value, the fill and the text, as Base UI's Progress root does. */
function measure({ value, min = 0, max = 100, format, locale }: ProgressProps) {
  if (value === null || !Number.isFinite(value)) {
    return { status: 'indeterminate' as const, clamped: null, percentage: null, formatted: '' }
  }

  let raw = ((value - min) * 100) / (max - min)
  let percentage = clamp(Number.isNaN(raw) ? 0 : raw, 0, 100)
  let clamped = clamp(value, min, max)
  let formatted = format
    ? new Intl.NumberFormat(locale, format).format(clamped)
    : new Intl.NumberFormat(locale, { style: 'percent' }).format(percentage / 100)

  return { status: clamped === max ? ('complete' as const) : ('progressing' as const), clamped, percentage, formatted }
}

/** The data attribute Base UI sets on every part: data-indeterminate, data-progressing or data-complete. */
function statusAttributes(status: ProgressStatus | undefined) {
  return {
    'data-indeterminate': status === 'indeterminate' ? '' : undefined,
    'data-progressing': status === 'progressing' ? '' : undefined,
    'data-complete': status === 'complete' ? '' : undefined,
  }
}

function isNode(node: unknown): node is { type: unknown; props: { id?: string; children?: RemixNode } } {
  return typeof node === 'object' && node !== null && 'type' in node && 'props' in node
}

/**
 * Finds a ProgressLabel among the children, also inside elements and
 * fragments, and returns its props. A label that another component renders
 * isn't among them: it takes the bar's label id, or claims its own id in
 * the browser.
 */
function findLabel(children: RemixNode): { id?: string } | undefined {
  if (Array.isArray(children)) {
    for (let child of children) {
      let found = findLabel(child)
      if (found) return found
    }
    return
  }
  if (!isNode(children)) return
  if (children.type === ProgressLabel) return children.props
  if (typeof children.type === 'string' || children.type === Fragment) return findLabel(children.props.children)
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`

const rootRule = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space(3), minWidth: 0 })

/**
 * Shows how far a task has come, as a bar. It renders role="progressbar"
 * with the range, the current value and a text alternative, as Base UI's
 * Progress does, and fills its track to match. Put a ProgressLabel inside to
 * name it, and a ProgressValue to show the number.
 */
export function Progress(handle: Handle<ProgressProps, ProgressState>) {
  let claimed: string | undefined
  let claimLabel = (id: string) => {
    if (id === claimed) return
    claimed = id
    void handle.update()
  }
  let releaseLabel = (id: string) => {
    if (id !== claimed) return
    claimed = undefined
    void handle.update()
  }

  return () => {
    let {
      value,
      min = 0,
      max = 100,
      format: _format,
      locale: _locale,
      getAriaValueText,
      children,
      mix,
      ...props
    } = handle.props
    let { status, clamped, percentage, formatted } = measure(handle.props)
    let labelId = `${handle.id}-label`
    let found = findLabel(children)
    // A name you give the bar wins. Otherwise its label names it: one among
    // its children, one that claimed its own id, or one that another
    // component renders with the bar's label id.
    let named = props['aria-label'] !== undefined || props['aria-labelledby'] !== undefined
    handle.context.set({ status, value, percentage, formatted, labelId, claimLabel, releaseLabel })

    return (
      <div
        role="progressbar"
        aria-labelledby={named ? undefined : (found?.id ?? claimed ?? labelId)}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={clamped ?? undefined}
        aria-valuetext={
          getAriaValueText
            ? getAriaValueText(formatted, value)
            : status === 'indeterminate'
              ? 'indeterminate progress'
              : formatted
        }
        data-slot="progress"
        {...statusAttributes(status)}
        {...props}
        mix={[rootRule, mix]}
      >
        {children}
        <ProgressTrack>
          <ProgressIndicator />
        </ProgressTrack>
      </div>
    )
  }
}

const trackRule = css({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  height: space(1.5),
  overflowX: 'hidden',
  borderRadius: '9999px',
  backgroundColor: 'var(--muted)',
  // Forced colors drop the fill, so a border draws the track.
  '@media (forced-colors: active)': { border: '1px solid CanvasText' },
})

/** The track the indicator fills. Progress renders it after its children. */
export function ProgressTrack(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props
    let state = handle.context.get(Progress)

    return <div data-slot="progress-track" {...statusAttributes(state?.status)} {...props} mix={[trackRule, mix]} />
  }
}

const indicatorRule = css(
  mergeStyles(
    {
      position: 'relative',
      height: '100%',
      backgroundColor: 'var(--primary)',
      // A system color, which forced colors keep, so the fill stays visible.
      '@media (forced-colors: active)': { backgroundColor: 'Highlight' },
      // Without a value, a short bar slides along the track from the inline start.
      '&[data-indeterminate]': {
        width: '40%',
        animation: 'remixcn-progress-indeterminate 1.5s var(--ease-in-out) infinite',
      },
      '@keyframes remixcn-progress-indeterminate': {
        from: { insetInlineStart: '-40%' },
        to: { insetInlineStart: '100%' },
      },
      // Reduced motion keeps it still: a full, faint bar, while aria-valuetext still says it's indeterminate.
      '@media (prefers-reduced-motion: reduce)': {
        '&[data-indeterminate]': { width: '100%', animation: 'none', opacity: 0.4 },
      },
    },
    transition('width'),
  ),
)

/** The filled part of the track, as wide as the value's share of the range. */
export function ProgressIndicator(handle: Handle<Props<'div'>>) {
  return () => {
    let { style, mix, ...props } = handle.props
    let state = handle.context.get(Progress)
    let percentage = state?.percentage ?? null
    let width = percentage === null ? undefined : `${percentage}%`

    return (
      <div
        data-slot="progress-indicator"
        {...statusAttributes(state?.status)}
        {...props}
        style={width ? withWidth(width, style) : style}
        mix={[indicatorRule, mix]}
      />
    )
  }
}

const labelRule = css({ fontSize: 'var(--text-sm)', lineHeight: 'var(--text-sm--line-height)', fontWeight: 500 })

/**
 * Names the progress bar, which points aria-labelledby at it. It may sit
 * anywhere inside the bar, also in a component of your own.
 */
export function ProgressLabel(handle: Handle<Props<'span'>>) {
  let state: ProgressState | undefined
  let claimed: string | undefined
  handle.signal.addEventListener('abort', () => {
    if (claimed) state?.releaseLabel(claimed)
  })

  return () => {
    let { id, mix, ...props } = handle.props
    state = handle.context.get(Progress)
    if (id !== claimed) {
      // An id of its own reaches the bar after this commit, in the browser.
      let previous = claimed
      claimed = id
      handle.queueTask(() => {
        if (previous) state?.releaseLabel(previous)
        if (id) state?.claimLabel(id)
      })
    }

    return (
      <span
        id={id ?? state?.labelId}
        role="presentation"
        data-slot="progress-label"
        {...statusAttributes(state?.status)}
        {...props}
        mix={[labelRule, mix]}
      />
    )
  }
}

const valueRule = css({
  marginInlineStart: 'auto',
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  fontVariantNumeric: 'tabular-nums',
})

/**
 * Shows the formatted value. Assistive technology skips it and reads the
 * progress bar's aria-valuetext instead, which says the same.
 */
export function ProgressValue(handle: Handle<ProgressValueProps>) {
  return () => {
    let { children, mix, ...props } = handle.props
    let state = handle.context.get(Progress)
    let indeterminate = !state || state.status === 'indeterminate'
    let content = children
      ? children(indeterminate ? 'indeterminate' : state.formatted, state?.value ?? null)
      : indeterminate
        ? null
        : state.formatted

    return (
      <span
        aria-hidden="true"
        data-slot="progress-value"
        {...statusAttributes(state?.status)}
        {...props}
        mix={[valueRule, mix]}
      >
        {content}
      </span>
    )
  }
}
