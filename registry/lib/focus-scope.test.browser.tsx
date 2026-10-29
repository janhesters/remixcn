import * as assert from 'remix/assert'
import type { Handle } from 'remix/component'
import { render } from 'remix/component/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { createFocusScope, focusScope, getTabbableElements } from '#remixcn/lib/focus-scope.ts'

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
}

function settle() {
  return new Promise((resolve) => setTimeout(resolve))
}

/** A toolbar with a trigger in the middle, and a popup container after it. */
function setup(t: TestContext, popupHtml = '<button>First</button><button>Second</button>') {
  let toolbar = document.createElement('div')
  toolbar.innerHTML = '<button>Before</button><button data-trigger>Trigger</button><button>After</button>'
  let popup = document.createElement('div')
  popup.innerHTML = popupHtml
  document.body.append(toolbar, popup)
  t.after(() => {
    toolbar.remove()
    popup.remove()
  })
  let trigger = toolbar.querySelector<HTMLButtonElement>('[data-trigger]')!
  trigger.focus()
  return { toolbar, popup, trigger }
}

function focused() {
  let active = document.activeElement
  return active instanceof HTMLInputElement ? active.value : (active?.textContent ?? null)
}

/** Dispatches Tab or Shift+Tab on the focused element, and says whether the scope took it over. */
function tab(shiftKey = false) {
  let event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true })
  document.activeElement!.dispatchEvent(event)
  return event.defaultPrevented
}

describe('getTabbableElements', () => {
  it('lists the elements Tab reaches, in document order', (t) => {
    let { popup } = setup(
      t,
      `<a href="#">Link</a><a>No href</a><button disabled>Disabled</button><input type="hidden">
       <span tabindex="0">Span</span><span tabindex="-1">Minus</span><div hidden><button>Hidden</button></div>
       <div inert><button>Inert</button></div><input value="Input"><button style="visibility: hidden">Invisible</button>`,
    )

    assert.deepEqual(
      getTabbableElements(popup).map((element) => element.textContent || (element as HTMLInputElement).value),
      ['Link', 'Span', 'Input'],
    )
  })
})

describe('getTabbableElements with radio groups', () => {
  it('keeps only the checked radio of a named group, and every radio of a group without one', (t) => {
    let { popup } = setup(
      t,
      `<input type="radio" name="plan" value="Monthly"><input type="radio" name="plan" value="Yearly" checked>
       <input type="radio" name="tone" value="Formal"><input type="radio" name="tone" value="Friendly">
       <input type="radio" value="Unnamed">`,
    )

    assert.deepEqual(
      getTabbableElements(popup).map((element) => (element as HTMLInputElement).value),
      ['Yearly', 'Formal', 'Friendly', 'Unnamed'],
    )
  })
})

describe('createFocusScope', () => {
  it('moves focus to the first tabbable element and returns it to the trigger', async (t) => {
    let { popup } = setup(t)
    let release = createFocusScope(popup)
    await nextFrame()
    assert.equal(focused(), 'First')

    release()
    await settle()
    assert.equal(focused(), 'Trigger')
  })

  it('prefers the initialFocus option, then autofocus, then the container itself', async (t) => {
    let { popup } = setup(t, '<button>First</button><button autofocus>Auto</button>')
    let release = createFocusScope(popup)
    await nextFrame()
    assert.equal(focused(), 'Auto')
    release()

    let first = popup.querySelector('button')!
    release = createFocusScope(popup, { initialFocus: () => first })
    await nextFrame()
    assert.equal(focused(), 'First')
    release()

    popup.innerHTML = 'Only text'
    release = createFocusScope(popup)
    await nextFrame()
    assert.equal(document.activeElement, popup)
    assert.equal(popup.getAttribute('tabindex'), '-1')
    release()
    assert.equal(popup.hasAttribute('tabindex'), false)
  })

  it('keeps focus a native dialog placed inside and fills its gap when the trigger is gone', async (t) => {
    let { trigger } = setup(t)
    let dialog = document.createElement('dialog')
    dialog.innerHTML = '<button>One</button><button>Two</button>'
    document.body.append(dialog)
    t.after(() => dialog.remove())

    let release = createFocusScope(dialog)
    dialog.showModal()
    assert.equal(focused(), 'One')
    dialog.querySelectorAll('button')[1].focus()
    await nextFrame()
    assert.equal(focused(), 'Two')

    trigger.remove()
    dialog.close()
    assert.ok(dialog.contains(document.activeElement), 'the native dialog leaves focus in its closed box')
    release()
    await settle()
    assert.equal(focused(), 'Before')
  })

  it('falls back to a tabbable neighbor when the trigger was removed or disabled', async (t) => {
    let { popup, trigger } = setup(t)
    let release = createFocusScope(popup)
    await nextFrame()
    trigger.remove()
    release()
    await settle()
    assert.equal(focused(), 'Before')

    let other = setup(t)
    release = createFocusScope(other.popup)
    await nextFrame()
    other.trigger.disabled = true
    other.toolbar.querySelector('button')!.remove()
    release()
    await settle()
    assert.equal(focused(), 'After')
  })

  it('falls back to a tabbable element in the body when the trigger sat directly in it or its wrappers are gone', async (t) => {
    let other = document.createElement('button')
    other.textContent = 'Other'
    document.body.prepend(other)
    t.after(() => other.remove())

    for (let wrapped of [false, true]) {
      let trigger = document.createElement('button')
      trigger.textContent = 'Trigger'
      let wrapper = document.createElement('div')
      wrapper.append(trigger)
      let popup = document.createElement('div')
      popup.innerHTML = '<button>Inside</button>'
      document.body.append(wrapped ? wrapper : trigger, popup)
      trigger.focus()

      let release = createFocusScope(popup)
      await nextFrame()
      ;(wrapped ? wrapper : trigger).remove()
      popup.remove()
      release()
      await settle()
      assert.equal(document.activeElement, other, wrapped ? 'wrapper removed' : 'trigger in body')
    }
  })

  it('uses fallbackFocus before guessing a neighbor', async (t) => {
    let { popup, trigger } = setup(t)
    let search = document.createElement('input')
    search.value = 'Search'
    document.body.append(search)
    t.after(() => search.remove())
    let release = createFocusScope(popup, { fallbackFocus: () => search })
    await nextFrame()
    trigger.remove()
    release()
    await settle()

    assert.equal(document.activeElement, search)
  })

  it("doesn't take back focus the user moved elsewhere, and honors returnFocus", async (t) => {
    let { popup, toolbar } = setup(t)
    let release = createFocusScope(popup)
    await nextFrame()
    toolbar.querySelector('button')!.focus()
    release()
    await settle()
    assert.equal(focused(), 'Before')

    release = createFocusScope(popup, { returnFocus: () => toolbar.querySelectorAll('button')[2] })
    await nextFrame()
    release()
    await settle()
    assert.equal(focused(), 'After')

    release = createFocusScope(popup, { returnFocus: false })
    await nextFrame()
    assert.equal(focused(), 'First')
    release()
    await settle()
    assert.equal(focused(), 'First')
  })

  it('wraps Tab and Shift+Tab around inside the container with trapFocus, and stops when released', async (t) => {
    let { popup } = setup(t, '<button>First</button><button disabled>Off</button><button>Last</button>')
    let release = createFocusScope(popup, { trapFocus: true })
    await nextFrame()
    assert.equal(focused(), 'First')

    assert.equal(tab(true), true, 'Shift+Tab on the first element wraps')
    assert.equal(focused(), 'Last')
    assert.equal(tab(), true, 'Tab on the last element wraps')
    assert.equal(focused(), 'First')
    assert.equal(tab(), false, 'Tab between the edges is left to the browser')

    popup.querySelector<HTMLElement>('button:last-child')!.focus()
    release()
    assert.equal(tab(), false)
  })

  it('treats a radio group as one stop at the edges of the trap, as the browser does', async (t) => {
    let { popup } = setup(
      t,
      `<input type="radio" name="plan" value="Monthly"><input type="radio" name="plan" value="Yearly" checked>
       <button>Middle</button>
       <input type="radio" name="tone" value="Formal"><input type="radio" name="tone" value="Friendly">`,
    )
    let release = createFocusScope(popup, { trapFocus: true })
    t.after(release)
    await nextFrame()
    assert.equal(focused(), 'Yearly', 'the checked radio is the first stop')

    assert.equal(tab(true), true, 'Shift+Tab on the checked radio wraps')
    assert.equal(focused(), 'Friendly', 'into the last radio of a group without a checked one')
    popup.querySelector<HTMLInputElement>('[value="Formal"]')!.focus()
    assert.equal(tab(), true, 'Tab anywhere in the last group wraps')
    assert.equal(focused(), 'Yearly')
  })

  it('updates the trap and the return target of a running scope without moving focus', async (t) => {
    let { popup, trigger } = setup(t)
    let scope = createFocusScope(popup)
    await nextFrame()
    popup.querySelector<HTMLElement>('button:last-child')!.focus()
    assert.equal(tab(), false)

    scope.update({ trapFocus: true })
    assert.equal(focused(), 'Second')
    assert.equal(tab(), true)
    assert.equal(focused(), 'First')

    scope.update({ trapFocus: false })
    popup.querySelector<HTMLElement>('button:last-child')!.focus()
    assert.equal(tab(), false)

    scope()
    await settle()
    assert.equal(document.activeElement, trigger)
  })

  it('skips initial focus when released before the next frame', async (t) => {
    let { popup } = setup(t)
    let release = createFocusScope(popup)
    release()
    await nextFrame()

    assert.equal(focused(), 'Trigger')
  })
})

describe('focusScope', () => {
  function Dialog(handle: Handle<{ open: boolean }>) {
    return () => (
      <div mix={focusScope({ open: handle.props.open })}>
        <button type="button">Inside</button>
      </div>
    )
  }

  it('focuses inside while open and returns focus when closed or unmounted while open', async (t) => {
    let trigger = document.createElement('button')
    trigger.textContent = 'Open'
    document.body.append(trigger)
    t.after(() => trigger.remove())
    trigger.focus()

    let { act, root, cleanup } = render(<Dialog open />)
    t.after(cleanup)
    await nextFrame()
    assert.equal(focused(), 'Inside')

    await act(() => root.render(<Dialog open={false} />))
    await settle()
    assert.equal(focused(), 'Open')

    await act(() => root.render(<Dialog open />))
    await nextFrame()
    assert.equal(focused(), 'Inside')
    await act(() => root.render(<span />))
    await settle()
    assert.equal(focused(), 'Open')
  })
})
