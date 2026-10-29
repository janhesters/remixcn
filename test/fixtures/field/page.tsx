// The Field, Input, Label, Native Select and Textarea examples on one
// synthetic page, with server validation, both themes side by side,
// right-to-left text and overrides. It is a test fixture for browser tests
// and UI reviews, not the public site.
import { css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'
import type { ImportMapData } from 'remix/component/server'

import {
  FieldCheckboxes,
  FieldHorizontal,
  FieldInputs,
  FieldInvoiceForm,
  FieldNativeSelects,
  FieldRadios,
  FieldRecipients,
  FieldResponsive,
  FieldSignIn,
  FieldSliders,
  FieldSwitches,
  FieldTextareas,
} from '../../../registry/examples/field-example.tsx'
import {
  InputBasic,
  InputDisabled,
  InputForm,
  InputInvalid,
  InputReadOnly,
  InputTypes,
  InputWithButton,
  InputWithDatalist,
  InputWithDescription,
  InputWithLabel,
  InputWithNativeSelect,
} from '../../../registry/examples/input-example.tsx'
import {
  LabelDisabled,
  LabelWithCheckbox,
  LabelWithInput,
  LabelWithTextarea,
} from '../../../registry/examples/label-example.tsx'
import {
  NativeSelectBasic,
  NativeSelectControlled,
  NativeSelectDisabled,
  NativeSelectInvalid,
  NativeSelectSizes,
  NativeSelectWithField,
  NativeSelectWithGroups,
} from '../../../registry/examples/native-select-example.tsx'
import {
  TextareaBasic,
  TextareaDisabled,
  TextareaInvalid,
  TextareaWithDescription,
  TextareaWithLabel,
} from '../../../registry/examples/textarea-example.tsx'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from '#remixcn/ui/field.tsx'
import type { FieldErrorEntry } from '#remixcn/ui/field.tsx'
import { Checkbox } from '#remixcn/ui/checkbox.tsx'
import { Input } from '#remixcn/ui/input.tsx'
import { NativeSelect, NativeSelectOption } from '#remixcn/ui/native-select.tsx'
import { Textarea } from '#remixcn/ui/textarea.tsx'

interface ScriptEntry {
  href: string
  importMap: ImportMapData
  preloads: readonly string[]
}

/** What the server found in a posted invoice form. */
export interface InvoiceResult {
  values: Record<string, string>
  errors?: Record<string, FieldErrorEntry[]>
  formError?: string
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
const themePanelStyles = css({
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  gap: space(5),
  alignContent: 'start',
  padding: space(6),
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  '& > h3': { margin: 0, fontSize: 'var(--text-base)', fontWeight: 600 },
  '@media (max-width: 40rem)': { padding: space(4) },
})
const narrowStyles = css({ maxWidth: '16rem' })
const echoListStyles = css({
  display: 'grid',
  gap: space(1),
  margin: 0,
  '& dt': { fontWeight: 600 },
  '& dd': { margin: 0, overflowWrap: 'anywhere' },
})

const families = [
  ['field', 'Field'],
  ['validation', 'Validation'],
  ['input', 'Input'],
  ['label', 'Label'],
  ['native-select', 'Native Select'],
  ['textarea', 'Textarea'],
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

// The registry examples use fixed ids, so the theme panels compose their own fields with ids per theme.
function ThemePanel(handle: Handle<{ theme: 'light' | 'dark' }>) {
  return () => {
    let { theme } = handle.props
    let id = (name: string) => `${theme}-${name}`

    return (
      <div data-theme={theme} data-panel={theme} mix={themePanelStyles}>
        <h3>{theme === 'light' ? 'Light' : 'Dark'}</h3>
        <FieldGroup>
          <Field>
            <FieldLabel for={id('customer')}>Customer</FieldLabel>
            <Input id={id('customer')} placeholder="Acme Labs" aria-describedby={id('customer-hint')} />
            <FieldDescription id={id('customer-hint')}>As it appears on invoices.</FieldDescription>
          </Field>
          <Field invalid>
            <FieldLabel for={id('email')}>Billing email</FieldLabel>
            <Input
              id={id('email')}
              type="email"
              defaultValue="ada@"
              aria-invalid={true}
              aria-describedby={id('email-error')}
            />
            <FieldError
              id={id('email-error')}
              errors={[{ message: 'Enter an email address like name@example.com.' }]}
            />
          </Field>
          <Field>
            <FieldLabel for={id('currency')}>Currency</FieldLabel>
            <NativeSelect id={id('currency')} defaultValue="CHF">
              <NativeSelectOption>CHF</NativeSelectOption>
              <NativeSelectOption>EUR</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel for={id('note')}>Note</FieldLabel>
            <Textarea id={id('note')} placeholder="Thanks for your order." />
          </Field>
          <Field orientation="horizontal">
            <Checkbox id={id('remind')} defaultChecked />
            <FieldLabel for={id('remind')}>Remind the customer</FieldLabel>
          </Field>
          <FieldLabel for={id('autopay')}>
            <Field orientation="horizontal">
              <Checkbox
                id={id('autopay')}
                defaultChecked
                aria-labelledby={id('autopay-title')}
                aria-describedby={id('autopay-hint')}
              />
              <FieldContent>
                <FieldTitle id={id('autopay-title')}>Pay automatically</FieldTitle>
                <FieldDescription id={id('autopay-hint')}>On each due date.</FieldDescription>
              </FieldContent>
            </Field>
          </FieldLabel>
          <FieldSeparator>Or</FieldSeparator>
          <Field disabled>
            <FieldLabel for={id('workspace')}>Workspace</FieldLabel>
            <Input id={id('workspace')} defaultValue="Acme Labs" disabled />
          </Field>
        </FieldGroup>
      </div>
    )
  }
}

function RightToLeft() {
  return () => (
    <div dir="rtl" lang="ar" mix={gridStyles}>
      <Example id="rtl-fields" title="حقول">
        <FieldGroup>
          <Field invalid>
            <FieldLabel for="rtl-email">البريد الإلكتروني</FieldLabel>
            <Input
              id="rtl-email"
              type="email"
              dir="ltr"
              defaultValue="ada@"
              aria-invalid={true}
              aria-describedby="rtl-email-hint rtl-email-error"
            />
            <FieldDescription id="rtl-email-hint">نرسل الفواتير إلى هذا العنوان.</FieldDescription>
            <FieldError id="rtl-email-error" errors={[{ message: 'أدخل عنوان بريد إلكتروني صالحًا.' }]} />
          </Field>
          <Field>
            <FieldLabel for="rtl-country">البلد</FieldLabel>
            <NativeSelect id="rtl-country" defaultValue="ch">
              <NativeSelectOption value="ch">سويسرا</NativeSelectOption>
              <NativeSelectOption value="de">ألمانيا</NativeSelectOption>
            </NativeSelect>
          </Field>
        </FieldGroup>
      </Example>
      <Example id="rtl-choices" title="اختيارات">
        <FieldSet>
          <FieldLegend variant="label">التذكيرات</FieldLegend>
          <FieldGroup data-slot="checkbox-group">
            <Field orientation="horizontal">
              <Checkbox id="rtl-before" defaultChecked />
              <FieldLabel for="rtl-before">قبل تاريخ الاستحقاق</FieldLabel>
            </Field>
            <Field orientation="horizontal">
              <Checkbox id="rtl-after" />
              <FieldLabel for="rtl-after">بعد تاريخ الاستحقاق</FieldLabel>
            </Field>
          </FieldGroup>
        </FieldSet>
        <FieldSeparator>أو</FieldSeparator>
        <Field>
          <FieldLabel for="rtl-note">ملاحظة</FieldLabel>
          <Textarea id="rtl-note" placeholder="شكرًا لطلبك." />
        </Field>
      </Example>
    </div>
  )
}

function Overrides() {
  return () => (
    <div mix={gridStyles}>
      <Example id="override-brand" title="Brand ring" description="--ring and --primary in @layer app.">
        <FieldGroup class="brand">
          <Field orientation="horizontal">
            <Checkbox id="override-brand-remind" defaultChecked />
            <FieldLabel for="override-brand-remind">Remind the customer</FieldLabel>
          </Field>
          <Field>
            <FieldLabel for="override-brand-name">Customer</FieldLabel>
            <Input id="override-brand-name" placeholder="Acme Labs" />
          </Field>
        </FieldGroup>
      </Example>
      <Example id="override-width" title="Full-width select" description="A class on the wrapper sizes the select.">
        <NativeSelect class="full-width" aria-label="Currency" defaultValue="CHF">
          <NativeSelectOption>CHF</NativeSelectOption>
          <NativeSelectOption>EUR</NativeSelectOption>
        </NativeSelect>
      </Example>
      <Example id="override-narrow" title="Narrow container" description="Long words break inside 16rem.">
        <div mix={narrowStyles}>
          <Field invalid>
            <FieldLabel for="override-narrow-email">accounts-receivable@example.com</FieldLabel>
            <Input id="override-narrow-email" aria-invalid={true} aria-describedby="override-narrow-error" />
            <FieldError
              id="override-narrow-error"
              errors={[{ message: 'Thisaddresscannotreceiveemailfromoutsideyourorganization.' }]}
            />
          </Field>
        </div>
      </Example>
    </div>
  )
}

export function FieldExamples(handle: Handle<{ stylesheets: string[]; script: ScriptEntry; invoice?: InvoiceResult }>) {
  return () => {
    let { stylesheets, script, invoice } = handle.props

    return (
      <Document
        title="RemixCN Field, Input, Label, Native Select and Textarea examples"
        stylesheets={stylesheets}
        script={script}
      >
        <main mix={pageStyles}>
          <header mix={headerStyles}>
            <h1 mix={titleStyles}>Field and native text controls</h1>
            <p>
              Every example from registry/examples for Field, Input, Label, Native Select and Textarea, rendered on the
              server and hydrated where it handles events.
            </p>
            <p mix={mutedStyles}>
              A synthetic test fixture with invented data, not the public site. The invoice form posts to /invoices,
              which validates it on the server; other forms send to /echo, which shows what the server received.
            </p>
            <nav aria-label="Families">
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
            id="field"
            title="Field"
            description="Labels, descriptions, errors and groups around native controls."
          >
            <div mix={gridStyles}>
              <Example id="field-inputs" title="Inputs">
                <FieldInputs />
              </Example>
              <Example id="field-textareas" title="Textareas">
                <FieldTextareas />
              </Example>
              <Example id="field-native-selects" title="Native selects">
                <FieldNativeSelects />
              </Example>
              <Example id="field-checkboxes" title="Checkboxes">
                <FieldCheckboxes />
              </Example>
              <Example id="field-radios" title="Radios">
                <FieldRadios />
              </Example>
              <Example id="field-switches" title="Switches">
                <FieldSwitches />
              </Example>
              <Example id="field-sliders" title="Sliders">
                <FieldSliders />
              </Example>
              <Example id="field-horizontal" title="Horizontal" wide>
                <FieldHorizontal />
              </Example>
              <Example id="field-responsive" title="Responsive" description="A row from 28rem, stacked below." wide>
                <FieldResponsive />
              </Example>
              <Example id="field-sign-in" title="Separator" description="Text between two lines.">
                <FieldSignIn action="/echo" />
              </Example>
              <Example
                id="field-recipients"
                title="Changing fields"
                description="Add and remove rows; each keeps its own ids and error."
              >
                <FieldRecipients />
              </Example>
            </div>
          </Section>

          <Section
            id="validation"
            title="Validation"
            description="The browser and the server validate the same form. A refused save is an error for the whole form."
          >
            <Example
              id="field-invoice"
              title="Invoice"
              description="Try an empty form, an amount over 10,000, or a customer named Closed Account Ltd."
              wide
            >
              <FieldInvoiceForm
                action="/invoices"
                values={invoice?.values}
                errors={invoice?.errors}
                formError={invoice?.formError}
              />
            </Example>
          </Section>

          <Section id="input" title="Input" description="Native inputs for text, email, numbers, dates and files.">
            <div mix={gridStyles}>
              <Example id="input-basic" title="Basic">
                <InputBasic />
              </Example>
              <Example id="input-invalid" title="Invalid">
                <InputInvalid />
              </Example>
              <Example id="input-label" title="With a label">
                <InputWithLabel />
              </Example>
              <Example id="input-description" title="With a description">
                <InputWithDescription />
              </Example>
              <Example id="input-disabled" title="Disabled">
                <InputDisabled />
              </Example>
              <Example id="input-read-only" title="Read only">
                <InputReadOnly />
              </Example>
              <Example id="input-types" title="Types">
                <InputTypes />
              </Example>
              <Example id="input-datalist" title="Suggestions">
                <InputWithDatalist />
              </Example>
              <Example id="input-button" title="With a button">
                <InputWithButton />
              </Example>
              <Example id="input-native-select" title="With a native select">
                <InputWithNativeSelect />
              </Example>
              <Example id="input-form" title="Form" description="Sends to /echo. Reset clears it." wide>
                <InputForm action="/echo" />
              </Example>
            </div>
          </Section>

          <Section id="label" title="Label" description="Native labels that name and focus their controls.">
            <div mix={gridStyles}>
              <Example id="label-checkbox" title="With a checkbox">
                <LabelWithCheckbox />
              </Example>
              <Example id="label-input" title="With an input">
                <LabelWithInput />
              </Example>
              <Example id="label-disabled" title="Disabled">
                <LabelDisabled />
              </Example>
              <Example id="label-textarea" title="With a textarea">
                <LabelWithTextarea />
              </Example>
            </div>
          </Section>

          <Section id="native-select" title="Native Select" description="The browser's own select, with a chevron.">
            <div mix={gridStyles}>
              <Example id="native-select-basic" title="Basic">
                <NativeSelectBasic />
              </Example>
              <Example id="native-select-groups" title="Groups">
                <NativeSelectWithGroups />
              </Example>
              <Example id="native-select-sizes" title="Sizes">
                <NativeSelectSizes />
              </Example>
              <Example id="native-select-field" title="In a field">
                <NativeSelectWithField />
              </Example>
              <Example id="native-select-disabled" title="Disabled">
                <NativeSelectDisabled />
              </Example>
              <Example id="native-select-invalid" title="Invalid">
                <NativeSelectInvalid />
              </Example>
              <Example id="native-select-controlled" title="Controlled" description="The text follows the value.">
                <NativeSelectControlled />
              </Example>
            </div>
          </Section>

          <Section id="textarea" title="Textarea" description="Native textareas that grow with their text.">
            <div mix={gridStyles}>
              <Example id="textarea-basic" title="Basic">
                <TextareaBasic />
              </Example>
              <Example id="textarea-invalid" title="Invalid">
                <TextareaInvalid />
              </Example>
              <Example id="textarea-label" title="With a label">
                <TextareaWithLabel />
              </Example>
              <Example id="textarea-description" title="With a description">
                <TextareaWithDescription />
              </Example>
              <Example id="textarea-disabled" title="Disabled">
                <TextareaDisabled />
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
            id="right-to-left"
            title="Right to left"
            description="Labels, chevrons, choices and separators follow the text direction."
          >
            <RightToLeft />
          </Section>

          <Section
            id="overrides"
            title="Overrides"
            description="Tokens and classes in @layer app, and a narrow container."
          >
            <Overrides />
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
