import { css, on, ref } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { Textarea } from './textarea.tsx'

function mount(t: TestContext, node: RemixNode) {
  let result = render(node)
  t.after(result.cleanup)
  return result
}

const tokens = {
  '--input': 'rgb(120, 120, 120)',
  '--destructive': 'rgb(200, 0, 0)',
  '--spacing': '4px',
  '--text-sm': '14px',
  '--text-sm--line-height': '20px',
}

function textarea(container: HTMLElement, name: string) {
  let found = container.querySelector(`textarea[name="${name}"]`)
  assert.ok(found instanceof HTMLTextAreaElement, `no textarea named ${name}`)
  return found
}

// Renders again on a click, with the same starting text, as a form owner might.
function Note(handle: Handle) {
  let renders = 0

  return () => (
    <div>
      <Textarea name="note" defaultValue="Thanks for your order." data-renders={String(renders)} />
      <button
        type="button"
        mix={on('click', () => {
          renders++
          void handle.update()
        })}
      >
        Render
      </button>
    </div>
  )
}

describe('Textarea in the browser', () => {
  it("runs the caller's events, refs and styles on the native textarea", async (t) => {
    let typed: string[] = []
    let node: HTMLTextAreaElement | undefined
    let { container, act } = mount(
      t,
      <Textarea
        name="note"
        mix={[
          ref((element) => (node = element)),
          on('input', (event) => void typed.push(event.currentTarget.value)),
          css({ letterSpacing: '3px' }),
        ]}
      />,
    )
    let element = textarea(container, 'note')

    await act(() => {
      element.value = 'Paid'
      element.dispatchEvent(new Event('input', { bubbles: true }))
    })

    assert.equal(node, element)
    assert.deepEqual(typed, ['Paid'])
    assert.equal(getComputedStyle(element).letterSpacing, '3px')
  })

  it('is at least 4rem tall, resizes only up and down, and turns red when invalid', async (t) => {
    let { container } = mount(
      t,
      <div style={tokens}>
        <Textarea name="note" />
        <Textarea name="reason" aria-invalid={true} />
        <Textarea name="locked" disabled />
      </div>,
    )
    let note = getComputedStyle(textarea(container, 'note'))

    assert.equal(note.minHeight, '64px')
    assert.equal(note.resize, 'vertical')
    assert.equal(note.borderTopColor, 'rgb(120, 120, 120)')
    assert.equal(getComputedStyle(textarea(container, 'reason')).borderTopColor, 'rgb(200, 0, 0)')
    assert.equal(getComputedStyle(textarea(container, 'locked')).opacity, '0.5')
  })

  it('grows with its text where the browser sizes fields to their content', async (t) => {
    let { container, act } = mount(
      t,
      <div style={{ ...tokens, width: '240px' }}>
        <Textarea name="note" />
      </div>,
    )
    let element = textarea(container, 'note')
    let empty = element.getBoundingClientRect().height

    await act(() => {
      element.value = Array.from({ length: 8 }, (_, line) => `Line ${line + 1}`).join('\n')
    })
    let full = element.getBoundingClientRect().height

    if (CSS.supports('field-sizing', 'content')) assert.ok(full > empty, `${full}px is not taller than ${empty}px`)
    else assert.equal(full, empty)
  })

  it('submits, validates and resets as a native textarea', async (t) => {
    let { container, act } = mount(
      t,
      <div>
        <form id="textarea-test-form">
          <Textarea name="note" defaultValue="Thanks for your order." />
          <Textarea name="reason" required />
          <Textarea name="terms" defaultValue="Net 30" readOnly />
          <Textarea name="internal" defaultValue="Hidden" disabled />
        </form>
        <Textarea name="outside" form="textarea-test-form" defaultValue="Outside" />
      </div>,
    )
    let form = container.querySelector('form')!

    assert.equal(form.checkValidity(), false)
    await act(() => {
      textarea(container, 'reason').value = 'Late delivery'
      textarea(container, 'note').value = 'Changed'
    })
    assert.equal(form.checkValidity(), true)
    assert.deepEqual(
      [...new FormData(form)].map(([name, value]) => `${name}=${value}`),
      ['note=Changed', 'reason=Late delivery', 'terms=Net 30', 'outside=Outside'],
    )

    await act(() => form.reset())
    assert.equal(textarea(container, 'note').value, 'Thanks for your order.')
    assert.equal(textarea(container, 'reason').value, '')
  })

  it('keeps what the user typed when the owner renders again', async (t) => {
    let { container, act } = mount(t, <Note />)
    let note = textarea(container, 'note')

    await act(() => {
      note.value = 'Thanks, paid in full.'
      note.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(() => container.querySelector('button')!.click())

    assert.equal(note.dataset.renders, '1')
    assert.equal(note.value, 'Thanks, paid in full.')
  })
})
