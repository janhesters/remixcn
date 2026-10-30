// RemixCN Bubble examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { Icon } from '#remixcn/lib/icons.tsx'
import type { IconProps } from '#remixcn/lib/icons.tsx'
import { Bubble, BubbleContent, BubbleGroup, BubbleReactions, bubbleContentVariants } from '#remixcn/ui/bubble.tsx'
import type { BubbleVariant } from '#remixcn/ui/bubble.tsx'
import { Button } from '#remixcn/ui/button.tsx'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const stackStyles = css({ display: 'flex', flexDirection: 'column', gap: space(3), minWidth: 0 })
// Reactions overlap the bubble edge, so rows with reactions leave room for them.
const roomyStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: space(8),
  paddingBlock: space(4),
  minWidth: 0,
})
const hintStyles = css({
  margin: 0,
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
})
const clampedStyles = css({
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  // A string, since css() would add px to a number.
  WebkitLineClamp: '3',
  overflow: 'hidden',
})
const chevronStyles = css({ alignSelf: 'flex-start', '&[aria-expanded="true"] svg': { rotate: '180deg' } })
// The arrow points onward, so it mirrors in right-to-left text.
const linkStyles = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: space(1.5),
  '& svg': { flexShrink: 0, width: '1rem', height: '1rem' },
  '& svg:dir(rtl)': { transform: 'scaleX(-1)' },
})

export function ThumbsUpIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M7.5 10.5v9h-3v-9h3Z" />
      <path d="M7.5 10.5 11 4a2.2 2.2 0 0 1 3 2.5l-.8 3.5h5a2 2 0 0 1 2 2.4l-1.2 5.5a2 2 0 0 1-2 1.6H7.5" />
    </Icon>
  )
}

export function ChevronDownIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="m5.5 9.5 6.5 6.5 6.5-6.5" />
    </Icon>
  )
}

export function ArrowRightIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5" />
    </Icon>
  )
}

const variantText: Record<BubbleVariant, string> = {
  default: 'Default: a strong bubble, usually for the current user.',
  secondary: 'Secondary: the standard neutral bubble.',
  muted: 'Muted: quieter supporting content.',
  tinted: 'Tinted: a subtle bubble tinted with the primary color.',
  outline: 'Outline: a bordered bubble for rich content.',
  ghost: 'Ghost: unframed text, such as an assistant reply, which may span the whole row.',
  destructive: 'Destructive: Failed to send. The text says so, not only the red.',
}

/** The seven looks. Each says what it's for in its text, so color isn't the only sign. */
export function BubbleVariants() {
  return () => (
    <BubbleGroup>
      {(Object.keys(variantText) as BubbleVariant[]).map((variant) => (
        <Bubble key={variant} variant={variant}>
          <BubbleContent>{variantText[variant]}</BubbleContent>
        </Bubble>
      ))}
    </BubbleGroup>
  )
}

/** Short and long bubbles: each sizes to its text, up to 80% of the row, and long words break. */
export function BubbleSizes() {
  return () => (
    <BubbleGroup>
      <Bubble variant="secondary">
        <BubbleContent>Hi!</BubbleContent>
      </Bubble>
      <Bubble variant="secondary">
        <BubbleContent>
          The export finished. Every invoice from March is in the archive, and the totals match the ledger.
        </BubbleContent>
      </Bubble>
      <Bubble variant="secondary" align="end">
        <BubbleContent>https://example.test/exports/2026-03/invoices-and-credit-notes-final.zip</BubbleContent>
      </Bubble>
    </BubbleGroup>
  )
}

/** Start bubbles for the other person and end bubbles for you. */
export function BubbleAlignment() {
  return () => (
    <BubbleGroup>
      <Bubble variant="secondary">
        <BubbleContent>Can you check why the March export is missing two invoices?</BubbleContent>
      </Bubble>
      <Bubble align="end">
        <BubbleContent>On it. I'll rerun the export with the archived ones included.</BubbleContent>
      </Bubble>
    </BubbleGroup>
  )
}

/** Consecutive bubbles from one sender share a group. */
export function BubbleGrouped() {
  return () => (
    <div mix={stackStyles}>
      <BubbleGroup>
        <Bubble variant="secondary">
          <BubbleContent>I reran the export.</BubbleContent>
        </Bubble>
        <Bubble variant="secondary">
          <BubbleContent>Both invoices are in it now.</BubbleContent>
        </Bubble>
      </BubbleGroup>
      <BubbleGroup>
        <Bubble align="end">
          <BubbleContent>Thanks!</BubbleContent>
        </Bubble>
        <Bubble align="end">
          <BubbleContent>I'll send it to accounting.</BubbleContent>
        </Bubble>
      </BubbleGroup>
    </div>
  )
}

/** Reactions on each edge and end. A row of emoji is one image with a name that says what they are. */
export function BubbleWithReactions() {
  return () => (
    <div mix={roomyStyles}>
      <Bubble variant="secondary">
        <BubbleContent>The release is live in every region.</BubbleContent>
        <BubbleReactions role="img" aria-label="Reactions: party popper and 3 more">
          <span>🎉</span>
          <span>+3</span>
        </BubbleReactions>
      </Bubble>
      <Bubble align="end">
        <BubbleContent>Great work, everyone.</BubbleContent>
        <BubbleReactions align="start" role="img" aria-label="Reactions: heart">
          <span>❤️</span>
        </BubbleReactions>
      </Bubble>
      <Bubble variant="muted">
        <BubbleContent>Pinned for the team.</BubbleContent>
        <BubbleReactions side="top" align="start" role="img" aria-label="Reactions: pushpin">
          <span>📌</span>
        </BubbleReactions>
      </Bubble>
      <Bubble variant="outline" align="end">
        <BubbleContent>Starred for later.</BubbleContent>
        <BubbleReactions side="top" role="img" aria-label="Reactions: star">
          <span>⭐</span>
        </BubbleReactions>
      </Bubble>
    </div>
  )
}

/** Reactions as buttons: each is a toggle with its own name and a pressed state. */
export const BubbleReactionButtons = clientEntry(import.meta.url, function BubbleReactionButtons(handle: Handle) {
  let liked = false

  return () => (
    <div mix={roomyStyles}>
      <Bubble variant="secondary">
        <BubbleContent>Shall I merge the fix now?</BubbleContent>
        <BubbleReactions>
          <Button
            variant="ghost"
            size="xs"
            aria-label={liked ? 'Thumbs up, 2 people including you' : 'Thumbs up, 1 person'}
            aria-pressed={liked ? 'true' : 'false'}
            mix={on('click', () => {
              liked = !liked
              void handle.update()
            })}
          >
            <ThumbsUpIcon data-icon="inline-start" />
            {liked ? '2' : '1'}
          </Button>
        </BubbleReactions>
      </Bubble>
    </div>
  )
})

/**
 * A bubble that is a link or a button, with bubbleContentVariants() on the
 * native element. Its text names it, and it shows the focus ring.
 */
export const BubbleLinksAndButtons = clientEntry(import.meta.url, function BubbleLinksAndButtons(handle: Handle) {
  let picked: string | undefined

  return () => (
    <div mix={stackStyles}>
      <BubbleGroup>
        <Bubble variant="muted">
          <a href="#bubble-help" mix={[bubbleContentVariants(), linkStyles]}>
            Read the export guide
            <ArrowRightIcon />
          </a>
        </Bubble>
        {['I forgot my password', 'I want to change my plan'].map((reply) => (
          <Bubble key={reply} variant="outline" align="end">
            <button
              type="button"
              mix={[
                bubbleContentVariants(),
                on('click', () => {
                  picked = reply
                  void handle.update()
                }),
              ]}
            >
              {reply}
            </button>
          </Bubble>
        ))}
      </BubbleGroup>
      <p role="status" mix={hintStyles}>
        {picked ? `You picked: ${picked}` : ''}
      </p>
    </div>
  )
})

const longReply = `I went through the March export line by line. Two invoices were archived before the export ran, so the filter skipped them. I added archived invoices to the filter, reran the export, and compared the totals with the ledger: they match now. I also added a check that warns when an export skips archived invoices, so this can't happen silently again.`

/** Long content collapses to three lines, with a button that shows the rest. */
export const BubbleShowMore = clientEntry(import.meta.url, function BubbleShowMore(handle: Handle) {
  let expanded = false

  return () => {
    let content = `${handle.id}-content`

    return (
      <Bubble variant="secondary">
        <BubbleContent id={content} mix={expanded ? null : clampedStyles}>
          {longReply}
        </BubbleContent>
        <Button
          variant="ghost"
          size="xs"
          aria-expanded={expanded ? 'true' : 'false'}
          aria-controls={content}
          mix={[
            chevronStyles,
            on('click', () => {
              expanded = !expanded
              void handle.update()
            }),
          ]}
        >
          <ChevronDownIcon data-icon="inline-start" />
          {expanded ? 'Show less' : 'Show more'}
        </Button>
      </Bubble>
    )
  }
})

/** In right-to-left text, start and end swap sides, and so do the reactions. */
export function BubbleRtl() {
  return () => (
    <div dir="rtl" lang="ar" mix={roomyStyles}>
      <Bubble variant="secondary">
        <BubbleContent>هل يمكنك مراجعة التصدير؟</BubbleContent>
      </Bubble>
      <Bubble align="end">
        <BubbleContent>بالتأكيد، سأراجعه الآن.</BubbleContent>
        <BubbleReactions role="img" aria-label="تفاعلات: إعجاب">
          <span>👍</span>
        </BubbleReactions>
      </Bubble>
      <Bubble variant="muted">
        <a href="#bubble-help" mix={[bubbleContentVariants(), linkStyles]}>
          اقرأ الدليل
          <ArrowRightIcon />
        </a>
      </Bubble>
    </div>
  )
}
