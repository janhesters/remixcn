# Input Group

One box around a native input or textarea and the icons, text, keys and buttons beside it. The box draws the focus ring and the invalid border; the control keeps its own element, events, refs and form value.

- Source: `registry/ui/input-group.tsx`. Needs `registry/lib/theme.css`, `registry/lib/styles.ts`, Button, Input and Textarea.
- Examples: `registry/examples/input-group-example.tsx`. Run them with `bun run input-group-examples`.
- Upstream: shadcn/ui [`input-group.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/input-group.tsx) and its [docs](https://ui.shadcn.com/docs/components/base/input-group).

## Usage

```tsx
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText } from '#remixcn/ui/input-group.tsx'

<InputGroup>
  <InputGroupInput id="website" name="website" placeholder="acme.example" />
  <InputGroupAddon>
    <InputGroupText>https://</InputGroupText>
  </InputGroupAddon>
  <InputGroupAddon align="inline-end">
    <InputGroupButton type="submit">Check</InputGroupButton>
  </InputGroupAddon>
</InputGroup>
```

## API

### `InputGroup`

A `<div role="group" data-slot="input-group">` that takes every `div` prop and `mix`. It adds no form, no tab stop and no second control. It draws the border, the background, and, while its control has keyboard focus, the focus ring. It turns red while any part with a `data-slot` has `aria-invalid="true"`, usually the control. `data-disabled="true"` dims the addons, as a disabled control or a disabled fieldset does. Name the group with `aria-label` or `aria-labelledby` only when the control's label doesn't cover it.

### `InputGroupAddon`

A `<div role="group" data-slot="input-group-addon">` for icons, text, keys and buttons.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `align` | `'inline-start' \| 'inline-end' \| 'block-start' \| 'block-end'` | `'inline-start'` | Where the addon sits: at the start or the end of the line, or above or below the control. It renders `data-align` |

A press on the addon, but not on a link, button, label or other control inside it, focuses the group's control: the element marked `data-slot="input-group-control"`. That runs in the browser, inside your client entry. Call `preventDefault()` in your own click listener to keep focus where it is.

### `InputGroupButton`

A [Button](./button.md) for an addon. It takes every Button prop, and:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `size` | `'xs' \| 'sm' \| 'icon-xs' \| 'icon-sm'` | `'xs'` | The Button size. The icon sizes make a square for an icon without text |
| `variant` | Button's variants | `'ghost'` | |
| `type` | `'button' \| 'submit' \| 'reset'` | `'button'` | It only submits or resets a form when you say so |

Its attributes, events, refs and mixins reach the native `<button>`.

### `InputGroupText`

A `<span data-slot="input-group-text">` for a prefix, a unit or a count.

### `InputGroupInput` and `InputGroupTextarea`

[Input](./input.md) and [Textarea](./textarea.md), marked `data-slot="input-group-control"`. They take every prop of their component; `id`, `name`, `aria-*`, events, refs and mixins reach the native control. They drop their own border, background and ring, which the group draws instead. The textarea doesn't resize by hand.

## Composition

- **Order.** Keyboard focus and screen readers follow the order you write the parts in. `align` moves only the look. Write an addon with buttons after the control when its buttons should come after it in the tab order, as shadcn advises.
- **Errors and descriptions.** Set `aria-invalid` and `aria-describedby` on the control, as on a plain Input. They change with your values without moving focus or replacing the control.
- **Disabled.** Disable the control, or put the group in a disabled fieldset; the addons dim with it. `data-disabled="true"` on the group dims them while the control stays enabled, such as during a check.
- **Custom controls.** Add `data-slot="input-group-control"` to your own control, such as a native `<select>`, so the group draws its ring and a press on an addon focuses it.
- **Buttons at the end of a line.** In an addon above or below the control, let the text before the buttons grow with `css({ flexGrow: 1 })`, or set `justifyContent: 'flex-end'` on the addon. A margin on an InputGroupButton can lose to the button's own `margin: 0` (see [Layers and overrides](../../AGENTS.md#layers-and-overrides)).
- **Groups and fields.** In a ButtonGroup, the group joins its neighbors and grows from 8rem. In a Field, it fills a stacked field and shares a row like an Input.
- **Narrow screens.** The group grows with its text. When the addons and an input of 4rem don't fit on one line, the parts wrap inside the box, so the page never scrolls sideways.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `InputGroup`: `div role="group"`, `relative flex w-full min-w-0 items-center`, `h-9 rounded-md border shadow-xs`, `dark:bg-input/30` | Same tokens, with a minimum height | Grows with large text, and wraps its parts when a line can't hold them |
| `has-[[data-slot=input-group-control]:focus-visible]:border-ring ring-3` | Border in `--ring` and the theme's 2px outline on the group | The outline stays in forced colors |
| `has-[[data-slot][aria-invalid=true]]:border-destructive` | Same | |
| `has-[>[data-align=block-*]]:flex-col h-auto`, `has-[>textarea]:h-auto` | The group stacks its parts; the minimum height covers the rest | |
| `has-[>[data-align=…]]:[&>input]:pl-1.5 / pr-1.5 / pt-3 / pb-3` | The input's own rule reacts to the group's addons | So the group never styles its children |
| `InputGroupAddon`, `align` with `order-first` and `order-last` | Same parts, `data-align` and `order` | |
| `py-1.5` on every addon | Only addons above and below the control | The group's height isn't fixed, so padding on a line addon would make it 2px taller than an Input |
| `has-[>button]:-ml-1`, `has-[>kbd]:ml-[-0.15rem]` and their ends | A padding smaller by the same amount, in logical properties | The button sits in the same place, and the addon's box never reaches past the group's border when it ends a wrapped line |
| `group-data-[disabled=true]/input-group:opacity-50` | Same, and also with a disabled control or fieldset | |
| `[&>kbd]:rounded-[calc(var(--radius)-5px)]` | Not ported | RemixCN's smaller radius would make it 1px; Kbd keeps its own |
| Addon `onClick`: focuses the parent's first `input`, unless the press is on a `button` | Focuses the parent's `data-slot="input-group-control"`, input or textarea, unless the press is on a link, button, label or control in the addon, or a listener prevented it | Upstream's handler replaced a caller's `onClick`; here both run |
| `InputGroupButton`: Button with `variant="ghost"`, `type="button"`, `data-size`, size classes, but no Button `size` | Button with the matching Button size, plus `text-sm`, `shadow-none` and the group's padding | `sm` is Button's `sm` (2rem) instead of the default height upstream falls back to |
| `rounded-[calc(var(--radius)-5px)]` on `xs` and `icon-xs` | `--radius-sm` | |
| Outline button text from the addon | `--foreground` | The addon's muted text misses 4.5:1 on the outline's tint in dark mode |
| `InputGroupText`: `span` | Same, with `data-slot="input-group-text"` | |
| `InputGroupInput`, `InputGroupTextarea`: `rounded-none border-0 bg-transparent shadow-none ring-0`, `flex-1`, `resize-none` | Same, with the outline moved to the group and a minimum width of 4rem for the input | |
| `in-data-[slot=combobox-content]` rules | Not ported here | They belong to Combobox, which isn't ported yet |
| `[.border-b]:pb-2`, `[.border-t]:pt-2` | Your own `css()` on the addon | Remix has no class names to react to; the code editor example sets its border and padding |
| Example: Basic | `InputGroupBasic` | |
| Example: With Addons; docs: Inline start, Inline end, Block start, Block end, Icon, Text | `InputGroupWithAddons` | |
| Example: With Buttons; docs: Button | `InputGroupWithButtons`, `InputGroupCopyLink` | Copy uses the browser's clipboard and says whether it worked, in place of a toast |
| Example: With Tooltip, Dropdown, Popover; docs: Dropdown | Not ported here; its Button Group part is `InputGroupInButtonGroup` | They wait for Tooltip, Dropdown Menu and Popover. `InputGroupCustomControl` shows a native select instead |
| Example: With Kbd; docs: Kbd, Spinner | `InputGroupWithKbd` | |
| Example: In Card | `InputGroupInCard` | A form that sends its fields |
| Example: Textarea; docs: Textarea | `InputGroupTextareas` | |
| Docs: Custom Input | `InputGroupCustomControl` | A native select in place of a third-party autosize textarea; Textarea already grows with its text |
| Docs: RTL | The fixture's right-to-left panel | |
| — | `InputGroupSearchForm`, `InputGroupCounter` | A search form with submit and reset buttons, and a live count with an error past the limit |

## Accessibility checks

Automated: one native control per group and no forms of its own, button types, Enter and the buttons submitting and resetting their form, also without JavaScript; a press on an addon focusing its input or textarea and not a press on its buttons; the tab order; description links and focus kept while the value and error change; the focus ring and border on the group, also in forced colors; addons dimmed with a disabled control, group or fieldset; contrast of the control, addons and text in both themes; mirrored addons in right-to-left text; no sideways scrolling at 320px, also with text at 200%; and axe-core's WCAG 2.2 A and AA rules in both schemes, before and after hydration. Axe can't tell that the addons dimmed with a disabled control belong to it, which WCAG 1.4.3 exempts, so the axe test skips only those; the contrast test measures them at full strength. Screen readers weren't run. This isn't an accessibility certification.
