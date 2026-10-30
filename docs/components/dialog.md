# Dialog

A window over the page, modal or not, built on the native `<dialog>` element. Alert Dialog and Sheet build on it.

- Source: `registry/ui/dialog.tsx`. Needs `registry/lib/theme.css`, `styles.ts`, `icons.tsx`, `layer.ts`, `focus-scope.ts`, `modal.ts` and `registry/ui/button.tsx`.
- Examples: `registry/examples/dialog-example.tsx`. Run them with `bun run dialog-examples`.
- Upstream: shadcn/ui [`dialog.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/dialog.tsx), its [docs](https://ui.shadcn.com/docs/components/base/dialog), and [Base UI Dialog](https://base-ui.com/react/components/dialog.md).

## Usage

```tsx
import { buttonVariants } from '#remixcn/ui/button.tsx'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#remixcn/ui/dialog.tsx'

<Dialog>
  <DialogTrigger mix={buttonVariants({ variant: 'outline' })}>Edit customer</DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Edit customer</DialogTitle>
      <DialogDescription>Change the billing contact of Acme Labs.</DialogDescription>
    </DialogHeader>
    …
    <DialogFooter>
      <DialogClose mix={buttonVariants({ variant: 'outline' })}>Cancel</DialogClose>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## How it runs

- **A native dialog.** `DialogContent` renders a `<dialog>`. A modal dialog opens with `showModal()`, which puts it in the browser's top layer, above every stacking context, makes the rest of the page inert, and draws its `::backdrop`, the overlay. So it needs no portal and no focus guards. The shared helpers add what the element lacks: Escape and outside presses for the topmost layer only (`layer.ts`), initial focus, return focus with a fallback and a Tab trap (`focus-scope.ts`), and the scroll lock (`modal.ts`).
- **On the server.** A closed dialog renders as a closed `<dialog>`: it takes no space, no tab stop and no place in the accessibility tree. Its trigger and close buttons carry invoker commands, `commandfor` with `command="show-modal"` or `command="close"`. In browsers with invoker commands (Chrome and Edge 135, Firefox 144, Safari 26.2 and later), the dialog opens modally, closes from its buttons and Escape, and submits its form before any script runs, also on a page that renders it outside any client entry. In older browsers the trigger does nothing until the script runs, and the content stays hidden.
- **Starts open.** A dialog with `defaultOpen` or `open` renders the `open` attribute on the server, so it reads without a script, as a dialog that isn't modal. Once it runs in the browser it becomes modal.
- **In the browser.** The parts run inside your client entry, as the examples do. They aren't client entries themselves: Remix serializes an entry's props to JSON, which drops your handlers and mixins, and renders an entry's component children to static HTML, which would freeze the dialog's content. Once running, the root owns the open state: the triggers and close buttons cancel their native commands and ask the root instead, so `onOpenChange` sees every change.

## API

### `Dialog`

Holds the open state and renders no element.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `open` | `boolean` | | The open state, for a dialog you control. Render the new value from `onOpenChange` |
| `defaultOpen` | `boolean` | `false` | The first open state, for a dialog that keeps its own |
| `onOpenChange` | `(open, details) => void` | | Called before the dialog opens or closes. `details.cancel()` keeps the current state |
| `onOpenChangeComplete` | `(open) => void` | | Called once the opening or closing transitions finished |
| `modal` | `boolean` | `true` | Whether the page is inert behind the dialog, with Tab kept inside and scrolling stopped. A dialog that isn't modal also closes when focus leaves it |
| `disablePointerDismissal` | `boolean` | `false` | Keeps it open on presses outside, and, when it isn't modal, when focus leaves it |
| `role` | `'dialog' \| 'alertdialog'` | `'dialog'` | Alert Dialog sets `alertdialog` |

`details` holds `reason`, the `event` and the `trigger` that opened the dialog. The reasons are Base UI's `trigger-press`, `close-press`, `outside-press`, `escape-key` and `focus-out`, plus `close-request` (a close request that isn't Escape, such as the Android back gesture), `parent-dismissed` (the dialog around it closed), `action-press` (an `AlertDialogAction`), `swipe` (a Drawer swiped closed) and `none` (the page closed the native dialog itself, such as a form with `method="dialog"`).

### `DialogTrigger`

A native `<button type="button">` that opens the dialog, as many as you need inside the root. It renders unstyled, like Base UI's trigger; give it a look with `mix={buttonVariants({ variant: 'outline' })}`. It renders `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`, `data-popup-open` while open and `data-disabled`. A trigger of a dialog that isn't modal toggles it. `preventDefault()` in your click handler cancels the opening.

### `DialogContent`

The dialog: a native `<dialog>` in the middle of the screen. It takes every prop of `<dialog>` except `open`, `id` and `role`, which the root owns, and:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `showCloseButton` | `boolean` | `true` | Shows a ghost close button in the corner, named "Close" |
| `initialFocus` | `HTMLElement \| (() => HTMLElement \| null) \| false` | first `[autofocus]` or tabbable element | What to focus on open. A dialog opened by touch focuses itself, so no virtual keyboard opens |
| `finalFocus` | the same | the trigger that opened it, else its first trigger, else a neighbor | What to focus on close |

It renders `data-slot="dialog-content"`, `data-open` or `data-closed`, `data-nested` inside another dialog, and `aria-labelledby` and `aria-describedby` for its title and description. `aria-label` or your own `aria-labelledby` replaces the title.

### `DialogClose`

A native `<button type="button">` that closes the dialog. Unstyled, like the trigger.

### `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`

A column for the title and description; the actions, in a column on a narrow screen and a row at the end from 40rem; an `<h2>` that names the dialog; and a `<p>` that describes it. `DialogFooter` takes `showCloseButton` for an outline Close button after its actions. The title and description take their ids from the root.

### `DialogPopup`

The unstyled `<dialog>` that `DialogContent`, `AlertDialogContent` and `SheetContent` style, with the same props as `DialogContent` except `showCloseButton`. Use it for a surface of your own.

### Also exported

- `dialogOverlayStyles`, `dialogSurfaceStyles` and `centeredDialogStyles`: style objects for `css()`, from the backdrop alone to the whole centered surface. `descriptionLinkStyles` underlines the links in a description.
- `getDialogContext(handle, part)` returns the nearest root's `DialogContext`: the open state, ids, trigger and `setOpen()`. Parts you build on Dialog read it.
- The types `DialogProps`, `DialogTriggerProps`, `DialogCloseProps`, `DialogPopupProps`, `DialogContentProps`, `DialogFooterProps`, `DialogContext`, `DialogChangeReason`, `DialogChangeDetails` and `DialogChangeRequest`.

## Composition

- **Triggers and close buttons** are native buttons. Style them with `buttonVariants()`. A `Button` with your own `on('click')` works too, for actions that aren't open or close.
- **Forms.** The dialog stays where you render it in the document, so its fields belong to a form around it and a submit button sends them, also without a script. A form inside with `method="dialog"` closes it natively, with the reason `none`.
- **Controlled.** Pass `open` and render the new value from `onOpenChange`. When you keep the old value, the dialog stays as it was, also after a native close.
- **Several triggers** sit inside one root. Focus returns to the one that opened the dialog.
- **Nested.** A Dialog inside `DialogContent` opens above it. Escape and outside presses close the inner one first, closing the outer one closes the inner one, and the inner one draws no second backdrop.
- **Popovers and menus** built on `layer.ts` inside the dialog close first on Escape, and focus in them counts as inside.
- **Long content.** Put it in a scroll region of its own, such as `maxHeight: '50vh'; overflowY: 'auto'`, so the title and footer stay in view. Give the region `tabIndex={0}`, a role and a name, so the keyboard can scroll it. Without one, the whole dialog scrolls once it reaches the screen's height.
- **Overrides.** A `css()` you pass with `mix` renders after the dialog's own rule, so it wins, for example `mix={css({ '@media (min-width: 40rem)': { maxWidth: '40rem' } })}`. Change the overlay with `'&::backdrop'` in that rule.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `Dialog` on Base UI's `Dialog.Root` | `Dialog` | Renders no element |
| `open`, `defaultOpen`, `onOpenChange(open, eventDetails)` | Same | `details` has `reason`, `event`, `trigger`, `cancel()` and `isCanceled`. `allowPropagation` and `preventUnmountOnClose` aren't needed: the dialog stops no events and never unmounts its content |
| `onOpenChangeComplete` | Same | After the transitions of the native dialog and its backdrop |
| `modal: true \| false` | Same | `showModal()` or `show()`. Changing it while open switches the native dialog and its focus trap, and keeps focus where it was |
| `modal: 'trap-focus'` | Not ported | A native modal dialog can't trap focus without making the page inert. Use `true` or `false` |
| `disablePointerDismissal` | Same | Also keeps a dialog that isn't modal open when focus leaves it, as in Base UI |
| `actionsRef` (`close`, `unmount`) | Not ported | Control `open` instead. The content stays mounted, so there's nothing to unmount |
| `handle`, `Dialog.createHandle()`, detached triggers, `payload`, function children | Not ported | Triggers sit inside the root. For a dialog opened from elsewhere, control `open` from your own state, which can also hold what the payload held |
| `triggerId`, `defaultTriggerId` | Not needed | Focus returns to the trigger that opened the dialog, without ids |
| `Dialog.Trigger` | `DialogTrigger`, a native button | `aria-haspopup="dialog"`, `aria-expanded`, `data-popup-open`, `data-disabled` |
| `render`, `nativeButton` | Not ported | Style the native button with `buttonVariants()`, as for Button |
| `Dialog.Portal`, `DialogPortal` | The top layer | A modal dialog paints above everything wherever it sits. `container` isn't needed, and the closed content stays in the document as a closed `<dialog>`, which replaces `keepMounted`. A dialog that isn't modal stays in the page with `z-index: 50`, so an ancestor with a transform or a filter can clip it |
| `Dialog.Backdrop`, `DialogOverlay` | The native `::backdrop`, drawn by `dialogOverlayStyles` | shadcn's `bg-black/10` and `backdrop-blur-xs`, with the same fade. Restyle it with `'&::backdrop'` |
| `forceRender` on the backdrop | Not ported | Nested dialogs draw a transparent backdrop, as Base UI's default. Style `'&[data-nested]::backdrop'` to draw one |
| `Dialog.Popup` | `DialogPopup`, styled by `DialogContent` | |
| `initialFocus`, `finalFocus` | Same, as an element, a function or `false` | Base UI passes the interaction type to the function. RemixCN handles its touch case itself: a dialog opened by touch focuses itself |
| `data-open`, `data-closed`, `data-nested` | Same | |
| `data-nested-dialog-open`, `--nested-dialogs` | Not set | Style a dialog with an open nested dialog with `:has(dialog[data-nested][open])` |
| `data-starting-style`, `data-ending-style` | `@starting-style` and transitions with `transition-behavior: allow-discrete` | So the attributes aren't needed. Firefox can't keep a closing dialog in the top layer during its fade-out, which takes 100ms |
| `Dialog.Viewport` | Not ported | The dialog scrolls itself once it reaches the screen's height |
| `Dialog.Title`, `Dialog.Description` | `DialogTitle` (`<h2>`), `DialogDescription` (`<p>`) | The dialog points to them with `aria-labelledby` and `aria-describedby` |
| `Dialog.Close` | `DialogClose`, a native button | |
| `DialogContent` `showCloseButton` | Same | The ghost `icon-sm` button with the hidden text "Close" |
| `DialogFooter` `showCloseButton` | Same | An outline Close button |
| `cn-dialog-*` classes in `style-vega.css` | The same measures in one `css()` rule per part | Tailwind classes become theme tokens, such as `p-6` to `calc(var(--spacing) * 6)`. `right-4` becomes `inset-inline-end`, so the close button mirrors in right-to-left text |
| Docs: Demo, With Form | `DialogWithForm` | |
| Docs: Scrollable Content | `DialogScrollableContent` | |
| Docs: Sticky Footer | `DialogWithStickyFooter` | |
| Docs: No Close Button | `DialogNoCloseButton` | |
| Docs: Custom Close Button | `DialogCustomCloseButton` | |
| Docs: RTL | The fixture's Direction section | |
| Example file: Chat Settings | Not ported yet | It needs Tabs, Select, Native Select, Switch, Field, Textarea, Input Group, Kbd and Tooltip, which come with their own tickets |
| — | `DialogWithChoices`, `DialogNonModal`, `DialogControlled`, `DialogStartsOpen` | A dialog that opens on a native radio group, one that isn't modal, a controlled one with two triggers, and one that starts open |

### Where it looks different from shadcn

- **The edge is a border**, not a ring drawn with a box shadow, so it stays in forced colors.
- **Long content scrolls inside the dialog** once it reaches the screen's height, so text at 200% never runs off the screen. shadcn's centered dialog grows past it.
- **The header leaves room for the close button**, so a long title wraps before it instead of running under it.
- **The footer's row wraps** from 40rem when its buttons don't fit.
- **Motion** uses the theme's tokens, 100ms, and stops for reduced motion.

## Accessibility checks

Automated, in Chromium, Firefox and WebKit (`bun run test`, `test:browser`, `test:e2e`):

- The server renders a closed dialog, out of the tab order, with its name and description, and triggers and close buttons with invoker commands. Each instance has its own ids.
- Without JavaScript, and on a page that renders it outside any client entry, the dialog opens modally, closes from its buttons and Escape, and submits its form. A dialog that starts open reads without a script and becomes modal once hydrated.
- A modal dialog makes the page inert, stops scrolling, and keeps Tab and Shift+Tab inside, wrapping at both ends, also when a native radio group comes first. Changing `modal` while open turns the trap and the scroll lock on or off and keeps focus in place. Focus starts on the first field, or on the dialog after a touch, and returns to the trigger that opened it, or to a neighbor when that trigger was removed or disabled.
- Escape, close buttons and presses on the backdrop close it; presses inside don't; `disablePointerDismissal` keeps it open on presses. A dialog that isn't modal leaves the page usable and closes when focus leaves it.
- Controlled dialogs, canceled changes, several triggers, nested dialogs and popovers, rapid opening and closing, unmounting while open, native closes, changing content, and `onOpenChangeComplete`.
- axe-core finds no WCAG 2.2 A or AA violation with the dialog open, in both themes.
- The focus ring and the dialog's edge show, also in forced colors. Transitions stop for reduced motion. The close button mirrors in right-to-left text.
- The dialog fits 320px without scrolling sideways, with normal text and at 200%.

Not checked, so not claimed:

- Screen readers (NVDA, JAWS, VoiceOver, TalkBack) weren't tested.
- Safari itself wasn't run, only Playwright's WebKit in CI. Forced colors were emulated in Chromium and Firefox, not tested in Windows.
- Browsers without invoker commands weren't run, so their no-script behavior, a trigger that does nothing, is inferred from the HTML standard.
- This isn't an accessibility certification.
