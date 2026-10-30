// The Input Group and Input OTP examples on one synthetic page, with both
// themes side by side, right-to-left text, overrides and the parts as a page
// shows them before their script runs. It is a test fixture for browser tests
// and UI reviews, not the public site.
import { css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'
import type { ImportMapData } from 'remix/component/server'

import {
  InputGroupBasic,
  InputGroupCopyLink,
  InputGroupCounter,
  InputGroupCustomControl,
  InputGroupInButtonGroup,
  InputGroupInCard,
  InputGroupSearchForm,
  InputGroupTextareas,
  InputGroupWithAddons,
  InputGroupWithButtons,
  InputGroupWithKbd,
} from '../../../registry/examples/input-group-example.tsx'
import {
  InputOTPAlphanumeric,
  InputOTPControlled,
  InputOTPDigitsOnly,
  InputOTPDisabled,
  InputOTPForm,
  InputOTPFourDigits,
  InputOTPInvalid,
  InputOTPMasked,
  InputOTPSimple,
  InputOTPWithSeparator,
} from '../../../registry/examples/input-otp-example.tsx'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '#remixcn/ui/field.tsx'
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '#remixcn/ui/input-group.tsx'
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot, REGEXP_ONLY_DIGITS } from '#remixcn/ui/input-otp.tsx'
import { Overrides, RightToLeft, ThemePanel } from './islands.tsx'

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
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 22rem), 1fr))',
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
const echoListStyles = css({
  display: 'grid',
  gap: space(1),
  margin: 0,
  '& dt': { fontWeight: 600 },
  '& dd': { margin: 0, overflowWrap: 'anywhere' },
})

const families = [
  ['input-group', 'Input Group'],
  ['input-otp', 'Input OTP'],
  ['themes', 'Themes'],
  ['right-to-left', 'Right to left'],
  ['overrides', 'Overrides'],
  ['without-script', 'Without its script'],
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

// Rendered straight into the page, outside any client entry, so no script
// ever runs them: the parts as a server-only page shows them.
function WithoutScript() {
  return () => (
    <div mix={gridStyles}>
      <Example
        id="server-only"
        title="Server-rendered only"
        description="No client entry runs these. The code turns into a plain text box after two seconds, or at once without scripting."
      >
        <FieldGroup>
          <Field>
            <FieldLabel for="server-code">Verification code</FieldLabel>
            <InputOTP
              id="server-code"
              name="code"
              maxLength={6}
              pattern={REGEXP_ONLY_DIGITS}
              aria-describedby="server-code-hint"
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
            <FieldDescription id="server-code-hint">Six digits.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel for="server-amount">Amount</FieldLabel>
            <InputGroup>
              <InputGroupInput id="server-amount" name="amount" inputMode="decimal" />
              <InputGroupAddon>
                <InputGroupText>CHF</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </Field>
        </FieldGroup>
      </Example>
    </div>
  )
}

export function InputGroupExamples(handle: Handle<{ stylesheets: string[]; script: ScriptEntry }>) {
  return () => {
    let { stylesheets, script } = handle.props

    return (
      <Document title="RemixCN Input Group and Input OTP examples" stylesheets={stylesheets} script={script}>
        <main mix={pageStyles}>
          <header mix={headerStyles}>
            <h1 mix={titleStyles}>Input Group and Input OTP</h1>
            <p>
              Every example from registry/examples for Input Group and Input OTP, rendered on the server and hydrated as
              client entries.
            </p>
            <p mix={mutedStyles}>
              A synthetic test fixture with invented data, not the public site. Forms send to /echo, which shows what
              the server received.
            </p>
            <nav aria-label="Sections">
              <ul mix={tocStyles}>
                {families.map(([id, title]) => (
                  <li key={id}>
                    <a href={`#${id}`}>{title}</a>
                  </li>
                ))}
              </ul>
            </nav>
          </header>

          <Section
            id="input-group"
            title="Input Group"
            description="One box around a native input or textarea and its icons, text, keys and buttons."
          >
            <div mix={gridStyles}>
              <Example id="input-group-basic" title="Basic">
                <InputGroupBasic />
              </Example>
              <Example id="input-group-addons" title="Addons">
                <InputGroupWithAddons />
              </Example>
              <Example id="input-group-buttons" title="Buttons">
                <InputGroupWithButtons />
              </Example>
              <Example id="input-group-kbd" title="Keys, status and loading">
                <InputGroupWithKbd />
              </Example>
              <Example id="input-group-copy" title="Copy" description="The clipboard and a status.">
                <InputGroupCopyLink />
              </Example>
              <Example id="input-group-button-group" title="In a button group">
                <InputGroupInButtonGroup />
              </Example>
              <Example id="input-group-search" title="Search form" description="Sends to /echo. Clear resets it.">
                <InputGroupSearchForm action="/echo" />
              </Example>
              <Example id="input-group-counter" title="Live count" description="An error past 280 characters.">
                <InputGroupCounter />
              </Example>
              <Example id="input-group-custom" title="Custom control" description="A native select joins the ring.">
                <InputGroupCustomControl />
              </Example>
              <Example id="input-group-card" title="In a card" description="Sends to /echo.">
                <InputGroupInCard action="/echo" />
              </Example>
              <Example id="input-group-textareas" title="Textareas" wide>
                <InputGroupTextareas />
              </Example>
            </div>
          </Section>

          <Section
            id="input-otp"
            title="Input OTP"
            description="One real text input for a one-time code; the slots draw its value and selection."
          >
            <div mix={gridStyles}>
              <Example id="input-otp-simple" title="Simple">
                <InputOTPSimple />
              </Example>
              <Example id="input-otp-digits" title="Digits only">
                <InputOTPDigitsOnly />
              </Example>
              <Example id="input-otp-separator" title="With separators">
                <InputOTPWithSeparator />
              </Example>
              <Example id="input-otp-alphanumeric" title="Alphanumeric">
                <InputOTPAlphanumeric />
              </Example>
              <Example id="input-otp-disabled" title="Disabled">
                <InputOTPDisabled />
              </Example>
              <Example id="input-otp-four" title="Four digits">
                <InputOTPFourDigits />
              </Example>
              <Example id="input-otp-masked" title="Masked">
                <InputOTPMasked />
              </Example>
              <Example id="input-otp-invalid" title="Invalid">
                <InputOTPInvalid />
              </Example>
              <Example id="input-otp-controlled" title="Controlled">
                <InputOTPControlled />
              </Example>
              <Example
                id="input-otp-form"
                title="Form"
                description="Sends to /echo once the code is complete, or with Verify."
              >
                <InputOTPForm action="/echo" />
              </Example>
            </div>
          </Section>

          <Section id="themes" title="Themes" description="data-theme overrides the system preference inside it.">
            <div mix={themesStyles}>
              <ThemePanel theme="light" />
              <ThemePanel theme="dark" />
            </div>
          </Section>

          <Section id="right-to-left" title="Right to left" description="Addons and slots follow the text direction.">
            <RightToLeft />
          </Section>

          <Section
            id="overrides"
            title="Overrides"
            description="Tokens and classes in @layer app, and a narrow container."
          >
            <Overrides />
          </Section>

          <Section
            id="without-script"
            title="Without its script"
            description="Native controls that take, validate and submit their values before any script runs."
          >
            <WithoutScript />
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
