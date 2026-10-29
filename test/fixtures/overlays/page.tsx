// The Popover, Hover Card and Tooltip examples on one synthetic page, with
// one of each open, both themes side by side, right-to-left text and parts
// the server renders outside any client entry. It is a test fixture for
// browser tests and UI reviews, not the public site.
import { css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'
import type { ImportMapData } from 'remix/component/server'

import { HoverCardBasic, HoverCardDelays, HoverCardSides } from '../../../registry/examples/hover-card-example.tsx'
import {
  PopoverAlignments,
  PopoverBasic,
  PopoverControlled,
  PopoverModal,
  PopoverNested,
  PopoverSides,
  PopoverWithForm,
} from '../../../registry/examples/popover-example.tsx'
import {
  TooltipBasic,
  TooltipDisabled,
  TooltipFormatted,
  TooltipLongContent,
  TooltipOnLink,
  TooltipSides,
  TooltipToolbar,
  TooltipWithIcon,
  TooltipWithKeyboard,
} from '../../../registry/examples/tooltip-example.tsx'
import { buttonVariants } from '#remixcn/ui/button.tsx'
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '#remixcn/ui/popover.tsx'
import { Tooltip, TooltipContent, TooltipTrigger } from '#remixcn/ui/tooltip.tsx'
import { OpenHoverCard, OpenPopover, OpenTooltip } from './open.tsx'

interface ScriptEntry {
  href: string
  importMap: ImportMapData
  preloads: readonly string[]
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const shrinkingColumn = 'minmax(0, 1fr)'

const pageStyles = css({
  maxWidth: '72rem',
  marginInline: 'auto',
  padding: space(6),
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  gap: space(12),
  '@media (max-width: 40rem)': { padding: space(4), gap: space(10) },
})
const headerStyles = css({
  display: 'grid',
  gap: space(2),
  '& p': { margin: 0, maxWidth: '40rem', overflowWrap: 'anywhere' },
})
const titleStyles = css({
  margin: 0,
  fontSize: 'var(--text-3xl)',
  lineHeight: 'var(--text-3xl--line-height)',
  fontWeight: 600,
  letterSpacing: '-0.025em',
})
const sectionStyles = css({ display: 'grid', gridTemplateColumns: shrinkingColumn, gap: space(6) })
const sectionTitleStyles = css({
  margin: 0,
  fontSize: 'var(--text-xl)',
  lineHeight: 'var(--text-xl--line-height)',
  fontWeight: 600,
})
const gridStyles = css({
  display: 'grid',
  gap: space(6),
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 22rem), 1fr))',
})
const exampleStyles = css({
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  alignContent: 'start',
  justifyItems: 'start',
  gap: space(3),
  margin: 0,
  padding: space(5),
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  '& > h3': { margin: 0, fontSize: 'var(--text-base)', lineHeight: 'var(--text-base--line-height)', fontWeight: 600 },
})
const wideStyles = css({ gridColumn: '1 / -1' })
const mutedStyles = css({
  margin: 0,
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
})
// Room below or above the trigger for the popup that is open from the start.
const roomBelow = (rem: number) => css({ minHeight: `${rem}rem` })
const roomAbove = css({ paddingTop: space(10) })
const themesStyles = css({
  display: 'grid',
  gap: space(6),
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 22rem), 1fr))',
})
const themePanelStyles = css({
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  gap: space(5),
  alignContent: 'start',
  padding: space(6),
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  '& h3': { margin: 0, fontSize: 'var(--text-base)', fontWeight: 600 },
})

function Section(handle: Handle<{ id: string; title: string; description: string; children?: RemixNode }>) {
  return () => {
    let { id, title, description, children } = handle.props

    return (
      <section aria-labelledby={id} mix={sectionStyles}>
        <h2 id={id} mix={sectionTitleStyles}>
          {title}
        </h2>
        <p mix={mutedStyles}>{description}</p>
        {children}
      </section>
    )
  }
}

function Example(
  handle: Handle<{ title: string; name: string; description?: string; wide?: boolean; children?: RemixNode }>,
) {
  return () => {
    let { title, name, description, wide, children } = handle.props

    return (
      <figure mix={[exampleStyles, wide ? wideStyles : null]} data-example={name}>
        <h3>{title}</h3>
        {description ? <p mix={mutedStyles}>{description}</p> : null}
        {children}
      </figure>
    )
  }
}

function Document(handle: Handle<{ title: string; stylesheets: string[]; script: ScriptEntry; children?: RemixNode }>) {
  return () => {
    let { title, stylesheets, script, children } = handle.props

    return (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content="light dark" />
          {stylesheets.map((href) => (
            <link key={href} rel="stylesheet" href={href} />
          ))}
          <title>{title}</title>
          <ImportMap value={script.importMap} />
          {script.preloads.map((href) => (
            <link key={href} rel="modulepreload" href={href} />
          ))}
          <script type="module" src={script.href}></script>
        </head>
        <body>{children}</body>
      </html>
    )
  }
}

/** One of each, open, with room for the popup beside its trigger. */
function OpenSet(handle: Handle<{ prefix: string }>) {
  return () => {
    let { prefix } = handle.props

    return (
      <div mix={gridStyles}>
        <Example title="Popover" name={`${prefix}-popover`}>
          <div mix={roomBelow(16)}>
            <OpenPopover />
          </div>
        </Example>
        <Example title="Hover Card" name={`${prefix}-hover-card`}>
          <div mix={roomBelow(9)}>
            <OpenHoverCard />
          </div>
        </Example>
        <Example title="Tooltip" name={`${prefix}-tooltip`}>
          <div mix={roomAbove}>
            <OpenTooltip />
          </div>
        </Example>
      </div>
    )
  }
}

function ThemePanel(handle: Handle<{ theme: 'light' | 'dark' }>) {
  return () => {
    let { theme } = handle.props

    return (
      <div data-theme={theme} mix={themePanelStyles}>
        <h3>{theme === 'light' ? 'Light' : 'Dark'}</h3>
        <OpenSet prefix={theme} />
      </div>
    )
  }
}

export function OverlayExamples(handle: Handle<{ stylesheets: string[]; script: ScriptEntry }>) {
  return () => (
    <Document
      title="RemixCN Popover, Hover Card and Tooltip examples"
      stylesheets={handle.props.stylesheets}
      script={handle.props.script}
    >
      <main mix={pageStyles}>
        <header mix={headerStyles}>
          <h1 mix={titleStyles}>Popover, Hover Card and Tooltip</h1>
          <p>Every example from registry/examples, rendered on the server and hydrated as client entries.</p>
          <p mix={mutedStyles}>A synthetic test fixture with invented data, not the public site.</p>
        </header>

        <Section
          id="open"
          title="Open"
          description="One of each, open from the start. They show in the top layer, next to their triggers."
        >
          <OpenSet prefix="open" />
        </Section>

        <Section
          id="popover"
          title="Popover"
          description="A click opens it with focus inside. Escape, a press elsewhere, Tab out and Close return focus."
        >
          <div mix={gridStyles}>
            <Example title="Basic" name="popover-basic">
              <PopoverBasic />
            </Example>
            <Example title="Sides" name="popover-sides">
              <PopoverSides />
            </Example>
            <Example title="Alignments" name="popover-alignments">
              <PopoverAlignments />
            </Example>
            <Example title="With form" name="popover-form" description="What you type stays while it's closed.">
              <PopoverWithForm />
            </Example>
            <Example title="Controlled" name="popover-controlled" description="Its state follows the change events.">
              <PopoverControlled />
            </Example>
            <Example title="Nested" name="popover-nested" description="Escape closes the inner one first.">
              <PopoverNested />
            </Example>
            <Example title="Modal" name="popover-modal" description="The page behind it waits.">
              <PopoverModal />
            </Example>
          </div>
        </Section>

        <Section
          id="hover-card"
          title="Hover Card"
          description="The pointer resting on a link, or keyboard focus, opens it. Touch follows the link."
        >
          <div mix={gridStyles}>
            <Example title="Basic" name="hover-card-basic">
              <HoverCardBasic />
            </Example>
            <Example title="Sides" name="hover-card-sides" wide>
              <HoverCardSides />
            </Example>
            <Example title="Delays" name="hover-card-delays">
              <HoverCardDelays />
            </Example>
          </div>
        </Section>

        <Section
          id="tooltip"
          title="Tooltip"
          description="Hover and keyboard focus open it, Escape closes it, and it describes its trigger."
        >
          <div mix={gridStyles}>
            <Example title="Basic" name="tooltip-basic">
              <TooltipBasic />
            </Example>
            <Example title="Sides" name="tooltip-sides" wide>
              <TooltipSides />
            </Example>
            <Example title="With icon" name="tooltip-icon">
              <TooltipWithIcon />
            </Example>
            <Example title="Long content" name="tooltip-long">
              <TooltipLongContent />
            </Example>
            <Example title="Disabled" name="tooltip-disabled" description="The button stays focusable.">
              <TooltipDisabled />
            </Example>
            <Example title="With keyboard shortcut" name="tooltip-keyboard">
              <TooltipWithKeyboard />
            </Example>
            <Example title="On a link" name="tooltip-link">
              <TooltipOnLink />
            </Example>
            <Example title="Formatted" name="tooltip-formatted">
              <TooltipFormatted />
            </Example>
            <Example title="Toolbar" name="tooltip-toolbar" description="Shared delays: the next one opens at once.">
              <TooltipToolbar />
            </Example>
          </div>
        </Section>

        <Section id="themes" title="Themes" description="data-theme overrides the system preference inside it.">
          <div mix={themesStyles}>
            <ThemePanel theme="light" />
            <ThemePanel theme="dark" />
          </div>
        </Section>

        <Section
          id="right-to-left"
          title="Right to left"
          description="Inline sides, start and end alignment, and offsets mirror."
        >
          <div dir="rtl" lang="ar" mix={sectionStyles}>
            <OpenSet prefix="rtl" />
            <div mix={gridStyles}>
              <Example title="جوانب" name="rtl-popover-sides">
                <PopoverSides />
              </Example>
              <Example title="تلميحات" name="rtl-tooltip-sides">
                <TooltipSides />
              </Example>
            </div>
          </div>
        </Section>

        <Section
          id="server-only"
          title="Server only"
          description="Rendered by the page, outside any client entry, so no component code runs in the browser."
        >
          <div mix={gridStyles}>
            <Example
              title="Popover"
              name="server-popover"
              description="The browser opens it natively, in the middle of the screen."
            >
              <Popover>
                <PopoverTrigger mix={buttonVariants({ variant: 'outline' })}>Payment terms</PopoverTrigger>
                <PopoverContent>
                  <PopoverHeader>
                    <PopoverTitle>Payment terms</PopoverTitle>
                    <PopoverDescription>Invoices are due 30 days after they are sent.</PopoverDescription>
                  </PopoverHeader>
                  <div>
                    <PopoverClose mix={buttonVariants({ variant: 'outline', size: 'sm' })}>Close</PopoverClose>
                  </div>
                </PopoverContent>
              </Popover>
            </Example>
            <Example title="Tooltip" name="server-tooltip" description="Its text still describes the trigger.">
              <Tooltip>
                <TooltipTrigger mix={buttonVariants({ variant: 'outline' })}>Archive</TooltipTrigger>
                <TooltipContent>Moves the invoice to the archive</TooltipContent>
              </Tooltip>
            </Example>
          </div>
        </Section>
      </main>
    </Document>
  )
}
