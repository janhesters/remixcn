# Bubble

A message surface that sizes to its text, in seven looks, aligned to the start or the end, with reactions on its edge.

- Source: `registry/ui/bubble.tsx`. Needs `registry/lib/theme.css` and `registry/lib/styles.ts`.
- Examples: `registry/examples/bubble-example.tsx`. Run them with `bun run conversation-examples`.
- Upstream: shadcn/ui [`bubble.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/bubble.tsx) and its [docs](https://ui.shadcn.com/docs/components/base/bubble).

## Usage

```tsx
import { Bubble, BubbleContent, BubbleReactions, bubbleContentVariants } from '#remixcn/ui/bubble.tsx'

<Bubble variant="secondary">
  <BubbleContent>I checked the registry output and removed the stale route.</BubbleContent>
  <BubbleReactions role="img" aria-label="Reactions: thumbs up">
    <span>👍</span>
  </BubbleReactions>
</Bubble>

<Bubble variant="muted" align="end">
  <button type="button" mix={[bubbleContentVariants(), on('click', reply)]}>
    I forgot my password
  </button>
</Bubble>
```

## API

| Part | Renders | Notes |
| --- | --- | --- |
| `Bubble` | `<div>` | `variant`: `'default'`, `'secondary'`, `'muted'`, `'tinted'`, `'outline'`, `'ghost'` or `'destructive'`. `align`: `'start'` (default) or `'end'`. Up to 80% of its column wide; a ghost bubble may span it. In an end `Message`, it moves to the end too |
| `BubbleContent` | `<div>` | The framed text. Long words break |
| `bubbleContentVariants()` | Mixins | The content's look and `data-slot` for a native `<a>` or `<button>`, in place of `render` |
| `BubbleReactions` | `<div>` | `side`: `'bottom'` (default) or `'top'`. `align`: `'end'` (default) or `'start'`. Overlaps that edge, 0.75rem from that end |
| `BubbleGroup` | `<div>` | Stacks consecutive bubbles from one sender. Set `align` on each Bubble |

Every part takes its native element's props and `mix`. `bubbleVariantNames` lists the variants.

## Composition

- **Meaning beyond color.** The variants tell people apart by color. Say who wrote a message in text nearby, such as in a `MessageHeader`, and say a failure in the text of a destructive bubble.
- **Reactions.** Name a row of emoji once, with `role="img"` and an `aria-label` such as "Reactions: thumbs up and 3 more". Make interactive reactions buttons, each with its own name and `aria-pressed`. The row overlaps the bubble, so leave room above or below it.
- **Links and buttons.** Use `bubbleContentVariants()` on a native element, so the whole bubble is one control named by its text, with the theme's focus ring.
- **Show more.** Collapsible isn't ported yet. The Show more example clamps the content with `css()` and toggles it with a Button that has `aria-expanded` and `aria-controls`.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `BubbleGroup`, `Bubble`, `BubbleContent`, `BubbleReactions` | Same parts and data attributes | |
| Seven variants on the content from the bubble's class | The content's own rule reacts to its bubble's `data-variant` | So no rule depends on the order Remix renders them in |
| `max-w-[80%]`, ghost `max-w-full`, `self-end` | Same | |
| `BubbleContent` with `render` | `bubbleContentVariants()` | |
| `focus-visible:ring-3` on links and buttons | The theme's 2px outline | Stays visible in forced colors |
| `border-transparent` | Same; none on a ghost bubble | Forced colors draw each frame, and leave ghost text unframed |
| Destructive `text-destructive` | Mixed with 25% `--foreground` | Reaches 4.5:1 |
| Tinted `oklch(from var(--primary) …)` with `dark:` | The same colors through `light-dark()` | Follows `data-theme` |
| Reactions `left-3`/`right-3`, `ring-3 ring-card` | Logical insets, a 3px `--card` shadow and a transparent border | Mirrors in right-to-left text; keeps a frame in forced colors |
| `wrap-break-word` | `overflow-wrap: anywhere` | So a long link fits a narrow screen |
| Docs: Variants, Alignment, Group, Links and Buttons, Reactions, Show more | `BubbleVariants`, `BubbleSizes`, `BubbleAlignment`, `BubbleGrouped`, `BubbleLinksAndButtons`, `BubbleWithReactions`, `BubbleReactionButtons`, `BubbleShowMore` | Plus `BubbleRtl` |
| Docs: Tooltip, Popover | Wait for Tooltip and Popover | |

## Accessibility checks

Automated: text escapes on the server; reaction toggles report `aria-pressed`; a button bubble works with Enter; Show more reports `aria-expanded`; text reaches 4.5:1 in every variant in both themes; frames stay in forced colors; reactions mirror in right-to-left text; the page passes axe-core's WCAG 2.2 A and AA rules and fits 320px with text at 200%. This isn't an accessibility certification.

Manual gaps: how screen readers read a reaction row named with `role="img"` was not checked with a screen reader.
