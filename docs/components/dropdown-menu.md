# Dropdown Menu

A button that opens a menu of choices, of which one is chosen, such as a theme picker with Light, Dark and System. The menu is a native `popover` element in the top layer. A click, Enter, Space or an arrow key opens it. The arrow keys, Home, End and typed letters move between its choices, and Enter, Space or a click chooses one. A choice and Escape close it and return focus to the trigger. Tab closes it and moves on from the trigger, and a press elsewhere closes it.

This first port covers the single-choice picker approved on #83: the root, a trigger that composes with Button, the popup, a radio group and its choices. Actions, links, checkboxes, labels, separators, shortcuts and submenus aren't ported yet (see the map below).

- Source: `registry/ui/dropdown-menu.tsx`. Needs `registry/lib/theme.css`, `styles.ts`, `icons.tsx`, `composite.ts`, `layer.ts`, `focus-scope.ts`, `modal.ts` and `anchor-position.ts`.
- Example: `registry/examples/dropdown-menu-example.tsx`, which also uses `registry/ui/button.tsx`, so the item depends on `@remixcn/button` and one `remixcn add @remixcn/dropdown-menu` installs both. Run it with `bun run dropdown-menu-examples`.
- Upstream: shadcn/ui [`dropdown-menu.tsx`](https://github.com/shadcn-ui/ui/blob/055aa6b7837b1808456a24beb4c97a677864aa82/apps/v4/registry/bases/base/ui/dropdown-menu.tsx), the same file as at the catalog's pinned commit, its Mira classes in [`style-mira.css`](https://github.com/shadcn-ui/ui/blob/055aa6b7837b1808456a24beb4c97a677864aa82/apps/v4/registry/styles/style-mira.css), its [docs](https://ui.shadcn.com/docs/components/base/dropdown-menu), and [Base UI 1.6.0's Menu](https://github.com/mui/base-ui/tree/b34551d644f2e58ebf8fc1050d949f6654ceca6c/packages/react/src/menu) ([docs](https://base-ui.com/react/components/menu.md)).

## Usage

```tsx
import { buttonVariants } from '#remixcn/ui/button.tsx'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  dropdownMenuValueChangeType,
} from '#remixcn/ui/dropdown-menu.tsx'

<DropdownMenu>
  <DropdownMenuTrigger aria-label={`Theme: ${label}`} mix={buttonVariants({ variant: 'outline', size: 'icon' })}>
    <SunIcon />
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuRadioGroup
      aria-label="Theme"
      value={theme}
      mix={on(dropdownMenuValueChangeType, (event) => {
        theme = event.value
        handle.update()
      })}
    >
      <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  </DropdownMenuContent>
</DropdownMenu>
```

You supply the labels, the current value and what happens on a change. The parts run in the browser inside your client entry, like Button: they take your mixins, which can't cross from the server into an entry. Put the menu in a component you mark with `clientEntry(...)`, as the example does.

## API

### `DropdownMenu`

Groups the parts and holds whether the menu is open. It renders no element.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `open` | `boolean` | | Whether it's open, for a menu you control. Update it from `DropdownMenuOpenChangeEvent` |
| `defaultOpen` | `boolean` | `false` | Whether it starts open. It takes no focus then |
| `modal` | `boolean` | `true` | Whether the page behind it waits: it can't be scrolled or used, and a press outside only closes the menu |

### `DropdownMenuTrigger` and `dropdownMenuTrigger()`

`DropdownMenuTrigger` is a native `<button type="button">` that opens and closes the menu. It takes every button prop and `mix`. Give it a Button's look with `mix={buttonVariants({ variant: 'outline' })}`.

`dropdownMenuTrigger()` makes any element the trigger, such as `<button type="button" mix={[buttonVariants(), dropdownMenuTrigger()]}>`. It keeps the element's own `id` and `data-slot`.

A click toggles the menu. Enter and Space open it with focus on the first choice; ArrowDown opens it on the first choice and ArrowUp on the last. The trigger renders `aria-haspopup="menu"`, `aria-controls` with the content's id, `aria-expanded` once the menu runs, and `data-popup-open` while open.

### `DropdownMenuContent`

The menu: a `<div role="menu">` in the top layer, named by its trigger. It takes every `div` prop and `mix`, and:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `side` | `'top' \| 'bottom' \| 'left' \| 'right' \| 'inline-start' \| 'inline-end'` | `'bottom'` | The side of the trigger. Inline sides follow the text direction |
| `sideOffset` | `number` | `4` | The gap to the trigger, in pixels |
| `align` | `'start' \| 'center' \| 'end'` | `'start'` | The alignment along that side. Start and end follow the text direction |
| `alignOffset` | `number` | `0` | A shift away from the aligned edge, in pixels |
| `collisionPadding` | `number` | `5` | Space to keep from the viewport's edges, in pixels |
| `collisionBoundary` | `Element \| null` | | An element whose box also limits where it goes |
| `collisionAvoidance` | `{ side?: 'flip' \| 'none'; align?: 'shift' \| 'none' }` | flip and shift | Whether it flips to the other side and shifts along the edge to stay in view |
| `finalFocus` | `HTMLElement \| (() => HTMLElement \| null) \| false` | the trigger | What to focus when it closes, or `false` to leave focus alone |

It renders `data-open` or `data-closed`, and while open `data-side`, `data-align`, and the CSS variables `--anchor-width`, `--anchor-height`, `--available-width`, `--available-height` and `--transform-origin`. It's at least as wide as its trigger and 8rem, as wide as its longest choice, never wider or taller than the room beside the trigger, and scrolls what doesn't fit. A wider minimum you set, such as `min(14rem, var(--available-width, 100%))`, should keep that room as its limit.

### `DropdownMenuRadioGroup` and `DropdownMenuRadioItem`

`DropdownMenuRadioGroup` is a `<div role="group">` that holds which choice is chosen: `value`, for a group you control, or `defaultValue`. Name it with `aria-label` when the trigger's name doesn't say what the choices are for. Choosing another choice sends `DropdownMenuValueChangeEvent` on it, once. Choosing the current one again closes the menu and sends nothing.

`DropdownMenuRadioItem` is `<button type="button" role="menuitemradio">` with its `value`, `aria-checked`, `data-checked` and a check mark at its end while it's the chosen one. A click, Enter or Space chooses it. It takes every button prop, `mix`, and `closeOnClick` (default `true`): set it to `false` to keep the menu open after a choice.

### Events

| Event | Dispatched on | Bubbles | `preventDefault()` |
| --- | --- | --- | --- |
| `DropdownMenuOpenChangeEvent` (`dropdownMenuOpenChangeType`) | the content, before it opens or closes | No | keeps the current state |
| `DropdownMenuValueChangeEvent` (`dropdownMenuValueChangeType`) | the radio group, before another choice is chosen | Yes | keeps the current choice and the menu open |

Each has `cause`, the event that asked. `DropdownMenuOpenChangeEvent` has `open`, the next state, and `reason`: `'trigger-press'`, `'item-press'`, `'list-navigation'` (an arrow key), `'escape-key'`, `'outside-press'`, `'focus-out'` (Tab or focus leaving) or `'trigger-removed'`. `DropdownMenuValueChangeEvent` has `value`.

```tsx
<DropdownMenuContent mix={on(dropdownMenuOpenChangeType, (event) => { open = event.open; handle.update() })}>
```

### Also exported

The types `DropdownMenuProps`, `DropdownMenuContentProps`, `DropdownMenuRadioGroupProps`, `DropdownMenuRadioItemProps`, `DropdownMenuOpenChangeReason` and `CollisionAvoidance`.

## Composition

- **Without JavaScript.** Until the menu runs, the trigger opens it natively with `popovertarget`. The browser shows it in the middle of the screen, and Escape or a press elsewhere closes it. Its choices are `<button type="button">`, so they submit no form around the menu, and do nothing else. A page that renders a menu outside any client entry keeps this native menu.
- **Stays in the document.** The content renders while closed, hidden, so the trigger's `aria-controls` always points at it.
- **Modal.** By default the rest of the page is inert while the menu is open and doesn't scroll, and a press or tap outside only closes the menu. The trigger stays usable, so it can close it. With `modal={false}`, the page stays usable, and a press outside closes the menu and still reaches what you pressed.
- **Several menus.** Each menu holds its own state and choice. A press in one non-modal menu is outside another, so it closes the other.
- **Pointer and touch.** The pointer focuses the choice it rests on. On touch, a tap opens the menu and another chooses.
- **Focus.** The focused choice gets the accent background, as in shadcn, and the shared 2px `--ring` outline from `focusRing()` when the keyboard moved focus there, so it stays easy to find when the check mark is on another choice.
- **Clipping.** The menu sits in the top layer, so a box with `overflow: hidden` around the trigger doesn't clip it.
- **Overrides.** A `css()` you pass with `mix` renders after the part's own rule, so it wins, as in `mix={css({ minWidth: 'min(14rem, var(--available-width, 100%))' })}`.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `DropdownMenu` on Base UI's `Menu.Root` | `DropdownMenu` | |
| Root `open`, `defaultOpen`, `modal` | Same | Base UI's default: modal. The arrows always loop |
| Root `onOpenChange` | `DropdownMenuOpenChangeEvent` on the content | Cancelable, like `eventDetails.cancel()` |
| Root `loopFocus`, `disabled`, `orientation`, `highlightItemOnHover`, `actionsRef`, `onOpenChangeComplete`, `handle`, `triggerId` | Not ported | A vertical menu with one trigger that loops, focused under the pointer; no exit animation to wait for |
| `DropdownMenuTrigger` on `Menu.Trigger` | `DropdownMenuTrigger` and `dropdownMenuTrigger()` | `dropdownMenuTrigger()` replaces `render` and `nativeButton` |
| Trigger opens on press and drags to an item | Opens on click | Choosing by releasing the pointer over a choice isn't ported |
| Trigger `openOnHover`, `delay`, `closeDelay` | Not ported | The menu opens on press |
| Trigger `data-popup-open` | Same | `data-pressed` isn't ported |
| `DropdownMenuContent` on `Portal`, `Positioner` and `Popup` | `DropdownMenuContent`, a native popover | The top layer replaces the portal and its `container` |
| Positioner `side`, `align`, `sideOffset`, `alignOffset` | Same, with shadcn's defaults | Offsets are numbers; the offset functions aren't ported |
| Positioner `collisionPadding`, `collisionBoundary`, `collisionAvoidance` | Same as Popover | `collisionBoundary` takes an element |
| Positioner `sticky`, `positionMethod`, `disableAnchorTracking`, `arrowPadding`, `anchor` | Not ported | Always fixed, tracked, against its trigger |
| Popup `finalFocus` | Same | `initialFocus` isn't ported: keys focus the first or last choice, a click the menu itself |
| `w-(--anchor-width)` | At least the trigger's width and 8rem, else as wide as its choices | shadcn's popup takes the trigger's width, which wraps choices under a narrow trigger |
| `Menu.RadioGroup`, `RadioItem`, `RadioItemIndicator` | `DropdownMenuRadioGroup`, `DropdownMenuRadioItem` with its check mark | `onValueChange` becomes `DropdownMenuValueChangeEvent`; values are strings; the indicator isn't a separate part. `closeOnClick` defaults to `true`, not `false`, since the approved picker closes on a choice. The group's and items' `disabled` aren't ported |
| Item `label` | Not ported | Typed letters match the choice's text |
| `Menu.Item`, `LinkItem`, `CheckboxItem`, `Group`, `GroupLabel`, `Separator`, `SubmenuRoot`, `SubmenuTrigger`; shadcn's `DropdownMenuPortal`, `DropdownMenuShortcut` and `inset` | Not ported | Outside the approved single-choice picker of #83; a later ticket can add them |
| `Menu.Arrow`, `Backdrop`, `Viewport` | Not ported | shadcn's menu doesn't draw them; `modal` makes the page inert instead of a backdrop |
| Classes in `style-mira.css` | Same measures and colors: `text-xs`, `min-h-7`, `rounded-md` choices, `p-1`, `rounded-lg` popup | `ring-1` becomes a border, drawn in `CanvasText` in forced colors, with a `Highlight` outline on the focused choice. Keyboard focus also draws the shared `--ring` outline, which shadcn's `focus:bg-accent` alone doesn't |
| Fade, zoom and slide in and out | A fade in | A transform would move the box the positioning measures; it closes at once |
| Examples: With Radio Group, Radio with Icons | `DropdownMenuThemePicker` | A Light, Dark and System picker on an icon button, with icons drawn with `Icon`, that closes on a choice |
| Every other example | Not ported | They show the parts this port leaves out |

## Accessibility checks

Automated, in Chromium, Firefox and WebKit (`bun run test`, `test:browser`, `test:e2e`):

- The trigger is a button with `aria-haspopup="menu"`, `aria-controls` and `aria-expanded`; the content is a menu named by its trigger; choices are `menuitemradio` with `aria-checked` in a named group, in the server HTML too. The chosen one shows a check mark.
- Enter, Space and ArrowDown open it on the first choice, ArrowUp on the last; the arrows loop; Home, End and typing move focus; Enter and Space choose.
- A choice reports its value once, closes the menu and puts focus back on the trigger; the current choice again reports nothing. Escape closes it with focus back on the trigger; Tab and Shift+Tab close it and move on from the trigger.
- The focused choice draws a 2px `--ring` outline at 3:1 or more against the menu in both themes, while the check sits on another choice.
- A press elsewhere closes it; a modal menu makes the page inert until it closes.
- Touch opens it, chooses and closes it with a tap elsewhere.
- Two pickers keep their own choice and ids.
- Without JavaScript, the trigger opens the menu natively, and neither it nor a choice submits a form.
- It stays beside its trigger at both edges of a phone screen, and fits 320px with text at 200%.
- In right-to-left text it lines up with the trigger's right edge, and the check sits at the left end.
- axe-core finds no WCAG 2.2 A or AA violation with menus open, in both themes.
- It fades in only without reduced motion; its border is `CanvasText` and the focused choice's outline `Highlight` in forced colors.

Not checked, so not claimed:

- Screen readers (NVDA, JAWS, VoiceOver, TalkBack) weren't tested.
- Safari itself wasn't run, only Playwright's WebKit in CI. Forced colors were emulated in Chromium and Firefox, not tested in Windows.
- This isn't an accessibility certification.
