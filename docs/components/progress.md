# Progress

Shows how far a task has come, as a bar, with a label and a formatted value. It is determinate with a value, and indeterminate without one.

- Source: `registry/ui/progress.tsx`. Needs `registry/lib/theme.css` and `registry/lib/styles.ts`.
- Examples: `registry/examples/progress-example.tsx`. Run them with `bun run display-examples`.
- Upstream: shadcn/ui [`progress.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/progress.tsx), its [docs](https://ui.shadcn.com/docs/components/base/progress), and [Base UI Progress](https://base-ui.com/react/components/progress.md).

## Usage

```tsx
import { Progress, ProgressLabel, ProgressValue } from '#remixcn/ui/progress.tsx'

<Progress value={56}>
  <ProgressLabel>Upload progress</ProgressLabel>
  <ProgressValue />
</Progress>
<Progress value={null} aria-label="Preparing the export" />
```

## API

### `Progress`

A `<div role="progressbar">` that takes every native `<div>` prop, `mix`, and:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `value` | `number \| null` | | The current value. `null`, or a value that isn't finite, makes the bar indeterminate |
| `min`, `max` | `number` | `0`, `100` | The range |
| `format` | `Intl.NumberFormatOptions` | | Formats the value. Without it, the value shows as a percentage of the range |
| `locale` | `Intl.LocalesArgument` | The runtime's | The formatting locale |
| `getAriaValueText` | `(formatted, value) => string` | | The text assistive technology reads, such as "Step 3 of 4" |

It renders `aria-valuemin`, `aria-valuemax`, `aria-valuenow` (clamped to the range, and left out while indeterminate) and `aria-valuetext` (the formatted value, or "indeterminate progress"). Every part gets one of `data-indeterminate`, `data-progressing` or `data-complete`. It renders its children, then the track and the indicator.

### Parts

- `ProgressLabel` is a `<span>` that names the bar through the bar's `aria-labelledby`. It may sit anywhere inside the bar, also in a component of your own, such as a reusable label:
  - Without an `id`, it takes the bar's label id, so the server HTML already names the bar.
  - With an `id`, the bar finds it among its children, also inside elements and fragments. Inside a component of your own, the label tells the bar its `id` in the browser; on a page that only renders on the server, leave the `id` to the bar there.
  - A name you give the bar, with `aria-label` or `aria-labelledby`, wins. A bar with neither and no label points at a label id that isn't there, and has no name: give it one.
- `ProgressValue` is a `<span aria-hidden="true">` with the formatted value, since the bar's `aria-valuetext` says the same. A function child gets the formatted value, or `'indeterminate'`, and the raw value.
- `ProgressTrack` and `ProgressIndicator` are the track and the fill. The fill's width is the value's share of the range, from the inline start, so it fills from the right in right-to-left text. A `style` you pass, as an object or a string, keeps the width, unless it sets one itself.

## Behavior

- The fill animates its width with the motion tokens, so it jumps for reduced motion.
- Without a value, a short bar slides along the track. For reduced motion, it stays still as a full, faint bar.
- In forced colors, the track draws a border and the fill takes `Highlight`.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| Base UI `Progress.Root`: value, min, max, format, locale, getAriaValueText, `aria-valuetext` | `Progress` | Same clamping, status and formatting rules |
| Base UI's hidden "x" for NVDA | Not ported | The bar holds its label and value as children instead |
| `Track`, `Indicator`, `Label`, `Value` | `ProgressTrack`, `ProgressIndicator`, `ProgressLabel`, `ProgressValue` | Remix context instead of React context. A label without an id takes the bar's; one with an id is found among the children, or tells the bar in the browser |
| `data-indeterminate`, `data-progressing`, `data-complete` | Same | |
| shadcn's track `h-1.5 rounded-full bg-muted`, fill `bg-primary transition-all` | Same, with `transition()` | |
| No indeterminate style | A sliding bar, still for reduced motion | |
| Docs: Label, Controlled, RTL; examples: Progress Bar, With Label, File Upload List | `ProgressWithLabel`, `ProgressControlled` (a native range input instead of Slider), `ProgressValues`, `ProgressFileList`, the Right to left section | |
| — | `ProgressIndeterminate`, `ProgressFormatted` | |

## Accessibility checks

Automated: range, value and text on the server at 0, in between, at and beyond both ends, in any range; indeterminate without a finite value; formats and `getAriaValueText`; the label names the bar, also from a component of your own, on the server and in the browser; a style string keeps the fill's width; in the browser, a changing value moves through progressing, complete and indeterminate and back, two bars keep their own values and labels, and the fill starts at the inline start; a range input sets it from the keyboard and a pointer; the fill stays visible in forced colors; animations stop for reduced motion. Screen readers weren't run. This isn't an accessibility certification.
