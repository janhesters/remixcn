import type { DocsPage } from '../page.ts'
import { List, P, Section } from '../ui.tsx'

const sections = {
  checks: { id: 'what-is-checked', title: 'What is checked' },
  gaps: { id: 'what-is-not', title: 'What is not' },
}

export const page: DocsPage = {
  path: 'docs/accessibility/',
  title: 'Accessibility',
  summary: 'What RemixCN checks for each component, and what it leaves to you.',
  group: 'Project',
  keywords: ['a11y', 'wcag', 'keyboard', 'screen reader', 'contrast', 'focus'],
  sections: Object.values(sections),
  Content: () => () => (
    <>
      <Section {...sections.checks}>
        <List>
          <li>Native elements and ARIA roles, keyboard use and visible focus, in Chromium, Firefox and WebKit.</li>
          <li>Text at 4.5:1 or more, focus rings and control borders at 3:1 or more, in light and dark themes.</li>
          <li>Pages that fit 320px without scrolling sideways, also with text at 200%.</li>
          <li>Reduced motion, forced colors and right-to-left text.</li>
          <li>axe-core's WCAG 2.2 A and AA rules on every example page.</li>
        </List>
      </Section>
      <Section {...sections.gaps}>
        <P>
          Screen readers aren't tested, so how they announce a component isn't claimed. Each component's notes list what
          wasn't checked. None of this is an accessibility certification: check your own app with the people who use it.
        </P>
      </Section>
    </>
  ),
}
