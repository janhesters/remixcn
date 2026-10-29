// The Button and Button Group examples on one synthetic page, with both
// themes side by side and right-to-left text. It is a test fixture for
// browser tests and UI reviews, not the public site.
import { css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'
import type { ImportMapData } from 'remix/component/server'

import {
  ButtonAsLink,
  ButtonDisabled,
  ButtonForm,
  ButtonIconOnly,
  ButtonInvalid,
  ButtonLoading,
  ButtonOverrides,
  ButtonVariantsAndSizes,
  ButtonWithIcons,
} from '../../../registry/examples/button-example.tsx'
import {
  ButtonGroupBasic,
  ButtonGroupLabelled,
  ButtonGroupNested,
  ButtonGroupPagination,
  ButtonGroupSizes,
  ButtonGroupSplit,
  ButtonGroupStepper,
  ButtonGroupVertical,
  ButtonGroupWithCount,
  ButtonGroupWithIcons,
  ButtonGroupWithInput,
  ButtonGroupWithText,
} from '../../../registry/examples/button-group-example.tsx'
import { Button } from '#remixcn/ui/button.tsx'

interface ScriptEntry {
  href: string
  importMap: ImportMapData
  preloads: readonly string[]
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const shrinkingColumn = 'minmax(0, 1fr)'

const pageStyles = css({
  maxWidth: '72rem',
  marginInline: 'auto',
  padding: space(6),
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  gap: space(12),
  '@media (max-width: 40rem)': { padding: space(4), gap: space(10) },
})
// A long path such as registry/examples may break, so large text still reflows.
const headerStyles = css({
  display: 'grid',
  gap: space(2),
  '& p': { margin: 0, maxWidth: '40rem', overflowWrap: 'anywhere' },
})
const titleStyles = css({
  margin: 0,
  fontSize: 'var(--text-3xl)',
  lineHeight: 'var(--text-3xl--line-height)',
  fontWeight: 600,
  letterSpacing: '-0.025em',
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
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 22rem), 1fr))',
})
const exampleStyles = css({
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  alignContent: 'start',
  gap: space(3),
  margin: 0,
  padding: space(5),
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  '& > h3': { margin: 0, fontSize: 'var(--text-base)', lineHeight: 'var(--text-base--line-height)', fontWeight: 600 },
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
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 22rem), 1fr))',
})
const themePanelStyles = css({
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  gap: space(5),
  alignContent: 'start',
  padding: space(6),
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  '& h3': { margin: 0, fontSize: 'var(--text-base)', fontWeight: 600 },
})
const orderStyles = css({ display: 'grid', gridTemplateColumns: shrinkingColumn, justifyItems: 'start', gap: space(3) })
const echoListStyles = css({
  display: 'grid',
  gap: space(1),
  margin: 0,
  '& dt': { fontWeight: 600 },
  '& dd': { margin: 0 },
})

function Section(handle: Handle<{ id: string; title: string; description: string; children?: RemixNode }>) {
  return () => {
    let { id, title, description, children } = handle.props

    return (
      <section aria-labelledby={id} mix={sectionStyles}>
        <h2 id={id} mix={sectionTitleStyles}>
          {title}
        </h2>
        <p mix={mutedStyles}>{description}</p>
        {children}
      </section>
    )
  }
}

function Example(handle: Handle<{ title: string; description?: string; wide?: boolean; children?: RemixNode }>) {
  return () => {
    let { title, description, wide, children } = handle.props

    return (
      <figure mix={[exampleStyles, wide ? wideStyles : null]} data-example={title}>
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

function ThemePanel(handle: Handle<{ theme: 'light' | 'dark' }>) {
  return () => {
    let { theme } = handle.props

    return (
      <div data-theme={theme} mix={themePanelStyles}>
        <h3>{theme === 'light' ? 'Light' : 'Dark'}</h3>
        <ButtonVariantsAndSizes />
        <ButtonGroupBasic />
        <ButtonGroupSplit />
        <ButtonInvalid />
      </div>
    )
  }
}

export function ButtonExamples(handle: Handle<{ stylesheets: string[]; script: ScriptEntry }>) {
  return () => (
    <Document title="RemixCN Button examples" stylesheets={handle.props.stylesheets} script={handle.props.script}>
      <main mix={pageStyles}>
        <header mix={headerStyles}>
          <h1 mix={titleStyles}>Button and Button Group</h1>
          <p>Every example from registry/examples, rendered on the server and hydrated where it handles events.</p>
          <p mix={mutedStyles}>
            A synthetic test fixture with invented data, not the public site. Forms post to /echo, which shows what the
            server received.
          </p>
        </header>

        <Section id="button" title="Button" description="Variants, sizes, icons, links, forms and states.">
          <div mix={gridStyles}>
            <Example title="Variants and sizes" wide>
              <ButtonVariantsAndSizes />
            </Example>
            <Example title="With icons">
              <ButtonWithIcons />
            </Example>
            <Example title="Icon only" description="Each names its action with aria-label.">
              <ButtonIconOnly />
            </Example>
            <Example title="As links" description="Native links with buttonVariants().">
              <ButtonAsLink />
            </Example>
            <Example title="Disabled">
              <ButtonDisabled />
            </Example>
            <Example title="Invalid" wide>
              <ButtonInvalid />
            </Example>
            <Example title="Form" description="Submit, reset and action buttons." wide>
              <ButtonForm action="/echo" draftAction="/echo/draft" />
            </Example>
            <Example title="Loading" description="Keeps focus while it saves.">
              <ButtonLoading />
            </Example>
            <Example title="Overrides" description="A caller css(), a token, and a rule in @layer app.">
              <ButtonOverrides />
              <div>
                <Button variant="outline" class="square" data-override="app">
                  App layer
                </Button>
              </div>
            </Example>
            <Example
              title="Server only"
              description="Rendered by the page, outside any client entry, so no Button code runs in the browser."
            >
              <form action="/echo" method="post" mix={orderStyles}>
                <div>
                  <Button type="submit" name="intent" value="pay" aria-disabled="true">
                    Pay
                  </Button>{' '}
                  <Button disabled focusableWhenDisabled>
                    Wait
                  </Button>{' '}
                  <Button type="submit" name="intent" value="hold" variant="outline">
                    Hold
                  </Button>
                </div>
              </form>
            </Example>
          </div>
        </Section>

        <Section
          id="button-group"
          title="Button Group"
          description="Joined parts in a row or a column. The group adds no tab stop and no form."
        >
          <div mix={gridStyles}>
            <Example title="Basic">
              <ButtonGroupBasic />
            </Example>
            <Example title="With input">
              <ButtonGroupWithInput action="/echo" />
            </Example>
            <Example title="With text">
              <ButtonGroupWithText />
            </Example>
            <Example title="With icons">
              <ButtonGroupWithIcons />
            </Example>
            <Example title="Split">
              <ButtonGroupSplit />
            </Example>
            <Example title="With count">
              <ButtonGroupWithCount />
            </Example>
            <Example title="Nested">
              <ButtonGroupNested />
            </Example>
            <Example title="Labelled">
              <ButtonGroupLabelled />
            </Example>
            <Example title="Pagination" description="Native links in a nav." wide>
              <ButtonGroupPagination />
            </Example>
            <Example title="Vertical">
              <ButtonGroupVertical />
            </Example>
            <Example title="Sizes">
              <ButtonGroupSizes />
            </Example>
            <Example title="Stepper" description="Two instances with their own state, in one form.">
              <form action="/echo" method="post" mix={orderStyles}>
                <ButtonGroupStepper label="invoices" name="invoices" initial={1} max={3} />
                <ButtonGroupStepper label="reminders" name="reminders" initial={2} />
                <Button type="submit" variant="outline" size="sm">
                  Order
                </Button>
              </form>
            </Example>
          </div>
        </Section>

        <Section id="themes" title="Themes" description="data-theme overrides the system preference inside it.">
          <div mix={themesStyles}>
            <ThemePanel theme="light" />
            <ThemePanel theme="dark" />
          </div>
        </Section>

        <Section
          id="direction"
          title="Direction"
          description="In right-to-left text, the joins, padding and onward arrows mirror."
        >
          <div dir="rtl" lang="ar" mix={gridStyles}>
            <Example title="أزرار">
              <ButtonWithIcons />
            </Example>
            <Example title="مجموعة">
              <ButtonGroupBasic />
              <ButtonGroupSplit />
            </Example>
            <Example title="صفحات" wide>
              <ButtonGroupPagination />
            </Example>
          </div>
        </Section>
      </main>
    </Document>
  )
}

export function Echo(
  handle: Handle<{ stylesheets: string[]; method: string; path: string; fields: Array<[string, string]> }>,
) {
  return () => {
    let { stylesheets, method, path, fields } = handle.props

    return (
      <Document title="Received" stylesheets={stylesheets}>
        <main mix={pageStyles}>
          <h1 mix={titleStyles}>Received</h1>
          <p data-echo="request">
            {method} {path}
          </p>
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
