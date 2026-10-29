// RemixCN Separator: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css } from 'remix/component'
import type { Handle, Props } from 'remix/component'

export type SeparatorOrientation = 'horizontal' | 'vertical'

export interface SeparatorProps extends Props<'div'> {
  /** A line across, the default, or a line down that divides parts of a row. */
  orientation?: SeparatorOrientation
  /**
   * Hides a separator that only draws a line, such as one between items that
   * already read as separate. A meaningful separator divides sections, and
   * assistive technology announces it.
   */
  decorative?: boolean
}

// A border, not a background, draws the line, so it stays visible in forced colors.
const separatorRule = css({
  flexShrink: 0,
  margin: 0,
  border: 0,
  '&[data-orientation="horizontal"]': { width: '100%', height: 0, borderBlockStart: '1px solid var(--border)' },
  '&[data-orientation="vertical"]': { width: 0, alignSelf: 'stretch', borderInlineStart: '1px solid var(--border)' },
})

/**
 * Divides content with a line. It renders role="separator" with its
 * orientation, as Base UI does, or role="none" when it is decorative.
 */
export function Separator(handle: Handle<SeparatorProps>) {
  return () => {
    let { orientation = 'horizontal', decorative = false, mix, ...props } = handle.props

    return (
      <div
        role={decorative ? 'none' : 'separator'}
        aria-orientation={decorative ? undefined : orientation}
        data-slot="separator"
        data-orientation={orientation}
        {...props}
        mix={[separatorRule, mix]}
      />
    )
  }
}
