import { on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { getOpenLayers } from '#remixcn/lib/layer.ts'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './alert-dialog.tsx'
import type { AlertDialogProps } from './alert-dialog.tsx'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from './dialog.tsx'
import type { DialogChangeReason } from './dialog.tsx'

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

function key(target: Element, init: KeyboardEventInit) {
  let event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

function pressBackdrop(dialog: HTMLDialogElement) {
  let rect = dialog.getBoundingClientRect()
  let init = { bubbles: true, cancelable: true, composed: true, clientX: 2, clientY: Math.max(2, rect.top / 2) }
  dialog.dispatchEvent(new PointerEvent('pointerdown', { ...init, pointerId: 1, pointerType: 'mouse' }))
  dialog.dispatchEvent(new PointerEvent('pointerup', { ...init, pointerId: 1, pointerType: 'mouse' }))
  dialog.dispatchEvent(new MouseEvent('click', { ...init, detail: 1 }))
}

function DeleteInvoice(handle: Handle<AlertDialogProps & { onConfirm?: (event: Event) => void }>) {
  return () => {
    let { onConfirm, ...props } = handle.props

    return (
      <AlertDialog {...props}>
        <AlertDialogTrigger>Delete invoice</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete INV-0042?</AlertDialogTitle>
            <AlertDialogDescription>
              Its reminders stop too. <a href="#reminders">See reminders</a>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep invoice</AlertDialogCancel>
            <AlertDialogAction variant="destructive" mix={on('click', (event) => onConfirm?.(event))}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }
}

describe('Alert Dialog in the browser', () => {
  it('opens as a modal alertdialog with focus on the cancel button, before a link in its text', async (t) => {
    let { $, act } = mount(t, <DeleteInvoice />)
    let dialog = $('dialog') as HTMLDialogElement

    await act(() => button('Delete invoice').click())
    await nextFrame()
    assert.ok(dialog.matches(':modal'))
    assert.equal(dialog.getAttribute('role'), 'alertdialog')
    assert.equal(document.activeElement, button('Keep invoice'))
  })

  it('separates confirm and cancel: only the action confirms, and both close the dialog', async (t) => {
    let confirmed = 0
    let reasons: DialogChangeReason[] = []
    let { $, act } = mount(
      t,
      <DeleteInvoice onConfirm={() => confirmed++} onOpenChange={(_open, details) => reasons.push(details.reason)} />,
    )
    let dialog = $('dialog') as HTMLDialogElement

    await act(() => button('Delete invoice').click())
    await act(() => button('Keep invoice').click())
    assert.equal(dialog.open, false)
    assert.equal(confirmed, 0)

    await act(() => button('Delete invoice').click())
    await act(() => button('Delete').click())
    assert.equal(dialog.open, false)
    assert.equal(confirmed, 1)
    assert.deepEqual(reasons, ['trigger-press', 'close-press', 'trigger-press', 'action-press'])
  })

  it('cancels on Escape and never confirms by closing', async (t) => {
    let confirmed = 0
    let reasons: DialogChangeReason[] = []
    let { $, act } = mount(
      t,
      <DeleteInvoice onConfirm={() => confirmed++} onOpenChange={(_open, details) => reasons.push(details.reason)} />,
    )
    let dialog = $('dialog') as HTMLDialogElement

    await act(() => button('Delete invoice').click())
    await act(() => key(dialog, { key: 'Escape' }))
    assert.equal(dialog.open, false)
    assert.equal(confirmed, 0)
    assert.deepEqual(reasons, ['trigger-press', 'escape-key'])
  })

  it('ignores presses outside by default, and closes on them when you allow it', async (t) => {
    let { $, act } = mount(
      t,
      <div>
        <DeleteInvoice />
        <DeleteInvoice disablePointerDismissal={false} />
      </div>,
    )
    let [strict, lenient] = [...document.querySelectorAll('dialog')]
    let [first, second] = [...document.querySelectorAll('button')].filter(
      (element) => element.textContent === 'Delete invoice',
    )

    await act(() => first.click())
    await act(() => pressBackdrop(strict))
    assert.ok(strict.open)
    await act(() => button('Keep invoice', strict).click())

    await act(() => second.click())
    await act(() => pressBackdrop(lenient))
    assert.equal(lenient.open, false)
    assert.ok($('dialog'))
  })

  it('stays open while a confirmation that called preventDefault runs, until its owner closes it', async (t) => {
    function Page(handle: Handle) {
      let open = false
      let status = ''
      return () => (
        <div>
          <DeleteInvoice
            open={open}
            onOpenChange={(next) => void ((open = next), handle.update())}
            onConfirm={(event) => {
              event.preventDefault()
              status = 'Deleting…'
              void handle.update()
            }}
          />
          <p role="status">{status}</p>
          <button type="button" mix={on('click', () => void ((open = false), (status = 'Deleted'), handle.update()))}>
            Finish
          </button>
        </div>
      )
    }

    let { $, act } = mount(t, <Page />)
    let dialog = $('dialog') as HTMLDialogElement

    await act(() => button('Delete invoice').click())
    await act(() => button('Delete').click())
    assert.ok(dialog.open)
    assert.equal($('[role="status"]')?.textContent, 'Deleting…')

    // The page finishes the work, as a response handler would.
    await act(() => {
      button('Finish').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    assert.equal(dialog.open, false)
  })

  it('ignores a held Enter or Space that began before the action had focus', async (t) => {
    let confirmed = 0
    let { act } = mount(t, <DeleteInvoice onConfirm={() => confirmed++} />)

    await act(() => button('Delete invoice').click())
    await nextFrame()
    let action = button('Delete')
    action.focus()

    assert.ok(key(action, { key: 'Enter', repeat: true }).defaultPrevented, 'a repeat from a key held elsewhere')
    assert.ok(key(action, { key: ' ', repeat: true }).defaultPrevented)
    assert.equal(key(action, { key: 'Enter' }).defaultPrevented, false, 'a fresh press on the action')
    assert.equal(key(action, { key: 'Enter', repeat: true }).defaultPrevented, false, 'held after a press on it')
    assert.equal(confirmed, 0)
  })

  /** The button Enter in a field of `form` presses, by the HTML standard: its first submit button. */
  function defaultButton(form: HTMLFormElement) {
    return [...form.elements].find(
      (element): element is HTMLButtonElement => element instanceof HTMLButtonElement && element.type === 'submit',
    )
  }

  it('makes a disabled guard the default button before a submit action, so Enter in a field confirms nothing', async (t) => {
    let submitters: string[] = []
    let { act } = mount(
      t,
      <form
        mix={on(
          'submit',
          (event) => void (event.preventDefault(), submitters.push(event.submitter?.textContent ?? '')),
        )}
      >
        <AlertDialog defaultOpen>
          <AlertDialogContent>
            <AlertDialogTitle>Write off INV-0042?</AlertDialogTitle>
            <input name="reason" aria-label="Reason" />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction type="submit">Write off</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </form>,
    )
    await act(() => {})
    let form = document.querySelector('form')!
    let guard = defaultButton(form)!

    assert.equal(guard.dataset.slot, 'alert-dialog-enter-guard')
    assert.equal(guard.disabled, true)
    assert.equal(getComputedStyle(guard).display, 'none')
    assert.equal(document.querySelector('footer, [data-slot="alert-dialog-footer"]')!.children.length, 3)

    // Pressing the action itself still confirms and submits through it.
    await act(() => button('Write off').click())
    assert.deepEqual(submitters, ['Write off'])
    assert.equal(document.querySelector('dialog')!.open, false)
  })

  it("leaves the default button alone when the form's first submit button isn't the action", async (t) => {
    let { act } = mount(
      t,
      <form>
        <AlertDialog defaultOpen>
          <AlertDialogContent>
            <AlertDialogTitle>Rename the reminder?</AlertDialogTitle>
            <input name="name" aria-label="Name" />
            <button type="submit">Save name</button>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction type="submit">Send</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </form>,
    )
    await act(() => {})

    assert.equal(defaultButton(document.querySelector('form')!)?.textContent, 'Save name')
  })

  it('closes only itself on Escape when it opened from a dialog', async (t) => {
    let { act } = mount(
      t,
      <Dialog>
        <DialogTrigger>Invoice</DialogTrigger>
        <DialogContent>
          <DialogTitle>Invoice</DialogTitle>
          <DeleteInvoice />
        </DialogContent>
      </Dialog>,
    )
    let [outer, alert] = [...document.querySelectorAll('dialog')]

    await act(() => button('Invoice').click())
    await act(() => button('Delete invoice').click())
    await nextFrame()
    assert.ok(alert.matches(':modal'))
    assert.ok(alert.hasAttribute('data-nested'))

    await act(() => key(document.activeElement!, { key: 'Escape' }))
    await nextFrame()
    assert.equal(alert.open, false)
    assert.ok(outer.matches(':modal'))
    assert.equal(document.activeElement, button('Delete invoice'))
  })
})
