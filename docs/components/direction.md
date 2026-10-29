# Direction

Sets the text direction of a subtree with the native `dir` attribute, and reads it while a component renders or in the browser.

- Source: `registry/ui/direction.tsx`. Needs `registry/lib/theme.css`.
- Examples: `registry/examples/direction-example.tsx`. Run them with `bun run display-examples`.
- Upstream: shadcn/ui [`direction.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/direction.tsx), its [docs](https://ui.shadcn.com/docs/components/base/direction), and [Base UI DirectionProvider](https://base-ui.com/react/utils/direction-provider.md).

## Usage

```tsx
import { DirectionProvider, directionOf, getDirection } from '#remixcn/ui/direction.tsx'

<DirectionProvider direction="rtl" lang="ar">
  <InvoiceSummary />
</DirectionProvider>
```

## API

### `DirectionProvider`

A `<div dir="ltr|rtl">` with `display: contents`, so it adds no box and never changes the layout around its content. It takes every native `<div>` prop, `mix`, and `direction`, `'ltr'` by default. The browser applies the direction before any script runs: text, logical properties and `:dir()` selectors follow it. A nested provider sets its own direction for its subtree. For a page that is right to left as a whole, set `dir` on `<html>` too.

### `getDirection(handle)`

Returns the nearest provider's direction while a component renders, on the server and in the browser, or `'ltr'` without one. It replaces Base UI's `useDirection()` hook.

### `directionOf(element)`

Returns the direction the browser uses for an element, from any `dir` attribute or `direction` style above it. Use it in event handlers, such as one that maps arrow keys.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `DirectionProvider`, React context only | `DirectionProvider`, a `dir` attribute and Remix context | The native attribute makes the browser lay the subtree out; context lets components read it while they render |
| `useDirection()` | `getDirection(handle)` and `directionOf(element)` | A hook can't run in Remix components; these read the context or the computed style |
| Docs: Usage, useDirection | `DirectionNested`, `DirectionSwitch` | |

## Accessibility checks

Automated: the server HTML sets `dir` on each nested subtree; `getDirection` reads the nearest provider on the server; in the browser, nested subtrees keep their own direction, a changed direction is followed by `dir`, `directionOf`, `getDirection` and `:dir()`, and the provider adds no box. Pair `dir` with a `lang` that matches the text, as the examples do. This isn't an accessibility certification.
