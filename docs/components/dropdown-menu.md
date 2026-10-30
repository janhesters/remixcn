# Dropdown Menu

A menu of actions that opens from a button, in a native `popover` element in the top layer. A click, Enter, Space or Arrow Down opens it; the arrow keys, Home, End and typing move between its items; Enter, Space and a click choose one. Escape, a press elsewhere and Tab close it, and focus goes back to the button. Submenus open on hover, a click, Enter or the arrow that points at them. Checkbox and radio items keep their state and announce it.

`dropdown-menu.tsx` is also the menu engine that [Context Menu](context-menu.md) and [Menubar](menubar.md) build on, as shadcn's Menubar builds on its Dropdown Menu.

- Source: `registry/ui/dropdown-menu.tsx`. Needs `registry/lib/theme.css`, `styles.ts`, `icons.tsx`, `composite.ts`, `layer.ts`, `focus-scope.ts`, `modal.ts`, `anchor-position.ts` and `hover-intent.ts`.
- Examples: `registry/examples/dropdown-menu-example.tsx`. Run them with `bun run menu-examples`.
- Upstream: shadcn/ui [`dropdown-menu.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/dropdown-menu.tsx), its [docs](https://ui.shadcn.com/docs/components/base/dropdown-menu), and [Base UI Menu](https://base-ui.com/react/components/menu.md).

## Usage

```tsx
import { buttonVariants } from '#remixcn/ui/button.tsx'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '#remixcn/ui/dropdown-menu.tsx'

<DropdownMenu>
  <DropdownMenuTrigger mix={buttonVariants({ variant: 'outline' })}>Account</DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuGroup>
      <DropdownMenuLabel>My account</DropdownMenuLabel>
      <DropdownMenuItem mix={on('click', openProfile)}>
        Profile <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
      </DropdownMenuItem>
    </DropdownMenuGroup>
    <DropdownMenuSeparator />
    <DropdownMenuItem variant="destructive">Sign out</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

The parts run in the browser inside your client entry, like Button: they take your mixins, which can't cross from the server into an entry. Put the menu in a component you mark with `clientEntry(...)`, as the examples do.

## API

### `DropdownMenu`

Groups the parts and holds whether the menu is open. It renders no element.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `open` | `boolean` | | Whether it's open, for a menu you control. Update it from `MenuOpenChangeEvent` |
| `defaultOpen` | `boolean` | `false` | Whether it starts open. A menu open from the start leaves focus where it is |
| `modal` | `boolean` | `true` | Whether the page waits while it's open: it can't be scrolled, and a press outside only closes the menu. A menu opened on hover is never modal |
| `disabled` | `boolean` | `false` | Disables its trigger and closes the menu, which stays closed once enabled again |
| `orientation` | `'vertical' \| 'horizontal'` | `'vertical'` | The arrows that move between the items: Up and Down, or Left and Right |
| `loopFocus` | `boolean` | `true` | Whether the arrows wrap from the last item to the first |
| `highlightItemOnHover` | `boolean` | `true` | Whether the pointer highlights the item under it |

### `DropdownMenuTrigger` and `dropdownMenuTrigger()`

`DropdownMenuTrigger` is a native `<button type="button">`. It takes every button prop, `mix`, and `openOnHover` (`false`), `delay` (`100`) and `closeDelay` (`0`), which open the menu while the pointer rests on it. Give it a Button's look with `mix={buttonVariants({ variant: 'outline' })}`.

`dropdownMenuTrigger(options)` makes any element the trigger and keeps the element's own `data-slot`. A click opens the menu with focus on the menu itself; Enter and Space open it at the first item, Arrow Down at the first and Arrow Up at the last. A trigger you disable, with `disabled`, `aria-disabled="true"` or a disabled `<fieldset>` around it, opens nothing, also on hover: hover checks the trigger when the pointer arrives and again when the delay ends. One in a disabled fieldset's first `<legend>` stays usable, as the browser keeps it enabled. The trigger renders `aria-haspopup="menu"`, `aria-controls`, `aria-expanded` once the menu runs, `data-popup-open` while open, and an `id` the menu's `aria-labelledby` points at (yours, if you give one).

### `DropdownMenuContent` and `DropdownMenuSubContent`

The menu: a `<div role="menu" tabindex="-1">` in the top layer. Inside a `DropdownMenuSub` it is the submenu's content, and `DropdownMenuSubContent` is the same component. It takes every `div` prop but `id` and `role`, `mix`, and:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `side` | `'top' \| 'bottom' \| 'left' \| 'right' \| 'inline-start' \| 'inline-end'` | `'bottom'`, `'inline-end'` in a submenu | The side of the trigger. Inline sides follow the text direction |
| `sideOffset` | `number` | `4`, `0` in a submenu | The gap to the trigger, in pixels |
| `align` | `'start' \| 'center' \| 'end'` | `'start'` | The alignment along that side |
| `alignOffset` | `number` | `0`, `-3` in a submenu | A shift away from the aligned edge, in pixels |
| `collisionPadding` | `number` | `5` | Space to keep from the viewport's edges |
| `collisionBoundary` | `Element \| null` | | An element whose box also limits where it goes |
| `collisionAvoidance` | `{ side?: 'flip' \| 'none'; align?: 'shift' \| 'none' }` | flip and shift | Whether it flips and shifts to stay in view |
| `finalFocus` | `HTMLElement \| (() => HTMLElement \| null) \| false` | the trigger | What to focus when it closes, or `false` to leave focus alone |

It's as wide as its trigger and at least 8rem, as in shadcn: give it a width with `mix={css({ width: '14rem' })}`. It's never wider or taller than the room beside the trigger, and scrolls what doesn't fit. It renders `data-open` or `data-closed`, and while open `data-side`, `data-align`, `data-anchor-hidden` and the CSS variables `--anchor-width`, `--anchor-height`, `--available-width`, `--available-height` and `--transform-origin`.

### `DropdownMenuItem`

A `<div role="menuitem" tabindex="-1">`. Listen for `click` to run it: the pointer, Enter and Space all click it. A click you cancel with `preventDefault()` keeps the menu open and the item highlighted. It takes every `div` prop but `role`, `mix`, and:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `disabled` | `boolean` | `false` | Keeps it from being highlighted and run. It renders `aria-disabled="true"` and `data-disabled`, and no click reaches your listeners |
| `inset` | `boolean` | `false` | Lines its text up with items that have an icon or a check |
| `variant` | `'default' \| 'destructive'` | `'default'` | Colors an item that deletes or can't be undone |
| `closeOnClick` | `boolean` | `true` | Whether running it closes the menu |
| `label` | `string` | its text | The text typing matches |

### `DropdownMenuLinkItem`

A native `<a role="menuitem">` that navigates as any link does, also before the menu runs. It takes every link prop, `inset`, `label` and `closeOnClick` (`true`). It replaces shadcn's `render={<a />}` and Base UI's `Menu.LinkItem`.

### `DropdownMenuCheckboxItem`

A `<div role="menuitemcheckbox" aria-checked>` with a check at its end. Choosing it toggles it and keeps the menu open. Takes `checked`, `defaultChecked`, `disabled`, `inset`, `closeOnClick` (`false`) and `label`. Before it changes it dispatches `MenuCheckedChangeEvent`, which bubbles; cancel it to keep the state.

### `DropdownMenuRadioGroup` and `DropdownMenuRadioItem`

The group is a `<div role="group">` with `value`, `defaultValue` and `disabled`. Before another item gets checked, it dispatches `MenuValueChangeEvent` with the item's `value`, which bubbles; cancel it to keep the value. Each item is a `<div role="menuitemradio" aria-checked>` with a required `value`, `disabled`, `inset`, `closeOnClick` (`false`) and `label`.

### `DropdownMenuGroup` and `DropdownMenuLabel`

A `<div role="group">`, and a `<div>` heading with `inset`. A label inside a group or a radio group names it through `aria-labelledby`: the group finds a label among its children, inside host elements, so the server renders the link; a label inside your own component is linked once the menu runs.

### `DropdownMenuSeparator` and `DropdownMenuShortcut`

A `<div role="separator">` drawn as a border, and a `<span>` for the keys that run an item, at its end.

### `DropdownMenuSub` and `DropdownMenuSubTrigger`

`DropdownMenuSub` groups a submenu and holds whether it's open: `open`, `defaultOpen`, `disabled`, `closeParentOnEsc` (`false`), `loopFocus` and `highlightItemOnHover`. `DropdownMenuSubTrigger` is an item of the outer menu, `<div role="menuitem" aria-haspopup="menu" aria-expanded>`, with a chevron that turns in right-to-left text. It takes `inset`, `label`, `openOnHover` (`true`), `delay` (`100`) and `closeDelay` (`0`).

### `DropdownMenuPortal`

shadcn's portal part. The content shows in the browser's top layer, which does what the portal did, so `DropdownMenuPortal` renders its children where they are.

### Events

| Event | On | Fields | Bubbles | Cancel to |
| --- | --- | --- | --- | --- |
| `MenuOpenChangeEvent` (`menuOpenChangeType`) | the content | `open`, `reason`, `cause` | no, so a submenu's stays its own | keep it open or closed |
| `MenuCheckedChangeEvent` (`menuCheckedChangeType`) | the checkbox item | `checked`, `cause` | yes | keep the item as it is |
| `MenuValueChangeEvent` (`menuValueChangeType`) | the radio group | `value`, `cause` | yes | keep the value |

`reason` is `'trigger-press'`, `'trigger-hover'`, `'item-press'`, `'list-navigation'` (an arrow key opened or closed it), `'escape-key'`, `'outside-press'`, `'focus-out'` (Tab, or focus moved elsewhere), `'sibling-open'` (another menu of a menubar opened), `'parent-dismissed'` (its outer menu closed) or `'trigger-removed'`.

```tsx
<DropdownMenuCheckboxItem checked={shown} mix={on(menuCheckedChangeType, (event) => { shown = event.checked; handle.update() })}>
```

### For other menu families

`MenuRoot` is the engine behind `DropdownMenu`, `ContextMenu` and `MenubarMenu`, with `family`, `nested` and a `group` that ties sibling menus together. `useMenu(handle)` reads the menu a part is in, `menuOfTrigger(element)` the menu a trigger opens, and `MenuApi`, `MenuController`, `MenuGroup`, `MenuFamily`, `MenuFocus` and `MenuOpenOptions` type them. Use them to build another menu family; for a dropdown, use the parts above.

### Also exported

The types `DropdownMenuProps`, `DropdownMenuTriggerProps`, `DropdownMenuTriggerOptions`, `DropdownMenuContentProps`, `DropdownMenuSubContentProps`, `DropdownMenuItemProps`, `DropdownMenuLinkItemProps`, `DropdownMenuCheckboxItemProps`, `DropdownMenuRadioGroupProps`, `DropdownMenuRadioItemProps`, `DropdownMenuLabelProps`, `DropdownMenuSubProps`, `DropdownMenuSubTriggerProps`, `MenuRootProps`, `MenuOpenChangeReason` and `CollisionAvoidance`.

## Composition

- **Without JavaScript.** Until the menu runs, the trigger opens it natively with `popovertarget`. The browser shows it in the middle of the screen, Escape or a press elsewhere closes it, and its link items work. The other items, the keys and submenus need the script. A menu the browser opened before the script ran stays open and moves below its trigger.
- **Keys.** Arrow Down and Up move between the items (Arrow Right and Left in a horizontal menu, mirrored in right-to-left text), past disabled and hidden ones, wrapping unless `loopFocus` is `false`; from the menu itself, after a pointer opened it, they start at the first or last item. Home and End jump to the ends; letters jump to the next item that starts with them. Arrow Right opens a submenu at its first item and Arrow Left closes it, swapped in right-to-left text. Escape closes only the topmost menu, unless the submenu has `closeParentOnEsc`. Tab and Shift+Tab close every menu and move focus to the element after or before the trigger, as from a native select. The menu moves focus itself, since Firefox skips its own move once focus changed during the key.
- **Pointer.** The pointer highlights the item under it by focusing it, and leaving the items clears the highlight while the menu keeps focus for the keys. A submenu opens after the pointer rests on its item for 100ms, stays open while the pointer crosses to it, and closes when the pointer highlights another item.
- **Modal.** By default, the rest of the page is inert and doesn't scroll while the menu is open, so a press outside only closes it. The trigger stays usable, so it can close the menu, and so does a menubar around it. A menu the pointer opened leaves the page alone, and so do submenus.
- **Items that come and go.** When the focused item leaves the document, focus moves to the item that took its place, or to the menu, so the keys keep working.
- **Open by default.** On the server and until the menu runs, it renders closed. Once it runs, a menu open from the start leaves focus where it is, so several can start open at once.
- **In a dialog.** A menu inside a modal `<dialog>` shows above it, and Escape closes the menu before the dialog.
- **Stays in the document.** The content renders while closed, hidden, so the trigger's `aria-controls` always points at it. A submenu's content sits inside its outer menu's, which is how presses and focus in it count as inside the outer menu.
- **Overrides.** A `css()` you pass with `mix` renders after the part's own rule, so it wins.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `DropdownMenu` on Base UI's `Menu.Root` | `DropdownMenu` on `MenuRoot` | |
| Root `open`, `defaultOpen`, `modal`, `disabled`, `orientation`, `loopFocus`, `highlightItemOnHover` | Same | A menu open from the start doesn't take focus |
| Root `onOpenChange` | `MenuOpenChangeEvent` on the content | Cancelable, like `eventDetails.cancel()`; `allowPropagation` isn't needed: nothing stops your events |
| Root `onItemHighlighted` | `focusin` on the content | The highlighted item is the focused one |
| Root `closeParentOnEsc` | On `DropdownMenuSub` | Only submenus use it |
| Root `actionsRef`, `onOpenChangeComplete` | Not ported | No exit animation to wait for: the menu hides at once |
| Root `handle`, `triggerId`, `defaultTriggerId`, Trigger `payload`, detached and multiple triggers | Not ported | One trigger per menu |
| `DropdownMenuTrigger` on `Menu.Trigger` | `DropdownMenuTrigger` and `dropdownMenuTrigger()` | The mixin replaces `render` and `nativeButton` |
| Trigger `openOnHover`, `delay`, `closeDelay`, `disabled` | Same | `disabled` is the button's own; the root's `disabled` disables it too |
| Trigger `data-popup-open`, `data-disabled` | Same | `data-pressed` isn't ported |
| `DropdownMenuPortal` on `Menu.Portal` | `DropdownMenuPortal` | Renders its children; the top layer replaces the portal and its `container`, `keepMounted` is always on |
| `DropdownMenuContent` on `Portal`, `Positioner` and `Popup` | `DropdownMenuContent`, a native popover | |
| Positioner `side`, `align`, `sideOffset`, `alignOffset`, `collisionPadding`, `collisionBoundary`, `collisionAvoidance` | Same, with shadcn's defaults | Offsets are numbers; `collisionBoundary` takes an element |
| Positioner `anchor`, `sticky`, `positionMethod`, `disableAnchorTracking`, `arrowPadding` | Not ported | Placed against the trigger, fixed, tracked, and hidden while the trigger is out of view |
| Popup `finalFocus` | Same | Elements, functions or `false`; the interaction-type function form isn't ported |
| `data-open`, `data-closed`, `data-side`, `data-align`, `data-anchor-hidden`, CSS variables | Same | `data-starting-style`, `data-ending-style`, `data-instant` and `--positioner-*` aren't ported |
| `DropdownMenuItem` on `Menu.Item` | Same, `variant` and `inset` from shadcn | `onClick` becomes a `click` listener; `nativeButton` isn't needed |
| Item `label`, `closeOnClick`, `disabled`, `data-highlighted`, `data-disabled` | Same, highlight as `:focus` | A disabled item's clicks never reach your listeners |
| `Menu.LinkItem`, shadcn's `render={<a />}` | `DropdownMenuLinkItem` | A native link |
| `DropdownMenuCheckboxItem` on `Menu.CheckboxItem` and its indicator | Same, the check always drawn by the item | `onCheckedChange` becomes `MenuCheckedChangeEvent`; the indicator's `keepMounted` isn't ported |
| `DropdownMenuRadioGroup`, `DropdownMenuRadioItem` on `Menu.RadioGroup`, `RadioItem` | Same | `onValueChange` becomes `MenuValueChangeEvent`; values are strings |
| `DropdownMenuGroup`, `DropdownMenuLabel` on `Group`, `GroupLabel` | Same | The label names the group |
| `DropdownMenuSeparator`, `DropdownMenuShortcut` | Same | The separator is a border, kept in forced colors |
| `DropdownMenuSub`, `SubTrigger`, `SubContent` on `SubmenuRoot`, `SubmenuTrigger` | Same | A bridge across the gap, as wide as both boxes, replaces the safe triangle; the hover delay is Base UI's 100ms |
| `Menu.Arrow`, `Backdrop`, `Viewport`, `Empty`, `FilterProvider`, `Input`, `Clear`, `List` | Not ported | shadcn's menu doesn't use them; Command filters a list |
| Press, drag and release to choose | Not ported | A press opens the menu, a second press chooses |
| Classes in `style-vega.css` | Same measures and colors | `ring-1` becomes a border, `CanvasText` in forced colors; a keyboard focus ring joins the highlight; the translucent menu option of shadcn's theme builder isn't ported |
| Fade, zoom and slide in and out | A fade in | A transform would move the box the positioning measures; it closes at once |
| Examples: Basic, Sides, With Icons, With Shortcuts | `DropdownMenuBasic`, `DropdownMenuSides`, `DropdownMenuWithIcons` | Icons and shortcuts share one example |
| Examples: With Submenu, With Checkboxes, Checkboxes with Icons, With Radio Group, Radio with Icons | `DropdownMenuWithSubmenu`, `DropdownMenuWithCheckboxes`, `DropdownMenuWithRadio` | The icon variants are folded in |
| Examples: With Destructive Items, With Avatar, With Inset, Complex, In Dialog | `DropdownMenuWithDestructive`, `DropdownMenuWithAvatar`, `DropdownMenuWithInset`, `DropdownMenuComplex`, `DropdownMenuInDialog` | |

## Accessibility checks

Automated, in Chromium, Firefox and WebKit (`bun run test`, `test:browser`, `test:e2e`):

- The trigger is a button with `aria-haspopup="menu"`, `aria-controls` and `aria-expanded`; the menu has role `menu`, is named by the trigger, and holds `menuitem`, `menuitemcheckbox`, `menuitemradio`, `group` and `separator` roles, in the server HTML too. A group is named by its label.
- Enter, Space, Arrow Down and Arrow Up open it at the right item; the arrows, Home, End and typing move past disabled and hidden items; Enter and Space run an item and return focus to the trigger; Escape closes one menu at a time; Tab and Shift+Tab close it and move focus on in every engine.
- Checkbox and radio items change `aria-checked` and keep the menu open; a canceled change keeps the state; disabled items never run, by key, pointer or script.
- A submenu opens with Arrow Right, Enter or a resting pointer, closes with Arrow Left or Escape with focus back on its item, and swaps the arrows in right-to-left text.
- A canceled open leaves no layer, scroll lock or highlight behind; a canceled close keeps the menu and its highlight; a controlled menu follows its owner; a menu that becomes disabled closes, and one that starts open and disabled stays closed; a trigger the caller disabled opens nothing, by hover, click or key, also one a fieldset disables before or during the hover delay, while one in the fieldset's first legend opens.
- A modal menu makes the page inert and stops scrolling until it closes; unmounting it while open releases the page.
- Removing the focused item moves focus to its neighbor.
- Without JavaScript, the trigger opens the menu natively and its links work; a menu opened that way before the script ran stays open after hydration, below its trigger.
- axe-core finds no WCAG 2.2 A or AA violation with menus and submenus open, in both themes.
- An open menu fits a 320px viewport with text at 200%, and scrolls what doesn't fit; in forced colors its edge is `CanvasText` and the highlighted item keeps an outline.

Not checked, so not claimed:

- Screen readers (NVDA, JAWS, VoiceOver, TalkBack) weren't tested.
- Safari itself wasn't run, only Playwright's WebKit. Forced colors were emulated in Chromium, not tested in Windows.
- This isn't an accessibility certification.
