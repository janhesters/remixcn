# Accordion

A stack of items, each a heading with a native button that opens a panel. One item opens at a time unless `multiple` allows more.

- Source: `registry/ui/accordion.tsx`. Needs `registry/lib/theme.css`, `registry/lib/styles.ts`, `registry/lib/icons.tsx` and `registry/ui/collapsible.tsx`.
- Examples: `registry/examples/accordion-example.tsx`. Run them with `bun run disclosure-examples` (http://localhost:4405/).
- Upstream: shadcn/ui [`accordion.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/accordion.tsx), its [docs](https://ui.shadcn.com/docs/components/base/accordion), and [Base UI Accordion](https://base-ui.com/react/components/accordion.md).

## Usage

```tsx
import { on } from 'remix/component'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, accordionChangeType } from '#remixcn/ui/accordion.tsx'

<Accordion id="faq" defaultValue={['due']} mix={on(accordionChangeType, (event) => remember(event.value))}>
  <AccordionItem value="due">
    <AccordionTrigger>When is an invoice due?</AccordionTrigger>
    <AccordionContent>Thirty days after it goes out.</AccordionContent>
  </AccordionItem>
  <AccordionItem value="reminders">
    <AccordionTrigger>Do customers get reminders?</AccordionTrigger>
    <AccordionContent>Three days before the due date.</AccordionContent>
  </AccordionItem>
</Accordion>
```

## How it runs

Like Collapsible, the accordion works once the browser runs it inside your client entry, and isn't a client entry itself. Before that, and on a page that only renders on the server, the server HTML shows the items that start open, and the triggers do nothing. Hydration keeps that state.

## API

### `Accordion`

Takes every prop of a `<div>`, and:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `value` | `string[]` | not set: it keeps its own value | The open items, for an accordion you control |
| `defaultValue` | `string[]` | `[]` | The items open at first |
| `multiple` | `boolean` | `false` | Lets several items be open. Without it, opening one closes the other, and only the first value counts |
| `disabled` | `boolean` | `false` | Disables every trigger |
| `headingLevel` | `1` to `6` | `3` | The level of the headings around the triggers. Pick the one that fits your page's outline |
| `keepMounted` | `boolean` | `false` | Keeps closed panels in the document, hidden |
| `hiddenUntilFound` | `boolean` | `false` | Keeps closed panels with `hidden="until-found"`, so find in page opens them |
| `id` | `string` | a generated id | Item ids derive from it and each item's value |

It renders `data-slot="accordion"` and `data-disabled`.

### `AccordionItem`

A Collapsible whose open state belongs to the accordion. Takes every prop of a `<div>`, and `value` (a string; without one, the item gets a generated value) and `disabled`. Its id is `<accordion id>-<value>` unless you give it one, and its trigger's and panel's ids derive from that, so they survive reordering. It renders `data-slot="accordion-item"`, `data-open` or `data-closed`, and `data-disabled`.

### `AccordionTrigger`

A heading (`<h3>` by default, `data-slot="accordion-header"`) around a native button (`data-slot="accordion-trigger"`) and a chevron. Takes every prop of `CollapsibleTrigger`, which all reach the button, and `headingLevel`, which overrides the accordion's for this item. The chevron turns to point up while the item is open.

### `AccordionContent`

The panel: a `role="region"` named by its trigger through `aria-labelledby`. Takes every prop of `CollapsibleContent`. `keepMounted` and `hiddenUntilFound` default to the accordion's. It renders `data-slot="accordion-content"` and moves like a Collapsible panel, with `--collapsible-panel-height`.

### Change event

`AccordionChangeEvent` (type `accordionChangeType`, `'remixcn:accordion-change'`) fires on the item before it opens or closes, and bubbles to the accordion. `event.value` lists the open items after the change, `event.item` is the item that changes, and `event.open` its next state. `event.preventDefault()` keeps the current items open. Listen on the accordion for every item, or on one item for that item. A controlled accordion (`value`) changes only when you render the new value.

### Also exported

`AccordionHeadingLevel` and the props types.

## Composition

- **Keyboard.** Tab and Shift+Tab move between triggers, and Enter or Space opens and closes an item. Disabled triggers leave the tab order. The arrow keys don't move between triggers: the WAI-ARIA Authoring Practices dropped that pattern, and Base UI at the pinned commit deprecated it (`loopFocus` and `orientation` "no longer affect keyboard focus behavior").
- **Headings.** Set `headingLevel` to fit your page, so the triggers land in the right place in the outline.
- **Styles.** A `css()` on a part renders after its own rule and wins, such as `paddingInline` on the trigger and the panel for bordered items. The panel styles its own links and paragraphs: links are underlined, and paragraphs have space between them.
- **Rich panels.** Panels hold any content, such as links and buttons. Focus inside a panel that closes moves to its trigger.
- **Nesting.** A Collapsible or another accordion inside a panel keeps its own state. The item ignores the change events of collapsibles nested in it.
- **Changing items.** Key items by value. Open state, ids and focus stay with each item when items are reordered, removed or added.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `Accordion` on Base UI's `Accordion.Root` | `Accordion`, a `<div>` | |
| `value`, `defaultValue`, `multiple`, `disabled` | Same props | Values are strings. Single mode honors only the first value |
| `onValueChange(value, details)` | `AccordionChangeEvent`, cancelable | One event replaces the root's `onValueChange` and the item's `onOpenChange` |
| `keepMounted`, `hiddenUntilFound` | Same props, on the accordion and the panel | |
| `loopFocus`, `orientation` | Not ported | Base UI deprecated both after the APG dropped arrow keys from accordions |
| `AccordionItem` on `Accordion.Item` | `AccordionItem`, built on `Collapsible` | Base UI builds the item on its Collapsible too |
| `Accordion.Header` (`<h3>`) | The heading inside `AccordionTrigger` | `headingLevel` replaces Base UI's `render` for another level |
| `AccordionTrigger` on `Accordion.Trigger` | A native button | `render` and `nativeButton` aren't ported |
| Two chevrons, down and up, swapped on `aria-expanded` | One chevron that turns | Looks the same at rest. The turn uses the motion tokens |
| `AccordionContent` on `Accordion.Panel` | `AccordionContent`, built on `CollapsibleContent` | Same `role="region"` and `aria-labelledby` |
| `--accordion-panel-height` | `--collapsible-panel-height` | One custom property for both |
| `data-open`, `data-disabled`, `data-panel-open`, `data-starting-style`, `data-ending-style` | Same | Items and panels also render `data-closed` |
| `data-index` | Not rendered | Style by position with `:nth-child()` |
| Accordion classes in `style-vega.css` | Same measures | `not-last:border-b`, `py-4`, `text-sm font-medium`, `hover:underline`, the `pb-4` inner panel, and its link and paragraph rules |
| `focus-visible:ring-3` | The theme's 2px outline in `--ring` | Stays visible in forced colors |
| `aria-disabled:opacity-50` | `disabledState` from `styles.ts` | On the natively disabled trigger |
| Docs: Basic, Multiple, With Borders, With Disabled | `AccordionBasic`, `AccordionMultiple`, `AccordionWithBorders`, `AccordionWithDisabled` | |
| Docs: In Card | `AccordionRichContent` | In a Card, with the item headings one level below its title |
| — | `AccordionControlled`, `AccordionHiddenUntilFound` | A controlled accordion that keeps one item open, and Base UI's find-in-page demo |
| Docs: RTL | The fixture's Direction section | |

### Where it looks different from shadcn

- **The chevron turns** instead of swapping for another icon. At rest it looks the same.
- **Long triggers wrap** next to the chevron, with a gap between them, instead of running into it.

## Accessibility checks

Automated, in Chromium, Firefox and WebKit (`bun run test`, `test:browser`, `test:e2e`):

- Each trigger is a native button inside a heading of the chosen level, with `aria-expanded`. An open panel is a region named by its trigger, and the trigger's `aria-controls` names it.
- Tab moves between triggers and skips disabled ones. Enter and Space open and close items. Single mode closes the other item.
- Every `aria-controls` and `aria-labelledby` on the example page points at an element, ids are unique, and the server's ids pair up after hydration too.
- The server renders the first state, and hydration keeps it. An accordion the page renders outside any client entry stays as the server rendered it.
- Changes can be cancelled. A controlled accordion changes only when its owner renders it.
- Open state, ids and focus stay with each item when items are reordered, removed and added. Separate accordions keep separate state.
- Closed panels hold nothing focusable, and closing ones are `inert`: Tab skips a panel while it shrinks. Focus in a closing panel moves to its trigger.
- Find in page opens a `hiddenUntilFound` item through `beforematch`.
- Trigger text is 4.5:1 or more in both themes. The focus ring shows, also in forced colors.
- Panels move over `--duration-normal`, and in 0s with reduced motion.
- The chevron sits on the left in right-to-left text.
- axe-core finds no WCAG 2.2 A or AA violations on the example page in either color scheme, with items open.
- The page fits 320px without scrolling sideways, with normal text and at 200%.

Not checked, so not claimed:

- Real find in page (Ctrl+F) can't be driven by Playwright. The tests fire `beforematch` themselves.
- Screen readers (NVDA, JAWS, VoiceOver, TalkBack) weren't tested. Safari itself wasn't run, only Playwright's WebKit in CI. Forced colors were emulated, not tested in Windows.
- This isn't an accessibility certification.
