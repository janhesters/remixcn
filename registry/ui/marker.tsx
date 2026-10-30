// RemixCN Marker: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { attrs, css } from 'remix/component'
import type { Handle, MixValue, Props } from 'remix/component'

import { mergeStyles, transition } from '#remixcn/lib/styles.ts'
import type { Styles } from '#remixcn/lib/styles.ts'

export const markerVariantNames = ['default', 'separator', 'border'] as const

export type MarkerVariant = (typeof markerVariantNames)[number]

export interface MarkerVariantOptions {
  /** default is an inline row, border adds a line under it, and separator centers a label between two lines. */
  variant?: MarkerVariant
}

export interface MarkerProps extends Props<'div'>, MarkerVariantOptions {}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const separator = ':where([data-slot="marker"][data-variant="separator"])'
// The lines are borders, not fills, so forced colors keep them. Each keeps
// 1rem, so a long label wraps between visible lines.
const line: Styles = {
  content: '""',
  flex: '1 1 0%',
  minWidth: '1rem',
  height: 0,
  borderBlockStart: '1px solid var(--border)',
}

const base: Styles = mergeStyles(
  {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: space(2),
    width: '100%',
    minHeight: '1rem',
    // A link or button marker drops its native box, so it reads as a row of text.
    margin: 0,
    padding: 0,
    border: 0,
    backgroundColor: 'transparent',
    color: 'var(--muted-foreground)',
    font: 'inherit',
    fontSize: 'var(--text-sm)',
    lineHeight: 'var(--text-sm--line-height)',
    textAlign: 'start',
    '& svg': { flexShrink: 0, width: '1rem', height: '1rem' },
    '&:where(a)': { textDecoration: 'underline', textUnderlineOffset: '3px' },
    '&:where(button)': { cursor: 'pointer' },
    '&:where(a, button):hover': { color: 'var(--foreground)' },
  },
  transition('color'),
)

const variants: Record<MarkerVariant, Styles> = {
  default: {},
  separator: {
    '&::before': { ...line, marginInlineEnd: space(1) },
    '&::after': { ...line, marginInlineStart: space(1) },
  },
  border: { paddingBlockEnd: space(2), borderBlockEnd: '1px solid var(--border)' },
}

const rules: Record<MarkerVariant, ReturnType<typeof css>> = {
  default: css(mergeStyles(base, variants.default)),
  separator: css(mergeStyles(base, variants.separator)),
  border: css(mergeStyles(base, variants.border)),
}

/**
 * Returns the mixins that give any element a marker's look and its data-slot
 * and data-variant attributes. Use it on a native link or button, so it keeps
 * its role, focus and name from its text: <a href="/files" mix={markerVariants()}>.
 */
export function markerVariants({ variant = 'default' }: MarkerVariantOptions = {}): MixValue {
  return [rules[variant], attrs({ 'data-slot': 'marker', 'data-variant': variant })]
}

/**
 * A line of status, a note or a labelled divider in a conversation, such as
 * "Explored 4 files" or "Today". It has no role: pass role="status" for one
 * that changes while something runs, so screen readers announce it.
 */
export function Marker(handle: Handle<MarkerProps>) {
  return () => {
    let { variant = 'default', mix, ...props } = handle.props

    return <div data-slot="marker" data-variant={variant} {...props} mix={[markerVariants({ variant }), mix]} />
  }
}

const iconRule = css({
  display: 'inline-flex',
  flexShrink: 0,
  alignItems: 'center',
  justifyContent: 'center',
  width: '1rem',
  height: '1rem',
  '& svg': { width: '1rem', height: '1rem' },
})

/** A decorative icon, such as a check or a spinner. It's hidden from assistive technology, so the content names the marker. */
export function MarkerIcon(handle: Handle<Props<'span'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <span data-slot="marker-icon" aria-hidden="true" {...props} mix={[iconRule, mix]} />
  }
}

const contentRule = css({
  minWidth: 0,
  overflowWrap: 'anywhere',
  '& a': { color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '3px' },
  '& a:hover': { color: 'var(--foreground)' },
  // shadcn keeps a separator's label on one line. It may shrink and wrap
  // instead, so a long label fits a narrow screen.
  [`${separator} > &`]: { flex: '0 1 auto', textAlign: 'center' },
})

/** The marker's text. Long words break, so it fits a narrow screen. */
export function MarkerContent(handle: Handle<Props<'span'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <span data-slot="marker-content" {...props} mix={[contentRule, mix]} />
  }
}
