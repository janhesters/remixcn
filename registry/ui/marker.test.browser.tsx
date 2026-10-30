import type { RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { Marker, MarkerContent, MarkerIcon, markerVariants } from './marker.tsx'

function mount(t: TestContext, node: RemixNode) {
  let result = render(node)
  t.after(result.cleanup)
  return result
}

// Browser tests run without theme.css, so the container sets the tokens they measure.
const tokens = {
  width: '320px',
  '--spacing': '4px',
  '--text-sm': '14px',
  '--text-sm--line-height': '20px',
  '--border': 'rgb(200, 200, 200)',
  '--muted-foreground': 'rgb(100, 100, 100)',
  '--foreground': 'rgb(10, 10, 10)',
}

function slot(container: HTMLElement, name: string) {
  return container.querySelector(`[data-slot="${name}"]`) as HTMLElement
}

describe('Marker in the browser', () => {
  it('draws a separator as two border lines around a centered label that wraps on a narrow screen', async (t) => {
    let label = 'Yesterday, after the release candidate shipped to every workspace'
    let { container } = mount(
      t,
      <div style={tokens}>
        <Marker variant="separator">
          <MarkerContent>{label}</MarkerContent>
        </Marker>
      </div>,
    )
    let marker = slot(container, 'marker')
    let content = slot(container, 'marker-content')
    let before = getComputedStyle(marker, '::before')
    let after = getComputedStyle(marker, '::after')

    for (let line of [before, after]) {
      assert.equal(line.borderTopWidth, '1px')
      assert.equal(line.borderTopColor, 'rgb(200, 200, 200)')
      // Each line keeps 1rem, so it stays visible beside a label that wraps.
      assert.ok(parseFloat(line.width) >= 16, `a line is ${line.width} wide`)
    }
    assert.equal(getComputedStyle(content).textAlign, 'center')
    assert.ok(content.getBoundingClientRect().height > 20, 'the label wraps')
    assert.ok(marker.scrollWidth <= 320, `marker is ${marker.scrollWidth}px wide`)
  })

  it('draws the border variant under the row, and keeps the icon at 1rem beside wrapping text', async (t) => {
    let { container } = mount(
      t,
      <div style={tokens}>
        <Marker variant="border">
          <MarkerIcon>
            <svg viewBox="0 0 24 24" />
          </MarkerIcon>
          <MarkerContent>{'registry/examples/a-very-long-file-name-without-spaces-that-must-break.tsx'}</MarkerContent>
        </Marker>
      </div>,
    )
    let marker = slot(container, 'marker')
    let icon = slot(container, 'marker-icon').getBoundingClientRect()

    assert.equal(getComputedStyle(marker).borderBottomWidth, '1px')
    assert.equal(getComputedStyle(marker).paddingBottom, '8px')
    assert.equal(Math.round(icon.width), 16)
    assert.ok(marker.scrollWidth <= 320)
  })

  it('underlines a link marker and drops the native box of a button marker', async (t) => {
    let { container } = mount(
      t,
      <div style={tokens}>
        <a href="#files" mix={markerVariants()}>
          <MarkerContent>View the files</MarkerContent>
        </a>
        <button type="button" mix={markerVariants()}>
          <MarkerContent>Show the steps</MarkerContent>
        </button>
      </div>,
    )
    let link = getComputedStyle(container.querySelector('a')!)
    let button = getComputedStyle(container.querySelector('button')!)

    assert.match(link.textDecorationLine, /underline/)
    assert.equal(link.color, 'rgb(100, 100, 100)')
    assert.equal(button.borderTopWidth, '0px')
    assert.equal(button.backgroundColor, 'rgba(0, 0, 0, 0)')
    assert.equal(button.cursor, 'pointer')
    assert.equal(button.textAlign, 'start')
  })

  it('updates its variant and role when the props change', async (t) => {
    let { container, root } = mount(
      t,
      <Marker>
        <MarkerContent>Thinking</MarkerContent>
      </Marker>,
    )
    root.render(
      <Marker variant="border" role="status">
        <MarkerContent>Done</MarkerContent>
      </Marker>,
    )
    root.flush()
    let marker = slot(container, 'marker')

    assert.equal(marker.dataset.variant, 'border')
    assert.equal(marker.getAttribute('role'), 'status')
    assert.equal(marker.textContent, 'Done')
  })
})
