import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import type { DocsPage } from '../page.ts'
import { href } from '../site.ts'
import { P, Section, Snippet } from '../ui.tsx'
import { page as button } from './button.tsx'

/** The component pages, in alphabetical order. */
export const componentPages: DocsPage[] = [button].toSorted((a, b) => a.title.localeCompare(b.title, 'en'))

const sections = {
  components: { id: 'components', title: 'Components' },
  install: { id: 'install', title: 'Install one' },
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const gridStyles = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 14rem), 1fr))',
  gap: space(3),
  margin: 0,
  padding: 0,
  listStyle: 'none',
})
const cardStyles = css({
  display: 'grid',
  gap: space(1),
  height: '100%',
  padding: space(4),
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  color: 'inherit',
  textDecoration: 'none',
  '&:hover': { backgroundColor: 'var(--muted)' },
})
const titleStyles = css({ fontWeight: 600 })
const summaryStyles = css({
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
})

function ComponentList(_handle: Handle) {
  return () => (
    <ul mix={gridStyles}>
      {componentPages.map((component) => (
        <li key={component.path}>
          <a href={href(component.path)} mix={cardStyles}>
            <span mix={titleStyles}>{component.title}</span>
            <span mix={summaryStyles}>{component.summary}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

export const page: DocsPage = {
  path: 'docs/components/',
  title: 'Components',
  navTitle: 'All components',
  summary: 'Every component with a reference page, in alphabetical order.',
  group: 'Components',
  keywords: ['catalog', 'index', 'reference'],
  sections: Object.values(sections),
  Content: () => () => (
    <>
      <Section {...sections.components}>
        <ComponentList />
      </Section>
      <Section {...sections.install}>
        <P>Add any component by its name. The command copies it with everything it needs into your app.</P>
        <Snippet title="Terminal" code="npx remixcn add button" label="the install command" />
      </Section>
    </>
  ),
}
