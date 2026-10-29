import { createRoot, css, on, ref } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { onSliderChange, Slider, SliderError, SliderRoot } from './slider.tsx'
import type { SliderChangeEvent, SliderCommitEvent } from './slider.tsx'

// 216px wide with a 16px thumb leaves 200px of travel, so 2px is one percent.
const frame = 'width: 216px; height: 240px; padding: 0; font-size: 16px; --spacing: 0.25rem'

function mount(t: TestContext, node: RemixNode) {
  let result = render(<div style={frame}>{node}</div>)
  t.after(result.cleanup)
  return result
}

function thumbs(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLInputElement>('input[data-slot="slider-thumb"]')]
}

function slot(container: HTMLElement, name: string) {
  let element = container.querySelector<HTMLElement>(`[data-slot="${name}"]`)
  assert.ok(element, `no ${name}`)
  return element
}

/** Records what the slider tells its ancestors, in order. */
function record(container: HTMLElement) {
  let log: string[] = []
  container.addEventListener('remixcn:slider-change', (event: SliderChangeEvent) => {
    log.push(`change ${event.reason} ${event.index} [${event.values.join(', ')}]`)
  })
  container.addEventListener('remixcn:slider-commit', (event: SliderCommitEvent) => {
    log.push(`commit ${event.reason} ${event.index} [${event.values.join(', ')}]`)
  })
  container.addEventListener('input', (event) => log.push(`input ${(event.target as HTMLInputElement).value}`))
  container.addEventListener('change', (event) => log.push(`native change ${(event.target as HTMLInputElement).value}`))
  return log
}

function press(input: HTMLInputElement, key: string, init: KeyboardEventInit = {}) {
  let event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  input.dispatchEvent(event)
  return event
}

/** Where a value sits on screen, for a pointer event. */
function at(container: HTMLElement, fraction: number, axis: 'x' | 'y' = 'x') {
  let rect = slot(container, 'slider-control').getBoundingClientRect()
  if (axis === 'y')
    return { clientX: rect.left + rect.width / 2, clientY: rect.bottom - 8 - fraction * (rect.height - 16) }
  return { clientX: rect.left + 8 + fraction * (rect.width - 16), clientY: rect.top + rect.height / 2 }
}

function pointer(
  target: Element,
  type: string,
  position: { clientX: number; clientY: number },
  init: PointerEventInit = {},
) {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 7,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      ...position,
      ...init,
    }),
  )
}

function values(container: HTMLElement) {
  return thumbs(container).map((input) => input.value)
}

describe('Slider keyboard', () => {
  it('moves by a step with the arrows, a large step with Page Up, Page Down and Shift, and to the ends with Home and End', async (t) => {
    let { container, act } = mount(t, <Slider aria-label="Volume" defaultValue={50} />)
    let [thumb] = thumbs(container)
    let moves: Array<[string, KeyboardEventInit, string]> = [
      ['ArrowRight', {}, '51'],
      ['ArrowUp', {}, '52'],
      ['ArrowLeft', {}, '51'],
      ['ArrowDown', {}, '50'],
      ['PageUp', {}, '60'],
      ['PageDown', {}, '50'],
      ['ArrowUp', { shiftKey: true }, '60'],
      ['ArrowLeft', { shiftKey: true }, '50'],
      ['End', {}, '100'],
      ['Home', {}, '0'],
    ]

    for (let [key, init, expected] of moves) {
      let event = press(thumb, key, init)
      await act(() => {})
      assert.equal(thumb.value, expected, `${key} ${JSON.stringify(init)}`)
      assert.equal(event.defaultPrevented, true)
    }
  })

  it('fires input and change on the thumb, then a change and a commit with every value, once per key', async (t) => {
    let { container, act } = mount(t, <Slider aria-label="Window" defaultValue={[20, 60]} />)
    let log = record(container)

    await act(() => press(thumbs(container)[1], 'ArrowRight'))

    assert.deepEqual(log, ['input 61', 'change keyboard 1 [20, 61]', 'native change 61', 'commit keyboard 1 [20, 61]'])
  })

  it('stays put and tells no one at an end, but keeps the key from scrolling the page', async (t) => {
    let { container, act } = mount(t, <Slider aria-label="Volume" defaultValue={100} />)
    let log = record(container)

    let event = press(thumbs(container)[0], 'PageUp')
    await act(() => {})

    assert.equal(event.defaultPrevented, true)
    assert.deepEqual(log, [])
  })

  it('leaves other keys and shortcuts to the browser', async (t) => {
    let { container, act } = mount(t, <Slider aria-label="Volume" defaultValue={50} />)

    for (let [key, init] of [
      ['Tab', {}],
      ['a', {}],
      ['ArrowRight', { altKey: true }],
      ['Home', { metaKey: true }],
    ] as const) {
      let event = press(thumbs(container)[0], key, init)
      await act(() => {})
      assert.equal(event.defaultPrevented, false, key)
    }
    assert.deepEqual(values(container), ['50'])
  })

  it('keeps fractional steps exact', async (t) => {
    let { container, act } = mount(t, <Slider aria-label="Temperature" defaultValue={0.7} max={1} step={0.1} />)
    let [thumb] = thumbs(container)

    await act(() => press(thumb, 'ArrowRight'))
    assert.equal(thumb.value, '0.8')
    await act(() => press(thumb, 'ArrowRight'))
    await act(() => press(thumb, 'ArrowRight'))
    assert.equal(thumb.value, '1')
    await act(() => press(thumb, 'PageDown'))
    assert.equal(thumb.value, '0.9')
  })

  it('reverses the left and right arrows in right-to-left text, but not up and down', async (t) => {
    let { container, act } = mount(
      t,
      <div dir="rtl">
        <Slider aria-label="Volume" defaultValue={50} />
      </div>,
    )
    let [thumb] = thumbs(container)

    await act(() => press(thumb, 'ArrowRight'))
    assert.equal(thumb.value, '49')
    await act(() => press(thumb, 'ArrowLeft'))
    await act(() => press(thumb, 'ArrowLeft'))
    assert.equal(thumb.value, '51')
    await act(() => press(thumb, 'ArrowUp'))
    assert.equal(thumb.value, '52')
  })

  it('moves a vertical thumb up with the up and right arrows, also in right-to-left text', async (t) => {
    let { container, act } = mount(
      t,
      <div dir="rtl">
        <Slider aria-label="Bass" orientation="vertical" defaultValue={50} />
      </div>,
    )
    let [thumb] = thumbs(container)

    await act(() => press(thumb, 'ArrowUp'))
    await act(() => press(thumb, 'ArrowRight'))
    assert.equal(thumb.value, '52')
    await act(() => press(thumb, 'ArrowLeft'))
    assert.equal(thumb.value, '51')
  })

  it("stops a thumb at its neighbour, minus the minimum steps, and keeps each thumb's input and name", async (t) => {
    let { container, act } = mount(
      t,
      <Slider
        thumbLabels={['Minimum price', 'Maximum price']}
        defaultValue={[200, 300]}
        max={1000}
        step={10}
        minStepsBetweenValues={5}
      />,
    )
    let [low, high] = thumbs(container)

    await act(() => press(low, 'End'))
    assert.deepEqual(values(container), ['250', '300'])
    await act(() => press(low, 'PageUp'))
    assert.deepEqual(values(container), ['250', '300'])
    await act(() => press(high, 'Home'))
    assert.deepEqual(values(container), ['250', '300'])
    await act(() => press(high, 'End'))
    assert.deepEqual(values(container), ['250', '1000'])

    assert.deepEqual(thumbs(container), [low, high])
    assert.deepEqual(
      [low, high].map((input) => input.getAttribute('aria-label')),
      ['Minimum price', 'Maximum price'],
    )
  })

  it('ignores keys while disabled', async (t) => {
    let { container, act } = mount(t, <Slider aria-label="Volume" defaultValue={50} disabled />)
    let log = record(container)

    await act(() => press(thumbs(container)[0], 'ArrowRight'))

    assert.deepEqual(values(container), ['50'])
    assert.deepEqual(log, [])
  })
})

describe('Slider pointer', () => {
  it('moves the nearest thumb to a pressed spot on the track, focuses it, and commits on release', async (t) => {
    let { container, act } = mount(t, <Slider aria-label="Window" defaultValue={[20, 60]} />)
    let log = record(container)
    let control = slot(container, 'slider-control')

    await act(() => pointer(control, 'pointerdown', at(container, 0.7)))
    assert.deepEqual(values(container), ['20', '70'])
    assert.equal(document.activeElement, thumbs(container)[1])
    assert.equal(slot(container, 'slider').hasAttribute('data-dragging'), true)
    assert.equal(thumbs(container)[1].hasAttribute('data-dragging'), true)

    await act(() => pointer(control, 'pointerup', at(container, 0.7)))
    assert.equal(slot(container, 'slider').hasAttribute('data-dragging'), false)
    assert.deepEqual(log, [
      'input 70',
      'change track-press 1 [20, 70]',
      'native change 70',
      'commit track-press 1 [20, 70]',
    ])
  })

  it('drags a thumb, snapping to steps, and commits once when the drag ends', async (t) => {
    let { container, act } = mount(t, <Slider aria-label="Volume" defaultValue={20} step={10} />)
    let log = record(container)
    let control = slot(container, 'slider-control')

    await act(() => pointer(thumbs(container)[0], 'pointerdown', at(container, 0.2)))
    await act(() => pointer(control, 'pointermove', at(container, 0.33)))
    await act(() => pointer(control, 'pointermove', at(container, 0.36)))
    await act(() => pointer(control, 'pointermove', at(container, 1.4)))
    await act(() => pointer(control, 'pointerup', at(container, 1.4)))

    assert.deepEqual(values(container), ['100'])
    assert.deepEqual(log, [
      'input 30',
      'change drag 0 [30]',
      'input 40',
      'change drag 0 [40]',
      'input 100',
      'change drag 0 [100]',
      'native change 100',
      'commit drag 0 [100]',
    ])
  })

  it('stops a dragged thumb at its neighbour', async (t) => {
    let { container, act } = mount(t, <Slider aria-label="Window" defaultValue={[20, 60]} minStepsBetweenValues={5} />)
    let control = slot(container, 'slider-control')

    await act(() => pointer(control, 'pointerdown', at(container, 0.2)))
    await act(() => pointer(control, 'pointermove', at(container, 0.9)))
    await act(() => pointer(control, 'pointerup', at(container, 0.9)))

    assert.deepEqual(values(container), ['55', '60'])
  })

  it('lets the pointer pick which of two thumbs on the same value moves', async (t) => {
    let { container, act } = mount(t, <Slider aria-label="Window" defaultValue={[100, 100]} />)
    let control = slot(container, 'slider-control')

    await act(() => pointer(control, 'pointerdown', at(container, 1)))
    assert.deepEqual(values(container), ['100', '100'])
    await act(() => pointer(control, 'pointermove', at(container, 0.8)))
    await act(() => pointer(control, 'pointerup', at(container, 0.8)))
    assert.deepEqual(values(container), ['80', '100'])
    assert.equal(document.activeElement, thumbs(container)[0])

    await act(() => pointer(control, 'pointerdown', at(container, 0.8)))
    await act(() => pointer(control, 'pointermove', at(container, 0.9)))
    await act(() => pointer(control, 'pointerup', at(container, 0.9)))
    assert.deepEqual(values(container), ['90', '100'])
  })

  it('returns to where the drag started when the browser cancels it, and commits nothing', async (t) => {
    let { container, act } = mount(t, <Slider aria-label="Volume" defaultValue={30} />)
    let log = record(container)
    let control = slot(container, 'slider-control')

    await act(() => pointer(control, 'pointerdown', at(container, 0.5), { pointerType: 'touch' }))
    await act(() => pointer(control, 'pointermove', at(container, 0.6), { pointerType: 'touch' }))
    await act(() => pointer(control, 'pointercancel', at(container, 0.6), { pointerType: 'touch' }))
    await act(() => pointer(control, 'pointerup', at(container, 0.6), { pointerType: 'touch' }))

    assert.deepEqual(values(container), ['30'])
    assert.deepEqual(log, [
      'input 50',
      'change track-press 0 [50]',
      'input 60',
      'change drag 0 [60]',
      'input 30',
      'change cancel 0 [30]',
    ])
    assert.equal(slot(container, 'slider').hasAttribute('data-dragging'), false)
  })

  it('reads a right-to-left track from the right and a vertical track from the bottom', async (t) => {
    let { container, act } = mount(
      t,
      <div dir="rtl">
        <Slider aria-label="Volume" defaultValue={50} />
      </div>,
    )
    let control = slot(container, 'slider-control')
    await act(() => pointer(control, 'pointerdown', at(container, 0.1)))
    await act(() => pointer(control, 'pointerup', at(container, 0.1)))
    assert.deepEqual(values(container), ['90'])

    let vertical = mount(t, <Slider aria-label="Bass" orientation="vertical" defaultValue={50} />)
    let verticalControl = slot(vertical.container, 'slider-control')
    await vertical.act(() => pointer(verticalControl, 'pointerdown', at(vertical.container, 0.75, 'y')))
    await vertical.act(() => pointer(verticalControl, 'pointerup', at(vertical.container, 0.75, 'y')))
    assert.deepEqual(values(vertical.container), ['75'])
  })

  it('takes presses on a band of at least 24px across the track, around the 16px thumbs', async (t) => {
    let { container, act } = mount(t, <Slider aria-label="Volume" defaultValue={50} />)
    let control = slot(container, 'slider-control')
    let band = control.getBoundingClientRect()
    let input = thumbs(container)[0].getBoundingClientRect()
    let edge = { clientX: at(container, 0.8).clientX, clientY: band.top + 1 }

    assert.equal(band.height, 24)
    assert.equal(input.height, 16)
    assert.equal(input.top - band.top, 4)
    assert.equal(document.elementFromPoint(edge.clientX, edge.clientY), control)
    await act(() => pointer(control, 'pointerdown', edge))
    await act(() => pointer(control, 'pointerup', edge))
    assert.deepEqual(values(container), ['80'])

    let vertical = mount(t, <Slider aria-label="Bass" orientation="vertical" defaultValue={50} />)
    let verticalBand = slot(vertical.container, 'slider-control').getBoundingClientRect()
    let verticalInput = thumbs(vertical.container)[0].getBoundingClientRect()
    assert.equal(verticalBand.width, 24)
    assert.equal(verticalInput.width, 16)
    assert.equal(verticalInput.left - verticalBand.left, 4)
  })

  it('ignores other mouse buttons and a disabled slider', async (t) => {
    let { container, act } = mount(t, <Slider aria-label="Volume" defaultValue={50} />)
    await act(() => pointer(slot(container, 'slider-control'), 'pointerdown', at(container, 0.9), { button: 2 }))
    assert.deepEqual(values(container), ['50'])

    let disabled = mount(t, <Slider aria-label="Volume" defaultValue={50} disabled />)
    await disabled.act(() =>
      pointer(slot(disabled.container, 'slider-control'), 'pointerdown', at(disabled.container, 0.9)),
    )
    assert.deepEqual(values(disabled.container), ['50'])
  })

  it('drops a drag when the slider is removed, so a late pointer event changes and commits nothing', async (t) => {
    let changes: string[] = []
    let { container, root, act } = mount(t, <Slider aria-label="Volume" defaultValue={30} />)
    container.addEventListener('remixcn:slider-change', (event) => changes.push(event.reason))
    container.addEventListener('remixcn:slider-commit', (event) => changes.push(`commit ${event.reason}`))
    let control = slot(container, 'slider-control')

    let far = at(container, 0.9)

    await act(() => pointer(control, 'pointerdown', at(container, 0.5)))
    root.render(<div style={frame} />)
    root.flush()
    assert.equal(control.isConnected, false)

    // A listener left behind would still run, and fail without its slider.
    let errors: string[] = []
    let onError = (event: ErrorEvent) => {
      event.preventDefault()
      errors.push(event.message)
    }
    window.addEventListener('error', onError)
    pointer(control, 'pointermove', far)
    pointer(control, 'pointerup', far)
    container.append(control)
    pointer(control, 'pointermove', far)
    pointer(control, 'pointerup', far)
    control.remove()
    window.removeEventListener('error', onError)

    assert.deepEqual(changes, ['track-press'])
    assert.deepEqual(errors, [])
  })

  it('cancels a drag when the slider becomes disabled', async (t) => {
    let { container, root, act } = mount(t, <Slider aria-label="Volume" defaultValue={30} />)
    let log = record(container)
    let control = slot(container, 'slider-control')

    await act(() => pointer(control, 'pointerdown', at(container, 0.5)))
    await act(() => {
      root.render(
        <div style={frame}>
          <Slider aria-label="Volume" defaultValue={30} disabled />
        </div>,
      )
    })
    await act(() => pointer(control, 'pointerup', at(container, 0.5)))

    assert.deepEqual(values(container), ['30'])
    assert.deepEqual(log.at(-1), 'change cancel 0 [30]')
    assert.equal(
      log.some((entry) => entry.startsWith('commit')),
      false,
    )
  })

  it("ends a drag whose thumb the owner removes, and keeps the owner's new value", async (t) => {
    let setValue!: (next: number[]) => void
    function Owner(handle: Handle) {
      let value = [20, 60]
      setValue = (next) => {
        value = next
        handle.update()
      }
      return () => (
        <div mix={onSliderChange((event) => setValue([...event.values]))}>
          <Slider aria-label="Window" value={value} />
        </div>
      )
    }
    let { container, act } = mount(t, <Owner />)
    let log = record(container)
    let control = slot(container, 'slider-control')

    await act(() => pointer(control, 'pointerdown', at(container, 0.7)))
    assert.deepEqual(values(container), ['20', '70'])
    log.length = 0
    await act(() => setValue([30]))
    await act(() => pointer(control, 'pointermove', at(container, 0.9)))
    await act(() => pointer(control, 'pointerup', at(container, 0.9)))

    assert.deepEqual(values(container), ['30'])
    assert.deepEqual(log, [])
    assert.equal(slot(container, 'slider').hasAttribute('data-dragging'), false)
  })

  it('takes no pointer or key input inside a disabled fieldset', async (t) => {
    let { container, act } = mount(
      t,
      <fieldset disabled>
        <Slider aria-label="Volume" defaultValue={40} />
      </fieldset>,
    )
    let log = record(container)
    let [thumb] = thumbs(container)

    await act(() => pointer(slot(container, 'slider-control'), 'pointerdown', at(container, 0.9)))
    await act(() => pointer(slot(container, 'slider-control'), 'pointerup', at(container, 0.9)))
    await act(() => press(thumb, 'End'))

    assert.equal(thumb.matches(':disabled'), true)
    assert.equal(getComputedStyle(slot(container, 'slider-control')).opacity, '0.5')
    assert.deepEqual(values(container), ['40'])
    assert.deepEqual(log, [])
  })

  it('cancels a drag when its fieldset becomes disabled, and commits nothing', async (t) => {
    let { container, act } = mount(
      t,
      <fieldset>
        <Slider aria-label="Volume" defaultValue={40} />
      </fieldset>,
    )
    let log = record(container)
    let control = slot(container, 'slider-control')

    await act(() => pointer(control, 'pointerdown', at(container, 0.5)))
    container.querySelector('fieldset')!.disabled = true
    await act(() => pointer(control, 'pointermove', at(container, 0.9)))
    await act(() => pointer(control, 'pointerup', at(container, 0.9)))

    assert.deepEqual(values(container), ['40'])
    assert.deepEqual(log, ['input 50', 'change track-press 0 [50]', 'input 40', 'change cancel 0 [40]'])
    assert.equal(slot(container, 'slider').hasAttribute('data-dragging'), false)
  })
})

describe('Slider values', () => {
  it('shows only its value prop when controlled, and follows the owner that renders the change', async (t) => {
    function Controlled(handle: Handle<{ follow: boolean }>) {
      let value = [20, 60]
      return () => (
        <div
          mix={onSliderChange((event) => {
            if (!handle.props.follow) return
            value = [...event.values]
            handle.update()
          })}
        >
          <output>{value.join(', ')}</output>
          <Slider aria-label="Window" value={value} />
        </div>
      )
    }

    let following = mount(t, <Controlled follow />)
    await following.act(() => press(thumbs(following.container)[0], 'ArrowRight'))
    assert.deepEqual(values(following.container), ['21', '60'])
    assert.equal(following.container.querySelector('output')?.textContent, '21, 60')

    let fixed = mount(t, <Controlled follow={false} />)
    let log = record(fixed.container)
    await fixed.act(() => press(thumbs(fixed.container)[0], 'ArrowRight'))
    await fixed.act(() => pointer(slot(fixed.container, 'slider-control'), 'pointerdown', at(fixed.container, 0.9)))
    await fixed.act(() => pointer(slot(fixed.container, 'slider-control'), 'pointerup', at(fixed.container, 0.9)))
    assert.deepEqual(values(fixed.container), ['20', '60'])
    assert.deepEqual(
      log.filter((entry) => entry.startsWith('change')),
      ['change keyboard 0 [21, 60]', 'change track-press 1 [20, 90]'],
    )
  })

  it('follows new props: a new controlled value, a changed range, and more thumbs', async (t) => {
    let { container, root, act } = mount(t, <Slider aria-label="Window" value={[20, 60]} />)
    let [first] = thumbs(container)
    let show = (node: RemixNode) =>
      act(() => {
        root.render(<div style={frame}>{node}</div>)
      })

    await show(<Slider aria-label="Window" value={[30, 70]} />)
    assert.deepEqual(values(container), ['30', '70'])

    await show(<Slider aria-label="Window" value={[25, 70]} max={50} step={20} />)
    assert.deepEqual(values(container), ['20', '40'])
    assert.equal(thumbs(container)[0].max, '50')

    await show(<Slider aria-label="Window" thumbLabels={['Start', 'Middle', 'End']} value={[10, 40, 90]} />)
    assert.deepEqual(values(container), ['10', '40', '90'])
    assert.equal(thumbs(container)[0], first)
    assert.deepEqual(
      thumbs(container).map((input) => input.getAttribute('aria-label')),
      ['Start', 'Middle', 'End'],
    )
  })

  it('keeps its own value across renders, and clamps it to a changed range', async (t) => {
    let { container, root, act } = mount(t, <Slider aria-label="Volume" defaultValue={50} />)
    await act(() => press(thumbs(container)[0], 'End'))

    await act(() => {
      root.render(
        <div style={frame}>
          <Slider aria-label="Volume" defaultValue={10} max={80} />
        </div>,
      )
    })

    assert.deepEqual(values(container), ['80'])
  })

  it('adopts a value that assistive technology sets on a thumb, inside its bounds', async (t) => {
    let { container, act } = mount(t, <Slider aria-label="Window" defaultValue={[20, 60]} />)
    let log = record(container)
    let [low] = thumbs(container)

    await act(() => {
      low.value = '95'
      low.dispatchEvent(new Event('input', { bubbles: true }))
      low.dispatchEvent(new Event('change', { bubbles: true }))
    })

    assert.deepEqual(values(container), ['60', '60'])
    assert.deepEqual(log, ['change input 0 [60, 60]', 'input 60', 'commit input 0 [60, 60]', 'native change 60'])
  })

  it("tells assistive technology each thumb's bounds, which follow its neighbours", async (t) => {
    let { container, act } = mount(t, <Slider aria-label="Window" defaultValue={[25, 50]} minStepsBetweenValues={5} />)
    let bounds = () =>
      thumbs(container).map((input) => [input.getAttribute('aria-valuemin'), input.getAttribute('aria-valuemax')])

    assert.deepEqual(bounds(), [
      [null, '45'],
      ['30', null],
    ])
    await act(() => press(thumbs(container)[1], 'End'))
    assert.deepEqual(bounds(), [
      [null, '95'],
      ['30', null],
    ])
    assert.deepEqual(
      thumbs(container).map((input) => [input.min, input.max]),
      [
        ['0', '100'],
        ['0', '100'],
      ],
    )
  })

  it('keeps separate values for separate sliders', async (t) => {
    let { container, act } = mount(
      t,
      <div>
        <Slider aria-label="Bass" defaultValue={50} />
        <Slider aria-label="Treble" defaultValue={50} />
      </div>,
    )

    await act(() => press(thumbs(container)[0], 'ArrowRight'))
    await act(() => press(thumbs(container)[1], 'Home'))

    assert.deepEqual(values(container), ['51', '0'])
  })

  it('reports a developer error for an invalid range', (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    let errors: unknown[] = []
    root.addEventListener('error', (event) => errors.push(event.error))
    t.after(() => {
      root.dispose()
      container.remove()
    })

    root.render(<Slider aria-label="Volume" step={0} />)
    root.flush()

    assert.equal(errors.length, 1)
    assert.ok(errors[0] instanceof SliderError)
    assert.match((errors[0] as Error).message, /^Slider: step must be a positive finite number, got 0$/)
  })
})

describe('Slider in a form', () => {
  it('submits one value per thumb under its name, from the lowest, and nothing while disabled', async (t) => {
    let { container, act } = mount(
      t,
      <form>
        <Slider name="price" thumbLabels={['Minimum', 'Maximum']} defaultValue={[800, 200]} max={1000} step={10} />
        <Slider name="quiet" aria-label="Quiet hours" defaultValue={[22, 6]} max={24} disabled />
      </form>,
    )
    let form = container.querySelector('form')!

    assert.deepEqual(new FormData(form).getAll('price'), ['200', '800'])
    assert.deepEqual(new FormData(form).getAll('quiet'), [])

    await act(() => press(thumbs(container)[0], 'PageUp'))
    assert.deepEqual(new FormData(form).getAll('price'), ['300', '800'])
  })

  it('returns to its default value on reset and tells its listeners', async (t) => {
    let { container, act } = mount(
      t,
      <form>
        <Slider name="volume" aria-label="Volume" defaultValue={40} />
      </form>,
    )
    let log = record(container)
    let form = container.querySelector('form')!

    await act(() => press(thumbs(container)[0], 'End'))
    log.length = 0
    form.reset()
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)))

    assert.deepEqual(values(container), ['40'])
    assert.deepEqual(new FormData(form).getAll('volume'), ['40'])
    assert.deepEqual(log, ['change reset -1 [40]'])
  })

  it('keeps its value when a listener cancels the reset', async (t) => {
    let { container, act } = mount(
      t,
      <form mix={on('reset', (event) => event.preventDefault())}>
        <Slider name="volume" aria-label="Volume" defaultValue={40} />
      </form>,
    )
    let log = record(container)

    await act(() => press(thumbs(container)[0], 'End'))
    log.length = 0
    container.querySelector('form')!.reset()
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)))

    assert.deepEqual(values(container), ['100'])
    assert.deepEqual(log, [])
  })

  it('asks a controlled owner to return to the value it first rendered on reset', async (t) => {
    function Controlled(handle: Handle<{ follow: boolean }>) {
      let value = 70
      return () => (
        <form
          mix={onSliderChange((event) => {
            if (!handle.props.follow) return
            value = event.values[0]
            handle.update()
          })}
        >
          <Slider name="volume" aria-label="Volume" value={value} />
        </form>
      )
    }
    let wait = () => new Promise((resolve) => setTimeout(resolve, 10))

    let following = mount(t, <Controlled follow />)
    let log = record(following.container)
    await following.act(() => press(thumbs(following.container)[0], 'End'))
    following.container.querySelector('form')!.reset()
    await following.act(wait)
    assert.deepEqual(values(following.container), ['70'])
    assert.deepEqual(log.at(-1), 'change reset -1 [70]')

    let fixed = mount(t, <Controlled follow={false} />)
    let [thumb] = thumbs(fixed.container)
    thumb.defaultValue = '10'
    fixed.container.querySelector('form')!.reset()
    await fixed.act(wait)
    assert.deepEqual(values(fixed.container), ['70'])
  })

  it('submits a value that belongs to another form by its form attribute', async (t) => {
    let { container } = mount(
      t,
      <div>
        <form id="filters" />
        <Slider name="price" form="filters" aria-label="Price" defaultValue={30} />
      </div>,
    )

    assert.deepEqual(new FormData(container.querySelector('form')!).getAll('price'), ['30'])
  })
})

describe('SliderRoot', () => {
  it("runs the caller's mixins on the root, and hears changes through onSliderChange", async (t) => {
    let node: HTMLElement | undefined
    let heard: number[][] = []
    let { container, act } = mount(
      t,
      <SliderRoot
        aria-label="Volume"
        defaultValue={50}
        mix={[
          css({ maxWidth: '10rem' }),
          ref((element) => (node = element)),
          on('focusin', () => {
            heard.push([])
          }),
          onSliderChange((event) => {
            heard.push([...event.values])
          }),
        ]}
      />,
    )
    let root = slot(container, 'slider')

    thumbs(container)[0].focus()
    await act(() => press(thumbs(container)[0], 'ArrowRight'))

    assert.equal(node, root)
    assert.equal(getComputedStyle(root).maxWidth, '160px')
    assert.deepEqual(heard, [[], [51]])
  })
})
