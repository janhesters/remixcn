// RemixCN Input: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css } from 'remix/component'
import type { Handle, Props } from 'remix/component'

import { ariaStates } from '#remixcn/lib/aria.ts'
import {
  buttonGroupItem,
  disabledState,
  fieldItem,
  invalidState,
  mergeStyles,
  transition,
} from '#remixcn/lib/styles.ts'

/**
 * The native types Input renders. Checkboxes, radios, ranges and buttons
 * have their own components, and a hidden input needs no styles.
 */
export type InputType =
  | 'text'
  | 'email'
  | 'password'
  | 'number'
  | 'search'
  | 'tel'
  | 'url'
  | 'date'
  | 'datetime-local'
  | 'month'
  | 'time'
  | 'week'
  | 'file'
  | 'color'

export interface InputProps extends Omit<
  Props<'input'>,
  'type' | 'role' | 'list' | 'checked' | 'defaultChecked' | 'indeterminate'
> {
  /** The native type. Without one, the input is a text box. */
  type?: InputType
  /** The id of a <datalist> whose options the browser suggests. */
  list?: string
  role?: 'combobox' | 'searchbox' | 'spinbutton' | 'textbox'
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`

// The control's colors read the theme, and light-dark() tints the dark scheme as shadcn's dark: classes do.
const inputRule = css(
  mergeStyles(
    {
      display: 'block',
      width: '100%',
      minWidth: 0,
      minHeight: space(9),
      margin: 0,
      paddingInline: space(2.5),
      paddingBlock: space(1),
      border: '1px solid var(--input)',
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'light-dark(transparent, color-mix(in oklab, var(--input) 30%, transparent))',
      boxShadow: 'var(--shadow-xs)',
      // 16px text keeps phones from zooming in on focus; wider screens use the smaller size.
      fontSize: 'var(--text-base)',
      lineHeight: 'var(--text-base--line-height)',
      '@media (min-width: 48rem)': { fontSize: 'var(--text-sm)', lineHeight: 'var(--text-sm--line-height)' },
      '&::placeholder': { color: 'var(--muted-foreground)', opacity: 1 },
      '&::file-selector-button': {
        display: 'inline-flex',
        height: space(7),
        marginInlineEnd: space(2),
        padding: 0,
        border: 0,
        backgroundColor: 'transparent',
        color: 'var(--foreground)',
        fontSize: 'var(--text-sm)',
        fontWeight: 500,
      },
      '&:focus-visible': { borderColor: 'var(--ring)' },
    },
    transition('color', 'border-color', 'box-shadow'),
    invalidState,
    disabledState,
    buttonGroupItem,
    fieldItem,
  ),
)

/**
 * A native input for text, email, numbers, dates, times, files and colors.
 * Every native attribute passes through: name, value or defaultValue,
 * required, readOnly, disabled, autocomplete, list, form and the rest. So
 * the browser validates, autofills, suggests, submits and resets it, also
 * before any script runs.
 */
export function Input(handle: Handle<InputProps>) {
  return () => {
    let { mix, ...props } = handle.props

    return <input data-slot="input" {...(ariaStates(props) as Props<'input'>)} mix={[inputRule, mix]} />
  }
}
