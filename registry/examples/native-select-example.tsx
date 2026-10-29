// RemixCN Native Select examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { Field, FieldDescription, FieldError, FieldLabel } from '#remixcn/ui/field.tsx'
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from '#remixcn/ui/native-select.tsx'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const stackStyles = css({ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: space(4) })

/** Fruits, one of them sold out. */
export function NativeSelectBasic() {
  return () => (
    <NativeSelect name="fruit" aria-label="Fruit">
      <NativeSelectOption value="">Select a fruit</NativeSelectOption>
      <NativeSelectOption value="apple">Apple</NativeSelectOption>
      <NativeSelectOption value="banana">Banana</NativeSelectOption>
      <NativeSelectOption value="blueberry">Blueberry</NativeSelectOption>
      <NativeSelectOption value="grapes" disabled>
        Grapes
      </NativeSelectOption>
      <NativeSelectOption value="pineapple">Pineapple</NativeSelectOption>
    </NativeSelect>
  )
}

/** Options in labelled groups. */
export function NativeSelectWithGroups() {
  return () => (
    <NativeSelect name="food" aria-label="Food">
      <NativeSelectOption value="">Select a food</NativeSelectOption>
      <NativeSelectOptGroup label="Fruits">
        <NativeSelectOption value="apple">Apple</NativeSelectOption>
        <NativeSelectOption value="banana">Banana</NativeSelectOption>
        <NativeSelectOption value="blueberry">Blueberry</NativeSelectOption>
      </NativeSelectOptGroup>
      <NativeSelectOptGroup label="Vegetables">
        <NativeSelectOption value="carrot">Carrot</NativeSelectOption>
        <NativeSelectOption value="broccoli">Broccoli</NativeSelectOption>
        <NativeSelectOption value="spinach">Spinach</NativeSelectOption>
      </NativeSelectOptGroup>
    </NativeSelect>
  )
}

/** The small and the default size. */
export function NativeSelectSizes() {
  return () => (
    <div mix={stackStyles}>
      <NativeSelect size="sm" name="small" aria-label="Small" defaultValue="apple">
        <NativeSelectOption value="apple">Apple</NativeSelectOption>
        <NativeSelectOption value="banana">Banana</NativeSelectOption>
      </NativeSelect>
      <NativeSelect name="default" aria-label="Default" defaultValue="apple">
        <NativeSelectOption value="apple">Apple</NativeSelectOption>
        <NativeSelectOption value="banana">Banana</NativeSelectOption>
      </NativeSelect>
    </div>
  )
}

/** In a field, the select fills the width and its label and description name it. */
export function NativeSelectWithField() {
  return () => (
    <Field>
      <FieldLabel for="native-select-demo-country">Country</FieldLabel>
      <NativeSelect
        id="native-select-demo-country"
        name="country"
        autocomplete="country"
        defaultValue="ch"
        aria-describedby="native-select-demo-country-hint"
      >
        <NativeSelectOption value="">Select a country</NativeSelectOption>
        <NativeSelectOption value="at">Austria</NativeSelectOption>
        <NativeSelectOption value="de">Germany</NativeSelectOption>
        <NativeSelectOption value="ch">Switzerland</NativeSelectOption>
      </NativeSelect>
      <FieldDescription id="native-select-demo-country-hint">Where the company is registered.</FieldDescription>
    </Field>
  )
}

/** A disabled select dims and sends nothing. */
export function NativeSelectDisabled() {
  return () => (
    <NativeSelect name="locked" aria-label="Plan" defaultValue="pro" disabled>
      <NativeSelectOption value="free">Free</NativeSelectOption>
      <NativeSelectOption value="pro">Pro</NativeSelectOption>
    </NativeSelect>
  )
}

/** An invalid select names its error message. */
export function NativeSelectInvalid() {
  return () => (
    <Field invalid>
      <FieldLabel for="native-select-demo-plan">Plan</FieldLabel>
      <NativeSelect
        id="native-select-demo-plan"
        name="plan"
        required
        aria-invalid={true}
        aria-describedby="native-select-demo-plan-error"
      >
        <NativeSelectOption value="">Select a plan</NativeSelectOption>
        <NativeSelectOption value="free">Free</NativeSelectOption>
        <NativeSelectOption value="pro">Pro</NativeSelectOption>
      </NativeSelect>
      <FieldError id="native-select-demo-plan-error" errors={[{ message: 'Choose a plan to continue.' }]} />
    </Field>
  )
}

const currencies = ['CHF', 'EUR', 'USD']

/**
 * A controlled currency. The client entry keeps the value, and the text
 * under the select follows each change.
 */
export const NativeSelectControlled = clientEntry(import.meta.url, function NativeSelectControlled(handle: Handle) {
  let currency = 'CHF'

  return () => (
    <Field>
      <FieldLabel for="native-select-demo-currency">Currency</FieldLabel>
      <NativeSelect
        id="native-select-demo-currency"
        name="currency"
        value={currency}
        aria-describedby="native-select-demo-currency-hint"
        mix={on('change', (event) => {
          currency = (event.target as HTMLSelectElement).value
          void handle.update()
        })}
      >
        {currencies.map((code) => (
          <NativeSelectOption key={code} value={code}>
            {code}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <FieldDescription id="native-select-demo-currency-hint" data-value="currency">
        Invoices show amounts in {currency}.
      </FieldDescription>
    </Field>
  )
})
