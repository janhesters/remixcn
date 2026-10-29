# Message Scroller

A chat transcript in a native scroll container. It opens a saved thread at the end or at its last question, follows a streamed reply only while you stay at the end, starts a new turn near the top with a peek of the message before it, keeps the message you're reading in place when content changes, and jumps to any message. Messages are your data: the scroller fetches nothing and connects to no AI.

- Source: `registry/ui/message-scroller.tsx`. Needs `registry/ui/button.tsx`, `registry/lib/icons.tsx`, `registry/lib/styles.ts` and `registry/lib/theme.css`.
- Examples: `registry/examples/message-scroller-example.tsx`. Run them with `bun run message-scroller-examples` (http://localhost:4430/), and `bun run capture:message-scroller-examples` writes the screenshots in `docs/images/message-scroller/`.
- Upstream: shadcn/ui [`message-scroller.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/message-scroller.tsx), the [`@shadcn/react` primitive](https://github.com/shadcn-ui/ui/tree/96da9cc7f1aa10580a3741664e2a77c721206c00/packages/react/src/message-scroller) it wraps, and its [docs](https://ui.shadcn.com/docs/components/base/message-scroller).

## How it runs

| Part | Element | Without JavaScript |
| --- | --- | --- |
| MessageScrollerProvider | No element. It owns one transcript's scroll behavior | — |
| MessageScroller | A frame around the viewport and the jump buttons | Rendered |
| MessageScrollerViewport | A native scroll container, a labelled region in the tab order | Every message is there. The keyboard, the wheel and touch scroll it. It shows the start |
| MessageScrollerContent | The rows, as a `log` | Rendered |
| MessageScrollerItem | One row | Rendered |
| MessageScrollerButton | A Button to the end or the start | Hidden, inert and out of the tab order |

Every part runs inside a client entry of your app, as every example does. None is a client entry itself, for the reasons in [Scroll Area](scroll-area.md#how-it-runs): an entry can't take your mixins, and its component children would hydrate frozen. The server renders every message, so nothing depends on the browser to be read.

The server can't scroll. When a transcript opens at the end or at its last question, the viewport carries `data-pending-scroll` and stays hidden until the browser has scrolled it, so it doesn't jump. Two fail-safes keep the messages visible: a browser that runs no script shows the viewport at once (`@media (scripting: none)`), and a page whose script never loads shows it after two seconds, at the start.

## Composition

```tsx
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from './ui/message-scroller.tsx'

<div mix={css({ height: '32rem' })}>
  <MessageScrollerProvider autoScroll>
    <MessageScroller>
      <MessageScrollerViewport>
        <MessageScrollerContent>
          {messages.map((message) => (
            <MessageScrollerItem key={message.id} messageId={message.id} scrollAnchor={message.role === 'user'}>
              <YourMessage message={message} />
            </MessageScrollerItem>
          ))}
        </MessageScrollerContent>
      </MessageScrollerViewport>
      <MessageScrollerButton />
    </MessageScroller>
  </MessageScrollerProvider>
</div>
```

- **Height.** The frame fills its parent, so give the parent a height.
- **Rows.** Wrap every direct child of the content in a MessageScrollerItem: a message, a marker, a typing row or a "load earlier" row. Key rows by their message, so rows added above are new elements, and give message rows a stable `messageId`.
- **Turns.** `scrollAnchor` marks the row that starts a turn, usually your own message, or a marker such as "Marcus joined". When one arrives, it lands near the top with `scrollPreviousItemPeek` pixels of the row before it, and the reply grows into the room below. A row that becomes an anchor in place, or a row that replaces a typing row, starts no turn.
- **Following.** With `autoScroll`, new content keeps the view at the end while you're there. The wheel, touch, the scroll keys and the scrollbar pause it, also while a reply streams. The end button, or `scrollToEnd()`, resumes it. Once a reply fills the room below its question, following takes over from the held question.
- **History.** Rows added above the first message, also below a "load earlier" row without a `messageId`, keep the message you're reading in place. So do images and rows above it that change size, also after a jump to a message.
- **Focus.** The scroller never moves focus while it scrolls. A jump button moves focus to the viewport when you press it, since the button goes away once it arrives.
- **Streaming.** The content is a `log` that announces new rows, not every streamed word. Pass `aria-busy="true"` on MessageScrollerContent while a reply streams if announcements should wait for the whole message.

Style a part with `mix={css(...)}`, a `class`, or a rule in `@layer app`, as `AGENTS.md` describes.

## Other components

Upstream's three hooks become helpers that take your component's `handle`. Call them while rendering, in any component inside the provider, also outside the frame.

```tsx
function Toolbar(handle: Handle) {
  return () => {
    let scroller = getMessageScroller(handle)
    let { end } = watchMessageScrollerScrollable(handle)
    let { currentAnchorId } = watchMessageScrollerVisibility(handle)
    return (
      <Button disabled={!end} mix={on('click', () => void scroller.scrollToEnd({ behavior: 'smooth' }))}>
        Latest message
      </Button>
    )
  }
}
```

| Helper | Replaces | Returns |
| --- | --- | --- |
| `getMessageScroller(handle)` | `useMessageScroller()` | The commands and the state: `scrollToMessage`, `scrollToEnd`, `scrollToStart`, `scrollable`, `visibility`, `onScrollableChange` and `onVisibilityChange` |
| `watchMessageScrollerScrollable(handle)` | `useMessageScrollerScrollable()` | `{ start, end }`, and renders the component again when it changes |
| `watchMessageScrollerVisibility(handle)` | `useMessageScrollerVisibility()` | `{ currentAnchorId, visibleMessageIds }`, and renders the component again when it changes |

The watchers stop when the component leaves. Code that isn't a component, such as a mixin, listens with `onScrollableChange(listener, signal)` and `onVisibilityChange(listener, signal)` until its signal aborts. Visibility tracking runs only while something watches it.

## API

### MessageScrollerProvider

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `autoScroll` | `boolean` | `false` | Follows new content while you're at the end |
| `defaultScrollPosition` | `'start' \| 'end' \| 'last-anchor'` | `'end'` | Where the transcript opens once it has rows. `'last-anchor'` opens at the last anchored row, or at the end when that turn fits or there's none. A changed value opens it again there |
| `scrollEdgeThreshold` | `number` | `8` | Pixels from an edge that still count as at it |
| `scrollPreviousItemPeek` | `number` | `64` | Pixels of the previous row kept in view above a new turn |
| `scrollMargin` | `number` | `0` | Pixels between a jump target and the aligned edge |

### Parts

| Part | Props | Renders |
| --- | --- | --- |
| `MessageScroller` | `<div>` props | `data-slot="message-scroller"` |
| `MessageScrollerViewport` | `<div>` props, `preserveScrollOnPrepend` (default `true`). `role` defaults to `region`, `aria-label` to `Messages` unless you pass `aria-labelledby`, `tabIndex` to `0` | `data-slot="message-scroller-viewport"` |
| `MessageScrollerContent` | `<div>` props, `spacerMix` for the spacer after the rows. `role` defaults to `log`, `aria-relevant` to `additions` | `data-slot="message-scroller-content"` and a hidden `data-slot="message-scroller-spacer"` |
| `MessageScrollerItem` | `<div>` props, `messageId`, `scrollAnchor` (default `false`) | `data-slot="message-scroller-item"`, `data-message-id`, `data-scroll-anchor="true"` or `"false"` |
| `MessageScrollerButton` | Button props, `direction` (`'end'` by default, or `'start'`), `behavior` (`'smooth'` by default), `variant` (`'secondary'`), `size` (`'icon-sm'`) | `data-slot="message-scroller-button"`, `data-direction`, `data-active="true"` or `"false"`. Inactive, it's `inert` with `tabindex="-1"`. Its default content is an arrow and the hidden text "Scroll to end" or "Scroll to start". Pass children with your own label in another language |

The frame and the viewport carry the scroll state for styling: `data-scrollable` with `start`, `end` or both (match one with `[data-scrollable~="end"]`), `data-autoscrolling` for a moment while `scrollToEnd()`, the end button or the opening position scrolls to the end (following a reply doesn't set it), and `data-pending-scroll` until the opening position applies. The provider writes them on scroll, outside renders.

### Commands

| Command | Returns |
| --- | --- |
| `scrollToMessage(messageId, options?)` | `true` when it scrolled, or waits for a row that hasn't mounted while the transcript is still empty. `false` when no row has the id. A jump wins over the opening position and pauses following until your next gesture |
| `scrollToEnd(options?)` | `false` before the viewport mounts. Resumes following with `autoScroll` |
| `scrollToStart(options?)` | `false` before the viewport mounts |

Options: `align` (`'start'`, `'center'`, `'end'` or `'nearest'`; default `'start'`), `behavior` (default `'auto'`), and `scrollMargin` (default the provider's). `'smooth'` turns instant for reduced motion.

## Source and behavior map

Upstream: `apps/v4/registry/bases/base/ui/message-scroller.tsx`, its example and demos, `apps/v4/content/docs/components/base/message-scroller.mdx` and `content/docs/react/message-scroller.mdx`, the `.cn-message-scroller-content` class of `apps/v4/registry/styles/style-vega.css`, the `scroll-fade-b` utility of `packages/shadcn/src/tailwind.css`, and the primitive in `packages/react/src/message-scroller/` (`components.tsx`, `use-message-scroller-controller.ts`, `use-message-scroller-commands.ts`, `use-message-scroller-refs.ts`, `geometry.ts`, `stores.ts` and `types.ts`), all at the pinned shadcn/ui commit.

| Upstream | RemixCN |
| --- | --- |
| `MessageScrollerProvider`, `MessageScroller`, `…Viewport`, `…Content`, `…Item`, `…Button` with their props and defaults | The same parts, props, defaults and data attributes. The primitive's `MessageScroller.Root`-style namespace isn't ported: the styled file's flat names are the API |
| The controller's modes, following, turn anchoring with a tail spacer, the hand-off from a held turn to following, the opening positions, queued `scrollToMessage`, alignments, margins and the edge threshold | The same rules and numbers, in one scroller per provider that its parts attach to with `ref`. Its observers, listeners, frames and timers stop when the parts or the provider leave |
| Following releases on an upward scroll only while no scroll to the end is marked automatic, and every followed chunk marks it again | Any upward scroll the reader makes releases following, since the scroller's own scrolls to the end only move down. Only a command, the end button or the opening position marks the scroll as automatic. Upstream's rule kept following through a scrollbar drag for as long as a reply streamed, and kept the scrollbar transparent |
| After `scrollToMessage`, rows above the target move it until the reader's next gesture, unless the browser anchors the scroll | Once the jump arrives, the first visible row stays in place as when scrolling freely. A smooth jump that rows above move while it's on its way is aimed at its message again |
| `useMessageScroller`, `useMessageScrollerScrollable`, `useMessageScrollerVisibility` and their stores | `getMessageScroller(handle)`, `watchMessageScrollerScrollable(handle)` and `watchMessageScrollerVisibility(handle)`, plus `onScrollableChange` and `onVisibilityChange` for code outside a component. Visibility still runs only while watched, with an IntersectionObserver on the reading line |
| Rows registered by React ref callbacks; a MutationObserver on the rows; ResizeObservers on the viewport and the rows | Rows found in the content by `data-message-id`. The same observers. A row whose `messageId` or `scrollAnchor` changes tells the scroller after its render |
| A new turn is the first anchor at or after the old row count; a replaced row anchors the first anchor never handled | A new turn is an anchored row the scroller hasn't seen. Upstream's rule jumped back to the first anchor of a loaded thread when a typing row was replaced, and to an old anchor when a row was inserted in the middle |
| Older rows are detected when the first row moves down, and the first visible row is restored where the browser didn't | Detected when a message row arrives before the first message row, so a "load earlier" row can stay on top. The first visible row is also restored when a row above it resizes or is added or removed, which engines without scroll anchoring need. A row that changed its own size stays as the browser left it |
| `data-pending-scroll` hides the viewport until the opening position applies; an inline script can scroll it first | The same attribute and hiding. It never hides without scripting, and shows after two seconds if the script never runs. The inline script isn't needed for that and isn't documented |
| Item rows with `content-visibility: auto` and `contain-intrinsic-size: auto 10rem` | Every row renders. A skipped row's height is a guess: in tests a jump to a far row landed 520px off in Chromium and 112px off in Firefox, and an image above the reader didn't resize until it came near. The ticket keeps referenced content rendered |
| `scroll-fade-b`: a scroll-driven mask that fades the bottom edge near the end | A mask while `data-scrollable~="end"`, none in forced colors. Since the mask clips the viewport's own outline, the frame draws the focus ring inside its edge |
| `scrollbar-thin`, `scrollbar-gutter-stable`, `overscroll-contain`, `contain-content`, transparent scrollbars while `data-autoscrolling` | The same, with the scrollbar colors left alone in forced colors |
| `gap-8` between rows, `flex h-max min-h-full flex-col` content, `min-w-0 shrink-0` rows | The same |
| The button: secondary Button `icon-sm`, centered, `border-border bg-background`, scales and fades out when inactive, the arrow turned for the start, `inert` and `tabIndex={-1}` when inactive, `blur()` after a click | The same look with the motion tokens, so reduced motion turns the transition off. The border and background apply to the secondary variant, so another variant looks like itself. A click moves focus to the viewport instead of dropping it to the page. A caller's click handler that calls `preventDefault()` cancels the scroll |
| `render` on the button | Not ported. Pass children and `mix`, or build your own control from the helpers |
| `spacerClassName` | `spacerMix` |
| Smooth scrolling regardless of motion settings | Smooth turns instant for reduced motion |
| The virtualization recipe with TanStack Virtual | Not ported: it needs React. The viewport is a plain scroll element, so a virtualizer can own its rows |

## Accessibility checks

Automated (`bun run test`, `bun run test:browser`, `bun run test:e2e`). The browser and end-to-end tests run in Chromium, Firefox, and WebKit:

- axe-core: no WCAG 2.2 A or AA violations on the examples, before and after hydration, in light and dark.
- Server HTML: every message in a labelled region and a log, the jump buttons inert and out of the tab order, the viewport hidden only while scripting is on. Without scripting the transcripts show at once; with a script that never loads, after two seconds.
- Hydration: each transcript opens at its position without console errors: the end, the last question with a 64px peek, or the start.
- Following and turns: appends and a growing reply followed at the end; nothing followed without `autoScroll`; the wheel, touch, keys and a scrollbar drag pause it, also during the scroller's own scroll and while a reply streams; the end button and `autoScroll` changes resume it; several turns at once keep following; a new turn held near the top while its reply streams, then followed; replaced and changed rows.
- Keeping the place: rows prepended at the top or below a "load earlier" row, a row and a real image resizing above the reader, also after an instant or smooth jump, with the browser's scroll anchoring and without it, and container resizes.
- Commands: every alignment and margin, a far row of natural height, a queued jump, jumps that pause following, controls outside the frame, and the visibility outline.
- Keyboard and pointer: Tab into the region with its focus ring, Home and End, Tab to the jump button and Enter, which moves focus to the viewport; the mouse wheel and button clicks. Following never moves focus from a composer or a link in a row.
- Instances and cleanup: two transcripts stay independent, and every observer, frame and timer stops when a transcript leaves in the middle of a scroll.
- Forced colors: the fade drops, borders and the focus ring stay. Reduced motion: transitions take 0s and smooth scrolling turns instant. Right to left: the button stays centered. Reflow: 320px wide without scrolling sideways or clipping a transcript, also at 200% text.

Not checked yet:

- Screen readers. Nobody has listened to the log's announcements in NVDA, JAWS, VoiceOver, or TalkBack, with or without `aria-busy`.
- Real touch devices, trackpads with momentum scrolling, and Windows High Contrast. Touch was a synthetic `touchmove`, and forced colors were emulated.
- Long transcripts. No benchmark ran here; upstream's measures its primitive without `content-visibility`.

These checks show how the component behaves in three browser engines. They're not an accessibility certification.
