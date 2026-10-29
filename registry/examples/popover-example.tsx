// RemixCN Popover examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { buttonVariants } from '#remixcn/ui/button.tsx'
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  popoverOpenChangeType,
} from '#remixcn/ui/popover.tsx'
import type { PopoverOpenChangeReason } from '#remixcn/ui/popover.tsx'

// Each example is a client entry, so its popovers run in the browser. Until
// then, and without JavaScript, a trigger opens its popover natively.

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const rowStyles = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space(2) })
const stackStyles = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  justifyItems: 'start',
  gap: space(2),
})
const hintStyles = css({
  margin: 0,
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
})
const narrowStyles = css({ width: '10rem' })
const textStyles = css({ margin: 0 })

/** A title and a description name and describe the popover. */
export const PopoverBasic = clientEntry(import.meta.url, function PopoverBasic() {
  return () => (
    <Popover>
      <PopoverTrigger mix={buttonVariants({ variant: 'outline' })}>Payment terms</PopoverTrigger>
      <PopoverContent align="start">
        <PopoverHeader>
          <PopoverTitle>Payment terms</PopoverTitle>
          <PopoverDescription>Invoices are due 30 days after they are sent.</PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  )
})

const sides = [
  ['inline-start', 'left', 'top'],
  ['bottom', 'right', 'inline-end'],
] as const

/** Every side. Inline start and end follow the text direction. */
export const PopoverSides = clientEntry(import.meta.url, function PopoverSides() {
  return () => (
    <div mix={stackStyles}>
      {sides.map((row) => (
        <div key={row.join()} mix={rowStyles}>
          {row.map((side) => (
            <Popover key={side}>
              <PopoverTrigger mix={buttonVariants({ variant: 'outline' })}>{side.replace('-', ' ')}</PopoverTrigger>
              <PopoverContent side={side} mix={narrowStyles}>
                <p mix={textStyles}>Popover on {side.replace('-', ' ')}</p>
              </PopoverContent>
            </Popover>
          ))}
        </div>
      ))}
    </div>
  )
})

/** Start, center and end alignment along the side. */
export const PopoverAlignments = clientEntry(import.meta.url, function PopoverAlignments() {
  return () => (
    <div mix={rowStyles}>
      {(['start', 'center', 'end'] as const).map((align) => (
        <Popover key={align}>
          <PopoverTrigger mix={buttonVariants({ variant: 'outline', size: 'sm' })}>
            {align[0].toUpperCase() + align.slice(1)}
          </PopoverTrigger>
          <PopoverContent align={align} mix={narrowStyles}>
            Aligned to {align}
          </PopoverContent>
        </Popover>
      ))}
    </div>
  )
})

const fieldsStyles = css({ display: 'grid', gap: space(3) })
const fieldStyles = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 6rem), 1fr))',
  alignItems: 'center',
  gap: space(2),
  '& label': { fontWeight: 500 },
})
const inputStyles = css({
  minWidth: 0,
  minHeight: space(8),
  paddingInline: space(2.5),
  border: '1px solid var(--input)',
  borderRadius: 'var(--radius-md)',
  backgroundColor: 'transparent',
})
const actionsStyles = css({ display: 'flex', justifyContent: 'flex-end', gap: space(2) })

/**
 * Fields in a popover. They keep what you type while it's closed, because the
 * popover stays in the document. Save closes it and returns focus to the trigger.
 */
export const PopoverWithForm = clientEntry(import.meta.url, function PopoverWithForm(handle: Handle) {
  return () => {
    let days = `${handle.id}-days`
    let repeat = `${handle.id}-repeat`

    return (
      <Popover>
        <PopoverTrigger mix={buttonVariants({ variant: 'outline' })}>Reminder schedule</PopoverTrigger>
        <PopoverContent align="start">
          <PopoverHeader>
            <PopoverTitle>Reminder schedule</PopoverTitle>
            <PopoverDescription>When Acme Labs hears about an open invoice.</PopoverDescription>
          </PopoverHeader>
          <div mix={fieldsStyles}>
            <div mix={fieldStyles}>
              <label for={days}>Days after due</label>
              <input id={days} type="number" min={1} defaultValue="3" mix={inputStyles} />
            </div>
            <div mix={fieldStyles}>
              <label for={repeat}>Repeat every</label>
              <input id={repeat} defaultValue="7 days" mix={inputStyles} />
            </div>
          </div>
          <div mix={actionsStyles}>
            <PopoverClose mix={buttonVariants({ size: 'sm' })}>Save</PopoverClose>
          </div>
        </PopoverContent>
      </Popover>
    )
  }
})

const reasonText: Record<PopoverOpenChangeReason, string> = {
  'trigger-press': 'the trigger',
  'close-press': 'the close button',
  'escape-key': 'Escape',
  'outside-press': 'a press outside',
  'focus-out': 'focus leaving it',
  'parent-dismissed': 'its parent closing',
  'trigger-removed': 'its trigger going away',
}

/**
 * A popover you control: its open prop follows your state, which the
 * open-change event updates, and another button opens it too.
 */
export const PopoverControlled = clientEntry(import.meta.url, function PopoverControlled(handle: Handle) {
  let open = false
  let last = ''

  return () => (
    <div mix={stackStyles}>
      <div mix={rowStyles}>
        <Popover open={open}>
          <PopoverTrigger mix={buttonVariants({ variant: 'outline' })}>Overdue invoices</PopoverTrigger>
          <PopoverContent
            align="start"
            mix={on(popoverOpenChangeType, (event) => {
              open = event.open
              last = `${event.open ? 'Opened' : 'Closed'} by ${reasonText[event.reason]}.`
              void handle.update()
            })}
          >
            <PopoverHeader>
              <PopoverTitle>3 overdue invoices</PopoverTitle>
              <PopoverDescription>INV-0042, INV-0047 and INV-0051 are past due.</PopoverDescription>
            </PopoverHeader>
            <PopoverClose mix={buttonVariants({ variant: 'outline', size: 'sm' })}>Close</PopoverClose>
          </PopoverContent>
        </Popover>
        <button
          type="button"
          mix={[
            buttonVariants({ variant: 'ghost' }),
            on('click', () => {
              open = true
              last = 'Opened by the other button.'
              void handle.update()
            }),
          ]}
        >
          Show overdue
        </button>
      </div>
      <p role="status" mix={hintStyles}>
        {last}
      </p>
    </div>
  )
})

/**
 * A popover inside another. Presses and focus in the inner one keep the outer
 * one open, and Escape closes the inner one first.
 */
export const PopoverNested = clientEntry(import.meta.url, function PopoverNested() {
  return () => (
    <Popover>
      <PopoverTrigger mix={buttonVariants({ variant: 'outline' })}>Filters</PopoverTrigger>
      <PopoverContent align="start">
        <PopoverHeader>
          <PopoverTitle>Filters</PopoverTitle>
          <PopoverDescription>Show invoices that match.</PopoverDescription>
        </PopoverHeader>
        <div>
          <Popover>
            <PopoverTrigger mix={buttonVariants({ variant: 'outline', size: 'sm' })}>Customer</PopoverTrigger>
            <PopoverContent side="inline-end" align="start" mix={narrowStyles}>
              <PopoverTitle>Customer</PopoverTitle>
              <PopoverClose mix={buttonVariants({ variant: 'ghost', size: 'sm' })}>Acme Labs</PopoverClose>
              <PopoverClose mix={buttonVariants({ variant: 'ghost', size: 'sm' })}>Globex</PopoverClose>
            </PopoverContent>
          </Popover>
        </div>
      </PopoverContent>
    </Popover>
  )
})

/**
 * A modal popover: the page behind it can't be scrolled or used while it's
 * open, and focus stays in it and its trigger.
 */
export const PopoverModal = clientEntry(import.meta.url, function PopoverModal() {
  return () => (
    <Popover modal>
      <PopoverTrigger mix={buttonVariants({ variant: 'outline' })}>Void invoice</PopoverTrigger>
      <PopoverContent align="start">
        <PopoverHeader>
          <PopoverTitle>Void INV-0042?</PopoverTitle>
          <PopoverDescription>Acme Labs won't be able to pay it anymore.</PopoverDescription>
        </PopoverHeader>
        <div mix={actionsStyles}>
          <PopoverClose mix={buttonVariants({ variant: 'outline', size: 'sm' })}>Keep</PopoverClose>
          <PopoverClose mix={buttonVariants({ variant: 'destructive', size: 'sm' })}>Void</PopoverClose>
        </div>
      </PopoverContent>
    </Popover>
  )
})
