# Empty

Shows that there is nothing here yet, and what to do about it.

- Source: `registry/ui/empty.tsx`. Needs `registry/lib/theme.css`.
- Examples: `registry/examples/empty-example.tsx`. Run them with `bun run display-examples`.
- Upstream: shadcn/ui [`empty.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/empty.tsx) and its [docs](https://ui.shadcn.com/docs/components/base/empty).

## Usage

```tsx
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '#remixcn/ui/empty.tsx'

<Empty>
  <EmptyHeader>
    <EmptyMedia variant="icon"><InboxIcon /></EmptyMedia>
    <EmptyTitle level={3}>No invoices yet</EmptyTitle>
    <EmptyDescription>Create your first invoice.</EmptyDescription>
  </EmptyHeader>
  <EmptyContent><Button>New invoice</Button></EmptyContent>
</Empty>
```

## API

| Part | Renders | Notes |
| --- | --- | --- |
| `Empty` | `<div>` | Centered column. Its border is dashed and 0 wide: give it a width, such as `css({ borderWidth: '1px' })`, to draw it |
| `EmptyHeader` | `<div>` | Holds the media, title and description, up to 24rem wide |
| `EmptyMedia` | `<div data-slot="empty-icon">` | `variant`: `'default'` holds content as it is; `'icon'` puts an icon on a muted tile |
| `EmptyTitle` | `<div>`, or `<h1>`–`<h6>` with `level` | |
| `EmptyDescription` | `<div>` | Links are underlined |
| `EmptyContent` | `<div>` | The actions, such as buttons or a search field |

Each part takes its native element's props and `mix`.

## Composition

- **Loading.** For a pending state, put a named Spinner in the media and mark the region `aria-busy="true"`.
- **Backgrounds and borders.** Pass a `css()` with `mix`, such as a muted background or a border width.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `Empty` `p-12 border-dashed` | Padding that shrinks with its container, up to 3rem | So a narrow screen keeps room for the text |
| `EmptyMedia` variants and `data-slot="empty-icon"` | Same | The tile draws a border in forced colors |
| `EmptyTitle`, `EmptyDescription` | Same, as `<div>` | `EmptyTitle` adds `level`. Long words break |
| `text-balance` | Same | |
| Docs: Outline, Background, Avatar, Avatar Group, RTL | `EmptyOutlineAndBackground`, `EmptyWithAvatars`, the fixture's pages | |
| Docs: InputGroup | `EmptyWithSearch` with a native search field | Input Group comes with its own ticket |
| Example: In Card | `EmptyLoading` | A pending state in a card |

## Accessibility checks

Automated: every part on the server; title and description are 4.5:1 or more in both themes; long titles break; the page fits 320px with text at 200% and passes axe-core's WCAG 2.2 A and AA rules. This isn't an accessibility certification.
