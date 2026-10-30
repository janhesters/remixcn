// RemixCN Chart: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css, Fragment, on, ref } from 'remix/component'
import type { Handle, Props, RemixElement, RemixNode } from 'remix/component'

import { computePosition } from '#remixcn/lib/anchor-position.ts'
import { getNextIndex } from '#remixcn/lib/composite.ts'
import { dismissableLayer } from '#remixcn/lib/layer.ts'
import type { DismissRequest } from '#remixcn/lib/layer.ts'
import { mergeStyles, transition, visuallyHidden } from '#remixcn/lib/styles.ts'
import type { Styles } from '#remixcn/lib/styles.ts'

// Charts drawn as native SVG, in place of Recharts. A chart is a root, such as
// BarChart, inside a ChartContainer, with parts as its children, as in shadcn:
// grids, axes and series inside the SVG, and the tooltip and legend as HTML.
// The root reads its children's props during render, so the server draws the
// whole chart, and the parts read the layout from the root.
//
// On the server and until the chart runs in the browser, it draws at the
// container's initial dimension, scaled to fit, and offers its data as a text
// summary and a table that only assistive technology reads. In the browser it
// measures its box and draws at that size, and the pointer or the arrow keys
// inspect each value, as the tooltip shows and a status message says.
//
// The parts run in the browser inside your client entry, like Button. A chart
// outside any client entry stays as the server drew it.

export type ChartTheme = { light: string; dark: string }

/** An icon for a config entry: a component that renders an SVG, such as one drawn with Icon. */
export type ChartIcon = (handle: Handle<any>) => () => RemixNode

export type ChartConfigItem = {
  /** The name people read for the series or category, in the tooltip, the legend and the text alternatives. */
  label?: string
  /** Shows in place of the color swatch in the tooltip and legend. */
  icon?: ChartIcon
} & ({ color?: string; theme?: never } | { color?: never; theme: ChartTheme })

/**
 * The labels, icons and colors of a chart's series and categories, by key.
 * Each color becomes the CSS variable `--color-<key>` on the container. A
 * theme color has a light and a dark value, which `light-dark()` picks by the
 * color scheme, so `data-theme` on any ancestor switches it.
 */
export type ChartConfig = Record<string, ChartConfigItem>

/** The rows a chart draws: one object per category, slice or ring, with a number for each series key. */
export type ChartData = readonly object[]

/** Thrown while rendering a chart whose data or config it can't draw, with what to fix. */
export class ChartError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChartError'
  }
}

function describe(value: unknown) {
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return JSON.stringify(value.length > 40 ? `${value.slice(0, 40)}…` : value)
  if (value === null || value === undefined) return String(value)
  return Array.isArray(value) ? 'an array' : `a ${typeof value}`
}

const keyPattern = /^[\w-]+$/

/** Whether a key may name a series or config entry: letters, digits, `-` and `_`, as a CSS variable name allows. */
export function isChartKey(key: string): boolean {
  return keyPattern.test(key)
}

function checkKey(key: unknown, what: string): string {
  if (typeof key !== 'string' || !isChartKey(key)) {
    throw new ChartError(`${what} ${describe(key)} may hold only letters, digits, "-" and "_".`)
  }
  return key
}

const colorFunctions = new Set([
  'rgb',
  'rgba',
  'hsl',
  'hsla',
  'hwb',
  'lab',
  'lch',
  'oklab',
  'oklch',
  'color',
  'color-mix',
  'light-dark',
  'var',
  'calc',
])

/**
 * Whether a value is a CSS color the chart may write into a style or an SVG
 * attribute: a hex color, a named color, or a color function, `var()`,
 * `color-mix()` or `light-dark()`. Quotes, semicolons, braces, colons and any
 * other function, such as `url()`, are refused, so a value can't end its
 * declaration or load anything.
 */
export function isChartColor(value: string): boolean {
  let color = value.trim()
  if (color === '' || !/^[\w\s#%(),./+*-]+$/.test(color)) return false
  let depth = 0
  for (let [token, name] of color.matchAll(/([\w-]*)\(|\)/g)) {
    if (token === ')') {
      depth--
      if (depth < 0) return false
    } else if (colorFunctions.has(name.toLowerCase())) depth++
    else return false
  }
  return depth === 0
}

function checkColor(value: unknown, what: string): string {
  if (typeof value !== 'string' || !isChartColor(value)) {
    throw new ChartError(
      `${what} must be a CSS color, such as #2563eb, oklch(0.6 0.2 250) or var(--chart-1), not ${describe(value)}.`,
    )
  }
  return value.trim()
}

/**
 * The CSS variables of a config's colors, `--color-<key>`, for a `style`
 * prop. ChartContainer sets them; use it for your own container. It takes the
 * place of shadcn's ChartStyle, which wrote a style element, and checks every
 * key and color first.
 */
export function chartStyle(config: ChartConfig): Record<string, string> {
  let style: Record<string, string> = {}
  for (let [key, item] of Object.entries(config)) {
    checkKey(key, 'The chart config key')
    if (item.theme) {
      let light = checkColor(item.theme.light, `The light color of "${key}"`)
      let dark = checkColor(item.theme.dark, `The dark color of "${key}"`)
      style[`--color-${key}`] = `light-dark(${light}, ${dark})`
    } else if (item.color !== undefined) {
      style[`--color-${key}`] = checkColor(item.color, `The color of "${key}"`)
    }
  }
  return style
}

/** The color of a series or category: its own color, the config's `--color-<key>`, or a chart token by position. */
function seriesColor(key: string | undefined, index: number, own?: string) {
  if (own !== undefined) return checkColor(own, `The color of "${key ?? index}"`)
  let token = `var(--chart-${(index % 5) + 1})`
  return key !== undefined && isChartKey(key) ? `var(--color-${key}, ${token})` : token
}

// ---------------------------------------------------------------------------
// Scales and geometry. Coordinates are SVG user units, which match CSS pixels
// once the chart has measured its box.

const niceSteps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]

function tidy(value: number) {
  let rounded = Number(value.toPrecision(12))
  return Object.is(rounded, -0) ? 0 : rounded
}

/**
 * The ticks of a value axis: `count` evenly spaced round numbers from at or
 * below `min` to at or above `max`, with a step of 1, 1.2, 1.5, 2, 2.5, 3, 4,
 * 5, 6 or 8 times a power of ten. Zero is a tick when the range holds it. An
 * empty range [0, 0] becomes [0, 1].
 */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (![min, max, count].every(Number.isFinite)) throw new ChartError('The axis range must be finite numbers.')
  if (min > max) [min, max] = [max, min]
  let n = Math.max(2, Math.round(count))
  if (min === max) {
    if (min > 0) min = 0
    else if (max < 0) max = 0
    else max = 1
  }
  // Two ticks can't hold zero between them, so a range across zero gets three.
  if (min < 0 && max > 0) n = Math.max(n, 3)
  let rough = (max - min) / (n - 1)
  // A span past the largest number, or a step below the smallest normal one, has no round ticks.
  if (!Number.isFinite(rough) || rough < smallestNormal) throw rangeError(min, max)
  let scale = 10 ** Math.floor(Math.log10(rough))
  // Any step of twice the rough one covers the span, and the second scale offers one.
  for (let attempt = 0; attempt < 2; attempt++, scale *= 10) {
    for (let multiple of niceSteps) {
      let step = tidy(multiple * scale)
      let start = tidy(Math.floor(tidy(min / step)) * step)
      if (tidy(start + step * (n - 1)) < max) continue
      let ticks = Array.from({ length: n }, (_, index) => tidy(start + step * index))
      if (!ticks.every(Number.isFinite)) throw rangeError(min, max)
      return ticks
    }
  }
  throw rangeError(min, max)
}

const smallestNormal = 2 ** -1022

function rangeError(min: number, max: number) {
  return new ChartError(`The axis can't divide the range from ${min} to ${max} into round ticks a number can hold.`)
}

/** Evenly spaced ticks across a fixed domain. */
function spacedTicks([min, max]: [number, number], count: number) {
  let n = Math.max(2, Math.round(count))
  let step = (max - min) / (n - 1)
  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(step)) throw rangeError(min, max)
  return Array.from({ length: n }, (_, index) => tidy(min + step * index))
}

function linear([d0, d1]: [number, number], [r0, r1]: [number, number]) {
  let span = d1 - d0
  return (value: number) => (span === 0 ? (r0 + r1) / 2 : r0 + ((value - d0) / span) * (r1 - r0))
}

/** Rounds a coordinate for a path or attribute, and refuses anything but a finite number. */
function n(value: number) {
  if (!Number.isFinite(value)) throw new ChartError('The chart computed a coordinate that is not a finite number.')
  return tidy(Math.round(value * 100) / 100)
}

export type CurveType = 'linear' | 'monotone' | 'natural' | 'step'
export type Point = readonly [x: number, y: number]

function sign(value: number) {
  return value < 0 ? -1 : 1
}

/** Tangents that keep a curve monotone between points, after Steffen (1990). */
function monotoneTangents(points: readonly Point[]) {
  let count = points.length
  let widths = points.slice(1).map(([x], index) => x - points[index][0])
  let slopes = points.slice(1).map(([, y], index) => (y - points[index][1]) / widths[index])
  let tangents = Array.from({ length: count }, () => 0)
  for (let index = 1; index < count - 1; index++) {
    let [s0, s1] = [slopes[index - 1], slopes[index]]
    let [h0, h1] = [widths[index - 1], widths[index]]
    let p = (s0 * h1 + s1 * h0) / (h0 + h1)
    tangents[index] = (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0
  }
  tangents[0] = (3 * slopes[0] - tangents[1]) / 2
  tangents[count - 1] = (3 * slopes[count - 2] - tangents[count - 2]) / 2
  return tangents
}

/** The first and second Bézier control points of a natural cubic spline through the values, one axis at a time. */
function naturalControls(values: readonly number[]) {
  let segments = values.length - 1
  let lower = Array.from({ length: segments }, () => 1)
  let diagonal = Array.from({ length: segments }, () => 4)
  let right = values.slice(0, segments).map((value, index) => 4 * value + 2 * values[index + 1])
  diagonal[0] = 2
  right[0] = values[0] + 2 * values[1]
  lower[segments - 1] = 2
  diagonal[segments - 1] = 7
  right[segments - 1] = 8 * values[segments - 1] + values[segments]
  // Thomas algorithm for the tridiagonal system, with ones above the diagonal.
  for (let index = 1; index < segments; index++) {
    let factor = lower[index] / diagonal[index - 1]
    diagonal[index] -= factor
    right[index] -= factor * right[index - 1]
  }
  let first = Array.from({ length: segments }, () => 0)
  first[segments - 1] = right[segments - 1] / diagonal[segments - 1]
  for (let index = segments - 2; index >= 0; index--) first[index] = (right[index] - first[index + 1]) / diagonal[index]
  let second = first.map((_, index) =>
    index < segments - 1 ? 2 * values[index + 1] - first[index + 1] : (values[segments] + first[segments - 1]) / 2,
  )
  return [first, second] as const
}

function joinPoint([x, y]: Point) {
  return `${n(x)},${n(y)}`
}

/**
 * An SVG path through the points with the curve: straight lines, a monotone
 * curve that never overshoots a value, a natural spline, or steps that change
 * halfway between points. One point draws a move only, and no point draws
 * nothing. Points that share an x fall back to straight lines.
 */
export function curvePath(
  points: readonly Point[],
  curve: CurveType = 'linear',
  options: { move?: boolean } = {},
): string {
  if (points.length === 0) return ''
  let start = `${options.move === false ? 'L' : 'M'}${joinPoint(points[0])}`
  if (points.length === 1) return start
  let rest = points.slice(1)
  let distinct = rest.every(([x], index) => x !== points[index][0])

  if (curve === 'step') {
    return (
      start +
      rest
        .map(([x, y], index) => {
          let middle = (points[index][0] + x) / 2
          return `H${n(middle)}V${n(y)}H${n(x)}`
        })
        .join('')
    )
  }
  if (curve === 'linear' || points.length === 2 || !distinct)
    return start + rest.map((point) => `L${joinPoint(point)}`).join('')
  if (curve === 'monotone') {
    let tangents = monotoneTangents(points)
    return (
      start +
      rest
        .map(([x, y], index) => {
          let [x0, y0] = points[index]
          let third = (x - x0) / 3
          return `C${n(x0 + third)},${n(y0 + third * tangents[index])} ${n(x - third)},${n(y - third * tangents[index + 1])} ${joinPoint([x, y])}`
        })
        .join('')
    )
  }
  let [firstX, secondX] = naturalControls(points.map(([x]) => x))
  let [firstY, secondY] = naturalControls(points.map(([, y]) => y))
  return (
    start +
    rest
      .map(
        (point, index) =>
          `C${n(firstX[index])},${n(firstY[index])} ${n(secondX[index])},${n(secondY[index])} ${joinPoint(point)}`,
      )
      .join('')
  )
}

/** Splits points at the gaps of missing values, so a line or area breaks there instead of joining across. */
function segments<T>(items: readonly (T | null)[]): T[][] {
  let result: T[][] = [[]]
  for (let item of items) {
    if (item === null) result.push([])
    else result[result.length - 1].push(item)
  }
  return result.filter((segment) => segment.length > 0)
}

/** Where an angle in degrees and a radius land, with 0° at three o'clock and angles growing counterclockwise, as in Recharts. */
export function polarToCartesian(cx: number, cy: number, radius: number, angle: number): Point {
  let radians = (angle * Math.PI) / 180
  return [cx + radius * Math.cos(radians), cy - radius * Math.sin(radians)]
}

/**
 * An SVG path for a ring sector between two radii and two angles, or a pie
 * slice when the inner radius is 0. A span of 360° or more draws a full ring.
 */
export function sectorPath(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
): string {
  let inner = Math.max(0, Math.min(innerRadius, outerRadius))
  let outer = Math.max(0, outerRadius)
  let span = endAngle - startAngle
  if (outer === 0 || span === 0) return ''
  if (Math.abs(span) >= 360) {
    let ring = (radius: number, sweep: number) => {
      let [x0, y0] = polarToCartesian(cx, cy, radius, startAngle)
      let [x1, y1] = polarToCartesian(cx, cy, radius, startAngle + 180)
      return `M${n(x0)},${n(y0)}A${n(radius)},${n(radius)} 0 1 ${sweep} ${n(x1)},${n(y1)}A${n(radius)},${n(radius)} 0 1 ${sweep} ${n(x0)},${n(y0)}Z`
    }
    return ring(outer, 0) + (inner > 0 ? ring(inner, 1) : '')
  }
  let large = Math.abs(span) > 180 ? 1 : 0
  // Angles grow counterclockwise on screen, which is SVG's sweep flag 0.
  let sweep = span > 0 ? 0 : 1
  let [ox0, oy0] = polarToCartesian(cx, cy, outer, startAngle)
  let [ox1, oy1] = polarToCartesian(cx, cy, outer, endAngle)
  let path = `M${n(ox0)},${n(oy0)}A${n(outer)},${n(outer)} 0 ${large} ${sweep} ${n(ox1)},${n(oy1)}`
  if (inner === 0) return `${path}L${n(cx)},${n(cy)}Z`
  let [ix1, iy1] = polarToCartesian(cx, cy, inner, endAngle)
  let [ix0, iy0] = polarToCartesian(cx, cy, inner, startAngle)
  return `${path}L${n(ix1)},${n(iy1)}A${n(inner)},${n(inner)} 0 ${large} ${1 - sweep} ${n(ix0)},${n(iy0)}Z`
}

/** Whether an angle lies on the arc from `start` to `end`, in either direction. */
function onArc(angle: number, start: number, end: number) {
  let span = end - start
  if (Math.abs(span) >= 360) return true
  let offset = span >= 0 ? angle - start : start - angle
  return ((offset % 360) + 360) % 360 <= Math.abs(span)
}

function inTriangle([x, y]: Point, [ax, ay]: Point, [bx, by]: Point, [cx, cy]: Point) {
  // A flat triangle holds no point: every point on its line would pass the sign test, far past its ends.
  if ((bx - ax) * (cy - ay) - (cx - ax) * (by - ay) === 0) return false
  let side = (px: number, py: number, qx: number, qy: number) => (x - qx) * (py - qy) - (px - qx) * (y - qy)
  let [d1, d2, d3] = [side(ax, ay, bx, by), side(bx, by, cx, cy), side(cx, cy, ax, ay)]
  let negative = d1 < 0 || d2 < 0 || d3 < 0
  let positive = d1 > 0 || d2 > 0 || d3 > 0
  return !(negative && positive)
}

/**
 * Whether `point` is on a box, or between `from` and it: inside the shape
 * that stretches from `from` to the box, where every straight path from
 * there to the box runs.
 */
function isOnWayTo(point: Point, from: Point, box: { left: number; top: number; right: number; bottom: number }) {
  let [x, y] = point
  if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) return true
  let corners: Point[] = [
    [box.left, box.top],
    [box.right, box.top],
    [box.right, box.bottom],
    [box.left, box.bottom],
  ]
  return corners.some((corner, index) => inTriangle(point, from, corner, corners[(index + 1) % 4]))
}

type Corners = [topLeft: number, topRight: number, bottomRight: number, bottomLeft: number]

function roundedRect(x: number, y: number, width: number, height: number, [tl, tr, br, bl]: Corners) {
  let max = Math.min(width, height) / 2
  let [a, b, c, d] = [tl, tr, br, bl].map((radius) => Math.max(0, Math.min(radius, max)))
  if (a + b + c + d === 0) return `M${n(x)},${n(y)}H${n(x + width)}V${n(y + height)}H${n(x)}Z`
  let arc = (radius: number, toX: number, toY: number) => `A${n(radius)},${n(radius)} 0 0 1 ${n(toX)},${n(toY)}`
  return (
    `M${n(x + a)},${n(y)}H${n(x + width - b)}${arc(b, x + width, y + b)}` +
    `V${n(y + height - c)}${arc(c, x + width - c, y + height)}` +
    `H${n(x + d)}${arc(d, x, y + height - d)}V${n(y + a)}${arc(a, x + a, y)}Z`
  )
}

/** Estimates the width of a line of text at a font size, without a browser to measure it. */
function textWidth(text: string, fontSize: number) {
  return [...text].length * fontSize * 0.6
}

function resolveRadius(value: number | `${number}%` | undefined, max: number, fallback: number) {
  if (value === undefined) return max * fallback
  if (typeof value === 'number') return value
  return (max * Number.parseFloat(value)) / 100
}

/**
 * The radii of a ring in a chart with `max` room: radii in pixels that don't
 * fit shrink together, by the scale it returns, and an inner radius that
 * reaches the outer one leaves a ring of 40% of it, so a small chart still
 * shows its shape.
 */
function ringRadii(
  inner: number | `${number}%` | undefined,
  outer: number | `${number}%` | undefined,
  max: number,
  fallbacks: [inner: number, outer: number],
): [inner: number, outer: number, scale: number] {
  let innerRadius = Math.max(0, resolveRadius(inner, max, fallbacks[0]))
  let outerRadius = Math.max(0, resolveRadius(outer, max, fallbacks[1]))
  let scale = outerRadius > max && outerRadius > 0 ? max / outerRadius : 1
  innerRadius *= scale
  outerRadius *= scale
  if (innerRadius >= outerRadius && innerRadius > 0) innerRadius = outerRadius * 0.6
  return [innerRadius, outerRadius, scale]
}

// ---------------------------------------------------------------------------
// Reading the data.

function field(row: object, key: string): unknown {
  return (row as Record<string, unknown>)[key]
}

function readValue(row: object, key: string, index: number): number | null {
  let value = field(row, key)
  if (value === null || value === undefined) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ChartError(
      `"${key}" in row ${index + 1} must be a finite number, null or missing, not ${describe(value)}.`,
    )
  }
  return value
}

function checkData(data: unknown, what: string): ChartData {
  if (!Array.isArray(data)) throw new ChartError(`${what} needs data as an array of rows, not ${describe(data)}.`)
  data.forEach((row, index) => {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) {
      throw new ChartError(`Row ${index + 1} of the chart data must be an object, not ${describe(row)}.`)
    }
  })
  return data
}

function checkNonNegative(value: number | null, key: string, index: number, chart: string) {
  if (value !== null && value < 0) {
    throw new ChartError(`${chart} draws values from 0 up, so "${key}" in row ${index + 1} can't be ${value}.`)
  }
}

// ---------------------------------------------------------------------------
// Payloads: what the tooltip, legend and text alternatives show. They follow
// Recharts' payload, so shadcn's tooltip and legend logic ports as it is.

export interface ChartPayloadItem {
  /** The series key, such as `desktop`, or the value key of a pie, such as `visitors`. */
  dataKey: string
  /** The series key, or the name of a pie slice or radial ring from its `nameKey`, such as `chrome`. */
  name: string
  /** The value, or null where the row has none. In a legend it repeats the name. */
  value: number | string | null
  /** The color the series or slice is drawn in. */
  color: string
  /** The row the value comes from. */
  payload: object
}

export interface ChartTooltipState {
  /** Whether the pointer or the keyboard inspects a row now. */
  active: boolean
  /** The row inspected, or -1. */
  index: number
  /** The category of the row, such as `January`, or undefined for pies and radial bars. */
  label: unknown
  payload: ChartPayloadItem[]
}

function configFor(config: ChartConfig, payload: unknown, key: string) {
  if (typeof payload !== 'object' || payload === null) return undefined
  let row = 'payload' in payload && typeof payload.payload === 'object' ? payload.payload : undefined
  let configKey = key
  let own = (payload as Record<string, unknown>)[key]
  let fromRow = row ? (row as Record<string, unknown>)[key] : undefined
  if (typeof own === 'string') configKey = own
  else if (typeof fromRow === 'string') configKey = fromRow
  return Object.hasOwn(config, configKey) ? config[configKey] : Object.hasOwn(config, key) ? config[key] : undefined
}

/** The text of a category, through its config label when it has one. */
function categoryText(config: ChartConfig, value: unknown) {
  let text = value === undefined || value === null ? '' : String(value)
  return (Object.hasOwn(config, text) ? config[text].label : undefined) ?? text
}

function itemLabel(config: ChartConfig, item: ChartPayloadItem, nameKey?: string) {
  return configFor(config, item, nameKey ?? item.name ?? item.dataKey)?.label ?? item.name
}

// ---------------------------------------------------------------------------
// Container.

export interface ChartContainerProps extends Props<'div'> {
  config: ChartConfig
  /** The size the chart draws at on the server and until it measures its box (defaults to 320 by 200). */
  initialDimension?: { width: number; height: number }
  /** The locale of the default number format, in the tooltip, the axes and the text alternatives (defaults to `en-US`). */
  locale?: string
}

interface ContainerState {
  config: ChartConfig
  initialDimension: { width: number; height: number }
  format: (value: number) => string
  /** Joins the values of a row in the locale's way, such as "Desktop 305, Mobile 200". */
  list: (items: string[]) => string
}

// A block, not shadcn's flex box: its aspect ratio then grows to fit a plot
// and legend taller than the ratio, which a flex box doesn't.
const containerRule = css({
  aspectRatio: '16 / 9',
  minWidth: 0,
  fontSize: 'var(--text-xs)',
  lineHeight: 'var(--text-xs--line-height)',
})

function withStyle(own: Record<string, string>, style: unknown) {
  if (typeof style === 'string') {
    let declarations = Object.entries(own).map(([name, value]) => `${name}: ${value};`)
    return [...declarations, style].join(' ')
  }
  return { ...own, ...(typeof style === 'object' && style !== null ? style : {}) }
}

/**
 * Holds a chart: its config, the CSS variables of its colors, and a box that
 * keeps a 16 by 9 aspect ratio unless your styles give it another size. Give
 * it a height, a minimum height or an aspect ratio, as shadcn asks, so the
 * chart has room to measure.
 */
export function ChartContainer(handle: Handle<ChartContainerProps, ContainerState>) {
  let state: ContainerState = {
    config: {},
    initialDimension: { width: 320, height: 200 },
    format: String,
    list: (items) => items.join(', '),
  }
  let formats = new Map<string, [Intl.NumberFormat, Intl.ListFormat]>()
  handle.context.set(state)

  return () => {
    let { config, initialDimension, locale = 'en-US', id, style, mix, children, ...props } = handle.props
    let [numbers, lists] = formats.get(locale) ?? [
      new Intl.NumberFormat(locale),
      new Intl.ListFormat(locale, { type: 'unit', style: 'short' }),
    ]
    formats.set(locale, [numbers, lists])
    state.config = config
    state.initialDimension = initialDimension ?? { width: 320, height: 200 }
    state.format = (value) => numbers.format(Object.is(value, -0) ? 0 : value)
    state.list = (items) => lists.format(items)

    return (
      <div
        data-slot="chart"
        data-chart={`chart-${id ?? handle.id}`}
        id={id}
        style={withStyle(chartStyle(config), style)}
        {...props}
        mix={[containerRule, mix]}
      >
        {children}
      </div>
    )
  }
}

// ---------------------------------------------------------------------------
// Parts. Each reads the layout of the chart it's in, so it renders only inside
// a chart root. The root reads their props too, to lay the chart out.

export type Margin = { top: number; right: number; bottom: number; left: number }

export interface XAxisProps {
  /** The row field of each category, such as `month`. */
  dataKey?: string
  /** Whether to hide the axis but keep its categories. */
  hide?: boolean
  /** Whether to draw the small lines at the ticks (defaults to `true`). */
  tickLine?: boolean
  /** Whether to draw the axis line (defaults to `true`). */
  axisLine?: boolean
  /** Whether to draw the tick labels (defaults to `true`). */
  tick?: boolean
  /** The gap between a tick and its label, in pixels (defaults to `2`). */
  tickMargin?: number
  /** Turns a category into its label, such as `(value) => String(value).slice(0, 3)`. */
  tickFormatter?: (value: unknown, index: number) => string
  /** Which labels to draw when they don't all fit: every one after this many (a number), or as many as fit, keeping the last or the first. */
  interval?: number | 'preserveEnd' | 'preserveStart'
  /** Runs the categories from right to left, for right-to-left text (defaults to `false`). */
  reversed?: boolean
  /** The height of the axis, in pixels (defaults to fit the labels). */
  height?: number
}

export interface YAxisProps {
  hide?: boolean
  tickLine?: boolean
  axisLine?: boolean
  tick?: boolean
  tickMargin?: number
  tickFormatter?: (value: number, index: number) => string
  /** How many ticks to aim for (defaults to `5`). */
  tickCount?: number
  /** A fixed range for the values. Values outside it are drawn past the plot's edge. */
  domain?: [number, number]
  /** Which side the axis sits on (defaults to `'left'`). */
  orientation?: 'left' | 'right'
  /** The width of the axis, in pixels (defaults to fit the labels). */
  width?: number
}

export interface CartesianGridProps {
  /** Whether to draw a line at each value tick (defaults to `true`). */
  horizontal?: boolean
  /** Whether to draw a line at each category (defaults to `true`). */
  vertical?: boolean
  /** A dash pattern, such as `'3 3'`. */
  strokeDasharray?: string
}

interface SeriesProps {
  /** The row field of the series' values, which also names its config entry and its color, `--color-<key>`. */
  dataKey: string
  /** Series with the same stack id stack on each other: positive values up, negative values down. */
  stackId?: string
}

export interface LineProps extends SeriesProps {
  type?: CurveType
  /** The line's color (defaults to `var(--color-<dataKey>)`). */
  stroke?: string
  /** The line's width, in pixels (defaults to `1`). */
  strokeWidth?: number
  /** Whether to draw a dot at each value (defaults to `true`). */
  dot?: boolean
  /** Whether to draw a dot at the value inspected (defaults to `true`). */
  activeDot?: boolean
}

export interface AreaProps extends SeriesProps {
  type?: CurveType
  fill?: string
  /** The fill's opacity (defaults to `0.6`). */
  fillOpacity?: number
  stroke?: string
  strokeWidth?: number
  dot?: boolean
  activeDot?: boolean
}

export interface BarProps extends SeriesProps {
  fill?: string
  /** Rounds the corners at the bar's end away from zero, or each one: top left, top right, bottom right, bottom left. */
  radius?: number | Corners
  /** Prints each value at the end of its bar. */
  label?: boolean | { position?: 'top' | 'inside'; formatter?: (value: number) => string }
}

export interface PieProps {
  /** The slices, if the chart's data holds something else. */
  data?: ChartData
  /** The row field of each slice's value. */
  dataKey: string
  /** The row field of each slice's name, which also picks its config entry (defaults to `name`). */
  nameKey?: string
  /** In pixels or as a percentage of the largest radius that fits (defaults to `0`, a pie). */
  innerRadius?: number | `${number}%`
  /** In pixels or as a percentage of the largest radius that fits (defaults to `'80%'`). */
  outerRadius?: number | `${number}%`
  /** In degrees, from three o'clock counterclockwise (defaults to `0`). */
  startAngle?: number
  /** In degrees (defaults to `360`). */
  endAngle?: number
  /** The gap between slices, in degrees (defaults to `0`). */
  paddingAngle?: number
  /** The color of the slices' edges (defaults to `none`). */
  stroke?: string
  strokeWidth?: number
}

export interface RadarProps {
  dataKey: string
  fill?: string
  /** The fill's opacity (defaults to `1`). */
  fillOpacity?: number
  stroke?: string
  strokeWidth?: number
  /** Whether to draw a dot at each value (defaults to `false`). */
  dot?: boolean
}

export interface RadialBarProps {
  dataKey: string
  /** The row field of each ring's name, which also picks its config entry and color (defaults to `name`). */
  nameKey?: string
  /** Whether to draw a track along the chart's whole angle behind each ring. */
  background?: boolean
}

export interface PolarGridProps {
  /** Polygons through the spokes or circles (defaults to `'polygon'`, or `'circle'` in a radial bar chart). */
  gridType?: 'polygon' | 'circle'
  /** Whether to draw a line from the center along each spoke (defaults to `true`). */
  radialLines?: boolean
  /** The radii of the rings, in pixels (defaults to the value ticks, or each ring of a radial bar chart). */
  polarRadius?: readonly number[]
  /** Fills the rings in order, each over the last, such as `['var(--muted)', 'var(--card)']` for a track between two radii. */
  fill?: string | readonly string[]
  /** The rings' color, or `'none'`. */
  stroke?: string
}

export interface PolarAngleAxisProps {
  /** The row field of each spoke's category, such as `month`. */
  dataKey?: string
  tick?: boolean
  tickFormatter?: (value: unknown, index: number) => string
}

export interface ChartCenterLabelViewBox {
  cx: number
  cy: number
  innerRadius: number
  outerRadius: number
}

export interface ChartCenterLabelProps {
  /** The large line, such as a total. */
  value?: string
  /** The small line under it. */
  caption?: string
  /** The size of the value (defaults to `'default'`, shadcn's text-3xl; `'lg'` is text-4xl). */
  size?: 'default' | 'lg'
  /** Draws your own SVG at the center instead, as Recharts' Label content did. */
  content?: (viewBox: ChartCenterLabelViewBox) => RemixNode
}

export interface ChartTooltipProps {
  /** What the tooltip shows (defaults to `<ChartTooltipContent />`). It reads the row inspected from the chart. */
  content?: RemixNode
  /** Whether to mark the row inspected with the pointer: a band behind bars, or a line (defaults to `true`). The keyboard always marks it. */
  cursor?: boolean
  /** A row to inspect from the start, until the pointer or keyboard inspects another. */
  defaultIndex?: number
}

export interface ChartLegendProps {
  /** What the legend shows (defaults to `<ChartLegendContent />`). */
  content?: RemixNode
  /** Whether the legend sits above or below the chart (defaults to `'bottom'`). */
  verticalAlign?: 'top' | 'bottom'
}

/** The category axis of a line, area or bar chart. */
export function XAxis(handle: Handle<XAxisProps>) {
  return () => {
    let model = cartesianOf(handle, 'XAxis')
    let { hide, tickLine = true, axisLine = true, tick = true, tickMargin = 2, tickFormatter } = handle.props
    if (hide || !model) return null
    let { plot, categories } = model
    let y = plot.bottom
    let labels = categories.map((category, index) =>
      tickFormatter ? tickFormatter(category.value, index) : categoryText(model.config, category.value),
    )
    let shown = visibleTicks(
      categories.map((category) => category.x),
      labels.map((label) => textWidth(label, model.fontSize)),
      handle.props.interval ?? 'preserveEnd',
    )

    return (
      <g data-slot="chart-x-axis" mix={axisRule}>
        {axisLine && <line x1={n(plot.left)} x2={n(plot.right)} y1={n(y)} y2={n(y)} data-slot="chart-axis-line" />}
        {categories.map((category, index) =>
          shown[index] ? (
            <g key={index} data-slot="chart-tick">
              {tickLine && <line x1={n(category.x)} x2={n(category.x)} y1={n(y)} y2={n(y + 6)} />}
              {tick && (
                <text
                  x={n(category.x)}
                  y={n(y + (tickLine ? 6 : 0) + tickMargin)}
                  text-anchor="middle"
                  dominant-baseline="hanging"
                >
                  {labels[index]}
                </text>
              )}
            </g>
          ) : null,
        )}
      </g>
    )
  }
}

/** Which tick labels fit without overlapping: from the last (or first) category on, each that keeps clear of the one kept before. */
function visibleTicks(positions: number[], widths: number[], interval: XAxisProps['interval']) {
  if (typeof interval === 'number') {
    let every = Math.max(0, Math.round(interval)) + 1
    return positions.map((_, index) => index % every === 0)
  }
  let order = positions.map((_, index) => index)
  if (interval !== 'preserveStart') order.reverse()
  let shown = positions.map(() => false)
  let kept: number | undefined
  for (let index of order) {
    let room = kept === undefined ? 0 : (widths[index] + widths[kept]) / 2 + 4
    if (kept === undefined || Math.abs(positions[index] - positions[kept]) >= room) {
      shown[index] = true
      kept = index
    }
  }
  return shown
}

/** The value axis of a line, area or bar chart. */
export function YAxis(handle: Handle<YAxisProps>) {
  return () => {
    let model = cartesianOf(handle, 'YAxis')
    let {
      hide,
      tickLine = true,
      axisLine = true,
      tick = true,
      tickMargin = 2,
      tickFormatter,
      orientation = 'left',
    } = handle.props
    if (hide || !model) return null
    let { plot, ticks, y } = model
    let left = orientation === 'left'
    let x = left ? plot.left : plot.right
    let edge = tickLine ? 6 : 0

    return (
      <g data-slot="chart-y-axis" mix={axisRule}>
        {axisLine && <line x1={n(x)} x2={n(x)} y1={n(plot.top)} y2={n(plot.bottom)} data-slot="chart-axis-line" />}
        {ticks.map((value, index) => (
          <g key={value} data-slot="chart-tick">
            {tickLine && <line x1={n(x)} x2={n(left ? x - 6 : x + 6)} y1={n(y(value))} y2={n(y(value))} />}
            {tick && (
              <text
                x={n(left ? x - edge - tickMargin : x + edge + tickMargin)}
                y={n(y(value))}
                text-anchor={left ? 'end' : 'start'}
                dominant-baseline="middle"
              >
                {tickFormatter ? tickFormatter(value, index) : model.format(value)}
              </text>
            )}
          </g>
        ))}
      </g>
    )
  }
}

/** Grid lines behind a line, area or bar chart: at the value ticks, and at the categories. */
export function CartesianGrid(handle: Handle<CartesianGridProps>) {
  return () => {
    let model = cartesianOf(handle, 'CartesianGrid')
    if (!model) return null
    let { horizontal = true, vertical = true, strokeDasharray } = handle.props
    let { plot, ticks, y, categories } = model

    return (
      <g data-slot="chart-grid" stroke-dasharray={strokeDasharray} mix={gridRule}>
        {horizontal &&
          ticks.map((value) => (
            <line key={`h${value}`} x1={n(plot.left)} x2={n(plot.right)} y1={n(y(value))} y2={n(y(value))} />
          ))}
        {vertical &&
          categories.map((category, index) => (
            <line key={`v${index}`} x1={n(category.x)} x2={n(category.x)} y1={n(plot.top)} y2={n(plot.bottom)} />
          ))}
      </g>
    )
  }
}

function seriesOf(handle: Handle<any>, part: string): { model: CartesianModel; series: SeriesModel } | undefined {
  let model = cartesianOf(handle, part)
  let series = model?.series.find((candidate) => candidate.key === handle.props.dataKey)
  return model && series ? { model, series } : undefined
}

/** A line through a series' values, with a break at each missing value. */
export function Line(handle: Handle<LineProps>) {
  return () => {
    let found = seriesOf(handle, 'Line')
    if (!found) return null
    let { model, series } = found
    let { type = 'linear', strokeWidth = 1, dot = true, activeDot = true } = handle.props
    let points = series.points.map((point) => (point ? ([point.x, point.y] as const) : null))
    let active = model.activeIndex >= 0 ? series.points[model.activeIndex] : null

    return (
      <g data-slot="chart-line" data-key={series.key} mix={seriesRule}>
        {segments(points).map((segment, index) => (
          <path
            key={index}
            d={curvePath(segment, type)}
            fill="none"
            stroke={series.color}
            stroke-width={strokeWidth}
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        ))}
        {dot &&
          series.points.map((point, index) =>
            point ? (
              <circle
                key={index}
                cx={n(point.x)}
                cy={n(point.y)}
                r="3"
                fill="var(--background)"
                stroke={series.color}
              />
            ) : null,
          )}
        {activeDot && active && (
          <circle data-slot="chart-active-dot" cx={n(active.x)} cy={n(active.y)} r="4" fill={series.color} />
        )}
      </g>
    )
  }
}

/** A filled area under a series' values, or between it and the series below it in a stack. */
export function Area(handle: Handle<AreaProps>) {
  return () => {
    let found = seriesOf(handle, 'Area')
    if (!found) return null
    let { model, series } = found
    let {
      type = 'linear',
      fillOpacity = 0.6,
      strokeWidth = 1,
      dot = false,
      activeDot = true,
      fill,
      stroke,
    } = handle.props
    let fillColor = fill === undefined ? series.color : checkColor(fill, `The fill of "${series.key}"`)
    let strokeColor = stroke === undefined ? series.color : checkColor(stroke, `The stroke of "${series.key}"`)
    let active = model.activeIndex >= 0 ? series.points[model.activeIndex] : null

    return (
      <g data-slot="chart-area" data-key={series.key} mix={seriesRule}>
        {segments(series.points).map((segment, index) => {
          let top = segment.map((point) => [point.x, point.y] as const)
          let base = segment.map((point) => [point.x, point.y0] as const).reverse()
          return (
            <g key={index}>
              <path
                d={`${curvePath(top, type)}${curvePath(base, type, { move: false })}Z`}
                fill={fillColor}
                fill-opacity={fillOpacity}
                stroke="none"
                data-slot="chart-area-fill"
              />
              <path d={curvePath(top, type)} fill="none" stroke={strokeColor} stroke-width={strokeWidth} />
            </g>
          )
        })}
        {dot &&
          series.points.map((point, index) =>
            point ? (
              <circle key={index} cx={n(point.x)} cy={n(point.y)} r="3" fill="var(--background)" stroke={strokeColor} />
            ) : null,
          )}
        {activeDot && active && (
          <circle data-slot="chart-active-dot" cx={n(active.x)} cy={n(active.y)} r="4" fill={strokeColor} />
        )}
      </g>
    )
  }
}

function corners(radius: BarProps['radius'], negative: boolean): Corners {
  let [tl, tr, br, bl]: Corners =
    typeof radius === 'number' ? [radius, radius, radius, radius] : (radius ?? [0, 0, 0, 0])
  // A bar below zero grows down, so its far end, which the top corners round, is at the bottom.
  return negative ? [bl, br, tr, tl] : [tl, tr, br, bl]
}

/** A bar for each of a series' values, side by side with the other series or stacked on them. */
export function Bar(handle: Handle<BarProps>) {
  return () => {
    let found = seriesOf(handle, 'Bar')
    if (!found) return null
    let { model, series } = found
    let format = handle.context.get(ChartFrame)?.format ?? model.format
    let { radius, label } = handle.props
    let labelOptions = typeof label === 'object' ? label : {}

    return (
      <g data-slot="chart-bar" data-key={series.key} mix={seriesRule}>
        {series.bars.map((bar, index) =>
          bar && bar.height > 0 ? (
            <path
              key={index}
              d={roundedRect(bar.x, bar.y, bar.width, bar.height, corners(radius, bar.negative))}
              fill={series.color}
              data-index={index}
              data-negative={bar.negative ? '' : undefined}
              data-active={model.activeIndex === index ? '' : undefined}
              mix={barRule}
            />
          ) : null,
        )}
        {label &&
          series.bars.map((bar, index) => {
            let value = series.values[index]
            if (!bar || value === null) return null
            let inside = labelOptions.position === 'inside'
            let y = bar.negative ? bar.y + bar.height + (inside ? -6 : 6) : bar.y + (inside ? 6 : -6)
            return (
              <text
                key={`label${index}`}
                x={n(bar.x + bar.width / 2)}
                y={n(y)}
                text-anchor="middle"
                dominant-baseline={bar.negative !== inside ? 'hanging' : 'auto'}
                data-slot="chart-bar-label"
                data-inside={inside ? '' : undefined}
                mix={barLabelRule}
              >
                {labelOptions.formatter ? labelOptions.formatter(value) : format(value, series.key)}
              </text>
            )
          })}
      </g>
    )
  }
}

/** The slices of a pie or donut, one per row. */
export function Pie(handle: Handle<PieProps>) {
  return () => {
    let model = polarOf(handle, 'Pie', 'pie')
    if (!model) return null
    let { stroke = 'none', strokeWidth } = handle.props
    let strokeColor = stroke === 'none' ? 'none' : checkColor(stroke, 'The stroke of the pie')

    return (
      <g data-slot="chart-pie" mix={seriesRule}>
        {model.total === 0 && (
          <path
            data-slot="chart-pie-empty"
            d={sectorPath(model.cx, model.cy, model.innerRadius, model.outerRadius, 0, 360)}
            mix={trackRule}
          />
        )}
        {model.sectors.map((sector) => {
          let d = sectorPath(
            model.cx,
            model.cy,
            sector.innerRadius,
            sector.outerRadius,
            sector.startAngle,
            sector.endAngle,
          )
          return d ? (
            <path
              key={sector.index}
              d={d}
              fill={sector.color}
              stroke={strokeColor}
              stroke-width={strokeWidth}
              data-index={sector.index}
              data-active={model.activeIndex === sector.index ? '' : undefined}
              mix={sectorRule}
            />
          ) : null
        })}
      </g>
    )
  }
}

/** A polygon through a series' values on the spokes of a radar chart. */
export function Radar(handle: Handle<RadarProps>) {
  return () => {
    let model = polarOf(handle, 'Radar', 'radar')
    let series = model?.series.find((candidate) => candidate.key === handle.props.dataKey)
    if (!model || !series) return null
    let { fillOpacity = 1, strokeWidth = 1, dot = false, fill, stroke } = handle.props
    let fillColor = fill === undefined ? series.color : checkColor(fill, `The fill of "${series.key}"`)
    let strokeColor = stroke === undefined ? 'none' : checkColor(stroke, `The stroke of "${series.key}"`)
    let points = series.points.map((point) => [point.x, point.y] as const)
    let active = model.activeIndex >= 0 ? series.points[model.activeIndex] : undefined

    return (
      <g data-slot="chart-radar" data-key={series.key} mix={seriesRule}>
        {points.length > 0 && (
          <path
            d={`${curvePath(points)}Z`}
            fill={fillColor}
            fill-opacity={fillOpacity}
            stroke={strokeColor}
            stroke-width={strokeWidth}
            data-slot="chart-radar-shape"
          />
        )}
        {dot && points.map(([x, y], index) => <circle key={index} cx={n(x)} cy={n(y)} r="3" fill={fillColor} />)}
        {active && <circle data-slot="chart-active-dot" cx={n(active.x)} cy={n(active.y)} r="4" fill={fillColor} />}
      </g>
    )
  }
}

/** A ring for each row of a radial bar chart, along the angle its value takes. */
export function RadialBar(handle: Handle<RadialBarProps>) {
  return () => {
    let model = polarOf(handle, 'RadialBar', 'radial')
    if (!model) return null

    return (
      <g data-slot="chart-radial-bar" mix={seriesRule}>
        {handle.props.background &&
          model.sectors.map((sector) => (
            <path
              key={`track${sector.index}`}
              data-slot="chart-radial-track"
              d={sectorPath(
                model.cx,
                model.cy,
                sector.innerRadius,
                sector.outerRadius,
                model.startAngle,
                model.endAngle,
              )}
              mix={trackRule}
            />
          ))}
        {model.sectors.map((sector) => {
          let d = sectorPath(
            model.cx,
            model.cy,
            sector.innerRadius,
            sector.outerRadius,
            sector.startAngle,
            sector.endAngle,
          )
          return d ? (
            <path
              key={sector.index}
              d={d}
              fill={sector.color}
              data-index={sector.index}
              data-active={model.activeIndex === sector.index ? '' : undefined}
              mix={sectorRule}
            />
          ) : null
        })}
      </g>
    )
  }
}

/** Rings and spokes behind a radar, pie or radial bar chart. */
export function PolarGrid(handle: Handle<PolarGridProps>) {
  return () => {
    let model = polarOf(handle, 'PolarGrid')
    if (!model) return null
    let { radialLines = true, polarRadius, fill, stroke } = handle.props
    let gridType = handle.props.gridType ?? (model.type === 'radial' ? 'circle' : 'polygon')
    let radii = polarRadius ? polarRadius.map((radius) => radius * model.radiusScale) : model.gridRadii
    let fills = (Array.isArray(fill) ? fill : fill === undefined ? [] : [fill]).map((color) =>
      checkColor(color, 'A polar grid fill'),
    )
    let strokeColor = stroke === undefined || stroke === 'none' ? stroke : checkColor(stroke, 'The polar grid stroke')
    let angles = model.spokes.map((spoke) => spoke.angle)
    let ring = (radius: number) =>
      gridType === 'circle' || angles.length < 3
        ? sectorPath(model.cx, model.cy, 0, radius, 0, 360)
        : `${curvePath(angles.map((angle) => polarToCartesian(model.cx, model.cy, radius, angle)))}Z`

    return (
      <g data-slot="chart-polar-grid" mix={gridRule} stroke={strokeColor}>
        {radii.map((radius, index) => (
          <path key={`ring${index}`} d={ring(radius)} fill={fills[index] ?? 'none'} data-slot="chart-polar-grid-ring" />
        ))}
        {radialLines &&
          angles.map((angle, index) => {
            let [x, y] = polarToCartesian(model.cx, model.cy, model.outerRadius, angle)
            return <line key={`spoke${index}`} x1={n(model.cx)} y1={n(model.cy)} x2={n(x)} y2={n(y)} />
          })}
      </g>
    )
  }
}

/** The category labels around a radar chart, at the end of each spoke. */
export function PolarAngleAxis(handle: Handle<PolarAngleAxisProps>) {
  return () => {
    let model = polarOf(handle, 'PolarAngleAxis')
    let { tick = true, tickFormatter } = handle.props
    if (!model || !tick) return null

    return (
      <g data-slot="chart-polar-angle-axis" mix={axisRule}>
        {model.spokes.map((spoke, index) => {
          let [x, y] = polarToCartesian(model.cx, model.cy, model.outerRadius + 8, spoke.angle)
          let cos = Math.cos((spoke.angle * Math.PI) / 180)
          let sin = Math.sin((spoke.angle * Math.PI) / 180)
          let anchor = Math.abs(cos) < 0.1 ? 'middle' : cos > 0 ? 'start' : 'end'
          let baseline = Math.abs(sin) < 0.1 ? 'middle' : sin > 0 ? 'auto' : 'hanging'
          return (
            <text
              key={index}
              x={n(x)}
              y={n(y)}
              text-anchor={anchor}
              dominant-baseline={baseline}
              data-slot="chart-tick"
            >
              {tickFormatter ? tickFormatter(spoke.value, index) : categoryText(model.config, spoke.value)}
            </text>
          )
        })}
      </g>
    )
  }
}

/** Text at the center of a pie, donut, radar or radial bar chart, or of the plot, such as a total. */
export function ChartCenterLabel(handle: Handle<ChartCenterLabelProps>) {
  return () => {
    let frame = handle.context.get(ChartFrame)
    if (!frame) throw new ChartError('ChartCenterLabel must be inside a chart, such as a PieChart.')
    let { value, caption, size = 'default', content } = handle.props
    let viewBox = frame.center
    if (content) return <g data-slot="chart-center-label">{content(viewBox)}</g>
    let x = n(viewBox.cx)
    let valueY = caption ? viewBox.cy - 8 : viewBox.cy

    return (
      <text x={x} y={n(viewBox.cy)} text-anchor="middle" dominant-baseline="middle" data-slot="chart-center-label">
        {value !== undefined && (
          <tspan x={x} y={n(valueY)} data-size={size} mix={centerValueRule}>
            {value}
          </tspan>
        )}
        {caption !== undefined && (
          <tspan x={x} y={n(valueY + 24)} mix={centerCaptionRule}>
            {caption}
          </tspan>
        )}
      </text>
    )
  }
}

// ---------------------------------------------------------------------------
// Tooltip and legend.

/**
 * Shows the row the pointer or keyboard inspects, next to it inside the
 * chart. Put it among the chart's parts. Its content reads the row from the
 * chart, so `content` can be any part of yours that calls
 * `getChartTooltip(handle)`.
 */
export function ChartTooltip(handle: Handle<ChartTooltipProps>) {
  let box: HTMLElement | null = null
  let placed = false

  function place(frame: FrameState) {
    if (!box || !frame.anchor) return
    let surface = box.offsetParent
    if (!(surface instanceof HTMLElement)) return
    let scale = frame.size.width > 0 ? surface.clientWidth / frame.size.width : 1
    let [width, height] = [box.offsetWidth, box.offsetHeight]
    let position = computePosition(
      { x: frame.anchor.x * scale, y: frame.anchor.y * scale, width: 0, height: 0 },
      { width, height },
      { x: 0, y: 0, width: surface.clientWidth, height: surface.clientHeight },
      { side: 'inline-end', align: 'start', sideOffset: 10, alignOffset: 10, collisionPadding: 0, dir: frame.dir },
    )
    // Too wide for either side of the row, it still stays inside the chart, over the row.
    let x = Math.max(0, Math.min(position.x, surface.clientWidth - width))
    let y = Math.max(0, Math.min(position.y, surface.clientHeight - height))
    let translate = `${Math.round(x)}px ${Math.round(y)}px`
    if (placed) {
      box.style.setProperty('translate', translate)
      return
    }
    // It opens where it points, rather than gliding there from where it closed.
    box.style.setProperty('transition', 'none')
    box.style.setProperty('translate', translate)
    void box.offsetWidth
    box.style.removeProperty('transition')
    placed = true
  }

  return () => {
    let frame = handle.context.get(ChartFrame)
    if (!frame) throw new ChartError('ChartTooltip must be inside a chart, such as a BarChart.')
    let { tooltip, running } = frame
    if (!running) return null
    if (tooltip.active) handle.queueTask(() => place(frame))
    else placed = false

    return (
      <div
        data-slot="chart-tooltip"
        aria-hidden="true"
        data-open={tooltip.active ? '' : undefined}
        data-closed={tooltip.active ? undefined : ''}
        mix={[tooltipBoxRule, ref((node) => (box = node))]}
      >
        {tooltip.payload.length > 0 ? (handle.props.content ?? <ChartTooltipContent />) : null}
      </div>
    )
  }
}

export interface ChartTooltipContentProps extends Props<'div'> {
  /** Whether it shows; defaults to whether the chart inspects a row. */
  active?: boolean
  /** The values to show; defaults to the row the chart inspects. */
  payload?: ChartPayloadItem[]
  /** The row's category; defaults to the chart's. */
  label?: unknown
  /** The swatch beside each value (defaults to `'dot'`). */
  indicator?: 'dot' | 'line' | 'dashed'
  hideLabel?: boolean
  hideIndicator?: boolean
  /** Turns the label into what shows, given the label text and the payload. */
  labelFormatter?: (label: string | undefined, payload: ChartPayloadItem[]) => RemixNode
  /** Renders one value your way, in place of its swatch, name and number. */
  formatter?: (
    value: number | string,
    name: string,
    item: ChartPayloadItem,
    index: number,
    payload: object,
  ) => RemixNode
  /** One color for every swatch, in place of each series' color. */
  color?: string
  /** The config or row key for each value's name, such as `browser`. */
  nameKey?: string
  /** The config or row key for the label, such as `visitors`. */
  labelKey?: string
}

/** Reads the row a chart inspects, for your own tooltip content. */
export function getChartTooltip(handle: Handle<any, any>): ChartTooltipState {
  return handle.context.get(ChartFrame)?.tooltip ?? { active: false, index: -1, label: undefined, payload: [] }
}

function configOf(handle: Handle<any, any>): ContainerState | undefined {
  return handle.context.get(ChartContainer)
}

/** The tooltip's box: the category, then a swatch, a name and a value for each series. */
export function ChartTooltipContent(handle: Handle<ChartTooltipContentProps>) {
  return () => {
    let container = configOf(handle)
    let config = container?.config ?? {}
    let format = handle.context.get(ChartFrame)?.format ?? container?.format ?? String
    let state = getChartTooltip(handle)
    let {
      active = state.active,
      payload = state.payload,
      label = state.label,
      indicator = 'dot',
      hideLabel = false,
      hideIndicator = false,
      labelFormatter,
      formatter,
      color,
      nameKey,
      labelKey,
      mix,
      ...props
    } = handle.props
    if (!active || payload.length === 0) return null
    let swatchColor = color === undefined ? undefined : checkColor(color, 'The tooltip color')

    let [first] = payload
    let key = labelKey ?? first.dataKey ?? first.name ?? 'value'
    let labelText =
      !labelKey && typeof label === 'string' ? categoryText(config, label) : configFor(config, first, key)?.label
    let tooltipLabel = hideLabel ? null : labelFormatter ? (
      <div data-slot="chart-tooltip-label" mix={tooltipLabelRule}>
        {labelFormatter(labelText, payload)}
      </div>
    ) : labelText ? (
      <div data-slot="chart-tooltip-label" mix={tooltipLabelRule}>
        {labelText}
      </div>
    ) : null
    let nestLabel = payload.length === 1 && indicator !== 'dot'

    return (
      <div data-slot="chart-tooltip-content" {...props} mix={[tooltipContentRule, mix]}>
        {nestLabel ? null : tooltipLabel}
        <div mix={tooltipItemsRule}>
          {payload.map((item, index) => {
            let itemConfig = configFor(config, item, nameKey ?? item.name ?? item.dataKey ?? 'value')
            let Icon = itemConfig?.icon
            // A payload you pass may hold any color, so it's checked like the config's.
            let indicatorColor = swatchColor ?? checkColor(item.color, `The color of "${item.name}"`)
            return (
              <div
                key={`${item.dataKey}-${item.name}`}
                data-slot="chart-tooltip-item"
                data-indicator={indicator}
                mix={tooltipItemRule}
              >
                {formatter && item.value !== null ? (
                  formatter(item.value, item.name, item, index, item.payload)
                ) : (
                  <>
                    {Icon ? (
                      <Icon />
                    ) : hideIndicator ? null : (
                      <div
                        data-slot="chart-tooltip-indicator"
                        data-indicator={indicator}
                        data-nested={nestLabel ? '' : undefined}
                        style={{ '--color-bg': indicatorColor, '--color-border': indicatorColor }}
                        mix={indicatorRule}
                      />
                    )}
                    <div data-nested={nestLabel ? '' : undefined} mix={tooltipRowRule}>
                      <div mix={tooltipNameRule}>
                        {nestLabel ? tooltipLabel : null}
                        <span data-slot="chart-tooltip-name">{itemConfig?.label ?? item.name}</span>
                      </div>
                      {item.value !== null && (
                        <span data-slot="chart-tooltip-value" mix={tooltipValueRule}>
                          {typeof item.value === 'number' ? format(item.value, item.dataKey) : String(item.value)}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }
}

/** Holds the legend above or below the chart. Put it among the chart's parts. */
export function ChartLegend(handle: Handle<ChartLegendProps>) {
  return () => {
    let frame = handle.context.get(ChartFrame)
    if (!frame) throw new ChartError('ChartLegend must be inside a chart, such as a BarChart.')
    return (
      <div data-slot="chart-legend" data-vertical-align={handle.props.verticalAlign ?? 'bottom'}>
        {handle.props.content ?? <ChartLegendContent />}
      </div>
    )
  }
}

export interface ChartLegendContentProps extends Props<'div'> {
  /** The items; defaults to the chart's series, or its slices and rings. */
  payload?: ChartPayloadItem[]
  /** Whether to show the color swatch instead of the config's icon. */
  hideIcon?: boolean
  /** The config or row key for each item's name, such as `browser`. */
  nameKey?: string
  /** Defaults to the legend's. */
  verticalAlign?: 'top' | 'bottom'
}

/** The legend's list: a swatch or icon and a label for each series, slice or ring. */
export function ChartLegendContent(handle: Handle<ChartLegendContentProps>) {
  return () => {
    let config = configOf(handle)?.config ?? {}
    let frame = handle.context.get(ChartFrame)
    let {
      payload = frame?.legend ?? [],
      hideIcon = false,
      nameKey,
      verticalAlign = frame?.legendAlign ?? 'bottom',
      mix,
      ...props
    } = handle.props
    if (payload.length === 0) return null

    return (
      <div data-slot="chart-legend-content" data-vertical-align={verticalAlign} {...props} mix={[legendRule, mix]}>
        <ul role="list" mix={legendListRule}>
          {payload.map((item) => {
            let itemConfig = configFor(config, item, nameKey ?? item.dataKey ?? 'value')
            let Icon = itemConfig?.icon
            return (
              <li key={`${item.dataKey}-${item.name}`} data-slot="chart-legend-item" mix={legendItemRule}>
                {Icon && !hideIcon ? (
                  <Icon />
                ) : (
                  <span
                    data-slot="chart-legend-swatch"
                    aria-hidden="true"
                    style={{ '--color-bg': checkColor(item.color, `The color of "${item.name}"`) }}
                    mix={swatchRule}
                  />
                )}
                <span>{itemConfig?.label ?? item.name}</span>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }
}

// ---------------------------------------------------------------------------
// The roots and their layout.

type ChartType = 'line' | 'area' | 'bar' | 'pie' | 'radar' | 'radial'

const chartNames: Record<ChartType, string> = {
  line: 'Line chart',
  area: 'Area chart',
  bar: 'Bar chart',
  pie: 'Pie chart',
  radar: 'Radar chart',
  radial: 'Radial bar chart',
}

interface ChartRootProps {
  /** The rows to draw. */
  data?: ChartData
  /** Space around the chart, in pixels (each side defaults to `5`). */
  margin?: Partial<Margin>
  /** Names the chart for assistive technology (defaults to the kind of chart, such as "Bar chart"). */
  'aria-label'?: string
  /** Names the chart by the id of a visible title, such as the card's. */
  'aria-labelledby'?: string
  /** Describes the chart for assistive technology, in place of the summary it writes from the data, such as for your language. */
  summary?: string
  /** Tells keyboard users what the arrow keys do, once the chart runs (defaults to an English sentence). */
  keyboardHint?: string
  /** Shows where the data has no rows (defaults to "No data"). */
  emptyLabel?: string
  /** Turns a value into text for the table, the summary and the tooltip (defaults to the container's number format). */
  valueFormatter?: (value: number, dataKey: string) => string
  children?: RemixNode
}

export interface CartesianChartProps extends ChartRootProps {
  /** The gap between the bars of a category, in pixels (defaults to `4`). */
  barGap?: number
  /** The gap at each side of a category's bars, in pixels or as a percentage of the category (defaults to `'10%'`). */
  barCategoryGap?: number | `${number}%`
}

export interface PolarChartProps extends ChartRootProps {
  /** The center, in pixels or as a percentage of the width or height (defaults to `'50%'`). */
  cx?: number | `${number}%`
  cy?: number | `${number}%`
}

export interface RadarChartProps extends PolarChartProps {
  innerRadius?: number | `${number}%`
  /** In pixels or as a percentage of the largest radius that fits (defaults to `'80%'`). */
  outerRadius?: number | `${number}%`
  /** Where the first spoke points, in degrees (defaults to `90`, twelve o'clock). */
  startAngle?: number
  /** Where the spokes end (defaults to `-270`, so they go clockwise). */
  endAngle?: number
}

export interface RadialBarChartProps extends PolarChartProps {
  /** In pixels or as a percentage of the largest radius that fits (defaults to `'30%'`). */
  innerRadius?: number | `${number}%`
  /** (defaults to `'100%'`). */
  outerRadius?: number | `${number}%`
  /** Where every ring starts, in degrees from three o'clock counterclockwise (defaults to `0`). */
  startAngle?: number
  /** Where the largest value ends (defaults to `360`). */
  endAngle?: number
  /** The values that span the angle (defaults to 0 up to the largest value). */
  domain?: [number, number]
  /** The gap between rings, in pixels or as a percentage of a ring (defaults to `'10%'` at each side). */
  barCategoryGap?: number | `${number}%`
}

interface Size {
  width: number
  height: number
  fontSize: number
}

interface CategoryModel {
  index: number
  value: unknown
  /** The center of the category. */
  x: number
  /** The start and width of its band. */
  start: number
  band: number
}

interface SeriesModel {
  key: string
  kind: 'line' | 'area' | 'bar' | 'radar'
  color: string
  values: (number | null)[]
  points: ({ x: number; y: number; y0: number } | null)[]
  bars: ({ x: number; y: number; width: number; height: number; negative: boolean } | null)[]
}

interface CartesianModel {
  kind: 'cartesian'
  type: ChartType
  config: ChartConfig
  format: (value: number) => string
  fontSize: number
  plot: { left: number; top: number; right: number; bottom: number }
  categories: CategoryModel[]
  ticks: number[]
  y: (value: number) => number
  series: SeriesModel[]
  activeIndex: number
}

interface SectorModel {
  index: number
  value: number | null
  name: string
  color: string
  innerRadius: number
  outerRadius: number
  startAngle: number
  endAngle: number
}

interface PolarModel {
  kind: 'polar'
  type: ChartType
  config: ChartConfig
  cx: number
  cy: number
  innerRadius: number
  outerRadius: number
  /** How much radii in pixels shrank to fit, such as a grid's `polarRadius`. */
  radiusScale: number
  startAngle: number
  endAngle: number
  spokes: { index: number; angle: number; value: unknown }[]
  gridRadii: number[]
  series: { key: string; color: string; values: (number | null)[]; points: { x: number; y: number }[] }[]
  sectors: SectorModel[]
  /** Above 0 when a slice or ring has a value, so 0 means an empty pie. */
  total: number
  activeIndex: number
}

type ChartModel = CartesianModel | PolarModel

interface Inspected {
  index: number
  source: 'pointer' | 'keyboard'
}

interface FrameState {
  model: ChartModel
  /** Turns a value into text, by the chart's valueFormatter or the container's locale. */
  format: (value: number, dataKey: string) => string
  size: Size
  running: boolean
  dir: 'ltr' | 'rtl'
  tooltip: ChartTooltipState
  anchor: { x: number; y: number } | null
  legend: ChartPayloadItem[]
  legendAlign: 'top' | 'bottom'
  center: ChartCenterLabelViewBox
}

function cartesianOf(handle: Handle<any, any>, part: string): CartesianModel | undefined {
  let frame: FrameState | undefined = handle.context.get(ChartFrame)
  if (!frame) throw new ChartError(`${part} must be inside a line, area or bar chart.`)
  return frame.model.kind === 'cartesian' ? frame.model : undefined
}

function polarOf(handle: Handle<any, any>, part: string, type?: ChartType): PolarModel | undefined {
  let frame: FrameState | undefined = handle.context.get(ChartFrame)
  if (!frame) throw new ChartError(`${part} must be inside a pie, radar or radial bar chart.`)
  return frame.model.kind === 'polar' && (type === undefined || frame.model.type === type) ? frame.model : undefined
}

function isElement(node: unknown): node is RemixElement {
  return typeof node === 'object' && node !== null && '$rmx' in node
}

/** The chart's parts, through arrays and fragments. Parts inside your own components can't be read. */
function partsOf(node: unknown, out: RemixElement[] = []): RemixElement[] {
  if (Array.isArray(node)) for (let child of node) partsOf(child, out)
  else if (isElement(node)) {
    if (node.type === Fragment) partsOf(node.props.children, out)
    else out.push(node)
  }
  return out
}

function propsOf<P>(parts: RemixElement[], type: unknown): P[] {
  return parts.filter((part) => part.type === type).map((part) => part.props as P)
}

function percentOf(value: number | `${number}%` | undefined, total: number, fallback: number) {
  if (value === undefined) return fallback
  return typeof value === 'number' ? value : (total * Number.parseFloat(value)) / 100
}

interface LayoutInput {
  type: ChartType
  props: CartesianChartProps & RadarChartProps & RadialBarChartProps
  parts: RemixElement[]
  config: ChartConfig
  format: (value: number) => string
  size: Size
  activeIndex: number
}

function checkSeriesKeys(keys: string[]) {
  let seen = new Set<string>()
  for (let key of keys) {
    checkKey(key, 'The series dataKey')
    if (seen.has(key)) throw new ChartError(`Two series share the dataKey "${key}". Give each series its own key.`)
    seen.add(key)
  }
}

function layoutCartesian({ type, props, parts, config, format, size, activeIndex }: LayoutInput): CartesianModel {
  let data = checkData(props.data ?? [], chartNames[type])
  let seriesProps = parts.flatMap((part) =>
    part.type === Line || part.type === Area || part.type === Bar
      ? [
          {
            kind: part.type === Line ? 'line' : part.type === Area ? 'area' : 'bar',
            ...(part.props as BarProps & AreaProps),
          } as const,
        ]
      : [],
  )
  checkSeriesKeys(seriesProps.map((series) => series.dataKey))
  let [xAxis = {} as XAxisProps] = propsOf<XAxisProps>(parts, XAxis)
  let [yAxis] = propsOf<YAxisProps>(parts, YAxis)
  let hasXAxis = parts.some((part) => part.type === XAxis)
  let margin: Margin = { top: 5, right: 5, bottom: 5, left: 5, ...props.margin }
  let { width, height, fontSize } = size
  let xKey = xAxis.dataKey

  // Values, stacked where series share a stack id: positive values up from zero, negative ones down.
  let values = seriesProps.map((series) => data.map((row, index) => readValue(row, series.dataKey, index)))
  let ranges = seriesProps.map((): ([number, number] | null)[] => [])
  let stacks = new Map<string, { up: number[]; down: number[] }>()
  seriesProps.forEach((series, seriesIndex) => {
    let stack = series.stackId === undefined ? undefined : stacks.get(series.stackId)
    if (series.stackId !== undefined && !stack) {
      stack = { up: data.map(() => 0), down: data.map(() => 0) }
      stacks.set(series.stackId, stack)
    }
    ranges[seriesIndex] = values[seriesIndex].map((value, row) => {
      if (value === null) return null
      if (!stack) return [0, value]
      let side = value >= 0 ? stack.up : stack.down
      let base = side[row]
      side[row] = base + value
      return [base, base + value]
    })
  })
  let extent = ranges.flat().flatMap((range) => range ?? [])
  let ticks = yAxis?.domain
    ? spacedTicks(yAxis.domain, yAxis.tickCount ?? 5)
    : niceTicks(Math.min(0, ...extent), Math.max(0, ...extent), yAxis?.tickCount ?? 5)
  let domain: [number, number] = yAxis?.domain ?? [ticks[0], ticks[ticks.length - 1]]

  // Room for the axes.
  let yLabelWidth = Math.max(
    0,
    ...ticks.map((value, index) =>
      textWidth(yAxis?.tickFormatter ? yAxis.tickFormatter(value, index) : format(value), fontSize),
    ),
  )
  let yWidth =
    !yAxis || yAxis.hide
      ? 0
      : (yAxis.width ?? Math.ceil(yLabelWidth + (yAxis.tickLine === false ? 0 : 6) + (yAxis.tickMargin ?? 2) + 4))
  let xHeight =
    !hasXAxis || xAxis.hide
      ? 0
      : (xAxis.height ?? Math.ceil((xAxis.tickLine === false ? 0 : 6) + (xAxis.tickMargin ?? 2) + fontSize * 1.25 + 2))
  let right = yAxis?.orientation === 'right'
  let plot = {
    left: margin.left + (right ? 0 : yWidth),
    top: margin.top,
    right: Math.max(margin.left + (right ? 0 : yWidth), width - margin.right - (right ? yWidth : 0)),
    bottom: Math.max(margin.top, height - margin.bottom - xHeight),
  }
  let y = linear(domain, [plot.bottom, plot.top])

  // Categories: bands for bar charts, points from edge to edge otherwise.
  let count = data.length
  let reversed = xAxis.reversed === true
  let span = plot.right - plot.left
  let banded = seriesProps.some((series) => series.kind === 'bar')
  let order = (index: number) => (reversed ? count - 1 - index : index)
  let categories: CategoryModel[] = data.map((row, index) => {
    let value = xKey === undefined ? index : field(row, xKey)
    if (banded) {
      let band = span / count
      let start = plot.left + band * order(index)
      return { index, value, x: start + band / 2, start, band }
    }
    let step = count > 1 ? span / (count - 1) : span
    let x = count > 1 ? plot.left + step * order(index) : plot.left + span / 2
    return { index, value, x, start: x - step / 2, band: step }
  })

  // Bars: one slot per stack, or per bar outside a stack, side by side in each band.
  let slots = [
    ...new Set(
      seriesProps.filter((series) => series.kind === 'bar').map((series) => series.stackId ?? `#${series.dataKey}`),
    ),
  ]
  let band = count > 0 ? span / count : 0
  let gapAtSide = Math.max(0, percentOf(props.barCategoryGap, band, band * 0.1))
  let barGap = props.barGap ?? 4
  let inner = Math.max(0, band - gapAtSide * 2)
  let barWidth = slots.length > 0 ? (inner - barGap * (slots.length - 1)) / slots.length : 0
  if (barWidth < 1 && slots.length > 0) {
    barGap = 0
    barWidth = inner / slots.length
  }

  let series: SeriesModel[] = seriesProps.map((props, seriesIndex) => {
    let color = seriesColor(
      props.dataKey,
      seriesIndex,
      props.kind === 'line' ? props.stroke : (props.fill ?? props.stroke),
    )
    let slot = slots.indexOf(props.stackId ?? `#${props.dataKey}`)
    let slotOrder = reversed ? slots.length - 1 - slot : slot
    return {
      key: props.dataKey,
      kind: props.kind,
      color,
      values: values[seriesIndex],
      points: ranges[seriesIndex].map((range, index) =>
        range ? { x: categories[index].x, y: y(range[1]), y0: y(range[0]) } : null,
      ),
      bars: ranges[seriesIndex].map((range, index) => {
        if (!range || props.kind !== 'bar') return null
        let [top, bottom] = [y(range[1]), y(range[0])]
        return {
          x: categories[index].start + gapAtSide + slotOrder * (barWidth + barGap),
          y: Math.min(top, bottom),
          width: barWidth,
          height: Math.abs(bottom - top),
          negative: range[1] < range[0],
        }
      }),
    }
  })

  return { kind: 'cartesian', type, config, format, fontSize, plot, categories, ticks, y, series, activeIndex }
}

function layoutPolar({ type, props, parts, config, size, activeIndex }: LayoutInput): PolarModel {
  let margin: Margin = { top: 5, right: 5, bottom: 5, left: 5, ...props.margin }
  let width = Math.max(0, size.width - margin.left - margin.right)
  let height = Math.max(0, size.height - margin.top - margin.bottom)
  let cx = margin.left + percentOf(props.cx, width, width / 2)
  let cy = margin.top + percentOf(props.cy, height, height / 2)
  let maxRadius = Math.max(0, Math.min(width, height) / 2)
  let base = {
    kind: 'polar' as const,
    type,
    config,
    cx,
    cy,
    activeIndex,
    spokes: [] as PolarModel['spokes'],
    series: [] as PolarModel['series'],
    sectors: [] as SectorModel[],
    gridRadii: [] as number[],
    total: 0,
  }

  if (type === 'pie') {
    let [pie] = propsOf<PieProps>(parts, Pie)
    let data = checkData(pie?.data ?? props.data ?? [], 'Pie')
    if (!pie)
      return { ...base, innerRadius: 0, outerRadius: maxRadius * 0.8, radiusScale: 1, startAngle: 0, endAngle: 360 }
    let dataKey = checkKey(pie.dataKey, 'The pie dataKey')
    let nameKey = pie.nameKey ?? 'name'
    let [innerRadius, outerRadius, radiusScale] = ringRadii(pie.innerRadius, pie.outerRadius, maxRadius, [0, 0.8])
    let { startAngle = 0, endAngle = 360, paddingAngle = 0 } = pie
    let values = data.map((row, index) => {
      let value = readValue(row, dataKey, index)
      checkNonNegative(value, dataKey, index, 'A pie chart')
      return value
    })
    // Shares of the values over the largest one, whose sum can't overflow as the values' own can.
    let largest = Math.max(0, ...values.map((value) => value ?? 0))
    let scaled = values.map((value) => (value !== null && largest > 0 ? value / largest : 0))
    let total = scaled.reduce((sum, value) => sum + value, 0)
    let drawn = scaled.filter((value) => value > 0).length
    let direction = Math.sign(endAngle - startAngle) || 1
    let fullSpan = Math.min(360, Math.abs(endAngle - startAngle))
    let padding = drawn > 1 ? Math.min(paddingAngle, fullSpan / drawn) : 0
    let span = Math.max(0, fullSpan - (fullSpan >= 360 ? drawn : drawn - 1) * padding)
    let angle = startAngle
    let sectors = data.map((row, index): SectorModel => {
      let value = values[index]
      let share = total > 0 ? (scaled[index] / total) * span : 0
      let start = angle
      let end = angle + share * direction
      if (share > 0) angle = end + padding * direction
      let name = String(field(row, nameKey) ?? index)
      let fill = field(row, 'fill')
      return {
        index,
        value,
        name,
        color: seriesColor(name, index, fill === undefined ? undefined : (fill as string)),
        innerRadius,
        outerRadius,
        startAngle: start,
        endAngle: end,
      }
    })
    return { ...base, innerRadius, outerRadius, radiusScale, startAngle, endAngle, sectors, total }
  }

  if (type === 'radar') {
    let data = checkData(props.data ?? [], 'RadarChart')
    let [angleAxis] = propsOf<PolarAngleAxisProps>(parts, PolarAngleAxis)
    let radars = propsOf<RadarProps>(parts, Radar)
    checkSeriesKeys(radars.map((radar) => radar.dataKey))
    let [innerRadius, outerRadius, radiusScale] = ringRadii(props.innerRadius, props.outerRadius, maxRadius, [0, 0.8])
    let { startAngle = 90, endAngle = -270 } = props
    let count = data.length
    let spokes = data.map((row, index) => ({
      index,
      angle: startAngle + ((endAngle - startAngle) * index) / Math.max(count, 1),
      value: angleAxis?.dataKey === undefined ? index : field(row, angleAxis.dataKey),
    }))
    let values = radars.map((radar) =>
      data.map((row, index) => {
        let value = readValue(row, radar.dataKey, index)
        checkNonNegative(value, radar.dataKey, index, 'A radar chart')
        return value
      }),
    )
    let ticks = niceTicks(0, Math.max(0, ...values.flat().map((value) => value ?? 0)), 5)
    let r = linear([0, ticks[ticks.length - 1]], [innerRadius, outerRadius])
    let series = radars.map((radar, seriesIndex) => ({
      key: radar.dataKey,
      color: seriesColor(radar.dataKey, seriesIndex, radar.fill ?? radar.stroke),
      values: values[seriesIndex],
      points: values[seriesIndex].map((value, index) => {
        let [x, y] = polarToCartesian(cx, cy, r(value ?? 0), spokes[index].angle)
        return { x, y }
      }),
    }))
    let gridRadii = ticks.filter((tick) => tick > 0).map(r)
    return { ...base, innerRadius, outerRadius, radiusScale, startAngle, endAngle, spokes, series, gridRadii }
  }

  // Radial bars: a ring per row, from the inner radius out, each along the angle its value takes.
  let data = checkData(props.data ?? [], 'RadialBarChart')
  let [bar] = propsOf<RadialBarProps>(parts, RadialBar)
  let [innerRadius, outerRadius, radiusScale] = ringRadii(props.innerRadius, props.outerRadius, maxRadius, [0.3, 1])
  let { startAngle = 0, endAngle = 360 } = props
  if (!bar) return { ...base, innerRadius, outerRadius, radiusScale, startAngle, endAngle }
  let dataKey = checkKey(bar.dataKey, 'The radial bar dataKey')
  let nameKey = bar.nameKey ?? 'name'
  let values = data.map((row, index) => {
    let value = readValue(row, dataKey, index)
    checkNonNegative(value, dataKey, index, 'A radial bar chart')
    return value
  })
  let [low, high] = props.domain ?? [0, Math.max(0, ...values.map((value) => value ?? 0))]
  if (!Number.isFinite(high - low)) throw rangeError(low, high)
  let angleOf = linear([low, high], [startAngle, endAngle])
  let ring = data.length > 0 ? (outerRadius - innerRadius) / data.length : 0
  let gap = Math.max(0, Math.min(ring / 2, percentOf(props.barCategoryGap, ring, ring * 0.1)))
  let sectors = data.map((row, index): SectorModel => {
    let value = values[index]
    let name = String(field(row, nameKey) ?? index)
    let fill = field(row, 'fill')
    let clamped = Math.max(low, Math.min(high, value ?? low))
    return {
      index,
      value,
      name,
      color: seriesColor(name, index, fill === undefined ? undefined : (fill as string)),
      innerRadius: innerRadius + ring * index + gap,
      outerRadius: innerRadius + ring * (index + 1) - gap,
      startAngle,
      endAngle: high === low ? startAngle : angleOf(clamped),
    }
  })
  let gridRadii = sectors.map((sector) => (sector.innerRadius + sector.outerRadius) / 2)
  let total = values.filter((value) => value !== null && value > 0).length
  return { ...base, innerRadius, outerRadius, radiusScale, startAngle, endAngle, sectors, gridRadii, total }
}

/** The rows the chart can inspect: the categories, spokes, slices or rings. */
function rowCount(model: ChartModel) {
  if (model.kind === 'cartesian') return model.categories.length
  return model.type === 'radar' ? model.spokes.length : model.sectors.length
}

/** The row under a point in chart units, or -1. */
function rowAt(model: ChartModel, [x, y]: Point): number {
  if (model.kind === 'cartesian') {
    let { plot, categories } = model
    // Across the whole width, so the margins beside the edge points count, but not over the axis below.
    if (y < plot.top - 1 || y > plot.bottom + 1 || categories.length === 0) return -1
    let nearest = categories.reduce((best, category) =>
      Math.abs(category.x - x) < Math.abs(best.x - x) ? category : best,
    )
    return nearest.index
  }
  let radius = Math.hypot(x - model.cx, y - model.cy)
  let angle = (Math.atan2(model.cy - y, x - model.cx) * 180) / Math.PI
  if (model.type === 'radar') {
    if (radius > model.outerRadius + 8 || model.spokes.length === 0) return -1
    let distance = (spoke: { angle: number }) => Math.abs(((((angle - spoke.angle) % 360) + 540) % 360) - 180)
    return model.spokes.reduce((best, spoke) => (distance(spoke) < distance(best) ? spoke : best)).index
  }
  let sector = model.sectors.find(
    (candidate) =>
      candidate.startAngle !== candidate.endAngle &&
      radius >= candidate.innerRadius &&
      radius <= candidate.outerRadius &&
      onArc(angle, candidate.startAngle, candidate.endAngle),
  )
  return sector ? sector.index : -1
}

/** Where the tooltip points for a row: the top value of a category, a slice's middle, a ring's end or a spoke's farthest value. */
function anchorOf(model: ChartModel, index: number): { x: number; y: number } {
  if (model.kind === 'cartesian') {
    let tops = model.series.flatMap((series) => {
      let point = series.points[index]
      let bar = series.bars[index]
      return bar ? [bar.y] : point ? [point.y] : []
    })
    return { x: model.categories[index].x, y: Math.min(model.plot.bottom, ...tops) }
  }
  if (model.type === 'radar') {
    let points = model.series.map((series) => series.points[index])
    let far = points.reduce<{ x: number; y: number } | undefined>(
      (best, point) =>
        !best || Math.hypot(point.x - model.cx, point.y - model.cy) > Math.hypot(best.x - model.cx, best.y - model.cy)
          ? point
          : best,
      undefined,
    )
    let [x, y] = far
      ? [far.x, far.y]
      : polarToCartesian(model.cx, model.cy, model.outerRadius, model.spokes[index].angle)
    return { x, y }
  }
  let sector = model.sectors[index]
  let angle = model.type === 'radial' ? sector.endAngle : (sector.startAngle + sector.endAngle) / 2
  let [x, y] = polarToCartesian(model.cx, model.cy, (sector.innerRadius + sector.outerRadius) / 2, angle)
  return { x, y }
}

function payloadOf(model: ChartModel, data: ChartData, index: number, pieKey: string | undefined): ChartPayloadItem[] {
  if (index < 0) return []
  if (model.kind === 'cartesian' || model.type === 'radar') {
    return model.series.map((series) => ({
      dataKey: series.key,
      name: series.key,
      value: series.values[index],
      color: series.color,
      payload: data[index],
    }))
  }
  let sector = model.sectors[index]
  return [
    { dataKey: pieKey ?? 'value', name: sector.name, value: sector.value, color: sector.color, payload: data[index] },
  ]
}

function legendOf(model: ChartModel, data: ChartData): ChartPayloadItem[] {
  if (model.kind === 'cartesian' || model.type === 'radar') {
    return model.series.map((series) => ({
      dataKey: series.key,
      name: series.key,
      value: series.key,
      color: series.color,
      payload: {},
    }))
  }
  return model.sectors.map((sector) => ({
    dataKey: sector.name,
    name: sector.name,
    value: sector.name,
    color: sector.color,
    payload: data[sector.index],
  }))
}

/** The text of a row: its category and each value, such as "February: Desktop 305, Mobile 200". */
function rowText(
  config: ChartConfig,
  label: unknown,
  payload: ChartPayloadItem[],
  format: (value: number, key: string) => string,
  list: (items: string[]) => string,
) {
  let values = list(
    payload
      .filter((item) => typeof item.value === 'number')
      .map((item) => `${itemLabel(config, item)} ${format(item.value as number, item.dataKey)}`),
  )
  let category = label === undefined ? '' : categoryText(config, label)
  return category ? `${category}: ${values}` : values
}

function listText(items: string[]) {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** A short description of the data in English, which `summary` replaces. */
function summaryOf(model: ChartModel, data: ChartData, format: (value: number, key: string) => string) {
  let name = chartNames[model.type]
  let { config } = model
  if (rowCount(model) === 0) return `${name} with no data.`
  if (model.kind === 'cartesian' || model.type === 'radar') {
    let labels = model.series.map((series) => config[series.key]?.label ?? series.key)
    let categories =
      model.kind === 'cartesian' ? model.categories.map((c) => c.value) : model.spokes.map((s) => s.value)
    let ranges = model.series.flatMap((series, index) => {
      let present = series.values.filter((value): value is number => value !== null)
      if (present.length === 0) return []
      let [low, high] = [Math.min(...present), Math.max(...present)]
      return [`${labels[index]} ranges from ${format(low, series.key)} to ${format(high, series.key)}.`]
    })
    let first = categoryText(config, categories[0])
    let last = categoryText(config, categories[categories.length - 1])
    let span = categories.length > 1 ? `, from ${first} to ${last}` : `, ${first}`
    return [`${name} of ${listText(labels)} over ${categories.length} categories${span}.`, ...ranges].join(' ')
  }
  let items = model.sectors.map((sector) => {
    let label = config[sector.name]?.label ?? sector.name
    return sector.value === null ? label : `${label} ${format(sector.value, sector.name)}`
  })
  let what = model.type === 'pie' ? `${model.sectors.length} slices` : `${model.sectors.length} rings`
  return `${name} with ${what}: ${listText(items)}.`
}

interface FrameProps extends CartesianChartProps, RadarChartProps, RadialBarChartProps {
  type: ChartType
}

const defaultHint = 'Use the arrow keys to read each value, and Home and End for the first and last.'

/** The root every chart type renders: it lays the chart out, measures its box and inspects its rows. */
function ChartFrame(handle: Handle<FrameProps, FrameState>) {
  let size: Size | undefined
  let running = false
  let dir: 'ltr' | 'rtl' = 'ltr'
  let inspected: Inspected | null = null
  // The keyboard's last row, so arrows and focus go on from it after Escape or a blur.
  let resume = -1
  // The pointer's row that Escape closed, which stays closed while the pointer stays on it.
  let dismissed = -1
  // The pointer's last position on its row, in the page, where a move toward the tooltip starts.
  let lastOnRow: Point | null = null
  let surface: HTMLElement | null = null
  let defaultApplied = false
  let state = {} as FrameState
  handle.context.set(state)

  function measure() {
    if (!surface) return false
    let rect = surface.getBoundingClientRect()
    let style = getComputedStyle(surface)
    dir = style.direction === 'rtl' ? 'rtl' : 'ltr'
    // A hidden chart has no size: keep drawing it as it was.
    if (rect.width === 0 || rect.height === 0) return false
    let next = {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      fontSize: Number.parseFloat(style.fontSize) || 12,
    }
    if (size && next.width === size.width && next.height === size.height && next.fontSize === size.fontSize)
      return false
    size = next
    return true
  }

  handle.queueTask(() => {
    running = true
    measure()
    // A press elsewhere ends the pointer's row, such as one a finger tapped and left showing. The layer
    // counts presses by their click, which WebKit leaves out for a tap on content that isn't clickable.
    document.addEventListener(
      'pointerdown',
      (event) => {
        if (inspected?.source !== 'pointer' || (event.target instanceof Node && surface?.contains(event.target))) return
        inspect(null)
      },
      { capture: true, signal: handle.signal },
    )
    void handle.update()
  })

  function inspect(next: Inspected | null) {
    if (next?.source === 'keyboard') resume = next.index
    if (next?.index === inspected?.index && next?.source === inspected?.source) return
    inspected = next
    void handle.update()
  }

  /** Closes the row the layer gives up, by Escape, a press elsewhere or its parent closing. */
  function dismiss({ reason }: DismissRequest) {
    // Escape closes the pointer's tooltip until the pointer moves to another row.
    if (reason === 'escape-key' && inspected?.source === 'pointer') dismissed = inspected.index
    inspect(null)
  }

  /** The pointer's position in chart units. */
  function pointerAt(event: PointerEvent): Point | undefined {
    if (!surface) return undefined
    let rect = surface.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return undefined
    return [
      ((event.clientX - rect.left) / rect.width) * state.size.width,
      ((event.clientY - rect.top) / rect.height) * state.size.height,
    ]
  }

  function point(event: PointerEvent) {
    let at = pointerAt(event)
    let index = at ? rowAt(state.model, at) : -1
    let page: Point = [event.clientX, event.clientY]
    // On the tooltip, or on the way there from its row, the row stays, so people can read it up close.
    if (inspected?.source === 'pointer' && index !== inspected.index && towardTooltip(page)) return
    // A row Escape closed stays closed until the pointer moves to another.
    if (index >= 0 && index === dismissed) return
    dismissed = -1
    lastOnRow = index >= 0 ? page : null
    inspect(index >= 0 ? { index, source: 'pointer' } : null)
  }

  function towardTooltip(page: Point) {
    let tooltip = surface?.querySelector('[data-slot="chart-tooltip"][data-open]')
    return tooltip !== null && tooltip !== undefined && lastOnRow !== null
      ? isOnWayTo(page, lastOnRow, tooltip.getBoundingClientRect())
      : false
  }

  return () => {
    let container = handle.context.get(ChartContainer)
    let config = container?.config ?? {}
    let format = container?.format ?? String
    let { type, children, summary, keyboardHint = defaultHint, emptyLabel = 'No data', valueFormatter } = handle.props
    let current = size ?? { ...(container?.initialDimension ?? { width: 320, height: 200 }), fontSize: 12 }
    let parts = partsOf(children)
    let [tooltipPart] = parts.filter((part) => part.type === ChartTooltip)
    let [legendPart] = parts.filter((part) => part.type === ChartLegend)
    let tooltipProps = (tooltipPart?.props ?? {}) as ChartTooltipProps
    let legendProps = (legendPart?.props ?? {}) as ChartLegendProps
    let svgParts = parts.filter((part) => part !== tooltipPart && part !== legendPart)

    let input: LayoutInput = { type, props: handle.props, parts, config, format, size: current, activeIndex: -1 }
    let polar = type === 'pie' || type === 'radar' || type === 'radial'
    let model = polar ? layoutPolar(input) : layoutCartesian(input)
    let data: ChartData =
      type === 'pie' ? (propsOf<PieProps>(parts, Pie)[0]?.data ?? handle.props.data ?? []) : (handle.props.data ?? [])
    let rows = rowCount(model)
    if (running && !defaultApplied) {
      defaultApplied = true
      let index = tooltipProps.defaultIndex
      if (index !== undefined && index >= 0 && index < rows) inspected = { index, source: 'pointer' }
    }
    if (inspected && inspected.index >= rows) inspected = null
    let index = running && inspected ? inspected.index : -1
    model.activeIndex = index

    let textFormat = (value: number, key: string) => (valueFormatter ? valueFormatter(value, key) : format(value))
    let pieKey =
      type === 'pie'
        ? propsOf<PieProps>(parts, Pie)[0]?.dataKey
        : type === 'radial'
          ? propsOf<RadialBarProps>(parts, RadialBar)[0]?.dataKey
          : undefined
    let label = (row: number) =>
      model.kind === 'cartesian'
        ? model.categories[row].value
        : model.type === 'radar'
          ? model.spokes[row].value
          : undefined
    let payload = payloadOf(model, data, index, pieKey)
    let center =
      model.kind === 'polar'
        ? { cx: model.cx, cy: model.cy, innerRadius: model.innerRadius, outerRadius: model.outerRadius }
        : {
            cx: (model.plot.left + model.plot.right) / 2,
            cy: (model.plot.top + model.plot.bottom) / 2,
            innerRadius: 0,
            outerRadius: Math.min(model.plot.right - model.plot.left, model.plot.bottom - model.plot.top) / 2,
          }
    Object.assign(state, {
      model,
      format: textFormat,
      size: current,
      running,
      dir,
      tooltip: { active: index >= 0, index, label: index >= 0 ? label(index) : undefined, payload },
      anchor: index >= 0 ? anchorOf(model, index) : null,
      legend: legendOf(model, data),
      legendAlign: legendProps.verticalAlign ?? 'bottom',
      center,
    } satisfies FrameState)

    let ids = { summary: `${handle.id}-summary`, hint: `${handle.id}-hint` }
    let name = handle.props['aria-label'] ?? (handle.props['aria-labelledby'] ? undefined : chartNames[type])
    let interactive = running && rows > 0
    let keyboard = inspected?.source === 'keyboard'
    // The keyboard marks its row even when the pointer's cursor is off, so focus stays visible.
    let showCursor = index >= 0 && (tooltipProps.cursor !== false || keyboard)
    // Only the keyboard's moves are announced: a pointer passing over the chart stays quiet.
    let list = container?.list ?? ((items: string[]) => items.join(', '))
    let announcement = keyboard && index >= 0 ? rowText(config, label(index), payload, textFormat, list) : ''

    let [xAxis] = propsOf<XAxisProps>(parts, XAxis)
    // Arrows move to the row on their side, so they swap along a reversed axis.
    let move = (key: string) =>
      getNextIndex(
        key,
        inspected?.index ?? (resume < rows ? resume : -1),
        Array.from({ length: rows }, () => false),
        {
          orientation: 'both',
          dir: model.kind === 'cartesian' && xAxis?.reversed ? 'rtl' : 'ltr',
          loop: false,
        },
      )

    let legend = legendPart ?? null
    let tableRows = Array.from({ length: rows }, (_, row) => row)
    let columns =
      model.kind === 'cartesian' || model.type === 'radar'
        ? model.series.map((series) => series.key)
        : [pieKey ?? 'value']
    let categoryKey =
      model.kind === 'cartesian'
        ? xAxis?.dataKey
        : model.type === 'radar'
          ? propsOf<PolarAngleAxisProps>(parts, PolarAngleAxis)[0]?.dataKey
          : type === 'pie'
            ? (propsOf<PieProps>(parts, Pie)[0]?.nameKey ?? 'name')
            : (propsOf<RadialBarProps>(parts, RadialBar)[0]?.nameKey ?? 'name')
    let headerOf = (key: string | undefined) => (key === undefined ? '' : (config[key]?.label ?? key))

    return (
      <div data-slot="chart-frame" data-chart-type={type} mix={frameRule}>
        {legend && legendProps.verticalAlign === 'top' ? legend : null}
        <div
          data-slot="chart-surface"
          role={interactive ? 'application' : 'img'}
          tabindex={interactive ? 0 : undefined}
          aria-label={name}
          aria-labelledby={handle.props['aria-labelledby']}
          aria-describedby={interactive ? `${ids.summary} ${ids.hint}` : ids.summary}
          data-keyboard={keyboard ? '' : undefined}
          mix={[
            surfaceRule,
            ref((node, signal) => {
              surface = node
              let observer = new ResizeObserver(() => {
                if (measure()) void handle.update()
              })
              observer.observe(node)
              signal.addEventListener('abort', () => {
                observer.disconnect()
                if (surface === node) surface = null
              })
            }),
            on('pointermove', (event) => point(event)),
            on('pointerdown', (event) => point(event)),
            on('pointerleave', (event) => {
              // A finger leaves as it lifts: keep its row until a press elsewhere or focus moves away.
              if (event.pointerType === 'touch') return
              dismissed = -1
              lastOnRow = null
              if (inspected?.source === 'pointer') inspect(null)
            }),
            on('keydown', (event) => {
              if (rows === 0 || event.altKey || event.ctrlKey || event.metaKey) return
              if (event.key === 'Escape') {
                if (inspected) {
                  event.preventDefault()
                  dismiss({ reason: 'escape-key', event })
                }
                return
              }
              let next = move(event.key)
              if (next === undefined) return
              event.preventDefault()
              inspect({ index: next, source: 'keyboard' })
            }),
            on('focus', () => {
              if (!surface?.matches(':focus-visible') || rows === 0) return
              inspect({ index: inspected?.index ?? (resume >= 0 && resume < rows ? resume : 0), source: 'keyboard' })
            }),
            on('blur', () => inspect(null)),
            // While it shows a row, the chart is a layer: Escape from anywhere closes it, also before the
            // dialog it's in, and so does a press elsewhere, such as after a tap.
            dismissableLayer({ open: running && inspected !== null, onDismiss: dismiss }),
          ]}
        >
          <svg
            data-slot="chart-svg"
            viewBox={`0 0 ${current.width} ${current.height}`}
            width="100%"
            height="100%"
            aria-hidden="true"
            focusable="false"
            mix={svgRule}
          >
            {showCursor && <ChartCursor />}
            {svgParts}
          </svg>
          {tooltipPart ?? null}
          {rows === 0 && (
            <div data-slot="chart-empty" aria-hidden="true" mix={emptyRule}>
              {emptyLabel}
            </div>
          )}
        </div>
        {legend && legendProps.verticalAlign !== 'top' ? legend : null}
        <p id={ids.summary} data-slot="chart-summary" mix={hiddenRule}>
          {summary ?? summaryOf(model, data, textFormat)}
        </p>
        {interactive && (
          <p id={ids.hint} data-slot="chart-hint" mix={hiddenRule}>
            {keyboardHint}
          </p>
        )}
        {rows > 0 && (
          // A table box ignores overflow, so a block around it hides it without widening the page.
          <div mix={hiddenRule}>
            <table data-slot="chart-table" aria-labelledby={handle.props['aria-labelledby']}>
              {name !== undefined && <caption>{name}</caption>}
              <thead>
                <tr>
                  <th scope="col">{headerOf(categoryKey)}</th>
                  {columns.map((key) => (
                    <th key={key} scope="col">
                      {headerOf(key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) => {
                  let items = payloadOf(model, data, row, pieKey)
                  let rowLabel =
                    model.kind === 'polar' && model.type !== 'radar'
                      ? (config[model.sectors[row].name]?.label ?? model.sectors[row].name)
                      : categoryText(config, label(row))
                  return (
                    <tr key={row}>
                      <th scope="row">{rowLabel}</th>
                      {items.map((item) => (
                        <td key={item.dataKey}>
                          {typeof item.value === 'number' ? textFormat(item.value, item.dataKey) : '–'}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div role="status" data-slot="chart-status" mix={hiddenRule}>
          {announcement}
        </div>
      </div>
    )
  }
}

/** Marks the row inspected: a band behind a category's bars, a line at a category, or a spoke. */
function ChartCursor(handle: Handle) {
  return () => {
    let frame = handle.context.get(ChartFrame)
    if (!frame || frame.model.activeIndex < 0) return null
    let { model } = frame
    let index = model.activeIndex
    if (model.kind === 'cartesian') {
      let category = model.categories[index]
      let { plot } = model
      if (model.series.some((series) => series.kind === 'bar')) {
        return (
          <rect
            data-slot="chart-cursor"
            x={n(category.start)}
            y={n(plot.top)}
            width={n(category.band)}
            height={n(plot.bottom - plot.top)}
            mix={cursorBandRule}
          />
        )
      }
      return (
        <line
          data-slot="chart-cursor"
          x1={n(category.x)}
          x2={n(category.x)}
          y1={n(plot.top)}
          y2={n(plot.bottom)}
          mix={cursorLineRule}
        />
      )
    }
    if (model.type === 'radar') {
      let [x, y] = polarToCartesian(model.cx, model.cy, model.outerRadius, model.spokes[index].angle)
      return (
        <line data-slot="chart-cursor" x1={n(model.cx)} y1={n(model.cy)} x2={n(x)} y2={n(y)} mix={cursorLineRule} />
      )
    }
    return null
  }
}

/** A line chart: one line per `Line` part, over categories from edge to edge. */
export function LineChart(handle: Handle<CartesianChartProps>) {
  return () => <ChartFrame type="line" {...handle.props} />
}

/** An area chart: one area per `Area` part, stacked where they share a stack id. */
export function AreaChart(handle: Handle<CartesianChartProps>) {
  return () => <ChartFrame type="area" {...handle.props} />
}

/** A bar chart: one bar per `Bar` part in each category, side by side or stacked. */
export function BarChart(handle: Handle<CartesianChartProps>) {
  return () => <ChartFrame type="bar" {...handle.props} />
}

/** A pie or donut chart of one `Pie` part's slices. */
export function PieChart(handle: Handle<PolarChartProps>) {
  return () => <ChartFrame type="pie" {...handle.props} />
}

/** A radar chart: one polygon per `Radar` part over spokes for the categories. */
export function RadarChart(handle: Handle<RadarChartProps>) {
  return () => <ChartFrame type="radar" {...handle.props} />
}

/** A radial bar chart: one ring per row of a `RadialBar` part. */
export function RadialBarChart(handle: Handle<RadialBarChartProps>) {
  return () => <ChartFrame type="radial" {...handle.props} />
}

// ---------------------------------------------------------------------------
// Styles.

const space = (steps: number) => `calc(var(--spacing) * ${steps})`

const frameRule = css({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  minHeight: '100%',
})

const surfaceRule = css({
  position: 'relative',
  flex: '1 1 0%',
  minWidth: 0,
  // A legend that wraps, such as at 320px with text at 200%, grows the box instead of hiding the plot.
  minHeight: 'var(--chart-min-height, 6rem)',
  borderRadius: 'var(--radius-sm)',
  touchAction: 'pan-y',
})

const svgRule = css({
  position: 'absolute',
  inset: 0,
  display: 'block',
  overflow: 'visible',
  // Labels keep their anchors while the page reads right to left; reversed axes mirror the chart.
  direction: 'ltr',
})

const hiddenRule = css(visuallyHidden)

const axisRule = css({
  '& text': { fill: 'var(--muted-foreground)' },
  '& line': { stroke: 'var(--border)' },
  '@media (forced-colors: active)': { '& text': { fill: 'CanvasText' }, '& line': { stroke: 'GrayText' } },
})

const gridRule = css({
  stroke: 'color-mix(in oklab, var(--border) 50%, transparent)',
  ':where([data-chart-type="radar"], [data-chart-type="pie"], [data-chart-type="radial"]) &': {
    stroke: 'var(--border)',
  },
  '@media (forced-colors: active)': { stroke: 'GrayText' },
})

const seriesRule = css({
  '@media (prefers-reduced-motion: no-preference)': {
    ...transition('opacity'),
    transitionDuration: 'var(--duration-normal)',
    '@starting-style': { opacity: 0 },
  },
})

// The keyboard's row outlines its bars, slices or rings. Forced colors keep
// the series' colors, so an edge keeps each shape apart from the page there.
const activeShape: Styles = {
  ':where([data-keyboard]) &[data-active]': { stroke: 'var(--foreground)', strokeWidth: '2' },
  '@media (forced-colors: active)': {
    stroke: 'CanvasText',
    strokeWidth: '1',
    ':where([data-keyboard]) &[data-active]': { stroke: 'Highlight', strokeWidth: '3' },
  },
}

const barRule = css(
  mergeStyles(activeShape, {
    transformBox: 'fill-box',
    transformOrigin: 'bottom',
    '&[data-negative]': { transformOrigin: 'top' },
    '@media (prefers-reduced-motion: no-preference)': {
      ...transition('transform'),
      transitionDuration: 'var(--duration-normal)',
      '@starting-style': { transform: 'scaleY(0)' },
    },
  }),
)

const sectorRule = css(activeShape)

const trackRule = css({ fill: 'var(--muted)', '@media (forced-colors: active)': { stroke: 'GrayText' } })

const cursorBandRule = css({
  fill: 'var(--muted)',
  '@media (forced-colors: active)': { fill: 'none', stroke: 'Highlight' },
})

const cursorLineRule = css({
  stroke: 'var(--border)',
  strokeWidth: '1',
  '@media (forced-colors: active)': { stroke: 'Highlight' },
})

const centerValueRule = css({
  fill: 'var(--foreground)',
  fontSize: 'var(--text-3xl)',
  fontWeight: 700,
  '&[data-size="lg"]': { fontSize: 'var(--text-4xl)' },
  '@media (forced-colors: active)': { fill: 'CanvasText' },
})

// shadcn's LabelList examples color labels with fill-foreground, or fill-background inside a bar.
const barLabelRule = css({
  fill: 'var(--foreground)',
  '&[data-inside]': { fill: 'var(--background)' },
  '@media (forced-colors: active)': { fill: 'CanvasText', '&[data-inside]': { fill: 'Canvas' } },
})

const centerCaptionRule = css({
  fill: 'var(--muted-foreground)',
  '@media (forced-colors: active)': { fill: 'CanvasText' },
})

const emptyRule = css({
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  textAlign: 'center',
})

const tooltipBoxRule = css({
  position: 'absolute',
  top: 0,
  left: 0,
  zIndex: 1,
  maxWidth: '100%',
  ...transition('opacity', 'translate', 'visibility'),
  // Open, the pointer can rest on it; closed, it lets presses through.
  '&[data-closed]': { opacity: 0, visibility: 'hidden', pointerEvents: 'none' },
  '&[data-open]': { '@starting-style': { opacity: 0 } },
})

const tooltipContentRule = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  alignItems: 'start',
  gap: space(1.5),
  minWidth: '8rem',
  maxWidth: '100%',
  paddingBlock: space(1.5),
  paddingInline: space(2.5),
  border: '1px solid color-mix(in oklab, var(--border) 50%, transparent)',
  borderRadius: 'var(--radius-lg)',
  backgroundColor: 'var(--background)',
  color: 'var(--foreground)',
  fontSize: 'var(--text-xs)',
  lineHeight: 'var(--text-xs--line-height)',
  boxShadow: 'var(--shadow-lg)',
  overflowWrap: 'anywhere',
  '@media (forced-colors: active)': { borderColor: 'CanvasText' },
})

const tooltipLabelRule = css({ fontWeight: 500 })

const tooltipItemsRule = css({ display: 'grid', gap: space(1.5) })

const tooltipItemRule = css({
  display: 'flex',
  width: '100%',
  flexWrap: 'wrap',
  alignItems: 'stretch',
  gap: space(2),
  '&[data-indicator="dot"]': { alignItems: 'center' },
  '& > svg': { width: space(2.5), height: space(2.5), color: 'var(--muted-foreground)', flex: 'none' },
})

const indicatorRule = css({
  flex: 'none',
  borderRadius: '2px',
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-bg)',
  '&[data-indicator="dot"]': { width: space(2.5), height: space(2.5) },
  '&[data-indicator="line"]': { width: space(1) },
  '&[data-indicator="dashed"]': {
    width: 0,
    borderWidth: '1.5px',
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  '&[data-indicator="dashed"][data-nested]': { marginBlock: space(0.5) },
  // Forced colors drop the background, so the border keeps the swatch.
  '@media (forced-colors: active)': { borderColor: 'CanvasText' },
})

const tooltipRowRule = css({
  display: 'flex',
  flex: '1 1 0%',
  minWidth: 0,
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  alignItems: 'center',
  columnGap: space(2),
  lineHeight: 1,
  '&[data-nested]': { alignItems: 'end' },
})

const tooltipNameRule = css({
  display: 'grid',
  gap: space(1.5),
  minWidth: 0,
  '& [data-slot="chart-tooltip-name"]': { color: 'var(--muted-foreground)' },
})

const tooltipValueRule = css({
  fontFamily: 'var(--font-mono)',
  fontWeight: 500,
  color: 'var(--foreground)',
  fontVariantNumeric: 'tabular-nums',
})

const legendRule = css({
  display: 'flex',
  justifyContent: 'center',
  paddingBlockStart: space(3),
  '&[data-vertical-align="top"]': { paddingBlockStart: 0, paddingBlockEnd: space(3) },
})

const legendListRule = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'center',
  columnGap: space(4),
  rowGap: space(1),
  margin: 0,
  padding: 0,
  listStyle: 'none',
})

const legendItemRule = css({
  display: 'flex',
  alignItems: 'center',
  gap: space(1.5),
  minWidth: 0,
  overflowWrap: 'anywhere',
  '& > svg': { width: space(3), height: space(3), color: 'var(--muted-foreground)', flex: 'none' },
})

const swatchRule = css({
  width: space(2),
  height: space(2),
  flex: 'none',
  borderRadius: '2px',
  backgroundColor: 'var(--color-bg)',
  '@media (forced-colors: active)': { border: '1px solid CanvasText' },
})
