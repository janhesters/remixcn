# Alert Dialog

A modal dialog that interrupts with something important and waits for an answer. It builds on Dialog, so `dialog.md` describes how it runs, its focus and its dismissal.

- Source: `registry/ui/alert-dialog.tsx`. Needs `registry/ui/dialog.tsx`, `registry/ui/button.tsx`, `registry/lib/focus-scope.ts`, `styles.ts` and `theme.css`.
- Examples: `registry/examples/alert-dialog-example.tsx`. Run them with `bun run dialog-examples`.
- Upstream: shadcn/ui [`alert-dialog.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/alert-dialog.tsx), its [docs](https://ui.shadcn.com/docs/components/base/alert-dialog), and [Base UI Alert Dialog](https://base-ui.com/react/components/alert-dialog.md).

## Usage

```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '#remixcn/ui/alert-dialog.tsx'
import { buttonVariants } from '#remixcn/ui/button.tsx'

<AlertDialog>
  <AlertDialogTrigger mix={buttonVariants({ variant: 'destructive' })}>Delete invoice</AlertDialogTrigger>
  <AlertDialogContent size="sm">
    <AlertDialogHeader>
      <AlertDialogTitle>Delete INV-0042?</AlertDialogTitle>
      <AlertDialogDescription>The invoice and its reminders go away for good.</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction variant="destructive" mix={on('click', deleteInvoice)}>
        Delete
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

## How it answers

- It's always modal, with the `alertdialog` role, a name from its title and a description from its description.
- **Cancel** closes it with the reason `close-press`. It carries the native close command, so it works before any script runs. **Escape** cancels too, with `escape-key`.
- **The action** confirms: your click handlers run first, then it closes with `action-press`. It carries no native command, so it never confirms without your code, unless you make it a submit button of a real form, which then posts to your server. Call `preventDefault()` in your handler to keep the dialog open while the confirmation runs, and close it from your owner.
- **No press outside closes it** by default. `disablePointerDismissal={false}` allows it.
- **Focus starts on the cancel button**, the answer that changes nothing, also when a link in the description comes first.
- **A held key doesn't confirm.** Enter or Space that is still repeating from a press before the action had focus, such as the Enter that opened the dialog, doesn't press the action.
- **Enter in a field doesn't confirm.** In a form, Enter in a field submits the form through its default button, its first submit button, as if the user pressed it. So a submit action renders a hidden, disabled submit button right before itself, which becomes the default button. The HTML standard has a disabled default button submit nothing, so this holds in the server's HTML too, before any script runs and without one. The user presses the action itself to confirm. `AlertDialogWithForm` shows it.
- It has no corner close button: the user answers with one of its buttons.

## API

### `AlertDialog`

Takes the props of `Dialog` except `modal` and `role`: `open`, `defaultOpen`, `onOpenChange`, `onOpenChangeComplete`, and `disablePointerDismissal`, which defaults to `true` here.

### `AlertDialogTrigger`

`DialogTrigger` with `data-slot="alert-dialog-trigger"`: an unstyled native button.

### `AlertDialogContent`

The alert dialog in the middle of the screen. Takes the props of `DialogPopup` and `size`:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `size` | `'default' \| 'sm'` | `'default'` | `sm` stays 20rem wide and puts the two answers side by side. `default` grows to 32rem from 40rem, where its text and media align to the start |
| `initialFocus` | as on `DialogContent` | `AlertDialogCancel`, else the first tabbable element | |

### `AlertDialogAction` and `AlertDialogCancel`

Buttons with all of `Button`'s props. The cancel button is `outline` by default and always `type="button"`. The action is `default` and `type="button"` by default; make it `type="submit"` in a form to post the answer. A submit action renders its hidden Enter guard right before itself, with the same `form` attribute.

### `AlertDialogHeader`, `AlertDialogMedia`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`

The header is a centered grid that aligns to the start in a wide default alert dialog. `AlertDialogMedia` holds an icon or an image above the title, or beside the text in a wide default alert dialog. The title is an `<h2>` in `text-lg`, the description a balanced `<p>`. The footer is a column on a narrow screen, a row at the end from 40rem, and two equal columns in a small alert dialog.

`AlertDialogSize`, `AlertDialogProps` and `AlertDialogContentProps` are the types.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `AlertDialog` on Base UI's `AlertDialog.Root` | `AlertDialog`, a modal `Dialog` with `role="alertdialog"` | Same props as Dialog's root, without `modal` |
| Base UI: no dismissal by outside presses | `disablePointerDismissal` defaults to `true` | It can be turned off, since the brief keeps outside presses off by default |
| `AlertDialogTrigger` | Same | As `DialogTrigger` |
| `AlertDialogPortal`, `AlertDialogOverlay` | The top layer and the native `::backdrop` | As for Dialog |
| `AlertDialogContent` with `size` | Same | `data-size` on the dialog |
| `AlertDialogHeader`, `AlertDialogFooter`, `AlertDialogMedia`, `AlertDialogTitle`, `AlertDialogDescription` | Same | |
| `AlertDialogCancel` on `AlertDialog.Close` with `render={<Button />}` | `AlertDialogCancel`, a `Button` with the native close command | |
| `AlertDialogAction`, a plain `Button` | `AlertDialogAction`, a `Button` that closes after your handlers | shadcn's base action doesn't close the dialog; Radix's action does. RemixCN closes, unless your handler calls `preventDefault()`, and reports `action-press`, so the owner tells confirm from cancel |
| — | A held key doesn't press the action | So the Enter that opened the dialog can't confirm it |
| — | Enter in a field doesn't submit through the action | A hidden, disabled submit button with `data-slot="alert-dialog-enter-guard"` comes first in the form, so the browser's implicit submission presses nothing. A submit button of your own before the action stays the default button |
| `group/alert-dialog-content` and `has-data-[slot=alert-dialog-media]` classes | Each part's own rule reacts to `[data-slot="alert-dialog-content"][data-size]` on its ancestor, and the header to `:has([data-slot="alert-dialog-media"])` | AGENTS.md "Layers and overrides" |
| `text-left` | `text-align: start` | So right-to-left text aligns to the right |
| Docs and example file: Basic, Small, With Media, Small with Media, Destructive, In Dialog | `AlertDialogBasic`, `AlertDialogSmall`, `AlertDialogWithMedia`, `AlertDialogSmallWithMedia`, `AlertDialogDestructive`, `AlertDialogInDialog` | The destructive example says in a status whether the invoice was deleted or kept |
| — | `AlertDialogWithForm` | An action that posts a form with a field |
| Docs: RTL | The fixture's Direction section | |

### Where it looks different from shadcn

- **It keeps a 1rem margin on a 320px screen.** shadcn's `max-w-xs` is 20rem, the whole width of that screen.
- **The destructive media's red** mixes in a quarter of the text color, as the destructive Button does, so the icon stays visible on its tint.
- The edge, motion and long content follow Dialog: see `dialog.md`.

## Accessibility checks

Automated, in Chromium, Firefox and WebKit, besides Dialog's:

- The server renders the `alertdialog` role, its name and description, a cancel button with the native close command and an action without one.
- Focus starts on the cancel button, also when a link comes first in the description.
- Only the action confirms. Cancel, Escape and closing never do, and neither does a held Enter that opened the dialog nor Enter in a field of the action's form, with a real keyboard, also without JavaScript. Pressing the action posts the form.
- Presses outside don't close it unless allowed. A confirmation that called `preventDefault()` keeps it open until its owner closes it.
- Escape closes only the alert dialog when it opened from a dialog, and focus returns to its trigger.
- The media sits beside the text in a wide default alert dialog and above it in a small one.
- axe-core finds no violation with the alert dialog open, in both themes. It fits 320px, also with text at 200%.

Not checked: screen readers, Safari itself, and Windows forced colors, as for Dialog. This isn't an accessibility certification.
