// The controls showcase: a synthetic page with every example of Checkbox,
// Radio Group, Switch, Toggle and Toggle Group, a native form, and a
// right-to-left panel. It is a local fixture for tests and screenshots, not
// the public site.
import type { ScriptEntry } from 'remix/assets'
import { css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'

import { Checkbox } from '#remixcn/ui/checkbox.tsx'
import { RadioGroup, RadioGroupItem } from '#remixcn/ui/radio-group.tsx'
import { Switch } from '#remixcn/ui/switch.tsx'

import * as checkbox from '../../../registry/examples/checkbox-example.tsx'
import * as radioGroup from '../../../registry/examples/radio-group-example.tsx'
import * as switches from '../../../registry/examples/switch-example.tsx'
import * as toggleGroup from '../../../registry/examples/toggle-group-example.tsx'
import * as toggle from '../../../registry/examples/toggle-example.tsx'
import * as styles from './styles.ts'

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
  '& p': { margin: 0, maxWidth: '44rem' },
})
const titleStyles = css({
  fontSize: 'var(--text-3xl)',
  lineHeight: 'var(--text-3xl--line-height)',
  margin: 0,
  fontWeight: 600,
  letterSpacing: '-0.025em',
})
const sectionStyles = css({ display: 'grid', gridTemplateColumns: shrinkingColumn, gap: space(4) })
const sectionTitleStyles = css({
  fontSize: 'var(--text-xl)',
  lineHeight: 'var(--text-xl--line-height)',
  margin: 0,
  fontWeight: 600,
})
const gridStyles = css({
  display: 'grid',
  gap: space(4),
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 20rem), 1fr))',
  alignItems: 'start',
})
const exampleStyles = css({
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  gap: space(4),
  minWidth: 0,
  padding: space(5),
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  '& h3': {
    fontSize: 'var(--text-sm)',
    lineHeight: 'var(--text-sm--line-height)',
    margin: 0,
    fontWeight: 500,
    color: 'var(--muted-foreground)',
  },
})
const formStyles = css({ display: 'grid', gridTemplateColumns: shrinkingColumn, gap: space(6), maxWidth: '36rem' })
const buttonStyles = css({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: space(9),
  paddingInline: space(4),
  border: '1px solid var(--input)',
  borderRadius: 'var(--radius-md)',
  background: 'transparent',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  '&[type="submit"]': {
    background: 'var(--primary)',
    borderColor: 'var(--primary)',
    color: 'var(--primary-foreground)',
  },
})

function Section(handle: Handle<{ id: string; title: string; description: string; children?: RemixNode }>) {
  return () => {
    let { id, title, description, children } = handle.props
    return (
      <section aria-labelledby={id} mix={sectionStyles}>
        <h2 id={id} mix={sectionTitleStyles}>
          {title}
        </h2>
        <p mix={styles.description}>{description}</p>
        {children}
      </section>
    )
  }
}

function Example(handle: Handle<{ title: string; children?: RemixNode }>) {
  return () => (
    <article data-example={handle.props.title} mix={exampleStyles}>
      <h3>{handle.props.title}</h3>
      {handle.props.children}
    </article>
  )
}

const people = [
  { id: '1', name: 'Sarah Chen', email: 'sarah.chen@example.com', role: 'Admin' },
  { id: '2', name: 'Marcus Rodriguez', email: 'marcus.rodriguez@example.com', role: 'User' },
  { id: '3', name: 'Priya Patel', email: 'priya.patel@example.com', role: 'User' },
  { id: '4', name: 'David Kim', email: 'david.kim@example.com', role: 'Editor' },
]

/** A form that only native controls drive: it submits and resets without JavaScript. */
function NativeForm() {
  return () => (
    <form method="get" action="/submitted" aria-labelledby="native-form" mix={formStyles}>
      <fieldset mix={styles.fieldset}>
        <legend>Reminders</legend>
        <div mix={styles.row}>
          <Checkbox id="form-email" name="reminders" value="email" defaultChecked />
          <label for="form-email" mix={styles.plainLabel}>
            Email
          </label>
        </div>
        <div mix={styles.row}>
          <Checkbox id="form-sms" name="reminders" value="sms" />
          <label for="form-sms" mix={styles.plainLabel}>
            SMS
          </label>
        </div>
      </fieldset>
      <fieldset mix={styles.fieldset}>
        <legend id="form-plan">Plan</legend>
        <RadioGroup name="plan" defaultValue="free" required aria-labelledby="form-plan">
          <div mix={styles.row}>
            <RadioGroupItem id="form-free" value="free" />
            <label for="form-free" mix={styles.plainLabel}>
              Free
            </label>
          </div>
          <div mix={styles.row}>
            <RadioGroupItem id="form-pro" value="pro" />
            <label for="form-pro" mix={styles.plainLabel}>
              Pro
            </label>
          </div>
        </RadioGroup>
      </fieldset>
      <div mix={styles.row}>
        <Switch id="form-autopay" name="autopay" value="yes" />
        <label for="form-autopay" mix={styles.label}>
          Pay automatically
        </label>
      </div>
      <div mix={styles.row}>
        <Checkbox id="form-terms" name="terms" value="accepted" required />
        <label for="form-terms" mix={styles.label}>
          I accept the terms
        </label>
      </div>
      <div mix={styles.stack}>
        <p mix={styles.description}>Formatting toolbar: its toggles never submit the form or add a value to it.</p>
        <toggleGroup.ToggleGroupBasic />
      </div>
      <div mix={styles.wrap}>
        <button type="submit" mix={buttonStyles}>
          Save
        </button>
        <button type="reset" mix={buttonStyles}>
          Reset
        </button>
      </div>
    </form>
  )
}

const rtlStyles = css({
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  gap: space(4),
  padding: space(5),
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
})

/** The same controls in Arabic text, written from right to left. */
function RightToLeft() {
  return () => (
    <div dir="rtl" lang="ar" data-rtl mix={rtlStyles}>
      <div mix={styles.row}>
        <Checkbox id="rtl-terms" defaultChecked />
        <label for="rtl-terms" mix={styles.label}>
          أوافق على الشروط
        </label>
      </div>
      <div mix={styles.row}>
        <Switch id="rtl-wifi" defaultChecked />
        <label for="rtl-wifi" mix={styles.label}>
          واي فاي
        </label>
      </div>
      <RadioGroup defaultValue="monthly" aria-label="فترة الفوترة">
        <div mix={styles.row}>
          <RadioGroupItem id="rtl-monthly" value="monthly" />
          <label for="rtl-monthly" mix={styles.plainLabel}>
            شهري
          </label>
        </div>
        <div mix={styles.row}>
          <RadioGroupItem id="rtl-yearly" value="yearly" />
          <label for="rtl-yearly" mix={styles.plainLabel}>
            سنوي
          </label>
        </div>
      </RadioGroup>
      <toggleGroup.ToggleGroupJoined label="المحاذاة" />
    </div>
  )
}

export function ControlsPage(handle: Handle<{ stylesheets: string[]; script: ScriptEntry }>) {
  return () => {
    let { stylesheets, script } = handle.props

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>RemixCN controls: Checkbox, Radio Group, Switch and Toggle</title>
          {stylesheets.map((href) => (
            <link key={href} rel="stylesheet" href={href} />
          ))}
          <ImportMap value={script.importMap} />
          {script.preloads.map((preload) => (
            <link key={preload} rel="modulepreload" href={preload} />
          ))}
          <script type="module" src={script.href}></script>
        </head>
        <body>
          <main mix={pageStyles}>
            <header mix={headerStyles}>
              <h1 mix={titleStyles}>Checkbox, Radio Group, Switch and Toggle</h1>
              <p>
                Synthetic examples of RemixCN's stateful controls, after shadcn/ui's examples. Checkboxes, radios and
                switches are native inputs and work before JavaScript runs. Toggles need the browser to change state.
              </p>
            </header>

            <Section
              id="checkbox"
              title="Checkbox"
              description="A native checkbox, with a mixed state for partial selections."
            >
              <div mix={gridStyles}>
                <Example title="Basic">
                  <checkbox.CheckboxBasic />
                </Example>
                <Example title="With description">
                  <checkbox.CheckboxWithDescription />
                </Example>
                <Example title="Invalid">
                  <checkbox.CheckboxInvalid />
                </Example>
                <Example title="Disabled">
                  <checkbox.CheckboxDisabled />
                </Example>
                <Example title="With title">
                  <checkbox.CheckboxWithTitle />
                </Example>
                <Example title="Group">
                  <checkbox.CheckboxGroup />
                </Example>
                <Example title="Select all">
                  <checkbox.CheckboxSelectAll people={people} selected={['1', '3']} />
                </Example>
              </div>
            </Section>

            <Section
              id="radio-group"
              title="Radio Group"
              description="Native radios with one name: the browser moves the selection with the arrow keys."
            >
              <div mix={gridStyles}>
                <Example title="Basic">
                  <radioGroup.RadioGroupBasic />
                </Example>
                <Example title="With descriptions">
                  <radioGroup.RadioGroupWithDescriptions />
                </Example>
                <Example title="With fieldset">
                  <radioGroup.RadioGroupWithFieldset />
                </Example>
                <Example title="Grid">
                  <radioGroup.RadioGroupGrid />
                </Example>
                <Example title="Disabled">
                  <radioGroup.RadioGroupDisabled />
                </Example>
                <Example title="Invalid">
                  <radioGroup.RadioGroupInvalid />
                </Example>
                <Example title="Controlled">
                  <radioGroup.RadioGroupControlled initialValue="monthly" />
                </Example>
              </div>
            </Section>

            <Section id="switch" title="Switch" description="A native checkbox with the switch role, in two sizes.">
              <div mix={gridStyles}>
                <Example title="Basic">
                  <switches.SwitchBasic />
                </Example>
                <Example title="With description">
                  <switches.SwitchWithDescription />
                </Example>
                <Example title="With label">
                  <switches.SwitchWithLabel />
                </Example>
                <Example title="Disabled">
                  <switches.SwitchDisabled />
                </Example>
                <Example title="Sizes">
                  <switches.SwitchSizes />
                </Example>
                <Example title="Controlled">
                  <switches.SwitchControlled initiallyOn />
                </Example>
              </div>
            </Section>

            <Section
              id="toggle"
              title="Toggle"
              description="A native button with aria-pressed. A bar under a pressed toggle marks it beyond its color."
            >
              <div mix={gridStyles}>
                <Example title="Basic">
                  <toggle.ToggleBasic />
                </Example>
                <Example title="Outline">
                  <toggle.ToggleOutline />
                </Example>
                <Example title="Sizes">
                  <toggle.ToggleSizes />
                </Example>
                <Example title="Disabled">
                  <toggle.ToggleDisabled />
                </Example>
                <Example title="With icon">
                  <toggle.ToggleWithIcon />
                </Example>
                <Example title="Formatting">
                  <toggle.ToggleFormatting />
                </Example>
              </div>
            </Section>

            <Section
              id="toggle-group"
              title="Toggle Group"
              description="Toggles with one value, in single or multiple mode. The group is one tab stop; the arrow keys move inside it."
            >
              <div mix={gridStyles}>
                <Example title="Multiple">
                  <toggleGroup.ToggleGroupBasic />
                </Example>
                <Example title="Outline">
                  <toggleGroup.ToggleGroupOutline />
                </Example>
                <Example title="Sizes">
                  <toggleGroup.ToggleGroupSizes />
                </Example>
                <Example title="Joined">
                  <toggleGroup.ToggleGroupJoined label="Alignment" />
                </Example>
                <Example title="Vertical">
                  <toggleGroup.ToggleGroupVertical />
                </Example>
                <Example title="Disabled">
                  <toggleGroup.ToggleGroupDisabled />
                </Example>
                <Example title="Filter">
                  <toggleGroup.ToggleGroupFilter />
                </Example>
              </div>
            </Section>

            <Section
              id="native-form"
              title="Native form"
              description="Submits with GET to a page that lists the values, and resets to the defaults."
            >
              <NativeForm />
            </Section>

            <Section
              id="right-to-left"
              title="Right to left"
              description="Checks, thumbs and joined corners follow the text direction."
            >
              <RightToLeft />
            </Section>
          </main>
        </body>
      </html>
    )
  }
}

/** The page a submission of the native form lands on: each submitted name and value. */
export function SubmittedPage(handle: Handle<{ stylesheets: string[]; entries: Array<[string, string]> }>) {
  return () => (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Submitted values</title>
        {handle.props.stylesheets.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
      </head>
      <body>
        <main mix={pageStyles}>
          <h1 mix={titleStyles}>Submitted values</h1>
          <ul aria-label="Submitted values" mix={styles.list}>
            {handle.props.entries.map(([name, value], index) => (
              <li key={index}>
                {name}={value}
              </li>
            ))}
          </ul>
          <a href="/">Back to the controls</a>
        </main>
      </body>
    </html>
  )
}
