# Resizable

Panel groups in a row or a column that resize with the pointer and the keyboard, with nested groups, minimum, maximum and default sizes, collapsible panels, and layout events. It replaces react-resizable-panels 4.5.8, the version shadcn's lockfile pins.

- Source: `registry/ui/resizable.tsx`. Needs `registry/lib/theme.css` and `registry/lib/styles.ts`.
- Examples: `registry/examples/resizable-example.tsx`. Run them with `bun run layout` (http://localhost:4402/), and `bun run capture:layout` writes the screenshots in `docs/images/layout/`.
- Upstream: shadcn/ui [`resizable.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/resizable.tsx), its [docs](https://ui.shadcn.com/docs/components/base/resizable), and [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels) 4.5.8 for the behavior.

## How it runs

| Entry | Element | Without JavaScript |
| --- | --- | --- |
| Resizable | `<div>` panels in a flex row or column, with `role="separator"` handles between them | The server renders the layout from the panels' percentages. The handles are static separators: not focusable, no resize cursor |

It needs the browser to drag and take keys, so it runs inside a client entry of your app, as every example does. It isn't a client entry itself, for two reasons found in `remix@3.0.0`:

- A client entry's props must serialize to JSON. Mixins and handlers don't, so an entry couldn't take the caller's `mix`.
- The server renders the component children of a client entry to static HTML before it serializes them. A panel group entry would hydrate with frozen panels. Inside a client entry of the app, the panels stay live.

Once the browser runs it, each handle becomes a focusable separator with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and `aria-controls` pointing at the panel before it.

## Composition

```tsx
import { on } from 'remix/component'

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  resizableLayoutChangedType,
} from './ui/resizable.tsx'

<ResizablePanelGroup
  orientation="horizontal"
  mix={on(resizableLayoutChangedType, (event) => save(event.layout))}
>
  <ResizablePanel id="sidebar" defaultSize="25%" minSize="12rem" collapsible>
    …
  </ResizablePanel>
  <ResizableHandle withHandle aria-label="Resize the sidebar" />
  <ResizablePanel id="content">…</ResizablePanel>
</ResizablePanelGroup>
```

- **Direct children.** Panels and handles are direct children of their group, as in react-resizable-panels. Fragments and arrays count. A panel or handle anywhere else fails the render with an error that names it. Nest a group inside a panel for a two-way layout.
- **Sizes.** A string such as `"25%"` or `"25"` counts percent of the group. A number counts pixels, and strings may say `px`, `rem`, `em`, `vh`, or `vw`. Percentages render exactly on the server. Other units resolve once the browser has measured the group, and the layout follows them then, so give `defaultSize` in percent to avoid a shift after hydration. From that first measured layout on, each change starts from the current layout, so panels that come and go keep the others' proportions.
- **Bounds.** `checkPanels` rejects sizes that can never work: a size it can't read, a negative one, more than 100%, a minimum above the maximum, a collapsed size above the minimum, a default outside the bounds, or minimums and maximums that can't fill the group. The render fails with a `RangeError` that names the panel and the prop. Mixed units only compare at the measured size. There, a minimum wins over a smaller maximum, minimums that overfill the group shrink in proportion, and maximums that can't fill it grow in proportion.
- **Identity.** A panel's `id` names it in the layout and is its element id, so keep ids unique on the page. Give panels that come and go an `id`. When a panel joins, it takes its default size or an equal share, and the others shrink in proportion. When one leaves, the others share its space in proportion.
- **Events in place of callbacks.** `ResizableLayoutChangeEvent` (`'remixcn:resizable-layout-change'`) fires on the group before each change while you drag or press a key. It bubbles and is cancelable: `preventDefault()` keeps the current layout. `ResizableLayoutChangedEvent` (`'remixcn:resizable-layout-changed'`) fires once the drag, key, or double click is done and the group has rendered the result. With a controlled `layout`, it reports what the owner rendered, and doesn't fire when the owner kept the old layout. A nested group's events bubble through its parent group, so check `event.target` when you listen on an ancestor.
- **Controlled layout.** Pass `layout` to own it. The group renders it within the panels' bounds and only changes when you render a new one, usually from the change event. This replaces the imperative `groupRef.setLayout()`, and `panelRef.collapse()`, `expand()`, and `resize()`. The Collapsible example hides and shows a panel from a button this way.
- **Persistence.** The group stores nothing. To restore a layout, keep `event.layout` from the changed event where you like, and pass it back as `defaultLayout`.
- **Handlers.** The caller's `mix` on a handle runs before the handle's own handlers. Call `preventDefault()` on a `pointerdown`, `keydown`, or `dblclick` to keep the handle from acting on it, for example to turn off the double-click reset.

## API

### ResizablePanelGroup

Takes the props of `<div>` except `children`, plus:

| Prop | Type | Default |
| --- | --- | --- |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` |
| `layout` | `ResizableLayout` (panel id to percent) | not set: the group keeps its own layout |
| `defaultLayout` | `ResizableLayout` | not set: the panels' default sizes |
| `disabled` | `boolean` | `false` |

Renders `data-slot="resizable-panel-group"`, `data-orientation`, `data-disabled`, and `data-dragging` while a handle is dragged.

### ResizablePanel

Takes the props of `<div>`, plus:

| Prop | Type | Default |
| --- | --- | --- |
| `id` | `string` | generated |
| `defaultSize` | `ResizableSize` | an equal share of what the other defaults leave |
| `minSize` | `ResizableSize` | `0%` |
| `maxSize` | `ResizableSize` | `100%` |
| `collapsible` | `boolean` | `false` |
| `collapsedSize` | `ResizableSize` | `0%` |

Renders `data-slot="resizable-panel"` and `data-collapsed` while collapsed. A panel at 0% is `inert`, so focus can't move into content nobody sees.

### ResizableHandle

Takes the props of `<div>` except `role` and `children`, plus `withHandle` (shows a grip) and `disabled`. Renders `data-slot="resizable-handle"`, `aria-orientation` (vertical in a horizontal group), `aria-disabled`, `data-dragging`, and the grip as `data-slot="resizable-handle-icon"`. Give it an `aria-label`, such as "Resize the sidebar": a separator has no name of its own.

Keys, once the browser runs it:

| Key | Action |
| --- | --- |
| Left and Right arrows, in a horizontal group | Move the line 5% that way, mirrored in right-to-left text |
| Up and Down arrows, in a vertical group | Move the line 5% that way |
| Home and End | Shrink or grow the panel before the line as far as it goes. At its minimum, Home collapses a collapsible panel |
| Enter | Collapse the panel before the line, or else the one after it, if it's collapsible. Again, restore it to its earlier size |
| F6, Shift+F6 | Move focus to the next or previous handle of the group |
| Escape, while dragging | Put the layout back as it was when the drag started |

A double click puts the first neighbor with a default size back to it.

The file also exports the layout math it uses: `checkPanels`, `resolveBounds`, `fitLayout`, `adjustLayout`, and `separatorValues`, with their types. They're pure functions, so you can compute a layout for `layout` with the same rules.

## Source and behavior map

Upstream: `apps/v4/registry/bases/base/ui/resizable.tsx`, its example and the `cn-resizable-*` classes of `apps/v4/registry/styles/style-vega.css` at the pinned shadcn/ui commit, and react-resizable-panels 4.5.8. RemixCN copies no code from react-resizable-panels. It maps the behavior to the platform.

| Upstream | RemixCN |
| --- | --- |
| `ResizablePanelGroup` over `Group` | The same name over a flex `<div>`. `aria-orientation` on the group becomes `data-orientation`, since ARIA doesn't allow it on a plain `<div>` |
| `ResizablePanel` over `Panel` | The same name. Sizes are `flex-grow` values that add up to 100, with `flex-basis: 0`, as in the library |
| `ResizableHandle` over `Separator`, with `withHandle` | The same name and prop. The 1px line is a border, so it stays in forced colors, in `--input` for 3:1 contrast instead of `--border`. The grip is a bordered pill. Its hit area is 0.5rem wide, 1.5rem for touch |
| `orientation`, `defaultSize`, `minSize`, `maxSize`, `collapsible`, `collapsedSize`, `id`, `disabled` on the group and the handle | The same props, with the library's units: numbers in pixels, unitless strings in percent, and `%`, `px`, `rem`, `em`, `vh`, `vw` |
| `defaultLayout` | The same prop |
| `onLayoutChange`, `onLayoutChanged` | `ResizableLayoutChangeEvent` and `ResizableLayoutChangedEvent`, which bubble. The first is cancelable |
| `groupRef` (`getLayout`, `setLayout`), `panelRef` (`collapse`, `expand`, `getSize`, `isCollapsed`, `resize`) | The controlled `layout` prop and the change events. `data-collapsed` shows a collapsed panel |
| `elementRef` | `mix={ref(...)}` on the part |
| Arrow keys by 5%, Home, End, Enter to collapse and restore, F6 between separators | The same keys. RemixCN mirrors Left and Right in right-to-left text, where the library doesn't. Enter also collapses the panel after the line when only that one is collapsible |
| Collapse below halfway between the collapsed size and the minimum | The same rule for collapsing. Expanding a collapsed panel by drag uses the same halfway point, as `collapsedThreshold` describes in later versions |
| Double click resets to the default size | The same. Cancel the `dblclick` event to turn it off, in place of `disableDoubleClick` |
| Pointer drag with a global cursor and hit regions around separators | Pointer Events with pointer capture on the handle, `touch-action: none`, a resize cursor on the group while dragging, and no text selection. Pointer cancel and Escape put the layout back. A drag ends when its handle leaves the group |
| `onResize` on a panel | Not ported. Read `event.layout[id]` from the group's change event |
| `collapsedThreshold`, `groupResizeBehavior`, `disabled` on a panel, `disableCursor`, `resizeTargetMinimumSize`, `resizePreviewMode` | Not ported. A panel keeps its share in percent when the group resizes, and bounds in pixels refit. Disable the handles next to a panel to fix its size |
| Server rendering with a layout shift for percentages | Percentages render exactly on the server. Handles turn on after hydration |

## Accessibility checks

Automated (`bun run test`, `bun run test:browser`, `bun run test:e2e`). The browser and end-to-end tests run in Chromium, Firefox, and WebKit:

- axe-core: no WCAG 2.2 A or AA violations on the examples, before and after hydration, in light and dark.
- Server HTML: the layout from percentages and static separators without a tab stop. Hydration: the same layout, focusable separators with values and `aria-controls`, and no console errors.
- Keyboard: arrows, Home, End, Enter, F6, and Escape on the handles, mirrored in right-to-left text.
- Pointer: mouse drags past the group, touch drags on a handle, and pointer cancel. Playwright drives real touch only in Chromium, so the other engines get the touch pointer events a finger sends.
- Bounds and changes: minimums and maximums, impossible sizes, collapse, nested groups, a resized group with pixel bounds, panels that come and go, a controlled layout, canceled changes, and two groups that stay apart.
- Cleanup: the observer disconnects and a drag stops once the group, or only the dragged handle, is removed in the middle of it.
- Forced colors: the handle lines and the grip keep their borders. Light and dark: the handle line uses `--input`, which `theme.test.ts` keeps at 3:1. Focus: the theme's 2px outline on a handle. Reduced motion: transitions take 0s. Reflow: 320px wide without scrolling sideways, also at 200% text.

Not checked yet:

- Screen readers. Nobody has listened to the separators in NVDA, JAWS, VoiceOver, or TalkBack.
- Real touch devices and Windows High Contrast. Touch and forced colors were emulated.
- Narrow panels at 200% text. On a 390px screen, a 25% panel wraps a short label letter by letter. The page doesn't scroll sideways, and dragging the handle widens the panel.

These checks show how the component behaves in three browser engines. They're not an accessibility certification.
