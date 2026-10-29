// RemixCN Alert Dialog examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { Icon } from '#remixcn/lib/icons.tsx'
import type { IconProps } from '#remixcn/lib/icons.tsx'
import { disabledState, invalidState, mergeStyles, transition } from '#remixcn/lib/styles.ts'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '#remixcn/ui/alert-dialog.tsx'
import { buttonVariants } from '#remixcn/ui/button.tsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#remixcn/ui/dialog.tsx'

// Every example handles events, so each is a client entry. Before the
// browser runs it, the trigger and the cancel button still open and close
// the native dialog in browsers with invoker commands.

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const outline = buttonVariants({ variant: 'outline' })
const stackStyles = css({ display: 'grid', justifyItems: 'start', gap: space(2) })
const statusStyles = css({
  margin: 0,
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
})
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
// shadcn's bg-destructive/10 text-destructive. The red mixes in a quarter of
// the text color, as the destructive Button's does, so the icon keeps 3:1.
const destructiveMediaStyles = css({
  backgroundColor:
    'light-dark(color-mix(in oklab, var(--destructive) 10%, transparent), color-mix(in oklab, var(--destructive) 20%, transparent))',
  color: 'color-mix(in oklab, var(--destructive) 75%, var(--foreground))',
})

function BellIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5h-14z" />
      <path d="M10 20.5h4" />
    </Icon>
  )
}

function TrashIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M4 6.5h16M9.5 6.5V4h5v2.5M6.5 6.5l1 13.5h9l1-13.5M10 10.5v6M14 10.5v6" />
    </Icon>
  )
}

/** A title, a description, and the two answers. */
export const AlertDialogBasic = clientEntry(import.meta.url, function AlertDialogBasic() {
  return () => (
    <AlertDialog>
      <AlertDialogTrigger mix={outline}>Archive customer</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive Acme Labs?</AlertDialogTitle>
          <AlertDialogDescription>
            Their open invoices stay due, but you can't send them new ones until you restore them.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Archive</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
})

/** size="sm": narrow at every width, with the answers side by side. */
export const AlertDialogSmall = clientEntry(import.meta.url, function AlertDialogSmall() {
  return () => (
    <AlertDialog>
      <AlertDialogTrigger mix={outline}>Small</AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Send reminders now?</AlertDialogTitle>
          <AlertDialogDescription>12 customers with late invoices get a reminder today.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Not now</AlertDialogCancel>
          <AlertDialogAction>Send</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
})

/** An icon in AlertDialogMedia, beside the text in a wide alert dialog. */
export const AlertDialogWithMedia = clientEntry(import.meta.url, function AlertDialogWithMedia() {
  return () => (
    <AlertDialog>
      <AlertDialogTrigger mix={outline}>With media</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <BellIcon />
          </AlertDialogMedia>
          <AlertDialogTitle>Turn off reminders?</AlertDialogTitle>
          <AlertDialogDescription>
            Late customers no longer get reminders. You can still send one by hand.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep them on</AlertDialogCancel>
          <AlertDialogAction>Turn off</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
})

/** A small alert dialog with media above its text. */
export const AlertDialogSmallWithMedia = clientEntry(import.meta.url, function AlertDialogSmallWithMedia() {
  return () => (
    <AlertDialog>
      <AlertDialogTrigger mix={outline}>Small with media</AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia>
            <BellIcon />
          </AlertDialogMedia>
          <AlertDialogTitle>Allow reminders?</AlertDialogTitle>
          <AlertDialogDescription>Customers get an email 3 days before an invoice is due.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Don't allow</AlertDialogCancel>
          <AlertDialogAction>Allow</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
})

/**
 * A destructive answer that confirms: the action's click handler deletes,
 * then the alert dialog closes, and a status says what happened. Cancel,
 * Escape and closing never delete.
 */
export const AlertDialogDestructive = clientEntry(import.meta.url, function AlertDialogDestructive(handle: Handle) {
  let status = ''

  return () => (
    <div mix={stackStyles}>
      <AlertDialog
        onOpenChange={(open, details) => {
          if (open || details.reason === 'action-press') return
          status = 'INV-0042 kept.'
          void handle.update()
        }}
      >
        <AlertDialogTrigger mix={buttonVariants({ variant: 'destructive' })}>Delete invoice</AlertDialogTrigger>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia mix={destructiveMediaStyles}>
              <TrashIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete INV-0042?</AlertDialogTitle>
            <AlertDialogDescription>
              The invoice and its reminders go away for good. <a href="#credit-notes">Issue a credit note</a> to keep a
              record instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="ghost">Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              mix={on('click', () => {
                status = 'INV-0042 deleted.'
                void handle.update()
              })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <p role="status" mix={statusStyles}>
        {status}
      </p>
    </div>
  )
})

/**
 * An answer that posts a form: the action is its submit button, and the
 * server receives the reason with it. Enter in the field doesn't confirm;
 * only pressing Write off does.
 */
export const AlertDialogWithForm = clientEntry(
  import.meta.url,
  function AlertDialogWithForm(handle: Handle<{ action: string }>) {
    return () => {
      let reason = `${handle.id}-reason`

      return (
        <form action={handle.props.action} method="post">
          <AlertDialog>
            <AlertDialogTrigger mix={outline}>Write off invoice</AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Write off INV-0042?</AlertDialogTitle>
                <AlertDialogDescription>
                  Acme Labs no longer owes CHF 650.00. Say why, for the audit log.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <label for={reason} mix={fieldStyles}>
                Reason
                <input id={reason} name="reason" mix={inputStyles} />
              </label>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction type="submit" name="intent" value="write-off" variant="destructive">
                  Write off
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </form>
      )
    }
  },
)

/** An alert dialog opened from a dialog. Escape closes the alert dialog first. */
export const AlertDialogInDialog = clientEntry(import.meta.url, function AlertDialogInDialog() {
  return () => (
    <Dialog>
      <DialogTrigger mix={outline}>Open dialog</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invoice INV-0042</DialogTitle>
          <DialogDescription>Void the invoice from here, after you confirm.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <AlertDialog>
            <AlertDialogTrigger mix={buttonVariants()}>Void invoice</AlertDialogTrigger>
            <AlertDialogContent size="sm">
              <AlertDialogHeader>
                <AlertDialogTitle>Void INV-0042?</AlertDialogTitle>
                <AlertDialogDescription>Acme Labs no longer owes this invoice.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction>Void</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
