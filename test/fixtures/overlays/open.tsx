// One of each, open from the start, for the screenshots and the end-to-end
// tests: client entries of the fixture, not examples to copy. The popover
// neither takes focus when it opens on load nor puts it on its trigger when
// a press elsewhere closes it. Each
// tooltip has its own provider: tooltips that share one close each other.
import { clientEntry, css } from 'remix/component'
import type { Handle } from 'remix/component'

import { buttonVariants } from '#remixcn/ui/button.tsx'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '#remixcn/ui/hover-card.tsx'
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '#remixcn/ui/popover.tsx'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '#remixcn/ui/tooltip.tsx'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
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
const actionsStyles = css({ display: 'flex', justifyContent: 'flex-end' })
const cardStyles = css({ display: 'grid', gap: space(1), '& p': { margin: 0 } })
const mutedStyles = css({ color: 'var(--muted-foreground)' })

export const OpenPopover = clientEntry(import.meta.url, function OpenPopover(handle: Handle) {
  return () => {
    let days = `${handle.id}-days`

    return (
      <Popover defaultOpen>
        <PopoverTrigger mix={buttonVariants({ variant: 'outline' })}>Reminder schedule</PopoverTrigger>
        <PopoverContent align="start" initialFocus={false} finalFocus={false}>
          <PopoverHeader>
            <PopoverTitle>Reminder schedule</PopoverTitle>
            <PopoverDescription>When Acme Labs hears about an open invoice.</PopoverDescription>
          </PopoverHeader>
          <div mix={fieldStyles}>
            <label for={days}>Days after due</label>
            <input id={days} type="number" min={1} defaultValue="3" mix={inputStyles} />
          </div>
          <div mix={actionsStyles}>
            <PopoverClose mix={buttonVariants({ size: 'sm' })}>Save</PopoverClose>
          </div>
        </PopoverContent>
      </Popover>
    )
  }
})

export const OpenHoverCard = clientEntry(import.meta.url, function OpenHoverCard() {
  return () => (
    <HoverCard defaultOpen>
      <HoverCardTrigger href="#acme-labs" mix={buttonVariants({ variant: 'link' })}>
        Acme Labs
      </HoverCardTrigger>
      <HoverCardContent align="start">
        <div mix={cardStyles}>
          <p>
            <strong>Acme Labs</strong>
          </p>
          <p>Lab equipment, billed monthly.</p>
          <p mix={mutedStyles}>Customer since March 2021</p>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
})

export const OpenTooltip = clientEntry(import.meta.url, function OpenTooltip() {
  return () => (
    <TooltipProvider>
      <Tooltip defaultOpen>
        <TooltipTrigger mix={buttonVariants({ variant: 'outline' })}>Archive</TooltipTrigger>
        <TooltipContent>Moves the invoice to the archive</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
})
