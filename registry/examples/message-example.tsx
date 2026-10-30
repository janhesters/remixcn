// RemixCN Message examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { CheckIcon, CircleAlertIcon, Icon } from '#remixcn/lib/icons.tsx'
import type { IconProps } from '#remixcn/lib/icons.tsx'
import { shimmer } from '#remixcn/lib/styles.ts'
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentImage,
  AttachmentMedia,
  AttachmentTitle,
  attachmentTriggerVariants,
  safeAttachmentUrl,
} from '#remixcn/ui/attachment.tsx'
import { Avatar, AvatarFallback } from '#remixcn/ui/avatar.tsx'
import { Bubble, BubbleContent, BubbleReactions } from '#remixcn/ui/bubble.tsx'
import { Button } from '#remixcn/ui/button.tsx'
import { CodeBlockCopyButton } from '#remixcn/ui/code-block.tsx'
import { Marker, MarkerContent, MarkerIcon } from '#remixcn/ui/marker.tsx'
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageGroup,
  MessageHeader,
} from '#remixcn/ui/message.tsx'
import { Spinner } from '#remixcn/ui/spinner.tsx'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const threadStyles = css({ display: 'flex', flexDirection: 'column', gap: space(8), minWidth: 0 })
const gapStyles = css({ gap: space(2) })
const timeStyles = css({ marginInlineStart: 'auto', fontWeight: 400 })
const endStyles = css({ justifyContent: 'flex-end' })
const shimmerStyles = css(shimmer())
const preWrapStyles = css({ whiteSpace: 'pre-wrap' })
const failedStyles = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: space(1),
  fontWeight: 400,
  // A quarter of the foreground mixes in, so the red text reaches 4.5:1.
  color: 'color-mix(in oklab, var(--destructive) 75%, var(--foreground))',
  '& svg': { width: '0.875rem', height: '0.875rem' },
})
const imageCardStyles = css({ width: 'min(100%, 14rem)' })
// Reactions overlap the bubble's lower edge, so the row leaves room under it.
const reactionRoomStyles = css({ paddingBlockEnd: space(4) })

export function RetryIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9" />
      <path d="M4.5 4.5V9H9" />
    </Icon>
  )
}

export function ThumbsUpIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M7.5 10.5v9h-3v-9h3Z" />
      <path d="M7.5 10.5 11 4a2.2 2.2 0 0 1 3 2.5l-.8 3.5h5a2 2 0 0 1 2 2.4l-1.2 5.5a2 2 0 0 1-2 1.6H7.5" />
    </Icon>
  )
}

export function ThumbsDownIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M16.5 13.5v-9h3v9h-3Z" />
      <path d="M16.5 13.5 13 20a2.2 2.2 0 0 1-3-2.5l.8-3.5h-5a2 2 0 0 1-2-2.4L5 6.1a2 2 0 0 1 2-1.6h9.5" />
    </Icon>
  )
}

export function FileTextIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5L14 3.5Z" />
      <path d="M14 3.5v5h5M9 13h6M9 16.5h6" />
    </Icon>
  )
}

export function ImageIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <circle cx="9" cy="9.5" r="1.5" />
      <path d="m20 15.5-4.5-4.5L6 20" />
    </Icon>
  )
}

/** Draws an invented chart inline, so the examples load no screenshot. */
export const chartImage = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" fill="#f5f5f5"/><path d="M24 136V24M24 136h112" stroke="#737373" stroke-width="4"/><path d="M40 120V88M64 120V64M88 120V96M112 120V48" stroke="#0f766e" stroke-width="14"/></svg>',
)}`

/** Your message at the end in a bubble, and the reply at the start as ghost text. */
export function MessageDefault() {
  return () => (
    <div mix={threadStyles}>
      <Message align="end">
        <MessageContent>
          <Bubble>
            <BubbleContent>Can you summarize why the March export missed two invoices?</BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
      <Message>
        <MessageContent>
          <Bubble variant="ghost">
            <BubbleContent>
              Both invoices were archived before the export ran, and the export skipped archived invoices. I added them
              to the filter and reran it; the totals match the ledger now.
            </BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    </div>
  )
}

/** An avatar at the bottom of each row, on the side the message is on. */
export function MessageWithAvatar() {
  return () => (
    <div mix={threadStyles}>
      <Message>
        <MessageAvatar>
          <Avatar>
            <AvatarFallback>OL</AvatarFallback>
          </Avatar>
        </MessageAvatar>
        <MessageContent>
          <Bubble variant="secondary">
            <BubbleContent>How can I help you today?</BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
      <Message align="end">
        <MessageAvatar>
          <Avatar>
            <AvatarFallback>MK</AvatarFallback>
          </Avatar>
        </MessageAvatar>
        <MessageContent>
          <Bubble>
            <BubbleContent>The March export is missing two invoices.</BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    </div>
  )
}

/** Consecutive messages from one sender. The earlier ones keep an empty avatar, so they line up. */
export function MessageGroupExample() {
  return () => (
    <MessageGroup>
      <Message>
        <MessageAvatar />
        <MessageContent>
          <Bubble variant="secondary">
            <BubbleContent>I reran the export.</BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
      <Message>
        <MessageAvatar>
          <Avatar>
            <AvatarFallback>OL</AvatarFallback>
          </Avatar>
        </MessageAvatar>
        <MessageContent>
          <Bubble variant="secondary">
            <BubbleContent>Both invoices are in it now.</BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    </MessageGroup>
  )
}

const chat = [
  { sender: 'Olivia', initials: 'OL', time: '09:12', text: 'Who owns the March export?', align: 'start' as const },
  { sender: 'Marina', initials: 'MA', time: '09:14', text: "I do. I'm rerunning it now.", align: 'start' as const },
  { sender: 'You', initials: 'YO', time: '09:15', text: 'Thanks, both of you.', align: 'end' as const },
]

/** Several senders, each named in the header with the time, so a name never depends on the avatar. */
export function MessageGroupChat() {
  return () => (
    <div mix={threadStyles}>
      {chat.map((message) => (
        <Message key={message.sender} align={message.align}>
          <MessageAvatar>
            <Avatar>
              <AvatarFallback>{message.initials}</AvatarFallback>
            </Avatar>
          </MessageAvatar>
          <MessageContent>
            <MessageHeader mix={gapStyles}>
              <span>{message.sender}</span>
              <time mix={timeStyles}>{message.time}</time>
            </MessageHeader>
            <Bubble variant={message.align === 'end' ? 'default' : 'secondary'}>
              <BubbleContent>{message.text}</BubbleContent>
            </Bubble>
          </MessageContent>
        </Message>
      ))}
    </div>
  )
}

/** Headers and footers for each look: who sent it, and its status in text. */
export function MessageHeaderFooter() {
  return () => (
    <div mix={threadStyles}>
      <Message align="end">
        <MessageContent>
          <MessageHeader>You</MessageHeader>
          <Bubble>
            <BubbleContent>Can we send the update today?</BubbleContent>
          </Bubble>
          <MessageFooter mix={gapStyles}>
            <span>Delivered</span>
          </MessageFooter>
        </MessageContent>
      </Message>
      <Message>
        <MessageContent>
          <MessageHeader mix={gapStyles}>
            <span>Olivia</span>
            <time mix={timeStyles}>1m ago</time>
          </MessageHeader>
          <Bubble variant="muted">
            <BubbleContent>The retry finished, and the missing invoices are included now.</BubbleContent>
          </Bubble>
          <MessageFooter>From the support queue</MessageFooter>
        </MessageContent>
      </Message>
      <Message align="end">
        <MessageContent>
          <MessageHeader>Marina</MessageHeader>
          <Bubble variant="outline">
            <BubbleContent>I drafted the reply with a link to the export history.</BubbleContent>
          </Bubble>
          <MessageFooter>Draft ready</MessageFooter>
        </MessageContent>
      </Message>
      <Message>
        <MessageContent>
          <MessageHeader>Assistant note</MessageHeader>
          <Bubble variant="ghost">
            <BubbleContent>Ghost messages keep long notes in line with the text around them.</BubbleContent>
          </Bubble>
          <MessageFooter>Internal only</MessageFooter>
        </MessageContent>
      </Message>
      <Message align="end">
        <MessageContent>
          <MessageHeader>Automation warning</MessageHeader>
          <Bubble variant="destructive">
            <BubbleContent>The export link expires in 10 minutes. Make a new one before you share it.</BubbleContent>
          </Bubble>
          <MessageFooter mix={failedStyles}>
            <CircleAlertIcon />
            Needs action
          </MessageFooter>
        </MessageContent>
      </Message>
    </div>
  )
}

type Feedback = 'up' | 'down' | undefined
type Delivery = 'failed' | 'sending' | 'delivered'

const reply = 'The install failure comes from the workspace package. I can open the log line or retry the deployment.'

/**
 * Actions in the footer: Copy confirms the clipboard write and says when
 * the browser refuses it, the feedback buttons are toggles, and a message
 * that failed to send says so in text and offers Retry.
 */
export const MessageActions = clientEntry(import.meta.url, function MessageActions(handle: Handle) {
  let feedback: Feedback
  let delivery: Delivery = 'failed'
  let timer: ReturnType<typeof setTimeout> | undefined

  handle.signal.addEventListener('abort', () => clearTimeout(timer))

  let rate = (value: Exclude<Feedback, undefined>) =>
    on<HTMLButtonElement, 'click'>('click', () => {
      feedback = feedback === value ? undefined : value
      void handle.update()
    })

  return () => (
    <div mix={threadStyles}>
      <Message align="end">
        <MessageContent>
          <Bubble>
            <BubbleContent>What is the status of the deployment?</BubbleContent>
          </Bubble>
          <MessageFooter>
            <CodeBlockCopyButton value="What is the status of the deployment?" aria-label="Copy message" />
          </MessageFooter>
        </MessageContent>
      </Message>
      <Message>
        <MessageAvatar>
          <Avatar>
            <AvatarFallback>AI</AvatarFallback>
          </Avatar>
        </MessageAvatar>
        <MessageContent>
          <Bubble variant="muted">
            <BubbleContent>{reply}</BubbleContent>
          </Bubble>
          <MessageFooter>
            <CodeBlockCopyButton value={reply} aria-label="Copy reply" />
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Good response"
              aria-pressed={feedback === 'up' ? 'true' : 'false'}
              mix={rate('up')}
            >
              <ThumbsUpIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Bad response"
              aria-pressed={feedback === 'down' ? 'true' : 'false'}
              mix={rate('down')}
            >
              <ThumbsDownIcon />
            </Button>
          </MessageFooter>
        </MessageContent>
      </Message>
      <Message align="end">
        <MessageContent>
          <Bubble>
            <BubbleContent>Okay, send me the link. I'll check it out.</BubbleContent>
          </Bubble>
          <MessageFooter mix={gapStyles}>
            <span role="status" mix={delivery === 'failed' ? failedStyles : null}>
              {delivery === 'failed' ? <CircleAlertIcon /> : null}
              {delivery === 'failed' ? 'Failed to send' : delivery === 'sending' ? 'Sending…' : 'Delivered'}
            </span>
            {delivery === 'failed' ? (
              <Button
                variant="secondary"
                size="xs"
                mix={on('click', () => {
                  delivery = 'sending'
                  void handle.update()
                  timer = setTimeout(() => {
                    delivery = 'delivered'
                    void handle.update()
                  }, 1000)
                })}
              >
                <RetryIcon data-icon="inline-start" />
                Retry
              </Button>
            ) : null}
          </MessageFooter>
        </MessageContent>
      </Message>
    </div>
  )
})

const report = safeAttachmentUrl('#message-attachments')

/** Attachments in a message: an image with a description, and a file the whole card opens. */
export const MessageAttachment = clientEntry(import.meta.url, function MessageAttachment() {
  return () => (
    <div mix={threadStyles}>
      <Message align="end">
        <MessageContent>
          <Attachment orientation="vertical" mix={imageCardStyles}>
            <AttachmentMedia variant="image">
              <ImageIcon />
              <AttachmentImage src={chartImage} alt="Bar chart of four months; the last bar is the tallest" />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>revenue-chart.svg</AttachmentTitle>
            </AttachmentContent>
          </Attachment>
          <Bubble>
            <BubbleContent>Why did revenue jump in the last month?</BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
      <Message>
        <MessageContent>
          <Bubble variant="ghost">
            <BubbleContent>Two annual plans renewed early. The details are in the report.</BubbleContent>
          </Bubble>
          <Attachment>
            <AttachmentMedia>
              <FileTextIcon />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>renewals-april.pdf</AttachmentTitle>
              <AttachmentDescription>PDF · 220 KB</AttachmentDescription>
            </AttachmentContent>
            {report ? <a href={report} aria-label="Open renewals-april.pdf" mix={attachmentTriggerVariants()} /> : null}
          </Attachment>
        </MessageContent>
      </Message>
    </div>
  )
})

/**
 * A reply that is still on its way: a Marker with role="status" announces
 * each step, and the reply takes its place.
 */
export const MessageStatus = clientEntry(import.meta.url, function MessageStatus(handle: Handle) {
  let step: 'checking' | 'replied' = 'replied'
  let run: AbortController | undefined

  handle.signal.addEventListener('abort', () => run?.abort())

  function ask() {
    run?.abort()
    let controller = new AbortController()
    run = controller
    step = 'checking'
    void handle.update()
    let timer = setTimeout(() => {
      step = 'replied'
      void handle.update()
    }, 1500)
    controller.signal.addEventListener('abort', () => clearTimeout(timer))
  }

  return () => (
    <div mix={threadStyles}>
      <Message align="end">
        <MessageContent>
          <Bubble>
            <BubbleContent>Why did the last deploy fail?</BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
      <Message>
        <MessageContent>
          <Marker role="status">
            <MarkerIcon>{step === 'checking' ? <Spinner decorative /> : <CheckIcon />}</MarkerIcon>
            <MarkerContent mix={step === 'checking' ? shimmerStyles : null}>
              {step === 'checking' ? 'Checking the logs…' : 'Checked the logs'}
            </MarkerContent>
          </Marker>
          {step === 'replied' ? (
            <Bubble variant="ghost">
              <BubbleContent>
                The build ran out of memory while it bundled the docs. A retry with more memory passed.
              </BubbleContent>
            </Bubble>
          ) : null}
        </MessageContent>
      </Message>
      <div mix={endStyles}>
        <Button size="sm" variant="outline" disabled={step === 'checking'} focusableWhenDisabled mix={on('click', ask)}>
          Ask again
        </Button>
      </div>
    </div>
  )
})

/** Names and text from users are data: Remix escapes them, so markup shows as text and never runs. */
export function MessageUntrusted() {
  return () => (
    <Message mix={reactionRoomStyles}>
      <MessageContent>
        <MessageHeader>{'<b onmouseover="alert(1)">Mallory</b>'}</MessageHeader>
        <Bubble variant="secondary">
          <BubbleContent mix={preWrapStyles}>
            {'<script>alert("owned")</script>\n<img src=x onerror="alert(1)">'}
          </BubbleContent>
          <BubbleReactions role="img" aria-label={'Reactions: <i>1</i>'}>
            <span>{'<i>1</i>'}</span>
          </BubbleReactions>
        </Bubble>
      </MessageContent>
    </Message>
  )
}

/** In right-to-left text, start and end swap sides: the avatar, the bubble and the footer. */
export function MessageRtl() {
  return () => (
    <div dir="rtl" lang="ar" mix={threadStyles}>
      <Message>
        <MessageAvatar>
          <Avatar>
            <AvatarFallback>ل</AvatarFallback>
          </Avatar>
        </MessageAvatar>
        <MessageContent>
          <MessageHeader>ليلى</MessageHeader>
          <Bubble variant="secondary">
            <BubbleContent>هل انتهى التصدير؟</BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
      <Message align="end">
        <MessageContent>
          <Bubble>
            <BubbleContent>نعم، وأُضيفت الفاتورتان.</BubbleContent>
          </Bubble>
          <MessageFooter>تم التسليم</MessageFooter>
        </MessageContent>
      </Message>
    </div>
  )
}
