// RemixCN Dialog examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { CopyIcon } from '#remixcn/lib/icons.tsx'
import { disabledState, invalidState, mergeStyles, transition } from '#remixcn/lib/styles.ts'
import { Button, buttonVariants } from '#remixcn/ui/button.tsx'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#remixcn/ui/dialog.tsx'
import type { DialogChangeReason } from '#remixcn/ui/dialog.tsx'

// Every example handles events, so each is a client entry: its dialog parts
// run in the browser inside it. Before the browser runs them, triggers and
// close buttons still open and close the native dialog in browsers with
// invoker commands.

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const outline = buttonVariants({ variant: 'outline' })
const rowStyles = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space(2) })
const fieldsStyles = css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(4) })
const fieldStyles = css({
  display: 'grid',
  gap: space(2),
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  fontWeight: 500,
})
const inputStyles = css(
  mergeStyles(
    {
      height: space(9),
      minWidth: 0,
      paddingInline: space(2.5),
      border: '1px solid var(--input)',
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'transparent',
      boxShadow: 'var(--shadow-xs)',
      fontSize: 'var(--text-sm)',
      fontWeight: 400,
    },
    transition('border-color'),
    invalidState,
    disabledState,
  ),
)
// A scroll region inside the dialog, so its header and footer stay in place.
const scrollStyles = css({
  maxHeight: '50vh',
  overflowY: 'auto',
  marginInline: space(-6),
  paddingInline: space(6),
  '& p': { margin: `0 0 ${space(4)}` },
})
const statusStyles = css({
  margin: 0,
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
})

const terms = [
  'Invoices are due 30 days after they are sent, unless the invoice names another date.',
  'A reminder goes out 3 days before the due date, and again 7 days after it.',
  'Late invoices may carry a fee of 2% of the open amount for every month they stay open.',
  'Credit notes cancel all or part of an invoice and appear on the next statement.',
  'Payments clear within 2 business days. A payment without a reference waits for a match.',
  'Disputed invoices stop their reminders until the dispute is closed.',
  'Statements list every open invoice, credit note and payment of the past 12 months.',
  'Archived invoices stay searchable for 10 years, as the law asks.',
]

/**
 * A form inside the dialog. The dialog stays where you render it in the
 * document, so its fields belong to the form around them and the submit
 * button sends them, also without a script.
 */
export const DialogWithForm = clientEntry(import.meta.url, function DialogWithForm(handle: Handle<{ action: string }>) {
  return () => {
    let id = handle.id

    return (
      <form action={handle.props.action} method="post">
        <Dialog>
          <DialogTrigger mix={outline}>Edit customer</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit customer</DialogTitle>
              <DialogDescription>Change the billing contact of Acme Labs. Save when you're done.</DialogDescription>
            </DialogHeader>
            <div mix={fieldsStyles}>
              <label for={`${id}-name`} mix={fieldStyles}>
                Name
                <input id={`${id}-name`} name="name" defaultValue="Acme Labs" mix={inputStyles} />
              </label>
              <label for={`${id}-email`} mix={fieldStyles}>
                Billing email
                <input
                  id={`${id}-email`}
                  name="email"
                  type="email"
                  defaultValue="billing@acme.example"
                  mix={inputStyles}
                />
              </label>
            </div>
            <DialogFooter>
              <DialogClose mix={outline}>Cancel</DialogClose>
              <Button type="submit">Save changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </form>
    )
  }
})

/** Long content in a scroll region of its own, so the title stays in view. */
export const DialogScrollableContent = clientEntry(import.meta.url, function DialogScrollableContent() {
  return () => (
    <Dialog>
      <DialogTrigger mix={outline}>Payment terms</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Payment terms</DialogTitle>
          <DialogDescription>The terms every invoice follows.</DialogDescription>
        </DialogHeader>
        <div mix={scrollStyles} tabIndex={0} role="region" aria-label="Terms">
          {terms.map((term) => (
            <p key={term}>{term}</p>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
})

/** The same long content with a footer that stays below it. */
export const DialogWithStickyFooter = clientEntry(import.meta.url, function DialogWithStickyFooter() {
  return () => (
    <Dialog>
      <DialogTrigger mix={outline}>Terms with footer</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Payment terms</DialogTitle>
          <DialogDescription>Read them, then close the dialog below.</DialogDescription>
        </DialogHeader>
        <div mix={scrollStyles} tabIndex={0} role="region" aria-label="Terms">
          {terms.map((term) => (
            <p key={term}>{term}</p>
          ))}
        </div>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  )
})

/** No close button in the corner: the footer's button, Escape and a press outside close it. */
export const DialogNoCloseButton = clientEntry(import.meta.url, function DialogNoCloseButton() {
  return () => (
    <Dialog>
      <DialogTrigger mix={outline}>No close button</DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Reminder sent</DialogTitle>
          <DialogDescription>Acme Labs got a reminder for INV-0042. The next one goes out in 7 days.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose mix={outline}>Close</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

/** Your own close button in the footer, next to a field to copy from. */
export const DialogCustomCloseButton = clientEntry(import.meta.url, function DialogCustomCloseButton(handle: Handle) {
  let copied = false

  return () => {
    let link = `${handle.id}-link`

    return (
      <Dialog
        onOpenChange={(open) => {
          if (open) copied = false
        }}
      >
        <DialogTrigger mix={outline}>Share invoice</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share link</DialogTitle>
            <DialogDescription>Anyone with the link can view INV-0042.</DialogDescription>
          </DialogHeader>
          <div mix={rowStyles}>
            <label for={link} mix={fieldStyles} style={{ flex: '1 1 12rem' }}>
              Link
              <input id={link} readOnly value="https://billing.example/i/INV-0042" mix={inputStyles} />
            </label>
            <Button
              variant="outline"
              size="icon"
              aria-label="Copy link"
              mix={on('click', () => void ((copied = true), handle.update()))}
            >
              <CopyIcon />
            </Button>
          </div>
          <p role="status" mix={statusStyles}>
            {copied ? 'Link copied.' : ''}
          </p>
          <DialogFooter>
            <DialogClose mix={buttonVariants({ variant: 'secondary' })}>Close</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }
})

const choicesStyles = css({
  display: 'grid',
  gap: space(2),
  margin: 0,
  padding: 0,
  border: 0,
  '& legend': { marginBottom: space(2), padding: 0, fontWeight: 500 },
  '& label': { display: 'flex', alignItems: 'center', gap: space(2) },
})

const schedules = [
  { value: 'weekly', label: 'Every week' },
  { value: 'biweekly', label: 'Every two weeks' },
  { value: 'monthly', label: 'Every month' },
]

/**
 * Native radios as the first controls. The group is one Tab stop, the
 * checked radio, and the arrow keys move between its radios, so Tab and
 * Shift+Tab still wrap around inside the dialog from it.
 */
export const DialogWithChoices = clientEntry(import.meta.url, function DialogWithChoices() {
  return () => (
    <Dialog>
      <DialogTrigger mix={outline}>Reminder schedule</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reminder schedule</DialogTitle>
          <DialogDescription>How often Acme Labs hears about late invoices.</DialogDescription>
        </DialogHeader>
        <fieldset mix={choicesStyles}>
          <legend>Send reminders</legend>
          {schedules.map(({ value, label }) => (
            <label key={value}>
              <input type="radio" name="schedule" value={value} defaultChecked={value === 'biweekly'} />
              {label}
            </label>
          ))}
        </fieldset>
        <DialogFooter>
          <DialogClose mix={outline}>Cancel</DialogClose>
          <DialogClose mix={buttonVariants()}>Save</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

/**
 * A dialog that isn't modal: the page stays usable beside it and keeps
 * scrolling, and the dialog closes when focus leaves it or on a press outside.
 */
export const DialogNonModal = clientEntry(import.meta.url, function DialogNonModal() {
  return () => (
    <Dialog modal={false}>
      <DialogTrigger mix={outline}>Keyboard shortcuts</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>N creates an invoice, R sends a reminder, and / searches.</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
})

/**
 * A dialog its owner controls, with two triggers. The owner renders the open
 * state from onOpenChange, and shows why it changed.
 */
export const DialogControlled = clientEntry(import.meta.url, function DialogControlled(handle: Handle) {
  let open = false
  let reason: DialogChangeReason | 'none yet' = 'none yet'

  return () => (
    <div mix={fieldsStyles}>
      <Dialog
        open={open}
        onOpenChange={(next, details) => {
          open = next
          reason = details.reason
          void handle.update()
        }}
      >
        <div mix={rowStyles}>
          <DialogTrigger mix={outline}>Open from the list</DialogTrigger>
          <DialogTrigger mix={outline}>Open from the toolbar</DialogTrigger>
        </div>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invoice INV-0042</DialogTitle>
            <DialogDescription>CHF 1,250.00, due on 30 November.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose mix={outline}>Close</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <p mix={statusStyles} data-reason={reason}>
        Last change: {reason}
      </p>
    </div>
  )
})

/**
 * A dialog that starts open, such as a notice on a page. The server renders
 * it open, so it reads before any script runs. Once the browser runs it, it
 * becomes modal.
 */
export const DialogStartsOpen = clientEntry(import.meta.url, function DialogStartsOpen() {
  return () => (
    <Dialog defaultOpen>
      <DialogTrigger mix={outline}>Show notice</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New payment terms</DialogTitle>
          <DialogDescription>From 1 January, invoices are due 30 days after they are sent.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose mix={outline}>Got it</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
