// RemixCN Sheet examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css } from 'remix/component'
import type { Handle } from 'remix/component'

import { disabledState, invalidState, mergeStyles, transition } from '#remixcn/lib/styles.ts'
import { Button, buttonVariants } from '#remixcn/ui/button.tsx'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '#remixcn/ui/sheet.tsx'
import type { SheetSide } from '#remixcn/ui/sheet.tsx'

// Every example handles events, so each is a client entry. Before the
// browser runs it, the trigger and the close buttons still open and close
// the native dialog in browsers with invoker commands.

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const outline = buttonVariants({ variant: 'outline' })
const rowStyles = css({ display: 'flex', flexWrap: 'wrap', gap: space(2) })
const fieldsStyles = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: space(4),
  paddingInline: space(4),
})
const fieldStyles = css({ display: 'grid', gap: space(2), fontWeight: 500 })
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
// A scroll region between the header and the footer. It shrinks in the
// panel's column, so the header and the footer stay in view.
const scrollStyles = css({
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto',
  paddingInline: space(4),
  '& p': { margin: `0 0 ${space(4)}` },
})
const notesStyles = css({ paddingInline: space(4), '& p': { margin: `0 0 ${space(4)}` } })
const shortSideStyles = css({ '&[data-side="top"], &[data-side="bottom"]': { maxHeight: '50vh' } })

const notes = [
  'INV-0042 was sent on 31 October to billing@acme.example.',
  'A reminder went out on 27 November, 3 days before the due date.',
  'Acme Labs paid CHF 600.00 on 2 December, with reference INV-0042.',
  'The open amount of CHF 650.00 is due on 30 December.',
  'A second reminder goes out on 6 January if the invoice stays open.',
  'Disputes stop the reminders until the dispute is closed.',
  'The invoice is archived 10 years after it is paid.',
  'Statements list every open invoice, credit note and payment of the past 12 months.',
]

/** A form in a sheet on the right. The sheet stays where you render it, so its fields submit with the form. */
export const SheetWithForm = clientEntry(import.meta.url, function SheetWithForm(handle: Handle<{ action: string }>) {
  return () => {
    let id = handle.id

    return (
      <form action={handle.props.action} method="post">
        <Sheet>
          <SheetTrigger mix={outline}>Edit customer</SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Edit customer</SheetTitle>
              <SheetDescription>Change the billing contact of Acme Labs. Save when you're done.</SheetDescription>
            </SheetHeader>
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
            <SheetFooter>
              <Button type="submit">Save changes</Button>
              <SheetClose mix={outline}>Close</SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </form>
    )
  }
})

/** No close button in the corner: the footer's button, Escape and a press outside close it. */
export const SheetNoCloseButton = clientEntry(import.meta.url, function SheetNoCloseButton() {
  return () => (
    <Sheet>
      <SheetTrigger mix={outline}>No close button</SheetTrigger>
      <SheetContent showCloseButton={false}>
        <SheetHeader>
          <SheetTitle>Reminder schedule</SheetTitle>
          <SheetDescription>
            This sheet has no close button in the corner. Close it with the button below, Escape, or a press outside.
          </SheetDescription>
        </SheetHeader>
        <SheetFooter>
          <SheetClose mix={outline}>Done</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
})

const sides: SheetSide[] = ['top', 'right', 'bottom', 'left']
const sideNames: Record<SheetSide, string> = { top: 'Top', right: 'Right', bottom: 'Bottom', left: 'Left' }

/** A sheet on each edge, with long content in a scroll region. Top and bottom sheets take half the screen at most. */
export const SheetSides = clientEntry(import.meta.url, function SheetSides() {
  return () => (
    <div mix={rowStyles}>
      {sides.map((side) => (
        <Sheet key={side}>
          <SheetTrigger mix={outline}>{sideNames[side]}</SheetTrigger>
          <SheetContent side={side} mix={shortSideStyles}>
            <SheetHeader>
              <SheetTitle>Invoice history</SheetTitle>
              <SheetDescription>Everything that happened to INV-0042.</SheetDescription>
            </SheetHeader>
            <div mix={scrollStyles} tabIndex={0} role="region" aria-label="History">
              {notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
            <SheetFooter>
              <SheetClose mix={outline}>Close</SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ))}
    </div>
  )
})

/** Content longer than the screen, without a scroll region: the whole sheet scrolls, and its close button stays in the corner. */
export const SheetLongContent = clientEntry(import.meta.url, function SheetLongContent() {
  return () => (
    <Sheet>
      <SheetTrigger mix={outline}>Long content</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>All notes</SheetTitle>
          <SheetDescription>Every note on every invoice of Acme Labs.</SheetDescription>
        </SheetHeader>
        <div mix={notesStyles}>
          {[...notes, ...notes, ...notes].map((note, index) => (
            <p key={index}>{note}</p>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
})
