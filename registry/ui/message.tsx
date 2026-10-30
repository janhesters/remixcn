// RemixCN Message: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css, ref } from 'remix/component'
import type { Handle, Props } from 'remix/component'

export type MessageAlign = 'start' | 'end'

export interface MessageProps extends Props<'div'> {
  /** Puts the message at the start of the conversation, or at the end, such as for the current user. */
  align?: MessageAlign
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const message = '[data-slot="message"]'
const atEnd = `:where(${message}[data-align="end"])`
// Only a ghost bubble counts, not a ghost button in the footer.
const withGhostBubble = `:where(${message}:has([data-slot="bubble"][data-variant="ghost"]))`

const groupRule = css({ display: 'flex', flexDirection: 'column', gap: space(2), minWidth: 0 })

/** Stacks consecutive messages from one sender. */
export function MessageGroup(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <div data-slot="message-group" {...props} mix={[groupRule, mix]} />
  }
}

const messageRule = css({
  position: 'relative',
  display: 'flex',
  gap: space(2),
  width: '100%',
  minWidth: 0,
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  // Reverses the inline order, so the avatar sits at the end, also in right-to-left text.
  '&[data-align="end"]': { flexDirection: 'row-reverse' },
})

const ownFooter = ':scope > [data-slot="message-content"] > [data-slot="message-footer"]'
const footerOffset = '--remixcn-message-footer-offset'

/** Puts the footer offset before the caller's style, in either form, so the caller's own declarations still win. */
function withFooterOffset(offset: string | undefined, style: Props<'div'>['style']) {
  if (offset === undefined) return style
  return typeof style === 'string' ? `${footerOffset}: ${offset}; ${style}` : { [footerOffset]: offset, ...style }
}

/**
 * One row of a conversation: an avatar beside the header, the message surface
 * and the footer. It's a layout without a role; name the sender in text,
 * such as in a MessageHeader.
 *
 * In the browser, inside a client entry, it measures where its footer
 * starts, so the avatar lines up with the bubble however many rows the
 * footer wraps onto and however wide the gap above it is.
 * Before that, and on a page that only renders on the server, the avatar
 * assumes a footer of one line.
 */
export function Message(handle: Handle<MessageProps>) {
  // How far the avatar moves up: from the bottom of the row to the bottom
  // of the part above the footer, so the footer, the gap above it and any
  // margins all count.
  let offset: string | undefined

  let measure = ref<HTMLDivElement>((element, signal) => {
    let footer: Element | null = null
    // The row resizes when anything in it does, such as a new gap from a
    // density setting; the footer may change while the row keeps its size.
    let resize = new ResizeObserver(() => update())
    // A footer may come or go without this component rendering again.
    let mutations = new MutationObserver(() => update())

    function update() {
      if (signal.aborted) return
      let next = element.querySelector(ownFooter)
      if (next !== footer) {
        if (footer) resize.unobserve(footer)
        if (next) resize.observe(next)
        footer = next
      }
      let measured: string | undefined
      if (footer) {
        // The avatar sits at the end of the row's content box.
        let style = getComputedStyle(element)
        let end =
          element.getBoundingClientRect().bottom - parseFloat(style.paddingBottom) - parseFloat(style.borderBottomWidth)
        let above = footer.previousElementSibling
        let target = above ? above.getBoundingClientRect().bottom : footer.getBoundingClientRect().top
        measured = `${Math.round((end - target) * 100) / 100}px`
      }
      if (measured === offset) return
      offset = measured
      void handle.update()
    }

    resize.observe(element)
    mutations.observe(element, { childList: true, subtree: true })
    signal.addEventListener('abort', () => {
      resize.disconnect()
      mutations.disconnect()
    })
    queueMicrotask(update)
  })

  return () => {
    let { align = 'start', style, mix, ...props } = handle.props

    return (
      <div
        data-slot="message"
        data-align={align}
        {...props}
        style={withFooterOffset(offset, style)}
        mix={[messageRule, measure, mix]}
      />
    )
  }
}

const avatarRule = css({
  display: 'flex',
  flexShrink: 0,
  alignItems: 'center',
  justifyContent: 'center',
  alignSelf: 'flex-end',
  width: 'fit-content',
  minWidth: space(8),
  overflow: 'hidden',
  borderRadius: '9999px',
  backgroundColor: 'var(--muted)',
  // Lines up with the bottom of the bubble instead of the footer below it:
  // by the footer's measured height and gap, or by one line of buttons.
  [`:where(${message}:has(> [data-slot="message-content"] > [data-slot="message-footer"])) > &`]: {
    translate: `0 calc(-1 * var(${footerOffset}, ${space(8)}))`,
  },
})

/**
 * Holds the sender's avatar at the bottom of the row. Leave it empty on the
 * earlier messages of a group, so they line up with the last one.
 */
export function MessageAvatar(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <div data-slot="message-avatar" {...props} mix={[avatarRule, mix]} />
  }
}

const contentRule = css({
  display: 'flex',
  flexDirection: 'column',
  gap: space(2.5),
  width: '100%',
  minWidth: 0,
  overflowWrap: 'anywhere',
  // In an end message, every part moves to the end, as in shadcn. Parts set
  // no alignment of their own, except Bubble, which agrees.
  [`${atEnd} > & > [data-slot]`]: { alignSelf: 'flex-end' },
})

/** Holds the header, the bubbles or attachments, and the footer. */
export function MessageContent(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <div data-slot="message-content" {...props} mix={[contentRule, mix]} />
  }
}

const lineStyles = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  maxWidth: '100%',
  minWidth: 0,
  paddingInline: space(3),
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-xs)',
  lineHeight: 'var(--text-xs--line-height)',
  fontWeight: 500,
  // Text next to a ghost bubble starts where the bubble's text does.
  [`${withGhostBubble} &`]: { paddingInline: 0 },
} as const

const headerRule = css(lineStyles)

/** A line above the message, such as the sender's name and the time. It wraps on a narrow screen. */
export function MessageHeader(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <div data-slot="message-header" {...props} mix={[headerRule, mix]} />
  }
}

const footerRule = css({ ...lineStyles, [`${atEnd} &`]: { justifyContent: 'flex-end' } })

/**
 * A line below the message, such as a delivery status and actions. In an
 * end message, it ends at the end too. Say a status in text, not only by color.
 */
export function MessageFooter(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <div data-slot="message-footer" {...props} mix={[footerRule, mix]} />
  }
}
