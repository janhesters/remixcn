import { css, on, ref } from 'remix/component'
import type { RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { buttonGroupItem } from '#remixcn/lib/styles.ts'

import { Button } from './button.tsx'
import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from './button-group.tsx'

// Browser tests run without theme.css, so give the tokens these tests measure a value.
function mount(t: TestContext, node: RemixNode, { dir = 'ltr' } = {}) {
  let container = document.createElement('div')
  container.dir = dir
  container.style.setProperty('--radius-md', '6px')
  container.style.setProperty('--spacing', '4px')
  container.style.setProperty('--input', 'rgb(128, 128, 128)')
  document.body.append(container)

  let result = render(node, { container })
  t.after(result.cleanup)
  return result
}

function corners(element: Element) {
  let style = getComputedStyle(element)
  return {
    topLeft: style.borderTopLeftRadius,
    topRight: style.borderTopRightRadius,
    bottomRight: style.borderBottomRightRadius,
    bottomLeft: style.borderBottomLeftRadius,
  }
}

function borders(element: Element) {
  let style = getComputedStyle(element)
  return { top: style.borderTopWidth, right: style.borderRightWidth, left: style.borderLeftWidth }
}

const rounded = '6px'
const square = '0px'

describe('ButtonGroup in the browser', () => {
  it('adds no tab stop, so Tab moves from part to part', async (t) => {
    let { container } = mount(
      t,
      <ButtonGroup aria-label="Invoice actions">
        <Button variant="outline">Archive</Button>
        <input data-slot="input" aria-label="Note" />
        <Button variant="outline">Report</Button>
      </ButtonGroup>,
    )
    let group = container.querySelector('[role="group"]') as HTMLElement

    group.focus()

    assert.notEqual(document.activeElement, group)
    assert.equal(group.tabIndex, -1)
    assert.deepEqual(
      [...group.children].map((part) => (part as HTMLElement).tabIndex),
      [0, 0, 0],
    )
  })

  it('leaves each part with its own form owner', async (t) => {
    let { container, act } = mount(
      t,
      <div>
        <form id="reminder">
          <ButtonGroup aria-label="Reminder">
            <input data-slot="input" name="days" defaultValue="14" aria-label="Days" />
            <Button type="submit" name="intent" value="schedule">
              Schedule
            </Button>
            <Button type="submit" form="archive" name="intent" value="archive">
              Archive
            </Button>
          </ButtonGroup>
        </form>
        <form id="archive" />
      </div>,
    )
    let [reminder, archive] = container.querySelectorAll('form')
    let sent: string[] = []
    for (let form of [reminder, archive]) {
      form.addEventListener('submit', (event) => {
        event.preventDefault()
        sent.push(`${form.id}: ${new URLSearchParams(new FormData(form, event.submitter) as never)}`)
      })
    }
    let [schedule, archiveButton] = container.querySelectorAll('button')

    assert.equal(schedule.form, reminder)
    assert.equal(archiveButton.form, archive)

    await act(() => schedule.click())
    await act(() => archiveButton.click())

    assert.deepEqual(sent, ['reminder: days=14&intent=schedule', 'archive: intent=archive'])
  })

  it("runs the caller's events, refs and mixins on the group element", async (t) => {
    let node: HTMLElement | undefined
    let clicked: string[] = []
    let { container, act } = mount(
      t,
      <ButtonGroup
        aria-label="Zoom"
        mix={[
          ref((element) => (node = element)),
          on('click', (event) => void clicked.push((event.target as HTMLElement).textContent ?? '')),
          css({ columnGap: '3px' }),
        ]}
      >
        <Button>In</Button>
        <Button>Out</Button>
      </ButtonGroup>,
    )
    let group = container.querySelector('[role="group"]') as HTMLElement

    await act(() => container.querySelector('button')!.click())

    assert.equal(node, group)
    assert.deepEqual(clicked, ['In'])
    assert.equal(getComputedStyle(group).columnGap, '3px')
  })

  it('joins a row: only the outer corners stay round, and neighbors share one border', async (t) => {
    let { container } = mount(
      t,
      <ButtonGroup aria-label="Pages">
        <Button variant="outline">Previous</Button>
        <Button variant="outline">1</Button>
        <Button variant="outline">Next</Button>
      </ButtonGroup>,
    )
    let [first, middle, last] = container.querySelectorAll('button')

    assert.deepEqual(corners(first), { topLeft: rounded, topRight: square, bottomRight: square, bottomLeft: rounded })
    assert.deepEqual(corners(middle), { topLeft: square, topRight: square, bottomRight: square, bottomLeft: square })
    assert.deepEqual(corners(last), { topLeft: square, topRight: rounded, bottomRight: rounded, bottomLeft: square })
    assert.deepEqual(borders(first), { top: '1px', right: '1px', left: '1px' })
    assert.deepEqual(borders(middle), { top: '1px', right: '1px', left: '0px' })
  })

  it('mirrors the joins in right-to-left text', async (t) => {
    let { container } = mount(
      t,
      <ButtonGroup aria-label="Pages">
        <Button variant="outline">Previous</Button>
        <Button variant="outline">Next</Button>
      </ButtonGroup>,
      { dir: 'rtl' },
    )
    let [first, last] = container.querySelectorAll('button')

    assert.deepEqual(corners(first), { topLeft: square, topRight: rounded, bottomRight: rounded, bottomLeft: square })
    assert.deepEqual(borders(last), { top: '1px', right: '0px', left: '1px' })
  })

  it('joins a column from top to bottom', async (t) => {
    let { container } = mount(
      t,
      <ButtonGroup orientation="vertical" aria-label="Zoom">
        <Button variant="outline" size="icon" aria-label="Zoom in">
          +
        </Button>
        <Button variant="outline" size="icon" aria-label="Zoom out">
          -
        </Button>
      </ButtonGroup>,
    )
    let group = container.querySelector('[role="group"]')!
    let [top, bottom] = container.querySelectorAll('button')

    assert.equal(getComputedStyle(group).flexDirection, 'column')
    assert.deepEqual(corners(top), { topLeft: rounded, topRight: rounded, bottomRight: square, bottomLeft: square })
    assert.deepEqual(corners(bottom), { topLeft: square, topRight: square, bottomRight: rounded, bottomLeft: rounded })
    assert.equal(borders(bottom).top, '0px')
  })

  it('joins text, inputs and separators as parts, and ignores elements without a data-slot', async (t) => {
    let { container } = mount(
      t,
      <ButtonGroup aria-label="Amount">
        <ButtonGroupText>CHF</ButtonGroupText>
        {/* A native input joins and grows once its own css() merges buttonGroupItem. */}
        <input data-slot="input" aria-label="Amount" mix={css(buttonGroupItem)} />
        <Button variant="secondary">Pay</Button>
        <ButtonGroupSeparator />
        <Button variant="secondary" size="icon" aria-label="More payment options">
          ⋯
        </Button>
        <input type="hidden" name="currency" value="CHF" />
      </ButtonGroup>,
    )
    let text = container.querySelector('[data-slot="button-group-text"]')!
    let input = container.querySelector('input[data-slot]')!
    let separator = container.querySelector('[role="separator"]')!
    let more = container.querySelector('[aria-label="More payment options"]')!

    assert.deepEqual(corners(text), { topLeft: rounded, topRight: square, bottomRight: square, bottomLeft: rounded })
    assert.equal(getComputedStyle(input).flexGrow, '1')
    assert.equal(getComputedStyle(separator).borderLeftWidth, '1px')
    assert.equal(getComputedStyle(separator).width, '0px')
    assert.deepEqual(corners(more), { topLeft: square, topRight: rounded, bottomRight: rounded, bottomLeft: square })
  })

  it('spaces nested groups apart instead of joining them', async (t) => {
    let { container } = mount(
      t,
      <ButtonGroup aria-label="Editor">
        <ButtonGroup aria-label="History">
          <Button variant="outline">Undo</Button>
          <Button variant="outline">Redo</Button>
        </ButtonGroup>
        <ButtonGroup aria-label="Zoom">
          <Button variant="outline">Fit</Button>
        </ButtonGroup>
      </ButtonGroup>,
    )
    let [outer] = container.querySelectorAll('[role="group"]')
    let fit = [...container.querySelectorAll('button')].at(-1)!

    assert.equal(getComputedStyle(outer).columnGap, '8px')
    assert.deepEqual(corners(fit), { topLeft: rounded, topRight: rounded, bottomRight: rounded, bottomLeft: rounded })
  })
})
