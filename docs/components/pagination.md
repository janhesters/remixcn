# Pagination

Native page links in a nav: the current page, Previous and Next, and an ellipsis for pages left out. It needs no JavaScript, fetches nothing and owns no routing. Your app builds the URLs, and its routes decide what each page shows.

- Source: `registry/ui/pagination.tsx`. Needs `registry/lib/theme.css`, `registry/lib/styles.ts`, `registry/lib/icons.tsx` and `registry/ui/button.tsx`.
- Examples: `registry/examples/pagination-example.tsx`. Run them with `bun run disclosure-examples` (http://localhost:4405/); `?page=N` picks the current page.
- Upstream: shadcn/ui [`pagination.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/pagination.tsx) and its [docs](https://ui.shadcn.com/docs/components/base/pagination).

## Usage

```tsx
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '#remixcn/ui/pagination.tsx'

<Pagination aria-label="Invoice pages">
  <PaginationContent>
    <PaginationItem>
      <PaginationPrevious href="/invoices?page=1" />
    </PaginationItem>
    <PaginationItem>
      <PaginationLink href="/invoices?page=2" isActive>2</PaginationLink>
    </PaginationItem>
    <PaginationItem>
      <PaginationEllipsis />
    </PaginationItem>
    <PaginationItem>
      <PaginationNext href="/invoices?page=3" />
    </PaginationItem>
  </PaginationContent>
</Pagination>
```

## API

### `Pagination`

A `<nav>` named "Pagination". Takes every prop of a `<nav>`. Give it your own `aria-label` when a page has more than one. It renders `data-slot="pagination"`.

### `PaginationContent` and `PaginationItem`

A `<ul>` and its `<li>`s. They take every prop of their element and render `data-slot="pagination-content"` and `"pagination-item"`.

### `PaginationLink`

A native `<a>` with a Button's look. Takes every prop of an `<a>`, and:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `href` | `string` | | Where it goes, query and hash included, exactly as you write it |
| `isActive` | `boolean` | `false` | Marks the current page with `aria-current="page"`, `data-active` and the outline look. Others are ghost buttons |
| `size` | a Button size | `'icon'` | Page numbers are squares |
| `disabled` | `boolean` | `false` | Renders no `href`, so there is nothing to follow and no tab stop, and `role="link"` with `aria-disabled="true"`, so assistive technology still announces it |

It renders `data-slot="pagination-link"`, and Button's `data-variant` and `data-size`.

### `PaginationPrevious` and `PaginationNext`

`PaginationLink`s in the default size with an arrow, named "Go to previous page" and "Go to next page". They take `PaginationLink`'s props except `children`, and `text`, the visible label ("Previous" and "Next"). With your own `text`, the link takes its name from that text, or from your `aria-label`. Below 640px the text is visually hidden, and still names the link.

### `PaginationEllipsis`

A `<span>` with three dots, which screen readers hear as "More pages". It renders `data-slot="pagination-ellipsis"`.

## Composition

- **URLs.** Build them from your routes, with the query your list needs. Pagination never changes them.
- **Boundaries.** Turn off Previous on the first page and Next on the last with `disabled`.
- **Without JavaScript.** The links work as plain HTML. With Remix's client runtime, same-origin links navigate in place through frame navigation.
- **Direction.** The arrows mirror in right-to-left text, and the list flows from the right.
- **Rows per page.** Put a form beside the pagination, as the With rows example does with a native select.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `Pagination` (`<nav role="navigation" aria-label="pagination">`) | `<nav aria-label="Pagination">` | A nav already has the navigation role |
| `PaginationContent`, `PaginationItem` | Same `<ul>` and `<li>` | |
| `PaginationLink` on `Button` with `render={<a />}` | A native `<a>` with `buttonVariants()` | Base UI's Button would add `role="button"` to the link |
| `isActive`, `size` | Same props | Same `aria-current="page"` and `data-active` |
| — | `disabled` | The ticket's disabled boundaries. shadcn's links can't be turned off |
| `PaginationPrevious`, `PaginationNext`, with `text` | Same | A custom `text` drops the English `aria-label`, so the name matches the label |
| `hidden sm:block` on the text | Visually hidden below 640px | The text keeps naming the link on a narrow screen |
| `cn-rtl-flip` | `mirrorInRtl` | |
| `PaginationEllipsis` with `aria-hidden` around "More pages" | "More pages" stays readable, the icon is hidden | shadcn's `aria-hidden` also hides its screen reader text |
| Pagination classes in `style-vega.css` | Same measures | `gap-1`, a `size-9` ellipsis, and the tighter padding beside the arrows, which Button's `data-icon` padding gives |
| Docs: Basic, Simple | `PaginationBasic`, `PaginationSimple` | Links to `?page=N`. Basic turns off Previous and Next at the ends |
| Docs: With Select | `PaginationWithRows` | Label and Native Select in a GET form take the place of Field and Select, so rows per page work without JavaScript |
| Docs: RTL | The fixture's Direction section | |

### Where it looks different from shadcn

- **Boundary links can be turned off**, and then look dimmed.
- **The list wraps** on a narrow screen or with large text, instead of running off the side.

## Accessibility checks

Automated, in Chromium, Firefox and WebKit (`bun run test`, `test:e2e`):

- The pagination is a named nav with a list of links. The current page has `aria-current="page"`.
- Links keep the caller's URLs, query and hash included, and navigate with and without JavaScript.
- Previous and Next are named, also when the text is visually hidden, and their arrows are hidden from assistive technology.
- A turned-off link has no `href`, takes no focus, and is announced as a disabled link.
- Screen readers get "More pages" for the ellipsis.
- Link text is 4.5:1 or more in both themes. The focus ring shows, also in forced colors.
- The arrows mirror in right-to-left text.
- axe-core finds no WCAG 2.2 A or AA violations on the example page in either color scheme.
- The page fits 320px without scrolling sideways, with normal text and at 200%.

Not checked, so not claimed:

- Screen readers (NVDA, JAWS, VoiceOver, TalkBack) weren't tested. Safari itself wasn't run, only Playwright's WebKit in CI. Forced colors were emulated, not tested in Windows.
- This isn't an accessibility certification.
