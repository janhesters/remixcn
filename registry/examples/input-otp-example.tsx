// RemixCN Input OTP examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { Icon } from '#remixcn/lib/icons.tsx'
import type { IconProps } from '#remixcn/lib/icons.tsx'
import { Button } from '#remixcn/ui/button.tsx'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '#remixcn/ui/card.tsx'
import { Field, FieldDescription, FieldError, FieldLabel } from '#remixcn/ui/field.tsx'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
  onInputOTPChange,
  onInputOTPComplete,
  REGEXP_ONLY_DIGITS,
  REGEXP_ONLY_DIGITS_AND_CHARS,
} from '#remixcn/ui/input-otp.tsx'

// InputOTP runs in the browser inside a client entry, so every example is one.

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const formStyles = css({ width: '100%', margin: 0 })
const labelRowStyles = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: space(2),
})
const largeSlotStyles = css({ width: space(12), height: space(16), fontSize: 'var(--text-xl)' })
const wideSeparatorStyles = css({ marginInline: space(2) })
const footerStyles = css({ display: 'grid', gap: space(2), width: '100%' })
const fullStyles = css({ width: '100%' })
const mutedStyles = css({
  margin: 0,
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  '& a': { color: 'inherit', textUnderlineOffset: '4px' },
  '& a:hover': { color: 'var(--primary)' },
})
const rowStyles = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space(3) })

function RefreshIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4" />
    </Icon>
  )
}

/** Six slots with a separator between the halves. */
export const InputOTPSimple = clientEntry(import.meta.url, function InputOTPSimple() {
  return () => (
    <Field>
      <FieldLabel for="input-otp-demo-simple">Verification code</FieldLabel>
      <InputOTP id="input-otp-demo-simple" name="code" maxLength={6}>
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={3} />
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
        </InputOTPGroup>
      </InputOTP>
    </Field>
  )
})

/** Digits only: typed and pasted letters and dashes are dropped. */
export const InputOTPDigitsOnly = clientEntry(import.meta.url, function InputOTPDigitsOnly() {
  return () => (
    <Field>
      <FieldLabel for="input-otp-demo-digits">Digits only</FieldLabel>
      <InputOTP
        id="input-otp-demo-digits"
        maxLength={6}
        pattern={REGEXP_ONLY_DIGITS}
        placeholder="○○○○○○"
        aria-describedby="input-otp-demo-digits-hint"
      >
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
          <InputOTPSlot index={3} />
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
        </InputOTPGroup>
      </InputOTP>
      <FieldDescription id="input-otp-demo-digits-hint">Paste 123-456 and the dash stays out.</FieldDescription>
    </Field>
  )
})

/** Three pairs, starting with a code. */
export const InputOTPWithSeparator = clientEntry(import.meta.url, function InputOTPWithSeparator() {
  return () => (
    <Field>
      <FieldLabel for="input-otp-demo-pairs">Backup code</FieldLabel>
      <InputOTP id="input-otp-demo-pairs" maxLength={6} defaultValue="123456">
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={2} />
          <InputOTPSlot index={3} />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
        </InputOTPGroup>
      </InputOTP>
    </Field>
  )
})

/** Letters and digits, with a keyboard for text. */
export const InputOTPAlphanumeric = clientEntry(import.meta.url, function InputOTPAlphanumeric() {
  return () => (
    <Field>
      <FieldLabel for="input-otp-demo-alphanumeric">Recovery key</FieldLabel>
      <FieldDescription id="input-otp-demo-alphanumeric-hint">Letters and numbers.</FieldDescription>
      <InputOTP
        id="input-otp-demo-alphanumeric"
        maxLength={6}
        pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
        autocapitalize="characters"
        aria-describedby="input-otp-demo-alphanumeric-hint"
      >
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={3} />
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
        </InputOTPGroup>
      </InputOTP>
    </Field>
  )
})

/** A disabled code dims, is skipped by the keyboard and sends nothing. */
export const InputOTPDisabled = clientEntry(import.meta.url, function InputOTPDisabled() {
  return () => (
    <Field disabled>
      <FieldLabel for="input-otp-demo-disabled">Code (expired)</FieldLabel>
      <InputOTP id="input-otp-demo-disabled" name="expired" maxLength={6} defaultValue="123456" disabled>
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={3} />
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
        </InputOTPGroup>
      </InputOTP>
    </Field>
  )
})

/** A four-digit PIN. */
export const InputOTPFourDigits = clientEntry(import.meta.url, function InputOTPFourDigits() {
  return () => (
    <Field>
      <FieldLabel for="input-otp-demo-pin">Card PIN</FieldLabel>
      <FieldDescription id="input-otp-demo-pin-hint">The usual length for a PIN.</FieldDescription>
      <InputOTP
        id="input-otp-demo-pin"
        maxLength={4}
        pattern={REGEXP_ONLY_DIGITS}
        aria-describedby="input-otp-demo-pin-hint"
      >
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
          <InputOTPSlot index={3} />
        </InputOTPGroup>
      </InputOTP>
    </Field>
  )
})

/** A masked PIN shows dots and keeps the digits in a password input. */
export const InputOTPMasked = clientEntry(import.meta.url, function InputOTPMasked() {
  return () => (
    <Field>
      <FieldLabel for="input-otp-demo-masked">Approval PIN</FieldLabel>
      <InputOTP id="input-otp-demo-masked" maxLength={4} pattern={REGEXP_ONLY_DIGITS} mask autocomplete="off">
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
          <InputOTPSlot index={3} />
        </InputOTPGroup>
      </InputOTP>
    </Field>
  )
})

/** An invalid code tells assistive technology and names its error. */
export const InputOTPInvalid = clientEntry(import.meta.url, function InputOTPInvalid() {
  return () => (
    <Field invalid>
      <FieldLabel for="input-otp-demo-invalid">Verification code</FieldLabel>
      <FieldDescription id="input-otp-demo-invalid-hint">The code from your authenticator app.</FieldDescription>
      <InputOTP
        id="input-otp-demo-invalid"
        maxLength={6}
        defaultValue="000000"
        aria-invalid={true}
        aria-describedby="input-otp-demo-invalid-hint input-otp-demo-invalid-error"
      >
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={2} />
          <InputOTPSlot index={3} />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
        </InputOTPGroup>
      </InputOTP>
      <FieldError id="input-otp-demo-invalid-error" errors={[{ message: 'That code is not valid. Try again.' }]} />
    </Field>
  )
})

/** The owner keeps the code and shows it; Clear empties it from outside. */
export const InputOTPControlled = clientEntry(import.meta.url, function InputOTPControlled(handle: Handle) {
  let value = ''

  return () => (
    <Field>
      <FieldLabel for="input-otp-demo-controlled">One-time password</FieldLabel>
      <div mix={rowStyles}>
        <InputOTP
          id="input-otp-demo-controlled"
          maxLength={6}
          value={value}
          aria-describedby="input-otp-demo-controlled-status"
          mix={onInputOTPChange((event) => {
            value = event.value
            void handle.update()
          })}
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
        <Button
          variant="outline"
          size="sm"
          disabled={value === ''}
          mix={on('click', () => {
            value = ''
            void handle.update()
          })}
        >
          Clear
        </Button>
      </div>
      <FieldDescription id="input-otp-demo-controlled-status">
        {value === '' ? 'Enter your one-time password.' : `You entered: ${value}`}
      </FieldDescription>
    </Field>
  )
})

export interface InputOTPFormProps {
  /** Where the form sends the code. */
  action: string
}

/**
 * Verifies a sign-in. The form sends itself once the code is complete,
 * Verify sends it by hand, and the browser checks that all six digits are there.
 */
export const InputOTPForm = clientEntry(import.meta.url, function InputOTPForm(handle: Handle<InputOTPFormProps>) {
  let resent = 0

  return () => (
    <Card>
      <CardHeader>
        <CardTitle level={3}>Verify your sign-in</CardTitle>
        <CardDescription>
          Enter the code we sent to <strong>ada@acme.example</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form id="input-otp-demo-form" action={handle.props.action} method="post" mix={formStyles}>
          <Field>
            <div mix={labelRowStyles}>
              <FieldLabel for="input-otp-demo-form-code">Verification code</FieldLabel>
              <Button
                variant="outline"
                size="xs"
                mix={on('click', () => {
                  resent++
                  void handle.update()
                })}
              >
                <RefreshIcon data-icon="inline-start" />
                Resend code
              </Button>
            </div>
            <InputOTP
              id="input-otp-demo-form-code"
              name="code"
              maxLength={6}
              minLength={6}
              pattern={REGEXP_ONLY_DIGITS}
              required
              aria-describedby="input-otp-demo-form-hint"
              mix={onInputOTPComplete((event) => event.currentTarget.form?.requestSubmit())}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} mix={largeSlotStyles} />
                <InputOTPSlot index={1} mix={largeSlotStyles} />
                <InputOTPSlot index={2} mix={largeSlotStyles} />
              </InputOTPGroup>
              <InputOTPSeparator mix={wideSeparatorStyles} />
              <InputOTPGroup>
                <InputOTPSlot index={3} mix={largeSlotStyles} />
                <InputOTPSlot index={4} mix={largeSlotStyles} />
                <InputOTPSlot index={5} mix={largeSlotStyles} />
              </InputOTPGroup>
            </InputOTP>
            <FieldDescription id="input-otp-demo-form-hint">
              {resent === 0 ? 'The code works for ten minutes.' : 'We sent a new code. The old one no longer works.'}
            </FieldDescription>
          </Field>
        </form>
      </CardContent>
      <CardFooter>
        <div mix={footerStyles}>
          <Button type="submit" form="input-otp-demo-form" mix={fullStyles}>
            Verify
          </Button>
          <p mix={mutedStyles}>
            Having trouble signing in? <a href="#input-otp-demo-form">Contact support</a>.
          </p>
        </div>
      </CardFooter>
    </Card>
  )
})
