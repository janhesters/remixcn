# Sidebar

An app's column of navigation beside the page. On a wide screen it expands and collapses, off the screen or to icons whose labels show in tooltips. Below 48rem the same parts open in a Sheet. A button, a click on its edge and Ctrl+B or ⌘B toggle it. Its links are native links, so navigation works before any script runs.

- Source: `registry/ui/sidebar.tsx`. Needs `registry/ui/button.tsx`, `dialog.tsx`, `input.tsx`, `separator.tsx`, `sheet.tsx`, `skeleton.tsx`, `tooltip.tsx`, and `registry/lib/use-mobile.ts`, `focus-scope.ts`, `icons.tsx`, `styles.ts` and `theme.css`.
- Examples: `registry/examples/sidebar-example.tsx`. Run them with `bun run sidebar-examples`: `/` shows each in a frame, and `/docs`, `/icons`, `/floating`, `/inset`, `/controlled` and `/settings` each on a page of its own.
- Upstream: shadcn/ui [`sidebar.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/sidebar.tsx), [`use-mobile.ts`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/hooks/use-mobile.ts), its [example](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/examples/sidebar-example.tsx) and [docs](https://ui.shadcn.com/docs/components/base/sidebar), and the Sidebar classes in `style-vega.css`.

## Usage

```tsx
import { clientEntry } from 'remix/component'
import type { Handle } from 'remix/component'

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '#remixcn/ui/sidebar.tsx'

export const AppLayout = clientEntry(import.meta.url, function AppLayout(handle: Handle<{ path: string }>) {
  return () => (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Billing</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton href="/invoices" isActive={handle.props.path === '/invoices'} tooltip="Invoices">
                    <ReceiptIcon />
                    <span>Invoices</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header>
          <SidebarTrigger />
        </header>
        …
      </SidebarInset>
    </SidebarProvider>
  )
})
```

The parts run in the browser inside your client entry, like Button: they take your mixins and live children, which a client entry's props can't carry. Give the entry serializable props, such as the current path.

## How it runs

- **On the server**, the provider renders the wide layout with the state you pass. The server doesn't know the viewport.
- **In the browser**, the provider asks `matchMedia('(width < 48rem)')`. Below it, Sidebar renders its parts in a modal Sheet on the sidebar's side, closed until the trigger opens it, and the rail stays out. The wide and narrow states are separate: opening the sheet leaves `open` alone, and leaving the narrow layout closes the sheet.
- **Before it runs, and without scripting**, the links stay reachable. Without scripting the sidebar shows expanded, with a narrow screen showing it above the page, and the trigger and rail hide, since nothing could run them. With scripting, a sidebar that would hide its links, on a narrow screen or collapsed off the screen, shows them the same way when its script still hasn't run two seconds later.
- **Nothing is saved.** The provider writes no cookie, storage or server state. Pass `open` and `onOpenChange` and keep the state where you like, such as a cookie your server reads to render the right state from the start.

## API

### `SidebarProvider`

Holds the state and renders a `<div data-slot="sidebar-wrapper">` that lays the sidebar out beside SidebarInset. It takes every `div` prop, `mix`, and:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `open` | `boolean` | | Whether the sidebar is expanded on a wide screen, for a sidebar you control |
| `defaultOpen` | `boolean` | `true` | Whether it starts expanded |
| `onOpenChange` | `(open, details) => void` | | Called before it expands or collapses. `details.reason` says why, and `details.cancel()` keeps it as it is |
| `openMobile` | `boolean` | | Whether the sheet is open on a narrow screen, for a sheet you control |
| `defaultOpenMobile` | `boolean` | `false` | Whether the sheet starts open |
| `onOpenMobileChange` | `(open, details) => void` | | Called before the sheet opens or closes, as for `onOpenChange` |
| `keyboardShortcut` | `string \| false` | `'b'` | The key that toggles it with Ctrl or Cmd, or `false` for none |

`details.reason` is `'trigger-press'`, `'rail-press'`, `'keyboard-shortcut'`, `'link-press'`, `'viewport-change'`, `'none'` for a call of your own, or one of Dialog's reasons for the sheet, such as `'escape-key'` and `'outside-press'`.

The wrapper sets three custom properties: `--sidebar-width` (16rem), `--sidebar-width-icon` (3rem) and `--sidebar-width-mobile` (18rem, the sheet's width). Change them with `style={{ '--sidebar-width': '20rem' }}` or a rule in `@layer app`.

**The shortcut.** Ctrl+B or ⌘B, without Shift or Alt, toggles the sheet on a narrow screen and the sidebar on a wide one, and keeps the browser's own Ctrl+B from running. The provider listens on its wrapper and on the document while it runs, and stops once it unmounts. The nearest sidebar around focus owns the press, also when it has no shortcut or another key, so a nested sidebar's press never reaches the one around it; outside every sidebar, the first one on the page takes it. A text field, a select, an editable element and an input method that composes keep the press, and so does a modal dialog outside the sidebar. `keyboardShortcut={false}` turns it off, and then a press inside that sidebar does nothing.

### `getSidebarContext(handle)`

The context of the nearest provider, in place of shadcn's `useSidebar()` hook. Read it during render, as parts you build on the sidebar do; the provider renders its children again when it changes. It throws outside a provider.

| Field | Type | What it is |
| --- | --- | --- |
| `state` | `'expanded' \| 'collapsed'` | The wide layout's state |
| `open`, `setOpen(open, request?)` | | The wide state, and a way to change it. Returns `false` when `onOpenChange` canceled |
| `openMobile`, `setOpenMobile(open, request?)` | | The sheet's state, and a way to change it |
| `isMobile` | `boolean` | Whether the viewport is narrower than 48rem. `false` until it runs |
| `toggleSidebar(request?)` | | Toggles the sheet on a narrow screen, the sidebar on a wide one |
| `running` | `boolean` | Whether the provider runs in the browser yet |

`request` takes a `reason` and the `event`, which reach `onOpenChange`.

### `Sidebar`

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `side` | `'left' \| 'right'` | `'left'` | The edge it sits on. Physical, as for Sheet: `'right'` stays right in right-to-left text, and the sheet opens from that side |
| `variant` | `'sidebar' \| 'floating' \| 'inset'` | `'sidebar'` | A column with a border, a panel with a border, rounded corners and a shadow, or a column beside an inset page |
| `collapsible` | `'offcanvas' \| 'icon' \| 'none'` | `'offcanvas'` | Collapses off the screen, to a column of icons, or not at all |

On a wide screen it renders `<div data-slot="sidebar">` with `data-state`, `data-collapsible` (the kind while collapsed, else empty), `data-variant`, `data-side`, and `data-pending` until it runs, around a gap that keeps its room in the page and a fixed container with the parts. Your props and `mix` reach the container, which `aria-controls` names. Its order in the wrapper follows its side and the text direction, so a right sidebar sits on the right wherever it comes in the markup. Collapsed off the screen, the parts are `inert` and hide once they slid out. `collapsible="none"` renders a plain column, which doesn't collapse or turn into a sheet: use it inside a page, such as for settings.

On a narrow screen it renders a modal Sheet named "Sidebar" with `data-mobile="true"`, without a close button. Your props, except `role`, and `mix` reach the sheet as they reach the wide container, so `aria-label` names it and your handlers keep running. Escape, a press outside and the trigger close it. Focus moves to its first control and returns to the trigger. A press on a link in it that navigates this tab closes it, because Remix's runtime navigates in place and the sheet would stay over the new page; cancel it in `onOpenMobileChange` to keep it open.

### `SidebarTrigger`

A ghost `icon-sm` Button named "Toggle Sidebar", with a panel icon on the sidebar's side. It takes Button's props; children replace the icon and the name. Once it runs, it renders `aria-expanded` for the current layout, `aria-controls`, and `aria-haspopup="dialog"` on a narrow screen. Your click handler runs first and can cancel the toggle with `preventDefault()`. It hides without scripting.

### `SidebarRail`

A strip along the sidebar's edge, a `<button tabindex="-1">` named "Toggle Sidebar", that toggles it with a click. Put it directly in `Sidebar`: the sidebar renders it outside the parts that go inert, so it stays usable at the screen's edge while the sidebar is off it. The sheet leaves it out, and it hides without scripting and below 40rem.

### `SidebarInset`

The page, a `<main>`. Beside the inset variant on a wide screen it sits in a rounded panel with a margin.

### `SidebarHeader`, `SidebarFooter`, `SidebarContent`, `SidebarSeparator`, `SidebarInput`

A padded column at the top, one at the bottom, the part between them that scrolls, a Separator in the sidebar's border color, and an Input with the page's background. Give the input a label, such as `aria-label`.

### `SidebarGroup`, `SidebarGroupLabel`, `SidebarGroupAction`, `SidebarGroupContent`

A section; its label, which fades out while collapsed to icons; a `<button>` at the label's end, which hides then; and the section's content. `sidebarGroupLabelVariants()` and `sidebarGroupActionVariants()` give another element the same look and slot, such as a `<summary>` that opens the group or a link.

### `SidebarMenu`, `SidebarMenuItem`

A `<ul>` and its `<li>`.

### `SidebarMenuButton`

A row of the menu: a native link with `href`, else a `<button type="button">`. Put an icon and the label, in a `<span>`, inside.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `href` | `string` | | Renders a native link to it. `target` and `rel` pass through |
| `isActive` | `boolean` | `false` | Marks the current row with `data-active`, and a link with `aria-current="page"` unless you set your own |
| `variant` | `'default' \| 'outline'` | `'default'` | A plain row, or one with an outline |
| `size` | `'default' \| 'sm' \| 'lg'` | `'default'` | 2rem, 1.75rem or 3rem tall, at least |
| `tooltip` | `string \| TooltipContentProps` | | A tooltip that shows the label while the sidebar is collapsed to icons |

The label wraps instead of being cut short, so a narrow screen or large text never hides it. Collapsed to icons, the row is a 2rem square that clips its label, which stays its accessible name; the tooltip only shows it, so it doesn't describe the row a second time. `sidebarMenuButtonVariants({ variant, size, isActive })` gives another element the look and data attributes, such as a PopoverTrigger or a `<summary>`.

### `SidebarMenuAction`, `SidebarMenuBadge`

A 24px `<button>` at the end of a row, beside the SidebarMenuButton and never inside it, and a count or short status there. `showOnHover` hides the action until its row is hovered or has focus, on a wide screen with a pointer that hovers; elsewhere it shows. Both hide while collapsed to icons, and the row makes room for them. Name the action, such as with visually hidden text. `sidebarMenuActionVariants({ showOnHover })` gives another element its look.

### `SidebarMenuSkeleton`

A placeholder row with an optional icon (`showIcon`), hidden from assistive technology. Its width follows its place in the menu, or `--skeleton-width`. Mark the menu `aria-busy="true"` and say what loads in text.

### `SidebarMenuSub`, `SidebarMenuSubItem`, `SidebarMenuSubButton`

A nested `<ul>` with a line at its start, its `<li>`, and a native link with `size` (`'md'` or `'sm'`) and `isActive`, which writes `aria-current="page"` on a link. The submenu hides while collapsed to icons. `sidebarMenuSubButtonVariants()` gives another element its look.

### `use-mobile.ts`

shadcn's `useIsMobile()` hook as plain functions: `isMobile(view?)` asks once, and `watchMobile(onChange, signal, view?)` calls `onChange` each time the viewport crosses the breakpoint until `signal` aborts, and returns where it starts. `MOBILE_BREAKPOINT` is `'48rem'` and `mobileQuery` is `'(width < 48rem)'`, the query the sidebar's CSS uses too, so scripts and styles agree, also when the browser's text size changes.

## Composition

- **Navigation.** Use `href` on SidebarMenuButton and SidebarMenuSubButton, and mark the page on screen with `isActive` from your route. The links work without JavaScript, and Remix's runtime navigates them in place.
- **No nested controls.** A popover or menu that opens from a row gets the row's look through `sidebarMenuButtonVariants()` on its own trigger, as the docs example's version switcher does, never a Button inside a SidebarMenuButton. Actions sit beside the row. The rail is out of the tab order, so each control has one tab stop.
- **Collapsible groups and submenus.** shadcn wraps them in Collapsible. RemixCN's Collapsible works the same way, with `<CollapsibleTrigger mix={sidebarMenuButtonVariants()}>` or `sidebarGroupLabelVariants()`. A native `<details>` does too, and opens without JavaScript: give its `<summary>` the same mixins. The icons example shows one with a tooltip while collapsed to icons.
- **Two sidebars.** Nest a second provider in the first one's inset; each wrapper takes the shortcut for its own sidebar.
- **Remembering the state.** shadcn writes a cookie in the provider. Here the caller does, if it wants to: keep `open` from `onOpenChange` in a cookie your server reads, and render the provider with it.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `SidebarProvider` with `defaultOpen`, `open`, `onOpenChange` | Same, with `details` | `onOpenChange` gets the reason and can cancel |
| Provider's `openMobile` state | `openMobile`, `defaultOpenMobile`, `onOpenMobileChange` | The sheet's state is yours to control too, and separate from `open` |
| `SIDEBAR_COOKIE_NAME`, the cookie write in `setOpen` | Not ported | Nothing is saved by default (ticket #26); the caller keeps the state |
| `SIDEBAR_WIDTH`, `SIDEBAR_WIDTH_MOBILE`, `SIDEBAR_WIDTH_ICON` | `--sidebar-width`, `--sidebar-width-mobile`, `--sidebar-width-icon` on the wrapper | shadcn's docs name `--sidebar-width-mobile`; its source never reads it. Here the sheet does |
| `SIDEBAR_KEYBOARD_SHORTCUT` and the `window` keydown listener | `keyboardShortcut` | Scoped to the nearest sidebar, ignores text fields, input methods, Shift and Alt, and turns off with `false` |
| `useSidebar()` | `getSidebarContext(handle)` | Plus `running` |
| `useIsMobile()` | `isMobile()` and `watchMobile()` in `use-mobile.ts` | In rem, matching the CSS |
| `Sidebar` with `side`, `variant`, `collapsible`, `dir` | Same | `dir` passes to the sheet. The order follows the side, so a left or right sidebar works in either direction |
| Mobile `Sheet` with a hidden header and no close button | Same, Sheet on a native `<dialog>` | A link that navigates in place closes it (`'link-press'`); leaving the narrow layout closes it (`'viewport-change'`) |
| `hidden md:block` until hydration | The wide layout on the server, the narrow one once it runs | Without scripting, or two seconds after a script that doesn't run, the links show above the page or expanded |
| Off-canvas container with `left`/`right` | `translate` | The parts go `inert` and hide once they slid out; focus inside moves to the trigger |
| `SidebarTrigger` | Same | Adds `aria-expanded`, `aria-controls` and, on a narrow screen, `aria-haspopup`; keeps the ghost look while expanded. Hides without scripting |
| `SidebarRail` | Same | Rendered outside the inert parts; hides without scripting |
| `SidebarInset`, `SidebarInput`, `SidebarHeader`, `SidebarFooter`, `SidebarSeparator`, `SidebarContent`, `SidebarGroup`, `SidebarGroupContent`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuSub`, `SidebarMenuSubItem`, `SidebarMenuBadge` | Same | |
| `SidebarContent`'s hidden scrollbar | A thin scrollbar | So a long menu shows that it scrolls. Collapsed to icons it still scrolls up and down |
| `SidebarGroupLabel`, `SidebarGroupAction`, `SidebarMenuAction`, `SidebarMenuSubButton` with `render` | Same, and their `…Variants()` mixins | |
| `SidebarMenuButton` with `render`, `isActive`, `variant`, `size`, `tooltip` | Same, `href` for a link, and `sidebarMenuButtonVariants()` | Labels wrap instead of truncating; links get `aria-current="page"`; the tooltip shows only collapsed to icons on a wide screen, on the side away from the sidebar, without describing the row twice |
| `SidebarMenuAction` 20px | 24px | WCAG 2.5.8: it sits over its row's link. `showOnHover` applies only where a pointer can hover |
| `SidebarMenuSkeleton` with a random width | A width from its place in the menu, or `--skeleton-width` | The server and the browser draw the same |
| Classes in `style-vega.css` | Same measures and colors | Edges are borders, so forced colors keep them; the current row draws an outline there |
| Example | `SidebarDocs` | The version switcher is a Popover of links, as the dropdown menu isn't ported yet; the search is a native form |
| Docs: SidebarHeader, SidebarFooter, SidebarGroup, collapsible group, SidebarMenuAction, SidebarMenuSub, SidebarMenuBadge, SidebarMenuSkeleton, controlled, RTL | `SidebarIcons`, `SidebarSettings`, `SidebarControlled`, the fixture's `?dir=rtl` | The example uses a native `<details>`; RemixCN's Collapsible works too |
| — | `SidebarFloatingRight`, `SidebarInsetLayout` | The floating and inset variants |

## Accessibility checks

Automated, in Chromium, Firefox and WebKit:

- The server HTML has the links, the current page's `aria-current="page"`, no `inert`, and a rail out of the tab order; every part has its native element and slot, and actions are buttons beside their rows.
- Without JavaScript at 320px, the links show above the page and navigate, the trigger hides, and nothing scrolls sideways; a sidebar collapsed off the screen shows expanded; with a script that never loads, a narrow screen shows the links after two seconds.
- The trigger, the rail and Ctrl+B or ⌘B toggle it, with `aria-expanded` and `aria-controls`; a canceled change keeps the state; a controlled sidebar follows its prop, also when it changes without a press.
- The shortcut skips text fields, an editable element, an input method that composes, Shift and Alt; it takes another key or none and follows a change; the sidebar around focus owns it, also a nested one without a shortcut or with another key, and outside every sidebar the first one takes it; it stops once the provider unmounts, as does the viewport listener.
- Collapsed off the screen, Tab skips its links and focus inside moves to the trigger; collapsed to icons, focus stays on a row and moves from an action that hides to its row.
- Collapsed to icons, each label shows in a tooltip on hover and keyboard focus, also for rows added later, without `aria-describedby`; expanded, none opens.
- On a narrow screen the sheet is modal, keeps Tab inside, and Escape returns focus to the trigger; the wide and narrow states stay apart; a link that navigates in place closes it, a modified click doesn't; resizing moves between the column and the sheet with focus on the trigger, and leaves nothing inert.
- Rows added and removed keep their tooltips and focus; the current page follows `isActive`; several providers on a page run on their own; nothing is written to cookies or storage.
- Each example reflows at 320px, also with text at 200%; axe-core finds no WCAG 2.2 A or AA violation in each example in both themes, collapsed to icons with a tooltip, as a sheet, and before the scripts run; the current row draws an outline and focus a 2px ring in forced colors; transitions stop for reduced motion.

Not checked, so not claimed:

- Screen readers weren't tested.
- Safari itself, Windows forced colors and touch input weren't tested.
- This isn't an accessibility certification.
