// The Select examples on one synthetic page, with both themes side by side,
// right-to-left text, and a select the page renders outside any client
// entry. It is a test fixture for browser tests and UI reviews, not the
// public site.
import { css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'
import type { ImportMapData } from 'remix/component/server'

import {
  SelectBasic,
  SelectControlled,
  SelectDisabled,
  SelectForm,
  SelectInDialog,
  SelectInline,
  SelectInvalid,
  SelectItemAligned,
  SelectLargeList,
  SelectMultiple,
  SelectPlan,
  SelectRtl,
  SelectSides,
  SelectSizes,
  SelectWithButton,
  SelectWithField,
  SelectWithGroups,
  SelectWithIcons,
} from '../../../registry/examples/select-example.tsx'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '#remixcn/ui/select.tsx'

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
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 20rem), 1fr))',
})
const exampleStyles = css({
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  alignContent: 'start',
  justifyItems: 'start',
  gap: space(3),
  margin: 0,
  padding: space(5),
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  '& > h3': { margin: 0, fontSize: 'var(--text-base)', lineHeight: 'var(--text-base--line-height)', fontWeight: 600 },
})
const mutedStyles = css({
  margin: 0,
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  // Code such as alignItemWithTrigger={false} has no break of its own.
  overflowWrap: 'anywhere',
})
const themesStyles = css({
  display: 'grid',
  gap: space(6),
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 22rem), 1fr))',
})
const themePanelStyles = css({
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  justifyItems: 'start',
  gap: space(4),
  alignContent: 'start',
  padding: space(6),
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  backgroundColor: 'var(--background)',
  color: 'var(--foreground)',
  '& h3': { margin: 0, fontSize: 'var(--text-base)', fontWeight: 600 },
})
const echoListStyles = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, max-content) minmax(0, 1fr)',
  gap: space(2),
  margin: 0,
  '& > div': { display: 'contents' },
  '& dt': { fontWeight: 600, overflowWrap: 'anywhere' },
  '& dd': { margin: 0, overflowWrap: 'anywhere' },
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

function Example(handle: Handle<{ title: string; description?: string; children?: RemixNode }>) {
  return () => {
    let { title, description, children } = handle.props

    return (
      <figure mix={exampleStyles} data-example={title}>
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
      <div data-theme={theme} mix={themePanelStyles} data-panel={theme}>
        <h3>{theme === 'light' ? 'Light' : 'Dark'}</h3>
        <SelectWithGroups />
        <SelectWithIcons />
        <SelectInvalid />
      </div>
    )
  }
}

export function SelectExamples(handle: Handle<{ stylesheets: string[]; script: ScriptEntry }>) {
  return () => (
    <Document title="RemixCN Select examples" stylesheets={handle.props.stylesheets} script={handle.props.script}>
      <main mix={pageStyles}>
        <header mix={headerStyles}>
          <h1 mix={titleStyles}>Select</h1>
          <p>Every example from registry/examples, rendered on the server and hydrated in its own client entry.</p>
          <p mix={mutedStyles}>
            A synthetic test fixture with invented data, not the public site. Without JavaScript, each select is a
            native select.
          </p>
        </header>

        <Section id="choose" title="Choosing" description="Placeholders, groups, icons, sizes and many items.">
          <div mix={gridStyles}>
            <Example title="Basic" description="The first item has no value: it is the placeholder.">
              <SelectBasic />
            </Example>
            <Example title="Groups" description="Labelled groups with a separator.">
              <SelectWithGroups />
            </Example>
            <Example title="Icons" description="The trigger shows the chosen item's icon.">
              <SelectWithIcons />
            </Example>
            <Example title="Sizes">
              <SelectSizes />
            </Example>
            <Example title="Large list" description="A hundred items; the list scrolls.">
              <SelectLargeList />
            </Example>
            <Example title="Multiple" description="The list stays open while you choose.">
              <SelectMultiple />
            </Example>
            <Example title="Plan" description="Items with a title and a description.">
              <SelectPlan />
            </Example>
            <Example title="Controlled" description="The status follows the value.">
              <SelectControlled />
            </Example>
          </div>
        </Section>

        <Section id="placement" title="Placement" description="Over the trigger, or beside it on every side.">
          <div mix={gridStyles}>
            <Example title="Item aligned" description="The chosen item opens where the value is. Grapes is off.">
              <SelectItemAligned />
            </Example>
            <Example title="Sides" description="alignItemWithTrigger={false} with each side.">
              <SelectSides />
            </Example>
            <Example title="In a dialog" description="The list opens above the dialog.">
              <SelectInDialog />
            </Example>
          </div>
        </Section>

        <Section id="forms" title="Forms" description="Labels, errors, disabled selects and the native form value.">
          <div mix={gridStyles}>
            <Example title="Field">
              <SelectWithField />
            </Example>
            <Example title="Invalid">
              <SelectInvalid />
            </Example>
            <Example title="Disabled">
              <SelectDisabled />
            </Example>
            <Example title="With a button">
              <SelectWithButton />
            </Example>
            <Example title="Inline" description="Beside a search field and a NativeSelect.">
              <SelectInline />
            </Example>
            <Example title="Required" description="Sends to /echo; the browser checks the choice.">
              <SelectForm />
            </Example>
            <Example
              title="Server only"
              description="Rendered by the page, outside any client entry: the native select stays the control."
            >
              <Select name="status" defaultValue="open">
                <SelectTrigger aria-label="Invoice status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Example>
          </div>
        </Section>

        <Section id="themes" title="Themes" description="data-theme on an ancestor reaches the select and its list.">
          <div mix={themesStyles}>
            <ThemePanel theme="light" />
            <ThemePanel theme="dark" />
          </div>
        </Section>

        <Section
          id="direction"
          title="Direction"
          description="In right-to-left text, the chevron, the checks and the lined-up list mirror."
        >
          <div mix={gridStyles}>
            <Example title="الفواكه">
              <SelectRtl />
            </Example>
          </div>
        </Section>
      </main>
    </Document>
  )
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
