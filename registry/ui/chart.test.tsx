import { renderToString } from 'remix/component/server'
import type { RemixNode } from 'remix/component'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, tags, text } from '../../test/html.ts'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ChartCenterLabel,
  ChartContainer,
  ChartError,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  chartStyle,
  curvePath,
  isChartColor,
  Line,
  LineChart,
  niceTicks,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  polarToCartesian,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  sectorPath,
  XAxis,
  YAxis,
} from './chart.tsx'
import type { ChartConfig, Point } from './chart.tsx'

const visits = [
  { month: 'January', desktop: 186, mobile: 80 },
  { month: 'February', desktop: 305, mobile: 200 },
  { month: 'March', desktop: 237, mobile: 120 },
  { month: 'April', desktop: 73, mobile: 190 },
  { month: 'May', desktop: 209, mobile: 130 },
  { month: 'June', desktop: 214, mobile: 140 },
]

const config = {
  month: { label: 'Month' },
  desktop: { label: 'Desktop', color: 'var(--chart-1)' },
  mobile: { label: 'Mobile', theme: { light: '#2563eb', dark: 'oklch(0.7 0.1 250)' } },
} satisfies ChartConfig

function chart(node: RemixNode, chartConfig: ChartConfig = config) {
  return renderToString(<ChartContainer config={chartConfig}>{node}</ChartContainer>)
}

/** Reads the numbers of an SVG path. */
function numbers(d: string) {
  return [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map(([value]) => Number(value))
}

function paths(html: string, slot: string) {
  return tags(html, 'path').filter((tag) => tag.attributes.get('data-slot') === slot || tag.attributes.has(slot))
}

/** The points a path of moves, lines, arcs and horizontal and vertical lines visits. */
function vertices(d: string) {
  let points: Array<[number, number]> = []
  let [x, y] = [0, 0]
  for (let [command] of d.matchAll(/[MLHVAZ][^MLHVAZ]*/g)) {
    let values = numbers(command.slice(1))
    if (command[0] === 'H') x = values[0]
    else if (command[0] === 'V') y = values[0]
    else if (command[0] === 'Z') continue
    else [x, y] = values.slice(-2)
    points.push([x, y])
  }
  return points
}

/** The bars of a series, as rectangles read from their paths. */
function bars(html: string, key: string) {
  let start = html.indexOf(`data-key="${key}"`)
  assert.ok(start >= 0, `no series ${key}`)
  let end = html.indexOf('</g>', start)
  return tags(html.slice(start, end), 'path').map((tag) => {
    let points = vertices(tag.attributes.get('d') ?? '')
    let xs = points.map(([x]) => x)
    let ys = points.map(([, y]) => y)
    return {
      left: Math.min(...xs),
      right: Math.max(...xs),
      top: Math.min(...ys),
      bottom: Math.max(...ys),
      negative: tag.attributes.has('data-negative'),
      d: tag.attributes.get('d') ?? '',
    }
  })
}

async function rejectsWith(promise: Promise<unknown>, message: RegExp) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ChartError, `expected a ChartError, got ${String(error)}`)
    assert.match(error.message, message)
    return true
  })
}

const validPath = /^[MLHVCAZ\d\s.,-]*$/

describe('niceTicks', () => {
  it('spans the values with five round ticks from zero', () => {
    assert.deepEqual(niceTicks(0, 305), [0, 80, 160, 240, 320])
    assert.deepEqual(niceTicks(0, 1260), [0, 400, 800, 1200, 1600])
    assert.deepEqual(niceTicks(0, 12486), [0, 4000, 8000, 12000, 16000])
  })

  it('reaches below zero for negative values and keeps zero a tick', () => {
    let ticks = niceTicks(-50, 300)
    assert.ok(ticks[0] <= -50 && ticks[ticks.length - 1] >= 300)
    assert.ok(ticks.includes(0))
    assert.deepEqual(niceTicks(-50, 0), [-60, -45, -30, -15, 0])
  })

  it('gives an empty range a unit and takes another count', () => {
    assert.deepEqual(niceTicks(0, 0), [0, 0.25, 0.5, 0.75, 1])
    assert.deepEqual(niceTicks(0, 10, 3), [0, 5, 10])
    assert.deepEqual(niceTicks(0, 10, 2), [0, 10])
    assert.deepEqual(niceTicks(-1, 10, 2), [-10, 0, 10], 'zero between needs a third tick')
    assert.deepEqual(niceTicks(0, 0.3), [0, 0.08, 0.16, 0.24, 0.32])
  })

  it('refuses ranges that are not finite', () => {
    assert.throws(() => niceTicks(0, Number.NaN), ChartError)
    assert.throws(() => niceTicks(-Infinity, 1), ChartError)
  })

  it('throws, and returns at once, for finite ranges whose span or ticks a number can’t hold', () => {
    let started = performance.now()
    for (let [min, max] of [
      [-1e308, 1e308],
      [0, Number.MIN_VALUE],
      [0, 1e-310],
      [0, 1.7e308],
    ]) {
      assert.throws(() => niceTicks(min, max), /can't divide/, `${min} to ${max}`)
    }
    assert.ok(performance.now() - started < 100)
    assert.deepEqual(niceTicks(0, 1e308), [0, 2.5e307, 5e307, 7.5e307, 1e308])
    assert.deepEqual(niceTicks(0, 3e-300, 4), [0, 1e-300, 2e-300, 3e-300])
  })
})

describe('curvePath', () => {
  let points: Point[] = [
    [0, 100],
    [50, 20],
    [100, 60],
    [150, 60],
    [200, 0],
  ]

  it('draws straight lines, steps and nothing for no points', () => {
    assert.equal(curvePath(points.slice(0, 3)), 'M0,100L50,20L100,60')
    assert.equal(curvePath(points.slice(0, 2), 'step'), 'M0,100H25V20H50')
    assert.equal(curvePath([[10, 20]], 'monotone'), 'M10,20')
    assert.equal(curvePath([]), '')
  })

  it('keeps a monotone curve between its neighbors, so it never overshoots a value', () => {
    let d = curvePath(points, 'monotone')
    assert.match(d, validPath)
    let segments = d.split('C').slice(1).map(numbers)
    segments.forEach(([, c1y, , c2y, , y], index) => {
      let y0 = points[index][1]
      let [low, high] = [Math.min(y0, y), Math.max(y0, y)]
      assert.ok(c1y >= low - 0.01 && c1y <= high + 0.01, `segment ${index} overshoots: ${c1y}`)
      assert.ok(c2y >= low - 0.01 && c2y <= high + 0.01, `segment ${index} overshoots: ${c2y}`)
    })
    // Flat between equal values.
    let [, flatY1, , flatY2] = segments[2]
    assert.equal(flatY1, 60)
    assert.equal(flatY2, 60)
  })

  it('passes a natural spline through every point', () => {
    let d = curvePath(points, 'natural')
    assert.match(d, validPath)
    let ends = d
      .split('C')
      .slice(1)
      .map((segment) => numbers(segment).slice(4))
    assert.deepEqual(
      ends,
      points.slice(1).map(([x, y]) => [x, y]),
    )
  })

  it('falls back to straight lines where points share an x, as in a chart with no width', () => {
    let d = curvePath(
      [
        [0, 10],
        [0, 20],
        [0, 5],
      ],
      'natural',
    )
    assert.equal(d, 'M0,10L0,20L0,5')
  })
})

describe('sectorPath', () => {
  it('draws a slice to the center, a donut sector, and a full ring', () => {
    let slice = sectorPath(100, 100, 0, 50, 0, 90)
    assert.equal(slice, 'M150,100A50,50 0 0 0 100,50L100,100Z')
    let sector = sectorPath(100, 100, 25, 50, 0, 270)
    assert.match(sector, /^M150,100A50,50 0 1 0 100,150L100,125A25,25 0 1 1 125,100Z$/)
    let ring = sectorPath(100, 100, 25, 50, 0, 360)
    assert.equal((ring.match(/A/g) ?? []).length, 4)
    assert.equal(sectorPath(100, 100, 0, 50, 30, 30), '')
    assert.equal(sectorPath(100, 100, 0, 0, 0, 90), '')
  })

  it('places angles counterclockwise from three o’clock, as Recharts does', () => {
    let round = (value: number) => Math.round(value) + 0
    assert.deepEqual(polarToCartesian(0, 0, 10, 90).map(round), [0, -10])
    assert.deepEqual(polarToCartesian(0, 0, 10, 180).map(round), [-10, 0])
  })
})

describe('chart colors and styles', () => {
  it('accepts hex, named and function colors, variables, mixes and light-dark pairs', () => {
    for (let color of [
      '#2563eb',
      'rebeccapurple',
      'var(--chart-1)',
      'var(--chart-1, #000)',
      'oklch(0.6 0.2 250 / 50%)',
      'hsl(220, 98%, 61%)',
      'color-mix(in oklab, var(--chart-2) 40%, transparent)',
      'light-dark(#fff, oklch(0.2 0 0))',
    ]) {
      assert.ok(isChartColor(color), color)
    }
  })

  it('refuses anything that could end a declaration, load a file or run script', () => {
    for (let color of [
      'red; background: url(https://example.com/x)',
      'url(https://example.com/x.svg#a)',
      'image(red)',
      'expression(alert(1))',
      'red}body{color:red',
      '"red"',
      '</style><script>',
      'var(--x))',
      'rgb(1, 2, 3',
      '',
    ]) {
      assert.ok(!isChartColor(color), color)
    }
  })

  it('writes one CSS variable per colored key, with light-dark for a theme', () => {
    assert.deepEqual(chartStyle(config), {
      '--color-desktop': 'var(--chart-1)',
      '--color-mobile': 'light-dark(#2563eb, oklch(0.7 0.1 250))',
    })
  })

  it('throws a ChartError for a key or color it could not write safely', () => {
    assert.throws(() => chartStyle({ 'desk top': { label: 'Desktop' } }), /only letters, digits/)
    assert.throws(() => chartStyle({ desktop: { color: 'red; display: none' } }), ChartError)
    assert.throws(
      () => chartStyle({ desktop: { theme: { light: '#fff', dark: 'url(x)' } } }),
      /dark color of "desktop"/,
    )
  })
})

describe('ChartContainer on the server', () => {
  it('sets the colors as CSS variables on its box, keeps a caller id and style, and names the chart for its styles', async () => {
    let html = await renderToString(
      <ChartContainer config={config} id="visits" style={{ maxHeight: '250px' }}>
        <BarChart data={visits}>
          <Bar dataKey="desktop" />
        </BarChart>
      </ChartContainer>,
    )
    let box = attributes(html, 'slot:chart')
    assert.equal(box.get('data-chart'), 'chart-visits')
    assert.equal(box.get('id'), 'visits')
    assert.match(box.get('style') ?? '', /--color-desktop: var\(--chart-1\)/)
    assert.match(box.get('style') ?? '', /--color-mobile: light-dark\(#2563eb, oklch\(0\.7 0\.1 250\)\)/)
    assert.match(box.get('style') ?? '', /max-height: 250px/)
  })

  it('fails with a ChartError for a color that could inject CSS, before anything renders', async () => {
    await rejectsWith(
      chart(
        <BarChart data={visits}>
          <Bar dataKey="desktop" />
        </BarChart>,
        { desktop: { color: 'red;background:url(//example.com)' } },
      ),
      /color of "desktop" must be a CSS color/,
    )
  })
})

describe('BarChart on the server', () => {
  let barChart = (
    <BarChart data={visits}>
      <CartesianGrid vertical={false} />
      <XAxis
        dataKey="month"
        tickLine={false}
        tickMargin={10}
        axisLine={false}
        tickFormatter={(value) => String(value).slice(0, 3)}
      />
      <Bar dataKey="desktop" radius={4} />
      <Bar dataKey="mobile" radius={4} />
      <ChartTooltip content={<ChartTooltipContent indicator="dashed" />} />
      <ChartLegend content={<ChartLegendContent />} />
    </BarChart>
  )

  it('draws every bar at the initial dimension, scaled to fit, before it measures', async () => {
    let html = await chart(barChart)
    let svg = attributes(html, 'svg')
    assert.equal(svg.get('viewBox'), '0 0 320 200')
    assert.equal(svg.get('width'), '100%')
    assert.equal(svg.get('aria-hidden'), 'true')

    let desktop = bars(html, 'desktop')
    let mobile = bars(html, 'mobile')
    assert.equal(desktop.length, 6)
    assert.equal(mobile.length, 6)
    for (let bar of [...desktop, ...mobile]) assert.match(bar.d, validPath)
    // Side by side in each category, desktop first, and taller where the value is larger.
    desktop.forEach((bar, index) => assert.ok(bar.right < mobile[index].left, `category ${index}`))
    assert.ok(desktop[1].top < desktop[0].top, 'February is taller than January')
    // All bars stand on the same baseline.
    assert.equal(new Set([...desktop, ...mobile].map((bar) => bar.bottom)).size, 1)
    // The largest value, 305, under the top tick of 320.
    let baseline = desktop[0].bottom
    let height = baseline - desktop[1].top
    let top = tags(html, 'line')
      .map((tag) => Number(tag.attributes.get('y1')))
      .sort((a, b) => a - b)[0]
    assert.ok(Math.abs(height / (baseline - top) - 305 / 320) < 0.01)
  })

  it('labels the categories with the formatter and draws the grid lines at the value ticks', async () => {
    let html = await chart(barChart)
    let axis = html.slice(html.indexOf('data-slot="chart-x-axis"'))
    assert.deepEqual(tags(axis.slice(0, axis.indexOf('</g></g>') + 8), 'text').length, 6)
    assert.match(text(html), /JanFebMarAprMayJun/)
    let grid = html.slice(
      html.indexOf('data-slot="chart-grid"'),
      html.indexOf('</g>', html.indexOf('data-slot="chart-grid"')),
    )
    assert.equal(tags(grid, 'line').length, 5)
  })

  it('describes the data in a summary and a table for assistive technology, and names the chart', async () => {
    let html = await chart(barChart)
    let surface = attributes(html, 'slot:chart-surface')
    assert.equal(surface.get('role'), 'img')
    assert.equal(surface.get('aria-label'), 'Bar chart')
    assert.ok(!surface.has('tabindex'), 'nothing to inspect before the script runs')
    let summary = attributes(html, 'slot:chart-summary')
    assert.equal(surface.get('aria-describedby'), summary.get('id'))
    assert.match(
      text(html),
      /Bar chart of Desktop and Mobile over 6 categories, from January to June\. Desktop ranges from 73 to 305\. Mobile ranges from 80 to 200\./,
    )

    let table = html.slice(html.indexOf('<table'), html.indexOf('</table>'))
    assert.match(text(table), /^Bar chartMonthDesktopMobileJanuary18680February305200/)
    assert.equal(tags(table, 'th').length, 3 + 6)
    assert.equal(tags(table, 'td').length, 12)
    assert.ok(attributes(html, 'slot:chart-status'), 'a status for the keyboard')
    assert.equal(attributes(html, 'slot:chart-status').get('role'), 'status')
  })

  it('takes the caller’s name, summary and number format', async () => {
    let html = await renderToString(
      <ChartContainer config={config} locale="de-CH">
        <BarChart data={[{ month: 'Januar', desktop: 12486 }]} aria-label="Besuche" summary="Besuche im Januar.">
          <XAxis dataKey="month" />
          <Bar dataKey="desktop" />
        </BarChart>
      </ChartContainer>,
    )
    assert.equal(attributes(html, 'slot:chart-surface').get('aria-label'), 'Besuche')
    assert.match(text(html), /Besuche im Januar\./)
    assert.match(text(html), /12['’]486/, 'Swiss grouping')
  })

  it('lists the legend’s labels from the config, with a swatch for each series', async () => {
    let html = await chart(barChart)
    let legend = html.slice(html.indexOf('<div data-slot="chart-legend"'))
    assert.match(text(legend.slice(0, legend.indexOf('</ul>'))), /^DesktopMobile$/)
    let swatches = tags(legend, 'span').filter((tag) => tag.attributes.get('data-slot') === 'chart-legend-swatch')
    assert.equal(swatches.length, 2)
    assert.match(swatches[0].attributes.get('style') ?? '', /--color-bg: var\(--color-desktop, var\(--chart-1\)\)/)
    assert.equal(swatches[0].attributes.get('aria-hidden'), 'true')
  })

  it('renders no tooltip on the server', async () => {
    let html = await chart(barChart)
    assert.ok(!html.includes('chart-tooltip'))
  })

  it('stacks bars that share a stack id, with negative values below zero', async () => {
    let html = await chart(
      <BarChart
        data={[
          { month: 'January', desktop: 100, mobile: 50 },
          { month: 'February', desktop: -40, mobile: 30 },
        ]}
      >
        <Bar dataKey="desktop" stackId="a" />
        <Bar dataKey="mobile" stackId="a" />
      </BarChart>,
    )
    let desktop = bars(html, 'desktop')
    let mobile = bars(html, 'mobile')
    assert.ok(Math.abs(mobile[0].bottom - desktop[0].top) < 0.02, 'mobile stands on desktop')
    assert.equal(mobile[0].left, desktop[0].left, 'one stack, one slot')
    assert.ok(desktop[1].negative, 'a negative bar hangs down')
    assert.ok(Math.abs(desktop[1].top - mobile[1].bottom) < 0.02, 'from the same zero line the positive bar starts at')
    assert.ok(desktop[1].bottom > desktop[0].bottom, 'below the baseline')
  })

  it('prints each value at the end of its bar, beyond zero on either side, or inside it', async () => {
    let html = await chart(
      <BarChart data={[{ desktop: 120 }, { desktop: -80 }]} valueFormatter={(value) => `${value} k`}>
        <Bar dataKey="desktop" label />
      </BarChart>,
    )
    let labels = tags(html, 'text').filter((tag) => tag.attributes.get('data-slot') === 'chart-bar-label')
    let [up, down] = bars(html, 'desktop')
    assert.equal(labels.length, 2)
    assert.ok(Number(labels[0].attributes.get('y')) < up.top, 'above the positive bar')
    assert.equal(labels[0].attributes.get('dominant-baseline'), 'auto')
    assert.ok(Number(labels[1].attributes.get('y')) > down.bottom, 'below the negative bar')
    assert.equal(labels[1].attributes.get('dominant-baseline'), 'hanging')
    assert.match(text(html), /120 k-80 k/, 'as the tooltip reads them')

    let inside = await chart(
      <BarChart data={[{ desktop: 120 }]}>
        <Bar dataKey="desktop" label={{ position: 'inside', formatter: (value) => `${value}!` }} />
      </BarChart>,
    )
    let label = tags(inside, 'text').find((tag) => tag.attributes.get('data-slot') === 'chart-bar-label')!
    assert.ok(label.attributes.has('data-inside'))
    assert.ok(Number(label.attributes.get('y')) > bars(inside, 'desktop')[0].top)
    assert.match(text(inside), /120!/)
  })

  it('draws nothing for zeros and missing values, and still lists them', async () => {
    let html = await chart(
      <BarChart data={[{ month: 'January', desktop: 0 }, { month: 'February', desktop: null }, { month: 'March' }]}>
        <XAxis dataKey="month" />
        <YAxis />
        <Bar dataKey="desktop" />
      </BarChart>,
    )
    assert.equal(bars(html, 'desktop').length, 0)
    let table = text(html.slice(html.indexOf('<table'), html.indexOf('</table>')))
    assert.match(table, /January0February–March–/)
    assert.match(text(html), /00\.250\.50\.751/, 'an empty range spans 0 to 1')
  })

  it('says when there is no data, and offers no table', async () => {
    let html = await chart(
      <BarChart data={[]} emptyLabel="Keine Daten">
        <XAxis dataKey="month" />
        <Bar dataKey="desktop" />
      </BarChart>,
    )
    assert.match(text(html), /Keine Daten/)
    assert.match(text(html), /Bar chart with no data\./)
    assert.ok(!html.includes('<table'))
    assert.equal(bars(html, 'desktop').length, 0)
  })

  it('reverses the categories for right-to-left text', async () => {
    let html = await chart(
      <BarChart data={visits}>
        <XAxis dataKey="month" reversed />
        <Bar dataKey="desktop" />
      </BarChart>,
    )
    let desktop = bars(html, 'desktop')
    assert.ok(desktop[0].left > desktop[5].left, 'January on the right')
  })

  it('skips category labels that would overlap, keeping the last', async () => {
    let months = Array.from({ length: 24 }, (_, index) => ({ month: `Month number ${index + 1}`, desktop: index }))
    let html = await chart(
      <BarChart data={months}>
        <XAxis dataKey="month" />
        <Bar dataKey="desktop" />
      </BarChart>,
    )
    let labels = text(html.slice(html.indexOf('<g data-slot="chart-x-axis"'), html.indexOf('<g data-slot="chart-bar"')))
    assert.match(labels, /Month number 24$/)
    assert.ok(!labels.includes('Month number 23'))
    assert.ok(labels.length > 0)
  })

  it('gives each chart its own ids, so several on a page keep their descriptions apart', async () => {
    let html = await renderToString(
      <>
        <ChartContainer config={config}>
          <BarChart data={visits}>
            <Bar dataKey="desktop" />
          </BarChart>
        </ChartContainer>
        <ChartContainer config={config}>
          <LineChart data={visits}>
            <Line dataKey="desktop" />
          </LineChart>
        </ChartContainer>
      </>,
    )
    let ids = tags(html, 'p').map((tag) => tag.attributes.get('id'))
    assert.equal(ids.length, 2)
    assert.notEqual(ids[0], ids[1])
    let charts = tags(html, 'div').filter((tag) => tag.attributes.get('data-slot') === 'chart')
    assert.notEqual(charts[0].attributes.get('data-chart'), charts[1].attributes.get('data-chart'))
  })

  it('writes labels from the data and config as text, never as markup', async () => {
    let html = await chart(
      <BarChart data={[{ month: '<img src=x onerror=alert(1)>', desktop: 1 }]}>
        <XAxis dataKey="month" />
        <Bar dataKey="desktop" />
      </BarChart>,
      { desktop: { label: '</table><script>alert(1)</script>' } },
    )
    assert.ok(!html.includes('<script>'))
    assert.ok(!html.includes('<img'))
    assert.match(text(html), /<img src=x onerror=alert\(1\)>/)
  })
})

describe('chart data checks', () => {
  it('throws a ChartError for values whose range overflows, instead of hanging the render', async () => {
    let started = performance.now()
    await rejectsWith(
      chart(
        <BarChart data={[{ desktop: -1e308 }, { desktop: 1e308 }]}>
          <Bar dataKey="desktop" />
        </BarChart>,
      ),
      /can't divide/,
    )
    await rejectsWith(
      chart(
        <BarChart data={[{ desktop: 1e308, mobile: 1e308 }]}>
          <Bar dataKey="desktop" stackId="a" />
          <Bar dataKey="mobile" stackId="a" />
        </BarChart>,
      ),
      /finite/,
    )
    await rejectsWith(
      chart(
        <BarChart data={visits}>
          <YAxis domain={[-1e308, 1e308]} />
          <Bar dataKey="desktop" />
        </BarChart>,
      ),
      /can't divide/,
    )
    assert.ok(performance.now() - started < 1000)
  })

  let barOf = (data: unknown, key = 'desktop') => (
    <BarChart data={data as object[]}>
      <Bar dataKey={key} />
    </BarChart>
  )

  it('throws a ChartError naming the row for a value that is not a finite number', async () => {
    await rejectsWith(
      chart(barOf([{ desktop: 1 }, { desktop: Number.NaN }])),
      /"desktop" in row 2 must be a finite number/,
    )
    await rejectsWith(chart(barOf([{ desktop: Infinity }])), /row 1/)
    await rejectsWith(chart(barOf([{ desktop: '186' }])), /not "186"/)
  })

  it('throws for data that is not rows, keys it could not name and series that share a key', async () => {
    await rejectsWith(chart(barOf('rows')), /needs data as an array of rows/)
    await rejectsWith(chart(barOf([1, 2])), /Row 1 of the chart data must be an object/)
    await rejectsWith(chart(barOf([{ 'desk top': 1 }], 'desk top')), /only letters, digits/)
    await rejectsWith(
      chart(
        <BarChart data={visits}>
          <Bar dataKey="desktop" />
          <Line dataKey="desktop" />
        </BarChart>,
      ),
      /share the dataKey "desktop"/,
    )
  })

  it('refuses negative values where the chart draws from zero up', async () => {
    await rejectsWith(
      chart(
        <PieChart>
          <Pie
            data={[
              { name: 'a', value: 3 },
              { name: 'b', value: -1 },
            ]}
            dataKey="value"
          />
        </PieChart>,
      ),
      /A pie chart draws values from 0 up, so "value" in row 2 can't be -1/,
    )
    await rejectsWith(
      chart(
        <RadarChart data={[{ month: 'a', desktop: -2 }]}>
          <Radar dataKey="desktop" />
        </RadarChart>,
      ),
      /A radar chart/,
    )
    await rejectsWith(
      chart(
        <RadialBarChart data={[{ name: 'a', visitors: -2 }]}>
          <RadialBar dataKey="visitors" />
        </RadialBarChart>,
      ),
      /A radial bar chart/,
    )
  })

  it('throws for a color in the data or a prop that it could not write safely', async () => {
    await rejectsWith(
      chart(
        <PieChart>
          <Pie data={[{ name: 'a', value: 3, fill: 'url(https://example.com/a)' }]} dataKey="value" />
        </PieChart>,
      ),
      /must be a CSS color/,
    )
    await rejectsWith(
      chart(
        <BarChart data={visits}>
          <Bar dataKey="desktop" fill="red;}" />
        </BarChart>,
      ),
      /must be a CSS color/,
    )
  })
})

describe('LineChart and AreaChart on the server', () => {
  it('runs a line from edge to edge through every value, and breaks it at a missing one', async () => {
    let html = await chart(
      <LineChart
        data={[{ desktop: 1 }, { desktop: 3 }, { desktop: null }, { desktop: 2 }, { desktop: 4 }]}
        margin={{ left: 12, right: 12 }}
      >
        <Line dataKey="desktop" type="monotone" strokeWidth={2} dot={false} />
      </LineChart>,
    )
    let lines = tags(html, 'path').filter((tag) => tag.attributes.get('fill') === 'none')
    assert.equal(lines.length, 2, 'two segments around the gap')
    let [first, second] = lines.map((tag) => numbers(tag.attributes.get('d') ?? ''))
    assert.equal(first[0], 12, 'starts at the left margin')
    assert.equal(second[second.length - 2], 320 - 12, 'ends at the right margin')
    assert.equal(lines[0].attributes.get('stroke-width'), '2')
    assert.equal(lines[0].attributes.get('stroke'), 'var(--color-desktop, var(--chart-1))')
    assert.equal(tags(html, 'circle').length, 0, 'no dots')
  })

  it('draws a dot at each value unless told otherwise', async () => {
    let html = await chart(
      <LineChart data={visits}>
        <Line dataKey="desktop" />
        <Line dataKey="mobile" dot={false} />
      </LineChart>,
    )
    assert.equal(tags(html, 'circle').length, 6)
  })

  it('stacks areas on the series below, closing each down to its base', async () => {
    let html = await chart(
      <AreaChart data={visits}>
        <XAxis dataKey="month" />
        <Area dataKey="mobile" stackId="a" type="natural" />
        <Area dataKey="desktop" stackId="a" type="natural" fillOpacity={0.4} />
      </AreaChart>,
    )
    let fills = paths(html, 'chart-area-fill')
    assert.equal(fills.length, 2)
    for (let fill of fills) assert.match(fill.attributes.get('d') ?? '', /^M[^M]*Z$/)
    assert.equal(fills[1].attributes.get('fill-opacity'), '0.4')
    // The desktop area's base is the mobile area's top.
    let mobileTop = numbers(fills[0].attributes.get('d') ?? '').slice(0, 2)
    let desktopFill = numbers(fills[1].attributes.get('d') ?? '')
    assert.deepEqual(desktopFill.slice(-2), mobileTop)
  })

  it('reaches below zero for negative values, with the area closed at zero', async () => {
    let html = await chart(
      <AreaChart data={[{ desktop: -20 }, { desktop: 40 }]}>
        <YAxis />
        <Area dataKey="desktop" />
      </AreaChart>,
    )
    assert.match(text(html), /-\d+/, 'a negative tick')
    let fill = numbers(paths(html, 'chart-area-fill')[0].attributes.get('d') ?? '')
    assert.equal(fill.length, 8)
  })
})

describe('PieChart on the server', () => {
  let browsers = [
    { browser: 'chrome', visitors: 275, fill: 'var(--color-chrome)' },
    { browser: 'safari', visitors: 200, fill: 'var(--color-safari)' },
    { browser: 'firefox', visitors: 287, fill: 'var(--color-firefox)' },
  ]
  let pieConfig = {
    visitors: { label: 'Visitors' },
    chrome: { label: 'Chrome', color: 'var(--chart-1)' },
    safari: { label: 'Safari', color: 'var(--chart-2)' },
    firefox: { label: 'Firefox', color: 'var(--chart-3)' },
  } satisfies ChartConfig

  it('draws a slice per row, sized by its share, with the center label', async () => {
    let html = await chart(
      <PieChart>
        <Pie data={browsers} dataKey="visitors" nameKey="browser" innerRadius={60} />
        <ChartCenterLabel value="762" caption="Visitors" />
      </PieChart>,
      pieConfig,
    )
    let slices = tags(html, 'path').filter((tag) => tag.attributes.has('data-index'))
    assert.equal(slices.length, 3)
    assert.deepEqual(
      slices.map((tag) => tag.attributes.get('fill')),
      ['var(--color-chrome)', 'var(--color-safari)', 'var(--color-firefox)'],
    )
    for (let slice of slices) assert.match(slice.attributes.get('d') ?? '', validPath)
    assert.match(text(html), /762Visitors/)
    assert.match(text(html), /Pie chart with 3 slices: Chrome 275, Safari 200 and Firefox 287\./)
    let table = text(html.slice(html.indexOf('<table'), html.indexOf('</table>')))
    assert.match(table, /browserVisitorsChrome275Safari200Firefox287/)
  })

  it('shares out values whose sum a number can’t hold', async () => {
    let html = await chart(
      <PieChart>
        <Pie
          data={[
            { name: 'a', value: 1e308 },
            { name: 'b', value: 1e308 },
            { name: 'c', value: 0 },
          ]}
          dataKey="value"
        />
      </PieChart>,
    )
    let slices = tags(html, 'path').filter((tag) => tag.attributes.has('data-index'))
    assert.equal(slices.length, 2, 'both positive slices, and none for zero')
    // Each takes half: a slice from three o'clock to nine o'clock, through twelve.
    let points = vertices(slices[0].attributes.get('d') ?? '')
    assert.deepEqual(points[1].map(Math.round), [Math.round(160 - 76), 100])
    assert.equal(paths(html, 'chart-pie-empty').length, 0)
  })

  it('draws an empty track when every slice is zero', async () => {
    let html = await chart(
      <PieChart>
        <Pie data={browsers.map((row) => ({ ...row, visitors: 0 }))} dataKey="visitors" nameKey="browser" />
      </PieChart>,
      pieConfig,
    )
    assert.equal(paths(html, 'chart-pie-empty').length, 1)
    assert.equal(tags(html, 'path').filter((tag) => tag.attributes.has('data-index')).length, 0)
  })
})

describe('RadarChart and RadialBarChart on the server', () => {
  it('draws a polygon per series through the spokes, with rings at the value ticks', async () => {
    let html = await chart(
      <RadarChart data={visits}>
        <PolarAngleAxis dataKey="month" />
        <PolarGrid />
        <Radar dataKey="desktop" fillOpacity={0.6} />
        <Radar dataKey="mobile" />
      </RadarChart>,
    )
    let shapes = paths(html, 'chart-radar-shape')
    assert.equal(shapes.length, 2)
    assert.equal(numbers(shapes[0].attributes.get('d') ?? '').length, 12, 'six vertices')
    assert.equal(shapes[0].attributes.get('fill-opacity'), '0.6')
    assert.equal(paths(html, 'chart-polar-grid-ring').length, 4, 'rings at 80, 160, 240 and 320')
    assert.match(text(html), /JanuaryFebruaryMarchAprilMayJune/)
  })

  it('draws a ring per row along its value’s angle, the largest to the end angle, over a track', async () => {
    let html = await chart(
      <RadialBarChart
        data={[
          { browser: 'safari', visitors: 1260 },
          { browser: 'chrome', visitors: 630 },
        ]}
        startAngle={0}
        endAngle={180}
        innerRadius={40}
        outerRadius={80}
      >
        <PolarGrid
          gridType="circle"
          radialLines={false}
          polarRadius={[86, 74]}
          fill={['var(--muted)', 'var(--card)']}
          stroke="none"
        />
        <RadialBar dataKey="visitors" nameKey="browser" background />
        <ChartCenterLabel value="1,890" caption="Visitors" size="lg" />
      </RadialBarChart>,
      { safari: { label: 'Safari', color: 'var(--chart-2)' } },
    )
    let rings = tags(html, 'path').filter((tag) => tag.attributes.has('data-index'))
    assert.equal(rings.length, 2)
    // Safari ends at 180°, on the left of the center; Chrome at 90°, above it.
    let [safariEnd] = [numbers(rings[0].attributes.get('d') ?? '')]
    let center = 160
    assert.ok(safariEnd[7] < center, 'safari reaches the left')
    assert.equal(paths(html, 'chart-radial-track').length, 2)
    let grid = paths(html, 'chart-polar-grid-ring')
    assert.deepEqual(
      grid.map((tag) => tag.attributes.get('fill')),
      ['var(--muted)', 'var(--card)'],
    )
    assert.equal(rings[0].attributes.get('fill'), 'var(--color-safari, var(--chart-1))')
  })
})

describe('ChartTooltipContent and ChartLegendContent on the server', () => {
  let browsers = [
    { browser: 'chrome', visitors: 187, fill: 'var(--color-chrome)' },
    { browser: 'safari', visitors: 200, fill: 'var(--color-safari)' },
  ]
  let browserConfig = {
    visitors: { label: 'Total Visitors' },
    chrome: { label: 'Chrome', color: 'var(--chart-1)' },
    safari: { label: 'Safari', color: 'var(--chart-2)' },
  } satisfies ChartConfig
  let items = browsers.map((row) => ({
    dataKey: 'visitors',
    name: row.browser,
    value: row.visitors,
    color: row.fill,
    payload: row,
  }))

  it('takes the label and names from the config through labelKey and nameKey, as shadcn documents', async () => {
    let html = await chart(
      <ChartTooltipContent active payload={items} labelKey="visitors" nameKey="browser" />,
      browserConfig,
    )
    assert.equal(text(html), 'Total VisitorsChrome187Safari200')
  })

  it('reads a category label from the config, formats it and the values, or hides the label', async () => {
    let row = [{ dataKey: 'desktop', name: 'desktop', value: 1234.5, color: 'red', payload: {} }]
    assert.equal(text(await chart(<ChartTooltipContent active label="month" payload={row} />)), 'MonthDesktop1,234.5')
    assert.equal(
      text(
        await chart(
          <ChartTooltipContent
            active
            label="January"
            payload={row}
            labelFormatter={(label) => `In ${label}`}
            formatter={(value, name) => `${name}=${value}`}
          />,
        ),
      ),
      'In Januarydesktop=1234.5',
    )
    assert.equal(
      text(await chart(<ChartTooltipContent active hideLabel label="January" payload={row} />)),
      'Desktop1,234.5',
    )
    assert.equal(await chart(<ChartTooltipContent active={false} label="January" payload={row} />).then(text), '')
  })

  it('draws each indicator, nests the label beside one value, and hides the indicator on request', async () => {
    let row = [{ dataKey: 'desktop', name: 'desktop', value: 1, color: 'red', payload: {} }]
    for (let indicator of ['dot', 'line', 'dashed'] as const) {
      let html = await chart(<ChartTooltipContent active label="January" payload={row} indicator={indicator} />)
      let swatch = attributes(html, 'slot:chart-tooltip-indicator')
      assert.equal(swatch.get('data-indicator'), indicator)
      assert.equal(swatch.has('data-nested'), indicator !== 'dot', indicator)
      assert.match(swatch.get('style') ?? '', /--color-bg: red/)
    }
    let hidden = await chart(<ChartTooltipContent active hideIndicator label="January" payload={row} />)
    assert.ok(!hidden.includes('chart-tooltip-indicator'))
    let one = await chart(<ChartTooltipContent active color="var(--chart-5)" label="January" payload={row} />)
    assert.match(attributes(one, 'slot:chart-tooltip-indicator').get('style') ?? '', /--color-bg: var\(--chart-5\)/)
    await rejectsWith(chart(<ChartTooltipContent active color="red;" payload={row} />), /tooltip color/)
    let injected = [{ ...row[0], color: 'red; background: url(https://example.com/x)' }]
    await rejectsWith(
      chart(<ChartTooltipContent active payload={injected} />),
      /color of "desktop" must be a CSS color/,
    )
    await rejectsWith(chart(<ChartLegendContent payload={injected} />), /color of "desktop" must be a CSS color/)
  })

  it('shows a config icon in place of the swatch, unless the legend hides it', async () => {
    function MonitorIcon() {
      return () => <svg data-icon-test="monitor" aria-hidden="true" />
    }
    let iconConfig = { desktop: { label: 'Desktop', icon: MonitorIcon, color: 'red' } } satisfies ChartConfig
    let row = [{ dataKey: 'desktop', name: 'desktop', value: 1, color: 'red', payload: {} }]
    assert.match(await chart(<ChartTooltipContent active payload={row} />, iconConfig), /data-icon-test="monitor"/)
    assert.match(await chart(<ChartLegendContent payload={row} />, iconConfig), /data-icon-test="monitor"/)
    assert.ok(!(await chart(<ChartLegendContent hideIcon payload={row} />, iconConfig)).includes('data-icon-test'))
  })

  it('names pie legend items from the config by the slice names', async () => {
    let html = await chart(
      <PieChart>
        <Pie data={browsers} dataKey="visitors" nameKey="browser" />
        <ChartLegend content={<ChartLegendContent nameKey="browser" />} />
      </PieChart>,
      browserConfig,
    )
    let legend = html.slice(html.indexOf('<div data-slot="chart-legend"'))
    assert.match(text(legend.slice(0, legend.indexOf('</ul>'))), /^ChromeSafari$/)
  })
})

describe('chart text and sizes on the server', () => {
  it('formats the table and summary with valueFormatter', async () => {
    let html = await chart(
      <BarChart data={visits.slice(0, 2)} valueFormatter={(value, key) => `${key}:${value.toFixed(1)}`}>
        <XAxis dataKey="month" />
        <Bar dataKey="desktop" />
      </BarChart>,
    )
    let table = text(html.slice(html.indexOf('<table'), html.indexOf('</table>')))
    assert.match(table, /Januarydesktop:186\.0/)
    assert.match(text(html), /ranges from desktop:186\.0 to desktop:305\.0/)
  })

  it('shrinks radii in pixels that don’t fit, keeping a ring for a donut', async () => {
    let html = await renderToString(
      <ChartContainer config={{}} initialDimension={{ width: 100, height: 100 }}>
        <PieChart>
          <Pie data={[{ name: 'a', value: 1 }]} dataKey="value" innerRadius={60} outerRadius={120} />
        </PieChart>
      </ChartContainer>,
    )
    let slice = tags(html, 'path').find((tag) => tag.attributes.has('data-index'))!
    let points = vertices(slice.attributes.get('d') ?? '')
    let radii = points.map(([x, y]) => Math.round(Math.hypot(x - 50, y - 50)))
    assert.deepEqual(
      [...new Set(radii)].sort((a, b) => a - b),
      [23, 45],
      'scaled by 45/120',
    )

    let tight = await renderToString(
      <ChartContainer config={{}} initialDimension={{ width: 100, height: 100 }}>
        <PieChart>
          <Pie data={[{ name: 'a', value: 1 }]} dataKey="value" innerRadius={60} />
        </PieChart>
      </ChartContainer>,
    )
    let ring = tags(tight, 'path').find((tag) => tag.attributes.has('data-index'))!
    let ringRadii = vertices(ring.attributes.get('d') ?? '').map(([x, y]) => Math.round(Math.hypot(x - 50, y - 50)))
    assert.deepEqual(
      [...new Set(ringRadii)].sort((a, b) => a - b),
      [22, 36],
      'a ring of 40% of the outer radius',
    )
  })
})
