import { on, ref } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { focusScope } from '#remixcn/lib/focus-scope.ts'
import { dismissableLayer, getOpenLayers } from '#remixcn/lib/layer.ts'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog.tsx'
import type { DialogChangeReason, DialogProps } from './dialog.tsx'

function mount(t: TestContext, node: RemixNode) {
  let result = render(node)
  t.after(() => {
    result.cleanup()
    for (let layer of getOpenLayers(document)) layer.release()
  })
  return result
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
}

function button(name: string, root: ParentNode = document) {
  let found = [...root.querySelectorAll('button')].find((element) => element.textContent?.trim() === name)
  assert.ok(found instanceof HTMLButtonElement, `no button named ${name}`)
  return found
}

function focused() {
  return document.activeElement?.textContent?.trim() ?? document.activeElement?.tagName
}

function escape(target: Element = document.activeElement ?? document.body) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
}

/** A press at a point, as a browser sends it: pointerdown, pointerup, then click on the element under the point. */
function pressAt(target: Element, clientX: number, clientY: number) {
  let init = { bubbles: true, cancelable: true, composed: true, clientX, clientY, pointerId: 1, isPrimary: true }
  target.dispatchEvent(new PointerEvent('pointerdown', { ...init, pointerType: 'mouse' }))
  target.dispatchEvent(new PointerEvent('pointerup', { ...init, pointerType: 'mouse' }))
  target.dispatchEvent(new MouseEvent('click', { ...init, detail: 1 }))
}

/** A press on a modal dialog's backdrop: the dialog element is the target, the point lies outside its box. */
function pressBackdrop(dialog: HTMLDialogElement) {
  let rect = dialog.getBoundingClientRect()
  pressAt(dialog, Math.max(1, rect.left / 2), Math.max(1, rect.top / 2))
}

function InvoiceDialog(handle: Handle<DialogProps & { label?: string; extra?: RemixNode }>) {
  return () => {
    let { label = 'Edit invoice', extra, ...props } = handle.props

    return (
      <Dialog {...props}>
        <DialogTrigger>{label}</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit invoice</DialogTitle>
            <DialogDescription>Change the due date of INV-0042.</DialogDescription>
          </DialogHeader>
          <label>
            Due date <input name="due" defaultValue="2026-11-30" />
          </label>
          {extra}
          <DialogFooter>
            <DialogClose>Cancel</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }
}

describe('Dialog in the browser', () => {
  it('opens as a modal dialog, focuses the first field, and closes on Escape with focus back on the trigger', async (t) => {
    let changes: Array<[boolean, DialogChangeReason]> = []
    let { $, act } = mount(
      t,
      <main>
        <button type="button">Before</button>
        <InvoiceDialog onOpenChange={(open, details) => changes.push([open, details.reason])} />
      </main>,
    )
    let trigger = button('Edit invoice')
    let dialog = $('dialog') as HTMLDialogElement
    trigger.focus()

    await act(() => trigger.click())
    await nextFrame()
    assert.ok(dialog.matches(':modal'))
    assert.equal(trigger.getAttribute('aria-expanded'), 'true')
    assert.ok(dialog.hasAttribute('data-open'))
    assert.equal((document.activeElement as HTMLInputElement).name, 'due')
    assert.equal(getComputedStyle(document.documentElement).overflowY, 'hidden', 'the page stops scrolling')
    button('Before').focus()
    assert.equal((document.activeElement as HTMLInputElement).name, 'due', 'the page behind is inert')

    await act(() => escape())
    await nextFrame()
    assert.equal(dialog.open, false)
    assert.equal(trigger.getAttribute('aria-expanded'), 'false')
    assert.equal(document.activeElement, trigger)
    assert.equal(document.documentElement.style.overflowY, '')
    assert.deepEqual(changes, [
      [true, 'trigger-press'],
      [false, 'escape-key'],
    ])
  })

  it('wraps Tab and Shift+Tab inside a modal dialog, and leaves Tab alone in one that is not modal', async (t) => {
    let tab = (shiftKey = false) => {
      let event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true })
      document.activeElement!.dispatchEvent(event)
      return event.defaultPrevented
    }
    let { act } = mount(
      t,
      <div>
        <InvoiceDialog />
        <InvoiceDialog modal={false} label="Preview invoice" />
      </div>,
    )
    let [modalDialog, nonModal] = [...document.querySelectorAll('dialog')]

    await act(() => button('Edit invoice').click())
    await nextFrame()
    button('Close', modalDialog).focus()
    assert.equal(tab(), true)
    assert.equal((document.activeElement as HTMLInputElement).name, 'due')
    assert.equal(tab(true), true)
    assert.equal(document.activeElement, button('Close', modalDialog))
    await act(() => escape())

    await act(() => button('Preview invoice').click())
    await nextFrame()
    button('Close', nonModal).focus()
    assert.equal(tab(), false)
  })

  it('follows a change of modal while open, with the trap, focus and scroll lock, and still returns focus', async (t) => {
    let tab = () => {
      let event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
      document.activeElement!.dispatchEvent(event)
      return event.defaultPrevented
    }
    let reasons: DialogChangeReason[] = []
    let { $, act, root } = mount(t, <InvoiceDialog onOpenChange={(_open, details) => reasons.push(details.reason)} />)
    let dialog = $('dialog') as HTMLDialogElement
    let trigger = button('Edit invoice')

    await act(() => trigger.click())
    await nextFrame()
    let close = button('Close', dialog)
    close.focus()
    assert.equal(tab(), true, 'a modal dialog wraps Tab')
    close.focus()

    await act(() =>
      root.render(<InvoiceDialog modal={false} onOpenChange={(_open, details) => reasons.push(details.reason)} />),
    )
    assert.ok(dialog.open)
    assert.equal(dialog.matches(':modal'), false)
    assert.equal(document.activeElement, close, 'focus stays where it was')
    assert.equal(tab(), false, 'a dialog that is not modal leaves Tab to the browser')
    assert.equal(document.documentElement.style.overflowY, '')

    await act(() =>
      root.render(<InvoiceDialog modal onOpenChange={(_open, details) => reasons.push(details.reason)} />),
    )
    assert.ok(dialog.matches(':modal'))
    assert.equal(document.activeElement, close)
    assert.equal(tab(), true, 'the newly modal dialog wraps Tab again')
    assert.equal(getComputedStyle(document.documentElement).overflowY, 'hidden')

    await act(() => escape())
    await nextFrame()
    assert.equal(dialog.open, false)
    assert.equal(document.activeElement, trigger)
    assert.deepEqual(reasons, ['trigger-press', 'escape-key'], 'switching never closed it')
  })

  it('closes from its close buttons and from a press on the backdrop, but not from a press inside', async (t) => {
    let reasons: DialogChangeReason[] = []
    let { $, act } = mount(t, <InvoiceDialog onOpenChange={(_open, details) => reasons.push(details.reason)} />)
    let dialog = $('dialog') as HTMLDialogElement

    await act(() => button('Edit invoice').click())
    await act(() => pressAt($('input')!, 10, 10))
    assert.ok(dialog.open, 'a press inside keeps it open')
    await act(() => button('Cancel').click())
    assert.equal(dialog.open, false)

    await act(() => button('Edit invoice').click())
    await act(() => button('Close', dialog).click())
    assert.equal(dialog.open, false)

    await act(() => button('Edit invoice').click())
    await act(() => pressBackdrop(dialog))
    assert.equal(dialog.open, false)
    assert.deepEqual(reasons, [
      'trigger-press',
      'close-press',
      'trigger-press',
      'close-press',
      'trigger-press',
      'outside-press',
    ])
  })

  it('keeps open on backdrop presses with disablePointerDismissal, and still closes on Escape', async (t) => {
    let { $, act } = mount(t, <InvoiceDialog disablePointerDismissal />)
    let dialog = $('dialog') as HTMLDialogElement

    await act(() => button('Edit invoice').click())
    await act(() => pressBackdrop(dialog))
    assert.ok(dialog.open)
    await act(() => escape(dialog))
    assert.equal(dialog.open, false)
  })

  it('follows a controlled open prop, and opens or closes only when its owner renders the change', async (t) => {
    let requests: Array<[boolean, DialogChangeReason]> = []

    function Owner(handle: Handle<{ accept: boolean }>) {
      let open = false
      return () => (
        <div>
          <button type="button" mix={on('click', () => void ((open = !open), handle.update()))}>
            Toggle from outside
          </button>
          <InvoiceDialog
            open={open}
            onOpenChange={(next, details) => {
              requests.push([next, details.reason])
              if (!handle.props.accept) return
              open = next
              void handle.update()
            }}
          />
        </div>
      )
    }

    let { $, act, root } = mount(t, <Owner accept={false} />)
    let dialog = $('dialog') as HTMLDialogElement

    await act(() => button('Edit invoice').click())
    assert.equal(dialog.open, false, 'the owner kept it closed')

    await act(() => button('Toggle from outside').click())
    assert.ok(dialog.matches(':modal'))
    await act(() => escape(dialog))
    assert.ok(dialog.open, 'the owner kept it open')

    await act(() => root.render(<Owner accept />))
    await act(() => escape(dialog))
    assert.equal(dialog.open, false)
    assert.deepEqual(requests, [
      [true, 'trigger-press'],
      [false, 'escape-key'],
      [false, 'escape-key'],
    ])
  })

  it('keeps its state when onOpenChange cancels the change', async (t) => {
    let { $, act } = mount(t, <InvoiceDialog onOpenChange={(open, details) => !open && details.cancel()} />)
    let dialog = $('dialog') as HTMLDialogElement

    await act(() => button('Edit invoice').click())
    await act(() => escape(dialog))
    await act(() => button('Cancel').click())
    assert.ok(dialog.open)
  })

  it('lets the trigger cancel its own opening with preventDefault', async (t) => {
    let { $, act } = mount(
      t,
      <Dialog>
        <DialogTrigger mix={on('click', (event) => event.preventDefault())}>Locked</DialogTrigger>
        <DialogContent>
          <DialogTitle>Locked</DialogTitle>
        </DialogContent>
      </Dialog>,
    )

    await act(() => button('Locked').click())
    assert.equal(($('dialog') as HTMLDialogElement).open, false)
  })

  it('opens from any of its triggers and returns focus to the one that opened it, also where a click leaves focus elsewhere', async (t) => {
    let { $, act } = mount(
      t,
      <Dialog>
        <DialogTrigger>From the list</DialogTrigger>
        <DialogTrigger>From the toolbar</DialogTrigger>
        <DialogContent>
          <DialogTitle>Reminder</DialogTitle>
          <DialogClose>Done</DialogClose>
        </DialogContent>
      </Dialog>,
    )
    let toolbar = button('From the toolbar')

    // WebKit doesn't focus a button on click, so focus stays where it was.
    button('From the list').focus()
    await act(() => toolbar.click())
    await nextFrame()
    assert.equal(focused(), 'Done')
    assert.equal(toolbar.getAttribute('aria-expanded'), 'true')
    await act(() => button('Done').click())
    await nextFrame()
    assert.equal(document.activeElement, toolbar)
    assert.equal(($('dialog') as HTMLDialogElement).open, false)
  })

  for (let change of ['removed', 'disabled'] as const) {
    it(`returns focus to a neighbor when the trigger was ${change} while open`, async (t) => {
      function Page(handle: Handle) {
        let changed = false
        return () => (
          <main>
            <button type="button">Before</button>
            <Dialog>
              {changed && change === 'removed' ? null : (
                <DialogTrigger disabled={changed && change === 'disabled'}>Archive</DialogTrigger>
              )}
              <DialogContent>
                <DialogTitle>Archive</DialogTitle>
                <button type="button" mix={on('click', () => void ((changed = true), handle.update()))}>
                  Change trigger
                </button>
              </DialogContent>
            </Dialog>
          </main>
        )
      }

      let { $, act } = mount(t, <Page />)
      let dialog = $('dialog') as HTMLDialogElement

      await act(() => button('Archive').click())
      await act(() => button('Change trigger').click())
      await act(() => escape(dialog))
      await nextFrame()
      assert.equal(dialog.open, false)
      assert.equal(focused(), 'Before')
    })
  }

  it('focuses the dialog itself when a touch opened it, so no virtual keyboard opens', async (t) => {
    let { $, act } = mount(t, <InvoiceDialog />)
    let trigger = button('Edit invoice')
    let dialog = $('dialog') as HTMLDialogElement

    await act(() => {
      trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }))
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }))
    })
    await nextFrame()
    assert.equal(document.activeElement, dialog)
  })

  it('works beside the page when it is not modal, and closes when focus leaves it', async (t) => {
    let reasons: DialogChangeReason[] = []
    let { $, act } = mount(
      t,
      <main>
        <button type="button">Page action</button>
        <InvoiceDialog modal={false} onOpenChange={(_open, details) => reasons.push(details.reason)} />
      </main>,
    )
    let dialog = $('dialog') as HTMLDialogElement
    let trigger = button('Edit invoice')

    await act(() => trigger.click())
    await nextFrame()
    assert.ok(dialog.open)
    assert.equal(dialog.matches(':modal'), false)
    assert.equal(document.documentElement.style.overflowY, '', 'the page keeps scrolling')
    assert.equal(button('Page action').closest('[inert]'), null)

    await act(() => trigger.click())
    assert.equal(dialog.open, false, 'its trigger toggles it')

    await act(() => trigger.click())
    await nextFrame()
    await act(() => button('Page action').focus())
    assert.equal(dialog.open, false)

    await act(() => trigger.click())
    await act(() => pressAt(button('Page action'), 1, 1))
    assert.equal(dialog.open, false)
    assert.deepEqual(reasons, [
      'trigger-press',
      'trigger-press',
      'trigger-press',
      'focus-out',
      'trigger-press',
      'outside-press',
    ])
  })

  it('closes the inner of two nested dialogs first, and closes the inner one with the outer', async (t) => {
    let inner: Array<[boolean, DialogChangeReason]> = []

    // The owner closes both dialogs from inside the inner one, such as after deleting the invoice.
    function Page(handle: Handle) {
      let open = false
      return () => (
        <Dialog open={open} onOpenChange={(next) => void ((open = next), handle.update())}>
          <DialogTrigger>Invoice</DialogTrigger>
          <DialogContent>
            <DialogTitle>Invoice</DialogTitle>
            <Dialog onOpenChange={(next, details) => inner.push([next, details.reason])}>
              <DialogTrigger>Delete</DialogTrigger>
              <DialogContent>
                <DialogTitle>Delete invoice?</DialogTitle>
                <DialogClose>Keep</DialogClose>
                <button type="button" mix={on('click', () => void ((open = false), handle.update()))}>
                  Delete and close
                </button>
              </DialogContent>
            </Dialog>
          </DialogContent>
        </Dialog>
      )
    }

    let { act } = mount(t, <Page />)
    let [outer, nested] = [...document.querySelectorAll('dialog')]

    await act(() => button('Invoice').click())
    await act(() => button('Delete').click())
    await nextFrame()
    assert.ok(nested.matches(':modal'))
    assert.ok(nested.hasAttribute('data-nested'))
    assert.equal(outer.hasAttribute('data-nested'), false)
    assert.equal(focused(), 'Keep')

    await act(() => escape())
    await nextFrame()
    assert.ok(outer.matches(':modal'))
    assert.equal(nested.open, false)
    assert.equal(focused(), 'Delete')

    await act(() => button('Delete').click())
    await act(() => pressBackdrop(nested))
    assert.equal(nested.open, false, 'a press on the inner backdrop closes only the inner dialog')
    assert.ok(outer.open)

    await act(() => button('Delete').click())
    await act(() => button('Delete and close').click())
    await act(() => {})
    await nextFrame()
    assert.equal(outer.open, false)
    assert.equal(nested.open, false)
    assert.deepEqual(inner.at(-1), [false, 'parent-dismissed'])
    assert.equal(document.activeElement, button('Invoice'))
  })

  it('closes a popover inside it before itself', async (t) => {
    function Menu(handle: Handle) {
      let open = false
      let trigger: HTMLElement | null = null
      return () => (
        <div>
          <button
            type="button"
            mix={[ref((node) => (trigger = node)), on('click', () => void ((open = true), handle.update()))]}
          >
            Options
          </button>
          {open ? (
            <div
              popover="manual"
              mix={[
                ref((node) => node.showPopover()),
                dismissableLayer({ trigger: () => trigger, onDismiss: () => void ((open = false), handle.update()) }),
                focusScope(),
              ]}
            >
              <button type="button">Duplicate</button>
            </div>
          ) : null}
        </div>
      )
    }

    let { $, act } = mount(t, <InvoiceDialog extra={<Menu />} />)
    let dialog = $('dialog') as HTMLDialogElement

    await act(() => button('Edit invoice').click())
    await nextFrame()
    button('Options').focus()
    await act(() => button('Options').click())
    await nextFrame()
    assert.equal(focused(), 'Duplicate')

    await act(() => escape())
    await nextFrame()
    assert.equal($('[popover]'), null)
    assert.ok(dialog.open)
    assert.equal(focused(), 'Options')

    await act(() => button('Options').click())
    await nextFrame()
    await act(() => button('Duplicate').focus())
    assert.ok(dialog.open, 'focus in a popover it owns stays inside')
    await act(() => escape())
    await act(() => escape())
    assert.equal(dialog.open, false)
  })

  it('ends in the last state after rapid opening and closing', async (t) => {
    let { $, act } = mount(t, <InvoiceDialog />)
    let dialog = $('dialog') as HTMLDialogElement
    let trigger = button('Edit invoice')

    await act(() => {
      trigger.click()
    })
    for (let round = 0; round < 3; round++) {
      await act(() => button('Cancel').click())
      await act(() => trigger.click())
    }
    // Let the close events of the earlier closings arrive.
    await nextFrame()
    assert.ok(dialog.matches(':modal'))
    assert.equal(getOpenLayers(document).length, 1)
    assert.equal(trigger.getAttribute('aria-expanded'), 'true')

    await act(() => button('Cancel').click())
    await nextFrame()
    assert.equal(dialog.open, false)
    assert.equal(getOpenLayers(document).length, 0)
    assert.equal(document.documentElement.style.overflowY, '')
  })

  it('cleans up when it unmounts while open', async (t) => {
    function Page(handle: Handle) {
      let shown = true
      return () => (
        <main>
          <button type="button" mix={on('click', () => void ((shown = false), handle.update()))}>
            Hide
          </button>
          {shown ? <InvoiceDialog defaultOpen /> : null}
        </main>
      )
    }

    let { $, act } = mount(t, <Page />)
    await act(() => {})
    await nextFrame()
    let dialog = $('dialog') as HTMLDialogElement
    assert.ok(dialog.matches(':modal'))
    assert.equal(getComputedStyle(document.documentElement).overflowY, 'hidden')

    await act(() => {
      dialog.close()
      // The page itself hides the dialog, from code outside it.
      button('Hide').click()
    })
    await nextFrame()
    assert.equal($('dialog'), null)
    assert.equal(getOpenLayers(document).length, 0)
    assert.equal(document.documentElement.style.overflowY, '')
  })

  it('follows a native close, such as a form with method="dialog", and lets a controlled owner keep it open', async (t) => {
    let reasons: DialogChangeReason[] = []
    let { $, act } = mount(
      t,
      <Dialog defaultOpen onOpenChange={(_open, details) => reasons.push(details.reason)}>
        <DialogContent>
          <DialogTitle>Terms</DialogTitle>
          <form method="dialog">
            <button type="submit">Accept</button>
          </form>
        </DialogContent>
      </Dialog>,
    )
    await act(() => {})
    let dialog = $('dialog') as HTMLDialogElement
    assert.ok(dialog.matches(':modal'))

    await act(() => button('Accept').click())
    await new Promise((resolve) => setTimeout(resolve, 20))
    await act(() => {})
    assert.equal(dialog.open, false)
    assert.deepEqual(reasons, ['none'])

    let kept = mount(
      t,
      <Dialog open onOpenChange={() => {}}>
        <DialogContent>
          <DialogTitle>Required</DialogTitle>
          <form method="dialog">
            <button type="submit">Skip</button>
          </form>
        </DialogContent>
      </Dialog>,
    )
    await kept.act(() => {})
    let required = [...document.querySelectorAll('dialog')].at(-1)!
    await kept.act(() => button('Skip').click())
    await new Promise((resolve) => setTimeout(resolve, 20))
    await kept.act(() => {})
    assert.ok(required.matches(':modal'), 'the owner kept it open, so it opens again')
  })

  it('keeps its open state while its children change, and reports when an opening or closing finished', async (t) => {
    let completed: boolean[] = []

    function Page(handle: Handle) {
      let step = 1
      return () => (
        <Dialog onOpenChangeComplete={(open) => completed.push(open)}>
          <DialogTrigger>Wizard</DialogTrigger>
          <DialogContent>
            <DialogTitle>Step {step}</DialogTitle>
            {step === 1 ? (
              <button type="button" mix={on('click', () => void ((step = 2), handle.update()))}>
                Next
              </button>
            ) : (
              <label>
                Reference <input name="reference" />
              </label>
            )}
          </DialogContent>
        </Dialog>
      )
    }

    let { $, act } = mount(t, <Page />)
    let dialog = $('dialog') as HTMLDialogElement

    await act(() => button('Wizard').click())
    await act(() => button('Next').click())
    assert.ok(dialog.matches(':modal'))
    assert.equal($('h2')?.textContent, 'Step 2')
    assert.ok($('input[name="reference"]'))

    await act(() => escape(dialog))
    await nextFrame()
    assert.deepEqual(completed, [true, false])
  })

  it("runs the caller's mixins and attributes on the native dialog", async (t) => {
    let node: HTMLDialogElement | undefined
    let { $ } = mount(
      t,
      <Dialog>
        <DialogContent data-test="custom" mix={ref((element) => (node = element as HTMLDialogElement))}>
          <DialogTitle>Custom</DialogTitle>
        </DialogContent>
      </Dialog>,
    )

    assert.equal(node, $('dialog'))
    assert.equal(node?.dataset.test, 'custom')
  })
})
