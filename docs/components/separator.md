# Separator

A horizontal or vertical line, meaningful or decorative.

- Source: `registry/ui/separator.tsx`. Needs `registry/lib/theme.css`.
- Examples: `registry/examples/separator-example.tsx`. Run them with `bun run display-examples`.
- Upstream: shadcn/ui [`separator.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/separator.tsx), its [docs](https://ui.shadcn.com/docs/components/base/separator), and [Base UI Separator](https://base-ui.com/react/components/separator.md).

## Usage

```tsx
import { Separator } from '#remixcn/ui/separator.tsx'

<Separator />
<Separator orientation="vertical" decorative />
```

## API

### `Separator`

A `<div>` that takes every native `<div>` prop, `mix`, and:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | A line across, or a line down that stretches to the row's height |
| `decorative` | `boolean` | `false` | Renders `role="none"`, so assistive technology skips a line that only draws |

A meaningful separator renders `role="separator"` and `aria-orientation`, as Base UI does. Both render `data-slot="separator"` and `data-orientation`.

## Composition

- Use a meaningful separator between sections, and a decorative one between things that already read as separate, such as links in a row.
- A list or a description list may hold only its items, so put separators between lists, not in them, or use Item's `ItemSeparator`, which is decorative.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| Base UI `Separator`: `role="separator"`, `aria-orientation` | Same | |
| — | `decorative` | Not in Base UI; shadcn's Radix version had it. Renders `role="none"` |
| `bg-border` with `h-px` or `w-px` | A 1px border in `--border` | Stays visible in forced colors |
| `data-horizontal`, `data-vertical` | `data-orientation` | |
| Docs: Vertical, Menu, List, RTL | `SeparatorVertical`, `SeparatorVerticalMenu`, `SeparatorInList`, `SeparatorHorizontal` | |

## Accessibility checks

Automated: roles and orientations on the server, the line stays visible in forced colors, and the page passes axe-core's WCAG 2.2 A and AA rules. Screen readers weren't run. This isn't an accessibility certification.
