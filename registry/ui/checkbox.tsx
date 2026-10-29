// RemixCN Checkbox: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { createMixin, css } from 'remix/component'
import type { Handle, Props } from 'remix/component'

import { CheckIcon, MinusIcon } from '#remixcn/lib/icons.tsx'
import { disabledState, invalidState, mergeStyles, transition } from '#remixcn/lib/styles.ts'
import type { Styles } from '#remixcn/lib/styles.ts'

export interface CheckboxProps extends Omit<Props<'input'>, 'type' | 'role' | 'children' | 'indeterminate'> {
  /**
   * Shows the mixed state, such as a "select all" box over a partial
   * selection. It changes what the box shows and what assistive technology
   * announces, not what the form submits: that still follows `checked`.
   */
  indeterminate?: boolean
}

// The input draws the box, and the indicators sit on top of it in the same
// grid cell. The input stays a native checkbox, so labels, Space, forms, reset
// and validation work without JavaScript.
const rootStyles = css({
  display: 'inline-grid',
  placeItems: 'center',
  flexShrink: 0,
  verticalAlign: 'middle',
})

const boxStyles = css(
  mergeStyles(
    {
      gridArea: '1 / 1',
      appearance: 'none',
      width: '1rem',
      height: '1rem',
      margin: 0,
      border: '1px solid var(--input)',
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'light-dark(transparent, color-mix(in oklch, var(--input) 30%, transparent))',
      boxShadow: 'var(--shadow-xs)',
      '&:is(:checked, :indeterminate)': { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' },
    },
    invalidState,
    disabledState,
    transition('background-color', 'border-color'),
    // Forced colors draw the system's own checkbox, mixed state included.
    { '@media (forced-colors: active)': { appearance: 'auto' } },
  ),
)

// An indicator reacts to the state of the input before it, in its own rule.
function indicatorStyles(state: string) {
  let shown: Styles = {}
  shown[`:where(input${state}) ~ &`] = { display: 'grid' }

  return css(
    mergeStyles(
      {
        gridArea: '1 / 1',
        display: 'none',
        pointerEvents: 'none',
        color: 'var(--primary-foreground)',
        '& svg': { width: '0.875rem', height: '0.875rem' },
      },
      shown,
      {
        ':where(input:disabled) ~ &': { opacity: 0.5 },
        '@media (forced-colors: active)': { ':where(input) ~ &': { display: 'none' } },
      },
    ),
  )
}

const checkedIndicatorStyles = indicatorStyles(':checked:not(:indeterminate)')
const mixedIndicatorStyles = indicatorStyles(':indeterminate')

// HTML has an indeterminate property but no attribute, so the server renders
// the checked value and the browser adds the mixed state once it runs.
const mixedState = createMixin<HTMLInputElement, [indeterminate: boolean]>((handle) => (indeterminate) => {
  handle.queueTask((input) => {
    input.indeterminate = indeterminate
  })
  return handle.element
})

/** A native checkbox in shadcn's style, with an optional mixed state. */
export function Checkbox(handle: Handle<CheckboxProps>) {
  return () => {
    let { indeterminate, mix, ...props } = handle.props

    return (
      <span data-slot="checkbox-root" mix={rootStyles}>
        <input
          {...props}
          type="checkbox"
          data-slot="checkbox"
          mix={[boxStyles, indeterminate !== undefined && mixedState(indeterminate), mix]}
        />
        <span data-slot="checkbox-indicator" mix={checkedIndicatorStyles}>
          <CheckIcon />
        </span>
        <span data-slot="checkbox-mixed-indicator" mix={mixedIndicatorStyles}>
          <MinusIcon />
        </span>
      </span>
    )
  }
}
