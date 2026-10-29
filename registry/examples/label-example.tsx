// RemixCN Label examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { Checkbox } from '#remixcn/ui/checkbox.tsx'
import { Field } from '#remixcn/ui/field.tsx'
import { Input } from '#remixcn/ui/input.tsx'
import { Label } from '#remixcn/ui/label.tsx'
import { Textarea } from '#remixcn/ui/textarea.tsx'

/** A checkbox before its label. A click on the label toggles it. */
export function LabelWithCheckbox() {
  return () => (
    <Field orientation="horizontal">
      <Checkbox id="label-demo-terms" name="terms" />
      <Label for="label-demo-terms">Accept the payment terms</Label>
    </Field>
  )
}

/** A label above the input it names. */
export function LabelWithInput() {
  return () => (
    <Field>
      <Label for="label-demo-username">Username</Label>
      <Input id="label-demo-username" name="username" placeholder="ada.lovelace" autocomplete="username" />
    </Field>
  )
}

/** A disabled field dims its label with the input. */
export function LabelDisabled() {
  return () => (
    <Field disabled>
      <Label for="label-demo-disabled">Workspace</Label>
      <Input id="label-demo-disabled" name="workspace" placeholder="Acme Labs" disabled />
    </Field>
  )
}

/** A label above a textarea. */
export function LabelWithTextarea() {
  return () => (
    <Field>
      <Label for="label-demo-message">Message</Label>
      <Textarea id="label-demo-message" name="message" placeholder="Thanks for your order." />
    </Field>
  )
}
