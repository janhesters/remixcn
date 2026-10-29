# Button Group

Joins related buttons, inputs and text into one control, in a row or a column.

- Source: `registry/ui/button-group.tsx`. Needs `registry/lib/theme.css` and `registry/lib/styles.ts`.
- Examples: `registry/examples/button-group-example.tsx`. Run them with `bun run button-examples`.
- Upstream: shadcn/ui [`button-group.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/button-group.tsx) and its [docs](https://ui.shadcn.com/docs/components/base/button-group).

## Usage

```tsx
import { Button } from '#remixcn/ui/button.tsx'
import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from '#remixcn/ui/button-group.tsx'

<ButtonGroup aria-label="Invoice actions">
  <Button variant="outline">Archive</Button>
  <Button variant="outline">Report</Button>
</ButtonGroup>
```

Use Button Group for buttons that act. Use Toggle Group, a later batch, for buttons that switch a state.

## API

### `ButtonGroup`

A `<div role="group">` that takes every native `<div>` prop, `mix`, and:

| Prop | Type | Default |
| --- | --- | --- |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` |

It renders `data-slot="button-group"` and `data-orientation`. It adds no tab stop and no form: Tab moves from part to part, and each part keeps its own form owner. Name it with `aria-label` or `aria-labelledby`. A row wraps when it can't fit, so a narrow screen or large text never scrolls sideways. Groups inside a group sit apart.

### `ButtonGroupSeparator`

A `<div role="separator">` with `aria-orientation`. `orientation` is `'vertical'` by default, to divide a row; use `'horizontal'` in a column. It draws a border, so it stays visible in forced colors.

### `ButtonGroupText`

A `<div>` for text that belongs to the group, such as a unit or a count.

### `buttonGroupVariants(options?)` and `buttonGroupTextVariants()`

Return the mixins that give another element the group or group text look and its data attributes, such as a `<nav>` of page links or a native `<label>` for a grouped input. Add a role or a label yourself where the element needs one.

### `buttonGroupItem`, in `styles.ts`

The style object that joins a control to its neighbors. Merge it into a control's own `css()`. Button and the group text already do; a native input, or a later Input or Select, merges it to join and grow too.

## Composition

```text
ButtonGroup
├── Button, a native input, or an element with buttonVariants()
├── ButtonGroupSeparator
├── ButtonGroupText, or a label with buttonGroupTextVariants()
└── ButtonGroup, nested
```

- **Joining.** Only parts with a `data-slot` attribute count as neighbors. So a hidden input, which has none, submits its value without breaking the joins.
- **Inputs.** Give a native input `data-slot="input"` and merge `buttonGroupItem` into its styles. It then joins its neighbors and grows into the room the group has.
- **Labels.** `<label for="amount" mix={buttonGroupTextVariants()}>` keeps naming its field.
- **Separators.** Outline buttons have their own borders. Add a separator between secondary or ghost buttons, as in a split button.
- **Links.** A `<nav mix={buttonGroupVariants()}>` with `buttonVariants()` links joins them and keeps them native links.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `ButtonGroup` | `ButtonGroup` | Same role, data attributes and default orientation |
| `buttonGroupVariants` (cva) | `buttonGroupVariants()`, returning mixins | Also sets the data attributes the parts join on |
| `ButtonGroupText` with `render` | `ButtonGroupText`, and `buttonGroupTextVariants()` for another element | Base UI's `useRender` has no Remix equivalent; a mixin on the native element replaces it |
| `ButtonGroupSeparator` on shadcn's `Separator` | `ButtonGroupSeparator`, its own native separator | Base UI's Separator renders the same `role` and `aria-orientation`. So Button Group doesn't wait for the Separator entry, and the catalog no longer lists it as a dependency |
| `bg-input` separator line | A border in `--input` | A background disappears in forced colors |
| The group styles its children: `*:data-slot:rounded-r-none`, `[&>[data-slot]~[data-slot]]:rounded-l-none border-l-0`, the vega last-child corners | `buttonGroupItem`, merged into each part's own rule | Remix orders `css()` rules by first render, so a parent rule could lose to its child's. Logical corners and borders mirror in right-to-left text |
| `*:focus-visible:relative *:focus-visible:z-10` | Same, in `buttonGroupItem` | |
| `[&>input]:flex-1` | `flex: 1 1 auto` with `min-width: 0`, in `buttonGroupItem` | Grows from the input's own width, so a group never squeezes it to nothing |
| `has-[>[data-slot=button-group]]:gap-2` | Same | |
| `[&>[data-slot=select-trigger]]:w-fit`, the hidden-select corner rule | Left to Select | Select's trigger sets its own width when it's ported. A hidden select has no `data-slot`, so it already doesn't count as a neighbor |
| No wrapping | Rows wrap when they can't fit | For 320px reflow. A wrapped row keeps its corners as one row |
| Examples: Basic, With Input, With Text, With Icons, Nested, Pagination, Pagination Split, Navigation, Text Alignment, Vertical, Vertical Nested, Orientation, Size, Separator, Split | `ButtonGroupBasic`, `ButtonGroupWithInput`, `ButtonGroupWithText`, `ButtonGroupWithIcons`, `ButtonGroupNested`, `ButtonGroupPagination`, `ButtonGroupLabelled`, `ButtonGroupVertical`, `ButtonGroupSizes`, `ButtonGroupSplit` | Pagination uses native links. Nested and Pagination cover Pagination Split and Navigation, which nest groups of arrow buttons. Labelled replaces Text Alignment, whose buttons would be toggles |
| Example: With Like | `ButtonGroupWithCount` | The count is group text, not a span that looks like a button |
| Examples: With Dropdown, With Select, With Select and Input, With Input Group, With Fields, Popover | Not here yet | They need Dropdown Menu (#16), Select (#17), Input Group (#11), Field (#8) and Popover (#15). The examples use native inputs and labels meanwhile |
| — | `ButtonGroupStepper` | A client entry with its own state, a hidden input, and buttons that keep focus at their limits |

## Accessibility checks

Automated, in Chromium, Firefox and WebKit (`bun run test`, `test:browser`, `test:e2e`):

- The group has no tab stop; Tab moves Archive, Report, Snooze.
- Each part keeps its form owner, also with a `form` attribute; a grouped input and hidden inputs submit with their form.
- Two steppers keep their own state; a button at its limit keeps focus.
- Rows and columns join with one shared border and round outer corners; text, inputs and separators join as parts; nested groups sit apart; joins mirror in right-to-left text.
- A focused part draws its ring above its neighbors; the separator stays visible in forced colors.
- The page fits 320px without scrolling sideways, with normal text and at 200%.

Not checked, so not claimed:

- Screen readers weren't tested, such as how each reads a named group.
- Safari itself wasn't run, only Playwright's WebKit in CI. Forced colors were emulated in Chromium and Firefox.
- A wrapped row keeps the corners of one row, so its parts look less joined. Nothing is cut off.
- This isn't an accessibility certification.
