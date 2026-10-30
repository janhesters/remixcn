// RemixCN Attachment: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { attrs, css, ref } from 'remix/component'
import type { Handle, MixValue, Props } from 'remix/component'

import { focusRing, mergeStyles, shimmer, transition } from '#remixcn/lib/styles.ts'
import type { Styles } from '#remixcn/lib/styles.ts'
import { Button } from '#remixcn/ui/button.tsx'
import type { ButtonProps } from '#remixcn/ui/button.tsx'

export const attachmentStates = ['idle', 'uploading', 'processing', 'error', 'done'] as const
export const attachmentSizes = ['default', 'sm', 'xs'] as const
export const attachmentOrientations = ['horizontal', 'vertical'] as const

export type AttachmentState = (typeof attachmentStates)[number]
export type AttachmentSize = (typeof attachmentSizes)[number]
export type AttachmentOrientation = (typeof attachmentOrientations)[number]
export type AttachmentMediaVariant = 'icon' | 'image'
export type AttachmentImageStatus = 'idle' | 'loading' | 'loaded' | 'error'

export interface AttachmentProps extends Props<'div'> {
  /**
   * Where the file is in its upload: idle has a dashed border, uploading and
   * processing shimmer the title, and error turns red. Say the state in the
   * description too, since a color or a border isn't enough.
   */
  state?: AttachmentState
  /** The padding, the text size and the media size. */
  size?: AttachmentSize
  /** Puts the media beside the content, or above it. */
  orientation?: AttachmentOrientation
}

export interface AttachmentMediaProps extends Props<'div'> {
  /** icon sizes an icon or a spinner; image crops an image to a square. */
  variant?: AttachmentMediaVariant
}

/**
 * A native img's props. Remix requires alt, which says what the image shows,
 * or "" when the title already says all there is.
 */
export type AttachmentImageProps = Props<'img'> & {
  /**
   * A local file to preview, such as one from a file input. The image shows
   * it through an object URL, which it releases when the file changes or the
   * image is removed. It takes the place of src and srcSet, and shows only in
   * the browser.
   */
  file?: Blob
  /** Runs in the browser each time the image starts loading, loads or fails, never after it's removed. */
  onLoadingStatusChange?: (status: AttachmentImageStatus) => void
}

export type AttachmentActionProps = ButtonProps

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const text = (size: 'xs' | 'sm'): Styles => ({
  fontSize: `var(--text-${size})`,
  lineHeight: `var(--text-${size}--line-height)`,
})
// Parts react to their attachment's attributes from their own rule, so no
// rule depends on the order in which Remix first renders them.
const attachment = '[data-slot="attachment"]'
const failed = `:where(${attachment}[data-state="error"])`
const settled = `:where(${attachment}[data-state="idle"], ${attachment}[data-state="done"])`
const busy = `:where(${attachment}[data-state="uploading"], ${attachment}[data-state="processing"])`
const small = `:where(${attachment}[data-size="sm"])`
const extraSmall = `:where(${attachment}[data-size="xs"])`
const vertical = `:where(${attachment}[data-orientation="vertical"])`
const withContent = '&:has(> [data-slot="attachment-content"])'
const withMedia = '&:has(> [data-slot="attachment-media"])'
const withTrigger = '&:has(> [data-slot="attachment-trigger"])'
// shadcn's red on its own red tint misses 4.5:1, so a quarter of the foreground mixes in.
const destructiveText = 'color-mix(in oklab, var(--destructive) 75%, var(--foreground))'

const groupRule = css({
  display: 'flex',
  gap: space(3),
  minWidth: 0,
  // Room for the focus ring of the first and the last attachment.
  padding: space(1),
  overflowX: 'auto',
  overscrollBehaviorX: 'contain',
  scrollSnapType: 'x mandatory',
  scrollPaddingInline: space(1),
  scrollbarWidth: 'thin',
})

/**
 * Lays attachments out in a row that scrolls sideways and snaps to each one.
 * Keyboard users reach an attachment by tabbing to its trigger or actions.
 * For a row of attachments without controls, make the row itself reachable:
 * tabIndex={0}, role="group" and an aria-label.
 */
export function AttachmentGroup(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <div data-slot="attachment-group" {...props} mix={[groupRule, mix]} />
  }
}

const sizes: Record<AttachmentSize, Styles> = {
  default: { ...text('sm'), gap: space(2), [withMedia]: { padding: space(2) } },
  sm: { ...text('xs'), gap: space(2.5), [withMedia]: { padding: space(1.5) } },
  xs: { ...text('xs'), gap: space(1.5), borderRadius: 'var(--radius-lg)', [withMedia]: { padding: space(1) } },
}

// The content's padding wins over the media's, as in shadcn, where both apply.
const contentPadding: Record<AttachmentSize, Styles> = {
  default: { [withContent]: { paddingInline: space(2.5), paddingBlock: space(2) } },
  sm: { [withContent]: { paddingInline: space(2), paddingBlock: space(1.5) } },
  xs: { [withContent]: { paddingInline: space(1.5), paddingBlock: space(1) } },
}

const orientations: Record<AttachmentOrientation, Styles> = {
  horizontal: { alignItems: 'center', minWidth: 'min(100%, 10rem)' },
  vertical: { flexDirection: 'column', width: '6rem', [withContent]: { width: '7.5rem' } },
}

const rootBase = mergeStyles(
  {
    position: 'relative',
    display: 'flex',
    flexWrap: 'wrap',
    flexShrink: 0,
    width: 'fit-content',
    maxWidth: '100%',
    minWidth: 0,
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    backgroundColor: 'var(--card)',
    color: 'var(--card-foreground)',
    '&[data-state="idle"]': { borderStyle: 'dashed' },
    '&[data-state="error"]': { borderColor: 'color-mix(in oklab, var(--destructive) 30%, transparent)' },
    [`${withTrigger}:hover`]: { backgroundColor: 'color-mix(in oklab, var(--muted) 50%, transparent)' },
    // In a group, each attachment keeps its width and is a snap point.
    ':where([data-slot="attachment-group"]) > &': { flex: 'none', scrollSnapAlign: 'start' },
  },
  // The trigger covers the card, so the card draws its ring.
  focusRing('&:has(> [data-slot="attachment-trigger"]:focus-visible)'),
  transition('background-color', 'border-color'),
)

const rootRules = new Map<string, ReturnType<typeof css>>()

function rootRule(size: AttachmentSize, orientation: AttachmentOrientation) {
  let key = `${size} ${orientation}`
  let rule = rootRules.get(key)
  if (!rule) {
    rule = css(mergeStyles(rootBase, sizes[size], contentPadding[size], orientations[orientation]))
    rootRules.set(key, rule)
  }
  return rule
}

/**
 * A file or an image attached to a message or a form: its media, name and
 * details, and actions such as Remove. Its name and details are your text,
 * which Remix escapes, so a file name can't add markup.
 */
export function Attachment(handle: Handle<AttachmentProps>) {
  return () => {
    let { state = 'done', size = 'default', orientation = 'horizontal', mix, ...props } = handle.props

    return (
      <div
        data-slot="attachment"
        data-state={state}
        data-size={size}
        data-orientation={orientation}
        {...props}
        mix={[rootRule(size, orientation), mix]}
      />
    )
  }
}

const mediaRule = css(
  mergeStyles(
    {
      position: 'relative',
      display: 'flex',
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
      width: space(10),
      aspectRatio: '1',
      overflow: 'hidden',
      borderRadius: 'var(--radius-lg)',
      backgroundColor: 'var(--muted)',
      color: 'var(--foreground)',
      '& svg': { pointerEvents: 'none', width: '1rem', height: '1rem' },
      [`${small} > &`]: { width: space(8) },
      [`${extraSmall} > &`]: { width: space(7), borderRadius: 'var(--radius-md)' },
      [`${extraSmall} > & svg`]: { width: '0.875rem', height: '0.875rem' },
      [`${vertical} > &`]: { width: '100%' },
      [`${vertical} > & svg`]: { width: '1.5rem', height: '1.5rem' },
      [`${failed} > &`]: {
        backgroundColor: 'color-mix(in oklab, var(--destructive) 10%, transparent)',
        color: destructiveText,
      },
      // An image covers the icon behind it, which shows when the image fails.
      '& > img': { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' },
      // An image dims until its upload is done.
      '&[data-variant="image"]': { opacity: 0.6 },
      [`${settled} > &[data-variant="image"]`]: { opacity: 1 },
    },
    transition('opacity'),
  ),
)

/** An icon, a spinner or an image at the start of the attachment, or above the content when it's vertical. */
export function AttachmentMedia(handle: Handle<AttachmentMediaProps>) {
  return () => {
    let { variant = 'icon', mix, ...props } = handle.props

    return <div data-slot="attachment-media" data-variant={variant} {...props} mix={[mediaRule, mix]} />
  }
}

const imageRule = css({
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  // Without JavaScript, a broken image would draw its alt text over the icon.
  color: 'transparent',
})

/**
 * The image in AttachmentMedia variant="image": a src, or a local file it
 * previews. Put an icon next to it; the image covers it once it loads, and
 * hides when it fails, so the icon shows instead of a broken image. It reads
 * its status from the element, so a late event for a replaced source or a
 * removed image changes nothing.
 */
export function AttachmentImage(handle: Handle<AttachmentImageProps>) {
  // Tasks run only in the browser, after the first commit.
  let running = false
  let image: HTMLImageElement | undefined
  let status: AttachmentImageStatus = 'idle'
  let source: string | undefined
  let file: Blob | undefined
  let objectUrl: string | undefined

  handle.signal.addEventListener('abort', () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    objectUrl = undefined
  })

  function report(next: AttachmentImageStatus) {
    if (next === status || handle.signal.aborted) return
    status = next
    handle.props.onLoadingStatusChange?.(next)
    void handle.update()
  }

  // Reads the element, not the event, so a late event for a source the image
  // no longer shows can't mark it loaded.
  function check(element: HTMLImageElement) {
    if (element !== image) return
    report(!element.complete ? 'loading' : element.naturalWidth > 0 ? 'loaded' : 'error')
  }

  let track = ref<HTMLImageElement>((element, signal) => {
    image = element
    element.addEventListener('load', () => check(element), { signal })
    element.addEventListener('error', () => check(element), { signal })
    signal.addEventListener('abort', () => {
      if (image === element) image = undefined
    })
    // It may have loaded or failed before this code ran, such as before hydration.
    queueMicrotask(() => check(element))
  })

  return () => {
    let {
      file: nextFile,
      src,
      srcSet,
      sizes,
      onLoadingStatusChange: _onLoadingStatusChange,
      mix,
      ...props
    } = handle.props

    if (!running) {
      handle.queueTask(() => {
        running = true
        if (handle.props.file) void handle.update()
      })
    }

    // A new file gets a new object URL. The old one is released once the
    // image shows the new one.
    if (running && nextFile !== file) {
      let previous = objectUrl
      file = nextFile
      objectUrl = nextFile ? URL.createObjectURL(nextFile) : undefined
      if (previous) handle.queueTask(() => URL.revokeObjectURL(previous))
    }

    let url = nextFile ? objectUrl : src
    let set = nextFile ? undefined : srcSet
    let next = [url, set, sizes, props.crossOrigin, props.referrerPolicy].join('\n')
    if (source !== undefined && next !== source && image) {
      // The browser starts on the new source when this render commits.
      let element = image
      handle.queueTask(() => check(element))
    }
    source = next

    if (!url && !set) return null

    return (
      <img
        data-slot="attachment-image"
        data-status={status}
        hidden={status === 'error'}
        {...props}
        sizes={sizes}
        srcSet={set}
        src={url}
        mix={[imageRule, track, mix]}
      />
    )
  }
}

const contentRule = css({
  flex: '1 1 0%',
  maxWidth: '100%',
  // Too narrow a card, such as with large text, wraps the content onto a
  // line of its own instead of squeezing it to a few letters a line.
  minWidth: 'min(100%, 6rem)',
  lineHeight: 1.25,
  [`${vertical} > &`]: { paddingInline: space(1) },
})

/** Holds the title and the description, and takes the room the attachment has. */
export function AttachmentContent(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <div data-slot="attachment-content" {...props} mix={[contentRule, mix]} />
  }
}

const titleRule = css(
  mergeStyles(
    {
      display: 'block',
      maxWidth: '100%',
      minWidth: 0,
      fontWeight: 500,
      // shadcn truncates a long name. It wraps instead, so the whole name
      // shows and the actions beside it stay in view.
      overflowWrap: 'anywhere',
    },
    shimmer(`${busy} &`),
  ),
)

/** The file's name. It shimmers while the file uploads or processes. */
export function AttachmentTitle(handle: Handle<Props<'span'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <span data-slot="attachment-title" {...props} mix={[titleRule, mix]} />
  }
}

const descriptionRule = css({
  display: 'block',
  maxWidth: '100%',
  minWidth: 0,
  marginBlockStart: space(0.5),
  ...text('xs'),
  color: 'var(--muted-foreground)',
  overflowWrap: 'anywhere',
  [`${failed} &`]: { color: destructiveText },
})

/** Details such as the type and size, the upload progress, or why it failed. */
export function AttachmentDescription(handle: Handle<Props<'span'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <span data-slot="attachment-description" {...props} mix={[descriptionRule, mix]} />
  }
}

const actionsRule = css({
  position: 'relative',
  // Above the trigger, so each action stays its own control.
  zIndex: 20,
  display: 'flex',
  flexShrink: 0,
  alignItems: 'center',
  [`${vertical} > &`]: {
    position: 'absolute',
    insetBlockStart: space(3),
    insetInlineEnd: space(3),
    gap: space(1),
    // Over an image, the buttons bring their own surface, so they stay visible.
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--card)',
  },
})

/** Holds the actions at the end of the attachment, or over the top end of a vertical one. */
export function AttachmentActions(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <div data-slot="attachment-actions" {...props} mix={[actionsRule, mix]} />
  }
}

/**
 * An action such as Remove or Download: a ghost icon Button, so it never
 * submits a form unless you say so. Name it with an aria-label that names the
 * file too, such as "Remove report.pdf".
 */
export function AttachmentAction(handle: Handle<AttachmentActionProps>) {
  return () => {
    let { variant = 'ghost', size = 'icon-xs', ...props } = handle.props

    return <Button data-slot="attachment-action" {...props} variant={variant} size={size} />
  }
}

const triggerRule = css({
  position: 'absolute',
  inset: 0,
  zIndex: 10,
  margin: 0,
  padding: 0,
  border: 0,
  borderRadius: 'inherit',
  backgroundColor: 'transparent',
  cursor: 'pointer',
  // The attachment draws the ring around the whole card.
  [`:where(${attachment}) > &:focus-visible`]: { outline: 'none' },
})

/**
 * Returns the mixins that make any element the attachment's trigger. Use it on
 * a native link, so the card opens the file: <a href={url} aria-label="Open
 * report.pdf" mix={attachmentTriggerVariants()} />. Pass the URL through
 * safeAttachmentUrl when it comes from a user.
 */
export function attachmentTriggerVariants(): MixValue {
  return [triggerRule, attrs({ 'data-slot': 'attachment-trigger' })]
}

/**
 * A button that covers the card, such as to open a preview. It has no text,
 * so name it with an aria-label, such as "Preview report.pdf". It sits under
 * the actions, so both stay reachable.
 */
export function AttachmentTrigger(handle: Handle<Props<'button'>>) {
  return () => {
    let { type = 'button', mix, ...props } = handle.props

    return <button data-slot="attachment-trigger" {...props} type={type} mix={[attachmentTriggerVariants(), mix]} />
  }
}

const safeProtocols = new Set(['http:', 'https:', 'blob:'])

/**
 * Returns a URL for a link or an image when it's a web, blob or relative URL,
 * and undefined for anything else, such as javascript:, data: or file: URLs,
 * which could run script or show other content.
 */
export function safeAttachmentUrl(value: string | null | undefined): string | undefined {
  if (!value?.trim()) return undefined
  try {
    // A relative URL resolves against a base that is always safe.
    let url = new URL(value, 'https://remixcn.invalid/')
    return safeProtocols.has(url.protocol) ? value : undefined
  } catch {
    return undefined
  }
}
