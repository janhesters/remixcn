import type { DocsPage } from '../page.ts'
import { A, List, P, Section } from '../ui.tsx'

const sections = {
  start: { id: 'start', title: 'Start here' },
  promise: { id: 'what-you-get', title: 'What you get' },
}

export const page: DocsPage = {
  path: '',
  title: 'RemixCN',
  summary:
    'shadcn components for Remix V3. Copy accessible components into your Remix 3 app and own their source. They need nothing but remix.',
  sections: Object.values(sections),
  Content: () => () => (
    <>
      <Section {...sections.start}>
        <List>
          <li>
            <A to="docs/components/">Browse the components</A>: each page shows the component running, its source, and
            how to add it.
          </li>
          <li>
            <A to="docs/">Read the introduction</A>: how RemixCN works and what your app needs.
          </li>
        </List>
      </Section>
      <Section {...sections.promise}>
        <List>
          <li>shadcn/ui's components, ported to Remix 3's components, events and styles.</li>
          <li>Source you copy and change, not a package you depend on.</li>
          <li>Native HTML first: links, buttons and forms work before any script runs.</li>
          <li>A registry, a command line and an MCP server to add them.</li>
        </List>
        <P>
          RemixCN is MIT licensed and adapts shadcn/ui and Base UI. <A to="docs/licenses/">Licenses and credits</A> name
          every source.
        </P>
      </Section>
    </>
  ),
}
