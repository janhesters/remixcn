# Kbd

Native `<kbd>` elements for single keys and key combinations.

- Source: `registry/ui/kbd.tsx`. Needs `registry/lib/theme.css`.
- Examples: `registry/examples/kbd-example.tsx`. Run them with `bun run display-examples`.
- Upstream: shadcn/ui [`kbd.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/kbd.tsx) and its [docs](https://ui.shadcn.com/docs/components/base/kbd).

## Usage

```tsx
import { Kbd, KbdGroup } from '#remixcn/ui/kbd.tsx'

<KbdGroup>
  <Kbd>Ctrl</Kbd>
  <span>+</span>
  <Kbd>B</Kbd>
</KbdGroup>
```

## API

- `Kbd` renders a `<kbd>` for one key. It passes pointer presses through to the control around it.
- `KbdGroup` renders an outer `<kbd>` for a combination, as HTML marks one up.

Both take every native prop and `mix`, and render `data-slot="kbd"` or `"kbd-group"`. Inside a later Tooltip (`data-slot="tooltip-content"`), a key takes the tooltip's colors.

## Composition

- **Symbols.** A `<kbd>` takes no `aria-label`. Show a symbol such as ⌘ `aria-hidden`, with its name in visually hidden text and a `title`, as the `Key` example component does. An arrow icon names its key the same way.
- **What the screen shows.** Put menu items and other output in `<samp>` inside `<kbd>`.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `Kbd`, `KbdGroup` (both `<kbd>`) | Same | |
| `h-5 min-w-5 px-1 rounded-sm bg-muted text-xs` | Same measures, `min-height` instead of a fixed height | |
| `pointer-events-none select-none` | Same | |
| `in-data-[slot=tooltip-content]` colors | Same | |
| — | A border in forced colors | The background drops there |
| Docs: Group, Button, Input Group, RTL | `KbdCombinations`, `KbdInControls`, the fixture's pages | |
| Docs: Tooltip | Waits for Tooltip | |
| Examples: Arrow Keys, With Icons, With samp | `KbdWithIcons`, `KbdWithSamp` | |

## Accessibility checks

Automated: native `kbd` nesting on the server; key text is 4.5:1 or more in both themes; keys keep an outline in forced colors; the page passes axe-core's WCAG 2.2 A and AA rules. Screen readers weren't run, so how each reads symbols is untested. This isn't an accessibility certification.
