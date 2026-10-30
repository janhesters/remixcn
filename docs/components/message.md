# Message

One row of a conversation: an avatar beside a header, the message surface, and a footer, at the start or the end.

- Source: `registry/ui/message.tsx`. Needs `registry/lib/theme.css`.
- Examples: `registry/examples/message-example.tsx`. Run them with `bun run conversation-examples`.
- Upstream: shadcn/ui [`message.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/message.tsx) and its [docs](https://ui.shadcn.com/docs/components/base/message).

## Usage

```tsx
import { Avatar, AvatarFallback } from '#remixcn/ui/avatar.tsx'
import { Bubble, BubbleContent } from '#remixcn/ui/bubble.tsx'
import { Message, MessageAvatar, MessageContent, MessageFooter, MessageHeader } from '#remixcn/ui/message.tsx'

<Message>
  <MessageAvatar>
    <Avatar>
      <AvatarFallback>OL</AvatarFallback>
    </Avatar>
  </MessageAvatar>
  <MessageContent>
    <MessageHeader>Olivia</MessageHeader>
    <Bubble variant="secondary">
      <BubbleContent>How can I help you today?</BubbleContent>
    </Bubble>
    <MessageFooter>Delivered</MessageFooter>
  </MessageContent>
</Message>
```

## API

| Part | Renders | Notes |
| --- | --- | --- |
| `Message` | `<div>` | `align`: `'start'` (default) or `'end'`. An end row puts the avatar at the end and moves every part of its content to the end. No role |
| `MessageGroup` | `<div>` | Stacks consecutive messages from one sender |
| `MessageAvatar` | `<div>` | At the bottom of the row, lined up with the bottom of the bubble when a footer follows it, however many rows the footer wraps onto. Leave it empty on the earlier messages of a group |
| `MessageContent` | `<div>` | Holds the header, the bubbles or attachments, and the footer |
| `MessageHeader` | `<div>` | A line above, such as the sender and the time. Wraps |
| `MessageFooter` | `<div>` | A line below, such as a status and actions. Ends at the end of an end row. Wraps |

Every part takes its native element's props and `mix`.

## Composition

- **Semantics.** Message is a layout. Give the conversation its own semantics, such as a list (`role="list"` on the group, `role="listitem"` on each Message) or a log, and name each sender in text: an avatar alone isn't a name.
- **Status in text.** Say a delivery status in words, such as "Delivered" or "Failed to send", with an icon where it helps, not only with a color. The Actions example puts it in a status, so a change is announced.
- **Actions.** Put Copy, feedback and Retry in the footer, each with a name. Copy uses Code Block's `CodeBlockCopyButton`, which shows Copied only after the clipboard confirms and says when the browser refuses. Feedback buttons are toggles with `aria-pressed`.
- **Running replies.** Show a step that runs with a `Marker role="status"`, then the reply, as the Status example does.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `MessageGroup`, `Message`, `MessageAvatar`, `MessageContent`, `MessageHeader`, `MessageFooter` | Same parts and data attributes | |
| `data-[align=end]:flex-row-reverse` | Same | Mirrors in right-to-left text |
| Content `*:data-slot:self-end` in an end row | Same | Bubble agrees from its own rule |
| Avatar `-translate-y-8` when the message has a footer anywhere | Lifted by the height of the message's own footer and the gap above it, which Message measures in the browser and measures again when either changes; 2rem before that and without JavaScript | A footer that wraps onto several rows, as on a narrow screen with large text, keeps the avatar beside the bubble. A nested message's footer doesn't move it |
| Header and footer `px-0` when the message has any `data-variant="ghost"` | Only next to a ghost Bubble | A ghost button in the footer used to remove the padding too |
| Header and footer on one line | They wrap | So a long name or several actions fit a narrow screen |
| `wrap-break-word` | `overflow-wrap: anywhere` | |
| Docs: Avatar, Group, Header and Footer, Actions, Attachment | `MessageWithAvatar`, `MessageGroupExample`, `MessageGroupChat`, `MessageHeaderFooter`, `MessageActions`, `MessageAttachment` | Plus `MessageDefault`, `MessageStatus`, `MessageUntrusted` and `MessageRtl` |
| Examples: the AI SDK message parts | Not ported | The examples use invented messages, no model SDK |

## Accessibility checks

Automated: names and text escape on the server; copy confirms or reports a refusal in a status; feedback toggles report `aria-pressed`, and each instance keeps its own state; a failed send says so in text with an icon and announces Retry's result; header and footer text reach 4.5:1 in both themes; avatars line up with the bubble above a footer of any height, also when it wraps at 320px with text at 200%, and mirror in right-to-left text; the page passes axe-core's WCAG 2.2 A and AA rules and fits 320px with text at 200%. This isn't an accessibility certification.

Manual gaps: reading order and announcements of a whole conversation were not checked with a screen reader.
