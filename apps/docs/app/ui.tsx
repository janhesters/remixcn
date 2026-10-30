// The parts pages are written with, rendered on the server. Text and code
// arrive as strings and JSX, which Remix escapes, so no page needs a Markdown
// runtime and no snippet can add markup. The parts that run in the browser,
// a source pane's copy button and an example's guard, are client entries.
import { css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../../../registry/ui/breadcrumb.tsx'
import { typography } from '../../../registry/examples/typography.tsx'
import { ExampleGuard } from './public/example-guard.tsx'
import { SourcePane } from './public/source-pane.tsx'
import { href } from './site.ts'
import { readExample } from './source.ts'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const text = (size: string) => ({ fontSize: `var(--text-${size})`, lineHeight: `var(--text-${size}--line-height)` })

// Restrained headings (C-977): smaller and lighter than the Typography recipe's.
// A word longer than the line, as at 320px with large text, breaks.
const heading = { margin: 0, overflowWrap: 'break-word', scrollMarginBlockStart: space(20) }
const styles = {
  header: css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(3) }),
  h1: css({ ...heading, ...text('3xl'), fontWeight: 600, letterSpacing: '-0.02em', textWrap: 'balance' }),
  lead: css({ margin: 0, ...text('lg'), color: 'var(--muted-foreground)' }),
  section: css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(4) }),
  h2: css({
    ...heading,
    paddingBlockEnd: space(2),
    borderBlockEnd: '1px solid var(--border)',
    ...text('xl'),
    fontWeight: 600,
  }),
  h3: css({ ...heading, ...text('base'), fontWeight: 600 }),
  p: css({ margin: 0, lineHeight: space(7), maxWidth: '72ch' }),
  list: css({
    margin: 0,
    paddingInlineStart: space(6),
    maxWidth: '72ch',
    '& > li:not(:first-child)': { marginBlockStart: space(2) },
  }),
  link: css({ '&:hover': { textDecorationThickness: '2px' } }),
  example: css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(3) }),
  description: css({ margin: 0, ...text('sm'), color: 'var(--muted-foreground)', maxWidth: '72ch' }),
  preview: css({
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: space(4),
    padding: space(6),
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    '@media (width < 40rem)': { padding: space(4) },
  }),
  // Shows at once without scripting, and after two seconds while the guard
  // still hasn't run, such as when its script never loads.
  pendingNote: css({
    '@keyframes remixcn-docs-pending-note': {
      to: { position: 'static', visibility: 'visible', height: 'auto', overflow: 'visible' },
    },
    margin: 0,
    ...text('sm'),
    color: 'var(--muted-foreground)',
    position: 'absolute',
    insetInline: 0,
    visibility: 'hidden',
    height: 0,
    overflow: 'hidden',
    ':where([data-pending]) > &': { animation: 'remixcn-docs-pending-note 0s 2s forwards' },
    '@media (scripting: none)': { position: 'static', visibility: 'visible', height: 'auto', overflow: 'visible' },
  }),
}

export interface Crumb {
  title: string
  path: string
}

/** The page's place in the site, its title and its summary. */
export function PageHeader(handle: Handle<{ crumbs: Crumb[]; title: string; summary: string }>) {
  return () => {
    let { crumbs, title, summary } = handle.props

    return (
      <header mix={styles.header}>
        {crumbs.length > 0 ? (
          <Breadcrumb>
            <BreadcrumbList>
              {crumbs.flatMap((crumb) => [
                <BreadcrumbItem key={crumb.path}>
                  <BreadcrumbLink href={href(crumb.path)}>{crumb.title}</BreadcrumbLink>
                </BreadcrumbItem>,
                <BreadcrumbSeparator key={`${crumb.path}-separator`} />,
              ])}
              <BreadcrumbItem>
                <BreadcrumbPage>{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        ) : null}
        <h1 mix={styles.h1}>{title}</h1>
        <p mix={styles.lead}>{summary}</p>
      </header>
    )
  }
}

export interface SectionInfo {
  id: string
  title: string
}

/** A section of a page, with the heading the table of contents links to. */
export function Section(handle: Handle<SectionInfo & { children?: RemixNode }>) {
  return () => (
    <section aria-labelledby={handle.props.id} mix={styles.section}>
      <h2 id={handle.props.id} mix={styles.h2}>
        {handle.props.title}
      </h2>
      {handle.props.children}
    </section>
  )
}

export function P(handle: Handle<{ children?: RemixNode }>) {
  return () => <p mix={styles.p}>{handle.props.children}</p>
}

export function List(handle: Handle<{ children?: RemixNode; ordered?: boolean }>) {
  return () =>
    handle.props.ordered ? (
      <ol mix={styles.list}>{handle.props.children}</ol>
    ) : (
      <ul mix={styles.list}>{handle.props.children}</ul>
    )
}

export function Code(handle: Handle<{ children?: RemixNode }>) {
  return () => <code mix={typography.inlineCode}>{handle.props.children}</code>
}

/** A link to a page of the site (`to`, such as `docs/cli/`) or to another site (`href`). */
export function A(handle: Handle<{ to?: string; href?: string; children?: RemixNode }>) {
  return () => (
    <a
      href={handle.props.to === undefined ? handle.props.href : href(handle.props.to)}
      mix={[typography.link, styles.link]}
    >
      {handle.props.children}
    </a>
  )
}

/** Code to read and copy, such as a command or a usage snippet. */
export function Snippet(handle: Handle<{ title: string; code: string; label: string }>) {
  return () => <SourcePane title={handle.props.title} code={handle.props.code} label={handle.props.label} />
}

export interface ExampleProps {
  id: string
  title: string
  description: string
  /** The example file in registry/examples, and the export the preview renders. */
  file: string
  name: string
  children?: RemixNode
}

/**
 * One example: the component running in its own preview, its guard, and its
 * source. Each example hydrates on its own, and the guard keeps its forms and
 * links on the page, so it can't reset another example or move the page.
 * Until the guard runs, the example is inert: without scripting, or while
 * the guard's script loads or if it never does, nothing in it can submit,
 * follow a link or take focus, and a note says it runs with JavaScript.
 */
export function Example(handle: Handle<ExampleProps>) {
  return () => {
    let { id, title, description, file, name, children } = handle.props

    return (
      <section aria-labelledby={id} data-docs-example={name} mix={styles.example}>
        <h3 id={id} mix={styles.h3}>
          {title}
        </h3>
        <p mix={styles.description}>{description}</p>
        <div data-docs-preview="" data-pending="" mix={styles.preview}>
          <div data-docs-canvas="" inert>
            {children}
          </div>
          <p mix={styles.pendingNote}>This example runs with JavaScript. Its source is below.</p>
          <ExampleGuard />
        </div>
        <SourcePane title={name} code={readExample(file, name)} label={`the ${name} source`} />
      </section>
    )
  }
}
