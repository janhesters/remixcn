// RemixCN Drawer examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'

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
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerSnapPointButton,
  DrawerTitle,
  DrawerTrigger,
} from '#remixcn/ui/drawer.tsx'
import type { DrawerSnapPoint, DrawerSnapPointChangeReason, DrawerSwipeDirection } from '#remixcn/ui/drawer.tsx'

// Every example handles events, so each is a client entry: its drawer parts
// run in the browser inside it. Before the browser runs them, triggers and
// close buttons still open and close the native dialog in browsers with
// invoker commands, and the drawer slides in without gestures.

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const outline = buttonVariants({ variant: 'outline' })
const rowStyles = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space(2) })
const bodyStyles = css({ padding: space(4) })
// A stand-in for content: a muted block, as tall as shadcn's on a vertical drawer, and filling a side drawer.
const placeholderStyles = css({
  height: '20rem',
  borderRadius: 'var(--radius-lg)',
  backgroundColor: 'var(--muted)',
  ':where([data-swipe-axis="x"]) &': { height: '100%', minHeight: '8rem' },
})
const growStyles = css({ flex: '1 1 auto', minHeight: 0, padding: space(4) })
const edgeStyles = css({
  height: '20rem',
  backgroundColor: 'light-dark(oklch(0.9 0.05 250), oklch(0.35 0.06 250))',
})
// A scroll region between the header and the footer: it shrinks in the drawer's column, so both stay in view.
const scrollStyles = css({
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  padding: space(4),
  '& p': { margin: `0 0 ${space(4)}` },
})
const fieldsStyles = css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(4), padding: space(4) })
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
// The list scrolls on its own, so the header and its snap buttons stay in view.
const listStyles = css({
  display: 'grid',
  alignContent: 'start',
  gap: space(2),
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  margin: 0,
  padding: space(4),
  listStyle: 'none',
  '& li': {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: space(2),
    padding: space(3),
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
  },
})
const snapButtonsStyles = css({ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: space(2) })
const statusStyles = css({
  margin: 0,
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
})
// Custom sizes: a shorter vertical drawer, and side drawers wider or narrower than 24rem.
const customSizes: Record<DrawerSwipeDirection, ReturnType<typeof css>> = {
  down: css({ height: '16rem' }),
  up: css({ height: '50vh' }),
  left: css({ width: 'min(100%, 36rem)' }),
  right: css({ width: 'min(100%, 20rem)' }),
}

const directions: DrawerSwipeDirection[] = ['up', 'right', 'down', 'left']
const directionNames: Record<DrawerSwipeDirection, string> = { up: 'Up', right: 'Right', down: 'Down', left: 'Left' }

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

const invoices = Array.from({ length: 16 }, (_, index) => ({
  number: `INV-${String(43 + index).padStart(4, '0')}`,
  amount: `CHF ${(180 + index * 75).toLocaleString('en-US')}.00`,
}))

function Placeholder() {
  return () => <div mix={placeholderStyles} />
}

function PayHeader() {
  return () => (
    <DrawerHeader>
      <DrawerTitle>Pay INV-0042</DrawerTitle>
      <DrawerDescription>CHF 1,250.00 to Acme Labs, due on 30 November.</DrawerDescription>
    </DrawerHeader>
  )
}

function PayFooter() {
  return () => (
    <DrawerFooter>
      <Button>Pay now</Button>
      <DrawerClose mix={outline}>Cancel</DrawerClose>
    </DrawerFooter>
  )
}

function PayBody() {
  return () => (
    <div mix={bodyStyles}>
      <Placeholder />
    </div>
  )
}

/** The demo: a header, content and a footer, and the same drawer with only some of them. */
export const DrawerDemo = clientEntry(import.meta.url, function DrawerDemo() {
  return () => (
    <div mix={rowStyles}>
      <Drawer>
        <DrawerTrigger mix={outline}>Pay invoice</DrawerTrigger>
        <DrawerContent>
          <PayHeader />
          <PayBody />
          <PayFooter />
        </DrawerContent>
      </Drawer>
      <Drawer>
        <DrawerTrigger mix={outline}>Header</DrawerTrigger>
        <DrawerContent>
          <PayHeader />
          <PayBody />
        </DrawerContent>
      </Drawer>
      <Drawer>
        <DrawerTrigger mix={outline}>Footer</DrawerTrigger>
        <DrawerContent aria-label="Pay INV-0042">
          <PayBody />
          <PayFooter />
        </DrawerContent>
      </Drawer>
      <Drawer>
        <DrawerTrigger mix={outline}>Edge to edge</DrawerTrigger>
        <DrawerContent aria-label="Invoice preview">
          <div mix={edgeStyles} />
        </DrawerContent>
      </Drawer>
    </div>
  )
})

function SideDrawer(
  handle: Handle<{ direction: DrawerSwipeDirection; showSwipeHandle?: boolean; children?: RemixNode }>,
) {
  return () => {
    let { direction, showSwipeHandle, children } = handle.props
    return (
      <Drawer swipeDirection={direction} showSwipeHandle={showSwipeHandle}>
        <DrawerTrigger mix={outline}>{directionNames[direction]}</DrawerTrigger>
        {children}
      </Drawer>
    )
  }
}

/** A drawer on each edge, which a swipe toward that edge closes. */
export const DrawerSides = clientEntry(import.meta.url, function DrawerSides() {
  return () => (
    <div mix={rowStyles}>
      {directions.map((direction) => (
        <SideDrawer key={direction} direction={direction}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Payment goal</DrawerTitle>
              <DrawerDescription>Set how much you want to collect this month.</DrawerDescription>
            </DrawerHeader>
            <div mix={growStyles}>
              <Placeholder />
            </div>
            <DrawerFooter>
              <Button>Save goal</Button>
              <DrawerClose mix={outline}>Cancel</DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </SideDrawer>
      ))}
    </div>
  )
})

/** The swipe handle on each edge: the bar a mouse or a pen drags the drawer by. */
export const DrawerWithSwipeHandle = clientEntry(import.meta.url, function DrawerWithSwipeHandle() {
  return () => (
    <div mix={rowStyles}>
      {directions.map((direction) => (
        <SideDrawer key={direction} direction={direction} showSwipeHandle>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Drawer</DrawerTitle>
              <DrawerDescription>Drag it by its handle, or swipe it on a touch screen.</DrawerDescription>
            </DrawerHeader>
            <div mix={growStyles}>
              <Placeholder />
            </div>
            <DrawerFooter>
              <DrawerClose mix={outline}>Close</DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </SideDrawer>
      ))}
    </div>
  )
})

/** Long content in a scroll region of its own, between a header and a footer that stay in view. */
export const DrawerScrollableContent = clientEntry(import.meta.url, function DrawerScrollableContent() {
  return () => (
    <div mix={rowStyles}>
      {directions.map((direction) => (
        <SideDrawer key={direction} direction={direction}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Invoice history</DrawerTitle>
              <DrawerDescription>Everything that happened to INV-0042.</DrawerDescription>
            </DrawerHeader>
            <div mix={scrollStyles} tabIndex={0} role="region" aria-label="History">
              {[...notes, ...notes].map((note, index) => (
                <p key={index}>{note}</p>
              ))}
            </div>
            <DrawerFooter>
              <DrawerClose mix={outline}>Close</DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </SideDrawer>
      ))}
    </div>
  )
})

/** Your own sizes: a shorter drawer at the bottom, half the screen at the top, and a wide and a narrow side drawer. */
export const DrawerCustomSize = clientEntry(import.meta.url, function DrawerCustomSize() {
  return () => (
    <div mix={rowStyles}>
      {(['down', 'up', 'left', 'right'] as const).map((direction) => (
        <SideDrawer key={direction} direction={direction}>
          <DrawerContent mix={customSizes[direction]}>
            <DrawerHeader>
              <DrawerTitle>{directionNames[direction]} drawer</DrawerTitle>
              <DrawerDescription>
                A drawer with a custom {direction === 'up' || direction === 'down' ? 'height' : 'width'}.
              </DrawerDescription>
            </DrawerHeader>
            <div mix={scrollStyles} tabIndex={0} role="region" aria-label="Notes">
              {notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
            <DrawerFooter>
              <DrawerClose mix={outline}>Close</DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </SideDrawer>
      ))}
    </div>
  )
})

const snapPoints: DrawerSnapPoint[] = ['20rem', 1]

/**
 * Snap points: the drawer opens at a 20rem peek and drags up to its full
 * height. Its buttons do the same from the keyboard, and the list scrolls
 * inside the part that shows at either point.
 */
export const DrawerSnapPoints = clientEntry(import.meta.url, function DrawerSnapPoints() {
  return () => (
    <Drawer snapPoints={snapPoints} showSwipeHandle>
      <DrawerTrigger mix={outline}>Open invoices</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Open invoices</DrawerTitle>
          <DrawerDescription>Drag the drawer between a peek and its full height.</DrawerDescription>
          <div mix={snapButtonsStyles}>
            <DrawerSnapPointButton snapPoint="20rem" mix={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Peek
            </DrawerSnapPointButton>
            <DrawerSnapPointButton snapPoint={1} mix={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Full height
            </DrawerSnapPointButton>
          </div>
        </DrawerHeader>
        <ul mix={listStyles}>
          {invoices.map((invoice) => (
            <li key={invoice.number}>
              <a href={`#${invoice.number}`}>{invoice.number}</a>
              <span>{invoice.amount}</span>
            </li>
          ))}
        </ul>
      </DrawerContent>
    </Drawer>
  )
})

function NestedLevel(handle: Handle<{ direction: DrawerSwipeDirection; depth: number }>) {
  let titles = ['Invoice INV-0042', 'Payment of CHF 600.00', 'Bank transfer']
  let descriptions = [
    'Open the payments made to it.',
    'Open the transfer it came with.',
    'The frontmost drawer in the stack.',
  ]

  return () => {
    let { direction, depth } = handle.props
    return (
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{titles[depth]}</DrawerTitle>
          <DrawerDescription>{descriptions[depth]}</DrawerDescription>
        </DrawerHeader>
        <div mix={growStyles}>
          <Placeholder />
        </div>
        <DrawerFooter>
          {depth < 2 ? (
            <Drawer swipeDirection={direction} showSwipeHandle>
              <DrawerTrigger mix={buttonVariants()}>{depth === 0 ? 'Open payment' : 'Open transfer'}</DrawerTrigger>
              <NestedLevel direction={direction} depth={depth + 1} />
            </Drawer>
          ) : null}
          <DrawerClose mix={outline}>Close</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    )
  }
}

/** Drawers opened from inside each other. The ones behind stay mounted, shrink and peek out behind the frontmost. */
export const DrawerNested = clientEntry(import.meta.url, function DrawerNested() {
  return () => (
    <div mix={rowStyles}>
      {directions.map((direction) => (
        <SideDrawer key={direction} direction={direction} showSwipeHandle>
          <NestedLevel direction={direction} depth={0} />
        </SideDrawer>
      ))}
    </div>
  )
})

/** A drawer beside the page: the page stays usable, and a press outside doesn't close it. */
export const DrawerNonModal = clientEntry(import.meta.url, function DrawerNonModal() {
  return () => (
    <Drawer modal={false} disablePointerDismissal swipeDirection="right" showSwipeHandle>
      <DrawerTrigger mix={outline}>Not modal</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Reminder schedule</DrawerTitle>
          <DrawerDescription>The page stays usable beside this drawer.</DrawerDescription>
        </DrawerHeader>
        <div mix={growStyles}>
          <Placeholder />
        </div>
        <DrawerFooter>
          <DrawerClose mix={outline}>Close</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
})

/** A form in a drawer. The drawer stays where you render it, so its fields submit with the form around it. */
export const DrawerWithForm = clientEntry(import.meta.url, function DrawerWithForm(handle: Handle<{ action: string }>) {
  return () => {
    let id = handle.id

    return (
      <form action={handle.props.action} method="post">
        <Drawer>
          <DrawerTrigger mix={outline}>Edit customer</DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Edit customer</DrawerTitle>
              <DrawerDescription>Change the billing contact of Acme Labs. Save when you're done.</DrawerDescription>
            </DrawerHeader>
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
            <DrawerFooter>
              <Button type="submit">Save changes</Button>
              <DrawerClose mix={outline}>Cancel</DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </form>
    )
  }
})

/**
 * A drawer whose owner keeps its open state and snap point, renders the new
 * values from onOpenChange and onSnapPointChange, and shows why they changed.
 */
export const DrawerControlled = clientEntry(import.meta.url, function DrawerControlled(handle: Handle) {
  let open = false
  let snapPoint: DrawerSnapPoint | null = '20rem'
  let reason: DialogChangeReason | DrawerSnapPointChangeReason | 'none yet' = 'none yet'

  return () => (
    <div mix={fieldsStyles}>
      <Drawer
        open={open}
        onOpenChange={(next, details) => {
          open = next
          reason = details.reason
          void handle.update()
        }}
        snapPoints={snapPoints}
        snapPoint={snapPoint}
        onSnapPointChange={(next, details) => {
          snapPoint = next
          reason = details.reason
          void handle.update()
        }}
        showSwipeHandle
      >
        <div mix={rowStyles}>
          <DrawerTrigger mix={outline}>Open controlled drawer</DrawerTrigger>
        </div>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Invoice INV-0042</DrawerTitle>
            <DrawerDescription>CHF 1,250.00, due on 30 November.</DrawerDescription>
            <div mix={snapButtonsStyles}>
              <DrawerSnapPointButton snapPoint="20rem" mix={buttonVariants({ variant: 'outline', size: 'sm' })}>
                Peek
              </DrawerSnapPointButton>
              <DrawerSnapPointButton snapPoint={1} mix={buttonVariants({ variant: 'outline', size: 'sm' })}>
                Full height
              </DrawerSnapPointButton>
            </div>
          </DrawerHeader>
          <div mix={scrollStyles} tabIndex={0} role="region" aria-label="History">
            {notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </div>
          <DrawerFooter>
            <DrawerClose mix={outline}>Close</DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
      <p mix={statusStyles} data-reason={reason} data-snap-point={String(snapPoint)}>
        Last change: {reason}. Snap point: {String(snapPoint)}.
      </p>
    </div>
  )
})

/** A drawer that starts open. The server renders it open, so it reads before any script runs. */
export const DrawerStartsOpen = clientEntry(import.meta.url, function DrawerStartsOpen() {
  return () => (
    <Drawer defaultOpen showSwipeHandle>
      <DrawerTrigger mix={outline}>Show notice</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>New payment terms</DrawerTitle>
          <DrawerDescription>From 1 January, invoices are due 30 days after they are sent.</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <DrawerClose mix={outline}>Got it</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
})

function ProfileFields(handle: Handle<{ padded?: boolean }>) {
  return () => {
    let id = handle.id
    return (
      <div mix={handle.props.padded ? fieldsStyles : dialogFieldsStyles}>
        <label for={`${id}-email`} mix={fieldStyles}>
          Billing email
          <input id={`${id}-email`} type="email" defaultValue="billing@acme.example" mix={inputStyles} />
        </label>
        <label for={`${id}-contact`} mix={fieldStyles}>
          Contact
          <input id={`${id}-contact`} defaultValue="Mira Keller" mix={inputStyles} />
        </label>
      </div>
    )
  }
}

const dialogFieldsStyles = css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(4) })
// shadcn's md breakpoint, 768px.
const wideQuery = '(min-width: 48rem)'

/**
 * A Dialog on a wide screen and a Drawer on a narrow one, as in shadcn's
 * responsive example. The server can't know the width, so it renders the
 * Drawer, and the Dialog takes over once the browser runs this entry on a
 * wide screen.
 */
export const DrawerResponsive = clientEntry(import.meta.url, function DrawerResponsive(handle: Handle) {
  let wide = false
  handle.queueTask(() => {
    let query = matchMedia(wideQuery)
    let sync = () => {
      wide = query.matches
      void handle.update()
    }
    query.addEventListener('change', sync, { signal: handle.signal })
    sync()
  })

  return () =>
    wide ? (
      <Dialog>
        <DialogTrigger mix={outline}>Edit contact</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit contact</DialogTitle>
            <DialogDescription>Change who gets the invoices of Acme Labs.</DialogDescription>
          </DialogHeader>
          <ProfileFields />
          <DialogFooter>
            <DialogClose mix={outline}>Cancel</DialogClose>
            <Button>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    ) : (
      <Drawer>
        <DrawerTrigger mix={outline}>Edit contact</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Edit contact</DrawerTitle>
            <DrawerDescription>Change who gets the invoices of Acme Labs.</DrawerDescription>
          </DrawerHeader>
          <ProfileFields padded />
          <DrawerFooter>
            <Button>Save changes</Button>
            <DrawerClose mix={outline}>Cancel</DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
})
