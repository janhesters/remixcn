// The Dropdown Menu theme picker on one synthetic page: open from the start in
// both themes, the registry example, two pickers, a picker in a form, pickers
// at the window's edges, right-to-left text, and a menu the server renders
// outside any client entry. It is a test fixture for browser tests and UI
// reviews, not the public site.
import { css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'
import type { ImportMapData } from 'remix/component/server'

import { DropdownMenuThemePicker } from '../../../registry/examples/dropdown-menu-example.tsx'
import { buttonVariants } from '#remixcn/ui/button.tsx'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '#remixcn/ui/dropdown-menu.tsx'
import { ThemeMenu } from './open.tsx'

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
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 18rem), 1fr))',
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
  // A long word, such as registry/examples, breaks rather than widening the page at 320px with text at 200%.
  overflowWrap: 'anywhere',
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
})
// Room below the trigger for the menu that is open from the start.
const roomBelow = css({ minHeight: '10rem' })
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
  backgroundColor: 'var(--background)',
  color: 'var(--foreground)',
  '& h3': { margin: 0, fontSize: 'var(--text-base)', fontWeight: 600 },
})
const edgesStyles = css({ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: space(2) })
const formStyles = css({
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  justifyItems: 'start',
  gap: space(3),
  '& label': {
    display: 'grid',
    gap: space(1),
    width: 'min(100%, 20rem)',
    fontSize: 'var(--text-sm)',
    fontWeight: 500,
  },
  '& input': {
    boxSizing: 'border-box',
    width: '100%',
    minWidth: 0,
    minHeight: space(8),
    paddingInline: space(2.5),
    border: '1px solid var(--input)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'transparent',
    color: 'inherit',
    font: 'inherit',
  },
})
const echoListStyles = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, max-content) minmax(0, 1fr)',
  gap: space(2),
  margin: 0,
  '& > div': { display: 'contents' },
  '& dt': { fontWeight: 600, overflowWrap: 'anywhere' },
  '& dd': { margin: 0, overflowWrap: 'anywhere' },
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
      <div data-theme={theme} mix={themePanelStyles} data-example={`open-${theme}`}>
        <h3>{theme === 'light' ? 'Light' : 'Dark'}</h3>
        <div mix={roomBelow}>
          <ThemeMenu name="Theme" defaultValue="dark" defaultOpen modal={false} />
        </div>
      </div>
    )
  }
}

export function DropdownMenuExamples(handle: Handle<{ stylesheets: string[]; script: ScriptEntry }>) {
  return () => (
    <Document
      title="RemixCN Dropdown Menu examples"
      stylesheets={handle.props.stylesheets}
      script={handle.props.script}
    >
      <main mix={pageStyles}>
        <header mix={headerStyles}>
          <h1 mix={titleStyles}>Dropdown Menu</h1>
          <p>A theme picker: one choice of Light, Dark and System, rendered on the server and hydrated.</p>
          <p mix={mutedStyles}>A synthetic test fixture with invented data, not the public site.</p>
        </header>

        <Section
          id="themes"
          title="Themes"
          description="A picker open from the start in each theme, with Dark chosen and its check mark showing."
        >
          <div mix={themesStyles}>
            <ThemePanel theme="light" />
            <ThemePanel theme="dark" />
          </div>
        </Section>

        <Section
          id="examples"
          title="Example"
          description="A click, Enter, Space or an arrow key opens the menu. A choice and Escape close it and put focus back on the button."
        >
          <div mix={gridStyles}>
            <Example title="Theme picker" name="theme" description="The example from registry/examples.">
              <DropdownMenuThemePicker />
            </Example>
            <Example title="Two pickers" name="two" description="Each keeps its own choice.">
              <ThemeMenu name="Editor theme" defaultValue="light" />
              <ThemeMenu name="Preview theme" defaultValue="dark" />
            </Example>
          </div>
        </Section>

        <Section
          id="form"
          title="In a form"
          description="Neither the button nor a choice sends the form, with or without JavaScript. Save does."
        >
          <Example title="Note" name="form">
            <form action="/echo" method="post" mix={formStyles}>
              <label>
                Note
                <input name="note" defaultValue="Call the supplier" />
              </label>
              <ThemeMenu name="Note theme" />
              <button type="submit" mix={buttonVariants()}>
                Save
              </button>
            </form>
          </Example>
        </Section>

        <Section
          id="edges"
          title="At the edges"
          description="Pickers at the start and end of the line stay beside their buttons and inside the window."
        >
          <div mix={edgesStyles} data-example="edges">
            <ThemeMenu name="Start" />
            <ThemeMenu name="End" align="end" />
          </div>
        </Section>

        <Section
          id="direction"
          title="Right to left"
          description="The menu lines up with the start of the line, on the right, and its check marks sit at the end, on the left."
        >
          <div dir="rtl" lang="ar" mix={gridStyles}>
            <Example title="المظهر" name="rtl">
              <ThemeMenu name="المظهر" labels={['فاتح', 'داكن', 'النظام']} />
            </Example>
          </div>
        </Section>

        <Section
          id="server-only"
          title="Server only"
          description="Rendered by the page, outside any client entry, so no component code runs in the browser."
        >
          <Example
            title="Native fallback"
            name="server-only"
            description="The browser opens it in the middle of the screen. Its choices do nothing."
          >
            <DropdownMenu>
              <DropdownMenuTrigger mix={buttonVariants({ variant: 'outline' })}>Theme</DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuRadioGroup aria-label="Theme" defaultValue="light">
                  <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </Example>
        </Section>
      </main>
    </Document>
  )
}

export function Echo(handle: Handle<{ stylesheets: string[]; fields: Array<[string, string]> }>) {
  return () => {
    let { stylesheets, fields } = handle.props

    return (
      <Document title="Received" stylesheets={stylesheets}>
        <main mix={pageStyles}>
          <h1 mix={titleStyles}>Received</h1>
          <dl mix={echoListStyles} data-echo="fields">
            {fields.map(([name, value], index) => (
              <div key={`${name}-${index}`}>
                <dt>{name}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <a href="/">Back to the examples</a>
        </main>
      </Document>
    )
  }
}
