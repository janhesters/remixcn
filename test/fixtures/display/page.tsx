// The display and feedback examples on one synthetic page, with both themes
// side by side and right-to-left text. It is a test fixture for browser
// tests and UI reviews, not the public site.
import { css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'
import type { ImportMapData } from 'remix/component/server'

import {
  AlertBasic,
  AlertCustomColors,
  AlertDestructive,
  AlertLiveStatus,
  AlertWithActions,
  AlertWithIcons,
} from '../../../registry/examples/alert-example.tsx'
import { AspectRatioRatios, AspectRatioVideo } from '../../../registry/examples/aspect-ratio-example.tsx'
import {
  AvatarFallbacks,
  AvatarGroupExample,
  AvatarPicker,
  AvatarSizes,
  AvatarWithBadge,
} from '../../../registry/examples/avatar-example.tsx'
import {
  BadgeAsLink,
  BadgeCustomColors,
  BadgeInvalid,
  BadgeLongText,
  BadgeVariants,
  BadgeWithIcons,
  BadgeWithSpinner,
} from '../../../registry/examples/badge-example.tsx'
import {
  BreadcrumbBasic,
  BreadcrumbCollapsed,
  BreadcrumbCustomSeparator,
  BreadcrumbWithLinkVariants,
} from '../../../registry/examples/breadcrumb-example.tsx'
import {
  CardCustomSpacing,
  CardEdgeToEdge,
  CardSizes,
  CardWithForm,
  CardWithImage,
} from '../../../registry/examples/card-example.tsx'
import { DirectionNested, DirectionSwitch } from '../../../registry/examples/direction-example.tsx'
import {
  EmptyBasic,
  EmptyLoading,
  EmptyOutlineAndBackground,
  EmptyWithAvatars,
  EmptyWithSearch,
} from '../../../registry/examples/empty-example.tsx'
import {
  ItemGroupOfLinks,
  ItemGroupWithActions,
  ItemVariantsAndSizes,
  ItemWithHeaderAndFooter,
  ItemWithMedia,
} from '../../../registry/examples/item-example.tsx'
import {
  KbdBasic,
  KbdCombinations,
  KbdInControls,
  KbdWithIcons,
  KbdWithSamp,
} from '../../../registry/examples/kbd-example.tsx'
import {
  ProgressControlled,
  ProgressFileList,
  ProgressFormatted,
  ProgressIndeterminate,
  ProgressValues,
  ProgressWithLabel,
} from '../../../registry/examples/progress-example.tsx'
import {
  SeparatorHorizontal,
  SeparatorInList,
  SeparatorVertical,
  SeparatorVerticalMenu,
} from '../../../registry/examples/separator-example.tsx'
import {
  SkeletonAvatar,
  SkeletonCard,
  SkeletonForm,
  SkeletonReload,
  SkeletonTable,
  SkeletonText,
} from '../../../registry/examples/skeleton-example.tsx'
import {
  SpinnerInBadges,
  SpinnerInButtons,
  SpinnerInField,
  SpinnerSizes,
} from '../../../registry/examples/spinner-example.tsx'
import { TypographyDemo } from '../../../registry/examples/typography.tsx'

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
  gap: space(3),
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
const echoListStyles = css({
  display: 'grid',
  gap: space(1),
  margin: 0,
  '& dt': { fontWeight: 600 },
  '& dd': { margin: 0 },
})

const families = [
  ['alert', 'Alert'],
  ['aspect-ratio', 'Aspect Ratio'],
  ['avatar', 'Avatar'],
  ['badge', 'Badge'],
  ['breadcrumb', 'Breadcrumb'],
  ['card', 'Card'],
  ['direction', 'Direction'],
  ['empty', 'Empty'],
  ['item', 'Item'],
  ['kbd', 'Kbd'],
  ['progress', 'Progress'],
  ['separator', 'Separator'],
  ['skeleton', 'Skeleton'],
  ['spinner', 'Spinner'],
  ['typography', 'Typography'],
  ['themes', 'Themes'],
  ['right-to-left', 'Right to left'],
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

function ThemePanel(handle: Handle<{ theme: 'light' | 'dark' }>) {
  return () => {
    let { theme } = handle.props

    return (
      <div data-theme={theme} mix={themePanelStyles}>
        <h3>{theme === 'light' ? 'Light' : 'Dark'}</h3>
        <AlertDestructive />
        <AlertWithActions />
        <BadgeVariants />
        <BadgeWithIcons />
        <BadgeAsLink />
        <AvatarSizes />
        <KbdBasic />
        <ProgressWithLabel />
        <ProgressIndeterminate />
        <SeparatorHorizontal />
        <ItemWithMedia />
        <EmptyBasic />
      </div>
    )
  }
}

export function DisplayExamples(handle: Handle<{ stylesheets: string[]; script: ScriptEntry }>) {
  return () => (
    <Document
      title="RemixCN display and feedback examples"
      stylesheets={handle.props.stylesheets}
      script={handle.props.script}
    >
      <main mix={pageStyles}>
        <header mix={headerStyles}>
          <h1 mix={titleStyles}>Display and feedback</h1>
          <p>
            Every example from registry/examples for 15 families, rendered on the server and hydrated where it handles
            events.
          </p>
          <p mix={mutedStyles}>A synthetic test fixture with invented data, not the public site.</p>
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

        <Section id="alert" title="Alert" description="Callouts whose live role follows the message's urgency.">
          <div mix={gridStyles}>
            <Example id="alert-basic" title="Basic" description="No live role: static callouts.">
              <AlertBasic />
            </Example>
            <Example id="alert-icons" title="With icons and links">
              <AlertWithIcons />
            </Example>
            <Example id="alert-destructive" title="Destructive" description='Announced at once, with role="alert".'>
              <AlertDestructive />
            </Example>
            <Example id="alert-actions" title="With actions">
              <AlertWithActions />
            </Example>
            <Example id="alert-colors" title="Custom colors">
              <AlertCustomColors />
            </Example>
            <Example
              id="alert-live"
              title="Live status"
              description='role="status" stays rendered while its text changes.'
            >
              <AlertLiveStatus />
            </Example>
          </div>
        </Section>

        <Section
          id="aspect-ratio"
          title="Aspect Ratio"
          description="Boxes that keep their shape before the image loads."
        >
          <div mix={gridStyles}>
            <Example id="aspect-ratio-ratios" title="Ratios" wide>
              <AspectRatioRatios />
            </Example>
            <Example id="aspect-ratio-video" title="Video frame">
              <AspectRatioVideo />
            </Example>
          </div>
        </Section>

        <Section id="avatar" title="Avatar" description="Images with fallbacks, badges and groups.">
          <div mix={gridStyles}>
            <Example id="avatar-sizes" title="Sizes">
              <AvatarSizes />
            </Example>
            <Example id="avatar-badge" title="With a badge">
              <AvatarWithBadge />
            </Example>
            <Example id="avatar-group" title="Groups and counts">
              <AvatarGroupExample />
            </Example>
            <Example
              id="avatar-fallbacks"
              title="Fallbacks"
              description="A failed image, no image, and a delayed fallback."
            >
              <AvatarFallbacks />
            </Example>
            <Example id="avatar-picker" title="Changing image" description="Swap the source after it loaded or failed.">
              <AvatarPicker />
            </Example>
          </div>
        </Section>

        <Section id="badge" title="Badge" description="Labels for a status, a count or a category.">
          <div mix={gridStyles}>
            <Example id="badge-variants" title="Variants">
              <BadgeVariants />
            </Example>
            <Example id="badge-icons" title="With icons">
              <BadgeWithIcons />
            </Example>
            <Example id="badge-spinner" title="With a spinner">
              <BadgeWithSpinner />
            </Example>
            <Example id="badge-links" title="As links" description="Native links with badgeVariants().">
              <BadgeAsLink />
            </Example>
            <Example id="badge-long" title="Long text">
              <BadgeLongText />
            </Example>
            <Example id="badge-invalid" title="Invalid">
              <BadgeInvalid />
            </Example>
            <Example id="badge-colors" title="Custom colors">
              <BadgeCustomColors />
            </Example>
          </div>
        </Section>

        <Section id="breadcrumb" title="Breadcrumb" description="The trail to the current page, as native links.">
          <div mix={gridStyles}>
            <Example id="breadcrumb-basic" title="Basic">
              <BreadcrumbBasic />
            </Example>
            <Example id="breadcrumb-separator" title="Custom separator">
              <BreadcrumbCustomSeparator />
            </Example>
            <Example id="breadcrumb-collapsed" title="Collapsed" description="A button shows the hidden levels.">
              <BreadcrumbCollapsed />
            </Example>
            <Example id="breadcrumb-link-variants" title="Link look on a button">
              <BreadcrumbWithLinkVariants />
            </Example>
          </div>
        </Section>

        <Section id="card" title="Card" description="Surfaces with a header, content and footer.">
          <div mix={gridStyles}>
            <Example id="card-form" title="With a form">
              <CardWithForm action="/echo" />
            </Example>
            <Example id="card-sizes" title="Sizes and borders">
              <CardSizes />
            </Example>
            <Example id="card-image" title="With an image">
              <CardWithImage />
            </Example>
            <Example id="card-edge" title="Edge to edge">
              <CardEdgeToEdge />
            </Example>
            <Example id="card-spacing" title="Custom spacing">
              <CardCustomSpacing />
            </Example>
          </div>
        </Section>

        <Section
          id="direction"
          title="Direction"
          description="Native dir on a subtree. Nested subtrees keep their own."
        >
          <div mix={gridStyles}>
            <Example id="direction-nested" title="Nested">
              <DirectionNested />
            </Example>
            <Example id="direction-switch" title="Switch">
              <DirectionSwitch />
            </Example>
          </div>
        </Section>

        <Section id="empty" title="Empty" description="Nothing here yet, and what to do about it.">
          <div mix={gridStyles}>
            <Example id="empty-basic" title="Basic">
              <EmptyBasic />
            </Example>
            <Example id="empty-outline" title="Border and background">
              <EmptyOutlineAndBackground />
            </Example>
            <Example id="empty-avatars" title="With avatars">
              <EmptyWithAvatars />
            </Example>
            <Example id="empty-search" title="With a search">
              <EmptyWithSearch />
            </Example>
            <Example id="empty-loading" title="Loading">
              <EmptyLoading />
            </Example>
          </div>
        </Section>

        <Section id="item" title="Item" description="Rows with media, content and actions. Groups are lists.">
          <div mix={gridStyles}>
            <Example id="item-variants" title="Variants and sizes" wide>
              <ItemVariantsAndSizes />
            </Example>
            <Example id="item-media" title="With media">
              <ItemWithMedia />
            </Example>
            <Example id="item-links" title="Group of links">
              <ItemGroupOfLinks />
            </Example>
            <Example id="item-actions" title="Group with actions">
              <ItemGroupWithActions />
            </Example>
            <Example id="item-header-footer" title="Header and footer">
              <ItemWithHeaderAndFooter />
            </Example>
          </div>
        </Section>

        <Section id="kbd" title="Kbd" description="Keys and key combinations, as native kbd elements.">
          <div mix={gridStyles}>
            <Example id="kbd-basic" title="Keys">
              <KbdBasic />
            </Example>
            <Example id="kbd-combinations" title="Combinations">
              <KbdCombinations />
            </Example>
            <Example id="kbd-icons" title="With icons">
              <KbdWithIcons />
            </Example>
            <Example id="kbd-controls" title="In controls">
              <KbdInControls />
            </Example>
            <Example id="kbd-samp" title="With samp">
              <KbdWithSamp />
            </Example>
          </div>
        </Section>

        <Section id="progress" title="Progress" description="Determinate and indeterminate progress bars.">
          <div mix={gridStyles}>
            <Example id="progress-values" title="Values">
              <ProgressValues />
            </Example>
            <Example id="progress-label" title="With a label">
              <ProgressWithLabel />
            </Example>
            <Example id="progress-indeterminate" title="Indeterminate">
              <ProgressIndeterminate />
            </Example>
            <Example id="progress-formatted" title="Ranges and formats">
              <ProgressFormatted />
            </Example>
            <Example id="progress-controlled" title="Controlled">
              <ProgressControlled />
            </Example>
            <Example id="progress-files" title="Uploads" wide>
              <ProgressFileList />
            </Example>
          </div>
        </Section>

        <Section id="separator" title="Separator" description="Meaningful and decorative lines.">
          <div mix={gridStyles}>
            <Example id="separator-horizontal" title="Horizontal">
              <SeparatorHorizontal />
            </Example>
            <Example id="separator-vertical" title="Vertical">
              <SeparatorVertical />
            </Example>
            <Example id="separator-menu" title="Vertical menu">
              <SeparatorVerticalMenu />
            </Example>
            <Example id="separator-list" title="In a list">
              <SeparatorInList />
            </Example>
          </div>
        </Section>

        <Section id="skeleton" title="Skeleton" description="Placeholders in busy regions that say what loads.">
          <div mix={gridStyles}>
            <Example id="skeleton-avatar" title="Avatar">
              <SkeletonAvatar />
            </Example>
            <Example id="skeleton-card" title="Card">
              <SkeletonCard />
            </Example>
            <Example id="skeleton-text" title="Text">
              <SkeletonText />
            </Example>
            <Example id="skeleton-form" title="Form">
              <SkeletonForm />
            </Example>
            <Example id="skeleton-table" title="Table">
              <SkeletonTable />
            </Example>
            <Example id="skeleton-reload" title="Reload">
              <SkeletonReload />
            </Example>
          </div>
        </Section>

        <Section id="spinner" title="Spinner" description="Named, or decorative next to text.">
          <div mix={gridStyles}>
            <Example id="spinner-sizes" title="Sizes and color">
              <SpinnerSizes />
            </Example>
            <Example id="spinner-buttons" title="In buttons">
              <SpinnerInButtons />
            </Example>
            <Example id="spinner-badges" title="In badges">
              <SpinnerInBadges />
            </Example>
            <Example id="spinner-field" title="In a field">
              <SpinnerInField />
            </Example>
          </div>
        </Section>

        <Section id="typography" title="Typography" description="Styles for native elements. Nothing else changes.">
          <Example id="typography-demo" title="Article" wide>
            <TypographyDemo />
          </Example>
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
          description="Logical properties, mirrored chevrons and arrows, and the progress fill follow the text direction."
        >
          <div dir="rtl" lang="ar" mix={gridStyles}>
            <Example id="rtl-breadcrumb" title="مسار التنقل">
              <BreadcrumbBasic />
            </Example>
            <Example id="rtl-alert" title="تنبيه">
              <AlertWithActions />
            </Example>
            <Example id="rtl-avatar" title="صورة رمزية">
              <AvatarWithBadge />
            </Example>
            <Example id="rtl-progress" title="تقدم">
              <ProgressWithLabel />
              <ProgressIndeterminate />
            </Example>
            <Example id="rtl-item" title="عناصر">
              <ItemGroupOfLinks />
            </Example>
            <Example id="rtl-badge" title="شارات">
              <BadgeAsLink />
              <BadgeWithIcons />
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
