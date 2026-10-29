# Aspect Ratio

Keeps its content at a width-to-height ratio, with the native CSS `aspect-ratio` property.

- Source: `registry/ui/aspect-ratio.tsx`. Needs `registry/lib/theme.css`.
- Examples: `registry/examples/aspect-ratio-example.tsx`. Run them with `bun run display-examples`.
- Upstream: shadcn/ui [`aspect-ratio.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/aspect-ratio.tsx) and its [docs](https://ui.shadcn.com/docs/components/base/aspect-ratio).

## Usage

```tsx
import { AspectRatio } from '#remixcn/ui/aspect-ratio.tsx'

<AspectRatio ratio={16 / 9}>
  <img src="/chart.png" alt="Revenue by month" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
</AspectRatio>
```

## API

### `AspectRatio`

A `<div>` that takes every native `<div>` prop, `mix`, and `ratio`, a number such as `16 / 9`. It sets `--ratio` in its `style`, next to the style you pass, and its rule sets `aspect-ratio: var(--ratio)` and `position: relative`. A ratio that isn't a positive finite number is left out, so the box sizes by its content. It renders `data-slot="aspect-ratio"`.

## Composition

- Position the content yourself, as in shadcn: absolute and filling the box, with `object-fit` for an image.
- The box takes its shape from CSS, before the image loads and without JavaScript, so nothing moves when it arrives.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `AspectRatio` with `ratio` and `--ratio` | Same | A ratio that isn't positive or finite is dropped |
| `relative aspect-(--ratio)` | Same, in its `css()` | |
| Docs: Square, Portrait, RTL; examples 16:9, 1:1, 9:16, 21:9 | `AspectRatioRatios`, `AspectRatioVideo` | |

## Accessibility checks

Automated: the server HTML sets the ratio, a caller's style stays, and invalid ratios fall back to the content's size. Images in the examples have alt text. The page passes axe-core's WCAG 2.2 A and AA rules and fits 320px with text at 200%. This isn't an accessibility certification.
