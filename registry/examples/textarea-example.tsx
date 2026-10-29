// RemixCN Textarea examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { Field, FieldDescription, FieldError, FieldLabel } from '#remixcn/ui/field.tsx'
import { Textarea } from '#remixcn/ui/textarea.tsx'

/** A textarea that grows with its text where the browser supports it. */
export function TextareaBasic() {
  return () => <Textarea name="message" aria-label="Message" placeholder="Type your message here." />
}

/** An invalid textarea names its error message. */
export function TextareaInvalid() {
  return () => (
    <Field invalid>
      <FieldLabel for="textarea-demo-reason">Reason for the credit note</FieldLabel>
      <Textarea
        id="textarea-demo-reason"
        name="reason"
        aria-invalid={true}
        aria-describedby="textarea-demo-reason-error"
        placeholder="Type your message here."
      />
      <FieldError id="textarea-demo-reason-error" errors={[{ message: 'Say why you credit this invoice.' }]} />
    </Field>
  )
}

/** A label above six rows. */
export function TextareaWithLabel() {
  return () => (
    <Field>
      <FieldLabel for="textarea-demo-message">Message</FieldLabel>
      <Textarea id="textarea-demo-message" name="message" placeholder="Type your message here." rows={6} />
    </Field>
  )
}

/** A description under the textarea, which its aria-describedby names. */
export function TextareaWithDescription() {
  return () => (
    <Field>
      <FieldLabel for="textarea-demo-note">Note on the invoice</FieldLabel>
      <Textarea
        id="textarea-demo-note"
        name="note"
        placeholder="Thanks for your order."
        rows={6}
        maxLength={500}
        aria-describedby="textarea-demo-note-hint"
      />
      <FieldDescription id="textarea-demo-note-hint">Up to 500 characters, printed under the total.</FieldDescription>
    </Field>
  )
}

/** A disabled textarea is skipped by the keyboard and left out of the form. */
export function TextareaDisabled() {
  return () => (
    <Field disabled>
      <FieldLabel for="textarea-demo-disabled">Message</FieldLabel>
      <Textarea id="textarea-demo-disabled" name="message" placeholder="Type your message here." disabled />
    </Field>
  )
}
