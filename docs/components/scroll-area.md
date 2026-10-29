# Scroll Area

A native scroll container with thin scrollbars and a corner in shadcn's style. The browser keeps scrolling it, and the system's scrollbars return wherever the thin ones can't reach all the content.

- Source: `registry/ui/scroll-area.tsx`. Needs `registry/lib/theme.css` and `registry/lib/styles.ts`.
- Examples: `registry/examples/scroll-area-example.tsx`. Run them with `bun run layout` (http://localhost:4402/), and `bun run capture:layout` writes the screenshots in `docs/images/layout/`.
- Upstream: shadcn/ui [`scroll-area.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/scroll-area.tsx), its [docs](https://ui.shadcn.com/docs/components/base/scroll-area), and [Base UI Scroll Area](https://base-ui.com/react/components/scroll-area.md).

## How it runs

| Entry | Element | Without JavaScript |
| --- | --- | --- |
| Scroll Area | A native `overflow: auto` viewport inside a positioned root, with thin scrollbars beside it | The content scrolls with the system's scrollbars. The keyboard, the wheel, touch, and focus all work |

It needs the browser to draw its own scrollbars, so it runs inside a client entry of your app, as every example does. It isn't a client entry itself, for two reasons found in `remix@3.0.0`:

- A client entry's props must serialize to JSON. Mixins and handlers don't, so an entry couldn't take the caller's `mix`.
- The server renders the component children of a client entry to static HTML before it serializes them. A scroll area entry would hydrate with frozen content. Inside a client entry of the app, the content stays live.

Once the browser runs it, each scroll area draws a scrollbar for every axis that overflows and hides the native ones. If an axis overflows and has no ScrollBar part, the native scrollbars stay, so the overflow is always reachable. In forced colors, the native scrollbars come back and the thin ones step aside.

## Composition

```tsx
import { ScrollArea, ScrollBar } from './ui/scroll-area.tsx'

<ScrollArea aria-label="Photos" mix={css({ width: '24rem' })}>
  <div mix={css({ display: 'flex', gap: '1rem' })}>…</div>
  <ScrollBar orientation="horizontal" />
</ScrollArea>
```

- **Viewport.** The content sits in a native scroll container. Scroll chaining stays on: at an edge, the wheel and touch scroll the page. Nothing blocks ordinary scrolling.
- **Scrollbars.** The scroll area draws a vertical ScrollBar by itself. Add `<ScrollBar orientation="horizontal" />` for the other axis, or your own vertical one to style it; it replaces the default. ScrollBar children are drawn beside the viewport, not inside it. A ScrollBar anywhere else fails the render.
- **Labels.** `aria-label` and `aria-labelledby` on ScrollArea name the viewport, which then has `role="region"`. A viewport that scrolls is in the tab order, so keyboard users can scroll it. One with nothing to scroll leaves the tab order.
- **State for styling.** The root has `data-has-overflow-x` and `-y`, `data-overflow-x-start` and `-end`, `data-overflow-y-start` and `-end`, `data-scrolling` for half a second after each scroll, `data-hovering`, and `data-scrollbars="custom"` or `"native"`. The viewport has `--scroll-area-overflow-{x,y}-{start,end}` in pixels, for fades. The root has `--scroll-area-corner-width` and `-height`. These follow Base UI's names. The scroll area writes them on scroll, outside renders, so scrolling stays cheap.

Style a part with `mix={css(...)}`, a `class`, or a rule in `@layer app`, as `AGENTS.md` describes. The thumb and the corner have `data-slot="scroll-area-thumb"` and `"scroll-area-corner"`.

## API

### ScrollArea and ScrollBar

`ScrollArea` takes the props of `<div>` for its root. `aria-label` and `aria-labelledby` go to the viewport. It renders `data-slot="scroll-area"`, `"scroll-area-viewport"`, `"scroll-area-content"`, and `"scroll-area-corner"`.

`ScrollBar` takes the props of `<div>` except `children`, plus `orientation: 'vertical' | 'horizontal'` (default `'vertical'`). It renders `data-slot="scroll-area-scrollbar"`, `data-orientation`, `aria-hidden="true"`, `data-dragging`, `data-scrolling`, `data-hovering`, and its thumb as `data-slot="scroll-area-thumb"`. Drag the thumb to scroll, press the track to jump there, or turn the wheel over it.

## Source and behavior map

Upstream: `apps/v4/registry/bases/base/ui/scroll-area.tsx`, its example and the `cn-scroll-area-*` classes of `apps/v4/registry/styles/style-vega.css` at the pinned shadcn/ui commit, and Base UI's Scroll Area at the pinned Base UI commit. RemixCN copies no code from Base UI. It maps the behavior to the platform.

| Upstream | RemixCN |
| --- | --- |
| `ScrollArea` over `ScrollArea.Root` and `ScrollArea.Viewport`, with a `ScrollBar` and `ScrollArea.Corner` | The same parts. The root is `position: relative`. The viewport has `overflow: auto` and the theme's focus ring in place of the translucent 3px ring |
| `ScrollArea.Content` | Rendered inside the viewport with `min-width: fit-content`, so content wider than the viewport reports its size |
| `ScrollBar` over `ScrollArea.Scrollbar` and `ScrollArea.Thumb`, with `orientation` | The same name and prop, 2.5 spacing steps thick with 1px padding, as in `.cn-scroll-area-scrollbar`. The thumb is round, in `--input` rather than `--border`, darker on hover and while dragged |
| A horizontal `ScrollBar` passed as a child lands inside the viewport | It's drawn beside the viewport, so it never scrolls with the content |
| Native scrollbars always hidden | Hidden only once the browser runs the scroll area, only while its own scrollbars cover every overflowing axis, and never in forced colors |
| Thumb drag, track press that jumps the thumb under the pointer, wheel over a scrollbar that chains at the edges, scroll snapping paused during a drag, no focus change on press | The same behaviors with Pointer Events and pointer capture. Right-to-left text mirrors the horizontal thumb and its drag. A drag ends when its scrollbar leaves |
| Viewport `tabIndex` 0 when it overflows, -1 when it doesn't | The same. The server renders 0, since it can't measure |
| `data-has-overflow-*`, `data-overflow-*-start` and `-end`, `data-scrolling`, `data-hovering`, the overflow and corner CSS variables, `MIN_THUMB_SIZE` of 16px | The same names and values. `data-scrolling` marks every scroll, not only those a user starts |
| `overflowEdgeThreshold`, `keepMounted`, `render`, the thumb shrinking on Safari's overscroll bounce | Not ported. The scrollbars stay in the document and CSS hides them when their axis doesn't overflow |

## Accessibility checks

Automated (`bun run test`, `bun run test:browser`, `bun run test:e2e`). The browser and end-to-end tests run in Chromium, Firefox, and WebKit:

- axe-core: no WCAG 2.2 A or AA violations on the examples, before and after hydration, in light and dark.
- Server HTML: the content in a native scroll container with the system's scrollbars and a labelled region. Hydration: the thin scrollbars in place of the native ones, and no console errors.
- Scrolling: long content in both axes with a corner, the wheel over the viewport and over a scrollbar, the page scrolling on at an edge, End from the keyboard, focus moving into view, and nested scroll areas. Touch scrolls the viewport and not the page, checked in Chromium, where Playwright drives real touch.
- Pointer: a thumb drag, a track press that keeps focus where it was, scroll snapping paused while dragging, and right-to-left text.
- Fallback: the system's scrollbars stay while an axis overflows without its own scrollbar.
- Cleanup: observers disconnect and a drag stops once the scroll area, or only the dragged scrollbar, is removed in the middle of it.
- Forced colors: the system's scrollbars return and the thin ones step aside. Reduced motion: transitions take 0s. Reflow: 320px wide without scrolling sideways, also at 200% text.

Not checked yet:

- Screen readers. Nobody has listened to the regions in NVDA, JAWS, VoiceOver, or TalkBack.
- Real touch devices and Windows High Contrast. Touch and forced colors were emulated.

These checks show how the component behaves in three browser engines. They're not an accessibility certification.
