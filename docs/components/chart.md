# Chart

Line, area, bar, pie, radar and radial bar charts drawn as native SVG, in place of shadcn's Recharts. You build a chart the way shadcn does: a `ChartContainer` with your config, a chart root such as `BarChart`, and parts such as `CartesianGrid`, `XAxis`, `Bar`, `ChartTooltip` and `ChartLegend` as its children. The parts are RemixCN's own, named after the Recharts components they replace, and nothing else is installed.

The server draws the whole chart. In the browser it measures its box and draws at that size, and the pointer or the arrow keys inspect each value. Every chart also describes its data in a text summary and a table that only assistive technology reads.

- Source: `registry/ui/chart.tsx`. Needs `registry/lib/theme.css`, `styles.ts`, `composite.ts`, `anchor-position.ts` and `layer.ts`.
- Examples: `registry/examples/chart-example.tsx`. Run them with `bun run chart-examples`.
- Upstream: shadcn/ui [`chart.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/chart.tsx), its [docs](https://ui.shadcn.com/docs/components/base/chart), and the behavior of [Recharts 3.8.0](https://github.com/recharts/recharts/tree/v3.8.0), the version shadcn pins. RemixCN copies no Recharts code.

## Usage

```tsx
import { clientEntry } from 'remix/component'
import type { Handle } from 'remix/component'

import {
  Bar,
  BarChart,
  CartesianGrid,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  XAxis,
} from '#remixcn/ui/chart.tsx'
import type { ChartConfig } from '#remixcn/ui/chart.tsx'

const data = [
  { month: 'January', desktop: 186, mobile: 80 },
  { month: 'February', desktop: 305, mobile: 200 },
]

const config = {
  month: { label: 'Month' },
  desktop: { label: 'Desktop', color: 'var(--chart-1)' },
  mobile: { label: 'Mobile', theme: { light: '#2563eb', dark: '#60a5fa' } },
} satisfies ChartConfig

export const Visitors = clientEntry(import.meta.url, function Visitors(handle: Handle) {
  return () => (
    <ChartContainer config={config}>
      <BarChart data={data} aria-label="Visitors per month">
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickFormatter={(value) => String(value).slice(0, 3)} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="desktop" radius={4} />
        <Bar dataKey="mobile" radius={4} />
      </BarChart>
    </ChartContainer>
  )
})
```

The parts run in the browser inside your client entry, like Button. A chart outside any client entry stays as the server drew it: at its container's initial dimension, scaled to fit its box, with its summary and table, but nothing to inspect.

## API

### `ChartConfig` and `chartStyle()`

The config names each series and category and gives it a color, as in shadcn. `label` shows in the tooltip, the legend, the summary and the table. `icon` is a component that renders an SVG, such as one drawn with `Icon`, in place of the swatch. `color` is any CSS color, and `theme` a `{ light, dark }` pair that becomes `light-dark(light, dark)`, so the system preference or `data-theme` on any ancestor switches it without drawing again.

Each color becomes the CSS variable `--color-<key>` on the container, which `chartStyle(config)` returns for your own container. It takes the place of shadcn's `ChartStyle`, which wrote a `<style>` element per chart. Keys may hold only letters, digits, `-` and `_`. A color must be a hex color, a named color, a color function, `var()`, `color-mix()` or `light-dark()`, without quotes, semicolons, braces or any other function such as `url()`, so a series name or color from your data can't inject CSS or load anything. `isChartKey()` and `isChartColor()` apply the same rules.

### `ChartContainer`

A `div` that holds the config and the colors, with every `div` prop and `mix`. It keeps a 16 by 9 aspect ratio unless your styles give it another size, as shadcn's `aspect-video` does: give it a height, a minimum height or an aspect ratio, such as `mix={css({ aspectRatio: '1', maxHeight: '15.625rem', marginInline: 'auto' })}`. It's a block rather than shadcn's flex box, so a plot and a legend taller than the ratio grow the box instead of hiding the plot, and the plot keeps at least `--chart-min-height` (6rem).

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `config` | `ChartConfig` | | The labels, icons and colors |
| `id` | `string` | its own | Names the chart: `data-chart="chart-<id>"` |
| `initialDimension` | `{ width, height }` | `320` by `200` | The size it draws at on the server and until it measures its box |
| `locale` | `string` | `'en-US'` | The number format and list punctuation of the tooltip, the axes and the text alternatives. A fixed default keeps the server's HTML and the browser's alike |

### Chart roots

`LineChart`, `AreaChart` and `BarChart` draw categories along the x axis and values up the y axis. `PieChart` draws one `Pie`, `RadarChart` one polygon per `Radar` over spokes, and `RadialBarChart` one ring per row. Each renders the plot, the hidden summary, table and status, and its legend, and reads its parts' props during render, so the server knows the whole layout. Put the parts directly among its children or in fragments: parts inside your own components can't be read.

Every root takes:

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `data` | `object[]` | `[]` | The rows: one object per category, slice or ring |
| `margin` | `{ top, right, bottom, left }` | `5` each | Space around the plot, in pixels |
| `aria-label`, `aria-labelledby` | `string` | the kind of chart, such as "Bar chart" | Names the chart and its table. Point `aria-labelledby` at your card title |
| `summary` | `string` | written from the data | Describes the chart, such as in your language |
| `keyboardHint` | `string` | "Use the arrow keys to read each value, and Home and End for the first and last." | Tells keyboard users what the keys do, once the chart runs |
| `emptyLabel` | `string` | `'No data'` | Shows when there are no rows |
| `valueFormatter` | `(value, dataKey) => string` | the container's number format | Turns values into text in the tooltip, the bar labels, the summary, the table and the status. The value axis keeps the number format |

`BarChart`, `LineChart` and `AreaChart` also take `barGap` (pixels between the bars of a category, `4`) and `barCategoryGap` (pixels or a percentage at each side of a category's bars, `'10%'`). `PieChart`, `RadarChart` and `RadialBarChart` take `cx` and `cy` (pixels or percentages, `'50%'`). `RadarChart` takes `innerRadius`, `outerRadius` (`'80%'`), `startAngle` (`90`) and `endAngle` (`-270`). `RadialBarChart` takes `innerRadius` (`'30%'`), `outerRadius` (`'100%'`), `startAngle` (`0`), `endAngle` (`360`), `domain` and `barCategoryGap`.

### Cartesian parts

| Part | Props | What it draws |
| --- | --- | --- |
| `CartesianGrid` | `horizontal` (`true`), `vertical` (`true`), `strokeDasharray` | Lines at the value ticks and at the categories |
| `XAxis` | `dataKey`, `hide`, `tickLine` (`true`), `axisLine` (`true`), `tick` (`true`), `tickMargin` (`2`), `tickFormatter(value, index)`, `interval` (`'preserveEnd'`), `reversed`, `height` | The categories. Labels that would overlap make room, keeping the last, unless `interval` is `'preserveStart'` or a number. `reversed` runs them from right to left, as in shadcn's right-to-left example |
| `YAxis` | `hide`, `tickLine`, `axisLine`, `tick`, `tickMargin`, `tickFormatter(value, index)`, `tickCount` (`5`), `domain`, `orientation` (`'left'`), `width` | The value ticks. Its width fits its labels unless you set it |
| `Line` | `dataKey`, `type` (`'linear'`), `stroke`, `strokeWidth` (`1`), `dot` (`true`), `activeDot` (`true`), `stackId` | A line through the values, broken at each missing one |
| `Area` | `dataKey`, `type`, `fill`, `fillOpacity` (`0.6`), `stroke`, `strokeWidth`, `dot` (`false`), `activeDot` (`true`), `stackId` | The area under the line, or between it and the series below in its stack |
| `Bar` | `dataKey`, `fill`, `radius`, `stackId`, `label` | A bar per value, side by side or stacked. `radius` rounds the end away from zero, or each corner: top left, top right, bottom right, bottom left. `label` prints each value at the bar's end, or `{ position: 'inside', formatter }` |

`type` is `'linear'`, `'monotone'` (never overshoots a value), `'natural'` (a natural cubic spline) or `'step'`. Colors default to `var(--color-<dataKey>)`, then to the chart tokens by position.

### Polar parts

| Part | Props | What it draws |
| --- | --- | --- |
| `Pie` | `data`, `dataKey`, `nameKey` (`'name'`), `innerRadius` (`0`), `outerRadius` (`'80%'`), `startAngle` (`0`), `endAngle` (`360`), `paddingAngle` (`0`), `stroke` (`'none'`), `strokeWidth` | A slice per row, sized by its share. A row's `fill` field colors its slice, as in shadcn's data; otherwise `var(--color-<name>)` |
| `Radar` | `dataKey`, `fill`, `fillOpacity` (`1`), `stroke`, `strokeWidth`, `dot` (`false`) | A polygon through the values on the spokes |
| `RadialBar` | `dataKey`, `nameKey` (`'name'`), `background` | A ring per row along the angle its value takes, over a muted track with `background` |
| `PolarGrid` | `gridType` (`'polygon'`, or `'circle'` in a radial chart), `radialLines` (`true`), `polarRadius`, `fill`, `stroke` | Rings at the value ticks, or at `polarRadius`, and spokes. `fill` fills the rings in order, each over the last: `['var(--muted)', 'var(--card)']` draws the track between two radii that shadcn draws with `first:fill-muted last:fill-background` |
| `PolarAngleAxis` | `dataKey`, `tick` (`true`), `tickFormatter(value, index)` | The categories at the end of each spoke |
| `ChartCenterLabel` | `value`, `caption`, `size` (`'default'` or `'lg'`), `content(viewBox)` | Text at the center, such as a donut's total. `content` draws your own SVG from `{ cx, cy, innerRadius, outerRadius }`, as Recharts' `Label content` did |

Angles are degrees from three o'clock, growing counterclockwise, as in Recharts. Radii are pixels or percentages of the largest radius that fits. Radii in pixels that don't fit shrink together, along with a grid's `polarRadius`, and an inner radius that reaches the outer one leaves a ring of 40% of it, so a small chart keeps its shape.

### `ChartTooltip` and `ChartTooltipContent`

`ChartTooltip` shows the row the pointer or keyboard inspects next to it, inside the chart: beside the top value of a category, the middle of a slice, the end of a ring or the farthest value of a spoke. It stays there while the pointer moves within the row, and the pointer can move onto it, also across other rows or a donut's hole on the way, to read it up close, as WCAG 1.4.13 asks. Escape closes it from anywhere, before a dialog the chart is in, and it stays closed until the pointer moves to another row. Put it among the chart's parts.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `content` | node | `<ChartTooltipContent />` | What it shows |
| `cursor` | `boolean` | `true` | Whether to mark the pointer's row: a muted band behind bars, or a line. The keyboard's row is always marked, so its focus stays visible |
| `defaultIndex` | `number` | | A row to inspect from the start, as Recharts v3's `defaultIndex` does |

`ChartTooltipContent` is shadcn's tooltip box, with every `div` prop and `mix`: the label, then a swatch, a name and a value per series. It reads the inspected row from the chart, or takes `active`, `payload` and `label` to render on its own, as the tooltip example does.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `indicator` | `'dot'`, `'line'` or `'dashed'` | `'dot'` | The swatch. With one value and a line or dash, the label nests beside it |
| `hideLabel`, `hideIndicator` | `boolean` | `false` | |
| `labelKey`, `nameKey` | `string` | | The config or row key for the label and the names, as shadcn documents: `labelKey="visitors" nameKey="browser"` |
| `labelFormatter` | `(label, payload) => node` | | Renders the label |
| `formatter` | `(value, name, item, index, row) => node` | | Renders one value in place of its swatch, name and number |
| `color` | `string` | each series' | One swatch color |

For your own content, call `getChartTooltip(handle)` in a part of yours: it returns `{ active, index, label, payload }`, where each payload item has `dataKey`, `name`, `value`, `color` and the row as `payload`, the shape Recharts gave shadcn.

### `ChartLegend` and `ChartLegendContent`

`ChartLegend` puts its `content` (default `<ChartLegendContent />`) below the chart, or above it with `verticalAlign="top"`. `ChartLegendContent` is a list of a swatch or icon and a label per series, or per slice or ring, with every `div` prop and `mix`, `hideIcon`, `nameKey` and `payload`. Labels come from the config and fall back to the key, so every series is named in text, not by color alone.

### `ChartError`

Rendering throws a `ChartError` that says what to fix, also on the server, for: data that isn't an array of objects; a value that isn't a finite number, `null` or missing; a negative value in a pie, radar or radial bar chart; two series with one `dataKey`; a key that isn't a CSS name; values whose range or stacked sum no number can hold, such as -1e308 to 1e308; and an unsafe color in the config, a prop, a row's `fill` or a payload you pass to the tooltip or legend content. Check data you don't control before you pass it, such as with `isChartKey()`, `isChartColor()` and `Number.isFinite()`.

### Geometry helpers

`niceTicks(min, max, count)`, `curvePath(points, type)`, `sectorPath(cx, cy, inner, outer, start, end)` and `polarToCartesian(cx, cy, radius, angle)` are the functions the parts draw with, for SVG parts of your own.

## Scales and data

- **Values.** `null` or a missing field is no value: a line breaks there, a bar or slice isn't drawn, and the table shows "–". Anything else must be a finite number.
- **Value axis.** It spans from zero, or below it for negative values, to the largest value, in `tickCount` evenly spaced ticks, at least three across zero, whose step is 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6 or 8 times a power of ten, so 0 to 305 gets 0, 80, 160, 240 and 320. All zeros span 0 to 1. `YAxis domain` fixes the range instead. Bars and areas grow from zero.
- **Stacks.** Series with the same `stackId` add up per row: positive values up from zero, negative values down from it.
- **Categories.** A bar chart gives each category an equal band; line and area charts put the first and last category at the plot's edges. A radar chart spaces its spokes evenly, clockwise from twelve o'clock.
- **Pies and radial bars.** A slice's angle is its share of the total, counted over the largest value, so values near the largest number a chart can hold still share out; a total of zero draws an empty track. A radial bar's angle runs from `startAngle` at 0 to `endAngle` at the largest value, or across `domain`.

## Composition

- **Cards.** Wrap a chart in Card, and name it with `aria-labelledby` pointing at the card title, as every example does.
- **Your own SVG.** Any other child of a chart root renders inside its SVG, after the parts before it, such as `<defs>` with a gradient that a `fill="url(#…)"` of yours uses.
- **Changing data.** New `data` or parts redraw the chart in place. A row the keyboard or pointer was on that no longer exists stops being inspected.
- **Right to left.** The plot keeps its geometry, as in shadcn: give `XAxis` `reversed` to run the categories from right to left, which also swaps the arrow keys and the bars within each category. The legend, tooltip and table follow the text direction, and the config's labels translate the months, as the right-to-left example shows.
- **Without JavaScript.** The chart is an image named like the interactive one, with the same summary and table.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `ChartConfig` with `label`, `icon`, `color` or `theme` | Same | `label` is a string, so the text alternatives can read it. `theme` becomes `light-dark()` |
| `ChartContainer` with `config`, `id`, `initialDimension` and Recharts' `ResponsiveContainer` | `ChartContainer` and the root's own measuring | A `ResizeObserver` on the plot. A block with a 16:9 aspect ratio instead of a flex box, so it grows for a legend; `locale` added |
| `ChartStyle`, a `<style>` element per chart with `.dark` selectors | `chartStyle()` and the container's `style` | CSS variables on the container. Keys and colors are checked first |
| `ChartTooltip` (Recharts' `Tooltip`) with `content`, `cursor`, `defaultIndex` | `ChartTooltip` | Placed beside the row inside the chart, as Recharts keeps it in its view box, rather than following the pointer, so the pointer can reach it. Escape closes it through `layer.ts`. Other Recharts `Tooltip` props, such as `trigger`, `offset`, `allowEscapeViewBox` and animation, aren't ported |
| `ChartTooltipContent` with `indicator`, `hideLabel`, `hideIndicator`, `label`, `labelFormatter`, `labelClassName`, `formatter`, `color`, `nameKey`, `labelKey` | Same, but `labelClassName` | Style the label with `[data-slot="chart-tooltip-label"]` in `@layer app`. Values use the container's locale, not the browser's, so the server and browser agree |
| `ChartLegend` (Recharts' `Legend`) with `content`, `verticalAlign` | `ChartLegend` | A list in the page's flow, not absolutely placed. Recharts' `align`, `layout`, `iconType` and click handlers aren't ported |
| `ChartLegendContent` with `hideIcon`, `nameKey`, `verticalAlign` | Same | A `<ul role="list">`; a series without a config label shows its key instead of nothing |
| `useChart()` | `getChartTooltip(handle)` and the container's context | Not a hook: parts read context during render |
| `getPayloadConfigFromPayload` | The same lookup, inside the content parts | |
| `LineChart`, `AreaChart`, `BarChart`, `PieChart`, `RadarChart`, `RadialBarChart` | Same names | Recharts' `layout="vertical"`, `stackOffset`, `syncId`, `ComposedChart` and the other charts aren't ported |
| `accessibilityLayer` | Always on | Arrow keys, Home and End, Escape, a status message, a summary and a table; see below |
| `CartesianGrid`, `XAxis`, `YAxis`, `Line`, `Area`, `Bar` | Same names and the documented props | Recharts' axis `type="number"`, `scale`, `ticks`, `padding`, `mirror`, `angle`, `connectNulls`, `Cell` and `LabelList` aren't ported; `Bar`'s `label` replaces the basic `LabelList`, and a row's `fill` colors pie slices as `Cell` did |
| `Pie`, `Radar`, `RadialBar`, `PolarGrid`, `PolarAngleAxis` | Same names and the documented props | `PolarRadiusAxis`, `activeShape`, `cornerRadius` and pie labels aren't ported |
| `Label` with `content({ viewBox })` in a pie or radius axis | `ChartCenterLabel` with `value`, `caption`, `size` or `content(viewBox)` | |
| Recharts' animations | Bars grow and series fade in once, with `--duration-normal` | None for reduced motion. New data redraws without animating |
| Recharts' default `#ccc` grid, `#fff` dots and slice edges, which shadcn's classes recolor | `--border` at 50% for the grid, `--muted` for the cursor and tracks, no slice edges | As shadcn's classes leave them |
| `.cn-chart-tooltip` in `style-vega.css` | The same box: `--background`, a border at 50%, `--radius-lg`, `text-xs`, a large shadow | A `CanvasText` border in forced colors |
| Docs: Your First Chart, Grid, Axis, Tooltip, Legend, Theming, Chart Config, RTL | `ChartBarExample`, `ChartBarStackedExample`, `ChartRtlExample` | The theme section's colors work through `color`, `theme` and `var()` |
| Examples: Area, Bar - Multiple, Line - Multiple, Pie - Donut with Text, Radial - Shape, Radar - Multiple | `ChartAreaExample`, `ChartBarExample`, `ChartLineExample`, `ChartPieExample`, `ChartRadialExample`, `ChartRadarExample` | The pie adds a legend |
| `chart-tooltip.tsx` docs demo | `ChartTooltipExample` | The four tooltip variants, without the hand-drawn arrows |
| `chart-demo.tsx`, the interactive bar chart | `ChartBarInteractiveExample` | Two weeks of invented data, with buttons that switch the series |
| — | `ChartBarStackedExample`, `ChartAreaStackedExample`, `ChartBarNegativeExample` | Stacks with a legend, and values below zero with a value axis and labels |

## Accessibility checks

Automated, in Chromium, Firefox and WebKit:

- The server draws every family with a role of `img`, a name, a summary and a table that lists every row; once it runs, the chart is one tab stop with the role `application`, described by the summary and the keyboard hint, and without rows it isn't focusable.
- Keyboard focus shows the first row, or the last one inspected; the arrows move one row and stay at the ends, Home and End jump, Escape hides the tooltip and gives a second Escape back to the page, and modified keys are left alone. Along a reversed axis the arrows swap. Each move is said in a `role="status"` region, such as "February: Desktop 305, Mobile 200", in the container's locale; the pointer stays quiet.
- The keyboard's row keeps a focus ring on the chart, the cursor and outlined bars or slices, also where the pointer's cursor is off.
- The pointer inspects the category, slice, ring or spoke under it, the tooltip stays inside the chart, and it closes as the pointer leaves. The pointer can move onto the tooltip, across other bars or a donut's hole, without the row changing, and leaving it another way inspects the row there. Escape closes the pointer's tooltip while focus stays elsewhere, and it stays closed until the pointer moves to another row. A tap keeps its row until a press elsewhere or focus moves away.
- Measuring, resizing, hiding, hydrating server HTML in place with paired ids, several charts on one page, new data (negative values, zeros, gaps and no rows), theme colors that follow `data-theme`, and cleanup of the size observer.
- axe-core finds no WCAG 2.2 A or AA violation in both themes, once the charts run and before the script loads. Tick labels, legend labels and the tooltip's text keep 4.5:1 in both themes.
- In forced colors, bars and slices get `CanvasText` edges, the keyboard's slice a `Highlight` outline, and the tooltip a `CanvasText` border.
- Bars grow and series fade in only without reduced motion.
- At 320px wide, also with text at 200%, nothing scrolls sideways, the legend wraps, and the plot keeps its minimum height.
- Long German labels wrap in the tooltip and legend, and overlapping category labels make room.

Not checked, so not claimed:

- The neutral theme's chart tokens are grays, the same in both themes, and not all reach 3:1 against the card: `--chart-1` is 1.5:1 in light, and `--chart-3`, `--chart-4` and `--chart-5` are 2.3, 1.7 and 1.2:1 in dark. Every value stays readable as text in the tooltip, the table and the legend, but those shapes alone don't meet WCAG 1.4.11. The tokens are the theme's (C-977) and unchanged here.
- Screen readers weren't tested, so how each announces the `application` role and the status isn't known.
- Safari itself and Windows forced colors weren't tested.
- This isn't an accessibility certification.
