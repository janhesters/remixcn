# Skeleton

A placeholder shape that pulses while content loads.

- Source: `registry/ui/skeleton.tsx`. Needs `registry/lib/theme.css`.
- Examples: `registry/examples/skeleton-example.tsx`. Run them with `bun run display-examples`.
- Upstream: shadcn/ui [`skeleton.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/skeleton.tsx) and its [docs](https://ui.shadcn.com/docs/components/base/skeleton).

## Usage

```tsx
import { Skeleton } from '#remixcn/ui/skeleton.tsx'

<p role="status" mix={css(visuallyHidden)}>Loading the invoice</p>
<div aria-busy="true">
  <Skeleton mix={css({ width: '12rem', height: '1rem' })} />
</div>
```

## API

`Skeleton` renders a `<div aria-hidden="true">` with a muted background, rounded corners and a pulse. It takes every native `<div>` prop and `mix`; size it with a `css()`. The pulse stops for reduced motion. In forced colors, which drop the background, a border in `CanvasText` draws the shape.

## Composition

A skeleton says nothing to assistive technology. Mark the region that loads with `aria-busy="true"`, and say what loads in a status outside that region, as the examples' `Loading` component does: assistive technology may hold back changes inside a busy region until it's no longer busy, so a status inside it could be cleared before anyone hears it. The Reload example shows the whole cycle, and says when it's done.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `Skeleton` `animate-pulse bg-muted rounded-md` | Same | |
| — | `aria-hidden="true"` | Placeholder shapes aren't content |
| — | Still for reduced motion; a border in forced colors | |
| Docs: Avatar, Card, Text, Form, Table, RTL | `SkeletonAvatar`, `SkeletonCard`, `SkeletonText`, `SkeletonForm`, `SkeletonTable` | |
| — | `SkeletonReload` | Busy, a status outside the busy region, then the content and a done status |

## Accessibility checks

Automated: hidden on the server; every loading status sits outside its busy region; a reloading region turns busy and says what loads, keeps focus on its button, then shows the content and says it's done; the pulse stops for reduced motion; the shape stays visible in forced colors. This isn't an accessibility certification.
