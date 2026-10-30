import type { DocsPage } from '../page.ts'
import { A, Code, P, Section } from '../ui.tsx'

const sections = {
  license: { id: 'license', title: 'License' },
  credits: { id: 'credits', title: 'Credits' },
}

export const page: DocsPage = {
  path: 'docs/licenses/',
  title: 'Licenses and credits',
  summary: 'RemixCN is MIT licensed. It adapts shadcn/ui and Base UI and builds on Remix.',
  group: 'Project',
  keywords: ['license', 'mit', 'credits', 'notices', 'shadcn', 'base ui', 'remix'],
  sections: Object.values(sections),
  Content: () => () => (
    <>
      <Section {...sections.license}>
        <P>
          RemixCN is MIT licensed, Copyright (c) 2026 Jan Hesters:{' '}
          <A href="https://github.com/janhesters/remixcn/blob/main/LICENSE">LICENSE</A>. Every component you install
          keeps its license header, and <Code>remixcn add</Code> installs the license texts with it.
        </P>
      </Section>
      <Section {...sections.credits}>
        <P>
          RemixCN adapts <A href="https://github.com/shadcn-ui/ui">shadcn/ui</A> (MIT, Copyright (c) 2023 shadcn) and
          the accessible behavior of <A href="https://github.com/mui/base-ui">Base UI</A> (MIT, Copyright (c) 2019
          Material-UI SAS), and builds on <A href="https://github.com/remix-run/remix">Remix</A> (MIT, Copyright (c)
          2025 Shopify Inc.).{' '}
          <A href="https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md">THIRD_PARTY_NOTICES.md</A>{' '}
          holds their license texts, and{' '}
          <A href="https://github.com/janhesters/remixcn/blob/main/SOURCES.md">SOURCES.md</A> lists what comes from
          where.
        </P>
      </Section>
    </>
  ),
}
