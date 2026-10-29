# Popover

A non-modal dialog beside its trigger, in a native `popover` element in the top layer. A click opens it and moves focus inside; Escape, a press elsewhere, focus leaving it and its trigger, and its close button close it. Escape and the close button return focus to the trigger.

- Source: `registry/ui/popover.tsx`. Needs `registry/lib/theme.css`, `styles.ts`, `layer.ts`, `focus-scope.ts`, `modal.ts` and `anchor-position.ts`.
- Examples: `registry/examples/popover-example.tsx`. Run them with `bun run overlays`.
- Upstream: shadcn/ui [`popover.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/popover.tsx), its [docs](https://ui.shadcn.com/docs/components/base/popover), [Base UI Popover](https://base-ui.com/react/components/popover.md), and Remix's [`popover.ts`](https://github.com/remix-run/remix/blob/6ab529634e35cac4eff786b048800831d1c5cf99/packages/ui/src/popover.ts).

## Usage

```tsx
import { buttonVariants } from '#remixcn/ui/button.tsx'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '#remixcn/ui/popover.tsx'

<Popover>
  <PopoverTrigger mix={buttonVariants({ variant: 'outline' })}>Payment terms</PopoverTrigger>
  <PopoverContent align="start">
    <PopoverHeader>
      <PopoverTitle>Payment terms</PopoverTitle>
      <PopoverDescription>Invoices are due 30 days after they are sent.</PopoverDescription>
    </PopoverHeader>
  </PopoverContent>
</Popover>
```

The parts run in the browser inside your client entry, like Button: they take your mixins, which can't cross from the server into an entry. Put the popover in a component you mark with `clientEntry(...)`, as the examples do.

## API

### `Popover`

Groups the parts and holds whether the popover is open. It renders no element.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `open` | `boolean` | | Whether it's open, for a popover you control. Update it from `PopoverOpenChangeEvent` |
| `defaultOpen` | `boolean` | `false` | Whether it starts open |
| `modal` | `boolean` | `false` | Whether the page behind it waits: it can't be scrolled or used, and focus stays in the popover and its trigger |

### `PopoverTrigger` and `popoverTrigger()`

`PopoverTrigger` is a native `<button type="button">` that opens and closes the popover. It takes every button prop and `mix`. Give it a Button's look with `mix={buttonVariants({ variant: 'outline' })}`.

`popoverTrigger()` makes any element the trigger, such as `<button type="button" mix={[buttonVariants(), popoverTrigger()]}>`. It keeps the element's own `data-slot`.

The trigger renders `aria-haspopup="dialog"`, `aria-controls` with the content's id, `aria-expanded` once the popover runs, and `data-popup-open` while open.

### `PopoverContent`

The popover: a `<div role="dialog">` in the top layer. It takes every `div` prop and `mix`, and:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `side` | `'top' \| 'bottom' \| 'left' \| 'right' \| 'inline-start' \| 'inline-end'` | `'bottom'` | The side of the trigger. Inline sides follow the text direction |
| `sideOffset` | `number` | `4` | The gap to the trigger, in pixels |
| `align` | `'start' \| 'center' \| 'end'` | `'center'` | The alignment along that side. Start and end follow the text direction |
| `alignOffset` | `number` | `0` | A shift away from the aligned edge, in pixels |
| `collisionPadding` | `number` | `5` | Space to keep from the viewport's edges, in pixels |
| `collisionBoundary` | `Element \| null` | | An element whose box also limits where it goes |
| `collisionAvoidance` | `{ side?: 'flip' \| 'none'; align?: 'shift' \| 'none' }` | flip and shift | Whether it flips to the other side and shifts along the edge to stay in view |
| `anchor` | `Element \| { x, y, width?, height? } \| () => …` | the trigger | What to place it against instead |
| `initialFocus` | `HTMLElement \| (() => HTMLElement \| null) \| false` | first `[autofocus]` or tabbable element, else the popover | What to focus when it opens, or `false` to leave focus alone |
| `finalFocus` | `HTMLElement \| (() => HTMLElement \| null) \| false` | the trigger | What to focus when it closes, or `false` to leave focus alone |

It renders `data-open` or `data-closed`, and while open `data-side`, `data-align`, `data-anchor-hidden` while the trigger is scrolled out of view, and the CSS variables `--anchor-width`, `--anchor-height`, `--available-width`, `--available-height` and `--transform-origin`. It's never wider or taller than the room beside the trigger, and scrolls what doesn't fit.

A `PopoverTitle` names the dialog and a `PopoverDescription` describes it: the content points `aria-labelledby` and `aria-describedby` at them. It finds them among its children, inside host elements and `PopoverHeader`, so the server renders the links. One rendered by your own component is linked once the popover runs, and stays linked as its `id` changes. So does content inside your own component and the trigger's `aria-controls`.

### `PopoverHeader`, `PopoverTitle`, `PopoverDescription`

A `<div>` that stacks the title and description, an `<h2>` heading, and a `<p>`. Each takes its element's props and `mix`. Pass an `id` to choose your own.

### `PopoverClose`

A native `<button type="button">` that closes the popover with focus back on the trigger. Style it with `buttonVariants()`.

### `PopoverOpenChangeEvent`

Dispatched on the content before the popover opens or closes, with `open`, the next state, `reason` and `cause`, the event that asked. It's cancelable: `preventDefault()` keeps the current state. It doesn't bubble, so a listener on the content hears only its own popover, not one nested inside it.

```tsx
<PopoverContent mix={on(popoverOpenChangeType, (event) => { open = event.open; handle.update() })}>
```

`reason` is `'trigger-press'`, `'close-press'`, `'escape-key'`, `'outside-press'`, `'focus-out'`, `'parent-dismissed'` (its parent popover closed) or `'trigger-removed'`.

### Also exported

`popoverOpenChangeType`, and the types `PopoverProps`, `PopoverContentProps`, `PopoverOpenChangeReason` and `CollisionAvoidance`.

## Composition

- **Without JavaScript.** Until the popover runs, the trigger opens it natively with `popovertarget`, and the close button closes it the same way. The browser shows it in the middle of the screen, and Escape or a press elsewhere closes it. A popover the browser opened before the script ran stays open and moves beside its trigger. A page that renders a popover outside any client entry keeps the native behavior.
- **Open by default.** On the server and until the popover runs, it renders closed: nothing places it beside its trigger before then.
- **Stays in the document.** The content renders while closed, hidden, so the trigger's `aria-controls` always points at it and fields keep what you typed. Base UI unmounts it unless you ask it to keep it mounted.
- **Nested popovers.** Put one popover in another's content. Presses and focus in the inner one count as inside the outer one, Escape closes the inner one first, and a press outside both closes both.
- **Modal.** With `modal`, the rest of the page is inert and doesn't scroll. The trigger stays usable, so it can close the popover.
- **Clipping.** The popover sits in the top layer, so a box with `overflow: hidden` around the trigger doesn't clip it.
- **Overrides.** A `css()` you pass with `mix` renders after the content's own rule, so it wins, as in `mix={css({ width: '10rem' })}`.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `Popover` on Base UI's `Popover.Root` | `Popover` | |
| Root `open`, `defaultOpen` | Same | |
| Root `onOpenChange` | `PopoverOpenChangeEvent` on the content | Cancelable, like `eventDetails.cancel()` |
| Root `modal` | `modal: boolean` | `'trap-focus'` isn't ported: `inert` traps focus and blocks the page together |
| Root `actionsRef`, `onOpenChangeComplete` | Not ported | No exit animation to wait for: the popover hides at once |
| Root `handle`, `triggerId`, `defaultTriggerId`, Trigger `payload` | Not ported | One trigger per popover |
| `PopoverTrigger` on `Popover.Trigger` | `PopoverTrigger` and `popoverTrigger()` | `popoverTrigger()` replaces `render` and `nativeButton` |
| Trigger `openOnHover`, `delay`, `closeDelay` | Not ported | Use a Hover Card for previews on hover |
| Trigger `data-popup-open` | Same | `data-pressed` isn't ported |
| `PopoverContent` on `Portal`, `Positioner` and `Popup` | `PopoverContent`, a native popover | The top layer replaces the portal and its `container` |
| Positioner `side`, `align`, `sideOffset`, `alignOffset` | Same, with shadcn's defaults | Offsets are numbers; the offset functions aren't ported |
| Positioner `collisionPadding`, `collisionBoundary`, `anchor` | Same | `collisionBoundary` takes an element |
| Positioner `collisionAvoidance` | `side: 'flip' \| 'none'`, `align: 'shift' \| 'none'` | Shifting on the side axis and flipping only the alignment aren't ported |
| Positioner `sticky`, `positionMethod`, `disableAnchorTracking`, `arrowPadding` | Not ported | Always fixed, tracked, and hidden while the anchor is out of view |
| Popup `initialFocus`, `finalFocus` | Same | Elements, functions or `false`; the interaction-type function form isn't ported |
| `data-open`, `data-closed`, `data-side`, `data-align`, `data-anchor-hidden`, CSS variables | Same | `data-starting-style`, `data-ending-style` and `data-instant` aren't ported |
| `PopoverHeader`, `PopoverTitle`, `PopoverDescription` | Same | Title and description link to the dialog through `aria-labelledby` and `aria-describedby` |
| Base UI's `Popover.Close` | `PopoverClose` | shadcn doesn't export one |
| `Popover.Arrow`, `Backdrop`, `Viewport` | Not ported | shadcn's popover doesn't draw them |
| Classes in `style-vega.css` | Same measures and colors | `ring-1` becomes a border, drawn in `CanvasText` in forced colors; `w-72` stays, within the room on screen |
| Fade and zoom in and out | A fade in | A transform would move the box the positioning measures; it closes at once |
| Docs: Basic, Align, With Form, RTL | `PopoverBasic`, `PopoverAlignments`, `PopoverWithForm`, the fixture's right-to-left section | |
| Example: Sides | `PopoverSides` | |
| Example: In Dialog | `PopoverNested`, `PopoverModal` | The dialog example waits for the Dialog port |
| — | `PopoverControlled` | The open-change event and an outside button |

## Accessibility checks

Automated, in Chromium, Firefox and WebKit (`bun run test`, `test:browser`, `test:e2e`):

- The trigger is a button with `aria-haspopup="dialog"`, `aria-controls` and `aria-expanded`; the content is a dialog named by its title and described by its description, in the server HTML too.
- Enter and a click open it with focus on the first field; Tab moves through it; Escape closes it with focus back on the trigger; Tab out of it, and Shift+Tab out through the trigger, close it with focus where it went; the close button returns focus.
- A press outside closes it without pulling focus back; a press in a nested popover keeps the outer one open, and Escape closes the nested one first.
- `initialFocus={false}` leaves focus on the trigger; `finalFocus` picks where focus goes, or nowhere.
- A modal popover makes the page inert and stops scrolling until it closes.
- Without JavaScript, the trigger and close button open and close it natively; a popover opened that way before the script ran stays open after hydration, beside its trigger.
- It follows its trigger in a scrolling box and hides while the trigger is out of view; a box that clips its overflow doesn't clip it; it flips at the viewport's edge; start alignment mirrors in right-to-left text.
- Its trigger removed while open closes it, with focus on a neighbor.
- axe-core finds no WCAG 2.2 A or AA violation with one open, in both themes.
- An open popover fits a 320px viewport with text at 200%, and scrolls what doesn't fit.
- It fades in only without reduced motion; its border is drawn in `CanvasText` in forced colors.

Not checked, so not claimed:

- Screen readers (NVDA, JAWS, VoiceOver, TalkBack) weren't tested.
- Safari itself wasn't run, only Playwright's WebKit in CI. Forced colors were emulated in Chromium and Firefox, not tested in Windows.
- This isn't an accessibility certification.
