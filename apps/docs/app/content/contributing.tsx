import type { DocsPage } from '../page.ts'
import { A, Code, List, P, Section, Snippet } from '../ui.tsx'

const sections = {
  setup: { id: 'set-up', title: 'Set up' },
  rules: { id: 'rules', title: 'The rules every change keeps' },
}

export const page: DocsPage = {
  path: 'docs/contributing/',
  title: 'Contributing',
  summary: 'How to work on RemixCN: the workspace, its checks and the contracts every change keeps.',
  group: 'Project',
  keywords: ['contribute', 'bun', 'checks', 'tests', 'AGENTS.md'],
  sections: Object.values(sections),
  Content: () => () => (
    <>
      <Section {...sections.setup}>
        <Snippet title="Terminal" code={'bun install --frozen-lockfile\nbun run check'} label="the setup commands" />
        <P>
          <Code>bun run check</Code> runs every check, from formatting to the browser tests in Chromium, Firefox and
          WebKit. CI runs the same checks for every pull request.
        </P>
      </Section>
      <Section {...sections.rules}>
        <List>
          <li>
            Components import only <Code>remix/component</Code> and each other, and add no dependency.
          </li>
          <li>Native elements first: links, buttons and forms work before any script runs.</li>
          <li>Tests with invented data, in real browsers, for every behavior a change adds.</li>
        </List>
        <P>
          <A href="https://github.com/janhesters/remixcn/blob/main/AGENTS.md">AGENTS.md</A> describes the layout, the
          commands and every contract.
        </P>
      </Section>
    </>
  ),
}
