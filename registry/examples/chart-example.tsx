// RemixCN Chart examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'

import { Icon } from '#remixcn/lib/icons.tsx'
import type { IconProps } from '#remixcn/lib/icons.tsx'
import { Button } from '#remixcn/ui/button.tsx'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '#remixcn/ui/card.tsx'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ChartCenterLabel,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  XAxis,
  YAxis,
} from '#remixcn/ui/chart.tsx'
import type { ChartConfig, ChartPayloadItem } from '#remixcn/ui/chart.tsx'

// Each example is a client entry, so its chart measures its box and the
// pointer and keyboard inspect its values. Without it, the chart stays as the
// server drew it, with its summary and table.

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const cardStyles = css({ width: '100%' })
const footerStyles = css({
  display: 'grid',
  gap: space(2),
  justifyItems: 'start',
  fontSize: 'var(--text-sm)',
  '&[data-centered]': { justifyItems: 'center', marginInline: 'auto', textAlign: 'center' },
})
const trendStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: space(2),
  margin: 0,
  fontWeight: 500,
  lineHeight: 1.25,
  '& svg': { width: space(4), height: space(4), flex: 'none' },
})
const mutedStyles = css({ margin: 0, color: 'var(--muted-foreground)', lineHeight: 1.25 })
const centered = css({ justifyItems: 'center', textAlign: 'center' })
const tooltipPartsStyles = css({ display: 'block', aspectRatio: 'auto' })
const square = (maxHeight: string) => css({ marginInline: 'auto', aspectRatio: '1', maxHeight })
const tallStyles = css({ aspectRatio: 'auto', height: '15.625rem', width: '100%' })
const tooltipGridStyles = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 10rem), 1fr))',
  gap: space(6),
  alignItems: 'start',
})
const toggleStyles = css({ display: 'flex', flexWrap: 'wrap', gap: space(2) })

const months = [
  { month: 'January', desktop: 186, mobile: 80 },
  { month: 'February', desktop: 305, mobile: 200 },
  { month: 'March', desktop: 237, mobile: 120 },
  { month: 'April', desktop: 73, mobile: 190 },
  { month: 'May', desktop: 209, mobile: 130 },
  { month: 'June', desktop: 214, mobile: 140 },
]

const visitsConfig = {
  month: { label: 'Month' },
  desktop: { label: 'Desktop', color: 'var(--chart-1)' },
  mobile: { label: 'Mobile', color: 'var(--chart-2)' },
} satisfies ChartConfig

const shortMonth = (value: unknown) => String(value).slice(0, 3)

function TrendingUpIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </Icon>
  )
}

function Trend(handle: Handle<{ centered?: boolean; children?: RemixNode }>) {
  return () => (
    <div data-centered={handle.props.centered ? '' : undefined} mix={footerStyles}>
      <p mix={trendStyles}>
        Trending up by 5.2% this month <TrendingUpIcon />
      </p>
      <p mix={mutedStyles}>{handle.props.children}</p>
    </div>
  )
}

/** An area under one series, with a natural curve and a line indicator in its tooltip. */
export const ChartAreaExample = clientEntry(import.meta.url, function ChartAreaExample(handle: Handle) {
  return () => (
    <Card mix={cardStyles}>
      <CardHeader>
        <CardTitle level={3} id={`${handle.id}-title`}>
          Area Chart
        </CardTitle>
        <CardDescription>Showing total visitors for the last 6 months</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={visitsConfig}>
          <AreaChart data={months} margin={{ left: 12, right: 12 }} aria-labelledby={`${handle.id}-title`}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={shortMonth} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
            <Area dataKey="desktop" type="natural" fillOpacity={0.4} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <Trend>January - June 2024</Trend>
      </CardFooter>
    </Card>
  )
})

/** Two series side by side in each month, with a dashed indicator in the tooltip. */
export const ChartBarExample = clientEntry(import.meta.url, function ChartBarExample(handle: Handle) {
  return () => (
    <Card mix={cardStyles}>
      <CardHeader>
        <CardTitle level={3} id={`${handle.id}-title`}>
          Bar Chart - Multiple
        </CardTitle>
        <CardDescription>January - June 2024</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={visitsConfig}>
          <BarChart data={months} aria-labelledby={`${handle.id}-title`}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} tickFormatter={shortMonth} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dashed" />} />
            <Bar dataKey="desktop" radius={4} />
            <Bar dataKey="mobile" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <Trend>Showing total visitors for the last 6 months</Trend>
      </CardFooter>
    </Card>
  )
})

/** Two series stacked in each month, with a legend and the cursor band behind the bars. */
export const ChartBarStackedExample = clientEntry(import.meta.url, function ChartBarStackedExample(handle: Handle) {
  return () => (
    <Card mix={cardStyles}>
      <CardHeader>
        <CardTitle level={3} id={`${handle.id}-title`}>
          Bar Chart - Stacked + Legend
        </CardTitle>
        <CardDescription>January - June 2024</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={visitsConfig}>
          <BarChart data={months} aria-labelledby={`${handle.id}-title`}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} tickFormatter={shortMonth} />
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="desktop" stackId="a" radius={[0, 0, 4, 4]} />
            <Bar dataKey="mobile" stackId="a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <Trend>Showing total visitors for the last 6 months</Trend>
      </CardFooter>
    </Card>
  )
})

const profits = [
  { month: 'January', profit: 186 },
  { month: 'February', profit: 205 },
  { month: 'March', profit: -207 },
  { month: 'April', profit: 173 },
  { month: 'May', profit: -209 },
  { month: 'June', profit: 214 },
]

const profitConfig = {
  month: { label: 'Month' },
  profit: { label: 'Profit', color: 'var(--chart-2)' },
} satisfies ChartConfig

/** Values below zero hang down from the zero line, with a value axis and a label on each bar. */
export const ChartBarNegativeExample = clientEntry(import.meta.url, function ChartBarNegativeExample(handle: Handle) {
  return () => (
    <Card mix={cardStyles}>
      <CardHeader>
        <CardTitle level={3} id={`${handle.id}-title`}>
          Bar Chart - Negative
        </CardTitle>
        <CardDescription>January - June 2024</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={profitConfig}>
          <BarChart data={profits} margin={{ top: 20, bottom: 20 }} aria-labelledby={`${handle.id}-title`}>
            <CartesianGrid vertical={false} />
            <YAxis tickLine={false} axisLine={false} tickCount={5} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel hideIndicator />} />
            <Bar dataKey="profit" radius={4} label />
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <Trend>Profit in thousands of francs</Trend>
      </CardFooter>
    </Card>
  )
})

/** Two lines with a monotone curve and no dots; the active dot follows the pointer and keyboard. */
export const ChartLineExample = clientEntry(import.meta.url, function ChartLineExample(handle: Handle) {
  return () => (
    <Card mix={cardStyles}>
      <CardHeader>
        <CardTitle level={3} id={`${handle.id}-title`}>
          Line Chart - Multiple
        </CardTitle>
        <CardDescription>January - June 2024</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={visitsConfig}>
          <LineChart data={months} margin={{ left: 12, right: 12 }} aria-labelledby={`${handle.id}-title`}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={shortMonth} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Line dataKey="desktop" type="monotone" strokeWidth={2} dot={false} />
            <Line dataKey="mobile" type="monotone" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <Trend>Showing total visitors for the last 6 months</Trend>
      </CardFooter>
    </Card>
  )
})

/** Two areas stacked, with a legend above and a value axis. */
export const ChartAreaStackedExample = clientEntry(import.meta.url, function ChartAreaStackedExample(handle: Handle) {
  return () => (
    <Card mix={cardStyles}>
      <CardHeader>
        <CardTitle level={3} id={`${handle.id}-title`}>
          Area Chart - Stacked
        </CardTitle>
        <CardDescription>Showing total visitors for the last 6 months</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={visitsConfig}>
          <AreaChart data={months} margin={{ left: 0, right: 12 }} aria-labelledby={`${handle.id}-title`}>
            <CartesianGrid vertical={false} />
            <YAxis tickLine={false} axisLine={false} tickCount={4} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={shortMonth} />
            <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
            <ChartLegend verticalAlign="top" content={<ChartLegendContent />} />
            <Area dataKey="mobile" type="natural" stackId="a" fillOpacity={0.4} />
            <Area dataKey="desktop" type="natural" stackId="a" fillOpacity={0.4} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <Trend>January - June 2024</Trend>
      </CardFooter>
    </Card>
  )
})

const browsers = [
  { browser: 'chrome', visitors: 275, fill: 'var(--color-chrome)' },
  { browser: 'safari', visitors: 200, fill: 'var(--color-safari)' },
  { browser: 'firefox', visitors: 287, fill: 'var(--color-firefox)' },
  { browser: 'edge', visitors: 173, fill: 'var(--color-edge)' },
  { browser: 'other', visitors: 190, fill: 'var(--color-other)' },
]

const browserConfig = {
  browser: { label: 'Browser' },
  visitors: { label: 'Visitors' },
  chrome: { label: 'Chrome', color: 'var(--chart-1)' },
  safari: { label: 'Safari', color: 'var(--chart-2)' },
  firefox: { label: 'Firefox', color: 'var(--chart-3)' },
  edge: { label: 'Edge', color: 'var(--chart-4)' },
  other: { label: 'Other', color: 'var(--chart-5)' },
} satisfies ChartConfig

/** A donut of five slices with the total in its center and a legend below. */
export const ChartPieExample = clientEntry(import.meta.url, function ChartPieExample(handle: Handle) {
  return () => {
    let total = browsers.reduce((sum, row) => sum + row.visitors, 0)

    return (
      <Card mix={cardStyles}>
        <CardHeader mix={centered}>
          <CardTitle level={3} id={`${handle.id}-title`}>
            Pie Chart - Donut with Text
          </CardTitle>
          <CardDescription>January - June 2024</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={browserConfig} mix={square('17.5rem')}>
            <PieChart aria-labelledby={`${handle.id}-title`}>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Pie data={browsers} dataKey="visitors" nameKey="browser" innerRadius={60} />
              <ChartCenterLabel value={total.toLocaleString('en-US')} caption="Visitors" />
              <ChartLegend content={<ChartLegendContent nameKey="browser" />} />
            </PieChart>
          </ChartContainer>
        </CardContent>
        <CardFooter>
          <Trend centered>Showing total visitors for the last 6 months</Trend>
        </CardFooter>
      </Card>
    )
  }
})

const safari = [{ browser: 'safari', visitors: 1260, fill: 'var(--color-safari)' }]

const radialConfig = {
  browser: { label: 'Browser' },
  visitors: { label: 'Visitors' },
  safari: { label: 'Safari', color: 'var(--chart-2)' },
} satisfies ChartConfig

/** One ring whose end angle shows the share, over a muted track, with the value in its center. */
export const ChartRadialExample = clientEntry(import.meta.url, function ChartRadialExample(handle: Handle) {
  return () => (
    <Card mix={cardStyles}>
      <CardHeader mix={centered}>
        <CardTitle level={3} id={`${handle.id}-title`}>
          Radial Chart - Shape
        </CardTitle>
        <CardDescription>January - June 2024</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={radialConfig} mix={square('13.125rem')}>
          <RadialBarChart
            data={safari}
            endAngle={100}
            innerRadius={64}
            outerRadius={94}
            aria-labelledby={`${handle.id}-title`}
          >
            <PolarGrid
              gridType="circle"
              radialLines={false}
              stroke="none"
              polarRadius={[86, 74]}
              fill={['var(--muted)', 'var(--card)']}
            />
            <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="browser" />} />
            <RadialBar dataKey="visitors" nameKey="browser" />
            <ChartCenterLabel value={safari[0].visitors.toLocaleString('en-US')} caption="Visitors" size="lg" />
          </RadialBarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <Trend centered>Showing total visitors for the last 6 months</Trend>
      </CardFooter>
    </Card>
  )
})

/** Two series over six spokes, one translucent over the other. */
export const ChartRadarExample = clientEntry(import.meta.url, function ChartRadarExample(handle: Handle) {
  return () => (
    <Card mix={cardStyles}>
      <CardHeader mix={centered}>
        <CardTitle level={3} id={`${handle.id}-title`}>
          Radar Chart - Multiple
        </CardTitle>
        <CardDescription>Showing total visitors for the last 6 months</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={visitsConfig} mix={square('15.625rem')}>
          <RadarChart data={months} aria-labelledby={`${handle.id}-title`}>
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
            <PolarAngleAxis dataKey="month" />
            <PolarGrid />
            <Radar dataKey="desktop" fillOpacity={0.6} />
            <Radar dataKey="mobile" />
          </RadarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <Trend centered>January - June 2024</Trend>
      </CardFooter>
    </Card>
  )
})

const days = [
  { date: '2024-04-01', desktop: 222, mobile: 150 },
  { date: '2024-04-02', desktop: 97, mobile: 180 },
  { date: '2024-04-03', desktop: 167, mobile: 120 },
  { date: '2024-04-04', desktop: 242, mobile: 260 },
  { date: '2024-04-05', desktop: 373, mobile: 290 },
  { date: '2024-04-06', desktop: 301, mobile: 340 },
  { date: '2024-04-07', desktop: 245, mobile: 180 },
  { date: '2024-04-08', desktop: 409, mobile: 320 },
  { date: '2024-04-09', desktop: 59, mobile: 110 },
  { date: '2024-04-10', desktop: 261, mobile: 190 },
  { date: '2024-04-11', desktop: 327, mobile: 350 },
  { date: '2024-04-12', desktop: 292, mobile: 210 },
  { date: '2024-04-13', desktop: 342, mobile: 380 },
  { date: '2024-04-14', desktop: 137, mobile: 220 },
]

const daysConfig = { ...visitsConfig, date: { label: 'Date' } } satisfies ChartConfig

const dayLabel = (value: unknown) =>
  new Date(`${String(value)}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })

/** Buttons switch the series the bars show, so the chart takes new props in place. */
export const ChartBarInteractiveExample = clientEntry(
  import.meta.url,
  function ChartBarInteractiveExample(handle: Handle) {
    let shown: 'desktop' | 'mobile' = 'desktop'

    return () => {
      let totals = {
        desktop: days.reduce((sum, day) => sum + day.desktop, 0),
        mobile: days.reduce((sum, day) => sum + day.mobile, 0),
      }

      return (
        <Card mix={cardStyles}>
          <CardHeader>
            <CardTitle level={3} id={`${handle.id}-title`}>
              Bar Chart - Interactive
            </CardTitle>
            <CardDescription>Showing total visitors for the first two weeks of April</CardDescription>
            <div mix={toggleStyles}>
              {(['desktop', 'mobile'] as const).map((key) => (
                <Button
                  key={key}
                  variant={shown === key ? 'secondary' : 'outline'}
                  size="sm"
                  aria-pressed={shown === key ? 'true' : 'false'}
                  data-series={key}
                  mix={on('click', () => {
                    shown = key
                    void handle.update()
                  })}
                >
                  {daysConfig[key].label}: {totals[key].toLocaleString('en-US')}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={daysConfig} mix={tallStyles}>
              <BarChart data={days} margin={{ left: 12, right: 12 }} aria-labelledby={`${handle.id}-title`}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={dayLabel} />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(label) => dayLabel(label)} />} />
                <Bar dataKey={shown} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )
    }
  },
)

const arabicConfig = {
  month: { label: 'الشهر' },
  january: { label: 'يناير' },
  february: { label: 'فبراير' },
  march: { label: 'مارس' },
  april: { label: 'أبريل' },
  may: { label: 'مايو' },
  june: { label: 'يونيو' },
  desktop: { label: 'سطح المكتب', color: 'var(--chart-2)' },
  mobile: { label: 'الجوال', color: 'var(--chart-1)' },
} satisfies ChartConfig

const arabicMonths = months.map((row) => ({ ...row, month: row.month.toLowerCase() }))

/**
 * Right to left: the categories run from right to left with `reversed`, and
 * the config's labels translate the months, the series and the table. The
 * summary is the caller's, in Arabic.
 */
export const ChartRtlExample = clientEntry(import.meta.url, function ChartRtlExample(handle: Handle) {
  return () => (
    <Card dir="rtl" lang="ar" mix={cardStyles}>
      <CardHeader>
        <CardTitle level={3} id={`${handle.id}-title`}>
          مخطط شريطي - متعدد
        </CardTitle>
        <CardDescription>يناير - يونيو 2024</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={arabicConfig} locale="ar-EG">
          <BarChart
            data={arabicMonths}
            aria-labelledby={`${handle.id}-title`}
            summary="زيارات سطح المكتب والجوال لستة أشهر، من يناير إلى يونيو."
            keyboardHint="استخدم مفاتيح الأسهم لقراءة كل قيمة."
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              reversed
              tickFormatter={(value) => arabicConfig[value as keyof typeof arabicConfig]?.label ?? String(value)}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="desktop" radius={4} />
            <Bar dataKey="mobile" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
})

const tooltipPayload = (items: Array<[name: string, value: number, color: string]>): ChartPayloadItem[] =>
  items.map(([name, value, color]) => ({ dataKey: name, name, value, color, payload: {} }))

/**
 * The tooltip's parts on their own: a label, a name, an indicator and a
 * value, with the label hidden or nested, and each indicator style.
 */
export const ChartTooltipExample = clientEntry(import.meta.url, function ChartTooltipExample() {
  return () => (
    <ChartContainer config={{}} mix={tooltipPartsStyles}>
      <div mix={tooltipGridStyles}>
        <ChartTooltipContent
          active
          label="Page Views"
          payload={tooltipPayload([
            ['Desktop', 186, 'var(--chart-1)'],
            ['Mobile', 80, 'var(--chart-2)'],
          ])}
        />
        <ChartTooltipContent
          active
          hideLabel
          indicator="dashed"
          payload={tooltipPayload([
            ['Chrome', 1286, 'var(--chart-3)'],
            ['Firefox', 1000, 'var(--chart-4)'],
          ])}
        />
        <ChartTooltipContent
          active
          label="Page Views"
          indicator="line"
          payload={tooltipPayload([['Desktop', 12486, 'var(--chart-3)']])}
        />
        <ChartTooltipContent active hideLabel payload={tooltipPayload([['Chrome', 1286, 'var(--chart-1)']])} />
      </div>
    </ChartContainer>
  )
})
