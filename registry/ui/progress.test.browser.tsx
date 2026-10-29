import { on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { Progress, ProgressIndicator, ProgressLabel, ProgressTrack, ProgressValue } from './progress.tsx'

function mount(t: TestContext, node: RemixNode) {
  let result = render(node)
  t.after(result.cleanup)
  return result
}

// Steps through values with buttons, as an upload would.
function Upload(handle: Handle<{ name: string }>) {
  let value: number | null = 20

  let set = (next: number | null) =>
    on<HTMLButtonElement, 'click'>('click', () => {
      value = next
      void handle.update()
    })

  return () => (
    <div data-upload={handle.props.name}>
      <button type="button" data-action="half" mix={set(50)}>
        Half
      </button>
      <button type="button" data-action="done" mix={set(100)}>
        Done
      </button>
      <button type="button" data-action="wait" mix={set(null)}>
        Wait
      </button>
      <Progress value={value}>
        <ProgressLabel>{handle.props.name}</ProgressLabel>
        <ProgressValue />
      </Progress>
    </div>
  )
}

function read(container: HTMLElement, name: string) {
  let upload = container.querySelector(`[data-upload="${name}"]`)!
  let root = upload.querySelector<HTMLElement>('[role="progressbar"]')!
  let indicator = upload.querySelector<HTMLElement>('[data-slot="progress-indicator"]')!
  let status = ['indeterminate', 'progressing', 'complete'].find((name) => root.hasAttribute(`data-${name}`))
  return {
    now: root.getAttribute('aria-valuenow'),
    text: root.getAttribute('aria-valuetext'),
    shown: upload.querySelector('[data-slot="progress-value"]')!.textContent,
    width: indicator.style.width,
    status,
    indicatorStatus: ['indeterminate', 'progressing', 'complete'].find((name) =>
      indicator.hasAttribute(`data-${name}`),
    ),
  }
}

function press(container: HTMLElement, name: string, action: string) {
  container.querySelector<HTMLButtonElement>(`[data-upload="${name}"] [data-action="${action}"]`)!.click()
}

describe('Progress in the browser', () => {
  it('follows a changing value through progressing, complete and indeterminate, and back', async (t) => {
    let { container, act } = mount(t, <Upload name="invoices.csv" />)
    assert.deepEqual(read(container, 'invoices.csv'), {
      now: '20',
      text: '20%',
      shown: '20%',
      width: '20%',
      status: 'progressing',
      indicatorStatus: 'progressing',
    })

    await act(() => press(container, 'invoices.csv', 'done'))
    assert.deepEqual(read(container, 'invoices.csv'), {
      now: '100',
      text: '100%',
      shown: '100%',
      width: '100%',
      status: 'complete',
      indicatorStatus: 'complete',
    })

    await act(() => press(container, 'invoices.csv', 'wait'))
    assert.deepEqual(read(container, 'invoices.csv'), {
      now: null,
      text: 'indeterminate progress',
      shown: '',
      width: '',
      status: 'indeterminate',
      indicatorStatus: 'indeterminate',
    })

    await act(() => press(container, 'invoices.csv', 'half'))
    assert.deepEqual(read(container, 'invoices.csv'), {
      now: '50',
      text: '50%',
      shown: '50%',
      width: '50%',
      status: 'progressing',
      indicatorStatus: 'progressing',
    })
  })

  it('keeps each instance apart: its own value and its own label', async (t) => {
    let { container, act } = mount(
      t,
      <div>
        <Upload name="invoices.csv" />
        <Upload name="reminders.csv" />
      </div>,
    )

    await act(() => press(container, 'reminders.csv', 'done'))

    assert.equal(read(container, 'invoices.csv').now, '20')
    assert.equal(read(container, 'reminders.csv').now, '100')
    let bars = [...container.querySelectorAll('[role="progressbar"]')]
    let names = bars.map((bar) => document.getElementById(bar.getAttribute('aria-labelledby')!)?.textContent)
    assert.deepEqual(names, ['invoices.csv', 'reminders.csv'])
  })

  it('is named by labels that other components render, also with an id of their own', async (t) => {
    function UploadLabel() {
      return () => <ProgressLabel>Upload progress</ProgressLabel>
    }
    function ExportLabel() {
      return () => <ProgressLabel id="export-label">Export</ProgressLabel>
    }
    let { container } = mount(
      t,
      <div>
        <Progress value={50} data-test="upload">
          <UploadLabel />
        </Progress>
        <Progress value={20} data-test="export">
          <ExportLabel />
        </Progress>
      </div>,
    )
    await new Promise((resolve) => requestAnimationFrame(resolve))
    let name = (test: string) => {
      let bar = container.querySelector(`[data-test="${test}"]`)!
      return document.getElementById(bar.getAttribute('aria-labelledby') ?? '')?.textContent
    }

    assert.equal(name('upload'), 'Upload progress')
    assert.equal(name('export'), 'Export')
  })

  it('keeps a value-driven width next to a style string you give the indicator', async (t) => {
    let { container } = mount(
      t,
      <div style={{ width: '200px' }}>
        <Progress value={50} aria-label="Upload">
          <ProgressTrack data-test="track">
            <ProgressIndicator style="opacity: 0.5" data-test="fill" />
          </ProgressTrack>
        </Progress>
      </div>,
    )
    let fill = container.querySelector<HTMLElement>('[data-test="fill"]')!

    assert.equal(fill.getBoundingClientRect().width, 100)
    assert.equal(getComputedStyle(fill).opacity, '0.5')
  })

  it('fills the track from the inline start, also in right-to-left text', async (t) => {
    let { container } = mount(
      t,
      <div style={{ width: '200px' }}>
        <Progress value={25} data-test="ltr" />
        <div dir="rtl">
          <Progress value={25} data-test="rtl" />
        </div>
      </div>,
    )
    let edges = (name: string) => {
      let track = container.querySelector(`[data-test="${name}"] [data-slot="progress-track"]`)!.getBoundingClientRect()
      let fill = container
        .querySelector(`[data-test="${name}"] [data-slot="progress-indicator"]`)!
        .getBoundingClientRect()
      return { start: Math.round(fill.left - track.left), end: Math.round(track.right - fill.right), width: fill.width }
    }

    assert.equal(edges('ltr').start, 0)
    assert.equal(edges('rtl').end, 0)
    assert.equal(edges('ltr').width, edges('rtl').width)
  })
})
