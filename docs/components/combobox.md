# Combobox

A text input that filters a list of items to choose from, with one value or several shown as chips. The chosen value lives in a native `<select>`, which is also the control until the script runs and on a page without JavaScript.

- Source: `registry/ui/combobox.tsx`. Needs `registry/lib/theme.css`, `styles.ts`, `aria.ts`, `icons.tsx`, `composite.ts`, `layer.ts`, `focus-scope.ts`, `modal.ts` and `anchor-position.ts`, and `registry/ui/button.tsx` and `input-group.tsx`.
- Examples: `registry/examples/combobox-example.tsx`. Run them with `bun run combobox-examples`.
- Upstream: shadcn/ui [`combobox.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/combobox.tsx), its [examples](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/examples/combobox-example.tsx) and [docs](https://ui.shadcn.com/docs/components/base/combobox), and [Base UI Combobox](https://base-ui.com/react/components/combobox.md).

## Usage

```tsx
import { Field, FieldLabel } from '#remixcn/ui/field.tsx'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '#remixcn/ui/combobox.tsx'

const frameworks = ['Next.js', 'SvelteKit', 'Nuxt.js', 'Remix', 'Astro']

<Field>
  <FieldLabel for="framework">Framework</FieldLabel>
  <Combobox name="framework" items={frameworks}>
    <ComboboxInput id="framework" placeholder="Select a framework" />
    <ComboboxContent>
      <ComboboxEmpty>No items found.</ComboboxEmpty>
      <ComboboxList>
        {(item: string) => (
          <ComboboxItem key={item} value={item}>
            {item}
          </ComboboxItem>
        )}
      </ComboboxList>
    </ComboboxContent>
  </Combobox>
</Field>
```

The parts run in the browser inside your client entry: they take your functions and mixins, which can't cross from the server into an entry. Put the combobox in a component you mark with `clientEntry(...)`, as the examples do. A combobox the page renders outside any client entry stays a native select.

## How it runs

- **Server and no JavaScript.** The server renders a native `<select>` after your parts, with an option for every item of `items`, an optgroup for every labelled group, and the chosen options selected. A multiple combobox renders a `<select multiple>`. The input, the chips and the trigger wait hidden. Without JavaScript, and while the script loads, that select is the control: the browser draws its list, checks `required`, submits and resets it.
- **Once it runs.** The input shows, and the native select moves out of sight: it loses its tab stop, hides from assistive technology, and gives focus on to the input, also focus it held when the script started. It keeps its name, so the form gets the chosen values from one control, in the order they were chosen. A choice made in it before the script ran, or that the browser restored, becomes the value.
- **Text and value.** The input's text is a search, never a value, as in Base UI. Typing filters the list; choosing an item writes its label into the input; when the list closes, the text goes back to the chosen item's label, or empties in a multiple combobox and in a popup's search. Text you edit while the list stays closed goes back once focus leaves the combobox. Emptying the input of a single combobox clears its value. A `name` on ComboboxInput sends the text too, but only once the script runs, so a page without it never sends a text the native select doesn't match. Prefer `name` on Combobox.
- **Ids and ARIA.** The control's `id`, `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-invalid`, `aria-errormessage`, `aria-details` and `aria-description` go to whichever control shows: the native select before the script runs, then the input, or the trigger when the search sits in the popup. So a `<label for>`, a description and an error name and describe both. Its `disabled`, `required` and `placeholder` go to the native select too.
- **Validation.** A required combobox without a choice blocks the form, before and after the script runs. Once it runs, the browser's check moves the native select over the input, so its message points there, and focus goes on to the input, which turns `aria-invalid` until a valid choice.
- **Events.** A choice dispatches `input` and `change` from the native select, so a form's change listener and `new FormData(form)` see the new value.
- **Reset.** A form reset returns to the default value, and the input to its label. A reset that a listener cancels changes nothing.
- **Results.** The list's status says how many items match once a search rests for 600ms, such as "3 results available.", and ComboboxEmpty, a live region, says when none does.

## Keys

Focus stays in the input, an editable combobox with list autocomplete, and `aria-activedescendant` points at the highlighted item, as the WAI-ARIA Authoring Practices describe.

| Key | Closed | Open |
| --- | --- | --- |
| Typing | Opens the list and filters it | Filters the list. Nothing is highlighted, or the first match with `autoHighlight` |
| ArrowDown | Opens with the chosen item highlighted, or the first | Moves down. With `loopFocus`, past the last item the highlight leaves for the input, then starts over |
| ArrowUp | Opens with the chosen item highlighted, or the last | Moves up, through the input in the same way |
| Alt+ArrowDown | Opens without a highlight | |
| Enter | The form submits, as from any text field | Chooses the highlighted item. Without one, the list closes and the form may submit |
| Space | Types | Chooses the highlighted item while the input is empty |
| Escape | Clears the value and the text; with nothing to clear, Escape is the page's, such as the dialog's | Closes the list without choosing |
| Home, End | Move the caret | Move the caret |
| Tab, Shift+Tab | Move on | Close the list and move on. A modal list keeps the page inert, so the combobox moves focus on itself |

In a multiple combobox, Enter, Space and a click toggle the highlighted item. The list stays open, unless you chose from a search: then the search clears and the list closes, as in Base UI. Disabled items are skipped.

Keys during an input method composition belong to it: the search waits for the committed text, and Enter there confirms the composition and chooses nothing.

| Chips | |
| --- | --- |
| Backspace in an empty input | Removes the last chip |
| ArrowLeft at the start of the input (ArrowRight in right-to-left text) | Focuses the last chip |
| ArrowLeft, ArrowRight on a chip | Move between chips; past the last, back to the input |
| Backspace, Delete on a chip | Remove it, and focus the chip that takes its place, the one before, or the input |
| Enter, Space on a chip | Back to the input |
| ArrowDown, ArrowUp on a chip | Open the list from the input |
| Typing on a chip | Goes on in the input |

With the search in a popup, the trigger opens the list with Enter, Space, ArrowDown and ArrowUp and moves focus to the search; a choice, Escape and Tab close it, and focus goes back to the trigger. Typing on the closed trigger of a single combobox chooses the next item that starts with the letters, as a native select does.

## API

### `Combobox`

Groups the parts and holds the value, the input's text and whether the list is open. It renders no element of its own, only the native select after your parts.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `items` | `Item[]`, or groups `{ items: Item[] }` | | The items. The list renders those that match the search; the native select offers all of them |
| `filteredItems` | Same shape | | Shows these in place of the ones Combobox filters, such as results you load. Keep the chosen items in `items` |
| `filter` | `(item, query, itemToString) => boolean`, or `null` | `contains` of `createComboboxFilter()` | Decides which items match; `null` shows every item |
| `limit` | `number` | `-1` | Shows at most this many items, also of `filteredItems` |
| `locale` | `string \| string[]` | | The locale of the default filter |
| `itemToStringLabel` | `(item) => string` | the item's `label`, or the item | The text in the input, in chips and for the default filter |
| `itemToStringValue` | `(item) => string` | the item's `value`, or its label | The text the form submits |
| `isItemEqualToValue` | `(item, value) => boolean` | `Object.is` | Whether an item stands for a value, for items that aren't the same object |
| `value` | `Item \| null`, or `Item[]` when `multiple` | | The chosen value, for a combobox you control. Render the new value from `onValueChange` |
| `defaultValue` | `Item \| null`, or `Item[]` | `null` or `[]` | The value chosen at first. The server selects its options, and a form reset returns to it |
| `onValueChange` | `(value, details) => void` | | Called before the value changes, with `details.reason`, `details.event` and `details.cancel()` |
| `multiple` | `boolean` | `false` | Lets the user choose several items, in the order chosen |
| `inputValue`, `defaultInputValue` | `string` | the chosen item's label | The input's text, for an input you control, or at first |
| `onInputValueChange` | `(text, details) => void` | | Called before the text changes. `details.signal` aborts once the text changes again or the combobox goes away; `details.isItemPress` marks a clear after a choice in a multiple combobox |
| `open`, `defaultOpen` | `boolean` | `false` | Whether the list is open, for a list you control, or once the combobox runs |
| `onOpenChange` | `(open, details) => void` | | Called before the list opens or closes, with a reason and `details.cancel()` |
| `autoHighlight` | `boolean \| 'always'` | `false` | Highlights the first match while you type, or whenever the list shows items |
| `highlightItemOnHover` | `boolean` | `true` | Whether the pointer moves the highlight |
| `openOnInputClick` | `boolean` | `true` | Whether a press on the input opens the list |
| `loopFocus` | `boolean` | `true` | Whether the arrow keys pass through the input between the last and the first item |
| `modal` | `boolean` | `false` | Whether the page stays still while the list is open: no scrolling, and the rest of the page is inert |
| `onItemHighlighted` | `(item \| undefined, details) => void` | | Called when another item lights up, with `'keyboard'`, `'pointer'` or `'none'` |
| `name`, `form`, `autocomplete`, `required`, `disabled` | | | Go to the native select. A disabled combobox leaves the form, as a native select does |
| `readOnly` | `boolean` | `false` | The list opens, but no other value can be chosen |

The value reasons are `'item-press'`, `'input-clear'`, `'clear-press'`, `'chip-remove-press'`, `'escape-key'`, `'native-change'`, `'reset'` and `'none'` (Backspace or Delete on a chip, typing on a closed trigger). The text reasons are `'input-change'`, `'input-clear'`, `'item-press'`, `'clear-press'`, `'escape-key'`, `'reset'` and `'none'`. The open reasons follow Base UI: `'trigger-press'`, `'input-press'`, `'input-change'`, `'input-clear'`, `'item-press'`, `'clear-press'`, `'escape-key'`, `'outside-press'`, `'focus-out'`, `'list-navigation'`, `'disabled'`, `'trigger-removed'` and `'none'`.

### `ComboboxInput`

An InputGroup around a native `<input role="combobox">` with `aria-autocomplete="list"`, `aria-expanded`, `aria-controls` and, while open, `aria-activedescendant`, and a chevron that opens the list. Your `mix`, `class` and `style` go to the group, as shadcn's `className` does; every other prop goes to the input. It renders `data-slot="combobox-input"` on the group and `data-popup-open` on the input.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `showTrigger` | `boolean` | `true` | Shows the chevron. It isn't a tab stop, and focus stays in the input |
| `showClear` | `boolean` | `false` | Shows a button that clears the value and the text while there is either; the chevron gives way to it |
| `triggerLabel`, `clearLabel` | `string` | `'Show suggestions'`, `'Clear'` | The buttons' names for assistive technology |
| `children` | `RemixNode` | | Addons, such as an `InputGroupAddon` with an icon |
| `disabled` | `boolean` | | Turns the combobox off, also its native select |
| `id`, `aria-*`, `required`, `placeholder` | | | Go to whichever control shows, as above |

Put a ComboboxInput in ComboboxContent for a search in the popup: it takes focus while the popup is open and empties when it closes.

### `ComboboxTrigger`

A `<button type="button">` with your children and a chevron, styled like a select's trigger. With the search in ComboboxContent, it is the control, as in shadcn's "Combobox in Popup": `role="combobox"`, `aria-haspopup="dialog"`, a tab stop, and the id and ARIA props that go to the native select until the combobox runs. Beside an input outside the popup, it is a button without a tab stop. It renders `data-popup-open`, `data-placeholder` and `data-disabled`.

### `ComboboxValue`

The chosen value, without an element of its own: the item's label, the labels with commas in a multiple combobox, or `placeholder` while nothing is chosen.

| Prop | Type | What it does |
| --- | --- | --- |
| `placeholder` | `RemixNode` | What shows while nothing is chosen. Its text is also the native select's empty option |
| `children` | `RemixNode \| (value) => RemixNode` | What shows instead; a function gets the item or `null`, or the list of items in a multiple combobox, such as chips |

### `ComboboxContent`

The popup: a native `popover` in the top layer, kept in the document while closed. It holds a status that says the results, and with a search inside it is a `role="dialog"` named like the trigger. It renders `data-open`, `data-closed`, `data-empty`, `data-side` and `data-align`.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `side` | `'top' \| 'bottom' \| 'left' \| 'right' \| 'inline-start' \| 'inline-end'` | `'bottom'` | The side of the input |
| `sideOffset`, `align`, `alignOffset` | `number`, `'start' \| 'center' \| 'end'`, `number` | `6`, `'start'`, `0` | Gap and alignment |
| `anchor` | `Element`, `ComboboxAnchor` or `() => Element \| null` | the chips, the input's group, or the trigger | What to line up with |
| `collisionPadding` | `number` | `5` | Space to keep from the viewport's edges |
| `collisionAvoidance` | `{ side?: 'flip' \| 'none'; align?: 'shift' \| 'none' }` | flip and shift | How to stay in view |
| `resultsLabel` | `(count) => string` | `'N results available.'` | What the status says once a search rests |

The popup is as wide as what it lines up with, and at most as wide as the viewport: long items wrap. It is at most 18rem tall, and the list scrolls.

### `ComboboxList`

A `role="listbox"`, with `aria-multiselectable` in a multiple combobox, named by the control's label. Give it a function, and it calls it with each matching item, or each group that has a match, with only its matching items. It renders `data-empty`.

### `ComboboxGroup`, `ComboboxLabel`, `ComboboxCollection`

A `role="group"` that its ComboboxLabel names, and in the native select an optgroup with the label's text. Pass the group's `items` from the list's function; ComboboxCollection inside calls its function with each of them. A group without a match leaves the list.

### `ComboboxItem`

A `role="option"` with `aria-selected`, and a check while chosen. It renders `data-selected`, `data-highlighted` and `data-disabled`.

| Prop | Type | What it does |
| --- | --- | --- |
| `value` | `Item` | The item it stands for |
| `disabled` | `boolean` | Keeps it from being chosen; it still shows |

Enter on the highlighted item clicks it, so your click listeners hear the keyboard too. A link in an item handles its own click.

### `ComboboxEmpty`

A `role="status"` live region, outside the listbox, that shows its children while no item matches. It stays in the document, empty, while items match, so assistive technology hears the text as it appears.

### `ComboboxSeparator`

A line between items or groups, hidden from assistive technology.

### `ComboboxChips`, `ComboboxChip`, `ComboboxChipsInput`

ComboboxChips is the box of a multiple combobox, a `role="toolbar"` while it holds chips. The list lines up with it, and a press on its empty space focuses the input. ComboboxChip is a chosen item, in the order of the values, focusable with the keys above; `showRemove` (default `true`) adds a remove button named `removeLabel`, by default "Remove" and the chip's text. ComboboxChipsInput is the text input after the chips, with the props of ComboboxInput's input.

### `createComboboxAnchor()`

In place of shadcn's `useComboboxAnchor()`: call it once in your component's setup, put its `mix` on the element to line up with, and pass it to ComboboxContent's `anchor`. Its `current` is the element once it is in the document. ComboboxChips anchors the list by itself.

### `createComboboxFilter(options)`

In place of Base UI's `useFilter()`: `contains`, `startsWith` and `endsWith` with `Intl.Collator`, so case, accents and punctuation don't count. Takes a `locale` and `Intl.CollatorOptions`.

### Also exported

`ComboboxProps`, `ComboboxSingleProps`, `ComboboxMultipleProps`, `ComboboxInputProps`, `ComboboxTriggerProps`, `ComboboxValueProps`, `ComboboxContentProps`, `ComboboxListProps`, `ComboboxGroupProps`, `ComboboxLabelProps`, `ComboboxCollectionProps`, `ComboboxItemProps`, `ComboboxChipProps`, `ComboboxChipsInputProps`, `ComboboxItems`, `ComboboxItemGroup`, `ComboboxFilter`, `ComboboxFilters`, `ComboboxFilterOptions`, `ComboboxAnchor`, `CollisionAvoidance`, the reason types and the details types.

## Composition

- **Results you load.** Combobox sends no request. Load results in `onInputValueChange`, pass `details.signal` to your request, and drop an answer that arrives after it aborted: it belongs to an older search. Show the results with `filter={null}` and `items`, or with `filteredItems`, and keep the chosen item in `items` so its label stays known. The Async results example does this with a made-up directory.
- **Changing items.** Items may come and go, also while the list is open. An item that stays keeps its id and its highlight; when the highlighted item goes, nothing is highlighted, or the first match with `autoHighlight`. `aria-activedescendant` never points at an item that left.
- **Values that have no item.** A value without an item stays the value: the input shows its label, and the native select keeps it in a hidden option, so the form submits it. A default without an item stays there too, for a form reset.
- **A disabled item that is chosen.** It stays chosen and submits. Before the script runs, the native select hides its option instead of disabling it, since a disabled option leaves the form.
- **Changing defaults.** A new `defaultValue` doesn't change the current choice; it changes what a form reset returns to.
- **A change the owner declines.** When you control `value` and keep the old one after a choice, the clear button or Escape, the input goes back to the label of the value you keep, so it shows what the form submits. After you empty the input yourself, it stays empty while you edit and shows that label once focus leaves.
- **Chips in your JSX.** ComboboxValue's function renders the chips and the input after them, as in shadcn. When the last chip goes, Remix renders that input anew; the combobox gives focus to the new one.
- **Static items.** Without `items`, hand-written ComboboxItems show and can be chosen, but nothing filters them, as Base UI's Empty and filtering need `items`.
- **Several comboboxes.** Each has its own ids, layer and value. Focus leaving one closes its list.
- **In a dialog.** The list opens above the dialog in the top layer, and Escape closes only the list.
- **Overrides.** A `css()` you pass with `mix` renders after the part's own rule, so it wins.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `Combobox` on Base UI's `Combobox.Root` | `Combobox` | Renders the native select that holds the value in place of Base UI's hidden input |
| Root `items`, `filteredItems`, `filter`, `limit`, `locale` | Same | Items registered from `items`; without it, hand-written items don't filter |
| Root `itemToStringLabel`, `itemToStringValue`, `isItemEqualToValue` | Same | `{ value, label }` items need neither function, as in Base UI |
| Root `value`, `defaultValue`, `onValueChange`, `multiple` | Same | Multiple values keep the order they were chosen in |
| Root `inputValue`, `defaultInputValue`, `onInputValueChange` | Same | `details.signal` is new: it aborts with the next text, for results you load |
| Root `open`, `defaultOpen`, `onOpenChange`, `autoHighlight`, `highlightItemOnHover`, `openOnInputClick`, `loopFocus`, `modal`, `onItemHighlighted` | Same | `autoHighlight` takes `true` or `'always'` |
| Root `name`, `form`, `autoComplete`, `required`, `disabled`, `readOnly` | `name`, `form`, `autocomplete`, `required`, `disabled`, `readOnly` | On the native select |
| Root `actionsRef`, `onOpenChangeComplete`, `inputRef`, `id`, `inline`, `grid`, `virtualized`, `Combobox.Row` | Not ported | No exit animation to wait for; find the native select by `[data-slot="combobox-native-select"]` |
| `Combobox.createItems()` | `itemToStringValue` and `isItemEqualToValue` | Stable ids for object items without a collection type |
| `useFilter()`, `useFilteredItems()` | `createComboboxFilter()`, the list's function | Plain functions instead of hooks |
| `useComboboxAnchor()` | `createComboboxAnchor()` | A `ref()` mixin and `current`, made once in setup; ComboboxChips anchors by itself |
| `ComboboxInput` on `InputGroup`, `InputGroupInput`, `Combobox.Input` | `ComboboxInput` | RemixCN's InputGroup; `showTrigger` and `showClear` as in shadcn; `triggerLabel` and `clearLabel` name the buttons, which shadcn leaves unnamed |
| `ComboboxClear` on `Combobox.Clear` | Inside `ComboboxInput` with `showClear` | Not exported, as in shadcn |
| `ComboboxTrigger` on `Combobox.Trigger` | `ComboboxTrigger` | Looks like a select's trigger, since `render` isn't ported; the chevron inside ComboboxInput is an InputGroupButton |
| `ComboboxValue` on `Combobox.Value` | Same | No element of its own; `placeholder` and function children as in Base UI |
| `ComboboxContent` on `Portal`, `Positioner` and `Popup` | `ComboboxContent`, a native popover | The top layer replaces the portal; same side, offset and align defaults as shadcn |
| Positioner `collisionBoundary`, `sticky`, `positionMethod`, `disableAnchorTracking`, `arrowPadding`, offset functions | Not ported | Offsets are numbers |
| `Combobox.Status` | A status inside ComboboxContent | Says the results once a search rests, with `resultsLabel` |
| `ComboboxList`, `ComboboxCollection`, `ComboboxGroup`, `ComboboxLabel` on `List`, `Collection`, `Group`, `GroupLabel` | Same | A labelled group is an optgroup in the native select |
| `ComboboxItem` on `Item` and `ItemIndicator` | `ComboboxItem` | `value` and `disabled` as in Base UI; Enter clicks the item |
| `ComboboxEmpty` on `Empty` | Same | A live region outside the listbox |
| `ComboboxSeparator` on `Separator` | Same | Hidden from assistive technology, since a listbox holds only options and groups |
| `ComboboxChips`, `ComboboxChip`, `ComboboxChipsInput` on `Chips`, `Chip`, `ChipRemove`, `Input` | Same | The remove button is RemixCN's Button, named "Remove" and the chip's text |
| `Combobox.Label`, `Combobox.Icon`, `Combobox.InputGroup`, `Arrow`, `Backdrop` | Not ported | shadcn doesn't use them; label the control with Field or `aria-label` |
| Input and trigger `data-popup-open`, item `data-selected`, `data-highlighted`, `data-disabled`, popup `data-empty` | Same | `data-popup-side`, `data-list-empty`, `data-pressed` and the Field states aren't ported |
| Base UI's Escape on a closed combobox | Same | Clears the value and the text, and keeps the key from a dialog only when it cleared something |
| Base UI's composition handling | Same | The search waits for `compositionend`; Enter during a composition chooses nothing |
| Classes in `style-vega.css` | Same measures and colors | `ring-1` becomes a border, drawn in `CanvasText` in forced colors; the focus ring is the theme's outline; the search in a popup and the dark chips box take lighter tints, so the muted chips and the search show on RemixCN's darker `--input`; chips wrap instead of `whitespace-nowrap`; the remove button is 70% opaque instead of 50%; the list's scrollbar is thin instead of hidden |
| `w-(--anchor-width)` and `min-w-[calc(var(--anchor-width)+--spacing(7))]` | As wide as the input's group, the chips or the trigger | Base UI anchors to the input inside shadcn's group, so shadcn widens the popup by the chevron; RemixCN anchors to the group |
| Fade and zoom in and out | A fade in | A transform would move the box the positioning measures; it closes at once |
| Examples: Basic, Disabled, Sides, Invalid, With Clear, Auto Highlight, With Groups, With Groups and Separator, Large List, Input Addon, In Popup, With Form, Multiple, Multiple Disabled, Multiple Invalid, Multiple No Remove, With Custom Items, In Dialog, With Other Inputs, Disabled Items | `ComboboxBasic`, `ComboboxDisabled`, `ComboboxSides`, `ComboboxInvalid`, `ComboboxWithClear`, `ComboboxAutoHighlight`, `ComboboxWithGroups`, `ComboboxWithGroupsAndSeparator`, `ComboboxLargeList`, `ComboboxInputAddon`, `ComboboxInPopup`, `ComboboxWithForm`, `ComboboxMultiple`, `ComboboxMultipleDisabled`, `ComboboxMultipleInvalid`, `ComboboxMultipleNoRemove`, `ComboboxWithCustomItems`, `ComboboxInDialog`, `ComboboxWithOtherInputs`, `ComboboxDisabledItems` | Icons drawn for RemixCN; the countries are a shorter list; the form sends to `/echo` with `name` on Combobox, instead of showing a toast with the input's text; the dialog's buttons close it |
| — | `ComboboxControlled`, `ComboboxAsync`, `ComboboxRtl` | A value you control, results loaded for each search, and right-to-left text |

## Accessibility checks

Automated, in Chromium, Firefox and WebKit (`bun run test`, `test:browser`, `test:e2e`):

- Without JavaScript, and when the script never loads, each combobox is a native select, single or multiple, that its label names and its description describes: it blocks an empty required form, submits and resets.
- A choice made in the native select before hydration stays, focus moves on to the input, and the label names the input once it runs.
- The input is a combobox with `aria-autocomplete="list"`, `aria-expanded`, `aria-controls` and `aria-required`; the list is a listbox named by the control's label, with groups named by their labels; separators are hidden from assistive technology; `aria-activedescendant` always points at one shown option, also while items change.
- Typing, the arrow keys through the input, Enter, Space, Escape on an open and a closed list, Tab past a modal list, and the chips' keys work as the tables above say; the end-to-end tests press real keys for typing, the arrows, Enter, Escape and the chips. A disabled item is never chosen.
- Typed text that isn't chosen goes back to the chosen label, and the form gets only the chosen value.
- An input method composition, real in Chromium and as events in every engine, searches only once it commits, and Enter during it chooses nothing.
- Focus stays in the combobox when chips go, also when your JSX renders the input anew.
- The signal of an older search aborts, so its late answer never replaces a newer one.
- The search in a popup takes focus, and a choice gives it back to the trigger; in a dialog, Escape closes only the list.
- Changing items, a controlled value and text the owner declines, a combobox that turns off, a new default, a form reset and required validation behave as described; unmounting releases its layer.
- The status says how many items match once a search rests, and ComboboxEmpty says when none does.
- axe-core finds no WCAG 2.2 A or AA violation before hydration, after it, with a list open, with no results, and in the dark theme.
- The text, the chips, the items, the group labels, the empty state and the highlighted item keep 4.5:1 in both themes.
- The focus ring, the highlighted item, the chips and the edges stay visible in forced colors.
- The list fades in only without reduced motion; the chevron, the checks and the chips' keys mirror in right-to-left text; the page fits 320px with text at 200%, also with a list open.

Not checked, so not claimed:

- Screen readers (NVDA, JAWS, VoiceOver, TalkBack) weren't tested; support for `aria-activedescendant` and for live regions in a popover differs between them.
- Real input methods were only driven through Chromium's protocol; no IME was tested by hand, and Android keyboards that compose every word weren't tested.
- The browser's validation message was seen in Chromium; other engines draw it outside the page, where screenshots don't reach.
- Safari itself wasn't run, only Playwright's WebKit. Forced colors were emulated, not tested in Windows. Touch wasn't tested.
- This isn't an accessibility certification.
