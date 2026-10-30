# Drawer

A Dialog along one edge of the screen that follows the pointer: swipe it toward its edge to close it, or drag it between snap points. It builds on Dialog, so `dialog.md` describes its focus, its dismissal and how it runs before and after hydration.

- Source: `registry/ui/drawer.tsx`. Needs `registry/ui/dialog.tsx` and what it needs, `registry/lib/styles.ts` and `theme.css`.
- Examples: `registry/examples/drawer-example.tsx`. Run them with `bun run drawer-examples`.
- Upstream: shadcn/ui [`drawer.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/drawer.tsx), its [docs](https://ui.shadcn.com/docs/components/base/drawer), and [Base UI Drawer](https://base-ui.com/react/components/drawer.md).

## Usage

```tsx
import { Button, buttonVariants } from '#remixcn/ui/button.tsx'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '#remixcn/ui/drawer.tsx'

<Drawer>
  <DrawerTrigger mix={buttonVariants({ variant: 'outline' })}>Pay invoice</DrawerTrigger>
  <DrawerContent>
    <DrawerHeader>
      <DrawerTitle>Pay INV-0042</DrawerTitle>
      <DrawerDescription>CHF 1,250.00 to Acme Labs, due on 30 November.</DrawerDescription>
    </DrawerHeader>
    …
    <DrawerFooter>
      <Button>Pay now</Button>
      <DrawerClose mix={buttonVariants({ variant: 'outline' })}>Cancel</DrawerClose>
    </DrawerFooter>
  </DrawerContent>
</Drawer>
```

## How it runs

- **A native dialog.** `DrawerContent` renders a `<dialog>`, as Dialog does: a modal drawer opens with `showModal()` in the browser's top layer, makes the page inert and draws its `::backdrop`, the overlay. Escape, outside presses, focus and the scroll lock come from Dialog.
- **On the server**, it renders a closed `<dialog>` on its edge, whose trigger and close buttons carry invoker commands. Without a script, it opens, slides in from its edge, closes from its buttons and Escape, and submits its form, in browsers with invoker commands. Gestures need the script; snap point buttons stay disabled until it runs.
- **In the browser**, inside your client entry, the drawer follows the pointer. A gesture mixin on the dialog measures it, writes CSS variables and data attributes, and its styles move it. Nothing renders on a pointer move.

### Gestures

- **Pointer Events and pointer capture.** A drag starts once the pointer moves 3px (6px for touch), from where it is then, so the drawer doesn't jump. The drawer captures the pointer, so the drag goes on outside it.
- **Mouse and pen** drag from the drawer itself, such as the swipe handle, not from its content, which they select text in, and not from controls. **Touch** drags from anywhere, also from buttons, which a drag then doesn't press.
- **Scrolling stays native.** `touch-action` hands the browser every pan the drawer doesn't need: the drawer blocks pans along its axis, and each scroll container inside keeps its native scrolling until it reaches the edge the swipe starts from, such as its top in a drawer that closes downward. From there, a swipe toward the edge moves the drawer and the other way still scrolls, in browsers that tell pans apart by direction (`pan-up` and `pan-down`: Chromium does, Firefox doesn't). Elsewhere, the region scrolls both ways and the drawer moves from its header and handle. The drawer looks at each region again whenever it scrolls, changes size, such as at another snap point, or its content changes. A touch along the other axis belongs to the browser.
- **Ignored:** range inputs, and elements with `data-swipe-ignore`. `data-swipe-ignore="x"` or `"y"` hands touch drags along that axis to the element, such as a carousel, and leaves the other axis to the drawer.
- **The release** follows Base UI: the drawer closes past half its size, or on a swipe faster than 0.5px/ms toward its edge. The closing slide starts where the drag ends and runs shorter after a fast swipe. Otherwise it slides back. A drag past its open position resists. A canceled pointer, a lost capture, Escape or a close button in the middle of a drag end it without a jump. `onOpenChange` gets the reason `swipe`, and canceling it slides the drawer back.

### Snap points

- **Values.** A number from 0 to 1 is a fraction of the viewport's height, a larger number is pixels, and a string takes `px` or `rem`. Each height clamps to the drawer and the viewport; values it can't read are dropped; of two points within a pixel, the later one stays. They apply to `up` and `down` drawers, as in Base UI, which grow to `100dvh` (at most `100dvh - 6rem`) to have room.
- **Settling.** A released drag settles on the snap point closest to where it ends, carried on by its velocity, so a fast flick can skip one. It closes when closed is closer than any snap point, or on a fast swipe toward the edge. `snapToSequentialPoints` moves one point at a time.
- **The keyboard.** `DrawerSnapPointButton` moves the drawer to its snap point, so every height a drag reaches has a button.
- **Reachable content.** At a snap point, the content column gets padding on the edge that sits off the screen, and the same scroll padding. So its content lays out in the part that shows and scrolls there. Focus that would still land off the screen, as WebKit ignores scroll padding for it, scrolls its container until the element shows, so Tab never lands on something you can't see.
- **State.** The drawer opens at `defaultSnapPoint`, else the first point, and goes back to it when it closes. `onSnapPointChange` gets `swipe`, `snap-point-press`, or the reason the drawer closed. An uncontrolled drawer whose snap points change falls back to its default.
- **Resizing.** A resize, a zoom or a change of the root font size resolves the snap points again and moves the drawer to its snap point without a transition. During a drag, the drawer's edge stays under the pointer. A drawer behind a nested one follows what the nested one shows now.

### Virtual keyboards, zoom and motion

- A virtual keyboard that covers the bottom of the page, as the visual viewport measures it, sets `--drawer-keyboard-inset`: the drawer lifts above it and its height shrinks. A pinch zoom changes nothing.
- The drawer slides for twice `--duration-normal`, so reduced motion turns every slide, snap and fade off.

### Nested drawers

A Drawer inside `DrawerContent` opens in front of it. The drawers behind stay open, shrink to the height the frontmost one shows, at its snap point if it has them, scale down by 5% per drawer and peek out 1rem behind it, with their content hidden, also from a snap point, whose offset they drop while they're behind; they follow the frontmost one as it's swiped. Escape and outside presses close the frontmost one first, and a drawer behind can't be dragged.

## API

### `Drawer`

Holds the open state and the snap point, and renders no element. It takes Dialog's props, except `role`:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `open`, `defaultOpen`, `onOpenChange`, `onOpenChangeComplete` | | | As for Dialog. The reasons add `swipe` |
| `modal` | `boolean` | `true` | As for Dialog. A drawer that isn't modal leaves the page usable |
| `disablePointerDismissal` | `boolean` | `false` | As for Dialog |
| `swipeDirection` | `'up' \| 'right' \| 'down' \| 'left'` | `'down'` | The direction a swipe closes it, which is the edge it sits on. Physical, so `right` stays right in right-to-left text |
| `snapPoints` | `DrawerSnapPoint[]` | | Heights an `up` or `down` drawer settles at |
| `snapPoint` | `DrawerSnapPoint \| null` | | The active snap point, for a drawer you control. Render the new value from `onSnapPointChange` |
| `defaultSnapPoint` | `DrawerSnapPoint \| null` | the first snap point | The snap point it opens at |
| `onSnapPointChange` | `(snapPoint, details) => void` | | Called before the snap point changes. `details.cancel()` keeps the current one |
| `snapToSequentialPoints` | `boolean` | `false` | Moves one snap point at a time: a fast swipe no longer skips one |
| `showSwipeHandle` | `boolean` | `false` | Shows the swipe handle at the drawer's inner edge |

`details` holds `reason`, `event`, `cancel()` and `isCanceled`.

### `DrawerTrigger`, `DrawerClose`

`DialogTrigger` and `DialogClose`, with the `drawer-trigger` and `drawer-close` slots: native, unstyled buttons. Give them a look with `buttonVariants()`.

### `DrawerContent`

The drawer itself, a native `<dialog>` with `data-slot="drawer-popup"`. Its children sit in a content column, `data-slot="drawer-content"`, which scrolls when it's taller than the drawer. It takes the props of `DialogPopup`. `initialFocus` defaults to the drawer itself, as in Base UI, so no virtual keyboard opens; `finalFocus` returns to the trigger. For that default it renders `autofocus` on the dialog, so `showModal()` focuses the drawer at once in Firefox and WebKit, also without a script. Chromium focuses the first control there, and the drawer takes focus a frame later, unless Tab already moved it on.

Vertical drawers take the screen's width and their content's height, at most `100dvh - 6rem`. Side drawers take the screen's height and 75% of its width, 24rem from 40rem. Change the size with `mix`, such as `mix={css({ height: '50vh' })}`, which wins over the drawer's own rule.

It renders these data attributes:

| Attribute | When |
| --- | --- |
| `data-swipe-direction` | Always: `up`, `right`, `down` or `left` |
| `data-swipe-axis` | Always: `x` or `y` |
| `data-snap-points` | The drawer has snap points |
| `data-expanded` | The active snap point is `1` |
| `data-swiping` | A drag is in progress |
| `data-swipe-dismiss` | A swipe closed it |
| `data-nested-drawer-open` | A drawer nested in it is open |
| `data-nested-drawer-swiping` | That nested drawer is being dragged |
| `data-resizing` | For one frame after a resize, while transitions are off |
| `data-open`, `data-closed`, `data-nested` | As for Dialog |

And these CSS variables. Set the first three yourself, on the drawer with `mix`:

| Variable | What it is |
| --- | --- |
| `--drawer-inset` | Floats the drawer away from the screen's edges (`0px`) |
| `--drawer-bleed-background` | Fills the gap behind a drawer dragged past its open position (`--popover`) |
| `--drawer-overlay-min-opacity` | The overlay's lowest opacity while swiped (`0`, `0.5` with snap points) |
| `--drawer-swipe-movement-x`, `--drawer-swipe-movement-y` | The drag's movement, in px |
| `--drawer-snap-point-offset` | How far the active snap point moves the drawer, in px |
| `--drawer-swipe-progress` | From 0 to 1, how far it's swiped toward closed, or from the full snap point to the next |
| `--drawer-swipe-strength` | From 0.1 to 1, the scale of the closing slide after a swipe |
| `--drawer-keyboard-inset` | The height a virtual keyboard covers |
| `--nested-drawers`, `--drawer-frontmost-height`, `--drawer-height` | The depth of the open stack in front of it, the height the frontmost one shows, and its own height while it's behind |

### `DrawerSnapPointButton`

A native `<button type="button">` that moves the drawer to its `snapPoint`, with `aria-pressed` for the active one. It stays disabled until the drawer runs in the browser, and in a drawer without snap points. Unstyled, like the trigger.

### `DrawerSwipeHandle`

The bar at the drawer's inner edge, which `DrawerContent` renders with `showSwipeHandle`. It's decorative and `aria-hidden`, as in shadcn: a mouse or pen drags the drawer by it, and the buttons do the same from the keyboard. Its pill is a border, so it shows in forced colors.

### `DrawerHeader`, `DrawerFooter`, `DrawerTitle`, `DrawerDescription`

A column for the title and description, centered in a vertical drawer below 48rem; a column of actions at the bottom of the content; an `<h2>` that names the drawer; and a `<p>` that describes it.

### `DrawerPortal`

Renders its children where they are, so shadcn compositions keep working: the top layer is the drawer's portal.

### Also exported

- `drawerOverlayStyles`: the overlay, shadcn's `DrawerOverlay`, as a style object for `css()`.
- `getDrawerContext(handle, part)` returns the nearest root's `DrawerContext`: the direction, the snap points and `setSnapPoint()`.
- The gesture rules as pure functions: `resolveSnapPoints`, `findSnapPoint`, `snapPointMovement`, `decideSwipeRelease`, `swipeReleaseStrength`, `touchActionFor` and `keyboardInset`.
- The types `DrawerProps`, `DrawerContentProps`, `DrawerSnapPointButtonProps`, `DrawerContext`, `DrawerSwipeDirection`, `DrawerSnapPoint`, `DrawerSnapPointChangeReason`, `DrawerSnapPointChangeDetails`, `ResolvedSnapPoint`, `SnapPointMeasures`, `SwipeRelease` and `SwipeDecision`.

## Composition

- **Long content.** Put it in a scroll region between the header and the footer, with `flex: '1 1 auto'; minHeight: 0; overflowY: 'auto'`, as `DrawerScrollableContent` does, so both stay in view. Give it `tabIndex={0}`, a role and a name, so the keyboard can scroll it. Without one, the content column scrolls.
- **Snap points** with a list: let the list scroll on its own, as `DrawerSnapPoints` does, and put `DrawerSnapPointButton`s in the header.
- **Forms.** The drawer stays where you render it, so its fields submit with a form around it, as `DrawerWithForm` shows.
- **Responsive.** Render a Dialog on a wide screen and a Drawer on a narrow one from your client entry, as `DrawerResponsive` does with `matchMedia`. The server renders the Drawer, because it can't know the width.
- **Nested.** A Drawer inside `DrawerContent`, usually in the footer, as `DrawerNested` shows.
- Everything else in Dialog's Composition applies.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `Drawer` on Base UI's `Drawer.Root` | `Drawer`, on a `Dialog` | Renders no element |
| `open`, `defaultOpen`, `onOpenChange`, `onOpenChangeComplete` | Same | Through Dialog, with `swipe` among the reasons. Base UI's `close-watcher` is Dialog's `close-request`; `imperative-action` has no source here |
| `modal: true \| false`, `disablePointerDismissal` | Same | `'trap-focus'` isn't ported, as for Dialog |
| `swipeDirection` | Same | `down` by default |
| `snapPoints`, `snapPoint`, `defaultSnapPoint`, `onSnapPointChange` | Same | `details` has `reason`, `event`, `cancel()` and `isCanceled`. `onSnapPointChange` runs only for a change: Base UI also calls it when a drag settles where it was, and with `null` before a swipe closes it |
| `snapToSequentialPoints` | Same | |
| `showSwipeHandle` (shadcn) | Same | |
| `actionsRef`, `handle`, `Drawer.createHandle()`, detached triggers, `payload`, `triggerId`, `defaultTriggerId` | Not ported | As for Dialog: control `open` instead |
| `Drawer.Provider`, `Drawer.Indent`, `Drawer.IndentBackground` | Not ported | Base UI's optional effect that scales the page behind; shadcn doesn't use it |
| `Drawer.SwipeArea` | Not ported | Base UI's swipe to open from an edge; shadcn doesn't use it. Triggers open the drawer |
| `Drawer.VirtualKeyboardProvider` | Built in, smaller | `--drawer-keyboard-inset` lifts every drawer above a virtual keyboard. Base UI's provider also scrolls the focused field into view on iOS |
| `DrawerTrigger`, `DrawerClose` | Same, native buttons | `render` and `nativeButton` aren't ported, as for Dialog |
| `DrawerPortal` | `DrawerPortal`, which renders its children | The top layer is the portal |
| `DrawerOverlay`, `Drawer.Backdrop` | The native `::backdrop`, `drawerOverlayStyles` | shadcn's `bg-black/10` and `backdrop-blur-xs`, fading with `--drawer-swipe-progress` down to `--drawer-overlay-min-opacity`. Nested drawers draw none, as Base UI's default |
| `Drawer.Viewport` | Not needed | The dialog positions itself on its edge |
| `Drawer.Popup` | The `<dialog>` of `DrawerContent`, `data-slot="drawer-popup"` | |
| `Drawer.Content`, `data-slot="drawer-content"` | The content column | It scrolls instead of clipping, so text at 200% stays reachable. Mouse and pen drags on it select text, as in Base UI |
| `DrawerSwipeHandle` | Same | `aria-hidden`. The pill is a border instead of a background, for forced colors |
| `DrawerHeader`, `DrawerFooter`, `DrawerTitle`, `DrawerDescription` | Same | |
| `initialFocus`, `finalFocus` | Same | The drawer focuses itself by default, as Base UI's drawer does |
| Base UI's touch handling: `touchstart` and a non-passive document `touchmove` | Pointer Events, pointer capture and `touch-action` | The scroll-edge rule and the axis lock work the same. Where the browser can't tell pans apart by direction, a scroll region at its edge scrolls both ways |
| `data-base-ui-swipe-ignore` | `data-swipe-ignore` | With the same `x` and `y` values |
| Release thresholds, velocities, snap skipping, overshoot damping, release strength | `decideSwipeRelease`, `snapPointMovement`, `swipeReleaseStrength` | Base UI's constants: 10px, 0.5px/ms, 300ms per px/ms up to 4, square-root damping, 80 to 360ms |
| `useDrawerSnapPoints` | `resolveSnapPoints`, `findSnapPoint` | Measured from the viewport less a virtual keyboard |
| Popup and backdrop data attributes and CSS variables | Same names | Plus `data-resizing` and `--drawer-keyboard-inset`, without `data-starting-style` and `data-ending-style` |
| `--nested-drawers`, `--drawer-frontmost-height`, the stack classes | Same | `--nested-drawers` is the depth of the open stack in front; Base UI counts every open nested drawer. A drawer behind drops its snap offset, which Base UI keeps, and the frontmost height is what the frontmost drawer shows at its snap point, not its whole height. So the stack peeks 1rem whichever of them has snap points |
| `data-starting-style`, `data-ending-style` | `@starting-style` and transitions with `transition-behavior: allow-discrete` | |
| `cn-drawer-*` classes in `style-vega.css` and the drawer's Tailwind classes | One `css()` rule per direction, and one per part | `rounded-t-xl border-t` and the rest map one to one. 450ms becomes twice `--duration-normal` |
| Docs: Demo, example: Demo | `DrawerDemo` | |
| Docs: Position, example: Position | `DrawerSides` | |
| Docs: Swipe Handle | `DrawerWithSwipeHandle` | |
| Docs: Custom Sizes, example: Custom Width and Height | `DrawerCustomSize` | |
| Example: Scrollable Content | `DrawerScrollableContent` | |
| Docs and example: Snap Points | `DrawerSnapPoints` | With buttons for the keyboard, and a 20rem peek instead of 31rem, so it peeks on a short screen too |
| Docs and example: Nested | `DrawerNested` | |
| Docs and example: Non Modal | `DrawerNonModal` | |
| Docs: Responsive (`drawer-dialog`) | `DrawerResponsive` | |
| Docs: Migrating from Vaul | Not needed | There is no earlier RemixCN drawer |
| — | `DrawerWithForm`, `DrawerControlled`, `DrawerStartsOpen` | A form, a controlled drawer with its snap point, and one that starts open |

### Where it looks different from shadcn

- **The content column scrolls** when it's taller than the drawer, instead of clipping.
- **Content stays in the part that shows** at a snap point, instead of running off the screen below it.
- **The swipe handle's pill is a border**, so it stays in forced colors.
- **Motion** uses the theme's tokens, 400ms, and stops for reduced motion.

## Accessibility checks

Automated, in Chromium, Firefox and WebKit (`bun run test`, `test:browser`, `test:e2e`), besides Dialog's:

- The server renders a closed dialog on its edge, named and described by its header, with triggers and close buttons that carry invoker commands, and disabled snap point buttons. Each instance has its own ids. Without JavaScript, the drawer opens modally on its edge, closes from its buttons and Escape, and submits its form; a drawer that starts open reads without a script and becomes modal once hydrated.
- Mouse, touch and pen drags follow the rules above, on all four edges: a short drag slides back, a long one or a fast flick closes, mouse and pen leave the content to text selection, a touch drag never presses the control it started on, and a canceled pointer or a lost capture slides back. Real touch input in Chromium scrolls a region until its top, then closes the drawer from there.
- Snap points open at their default, keep the last item reachable at the peek, settle where a drag ends, skip on a flick or not with `snapToSequentialPoints`, follow their buttons with the keyboard, stay put through a resize, also under a dragging pointer, and give a list that overflows only at the peek its touch scrolling back, also after the snap's transition. Nested drawers stack with the edge behind in view, whichever of them has snap points, also after the front one moves to another, or a text zoom changes what its snap point shows. Controlled drawers that keep their state, changed props, canceled changes, nested drawers, several instances and unmounting in the middle of a drag, which lets go of its listeners, frames and `touch-action`.
- axe-core finds no WCAG 2.2 A or AA violation with a drawer open, in both themes. The focus ring, the drawer's edge and the swipe handle show, also in forced colors. Transitions stop for reduced motion. A right drawer stays right in right-to-left text. Drawers fit 320px without scrolling sideways, with normal text and at 200%.

Not checked, so not claimed:

- Screen readers (NVDA, JAWS, VoiceOver, TalkBack) weren't tested.
- Real touch screens weren't tested: Chromium's touch input runs through its DevTools protocol, and Firefox and WebKit get synthetic pointer events only. Safari on iOS, its virtual keyboard and its overscroll, and Android's virtual keyboard weren't run.
- Forced colors were emulated in Chromium and Firefox, not tested in Windows.
- This isn't an accessibility certification.
