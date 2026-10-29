// RemixCN Field examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on, ref } from 'remix/component'
import type { Handle } from 'remix/component'

import { CircleAlertIcon } from '#remixcn/lib/icons.tsx'
import { Alert, AlertDescription, AlertTitle } from '#remixcn/ui/alert.tsx'
import { Badge } from '#remixcn/ui/badge.tsx'
import { Button } from '#remixcn/ui/button.tsx'
import { Checkbox } from '#remixcn/ui/checkbox.tsx'
import {
  describedBy,
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  fieldErrorMessages,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from '#remixcn/ui/field.tsx'
import type { FieldErrorEntry } from '#remixcn/ui/field.tsx'
import { Input } from '#remixcn/ui/input.tsx'
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from '#remixcn/ui/native-select.tsx'
import { RadioGroup, RadioGroupItem } from '#remixcn/ui/radio-group.tsx'
import { Slider } from '#remixcn/ui/slider.tsx'
import { Switch } from '#remixcn/ui/switch.tsx'
import { Textarea } from '#remixcn/ui/textarea.tsx'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const requiredStyles = css({ color: 'var(--destructive)' })
const endStyles = css({ marginInlineStart: 'auto' })
const columnsStyles = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 10rem), 1fr))',
  gap: space(4),
})
const rowStyles = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: space(2), width: '100%' })
const growStyles = css({ flex: '1 1 12rem' })
const formStyles = css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(6), width: '100%' })
// Each FieldContent takes this itself: a rule on the group could lose to FieldContent's own.
const contentWidthStyles = css({ minWidth: 'min(100%, 12rem)' })

/** Labels, descriptions before or after the input, required, disabled and invalid inputs. */
export function FieldInputs() {
  return () => (
    <FieldGroup>
      <Field>
        <FieldLabel for="field-demo-basic">Company name</FieldLabel>
        <Input id="field-demo-basic" name="company" placeholder="Acme Labs" autocomplete="organization" />
      </Field>
      <Field>
        <FieldLabel for="field-demo-username">Username</FieldLabel>
        <Input id="field-demo-username" name="username" aria-describedby="field-demo-username-hint" />
        <FieldDescription id="field-demo-username-hint">Your teammates see it on shared invoices.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel for="field-demo-email">Email address</FieldLabel>
        <FieldDescription id="field-demo-email-hint">We never share your email.</FieldDescription>
        <Input
          id="field-demo-email"
          name="email"
          type="email"
          placeholder="ada@example.com"
          aria-describedby="field-demo-email-hint"
        />
      </Field>
      <Field>
        <FieldLabel for="field-demo-required">
          VAT number
          <span aria-hidden="true" mix={requiredStyles}>
            *
          </span>
        </FieldLabel>
        <Input id="field-demo-required" name="vat" required aria-describedby="field-demo-required-hint" />
        <FieldDescription id="field-demo-required-hint">Required for invoices to companies.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel for="field-demo-badge">
          Reference
          <Badge variant="secondary" mix={endStyles}>
            Recommended
          </Badge>
        </FieldLabel>
        <Input id="field-demo-badge" name="reference" placeholder="PO-1234" />
      </Field>
      <Field invalid>
        <FieldLabel for="field-demo-invalid">IBAN</FieldLabel>
        <Input
          id="field-demo-invalid"
          name="iban"
          defaultValue="CH93 0076"
          aria-invalid={true}
          aria-describedby="field-demo-invalid-error"
        />
        <FieldError id="field-demo-invalid-error" errors={[{ message: 'Enter all 21 characters of a Swiss IBAN.' }]} />
      </Field>
      <Field disabled>
        <FieldLabel for="field-demo-disabled">Workspace</FieldLabel>
        <Input
          id="field-demo-disabled"
          name="workspace"
          defaultValue="Acme Labs"
          disabled
          aria-describedby="field-demo-disabled-hint"
        />
        <FieldDescription id="field-demo-disabled-hint">Your administrator sets the workspace name.</FieldDescription>
      </Field>
    </FieldGroup>
  )
}

/** Textareas with a description before or after them, invalid and disabled. */
export function FieldTextareas() {
  return () => (
    <FieldGroup>
      <Field>
        <FieldLabel for="field-demo-comments">Comments</FieldLabel>
        <Textarea
          id="field-demo-comments"
          name="comments"
          placeholder="Share your thoughts…"
          maxLength={500}
          aria-describedby="field-demo-comments-hint"
        />
        <FieldDescription id="field-demo-comments-hint">Up to 500 characters.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel for="field-demo-bio">About your company</FieldLabel>
        <FieldDescription id="field-demo-bio-hint">A few sentences for your customers.</FieldDescription>
        <Textarea id="field-demo-bio" name="bio" rows={4} aria-describedby="field-demo-bio-hint" />
      </Field>
      <Field invalid>
        <FieldLabel for="field-demo-reason">Reason for the credit note</FieldLabel>
        <Textarea id="field-demo-reason" name="reason" aria-invalid={true} aria-describedby="field-demo-reason-error" />
        <FieldError id="field-demo-reason-error" errors={[{ message: 'Say why you credit this invoice.' }]} />
      </Field>
      <Field disabled>
        <FieldLabel for="field-demo-terms-text">Standard terms</FieldLabel>
        <Textarea id="field-demo-terms-text" name="terms" defaultValue="Payable within 30 days." disabled />
      </Field>
    </FieldGroup>
  )
}

/** Native selects with descriptions, option groups, an invalid and a disabled one. */
export function FieldNativeSelects() {
  return () => (
    <FieldGroup>
      <Field>
        <FieldLabel for="field-demo-country">Country</FieldLabel>
        <NativeSelect
          id="field-demo-country"
          name="country"
          autocomplete="country"
          aria-describedby="field-demo-country-hint"
        >
          <NativeSelectOption value="">Select your country</NativeSelectOption>
          <NativeSelectOption value="at">Austria</NativeSelectOption>
          <NativeSelectOption value="de">Germany</NativeSelectOption>
          <NativeSelectOption value="ch">Switzerland</NativeSelectOption>
        </NativeSelect>
        <FieldDescription id="field-demo-country-hint">Where the company is registered.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel for="field-demo-region">Sales region</FieldLabel>
        <NativeSelect id="field-demo-region" name="region" defaultValue="emea">
          <NativeSelectOptGroup label="Europe">
            <NativeSelectOption value="emea">Europe, Middle East and Africa</NativeSelectOption>
            <NativeSelectOption value="dach">Germany, Austria and Switzerland</NativeSelectOption>
          </NativeSelectOptGroup>
          <NativeSelectOptGroup label="Americas">
            <NativeSelectOption value="na">North America</NativeSelectOption>
            <NativeSelectOption value="latam">Latin America</NativeSelectOption>
          </NativeSelectOptGroup>
        </NativeSelect>
      </Field>
      <Field invalid>
        <FieldLabel for="field-demo-plan">Plan</FieldLabel>
        <NativeSelect
          id="field-demo-plan"
          name="plan"
          required
          aria-invalid={true}
          aria-describedby="field-demo-plan-error"
        >
          <NativeSelectOption value="">Select a plan</NativeSelectOption>
          <NativeSelectOption value="free">Free</NativeSelectOption>
          <NativeSelectOption value="pro">Pro</NativeSelectOption>
        </NativeSelect>
        <FieldError id="field-demo-plan-error" errors={[{ message: 'Choose a plan to continue.' }]} />
      </Field>
      <Field disabled>
        <FieldLabel for="field-demo-locale">Language</FieldLabel>
        <NativeSelect id="field-demo-locale" name="locale" defaultValue="en" disabled>
          <NativeSelectOption value="en">English</NativeSelectOption>
          <NativeSelectOption value="de">German</NativeSelectOption>
        </NativeSelect>
      </Field>
    </FieldGroup>
  )
}

/** Checkboxes: before or after their label, with a description, as a card, in a field set, invalid and disabled. */
export function FieldCheckboxes() {
  return () => (
    <FieldGroup>
      <Field orientation="horizontal">
        <Checkbox id="field-demo-agree" name="agree" defaultChecked />
        <FieldLabel for="field-demo-agree">I agree to the payment terms</FieldLabel>
      </Field>
      <Field orientation="horizontal">
        <FieldLabel for="field-demo-copy">Send me a copy</FieldLabel>
        <Checkbox id="field-demo-copy" name="copy" />
      </Field>
      <Field orientation="horizontal">
        <Checkbox id="field-demo-newsletter" name="newsletter" aria-describedby="field-demo-newsletter-hint" />
        <FieldContent>
          <FieldLabel for="field-demo-newsletter">Product updates</FieldLabel>
          <FieldDescription id="field-demo-newsletter-hint">One email a month about new features.</FieldDescription>
        </FieldContent>
      </Field>
      <FieldLabel for="field-demo-autopay">
        <Field orientation="horizontal">
          <Checkbox
            id="field-demo-autopay"
            name="autopay"
            aria-labelledby="field-demo-autopay-title"
            aria-describedby="field-demo-autopay-hint"
          />
          <FieldContent>
            <FieldTitle id="field-demo-autopay-title">Pay automatically</FieldTitle>
            <FieldDescription id="field-demo-autopay-hint">
              We charge the card on file on each due date.
            </FieldDescription>
          </FieldContent>
        </Field>
      </FieldLabel>
      <FieldSet>
        <FieldLegend variant="label">Reminders</FieldLegend>
        <FieldDescription>Choose when customers hear from you.</FieldDescription>
        <FieldGroup data-slot="checkbox-group">
          {[
            ['before', 'Three days before the due date'],
            ['due', 'On the due date'],
            ['after', 'A week after the due date'],
          ].map(([value, text]) => (
            <Field key={value} orientation="horizontal">
              <Checkbox id={`field-demo-reminder-${value}`} name="reminders" value={value} />
              <FieldLabel for={`field-demo-reminder-${value}`}>{text}</FieldLabel>
            </Field>
          ))}
        </FieldGroup>
      </FieldSet>
      <Field orientation="horizontal" invalid>
        <Checkbox
          id="field-demo-consent"
          name="consent"
          required
          aria-invalid="true"
          aria-describedby="field-demo-consent-error"
        />
        <FieldContent>
          <FieldLabel for="field-demo-consent">I may send invoices by email</FieldLabel>
          <FieldError id="field-demo-consent-error" errors={[{ message: 'Agree to receive invoices by email.' }]} />
        </FieldContent>
      </Field>
      <Field orientation="horizontal" disabled>
        <Checkbox id="field-demo-sms" name="sms" disabled />
        <FieldLabel for="field-demo-sms">Text message reminders</FieldLabel>
      </Field>
    </FieldGroup>
  )
}

const plans = [
  { value: 'free', title: 'Free', description: 'Ten invoices a month.' },
  { value: 'pro', title: 'Pro', description: 'Unlimited invoices and reminders.' },
]

/** Radio groups in field sets: a plain group, choice cards, an invalid and a disabled group. */
export function FieldRadios() {
  return () => (
    <FieldGroup>
      <FieldSet>
        <FieldLegend variant="label">Billing cycle</FieldLegend>
        <RadioGroup name="cycle" defaultValue="monthly">
          {['Monthly', 'Yearly'].map((cycle) => (
            <Field key={cycle} orientation="horizontal">
              <RadioGroupItem id={`field-demo-cycle-${cycle}`} value={cycle.toLowerCase()} />
              <FieldLabel for={`field-demo-cycle-${cycle}`}>{cycle}</FieldLabel>
            </Field>
          ))}
        </RadioGroup>
      </FieldSet>
      <FieldSet>
        <FieldLegend variant="label">Plan</FieldLegend>
        <FieldDescription>You can change it at any time.</FieldDescription>
        <RadioGroup name="plan-card" defaultValue="pro">
          {plans.map((plan) => (
            <FieldLabel key={plan.value} for={`field-demo-plan-${plan.value}`}>
              <Field orientation="horizontal">
                <RadioGroupItem
                  id={`field-demo-plan-${plan.value}`}
                  value={plan.value}
                  aria-labelledby={`field-demo-plan-${plan.value}-title`}
                  aria-describedby={`field-demo-plan-${plan.value}-hint`}
                />
                <FieldContent>
                  <FieldTitle id={`field-demo-plan-${plan.value}-title`}>{plan.title}</FieldTitle>
                  <FieldDescription id={`field-demo-plan-${plan.value}-hint`}>{plan.description}</FieldDescription>
                </FieldContent>
              </Field>
            </FieldLabel>
          ))}
        </RadioGroup>
      </FieldSet>
      <FieldSet aria-describedby="field-demo-delivery-error">
        <FieldLegend variant="label">Delivery</FieldLegend>
        <RadioGroup name="delivery" required>
          {['Email', 'Post'].map((way) => (
            <Field key={way} orientation="horizontal" invalid>
              <RadioGroupItem id={`field-demo-delivery-${way}`} value={way.toLowerCase()} aria-invalid="true" />
              <FieldLabel for={`field-demo-delivery-${way}`}>{way}</FieldLabel>
            </Field>
          ))}
        </RadioGroup>
        <FieldError id="field-demo-delivery-error" errors={[{ message: 'Choose how invoices reach the customer.' }]} />
      </FieldSet>
      <FieldSet>
        <FieldLegend variant="label">Archive</FieldLegend>
        <RadioGroup name="archive" defaultValue="year" disabled>
          {[
            ['year', 'After a year'],
            ['never', 'Never'],
          ].map(([value, text]) => (
            <Field key={value} orientation="horizontal" disabled>
              <RadioGroupItem id={`field-demo-archive-${value}`} value={value} />
              <FieldLabel for={`field-demo-archive-${value}`}>{text}</FieldLabel>
            </Field>
          ))}
        </RadioGroup>
      </FieldSet>
    </FieldGroup>
  )
}

/** Switches: after or before their text, in a field of their own, invalid and disabled. */
export function FieldSwitches() {
  return () => (
    <FieldGroup>
      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel for="field-demo-pause">Pause reminders</FieldLabel>
          <FieldDescription id="field-demo-pause-hint">
            No reminders go out until you turn them back on.
          </FieldDescription>
        </FieldContent>
        <Switch id="field-demo-pause" name="pause" aria-describedby="field-demo-pause-hint" />
      </Field>
      <Field orientation="horizontal">
        <FieldLabel for="field-demo-dark">Dark invoices</FieldLabel>
        <Switch id="field-demo-dark" name="dark" />
      </Field>
      <Field orientation="horizontal">
        <Switch id="field-demo-receipts" name="receipts" defaultChecked aria-describedby="field-demo-receipts-hint" />
        <FieldContent>
          <FieldLabel for="field-demo-receipts">Payment receipts</FieldLabel>
          <FieldDescription id="field-demo-receipts-hint">Email the customer when a payment arrives.</FieldDescription>
        </FieldContent>
      </Field>
      <Field aria-labelledby="field-demo-portal-title">
        <FieldTitle id="field-demo-portal-title">Customer portal</FieldTitle>
        <FieldDescription>What customers see when they sign in.</FieldDescription>
        <Field orientation="horizontal">
          <Switch id="field-demo-portal-history" name="history" defaultChecked />
          <FieldLabel for="field-demo-portal-history">Show past invoices</FieldLabel>
        </Field>
        <Field orientation="horizontal">
          <Switch id="field-demo-portal-notes" name="notes" />
          <FieldLabel for="field-demo-portal-notes">Show internal notes</FieldLabel>
        </Field>
      </Field>
      <Field orientation="horizontal" invalid>
        <FieldContent>
          <FieldLabel for="field-demo-autocharge">Charge automatically</FieldLabel>
          <FieldError id="field-demo-autocharge-error" errors={[{ message: 'Add a card before you turn this on.' }]} />
        </FieldContent>
        <Switch
          id="field-demo-autocharge"
          name="autocharge"
          defaultChecked
          aria-invalid="true"
          aria-describedby="field-demo-autocharge-error"
        />
      </Field>
      <Field orientation="horizontal" disabled>
        <FieldContent>
          <FieldLabel for="field-demo-sso">Single sign-on</FieldLabel>
          <FieldDescription id="field-demo-sso-hint">Available on the Pro plan.</FieldDescription>
        </FieldContent>
        <Switch id="field-demo-sso" name="sso" disabled aria-describedby="field-demo-sso-hint" />
      </Field>
    </FieldGroup>
  )
}

/** Sliders that their labels name, with a description, invalid and disabled. */
export function FieldSliders() {
  return () => (
    <FieldGroup>
      <Field>
        <FieldLabel for="field-demo-volume">Reminder volume</FieldLabel>
        <Slider id="field-demo-volume" name="volume" defaultValue={50} max={100} step={1} />
      </Field>
      <Field>
        <FieldLabel for="field-demo-quality">Scan quality</FieldLabel>
        <FieldDescription id="field-demo-quality-hint">Higher quality makes larger files.</FieldDescription>
        <Slider
          id="field-demo-quality"
          name="quality"
          aria-describedby="field-demo-quality-hint"
          defaultValue={300}
          min={150}
          max={600}
          step={150}
        />
      </Field>
      <Field disabled>
        <FieldLabel for="field-demo-limit">Credit limit</FieldLabel>
        <Slider id="field-demo-limit" name="limit" defaultValue={40} max={100} disabled />
      </Field>
    </FieldGroup>
  )
}

/** Labels and descriptions beside their controls. */
export function FieldHorizontal() {
  return () => (
    <FieldGroup>
      <Field orientation="horizontal">
        <FieldContent mix={contentWidthStyles}>
          <FieldLabel for="field-demo-h-username">Username</FieldLabel>
          <FieldDescription id="field-demo-h-username-hint">Your name on shared invoices.</FieldDescription>
        </FieldContent>
        <Input id="field-demo-h-username" name="username" aria-describedby="field-demo-h-username-hint" />
      </Field>
      <Field orientation="horizontal">
        <FieldContent mix={contentWidthStyles}>
          <FieldLabel for="field-demo-h-bio">Bio</FieldLabel>
          <FieldDescription id="field-demo-h-bio-hint">A short description of yourself.</FieldDescription>
        </FieldContent>
        <Textarea id="field-demo-h-bio" name="bio" aria-describedby="field-demo-h-bio-hint" />
      </Field>
      <Field orientation="horizontal">
        <FieldContent mix={contentWidthStyles}>
          <FieldLabel for="field-demo-h-notify">Email notifications</FieldLabel>
          <FieldDescription id="field-demo-h-notify-hint">Updates about your account.</FieldDescription>
        </FieldContent>
        <Switch id="field-demo-h-notify" name="notify" aria-describedby="field-demo-h-notify-hint" />
      </Field>
      <Field orientation="horizontal">
        <FieldContent mix={contentWidthStyles}>
          <FieldLabel for="field-demo-h-country">Country</FieldLabel>
          <FieldDescription id="field-demo-h-country-hint">Select your country.</FieldDescription>
        </FieldContent>
        <NativeSelect id="field-demo-h-country" name="country" aria-describedby="field-demo-h-country-hint">
          <NativeSelectOption value="">Select a country</NativeSelectOption>
          <NativeSelectOption value="at">Austria</NativeSelectOption>
          <NativeSelectOption value="ch">Switzerland</NativeSelectOption>
        </NativeSelect>
      </Field>
    </FieldGroup>
  )
}

/** Fields that stack in a narrow group and put their parts in a row from 28rem. */
export function FieldResponsive() {
  return () => (
    <FieldGroup>
      <Field orientation="responsive">
        <FieldContent>
          <FieldLabel for="field-demo-r-name">Display name</FieldLabel>
          <FieldDescription id="field-demo-r-name-hint">Shown on the invoice header.</FieldDescription>
        </FieldContent>
        <Input id="field-demo-r-name" name="display-name" aria-describedby="field-demo-r-name-hint" />
      </Field>
      <Field orientation="responsive">
        <FieldLabel for="field-demo-r-currency">Default currency</FieldLabel>
        <NativeSelect id="field-demo-r-currency" name="currency" defaultValue="CHF">
          <NativeSelectOption>CHF</NativeSelectOption>
          <NativeSelectOption>EUR</NativeSelectOption>
          <NativeSelectOption>USD</NativeSelectOption>
        </NativeSelect>
      </Field>
    </FieldGroup>
  )
}

/** A sign-in form whose separator text sits between two lines. */
export function FieldSignIn(handle: Handle<{ action: string }>) {
  return () => (
    <form action={handle.props.action} method="post" mix={formStyles}>
      <FieldGroup>
        <Field>
          <FieldLabel for="field-demo-sign-in-email">Email</FieldLabel>
          <Input id="field-demo-sign-in-email" name="email" type="email" autocomplete="username" required />
        </Field>
        <Field>
          <FieldLabel for="field-demo-sign-in-password">Password</FieldLabel>
          <Input
            id="field-demo-sign-in-password"
            name="password"
            type="password"
            autocomplete="current-password"
            minLength={8}
            required
          />
        </Field>
        <Button type="submit">Sign in</Button>
        <FieldSeparator>Or continue with</FieldSeparator>
        <Button type="submit" variant="outline" name="provider" value="sso" formNoValidate>
          Single sign-on
        </Button>
      </FieldGroup>
    </form>
  )
}

export interface FieldInvoiceFormProps {
  /** Where the form posts. */
  action: string
  /** The values the server received, so a refused form keeps them. */
  values?: Record<string, string>
  /** The errors the server found, by field name. */
  errors?: Record<string, FieldErrorEntry[]>
  /** An error about the whole operation, such as a refused save. It marks no field invalid. */
  formError?: string
}

const invoiceFields = ['customer', 'email', 'amount', 'currency', 'due', 'terms', 'note'] as const
type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

/**
 * An invoice form that validates on the server and in the browser. Without
 * JavaScript, the browser checks the required fields, types and limits, and
 * the server returns its own errors in the HTML. Once hydrated, the form
 * shows the browser's messages in FieldError instead of the browser's
 * bubbles, focuses the first invalid field, and clears an error as soon as
 * its field is fixed. A refused save shows as an alert for the whole form
 * and marks no field invalid. Internal reference sits outside the form and
 * joins it through its form attribute.
 */
export const FieldInvoiceForm = clientEntry(
  import.meta.url,
  function FieldInvoiceForm(handle: Handle<FieldInvoiceFormProps>) {
    let serverErrors = handle.props.errors
    let browserErrors: Record<string, string> = {}
    let edited = new Set<string>()
    let focusPending = false

    let errorsOf = (name: string): FieldErrorEntry[] => {
      if (browserErrors[name]) return [{ message: browserErrors[name] }]
      if (edited.has(name)) return []
      return handle.props.errors?.[name] ?? []
    }

    let focusFirstInvalid = (form: HTMLFormElement) => {
      let controls = [...form.elements] as FormControl[]
      controls.find((control) => control.willValidate && !control.validity.valid)?.focus()
    }

    let events = [
      on<HTMLFormElement, 'invalid'>(
        'invalid',
        (event) => {
          let control = event.target as FormControl
          // The message shows in the field's FieldError instead of the browser's bubble.
          event.preventDefault()
          browserErrors[control.name] = control.validationMessage
          if (!focusPending) {
            focusPending = true
            let form = event.currentTarget
            handle.queueTask(() => {
              focusPending = false
              focusFirstInvalid(form)
            })
          }
          void handle.update()
        },
        true,
      ),
      on<HTMLFormElement, 'input'>('input', (event) => {
        let control = event.target as FormControl
        if (!control.name) return
        edited.add(control.name)
        if (control.validity.valid) delete browserErrors[control.name]
        void handle.update()
      }),
      on<HTMLFormElement, 'reset'>('reset', () => {
        browserErrors = {}
        edited = new Set()
        void handle.update()
      }),
    ]

    return () => {
      let { action, values = {}, formError } = handle.props
      if (handle.props.errors !== serverErrors) {
        serverErrors = handle.props.errors
        browserErrors = {}
        edited = new Set()
      }

      let state = Object.fromEntries(
        invoiceFields.map((name) => {
          let errors = errorsOf(name)
          return [name, { errors, invalid: fieldErrorMessages(errors).length > 0 }]
        }),
      ) as Record<(typeof invoiceFields)[number], { errors: FieldErrorEntry[]; invalid: boolean }>
      // Without JavaScript, the browser focuses the first field the server rejected.
      let firstInvalid = invoiceFields.find((name) => fieldErrorMessages(handle.props.errors?.[name]).length > 0)
      let control = (name: (typeof invoiceFields)[number], hint?: string) => ({
        id: `invoice-${name}`,
        name,
        autofocus: name === firstInvalid ? true : undefined,
        'aria-invalid': state[name].invalid,
        'aria-describedby': describedBy(hint && `invoice-${name}-hint`, state[name].invalid && `invoice-${name}-error`),
      })

      return (
        <div mix={formStyles}>
          <form
            id="invoice-form"
            action={action}
            method="post"
            aria-labelledby="invoice-form-title"
            aria-describedby={formError ? 'invoice-form-error' : undefined}
            mix={[formStyles, ...events]}
          >
            {formError ? (
              <Alert variant="destructive" id="invoice-form-error">
                <CircleAlertIcon />
                <AlertTitle>The invoice wasn't created</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}
            <FieldSet>
              <FieldLegend id="invoice-form-title">New invoice</FieldLegend>
              <FieldDescription>Fields marked required must be filled in.</FieldDescription>
              <FieldGroup>
                <Field invalid={state.customer.invalid}>
                  <FieldLabel for="invoice-customer">Customer (required)</FieldLabel>
                  <Input {...control('customer')} defaultValue={values.customer} autocomplete="organization" required />
                  <FieldError id="invoice-customer-error" errors={state.customer.errors} />
                </Field>
                <Field invalid={state.email.invalid}>
                  <FieldLabel for="invoice-email">Billing email (required)</FieldLabel>
                  <Input
                    {...control('email', 'hint')}
                    type="email"
                    defaultValue={values.email}
                    autocomplete="email"
                    required
                  />
                  <FieldDescription id="invoice-email-hint">The invoice and its reminders go here.</FieldDescription>
                  <FieldError id="invoice-email-error" errors={state.email.errors} />
                </Field>
                <div mix={columnsStyles}>
                  <Field invalid={state.amount.invalid}>
                    <FieldLabel for="invoice-amount">Amount (required)</FieldLabel>
                    <Input
                      {...control('amount', 'hint')}
                      type="number"
                      inputMode="decimal"
                      min={1}
                      step={0.05}
                      defaultValue={values.amount}
                      required
                    />
                    <FieldDescription id="invoice-amount-hint">Up to 10,000 without approval.</FieldDescription>
                    <FieldError id="invoice-amount-error" errors={state.amount.errors} />
                  </Field>
                  <Field invalid={state.currency.invalid}>
                    <FieldLabel for="invoice-currency">Currency</FieldLabel>
                    <NativeSelect {...control('currency')} defaultValue={values.currency ?? 'CHF'}>
                      <NativeSelectOption>CHF</NativeSelectOption>
                      <NativeSelectOption>EUR</NativeSelectOption>
                      <NativeSelectOption>USD</NativeSelectOption>
                    </NativeSelect>
                    <FieldError id="invoice-currency-error" errors={state.currency.errors} />
                  </Field>
                </div>
                <div mix={columnsStyles}>
                  <Field invalid={state.due.invalid}>
                    <FieldLabel for="invoice-due">Due date (required)</FieldLabel>
                    <Input {...control('due')} type="date" min="2026-01-01" defaultValue={values.due} required />
                    <FieldError id="invoice-due-error" errors={state.due.errors} />
                  </Field>
                  <Field invalid={state.terms.invalid}>
                    <FieldLabel for="invoice-terms">Payment terms</FieldLabel>
                    <Input {...control('terms')} list="invoice-terms-list" defaultValue={values.terms ?? 'Net 30'} />
                    <datalist id="invoice-terms-list">
                      <option value="Due on receipt" />
                      <option value="Net 15" />
                      <option value="Net 30" />
                    </datalist>
                    <FieldError id="invoice-terms-error" errors={state.terms.errors} />
                  </Field>
                </div>
                <div mix={columnsStyles}>
                  <Field>
                    <FieldLabel for="invoice-number">Invoice number</FieldLabel>
                    <Input
                      id="invoice-number"
                      name="number"
                      defaultValue="INV-2026-0042"
                      readOnly
                      aria-describedby="invoice-number-hint"
                    />
                    <FieldDescription id="invoice-number-hint">Numbers are given out in order.</FieldDescription>
                  </Field>
                  <Field disabled>
                    <FieldLabel for="invoice-workspace">Workspace</FieldLabel>
                    <Input id="invoice-workspace" name="workspace" defaultValue="Acme Labs" disabled />
                  </Field>
                </div>
                <Field invalid={state.note.invalid}>
                  <FieldLabel for="invoice-note">Note</FieldLabel>
                  <Textarea {...control('note', 'hint')} maxLength={500} defaultValue={values.note} />
                  <FieldDescription id="invoice-note-hint">
                    Printed under the total. Up to 500 characters.
                  </FieldDescription>
                  <FieldError id="invoice-note-error" errors={state.note.errors} />
                </Field>
              </FieldGroup>
            </FieldSet>
            <div mix={rowStyles}>
              <Button type="submit">Create invoice</Button>
              <Button type="reset" variant="outline">
                Reset
              </Button>
            </div>
          </form>
          <Field>
            <FieldLabel for="invoice-reference">Internal reference</FieldLabel>
            <Input
              id="invoice-reference"
              name="reference"
              form="invoice-form"
              defaultValue={values.reference}
              aria-describedby="invoice-reference-hint"
            />
            <FieldDescription id="invoice-reference-hint">
              Outside the form, and sent with it through its form attribute.
            </FieldDescription>
          </Field>
        </div>
      )
    }
  },
)

interface Recipient {
  id: string
  error?: string
}

/**
 * Reminder recipients the user adds and removes. Each row keeps the id it
 * got when it was added, so labels, descriptions and errors never point at
 * another row, and an address the browser rejects shows its message until
 * it is fixed.
 */
export const FieldRecipients = clientEntry(
  import.meta.url,
  function FieldRecipients(handle: Handle<{ defaultEmails?: string[] }>) {
    let next = 0
    let emails = handle.props.defaultEmails ?? ['billing@acme.example']
    let rows: Recipient[] = emails.map(() => ({ id: `recipient-${++next}` }))
    let defaults = new Map(rows.map((row, index) => [row.id, emails[index]]))
    let addButton: HTMLButtonElement | undefined
    let inputs = new Map<string, HTMLInputElement>()

    let add = on<HTMLButtonElement, 'click'>('click', () => {
      let row = { id: `recipient-${++next}` }
      rows = [...rows, row]
      handle.queueTask(() => inputs.get(row.id)?.focus())
      void handle.update()
    })
    let remove = (id: string) =>
      on<HTMLButtonElement, 'click'>('click', () => {
        rows = rows.filter((row) => row.id !== id)
        inputs.delete(id)
        handle.queueTask(() => addButton?.focus())
        void handle.update()
      })
    let check = (id: string) => [
      ref<HTMLInputElement>((input) => void inputs.set(id, input)),
      on<HTMLInputElement, 'input'>('input', (event) => {
        let row = rows.find((candidate) => candidate.id === id)
        if (row?.error && event.currentTarget.validity.valid) {
          row.error = undefined
          void handle.update()
        }
      }),
      on<HTMLInputElement, 'change'>('change', (event) => {
        let row = rows.find((candidate) => candidate.id === id)
        if (!row) return
        row.error = event.currentTarget.validity.valid ? undefined : event.currentTarget.validationMessage
        void handle.update()
      }),
    ]

    return () => (
      <FieldSet>
        <FieldLegend variant="label">Reminder recipients</FieldLegend>
        <FieldDescription id="recipients-hint">Every address gets each payment reminder.</FieldDescription>
        <FieldGroup>
          {rows.map((row, index) => (
            <Field key={row.id} invalid={Boolean(row.error)}>
              <FieldLabel for={row.id}>Recipient {index + 1}</FieldLabel>
              <div mix={rowStyles}>
                <Input
                  id={row.id}
                  name="recipients"
                  type="email"
                  defaultValue={defaults.get(row.id)}
                  autocomplete="off"
                  aria-invalid={Boolean(row.error)}
                  aria-describedby={describedBy('recipients-hint', row.error ? `${row.id}-error` : false)}
                  mix={[growStyles, ...check(row.id)]}
                />
                <Button variant="outline" aria-label={`Remove recipient ${index + 1}`} mix={remove(row.id)}>
                  Remove
                </Button>
              </div>
              <FieldError id={`${row.id}-error`} errors={[{ message: row.error }]} />
            </Field>
          ))}
        </FieldGroup>
        <div>
          <Button variant="secondary" mix={[add, ref<HTMLButtonElement>((button) => void (addButton = button))]}>
            Add recipient
          </Button>
        </div>
      </FieldSet>
    )
  },
)
