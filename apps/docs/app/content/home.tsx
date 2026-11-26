// The landing page (C-977): the approved phrase, the setup commands and the
// way into the component reference (C-979) first, then a showcase that runs
// on the page, what RemixCN promises, and the ways to add components. The
// footer of every page carries the credits and licenses.
import { css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'

import { buttonVariants } from '../../../../registry/ui/button.tsx'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../../../registry/ui/card.tsx'
import type { DocsPage } from '../page.ts'
import { Showcase } from '../public/showcase.tsx'
import { href, repository, seoPhrase } from '../site.ts'
import { A, Code, Snippet } from '../ui.tsx'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const text = (size: string) => ({ fontSize: `var(--text-${size})`, lineHeight: `var(--text-${size}--line-height)` })
const heading = { margin: 0, overflowWrap: 'break-word', scrollMarginBlockStart: space(20) } as const

const styles = {
  hero: css({
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    justifyItems: 'center',
    gap: space(6),
    paddingBlock: space(8),
    textAlign: 'center',
    '@media (width < 40rem)': { paddingBlock: space(2), justifyItems: 'stretch', textAlign: 'start' },
  }),
  h1: css({
    ...heading,
    maxWidth: '20ch',
    ...text('4xl'),
    fontWeight: 600,
    letterSpacing: '-0.025em',
    textWrap: 'balance',
    '@media (width < 40rem)': text('3xl'),
  }),
  lead: css({ margin: 0, maxWidth: '40rem', ...text('lg'), color: 'var(--muted-foreground)', textWrap: 'pretty' }),
  actions: css({
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space(2),
    '@media (width < 40rem)': { justifyContent: 'flex-start' },
  }),
  command: css({ width: 'min(100%, 32rem)', textAlign: 'start' }),
  section: css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(6) }),
  sectionHeader: css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(2) }),
  h2: css({ ...heading, ...text('2xl'), fontWeight: 600, letterSpacing: '-0.015em' }),
  intro: css({ margin: 0, maxWidth: '72ch', color: 'var(--muted-foreground)' }),
  cards: css({
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 16rem), 1fr))',
    gap: space(4),
  }),
  tools: css({
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 22rem), 1fr))',
    gap: space(4),
  }),
  // Cards in one row take its height, and their content grows, so their footers line up.
  card: css({ height: '100%' }),
  featureContent: css({ flex: '1 1 auto' }),
  featureBody: css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(4) }),
  featureText: css({ margin: 0 }),
  credits: css({ margin: 0, maxWidth: '72ch', ...text('sm'), color: 'var(--muted-foreground)' }),
}

const mcpConfig = `{
  "mcpServers": {
    "remixcn": {
      "command": "npx",
      "args": ["-y", "remixcn", "mcp"]
    }
  }
}`

const summary =
  'RemixCN ports shadcn/ui to Remix 3. Copy accessible components into your app and own their source: they need nothing but remix.'

const sections = {
  showcase: { id: 'try-them', title: 'Try them here' },
  promise: { id: 'what-you-get', title: 'What you get' },
  tools: { id: 'add-them-your-way', title: 'Add them your way' },
}

/** The components the showcase is built from, each linked to its source on GitHub. */
const showcaseParts = ['Button', 'Card', 'Checkbox', 'Field', 'Input', 'Tabs', 'Toggle']

function sourceUrl(component: string) {
  return `${repository}/blob/main/registry/ui/${component.toLowerCase()}.tsx`
}

function LandingSection(handle: Handle<{ id: string; title: string; intro: string; children?: RemixNode }>) {
  return () => {
    let { id, title, intro, children } = handle.props

    return (
      <section aria-labelledby={id} mix={styles.section}>
        <div mix={styles.sectionHeader}>
          <h2 id={id} mix={styles.h2}>
            {title}
          </h2>
          <p mix={styles.intro}>{intro}</p>
        </div>
        {children}
      </section>
    )
  }
}

function Feature(handle: Handle<{ title: string; children?: RemixNode; footer?: RemixNode }>) {
  return () => (
    <Card mix={styles.card}>
      <CardHeader>
        <CardTitle level={3}>{handle.props.title}</CardTitle>
      </CardHeader>
      <CardContent mix={styles.featureContent}>
        <div mix={styles.featureBody}>{handle.props.children}</div>
      </CardContent>
      {handle.props.footer ? <CardFooter>{handle.props.footer}</CardFooter> : null}
    </Card>
  )
}

export const page: DocsPage = {
  path: '',
  title: seoPhrase,
  summary,
  landing: true,
  sections: Object.values(sections),
  Content: () => () => (
    <>
      <section aria-labelledby="home-title" mix={styles.hero}>
        <h1 id="home-title" mix={styles.h1}>
          {seoPhrase}
        </h1>
        <p mix={styles.lead}>{summary}</p>
        <div mix={styles.actions}>
          <a href={href('docs/components/')} mix={buttonVariants({ size: 'lg' })}>
            Browse components
          </a>
          <a href={href('docs/')} mix={buttonVariants({ variant: 'outline', size: 'lg' })}>
            Read the docs
          </a>
        </div>
        <div mix={styles.command}>
          <Snippet title="Terminal" code={'npx remixcn init\nnpx remixcn add button'} label="the setup commands" />
        </div>
      </section>

      <LandingSection
        {...sections.showcase}
        intro="These cards run on this page with made-up people and data. Nothing you enter leaves it."
      >
        <Showcase />
        <p mix={styles.credits}>
          Built from{' '}
          {showcaseParts.flatMap((part, index) => [
            index === 0 ? null : index === showcaseParts.length - 1 ? ' and ' : ', ',
            <A key={part} href={sourceUrl(part)}>
              {part}
            </A>,
          ])}
          . Each name opens its source on GitHub.
        </p>
      </LandingSection>

      <LandingSection
        {...sections.promise}
        intro="shadcn/ui's components and their accessible behavior, ported to Remix 3's components, events and styles."
      >
        <div mix={styles.cards}>
          <Feature title="Source you own">
            <p mix={styles.featureText}>
              <Code>remixcn add</Code> copies each component into your app as a file you change like any other. There's
              no component package to install or upgrade.
            </p>
          </Feature>
          <Feature title="Built on Remix 3">
            <p mix={styles.featureText}>
              Components use Remix's own components, events and <Code>css()</Code> styles. Links, buttons and forms are
              native HTML, so they work before any script runs.
            </p>
          </Feature>
          <Feature title="Nothing but remix">
            <p mix={styles.featureText}>
              Components import only <Code>remix/component</Code> and each other: no React, Tailwind, Radix or Base UI.{' '}
              <Code>remixcn add</Code> installs no npm package.
            </p>
          </Feature>
        </div>
      </LandingSection>

      <LandingSection
        {...sections.tools}
        intro="Add components from a terminal, through your AI client, or by copying the files yourself."
      >
        <div mix={styles.tools}>
          <Feature title="Command line" footer={<A to="docs/cli/">The CLI reference</A>}>
            <p mix={styles.featureText}>
              Set up your app once, then add components. Each arrives with the helpers it imports, the theme tokens and
              the license texts.
            </p>
            <Snippet title="Terminal" code="npx remixcn add card dialog tabs" label="the add command" />
          </Feature>
          <Feature title="MCP server" footer={<A to="docs/mcp/">Set up a client</A>}>
            <p mix={styles.featureText}>
              Lets Claude Code, Cursor, Codex or VS Code list, search and view components, and build the add command.
              Its tools only read.
            </p>
            <Snippet title=".mcp.json" code={mcpConfig} label="the MCP config" />
          </Feature>
        </div>
        <p mix={styles.intro}>
          Or copy the files yourself from <A href={`${repository}/tree/main/registry/ui`}>registry/ui</A>. The items
          follow <A to="docs/registry/">shadcn's registry format</A>, so shadcn's MCP server finds them too.
        </p>
        <p mix={styles.credits}>
          RemixCN is MIT licensed. It adapts shadcn/ui and Base UI and builds on Remix:{' '}
          <A to="docs/licenses/">Licenses and credits</A> name every source.
        </p>
      </LandingSection>
    </>
  ),
}
