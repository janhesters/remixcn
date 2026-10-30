# Navigation Menu

A site's main links in a `<nav>` landmark: a list of links and of buttons that each show a panel of more links. It is no ARIA menu: the links stay links in the tab order, and each panel is a disclosure its button controls. Resting the pointer on a button opens its panel, and once one is open the pointer opens the others at once. A click or Enter opens or closes a panel, and Arrow Down moves into it.

- Source: `registry/ui/navigation-menu.tsx`. Needs `registry/lib/theme.css`, `styles.ts`, `icons.tsx`, `composite.ts`, `layer.ts`, `focus-scope.ts`, `anchor-position.ts` and `hover-intent.ts`.
- Examples: `registry/examples/navigation-menu-example.tsx`. Run them with `bun run menu-examples`.
- Upstream: shadcn/ui [`navigation-menu.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/navigation-menu.tsx), its [docs](https://ui.shadcn.com/docs/components/base/navigation-menu), and [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu.md).

## Usage

```tsx
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '#remixcn/ui/navigation-menu.tsx'

<NavigationMenu aria-label="Main">
  <NavigationMenuList>
    <NavigationMenuItem>
      <NavigationMenuTrigger>Reports</NavigationMenuTrigger>
      <NavigationMenuContent>
        <NavigationMenuLink href="/reports/revenue" active>Revenue</NavigationMenuLink>
        <NavigationMenuLink href="/reports/tax">Tax</NavigationMenuLink>
      </NavigationMenuContent>
    </NavigationMenuItem>
    <NavigationMenuItem>
      <NavigationMenuLink href="/settings" mix={navigationMenuTriggerStyle()}>
        Settings
      </NavigationMenuLink>
    </NavigationMenuItem>
  </NavigationMenuList>
</NavigationMenu>
```

Put it in a component you mark with `clientEntry(...)`, as the examples do. Rendered outside any client entry, its links and its buttons' native panels still work.

## API

### `NavigationMenu`

A native `<nav>`. Give it an `aria-label` when the page has more than one. It takes every `nav` prop, `mix`, and:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `value` | `string \| null` | | The open item's value, or `null`, for a menu you control. Update it from `NavigationMenuValueChangeEvent` |
| `defaultValue` | `string \| null` | `null` | The item whose panel starts open |
| `delay` | `number` | `50` | Milliseconds the pointer rests on a button before its panel opens |
| `closeDelay` | `number` | `50` | Milliseconds before a panel closes once the pointer has left |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | The direction the list runs |
| `side` | as Dropdown Menu's | `'bottom'`, `'inline-end'` when vertical | The side of its button a panel shows on |
| `sideOffset` | `number` | `8` | The gap between a panel and its button |
| `align` | `'start' \| 'center' \| 'end'` | `'start'` | How a panel aligns with its button |
| `alignOffset` | `number` | `0` | A shift away from the aligned edge |

It renders `data-orientation`, and `data-open` while a panel is open.

### `NavigationMenuList` and `NavigationMenuItem`

A `<ul>` and its `<li>`s. The arrow keys move between the list's buttons and links, Home and End to the ends, mirrored in right-to-left text; Tab still reaches each of them. An item takes a `value` (a unique id by default) for a menu you control.

### `NavigationMenuTrigger`

A native `<button type="button">` with a chevron that turns while its panel is open. It renders `aria-expanded` once the menu runs, `aria-controls`, and `data-popup-open` while open. It never opens on focus alone. Enter, Space and a click open or close the panel with focus kept on the button; Arrow Down (the arrow toward the panel when vertical) opens it and moves focus to its first link. A disabled button opens nothing.

### `NavigationMenuContent`

The panel: a `<div>` in a native popover, below its button. It stays in the document while closed, hidden, so its links are in the server HTML. Inside it, the arrow keys move between the links, and Tab moves on to the next button of the list. It renders `data-open` or `data-closed`, and `data-activation-direction` (`'left'` or `'right'`) when another panel was open before it, for an animation that follows.

### `NavigationMenuLink`

A native `<a>`. `active` marks the page you're on with `aria-current="page"` and `data-active`. `closeOnClick` (`false`, as in Base UI) closes the open panel when the link is followed, as in an app that navigates without loading a page.

### `navigationMenuTriggerStyle()`

The buttons' look for a link beside them: `<NavigationMenuLink href="/docs" mix={navigationMenuTriggerStyle()}>`. It returns mixins, like `buttonVariants()`.

### `NavigationMenuIndicator`

A small arrow, hidden from assistive technology, below the open panel's button. Inside an item it shows while that item's panel is open; in the list or the root, it follows whichever button has its panel open.

### `NavigationMenuValueChangeEvent`

Dispatched on the `<nav>` before a panel opens or the open one closes, with `value` (`null` when every panel closes), `reason` and `cause`. It's cancelable and doesn't bubble. `reason` is `'trigger-press'`, `'trigger-hover'`, `'outside-press'`, `'list-navigation'`, `'focus-out'`, `'escape-key'`, `'link-press'` or `'trigger-removed'`.

### Also exported

`navigationMenuValueChangeType`, and the types `NavigationMenuProps`, `NavigationMenuItemProps`, `NavigationMenuLinkProps` and `NavigationMenuValueChangeReason`.

## Composition

- **Without JavaScript.** Every link works. Until the menu runs, a button opens its panel natively with `popovertarget`, in the middle of the screen; Escape or a press elsewhere closes it. A panel opened that way before the script ran stays open, now below its button.
- **Closing.** Escape closes the open panel, with focus back on its button when focus was in the panel. A press elsewhere, and focus leaving the button and its panel, close it too.
- **Pointer.** A panel stays open while the pointer crosses the gap to it. A click on a button whose panel the pointer opened keeps it open until the next click. Touch doesn't hover: a tap on a button opens its panel, and a tap on a link follows it.
- **Placement.** Each panel sits below its own button, in the top layer, so a box that clips its overflow doesn't clip it. It's never wider than the window, and scrolls what doesn't fit.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `NavigationMenu` on Base UI's `NavigationMenu.Root` | `NavigationMenu`, a `<nav>` | `value`, `defaultValue`, `delay`, `closeDelay`, `orientation` |
| Root `onValueChange` | `NavigationMenuValueChangeEvent` on the `<nav>` | Cancelable |
| Root `actionsRef`, `onOpenChangeComplete` | Not ported | No exit animation to wait for |
| A nested Root, rendered as a `<div>` in a panel | Not ported | shadcn's examples don't nest menus; a panel holds links |
| shadcn's `align` on `NavigationMenu` for the positioner | `side`, `sideOffset`, `align`, `alignOffset` on `NavigationMenu` | The positioner's props move to the root |
| `NavigationMenuPositioner`, Base UI's `Portal`, `Positioner`, `Popup` and `Viewport` | Not exported: each `NavigationMenuContent` is its own popover below its button | Remix renders no portal to move a panel into one shared viewport, so the viewport's size and position morph between panels isn't ported. `data-activation-direction` is, for an animation of your own |
| `Backdrop`, `Arrow` | Not ported | shadcn doesn't render them |
| `NavigationMenuList`, `NavigationMenuItem` | Same, `<ul>` and `<li>` | Item `value` is a string |
| `NavigationMenuTrigger` with its chevron | Same | `nativeButton` isn't needed; `data-popup-open`, `aria-expanded` |
| `NavigationMenuContent` | Same | Always mounted, so `keepMounted` is always on; `data-starting-style` and `data-ending-style` aren't ported |
| `NavigationMenuLink` with `active`, `closeOnClick` | Same | `render` with a router's link becomes the router's own link handling: Remix follows a plain `<a>` |
| `navigationMenuTriggerStyle()` from `cva` | `navigationMenuTriggerStyle()` returning mixins | |
| `NavigationMenuIndicator` on `NavigationMenu.Icon` | `NavigationMenuIndicator` | Placed inside an item, or following the open button from the list |
| Classes in `style-vega.css` | Same measures and colors | `ring-1` becomes a border, `CanvasText` in forced colors; the list wraps on a narrow screen; in forced colors an open button and the current page are underlined |
| Example: Basic | `NavigationMenuBasic` | |
| — | `NavigationMenuWithIndicator`, `NavigationMenuVertical` | The indicator and Base UI's vertical orientation |

## Accessibility checks

Automated, in Chromium, Firefox and WebKit (`bun run test`, `test:browser`, `test:e2e`):

- The root is a `nav` landmark with a list; links are plain links with no menu roles; the current page has `aria-current="page"`; each button has `aria-controls` and `aria-expanded`, in the server HTML too.
- Focus alone opens nothing; Enter opens a panel and keeps focus on its button; Arrow Down moves into it; the arrows move between its links; Escape returns focus to its button.
- The arrows, Home and End move between the list's buttons and links, mirrored in right-to-left text.
- The pointer opens a panel after the delay, switches at once to the next button, and a press-opened panel stays when the pointer leaves.
- Focus leaving, a press elsewhere and Escape close it; a controlled menu follows its owner and a canceled change keeps the panel as it is.
- Without JavaScript, the links work and a button opens its panel natively; a panel opened that way before the script ran stays open after hydration, below its button; a tap follows a link on touch.
- axe-core finds no WCAG 2.2 A or AA violation with a panel open, in both themes.

Not checked, so not claimed:

- Screen readers weren't tested. This isn't an accessibility certification.
