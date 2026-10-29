# Sources

RemixCN credits every upstream file it copies or adapts. Update this file in the PR that adds the adaptation. `THIRD_PARTY_NOTICES.md` holds the licenses.

## Pinned upstream versions

| Source | Version | License |
| --- | --- | --- |
| [shadcn/ui](https://github.com/shadcn-ui/ui) | Commit [`96da9cc7f1aa10580a3741664e2a77c721206c00`](https://github.com/shadcn-ui/ui/tree/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base), `apps/v4/registry/bases/base` | MIT, Copyright (c) 2023 shadcn |
| [shadcn/ui Components docs](https://ui.shadcn.com/docs/components) | The Base pages, read on 29 October 2026; their sources are `apps/v4/content/docs/components/base/*.mdx` at the commit above | MIT, Copyright (c) 2023 shadcn |
| [Base UI](https://github.com/mui/base-ui) | Commit [`06cf9a0064231a1393cd43d86439bbc52255fa5a`](https://github.com/mui/base-ui/tree/06cf9a0064231a1393cd43d86439bbc52255fa5a); [accessibility guidance](https://base-ui.com/react/overview/accessibility) | MIT, Copyright (c) 2019 Material-UI SAS |
| [Remix](https://github.com/remix-run/remix) | [`remix@3.0.0`](https://registry.npmjs.org/remix/3.0.0) on npm, with `@remix-run/cli` 1.0.1; commit [`6ab529634e35cac4eff786b048800831d1c5cf99`](https://github.com/remix-run/remix/tree/6ab529634e35cac4eff786b048800831d1c5cf99) for `packages/component` and `packages/ui` | MIT, Copyright (c) 2025 Shopify Inc. |

## Adapted files

| RemixCN file | Upstream | What changed |
| --- | --- | --- |
| `.agents/skills/remix/SKILL.md` | `template/.agents/skills/remix/SKILL.md` in `@remix-run/cli` 1.0.1, which `remix@3.0.0` installs | Nothing. It's copied unchanged, and a test keeps it equal to the installed template. |
| `registry/catalog.json` | At the shadcn/ui commit: `apps/v4/registry/bases/base/ui/_registry.ts` and the 64 files beside it, `examples/`, `hooks/`, and `lib/` in the same base, and `apps/v4/content/docs/components/base/*.mdx` | Collects names, titles, links, registry dependencies, behavior references, and upstream imports into one inventory. RemixCN adds the batches, targets, and the Sonner-to-Toast mapping. |
| `registry/lib/theme.css` | At the shadcn/ui commit: the Neutral theme in `apps/v4/registry/themes.ts` | Writes shadcn's light and dark `cssVars` as `light-dark()` custom properties under the same names, in `@layer base` after the `@layer base, rmx, app;` order from Remix's rendering guide. Adds system font stacks, rem type, space and radius tokens named after Tailwind's theme variables, shadows, motion tokens, and a small reset. For WCAG 2.2 AA contrast, five values change: light `--muted-foreground` from `oklch(0.556 0 0)` to `oklch(0.54 0 0)`, light `--destructive` lightness from 0.577 to 0.56, `--input` from `oklch(0.922 0 0)` to `oklch(0.62 0 0)` in light and from `oklch(1 0 0 / 15%)` to `oklch(0.556 0 0)` in dark, and light `--ring` and `--sidebar-ring` from `oklch(0.708 0 0)` to `oklch(0.556 0 0)`. `--radius` drops from 0.625rem to 0.375rem for C-977's small radii. |
| `registry/lib/styles.ts` | At the shadcn/ui commit: the shared state classes in `apps/v4/registry/styles/style-vega.css` (`focus-visible:ring-3`, `aria-invalid:border-destructive`, `disabled:opacity-50`) | Turns them into style objects for `css()`, and adds `mergeStyles()` in place of `cn`. The focus ring is a 2px outline in `--ring` instead of a translucent 3px box shadow, so it stays visible in forced colors. |
| `registry/lib/icons.tsx` | Replaces `apps/v4/app/(app)/(create)/components/icon-placeholder.tsx` at the shadcn/ui commit, which renders an icon from Lucide or another icon library | Copies no code or icon: RemixCN draws its own inline SVG icons and loads no icon library, so the file names no upstream source. |
| `registry/lib/layer.ts` | Base UI [`utils/popups/interactions/useDismiss.ts`](https://github.com/mui/base-ui/blob/06cf9a0064231a1393cd43d86439bbc52255fa5a/packages/react/src/utils/popups/interactions/useDismiss.ts) and [`utils/popups/tree/FloatingTree.tsx`](https://github.com/mui/base-ui/blob/06cf9a0064231a1393cd43d86439bbc52255fa5a/packages/react/src/utils/popups/tree/FloatingTree.tsx) | New code for the DOM and Remix mixins, keeping Base UI's dismissal rules: Escape closes only the topmost layer, an outside press closes every layer it lands outside of, and presses in a child layer count as inside its parents. A per-document layer stack replaces React context. Presses that drag across a layer edge or scroll by touch don't count, and modal layers shield the layers below. |
| `registry/lib/focus-scope.ts` | Base UI [`utils/popups/focus/FloatingFocusManager.tsx`](https://github.com/mui/base-ui/blob/06cf9a0064231a1393cd43d86439bbc52255fa5a/packages/react/src/utils/popups/focus/FloatingFocusManager.tsx) and [`utils/popups/focus/tabbable.ts`](https://github.com/mui/base-ui/blob/06cf9a0064231a1393cd43d86439bbc52255fa5a/packages/react/src/utils/popups/focus/tabbable.ts) | New code for initial and return focus. It leaves containment to native modal dialogs and `inert` instead of focus guards, and returns focus to a tabbable neighbor when the trigger was removed or disabled. |
| `registry/lib/modal.ts` | Remix [`lib/scroll-lock.ts`](https://github.com/remix-run/remix/blob/6ab529634e35cac4eff786b048800831d1c5cf99/packages/ui/src/lib/scroll-lock.ts); Base UI [`utils/popups/focus/markOthers.ts`](https://github.com/mui/base-ui/blob/06cf9a0064231a1393cd43d86439bbc52255fa5a/packages/react/src/utils/popups/focus/markOthers.ts) | The scroll lock adapts Remix's counted lock, scrollbar gutter and scroll restore, and restores the overflow longhands with their priority. Inertness is new code after Base UI's `markOthers`, with `inert` instead of `aria-hidden`; only the newest modal applies, and content added while it's open becomes inert too. |
| `registry/lib/composite.ts` | Base UI [`internals/composite/root/CompositeRoot.tsx`](https://github.com/mui/base-ui/blob/06cf9a0064231a1393cd43d86439bbc52255fa5a/packages/react/src/internals/composite/root/CompositeRoot.tsx), [`utils/popups/interactions/useListNavigation.ts`](https://github.com/mui/base-ui/blob/06cf9a0064231a1393cd43d86439bbc52255fa5a/packages/react/src/utils/popups/interactions/useListNavigation.ts) and [`utils/popups/interactions/useTypeahead.ts`](https://github.com/mui/base-ui/blob/06cf9a0064231a1393cd43d86439bbc52255fa5a/packages/react/src/utils/popups/interactions/useTypeahead.ts); Remix [`lib/typeahead.ts`](https://github.com/remix-run/remix/blob/6ab529634e35cac4eff786b048800831d1c5cf99/packages/ui/src/lib/typeahead.ts) | New code for roving focus and active descendant as two separate mixins. The typeahead buffer follows Remix's, and adds repeated-letter cycling. |
| `registry/lib/anchor-position.ts` | Base UI [`utils/popups/positioning/usePositioner.tsx`](https://github.com/mui/base-ui/blob/06cf9a0064231a1393cd43d86439bbc52255fa5a/packages/react/src/utils/popups/positioning/usePositioner.tsx); Remix [`anchor.ts`](https://github.com/remix-run/remix/blob/6ab529634e35cac4eff786b048800831d1c5cf99/packages/ui/src/anchor.ts) | New code that uses CSS anchor positioning where supported and its own measurement otherwise, instead of Floating UI. It keeps Base UI's side, align, offsets, collision padding, `data-side`, `data-align` and CSS variables, and Remix's point anchors. |

## Adding an adaptation

When a PR ports a component, recipe, or helper:

- Add a row above: the RemixCN file, each upstream file at its pinned commit, and what changed.
- Start the file with the installed-source header below.
- Before copying code from a source this file doesn't list, add the source here and its license to `THIRD_PARTY_NOTICES.md`.

## Credit text

### Site

Show this on the site:

> RemixCN adapts [shadcn/ui](https://github.com/shadcn-ui/ui) (MIT, Copyright (c) 2023 shadcn) and the accessible behavior of [Base UI](https://github.com/mui/base-ui) (MIT, Copyright (c) 2019 Material-UI SAS), and builds on [Remix](https://github.com/remix-run/remix) (MIT, Copyright (c) 2025 Shopify Inc.). [Licenses](https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md)

### Installed source

Every file in `registry/` starts with this header, and the installer keeps it. Name only the sources the file adapts.

```tsx
// RemixCN Button: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
```

The registry's `licenses` item ships `LICENSE` and `THIRD_PARTY_NOTICES.md`, and every item that ships `registry/` source depends on it. So installing any item also installs the full license texts.
