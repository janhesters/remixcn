// RemixCN Slider: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on, ref } from 'remix/component'
import type { Dispatched, Handle, Props } from 'remix/component'

import { focusRing, mergeStyles, transition } from '#remixcn/lib/styles.ts'
import type { Styles } from '#remixcn/lib/styles.ts'

// Each thumb is a native <input type="range">: it carries the slider role, the
// value, keyboard focus and the form value, and it works before hydration and
// without JavaScript. The thumbs of a range sit on top of each other over one
// track. Once the slider hydrates, a small adapter takes over the pointer and
// the keys, so thumbs keep their order, snap the same way in every browser,
// and the range between them follows.

export type SliderOrientation = 'horizontal' | 'vertical'

/** The range every thumb moves in. getSliderRange checks and completes it. */
export interface SliderRange {
  min: number
  max: number
  step: number
  /** How far Page Up, Page Down and Shift with an arrow key move a thumb. */
  largeStep: number
  /** The steps two neighbouring thumbs keep between them. */
  minStepsBetweenValues: number
}

/** A developer error: a range or value the slider can't use. Its message names the prop. */
export class SliderError extends Error {
  constructor(message: string) {
    super(`Slider: ${message}`)
    this.name = 'SliderError'
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** Counts the decimal places of a number, also when it prints with an exponent, such as 1e-7. */
function decimalPlaces(value: number) {
  let [digits, exponent = '0'] = String(value).toLowerCase().split('e')
  let fraction = digits.split('.')[1]?.length ?? 0
  return Math.max(0, fraction - Number(exponent))
}

// Values are min plus whole steps. Rounding to the decimals of min and step
// keeps 0.1 + 0.2 at 0.3, as a native range input does.
function precise(value: number, range: SliderRange) {
  let decimals = Math.min(20, Math.max(decimalPlaces(range.min), decimalPlaces(range.step)))
  return Number(value.toFixed(decimals))
}

// Steps from min, without the float noise of the division (3.4999999999999996 is 3.5).
function stepsFromMin(value: number, range: SliderRange) {
  return Number(((value - range.min) / range.step).toFixed(9))
}

/** The highest value a thumb reaches: max, or the last step below it. */
function lastStep(range: SliderRange) {
  return precise(range.min + Math.floor(stepsFromMin(range.max, range)) * range.step, range)
}

/**
 * Checks a slider's range and fills in Base UI's defaults: 0 to 100 in steps
 * of 1. The large step defaults to a tenth of the range, at least one step,
 * as Page Up moves a native range input. Throws a SliderError for a range the
 * slider can't use.
 */
export function getSliderRange(options: Partial<SliderRange>): SliderRange {
  let { min = 0, max = 100, step = 1, minStepsBetweenValues = 0 } = options

  if (!isFiniteNumber(min)) throw new SliderError(`min must be a finite number, got ${min}`)
  if (!isFiniteNumber(max)) throw new SliderError(`max must be a finite number, got ${max}`)
  if (min >= max) throw new SliderError(`min (${min}) must be less than max (${max})`)
  if (!isFiniteNumber(step) || step <= 0) throw new SliderError(`step must be a positive finite number, got ${step}`)
  if (!Number.isInteger(minStepsBetweenValues) || minStepsBetweenValues < 0) {
    throw new SliderError(`minStepsBetweenValues must be a whole number of 0 or more, got ${minStepsBetweenValues}`)
  }

  let largeStep = options.largeStep
  if (largeStep === undefined) {
    let range = { min, max, step, largeStep: step, minStepsBetweenValues }
    largeStep = precise(Math.max(1, Math.round(stepsFromMin(min + (max - min) / 10, range))) * step, range)
  } else if (!isFiniteNumber(largeStep) || largeStep <= 0) {
    throw new SliderError(`largeStep must be a positive finite number, got ${largeStep}`)
  }

  return { min, max, step, largeStep, minStepsBetweenValues }
}

/**
 * Snaps a value to the nearest step from min and keeps it in the range, as a
 * native range input does: a value halfway between two steps takes the larger
 * one, and a max that isn't a step stops at the last step below it.
 */
export function snapSliderValue(value: number, range: SliderRange): number {
  let snapped = precise(range.min + Math.round(stepsFromMin(value, range)) * range.step, range)
  return Math.min(Math.max(snapped, range.min), lastStep(range))
}

function gap(range: SliderRange) {
  return precise(range.minStepsBetweenValues * range.step, range)
}

/**
 * Turns a value prop into one value per thumb, in thumb order: snapped,
 * clamped, sorted from lowest to highest, and moved apart to keep the
 * minimum steps between neighbours. Use it on the server too, to read a
 * submitted form with the slider's own rules. Throws a SliderError for a value
 * that isn't a finite number, an empty array, or more thumbs than the range
 * fits.
 */
export function normalizeSliderValues(value: number | readonly number[], range: SliderRange): number[] {
  let values = typeof value === 'number' ? [value] : [...value]
  if (values.length === 0) throw new SliderError('value needs at least one value, one per thumb')

  values.forEach((item, index) => {
    if (!isFiniteNumber(item)) throw new SliderError(`value[${index}] must be a finite number, got ${item}`)
  })

  let spacing = gap(range)
  let needed = precise((values.length - 1) * spacing, range)
  let available = precise(lastStep(range) - range.min, range)
  if (needed > available) {
    throw new SliderError(
      `${values.length} thumbs need ${needed} between min and max with minStepsBetweenValues ${range.minStepsBetweenValues}, but the range has ${available}`,
    )
  }

  let sorted = values.map((item) => snapSliderValue(item, range)).sort((a, b) => a - b)
  for (let index = 1; index < sorted.length; index++) {
    sorted[index] = Math.max(sorted[index], precise(sorted[index - 1] + spacing, range))
  }
  sorted[sorted.length - 1] = Math.min(sorted[sorted.length - 1], lastStep(range))
  for (let index = sorted.length - 2; index >= 0; index--) {
    sorted[index] = Math.min(sorted[index], precise(sorted[index + 1] - spacing, range))
  }
  return sorted
}

/**
 * The values one thumb may take: from its lower neighbour plus the minimum
 * steps, or min, to its upper neighbour minus them, or the last step. Thumbs
 * never cross, so a thumb keeps its index, its name and its form value.
 */
export function getThumbBounds(
  values: readonly number[],
  index: number,
  range: SliderRange,
): { lower: number; upper: number } {
  let spacing = gap(range)
  return {
    lower: index > 0 ? precise(values[index - 1] + spacing, range) : range.min,
    upper: index < values.length - 1 ? precise(values[index + 1] - spacing, range) : lastStep(range),
  }
}

/**
 * Moves one thumb towards a value: snapped, and stopped at its bounds. Returns
 * a new array, or the same array when the thumb stays where it is.
 */
export function moveSliderThumb(values: readonly number[], index: number, value: number, range: SliderRange): number[] {
  let { lower, upper } = getThumbBounds(values, index, range)
  let next = Math.min(Math.max(snapSliderValue(value, range), lower), upper)
  if (next === values[index]) return values as number[]
  return values.map((item, current) => (current === index ? next : item))
}

/** Where a value sits between min and max, from 0 to 1. */
function fraction(value: number, range: SliderRange) {
  return precise((value - range.min) / (range.max - range.min), { ...range, min: 0, step: 1e-6 })
}

// Events

const sliderChangeType = 'remixcn:slider-change' as const
const sliderCommitType = 'remixcn:slider-commit' as const

/**
 * What moved the thumbs: a key, a press on the track, a drag, a canceled drag
 * returning to where it started, a native input event (such as assistive
 * technology), or a form reset.
 */
export type SliderChangeReason = 'keyboard' | 'track-press' | 'drag' | 'cancel' | 'input' | 'reset'

/** What committed a value: a key, the end of a press or drag, or a native change event. */
export type SliderCommitReason = 'keyboard' | 'track-press' | 'drag' | 'input'

/**
 * Bubbles from the slider each time its values change, also while a thumb is
 * dragged. A controlled slider shows the new values only once its value prop
 * does. index is the thumb that moved, or -1 for a reset.
 */
export class SliderChangeEvent extends Event {
  readonly values: readonly number[]
  readonly index: number
  readonly reason: SliderChangeReason

  constructor(values: readonly number[], index: number, reason: SliderChangeReason) {
    super(sliderChangeType, { bubbles: true })
    this.values = values
    this.index = index
    this.reason = reason
  }
}

/**
 * Bubbles from the slider when the user settles on values: after each key,
 * and when a press or drag ends. A canceled drag commits nothing.
 */
export class SliderCommitEvent extends Event {
  readonly values: readonly number[]
  readonly index: number
  readonly reason: SliderCommitReason

  constructor(values: readonly number[], index: number, reason: SliderCommitReason) {
    super(sliderCommitType, { bubbles: true })
    this.values = values
    this.index = index
    this.reason = reason
  }
}

declare global {
  interface HTMLElementEventMap {
    [sliderChangeType]: SliderChangeEvent
    [sliderCommitType]: SliderCommitEvent
  }
}

type SliderEventHandler<event extends Event, target extends HTMLElement> = (
  event: Dispatched<event, target>,
  signal: AbortSignal,
) => void | Promise<void>

/** Listens for SliderChangeEvent on the slider or any ancestor: mix={onSliderChange((event) => …)}. */
export function onSliderChange<target extends HTMLElement>(
  handler: SliderEventHandler<SliderChangeEvent, target>,
  capture?: boolean,
): ReturnType<typeof on<target, typeof sliderChangeType>> {
  return on(sliderChangeType, handler, capture)
}

/** Listens for SliderCommitEvent on the slider or any ancestor: mix={onSliderCommit((event) => …)}. */
export function onSliderCommit<target extends HTMLElement>(
  handler: SliderEventHandler<SliderCommitEvent, target>,
  capture?: boolean,
): ReturnType<typeof on<target, typeof sliderCommitType>> {
  return on(sliderCommitType, handler, capture)
}

// Props

export interface SliderProps {
  /**
   * The controlled value: a number for one thumb, or one number per thumb.
   * The slider then shows only this value, and asks for changes with
   * SliderChangeEvent.
   */
  value?: number | number[]
  /** The starting value when the slider owns it, and the value a form reset returns to. One thumb at min by default. */
  defaultValue?: number | number[]
  min?: number
  max?: number
  step?: number
  /** How far Page Up, Page Down and Shift with an arrow key move a thumb. A tenth of the range by default. */
  largeStep?: number
  /** The steps two neighbouring thumbs keep between them. 0 by default, so thumbs may meet. */
  minStepsBetweenValues?: number
  orientation?: SliderOrientation
  disabled?: boolean
  /** The form field name. Each thumb submits its own value under it, from the lowest to the highest. */
  name?: string
  /** The id of a form the slider belongs to when it sits outside it. */
  form?: string
  /** The first thumb's id, so a <label for> names it. */
  id?: string
  /** Names one thumb, or the group of several thumbs and each thumb without its own label. */
  'aria-label'?: string
  /** The id of visible text that names one thumb, or the group and each thumb without its own label. */
  'aria-labelledby'?: string
  /** The id of text that describes every thumb, such as a hint. */
  'aria-describedby'?: string
  /** One name per thumb, such as ['Minimum price', 'Maximum price']. Several thumbs need them to tell them apart. */
  thumbLabels?: string[]
  /** Formats each value for screen readers, such as { style: 'currency', currency: 'EUR' }. */
  format?: Intl.NumberFormatOptions
  /** The locale of format. Set it to render the same text on the server and in the browser. */
  locale?: string
  class?: string
  style?: Props<'div'>['style']
  dir?: 'ltr' | 'rtl' | 'auto'
  [data: `data-${string}`]: string | number | boolean | undefined
}

export interface SliderRootProps extends SliderProps {
  /** Your mixins for the root element, such as css(), on() or onSliderChange(). */
  mix?: Props<'div'>['mix']
}

// Styles

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const vertical = '&[data-orientation="vertical"]'
const thumbSize = 'var(--slider-thumb-size)'
// The control takes presses on a band at least WCAG 2.2's 24px target size
// across, wider than shadcn's 16px thumb, which it centers.
const bandSize = `max(24px, ${thumbSize})`
// Where a thumb's input starts across the band, so the thumb sits in its middle.
const inset = `calc(50% - ${thumbSize} / 2)`
// Where the center of a thumb sits at a fraction of the range. A native thumb
// stays inside its input, so its center moves half a thumb in from each end.
const center = (fraction: string) => `calc(${thumbSize} / 2 + ${fraction} * (100% - ${thumbSize}))`

const rootStyles = css({
  '--slider-thumb-size': '1rem',
  display: 'block',
  width: '100%',
  [vertical]: { display: 'inline-block', width: 'auto', height: '100%' },
})

const controlStyles = css({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  height: bandSize,
  // A horizontal slider lets the page scroll vertically. A touch that scrolls
  // cancels the drag, which then returns the thumb to where it started.
  touchAction: 'pan-y',
  userSelect: 'none',
  [vertical]: {
    flexDirection: 'column',
    width: bandSize,
    height: '100%',
    minHeight: space(40),
    touchAction: 'pan-x',
  },
  // Matches disabledState in styles.ts, on the control, so the thumbs dim once.
  // A disabled fieldset disables the inputs without the disabled prop.
  '&[data-disabled], &:has(> input:disabled)': { cursor: 'not-allowed', opacity: 0.5 },
})

const trackStyles = css({
  position: 'relative',
  flexGrow: 1,
  width: '100%',
  height: space(1.5),
  overflow: 'hidden',
  borderRadius: '9999px',
  backgroundColor: 'var(--muted)',
  [vertical]: { width: space(1.5), height: '100%' },
  // Forced colors drop background colors, so the track draws its edge.
  '@media (forced-colors: active)': { border: '1px solid CanvasText' },
})

const rangeStyles = css({
  position: 'absolute',
  insetBlock: 0,
  insetInlineStart: center('var(--slider-start)'),
  insetInlineEnd: `calc(100% - ${center('var(--slider-end)')})`,
  backgroundColor: 'var(--primary)',
  '&[data-from-start]': { insetInlineStart: 0 },
  [vertical]: {
    insetInline: 0,
    insetBlock: 'auto',
    bottom: center('var(--slider-start)'),
    top: `calc(100% - ${center('var(--slider-end)')})`,
  },
  [`${vertical}[data-from-start]`]: { bottom: 0 },
  '@media (forced-colors: active)': {
    backgroundColor: 'Highlight',
    '&[data-disabled], :where([data-slot="slider-control"]:has(> input:disabled)) &': { backgroundColor: 'GrayText' },
  },
})

const thumbLook: Styles = mergeStyles(
  {
    boxSizing: 'border-box',
    width: thumbSize,
    height: thumbSize,
    border: '1px solid var(--primary)',
    borderRadius: '9999px',
    backgroundColor: 'white',
    boxShadow: 'var(--shadow-sm)',
    // The inputs of a range overlap, so only their thumbs take the pointer.
    pointerEvents: 'auto',
  },
  transition('box-shadow'),
)
const thumbHalo = { boxShadow: '0 0 0 4px color-mix(in oklab, var(--ring) 50%, transparent)' }

// Firefox and Chromium-based browsers and Safari name the thumb differently,
// and a browser drops a whole rule with a selector it doesn't know, so each
// name gets its own rule.
function thumbPart(part: '::-webkit-slider-thumb' | '::-moz-range-thumb'): Styles {
  let look: Styles = part === '::-webkit-slider-thumb' ? mergeStyles({ appearance: 'none' }, thumbLook) : thumbLook
  let forcedColors: Styles = {}
  forcedColors[`&${part}`] = { borderColor: 'CanvasText' }
  let styles: Styles = { '@media (forced-colors: active)': forcedColors }
  styles[`&${part}`] = look
  styles[`&:hover${part}, &[data-dragging]${part}`] = thumbHalo
  styles[`&:disabled${part}`] = { pointerEvents: 'none' }
  return mergeStyles(styles, focusRing(`&:focus-visible${part}`))
}

const thumbStyles = css(
  mergeStyles(
    {
      // Each input spans the whole track and is as tall as its thumb, so the
      // browser places the thumb by its value. The inputs of a range overlap.
      position: 'absolute',
      insetInlineStart: 0,
      top: inset,
      width: '100%',
      height: thumbSize,
      margin: 0,
      padding: 0,
      appearance: 'none',
      backgroundColor: 'transparent',
      pointerEvents: 'none',
      // The ring moves to the thumb, which is all you see of the input.
      '&:focus-visible': { outline: 'none' },
      '&::-moz-range-track': { backgroundColor: 'transparent' },
      [vertical]: {
        insetInlineStart: 'auto',
        top: 0,
        left: inset,
        width: thumbSize,
        height: '100%',
        writingMode: 'vertical-lr',
        direction: 'rtl',
      },
    },
    thumbPart('::-webkit-slider-thumb'),
    thumbPart('::-moz-range-thumb'),
  ),
)

// The adapter

type Drag = {
  pointerId: number
  /** The thumb that moves, or the thumbs that sit on the same value until the pointer picks a side. */
  index: number
  tied: number[]
  startValues: readonly number[]
  reason: 'track-press' | 'drag'
  controller: AbortController
}

const ownEvents = new WeakSet<Event>()

function sameValues(a: readonly number[], b: readonly number[]) {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

/** Which thumb a press at this value moves: the nearest, or, among thumbs on the same value, the one on the pressed side. */
function closestThumb(values: readonly number[], value: number): { index: number; tied: number[] } {
  let distances = values.map((item) => Math.abs(item - value))
  let nearest = Math.min(...distances)
  let candidates = distances.flatMap((distance, index) => (distance === nearest ? [index] : []))
  let first = candidates[0]
  if (candidates.length === 1 || values[candidates.at(-1)!] !== values[first]) return { index: first, tied: [] }
  if (value > values[first]) return { index: candidates.at(-1)!, tied: [] }
  if (value < values[first]) return { index: first, tied: [] }
  return { index: first, tied: candidates }
}

/**
 * The slider, for use inside a component that hydrates, such as your own
 * client entry. It takes mixins for its root. Render Slider instead in
 * server-rendered UI.
 */
export function SliderRoot(handle: Handle<SliderRootProps>) {
  let uncontrolled: number[] | undefined
  // The value a controlled slider first rendered, which a reset returns to without a defaultValue.
  let initialControlled: number[] | undefined
  let current: number[] = []
  let range: SliderRange = getSliderRange({})
  let root: HTMLElement | undefined
  let control: HTMLElement | undefined
  let inputs: HTMLInputElement[] = []
  let drag: Drag | undefined
  let hydrated = false

  function isControlled() {
    return handle.props.value !== undefined
  }

  // A reset returns to defaultValue, or to the value a controlled slider first
  // rendered. A slider whose number of thumbs changed since keeps its values.
  function resetValues() {
    let { defaultValue } = handle.props
    let values =
      defaultValue !== undefined
        ? normalizeSliderValues(defaultValue, range)
        : (initialControlled ?? normalizeSliderValues(range.min, range))
    return values.length === current.length ? values : current
  }

  // A disabled fieldset disables the inputs natively, without the disabled prop.
  function isDisabled() {
    return Boolean(handle.props.disabled) || inputs.some((input) => input?.matches(':disabled'))
  }

  function isRtl(element: Element) {
    return getComputedStyle(element).direction === 'rtl'
  }

  /** Writes the shown values into the inputs, which a reset or a native event may have changed. */
  function syncInputs() {
    current.forEach((value, index) => {
      let input = inputs[index]
      if (input && input.value !== String(value)) input.value = String(value)
    })
  }

  function dispatchNative(input: HTMLInputElement | undefined, type: 'input' | 'change') {
    if (!input) return
    let event = new Event(type, { bubbles: true })
    ownEvents.add(event)
    input.dispatchEvent(event)
  }

  /**
   * Applies new values: an uncontrolled slider keeps them, and the inputs and
   * listeners see them at once. A controlled slider returns to its value prop
   * unless its owner renders the new one.
   */
  function change(next: readonly number[], index: number, reason: SliderChangeReason, native = false) {
    if (sameValues(next, current)) return false
    let values = [...next]
    if (!isControlled()) uncontrolled = values
    current = values
    values.forEach((value, thumb) => {
      let input = inputs[thumb]
      if (input && input.value !== String(value)) input.value = String(value)
    })
    if (!native && index >= 0) dispatchNative(inputs[index], 'input')
    root?.dispatchEvent(new SliderChangeEvent(values, index, reason))
    void handle.update().then(() => {
      if (!handle.signal.aborted) syncInputs()
    })
    return true
  }

  function commit(index: number, reason: SliderCommitReason, native = false) {
    if (!native) dispatchNative(inputs[index], 'change')
    root?.dispatchEvent(new SliderCommitEvent([...current], index, reason))
  }

  function endDrag() {
    if (!drag) return
    let { controller, pointerId } = drag
    drag = undefined
    controller.abort()
    if (control?.hasPointerCapture(pointerId)) control.releasePointerCapture(pointerId)
    if (!handle.signal.aborted) void handle.update()
  }

  // Returns the dragged thumb to where the drag started. The other thumbs keep
  // their values, which the owner may have changed during the drag.
  function cancelDrag() {
    if (!drag) return
    let { startValues, index } = drag
    endDrag()
    if (handle.signal.aborted || index >= current.length) return
    change(moveSliderThumb(current, index, startValues[index], range), index, 'cancel')
  }

  function valueAt(event: PointerEvent) {
    let rect = control!.getBoundingClientRect()
    let firstInput = inputs[0]
    let orientation = handle.props.orientation ?? 'horizontal'
    let size = orientation === 'vertical' ? rect.width : rect.height
    if (firstInput) {
      let inputRect = firstInput.getBoundingClientRect()
      size = orientation === 'vertical' ? inputRect.width : inputRect.height
    }

    let along: number
    if (orientation === 'vertical') {
      along = (rect.bottom - event.clientY - size / 2) / (rect.height - size)
    } else {
      along = (event.clientX - rect.left - size / 2) / (rect.width - size)
      if (isRtl(control!)) along = 1 - along
    }
    let clamped = Math.min(Math.max(Number.isFinite(along) ? along : 0, 0), 1)
    return range.min + clamped * (range.max - range.min)
  }

  function moveTo(value: number, reason: 'track-press' | 'drag') {
    if (!drag) return
    if (drag.tied.length > 0) {
      let tiedValue = current[drag.tied[0]]
      let snapped = snapSliderValue(value, range)
      if (snapped === tiedValue) return
      drag.index = snapped > tiedValue ? drag.tied.at(-1)! : drag.tied[0]
      drag.tied = []
      inputs[drag.index]?.focus({ preventScroll: true })
    }
    let next = moveSliderThumb(current, drag.index, value, range)
    if (change(next, drag.index, reason)) drag.reason = reason
  }

  function startDrag(event: PointerEvent) {
    if (drag || !control || isDisabled()) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    // Keeps the native input from dragging or taking focus itself, and the page from selecting text.
    event.preventDefault()

    let value = valueAt(event)
    let { index, tied } = closestThumb(current, value)
    let controller = new AbortController()
    drag = { pointerId: event.pointerId, index, tied, startValues: current, reason: 'track-press', controller }
    // Capture keeps the drag going outside the control. A script's synthetic
    // pointer has no active pointer to capture, and still drags inside it.
    try {
      control.setPointerCapture(event.pointerId)
    } catch {}
    inputs[index]?.focus({ preventScroll: true })

    let options = { signal: controller.signal }
    let mine = (pointer: PointerEvent) => drag !== undefined && pointer.pointerId === drag.pointerId
    control.addEventListener(
      'pointermove',
      (move) => {
        if (!mine(move)) return
        if (isDisabled()) return cancelDrag()
        moveTo(valueAt(move), 'drag')
      },
      options,
    )
    control.addEventListener(
      'pointerup',
      (up) => {
        if (!mine(up)) return
        if (isDisabled()) return cancelDrag()
        let { index: thumb, startValues, reason } = drag!
        endDrag()
        if (!sameValues(startValues, current)) commit(thumb, reason)
      },
      options,
    )
    control.addEventListener('pointercancel', (cancel) => mine(cancel) && cancelDrag(), options)
    control.addEventListener('lostpointercapture', (lost) => mine(lost) && cancelDrag(), options)

    moveTo(value, 'track-press')
    void handle.update()
  }

  function keyTarget(event: KeyboardEvent, index: number): number | undefined {
    let orientation = handle.props.orientation ?? 'horizontal'
    let rtl = orientation === 'horizontal' && isRtl(event.currentTarget as Element)
    let size = event.shiftKey ? Math.max(range.largeStep, range.step) : range.step
    let value = current[index]
    let { lower, upper } = getThumbBounds(current, index, range)

    switch (event.key) {
      case 'ArrowUp':
        return value + size
      case 'ArrowDown':
        return value - size
      case 'ArrowRight':
        return rtl ? value - size : value + size
      case 'ArrowLeft':
        return rtl ? value + size : value - size
      case 'PageUp':
        return value + Math.max(range.largeStep, range.step)
      case 'PageDown':
        return value - Math.max(range.largeStep, range.step)
      case 'Home':
        return lower
      case 'End':
        return upper
    }
  }

  function onKey(event: KeyboardEvent, index: number) {
    if (isDisabled() || event.altKey || event.ctrlKey || event.metaKey) return
    let target = keyTarget(event, index)
    if (target === undefined) return
    event.preventDefault()
    if (change(moveSliderThumb(current, index, target, range), index, 'keyboard')) commit(index, 'keyboard')
  }

  // Assistive technology may set a native range input's value and fire input
  // and change itself. The slider keeps that value inside the thumb's bounds.
  function onNativeInput(event: Event, index: number) {
    if (ownEvents.has(event)) return
    let input = event.currentTarget as HTMLInputElement
    let next = moveSliderThumb(current, index, Number(input.value), range)
    if (!change(next, index, 'input', true)) syncInputs()
  }

  function onNativeChange(event: Event, index: number) {
    if (ownEvents.has(event)) return
    commit(index, 'input', true)
  }

  // Before hydration, the native inputs work on their own. Values the user set
  // then become an uncontrolled slider's own once it hydrates.
  function adoptInputs() {
    let dom = inputs.slice(0, current.length).map((input) => Number(input?.value))
    if (!isControlled() && dom.length === current.length && dom.every(Number.isFinite)) {
      let adopted = normalizeSliderValues(dom, range)
      if (!sameValues(adopted, current)) {
        uncontrolled = adopted
        current = adopted
        void handle.update()
      }
    }
    syncInputs()
  }

  // A form reset returns each input to its default value. The slider follows
  // once the reset has finished, and tells a controlled owner. A listener may
  // cancel the reset after this one runs, so the slider checks afterwards.
  function onReset(event: Event) {
    let form = inputs[0]?.form
    if (!form || event.target !== form) return
    let timer = setTimeout(() => {
      if (handle.signal.aborted || event.defaultPrevented) return
      cancelDrag()
      if (!change(resetValues(), -1, 'reset')) syncInputs()
    })
    handle.signal.addEventListener('abort', () => clearTimeout(timer), { once: true })
  }

  handle.queueTask(() => {
    document.addEventListener('reset', onReset, { capture: true, signal: handle.signal })
    handle.signal.addEventListener('abort', () => drag?.controller.abort(), { once: true })
  })

  return () => {
    let {
      value,
      defaultValue,
      min,
      max,
      step,
      largeStep,
      minStepsBetweenValues,
      orientation = 'horizontal',
      disabled = false,
      name,
      form,
      id,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledby,
      'aria-describedby': ariaDescribedby,
      thumbLabels,
      format,
      locale,
      mix,
      style,
      ...rootProps
    } = handle.props

    range = getSliderRange({ min, max, step, largeStep, minStepsBetweenValues })
    if (value !== undefined) {
      current = normalizeSliderValues(value, range)
      initialControlled ??= current
    } else {
      uncontrolled = normalizeSliderValues(uncontrolled ?? defaultValue ?? range.min, range)
      current = uncontrolled
    }

    // New props may end a drag: disabling cancels it, and a thumb the owner
    // removed ends it where the owner's value is, without restoring old values.
    if (drag && disabled) handle.queueTask(cancelDrag)
    else if (drag && [drag.index, ...drag.tied].some((index) => index >= current.length)) handle.queueTask(endDrag)
    // The slider writes each input's value itself after a render. A value prop
    // would let the runtime restore the server's value on hydration, over one
    // the user set before.
    handle.queueTask(() => {
      if (hydrated) return syncInputs()
      hydrated = true
      adoptInputs()
    })

    let multiple = current.length > 1
    let formatter = format ? new Intl.NumberFormat(locale, format) : undefined
    let state = {
      'data-orientation': orientation,
      'data-disabled': disabled || undefined,
      'data-dragging': drag ? true : undefined,
    }
    let fill = {
      '--slider-start': String(multiple ? fraction(current[0], range) : 0),
      '--slider-end': String(fraction(current[current.length - 1], range)),
    }
    let fillText = Object.entries(fill)
      .map(([property, amount]) => `${property}: ${amount}`)
      .join('; ')

    return (
      <div
        {...rootProps}
        data-slot="slider"
        {...state}
        role={multiple && (ariaLabel || ariaLabelledby) ? 'group' : undefined}
        aria-label={multiple ? ariaLabel : undefined}
        aria-labelledby={multiple ? ariaLabelledby : undefined}
        style={typeof style === 'string' ? `${style}; ${fillText}` : { ...style, ...fill }}
        mix={[
          rootStyles,
          ref((node, signal) => {
            root = node
            signal.addEventListener('abort', () => root === node && (root = undefined))
          }),
          mix,
        ]}
      >
        <div
          data-slot="slider-control"
          {...state}
          mix={[
            controlStyles,
            ref((node, signal) => {
              control = node
              signal.addEventListener('abort', () => control === node && (control = undefined))
            }),
            on<HTMLDivElement, 'pointerdown'>('pointerdown', startDrag),
          ]}
        >
          <div data-slot="slider-track" {...state} mix={trackStyles}>
            <div data-slot="slider-range" {...state} data-from-start={multiple ? undefined : true} mix={rangeStyles} />
          </div>
          {current.map((thumbValue, index) => {
            let ownLabel = thumbLabels?.[index]
            // The native min and max keep the shared track's geometry. A thumb
            // whose neighbours narrow its bounds tells assistive technology.
            let { lower, upper } = getThumbBounds(current, index, range)
            return (
              <input
                key={index}
                type="range"
                data-slot="slider-thumb"
                data-index={index}
                {...state}
                data-dragging={drag?.index === index ? true : undefined}
                id={index === 0 ? id : undefined}
                name={name}
                form={form}
                min={range.min}
                max={range.max}
                step={range.step}
                defaultValue={String(thumbValue)}
                disabled={disabled}
                aria-label={ownLabel ?? ariaLabel}
                aria-labelledby={ownLabel ? undefined : ariaLabelledby}
                aria-describedby={ariaDescribedby}
                aria-valuemin={lower !== range.min ? lower : undefined}
                aria-valuemax={upper !== range.max ? upper : undefined}
                aria-orientation={orientation === 'vertical' ? 'vertical' : undefined}
                aria-valuetext={formatter?.format(thumbValue)}
                mix={[
                  thumbStyles,
                  ref((node, signal) => {
                    inputs[index] = node
                    signal.addEventListener('abort', () => inputs[index] === node && delete inputs[index])
                  }),
                  on('keydown', (event) => onKey(event, index)),
                  on('input', (event) => onNativeInput(event, index)),
                  on('change', (event) => onNativeChange(event, index)),
                ]}
              />
            )
          })}
        </div>
      </div>
    )
  }
}

/**
 * shadcn's Slider: one thumb for a number, one thumb per value for an array.
 * It hydrates by itself, so it works in server-rendered UI. Listen for
 * SliderChangeEvent and SliderCommitEvent on an ancestor, or read the form.
 */
export const Slider = clientEntry(import.meta.url, function Slider(handle: Handle<SliderProps>) {
  return () => <SliderRoot {...handle.props} />
})
