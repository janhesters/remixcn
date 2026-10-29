import * as assert from 'remix/assert'
import { on, ref } from 'remix/component'
import type { Handle } from 'remix/component'
import { render } from 'remix/component/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { anchorPosition } from '#remixcn/lib/anchor-position.ts'
import { focusScope } from '#remixcn/lib/focus-scope.ts'
import { dismissableLayer, getOpenLayers, openLayer } from '#remixcn/lib/layer.ts'
import { modal } from '#remixcn/lib/modal.ts'
import type { DismissReason, Layer, LayerOptions } from '#remixcn/lib/layer.ts'

/** Adds a fixed box at the given position, so presses can land on it by coordinates. */
function box(t: TestContext, name: string, left: number, top: number, parent: Element = document.body) {
  let element = document.createElement('div')
  element.dataset.name = name
  element.tabIndex = -1
  element.style.cssText = `position: fixed; left: ${left}px; top: ${top}px; width: 60px; height: 40px`
  parent.append(element)
  t.after(() => element.remove())
  return element
}

function track(t: TestContext, element: HTMLElement, options: Partial<LayerOptions> = {}) {
  let dismissed: DismissReason[] = []
  let layer = openLayer(element, { ...options, onDismiss: (request) => dismissed.push(request.reason) })
  t.after(() => layer.release())
  return { layer, dismissed }
}

function center(element: Element) {
  let rect = element.getBoundingClientRect()
  return { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }
}

function pointer(type: string, target: Element, at: { clientX: number; clientY: number }, pointerType = 'mouse') {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 1,
      isPrimary: true,
      pointerType,
      ...at,
    }),
  )
}

/** A press that starts on `down` and ends on `up`, with the click on their common ancestor, as browsers do. */
function press(down: Element, up: Element = down, pointerType = 'mouse') {
  pointer('pointerdown', down, center(down), pointerType)
  // Touch pointers stay captured to the element they started on.
  pointer('pointerup', pointerType === 'touch' ? down : up, center(up), pointerType)
  let common: Element | null = down
  while (common && !common.contains(up)) common = common.parentElement
  common!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1, ...center(up) }))
}

function escape(target: Element = document.body) {
  let event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
  target.dispatchEvent(event)
  return event
}

describe('openLayer', () => {
  it('dismisses only the topmost layer on Escape and prevents the native close', (t) => {
    let parent = box(t, 'parent', 0, 0)
    let child = box(t, 'child', 100, 0, parent)
    let a = track(t, parent)
    let b = track(t, child)

    assert.equal(b.layer.parent, a.layer)
    assert.ok(b.layer.isTopmost())
    assert.ok(escape(child).defaultPrevented)
    assert.deepEqual([a.dismissed, b.dismissed], [[], ['escape-key']])

    b.layer.release()
    assert.ok(a.layer.isTopmost())
    escape()
    assert.deepEqual(a.dismissed, ['escape-key'])
  })

  it('treats a later sibling layer as topmost', (t) => {
    let a = track(t, box(t, 'a', 0, 0))
    let b = track(t, box(t, 'b', 100, 0))

    assert.equal(b.layer.parent, null)
    escape()
    assert.deepEqual([a.dismissed, b.dismissed], [[], ['escape-key']])
  })

  it('leaves an Escape the content handled, and stops at a topmost layer that ignores Escape', (t) => {
    let parent = box(t, 'parent', 0, 0)
    let a = track(t, parent)
    let b = track(t, box(t, 'child', 100, 0, parent), { dismissOnEscape: false })
    let input = document.createElement('input')
    parent.append(input)
    input.addEventListener('keydown', (event) => event.preventDefault())

    escape(input)
    escape()
    assert.deepEqual([a.dismissed, b.dismissed], [[], []])
  })

  it('dismisses every layer a press lands outside of, topmost first', (t) => {
    let outside = box(t, 'outside', 300, 300)
    let parent = box(t, 'parent', 0, 0)
    let child = box(t, 'child', 100, 0, parent)
    let order: string[] = []
    openLayer(parent, { onDismiss: () => order.push('parent') })
    openLayer(child, { onDismiss: () => order.push('child') })
    t.after(() => getOpenLayers(document).forEach((layer) => layer.release()))

    press(child)
    assert.deepEqual(order, [])
    press(parent)
    assert.deepEqual(order, ['child'])
    press(outside)
    assert.deepEqual(order, ['child', 'child', 'parent'])
  })

  it('dismisses a parallel layer when the press lands in another layer', (t) => {
    let a = track(t, box(t, 'a', 0, 0))
    let b = track(t, box(t, 'b', 100, 0))

    press(a.layer.element)
    assert.deepEqual([a.dismissed, b.dismissed], [[], ['outside-press']])
  })

  it('ignores presses dragged out of or into a layer', (t) => {
    let outside = box(t, 'outside', 300, 300)
    let a = track(t, box(t, 'a', 0, 0))
    let b = track(t, box(t, 'b', 100, 0))

    press(a.layer.element, outside)
    press(outside, b.layer.element)
    press(b.layer.element, a.layer.element)
    assert.deepEqual([a.dismissed, b.dismissed], [[], []])
  })

  it('ignores a touch that scrolls instead of tapping', (t) => {
    let outside = box(t, 'outside', 300, 300)
    let { dismissed } = track(t, box(t, 'a', 0, 0))

    pointer('pointerdown', outside, center(outside), 'touch')
    pointer('pointercancel', outside, center(outside), 'touch')
    outside.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    assert.deepEqual(dismissed, [])

    press(outside, outside, 'touch')
    assert.deepEqual(dismissed, ['outside-press'])
  })

  it('ignores the click of a press that began before the layer opened', (t) => {
    let outside = box(t, 'outside', 300, 300)
    pointer('pointerdown', outside, center(outside))
    let { dismissed } = track(t, box(t, 'a', 0, 0))
    pointer('pointerup', outside, center(outside))
    outside.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))

    assert.deepEqual(dismissed, [])
  })

  it('applies a press only to the layers open when it began, also when another layer was open', (t) => {
    let outside = box(t, 'outside', 300, 300)
    let first = track(t, box(t, 'a', 0, 0))
    pointer('pointerdown', outside, center(outside))
    let second = track(t, box(t, 'b', 100, 0))
    pointer('pointerup', outside, center(outside))
    outside.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1, ...center(outside) }))

    assert.deepEqual([first.dismissed, second.dismissed], [['outside-press'], []])
  })

  it('counts the trigger as inside and accepts keyboard clicks outside', (t) => {
    let trigger = box(t, 'trigger', 300, 0)
    let button = document.createElement('button')
    document.body.append(button)
    t.after(() => button.remove())
    let { dismissed } = track(t, box(t, 'a', 0, 0), { trigger: () => trigger })

    press(trigger)
    assert.deepEqual(dismissed, [])
    button.click()
    assert.deepEqual(dismissed, ['outside-press'])
  })

  it('lets a predicate keep presses on chosen outside elements', (t) => {
    let toast = box(t, 'toast', 300, 0)
    let outside = box(t, 'outside', 300, 300)
    let { dismissed } = track(t, box(t, 'a', 0, 0), {
      dismissOnOutsidePress: (target) => !target.closest('[data-name=toast]'),
    })

    press(toast)
    assert.deepEqual(dismissed, [])
    press(outside)
    assert.deepEqual(dismissed, ['outside-press'])
  })

  it('shields layers below a modal layer from outside presses', (t) => {
    let outside = box(t, 'outside', 300, 300)
    let below = track(t, box(t, 'below', 0, 0))
    let modal = track(t, box(t, 'modal', 100, 0), { modal: true })

    press(outside)
    assert.deepEqual([below.dismissed, modal.dismissed], [[], ['outside-press']])
  })

  it('dismisses a modal dialog on a backdrop press, but not on presses inside its box', (t) => {
    let dialog = document.createElement('dialog')
    dialog.style.cssText = 'width: 100px; height: 60px; padding: 0'
    let button = document.createElement('button')
    dialog.append(button)
    document.body.append(dialog)
    t.after(() => dialog.remove())
    dialog.showModal()
    let { dismissed } = track(t, dialog, { modal: true })

    let rect = dialog.getBoundingClientRect()
    let inside = { clientX: rect.left + 5, clientY: rect.top + 5 }
    let backdrop = { clientX: 5, clientY: 5 }
    for (let at of [inside, backdrop]) {
      pointer('pointerdown', dialog, at)
      pointer('pointerup', dialog, at)
      dialog.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1, ...at }))
    }
    assert.deepEqual(dismissed, ['outside-press'])

    let cancel = new Event('cancel', { cancelable: true })
    dialog.dispatchEvent(cancel)
    assert.ok(cancel.defaultPrevented)
    assert.deepEqual(dismissed, ['outside-press', 'close-request'])
    assert.ok(dialog.open)
  })

  it('dismisses child layers when their parent goes away', (t) => {
    let parent = box(t, 'parent', 0, 0)
    let trigger = document.createElement('button')
    parent.append(trigger)
    let a = track(t, parent)
    let b = track(t, box(t, 'submenu', 100, 0), { trigger })

    assert.equal(b.layer.parent, a.layer)
    a.layer.release()
    assert.deepEqual(b.dismissed, ['parent-dismissed'])
    assert.equal(b.layer.parent, null)
  })

  it('stops listening once the last layer is released', (t) => {
    let outside = box(t, 'outside', 300, 300)
    let { layer, dismissed } = track(t, box(t, 'a', 0, 0))
    layer.release()

    assert.deepEqual(getOpenLayers(document), [])
    assert.equal(escape().defaultPrevented, false)
    press(outside)
    assert.deepEqual(dismissed, [])
  })
})

describe('dismissableLayer', () => {
  function Popover(handle: Handle<{ open: boolean; onDismiss: (reason: DismissReason) => void }>) {
    return () => (
      <div
        data-popover
        mix={dismissableLayer({
          open: handle.props.open,
          onDismiss: (request) => handle.props.onDismiss(request.reason),
        })}
      />
    )
  }

  it('joins the stack while open and leaves it when closed or unmounted while open', async (t) => {
    let reasons: DismissReason[] = []
    let onDismiss = (reason: DismissReason) => reasons.push(reason)
    let { $, act, root, cleanup } = render(<Popover open onDismiss={onDismiss} />)
    t.after(cleanup)
    let layers: readonly Layer[] = getOpenLayers(document)

    assert.equal(layers.length, 1)
    assert.equal(layers[0].element, $('[data-popover]'))
    escape()
    assert.deepEqual(reasons, ['escape-key'])

    await act(() => root.render(<Popover open={false} onDismiss={onDismiss} />))
    assert.equal(getOpenLayers(document).length, 0)

    await act(() => root.render(<Popover open onDismiss={onDismiss} />))
    assert.equal(getOpenLayers(document).length, 1)
    await act(() => root.render(<div />))
    assert.equal(getOpenLayers(document).length, 0)
    assert.equal(escape().defaultPrevented, false)
  })
})

describe('composed overlays', () => {
  function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  }

  // A modal dialog with a nested popover, built only from the helpers.
  function Page(handle: Handle) {
    let dialogOpen = false
    let popoverOpen = false
    let dialog: HTMLDialogElement | null = null
    let popoverTrigger: HTMLElement | null = null

    function setDialog(open: boolean) {
      dialogOpen = open
      if (!open) popoverOpen = false
      handle.queueTask(() => (open ? dialog?.showModal() : dialog?.close()))
      void handle.update()
    }

    function setPopover(open: boolean) {
      popoverOpen = open
      void handle.update()
    }

    return () => (
      <main>
        <button type="button" data-open-dialog mix={on('click', () => setDialog(true))}>
          Open dialog
        </button>
        <dialog
          mix={[
            ref((node) => (dialog = node as HTMLDialogElement)),
            dismissableLayer({ open: dialogOpen, modal: true, onDismiss: () => setDialog(false) }),
            focusScope({ open: dialogOpen }),
            modal({ open: dialogOpen }),
          ]}
        >
          <button
            type="button"
            data-open-popover
            mix={[ref((node) => (popoverTrigger = node as HTMLElement)), on('click', () => setPopover(true))]}
          >
            Options
          </button>
          {popoverOpen && (
            <div
              popover="manual"
              mix={[
                ref((node) => (node as HTMLElement).showPopover()),
                dismissableLayer({ trigger: () => popoverTrigger, onDismiss: () => setPopover(false) }),
                focusScope(),
                anchorPosition({ anchor: () => popoverTrigger, align: 'start' }),
              ]}
            >
              <button type="button">Rename</button>
            </div>
          )}
        </dialog>
      </main>
    )
  }

  it('closes the nested popover first, returns focus step by step, and restores the page', async (t) => {
    let { $, act, cleanup } = render(<Page />)
    t.after(cleanup)
    let openDialog = $('[data-open-dialog]') as HTMLButtonElement
    openDialog.focus()

    await act(() => openDialog.click())
    await nextFrame()
    let dialog = $('dialog') as HTMLDialogElement
    assert.ok(dialog.matches(':modal'))
    assert.equal(document.activeElement?.textContent, 'Options')
    assert.equal(getComputedStyle(document.documentElement).overflowY, 'hidden')

    await act(() => ($('[data-open-popover]') as HTMLButtonElement).click())
    await nextFrame()
    assert.equal(document.activeElement?.textContent, 'Rename')
    assert.equal(($('[popover]') as HTMLElement).dataset.side, 'bottom')
    assert.equal(getOpenLayers(document).length, 2)

    await act(() => escape(document.activeElement!))
    await nextFrame()
    assert.equal($('[popover]'), null)
    assert.ok(dialog.open)
    assert.equal(document.activeElement?.textContent, 'Options')

    await act(() => escape(document.activeElement!))
    await nextFrame()
    assert.equal(dialog.open, false)
    assert.equal(document.activeElement, openDialog)
    assert.equal(getOpenLayers(document).length, 0)
    assert.equal(document.documentElement.style.overflowY, '')
  })
})
