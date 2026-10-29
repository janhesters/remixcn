// RemixCN Tooltip examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css } from 'remix/component'
import type { Handle } from 'remix/component'

import { Icon } from '#remixcn/lib/icons.tsx'
import type { IconProps } from '#remixcn/lib/icons.tsx'
import { Button, buttonVariants } from '#remixcn/ui/button.tsx'
import { Kbd } from '#remixcn/ui/kbd.tsx'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, tooltipTrigger } from '#remixcn/ui/tooltip.tsx'

// Each example is a client entry, so its tooltips run in the browser. Without
// it, every trigger still has its description.

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const rowStyles = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space(2) })
const outline = buttonVariants({ variant: 'outline' })

function InfoIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.5h.01" />
    </Icon>
  )
}

function SaveIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M5 4h11.5L20 7.5V20H4V4Z" />
      <path d="M8 4v5h7V4M8 20v-6.5h8V20" />
    </Icon>
  )
}

function ArchiveIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M3.5 4.5h17v4h-17zM5 8.5V19.5h14V8.5M10 12.5h4" />
    </Icon>
  )
}

function SendIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M20.5 3.5 10 14M20.5 3.5 14 20.5l-4-6.5-6.5-4 17-6.5Z" />
    </Icon>
  )
}

function CopyIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M8.5 8.5h11v11h-11zM15.5 8.5v-4h-11v11h4" />
    </Icon>
  )
}

/** A short description of what the button does. */
export const TooltipBasic = clientEntry(import.meta.url, function TooltipBasic() {
  return () => (
    <Tooltip>
      <TooltipTrigger mix={outline}>Show tooltip</TooltipTrigger>
      <TooltipContent>Add to the reminder list</TooltipContent>
    </Tooltip>
  )
})

const sides = ['inline-start', 'left', 'top', 'bottom', 'right', 'inline-end'] as const

/** Every side. Inline start and end follow the text direction. */
export const TooltipSides = clientEntry(import.meta.url, function TooltipSides() {
  return () => (
    <div mix={rowStyles}>
      {sides.map((side) => (
        <Tooltip key={side}>
          <TooltipTrigger mix={outline}>{side.replace('-', ' ')}</TooltipTrigger>
          <TooltipContent side={side}>Add to the reminder list</TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
})

/** An icon button names its action with aria-label; the tooltip describes it. */
export const TooltipWithIcon = clientEntry(import.meta.url, function TooltipWithIcon() {
  return () => (
    <Tooltip>
      <TooltipTrigger aria-label="Payment status" mix={buttonVariants({ variant: 'ghost', size: 'icon' })}>
        <InfoIcon />
      </TooltipTrigger>
      <TooltipContent>Paid invoices turn green within a day</TooltipContent>
    </Tooltip>
  )
})

/** Long text wraps at 20rem, and never past the room on screen. */
export const TooltipLongContent = clientEntry(import.meta.url, function TooltipLongContent() {
  return () => (
    <Tooltip>
      <TooltipTrigger mix={outline}>Late fees</TooltipTrigger>
      <TooltipContent>
        A late fee of 2% is added to an invoice 14 days after it's due. To waive it, open the invoice and choose Waive
        fee before you send the next reminder.
      </TooltipContent>
    </Tooltip>
  )
})

/**
 * A tooltip on a disabled button that says why. focusableWhenDisabled keeps
 * the button in the tab order, so keyboard users reach the reason too.
 */
export const TooltipDisabled = clientEntry(import.meta.url, function TooltipDisabled() {
  return () => (
    <Tooltip>
      <Button variant="outline" disabled focusableWhenDisabled mix={tooltipTrigger()}>
        Refund
      </Button>
      <TooltipContent>Paid invoices can be refunded after 24 hours</TooltipContent>
    </Tooltip>
  )
})

/** A keyboard shortcut in the description. */
export const TooltipWithKeyboard = clientEntry(import.meta.url, function TooltipWithKeyboard() {
  return () => (
    <Tooltip>
      <TooltipTrigger aria-label="Save draft" mix={buttonVariants({ variant: 'outline', size: 'icon-sm' })}>
        <SaveIcon />
      </TooltipTrigger>
      <TooltipContent>
        Save changes <Kbd>S</Kbd>
      </TooltipContent>
    </Tooltip>
  )
})

/** A native link as the trigger. It navigates as always; touch never opens the tooltip. */
export const TooltipOnLink = clientEntry(import.meta.url, function TooltipOnLink() {
  return () => (
    <Tooltip>
      <a href="#payment-terms" mix={[buttonVariants({ variant: 'link' }), tooltipTrigger()]}>
        Payment terms
      </a>
      <TooltipContent>Read the terms every customer agreed to</TooltipContent>
    </Tooltip>
  )
})

const formattedStyles = css({ display: 'grid', gap: space(1) })
const statusStyles = css({ margin: 0, fontWeight: 600 })
const updatedStyles = css({ margin: 0, opacity: 0.8 })

/** Structured text in the tooltip. It stays text: nothing in a tooltip takes focus. */
export const TooltipFormatted = clientEntry(import.meta.url, function TooltipFormatted() {
  return () => (
    <Tooltip>
      <TooltipTrigger mix={outline}>Status</TooltipTrigger>
      <TooltipContent>
        <div mix={formattedStyles}>
          <p mix={statusStyles}>Paid</p>
          <p mix={updatedStyles}>Last updated 2 hours ago</p>
        </div>
      </TooltipContent>
    </Tooltip>
  )
})

/**
 * A toolbar whose tooltips share a provider: the first waits 400ms, and the
 * next opens at once while one is open or just closed.
 */
export const TooltipToolbar = clientEntry(import.meta.url, function TooltipToolbar() {
  let actions = [
    ['Archive', 'Moves the invoice to the archive', ArchiveIcon],
    ['Send', 'Sends the invoice to Acme Labs', SendIcon],
    ['Duplicate', 'Starts a new draft from this invoice', CopyIcon],
  ] as const

  return () => (
    <TooltipProvider delay={400}>
      <div role="group" aria-label="Invoice actions" mix={rowStyles}>
        {actions.map(([label, description, ActionIcon]) => (
          <Tooltip key={label}>
            <TooltipTrigger aria-label={label} mix={buttonVariants({ variant: 'ghost', size: 'icon' })}>
              <ActionIcon />
            </TooltipTrigger>
            <TooltipContent side="bottom">{description}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  )
})
