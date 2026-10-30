// The Command examples on one synthetic page, with both themes side by side,
// right-to-left text, and a command the page renders outside any client
// entry. It is a test fixture for browser tests and UI reviews, not the
// public site.
import { css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'
import type { ImportMapData } from 'remix/component/server'

import {
  CommandBasic,
  CommandChecked,
  CommandInline,
  CommandManyItems,
  CommandRtl,
  CommandWithGroups,
  CommandWithKeyboardShortcut,
  CommandWithShortcuts,
  CommandYourFilter,
} from '../../../registry/examples/command-example.tsx'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '#remixcn/ui/command.tsx'

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
  gridTemplateColumns: shrinkingColumn,
  gap: space(2),
  '& p': { margin: 0, maxWidth: '40rem', overflowWrap: 'anywhere' },
})
const titleStyles = css({
  margin: 0,
  fontSize: 'var(--text-3xl)',
  lineHeight: 'var(--text-3xl--line-height)',
  fontWeight: 600,
  letterSpacing: '-0.025em',
  // "Command" is one word, wider than a 320px screen at 200% text in some fonts, such as CI's DejaVu Sans.
  overflowWrap: 'anywhere',
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
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 20rem), 1fr))',
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
const mutedStyles = css({
  margin: 0,
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  // Code such as shouldFilter={false} has no break of its own.
  overflowWrap: 'anywhere',
})
const themesStyles = css({
  display: 'grid',
  gap: space(6),
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 22rem), 1fr))',
})
const themePanelStyles = css({
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  justifyItems: 'start',
  gap: space(4),
  alignContent: 'start',
  padding: space(6),
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  backgroundColor: 'var(--background)',
  color: 'var(--foreground)',
  '& h3': { margin: 0, fontSize: 'var(--text-base)', fontWeight: 600 },
})
const serverOnlyStyles = css({
  width: '100%',
  maxWidth: '24rem',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
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

function Example(handle: Handle<{ title: string; description?: string; children?: RemixNode }>) {
  return () => {
    let { title, description, children } = handle.props

    return (
      <figure mix={exampleStyles} data-example={title}>
        <h3>{title}</h3>
        {description ? <p mix={mutedStyles}>{description}</p> : null}
        {children}
      </figure>
    )
  }
}

function Document(
  handle: Handle<{ title: string; stylesheets: string[]; script?: ScriptEntry; children?: RemixNode }>,
) {
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
          {script ? <ImportMap value={script.importMap} /> : null}
          {script?.preloads.map((href) => (
            <link key={href} rel="modulepreload" href={href} />
          ))}
          {script ? <script type="module" src={script.href}></script> : null}
        </head>
        <body>{children}</body>
      </html>
    )
  }
}

function ThemePanel(handle: Handle<{ theme: 'light' | 'dark' }>) {
  return () => {
    let { theme } = handle.props

    return (
      <div data-theme={theme} mix={themePanelStyles} data-panel={theme}>
        <h3>{theme === 'light' ? 'Light' : 'Dark'}</h3>
        <CommandInline />
        <CommandWithGroups />
      </div>
    )
  }
}

export function CommandExamples(handle: Handle<{ stylesheets: string[]; script: ScriptEntry }>) {
  return () => (
    <Document title="RemixCN Command examples" stylesheets={handle.props.stylesheets} script={handle.props.script}>
      <main mix={pageStyles}>
        <header mix={headerStyles}>
          <h1 mix={titleStyles}>Command</h1>
          <p>Every example from registry/examples, rendered on the server and hydrated in its own client entry.</p>
          <p mix={mutedStyles}>
            A synthetic test fixture with invented data, not the public site. Each example only says which command you
            picked.
          </p>
        </header>

        <Section id="inline" title="In the page" description="A command menu without a dialog.">
          <div mix={gridStyles}>
            <Example title="Inline" description="Groups, icons, shortcuts and keywords: try “account”.">
              <CommandInline />
            </Example>
            <Example title="Your filter" description="shouldFilter={false}: the example filters its own customers.">
              <CommandYourFilter />
            </Example>
            <Example title="Checked" description="The current status has a check; Void is disabled.">
              <CommandChecked />
            </Example>
            <Example
              title="Server only"
              description="Rendered by the page, outside any client entry: the list shows, and the search stays off."
            >
              <Command label="Search reports" mix={serverOnlyStyles}>
                <CommandInput placeholder="Search reports…" />
                <CommandList>
                  <CommandEmpty>No reports found.</CommandEmpty>
                  <CommandGroup heading="Reports">
                    <CommandItem>Revenue by month</CommandItem>
                    <CommandItem>
                      <span>Open invoices</span>
                      <CommandShortcut>⌘O</CommandShortcut>
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </Example>
          </div>
        </Section>

        <Section id="dialog" title="Command Dialog" description="A command menu in a modal dialog.">
          <div mix={gridStyles}>
            <Example title="Basic">
              <CommandBasic />
            </Example>
            <Example title="Shortcuts">
              <CommandWithShortcuts />
            </Example>
            <Example title="Groups">
              <CommandWithGroups />
            </Example>
            <Example title="Many groups" description="The list scrolls inside the dialog.">
              <CommandManyItems />
            </Example>
            <Example title="Keyboard shortcut" description="The example listens for the key itself.">
              <CommandWithKeyboardShortcut />
            </Example>
          </div>
        </Section>

        <Section id="themes" title="Themes" description="data-theme on an ancestor reaches the command and its dialog.">
          <div mix={themesStyles}>
            <ThemePanel theme="light" />
            <ThemePanel theme="dark" />
          </div>
        </Section>

        <Section
          id="direction"
          title="Direction"
          description="In right-to-left text, the icon, shortcuts and checks mirror."
        >
          <div mix={gridStyles}>
            <Example title="أوامر">
              <CommandRtl />
            </Example>
          </div>
        </Section>
      </main>
    </Document>
  )
}
