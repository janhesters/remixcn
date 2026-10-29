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

The installer ticket decides whether `remixcn add` also writes the full license texts into the user's project.
