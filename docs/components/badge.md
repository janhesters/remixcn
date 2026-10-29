# Badge

A small label for a status, a count or a category, in six variants, and `badgeVariants()` for links that look like badges.

- Source: `registry/ui/badge.tsx`. Needs `registry/lib/theme.css` and `registry/lib/styles.ts`.
- Examples: `registry/examples/badge-example.tsx`. Run them with `bun run display-examples`.
- Upstream: shadcn/ui [`badge.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/badge.tsx) and its [docs](https://ui.shadcn.com/docs/components/base/badge).

## Usage

```tsx
import { Badge, badgeVariants } from '#remixcn/ui/badge.tsx'

<Badge variant="secondary">Paid</Badge>
<a href="/invoices?status=overdue" mix={badgeVariants({ variant: 'destructive' })}>3 overdue</a>
```

## API

### `Badge`

A `<span>` that takes every native `<span>` prop, `mix`, and `variant`: `'default'`, `'secondary'`, `'destructive'`, `'outline'`, `'ghost'` or `'link'`. It renders `data-slot="badge"` and `data-variant`. `aria-invalid="true"` draws a red border.

### `badgeVariants(options?)`

Returns the mixins that give any element a badge's look, `data-slot` and `data-variant`. Use it on a native link, so it keeps its link role and navigation. `badgeVariantNames` lists the variants.

## Composition

- **Icons and spinners.** Mark one with `data-icon="inline-start"` or `"inline-end"` to tighten the padding on that side. A spinner next to text is `decorative`.
- **Links.** Only a badge that is a link reacts to the pointer and shows the focus ring.
- **Long text** wraps when the badge would be wider than its container.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `Badge` with `render` | `Badge`, and `badgeVariants()` on another element | |
| Six variants | Same names and colors | |
| `[a]:hover` colors | Same | Ghost's hover applies only to links too, so a plain badge never looks clickable |
| `whitespace-nowrap overflow-hidden` | Wraps only when it would overflow | So no text is cut off on a narrow screen or with large text |
| `has-data-[icon=…]` padding, `[&>svg]:size-3` | Same | |
| `focus-visible:ring-[3px]` | The theme's 2px outline and a `--ring` border | Stays visible in forced colors |
| `aria-invalid:border-destructive` | `invalidState` | |
| Destructive `text-destructive` on its tint | Mixed with 25% `--foreground` | As in Button, to reach 4.5:1 |
| Docs: Variants, With Icon, With Spinner, Link, Custom Colors, RTL | `BadgeVariants`, `BadgeWithIcons`, `BadgeWithSpinner`, `BadgeAsLink`, `BadgeCustomColors`, the Right to left section | |
| Example: Long Text | `BadgeLongText` | |
| — | `BadgeInvalid` | |

## Accessibility checks

Automated: every variant renders on the server, links keep their href, text is 4.5:1 or more in both themes, link badges show a focus ring also in forced colors, arrows mirror in right-to-left text, and the page fits 320px with text at 200%. Screen readers weren't run. This isn't an accessibility certification.
