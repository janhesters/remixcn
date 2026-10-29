// RemixCN Kbd: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css } from 'remix/component'
import type { Handle, Props } from 'remix/component'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`

const kbdRule = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: space(1),
  width: 'fit-content',
  minWidth: space(5),
  minHeight: space(5),
  paddingInline: space(1),
  borderRadius: 'var(--radius-sm)',
  backgroundColor: 'var(--muted)',
  color: 'var(--muted-foreground)',
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--text-xs)',
  lineHeight: 'var(--text-xs--line-height)',
  fontWeight: 500,
  // A key is a label, not a target: presses go through to the button around it.
  pointerEvents: 'none',
  userSelect: 'none',
  '& svg': { width: '0.75rem', height: '0.75rem' },
  // Inside a tooltip, which uses the foreground color as its background.
  ':where([data-slot="tooltip-content"]) &': {
    backgroundColor:
      'light-dark(color-mix(in oklab, var(--background) 20%, transparent), color-mix(in oklab, var(--background) 10%, transparent))',
    color: 'var(--background)',
  },
  // Forced colors drop the background, so a border keeps the key's outline.
  '@media (forced-colors: active)': { border: '1px solid' },
})

/** Shows a key the user presses, as a native kbd element. */
export function Kbd(handle: Handle<Props<'kbd'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <kbd data-slot="kbd" {...props} mix={[kbdRule, mix]} />
  }
}

const kbdGroupRule = css({ display: 'inline-flex', alignItems: 'center', gap: space(1) })

/**
 * Groups the keys of a combination, such as Ctrl + B, in an outer kbd: HTML
 * marks up a key combination as kbd elements inside a kbd.
 */
export function KbdGroup(handle: Handle<Props<'kbd'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <kbd data-slot="kbd-group" {...props} mix={[kbdGroupRule, mix]} />
  }
}
