# Select

A button that shows the chosen value and opens a list of items to choose from. The form value lives in a native `<select>`, which is also the control until the script runs and on a page without JavaScript.

- Source: `registry/ui/select.tsx`. Needs `registry/lib/theme.css`, `styles.ts`, `aria.ts`, `icons.tsx`, `composite.ts`, `layer.ts`, `focus-scope.ts`, `modal.ts` and `anchor-position.ts`.
- Examples: `registry/examples/select-example.tsx`. Run them with `bun run select-examples`.
- Upstream: shadcn/ui [`select.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/select.tsx), its [examples](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/examples/select-example.tsx) and [docs](https://ui.shadcn.com/docs/components/base/select), and [Base UI Select](https://base-ui.com/react/components/select.md).

## Usage

```tsx
import { Field, FieldLabel } from '#remixcn/ui/field.tsx'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '#remixcn/ui/select.tsx'

<Field>
  <FieldLabel for="fruit">Favorite fruit</FieldLabel>
  <Select name="fruit" defaultValue="banana">
    <SelectTrigger id="fruit">
      <SelectValue placeholder="Select a fruit" />
    </SelectTrigger>
    <SelectContent>
      <SelectGroup>
        <SelectLabel>Fruits</SelectLabel>
        <SelectItem value="apple">Apple</SelectItem>
        <SelectItem value="banana">Banana</SelectItem>
      </SelectGroup>
    </SelectContent>
  </Select>
</Field>
```

The parts run in the browser inside your client entry: they take your mixins and functions, which can't cross from the server into an entry. Put the select in a component you mark with `clientEntry(...)`, as the examples do. A select the page renders outside any client entry stays a native select.

## How it runs

- **Server and no JavaScript.** The server renders a native `<select>` after your parts, with an option for every item, an optgroup for every labelled group, and the chosen options selected. The trigger waits hidden. Without JavaScript, and while the script loads, that select is the control: the browser draws its list, checks `required`, submits and resets it.
- **Once it runs.** The trigger shows, and the native select moves out of sight: it loses its tab stop, hides from assistive technology, and gives focus on to the trigger, also focus it held when the script started. It keeps its name, so the form still gets one value from one control. A choice made in it before the script ran, or that the browser restored, becomes the select's value.
- **Ids and ARIA.** The trigger's `id`, `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-invalid`, `aria-errormessage`, `aria-details` and `aria-description` go to whichever control shows. So a `<label for>`, a description and an error name and describe the native select before the script runs and the trigger after. Use `for` and an id, or `aria-label`: a `<label>` around the select would name the hidden trigger before the script runs.
- **Validation.** A required select without a choice blocks the form, before and after the script runs. Once it runs, the browser's check moves the native select over the trigger, so its message points there, and focus goes on to the trigger, which turns `aria-invalid` until a valid choice.
- **Events.** A choice dispatches `input` and `change` from the native select, as a native select does, so a form's change listener and `new FormData(form)` see the new value. Autofill and other changes to the native select reach the select too.
- **Reset.** A form reset returns the native select to the default value, and the select follows it.

## Keys

Focus stays on the trigger, a select-only combobox, and `aria-activedescendant` points at the highlighted item, as the WAI-ARIA Authoring Practices describe.

| Key | Closed | Open |
| --- | --- | --- |
| ArrowDown, Enter, Space | Opens with the chosen item highlighted, or the first | ArrowDown moves down; Enter and Space choose the highlighted item |
| ArrowUp | Opens with the chosen item highlighted, or the first | Moves up; the list doesn't wrap |
| Home, End | Opens with the first or last item highlighted | Highlights the first or last item |
| Letters | Choose the next item that starts with them, as a native select does; letters typed within half a second make one word | Highlight it; a space continues the typed text |
| Alt+ArrowUp | | Chooses the highlighted item and closes |
| Escape | | Closes without choosing |
| Tab, Shift+Tab | Move on | Close without choosing and move on. A modal list keeps the page inert, so the select moves focus to the next or previous stop itself |

Disabled items and the items of a disabled group are skipped. In a multiple select, Enter, Space and a click toggle the highlighted item and the list stays open.

## API

### `Select`

Groups the parts and holds the value and whether the list is open. It renders no element of its own, only the native select after your parts.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `value` | `Value \| null`, or `Value[]` when `multiple` | | The chosen value, for a select you control. Render the new value from `onValueChange` |
| `defaultValue` | `Value \| null`, or `Value[]` | `null` or `[]` | The value chosen at first. The server selects its options, and a form reset returns to it |
| `onValueChange` | `(value, details) => void` | | Called before the value changes, with `details.reason`, `details.event` and `details.cancel()` |
| `multiple` | `boolean` | `false` | Lets the user choose several items. Values come in the items' order |
| `name`, `form`, `autocomplete`, `required`, `disabled` | | | Go to the native select. A disabled select leaves the form, as a native one does |
| `readOnly` | `boolean` | `false` | The list opens, but no other value can be chosen; the native select offers no other option |
| `open`, `defaultOpen` | `boolean` | `false` | Whether the list is open, for a list you control, or once the select runs |
| `onOpenChange` | `(open, details) => void` | | Called before the list opens or closes, with a reason and `details.cancel()` |
| `modal` | `boolean` | `true` | Whether the page stays still while the list is open: no scrolling, and the rest of the page is inert |
| `highlightItemOnHover` | `boolean` | `true` | Whether the pointer moves the highlight |
| `items` | `Record<string, RemixNode>`, or a list of `{ value, label }` or of groups with `items` | | Labels SelectValue shows for values whose item hasn't rendered yet, such as on the server through a component of yours |

`Value` is a string type, such as `Select<'light' | 'dark'>`, and `null` means no choice. The value reasons are `'item-press'`, `'list-navigation'` (typing on the closed trigger), `'native-change'` and `'reset'`. The open reasons follow Base UI: `'trigger-press'`, `'item-press'`, `'escape-key'`, `'outside-press'`, `'focus-out'`, `'list-navigation'`, `'parent-dismissed'`, `'disabled'` and `'trigger-removed'`.

### `SelectTrigger`

A `<button type="button" role="combobox">` with the value and a chevron, `aria-haspopup="listbox"`, `aria-expanded`, `aria-controls` and, while open, `aria-activedescendant`. It renders `data-popup-open`, `data-placeholder`, `data-disabled`, `data-required`, `data-readonly` and `data-size`.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `size` | `'sm' \| 'default'` | `'default'` | 2rem or 2.25rem tall at least. Taller content, such as a plan with a description, makes it grow |
| `id`, `aria-*` | | | Go to whichever control shows, as above |
| `mix`, `class`, `style`, other props | | | Go to the trigger. A `css()` width, such as `css({ width: '9rem' })`, sizes it once the select runs |

### `SelectValue`

A `<span data-slot="select-value">`: the chosen item's content, or in a multiple select every chosen item's content with commas. It shows `placeholder`, or the content of the item without a value, while nothing is chosen, and renders `data-placeholder` then.

| Prop | Type | What it does |
| --- | --- | --- |
| `placeholder` | `RemixNode` | What shows while nothing is chosen. Its text is also the native select's empty option |
| `children` | `RemixNode \| (value) => RemixNode` | What shows instead; a function gets `string \| null`, or `string[]` in a multiple select |

### `SelectContent`

The list: a native `popover` in the top layer, with the items in a `role="listbox"` that scrolls between two scroll buttons. It stays in the document while closed, so the native select knows every item. It renders `data-open`, `data-closed`, `data-side` (`'none'` while lined up with the trigger), `data-align` and `data-align-trigger`.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `alignItemWithTrigger` | `boolean` | `true` | Opens the list over the trigger, with the chosen item's text where the value's text is. It opens beside the trigger instead after a touch, when the trigger is within 20px of the viewport's top or bottom, or when the list would get shorter than its `min-height`, or 100px |
| `side` | `'top' \| 'bottom' \| 'left' \| 'right' \| 'inline-start' \| 'inline-end'` | `'bottom'` | The side beside the trigger |
| `sideOffset`, `align`, `alignOffset` | `number`, `'start' \| 'center' \| 'end'`, `number` | `4`, `'center'`, `0` | Gap and alignment beside the trigger |
| `collisionPadding` | `number` | `5` | Space to keep from the viewport's edges |
| `collisionAvoidance` | `{ side?: 'flip' \| 'none'; align?: 'shift' \| 'none' }` | flip and shift | How to stay in view beside the trigger |

The list is at least as wide as the trigger and 9rem, as wide as its longest item, and never wider than the viewport: long items wrap instead of being cut off. It is as tall as the room allows, and scrolls. The listbox takes its name from the trigger's `aria-labelledby` or `aria-label`, or from the trigger's labels.

### `SelectGroup`, `SelectLabel`

A `role="group"` that its `SelectLabel` names, and in the native select an optgroup with the label's text. `disabled` on the group turns off every item in it, as a disabled optgroup does. A `SelectLabel` outside a group is hidden from assistive technology.

### `SelectItem`

A `role="option"` with `aria-selected`, its content in `data-slot="select-item-text"` and a check in `data-slot="select-item-indicator"` while chosen. It renders `data-selected`, `data-highlighted` and `data-disabled`.

| Prop | Type | What it does |
| --- | --- | --- |
| `value` | `string \| null` | The value. `null` makes the item that clears the choice: its content shows as the placeholder, and in the native select it is the first option, outside any group |
| `label` | `string` | The text for typing and the native option, for content that isn't plain text, such as an icon or a component |
| `disabled` | `boolean` | Keeps it from being chosen; it still shows |

### `SelectSeparator`, `SelectScrollUpButton`, `SelectScrollDownButton`

A line between groups, hidden from assistive technology. The scroll buttons show while the list can scroll their way and scroll it while the pointer rests on them; `SelectContent` renders them, and devices without hover leave them out.

### Also exported

`SelectProps`, `SelectSingleProps`, `SelectMultipleProps`, `SelectTriggerProps`, `SelectValueProps`, `SelectContentProps`, `SelectGroupProps`, `SelectLabelProps`, `SelectItemProps`, `SelectItems`, `SelectItemData`, `SelectSize`, `SelectValueChangeReason`, `SelectOpenChangeReason`, `SelectValueChangeDetails`, `SelectOpenChangeDetails` and `CollisionAvoidance`.

## Composition

- **Values that have no item.** A value without an item, such as one the server sends or an item that went away, stays the value: the trigger shows the raw value, and the native select keeps it in a hidden option, so the form submits what the trigger shows. A default without an item stays in a hidden option too, so a form reset returns to it. Open, no item is highlighted as chosen.
- **A disabled item that is chosen.** It stays chosen, shows in the trigger and submits. The native select hides its option instead of disabling it, since a disabled option leaves the form, and never offers it again. In a disabled group, its optgroup stays on for the same reason, and only the group's other options turn off.
- **Changing items.** Items may come and go, also while the list is open. The highlight moves to the chosen item, or the first, when its item goes away. The native select follows on the next render.
- **Changing defaults.** A new `defaultValue` doesn't change the current choice; it changes what a form reset returns to.
- **Items in your components.** Items register while they render, so a component of yours that renders them works, also on the server. SelectValue renders before the items, so on the server it shows the label from `items`, else the item's content when it sits in the select's own JSX, else the raw value; the trigger is hidden then, and shows the item's content once the select runs. When a component of yours changes its items on its own, such as items it loads after the page shows, the select renders the trigger and the native select again.
- **Several selects.** Each select has its own ids, layer and value. A modal select keeps the rest of the page inert while open, so a press on another select first closes the open one.
- **In a dialog.** The list opens above the dialog in the top layer, and Escape closes only the list.
- **Overrides.** A `css()` you pass with `mix` renders after the part's own rule, so it wins.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `Select` on Base UI's `Select.Root` | `Select` | Renders the native select that holds the value in place of Base UI's hidden input |
| Root `value`, `defaultValue`, `onValueChange`, `multiple` | Same | Values are strings; `null` is no choice |
| Root object values, `itemToStringValue`, `itemToStringLabel`, `isItemEqualToValue` | String values, a lookup in `SelectValue` or `items` | A native select submits strings; the Plan example looks its plan up by key |
| Root `items` | Same | Maps, lists and groups of labels |
| Root `name`, `form`, `autoComplete`, `required`, `disabled`, `readOnly` | `name`, `form`, `autocomplete`, `required`, `disabled`, `readOnly` | On the native select; read-only offers no other native option |
| Root `open`, `defaultOpen`, `onOpenChange`, `modal`, `highlightItemOnHover` | Same | |
| Root `actionsRef`, `onOpenChangeComplete`, `inputRef`, `id` | Not ported | No exit animation to wait for; find the native select by `[data-slot="select-native-select"]` |
| `SelectTrigger` on `Select.Trigger` and `Select.Icon` | `SelectTrigger` with a chevron | `size: 'sm' \| 'default'` as in shadcn; `render` and `nativeButton` aren't ported |
| `SelectValue` on `Select.Value` | Same | `placeholder` and function children as in Base UI |
| `SelectContent` on `Portal`, `Positioner`, `Popup` and `List` | `SelectContent`, a native popover with a listbox | The top layer replaces the portal |
| Positioner `alignItemWithTrigger` | Same, `true` by default as in shadcn | Falls back as Base UI does: touch, 20px from an edge, too short |
| Positioner `side`, `align`, `sideOffset`, `alignOffset`, `collisionPadding`, `collisionAvoidance` | Same, with shadcn's defaults | Offsets are numbers |
| Positioner `anchor`, `collisionBoundary`, `sticky`, `positionMethod`, `disableAnchorTracking`, `arrowPadding` | Not ported | Always beside, or over, the trigger |
| `SelectGroup`, `SelectLabel` on `Group`, `GroupLabel` | Same | An optgroup in the native select; `disabled` on the group is new, from the native optgroup |
| `SelectItem` on `Item`, `ItemText`, `ItemIndicator` | `SelectItem` | `label` and `disabled` as in Base UI |
| `SelectSeparator` on `Separator` | Same | Hidden from assistive technology, since a listbox holds only options and groups |
| `SelectScrollUpButton`, `SelectScrollDownButton` on `ScrollUpArrow`, `ScrollDownArrow` | Same | Scroll by an item every 50ms while the pointer rests on them |
| `Select.Arrow`, `Backdrop`, `Label` | Not ported | shadcn doesn't render them; label a select with Field or `aria-label` |
| Trigger `data-popup-open`, `data-placeholder`, `data-disabled`, `data-required`, `data-readonly` | Same | `data-pressed` and the Field states aren't ported |
| Item `data-selected`, `data-highlighted`, `data-disabled` | Same | |
| Base UI's focus moving into the list | Focus stays on the trigger, with `aria-activedescendant` | The WAI-ARIA select-only combobox, with `composite.ts` |
| Base UI's typing on the closed trigger | Same | Chooses as a native select does |
| Classes in `style-vega.css` | Same measures and colors | `ring-1` becomes a border, drawn in `CanvasText` in forced colors; the focus ring is the theme's outline; the dark hover tint is 40% instead of 50%, so the placeholder keeps 4.5:1; the menu translucency of shadcn's create options isn't ported |
| `w-(--anchor-width)` and items without wrapping | At least the trigger's width, as wide as the longest item, within the viewport | Long items wrap instead of being cut off |
| The trigger's value on one line, cut off | One line while it fits | It wraps once the trigger has no more room, so 320px with text at 200% shows all of it |
| Fade and zoom in and out | A fade in beside the trigger | A transform would move the box the positioning measures; it closes at once, and over the trigger it shows at once, as in shadcn |
| Examples: Basic, Sides, With Icons, With Groups, Large List, Multiple, Sizes, Plan, With Button, Item Aligned, With Field, Invalid, Inline, Disabled, In Dialog | `SelectBasic`, `SelectSides`, `SelectWithIcons`, `SelectWithGroups`, `SelectLargeList`, `SelectMultiple`, `SelectSizes`, `SelectPlan`, `SelectWithButton`, `SelectItemAligned`, `SelectWithField`, `SelectInvalid`, `SelectInline`, `SelectDisabled`, `SelectInDialog` | Icons drawn for RemixCN; the Plan example uses string values |
| — | `SelectControlled`, `SelectForm`, `SelectRtl` | A value you control, a required select in a form that works without JavaScript, and right-to-left text |

## Accessibility checks

Automated, in Chromium, Firefox and WebKit (`bun run test`, `test:browser`, `test:e2e`):

- Without JavaScript, and when the script never loads, each select is a native select that its label names and its description describes: it blocks an empty required form, submits and resets.
- A choice made in the native select before hydration stays, and the label names the trigger once it runs.
- The trigger is a combobox with `aria-haspopup="listbox"`, `aria-expanded`, `aria-controls` and `aria-required`; the list is a listbox named by the trigger's label, with groups named by their labels; separators and scroll buttons are hidden from assistive technology.
- The keyboard opens, moves, types, chooses, cancels and moves on as the table above says, with real key presses; Tab closes the list and moves on past the page the open list kept inert.
- A click and a press dragged from the trigger choose; a click outside closes and returns focus to the trigger; a label focuses the trigger without opening it.
- The form gets one value from one control, also from several selects; required validation focuses the trigger and marks it invalid until a valid choice; a reset returns to the default.
- Changing items, a value without an item, a disabled chosen item, disabled items and groups, a controlled value the owner declines, and cancelled changes behave as described.
- The chosen item opens over the trigger with its text where the value is, and the list opens on every side beside the trigger otherwise, also mirrored in right-to-left text.
- Unmounting releases its layer, the scroll lock and the inert page.
- axe-core finds no WCAG 2.2 A or AA violation before hydration, after it, with a list open, and in the dark theme.
- The value, the placeholder, the items, the group labels and the highlighted item keep 4.5:1 in both themes.
- The focus ring, the trigger's and list's edges and the highlighted item stay visible in forced colors.
- The list fades in only without reduced motion; the page fits 320px with text at 200%, also with a list open.

Not checked, so not claimed:

- Screen readers (NVDA, JAWS, VoiceOver, TalkBack) weren't tested; support for `aria-activedescendant` on a combobox differs between them.
- The browser's validation message was seen in Chromium; other engines draw it outside the page, where screenshots don't reach.
- Safari itself wasn't run, only Playwright's WebKit in CI. Forced colors were emulated, not tested in Windows. Touch was emulated, not tested on a phone.
- This isn't an accessibility certification.
