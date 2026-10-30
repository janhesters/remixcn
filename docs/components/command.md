# Command

A command menu: a search field over a list of commands, filtered and sorted as you type, with keyboard and pointer selection, and a command dialog. It replaces [cmdk](https://github.com/dip/cmdk), which shadcn's Command wraps, without its code.

- Source: `registry/ui/command.tsx`. Needs `registry/ui/dialog.tsx`, `registry/lib/composite.ts`, `icons.tsx`, `styles.ts` and `theme.css`.
- Examples: `registry/examples/command-example.tsx`. Run them with `bun run command-examples` (http://localhost:4419/), and `bun run capture:command-examples` writes the screenshots in `docs/images/command/`.
- Upstream: shadcn/ui [`command.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/command.tsx), its [examples](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/examples/command-example.tsx) and [docs](https://ui.shadcn.com/docs/components/base/command), and cmdk 1.1.1, the version shadcn pins, for the behavior.

## Usage

```tsx
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '#remixcn/ui/command.tsx'

<Command label="Search commands">
  <CommandInput placeholder="Type a command or search…" />
  <CommandList>
    <CommandEmpty>No results found.</CommandEmpty>
    <CommandGroup heading="Suggestions">
      <CommandItem onSelect={openCalendar}>Calendar</CommandItem>
      <CommandItem onSelect={openCalculator}>Calculator</CommandItem>
    </CommandGroup>
    <CommandSeparator />
    <CommandGroup heading="Settings">
      <CommandItem keywords={['account']} onSelect={openProfile}>
        <span>Profile</span>
        <CommandShortcut>⌘P</CommandShortcut>
      </CommandItem>
    </CommandGroup>
  </CommandList>
</Command>
```

In a dialog, put the Command in `CommandDialog` and control `open`:

```tsx
<CommandDialog open={open} onOpenChange={(next) => ((open = next), void handle.update())}>
  <Command>
    <CommandInput placeholder="Type a command or search…" />
    <CommandList>…</CommandList>
  </Command>
</CommandDialog>
```

## How it runs

- **A native input with the combobox role.** `CommandInput` renders `<input type="text" role="combobox">` with `aria-autocomplete="list"`, `aria-expanded="true"` and `aria-controls` pointing at the list. Focus stays in it. The keys move a highlight through the options with `aria-activedescendant`, through the shared `activeDescendant` helper of `composite.ts`.
- **The list is a listbox.** `CommandList` renders `role="listbox"`, each `CommandItem` an option with `aria-selected`, and each `CommandGroup` a `role="group"` named by its heading.
- **Nothing runs by itself.** Enter or a click calls the item's `onSelect`. Command adds no global key, runs no command and sends no request. `CommandShortcut` is text.
- **Filtering and sorting.** Each item registers its value, keywords and state with the `Command` root as it renders. As you type, the root scores every item, hides those that score 0 with the `hidden` attribute, and shows the rest best first. It sorts with the CSS `order` of each item within its group and of each group within the list, so the DOM keeps your order and Remix keeps owning it. Equal scores keep your order. The keys follow the order on screen, and while a search sorts the list, each option carries `aria-posinset` and `aria-setsize` in that order.
- **On the server.** Command renders every item, nothing highlighted, no empty state, and a disabled input, so a page whose script never runs shows the commands and doesn't promise a search. In the browser, inside your client entry, the input turns on and the first item lights up. A search a controlled input starts with shows in the input, and filters once the command runs.
- **In the browser.** The parts run inside your client entry, as the examples do. They aren't client entries themselves: Remix serializes an entry's props to JSON, which drops `onSelect`, `filter` and your mixins, and renders an entry's component children to static HTML, which would freeze the list.

## Keys

The keys work in the input.

| Key | What it does |
| --- | --- |
| Arrow Down, Arrow Up | The next or previous item, past disabled ones. Without `loop`, the ends stay put |
| Home, End | The first or last item. In the input they don't move the caret, as in cmdk |
| Ctrl+N or Ctrl+J, Ctrl+P or Ctrl+K | Down or up, unless `vimBindings={false}` |
| Meta+Arrow Down, Meta+Arrow Up | The last or first item |
| Alt+Arrow Down, Alt+Arrow Up | The first item of the next or previous group, or the next or previous item when there's no other group |
| Enter | Runs the highlighted item's `onSelect`. It never sends a form around the command, also with nothing highlighted |
| Escape | Nothing in Command. In a `CommandDialog`, the dialog closes and focus returns to its trigger |
| Arrow Left, Arrow Right, typing | Edit the search |

A key that finishes an input method composition stays with the input method. Your own `keydown` handler on `CommandInput` runs first, and `preventDefault()` there keeps Command out of it.

## Filtering and ranking

`defaultCommandFilter(value, search, keywords)` scores from 0, which hides an item, to 1. Case, accents and repeated spaces don't count.

| Match | Score |
| --- | --- |
| The whole value | 1 |
| The start of the value | 0.9 |
| The start of a word, after a space, a dash, a slash or other punctuation | 0.8 |
| Inside a word | 0.6 |
| Every word of the search, in any order | 0.5 |
| The letters of the search in order | 0.1 to 0.4, higher the closer they sit |
| None of that | 0 |

A keyword scores 0.95 of the same match on the value, so a value wins a tie. Items outside a group come first, then the groups, each sorted by its best item, as cmdk sorts them. Anything else in the list, such as a separator that always renders, keeps its place before them.

Pass `filter` to score items your way, with the same signature. Pass `shouldFilter={false}` to filter yourself: Command then hides and sorts nothing, and you render only the items that match, in your order.

## API

### `Command`

The root: holds the search and the highlighted item, and filters and sorts its items. It renders a `<div>` and takes its props, and:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `label` | `string` | `'Command menu'`, or the title of a `CommandDialog` | Names the input for assistive technology |
| `shouldFilter` | `boolean` | `true` | With `false`, you filter: Command hides and sorts nothing |
| `filter` | `(value, search, keywords) => number` | `defaultCommandFilter` | Scores each item, from 0 to hide it to 1. A new filter during a search is like a new search for what shows; when the highlighted item stops showing, the first result lights up |
| `value` | `string` | | The highlighted item's value, for a command you control. Render the new value from `onValueChange` |
| `defaultValue` | `string` | | The value to highlight first, for a command that keeps its own state |
| `onValueChange` | `(value) => void` | | Called when another item lights up, through the keys, the pointer or a new search |
| `loop` | `boolean` | `false` | Whether the arrow keys wrap around |
| `disablePointerSelection` | `boolean` | `false` | Keeps the pointer from moving the highlight. A click still runs the item |
| `vimBindings` | `boolean` | `true` | Ctrl+N, Ctrl+J, Ctrl+P and Ctrl+K |

The root also renders a visually hidden `role="status"`, which says the empty state's text when it appears.

### `CommandInput`

The search field: a native `<input type="text" role="combobox">` inside a rounded group with a search icon at the start. It takes the props of `<input>`, except `type`, `role`, `id` and `aria-activedescendant`, which Command owns, and:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `value` | `string` | | The search, for an input you control. Render the new value from `onValueChange` |
| `defaultValue` | `string` | `''` | The first search, for an input that keeps its own |
| `onValueChange` | `(search) => void` | | Called on every change of the search |

It's named by your `aria-label` or `aria-labelledby`, else by `label` on `Command`, else by the title of a `CommandDialog` around it. It's disabled until the command runs in the browser, with `disabled`, and in a disabled fieldset.

In a form, a reset returns the input to `defaultValue`, and the search follows. `onValueChange` tells a controlled owner, and an owner that keeps its search keeps it in the input too. The input has no `name` unless you give it one, and Enter never sends the form.

### `CommandList`

The listbox, `role="listbox"`, which scrolls when it gets taller than 18rem. It scrolls itself, and never the page, so the highlighted item shows, its group's heading with the first item; a command that mounts or hydrates below the fold leaves the reader where they are. `label` names it (defaults to `'Suggestions'`, as cmdk). A press in the list keeps focus in the input.

### `CommandEmpty`

Shows its children when no item matches, from the time the command runs. A listbox holds only options, so the element is `aria-hidden` and the root's status says its text instead. Items with `forceMount` don't count as matches.

### `CommandGroup`

A group with a heading. It renders a `<div>` with the heading (`aria-hidden`, `data-slot="command-group-heading"`) and a `role="group"` named by it. It hides while none of its items show.

| Prop | Type | What it does |
| --- | --- | --- |
| `heading` | `RemixNode` | The heading, which also names the group |
| `value` | `string` | Written as `data-value` |
| `forceMount` | `boolean` | Keeps the group and its items in view whatever the search |

### `CommandItem`

One command: an option that lights up under the pointer and the keys. It takes the props of `<div>`, except `role` and `id`, and:

| Prop | Type | What it does |
| --- | --- | --- |
| `value` | `string` | What the search matches and `onSelect` receives. Defaults to the item's text without its shortcut, read from the JSX on the server and from the page in the browser. Give a stable, unique one when the text changes or repeats |
| `keywords` | `string[]` | Other names the search matches |
| `disabled` | `boolean` | Shows the item dimmed, skips it with the keys and the pointer, and never runs it. `aria-disabled="true"` |
| `checked` | `boolean` | `true` shows a check at the end, `false` keeps its place. `aria-checked` tells assistive technology |
| `forceMount` | `boolean` | Keeps the item in view whatever the search. It doesn't count as a match |
| `onSelect` | `(value, event) => void` | Called on a click, or on Enter while the item is highlighted. `preventDefault()` in your own click handler stops it |

It renders `data-slot="command-item"`, `data-value`, `data-selected` while highlighted, `data-disabled`, and `data-checked="true"` or `"false"`.

### `CommandSeparator`

A line between groups, hidden while a search filters the list unless `alwaysRender`. It's `aria-hidden`, since a listbox holds only options and groups.

### `CommandShortcut`

A `<span>` at the end of an item for the keys of a command, as text. Command listens for none of them: wire a key yourself, as the Keyboard shortcut example does, and say so in the text.

### `CommandDialog`

A Command in a modal [Dialog](dialog.md), a third of the way down the screen. It takes Dialog's props (`open`, `defaultOpen`, `onOpenChange`, `onOpenChangeComplete`, `modal`, `disablePointerDismissal`), DialogContent's `initialFocus` and `finalFocus`, `mix` for the surface, and:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `title` | `string` | `'Command Palette'` | The dialog's name, hidden on screen. It also names the input |
| `description` | `string` | `'Search for a command to run...'` | The dialog's description, hidden on screen |
| `showCloseButton` | `boolean` | `false` | Shows the corner close button |

Its children are mounted afresh each time it opens, so the search starts empty and the first item lights up, as when Base UI renders the popup again. Escape closes it and focus returns to the trigger, as with Dialog.

### Also exported

- `defaultCommandFilter` and the type `CommandFilter`.
- `getCommandContext(handle, part)`, in place of cmdk's `useCommandState()`. A part you build inside a Command reads the `search`, the highlighted `value`, the `count` of matches and whether the command is `ready`, and renders again on every change.
- The types `CommandProps`, `CommandInputProps`, `CommandListProps`, `CommandGroupProps`, `CommandItemProps`, `CommandSeparatorProps`, `CommandDialogProps` and `CommandContext`.

## Composition

```text
CommandDialog, optional
└── Command
    ├── CommandInput
    └── CommandList
        ├── CommandEmpty
        ├── CommandGroup
        │   ├── CommandItem
        │   │   └── CommandShortcut
        │   └── CommandItem
        ├── CommandSeparator
        └── CommandGroup
```

- **One input.** Command needs its `CommandInput` for the keyboard: the input holds focus and the keys.
- **Items you render in your own component** register like any other, also in a component that updates by itself. Items that come, go, change or move during a search keep the highlight on a live item: when the highlighted one leaves, hides or is disabled, the first item lights up. A list whose items all leave has no highlight, and Enter runs nothing.
- **Items your styles hide**, such as with `display: none`, `visibility: hidden` or a hidden or inert box around them, never light up or run, also when they match the search. When an item stops showing, the highlight moves to the first item that shows, before any key: Command watches the `class`, `style`, `hidden`, `inert` and `open` attributes of the items, of the boxes inside the command and of every box around it, and the size of each item. A change no attribute or size shows, such as a style sheet's media query toggling `visibility`, is caught before the next key acts, and Enter never runs a hidden item. Hidden items still count as matches for `CommandEmpty`.
- **Your own filtering.** With `shouldFilter={false}`, keep the search in your state with `onValueChange` on the input, and render the matching items, as the Your filter example does. Command still moves the highlight, runs items and shows `CommandEmpty`.
- **A palette that closes.** Close the dialog from `onSelect`: set `open` to `false`. Focus returns to the trigger.
- **Opening without a script.** `CommandDialog` renders its own Dialog root, so its opener is your button. A button that sets state does nothing before your script runs, so the examples disable theirs until then. For a palette that opens before hydration, compose `Dialog`, `DialogTrigger`, `DialogContent` and a `Command` yourself.
- **Overrides.** A `css()` you pass with `mix` renders after the part's own rule, so it wins.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `Command` on cmdk's `Command` | `Command` | Same props: `label`, `shouldFilter`, `filter`, `value`, `defaultValue`, `onValueChange`, `loop`, `disablePointerSelection`, `vimBindings`. `onValueChange` also fires for a command that keeps its own state, which cmdk skips |
| cmdk's hidden `<label>` | `aria-label` on the input, or `aria-labelledby` to a `CommandDialog`'s title | `label` defaults to `'Command menu'`, so the input always has a name |
| cmdk's `tabIndex={-1}` root with the keys | The keys on the input | The input holds focus; nothing else needs it |
| cmdk's `command-score` | `defaultCommandFilter` | New code with its own ranking, above. The filter signature is cmdk's |
| Sorting by moving DOM nodes | CSS `order` on items and groups | The DOM keeps your order, which Remix owns. The keys, `aria-posinset` and `aria-setsize` follow the order on screen |
| `CommandInput` on `Command.Input` in an `InputGroup` with a search addon | `CommandInput` | A native input with the same attributes. RemixCN has no Input Group yet (its own ticket), so the group, its search icon and its fill are drawn by Command. Disabled until the command runs |
| `value`, `onValueChange` on the input | Same, plus `defaultValue` | |
| `CommandList` on `Command.List` | `CommandList` | Same `label` default. The `--cmdk-list-height` variable and its sizer aren't ported: the list's height comes from CSS. A press in the list keeps focus in the input |
| `CommandEmpty` on `Command.Empty` | `CommandEmpty` | `aria-hidden`, with its text said by the root's status, so axe-core passes and the empty state is announced |
| `CommandGroup` on `Command.Group` | `CommandGroup` | Same `heading`, `value`, `forceMount` and structure: a heading hidden from assistive technology that names a `role="group"` |
| `CommandSeparator` on `Command.Separator` | `CommandSeparator` | Same `alwaysRender`. `aria-hidden` instead of `role="separator"`, which a listbox can't hold. shadcn's `-mx-1` isn't ported: the list clips it |
| `CommandItem` on `Command.Item` | `CommandItem` | Same `value`, `keywords`, `disabled`, `forceMount` and `onSelect`, which also gets the event. The value without a prop leaves out the shortcut's text, which cmdk keeps |
| `data-[checked=true]` on an item shows its check | `checked` | Writes `data-checked` and `aria-checked`. Only items with `checked` keep a place for the check, so a narrow item has room for its text |
| `data-selected="true"`, `data-disabled="true"` | `data-selected`, `data-disabled` while they apply | Plus `aria-selected` and `aria-disabled` |
| `CommandShortcut` | Same | Text at the item's end, in its own direction (`unicode-bidi: plaintext`), so ⌘P stays ⌘P in right-to-left text. It wraps rather than overflow at 320px with text at 200% |
| `CommandDialog` on Base UI's Dialog | `CommandDialog` on RemixCN's Dialog | Same `title`, `description` and `showCloseButton` defaults. The hidden header sits inside the dialog, not before it, so the page has no stray heading. `className` becomes `mix` |
| Base UI unmounting the popup when it closes | A fresh Command each time the dialog opens | RemixCN's Dialog keeps its content in the document |
| `Command.Loading` | Not ported | shadcn exports no Loading part. Show your own status inside the list while you load |
| `Command.Dialog` (cmdk's Radix dialog) | Not ported | shadcn uses its own `CommandDialog` |
| `useCommandState(selector)` | `getCommandContext(handle, part)` | Read during render; parts render again on every change |
| `asChild` on cmdk's parts | Not ported | Pass your mixins with `mix` |
| `cn-command-*` classes in `style-vega.css` | One `css()` rule per part with the same measures | Tailwind classes become theme tokens. `ml-auto` becomes `margin-inline-start: auto`, so shortcuts and checks sit at the end in right-to-left text |
| Example file: Inline | `CommandInline` | In a Card, with keywords, and a status that says what you picked |
| Example file: Basic, With Shortcuts, With Groups, Many Groups & Items | `CommandBasic`, `CommandWithShortcuts`, `CommandWithGroups`, `CommandManyItems` | Each item closes the dialog and says what you picked |
| Docs: Dialog with ⌘J | `CommandWithKeyboardShortcut` | The example listens for Ctrl+J or ⌘J itself, leaves keys the palette used alone, and stops listening when it leaves the page |
| Docs: RTL | `CommandRtl` | Arabic labels in a right-to-left Command |
| — | `CommandYourFilter`, `CommandChecked` | `shouldFilter={false}` with invented customers, and checked and disabled items |

### Where it looks different from shadcn

- **A focus ring around the search field**, which shadcn hides, and **on the highlighted item while the input has focus**, besides its `--muted` fill. The highlight's fill alone is about 1.1:1 against the surface, below the 3:1 a focus indicator needs. In forced colors, the highlighted item has a thin outline, and a thick one while the input has focus.
- **The light search field is filled with `--muted`**, the color shadcn's `bg-input/30` makes. RemixCN's light `--input` is darker, for the 3:1 of control borders, so 30% of it would read as a gray bar.
- **The list shows a thin scrollbar** when it scrolls; shadcn hides it.
- **Long items wrap**, and shortcuts wrap rather than overflow, so the list fits 320px with text at 200%.
- **The dialog's top** sits a third of the way down, as in shadcn, and moves up on a short screen so the whole command fits; its list scrolls inside.

## Accessibility checks

Automated, in Chromium, Firefox and WebKit (`bun run test`, `test:browser`, `test:e2e`):

- The server renders a disabled, named combobox that controls a named listbox, every option unhighlighted with its own id, groups named by their headings, the dialog's title and description inside the closed dialog, and no stale `aria-activedescendant`. Each instance has its own ids.
- Without JavaScript, the commands show, the search is off and the openers are disabled. axe-core finds no WCAG 2.2 A or AA violation before hydration, after it, with a search in the dialog, and in the empty state.
- Searching, ranking, keywords, your filter, `shouldFilter={false}`, groups and separators that hide, `forceMount`, `alwaysRender`, and the empty state, which the status announces.
- The arrow keys, Home, End, Ctrl+N, Ctrl+J, Ctrl+P, Ctrl+K, Meta and Alt with the arrows, `loop`, disabled items skipped, Left and Right left to the caret, and keys during a composition left to the input method.
- Enter and clicks run only the highlighted, visible, enabled item; Enter never sends a form; your handlers cancel Command's keys and an item's click. `aria-activedescendant` never points at a hidden, removed or disabled item while items come, go, change, move or all leave during a search, nor at an item your styles or a hidden or inert box around it hide, also when they hide it later through a class, an inline style or `inert`, before any key. A filter replaced during a search lights up the result that shows. Mounting below the fold scrolls nothing, and the keys scroll only the list.
- Pointer hover, `disablePointerSelection`, a press in the list keeping focus in the input, controlled values and searches, an owner that declines a change, a form reset, several commands on a page, and removal.
- `CommandDialog`: named by its title, input focused on open, also when it starts open; Escape and a picked item close it and return focus; an owner can cancel the close; it starts afresh each time it opens.
- Text, shortcuts, headings and the placeholder keep 4.5:1 in both themes. The focus rings show, also in forced colors. The icon, shortcuts and checks mirror in right-to-left text. The page and the open dialog fit 320px without scrolling sideways, also with text at 200%.

Not checked, so not claimed:

- Screen readers (NVDA, JAWS, VoiceOver, TalkBack) weren't tested, including how they read options that CSS sorts and the empty state's announcement.
- Safari itself wasn't run, only Playwright's WebKit. Forced colors were emulated in Chromium, not tested in Windows.
- Touch screens and on-screen keyboards weren't tested.
- This isn't an accessibility certification.
