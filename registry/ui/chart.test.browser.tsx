import { css, on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import {
  Bar,
  BarChart,
  CartesianGrid,
  ChartContainer,
  ChartLegend,
  ChartTooltip,
  ChartTooltipContent,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  XAxis,
} from './chart.tsx'
import type { ChartConfig } from './chart.tsx'

const visits = [
  { month: 'January', desktop: 186, mobile: 80 },
  { month: 'February', desktop: 305, mobile: 200 },
  { month: 'March', desktop: 237, mobile: 120 },
  { month: 'April', desktop: 73, mobile: 190 },
]

const config = {
  month: { label: 'Month' },
  desktop: { label: 'Desktop', color: 'rgb(10, 20, 30)' },
  mobile: { label: 'Mobile', theme: { light: 'rgb(200, 0, 0)', dark: 'rgb(0, 0, 200)' } },
} satisfies ChartConfig

// Browser tests run without theme.css, so the box sets the tokens the chart reads.
const boxStyles = (width: number) =>
  css({
    width: `${width}px`,
    '--chart-1': 'rgb(1, 1, 1)',
    '--chart-2': 'rgb(2, 2, 2)',
    '--muted': 'rgb(240, 240, 240)',
    '--foreground': 'rgb(0, 0, 0)',
    '--background': 'rgb(255, 255, 255)',
    fontSize: '16px',
  })

function Box(handle: Handle<{ width?: number; children?: RemixNode }>) {
  return () => <div mix={boxStyles(handle.props.width ?? 400)}>{handle.props.children}</div>
}

function mount(t: TestContext, node: RemixNode, width = 400) {
  let result = render(<Box width={width}>{node}</Box>)
  t.after(result.cleanup)
  return result
}

/** Waits for the chart's first browser render, its measurement, and the frame after. */
async function settle() {
  for (let index = 0; index < 3; index++) {
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))
  }
}

function surfaceOf(container: HTMLElement, index = 0) {
  let surface = container.querySelectorAll<HTMLElement>('[data-slot="chart-surface"]')[index]
  assert.ok(surface, 'no chart surface')
  return surface
}

/** Moves a pointer to a fraction of the surface's width and height. */
function pointAt(surface: HTMLElement, x: number, y: number, type = 'pointermove', pointerType = 'mouse') {
  let rect = surface.getBoundingClientRect()
  surface.dispatchEvent(
    new PointerEvent(type, {
      bubbles: type !== 'pointerleave',
      cancelable: true,
      pointerId: pointerType === 'touch' ? 2 : 1,
      isPrimary: true,
      pointerType,
      clientX: rect.left + rect.width * x,
      clientY: rect.top + rect.height * y,
    }),
  )
}

/** Moves a pointer to a point of the page, as the events of a real move land on the element under it. */
function moveTo(target: Element, x: number, y: number) {
  target.dispatchEvent(
    new PointerEvent('pointermove', {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      isPrimary: true,
      pointerType: 'mouse',
      clientX: x,
      clientY: y,
    }),
  )
}

/** Moves a pointer in steps along a straight line, as a person's hand does. */
async function glide(surface: HTMLElement, from: { x: number; y: number }, to: { x: number; y: number }) {
  for (let step = 1; step <= 10; step++) {
    let x = from.x + ((to.x - from.x) * step) / 10
    let y = from.y + ((to.y - from.y) * step) / 10
    let target = document.elementFromPoint(x, y)
    moveTo(target && surface.contains(target) ? target : surface, x, y)
    await settle()
  }
}

function center(element: Element) {
  let rect = element.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

function press(surface: HTMLElement, key: string, init: KeyboardEventInit = {}) {
  let event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  surface.dispatchEvent(event)
  return event
}

function tooltipText(container: HTMLElement, index = 0) {
  let tooltip = container.querySelectorAll<HTMLElement>('[data-slot="chart-tooltip"]')[index]
  return tooltip?.hasAttribute('data-open') ? tooltip.textContent : null
}

function statusText(container: HTMLElement) {
  return container.querySelector('[data-slot="chart-status"]')?.textContent ?? ''
}

function barRects(container: HTMLElement, key: string) {
  return [...container.querySelectorAll<SVGPathElement>(`[data-key="${key}"] path`)].map((path) => path.getBBox())
}

const barChart = (
  <ChartContainer config={config}>
    <BarChart data={visits}>
      <CartesianGrid vertical={false} />
      <XAxis dataKey="month" tickFormatter={(value) => String(value).slice(0, 3)} />
      <ChartTooltip content={<ChartTooltipContent indicator="dashed" />} />
      <Bar dataKey="desktop" radius={4} />
      <Bar dataKey="mobile" radius={4} />
    </BarChart>
  </ChartContainer>
)

describe('Chart in the browser', () => {
  it('measures its box and draws at that size, then again when the box resizes', async (t) => {
    let { container } = mount(t, barChart, 400)
    await settle()
    let svg = container.querySelector('svg')!
    assert.equal(svg.getAttribute('viewBox'), '0 0 400 225')
    let wide = barRects(container, 'desktop')
    assert.equal(wide.length, 4)

    container.querySelector<HTMLElement>('div')!.style.width = '200px'
    await settle()
    assert.equal(svg.getAttribute('viewBox'), '0 0 200 113')
    assert.equal(container.querySelector('svg'), svg, 'drawn again in place')
    let narrow = barRects(container, 'desktop')
    assert.ok(narrow[0].width < wide[0].width / 1.5, 'narrower bars')
    for (let path of container.querySelectorAll('path')) assert.ok(!/NaN|Infinity/.test(path.getAttribute('d') ?? ''))
  })

  it('keeps its last drawing while hidden, without a size of zero', async (t) => {
    let { container } = mount(t, barChart)
    await settle()
    let outer = container.querySelector<HTMLElement>('div')!
    outer.style.display = 'none'
    await settle()
    assert.equal(container.querySelector('svg')!.getAttribute('viewBox'), '0 0 400 225')
    outer.style.display = ''
    await settle()
    assert.equal(barRects(container, 'desktop').length, 4)
  })

  it('shows the row under the pointer, follows it, and closes as it leaves', async (t) => {
    let { container } = mount(t, barChart)
    await settle()
    let surface = surfaceOf(container)
    assert.equal(tooltipText(container), null)

    pointAt(surface, 0.4, 0.5)
    await settle()
    assert.equal(tooltipText(container), 'FebruaryDesktop305Mobile200')
    let cursor = container.querySelector('[data-slot="chart-cursor"]')
    assert.ok(cursor, 'a band behind the row')

    pointAt(surface, 0.9, 0.5)
    await settle()
    assert.equal(tooltipText(container), 'AprilDesktop73Mobile190')
    assert.equal(statusText(container), '', 'the pointer stays quiet')

    pointAt(surface, 0.9, 0.5, 'pointerleave')
    await settle()
    assert.equal(tooltipText(container), null)
    assert.equal(container.querySelector('[data-slot="chart-cursor"]'), null)
  })

  it('keeps a finger’s row after it lifts, until a press elsewhere or focus moves away', async (t) => {
    let { container } = mount(t, barChart)
    await settle()
    let surface = surfaceOf(container)
    let tap = (x: number) => {
      pointAt(surface, x, 0.5, 'pointerdown', 'touch')
      pointAt(surface, x, 0.5, 'pointerleave', 'touch')
    }
    tap(0.1)
    await settle()
    assert.match(tooltipText(container) ?? '', /^January/)
    surface.dispatchEvent(new FocusEvent('blur'))
    await settle()
    assert.equal(tooltipText(container), null)

    tap(0.9)
    await settle()
    assert.match(tooltipText(container) ?? '', /^April/)
    tap(0.9)
    await settle()
    assert.match(tooltipText(container) ?? '', /^April/, 'a press on the row keeps it')
    // A tap elsewhere: the whole press, as the layer counts it.
    for (let type of ['pointerdown', 'pointerup']) {
      document.body.dispatchEvent(
        new PointerEvent(type, { bubbles: true, pointerType: 'touch', clientX: 1, clientY: 1 }),
      )
    }
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1, clientX: 1, clientY: 1 }))
    await settle()
    assert.equal(tooltipText(container), null)
  })

  it('lets Escape close the pointer’s tooltip while focus is elsewhere, until the pointer moves to another row', async (t) => {
    let { container } = mount(t, barChart)
    await settle()
    let surface = surfaceOf(container)
    assert.equal(document.activeElement, document.body)

    pointAt(surface, 0.4, 0.5)
    await settle()
    assert.match(tooltipText(container) ?? '', /^February/)
    let escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    document.body.dispatchEvent(escape)
    await settle()
    assert.ok(escape.defaultPrevented, 'the tooltip took the Escape')
    assert.equal(tooltipText(container), null)
    assert.equal(document.activeElement, document.body, 'focus stays')

    pointAt(surface, 0.42, 0.6)
    await settle()
    assert.equal(tooltipText(container), null, 'a move within February keeps it closed')
    pointAt(surface, 0.6, 0.5)
    await settle()
    assert.match(tooltipText(container) ?? '', /^March/, 'another row opens again')

    pointAt(surface, 0.6, 0.5, 'pointerleave')
    await settle()
    let later = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    document.body.dispatchEvent(later)
    assert.ok(!later.defaultPrevented, 'with nothing shown, Escape is the page’s')
  })

  it('changes the row once the pointer passes the tooltip along the line of its edge', async (t) => {
    let { container } = mount(t, barChart, 600)
    await settle()
    let surface = surfaceOf(container)
    let bounds = surface.getBoundingClientRect()
    pointAt(surface, 0.375, 0.6)
    await settle()
    assert.match(tooltipText(container) ?? '', /^February/)
    let edge = container.querySelector('[data-slot="chart-tooltip"]')!.getBoundingClientRect()
    let february = bounds.left + bounds.width * 0.375
    assert.ok(edge.left > february, 'the tooltip starts right of the pointer')

    // Still on February, level with the tooltip's top edge, then straight across to April, past the tooltip.
    for (let y of [edge.top, edge.bottom]) {
      moveTo(surface, february, y)
      await settle()
      assert.match(tooltipText(container) ?? '', /^February/)
      let april = bounds.left + bounds.width * 0.875
      assert.ok(april > edge.right, 'April lies past the tooltip')
      moveTo(surface, april, y)
      await settle()
      assert.match(tooltipText(container) ?? '', /^April/, `level with y ${y}`)
      pointAt(surface, 0.375, 0.6)
      await settle()
      edge = container.querySelector('[data-slot="chart-tooltip"]')!.getBoundingClientRect()
    }
  })

  it('keeps the row while the pointer moves onto its tooltip, and changes it once the pointer leaves that way', async (t) => {
    let { container } = mount(t, barChart, 600)
    await settle()
    let surface = surfaceOf(container)
    let bounds = surface.getBoundingClientRect()
    pointAt(surface, 0.375, 0.8)
    await settle()
    assert.match(tooltipText(container) ?? '', /^February/)
    let tooltip = container.querySelector<HTMLElement>('[data-slot="chart-tooltip"]')!
    let start = { x: bounds.left + bounds.width * 0.375, y: bounds.top + bounds.height * 0.8 }

    await glide(surface, start, center(tooltip))
    assert.match(tooltipText(container) ?? '', /^February/, 'over the tooltip')
    assert.equal(getComputedStyle(tooltip).pointerEvents, 'auto')

    // Down from the tooltip, below it, into April's band.
    let below = { x: bounds.left + bounds.width * 0.875, y: bounds.top + bounds.height * 0.85 }
    await glide(surface, center(tooltip), below)
    assert.match(tooltipText(container) ?? '', /^April/)
  })

  it('keeps a slice while the pointer crosses the donut’s hole to its tooltip', async (t) => {
    let { container } = mount(
      t,
      <ChartContainer config={{}}>
        <PieChart>
          <ChartTooltip />
          <Pie
            data={[
              { name: 'a', value: 1 },
              { name: 'b', value: 1 },
              { name: 'c', value: 2 },
            ]}
            dataKey="value"
            innerRadius="60%"
          />
        </PieChart>
      </ChartContainer>,
      500,
    )
    await settle()
    let surface = surfaceOf(container)
    let slice = container.querySelector('path[data-index="0"]')!
    let rect = slice.getBoundingClientRect()
    // Slice a runs from three o'clock to twelve: its outer edge at 45°.
    let { x: cx, y: cy } = center(surface)
    let radius = Math.hypot(rect.right - cx, rect.top - cy) * 0.6
    let start = { x: cx + radius * Math.cos(Math.PI / 4), y: cy - radius * Math.sin(Math.PI / 4) }
    moveTo(surface, start.x, start.y)
    await settle()
    assert.equal(tooltipText(container), 'a1')
    await glide(surface, start, center(container.querySelector('[data-slot="chart-tooltip"]')!))
    assert.equal(tooltipText(container), 'a1')
  })

  it('keeps the tooltip inside the chart next to the row', async (t) => {
    let { container } = mount(t, barChart)
    await settle()
    let surface = surfaceOf(container)
    for (let [x, y] of [
      [0.05, 0.75],
      [0.95, 0.75],
      [0.95, 0.05],
    ]) {
      pointAt(surface, x, y)
      await settle()
      let box = container.querySelector<HTMLElement>('[data-slot="chart-tooltip"]')!.getBoundingClientRect()
      let bounds = surface.getBoundingClientRect()
      assert.ok(box.width > 0)
      assert.ok(box.left >= bounds.left - 0.5 && box.right <= bounds.right + 0.5, `inside at ${x}`)
      assert.ok(box.top >= bounds.top - 0.5 && box.bottom <= bounds.bottom + 0.5, `inside at ${x}`)
    }
  })

  it('reads each row with the arrow keys, Home and End, and says it in the status', async (t) => {
    let { container } = mount(t, barChart)
    await settle()
    let surface = surfaceOf(container)
    assert.equal(surface.getAttribute('role'), 'application')
    assert.equal(surface.tabIndex, 0)
    let [summary, hint] = (surface.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((id) => document.getElementById(id))
    assert.match(summary?.textContent ?? '', /^Bar chart of Desktop and Mobile/)
    assert.match(hint?.textContent ?? '', /arrow keys/)

    assert.ok(press(surface, 'ArrowRight').defaultPrevented)
    await settle()
    assert.equal(statusText(container), 'January: Desktop 186, Mobile 80')
    assert.equal(tooltipText(container), 'JanuaryDesktop186Mobile80')
    assert.ok(container.querySelector('[data-slot="chart-surface"][data-keyboard]'))
    assert.equal(container.querySelectorAll('path[data-active]').length, 2, 'both bars of the row are marked')

    press(surface, 'ArrowDown')
    await settle()
    assert.equal(statusText(container), 'February: Desktop 305, Mobile 200')
    press(surface, 'End')
    await settle()
    assert.equal(statusText(container), 'April: Desktop 73, Mobile 190')
    press(surface, 'ArrowRight')
    await settle()
    assert.match(statusText(container), /^April/, 'stays at the end')
    press(surface, 'Home')
    await settle()
    assert.match(statusText(container), /^January/)
    press(surface, 'ArrowLeft')
    await settle()
    assert.match(statusText(container), /^January/, 'stays at the start')

    assert.ok(!press(surface, 'ArrowRight', { ctrlKey: true }).defaultPrevented, 'leaves shortcuts alone')
    assert.ok(!press(surface, 'a').defaultPrevented)

    assert.ok(press(surface, 'Escape').defaultPrevented)
    await settle()
    assert.equal(tooltipText(container), null)
    assert.equal(statusText(container), '')
    assert.ok(!press(surface, 'Escape').defaultPrevented, 'a second Escape is the page’s')
  })

  it('marks the keyboard’s row even when the pointer’s cursor is off', async (t) => {
    let { container } = mount(
      t,
      <ChartContainer config={config}>
        <LineChart data={visits}>
          <ChartTooltip cursor={false} />
          <Line dataKey="desktop" dot={false} />
        </LineChart>
      </ChartContainer>,
    )
    await settle()
    let surface = surfaceOf(container)
    pointAt(surface, 0.5, 0.5)
    await settle()
    assert.equal(container.querySelector('[data-slot="chart-cursor"]'), null, 'no cursor for the pointer')
    assert.ok(container.querySelector('[data-slot="chart-active-dot"]'))
    press(surface, 'ArrowRight')
    await settle()
    assert.ok(container.querySelector('[data-slot="chart-cursor"]'), 'a line for the keyboard')
  })

  it('swaps the arrows along a reversed axis, so each moves to the row on its side', async (t) => {
    let { container } = mount(
      t,
      <ChartContainer config={config}>
        <BarChart data={visits}>
          <XAxis dataKey="month" reversed />
          <Bar dataKey="desktop" />
        </BarChart>
      </ChartContainer>,
    )
    await settle()
    let surface = surfaceOf(container)
    press(surface, 'ArrowLeft')
    await settle()
    assert.match(statusText(container), /^January/, 'January sits on the right')
    press(surface, 'ArrowLeft')
    await settle()
    assert.match(statusText(container), /^February/)
  })

  it('takes new data in place, and forgets a row that no longer exists', async (t) => {
    function Changing(handle: Handle) {
      let rows = visits
      return () => (
        <div>
          <button
            type="button"
            mix={on('click', () => {
              rows = rows.length > 1 ? rows.slice(0, 1) : []
              void handle.update()
            })}
          >
            Change
          </button>
          <ChartContainer config={config}>
            <BarChart data={rows} emptyLabel="Nothing yet">
              <XAxis dataKey="month" />
              <ChartTooltip />
              <Bar dataKey="desktop" />
            </BarChart>
          </ChartContainer>
        </div>
      )
    }
    let { container, act } = mount(t, <Changing />)
    await settle()
    let surface = surfaceOf(container)
    let table = () => container.querySelectorAll('[data-slot="chart-table"] tbody tr').length
    assert.equal(table(), 4)
    press(surface, 'End')
    await settle()
    assert.match(statusText(container), /^April/)

    await act(() => container.querySelector('button')!.click())
    await settle()
    assert.equal(surfaceOf(container), surface, 'the same chart')
    assert.equal(barRects(container, 'desktop').length, 1)
    assert.equal(table(), 1)
    assert.equal(tooltipText(container), null, 'April is gone')
    assert.equal(statusText(container), '')

    await act(() => container.querySelector('button')!.click())
    await settle()
    assert.equal(container.querySelector('[data-slot="chart-empty"]')?.textContent, 'Nothing yet')
    assert.equal(surface.getAttribute('tabindex'), null, 'nothing to inspect')
    assert.equal(surface.getAttribute('role'), 'img')
    assert.equal(table(), 0)
  })

  it('switches theme colors with data-theme on an ancestor, without drawing again', async (t) => {
    let { container } = mount(
      t,
      <div data-theme-box style={{ colorScheme: 'light' }}>
        {barChart}
      </div>,
    )
    await settle()
    let mobile = container.querySelector<SVGPathElement>('[data-key="mobile"] path')!
    assert.equal(getComputedStyle(mobile).fill, 'rgb(200, 0, 0)')
    container.querySelector<HTMLElement>('[data-theme-box]')!.style.colorScheme = 'dark'
    assert.equal(getComputedStyle(mobile).fill, 'rgb(0, 0, 200)')
    assert.equal(getComputedStyle(container.querySelector('[data-key="desktop"] path')!).fill, 'rgb(10, 20, 30)')
  })

  it('hydrates the server’s HTML in place and keeps its descriptions paired', async (t) => {
    let container = document.createElement('div')
    container.innerHTML = (await renderToString(<Box>{barChart}</Box>)).replace(/<head>[\s\S]*?<\/head>/, '')
    document.body.append(container)
    let svg = container.querySelector('svg')!
    assert.equal(svg.getAttribute('viewBox'), '0 0 320 200')
    assert.equal(surfaceOf(container).getAttribute('role'), 'img')

    let { act, cleanup } = render(<Box>{barChart}</Box>, { container })
    t.after(cleanup)
    await act(() => settle())
    await settle()
    assert.equal(container.querySelector('svg'), svg, 'hydrated in place')
    assert.equal(svg.getAttribute('viewBox'), '0 0 400 225')
    let surface = surfaceOf(container)
    assert.equal(surface.getAttribute('role'), 'application')
    for (let id of (surface.getAttribute('aria-describedby') ?? '').split(' ')) {
      assert.ok(document.getElementById(id), `#${id} exists`)
    }
    assert.equal(container.querySelectorAll('[data-slot="chart-summary"]').length, 1)
  })

  it('keeps several charts apart: their ids, rows and tooltips', async (t) => {
    let { container } = mount(
      t,
      <>
        {barChart}
        {barChart}
      </>,
    )
    await settle()
    let ids = [...container.querySelectorAll('[data-slot="chart-summary"]')].map((node) => node.id)
    assert.equal(new Set(ids).size, 2)
    pointAt(surfaceOf(container, 1), 0.1, 0.5)
    await settle()
    assert.equal(tooltipText(container, 0), null)
    assert.match(tooltipText(container, 1) ?? '', /^January/)
  })

  it('shows a row from the start with defaultIndex', async (t) => {
    let { container } = mount(
      t,
      <ChartContainer config={config}>
        <BarChart data={visits}>
          <XAxis dataKey="month" />
          <ChartTooltip defaultIndex={2} />
          <Bar dataKey="desktop" />
        </BarChart>
      </ChartContainer>,
    )
    await settle()
    assert.equal(tooltipText(container), 'MarchDesktop237')
  })

  it('stops watching its size once it is gone', async (t) => {
    let disconnected = 0
    let original = ResizeObserver.prototype.disconnect
    ResizeObserver.prototype.disconnect = function () {
      disconnected++
      return original.call(this)
    }
    t.after(() => {
      ResizeObserver.prototype.disconnect = original
    })
    let { cleanup } = render(<Box>{barChart}</Box>)
    await settle()
    cleanup()
    assert.equal(disconnected, 1)
  })

  it('inspects the slice, ring or spoke under the pointer in polar charts', async (t) => {
    let { container } = mount(
      t,
      <>
        <ChartContainer config={{}}>
          <PieChart>
            <ChartTooltip />
            <Pie
              data={[
                { name: 'a', value: 1 },
                { name: 'b', value: 1 },
              ]}
              dataKey="value"
              innerRadius="50%"
            />
          </PieChart>
        </ChartContainer>
        <ChartContainer config={{}}>
          <RadialBarChart data={[{ name: 'only', value: 5 }]} startAngle={0} endAngle={180}>
            <ChartTooltip />
            <RadialBar dataKey="value" />
          </RadialBarChart>
        </ChartContainer>
        <ChartContainer config={{}}>
          <RadarChart data={visits}>
            <ChartTooltip />
            <PolarAngleAxis dataKey="month" />
            <Radar dataKey="desktop" />
          </RadarChart>
        </ChartContainer>
      </>,
    )
    await settle()
    // The upper half of the donut is slice a, from 0° to 180° counterclockwise; its middle is above the center.
    let [pie, radial, radar] = [0, 1, 2].map((index) => surfaceOf(container, index))
    let ring = (surface: HTMLElement, angle: number, fraction: number) => {
      let rect = surface.getBoundingClientRect()
      let radius = (Math.min(rect.width, rect.height) - 10) / 2
      let x = 0.5 + (Math.cos((angle * Math.PI) / 180) * radius * fraction) / rect.width
      let y = 0.5 - (Math.sin((angle * Math.PI) / 180) * radius * fraction) / rect.height
      pointAt(surface, x, y)
    }
    ring(pie, 90, 0.65)
    await settle()
    assert.equal(tooltipText(container, 0), 'a1')
    ring(pie, 270, 0.65)
    await settle()
    assert.equal(tooltipText(container, 0), 'b1')
    pointAt(pie, 0.5, 0.5)
    await settle()
    assert.equal(tooltipText(container, 0), null, 'the hole holds no slice')

    ring(radial, 90, 0.65)
    await settle()
    assert.equal(tooltipText(container, 1), 'only5')
    ring(radial, 270, 0.65)
    await settle()
    assert.equal(tooltipText(container, 1), null, 'past the ring’s end')

    ring(radar, 90, 0.5)
    await settle()
    assert.match(tooltipText(container, 2) ?? '', /^January/)
  })

  it('wraps long labels inside the chart’s width', async (t) => {
    let long = {
      desktop: { label: 'Arbeitsplatzrechner, Notebooks und andere Geräte mit großem Bildschirm', color: 'red' },
    }
    let { container } = mount(
      t,
      <ChartContainer config={long}>
        <BarChart data={visits}>
          <XAxis dataKey="month" />
          <ChartTooltip />
          <ChartLegend />
          <Bar dataKey="desktop" />
        </BarChart>
      </ChartContainer>,
      240,
    )
    await settle()
    let surface = surfaceOf(container)
    pointAt(surface, 0.5, 0.5)
    await settle()
    let tooltip = container.querySelector<HTMLElement>('[data-slot="chart-tooltip"]')!.getBoundingClientRect()
    let bounds = surface.getBoundingClientRect()
    assert.ok(tooltip.width <= bounds.width + 0.5, 'no wider than the chart')
    let legend = container.querySelector<HTMLElement>('[data-slot="chart-legend"]')!
    assert.ok(legend.scrollWidth <= legend.clientWidth + 1, 'the legend wraps')
  })
})
