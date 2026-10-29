// RemixCN Alert examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { CheckIcon, CircleAlertIcon, Icon } from '#remixcn/lib/icons.tsx'
import type { IconProps } from '#remixcn/lib/icons.tsx'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '#remixcn/ui/alert.tsx'
import { Button } from '#remixcn/ui/button.tsx'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const stackStyles = css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(4) })

export function InfoIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.5h.01" />
    </Icon>
  )
}

/** Title only, title and description, and description only. None of them interrupts a screen reader. */
export function AlertBasic() {
  return () => (
    <div mix={stackStyles}>
      <Alert>
        <AlertTitle>Your changes were saved.</AlertTitle>
      </Alert>
      <Alert>
        <AlertTitle>Your changes were saved.</AlertTitle>
        <AlertDescription>Acme Labs sees the new payment terms on their next invoice.</AlertDescription>
      </Alert>
      <Alert>
        <AlertDescription>Invoice numbers restart at 0001 every January.</AlertDescription>
      </Alert>
    </div>
  )
}

/** An icon before the text takes a column of its own. Links in the title and description are underlined. */
export function AlertWithIcons() {
  return () => (
    <div mix={stackStyles}>
      <Alert>
        <InfoIcon />
        <AlertTitle>
          Reminders now go out at 9:00 in each customer's time zone. <a href="#reminders">Change it</a>.
        </AlertTitle>
      </Alert>
      <Alert>
        <CheckIcon />
        <AlertTitle>Payment received</AlertTitle>
        <AlertDescription>
          Globex paid INV-0042 in full. <a href="#receipt">Send a receipt</a> or <a href="#ledger">open the ledger</a>.
        </AlertDescription>
      </Alert>
      <Alert>
        <InfoIcon />
        <AlertTitle>
          This title is long on purpose, to show that it wraps onto as many lines as it needs on a narrow screen instead
          of running out of the alert
        </AlertTitle>
        <AlertDescription>
          <p>The description wraps too, and keeps its own column next to the icon.</p>
          <p>Paragraphs inside it get space between them.</p>
        </AlertDescription>
      </Alert>
    </div>
  )
}

/** A destructive alert is red and announced at once, with role="alert". */
export function AlertDestructive() {
  return () => (
    <Alert variant="destructive">
      <CircleAlertIcon />
      <AlertTitle>Payment failed</AlertTitle>
      <AlertDescription>
        The card ending in 4242 was declined. Ask Acme Labs for another payment method.
      </AlertDescription>
    </Alert>
  )
}

/** An action sits in the end corner. */
export function AlertWithActions() {
  return () => (
    <div mix={stackStyles}>
      <Alert>
        <CheckIcon />
        <AlertTitle>Reminder scheduled</AlertTitle>
        <AlertDescription>Acme Labs gets a reminder on 4 November.</AlertDescription>
        <AlertAction>
          <Button size="xs" variant="outline">
            Undo
          </Button>
        </AlertAction>
      </Alert>
      <Alert variant="destructive" live="off">
        <CircleAlertIcon />
        <AlertTitle>Bank feed disconnected</AlertTitle>
        <AlertDescription>New payments won't match their invoices until you reconnect.</AlertDescription>
        <AlertAction>
          <Button size="xs" variant="destructive">
            Reconnect
          </Button>
        </AlertAction>
      </Alert>
    </div>
  )
}

const brandStyles = css({
  borderColor: 'light-dark(oklch(0.83 0.11 85), oklch(0.47 0.1 75))',
  backgroundColor: 'light-dark(oklch(0.98 0.03 95), oklch(0.27 0.05 75))',
  color: 'light-dark(oklch(0.42 0.1 65), oklch(0.93 0.07 95))',
  '& [data-slot="alert-description"]': { color: 'inherit' },
})

/** Your own colors with a css() you pass with mix. */
export function AlertCustomColors() {
  return () => (
    <Alert mix={brandStyles} data-override="mix">
      <InfoIcon />
      <AlertTitle>Trial ends in 3 days</AlertTitle>
      <AlertDescription>Add a payment method to keep sending invoices.</AlertDescription>
    </Alert>
  )
}

/**
 * A polite status that stays rendered while its text changes, so screen
 * readers announce each change without interrupting.
 */
export const AlertLiveStatus = clientEntry(import.meta.url, function AlertLiveStatus(handle: Handle) {
  let saves = 0

  return () => (
    <div mix={stackStyles}>
      <Alert live="polite">
        <InfoIcon />
        <AlertTitle>Draft</AlertTitle>
        <AlertDescription>
          {saves === 0 ? 'No changes saved yet.' : `Draft saved ${saves === 1 ? 'once' : `${saves} times`}.`}
        </AlertDescription>
      </Alert>
      <div>
        <Button
          variant="outline"
          mix={on('click', () => {
            saves++
            void handle.update()
          })}
        >
          Save draft
        </Button>
      </div>
    </div>
  )
})
