import type { DocsPage } from '../page.ts'
import { A, Code, List, P, Section, Snippet } from '../ui.tsx'

const sections = {
  what: { id: 'what-it-is', title: 'What it is' },
  how: { id: 'how-it-works', title: 'How it works' },
  needs: { id: 'what-your-app-needs', title: 'What your app needs' },
  docs: { id: 'these-docs', title: 'These docs' },
}

export const page: DocsPage = {
  path: 'docs/',
  title: 'Introduction',
  crumbTitle: 'Docs',
  summary: 'RemixCN ports the shadcn/ui components to Remix 3. You copy their source into your app and own it.',
  group: 'Getting started',
  keywords: ['getting started', 'overview', 'source', 'copy', 'own'],
  sections: Object.values(sections),
  Content: () => () => (
    <>
      <Section {...sections.what}>
        <P>
          shadcn/ui is a set of components you copy into a React app instead of installing a package. RemixCN does the
          same for Remix 3: each component is built on Remix's own components, events and <Code>css()</Code> styles,
          with no React, Tailwind or headless UI kit.
        </P>
      </Section>
      <Section {...sections.how}>
        <List ordered>
          <li>
            <Code>npx remixcn init</Code> prepares your app: the import aliases, the theme stylesheet and the license
            texts.
          </li>
          <li>
            <Code>npx remixcn add button</Code> copies a component and everything it imports into your app.
          </li>
          <li>The files are yours. Change them like any other file of your app.</li>
        </List>
        <Snippet title="Terminal" code={'npx remixcn init\nnpx remixcn add button'} label="the setup commands" />
      </Section>
      <Section {...sections.needs}>
        <List>
          <li>
            A Remix 3 app with <Code>remix@3.0.0</Code>, such as one from <Code>npx remix new</Code>.
          </li>
          <li>Node 24.3 or later to run the command line.</li>
          <li>Nothing else: the components add no npm package.</li>
        </List>
      </Section>
      <Section {...sections.docs}>
        <P>
          The docs put the components first (C-979). Each <A to="docs/components/">component page</A> shows its examples
          running, their source to copy, and how to add it. The <A to="docs/registry/">registry</A>, the{' '}
          <A to="docs/cli/">command line</A> and the <A to="docs/mcp/">MCP server</A> have pages of their own.
        </P>
      </Section>
    </>
  ),
}
