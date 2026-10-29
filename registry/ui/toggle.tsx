// RemixCN Toggle: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css, on } from 'remix/component'
import type { Handle, Props } from 'remix/component'

import { disabledState, invalidState, mergeStyles, transition } from '#remixcn/lib/styles.ts'
import type { Styles } from '#remixcn/lib/styles.ts'

export type ToggleVariant = 'default' | 'outline'
export type ToggleSize = 'default' | 'sm' | 'lg'

export interface ToggleProps extends Omit<Props<'button'>, 'type' | 'aria-pressed'> {
  /** Whether the toggle is pressed, for a toggle the caller controls. */
  pressed?: boolean
  /** Whether the toggle starts pressed. */
  defaultPressed?: boolean
  variant?: ToggleVariant
  size?: ToggleSize
}

export const toggleChangeType = 'remixcn:toggle-change' as const

/**
 * Dispatched on the toggle before its pressed state changes, and bubbles.
 * `pressed` is the next state. Cancel it with `preventDefault()` to keep the
 * current one. It takes the place of shadcn's `onPressedChange`.
 */
export class ToggleChangeEvent extends Event {
  readonly pressed: boolean

  constructor(pressed: boolean) {
    super(toggleChangeType, { bubbles: true, cancelable: true })
    this.pressed = pressed
  }
}

declare global {
  interface HTMLElementEventMap {
    [toggleChangeType]: ToggleChangeEvent
  }
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`

// A bar along the bottom edge marks a pressed toggle, so the state doesn't
// rest on the muted background alone. Forced colors drop shadows and
// backgrounds and draw a backplate behind text, so there the bar is a thick
// bottom border in the system's highlight color.
const pressedBar = 'inset 0 -2px 0 0 var(--foreground)'

const sizeStyles: Record<ToggleSize, Styles> = {
  default: { height: '2.25rem', minWidth: '2.25rem', paddingInline: space(2.5) },
  sm: { height: '2rem', minWidth: '2rem', paddingInline: space(2.5) },
  lg: { height: '2.5rem', minWidth: '2.5rem', paddingInline: space(2.5) },
}

const variantStyles: Record<ToggleVariant, Styles> = {
  default: {},
  outline: {
    borderColor: 'var(--input)',
    boxShadow: 'var(--shadow-xs)',
    '&[aria-pressed="true"]': { boxShadow: `${pressedBar}, var(--shadow-xs)` },
  },
}

/**
 * The style object of a toggle in a variant and size, for `css()`. It takes
 * the place of shadcn's `toggleVariants`, so other controls can look like a toggle.
 */
export function toggleStyles({
  variant = 'default',
  size = 'default',
}: { variant?: ToggleVariant; size?: ToggleSize } = {}): Styles {
  return mergeStyles(
    {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space(1),
      whiteSpace: 'nowrap',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: 'transparent',
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'transparent',
      fontSize: 'var(--text-sm)',
      lineHeight: 'var(--text-sm--line-height)',
      fontWeight: 500,
      '& svg': { width: '1rem', height: '1rem', flexShrink: 0, pointerEvents: 'none' },
      '@media (hover: hover)': { '&:hover': { backgroundColor: 'var(--muted)', color: 'var(--foreground)' } },
      '&[aria-pressed="true"]': { backgroundColor: 'var(--muted)', color: 'var(--foreground)', boxShadow: pressedBar },
    },
    sizeStyles[size],
    variantStyles[variant],
    invalidState,
    disabledState,
    { '&:disabled, &[aria-disabled="true"]': { pointerEvents: 'none' } },
    transition('color', 'background-color', 'box-shadow'),
    {
      '@media (forced-colors: active)': {
        '&[aria-pressed="true"]': { borderColor: 'Highlight', borderBlockEndWidth: '3px' },
      },
    },
  )
}

const variants: ToggleVariant[] = ['default', 'outline']
const sizes: ToggleSize[] = ['default', 'sm', 'lg']
const styles = new Map(
  variants.flatMap((variant) =>
    sizes.map((size) => [`${variant} ${size}`, css(toggleStyles({ variant, size }))] as const),
  ),
)

function isAriaDisabled(value: unknown) {
  return value === true || value === 'true'
}

/** A native button that turns on and off, with a literal aria-pressed. */
export function Toggle(handle: Handle<ToggleProps>) {
  let uncontrolledPressed = handle.props.defaultPressed ?? false

  return () => {
    let {
      pressed: controlledPressed,
      defaultPressed: _defaultPressed,
      variant = 'default',
      size = 'default',
      mix,
      ...props
    } = handle.props
    let pressed = controlledPressed ?? uncontrolledPressed

    return (
      <button
        {...props}
        type="button"
        data-slot="toggle"
        data-variant={variant}
        data-size={size}
        data-state={pressed ? 'on' : 'off'}
        aria-pressed={pressed ? 'true' : 'false'}
        mix={[
          styles.get(`${variant} ${size}`),
          on('click', (event) => {
            if (isAriaDisabled(handle.props['aria-disabled'])) return

            let next = !(handle.props.pressed ?? uncontrolledPressed)
            let accepted = event.currentTarget.dispatchEvent(new ToggleChangeEvent(next))
            if (accepted && handle.props.pressed === undefined) {
              uncontrolledPressed = next
              void handle.update()
            }
          }),
          mix,
        ]}
      />
    )
  }
}
