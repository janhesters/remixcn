// RemixCN Textarea: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css } from 'remix/component'
import type { Handle, Props } from 'remix/component'

import { ariaStates } from '#remixcn/lib/aria.ts'
import { disabledState, fieldItem, invalidState, mergeStyles, transition } from '#remixcn/lib/styles.ts'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`

// The same box as Input, at least 4rem tall. It grows with its text where the
// browser supports field-sizing, and the user may resize it upward or down.
const textareaRule = css(
  mergeStyles(
    {
      display: 'block',
      width: '100%',
      minWidth: 0,
      minHeight: space(16),
      margin: 0,
      paddingInline: space(2.5),
      paddingBlock: space(2),
      border: '1px solid var(--input)',
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'light-dark(transparent, color-mix(in oklab, var(--input) 30%, transparent))',
      boxShadow: 'var(--shadow-xs)',
      fontSize: 'var(--text-base)',
      lineHeight: 'var(--text-base--line-height)',
      fieldSizing: 'content',
      resize: 'vertical',
      '@media (min-width: 48rem)': { fontSize: 'var(--text-sm)', lineHeight: 'var(--text-sm--line-height)' },
      '&::placeholder': { color: 'var(--muted-foreground)', opacity: 1 },
      '&:focus-visible': { borderColor: 'var(--ring)' },
    },
    transition('color', 'border-color', 'box-shadow'),
    invalidState,
    disabledState,
    fieldItem,
  ),
)

/**
 * A native textarea. Every native attribute passes through: name, value or
 * defaultValue, rows, required, readOnly, disabled, maxLength, autocomplete,
 * form and the rest. So the browser validates, autofills, submits and resets
 * it, also before any script runs.
 */
export function Textarea(handle: Handle<Props<'textarea'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <textarea data-slot="textarea" {...ariaStates(props)} mix={[textareaRule, mix]} />
  }
}
