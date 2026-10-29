# Alert

A callout for a message, with an optional icon, title, description and action. Its live role follows the message's urgency.

- Source: `registry/ui/alert.tsx`. Needs `registry/lib/theme.css`.
- Examples: `registry/examples/alert-example.tsx`. Run them with `bun run display-examples`.
- Upstream: shadcn/ui [`alert.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/alert.tsx) and its [docs](https://ui.shadcn.com/docs/components/base/alert).

## Usage

```tsx
import { Alert, AlertAction, AlertDescription, AlertTitle } from '#remixcn/ui/alert.tsx'

<Alert variant="destructive">
  <CircleAlertIcon />
  <AlertTitle>Payment failed</AlertTitle>
  <AlertDescription>The card ending in 4242 was declined.</AlertDescription>
  <AlertAction>
    <Button size="xs" variant="destructive">Retry</Button>
  </AlertAction>
</Alert>
```

## API

### `Alert`

A `<div>` that takes every native `<div>` prop, `mix`, and:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `variant` | `'default' \| 'destructive'` | `'default'` | Neutral, or red for an error |
| `live` | `'assertive' \| 'polite' \| 'off'` | `'assertive'` when destructive, else `'off'` | `assertive` renders `role="alert"`, which interrupts a screen reader. `polite` renders `role="status"`, which waits. `off` renders no live role, for a static callout |

A `role` you pass wins. It renders `data-slot="alert"` and `data-variant`.

### `AlertTitle`

A `<div>`, as in shadcn. `level={2}` and so on render a native `<h2>` to `<h6>` instead, so the title joins the document outline.

### `AlertDescription`

A `<div>` for the message. It may hold paragraphs, which get space between them, and links, which are underlined.

### `AlertAction`

A `<div>` for a button or link that acts on the alert. It sits in the end corner, in a column of its own, so the text never runs under it. In an alert narrower than 18rem, it moves under the text.

## Composition

- **Icon.** Put an icon first. It takes a column of its own and the alert's text color. RemixCN icons hide themselves from assistive technology, so the text carries the meaning.
- **Urgency.** Keep `live="off"` for content that is there when the page loads. For a message that appears or changes later, render the alert with `live="polite"` or `"assertive"` before the change and change its text: a live region that appears together with its text may not be announced. The Live status example shows it.
- **Colors.** Pass a `css()` with `mix`, or set `--card`, `--card-foreground` and `--destructive` on an ancestor.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `Alert` with `role="alert"` | `Alert` with `live` | shadcn interrupts screen readers for every alert. RemixCN picks the role by urgency: `alert` for destructive, none for a default callout, `status` when you ask for it |
| `variant`: default, destructive | Same | |
| `AlertTitle`, `AlertDescription` | Same, as `<div>` | `AlertTitle` adds `level` for a native heading |
| `AlertAction`, absolute in the end corner with `pr-18` on the alert | A grid column at the end | Reserving a fixed 4.5rem let a wider action cover the text. The column fits the action, and a container query moves it under the text in a narrow alert |
| `*:[svg]` icon column, `translate-y-0.5` | Same, in the alert's own rule | |
| `[&_a]:underline` | Same | |
| Destructive description `text-destructive/90` | `--destructive` mixed with 15% `--foreground` | Keeps 4.5:1 or more |
| `text-balance md:text-pretty` | `text-wrap: pretty` | |
| Docs: Basic, Destructive, Action, Custom Colors, RTL | `AlertBasic`, `AlertDestructive`, `AlertWithActions`, `AlertCustomColors`, the fixture's Right to left section | |
| Example: With Icons | `AlertWithIcons` | |
| — | `AlertLiveStatus` | A polite status that stays rendered while its text changes |

## Accessibility checks

Automated (`bun run test`, `test:browser`, `test:e2e`):

- A default alert has no live role, a destructive one has `role="alert"`, and `live` sets `status`, `alert` or none.
- A polite status keeps its element while its text changes, from a click or Enter.
- Title, description and alert-colored text are 4.5:1 or more in both themes.
- The action keeps clear of the text, and moves under it in a narrow alert. Long words break.
- The page passes axe-core's WCAG 2.2 A and AA rules, fits 320px with text at 200%, and mirrors in right-to-left text.

Not checked, so not claimed: screen readers weren't run, so whether each one announces a live region as intended is untested. Forced colors were emulated in Chromium and Firefox only. This isn't an accessibility certification.
