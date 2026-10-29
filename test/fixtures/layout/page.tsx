// The Resizable and Scroll Area showcase: a synthetic page with every example
// of both entries and a right-to-left section. It is a local fixture for
// tests and screenshots, not the public site.
import type { ScriptEntry } from 'remix/assets'
import { css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'

import * as resizable from '../../../registry/examples/resizable-example.tsx'
import * as scrollArea from '../../../registry/examples/scroll-area-example.tsx'

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
  '& p': { margin: 0, maxWidth: '44rem' },
})
const titleStyles = css({
  fontSize: 'var(--text-3xl)',
  lineHeight: 'var(--text-3xl--line-height)',
  margin: 0,
  fontWeight: 600,
  letterSpacing: '-0.025em',
})
const sectionStyles = css({ display: 'grid', gridTemplateColumns: shrinkingColumn, gap: space(4) })
const sectionTitleStyles = css({
  fontSize: 'var(--text-xl)',
  lineHeight: 'var(--text-xl--line-height)',
  margin: 0,
  fontWeight: 600,
})
const descriptionStyles = css({
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  margin: 0,
  color: 'var(--muted-foreground)',
})
const gridStyles = css({
  display: 'grid',
  gap: space(4),
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 24rem), 1fr))',
  alignItems: 'start',
})
const exampleStyles = css({
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  gap: space(4),
  minWidth: 0,
  padding: space(5),
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  '& h3': {
    fontSize: 'var(--text-sm)',
    lineHeight: 'var(--text-sm--line-height)',
    margin: 0,
    fontWeight: 500,
    color: 'var(--muted-foreground)',
  },
  '@media (max-width: 40rem)': { padding: space(3) },
})

function Section(handle: Handle<{ id: string; title: string; description: string; children?: RemixNode }>) {
  return () => {
    let { id, title, description, children } = handle.props
    return (
      <section aria-labelledby={id} mix={sectionStyles}>
        <h2 id={id} mix={sectionTitleStyles}>
          {title}
        </h2>
        <p mix={descriptionStyles}>{description}</p>
        {children}
      </section>
    )
  }
}

function Example(handle: Handle<{ name: string; title: string; children?: RemixNode }>) {
  return () => (
    <article data-example={handle.props.name} mix={exampleStyles}>
      <h3>{handle.props.title}</h3>
      {handle.props.children}
    </article>
  )
}

export function LayoutPage(handle: Handle<{ stylesheets: string[]; script: ScriptEntry }>) {
  return () => {
    let { stylesheets, script } = handle.props

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>RemixCN Resizable and Scroll Area</title>
          {stylesheets.map((href) => (
            <link key={href} rel="stylesheet" href={href} />
          ))}
          <ImportMap value={script.importMap} />
          {script.preloads.map((preload) => (
            <link key={preload} rel="modulepreload" href={preload} />
          ))}
          <script type="module" src={script.href}></script>
        </head>
        <body>
          <main mix={pageStyles}>
            <header mix={headerStyles}>
              <h1 mix={titleStyles}>Resizable and Scroll Area</h1>
              <p>
                Synthetic examples of RemixCN's resizable panels and scroll areas, after shadcn/ui's examples. The
                server renders every layout and every scrollable region. The browser adds the handles and the thin
                scrollbars.
              </p>
            </header>

            <Section
              id="resizable"
              title="Resizable"
              description="Drag a handle, or focus it and use the arrow keys, Home, End and Enter."
            >
              <div mix={gridStyles}>
                <Example name="resizable-horizontal" title="Horizontal">
                  <resizable.ResizableHorizontal />
                </Example>
                <Example name="resizable-vertical" title="Vertical">
                  <resizable.ResizableVertical />
                </Example>
                <Example name="resizable-with-handle" title="With handle">
                  <resizable.ResizableWithHandle />
                </Example>
                <Example name="resizable-nested" title="Nested">
                  <resizable.ResizableNested />
                </Example>
                <Example name="resizable-controlled" title="Controlled">
                  <resizable.ResizableControlled />
                </Example>
                <Example name="resizable-collapsible" title="Collapsible">
                  <resizable.ResizableCollapsible />
                </Example>
              </div>
            </Section>

            <Section
              id="scroll-area"
              title="Scroll Area"
              description="A native scroll container: the wheel, touch, the keyboard and focus scroll it, and the page scrolls on at its edges."
            >
              <div mix={gridStyles}>
                <Example name="scroll-area-vertical" title="Vertical">
                  <scrollArea.ScrollAreaVertical />
                </Example>
                <Example name="scroll-area-horizontal" title="Horizontal">
                  <scrollArea.ScrollAreaHorizontal />
                </Example>
                <Example name="scroll-area-both" title="Both axes">
                  <scrollArea.ScrollAreaBothAxes />
                </Example>
              </div>
            </Section>

            <Section
              id="right-to-left"
              title="Right to left"
              description="Handles, keys and scrollbars follow the text direction."
            >
              <div dir="rtl" lang="ar" mix={gridStyles}>
                <Example name="rtl-resizable" title="لوحات قابلة لتغيير الحجم">
                  <resizable.ResizableRightToLeft />
                </Example>
                <Example name="rtl-scroll-area" title="منطقة التمرير">
                  <scrollArea.ScrollAreaRightToLeft />
                </Example>
              </div>
            </Section>
          </main>
        </body>
      </html>
    )
  }
}
