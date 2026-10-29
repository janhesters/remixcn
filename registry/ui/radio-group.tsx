// RemixCN Radio Group: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css, on } from 'remix/component'
import type { Handle, Props } from 'remix/component'

import { disabledState, invalidState, mergeStyles, transition } from '#remixcn/lib/styles.ts'

export interface RadioGroupProps extends Omit<Props<'div'>, 'role'> {
  /** The form field name of every radio. Without one, the radios share a generated name and still form one group. */
  name?: string
  /** The selected value, for a group the caller controls. */
  value?: string
  /** The value selected at first, and again after a form reset. */
  defaultValue?: string
  disabled?: boolean
  /** Blocks form submission until a radio is selected. */
  required?: boolean
  /** The id of the form the radios belong to, when the group sits outside it. */
  form?: string
}

export interface RadioGroupItemProps extends Omit<
  Props<'input'>,
  'type' | 'role' | 'children' | 'value' | 'checked' | 'defaultChecked'
> {
  /** The value the form submits while this radio is selected. */
  value: string
}

interface RadioGroupContext {
  name: string
  value?: string
  defaultValue?: string
  disabled?: boolean
  required?: boolean
  form?: string
}

// One column that may shrink below its content, so long labels reflow on narrow screens.
const groupStyles = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: 'calc(var(--spacing) * 3)',
  width: '100%',
})

/**
 * A group of native radios with one name. The browser groups them: arrow
 * keys move the selection, Tab enters at the selected radio, and forms submit
 * and reset the value without JavaScript.
 */
export function RadioGroup(handle: Handle<RadioGroupProps, RadioGroupContext>) {
  // A click unchecks the selected radio before anyone decides. Remix restores
  // only the clicked radio of a controlled group, so when the owner keeps the
  // old value, the group checks the radio of its current value again. A
  // microtask leaves room for an owner that accepts the change to render first.
  function restoreControlledValue(group: HTMLElement) {
    queueMicrotask(() => {
      let { value } = handle.props
      if (value === undefined) return

      for (let radio of group.querySelectorAll<HTMLInputElement>('input[data-slot="radio-group-item"]')) {
        if (radio.closest('[data-slot="radio-group"]') === group) radio.checked = radio.value === value
      }
    })
  }

  return () => {
    let { name, value, defaultValue, disabled, required, form, mix, children, ...props } = handle.props
    handle.context.set({ name: name ?? `radio-group-${handle.id}`, value, defaultValue, disabled, required, form })

    return (
      <div
        {...props}
        role="radiogroup"
        data-slot="radio-group"
        data-disabled={disabled ? '' : undefined}
        aria-required={required ? 'true' : undefined}
        mix={[groupStyles, mix, on('change', (event) => restoreControlledValue(event.currentTarget))]}
      >
        {children}
      </div>
    )
  }
}

const itemRootStyles = css({
  display: 'inline-grid',
  placeItems: 'center',
  flexShrink: 0,
  verticalAlign: 'middle',
})

const itemStyles = css(
  mergeStyles(
    {
      gridArea: '1 / 1',
      appearance: 'none',
      width: '1rem',
      height: '1rem',
      margin: 0,
      border: '1px solid var(--input)',
      borderRadius: '9999px',
      backgroundColor: 'light-dark(transparent, color-mix(in oklch, var(--input) 30%, transparent))',
      boxShadow: 'var(--shadow-xs)',
      '&:checked': { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' },
    },
    invalidState,
    disabledState,
    transition('background-color', 'border-color'),
    // Forced colors draw the system's own radio.
    { '@media (forced-colors: active)': { appearance: 'auto' } },
  ),
)

const indicatorStyles = css({
  gridArea: '1 / 1',
  display: 'none',
  width: '0.5rem',
  height: '0.5rem',
  borderRadius: '9999px',
  pointerEvents: 'none',
  backgroundColor: 'var(--primary-foreground)',
  ':where(input:checked) ~ &': { display: 'block' },
  ':where(input:disabled) ~ &': { opacity: 0.5 },
  '@media (forced-colors: active)': { ':where(input) ~ &': { display: 'none' } },
})

/** One native radio of a Radio Group, with shadcn's dot. */
export function RadioGroupItem(handle: Handle<RadioGroupItemProps>) {
  return () => {
    let group = handle.context.get(RadioGroup) as RadioGroupContext | undefined
    let { value, mix, ...props } = handle.props
    let controlled = group?.value !== undefined

    return (
      <span data-slot="radio-group-item-root" mix={itemRootStyles}>
        <input
          {...props}
          type="radio"
          data-slot="radio-group-item"
          name={group?.name ?? props.name}
          value={value}
          form={group?.form ?? props.form}
          checked={controlled ? group?.value === value : undefined}
          defaultChecked={!controlled && group?.defaultValue === value ? true : undefined}
          disabled={group?.disabled || props.disabled}
          required={group?.required || props.required}
          mix={[itemStyles, mix]}
        />
        <span data-slot="radio-group-indicator" aria-hidden="true" mix={indicatorStyles} />
      </span>
    )
  }
}
