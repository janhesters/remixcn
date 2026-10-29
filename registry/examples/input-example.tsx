// RemixCN Input examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css } from 'remix/component'
import type { Handle } from 'remix/component'

import { Button } from '#remixcn/ui/button.tsx'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '#remixcn/ui/field.tsx'
import { Input } from '#remixcn/ui/input.tsx'
import type { InputType } from '#remixcn/ui/input.tsx'
import { NativeSelect, NativeSelectOption } from '#remixcn/ui/native-select.tsx'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const rowStyles = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: space(2), width: '100%' })
const growStyles = css({ flex: '1 1 12rem' })
const columnsStyles = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 12rem), 1fr))',
  gap: space(4),
})
const formStyles = css({ width: '100%', margin: 0 })

/** An email input. */
export function InputBasic() {
  return () => <Input type="email" name="email" aria-label="Email" placeholder="Email" autocomplete="email" />
}

/** An invalid input names its error message. */
export function InputInvalid() {
  return () => (
    <Field invalid>
      <FieldLabel for="input-demo-iban">IBAN</FieldLabel>
      <Input
        id="input-demo-iban"
        name="iban"
        defaultValue="CH93 0076 2011"
        aria-invalid={true}
        aria-describedby="input-demo-iban-error"
      />
      <FieldError id="input-demo-iban-error" errors={[{ message: 'Enter all 21 characters of a Swiss IBAN.' }]} />
    </Field>
  )
}

/** A label above the input. */
export function InputWithLabel() {
  return () => (
    <Field>
      <FieldLabel for="input-demo-email">Email</FieldLabel>
      <Input id="input-demo-email" name="email" type="email" placeholder="name@example.com" autocomplete="email" />
    </Field>
  )
}

/** A description the input's aria-describedby names. */
export function InputWithDescription() {
  return () => (
    <Field>
      <FieldLabel for="input-demo-username">Username</FieldLabel>
      <Input
        id="input-demo-username"
        name="username"
        placeholder="ada.lovelace"
        autocomplete="username"
        aria-describedby="input-demo-username-hint"
      />
      <FieldDescription id="input-demo-username-hint">Your teammates see it on shared invoices.</FieldDescription>
    </Field>
  )
}

/** A disabled input dims, is skipped by the keyboard and sends nothing. */
export function InputDisabled() {
  return () => (
    <Field disabled>
      <FieldLabel for="input-demo-disabled">Email</FieldLabel>
      <Input id="input-demo-disabled" name="email" type="email" placeholder="Email" disabled />
    </Field>
  )
}

/** A read-only input can be focused, selected and sent, but not changed. */
export function InputReadOnly() {
  return () => (
    <Field>
      <FieldLabel for="input-demo-invoice-number">Invoice number</FieldLabel>
      <Input
        id="input-demo-invoice-number"
        name="number"
        defaultValue="INV-2026-0042"
        readOnly
        aria-describedby="input-demo-invoice-number-hint"
      />
      <FieldDescription id="input-demo-invoice-number-hint">Numbers are given out in order.</FieldDescription>
    </Field>
  )
}

const types: Array<{ type: InputType; label: string; placeholder?: string; autocomplete?: string }> = [
  { type: 'password', label: 'Password', placeholder: 'Password', autocomplete: 'current-password' },
  { type: 'tel', label: 'Phone', placeholder: '+41 44 123 45 67', autocomplete: 'tel' },
  { type: 'url', label: 'Website', placeholder: 'https://example.com', autocomplete: 'url' },
  { type: 'search', label: 'Search', placeholder: 'Search invoices' },
  { type: 'number', label: 'Quantity', placeholder: '1' },
  { type: 'date', label: 'Due date' },
  { type: 'time', label: 'Reminder time' },
  { type: 'file', label: 'Receipt' },
]

/** The native types shadcn shows, each with its own keyboard and picker. */
export function InputTypes() {
  return () => (
    <FieldGroup>
      {types.map(({ type, label, placeholder, autocomplete }) => (
        <Field key={type}>
          <FieldLabel for={`input-demo-${type}`}>{label}</FieldLabel>
          <Input
            id={`input-demo-${type}`}
            name={type}
            type={type}
            placeholder={placeholder}
            autocomplete={autocomplete}
          />
        </Field>
      ))}
    </FieldGroup>
  )
}

/** Suggestions from a native datalist, which the user may ignore. */
export function InputWithDatalist() {
  return () => (
    <Field>
      <FieldLabel for="input-demo-terms">Payment terms</FieldLabel>
      <Input id="input-demo-terms" name="terms" list="input-demo-terms-list" placeholder="Net 30" />
      <datalist id="input-demo-terms-list">
        <option value="Due on receipt" />
        <option value="Net 15" />
        <option value="Net 30" />
        <option value="Net 60" />
      </datalist>
    </Field>
  )
}

/** A search box beside its button. */
export function InputWithButton() {
  return () => (
    <form role="search" method="get" mix={[rowStyles, formStyles]}>
      <Input type="search" name="q" aria-label="Search invoices" placeholder="Search…" mix={growStyles} />
      <Button type="submit">Search</Button>
    </form>
  )
}

/** A phone number beside its country code. */
export function InputWithNativeSelect() {
  return () => (
    <div mix={rowStyles}>
      <NativeSelect name="dial-code" aria-label="Country code" defaultValue="+41">
        <NativeSelectOption value="+41">+41</NativeSelectOption>
        <NativeSelectOption value="+44">+44</NativeSelectOption>
        <NativeSelectOption value="+49">+49</NativeSelectOption>
      </NativeSelect>
      <Input type="tel" name="phone" aria-label="Phone number" placeholder="44 123 45 67" mix={growStyles} />
    </div>
  )
}

/** A contact form that sends its fields to action. Reset clears them. */
export function InputForm(handle: Handle<{ action: string }>) {
  return () => (
    <form action={handle.props.action} method="get" mix={formStyles}>
      <FieldGroup>
        <Field>
          <FieldLabel for="input-form-name">Name</FieldLabel>
          <Input id="input-form-name" name="name" placeholder="Ada Lovelace" autocomplete="name" required />
        </Field>
        <Field>
          <FieldLabel for="input-form-email">Email</FieldLabel>
          <Input
            id="input-form-email"
            name="email"
            type="email"
            placeholder="ada@example.com"
            autocomplete="email"
            aria-describedby="input-form-email-hint"
            required
          />
          <FieldDescription id="input-form-email-hint">We never share your email.</FieldDescription>
        </Field>
        <div mix={columnsStyles}>
          <Field>
            <FieldLabel for="input-form-phone">Phone</FieldLabel>
            <Input id="input-form-phone" name="phone" type="tel" placeholder="+41 44 123 45 67" autocomplete="tel" />
          </Field>
          <Field>
            <FieldLabel for="input-form-country">Country</FieldLabel>
            <NativeSelect id="input-form-country" name="country" defaultValue="ch" autocomplete="country">
              <NativeSelectOption value="at">Austria</NativeSelectOption>
              <NativeSelectOption value="de">Germany</NativeSelectOption>
              <NativeSelectOption value="ch">Switzerland</NativeSelectOption>
            </NativeSelect>
          </Field>
        </div>
        <Field>
          <FieldLabel for="input-form-address">Address</FieldLabel>
          <Input id="input-form-address" name="address" placeholder="Bahnhofstrasse 1" autocomplete="street-address" />
        </Field>
        <Field orientation="horizontal">
          <Button type="reset" variant="outline">
            Reset
          </Button>
          <Button type="submit">Submit</Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
