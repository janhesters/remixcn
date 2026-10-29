# Card

A surface that groups a title, a description, an action, content and a footer about one subject.

- Source: `registry/ui/card.tsx`. Needs `registry/lib/theme.css`.
- Examples: `registry/examples/card-example.tsx`. Run them with `bun run display-examples`.
- Upstream: shadcn/ui [`card.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/card.tsx) and its [docs](https://ui.shadcn.com/docs/components/base/card).

## Usage

```tsx
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '#remixcn/ui/card.tsx'

<Card>
  <CardHeader>
    <CardTitle level={3}>INV-0042</CardTitle>
    <CardDescription>Due 4 November</CardDescription>
    <CardAction><Button variant="link">Edit</Button></CardAction>
  </CardHeader>
  <CardContent>€1,200.00</CardContent>
  <CardFooter><Button>Send</Button></CardFooter>
</Card>
```

## API

| Part | Renders | Props besides the native ones and `mix` |
| --- | --- | --- |
| `Card` | `<div>` with `data-size` | `size`: `'default'` (1.5rem spacing) or `'sm'` (1rem) |
| `CardHeader` | `<div>`, a grid | `border`: a line under it, with the card's spacing |
| `CardTitle` | `<div>`, or `<h1>`–`<h6>` | `level`: renders a native heading |
| `CardDescription` | `<div>` | |
| `CardAction` | `<div>` | Sits in the header's end column, beside the title and description |
| `CardContent` | `<div>` | |
| `CardFooter` | `<div>`, a wrapping row | `border`: a line above it, with the card's spacing |

Every part renders shadcn's `data-slot`. `--card-spacing` on the card sets the padding and gaps of every part.

## Composition

- **Headings and landmarks.** Give the title a `level` that fits the page's outline. To make a card a landmark, add `role="region"` and `aria-labelledby` pointing at the title, as the form example does.
- **Images.** An image that starts the card reaches its top and side edges.
- **Edge to edge.** Remove the content's padding with a `css()` and use `var(--card-spacing)` inside, as the table example does. A table too wide for a narrow screen scrolls in a region a keyboard can reach.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `Card` with `size` and `--card-spacing` | Same | |
| `ring-1 ring-foreground/10` | A 1px border in `--foreground` at 10% | Stays visible in forced colors |
| `CardHeader` grid with `has-data-[slot=card-action]` columns and `@container/card-header` | Same, with `container-name: card-header` | |
| `[.border-b]:pb-(--card-spacing)` on the header, `[.border-t]:pt-…` on the footer | `border` prop | A Tailwind class can't reach a component without Tailwind |
| `CardTitle`, `CardDescription` | Same, as `<div>` | `CardTitle` adds `level`. Long words break |
| `CardAction` `col-start-2 row-span-2` | Same | |
| `CardFooter` `flex items-center` | Also wraps | So buttons never overflow a narrow card |
| `has-[>img:first-child]:pt-0`, rounded image corners | Same; the card clips its corners | |
| Docs: Size, Spacing, Edge to edge, Image, RTL | `CardSizes`, `CardCustomSpacing`, `CardEdgeToEdge`, `CardWithImage`, the Right to left section | |
| Examples: Login, Header and Footer with Border | `CardWithForm`, `CardSizes` | |

## Accessibility checks

Automated: every part and its order on the server; the action sits in the end column; a form in a card submits from its footer button; descriptions are 4.5:1 or more in both themes; the page fits 320px with text at 200% and passes axe-core's WCAG 2.2 A and AA rules. Screen readers weren't run. This isn't an accessibility certification.
