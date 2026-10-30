// RemixCN Input Group examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { CheckIcon, CopyIcon, Icon, SearchIcon, XIcon } from '#remixcn/lib/icons.tsx'
import type { IconProps } from '#remixcn/lib/icons.tsx'
import { Button } from '#remixcn/ui/button.tsx'
import { ButtonGroup, ButtonGroupText } from '#remixcn/ui/button-group.tsx'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '#remixcn/ui/card.tsx'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '#remixcn/ui/field.tsx'
import { Input } from '#remixcn/ui/input.tsx'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from '#remixcn/ui/input-group.tsx'
import { Kbd, KbdGroup } from '#remixcn/ui/kbd.tsx'
import { Spinner } from '#remixcn/ui/spinner.tsx'
import { Textarea } from '#remixcn/ui/textarea.tsx'

// Every example is a client entry, so a press on an addon focuses its control.

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const formStyles = css({ width: '100%', margin: 0 })
const columnsStyles = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 10rem), 1fr))',
  gap: space(4),
})
// The text before a button takes the free room, so the button ends the line. A margin on the button
// would lose to the button's own margin: 0, whose rule may render first.
const fillStyles = css({ flexGrow: 1 })
const addonEndStyles = css({ justifyContent: 'flex-end' })
const roundStyles = css({ borderRadius: '9999px' })
const monoStyles = css({ fontFamily: 'var(--font-mono)', fontWeight: 500 })
const codeStyles = css({ minHeight: '12rem', paddingBlock: space(3), fontFamily: 'var(--font-mono)' })
const tallStyles = css({ minHeight: '6.25rem' })
const ruleBelowStyles = css({ borderBlockEnd: '1px solid var(--border)', paddingBlockEnd: space(2) })
const ruleAboveStyles = css({ borderBlockStart: '1px solid var(--border)', paddingBlockStart: space(2) })
const availableStyles = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '1rem',
  height: '1rem',
  borderRadius: '9999px',
  // A border, not only a fill, keeps the mark in forced colors.
  border: '1px solid currentColor',
  color: 'light-dark(oklch(0.45 0.13 150), oklch(0.8 0.15 150))',
  '& svg': { width: '0.75rem', height: '0.75rem' },
})
const availableTextStyles = css({ color: 'light-dark(oklch(0.45 0.13 150), oklch(0.8 0.15 150))' })
const visuallyHiddenStyles = css({
  position: 'absolute',
  width: '1px',
  height: '1px',
  margin: '-1px',
  padding: 0,
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  border: 0,
})
const currencyStyles = css({
  flex: '0 0 auto',
  minHeight: `calc(${space(9)} - 2px)`,
  margin: 0,
  paddingInline: space(2),
  border: 0,
  borderInlineEnd: '1px solid var(--input)',
  backgroundColor: 'transparent',
  color: 'inherit',
  font: 'inherit',
  fontSize: 'var(--text-sm)',
  '&:focus-visible': { outline: 'none' },
})

// Icons drawn for these examples, on the 24 by 24 grid of icons.tsx.

function InfoIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16.5V11M12 7.5h.01" />
    </Icon>
  )
}

function MailIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
    </Icon>
  )
}

function LinkIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </Icon>
  )
}

function ArrowUpIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M12 19.5v-15M5.5 11 12 4.5l6.5 6.5" />
    </Icon>
  )
}

function TrashIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 12.5h9l1-12.5" />
    </Icon>
  )
}

function CodeIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="m8 7-5 5 5 5M16 7l5 5-5 5" />
    </Icon>
  )
}

/** A plain input beside input groups, and a group that is disabled or invalid. */
export const InputGroupBasic = clientEntry(import.meta.url, function InputGroupBasic() {
  return () => (
    <FieldGroup>
      <Field>
        <FieldLabel for="input-group-demo-plain">Customer (plain input)</FieldLabel>
        <Input id="input-group-demo-plain" placeholder="Acme Labs" />
      </Field>
      <Field>
        <FieldLabel for="input-group-demo-group">Customer (input group)</FieldLabel>
        <InputGroup>
          <InputGroupInput id="input-group-demo-group" placeholder="Acme Labs" />
        </InputGroup>
      </Field>
      <Field disabled>
        <FieldLabel for="input-group-demo-disabled">Workspace</FieldLabel>
        <InputGroup>
          <InputGroupInput id="input-group-demo-disabled" defaultValue="Acme Labs" disabled />
          <InputGroupAddon align="inline-end">
            <InputGroupText>Locked</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      </Field>
      <Field invalid>
        <FieldLabel for="input-group-demo-invalid">VAT number</FieldLabel>
        <InputGroup>
          <InputGroupInput
            id="input-group-demo-invalid"
            defaultValue="123.456"
            aria-invalid={true}
            aria-describedby="input-group-demo-invalid-error"
          />
          <InputGroupAddon>
            <InputGroupText>CHE-</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
        <FieldError
          id="input-group-demo-invalid-error"
          errors={[{ message: 'Enter all nine digits, such as 123.456.789.' }]}
        />
      </Field>
    </FieldGroup>
  )
})

/** Icons and text at the start, at the end, above and below the input. */
export const InputGroupWithAddons = clientEntry(import.meta.url, function InputGroupWithAddons() {
  return () => (
    <FieldGroup>
      <Field>
        <FieldLabel for="input-group-demo-search">Search invoices</FieldLabel>
        <InputGroup>
          <InputGroupInput id="input-group-demo-search" type="search" placeholder="Number or customer" />
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
        </InputGroup>
      </Field>
      <Field>
        <FieldLabel for="input-group-demo-email">Billing email</FieldLabel>
        <InputGroup>
          <InputGroupInput id="input-group-demo-email" type="email" placeholder="billing@acme.example" />
          <InputGroupAddon align="inline-end">
            <MailIcon />
          </InputGroupAddon>
        </InputGroup>
      </Field>
      <Field>
        <FieldLabel for="input-group-demo-amount">Amount</FieldLabel>
        <InputGroup>
          <InputGroupInput id="input-group-demo-amount" inputMode="decimal" placeholder="0.00" />
          <InputGroupAddon>
            <InputGroupText>CHF</InputGroupText>
          </InputGroupAddon>
          <InputGroupAddon align="inline-end">
            <InputGroupText>incl. VAT</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      </Field>
      <Field>
        <FieldLabel for="input-group-demo-reference">Reference (block-start)</FieldLabel>
        <InputGroup>
          <InputGroupInput id="input-group-demo-reference" placeholder="PO-2026-118" />
          <InputGroupAddon align="block-start">
            <InputGroupText>Purchase order</InputGroupText>
            <InfoIcon />
          </InputGroupAddon>
        </InputGroup>
      </Field>
      <Field>
        <FieldLabel for="input-group-demo-memo">Memo (block-end)</FieldLabel>
        <InputGroup>
          <InputGroupInput id="input-group-demo-memo" placeholder="Shown on the invoice" />
          <InputGroupAddon align="block-end">
            <InputGroupText>Up to 80 characters</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      </Field>
      <Field>
        <FieldLabel for="input-group-demo-iban">IBAN</FieldLabel>
        <InputGroup>
          <InputGroupInput
            id="input-group-demo-iban"
            placeholder="CH93 0076 2011 6238 5295 7"
            aria-describedby="input-group-demo-iban-hint"
          />
          <InputGroupAddon align="inline-end">
            <InfoIcon />
          </InputGroupAddon>
        </InputGroup>
        <FieldDescription id="input-group-demo-iban-hint">We pay refunds to this account.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel for="input-group-demo-label">Label inside the group</FieldLabel>
        <InputGroup>
          <InputGroupAddon>
            <FieldLabel for="input-group-demo-label">Ref.</FieldLabel>
          </InputGroupAddon>
          <InputGroupInput id="input-group-demo-label" placeholder="INV-0042" />
        </InputGroup>
        <InputGroup>
          <InputGroupInput aria-label="Department (optional)" placeholder="Department" />
          <InputGroupAddon align="inline-end">
            <InputGroupText>(optional)</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      </Field>
    </FieldGroup>
  )
})

/** Buttons in every variant beside the input. Each keeps type="button", so none submits a form. */
export const InputGroupWithButtons = clientEntry(import.meta.url, function InputGroupWithButtons() {
  return () => (
    <FieldGroup>
      <Field>
        <FieldLabel for="input-group-demo-button-default">Coupon</FieldLabel>
        <InputGroup>
          <InputGroupInput id="input-group-demo-button-default" placeholder="SPRING26" />
          <InputGroupAddon>
            <InputGroupButton>Ghost</InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <InputGroup>
          <InputGroupInput aria-label="Coupon (outline)" />
          <InputGroupAddon>
            <InputGroupButton variant="outline">Outline</InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <InputGroup>
          <InputGroupInput aria-label="Coupon (secondary)" />
          <InputGroupAddon>
            <InputGroupButton variant="secondary">Secondary</InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <InputGroup>
          <InputGroupInput aria-label="Coupon (at the end)" />
          <InputGroupAddon align="inline-end">
            <InputGroupButton variant="secondary">Apply</InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <InputGroup>
          <InputGroupInput aria-label="Attachment name" defaultValue="receipt-0042.pdf" />
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="icon-xs" variant="secondary" aria-label="Remove attachment">
              <TrashIcon />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <InputGroup>
          <InputGroupInput aria-label="Search with a small button" />
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="sm" variant="default">
              Search
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <InputGroup>
          <InputGroupInput aria-label="Search with a small icon button" />
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="icon-sm" aria-label="Search">
              <SearchIcon />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </Field>
    </FieldGroup>
  )
})

/**
 * Copies the invoice link with the browser's clipboard. The button's label
 * and a status say whether it worked.
 */
export const InputGroupCopyLink = clientEntry(import.meta.url, function InputGroupCopyLink(handle: Handle) {
  let state: 'idle' | 'copied' | 'failed' = 'idle'

  return () => (
    <Field>
      <FieldLabel for="input-group-demo-link">Invoice link</FieldLabel>
      <InputGroup>
        <InputGroupInput
          id="input-group-demo-link"
          readOnly
          defaultValue="https://pay.example/inv/0042"
          aria-describedby="input-group-demo-link-status"
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label={state === 'copied' ? 'Copied' : 'Copy link'}
            mix={on('click', async (event, signal) => {
              let link = event.currentTarget.closest('[data-slot="input-group"]')?.querySelector('input')
              try {
                await navigator.clipboard.writeText(link?.value ?? '')
                state = 'copied'
              } catch {
                state = 'failed'
              }
              if (!signal.aborted) void handle.update()
            })}
          >
            {state === 'copied' ? <CheckIcon /> : <CopyIcon />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <FieldDescription id="input-group-demo-link-status" role="status">
        {state === 'copied'
          ? 'Copied to the clipboard.'
          : state === 'failed'
            ? 'The browser refused the clipboard. Select the link and copy it yourself.'
            : 'Anyone with the link can pay this invoice.'}
      </FieldDescription>
    </Field>
  )
})

/** Keys, a result count, a status mark, a disabled search and a loading field. */
export const InputGroupWithKbd = clientEntry(import.meta.url, function InputGroupWithKbd() {
  return () => (
    <FieldGroup>
      <Field>
        <FieldLabel for="input-group-demo-kbd">Command search</FieldLabel>
        <InputGroup>
          <InputGroupInput id="input-group-demo-kbd" placeholder="Jump to…" />
          <InputGroupAddon>
            <Kbd>⌘K</Kbd>
          </InputGroupAddon>
        </InputGroup>
        <InputGroup>
          <InputGroupInput aria-label="Ask the assistant" placeholder="Ask about an invoice…" />
          <InputGroupAddon align="inline-end">Ask</InputGroupAddon>
          <InputGroupAddon align="inline-end">
            <Kbd>Tab</Kbd>
          </InputGroupAddon>
        </InputGroup>
        <InputGroup>
          <InputGroupInput aria-label="Copy a reference" placeholder="Reference" />
          <InputGroupAddon align="inline-end">
            <KbdGroup>
              <Kbd>Ctrl</Kbd>
              <Kbd>C</Kbd>
            </KbdGroup>
          </InputGroupAddon>
        </InputGroup>
      </Field>
      <Field>
        <FieldLabel for="input-group-demo-handle">Workspace handle</FieldLabel>
        <InputGroup>
          <InputGroupInput
            id="input-group-demo-handle"
            defaultValue="acme-labs"
            aria-describedby="input-group-demo-handle-hint"
          />
          <InputGroupAddon align="inline-end">
            <span mix={availableStyles}>
              <CheckIcon />
            </span>
          </InputGroupAddon>
        </InputGroup>
        <FieldDescription id="input-group-demo-handle-hint" mix={availableTextStyles}>
          This handle is available.
        </FieldDescription>
      </Field>
      <InputGroup>
        <InputGroupInput type="search" aria-label="Search the documentation" placeholder="Search the documentation" />
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupAddon align="inline-end">12 results</InputGroupAddon>
      </InputGroup>
      <InputGroup data-disabled="true">
        <InputGroupInput type="search" aria-label="Search the archive" placeholder="Search the archive" disabled />
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupAddon align="inline-end">Disabled</InputGroupAddon>
      </InputGroup>
      <div mix={columnsStyles}>
        <Field>
          <FieldLabel for="input-group-demo-first">First name</FieldLabel>
          <InputGroup>
            <InputGroupInput id="input-group-demo-first" placeholder="Ada" autocomplete="given-name" />
            <InputGroupAddon align="inline-end">
              <InfoIcon />
            </InputGroupAddon>
          </InputGroup>
        </Field>
        <Field>
          <FieldLabel for="input-group-demo-last">Last name</FieldLabel>
          <InputGroup>
            <InputGroupInput id="input-group-demo-last" placeholder="Lovelace" autocomplete="family-name" />
            <InputGroupAddon align="inline-end">
              <InfoIcon />
            </InputGroupAddon>
          </InputGroup>
        </Field>
      </div>
      <Field disabled>
        <FieldLabel for="input-group-demo-loading">Company (checking the register)</FieldLabel>
        <InputGroup data-disabled="true">
          <InputGroupInput
            id="input-group-demo-loading"
            defaultValue="Acme Labs"
            disabled
            aria-describedby="input-group-demo-loading-hint"
          />
          <InputGroupAddon align="inline-end">
            <Spinner label="Checking" />
          </InputGroupAddon>
        </InputGroup>
        <FieldDescription id="input-group-demo-loading-hint">
          The field opens again once the check is done.
        </FieldDescription>
      </Field>
    </FieldGroup>
  )
})

/** A card whose form sends its fields to action. */
export const InputGroupInCard = clientEntry(
  import.meta.url,
  function InputGroupInCard(handle: Handle<{ action: string }>) {
    return () => (
      <Card>
        <CardHeader>
          <CardTitle level={3}>Billing contact</CardTitle>
          <CardDescription>Where we send invoices and questions about them.</CardDescription>
        </CardHeader>
        <CardContent>
          <form id="input-group-demo-card" action={handle.props.action} method="get" mix={formStyles}>
            <FieldGroup>
              <Field>
                <FieldLabel for="input-group-demo-card-email">Email address</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="input-group-demo-card-email"
                    name="email"
                    type="email"
                    placeholder="billing@acme.example"
                    autocomplete="email"
                    required
                  />
                  <InputGroupAddon align="inline-end">
                    <MailIcon />
                  </InputGroupAddon>
                </InputGroup>
              </Field>
              <Field>
                <FieldLabel for="input-group-demo-card-website">Website</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <InputGroupText>https://</InputGroupText>
                  </InputGroupAddon>
                  <InputGroupInput
                    id="input-group-demo-card-website"
                    name="website"
                    placeholder="acme.example"
                    autocomplete="url"
                  />
                  <InputGroupAddon align="inline-end">
                    <LinkIcon />
                  </InputGroupAddon>
                </InputGroup>
              </Field>
              <Field>
                <FieldLabel for="input-group-demo-card-notes">Notes for accounts payable</FieldLabel>
                <InputGroup>
                  <InputGroupTextarea
                    id="input-group-demo-card-notes"
                    name="notes"
                    placeholder="PO numbers, cost centers…"
                    aria-describedby="input-group-demo-card-notes-hint"
                    mix={tallStyles}
                  />
                  <InputGroupAddon align="block-end">
                    <InputGroupText id="input-group-demo-card-notes-hint">Up to 500 characters</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
        <CardFooter>
          <Button type="reset" form="input-group-demo-card" variant="outline">
            Reset
          </Button>
          <Button type="submit" form="input-group-demo-card">
            Save contact
          </Button>
        </CardFooter>
      </Card>
    )
  },
)

/** Textareas with addons above and below, buttons and a code editor's frame. */
export const InputGroupTextareas = clientEntry(import.meta.url, function InputGroupTextareas() {
  return () => (
    <FieldGroup>
      <Field>
        <FieldLabel for="input-group-demo-textarea-plain">Note (plain textarea)</FieldLabel>
        <Textarea id="input-group-demo-textarea-plain" placeholder="Thanks for your order." />
      </Field>
      <Field>
        <FieldLabel for="input-group-demo-textarea">Note (input group)</FieldLabel>
        <InputGroup>
          <InputGroupTextarea id="input-group-demo-textarea" placeholder="Thanks for your order." />
        </InputGroup>
      </Field>
      <Field invalid>
        <FieldLabel for="input-group-demo-textarea-invalid">Dispute reason</FieldLabel>
        <InputGroup>
          <InputGroupTextarea
            id="input-group-demo-textarea-invalid"
            aria-invalid={true}
            aria-describedby="input-group-demo-textarea-invalid-error"
          />
        </InputGroup>
        <FieldError
          id="input-group-demo-textarea-invalid-error"
          errors={[{ message: 'Tell us what is wrong with the invoice.' }]}
        />
      </Field>
      <Field disabled>
        <FieldLabel for="input-group-demo-textarea-disabled">Archived note</FieldLabel>
        <InputGroup>
          <InputGroupTextarea
            id="input-group-demo-textarea-disabled"
            defaultValue="Paid in full on 3 March."
            disabled
          />
        </InputGroup>
      </Field>
      <Field>
        <FieldLabel for="input-group-demo-prompt">Question (block-start)</FieldLabel>
        <InputGroup>
          <InputGroupTextarea id="input-group-demo-prompt" />
          <InputGroupAddon align="block-start">
            <InputGroupText mix={fillStyles}>Ask about this invoice</InputGroupText>
            <InfoIcon />
          </InputGroupAddon>
        </InputGroup>
      </Field>
      <Field>
        <FieldLabel for="input-group-demo-reply">Reply (block-end)</FieldLabel>
        <InputGroup>
          <InputGroupTextarea id="input-group-demo-reply" placeholder="Write a reply…" />
          <InputGroupAddon align="block-end">
            <InputGroupText mix={fillStyles}>Replies go to the customer</InputGroupText>
            <InputGroupButton variant="default" size="icon-xs" aria-label="Send" mix={roundStyles}>
              <ArrowUpIcon />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </Field>
      <Field>
        <FieldLabel for="input-group-demo-comment">Comment (buttons)</FieldLabel>
        <InputGroup>
          <InputGroupTextarea id="input-group-demo-comment" placeholder="Share your thoughts…" mix={tallStyles} />
          <InputGroupAddon align="block-end" mix={addonEndStyles}>
            <InputGroupButton size="sm">Cancel</InputGroupButton>
            <InputGroupButton size="sm" variant="default">
              Post comment
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </Field>
      <Field>
        <FieldLabel for="input-group-demo-code">Webhook script</FieldLabel>
        <InputGroup>
          <InputGroupTextarea
            id="input-group-demo-code"
            spellcheck="false"
            placeholder="export default (invoice) => invoice.total"
            mix={codeStyles}
          />
          <InputGroupAddon align="block-start" mix={ruleBelowStyles}>
            <InputGroupText mix={[monoStyles, fillStyles]}>
              <CodeIcon />
              on-paid.js
            </InputGroupText>
            <InputGroupButton size="icon-xs" aria-label="Copy the script">
              <CopyIcon />
            </InputGroupButton>
            <InputGroupButton size="icon-xs" aria-label="Clear the script">
              <XIcon />
            </InputGroupButton>
          </InputGroupAddon>
          <InputGroupAddon align="block-end" mix={ruleAboveStyles}>
            <InputGroupText mix={fillStyles}>Line 1, column 1</InputGroupText>
            <InputGroupText>JavaScript</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      </Field>
    </FieldGroup>
  )
})

/** An input group joined to text in a ButtonGroup. */
export const InputGroupInButtonGroup = clientEntry(import.meta.url, function InputGroupInButtonGroup() {
  return () => (
    <Field>
      <FieldLabel for="input-group-demo-domain">Custom domain</FieldLabel>
      <ButtonGroup>
        <ButtonGroupText>https://</ButtonGroupText>
        <InputGroup>
          <InputGroupInput id="input-group-demo-domain" placeholder="acme" />
          <InputGroupAddon align="inline-end">
            <InfoIcon />
          </InputGroupAddon>
        </InputGroup>
        <ButtonGroupText>.com</ButtonGroupText>
      </ButtonGroup>
    </Field>
  )
})

/**
 * A search form that sends its query to action. Its buttons keep their
 * types: Clear resets the form and Search submits it.
 */
export const InputGroupSearchForm = clientEntry(
  import.meta.url,
  function InputGroupSearchForm(handle: Handle<{ action: string }>) {
    return () => (
      <form role="search" action={handle.props.action} method="get" mix={formStyles}>
        <InputGroup>
          <InputGroupInput
            type="search"
            name="q"
            aria-label="Search invoices"
            placeholder="Number or customer"
            required
          />
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupAddon align="inline-end">
            <InputGroupButton type="reset" size="icon-xs" aria-label="Clear">
              <XIcon />
            </InputGroupButton>
            <InputGroupButton type="submit" variant="secondary" name="scope" value="invoices">
              Search
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>
    )
  },
)

const limit = 280

/**
 * A reply with a live count. Over the limit, the textarea turns invalid and
 * names its error; its focus and its description links stay as the text changes.
 */
export const InputGroupCounter = clientEntry(import.meta.url, function InputGroupCounter(handle: Handle) {
  let length = 0

  return () => {
    let over = length > limit

    return (
      <Field invalid={over}>
        <FieldLabel for="input-group-demo-counter">Message to the customer</FieldLabel>
        <InputGroup>
          <InputGroupTextarea
            id="input-group-demo-counter"
            name="message"
            aria-invalid={over}
            aria-describedby={
              over ? 'input-group-demo-counter-count input-group-demo-counter-error' : 'input-group-demo-counter-count'
            }
            mix={on('input', (event) => {
              length = event.currentTarget.value.length
              void handle.update()
            })}
          />
          <InputGroupAddon align="block-end">
            <InputGroupText id="input-group-demo-counter-count">
              {length}/{limit} characters
            </InputGroupText>
          </InputGroupAddon>
        </InputGroup>
        {over ? (
          <FieldError
            id="input-group-demo-counter-error"
            errors={[{ message: `Shorten the message by ${length - limit} characters.` }]}
          />
        ) : null}
      </Field>
    )
  }
})

/**
 * Any control marked data-slot="input-group-control" joins the group's ring:
 * here a native select for the currency beside an amount.
 */
export const InputGroupCustomControl = clientEntry(import.meta.url, function InputGroupCustomControl() {
  return () => (
    <Field>
      <FieldLabel for="input-group-demo-price">Price</FieldLabel>
      <InputGroup>
        <label for="input-group-demo-currency" mix={visuallyHiddenStyles}>
          Currency
        </label>
        <select id="input-group-demo-currency" name="currency" data-slot="input-group-control" mix={currencyStyles}>
          <option value="CHF">CHF</option>
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
        </select>
        <InputGroupInput id="input-group-demo-price" name="price" inputMode="decimal" placeholder="0.00" />
      </InputGroup>
    </Field>
  )
})
