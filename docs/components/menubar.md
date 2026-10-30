# Menubar

A row of menu buttons, as at the top of a desktop app. The arrow keys move between the buttons and Arrow Down opens a menu; inside a menu, Arrow Left and Right move to the menu beside it. Once a menu is open, the pointer opens the others by moving onto their buttons. Inside, each menu is [Dropdown Menu](dropdown-menu.md)'s engine.

- Source: `registry/ui/menubar.tsx`. Needs `registry/ui/dropdown-menu.tsx` and its helpers, `registry/lib/theme.css`, `styles.ts` and `composite.ts`.
- Examples: `registry/examples/menubar-example.tsx`. Run them with `bun run menu-examples`.
- Upstream: shadcn/ui [`menubar.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/menubar.tsx), its [docs](https://ui.shadcn.com/docs/components/base/menubar), and [Base UI Menubar](https://base-ui.com/react/components/menubar.md).

## Usage

```tsx
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarShortcut,
  MenubarTrigger,
} from '#remixcn/ui/menubar.tsx'

<Menubar>
  <MenubarMenu>
    <MenubarTrigger>File</MenubarTrigger>
    <MenubarContent>
      <MenubarItem>
        New invoice <MenubarShortcut>⌘N</MenubarShortcut>
      </MenubarItem>
    </MenubarContent>
  </MenubarMenu>
  <MenubarMenu>
    <MenubarTrigger>Edit</MenubarTrigger>
    <MenubarContent>
      <MenubarItem>Undo</MenubarItem>
    </MenubarContent>
  </MenubarMenu>
</Menubar>
```

Put it in a component you mark with `clientEntry(...)`, as the examples do.

## API

### `Menubar`

A `<div role="menubar">` with one tab stop: the arrow keys move between its buttons, past disabled ones. It takes every `div` prop but `role`, `mix`, and:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | The direction the buttons run, and the arrows that move between them |
| `loopFocus` | `boolean` | `true` | Whether the arrows wrap from the last button to the first, and from the last menu to the first |
| `modal` | `boolean` | `true` | Whether the page waits while a menu is open. The menubar itself stays usable |
| `disabled` | `boolean` | `false` | Keeps every menu closed |

It renders `aria-orientation`, `data-orientation`, `data-modal` and, while a menu is open, `data-has-submenu-open`. On a narrow screen its buttons wrap.

### `MenubarMenu`

Groups one menu: its `MenubarTrigger` and `MenubarContent`. It takes Dropdown Menu's root props but `modal`, which comes from the menubar.

### `MenubarTrigger`

A native `<button type="button" role="menuitem">` with the menubar's button style. A click opens its menu with focus on the menu; Enter, Space and Arrow Down open it at its first item, and Arrow Up at its last. In a vertical menubar, the arrow toward the menu opens it. It renders Dropdown Menu's trigger attributes.

### `MenubarContent` and the other parts

`MenubarContent` is `DropdownMenuContent` with the menubar's defaults: below its button with `sideOffset={8}` and `alignOffset={-4}`, or at `'inline-end'` in a vertical menubar, and at least 9rem wide.

`MenubarItem`, `MenubarLinkItem`, `MenubarCheckboxItem`, `MenubarRadioGroup`, `MenubarRadioItem`, `MenubarGroup`, `MenubarLabel`, `MenubarSeparator`, `MenubarShortcut`, `MenubarSub`, `MenubarSubTrigger`, `MenubarSubContent` and `MenubarPortal` are Dropdown Menu's parts under these names. Inside a menubar they render `data-slot="menubar-…"` and take shadcn's menubar styles: checkbox and radio items show their check at the start, and labels are as large as items. See [Dropdown Menu](dropdown-menu.md#api) for their props.

### Events and also exported

`MenuOpenChangeEvent`, `MenuCheckedChangeEvent` and `MenuValueChangeEvent`, with their type constants, are re-exported. Opening another menu closes the open one with `reason: 'sibling-open'`; the arrows that move to the next menu open it with `'list-navigation'`. The types `MenubarProps`, `MenubarMenuProps`, `MenuOpenChangeReason` and the props of every part under its menubar name are exported too.

## Composition

- **Keys.** In the menubar, Arrow Left and Right (Up and Down when vertical), Home and End move between the buttons, mirrored in right-to-left text. Inside a menu, Arrow Left and Right first open or close a submenu, then move to the menu beside it, at its first item, wrapping past disabled menus. Escape closes the menu with focus back on its button. Tab leaves the menubar.
- **Pointer.** With a menu open, moving onto another button opens its menu at once and closes the first. A click on a button whose menu the pointer opened keeps it open; a second click closes it.
- **Modal.** By default, the page around the menubar is inert and doesn't scroll while a menu is open; the menubar's buttons stay usable, so you can switch menus. A menu the pointer opened leaves the page alone.
- **Without JavaScript.** Each button opens its menu natively, as Dropdown Menu's does.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `Menubar` on Base UI's `Menubar` | `Menubar` | `orientation`, `loopFocus`, `modal`, `disabled` and its data attributes are ported; roving focus comes from `composite.ts` |
| `MenubarMenu` on `DropdownMenu` | `MenubarMenu` on Dropdown Menu's `MenuRoot` | Root props as in [Dropdown Menu](dropdown-menu.md#source-and-behavior-map) |
| `MenubarTrigger` on `DropdownMenuTrigger` | `MenubarTrigger`, a button with role `menuitem` | shadcn's `cn-menubar-trigger` style |
| `MenubarContent` with `align="start"`, `alignOffset={-4}`, `sideOffset={8}` | Same defaults | A vertical menubar's menus show on `'inline-end'`, as Base UI's do |
| `MenubarItem`, `CheckboxItem`, `RadioGroup`, `RadioItem`, `Group`, `Label`, `Separator`, `Shortcut`, `Sub`, `SubTrigger`, `SubContent`, `Portal` | Dropdown Menu's parts | shadcn's menubar wraps its dropdown parts with other slots and classes; here the styles key on `data-slot` |
| — | `MenubarLinkItem` | Dropdown Menu's link item |
| Classes in `style-vega.css` | Same measures and colors | `h-9` becomes a minimum height, and the buttons wrap on a narrow screen |
| Examples: Basic, With Submenu, With Checkboxes, With Radio, With Shortcuts, Format, Insert, Destructive | `MenubarBasic` | One menubar with File, Edit, View and a disabled Share menu |
| Example: Sides | `MenubarSides` | |
| Examples: With Icons, With Inset, In Dialog | Not repeated | Dropdown Menu's `DropdownMenuWithIcons`, `DropdownMenuWithInset` and `DropdownMenuInDialog` show the shared parts |
| — | `MenubarVertical` | Base UI's vertical orientation |

## Accessibility checks

Automated, in Chromium, Firefox and WebKit (`bun run test`, `test:browser`, `test:e2e`):

- The menubar has role `menubar` with `aria-orientation` and one tab stop; its buttons have role `menuitem` with `aria-haspopup="menu"` and name their menus, in the server HTML too.
- The arrows, Home and End move between the buttons past a disabled one; Arrow Down opens a menu at its first item; Escape returns focus to its button.
- Arrow Left and Right move between the open menus, wrapping and skipping a disabled menu, after opening or closing a submenu first.
- The pointer switches menus once one is open, and a click keeps a menu it opened.
- The page waits behind an open menu while the menubar stays usable; a disabled menubar opens nothing.
- axe-core finds no WCAG 2.2 A or AA violation with a menu open, in both themes.

Not checked, so not claimed:

- Screen readers weren't tested. This isn't an accessibility certification.
