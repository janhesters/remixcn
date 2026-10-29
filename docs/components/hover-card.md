# Hover Card

Previews what's behind a link for sighted pointer and keyboard users. It opens while the pointer rests on the link or the link has keyboard focus, and stays open while the pointer or focus is on the card, so links in it work. The link works as always, also on the first tap: touch never opens the card.

- Source: `registry/ui/hover-card.tsx`. Needs `registry/lib/theme.css`, `styles.ts`, `layer.ts`, `anchor-position.ts` and `hover-intent.ts`.
- Examples: `registry/examples/hover-card-example.tsx`. Run them with `bun run overlays`.
- Upstream: shadcn/ui [`hover-card.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/hover-card.tsx), its [docs](https://ui.shadcn.com/docs/components/base/hover-card), and [Base UI Preview Card](https://base-ui.com/react/components/preview-card.md).

## Usage

```tsx
import { HoverCard, HoverCardContent, HoverCardTrigger } from '#remixcn/ui/hover-card.tsx'

<HoverCard>
  <HoverCardTrigger href="/customers/acme-labs">Acme Labs</HoverCardTrigger>
  <HoverCardContent>Lab equipment, billed monthly.</HoverCardContent>
</HoverCard>
```

The parts run in the browser inside your client entry, like Button. Until then, and without JavaScript, the link works and no card opens.

## API

### `HoverCard`

Groups the parts and holds whether the card is open. It renders no element. Takes `open`, for a card you control, and `defaultOpen`.

### `HoverCardTrigger` and `hoverCardTrigger()`

`HoverCardTrigger` is a native `<a>`: give it an `href`. It takes every link prop, `mix`, and:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `delay` | `number` | `600` | Milliseconds the pointer rests on the link before the card opens. Keyboard focus opens it at once |
| `closeDelay` | `number` | `300` | Milliseconds before it closes once the pointer has left the link and the card |

`hoverCardTrigger({ delay, closeDelay })` makes any focusable element the trigger, such as a button with `buttonVariants()`. The trigger renders `data-popup-open` while the card is open.

### `HoverCardContent`

The card, a `<div>` in the top layer. It takes every `div` prop, `mix`, and the placement props of [`PopoverContent`](popover.md#popovercontent): `side` (`'bottom'`), `sideOffset` (`4`), `align` (`'center'`), `alignOffset` (`4`, as shadcn sets it), `collisionPadding`, `collisionBoundary`, `collisionAvoidance` and `anchor`. It renders the same data attributes and CSS variables, never grows wider or taller than the room beside the trigger, and scrolls what doesn't fit.

### `HoverCardOpenChangeEvent`

Dispatched on the card before it opens or closes, with `open`, `reason` and `cause`. Cancelable, and it doesn't bubble. `reason` is `'trigger-hover'`, `'trigger-focus'`, `'focus-out'`, `'escape-key'`, `'outside-press'`, `'parent-dismissed'` or `'trigger-removed'`. Also exported: `hoverCardOpenChangeType` and the types.

## Composition

- **What it's for.** A hover card adds a preview for people who can see it; it has no role and isn't announced. Keep everything it shows reachable behind the link too.
- **Keyboard.** Focus on the link opens the card, also while a hover delay runs. It stays in the document after the link while hidden, so Tab moves into its links next, and the card stays open while focus is inside. Escape from inside the card closes it and puts focus back on the link.
- **Hovering the card.** The pointer can cross the gap from the link to the card, and back, without closing it, also with no close delay.
- **Touch.** Touch never opens the card, so the first tap follows the link. Base UI may open it on touch.
- **Inside a popover.** A press in the card counts as inside the popover, and Escape closes the card first.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `HoverCard` on Base UI's `PreviewCard.Root` | `HoverCard` | `open` and `defaultOpen` |
| Root `onOpenChange` | `HoverCardOpenChangeEvent` on the card | |
| Root `actionsRef`, `onOpenChangeComplete`, `handle`, `triggerId`, `defaultTriggerId`, Trigger `payload` | Not ported | One trigger per card, no exit animation |
| `HoverCardTrigger` on `PreviewCard.Trigger` | `HoverCardTrigger`, a native link, and `hoverCardTrigger()` | `hoverCardTrigger()` replaces `render` |
| Trigger `delay`, `closeDelay` | Same, with Base UI's defaults of 600 and 300 | |
| Hover with Base UI's safe polygon | `hover-intent.ts`: a bridge across the gap the size of both boxes | Simpler than a polygon; diagonal moves rely on the close delay |
| Focus opens it | Same, on keyboard focus only (`:focus-visible`) | A click that focuses the link doesn't |
| `HoverCardContent` on `Portal`, `Positioner` and `Popup` | `HoverCardContent`, a native popover | Same placement props and defaults as shadcn |
| Classes in `style-vega.css` | Same measures and colors | `ring-1` becomes a border, drawn in `CanvasText` in forced colors; `w-64` stays within the room on screen |
| Fade and zoom | A fade in | As in Popover |
| `PreviewCard.Arrow`, `Backdrop`, `Viewport` | Not ported | shadcn's hover card doesn't draw them |
| Docs: Basic, Trigger Delays, Positioning, Sides, RTL | `HoverCardBasic`, `HoverCardDelays`, `HoverCardSides`, the fixture's right-to-left section | |
| Example: In Dialog | Not yet | Waits for the Dialog port. A hover card inside a popover is tested instead |

## Accessibility checks

Automated, in Chromium, Firefox and WebKit:

- The trigger is a native link that navigates as always, also on the first tap; touch opens no card.
- The card opens after its delay under a resting pointer, not when the pointer leaves first, and after Base UI's 600ms by default.
- The pointer can cross to the card and use its link; the card closes once the pointer leaves both, after the close delay.
- Keyboard focus opens it at once; focus can move into its links; it closes when focus leaves both.
- Escape and a press elsewhere close it, and the open-change event names the reason. Escape from a link in the card puts focus back on the trigger; a press elsewhere leaves focus where it went.
- Its trigger removed while open closes it; a delay running when it unmounts opens nothing.
- axe-core finds no WCAG 2.2 A or AA violation with one open, in both themes; its border is drawn in `CanvasText` in forced colors.

Not checked, so not claimed:

- Screen readers weren't tested; the card isn't meant to be announced.
- Safari itself and Windows forced colors weren't tested.
- This isn't an accessibility certification.
