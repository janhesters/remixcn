import type { DocsPage } from '../page.ts'
import { Code, List, P, Section, Snippet } from '../ui.tsx'

const sections = {
  setup: { id: 'set-up-a-client', title: 'Set up a client' },
  tools: { id: 'tools', title: 'Tools' },
  limits: { id: 'what-it-never-does', title: 'What it never does' },
}

const config = `{
  "mcpServers": {
    "remixcn": { "command": "npx", "args": ["-y", "remixcn", "mcp"] }
  }
}`

export const page: DocsPage = {
  path: 'docs/mcp/',
  title: 'MCP server',
  summary: 'remixcn mcp lets an AI client find RemixCN components and the command that installs them.',
  group: 'Tools',
  keywords: ['mcp', 'ai', 'claude', 'cursor', 'codex', 'vs code', 'model context protocol'],
  sections: Object.values(sections),
  Content: () => () => (
    <>
      <Section {...sections.setup}>
        <P>
          Add the server to your client's config in the app's root, such as <Code>.mcp.json</Code> for Claude Code or{' '}
          <Code>.cursor/mcp.json</Code> for Cursor. <Code>remixcn help mcp</Code> prints the config for each client.
        </P>
        <Snippet title=".mcp.json" code={config} label="the MCP config" />
      </Section>
      <Section {...sections.tools}>
        <P>
          It offers the seven tools of shadcn's MCP server, with the same names and arguments: list, search and view
          items with their source, find examples, build the <Code>remixcn add</Code> command, and an audit checklist.
        </P>
      </Section>
      <Section {...sections.limits}>
        <List>
          <li>The tools only read: they write no file, run no command and open no port.</li>
          <li>Registry text is data, and the server tells the client not to follow instructions in it.</li>
        </List>
      </Section>
    </>
  ),
}
