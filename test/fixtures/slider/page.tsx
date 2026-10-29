// The Slider examples on one synthetic page, with both themes side by side,
// right-to-left text and overrides. It is a test fixture for browser tests
// and UI reviews, not the public site.
import { css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'
import type { ImportMapData } from 'remix/component/server'

import {
  SliderBasic,
  SliderControlled,
  SliderDisabled,
  SliderMultiple,
  SliderPriceForm,
  SliderRange,
  SliderRtl,
  SliderVertical,
} from '../../../registry/examples/slider-example.tsx'
import { Slider } from '#remixcn/ui/slider.tsx'

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
// A grid's auto column stays as wide as its longest word, such as
// registry/examples in a wide font, so the header's column may shrink.
const headerStyles = css({
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  gap: space(2),
  '& p': { margin: 0, maxWidth: '40rem' },
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
  gap: space(4),
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
const narrowStyles = css({ maxWidth: '12rem' })
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
      <div data-theme={theme} data-panel={theme} mix={themePanelStyles}>
        <h3>{theme === 'light' ? 'Light' : 'Dark'}</h3>
        <SliderBasic />
        <SliderMultiple />
        <SliderDisabled />
      </div>
    )
  }
}

export function SliderExamples(handle: Handle<{ stylesheets: string[]; script: ScriptEntry }>) {
  return () => (
    <Document title="RemixCN Slider examples" stylesheets={handle.props.stylesheets} script={handle.props.script}>
      <main mix={pageStyles}>
        <header mix={headerStyles}>
          <h1 mix={titleStyles}>Slider</h1>
          <p>Every example from registry/examples, rendered on the server and hydrated.</p>
          <p mix={mutedStyles}>
            A synthetic test fixture with invented data, not the public site. The form sends to /echo, which shows what
            the server received.
          </p>
        </header>

        <Section
          id="examples"
          title="Examples"
          description="One thumb, a range, several thumbs, vertical, controlled, disabled and in a form."
        >
          <div mix={gridStyles}>
            <Example title="Basic">
              <SliderBasic />
            </Example>
            <Example title="Range" description="Each thumb has its own name.">
              <SliderRange />
            </Example>
            <Example title="Multiple thumbs" description="Thumbs stay a step apart and never cross.">
              <SliderMultiple />
            </Example>
            <Example title="Vertical">
              <SliderVertical />
            </Example>
            <Example title="Controlled" description="The text follows the value the owner keeps.">
              <SliderControlled />
            </Example>
            <Example title="Disabled">
              <SliderDisabled />
            </Example>
            <Example
              title="Form"
              description="Each thumb submits its own value. Reset returns both thumbs to their defaults."
              wide
            >
              <SliderPriceForm action="/echo" />
            </Example>
          </div>
        </Section>

        <Section id="themes" title="Themes" description="data-theme overrides the system preference inside it.">
          <div mix={gridStyles}>
            <ThemePanel theme="light" />
            <ThemePanel theme="dark" />
          </div>
        </Section>

        <Section
          id="direction"
          title="Direction"
          description="In right-to-left text, min sits on the right and the left and right arrows swap."
        >
          <div mix={gridStyles}>
            <Example title="مستوى الصوت">
              <SliderRtl />
            </Example>
            <Example title="نطاق السعر">
              <div dir="rtl" lang="ar">
                <Slider
                  aria-label="نطاق السعر"
                  thumbLabels={['أدنى سعر', 'أعلى سعر']}
                  defaultValue={[30, 80]}
                  max={100}
                  step={5}
                />
              </div>
            </Example>
          </div>
        </Section>

        <Section
          id="overrides"
          title="Overrides"
          description="A --primary token in @layer app, a larger thumb, and a narrow container."
        >
          <div mix={gridStyles}>
            <Example title="Brand color">
              <div class="brand">
                <Slider aria-label="Brand volume" defaultValue={[20, 60]} thumbLabels={['From', 'To']} />
              </div>
            </Example>
            <Example title="Large thumbs">
              <Slider aria-label="Zoom" class="large-thumbs" defaultValue={40} />
            </Example>
            <Example title="Narrow container">
              <div mix={narrowStyles}>
                <Slider aria-label="Opacity" defaultValue={90} />
              </div>
            </Example>
          </div>
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
