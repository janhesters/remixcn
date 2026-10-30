# Marker

A line of status, a note, or a labelled divider in a conversation, such as "Explored 4 files" or "Today".

- Source: `registry/ui/marker.tsx`. Needs `registry/lib/theme.css` and `registry/lib/styles.ts`.
- Examples: `registry/examples/marker-example.tsx`. Run them with `bun run conversation-examples`.
- Upstream: shadcn/ui [`marker.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/marker.tsx) and its [docs](https://ui.shadcn.com/docs/components/base/marker).

## Usage

```tsx
import { css } from 'remix/component'

import { shimmer } from '#remixcn/lib/styles.ts'
import { Marker, MarkerContent, MarkerIcon, markerVariants } from '#remixcn/ui/marker.tsx'
import { Spinner } from '#remixcn/ui/spinner.tsx'

const shimmering = css(shimmer())

<Marker role="status">
  <MarkerIcon>
    <Spinner decorative />
  </MarkerIcon>
  <MarkerContent mix={shimmering}>Checking the logs…</MarkerContent>
</Marker>

<Marker variant="separator">
  <MarkerContent>Today</MarkerContent>
</Marker>

<a href="/pulls/42" mix={markerVariants()}>
  <MarkerContent>View the pull request</MarkerContent>
</a>
```

## API

| Part | Renders | Notes |
| --- | --- | --- |
| `Marker` | `<div>` | `variant`: `'default'`, `'border'` or `'separator'`. No role; pass `role="status"` for one that changes while work runs |
| `markerVariants(options?)` | Mixins | The marker look, `data-slot` and `data-variant` for a native `<a>` or `<button>`, in place of `render` |
| `MarkerIcon` | `<span aria-hidden="true">` | A decorative icon, 1rem |
| `MarkerContent` | `<span>` | The text. Long words break. In a separator, it's centered and wraps between the lines |

Every part takes its native element's props and `mix`. `markerVariantNames` lists the variants. `shimmer()` in `registry/lib/styles.ts` is shadcn's `shimmer` utility as a style object. Its highlight sits between `--foreground` and `--muted-foreground`, so text on the page or a card keeps 4.5:1 through the sweep; set `--shimmer-color` for text on another surface.

## Composition

- **Status.** For a step that runs, such as "Thinking…", set `role="status"`, so assistive technology announces each change, and mark the spinner `decorative`, since the text says the same.
- **Labelled dividers.** Use the separator variant without a role. Its lines are decorative, and its text reads as ordinary content. Don't add `role="separator"`, which would hide the label.
- **Icon only.** A marker without text needs a name, such as `role="img"` and `aria-label="Synced"`.
- **Links and buttons.** Use `markerVariants()` on a native element. A link is underlined; a button drops its native box and shows a pointer.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `Marker`, `MarkerIcon`, `MarkerContent`, `markerVariants` | Same names | `markerVariants()` returns mixins instead of class names |
| `render` | `markerVariants()` | |
| Separator `before:`/`after:` with `bg-border` | Pseudo-elements drawn with a top border | So forced colors keep them. Each keeps 1rem, so a long label wraps between visible lines |
| Separator content `flex-none` | `flex: 0 1 auto` | So a long label wraps instead of overflowing |
| Border `border-b pb-2` | Same, with a logical border | |
| `[a]:underline`, `[a]:hover:text-foreground` | Same | |
| `text-left` | `text-align: start` | Follows right-to-left text |
| The `shimmer` utility from the `shadcn` package | `shimmer()` in `styles.ts` | Still for reduced motion, plain text in forced colors. shadcn's highlight fades the text to about 1.3:1; this one sits between `--foreground` and `--muted-foreground`, so the text keeps 4.5:1 |
| Docs: Variants, Status, Shimmer, Separator, Border, With Icon, Links and Buttons | `MarkerVariants`, `MarkerStatus`, `MarkerShimmer`, `MarkerSeparator`, `MarkerBorder`, `MarkerWithIcon`, `MarkerLinksAndButtons` | Plus `MarkerRtl` |
| Examples: Accordion, Drawer | Wait for Accordion and Drawer | |

## Accessibility checks

Automated: a running marker announces each step through `role="status"`, and its button stays focusable while it's disabled; the shimmer animates only without reduced motion, and keeps 4.5:1 through the sweep in both schemes; separator lines stay in forced colors; a marker button reports `aria-expanded`; text reaches 4.5:1 in both themes; the page passes axe-core's WCAG 2.2 A and AA rules and fits 320px with text at 200%. This isn't an accessibility certification.

Manual gaps: how often screen readers repeat a fast-changing status was not checked with a screen reader.
