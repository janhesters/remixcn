// The style reference: a synthetic page that shows RemixCN's tokens, text,
// surfaces, focus and form states in both themes. Later batches check their
// components against it. It is not the public site.
import { css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'

import { CheckIcon, ChevronRightIcon, CircleAlertIcon } from '#remixcn/lib/icons.tsx'
import { disabledState, invalidState, mergeStyles, mirrorInRtl, transition } from '#remixcn/lib/styles.ts'
import type { Styles } from '#remixcn/lib/styles.ts'

type TextSize = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
// A single grid column that may shrink below its content, such as a text
// field's default width of about 20 characters, so large text still reflows.
const shrinkingColumn = 'minmax(0, 1fr)'
const text = (size: TextSize): Styles => ({
  fontSize: `var(--text-${size})`,
  lineHeight: `var(--text-${size}--line-height)`,
})

const pageStyles = css({
  maxWidth: '72rem',
  marginInline: 'auto',
  padding: space(6),
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  gap: space(12),
  '@media (max-width: 40rem)': { padding: space(4), gap: space(10) },
})
const headerStyles = css({ display: 'grid', gap: space(2), '& p': { margin: 0, maxWidth: '40rem' } })
const titleStyles = css({ ...text('3xl'), margin: 0, fontWeight: 600, letterSpacing: '-0.025em' })
const sectionStyles = css({ display: 'grid', gridTemplateColumns: shrinkingColumn, gap: space(4) })
const sectionTitleStyles = css({ ...text('xl'), margin: 0, fontWeight: 600 })
const mutedStyles = css({ color: 'var(--muted-foreground)', margin: 0 })
const gridStyles = css({
  display: 'grid',
  gap: space(4),
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 9rem), 1fr))',
})
const wideGridStyles = css({
  display: 'grid',
  gap: space(6),
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 22rem), 1fr))',
})
const monoStyles = css({ ...text('xs'), fontFamily: 'var(--font-mono)' })

const swatches: Array<[color: string, text?: string]> = [
  ['background', 'foreground'],
  ['card', 'card-foreground'],
  ['popover', 'popover-foreground'],
  ['primary', 'primary-foreground'],
  ['secondary', 'secondary-foreground'],
  ['muted', 'muted-foreground'],
  ['accent', 'accent-foreground'],
  ['destructive'],
  ['border'],
  ['input'],
  ['ring'],
  ['chart-1'],
  ['chart-2'],
  ['chart-3'],
  ['chart-4'],
  ['chart-5'],
  ['sidebar', 'sidebar-foreground'],
  ['sidebar-primary', 'sidebar-primary-foreground'],
  ['sidebar-accent', 'sidebar-accent-foreground'],
  ['sidebar-border'],
  ['sidebar-ring'],
]

const swatchStyles = css({ display: 'grid', alignContent: 'start', gap: space(1.5), margin: 0 })
const captionStyles = css({ ...text('xs'), display: 'grid', fontFamily: 'var(--font-mono)', overflowWrap: 'anywhere' })
const swatchColorStyles = css({
  ...text('lg'),
  display: 'grid',
  placeItems: 'center',
  height: space(16),
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'inset 0 0 0 1px var(--border)',
  fontWeight: 600,
})

function Swatch(handle: Handle<{ color: string; text?: string }>) {
  return () => {
    let { color, text: textColor } = handle.props

    return (
      <figure mix={swatchStyles}>
        <div
          mix={swatchColorStyles}
          style={{ background: `var(--${color})`, color: textColor ? `var(--${textColor})` : undefined }}
          aria-hidden="true"
        >
          {textColor ? 'Aa' : null}
        </div>
        <figcaption mix={captionStyles}>
          <span>--{color}</span>
          {textColor ? <span mix={mutedStyles}>--{textColor}</span> : null}
        </figcaption>
      </figure>
    )
  }
}

const typeScale: Array<[TextSize, string]> = [
  ['4xl', 'Invoices for March'],
  ['3xl', 'Invoices for March'],
  ['2xl', 'Overdue invoices'],
  ['xl', 'Payment reminders'],
  ['lg', 'Billing contact'],
  ['base', 'Send the invoice to the billing contact before the due date.'],
  ['sm', 'Due in 14 days. Late fees apply after 30 days.'],
  ['xs', 'Invoice INV-0042 · Created 3 March'],
]

const typeRowStyles = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  gap: `${space(1)} ${space(4)}`,
  margin: 0,
  '& code': { color: 'var(--muted-foreground)', minWidth: '6rem' },
})
const proseStyles = css({
  display: 'grid',
  gap: space(3),
  maxWidth: '40rem',
  '& p': { margin: 0 },
  '& a': { color: 'var(--primary)', textDecoration: 'underline', textUnderlineOffset: '0.25em' },
  '& code': {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.875em',
    background: 'var(--muted)',
    borderRadius: 'var(--radius-sm)',
    paddingInline: space(1),
  },
})

const surfaces: Array<{ name: string; background: string; foreground: string; elevation?: string }> = [
  { name: 'Background', background: 'background', foreground: 'foreground' },
  { name: 'Card', background: 'card', foreground: 'card-foreground', elevation: 'var(--shadow-xs)' },
  { name: 'Popover', background: 'popover', foreground: 'popover-foreground', elevation: 'var(--shadow-md)' },
  { name: 'Muted', background: 'muted', foreground: 'foreground' },
  { name: 'Secondary', background: 'secondary', foreground: 'secondary-foreground' },
  { name: 'Accent', background: 'accent', foreground: 'accent-foreground' },
  { name: 'Sidebar', background: 'sidebar', foreground: 'sidebar-foreground' },
]

const surfaceStyles = css({
  display: 'grid',
  gap: space(1),
  padding: space(4),
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  '& h3': { ...text('base'), margin: 0, fontWeight: 600 },
  '& p': { ...text('sm'), margin: 0, color: 'var(--muted-foreground)' },
})

const controlStyles = mergeStyles(
  {
    ...text('base'),
    width: '100%',
    minHeight: space(9),
    paddingBlock: space(1.5),
    paddingInline: space(2.5),
    border: '1px solid var(--input)',
    borderRadius: 'var(--radius-md)',
    background: 'transparent',
    boxShadow: 'var(--shadow-xs)',
    '&::placeholder': { color: 'var(--muted-foreground)', opacity: 1 },
  },
  transition('border-color'),
  invalidState,
  disabledState,
)
const inputStyles = css(controlStyles)
const selectStyles = css(mergeStyles(controlStyles, { maxWidth: '16rem' }))

const formStyles = css({ display: 'grid', gridTemplateColumns: shrinkingColumn, gap: space(5), maxWidth: '32rem' })
const fieldStyles = css({
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  gap: space(1.5),
  margin: 0,
  padding: 0,
  border: 0,
  '& label, & legend': { ...text('sm'), fontWeight: 500, padding: 0 },
})
const message: Styles = {
  ...text('sm'),
  display: 'flex',
  alignItems: 'flex-start',
  gap: space(1.5),
  margin: 0,
  color: 'var(--muted-foreground)',
  // Lets a long word, such as an email address, break when large text needs it.
  overflowWrap: 'anywhere',
  '& svg': { flexShrink: 0, width: '1rem', height: '1rem', marginBlockStart: '0.125rem' },
}
const messageStyles = css(message)
const errorStyles = css(mergeStyles(message, { color: 'var(--destructive)' }))
const choiceStyles = css({
  ...text('sm'),
  display: 'flex',
  alignItems: 'center',
  gap: space(2),
  '& input': { width: '1rem', height: '1rem', margin: 0 },
})
const choicesStyles = css({ display: 'flex', flexWrap: 'wrap', gap: `${space(2)} ${space(6)}` })

const buttonBase: Styles = mergeStyles(
  {
    ...text('sm'),
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
    minHeight: space(9),
    paddingInline: space(4),
    border: '1px solid transparent',
    borderRadius: 'var(--radius-md)',
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  transition('background-color', 'border-color', 'color'),
  disabledState,
)
const buttonVariants = {
  primary: css(
    mergeStyles(buttonBase, {
      background: 'var(--primary)',
      color: 'var(--primary-foreground)',
      '&:hover:not(:disabled)': { background: 'color-mix(in oklab, var(--primary) 90%, transparent)' },
    }),
  ),
  secondary: css(
    mergeStyles(buttonBase, {
      background: 'var(--secondary)',
      color: 'var(--secondary-foreground)',
      '&:hover:not(:disabled)': { background: 'color-mix(in oklab, var(--secondary) 80%, var(--foreground) 5%)' },
    }),
  ),
  destructive: css(
    mergeStyles(buttonBase, {
      background: 'transparent',
      borderColor: 'var(--destructive)',
      color: 'var(--destructive)',
      '&:hover:not(:disabled)': { background: 'color-mix(in oklab, var(--destructive) 10%, transparent)' },
    }),
  ),
}
const buttonRowStyles = css({ display: 'flex', flexWrap: 'wrap', gap: space(3) })
const statusStyles = css({
  ...text('sm'),
  display: 'flex',
  alignItems: 'center',
  gap: space(1.5),
  margin: 0,
  fontWeight: 500,
})

function FormStates(handle: Handle<{ prefix: string }>) {
  return () => {
    let id = (name: string) => `${handle.props.prefix}-${name}`

    return (
      <form mix={formStyles}>
        <div mix={fieldStyles}>
          <label for={id('name')}>Name</label>
          <input id={id('name')} name="name" mix={inputStyles} placeholder="Ada Lovelace" autocomplete="off" />
        </div>
        <div mix={fieldStyles}>
          <label for={id('email')}>Email</label>
          <input
            id={id('email')}
            name="email"
            type="email"
            mix={inputStyles}
            value="ada@"
            aria-invalid="true"
            aria-describedby={id('email-error')}
          />
          <p id={id('email-error')} mix={errorStyles}>
            <CircleAlertIcon />
            <span>Enter an email address like name@example.com.</span>
          </p>
        </div>
        <div mix={fieldStyles}>
          <label for={id('company')}>Company</label>
          <input
            id={id('company')}
            name="company"
            mix={inputStyles}
            value="Acme Labs"
            disabled
            aria-describedby={id('company-hint')}
          />
          <p id={id('company-hint')} mix={messageStyles}>
            Disabled: your workspace sets the company name.
          </p>
        </div>
        <fieldset mix={fieldStyles}>
          <legend>Plan</legend>
          <div mix={choicesStyles}>
            <label mix={choiceStyles}>
              <input type="radio" name={id('plan')} value="free" checked /> Free
            </label>
            <label mix={choiceStyles}>
              <input type="radio" name={id('plan')} value="pro" /> Pro
            </label>
          </div>
        </fieldset>
        <label mix={choiceStyles}>
          <input type="checkbox" name="reminders" checked /> Email me before an invoice is due
        </label>
        <div mix={fieldStyles}>
          <label for={id('country')}>Country</label>
          <select id={id('country')} name="country" mix={selectStyles}>
            <option>Switzerland</option>
            <option>Germany</option>
            <option>Austria</option>
          </select>
        </div>
        <div mix={buttonRowStyles}>
          <button type="button" mix={buttonVariants.primary}>
            Save
          </button>
          <button type="button" mix={buttonVariants.secondary}>
            Cancel
          </button>
          <button type="button" mix={buttonVariants.destructive}>
            Delete
          </button>
          <button type="button" mix={buttonVariants.primary} disabled>
            Archive
          </button>
        </div>
        <p role="status" mix={statusStyles}>
          <CheckIcon />
          Draft saved
        </p>
      </form>
    )
  }
}

const themePanelStyles = css({
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  gap: space(4),
  alignContent: 'start',
  padding: space(6),
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  '& h3': { ...text('base'), margin: 0, fontWeight: 600 },
})

function ThemePanel(handle: Handle<{ theme: 'light' | 'dark' }>) {
  return () => {
    let { theme } = handle.props

    return (
      <div data-theme={theme} mix={themePanelStyles}>
        <h3>
          {theme === 'light' ? 'Light' : 'Dark'} <code mix={monoStyles}>data-theme="{theme}"</code>
        </h3>
        <FormStates prefix={theme} />
      </div>
    )
  }
}

const chipStyles = css({
  ...text('sm'),
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: space(8),
  paddingInline: space(3),
  borderRadius: 'var(--radius-md)',
  background: 'var(--primary)',
  color: 'var(--primary-foreground)',
  fontWeight: 500,
})
// A caller's own css(), passed with mix. It renders after chipStyles, so it wins.
const callerChipStyles = css({ borderRadius: 0 })
const overrideListStyles = css({
  display: 'grid',
  gap: space(3),
  margin: 0,
  padding: 0,
  listStyle: 'none',
  '& li': { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${space(1)} ${space(3)}` },
})

const breadcrumbStyles = css({
  ...text('sm'),
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: space(1.5),
  margin: 0,
  paddingInlineStart: space(3),
  borderInlineStart: '2px solid var(--primary)',
  '& svg': mergeStyles({ width: '1rem', height: '1rem', color: 'var(--muted-foreground)' }, mirrorInRtl),
})

function Breadcrumb(handle: Handle<{ dir: 'ltr' | 'rtl' }>) {
  return () => (
    <p dir={handle.props.dir} mix={breadcrumbStyles}>
      <span>Invoices</span>
      <ChevronRightIcon />
      <span>March</span>
      <ChevronRightIcon />
      <span aria-current="page">INV-0042</span>
    </p>
  )
}

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

export function StyleReference(handle: Handle<{ stylesheets: string[] }>) {
  return () => (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        {handle.props.stylesheets.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
        <title>RemixCN style reference</title>
      </head>
      <body>
        <main mix={pageStyles}>
          <header mix={headerStyles}>
            <h1 mix={titleStyles}>RemixCN style reference</h1>
            <p>The theme tokens, text, surfaces, focus and form states every component uses.</p>
            <p mix={mutedStyles}>
              A synthetic test fixture, not the public site. The page follows your system theme; the panels under Themes
              set theirs with data-theme.
            </p>
          </header>

          <Section id="colors" title="Colors" description="shadcn's Neutral theme as CSS custom properties.">
            <div mix={gridStyles}>
              {swatches.map(([color, textColor]) => (
                <Swatch key={color} color={color} text={textColor} />
              ))}
            </div>
          </Section>

          <Section id="text" title="Text" description="System fonts on a rem scale. Muted text stays at 4.5:1 or more.">
            <div>
              {typeScale.map(([size, sample]) => (
                <p
                  key={size}
                  mix={typeRowStyles}
                  style={{ fontSize: `var(--text-${size})`, lineHeight: `var(--text-${size}--line-height)` }}
                >
                  <code mix={monoStyles}>--text-{size}</code>
                  <span>{sample}</span>
                </p>
              ))}
            </div>
            <div mix={proseStyles}>
              <p>
                Body text uses <code>--foreground</code>. Links stay underlined, so they don't rely on color:{' '}
                <a href="#text">view the payment terms</a>.
              </p>
              <p mix={mutedStyles}>Muted text uses --muted-foreground for hints and descriptions.</p>
            </div>
          </Section>

          <Section id="surfaces" title="Surfaces" description="Each surface with its own text color and a muted hint.">
            <div mix={gridStyles}>
              {surfaces.map((surface) => (
                <div
                  key={surface.name}
                  mix={surfaceStyles}
                  style={{
                    background: `var(--${surface.background})`,
                    color: `var(--${surface.foreground})`,
                    boxShadow: surface.elevation,
                  }}
                >
                  <h3>{surface.name}</h3>
                  <p>--{surface.background}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section
            id="forms"
            title="Focus and form states"
            description="Tab through the controls. Errors show an icon and text, not only color, and disabled fields say why."
          >
            <FormStates prefix="page" />
          </Section>

          <Section
            id="themes"
            title="Themes"
            description="data-theme overrides the system preference for everything inside it."
          >
            <div mix={wideGridStyles}>
              <ThemePanel theme="light" />
              <ThemePanel theme="dark" />
            </div>
          </Section>

          <Section
            id="overrides"
            title="Overrides"
            description="How an app changes a component without editing it, from the weakest to the strongest."
          >
            <ol mix={overrideListStyles}>
              <li>
                <span mix={chipStyles}>Component</span>
                <span mix={mutedStyles}>The component's own css(), in the rmx layer.</span>
              </li>
              <li>
                <span class="brand" data-override="token">
                  <span mix={chipStyles}>Token</span>
                </span>
                <span mix={mutedStyles}>--primary set on an ancestor changes every component inside.</span>
              </li>
              <li>
                <span mix={[chipStyles, callerChipStyles]} data-override="mix">
                  Caller css()
                </span>
                <span mix={mutedStyles}>A css() the caller passes with mix renders later, so it wins.</span>
              </li>
              <li>
                <span mix={chipStyles} class="pill" data-override="app">
                  App layer
                </span>
                <span mix={mutedStyles}>A rule in @layer app beats every css(), even with lower specificity.</span>
              </li>
            </ol>
          </Section>

          <Section
            id="direction"
            title="Direction"
            description="Logical properties and mirrored icons follow dir, so right-to-left text needs no extra rules."
          >
            <Breadcrumb dir="ltr" />
            <Breadcrumb dir="rtl" />
          </Section>
        </main>
      </body>
    </html>
  )
}
