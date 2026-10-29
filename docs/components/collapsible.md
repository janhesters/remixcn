# Collapsible

A native button that shows and hides a panel. Accordion builds its items on it.

- Source: `registry/ui/collapsible.tsx`. Needs `registry/lib/theme.css`.
- Examples: `registry/examples/collapsible-example.tsx`. Run them with `bun run disclosure-examples` (http://localhost:4405/).
- Upstream: shadcn/ui [`collapsible.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/collapsible.tsx), its [docs](https://ui.shadcn.com/docs/components/base/collapsible), and [Base UI Collapsible](https://base-ui.com/react/components/collapsible.md).

## Usage

```tsx
import { on } from 'remix/component'

import { buttonVariants } from '#remixcn/ui/button.tsx'
import { Collapsible, CollapsibleContent, CollapsibleTrigger, collapsibleChangeType } from '#remixcn/ui/collapsible.tsx'

<Collapsible id="filters" mix={on(collapsibleChangeType, (event) => save(event.open))}>
  <CollapsibleTrigger mix={buttonVariants({ variant: 'ghost', size: 'sm' })}>Filters</CollapsibleTrigger>
  <CollapsibleContent>…</CollapsibleContent>
</Collapsible>
```

## How it runs

The trigger handles clicks, so Collapsible works once the browser runs it: inside a client entry of your app, as the examples are. It isn't a client entry itself. Remix serializes an entry's props to JSON, so an entry couldn't take your `mix`, and it renders an entry's component children to static HTML first.

Before the browser runs it, and on a page that only renders on the server, the server HTML shows the first state: an open panel is there, a closed one isn't, or is `hidden`. The trigger is a `type="button"` that does nothing, so it never submits a form. Hydration keeps that state.

## API

### `Collapsible`

Takes every prop of a `<div>`, and:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `open` | `boolean` | not set: it keeps its own state | Whether the panel is open, for a collapsible you control |
| `defaultOpen` | `boolean` | `false` | Whether the panel starts open |
| `disabled` | `boolean` | `false` | Disables the trigger natively |
| `id` | `string` | a generated id | The trigger's and panel's ids derive from it: `<id>-trigger` and `<id>-panel` |

It renders `data-slot="collapsible"`, `data-open` or `data-closed`, and `data-disabled`.

### `CollapsibleTrigger`

A native `<button>`. Takes every button prop except `type`, `id`, `aria-expanded` and `aria-controls`, which it sets: it's always `type="button"`, `aria-expanded` follows the state, and `aria-controls` names the panel while it's open. It renders `data-slot="collapsible-trigger"` and `data-panel-open`. Your click handlers run first: `event.preventDefault()` keeps the state.

### `CollapsibleContent`

Takes every prop of a `<div>` except `id` and `hidden`, and:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `keepMounted` | `boolean` | `false` | Keeps a closed panel in the document with `hidden`, instead of removing it. What you typed in it stays |
| `hiddenUntilFound` | `boolean` | `false` | Keeps a closed panel with `hidden="until-found"`, so the browser's find in page searches it and opens it on a match. It wins over `keepMounted` |

It renders `data-slot="collapsible-content"`, `data-open` or `data-closed`, and while it moves, `data-starting-style`, `data-ending-style` and `data-animating`. While it closes, it's `inert`. Otherwise your own `inert` applies.

### Change event

`CollapsibleChangeEvent` (type `collapsibleChangeType`, `'remixcn:collapsible-change'`) fires on the collapsible before it opens or closes, and bubbles. `event.open` is the next state. `event.preventDefault()` keeps the current one. A controlled collapsible (`open`) changes only when you render the new value.

### Also exported

`animationsFinished(element, signal)` resolves once an element's transitions end. `collapsiblePanelHeight` is the name of the custom property the panel moves with, `--collapsible-panel-height`. `CollapsibleContext` is the value parts read from the collapsible, so another part, such as Accordion's, can name its trigger.

## Composition

- **Trigger looks.** Give the trigger a button's look with `mix={buttonVariants(...)}` from `button.tsx`. It stays one native button. This replaces Base UI's `render={<Button />}`.
- **Placement.** The trigger and the panel may sit anywhere inside the collapsible, in any order, such as a trigger after its panel in a row. They find each other through the collapsible.
- **Icons.** Turn a chevron with a rule on `[aria-expanded="true"]`, as the File tree example does. Mirror one that points onward with `mirrorInRtl`.
- **Motion.** The panel grows and shrinks its height over `--duration-normal` with `--ease-out`. Reduced motion sets the duration to 0s. Override the transition with your own `css()`, such as `transitionDuration: '0s'`.
- **Focus.** When a panel closes while focus is inside it, focus moves to its trigger first. While it shrinks, the panel is `inert`, so Tab skips it.
- **Nesting.** Collapsibles nest. Each listens only to its own trigger.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `Collapsible` on Base UI's `Collapsible.Root` | `Collapsible`, a `<div>` | |
| `open`, `defaultOpen`, `disabled` | Same props | |
| `onOpenChange(open, details)` | `CollapsibleChangeEvent`, cancelable | Base UI's `details.cancel()` becomes `event.preventDefault()` |
| `CollapsibleTrigger` on `Collapsible.Trigger` | A native button with `aria-expanded` and `aria-controls` | |
| `render`, `nativeButton` | Not ported | `buttonVariants()` on the trigger gives it a button's look. The trigger is always a native button |
| `CollapsibleContent` on `Collapsible.Panel` | `CollapsibleContent` | |
| `keepMounted`, `hiddenUntilFound` | Same props | `beforematch` opens the panel. If a listener cancels the change, or a controlled owner keeps it closed, the panel hides again |
| `data-open`, `data-closed`, `data-panel-open`, `data-starting-style`, `data-ending-style` | Same attributes | |
| `--collapsible-panel-height` | Same | Set only while the panel moves. Otherwise the panel takes its natural height, so it follows its content |
| `--collapsible-panel-width` | Not set | Nothing in shadcn animates the width |
| shadcn's styles | None for the trigger, a height transition for the panel | shadcn's Collapsible has no styles. The ticket asks for reduced-motion transitions, so the panel moves with the motion tokens |
| Docs: File Tree | `CollapsibleFileTree` | Nested collapsibles under Tabs, in a small Card. The tree sits in a tab panel, so each tab has one |
| Docs: Settings | `CollapsibleSettings` | A controlled collapsible in a Card, with Field and Input and visually hidden labels. The trigger names its action |
| — | `CollapsibleRecoveryKeys` | Base UI's demo, with `keepMounted` |
| Docs: RTL | The fixture's Direction section | |

### Where it looks different from shadcn

- **The panel moves.** shadcn's Collapsible panel appears and disappears at once. RemixCN grows and shrinks it with the motion tokens, which reduced motion sets to 0s.
- **Settings names its trigger.** shadcn's square trigger has only an icon. RemixCN's says "Show the bottom corners" or "Hide the bottom corners".

## Accessibility checks

Automated, in Chromium, Firefox and WebKit (`bun run test`, `test:browser`, `test:e2e`):

- The trigger is a native button with `aria-expanded`, and `aria-controls` names the panel while it's open.
- Enter, Space and clicks toggle the panel. A disabled trigger is natively disabled.
- A closed panel is out of the document or `hidden`, and a closing one is `inert`, so nothing in them takes focus, also with Tab during a slow transition. Focus in a closing panel moves to its trigger.
- The server renders the first state, and hydration keeps it. Without JavaScript, the trigger does nothing and submits nothing.
- A change can be cancelled, and a controlled collapsible changes only when its owner renders it.
- Separate instances keep separate state and ids. Nested collapsibles toggle only themselves.
- A panel removed while it moves stops its transition without errors.
- `hidden="until-found"` panels open when `beforematch` fires.
- The panel moves over `--duration-normal`, and in 0s with reduced motion.
- axe-core finds no WCAG 2.2 A or AA violations on the example page in either color scheme, with panels open.
- The page fits 320px without scrolling sideways, with normal text and at 200%.

Not checked, so not claimed:

- Real find in page (Ctrl+F) can't be driven by Playwright. The test fires `beforematch` itself.
- Screen readers (NVDA, JAWS, VoiceOver, TalkBack) weren't tested. Safari itself wasn't run, only Playwright's WebKit in CI. Forced colors were emulated, not tested in Windows.
- This isn't an accessibility certification.
