// Client entries of the Input Group and Input OTP fixture page: the theme
// panels, right-to-left text and the overrides compose the components with
// ids of their own, and hydrate, so their codes run. The registry examples
// use fixed ids, so the page can't show them twice.
import { clientEntry, css } from 'remix/component'
import type { Handle } from 'remix/component'

import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '#remixcn/ui/field.tsx'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from '#remixcn/ui/input-group.tsx'
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot, REGEXP_ONLY_DIGITS } from '#remixcn/ui/input-otp.tsx'
import { Spinner } from '#remixcn/ui/spinner.tsx'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const panelStyles = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: space(5),
  alignContent: 'start',
  padding: space(6),
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  '& > h3': { margin: 0, fontSize: 'var(--text-base)', fontWeight: 600 },
  '@media (max-width: 40rem)': { padding: space(4) },
})
const narrowStyles = css({ maxWidth: '16rem' })
// The count takes the free room, so the button ends the line.
const fillStyles = css({ flexGrow: 1 })

// Renders a run of slots from a component of its own, as an app may, so the
// page's reflow test covers slots a group doesn't hold directly.
function SlotRun(handle: Handle<{ from: number; count: number }>) {
  return () => (
    <>
      {Array.from({ length: handle.props.count }, (_, offset) => (
        <InputOTPSlot key={offset} index={handle.props.from + offset} />
      ))}
    </>
  )
}

function SixDigits() {
  return () => (
    <>
      <InputOTPGroup>
        <SlotRun from={0} count={3} />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <SlotRun from={3} count={3} />
      </InputOTPGroup>
    </>
  )
}

/** The same parts in one theme, with ids of their own. */
export const ThemePanel = clientEntry(
  import.meta.url,
  function ThemePanel(handle: Handle<{ theme: 'light' | 'dark' }>) {
    return () => {
      let { theme } = handle.props
      let id = (name: string) => `${theme}-${name}`

      return (
        <div data-theme={theme} data-panel={theme} mix={panelStyles}>
          <h3>{theme === 'light' ? 'Light' : 'Dark'}</h3>
          <FieldGroup>
            <Field>
              <FieldLabel for={id('website')}>Website</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <InputGroupText>https://</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput id={id('website')} placeholder="acme.example" />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton variant="secondary">Check</InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </Field>
            <Field invalid>
              <FieldLabel for={id('amount')}>Amount</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id={id('amount')}
                  defaultValue="-20"
                  aria-invalid={true}
                  aria-describedby={id('amount-error')}
                />
                <InputGroupAddon>
                  <InputGroupText>CHF</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
              <FieldError id={id('amount-error')} errors={[{ message: 'Enter an amount above zero.' }]} />
            </Field>
            <Field>
              <FieldLabel for={id('note')}>Note</FieldLabel>
              <InputGroup>
                <InputGroupTextarea id={id('note')} placeholder="Thanks for your order." />
                <InputGroupAddon align="block-end">
                  <InputGroupText mix={fillStyles}>0/280</InputGroupText>
                  <InputGroupButton variant="default" size="sm">
                    Send
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </Field>
            <Field disabled>
              <FieldLabel for={id('loading')}>Company</FieldLabel>
              <InputGroup data-disabled="true">
                <InputGroupInput id={id('loading')} defaultValue="Acme Labs" disabled />
                <InputGroupAddon align="inline-end">
                  <Spinner label="Checking" />
                </InputGroupAddon>
              </InputGroup>
            </Field>
            <Field>
              <FieldLabel for={id('code')}>Verification code</FieldLabel>
              <InputOTP id={id('code')} maxLength={6} defaultValue="0427" pattern={REGEXP_ONLY_DIGITS}>
                <SixDigits />
              </InputOTP>
            </Field>
            <Field invalid>
              <FieldLabel for={id('code-invalid')}>Expired code</FieldLabel>
              <InputOTP
                id={id('code-invalid')}
                maxLength={6}
                defaultValue="000000"
                aria-invalid={true}
                aria-describedby={id('code-invalid-error')}
              >
                <SixDigits />
              </InputOTP>
              <FieldError id={id('code-invalid-error')} errors={[{ message: 'That code expired.' }]} />
            </Field>
            <Field disabled>
              <FieldLabel for={id('code-disabled')}>Used code</FieldLabel>
              <InputOTP id={id('code-disabled')} maxLength={6} defaultValue="123456" disabled>
                <SixDigits />
              </InputOTP>
            </Field>
          </FieldGroup>
        </div>
      )
    }
  },
)

/** Arabic labels: addons and slots follow the text direction. */
export const RightToLeft = clientEntry(import.meta.url, function RightToLeft() {
  return () => (
    <div dir="rtl" lang="ar" mix={panelStyles}>
      <h3>حقول</h3>
      <FieldGroup>
        <Field>
          <FieldLabel for="rtl-search">بحث</FieldLabel>
          <InputGroup>
            <InputGroupInput id="rtl-search" placeholder="بحث..." />
            <InputGroupAddon>
              <InputGroupText>الفواتير</InputGroupText>
            </InputGroupAddon>
            <InputGroupAddon align="inline-end">١٢ نتيجة</InputGroupAddon>
          </InputGroup>
        </Field>
        <Field>
          <FieldLabel for="rtl-comment">تعليق</FieldLabel>
          <InputGroup>
            <InputGroupTextarea id="rtl-comment" placeholder="اكتب تعليقًا..." />
            <InputGroupAddon align="block-end">
              <InputGroupText mix={fillStyles}>٠/٢٨٠</InputGroupText>
              <InputGroupButton variant="default" size="sm">
                نشر
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </Field>
        <Field>
          <FieldLabel for="rtl-code">رمز التحقق</FieldLabel>
          <InputOTP id="rtl-code" maxLength={6} defaultValue="123" pattern={REGEXP_ONLY_DIGITS}>
            <SixDigits />
          </InputOTP>
        </Field>
      </FieldGroup>
    </div>
  )
})

/** Tokens in @layer app, a class on the box around the slots, and a narrow container. */
export const Overrides = clientEntry(import.meta.url, function Overrides() {
  return () => (
    <div mix={panelStyles}>
      <h3>Overrides</h3>
      <FieldGroup class="brand">
        <Field>
          <FieldLabel for="override-brand-search">Brand ring</FieldLabel>
          <InputGroup>
            <InputGroupInput id="override-brand-search" placeholder="--ring in @layer app" />
            <InputGroupAddon align="inline-end">
              <InputGroupButton variant="default">Go</InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </Field>
        <Field>
          <FieldLabel for="override-brand-code">Centered code</FieldLabel>
          <InputOTP id="override-brand-code" maxLength={6} containerClass="centered">
            <SixDigits />
          </InputOTP>
        </Field>
      </FieldGroup>
      <div mix={narrowStyles}>
        <Field>
          <FieldLabel for="override-narrow">accounts-receivable@example.com</FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <InputGroupText>Forward to</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput id="override-narrow" aria-describedby="override-narrow-hint" />
            <InputGroupAddon align="inline-end">
              <InputGroupButton variant="secondary">Verify</InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <FieldDescription id="override-narrow-hint">The parts wrap inside 16rem.</FieldDescription>
        </Field>
      </div>
    </div>
  )
})
