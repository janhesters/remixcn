# Tabs

A tab list of native buttons with their panels. The list is one tab stop, and the arrow keys move between tabs.

- Source: `registry/ui/tabs.tsx`. Needs `registry/lib/theme.css`, `registry/lib/styles.ts` and `registry/lib/composite.ts`.
- Examples: `registry/examples/tabs-example.tsx`. Run them with `bun run disclosure-examples` (http://localhost:4405/).
- Upstream: shadcn/ui [`tabs.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/tabs.tsx), its [docs](https://ui.shadcn.com/docs/components/base/tabs), and [Base UI Tabs](https://base-ui.com/react/components/tabs.md).

## Usage

```tsx
import { on } from 'remix/component'

import { Tabs, TabsContent, TabsList, TabsTrigger, tabsChangeType } from '#remixcn/ui/tabs.tsx'

<Tabs id="settings" defaultValue="account" mix={on(tabsChangeType, (event) => remember(event.value))}>
  <TabsList aria-label="Settings">
    <TabsTrigger value="account">Account</TabsTrigger>
    <TabsTrigger value="password">Password</TabsTrigger>
  </TabsList>
  <TabsContent value="account">…</TabsContent>
  <TabsContent value="password">…</TabsContent>
</Tabs>
```

## How it runs

Tabs work once the browser runs them inside your client entry, and aren't a client entry themselves. Before that, and on a page that only renders on the server, the server HTML shows the selected tab and its panel, every tab is in the tab order, and the other tabs do nothing. Hydration keeps the selection.

## API

### `Tabs`

Takes every prop of a `<div>`, and:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `value` | `string \| null` | not set: the tabs keep their own value | The selected tab, for tabs you control. `null` selects none |
| `defaultValue` | `string \| null` | the first enabled tab | The tab selected at first |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | A row of tabs above the panels, or a column beside them. Without room beside the column, the panel moves below it |
| `id` | `string` | a generated id | Tab and panel ids derive from it and each value |

It renders `data-slot="tabs"` and `data-orientation`.

### `TabsList`

A `role="tablist"` `<div>` with `aria-orientation`. Name it with `aria-label` or `aria-labelledby`. Takes every prop of a `<div>` except `role`, and:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `variant` | `'default' \| 'line'` | `'default'` | A muted pill, or a line under the selected tab |
| `activateOnFocus` | `boolean` | `false` | Selects a tab as soon as the arrow keys reach it. Otherwise Enter or Space selects it |
| `loopFocus` | `boolean` | `true` | Whether the arrow keys wrap from the last tab to the first |

It renders `data-slot="tabs-list"`, `data-orientation` and `data-variant`.

### `TabsTrigger`

A native `<button role="tab">`. Takes every button prop except `type`, `role` and `id`, and needs `value`. It renders `aria-selected`, `aria-controls` once its panel is in the document, `data-slot="tabs-trigger"`, `data-active`, `data-disabled`, `data-orientation` and `data-variant`. `disabled` disables it natively. Your click handlers run first: `event.preventDefault()` keeps the current tab.

### `TabsContent`

A `role="tabpanel"` `<div>` labelled by its tab, with `tabindex="0"` while it shows. Takes every prop of a `<div>` except `role`, `id` and `hidden`, and needs `value`. Pass `tabindex={-1}` when the panel starts with something focusable. Only the selected tab's panel is in the document, unless `keepMounted` keeps the others there, `hidden`. It renders `data-slot="tabs-content"`, `data-orientation` and `data-hidden`.

### Change event

`TabsChangeEvent` (type `tabsChangeType`, `'remixcn:tabs-change'`) fires on the tabs before the selected tab changes, and bubbles. `event.value` is the next tab. `event.reason` is `'none'` when the user picks a tab, and `event.preventDefault()` then keeps the current one. A controlled Tabs (`value`) changes only when you render the new value.

Like Base UI, uncontrolled tabs move to the first enabled tab when the selected tab is removed or disabled. That change fires with `reason` `'missing'` or `'disabled'` and can't be cancelled. Controlled tabs keep their value.

### Also exported

`TabsOrientation`, `TabsListVariant`, `TabsChangeReason` and the props types.

## Composition

- **Keyboard.** Tab enters the list at the selected tab, also after its owner selects another tab, and leaves it with the next Tab. The arrow keys follow the orientation: left and right in a row, swapped in right-to-left text, up and down in a column. Home and End jump to the ends. Disabled tabs are skipped. The arrow keys come from `rovingFocus` in `composite.ts`.
- **Manual or automatic.** By default, the arrow keys only move focus, and Enter or Space selects. Set `activateOnFocus` when panels show at once, so the arrow keys select as they move.
- **Changing tabs.** Key tabs and panels by value. When the focused tab is removed or disabled, focus moves to the new tab stop. When the selected tab changes while focus is in its panel, focus moves to the new tab.
- **Tabs without panels.** A tab list may stand alone, such as a segmented control. A tab names a panel in `aria-controls` only when that panel is in the document.
- **Icons.** Put an icon before or after the label and mark it `data-icon="inline-start"` or `"inline-end"`, which tightens the padding on that side. Name an icon-only tab with `aria-label`.
- **Styles.** A `css()` on a part renders after its own rule and wins, such as `width: '100%'` on the list.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `Tabs` on Base UI's `Tabs.Root` | `Tabs`, a `<div>` | |
| `value`, `defaultValue`, `orientation` | Same props | Values are strings. Without a value, the first enabled tab is selected, as Base UI's default of the first tab does |
| `onValueChange(value, details)` | `TabsChangeEvent` | `reason` is `'none'`, `'disabled'` or `'missing'`. Base UI's `'initial'` notification isn't sent |
| `TabsList` on `Tabs.List`, with `variant` | `TabsList` | `activateOnFocus` and `loopFocus` keep Base UI's defaults |
| `tabsListVariants` (cva class names) | `variant` | shadcn exports the cva function. RemixCN renders `data-variant` for your rules instead |
| `TabsTrigger` on `Tabs.Tab` | A native `<button role="tab">` | `render` and `nativeButton` aren't ported |
| `TabsContent` on `Tabs.Panel` | `TabsContent` | `keepMounted` is the same prop |
| `Tabs.Indicator` | Not ported | shadcn doesn't use it. The line variant draws its line on each tab |
| `data-activation-direction` | Not rendered | |
| `data-active`, `data-disabled`, `data-orientation`, `data-hidden` | Same | |
| Tabs classes in `style-vega.css` | Same measures | The list's `h-9` and `p-[3px]`, the tab's `px-2 py-1`, `text-sm font-medium`, `text-foreground/60` and the selected tab's background, border and shadow |
| `whitespace-nowrap` | Labels wrap only when a tab can't fit | So a narrow screen never scrolls sideways |
| `focus-visible:ring-[3px]` | The theme's 2px outline in `--ring` | Stays visible in forced colors |
| `TabsContent` `outline-none` | The theme's focus ring | A focused panel shows where focus is |
| The line `::after` drawn with a background | Drawn with a border | Forced colors keep borders. There, every selected tab shows the line |
| Docs: Basic, Line, Variants Alignment, Disabled, With Icons, Icon Only, Multiple, With Content, Line With Content, Line Disabled, Vertical, With Input and Button | `TabsBasic`, `TabsLine`, `TabsVariantsAlignment`, `TabsDisabled`, `TabsWithIcons`, `TabsIconOnly`, `TabsMultiple`, `TabsWithContent`, `TabsLineWithContent`, `TabsVertical`, `TabsWithInputAndButton` | `TabsDisabled` shows both of shadcn's disabled examples |
| Docs: With Dropdown | Waits for Dropdown Menu (#16) | |
| — | `TabsAutomatic` | `activateOnFocus` |
| Docs: RTL | The fixture's Direction section | |

### Where it looks different from shadcn

- **Long labels wrap**, and a list wraps its tabs, when they can't fit. Normal tabs look the same as shadcn's.
- **A narrow vertical Tabs** puts its panel below the tab column when the panel would have less than 10rem beside it.
- **Icon-only tabs have names.** shadcn's Icon Only example leaves them unnamed.
- **A focused panel shows the focus ring.** shadcn removes it.
- **In forced colors**, the selected tab shows the line under it in both variants.

## Accessibility checks

Automated, in Chromium, Firefox and WebKit (`bun run test`, `test:browser`, `test:e2e`):

- The list is a `tablist` with `aria-orientation`, each tab a native button with `role="tab"` and `aria-selected`, and the panel a `tabpanel` labelled by its tab. A tab's `aria-controls` names its panel only while the panel is in the document.
- The arrow keys, Home and End move focus, with wrapping, in both orientations and in right-to-left text. Disabled tabs are skipped. Enter and Space select in manual mode; the arrow keys select in automatic mode.
- Tab enters the list at the selected tab, also when a controlled Tabs selects another tab while focus is elsewhere, and leaves it with the next Tab.
- The server renders the selected tab and its panel, and hydration keeps them. Tabs the page renders outside any client entry stay as the server rendered them.
- Changes can be cancelled, and controlled tabs change only when their owner renders them.
- Removing or disabling the selected tab selects the first enabled tab, and focus stays in the list. Controlled tabs keep their value. Reordering keeps the selection and focus.
- Focus in a panel that hides moves to the new tab. Hidden panels hold nothing focusable.
- Separate and nested tabs keep separate state and unique ids.
- Tab text is 4.5:1 or more in both themes and both variants, selected or not. The focus ring shows, also in forced colors, where the selected tab keeps its line.
- axe-core finds no WCAG 2.2 A or AA violations on the example page in either color scheme.
- The page fits 320px without scrolling sideways, with normal text and at 200%.

Not checked, so not claimed:

- Screen readers (NVDA, JAWS, VoiceOver, TalkBack) weren't tested. Safari itself wasn't run, only Playwright's WebKit in CI. Forced colors were emulated, not tested in Windows.
- This isn't an accessibility certification.
