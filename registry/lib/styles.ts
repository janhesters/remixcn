// RemixCN Style conventions: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import type { css } from 'remix/component'

// Remix gives every css() rule its own layer inside rmx, ordered by where the
// rule first renders, not by selector specificity. So compose a component's
// states into one css() call with mergeStyles: inside one rule, the more
// specific state selectors win as usual.

/** The style object css() takes. */
export type Styles = Parameters<typeof css>[0]

function isStyles(value: unknown): value is Styles {
  return typeof value === 'object' && value !== null
}

/** Merges style objects into a new one. Nested selectors merge too, and later declarations win. */
export function mergeStyles(...parts: Styles[]): Styles {
  let merged: Styles = {}

  for (let part of parts) {
    for (let [key, value] of Object.entries(part)) {
      let current = merged[key]
      merged[key] = isStyles(current) && isStyles(value) ? mergeStyles(current, value) : value
    }
  }

  return merged
}

/**
 * Draws the focus ring, an outline that stays visible in forced colors, when
 * `selector` matches: keyboard focus by default, or for example
 * `&:has(input:focus-visible)` for a group around a field.
 */
export function focusRing(selector = '&:focus-visible'): Styles {
  let styles: Styles = {}
  styles[selector] = { outline: '2px solid var(--ring)', outlineOffset: '2px' }
  return styles
}

/** Marks a control whose aria-invalid is "true". Pair it with an error message in text. */
export const invalidState: Styles = {
  '&[aria-invalid="true"]': { borderColor: 'var(--destructive)' },
  '&[aria-invalid="true"]:focus-visible': { outlineColor: 'var(--destructive)' },
}

/** Dims a disabled control. The disabled attribute or aria-disabled tells assistive technology. */
export const disabledState: Styles = {
  '&:disabled, &[aria-disabled="true"]': { cursor: 'not-allowed', opacity: 0.5 },
}

/** Hides text visually but keeps it for screen readers. */
export const visuallyHidden: Styles = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  margin: '-1px',
  padding: 0,
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  border: 0,
}

/** Animates the named properties with the motion tokens, which drop to 0s for reduced motion. */
export function transition(...properties: string[]): Styles {
  return {
    transitionProperty: properties.join(', '),
    transitionDuration: 'var(--duration-fast)',
    transitionTimingFunction: 'var(--ease-out)',
  }
}

/**
 * Sweeps a highlight across text that is still in progress, such as a file
 * name while it uploads or a status while a reply streams. The text keeps
 * 4.5:1 through the sweep on the page and on cards, and stays still for
 * reduced motion and plain in forced colors. Pass a selector, such as
 * ':where([data-state="uploading"]) &', to shimmer only while it matches.
 * --shimmer-color, --shimmer-duration and --shimmer-spread change the
 * highlight, the time of one sweep and its width.
 */
export function shimmer(selector = '&'): Styles {
  let spread = 'var(--shimmer-spread, calc(3ch + 40px))'
  // shadcn fades the text to a faint highlight, which drops it far below
  // 4.5:1. The highlight here sits halfway between --foreground and
  // --muted-foreground, which both reach 4.5:1 on the page and on cards, so
  // the whole sweep does too: it lightens dark text and darkens muted text.
  // Set --shimmer-color for text on another surface, such as a filled bubble.
  let highlight = 'var(--shimmer-color, color-mix(in oklab, var(--foreground), var(--muted-foreground)))'
  let edge = 'color-mix(in oklab, var(--remixcn-shimmer-highlight), currentColor 50%)'
  let sweep: Styles = {
    '--remixcn-shimmer-highlight': highlight,
    backgroundImage: `linear-gradient(110deg, currentColor calc(50% - ${spread}), ${edge} calc(50% - ${spread} * 0.5), var(--remixcn-shimmer-highlight) 50%, ${edge} calc(50% + ${spread} * 0.5), currentColor calc(50% + ${spread}))`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `calc(200% + ${spread} * 2) 100%`,
    backgroundPosition: '0 0',
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    animation: 'remixcn-shimmer var(--shimmer-duration, 2s) linear infinite',
  }
  let plain: Styles = { animation: 'none', backgroundImage: 'none', WebkitTextFillColor: 'currentColor' }

  return mergeStyles(
    selector === '&' ? sweep : nested(selector, sweep),
    nested(`${selector}:dir(rtl)`, { animationDirection: 'reverse' }),
    {
      '@media (prefers-reduced-motion: reduce)': nested(selector, plain),
      // Forced colors keep the text color but may drop the gradient, which would leave the text clear.
      '@media (forced-colors: active)': nested(selector, plain),
      '@keyframes remixcn-shimmer': { from: { backgroundPosition: '100% 0' }, to: { backgroundPosition: '0 0' } },
    },
  )
}

function nested(selector: string, styles: Styles): Styles {
  let wrapped: Styles = {}
  wrapped[selector] = styles
  return wrapped
}

/** Mirrors a directional icon, such as a chevron that points onward, in right-to-left text. */
export const mirrorInRtl: Styles = {
  '&:dir(rtl)': { transform: 'scaleX(-1)' },
}

const inGroup = ':where([data-slot="button-group"])'
const inRow = ':where([data-slot="button-group"][data-orientation="horizontal"])'
const inColumn = ':where([data-slot="button-group"][data-orientation="vertical"])'

/**
 * Joins a control to its neighbors when it sits directly in a ButtonGroup:
 * it drops the corners and the leading border it shares with another part,
 * an input grows into the room a wider group gives it and shrinks on a narrow
 * screen, and a focused part draws its ring above its neighbors. Only parts
 * with a data-slot attribute count as neighbors. Merge it into the control's
 * own css(), as Button does, so the group never styles its children from
 * outside. Logical corners follow right-to-left text.
 */
export const buttonGroupItem: Styles = {
  [`${inGroup} > &:focus-visible`]: { position: 'relative', zIndex: 1 },
  [`${inGroup} > &:where(input)`]: { flex: '1 1 auto', minWidth: 0 },
  [`${inRow} > &:has(~ [data-slot])`]: { borderStartEndRadius: 0, borderEndEndRadius: 0 },
  [`${inRow} > [data-slot] ~ &`]: { borderStartStartRadius: 0, borderEndStartRadius: 0, borderInlineStartWidth: 0 },
  [`${inColumn} > &:has(~ [data-slot])`]: { borderEndStartRadius: 0, borderEndEndRadius: 0 },
  [`${inColumn} > [data-slot] ~ &`]: { borderStartStartRadius: 0, borderStartEndRadius: 0, borderBlockStartWidth: 0 },
}
