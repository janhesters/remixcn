import type { DocsPage } from '../page.ts'
import { A, Code, List, P, Section, Snippet } from '../ui.tsx'

const sections = {
  where: { id: 'where-it-lives', title: 'Where it lives' },
  format: { id: 'format', title: 'Format' },
  shadcn: { id: 'with-shadcn', title: "With shadcn's tools" },
}

const config = `{
  "registries": {
    "@remixcn": "https://janhesters.github.io/remixcn/r/{name}.json"
  }
}`

export const page: DocsPage = {
  path: 'docs/registry/',
  title: 'Registry',
  summary: "RemixCN serves its components as a registry in shadcn's format, so tools find them as @remixcn items.",
  group: 'Tools',
  keywords: ['registry.json', 'shadcn', 'components.json', '@remixcn', 'namespace'],
  sections: Object.values(sections),
  Content: () => () => (
    <>
      <Section {...sections.where}>
        <P>
          The site serves the index at <Code>/remixcn/r/registry.json</Code> and each item at{' '}
          <Code>/remixcn/r/{'{name}'}.json</Code>. Register it in your app's <Code>components.json</Code>:
        </P>
        <Snippet title="components.json" code={config} label="the registry config" />
      </Section>
      <Section {...sections.format}>
        <List>
          <li>Items follow the registry and registry-item schemas of shadcn 4.23.0.</li>
          <li>
            Items install only source files and list no npm package: your app already has <Code>remix@3.0.0</Code>.
          </li>
          <li>Every item brings RemixCN's license and the license texts of the projects it adapts.</li>
        </List>
      </Section>
      <Section {...sections.shadcn}>
        <P>
          shadcn's MCP server lists, searches and shows RemixCN items from this registry, and shadcn's command line can
          install them. <A to="docs/cli/">remixcn add</A> is the installer made for Remix apps: it rewrites the imports
          to relative paths and keeps each file's license header.
        </P>
      </Section>
    </>
  ),
}
