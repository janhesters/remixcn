// RemixCN Button examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { Icon } from '#remixcn/lib/icons.tsx'
import type { IconProps } from '#remixcn/lib/icons.tsx'
import { mirrorInRtl } from '#remixcn/lib/styles.ts'
import { Button, buttonSizes, buttonVariantNames, buttonVariants } from '#remixcn/ui/button.tsx'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const rowStyles = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space(2) })
const stackStyles = css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(4) })
const hintStyles = css({
  margin: 0,
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
})

export function ArrowRightIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M4.5 12h15M13 5.5l6.5 6.5-6.5 6.5" />
    </Icon>
  )
}

export function PlusIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M12 4.5v15M4.5 12h15" />
    </Icon>
  )
}

export function TrashIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M4 6.5h16M9.5 6.5V4h5v2.5M6.5 6.5l1 13.5h9l1-13.5M10 10.5v6M14 10.5v6" />
    </Icon>
  )
}

export function SaveIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M5 4h11.5L20 7.5V20H4V4Z" />
      <path d="M8 4v5h7V4M8 20v-6.5h8V20" />
    </Icon>
  )
}

/** An open ring that the loading example turns. */
export function LoaderIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M12 3a9 9 0 1 0 9 9" />
    </Icon>
  )
}

/** Every variant at every text size. */
export function ButtonVariantsAndSizes() {
  return () => (
    <div mix={stackStyles}>
      {(['xs', 'sm', 'default', 'lg'] as const).map((size) => (
        <div key={size} mix={rowStyles}>
          {buttonVariantNames.map((variant) => (
            <Button key={variant} size={size} variant={variant}>
              {variant === 'default' ? 'Send' : variant[0].toUpperCase() + variant.slice(1)}
            </Button>
          ))}
        </div>
      ))}
    </div>
  )
}

// Mirrors the arrow in right-to-left text, where onward points left.
const onwardStyles = css({ '& svg': mirrorInRtl })

/** Icons before or after the label. data-icon tightens the padding on that side. */
export function ButtonWithIcons() {
  return () => (
    <div mix={rowStyles}>
      <Button variant="outline">
        <PlusIcon data-icon="inline-start" />
        New invoice
      </Button>
      <Button mix={onwardStyles}>
        Continue
        <ArrowRightIcon data-icon="inline-end" />
      </Button>
      <Button variant="destructive" size="sm">
        <TrashIcon data-icon="inline-start" />
        Delete draft
      </Button>
    </div>
  )
}

/** Icon sizes. An icon-only button names its action with aria-label. */
export function ButtonIconOnly() {
  let sizes = buttonSizes.filter((size) => size.startsWith('icon'))

  return () => (
    <div mix={rowStyles}>
      {sizes.map((size) => (
        <Button key={size} size={size} variant="outline" aria-label="Add a line item">
          <PlusIcon />
        </Button>
      ))}
      <Button size="icon" variant="destructive" aria-label="Delete invoice INV-0042">
        <TrashIcon />
      </Button>
      <Button size="icon" aria-label="Continue to payment" mix={onwardStyles}>
        <ArrowRightIcon />
      </Button>
    </div>
  )
}

/** Links that look like buttons keep their link role and navigate natively, also without JavaScript. */
export function ButtonAsLink() {
  return () => (
    <div mix={rowStyles}>
      <a href="#invoices" mix={buttonVariants()}>
        View invoices
      </a>
      <a href="#reminders" mix={buttonVariants({ variant: 'outline' })}>
        Reminders
      </a>
      <a href="#terms" mix={buttonVariants({ variant: 'link' })}>
        Payment terms
      </a>
    </div>
  )
}

/** aria-invalid marks a button in red, for example one that confirms a form with errors. */
export function ButtonInvalid() {
  return () => (
    <div mix={rowStyles}>
      {buttonVariantNames.map((variant) => (
        <Button key={variant} variant={variant} aria-invalid="true">
          {variant[0].toUpperCase() + variant.slice(1)}
        </Button>
      ))}
    </div>
  )
}

/** A disabled button says why in text next to it. */
export function ButtonDisabled(handle: Handle) {
  return () => {
    let reason = `${handle.id}-reason`

    return (
      <div mix={stackStyles}>
        <div mix={rowStyles}>
          <Button disabled aria-describedby={reason}>
            Send
          </Button>
          <Button variant="outline" disabled aria-describedby={reason}>
            Schedule
          </Button>
          <Button variant="destructive" disabled aria-describedby={reason}>
            Delete
          </Button>
        </div>
        <p id={reason} mix={hintStyles}>
          Paid invoices can't be sent, scheduled or deleted.
        </p>
      </div>
    )
  }
}

const fieldStyles = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: space(1.5),
  maxWidth: '24rem',
  '& label': { fontSize: 'var(--text-sm)', lineHeight: 'var(--text-sm--line-height)', fontWeight: 500 },
})
const inputStyles = css({
  minHeight: space(9),
  paddingInline: space(2.5),
  border: '1px solid var(--input)',
  borderRadius: 'var(--radius-md)',
  backgroundColor: 'transparent',
})

export interface ButtonFormProps {
  /** Where Send and Schedule post the form. */
  action: string
  /** Where Save draft posts it instead, without validation. */
  draftAction: string
}

/**
 * Submit, reset and action buttons in one form. Send and Schedule submit their
 * name and value, Save draft overrides the action and skips validation, Preview
 * runs JavaScript without submitting, and Reset restores the defaults.
 */
export const ButtonForm = clientEntry(import.meta.url, function ButtonForm(handle: Handle<ButtonFormProps>) {
  let previews = 0

  return () => {
    let { action, draftAction } = handle.props
    let email = `${handle.id}-email`

    return (
      <form action={action} method="post" mix={stackStyles}>
        <div mix={fieldStyles}>
          <label for={email}>Billing email</label>
          <input id={email} name="email" type="email" required defaultValue="billing@acme.example" mix={inputStyles} />
        </div>
        <div mix={rowStyles}>
          <Button type="submit" name="intent" value="send" mix={onwardStyles}>
            Send reminder
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
          <Button type="submit" name="intent" value="schedule" variant="outline">
            Schedule
          </Button>
          <Button type="submit" variant="secondary" formAction={draftAction} formNoValidate>
            Save draft
          </Button>
          <Button
            variant="ghost"
            mix={on('click', () => {
              previews++
              void handle.update()
            })}
          >
            Preview
          </Button>
          <Button type="reset" variant="ghost">
            Reset
          </Button>
        </div>
        <p role="status" mix={hintStyles}>
          {previews === 0 ? '' : `Preview opened ${previews === 1 ? 'once' : `${previews} times`}. Nothing was sent.`}
        </p>
      </form>
    )
  }
})

const spinStyles = css({
  display: 'inline-flex',
  animation: 'remixcn-button-spin 1s linear infinite',
  '@keyframes remixcn-button-spin': { to: { transform: 'rotate(360deg)' } },
  // Reduced motion keeps the ring still; the label still says it's saving.
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
})

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    let timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })
}

/**
 * A loading state that keeps focus: focusableWhenDisabled leaves the button
 * focusable while it saves and cancels further clicks. The changing label
 * names the button through aria-labelledby, and a status says when it's done.
 */
export const ButtonLoading = clientEntry(
  import.meta.url,
  function ButtonLoading(handle: Handle<{ duration?: number }>) {
    let saving = false
    let saved = false

    return () => {
      let label = `${handle.id}-label`

      return (
        <div mix={rowStyles}>
          <Button
            variant="outline"
            disabled={saving}
            focusableWhenDisabled
            aria-labelledby={label}
            mix={on('click', async (_event, signal) => {
              saving = true
              saved = false
              await handle.update()
              await wait(handle.props.duration ?? 2000, signal)
              if (signal.aborted) return
              saving = false
              saved = true
              void handle.update()
            })}
          >
            {saving ? (
              <span mix={spinStyles} data-icon="inline-start">
                <LoaderIcon />
              </span>
            ) : (
              <SaveIcon data-icon="inline-start" />
            )}
            <span id={label}>{saving ? 'Saving template…' : 'Save template'}</span>
          </Button>
          <p role="status" mix={hintStyles}>
            {saved ? 'Template saved.' : ''}
          </p>
        </div>
      )
    }
  },
)

const pillStyles = css({ borderRadius: '999px', paddingInline: space(4) })
const brandStyles = css({
  display: 'contents',
  '--primary': 'light-dark(oklch(0.488 0.217 264.4), oklch(0.809 0.105 251.8))',
  '--primary-foreground': 'light-dark(oklch(0.985 0 0), oklch(0.205 0 0))',
})

/**
 * Overrides without editing the component: a css() passed with mix renders
 * after the button's own rule, so it wins, and a token set on an ancestor
 * reaches every button inside. data-variant and data-size let an app rule in
 * @layer app target one variant.
 */
export function ButtonOverrides() {
  return () => (
    <div mix={rowStyles}>
      <Button mix={pillStyles} data-override="mix">
        Pill
      </Button>
      <span mix={brandStyles} data-override="token">
        <Button>Brand color</Button>
        <a href="#brand" mix={buttonVariants({ variant: 'link' })}>
          Brand link
        </a>
      </span>
    </div>
  )
}
