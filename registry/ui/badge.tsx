// RemixCN Badge: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { attrs, css } from 'remix/component'
import type { Handle, MixValue, Props } from 'remix/component'

import { invalidState, mergeStyles, transition } from '#remixcn/lib/styles.ts'
import type { Styles } from '#remixcn/lib/styles.ts'

export const badgeVariantNames = ['default', 'secondary', 'destructive', 'outline', 'ghost', 'link'] as const

export type BadgeVariant = (typeof badgeVariantNames)[number]

export interface BadgeVariantOptions {
  /** The look: a filled primary badge by default. */
  variant?: BadgeVariant
}

export interface BadgeProps extends Props<'span'>, BadgeVariantOptions {}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
// Only a badge that is a link reacts to the pointer; a plain badge is a label.
const linkHover = '&:where(a):hover'

const base: Styles = mergeStyles(
  {
    display: 'inline-flex',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(1),
    width: 'fit-content',
    // shadcn keeps a badge on one line and clips the rest. A badge never grows
    // past its container instead, and wraps only then, so no text is lost on a
    // narrow screen or with large text.
    maxWidth: '100%',
    minHeight: space(5),
    paddingInline: space(2),
    paddingBlock: space(0.5),
    border: '1px solid transparent',
    borderRadius: '999px',
    fontSize: 'var(--text-xs)',
    lineHeight: 'var(--text-xs--line-height)',
    fontWeight: 500,
    textDecoration: 'none',
    overflowWrap: 'anywhere',
    '& > svg': { flexShrink: 0, pointerEvents: 'none', width: '0.75rem', height: '0.75rem' },
    '&:has(> [data-icon="inline-start"])': { paddingInlineStart: space(1.5) },
    '&:has(> [data-icon="inline-end"])': { paddingInlineEnd: space(1.5) },
    '&:focus-visible': { borderColor: 'var(--ring)' },
  },
  transition('color', 'background-color', 'border-color'),
)

// Colors that differ by scheme use light-dark(), so a data-theme ancestor picks them too.
const variants: Record<BadgeVariant, Styles> = {
  default: {
    backgroundColor: 'var(--primary)',
    color: 'var(--primary-foreground)',
    [linkHover]: { backgroundColor: 'color-mix(in oklab, var(--primary) 80%, transparent)' },
  },
  secondary: {
    backgroundColor: 'var(--secondary)',
    color: 'var(--secondary-foreground)',
    [linkHover]: { backgroundColor: 'color-mix(in oklch, var(--secondary), var(--foreground) 5%)' },
  },
  destructive: {
    backgroundColor:
      'light-dark(color-mix(in oklab, var(--destructive) 10%, transparent), color-mix(in oklab, var(--destructive) 20%, transparent))',
    // shadcn's red text on its own red tint misses 4.5:1, so a quarter of the
    // foreground mixes in, as in Button.
    color: 'color-mix(in oklab, var(--destructive) 75%, var(--foreground))',
    [linkHover]: {
      backgroundColor:
        'light-dark(color-mix(in oklab, var(--destructive) 20%, transparent), color-mix(in oklab, var(--destructive) 30%, transparent))',
    },
    '&:focus-visible': { outlineColor: 'var(--destructive)' },
  },
  outline: {
    borderColor: 'var(--border)',
    color: 'var(--foreground)',
    [linkHover]: { backgroundColor: 'var(--muted)' },
  },
  ghost: {
    color: 'var(--foreground)',
    [linkHover]: {
      backgroundColor: 'light-dark(var(--muted), color-mix(in oklab, var(--muted) 50%, transparent))',
    },
  },
  link: {
    color: 'var(--primary)',
    textUnderlineOffset: '4px',
    [linkHover]: { textDecoration: 'underline' },
  },
}

const rules = new Map<BadgeVariant, ReturnType<typeof css>>()

function badgeRule(variant: BadgeVariant) {
  let rule = rules.get(variant)
  if (!rule) {
    rule = css(mergeStyles(base, variants[variant], invalidState))
    rules.set(variant, rule)
  }
  return rule
}

/**
 * Returns the mixins that give any element a badge's look and its data-slot
 * and data-variant attributes. Use it on a native link, so it keeps its link
 * role and navigation: <a href="/invoices" mix={badgeVariants()}>.
 */
export function badgeVariants({ variant = 'default' }: BadgeVariantOptions = {}): MixValue {
  return [badgeRule(variant), attrs({ 'data-slot': 'badge', 'data-variant': variant })]
}

/** A small label for a status, a count or a category. */
export function Badge(handle: Handle<BadgeProps>) {
  return () => {
    let { variant = 'default', mix, ...props } = handle.props

    return <span data-slot="badge" data-variant={variant} {...props} mix={[badgeVariants({ variant }), mix]} />
  }
}
