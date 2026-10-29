// RemixCN Toggle Group: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css, on, ref } from 'remix/component'
import type { Handle, Props } from 'remix/component'

import { rovingFocus } from '#remixcn/lib/composite.ts'
import { mergeStyles } from '#remixcn/lib/styles.ts'
import { toggleStyles } from '#remixcn/ui/toggle.tsx'
import type { ToggleSize, ToggleVariant } from '#remixcn/ui/toggle.tsx'

export type ToggleGroupOrientation = 'horizontal' | 'vertical'

export interface ToggleGroupProps extends Omit<Props<'div'>, 'role' | 'defaultValue'> {
  /** The values of the pressed items, for a group the caller controls. */
  value?: string[]
  /** The values of the items pressed at first. */
  defaultValue?: string[]
  /** Lets several items be pressed at once. Otherwise pressing one releases the others. */
  multiple?: boolean
  disabled?: boolean
  /** Which arrow keys move between items: left and right, or up and down. */
  orientation?: ToggleGroupOrientation
  /** Whether the arrow keys wrap from the last item to the first. */
  loopFocus?: boolean
  /** The variant of every item. Without one, each item keeps its own. */
  variant?: ToggleVariant
  /** The size of every item. Without one, each item keeps its own. */
  size?: ToggleSize
  /** The gap between items in spacing steps. 0 joins them into one bar. */
  spacing?: number
}

export interface ToggleGroupItemProps extends Omit<Props<'button'>, 'type' | 'aria-pressed' | 'value'> {
  /** Identifies the item in the group's value. */
  value: string
  variant?: ToggleVariant
  size?: ToggleSize
}

interface ToggleGroupContext {
  value: string[]
  disabled: boolean
  orientation: ToggleGroupOrientation
  spacing: number
  variant?: ToggleVariant
  size?: ToggleSize
  toggle(value: string): void
}

export const toggleGroupChangeType = 'remixcn:toggle-group-change' as const

/**
 * Dispatched on the group before its value changes, and bubbles. `value` is
 * the next value. Cancel it with `preventDefault()` to keep the current one.
 * It takes the place of shadcn's `onValueChange`.
 */
export class ToggleGroupChangeEvent extends Event {
  readonly value: string[]

  constructor(value: string[]) {
    super(toggleGroupChangeType, { bubbles: true, cancelable: true })
    this.value = value
  }
}

declare global {
  interface HTMLElementEventMap {
    [toggleGroupChangeType]: ToggleGroupChangeEvent
  }
}

function isAriaDisabled(value: unknown) {
  return value === true || value === 'true'
}

const groupStyles = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  width: 'fit-content',
  maxWidth: '100%',
  gap: 'calc(var(--spacing) * var(--gap))',
  borderRadius: 'var(--radius-md)',
  '&[data-orientation="vertical"]': { flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'stretch' },
  '&[data-spacing="0"][data-variant="outline"]': { boxShadow: 'var(--shadow-xs)' },
})

/**
 * A row or column of toggles with a shared value, in single or multiple
 * mode. Once the browser runs it, the group is one tab stop and the arrow
 * keys move between its items, as in a toolbar.
 */
export function ToggleGroup(handle: Handle<ToggleGroupProps, ToggleGroupContext>) {
  let uncontrolledValue = handle.props.defaultValue ?? []
  let group: HTMLElement | undefined

  function currentValue() {
    return handle.props.value ?? uncontrolledValue
  }

  function toggle(item: string) {
    if (handle.props.disabled || !group) return

    let value = currentValue()
    let pressed = value.includes(item)
    let next = handle.props.multiple
      ? pressed
        ? value.filter((other) => other !== item)
        : [...value, item]
      : pressed
        ? []
        : [item]

    let accepted = group.dispatchEvent(new ToggleGroupChangeEvent(next))
    if (accepted && handle.props.value === undefined) {
      uncontrolledValue = next
      void handle.update()
    }
  }

  return () => {
    let {
      value: _value,
      defaultValue: _defaultValue,
      multiple,
      disabled = false,
      orientation = 'horizontal',
      loopFocus = true,
      variant,
      size,
      spacing = 2,
      style,
      mix,
      children,
      ...props
    } = handle.props

    handle.context.set({ value: currentValue(), disabled, orientation, spacing, variant, size, toggle })

    return (
      <div
        {...props}
        role="group"
        data-slot="toggle-group"
        data-orientation={orientation}
        data-spacing={spacing}
        data-variant={variant}
        data-size={size}
        data-multiple={multiple ? '' : undefined}
        data-disabled={disabled ? '' : undefined}
        style={typeof style === 'string' ? `${style}; --gap: ${spacing}` : { ...style, '--gap': String(spacing) }}
        mix={[
          groupStyles,
          ref<HTMLDivElement>((node, signal) => {
            group = node
            signal.addEventListener('abort', () => {
              if (group === node) group = undefined
            })
          }),
          mix,
          // One tab stop, the arrow keys, Home and End, from the shared helper.
          // Before the browser runs it, every item stays in the tab order.
          rovingFocus({ items: '[data-slot="toggle-group-item"]', orientation, loop: loopFocus }),
        ]}
      >
        {children}
      </div>
    )
  }
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const radius = 'var(--radius-md)'

// With spacing 0 the items join into one bar: only the outer corners stay
// round, and outline items share their borders. Logical corners and borders
// keep the bar right in right-to-left text.
const joinedStyles = {
  position: 'relative',
  flexShrink: 0,
  '&:focus-visible': { zIndex: 1 },
  '&[data-spacing="0"]': { borderRadius: 0, paddingInline: space(2) },
  '&[data-spacing="0"]:not([aria-pressed="true"])': { boxShadow: 'none' },
  '&[data-spacing="0"][data-orientation="horizontal"]:first-child': {
    borderStartStartRadius: radius,
    borderEndStartRadius: radius,
  },
  '&[data-spacing="0"][data-orientation="horizontal"]:last-child': {
    borderStartEndRadius: radius,
    borderEndEndRadius: radius,
  },
  '&[data-spacing="0"][data-orientation="vertical"]:first-child': {
    borderStartStartRadius: radius,
    borderStartEndRadius: radius,
  },
  '&[data-spacing="0"][data-orientation="vertical"]:last-child': {
    borderEndStartRadius: radius,
    borderEndEndRadius: radius,
  },
  '&[data-spacing="0"][data-variant="outline"][data-orientation="horizontal"]:not(:first-child)': {
    borderInlineStartWidth: 0,
  },
  '&[data-spacing="0"][data-variant="outline"][data-orientation="vertical"]:not(:first-child)': {
    borderBlockStartWidth: 0,
  },
}

const variants: ToggleVariant[] = ['default', 'outline']
const sizes: ToggleSize[] = ['default', 'sm', 'lg']
const itemStyles = new Map(
  variants.flatMap((variant) =>
    sizes.map(
      (size) => [`${variant} ${size}`, css(mergeStyles(toggleStyles({ variant, size }), joinedStyles))] as const,
    ),
  ),
)

/** One toggle of a Toggle Group. The group's variant and size win over its own. */
export function ToggleGroupItem(handle: Handle<ToggleGroupItemProps>) {
  return () => {
    let group = handle.context.get(ToggleGroup) as ToggleGroupContext | undefined
    let { value, variant: ownVariant = 'default', size: ownSize = 'default', disabled, mix, ...props } = handle.props
    let variant = group?.variant ?? ownVariant
    let size = group?.size ?? ownSize
    let pressed = group?.value.includes(value) ?? false

    return (
      <button
        {...props}
        type="button"
        value={value}
        data-slot="toggle-group-item"
        data-variant={variant}
        data-size={size}
        data-spacing={group?.spacing ?? 2}
        data-orientation={group?.orientation ?? 'horizontal'}
        data-state={pressed ? 'on' : 'off'}
        aria-pressed={pressed ? 'true' : 'false'}
        disabled={group?.disabled || disabled}
        mix={[
          itemStyles.get(`${variant} ${size}`),
          on('click', () => {
            if (!isAriaDisabled(handle.props['aria-disabled'])) group?.toggle(value)
          }),
          mix,
        ]}
      />
    )
  }
}
