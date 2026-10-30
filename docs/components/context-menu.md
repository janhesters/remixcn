# Context Menu

A menu that opens where you right-click inside its area, at the focused element with Shift+F10 or the Context Menu key, and at your finger after a held touch. Inside, it is [Dropdown Menu](dropdown-menu.md)'s engine: the same items, groups, checkbox and radio items, submenus, keys and events.

- Source: `registry/ui/context-menu.tsx`. Needs `registry/ui/dropdown-menu.tsx` and its helpers, `registry/lib/theme.css`, `styles.ts` and `anchor-position.ts`.
- Examples: `registry/examples/context-menu-example.tsx`. Run them with `bun run menu-examples`.
- Upstream: shadcn/ui [`context-menu.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/context-menu.tsx), its [docs](https://ui.shadcn.com/docs/components/base/context-menu), and [Base UI Context Menu](https://base-ui.com/react/components/context-menu.md).

## Usage

```tsx
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '#remixcn/ui/context-menu.tsx'

<ContextMenu>
  <ContextMenuTrigger tabIndex={0}>Invoice INV-2041</ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem mix={on('click', open)}>Open</ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem variant="destructive">Delete</ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

Put it in a component you mark with `clientEntry(...)`, as the examples do. A context menu is a shortcut: offer its actions somewhere visible too, since touch and assistive technology users may never find it.

## API

### `ContextMenu`

Groups the parts and holds whether the menu is open. It renders no element. It takes Dropdown Menu's root props but `modal`: `open`, `defaultOpen`, `disabled`, `orientation`, `loopFocus` and `highlightItemOnHover`. A disabled context menu leaves the browser's own menu.

### `ContextMenuTrigger` and `contextMenuTrigger()`

`ContextMenuTrigger` is the area, a `<div>` that takes every `div` prop and `mix`. `contextMenuTrigger()` makes any element the area, such as a table row: `<tr tabIndex={0} mix={contextMenuTrigger()}>`.

- A right click opens the menu at the pointer, instead of the browser's menu, with focus on the menu.
- Shift+F10 and the Context Menu key open it below the start of the focused element in the area, at its first item. Make the area or something in it focusable, as with `tabIndex={0}`.
- A touch held still for half a second opens it at the finger. A touch that moves more than 10 pixels, scrolls the page or ends sooner is an ordinary touch, so the page scrolls and a tap follows a link; the tap that ends a held touch is swallowed.

The area renders `data-popup-open` and `data-pressed` while the menu is open, and `-webkit-touch-callout: none` with `user-select: none`, as shadcn's does.

### `ContextMenuContent` and the other parts

`ContextMenuContent` is `DropdownMenuContent` with the context menu's defaults: `side="inline-end"`, `sideOffset={0}`, `align="start"` and `alignOffset={4}`, against the point where it opened, and at least 9rem wide. Without a trigger button, the menu has no `aria-labelledby`; give it an `aria-label` when its items don't explain themselves.

`ContextMenuItem`, `ContextMenuLinkItem`, `ContextMenuCheckboxItem`, `ContextMenuRadioGroup`, `ContextMenuRadioItem`, `ContextMenuGroup`, `ContextMenuLabel`, `ContextMenuSeparator`, `ContextMenuShortcut`, `ContextMenuSub`, `ContextMenuSubTrigger`, `ContextMenuSubContent` and `ContextMenuPortal` are Dropdown Menu's parts under these names. Inside a context menu they render `data-slot="context-menu-…"`. See [Dropdown Menu](dropdown-menu.md#api) for their props.

### Events

`MenuOpenChangeEvent`, `MenuCheckedChangeEvent` and `MenuValueChangeEvent`, with their type constants, are re-exported. A right click or the keys open the menu with `reason: 'trigger-press'`.

### Also exported

The types `ContextMenuProps`, `MenuOpenChangeReason`, and the props of every part under its context menu name, such as `ContextMenuItemProps`.

## Composition

- **While open.** The rest of the page waits, as behind a native context menu: it doesn't scroll, and a press elsewhere only closes the menu. Another right click inside the area moves the menu there; one outside closes it and lets the browser show its own menu.
- **A menu inside its area.** A menu can sit inside its area, such as in a table cell when the area is a row, since a row holds only cells. Its own right clicks, keys and touches don't reopen it.
- **Focus.** Escape and a chosen item return focus to the element focused when the menu opened. Tab and Shift+Tab close it and move focus on from there.
- **Without JavaScript.** A right click shows the browser's menu. Nothing in the area depends on the menu.
- **Edges.** Near the edges of the window, the menu flips to the other side of the pointer and shifts to stay in view.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `ContextMenu` on Base UI's `ContextMenu.Root` | `ContextMenu` on Dropdown Menu's `MenuRoot` | Root props as in [Dropdown Menu](dropdown-menu.md#source-and-behavior-map); `onOpenChange` becomes `MenuOpenChangeEvent` |
| `ContextMenuTrigger` on `ContextMenu.Trigger` | `ContextMenuTrigger` and `contextMenuTrigger()` | The mixin replaces `render` |
| Right click, long press | Same | The long press waits 500ms and gives way to scrolling and moving, as Base UI's does |
| — | Shift+F10 and the Context Menu key | Base UI waits for the browser's own `contextmenu` event, which not every browser sends for them |
| Trigger `data-popup-open`, `data-pressed` | Same | |
| `ContextMenuContent` on `Portal`, `Positioner` and `Popup` | Dropdown Menu's content, a native popover at the pointer | shadcn's defaults; `side="right"` becomes `'inline-end'`, so it opens to the left in right-to-left text |
| `ContextMenuItem`, `CheckboxItem`, `RadioGroup`, `RadioItem`, `Group`, `Label`, `Separator`, `Shortcut`, `Sub`, `SubTrigger`, `SubContent`, `Portal` | Dropdown Menu's parts | shadcn's context menu is a copy of its dropdown menu; here it is the same code, named per family |
| — | `ContextMenuLinkItem` | Dropdown Menu's link item |
| Classes in `style-vega.css` | Same, keyed by `data-slot` | `min-w-36` on the menu; the sub content's border and `shadow-lg` |
| Examples: Basic, With Icons, With Shortcuts, With Destructive Items | `ContextMenuBasic`, `ContextMenuWithIcons` | |
| Examples: With Submenu, With Groups, Labels & Separators, With Checkboxes, With Radio Group, With Inset | `ContextMenuWithGroups` | One menu with all of them |
| Example: With Sides | `ContextMenuSides` | |
| Example: In Dialog | Not repeated | `DropdownMenuInDialog` shows the shared engine in a dialog |
| — | `ContextMenuOnRows` | `contextMenuTrigger()` on table rows |

## Accessibility checks

Automated, in Chromium, Firefox and WebKit (`bun run test`, `test:browser`, `test:e2e`):

- A right click opens the menu at the pointer instead of the browser's menu; near the window's edges it flips and shifts to stay in view; in right-to-left text it opens to the left of the pointer.
- Shift+F10 and the Context Menu key open it below the focused element at its first item, and Escape returns focus there. The `contextmenu` event a browser sends after those keys changes nothing.
- A right click elsewhere in the area moves the menu; one outside closes it and leaves the browser's menu.
- A held touch opens it at the finger and swallows the tap that ends it; a touch that moves, scrolls or ends early doesn't, and a tap follows a link. The held touch runs through Chromium's real touch input in the end-to-end tests, and through pointer events in every engine in the browser tests.
- A disabled context menu leaves the browser's menu alone.
- The keys, submenus and items behave as in [Dropdown Menu](dropdown-menu.md#accessibility-checks), and axe-core finds no WCAG 2.2 A or AA violation with one open.

Not checked, so not claimed:

- Screen readers weren't tested, nor a real phone's long press: iOS Safari, which sends no `contextmenu` event, and Android, which sends one after its own long press.
- This isn't an accessibility certification.
