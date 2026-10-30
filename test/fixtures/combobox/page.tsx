// The Combobox examples on one synthetic page, with both themes side by side,
// right-to-left text, and a combobox the page renders outside any client
// entry. It is a test fixture for browser tests and UI reviews, not the
// public site.
import { css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'
import type { ImportMapData } from 'remix/component/server'

import {
  ComboboxAsync,
  ComboboxAutoHighlight,
  ComboboxBasic,
  ComboboxControlled,
  ComboboxDisabled,
  ComboboxDisabledItems,
  ComboboxInDialog,
  ComboboxInPopup,
  ComboboxInputAddon,
  ComboboxInvalid,
  ComboboxLargeList,
  ComboboxMultiple,
  ComboboxMultipleDisabled,
  ComboboxMultipleInvalid,
  ComboboxMultipleNoRemove,
  ComboboxRtl,
  ComboboxSides,
  ComboboxWithClear,
  ComboboxWithCustomItems,
  ComboboxWithForm,
  ComboboxWithGroups,
  ComboboxWithGroupsAndSeparator,
  ComboboxWithOtherInputs,
} from '../../../registry/examples/combobox-example.tsx'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '#remixcn/ui/combobox.tsx'

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

const statuses = ['Draft', 'Open', 'Paid']

function ThemePanel(handle: Handle<{ theme: 'light' | 'dark' }>) {
  return () => {
    let { theme } = handle.props

    return (
      <div data-theme={theme} mix={themePanelStyles} data-panel={theme}>
        <h3>{theme === 'light' ? 'Light' : 'Dark'}</h3>
        <ComboboxWithClear />
        <ComboboxMultiple />
        <ComboboxInvalid />
      </div>
    )
  }
}

export function ComboboxExamples(handle: Handle<{ stylesheets: string[]; script: ScriptEntry }>) {
  return () => (
    <Document title="RemixCN Combobox examples" stylesheets={handle.props.stylesheets} script={handle.props.script}>
      <main mix={pageStyles}>
        <header mix={headerStyles}>
          <h1 mix={titleStyles}>Combobox</h1>
          <p>Every example from registry/examples, rendered on the server and hydrated in its own client entry.</p>
          <p mix={mutedStyles}>
            A synthetic test fixture with invented data, not the public site. Without JavaScript, each combobox is a
            native select.
          </p>
        </header>

        <Section id="choose" title="Choosing" description="Type to filter, then choose with the keys or the pointer.">
          <div mix={gridStyles}>
            <Example title="Basic">
              <ComboboxBasic />
            </Example>
            <Example title="Clear button" description="The clear button takes the chevron's place.">
              <ComboboxWithClear />
            </Example>
            <Example title="Auto highlight" description="The first match lights up as you type.">
              <ComboboxAutoHighlight />
            </Example>
            <Example title="Disabled items" description="Nuxt.js and Remix show but can't be chosen.">
              <ComboboxDisabledItems />
            </Example>
            <Example title="Groups" description="A group without a match leaves.">
              <ComboboxWithGroups />
            </Example>
            <Example title="Groups and separators">
              <ComboboxWithGroupsAndSeparator />
            </Example>
            <Example title="Icon addon">
              <ComboboxInputAddon />
            </Example>
            <Example title="Large list" description="A hundred items; the list scrolls.">
              <ComboboxLargeList />
            </Example>
            <Example title="Custom items" description="A title and a description per country.">
              <ComboboxWithCustomItems />
            </Example>
            <Example title="Controlled" description="The status follows the value.">
              <ComboboxControlled />
            </Example>
            <Example title="Async results" description="Results load as you type; an older answer never wins.">
              <ComboboxAsync />
            </Example>
          </div>
        </Section>

        <Section id="multiple" title="Multiple" description="Chips for the chosen items, and a search after them.">
          <div mix={gridStyles}>
            <Example title="Multiple" description="Backspace removes the last chip; the arrow keys reach the chips.">
              <ComboboxMultiple />
            </Example>
            <Example title="Without remove buttons">
              <ComboboxMultipleNoRemove />
            </Example>
            <Example title="Multiple disabled">
              <ComboboxMultipleDisabled />
            </Example>
            <Example title="Multiple invalid">
              <ComboboxMultipleInvalid />
            </Example>
          </div>
        </Section>

        <Section
          id="placement"
          title="Placement"
          description="Beside the input on every side, in a popup and in a dialog."
        >
          <div mix={gridStyles}>
            <Example title="Sides">
              <ComboboxSides />
            </Example>
            <Example title="In a popup" description="A button opens the search.">
              <ComboboxInPopup />
            </Example>
            <Example title="In a dialog" description="The list opens above the dialog.">
              <ComboboxInDialog />
            </Example>
          </div>
        </Section>

        <Section id="forms" title="Forms" description="Labels, errors, disabled comboboxes and the native form value.">
          <div mix={gridStyles}>
            <Example title="Required" description="Sends to /echo; the browser checks the choice.">
              <ComboboxWithForm />
            </Example>
            <Example title="Invalid">
              <ComboboxInvalid />
            </Example>
            <Example title="Disabled">
              <ComboboxDisabled />
            </Example>
            <Example title="With other inputs" description="A combobox beside the other controls of the same height.">
              <ComboboxWithOtherInputs />
            </Example>
            <Example
              title="Server only"
              description="Rendered by the page, outside any client entry: the native select stays the control."
            >
              <Combobox name="status" items={statuses} defaultValue="Open">
                <ComboboxInput aria-label="Invoice status" placeholder="Select a status" />
                <ComboboxContent>
                  <ComboboxEmpty>No statuses found.</ComboboxEmpty>
                  <ComboboxList>
                    {(status: string) => (
                      <ComboboxItem key={status} value={status}>
                        {status}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </Example>
          </div>
        </Section>

        <Section id="themes" title="Themes" description="data-theme on an ancestor reaches the combobox and its list.">
          <div mix={themesStyles}>
            <ThemePanel theme="light" />
            <ThemePanel theme="dark" />
          </div>
        </Section>

        <Section
          id="direction"
          title="Direction"
          description="In right-to-left text, the chevron, the checks and the chips mirror, and the arrow keys follow."
        >
          <div mix={gridStyles}>
            <Example title="الفواكه">
              <ComboboxRtl />
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
