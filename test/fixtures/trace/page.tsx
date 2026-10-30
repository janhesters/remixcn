// The Trace examples on one synthetic page, with both themes side by side
// and right-to-left text. It is a test fixture for browser tests and UI
// reviews, not the public site.
import { css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'
import type { ImportMapData } from 'remix/component/server'

import {
  TraceCollapsibleDemo,
  TraceCommit,
  TraceDemo,
  TraceDescriptionDemo,
  TraceDialog,
  TraceGroupDemo,
  TraceLink,
  TraceOpen,
  TraceSheet,
  TraceSources,
  TraceStatic,
  TraceStatus,
  TraceSteps,
  TraceThinking,
  TraceToolCalls,
  TraceTurn,
} from '../../../registry/examples/trace-example.tsx'
import { TraceLongContent } from './islands.tsx'
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceLine,
  TraceTitle,
} from '#remixcn/ui/trace.tsx'

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
  overflowWrap: 'anywhere',
})
const sectionStyles = css({ display: 'grid', gridTemplateColumns: shrinkingColumn, gap: space(6) })
const sectionTitleStyles = css({
  margin: 0,
  fontSize: 'var(--text-xl)',
  lineHeight: 'var(--text-xl--line-height)',
  fontWeight: 600,
  overflowWrap: 'anywhere',
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
  '& > h3': {
    margin: 0,
    fontSize: 'var(--text-base)',
    lineHeight: 'var(--text-base--line-height)',
    fontWeight: 600,
    overflowWrap: 'anywhere',
  },
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
  '@media (max-width: 40rem)': { padding: space(4) },
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
        <TraceStatus />
        <TraceDescriptionDemo />
        <TraceTurn />
        <TraceLink />
      </div>
    )
  }
}

/** Rows the page renders outside any client entry, so no code of theirs runs in the browser. */
function ServerOnly() {
  return () => (
    <Trace>
      <TraceLine status="running">
        <TraceTitle>Running pnpm build</TraceTitle>
      </TraceLine>
      <TraceCollapsible defaultOpen>
        <TraceCollapsibleTrigger>
          <TraceLine>
            <TraceTitle>Ran node --version</TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>v24.18.0</TraceCollapsibleContent>
      </TraceCollapsible>
      <TraceCollapsible>
        <TraceCollapsibleTrigger>
          <TraceLine status="error">
            <TraceTitle>Failed to run pnpm --version</TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>command not found: pnpm</TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  )
}

export function TraceExamples(handle: Handle<{ stylesheets: string[]; script: ScriptEntry }>) {
  return () => (
    <Document title="RemixCN Trace examples" stylesheets={handle.props.stylesheets} script={handle.props.script}>
      <main mix={pageStyles}>
        <header mix={headerStyles}>
          <h1 mix={titleStyles}>Trace</h1>
          <p>Every example from registry/examples, rendered on the server and hydrated where it handles events.</p>
          <p mix={mutedStyles}>A synthetic test fixture with invented data, not the public site.</p>
        </header>

        <Section id="lines" title="Lines" description="Steps that read as text. A status adds color, motion and words.">
          <div mix={gridStyles}>
            <Example title="Trace line">
              <TraceStatic />
            </Example>
            <Example title="Status" description="Done, failed, running and not started.">
              <TraceStatus />
            </Example>
            <Example title="Description">
              <TraceDescriptionDemo />
            </Example>
            <Example title="Group">
              <TraceGroupDemo />
            </Example>
          </div>
        </Section>

        <Section id="rows" title="Rows that expand" description="A native button opens each row's detail.">
          <div mix={gridStyles}>
            <Example title="Collapsible">
              <TraceCollapsibleDemo />
            </Example>
            <Example title="Open state" description="One row starts open; the button controls the other.">
              <TraceOpen />
            </Example>
            <Example title="Sources">
              <TraceSources />
            </Example>
            <Example title="Chain of thought" description="Steps inside a summary that keeps their state.">
              <TraceSteps />
            </Example>
            <Example title="Commit" description="Each file opens its diff in a sheet.">
              <TraceCommit />
            </Example>
            <Example title="Whole turn" description="Three levels: the turn, a summary and the rows.">
              <TraceTurn />
            </Example>
            <Example title="Long content" description="A long title, a long word and a long detail wrap.">
              <TraceLongContent />
            </Example>
            <Example
              title="Server only"
              description="Rendered by the page, outside any client entry, so it shows its first state and stays put."
            >
              <ServerOnly />
            </Example>
          </div>
        </Section>

        <Section
          id="elsewhere"
          title="Links, dialogs and sheets"
          description="A line inside a link or another component's trigger takes that element's role and keys."
        >
          <div mix={gridStyles}>
            <Example title="Link">
              <TraceLink />
            </Example>
            <Example title="Dialog">
              <TraceDialog />
            </Example>
            <Example title="Sheet">
              <TraceSheet />
            </Example>
          </div>
        </Section>

        <Section
          id="streaming"
          title="Streaming"
          description="Played from a script. The tool call lists announce each change of status."
        >
          <div mix={gridStyles}>
            <Example title="Reasoning">
              <TraceThinking />
            </Example>
            <Example title="Tool calls">
              <TraceToolCalls />
            </Example>
            <Example title="Demo" wide>
              <TraceDemo />
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
          description="In right-to-left text, lines start on the right, and the chevrons and arrows mirror."
        >
          <div dir="rtl" lang="ar" mix={gridStyles}>
            <Example title="حالات">
              <TraceStatus />
            </Example>
            <Example title="مصادر">
              <TraceSources />
            </Example>
            <Example title="روابط">
              <TraceLink />
            </Example>
            <Example title="دورة كاملة">
              <TraceTurn />
            </Example>
          </div>
        </Section>
      </main>
    </Document>
  )
}
