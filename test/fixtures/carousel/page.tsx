// The Carousel examples on one synthetic page, with both themes side by side,
// right-to-left text, and a carousel that never runs in the browser. It is a
// test fixture for browser tests and UI reviews, not the public site.
import { css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'
import type { ImportMapData } from 'remix/component/server'

import {
  CarouselAutoplay,
  CarouselBasic,
  CarouselInvoices,
  CarouselLoop,
  CarouselRightToLeft,
  CarouselSizes,
  CarouselSpacing,
  CarouselVertical,
  CarouselWithApi,
} from '../../../registry/examples/carousel-example.tsx'
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '#remixcn/ui/carousel.tsx'

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
  gap: space(5),
  alignContent: 'start',
  padding: space(6),
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  backgroundColor: 'var(--background)',
  color: 'var(--foreground)',
  '& h3': { margin: 0, fontSize: 'var(--text-base)', fontWeight: 600 },
})
const staticFrameStyles = css({ paddingInline: space(12) })
const staticCarouselStyles = css({ width: '100%', maxWidth: '20rem', marginInline: 'auto' })
const staticSlideStyles = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  aspectRatio: '2',
  margin: space(1),
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  fontSize: 'var(--text-2xl)',
  fontWeight: 600,
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

// Rendered by the page, outside any client entry, so no carousel code runs
// in the browser: the slides scroll natively and the buttons stay disabled.
function StaticCarousel() {
  return () => (
    <div mix={staticFrameStyles}>
      <Carousel aria-label="Numbers without JavaScript" mix={staticCarouselStyles}>
        <CarouselContent>
          {[1, 2, 3].map((number) => (
            <CarouselItem key={number}>
              <div mix={staticSlideStyles}>{number}</div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  )
}

function ThemePanel(handle: Handle<{ theme: 'light' | 'dark' }>) {
  return () => {
    let { theme } = handle.props

    return (
      <div data-theme={theme} data-panel={theme} mix={themePanelStyles}>
        <h3>{theme === 'light' ? 'Light' : 'Dark'}</h3>
        <CarouselWithApi />
        <CarouselInvoices />
      </div>
    )
  }
}

export function CarouselExamples(handle: Handle<{ stylesheets: string[]; script: ScriptEntry }>) {
  return () => (
    <Document title="RemixCN Carousel examples" stylesheets={handle.props.stylesheets} script={handle.props.script}>
      <main mix={pageStyles}>
        <header mix={headerStyles}>
          <h1 mix={titleStyles}>Carousel</h1>
          <p>Every example from registry/examples, rendered on the server and hydrated as client entries.</p>
          <p mix={mutedStyles}>A synthetic test fixture with invented data, not the public site.</p>
        </header>

        <Section
          id="carousel"
          title="Carousel"
          description="Native scrolling with snap points, buttons, arrow keys, mouse drags and touch."
        >
          <div mix={gridStyles}>
            <Example title="Basic">
              <CarouselBasic />
            </Example>
            <Example title="Sizes" description="Two slides in view on small screens, three on large ones." wide>
              <CarouselSizes />
            </Example>
            <Example title="Spacing" description="A 0.25rem gap from --carousel-gap.">
              <CarouselSpacing />
            </Example>
            <Example title="Orientation" description="A column with Up and Down.">
              <CarouselVertical />
            </Example>
            <Example title="API" description="The count and the slide picker use the API and the select event.">
              <CarouselWithApi />
            </Example>
            <Example title="Autoplay" description="Pauses on hover, focus, a hidden page and reduced motion.">
              <CarouselAutoplay />
            </Example>
            <Example title="Loop">
              <CarouselLoop />
            </Example>
            <Example title="Links and fields" description="Arrows stay with a field; Tab reaches every slide.">
              <CarouselInvoices />
            </Example>
            <Example
              title="Without JavaScript"
              description="Rendered by the page, outside any client entry: it scrolls natively, with its scrollbar."
            >
              <StaticCarousel />
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
          description="In right-to-left text, the slides start on the right and the buttons, keys and chevrons swap."
        >
          <div mix={gridStyles}>
            <Example title="من اليمين إلى اليسار">
              <CarouselRightToLeft />
            </Example>
          </div>
        </Section>
      </main>
    </Document>
  )
}
