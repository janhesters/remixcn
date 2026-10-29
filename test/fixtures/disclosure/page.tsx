// The Accordion, Collapsible, Tabs and Pagination examples on one synthetic
// page, with both themes side by side and right-to-left text. It is a test
// fixture for browser tests and UI reviews, not the public site.
import { css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'
import type { ImportMapData } from 'remix/component/server'

import {
  AccordionBasic,
  AccordionControlled,
  AccordionHiddenUntilFound,
  AccordionMultiple,
  AccordionRichContent,
  AccordionWithBorders,
  AccordionWithDisabled,
} from '../../../registry/examples/accordion-example.tsx'
import {
  CollapsibleFileTree,
  CollapsibleRecoveryKeys,
  CollapsibleSettings,
} from '../../../registry/examples/collapsible-example.tsx'
import {
  PaginationBasic,
  PaginationSimple,
  PaginationWithRows,
} from '../../../registry/examples/pagination-example.tsx'
import {
  TabsAutomatic,
  TabsBasic,
  TabsDisabled,
  TabsIconOnly,
  TabsLine,
  TabsLineWithContent,
  TabsMultiple,
  TabsVariantsAlignment,
  TabsVertical,
  TabsWithContent,
  TabsWithIcons,
  TabsWithInputAndButton,
} from '../../../registry/examples/tabs-example.tsx'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '#remixcn/ui/accordion.tsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#remixcn/ui/tabs.tsx'

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
  // "Collapsible," alone is wider than 320px with text at 200%.
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
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 22rem), 1fr))',
})
const exampleStyles = css({
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  alignContent: 'start',
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
  gap: space(6),
  alignContent: 'start',
  padding: space(6),
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  backgroundColor: 'var(--background)',
  color: 'var(--foreground)',
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

function ThemePanel(handle: Handle<{ theme: 'light' | 'dark' }>) {
  return () => {
    let { theme } = handle.props

    return (
      <div data-theme={theme} data-panel={theme} mix={themePanelStyles}>
        <h3>{theme === 'light' ? 'Light' : 'Dark'}</h3>
        <AccordionWithDisabled />
        <CollapsibleRecoveryKeys />
        <TabsWithContent />
        <TabsLine />
        <PaginationBasic page={1} />
      </div>
    )
  }
}

/** An accordion and tabs the page renders outside any client entry, so no code of theirs runs in the browser. */
function ServerOnly() {
  return () => (
    <div mix={css({ display: 'grid', gridTemplateColumns: shrinkingColumn, gap: space(4) })}>
      <Accordion defaultValue={['terms']}>
        <AccordionItem value="terms">
          <AccordionTrigger>What are the payment terms?</AccordionTrigger>
          <AccordionContent>Thirty days from the invoice date.</AccordionContent>
        </AccordionItem>
        <AccordionItem value="methods">
          <AccordionTrigger>Which payment methods work?</AccordionTrigger>
          <AccordionContent>Bank transfer and card.</AccordionContent>
        </AccordionItem>
      </Accordion>
      <Tabs defaultValue="summary">
        <TabsList aria-label="Statement">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="lines">Lines</TabsTrigger>
        </TabsList>
        <TabsContent value="summary">Three invoices, 1,240.00 EUR.</TabsContent>
        <TabsContent value="lines">INV-0040, INV-0041 and INV-0042.</TabsContent>
      </Tabs>
    </div>
  )
}

export function DisclosureExamples(handle: Handle<{ stylesheets: string[]; script: ScriptEntry; page: number }>) {
  return () => (
    <Document
      title="RemixCN Accordion, Collapsible, Tabs and Pagination examples"
      stylesheets={handle.props.stylesheets}
      script={handle.props.script}
    >
      <main mix={pageStyles}>
        <header mix={headerStyles}>
          <h1 mix={titleStyles}>Accordion, Collapsible, Tabs and Pagination</h1>
          <p>Every example from registry/examples, rendered on the server and hydrated where it handles events.</p>
          <p mix={mutedStyles}>A synthetic test fixture with invented data, not the public site.</p>
        </header>

        <Section id="accordion" title="Accordion" description="Headings with buttons that open their panels.">
          <div mix={gridStyles}>
            <Example title="Basic" description="One item open at a time.">
              <AccordionBasic />
            </Example>
            <Example title="Multiple" description="Several items open at once.">
              <AccordionMultiple />
            </Example>
            <Example title="With borders">
              <AccordionWithBorders />
            </Example>
            <Example title="Rich content" description="Paragraphs, a link and a button, one item open at first.">
              <AccordionRichContent />
            </Example>
            <Example title="With disabled">
              <AccordionWithDisabled />
            </Example>
            <Example title="Controlled" description="The owner keeps one answer open.">
              <AccordionControlled />
            </Example>
            <Example title="Hidden until found">
              <AccordionHiddenUntilFound />
            </Example>
            <Example
              title="Server only"
              description="Rendered by the page, outside any client entry, so it shows its first state and stays put."
            >
              <ServerOnly />
            </Example>
          </div>
        </Section>

        <Section id="collapsible" title="Collapsible" description="A button that shows and hides a panel.">
          <div mix={gridStyles}>
            <Example title="File tree" description="Nested folders under tabs.">
              <CollapsibleFileTree />
            </Example>
            <Example title="Settings" description="A controlled collapsible with a square trigger.">
              <CollapsibleSettings />
            </Example>
            <Example title="Recovery keys" description="The closed panel stays in the page, hidden.">
              <CollapsibleRecoveryKeys />
            </Example>
          </div>
        </Section>

        <Section id="tabs" title="Tabs" description="One tab stop. The arrow keys move between tabs.">
          <div mix={gridStyles}>
            <Example title="Tabs basic">
              <TabsBasic />
            </Example>
            <Example title="Line">
              <TabsLine />
            </Example>
            <Example title="Variants alignment">
              <TabsVariantsAlignment />
            </Example>
            <Example title="Tabs disabled">
              <TabsDisabled />
            </Example>
            <Example title="With icons">
              <TabsWithIcons />
            </Example>
            <Example title="Icon only">
              <TabsIconOnly />
            </Example>
            <Example title="Tabs multiple">
              <TabsMultiple />
            </Example>
            <Example title="With content">
              <TabsWithContent />
            </Example>
            <Example title="Line with content">
              <TabsLineWithContent />
            </Example>
            <Example title="Vertical">
              <TabsVertical />
            </Example>
            <Example title="Automatic" description="The arrow keys select as they move.">
              <TabsAutomatic />
            </Example>
            <Example title="With input and button" wide>
              <TabsWithInputAndButton />
            </Example>
          </div>
        </Section>

        <Section
          id="pagination"
          title="Pagination"
          description="Native links to ?page=N. They work without JavaScript; the server picks the page."
        >
          <div mix={gridStyles}>
            <Example title="Pagination basic" wide>
              <PaginationBasic page={handle.props.page} />
            </Example>
            <Example title="Pagination simple">
              <PaginationSimple />
            </Example>
            <Example title="First page" description="Previous turns off." wide>
              <PaginationBasic page={1} />
            </Example>
            <Example title="With rows" wide>
              <PaginationWithRows />
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
          id="direction"
          title="Direction"
          description="In right-to-left text, the arrows swap, the chevrons and the vertical line mirror."
        >
          <div dir="rtl" lang="ar" mix={gridStyles}>
            <Example title="أسئلة">
              <AccordionWithBorders />
            </Example>
            <Example title="ملفات">
              <CollapsibleFileTree />
            </Example>
            <Example title="تبويبات">
              <TabsWithContent />
              <TabsVertical />
            </Example>
            <Example title="صفحات" wide>
              <PaginationBasic page={2} />
            </Example>
          </div>
        </Section>
      </main>
    </Document>
  )
}
