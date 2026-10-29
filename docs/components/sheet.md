# Sheet

A Dialog that slides in from an edge of the screen, for content that complements the page, such as filters or details. It builds on Dialog, so `dialog.md` describes how it runs, its focus and its dismissal.

- Source: `registry/ui/sheet.tsx`. Needs `registry/ui/dialog.tsx`, `registry/ui/button.tsx`, `registry/lib/icons.tsx`, `styles.ts` and `theme.css`.
- Examples: `registry/examples/sheet-example.tsx`. Run them with `bun run dialog-examples`.
- Upstream: shadcn/ui [`sheet.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/sheet.tsx), its [docs](https://ui.shadcn.com/docs/components/base/sheet), and [Base UI Dialog](https://base-ui.com/react/components/dialog.md).

## Usage

```tsx
import { buttonVariants } from '#remixcn/ui/button.tsx'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '#remixcn/ui/sheet.tsx'

<Sheet>
  <SheetTrigger mix={buttonVariants({ variant: 'outline' })}>Filters</SheetTrigger>
  <SheetContent side="left">
    <SheetHeader>
      <SheetTitle>Filter invoices</SheetTitle>
      <SheetDescription>Show only the invoices you need.</SheetDescription>
    </SheetHeader>
    …
    <SheetFooter>
      <SheetClose mix={buttonVariants({ variant: 'outline' })}>Done</SheetClose>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

## API

### `Sheet`, `SheetTrigger`, `SheetClose`

`Dialog`, `DialogTrigger` and `DialogClose`, with the `sheet-trigger` and `sheet-close` slots. A sheet can be modal or not, controlled or not, and nested, exactly as a dialog.

### `SheetContent`

The sheet along one edge of the screen. Takes the props of `DialogPopup`, and:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `side` | `'top' \| 'right' \| 'bottom' \| 'left'` | `'right'` | The edge it slides in from. Physical, so `right` stays right in right-to-left text |
| `showCloseButton` | `boolean` | `true` | Shows a ghost close button in the top corner, named "Close" |

Side sheets take 75% of the width, at most 24rem from 40rem, and the whole height. Top and bottom sheets take the whole width and the height of their content, at most the screen's. It renders `data-side`.

### `SheetHeader`, `SheetFooter`, `SheetTitle`, `SheetDescription`

A padded column for the title and description, a padded column of actions pushed to the bottom, an `<h2>` that names the sheet, and a `<p>` that describes it.

`SheetSide`, `SheetProps` and `SheetContentProps` are the types.

## Composition

- **Long content.** Put it in a scroll region between the header and the footer, with `flex: '1 1 auto'; minHeight: 0; overflowY: 'auto'`, as `SheetSides` does, so both stay in view. Without one, the whole sheet scrolls, and the close button sticks to its corner. The accessible name stays the title either way.
- **Forms.** The sheet stays where you render it, so its fields submit with a form around it, as `SheetWithForm` shows.
- Everything else in Dialog's Composition applies.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `Sheet` on Base UI's `Dialog.Root` | `Sheet`, a `Dialog` | |
| `SheetTrigger`, `SheetClose` | Same | Native buttons, as for Dialog |
| `SheetPortal`, `SheetOverlay` | The top layer and the native `::backdrop` | As for Dialog. shadcn doesn't export them for Sheet either |
| `SheetContent` with `side` and `showCloseButton` | Same | |
| `cn-sheet-content` side classes | One `css()` rule per side | `inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm` and the rest map one to one |
| `data-starting-style` and `data-ending-style` with `translate-x-[2.5rem]` and opacity 0 | `@starting-style` and transitions with `translate` and `opacity` | 200ms with `--ease-in-out`, off for reduced motion. The overlay fades with the panel |
| `cn-sheet-close`: `absolute top-4 right-4` | A sticky close button in the top corner, at the inline end | It stays in view when the whole sheet scrolls, on the panel's background. It comes last in the tab order, as upstream |
| `SheetHeader`, `SheetFooter`, `SheetTitle`, `SheetDescription` | Same | |
| Docs and example file: Demo, With Form | `SheetWithForm` | |
| Docs: Side, example: Sides | `SheetSides` | With long content in a scroll region, and top and bottom sheets at most half the screen, as upstream |
| Docs: No Close Button | `SheetNoCloseButton` | Upstream's text names a button below that it doesn't render; RemixCN's has one |
| Docs: RTL | The fixture's Direction section | |
| — | `SheetLongContent` | Content without a scroll region of its own |

### Where it looks different from shadcn

- **The close button sticks to its corner** when the whole sheet scrolls, instead of scrolling away.
- **The header leaves room for the close button**, so a long title wraps before it.
- **A side sheet keeps its 75% width on a narrow screen** and never grows past the screen.

## Accessibility checks

Automated, in Chromium, Firefox and WebKit, besides Dialog's:

- On each edge, at 1280px and at 320px, the sheet opens modally inside the screen, with its title and close button in view and its name from the title.
- With content longer than the screen, the close button stays inside the visible sheet, isn't covered, and closes it.
- axe-core finds no violation with a sheet open, in both themes. It fits 320px, also with text at 200%.

Not checked: screen readers, Safari itself, and Windows forced colors, as for Dialog. This isn't an accessibility certification.
