// RemixCN Hover Card examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css } from 'remix/component'

import { buttonVariants } from '#remixcn/ui/button.tsx'
import { HoverCard, HoverCardContent, HoverCardTrigger, hoverCardTrigger } from '#remixcn/ui/hover-card.tsx'

// Each example is a client entry, so its hover cards run in the browser.
// The links work without it.

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const rowStyles = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space(2) })
const cardStyles = css({ display: 'grid', gap: space(1) })
const nameStyles = css({ margin: 0, fontWeight: 600 })
const textStyles = css({ margin: 0 })
const mutedStyles = css({
  margin: 0,
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-xs)',
  lineHeight: 'var(--text-xs--line-height)',
})
const linkStyles = css({ color: 'var(--primary)', textUnderlineOffset: '4px' })

/** A customer link that previews the customer. The link in the card works too. */
export const HoverCardBasic = clientEntry(import.meta.url, function HoverCardBasic() {
  return () => (
    <HoverCard>
      <HoverCardTrigger href="#acme-labs" delay={100} closeDelay={200} mix={buttonVariants({ variant: 'link' })}>
        @acme-labs
      </HoverCardTrigger>
      <HoverCardContent>
        <div mix={cardStyles}>
          <p mix={nameStyles}>Acme Labs</p>
          <p mix={textStyles}>Lab equipment, billed monthly. Pays within 12 days on average.</p>
          <p mix={mutedStyles}>Customer since March 2021</p>
          <a href="#acme-labs-invoices" mix={linkStyles}>
            Open invoices
          </a>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
})

const sides = ['inline-start', 'left', 'top', 'bottom', 'right', 'inline-end'] as const

/** Every side, on buttons that look like Buttons. Inline start and end follow the text direction. */
export const HoverCardSides = clientEntry(import.meta.url, function HoverCardSides() {
  return () => (
    <div mix={rowStyles}>
      {sides.map((side) => (
        <HoverCard key={side}>
          <button
            type="button"
            mix={[buttonVariants({ variant: 'outline' }), hoverCardTrigger({ delay: 100, closeDelay: 100 })]}
          >
            {side.replace('-', ' ')}
          </button>
          <HoverCardContent side={side}>
            <div mix={cardStyles}>
              <p mix={nameStyles}>Hover Card</p>
              <p mix={textStyles}>This hover card appears on the {side.replace('-', ' ')} side of the trigger.</p>
            </div>
          </HoverCardContent>
        </HoverCard>
      ))}
    </div>
  )
})

/**
 * Open and close delays. Base UI's defaults wait 600ms to open and 300ms to
 * close, so moving the pointer across a list opens nothing by accident.
 */
export const HoverCardDelays = clientEntry(import.meta.url, function HoverCardDelays() {
  return () => (
    <div mix={rowStyles}>
      <HoverCard>
        <HoverCardTrigger href="#globex" mix={buttonVariants({ variant: 'link' })}>
          Globex (600ms)
        </HoverCardTrigger>
        <HoverCardContent>
          <p mix={nameStyles}>Globex</p>
          <p mix={textStyles}>Opens after the default delay.</p>
        </HoverCardContent>
      </HoverCard>
      <HoverCard>
        <HoverCardTrigger href="#initech" delay={0} closeDelay={0} mix={buttonVariants({ variant: 'link' })}>
          Initech (at once)
        </HoverCardTrigger>
        <HoverCardContent>
          <p mix={nameStyles}>Initech</p>
          <p mix={textStyles}>Opens at once, and stays while the pointer crosses to it.</p>
        </HoverCardContent>
      </HoverCard>
    </div>
  )
})
