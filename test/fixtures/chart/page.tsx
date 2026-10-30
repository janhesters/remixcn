// The Chart examples on one synthetic page: the six families, the tooltip's
// parts, both themes side by side, right-to-left text, long translated
// labels, a chart that takes new data, and a chart the server renders
// outside any client entry. It is a test fixture for browser tests and UI
// reviews, not the public site.
import { css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'
import type { ImportMapData } from 'remix/component/server'

import {
  ChartAreaExample,
  ChartAreaStackedExample,
  ChartBarExample,
  ChartBarInteractiveExample,
  ChartBarNegativeExample,
  ChartBarStackedExample,
  ChartLineExample,
  ChartPieExample,
  ChartRadarExample,
  ChartRadialExample,
  ChartRtlExample,
  ChartTooltipExample,
} from '../../../registry/examples/chart-example.tsx'
import { Bar, BarChart, CartesianGrid, ChartContainer, XAxis } from '#remixcn/ui/chart.tsx'
import { ChangingData, LongLabels } from './islands.tsx'

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
  overflowWrap: 'anywhere',
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
  gap: space(3),
  margin: 0,
  minWidth: 0,
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
  handle: Handle<{ name: string; title?: string; description?: string; wide?: boolean; children?: RemixNode }>,
) {
  return () => {
    let { title, name, description, wide, children } = handle.props

    return (
      <div mix={[exampleStyles, wide ? wideStyles : null]} data-example={name}>
        {title ? <h3>{title}</h3> : null}
        {description ? <p mix={mutedStyles}>{description}</p> : null}
        {children}
      </div>
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
      <div data-theme={theme} mix={themePanelStyles}>
        <h3>{theme === 'light' ? 'Light' : 'Dark'}</h3>
        <Example name={`${theme}-bar`}>
          <ChartBarStackedExample />
        </Example>
        <Example name={`${theme}-pie`}>
          <ChartPieExample />
        </Example>
      </div>
    )
  }
}

const serverConfig = {
  month: { label: 'Month' },
  desktop: { label: 'Desktop', color: 'var(--chart-2)' },
}

export function ChartExamples(handle: Handle<{ stylesheets: string[]; script: ScriptEntry }>) {
  return () => (
    <Document title="RemixCN Chart examples" stylesheets={handle.props.stylesheets} script={handle.props.script}>
      <main mix={pageStyles}>
        <header mix={headerStyles}>
          <h1 mix={titleStyles}>Chart</h1>
          <p>Every example from registry/examples, rendered on the server and hydrated as client entries.</p>
          <p mix={mutedStyles}>A synthetic test fixture with invented data, not the public site.</p>
        </header>

        <Section
          id="families"
          title="Chart families"
          description="Area, bar, line, pie, radial and radar charts in native SVG. Point at a chart, or tab to it and use the arrow keys."
        >
          <div mix={gridStyles}>
            <Example name="area">
              <ChartAreaExample />
            </Example>
            <Example name="bar">
              <ChartBarExample />
            </Example>
            <Example name="line">
              <ChartLineExample />
            </Example>
            <Example name="pie">
              <ChartPieExample />
            </Example>
            <Example name="radial">
              <ChartRadialExample />
            </Example>
            <Example name="radar">
              <ChartRadarExample />
            </Example>
          </div>
        </Section>

        <Section
          id="more"
          title="Stacked, negative and interactive"
          description="Stacks share a stack id, values below zero hang from the zero line, and new props redraw the chart in place."
        >
          <div mix={gridStyles}>
            <Example name="bar-stacked">
              <ChartBarStackedExample />
            </Example>
            <Example name="area-stacked">
              <ChartAreaStackedExample />
            </Example>
            <Example name="bar-negative">
              <ChartBarNegativeExample />
            </Example>
            <Example name="bar-interactive" wide>
              <ChartBarInteractiveExample />
            </Example>
          </div>
        </Section>

        <Section
          id="tooltip"
          title="Tooltip"
          description="ChartTooltipContent on its own: a label, names, indicators and values, with the label hidden or nested."
        >
          <Example name="tooltip-parts">
            <ChartTooltipExample />
          </Example>
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
          description="The categories run from right to left with reversed, and the config translates every label."
        >
          <div mix={gridStyles}>
            <Example name="rtl">
              <ChartRtlExample />
            </Example>
          </div>
        </Section>

        <Section
          id="data"
          title="Long labels and changing data"
          description="German labels wrap in the legend and tooltip, and overlapping month names make room. The buttons give one chart new data: negative values, zeros, gaps and no rows."
        >
          <div mix={gridStyles}>
            <Example name="long-labels" title="Long labels">
              <LongLabels />
            </Example>
            <Example name="changing-data" title="Changing data">
              <ChangingData />
            </Example>
          </div>
        </Section>

        <Section
          id="server-only"
          title="Server only"
          description="Rendered by the page, outside any client entry: drawn at its initial size and scaled to fit, with its summary and table."
        >
          <div mix={gridStyles}>
            <Example name="server-bar" title="Visitors">
              <ChartContainer config={serverConfig}>
                <BarChart
                  data={[
                    { month: 'January', desktop: 186 },
                    { month: 'February', desktop: 305 },
                    { month: 'March', desktop: 237 },
                  ]}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                  <Bar dataKey="desktop" radius={4} />
                </BarChart>
              </ChartContainer>
            </Example>
          </div>
        </Section>
      </main>
    </Document>
  )
}
