# Item

A row that shows media, a title, a description and actions about one thing. Items in a group form a list.

- Source: `registry/ui/item.tsx`. Needs `registry/lib/theme.css`, `registry/lib/styles.ts` and `registry/ui/separator.tsx`.
- Examples: `registry/examples/item-example.tsx`. Run them with `bun run display-examples`.
- Upstream: shadcn/ui [`item.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/item.tsx) and its [docs](https://ui.shadcn.com/docs/components/base/item).

## Usage

```tsx
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle, itemVariants } from '#remixcn/ui/item.tsx'

<ItemGroup aria-label="Customers">
  <Item variant="outline">
    <ItemContent>
      <ItemTitle>Acme Labs</ItemTitle>
      <ItemDescription>3 open invoices</ItemDescription>
    </ItemContent>
    <ItemActions><Button size="sm">Remind</Button></ItemActions>
  </Item>
</ItemGroup>
```

## API

| Part | Renders | Notes |
| --- | --- | --- |
| `Item` | `<div>` | `variant`: `'default'`, `'outline'` or `'muted'`. `size`: `'default'`, `'sm'` or `'xs'`. In an `ItemGroup` it renders `role="listitem"`. A `role` you pass wins |
| `itemVariants(options?)` | Mixins | The item look, `data-slot`, `data-variant` and `data-size` for another element, such as a link that is the whole row |
| `ItemGroup` | `<div role="list">` | Name it with `aria-label` where it helps |
| `ItemSeparator` | A horizontal Separator | Decorative by default, since a list holds only list items |
| `ItemMedia` | `<div>` | `variant`: `'default'`, `'icon'` or `'image'`, which crops an image to a square that follows the item's size |
| `ItemContent` | `<div>` | Takes the room the row has. On a row too narrow for 8rem, it wraps onto a line of its own. A second content part keeps its own width |
| `ItemTitle` | `<div>`, or `<h1>`–`<h6>` with `level` | |
| `ItemDescription` | `<p>` | Links are underlined |
| `ItemActions` | `<div>` | Buttons or links at the end |
| `ItemHeader`, `ItemFooter` | `<div>` | Full-width lines above and below the content |

Every part takes its native element's props and `mix`. `itemVariantNames` and `itemSizes` list the options.

## Composition

- **Link rows.** Use `itemVariants()` on a native `<a>`, so the whole row is one link. In a group, wrap it in an element with `role="listitem"`, since a link can't be a list item itself. The Group of links example shows it.
- **Media.** Give a decorative image `alt=""`; the title says what it is.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `ItemGroup role="list"` | Same | |
| `Item` without a role | `role="listitem"` inside a group | A list without list items fails WCAG's structure rules. Remix context tells the item it's in a group, also on the server |
| `Item` with `render` | `itemVariants()` | |
| `ItemSeparator` on Separator | Same, decorative | |
| Variants and sizes | Same names and measures | |
| `focus-visible:ring-[3px]`, `outline-none` | The theme's 2px outline | Stays visible in forced colors |
| `line-clamp-1` title, `line-clamp-2` description | Not clamped; long words break | So no text is lost on a narrow screen or with large text. Clamp with your own `css()` where the full text shows elsewhere |
| `ItemContent` `flex-1` | Also a minimum of 8rem | So a narrow row wraps instead of squeezing the text |
| Media `translate-y-0.5 self-start` with a description | Same | |
| `in-data-[slot=dropdown-menu-content]:p-0` for `xs` | Same | |
| Docs: Variant, Size, Icon, Avatar, Image, Group, Header, Link, RTL | `ItemVariantsAndSizes`, `ItemWithMedia`, `ItemGroupOfLinks`, `ItemGroupWithActions`, `ItemWithHeaderAndFooter`, the Right to left section | |
| Docs: Dropdown | Waits for Dropdown Menu | |

## Accessibility checks

Automated: list and list item roles on the server, also for a caller's role; link rows navigate with Enter and show a focus ring also in forced colors; content wraps on a narrow row; title and description text are 4.5:1 or more in both themes; the page passes axe-core's WCAG 2.2 A and AA rules and fits 320px with text at 200%. This isn't an accessibility certification.
