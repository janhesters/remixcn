# Breadcrumb

The trail to the current page: a navigation landmark with an ordered list of native links, separators, the current page and an ellipsis for collapsed levels.

- Source: `registry/ui/breadcrumb.tsx`. Needs `registry/lib/theme.css`, `registry/lib/styles.ts` and `registry/lib/icons.tsx`.
- Examples: `registry/examples/breadcrumb-example.tsx`. Run them with `bun run display-examples`.
- Upstream: shadcn/ui [`breadcrumb.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/breadcrumb.tsx) and its [docs](https://ui.shadcn.com/docs/components/base/breadcrumb).

## Usage

```tsx
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '#remixcn/ui/breadcrumb.tsx'

<Breadcrumb>
  <BreadcrumbList>
    <BreadcrumbItem>
      <BreadcrumbLink href="/">Home</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbPage>INV-0042</BreadcrumbPage>
    </BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>
```

## API

| Part | Renders | Notes |
| --- | --- | --- |
| `Breadcrumb` | `<nav aria-label="breadcrumb">` | Pass `aria-label` to name it otherwise, such as when a page has two |
| `BreadcrumbList` | `<ol>` | Wraps on a narrow screen; the gap grows from 40rem |
| `BreadcrumbItem` | `<li>` | |
| `BreadcrumbLink` | `<a>` | Every native link prop. Underlines on hover |
| `breadcrumbLinkVariants()` | Mixins | The link look and `data-slot` for another element, such as a button that opens a menu |
| `BreadcrumbPage` | `<span role="link" aria-disabled="true" aria-current="page">` | As in shadcn: announced as the current page |
| `BreadcrumbSeparator` | `<li role="presentation" aria-hidden="true">` | A chevron that mirrors in right-to-left text, or your own children, such as `/` |
| `BreadcrumbEllipsis` | `<span aria-hidden="true">` with three dots | Put it in a control that names what it does |

Each part takes its native element's props and `mix`, and renders shadcn's `data-slot`.

## Composition

- **Collapsed levels.** Put `BreadcrumbEllipsis` in a button named for what it does, such as "Show 2 hidden levels". The Collapsed example shows the levels in place and moves focus to the first one. A menu of the levels waits for Dropdown Menu.
- **Router links.** Links are native, so they work with Remix navigation and without JavaScript. Add your own mixins with `mix`.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem` | Same elements | |
| `BreadcrumbLink` with `render` | `BreadcrumbLink`, and `breadcrumbLinkVariants()` | |
| `BreadcrumbPage` | Same attributes | |
| `BreadcrumbSeparator` with a chevron and `cn-rtl-flip` | Same, with RemixCN's chevron and `mirrorInRtl` | |
| `BreadcrumbEllipsis` with a hidden "More" | The dots, hidden | shadcn's "More" sits inside `aria-hidden`, so no one hears it. RemixCN leaves it out and asks the control around the dots for a name |
| `sm:gap-2.5` | `@media (min-width: 40rem)` | |
| Docs: Basic, Custom separator, Collapsed, Link component, RTL | `BreadcrumbBasic`, `BreadcrumbCustomSeparator`, `BreadcrumbCollapsed`, `BreadcrumbWithLinkVariants`, the Right to left section | |
| Docs: Dropdown | Waits for Dropdown Menu | |

## Accessibility checks

Automated: a named `nav` with an `ol` of `li`, native links with their href, the current page marked, separators and dots hidden; links navigate with a click or Enter; the collapsed levels open with Enter and focus moves to the first one; link text is 4.5:1 or more in both themes; links show a focus ring also in forced colors; chevrons mirror in right-to-left text. Screen readers weren't run. This isn't an accessibility certification.
