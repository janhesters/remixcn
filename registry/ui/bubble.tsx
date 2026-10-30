// RemixCN Bubble: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { attrs, css } from 'remix/component'
import type { Handle, MixValue, Props } from 'remix/component'

import { mergeStyles, transition } from '#remixcn/lib/styles.ts'
import type { Styles } from '#remixcn/lib/styles.ts'

export const bubbleVariantNames = [
  'default',
  'secondary',
  'muted',
  'tinted',
  'outline',
  'ghost',
  'destructive',
] as const

export type BubbleVariant = (typeof bubbleVariantNames)[number]
export type BubbleAlign = 'start' | 'end'
export type BubbleReactionsSide = 'top' | 'bottom'

export interface BubbleProps extends Props<'div'> {
  /** The look: a strong primary bubble by default, usually for the current user. */
  variant?: BubbleVariant
  /** Puts the bubble at the start or the end of its column. */
  align?: BubbleAlign
}

export interface BubbleReactionsProps extends Props<'div'> {
  /** The edge of the bubble the row overlaps. */
  side?: BubbleReactionsSide
  /** The end of that edge the row sits at. */
  align?: BubbleAlign
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
// Parts react to their bubble's attributes from their own rule, so no rule
// depends on the order in which Remix first renders them.
const inVariant = (variant: BubbleVariant) => `:where([data-slot="bubble"][data-variant="${variant}"]) > &`
const interactive = '&:where(a, button)'
const hover = `${interactive}:hover`
const endOfMessage = ':where([data-slot="message"][data-align="end"]) &'

const groupRule = css({ display: 'flex', flexDirection: 'column', gap: space(2), minWidth: 0 })

/** Stacks consecutive bubbles from one sender. Set align on each Bubble. */
export function BubbleGroup(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <div data-slot="bubble-group" {...props} mix={[groupRule, mix]} />
  }
}

const bubbleRule = css({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  gap: space(1),
  width: 'fit-content',
  minWidth: 0,
  maxWidth: '80%',
  '&[data-variant="ghost"]': { maxWidth: '100%' },
  '&[data-align="end"]': { alignSelf: 'flex-end' },
  [endOfMessage]: { alignSelf: 'flex-end' },
})

/**
 * A message surface that sizes to its text, up to 80% of its column; a
 * ghost bubble may take the whole row. It's presentational: put its sender
 * and time in text nearby, such as in a MessageHeader.
 */
export function Bubble(handle: Handle<BubbleProps>) {
  return () => {
    let { variant = 'default', align = 'start', mix, ...props } = handle.props

    return <div data-slot="bubble" data-variant={variant} data-align={align} {...props} mix={[bubbleRule, mix]} />
  }
}

// Colors that differ by scheme use light-dark(), so a data-theme ancestor picks them too.
const contentVariants: Record<BubbleVariant, Styles> = {
  default: {
    backgroundColor: 'var(--primary)',
    color: 'var(--primary-foreground)',
    [hover]: { backgroundColor: 'color-mix(in oklab, var(--primary) 80%, transparent)' },
  },
  secondary: {
    backgroundColor: 'var(--secondary)',
    color: 'var(--secondary-foreground)',
    [hover]: { backgroundColor: 'color-mix(in oklch, var(--secondary), var(--foreground) 5%)' },
  },
  muted: {
    backgroundColor: 'var(--muted)',
    color: 'var(--foreground)',
    [hover]: { backgroundColor: 'color-mix(in oklch, var(--muted), var(--foreground) 5%)' },
  },
  tinted: {
    backgroundColor:
      'light-dark(oklch(from var(--primary) 0.93 calc(c * 0.4) h), oklch(from var(--primary) 0.3 calc(c * 0.4) h))',
    color: 'var(--foreground)',
    [hover]: {
      backgroundColor:
        'light-dark(oklch(from var(--primary) 0.88 calc(c * 0.5) h), oklch(from var(--primary) 0.35 calc(c * 0.5) h))',
    },
  },
  outline: {
    borderColor: 'var(--border)',
    backgroundColor: 'var(--background)',
    color: 'var(--foreground)',
    [hover]: { backgroundColor: 'light-dark(var(--muted), color-mix(in oklab, var(--input) 30%, transparent))' },
  },
  ghost: {
    // Unframed text, also in forced colors.
    borderWidth: 0,
    borderRadius: 0,
    padding: 0,
    backgroundColor: 'transparent',
    color: 'var(--foreground)',
    [hover]: { backgroundColor: 'light-dark(var(--muted), color-mix(in oklab, var(--muted) 50%, transparent))' },
  },
  destructive: {
    backgroundColor:
      'light-dark(color-mix(in oklab, var(--destructive) 10%, transparent), color-mix(in oklab, var(--destructive) 20%, transparent))',
    // shadcn's red text on its own red tint misses 4.5:1, so a quarter of the
    // foreground mixes in, as in Button.
    color: 'color-mix(in oklab, var(--destructive) 75%, var(--foreground))',
    [hover]: {
      backgroundColor:
        'light-dark(color-mix(in oklab, var(--destructive) 20%, transparent), color-mix(in oklab, var(--destructive) 30%, transparent))',
    },
  },
}

const contentRule = css(
  mergeStyles(
    {
      width: 'fit-content',
      maxWidth: '100%',
      minWidth: 0,
      margin: 0,
      overflow: 'hidden',
      paddingInline: space(3),
      paddingBlock: space(2),
      // A transparent border, which forced colors draw, so each bubble keeps its frame there.
      border: '1px solid transparent',
      borderRadius: 'var(--radius-xl)',
      font: 'inherit',
      fontSize: 'var(--text-sm)',
      lineHeight: 1.625,
      textAlign: 'start',
      textDecoration: 'none',
      overflowWrap: 'anywhere',
      [interactive]: { cursor: 'pointer' },
      ':where([data-slot="bubble"][data-align="end"]) > &': { alignSelf: 'flex-end' },
      ...Object.fromEntries(bubbleVariantNames.map((variant) => [inVariant(variant), contentVariants[variant]])),
    },
    transition('color', 'background-color', 'border-color'),
  ),
)

/**
 * Returns the mixins that make any element a bubble's content, with its look
 * and data-slot. Use it on a native link or button, so the whole bubble is
 * one control named by its text: <button type="button" mix={bubbleContentVariants()}>.
 */
export function bubbleContentVariants(): MixValue {
  return [contentRule, attrs({ 'data-slot': 'bubble-content' })]
}

/** The framed text of the bubble. Long words break, so it fits a narrow screen. */
export function BubbleContent(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <div data-slot="bubble-content" {...props} mix={[bubbleContentVariants(), mix]} />
  }
}

const reactionsRule = css({
  position: 'absolute',
  zIndex: 10,
  display: 'flex',
  flexShrink: 0,
  alignItems: 'center',
  justifyContent: 'center',
  gap: space(1),
  width: 'fit-content',
  paddingInline: space(1.5),
  paddingBlock: space(0.5),
  border: '1px solid transparent',
  borderRadius: '9999px',
  backgroundColor: 'var(--muted)',
  boxShadow: '0 0 0 3px var(--card)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  '&:has(button)': { padding: 0 },
  '&[data-side="top"]': { insetBlockStart: 0, translate: '0 -75%' },
  '&[data-side="bottom"]': { insetBlockEnd: 0, translate: '0 75%' },
  '&[data-align="start"]': { insetInlineStart: space(3) },
  '&[data-align="end"]': { insetInlineEnd: space(3) },
})

/**
 * A row of reactions or quick actions that overlaps an edge of the bubble.
 * Leave room above or below the bubble for it. Name a row of emoji once,
 * with role="img" and an aria-label; give icon buttons their own labels.
 */
export function BubbleReactions(handle: Handle<BubbleReactionsProps>) {
  return () => {
    let { side = 'bottom', align = 'end', mix, ...props } = handle.props

    return (
      <div data-slot="bubble-reactions" data-side={side} data-align={align} {...props} mix={[reactionsRule, mix]} />
    )
  }
}
