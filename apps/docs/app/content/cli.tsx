import type { DocsPage } from '../page.ts'
import { Code, List, P, Section, Snippet } from '../ui.tsx'

const sections = {
  init: { id: 'init', title: 'Set up an app' },
  add: { id: 'add', title: 'Add components' },
  discover: { id: 'discover', title: 'Find items' },
  safety: { id: 'safe-by-default', title: 'Safe by default' },
}

export const page: DocsPage = {
  path: 'docs/cli/',
  title: 'CLI',
  summary: 'remixcn sets up a Remix 3 app and copies components into it, with everything they depend on.',
  group: 'Tools',
  keywords: ['command line', 'npx', 'init', 'add', 'remixcn'],
  sections: Object.values(sections),
  Content: () => () => (
    <>
      <Section {...sections.init}>
        <P>
          Run <Code>init</Code> in the root of a Remix 3 app. It writes <Code>components.json</Code>, maps the{' '}
          <Code>#remixcn/</Code> import aliases and installs the theme stylesheet.
        </P>
        <Snippet title="Terminal" code="npx remixcn init" label="the init command" />
      </Section>
      <Section {...sections.add}>
        <Snippet
          title="Terminal"
          code={'npx remixcn add button\nnpx remixcn add button card dialog\nnpx remixcn add --all'}
          label="the add commands"
        />
        <P>
          Each item arrives with its helpers, the theme tokens and the license texts. Its <Code>#remixcn/</Code> imports
          become relative paths to the files it installed.
        </P>
      </Section>
      <Section {...sections.discover}>
        <Snippet
          title="Terminal"
          code={'npx remixcn list\nnpx remixcn search --query dialog\nnpx remixcn view button'}
          label="the discovery commands"
        />
      </Section>
      <Section {...sections.safety}>
        <List>
          <li>It checks every item before it writes a file, and writes them all as one change.</li>
          <li>
            It never replaces a file you changed without <Code>--overwrite</Code>, and <Code>--dry-run</Code> writes
            nothing.
          </li>
          <li>It installs no npm package, runs no registry script and sends no telemetry.</li>
        </List>
      </Section>
    </>
  ),
}
