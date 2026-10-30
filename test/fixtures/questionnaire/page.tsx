// The Questionnaire examples on one synthetic page, with both themes side by
// side, right-to-left text, a brand override and two questionnaires in one
// panel. It is a test fixture for browser tests and UI reviews, not the
// public site.
import { css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'
import type { ImportMapData } from 'remix/component/server'

import {
  QuestionnaireAnimated,
  QuestionnaireCard,
  QuestionnaireConditional,
  QuestionnaireControlled,
  QuestionnaireCustomProgress,
  QuestionnaireDemo,
  QuestionnaireDialog,
  QuestionnaireDisabled,
  QuestionnaireFreeform,
  QuestionnaireMultiple,
  QuestionnaireNativeForm,
  QuestionnaireNavigationState,
  QuestionnaireResume,
  QuestionnaireRightToLeft,
  QuestionnaireShortcuts,
  QuestionnaireSkipExample,
  QuestionnaireSubmitting,
  QuestionnaireValidation,
} from '../../../registry/examples/questionnaire-example.tsx'

interface ScriptEntry {
  href: string
  importMap: ImportMapData
  preloads: readonly string[]
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const shrinkingColumn = 'minmax(0, 1fr)'

const pageStyles = css({
  maxWidth: '76rem',
  marginInline: 'auto',
  padding: space(6),
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  gap: space(12),
  '@media (max-width: 40rem)': { padding: space(4), gap: space(10) },
})
const headerStyles = css({
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  gap: space(2),
  '& p': { margin: 0, maxWidth: '40rem', overflowWrap: 'anywhere' },
})
const titleStyles = css({
  margin: 0,
  fontSize: 'var(--text-3xl)',
  lineHeight: 'var(--text-3xl--line-height)',
  fontWeight: 600,
  letterSpacing: '-0.025em',
  overflowWrap: 'anywhere',
})
const tocStyles = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: `${space(1)} ${space(3)}`,
  margin: 0,
  padding: 0,
  listStyle: 'none',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
})
const sectionStyles = css({ display: 'grid', gridTemplateColumns: shrinkingColumn, gap: space(6) })
const sectionTitleStyles = css({
  margin: 0,
  fontSize: 'var(--text-xl)',
  lineHeight: 'var(--text-xl--line-height)',
  fontWeight: 600,
})
const gridStyles = css({
  display: 'grid',
  gap: space(6),
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 26rem), 1fr))',
})
const exampleStyles = css({
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  alignContent: 'start',
  gap: space(4),
  margin: 0,
  padding: space(5),
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  '& > h3': { margin: 0, fontSize: 'var(--text-base)', lineHeight: 'var(--text-base--line-height)', fontWeight: 600 },
  '@media (max-width: 40rem)': { padding: space(4) },
})
const wideStyles = css({ gridColumn: '1 / -1' })
const mutedStyles = css({
  margin: 0,
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
})
const themesStyles = css({
  display: 'grid',
  gap: space(6),
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 24rem), 1fr))',
})
const themePanelStyles = css({
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  gap: space(5),
  alignContent: 'start',
  padding: space(6),
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  backgroundColor: 'var(--background)',
  color: 'var(--foreground)',
  '& > h3': { margin: 0, fontSize: 'var(--text-base)', fontWeight: 600 },
  '@media (max-width: 40rem)': { padding: space(4) },
})
const narrowStyles = css({ maxWidth: '18rem' })
const echoListStyles = css({
  display: 'grid',
  gap: space(1),
  margin: 0,
  '& dt': { fontWeight: 600 },
  '& dd': { margin: 0, overflowWrap: 'anywhere' },
})

const sections = [
  ['basics', 'Basics'],
  ['checks', 'Checks and submits'],
  ['state', 'State'],
  ['composition', 'Composition'],
  ['themes', 'Themes'],
  ['right-to-left', 'Right to left'],
  ['overrides', 'Overrides'],
]

function Section(handle: Handle<{ id: string; title: string; description: string; children?: RemixNode }>) {
  return () => {
    let { id, title, description, children } = handle.props

    return (
      <section id={id} aria-labelledby={`${id}-title`} mix={sectionStyles}>
        <h2 id={`${id}-title`} mix={sectionTitleStyles}>
          {title}
        </h2>
        <p mix={mutedStyles}>{description}</p>
        {children}
      </section>
    )
  }
}

function Example(
  handle: Handle<{ id: string; title: string; description?: string; wide?: boolean; children?: RemixNode }>,
) {
  return () => {
    let { id, title, description, wide, children } = handle.props

    return (
      <figure mix={[exampleStyles, wide ? wideStyles : null]} data-example={id}>
        <h3>{title}</h3>
        {description ? <p mix={mutedStyles}>{description}</p> : null}
        {children}
      </figure>
    )
  }
}

function Document(
  handle: Handle<{ title: string; stylesheets: string[]; script?: ScriptEntry; children?: RemixNode }>,
) {
  return () => {
    let { title, stylesheets, script, children } = handle.props

    return (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content="light dark" />
          {stylesheets.map((href) => (
            <link key={href} rel="stylesheet" href={href} />
          ))}
          <title>{title}</title>
          {script ? <ImportMap value={script.importMap} /> : null}
          {script?.preloads.map((href) => (
            <link key={href} rel="modulepreload" href={href} />
          ))}
          {script ? <script type="module" src={script.href}></script> : null}
        </head>
        <body>{children}</body>
      </html>
    )
  }
}

export function QuestionnaireExamples(handle: Handle<{ stylesheets: string[]; script: ScriptEntry }>) {
  return () => {
    let { stylesheets, script } = handle.props

    return (
      <Document title="RemixCN Questionnaire" stylesheets={stylesheets} script={script}>
        <main mix={pageStyles}>
          <header mix={headerStyles}>
            <h1 mix={titleStyles}>Questionnaire</h1>
            <p>
              One question at a time in one native form: radios, checkboxes and a freeform answer, with progress,
              checks, keys and a snapshot of every answer. Synthetic data for tests and UI reviews.
            </p>
            <nav aria-label="Sections">
              <ul mix={tocStyles}>
                {sections.map(([id, label]) => (
                  <li key={id}>
                    <a href={`#${id}`}>{label}</a>
                  </li>
                ))}
              </ul>
            </nav>
          </header>

          <Section id="basics" title="Basics" description="Single, multiple, freeform and skipped answers.">
            <div mix={gridStyles}>
              <Example id="demo" title="Three questions" description="Letter keys pick an answer." wide>
                <QuestionnaireDemo />
              </Example>
              <Example id="multiple" title="Multiple">
                <QuestionnaireMultiple />
              </Example>
              <Example id="freeform" title="Freeform answer">
                <QuestionnaireFreeform />
              </Example>
              <Example id="skip" title="Explicit skip">
                <QuestionnaireSkipExample />
              </Example>
              <Example id="shortcuts" title="Number keys">
                <QuestionnaireShortcuts />
              </Example>
              <Example id="disabled" title="Disabled choice">
                <QuestionnaireDisabled />
              </Example>
            </div>
          </Section>

          <Section
            id="checks"
            title="Checks and submits"
            description="Your own async check, a submit that waits and fails, and a native post."
          >
            <div mix={gridStyles}>
              <Example id="validation" title="Async check" description="Known codes: INV-2041, INV-2042, INV-2050.">
                <QuestionnaireValidation />
              </Example>
              <Example id="submitting" title="Pending and failed submit">
                <QuestionnaireSubmitting />
              </Example>
              <Example id="native" title="Native form" description="Posts to /echo, also without a script.">
                <QuestionnaireNativeForm action="/echo" />
              </Example>
            </div>
          </Section>

          <Section id="state" title="State" description="Controlled, resumed and conditional questionnaires.">
            <div mix={gridStyles}>
              <Example id="controlled" title="Controlled">
                <QuestionnaireControlled />
              </Example>
              <Example id="resume" title="Resume a draft">
                <QuestionnaireResume />
              </Example>
              <Example id="conditional" title="Conditional question">
                <QuestionnaireConditional />
              </Example>
              <Example id="navigation-state" title="Navigation state">
                <QuestionnaireNavigationState />
              </Example>
            </div>
          </Section>

          <Section id="composition" title="Composition" description="Your own progress, motion, cards and a dialog.">
            <div mix={gridStyles}>
              <Example id="custom-progress" title="Custom progress">
                <QuestionnaireCustomProgress />
              </Example>
              <Example id="animated" title="Animated questions">
                <QuestionnaireAnimated />
              </Example>
              <Example id="card" title="Card" wide>
                <QuestionnaireCard />
              </Example>
              <Example id="dialog" title="Dialog">
                <QuestionnaireDialog />
              </Example>
            </div>
          </Section>

          <Section id="themes" title="Themes" description="data-theme overrides the system preference inside it.">
            <div mix={themesStyles}>
              {(['light', 'dark'] as const).map((theme) => (
                <div key={theme} data-theme={theme} mix={themePanelStyles}>
                  <h3>{theme === 'light' ? 'Light' : 'Dark'}</h3>
                  <QuestionnaireDisabled />
                </div>
              ))}
            </div>
          </Section>

          <Section
            id="right-to-left"
            title="Right to left"
            description="Choices, keys and buttons follow the text direction."
          >
            <div mix={gridStyles}>
              <Example id="rtl" title="من اليمين إلى اليسار">
                <QuestionnaireRightToLeft />
              </Example>
            </div>
          </Section>

          <Section id="overrides" title="Overrides" description="Tokens in @layer app, and a narrow container.">
            <div mix={gridStyles}>
              <Example id="override-brand" title="Brand ring" description="--ring and --primary in @layer app.">
                <div class="brand">
                  <QuestionnaireMultiple />
                </div>
              </Example>
              <Example id="override-narrow" title="Narrow container" description="Long words break inside 18rem.">
                <div mix={narrowStyles}>
                  <QuestionnaireFreeform />
                </div>
              </Example>
            </div>
          </Section>
        </main>
      </Document>
    )
  }
}

export function Echo(handle: Handle<{ stylesheets: string[]; fields: Array<[string, string]> }>) {
  return () => {
    let { stylesheets, fields } = handle.props

    return (
      <Document title="Received" stylesheets={stylesheets}>
        <main mix={pageStyles}>
          <h1 mix={titleStyles}>Received</h1>
          <dl mix={echoListStyles} data-echo="fields">
            {fields.map(([name, value], index) => (
              <div key={`${name}-${index}`}>
                <dt>{name}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <a href="/">Back to the examples</a>
        </main>
      </Document>
    )
  }
}
