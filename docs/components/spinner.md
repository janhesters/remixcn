# Spinner

A turning ring that shows something is pending.

- Source: `registry/ui/spinner.tsx`. Needs `registry/lib/theme.css`.
- Examples: `registry/examples/spinner-example.tsx`. Run them with `bun run display-examples`.
- Upstream: shadcn/ui [`spinner.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/spinner.tsx) and its [docs](https://ui.shadcn.com/docs/components/base/spinner).

## Usage

```tsx
import { Spinner } from '#remixcn/ui/spinner.tsx'

<Spinner label="Loading invoices" />
<Button disabled>
  <Spinner decorative data-icon="inline-start" />
  Sending…
</Button>
```

## API

`Spinner` renders an `<svg>` that takes every native `<svg>` prop, `mix`, and:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `label` | `string` | `'Loading'` | Names what is pending |
| `decorative` | `boolean` | `false` | Hides it from assistive technology, next to text that says the same |
| `data-icon` | `'inline-start' \| 'inline-end'` | | Tightens a Button's or Badge's padding on that side |

A named spinner renders `role="status"` and `aria-label`, as shadcn does. It is 1rem and takes the text color; size or color it with a `css()`. It stops turning for reduced motion.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `Spinner`: an icon with `role="status" aria-label="Loading"` | Same, with RemixCN's own ring | No icon library |
| — | `label` and `decorative` | So a spinner names what's pending, or stays out of a button's name |
| `animate-spin` | Same, still for reduced motion | |
| Docs: Customization, Size, Button, Badge, Input Group, Empty, RTL | `SpinnerSizes`, `SpinnerInButtons`, `SpinnerInBadges`, `SpinnerInField`, `EmptyLoading` | A native search field stands in for Input Group |

## Accessibility checks

Automated: a named status by default, a hidden decorative one, every spinner on the example page is named or hidden, none inside a button is announced, and the ring stops for reduced motion. Screen readers weren't run. This isn't an accessibility certification.
