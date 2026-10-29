# Typography

Styles for long-form text: headings, paragraphs, quotes, lists, inline code, links and tables, as mixins for native elements. It's a recipe: copy it, and give each element you want styled its style.

- Source: `registry/examples/typography.tsx`. Needs `registry/lib/theme.css`.
- Run it with `bun run display-examples`.
- Upstream: shadcn/ui's [Typography docs](https://ui.shadcn.com/docs/components/base/typography), which style native elements with utility classes.

## Usage

```tsx
// remixcn add typography installs it in your components directory.
import { typography } from './typography.tsx'

<h2 mix={typography.h2}>Payment terms</h2>
<p mix={typography.p}>Invoices are due in 14 days.</p>
```

## API

`typography` holds one `css()` mixin for each of `h1`, `h2`, `h3`, `h4`, `p`, `lead`, `large`, `small`, `muted`, `link`, `blockquote`, `list`, `inlineCode`, `tableRegion`, `table`, `tr`, `th` and `td`. The file also exports an example for each: `TypographyH1` to `TypographyMuted`, `TypographyTable` and `TypographyDemo`.

- No rule reaches an element you don't give a style to, so the recipe never restyles the rest of your app.
- Headings keep a scroll margin, so a sticky header doesn't cover them after a link jumps to them.
- A table sits in a region that scrolls sideways on a narrow screen. Give the region `role="region"`, `tabindex="0"` and a name, such as its caption, so a keyboard can scroll it. Column headers use `scope="col"`, and `data-align="end"` aligns numbers.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| h1, h2, h3, h4, p, blockquote, table, list, inline code, lead, large, small, muted | Same names in `typography` | Same sizes and weights, with logical margins and borders |
| `[&[align=center]]` on cells | `data-align` | |
| Table wrapper `overflow-y-auto` | A named, focusable region that scrolls sideways | |
| The demo article | `TypographyDemo` | New invented text about invoices |

## Accessibility checks

Automated: native elements, heading levels in order, a caption and column headers, the scrolling region named and focusable, and no rule without a class. The page passes axe-core's WCAG 2.2 A and AA rules and fits 320px with text at 200%, with the table scrolling in its region. This isn't an accessibility certification.
