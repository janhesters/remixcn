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

/** Mirrors a directional icon, such as a chevron that points onward, in right-to-left text. */
export const mirrorInRtl: Styles = {
  '&:dir(rtl)': { transform: 'scaleX(-1)' },
}
