import { css, on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { mirrorInRtl } from '#remixcn/lib/styles.ts'
import { DirectionProvider, directionOf, getDirection } from './direction.tsx'

function mount(t: TestContext, node: RemixNode) {
  let result = render(node)
  t.after(result.cleanup)
  return result
}

function find(container: HTMLElement, testId: string) {
  let element = container.querySelector(`[data-test="${testId}"]`)
  assert.ok(element instanceof HTMLElement, `no element ${testId}`)
  return element
}

const arrow = css({ display: 'inline-block', '&': mirrorInRtl })

function Reader(handle: Handle<{ name: string }>) {
  return () => (
    <span data-test={handle.props.name} mix={arrow}>
      {getDirection(handle)}
    </span>
  )
}

// Flips its subtree with a button, to change the provider's prop after hydration.
function Switcher(handle: Handle) {
  let direction: 'ltr' | 'rtl' = 'ltr'

  return () => (
    <div>
      <button
        type="button"
        mix={on('click', () => {
          direction = direction === 'ltr' ? 'rtl' : 'ltr'
          void handle.update()
        })}
      >
        Flip
      </button>
      <DirectionProvider direction={direction}>
        <Reader name="outer" />
        <DirectionProvider direction="ltr">
          <Reader name="inner" />
        </DirectionProvider>
      </DirectionProvider>
    </div>
  )
}

describe('DirectionProvider in the browser', () => {
  it('gives nested subtrees their own direction, which directionOf and :dir() read', async (t) => {
    let { container } = mount(
      t,
      <DirectionProvider direction="rtl">
        <Reader name="outer" />
        <DirectionProvider direction="ltr">
          <Reader name="inner" />
        </DirectionProvider>
      </DirectionProvider>,
    )
    let outer = find(container, 'outer')
    let inner = find(container, 'inner')

    assert.deepEqual([directionOf(outer), directionOf(inner)], ['rtl', 'ltr'])
    assert.deepEqual([outer.textContent, inner.textContent], ['rtl', 'ltr'])
    assert.equal(getComputedStyle(outer).transform, 'matrix(-1, 0, 0, 1, 0, 0)')
    assert.equal(getComputedStyle(inner).transform, 'none')
  })

  it('follows a changed direction, while a nested provider keeps its own', async (t) => {
    let { container, act } = mount(t, <Switcher />)
    let outer = find(container, 'outer')
    let inner = find(container, 'inner')
    assert.deepEqual([directionOf(outer), directionOf(inner)], ['ltr', 'ltr'])

    await act(() => container.querySelector('button')!.click())

    assert.deepEqual([directionOf(outer), directionOf(inner)], ['rtl', 'ltr'])
    assert.deepEqual([outer.textContent, inner.textContent], ['rtl', 'ltr'])
    assert.equal(outer.closest('[data-slot="direction"]')?.getAttribute('dir'), 'rtl')

    await act(() => container.querySelector('button')!.click())

    assert.deepEqual([directionOf(outer), outer.textContent], ['ltr', 'ltr'])
  })

  it('adds no box of its own, so it never changes the layout around its content', async (t) => {
    let { container } = mount(
      t,
      <div style={{ display: 'flex', gap: '8px' }}>
        <DirectionProvider direction="rtl">
          <span data-test="a">أ</span>
          <span data-test="b">ب</span>
        </DirectionProvider>
      </div>,
    )
    let provider = container.querySelector('[data-slot="direction"]')!

    assert.equal(getComputedStyle(provider).display, 'contents')
    // The spans are flex items of the outer row, so its gap sits between them.
    let a = find(container, 'a').getBoundingClientRect()
    let b = find(container, 'b').getBoundingClientRect()
    assert.equal(Math.round(b.left - a.right), 8)
    assert.equal(a.top, b.top)
  })

  it('reads a dir set anywhere, not only by a provider', async (t) => {
    let { container } = mount(
      t,
      <p dir="rtl">
        <span data-test="text">شكرا</span>
      </p>,
    )

    assert.equal(directionOf(find(container, 'text')), 'rtl')
  })
})
