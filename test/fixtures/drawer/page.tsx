// The Drawer examples on one synthetic page, with both themes side by side,
// right-to-left text, and a drawer the page renders outside any client
// entry. It is a test fixture for browser tests and UI reviews, not the
// public site.
import { css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'
import type { ImportMapData } from 'remix/component/server'

import {
  DrawerControlled,
  DrawerCustomSize,
  DrawerDemo,
  DrawerNested,
  DrawerNonModal,
  DrawerResponsive,
  DrawerScrollableContent,
  DrawerSides,
  DrawerSnapPoints,
  DrawerStartsOpen,
  DrawerWithForm,
  DrawerWithSwipeHandle,
} from '../../../registry/examples/drawer-example.tsx'
import { buttonVariants } from '#remixcn/ui/button.tsx'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '#remixcn/ui/drawer.tsx'

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
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 16rem), 1fr))',
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
  '& h3': { margin: 0, fontSize: 'var(--text-base)', fontWeight: 600 },
})
const echoListStyles = css({
  display: 'grid',
  gap: space(1),
  margin: 0,
  '& dt': { fontWeight: 600 },
  '& dd': { margin: 0 },
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

function Example(handle: Handle<{ title: string; description?: string; wide?: boolean; children?: RemixNode }>) {
  return () => {
    let { title, description, wide, children } = handle.props

    return (
      <figure mix={[exampleStyles, wide ? wideStyles : null]} data-example={title}>
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
        <DrawerWithForm action="/echo" />
        <DrawerSnapPoints />
      </div>
    )
  }
}

export function DrawerExamples(handle: Handle<{ stylesheets: string[]; script: ScriptEntry }>) {
  return () => (
    <Document title="RemixCN Drawer examples" stylesheets={handle.props.stylesheets} script={handle.props.script}>
      <main mix={pageStyles}>
        <header mix={headerStyles}>
          <h1 mix={titleStyles}>Drawer</h1>
          <p>Every example from registry/examples, rendered on the server and hydrated in its own client entry.</p>
          <p mix={mutedStyles}>
            A synthetic test fixture with invented data, not the public site. Forms post to /echo, which shows what the
            server received.
          </p>
        </header>

        <Section
          id="drawer"
          title="Drawer"
          description="Dialogs along an edge of the screen that follow the pointer: swipe them closed, or between snap points."
        >
          <div mix={gridStyles}>
            <Example
              title="Demo"
              description="A header, content and a footer, and drawers with only some of them."
              wide
            >
              <DrawerDemo />
            </Example>
            <Example title="Sides" description="A swipe toward its edge closes each one." wide>
              <DrawerSides />
            </Example>
            <Example title="Swipe handle" description="The bar a mouse or a pen drags the drawer by." wide>
              <DrawerWithSwipeHandle />
            </Example>
            <Example title="Scrollable content" description="Long content in a scroll region of its own." wide>
              <DrawerScrollableContent />
            </Example>
            <Example title="Custom size" wide>
              <DrawerCustomSize />
            </Example>
            <Example title="Snap points" description="A peek and the full height, by drag or with its buttons.">
              <DrawerSnapPoints />
            </Example>
            <Example title="Not modal" description="The page stays usable beside it.">
              <DrawerNonModal />
            </Example>
            <Example title="With form" description="The fields submit with the form around the drawer.">
              <DrawerWithForm action="/echo" />
            </Example>
            <Example
              title="Nested"
              description="Drawers opened from inside each other stack behind the frontmost."
              wide
            >
              <DrawerNested />
            </Example>
            <Example title="Responsive" description="A Dialog on a wide screen, a Drawer on a narrow one.">
              <DrawerResponsive />
            </Example>
            <Example title="Controlled" description="The owner keeps the open state and the snap point." wide>
              <DrawerControlled />
            </Example>
            <Example
              title="Server only"
              description="Rendered by the page, outside any client entry, so only the browser's invoker commands run it."
              wide
            >
              <Drawer>
                <DrawerTrigger mix={buttonVariants({ variant: 'outline' })}>Open native drawer</DrawerTrigger>
                <DrawerContent>
                  <DrawerHeader>
                    <DrawerTitle>Native drawer</DrawerTitle>
                    <DrawerDescription>No script runs this drawer. The browser opens and closes it.</DrawerDescription>
                  </DrawerHeader>
                  <DrawerFooter>
                    <DrawerClose mix={buttonVariants({ variant: 'outline' })}>Close</DrawerClose>
                  </DrawerFooter>
                </DrawerContent>
              </Drawer>
            </Example>
          </div>
        </Section>

        <Section
          id="themes"
          title="Themes"
          description="data-theme on an ancestor reaches the drawer in the top layer."
        >
          <div mix={themesStyles}>
            <ThemePanel theme="light" />
            <ThemePanel theme="dark" />
          </div>
        </Section>

        <Section
          id="direction"
          title="Direction"
          description="In right-to-left text, the text aligns to the right. Swipe directions stay physical."
        >
          <div dir="rtl" lang="ar" mix={gridStyles}>
            <Example title="درج" wide>
              <DrawerSides />
            </Example>
            <Example title="نقاط">
              <DrawerSnapPoints />
            </Example>
          </div>
        </Section>
      </main>
    </Document>
  )
}

/** A page with a drawer that is open before any script runs. */
export function StartsOpen(handle: Handle<{ stylesheets: string[]; script: ScriptEntry }>) {
  return () => (
    <Document title="Starts open" stylesheets={handle.props.stylesheets} script={handle.props.script}>
      <main mix={pageStyles}>
        <h1 mix={titleStyles}>Invoices</h1>
        <button type="button">Behind the drawer</button>
        <DrawerStartsOpen />
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
