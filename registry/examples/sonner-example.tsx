// RemixCN Sonner examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on } from 'remix/component'

import { Button } from '#remixcn/ui/button.tsx'
import { toast } from '#remixcn/ui/sonner.tsx'

// Each example calls Sonner's toast(), which shows in the page's Sonner
// <Toaster />. Render it once, at the end of <body>.

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const rowStyles = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space(2) })

export const SonnerBasic = clientEntry(import.meta.url, function SonnerBasic() {
  return () => (
    <Button variant="outline" mix={on('click', () => void toast('Event has been created'))}>
      Show toast
    </Button>
  )
})

export const SonnerWithDescription = clientEntry(import.meta.url, function SonnerWithDescription() {
  return () => (
    <Button
      variant="outline"
      mix={on('click', () => void toast('Event has been created', { description: 'Monday, January 3rd at 6:00pm' }))}
    >
      Show toast
    </Button>
  )
})

/** toast.success(), info(), warning(), error() and promise(). */
export const SonnerTypes = clientEntry(import.meta.url, function SonnerTypes() {
  return () => (
    <div mix={rowStyles}>
      <Button variant="outline" mix={on('click', () => void toast.success('Event has been created'))}>
        Success
      </Button>
      <Button
        variant="outline"
        mix={on('click', () => void toast.info('Be at the area 10 minutes before the event time'))}
      >
        Info
      </Button>
      <Button
        variant="outline"
        mix={on('click', () => void toast.warning('Event start time cannot be earlier than 8am'))}
      >
        Warning
      </Button>
      <Button variant="outline" mix={on('click', () => void toast.error('Event has not been created'))}>
        Error
      </Button>
      <Button
        variant="outline"
        mix={on('click', () => {
          toast.promise<{ name: string }>(
            () => new Promise((resolve) => setTimeout(() => resolve({ name: 'Event' }), 2000)),
            {
              loading: 'Loading...',
              success: (data) => `${data.name} has been created`,
              error: 'Error',
            },
          )
        })}
      >
        Promise
      </Button>
    </div>
  )
})

/** An action and a cancel button. Each closes the toast after its onClick. */
export const SonnerWithAction = clientEntry(import.meta.url, function SonnerWithAction() {
  return () => (
    <Button
      variant="outline"
      mix={on('click', () => {
        toast('Event has been deleted', {
          description: 'Sunday, December 3 at 9:00 AM',
          action: { label: 'Undo', onClick: () => void toast('Event restored') },
          cancel: { label: 'Keep', onClick: () => {} },
        })
      })}
    >
      Delete event
    </Button>
  )
})

const customStyles = css({
  display: 'grid',
  gap: space(1),
  padding: space(4),
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  '& p': { margin: 0 },
})

/** toast.custom() renders your own content in the toast frame. Its text names the toast and is announced. */
export const SonnerCustom = clientEntry(import.meta.url, function SonnerCustom() {
  return () => (
    <Button
      variant="outline"
      mix={on('click', () => {
        toast.custom(() => (
          <div mix={customStyles}>
            <p>
              <strong>INV-0044 paid</strong>
            </p>
            <p>€320.00 from Lumen Studio.</p>
          </div>
        ))
      })}
    >
      Show custom toast
    </Button>
  )
})
