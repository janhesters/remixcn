// The Attachment, Bubble, Marker and Message examples on one synthetic page,
// with both themes side by side and right-to-left text. It is a test fixture
// for browser tests and UI reviews, not the public site. Every name, file,
// image and message is made up, and nothing leaves the page.
import { css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'
import type { ImportMapData } from 'remix/component/server'

import {
  AttachmentComposer,
  AttachmentContentOnly,
  AttachmentFiles,
  AttachmentImagePicker,
  AttachmentImages,
  AttachmentRtl,
  AttachmentScrollableGroup,
  AttachmentSizes,
  AttachmentStates,
  AttachmentTriggers,
  AttachmentUntrusted,
  AttachmentUpload,
} from '../../../registry/examples/attachment-example.tsx'
import {
  BubbleAlignment,
  BubbleGrouped,
  BubbleLinksAndButtons,
  BubbleReactionButtons,
  BubbleRtl,
  BubbleShowMore,
  BubbleSizes,
  BubbleVariants,
  BubbleWithReactions,
} from '../../../registry/examples/bubble-example.tsx'
import {
  MarkerBorder,
  MarkerLinksAndButtons,
  MarkerRtl,
  MarkerSeparator,
  MarkerShimmer,
  MarkerStatus,
  MarkerVariants,
  MarkerWithIcon,
} from '../../../registry/examples/marker-example.tsx'
import {
  MessageActions,
  MessageAttachment,
  MessageDefault,
  MessageGroupChat,
  MessageGroupExample,
  MessageHeaderFooter,
  MessageRtl,
  MessageStatus,
  MessageUntrusted,
  MessageWithAvatar,
} from '../../../registry/examples/message-example.tsx'

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
// The long title may break anywhere, so it fits 320px with text at 200%.
const titleStyles = css({
  margin: 0,
  overflowWrap: 'anywhere',
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
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 26rem), 1fr))',
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
        <MessageHeaderFooter />
        <MessageActions />
        <BubbleVariants />
        <AttachmentStates />
        <MarkerVariants />
      </div>
    )
  }
}

export function ConversationExamples(handle: Handle<{ stylesheets: string[]; script: ScriptEntry }>) {
  return () => (
    <Document
      title="RemixCN Attachment, Bubble, Marker and Message examples"
      stylesheets={handle.props.stylesheets}
      script={handle.props.script}
    >
      <main mix={pageStyles}>
        <header mix={headerStyles}>
          <h1 mix={titleStyles}>Attachment, Bubble, Marker and Message</h1>
          <p>Every example from registry/examples, rendered on the server and hydrated where it handles events.</p>
          <p mix={mutedStyles}>
            A synthetic test fixture with made-up files, images and messages, not the public site. Nothing uploads: the
            composer posts to /echo, which shows what the server received.
          </p>
        </header>

        <Section
          id="attachment"
          title="Attachment"
          description="Files and images with their details, states and actions."
        >
          <div mix={gridStyles}>
            <Example id="attachment-files" title="Files" description="Remove moves focus to the next file.">
              <AttachmentFiles />
            </Example>
            <Example
              id="attachment-content-only"
              title="Content only"
              description="Text attachments, such as saved links."
            >
              <AttachmentContentOnly />
            </Example>
            <Example id="attachment-states" title="States" description="Each state says what is happening in text.">
              <AttachmentStates />
            </Example>
            <Example id="attachment-sizes" title="Sizes">
              <AttachmentSizes />
            </Example>
            <Example id="attachment-states-vertical" title="States, vertical" wide>
              <AttachmentStates orientation="vertical" />
            </Example>
            <Example id="attachment-images" title="Images" description="A failed image shows its icon instead.">
              <AttachmentImages />
            </Example>
            <Example id="attachment-image-picker" title="Replace an image">
              <AttachmentImagePicker />
            </Example>
            <Example id="attachment-group" title="Scrollable group" description="Scrolls sideways and snaps." wide>
              <AttachmentScrollableGroup />
            </Example>
            <Example
              id="attachment-triggers"
              title="Triggers"
              description="A link and a dialog; the actions stay apart."
            >
              <AttachmentTriggers href="/files/contract-review.txt" />
            </Example>
            <Example
              id="attachment-untrusted"
              title="Untrusted"
              description="Markup shows as text; the unsafe URL is dropped."
            >
              <AttachmentUntrusted />
            </Example>
            <Example id="attachment-upload" title="Upload" description="Simulated: nothing leaves the page.">
              <AttachmentUpload />
            </Example>
            <Example
              id="attachment-composer"
              title="Composer"
              description="Local previews; Send posts the files to /echo."
              wide
            >
              <AttachmentComposer action="/echo" />
            </Example>
          </div>
        </Section>

        <Section id="bubble" title="Bubble" description="Message surfaces, alignment, groups and reactions.">
          <div mix={gridStyles}>
            <Example id="bubble-variants" title="Variants">
              <BubbleVariants />
            </Example>
            <Example id="bubble-sizes" title="Sizes" description="Up to 80% of the row; long words break.">
              <BubbleSizes />
            </Example>
            <Example id="bubble-alignment" title="Alignment">
              <BubbleAlignment />
            </Example>
            <Example id="bubble-grouped" title="Grouped">
              <BubbleGrouped />
            </Example>
            <Example id="bubble-reactions" title="Reactions">
              <BubbleWithReactions />
            </Example>
            <Example id="bubble-reaction-buttons" title="Reaction buttons">
              <BubbleReactionButtons />
            </Example>
            <Example id="bubble-links-and-buttons" title="Links and buttons">
              <BubbleLinksAndButtons />
            </Example>
            <Example id="bubble-show-more" title="Show more">
              <BubbleShowMore />
            </Example>
          </div>
        </Section>

        <Section id="marker" title="Marker" description="Status lines, notes and labelled dividers.">
          <div mix={gridStyles}>
            <Example id="marker-variants" title="Variants">
              <MarkerVariants />
            </Example>
            <Example id="marker-status" title="Status" description="Announces each step.">
              <MarkerStatus />
            </Example>
            <Example id="marker-shimmer" title="Shimmer" description="Still for reduced motion.">
              <MarkerShimmer />
            </Example>
            <Example id="marker-separator" title="Separator">
              <MarkerSeparator />
            </Example>
            <Example id="marker-border" title="Border">
              <MarkerBorder />
            </Example>
            <Example id="marker-icon" title="With icon">
              <MarkerWithIcon />
            </Example>
            <Example id="marker-links-and-buttons" title="Links and buttons">
              <MarkerLinksAndButtons />
            </Example>
          </div>
        </Section>

        <Section id="message" title="Message" description="Rows with avatars, headers, footers and actions.">
          <div mix={gridStyles}>
            <Example id="message-default" title="Message">
              <MessageDefault />
            </Example>
            <Example id="message-avatar" title="Avatar">
              <MessageWithAvatar />
            </Example>
            <Example id="message-group" title="Group">
              <MessageGroupExample />
            </Example>
            <Example id="message-group-chat" title="Group chat">
              <MessageGroupChat />
            </Example>
            <Example id="message-header-footer" title="Header and footer">
              <MessageHeaderFooter />
            </Example>
            <Example id="message-actions" title="Actions" description="Copy, feedback and Retry.">
              <MessageActions />
            </Example>
            <Example id="message-attachments" title="Attachments">
              <MessageAttachment />
            </Example>
            <Example id="message-status" title="Status">
              <MessageStatus />
            </Example>
            <Example id="message-untrusted" title="Untrusted" description="Markup shows as text and never runs.">
              <MessageUntrusted />
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
          description="In right-to-left text, start and end swap sides: avatars, bubbles, reactions, actions and lines."
        >
          <div mix={gridStyles}>
            <Example id="attachment-rtl" title="Attachment">
              <AttachmentRtl />
            </Example>
            <Example id="bubble-rtl" title="Bubble">
              <BubbleRtl />
            </Example>
            <Example id="marker-rtl" title="Marker">
              <MarkerRtl />
            </Example>
            <Example id="message-rtl" title="Message">
              <MessageRtl />
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
