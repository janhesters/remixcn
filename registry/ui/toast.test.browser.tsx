import { on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import {
  Toast,
  ToastAction,
  ToastClose,
  ToastContent,
  ToastDescription,
  ToastList,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  createToastManager,
} from './toast.tsx'
import type { ToastManager, ToastPosition, ToastProviderProps, ToastStore } from './toast.tsx'

/** Fake timers with a clock that moves with them, so paused timers know how much time is left. */
function useClock(t: TestContext) {
  let timers = t.useFakeTimers()
  let now = 0
  t.mock.method(performance, 'now', () => now)
  return {
    advance(ms: number) {
      now += ms
      timers.advance(ms)
    },
  }
}

interface MountOptions extends Omit<ToastProviderProps, 'children'> {
  position?: ToastPosition
  expanded?: boolean
  children?: RemixNode
}

function mount(t: TestContext, { position, expanded, children, ...provider }: MountOptions = {}) {
  let toastManager = provider.toastManager ?? createToastManager()
  let result = render(
    <ToastProvider {...provider} toastManager={toastManager}>
      {children}
      <ToastViewport position={position} expanded={expanded}>
        <ToastList />
      </ToastViewport>
    </ToastProvider>,
  )
  t.after(result.cleanup)
  return { ...result, manager: toastManager }
}

type Mounted = ReturnType<typeof mount>

/** Lets the exit of a closing toast finish: without the theme there's no transition, so it ends after a microtask. */
async function settle({ act }: Pick<Mounted, 'act'>) {
  await act(async () => {
    for (let turn = 0; turn < 5; turn++) await Promise.resolve()
  })
}

const toasts = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('[data-slot="toast"]')]
const titles = (container: HTMLElement) => toasts(container).map((toast) => toast.querySelector('h2')?.textContent)
const status = (container: HTMLElement) => container.querySelector<HTMLElement>('[role="status"]')!
const alert = (container: HTMLElement) => container.querySelector<HTMLElement>('[role="alert"]')!

function button(scope: ParentNode, name: string) {
  let found = [...scope.querySelectorAll('button')].find(
    (element) => (element.getAttribute('aria-label') ?? element.textContent?.trim()) === name,
  )
  assert.ok(found instanceof HTMLButtonElement, `no button named ${name}`)
  return found
}

function pointer(element: Element, type: string, init: PointerEventInit = {}) {
  element.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      isPrimary: true,
      pointerType: 'mouse',
      ...init,
    }),
  )
}

describe('Toast in the browser', () => {
  it('renders a toast from its manager as a dialog named by its title, with its type icon and a named close button', async (t) => {
    let { container, act, manager } = mount(t)

    await act(() => manager.add({ title: 'Invoice sent', description: 'INV-0042 to Acme Labs', type: 'success' }))

    let [toast] = toasts(container)
    let title = toast.querySelector('[data-slot="toast-title"]')!
    let description = toast.querySelector('[data-slot="toast-description"]')!
    assert.equal(toast.getAttribute('role'), 'dialog')
    assert.equal(toast.getAttribute('aria-modal'), 'false')
    assert.equal(toast.getAttribute('aria-labelledby'), title.id)
    assert.equal(toast.getAttribute('aria-describedby'), description.id)
    assert.equal(toast.dataset.type, 'success')
    assert.equal(toast.tabIndex, 0)
    assert.equal(description.textContent, 'INV-0042 to Acme Labs')
    assert.equal(toast.querySelector('[data-slot="toast-icon"] svg')?.getAttribute('aria-hidden'), 'true')
    assert.ok(button(toast, 'Close toast'))
    assert.equal(toast.querySelector('[data-slot="toast-action"]'), null)
  })

  it('names a toast without a title by its description, and makes a high priority toast an alertdialog', async (t) => {
    let { container, act, manager } = mount(t)

    await act(() => manager.add({ description: 'Copied to the clipboard' }))
    await act(() => manager.add({ title: 'Payment failed', priority: 'high' }))

    let [high, low] = toasts(container)
    assert.equal(high.getAttribute('role'), 'alertdialog')
    assert.equal(low.getAttribute('aria-labelledby'), low.querySelector('p')?.id)
    assert.equal(low.hasAttribute('aria-describedby'), false)
  })

  it('stacks the newest toast in front, and passes each toast its place and the stack state', async (t) => {
    let { container, act, manager } = mount(t)

    await act(() => {
      manager.add({ title: 'One' })
      manager.add({ title: 'Two' })
      manager.add({ title: 'Three' })
    })

    let [front, middle, back] = toasts(container)
    assert.deepEqual(titles(container), ['Three', 'Two', 'One'])
    assert.ok(front.hasAttribute('data-front'))
    assert.equal(middle.style.getPropertyValue('--toast-index'), '1')
    assert.equal(back.style.getPropertyValue('--toast-index'), '2')
    assert.ok(Number.parseFloat(middle.style.getPropertyValue('--toast-offset-y')) > 0)
    assert.ok(Number.parseFloat(front.style.getPropertyValue('--toast-height')) > 0)
    assert.equal(front.querySelector('[data-slot="toast-content"]')?.hasAttribute('data-behind'), false)
    assert.ok(middle.querySelector('[data-slot="toast-content"]')?.hasAttribute('data-behind'))
  })

  it('announces each toast once in the live region for its priority, and again only when its text changes', async (t) => {
    let { container, act, manager } = mount(t)
    let added: Node[] = []
    let removed: Node[] = []
    let observer = new MutationObserver((records) => {
      for (let record of records) {
        added.push(...record.addedNodes)
        removed.push(...record.removedNodes)
      }
    })
    observer.observe(status(container), { childList: true, subtree: true, characterData: true })
    observer.observe(alert(container), { childList: true, subtree: true, characterData: true })
    t.after(() => observer.disconnect())

    let id = await (async () => {
      let added = ''
      await act(() => void (added = manager.add({ title: 'Uploading', description: '1 of 3' })))
      return added
    })()
    await act(() => manager.add({ title: 'Payment failed', priority: 'high' }))
    assert.equal(added.length, 2)
    assert.equal(status(container).textContent, 'Uploading1 of 3')
    assert.equal(alert(container).textContent, 'Payment failed')

    // Hovering, new data and another toast render the toasts again without a new announcement.
    await act(() => pointer(toasts(container)[0], 'pointerenter'))
    await act(() => manager.update(id, { data: { progress: 0.5 } }))
    await act(() => manager.update(id, { description: '1 of 3' }))
    assert.equal(added.length, 2)
    assert.equal(removed.length, 0)

    await act(() => manager.update(id, { description: '2 of 3' }))
    assert.equal(added.length, 3)
    assert.equal(status(container).textContent, 'Uploading2 of 3')

    await act(() => manager.close(id))
    assert.equal(status(container).textContent, '')
  })

  it('closes with its close button and leaves the page once its exit ends', async (t) => {
    let removed: string[] = []
    let { container, act, manager } = mount(t)
    await act(() => manager.add({ title: 'Invoice sent', onRemove: () => removed.push('invoice') }))

    await act(() => button(toasts(container)[0], 'Close toast').click())
    await settle({ act })

    assert.deepEqual(toasts(container), [])
    assert.deepEqual(removed, ['invoice'])
  })

  it('takes a closing toast out of keyboard reach once focus left it, while its exit still runs', async (t) => {
    let manager = createToastManager()
    let undone = 0
    // The motion token gives the toasts their exit transition, as the theme does.
    let result = render(
      <div style="--duration-normal: 1s">
        <ToastProvider toastManager={manager}>
          <ToastViewport>
            <ToastList />
          </ToastViewport>
        </ToastProvider>
      </div>,
    )
    t.after(result.cleanup)
    let { container, act } = result
    await act(() => {
      manager.add({ title: 'Older' })
      manager.add({ title: 'Newer', actionProps: { children: 'Undo', mix: [on('click', () => void undone++)] } })
    })
    let [newer, older] = toasts(container)
    let undo = button(newer, 'Undo')

    await act(() => undo.focus())
    await act(() =>
      undo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })),
    )
    await settle({ act })

    assert.ok(newer.isConnected, 'the exit is still running')
    assert.ok(newer.hasAttribute('data-ending-style'))
    assert.equal(document.activeElement, older)
    assert.equal(newer.inert, true)
    undo.focus()
    assert.notEqual(document.activeElement, undo)
    assert.equal(undone, 0)
  })

  it('closes a focused toast with Escape and moves focus to the next toast, then back to where it was', async (t) => {
    let { container, act, manager } = mount(t, { children: <button type="button">Send reminder</button> })
    await act(() => {
      manager.add({ title: 'Older' })
      manager.add({ title: 'Newer' })
    })
    let origin = button(container, 'Send reminder')
    origin.focus()
    let [newer] = toasts(container)

    await act(() => newer.querySelector('button')!.focus())
    await act(() =>
      newer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })),
    )
    await settle({ act })
    assert.deepEqual(titles(container), ['Older'])
    assert.equal(document.activeElement, toasts(container)[0])

    await act(() => button(toasts(container)[0], 'Close toast').click())
    await settle({ act })
    assert.deepEqual(toasts(container), [])
    assert.equal(document.activeElement, origin)
  })

  it('renders a named action that runs only the handler you give it, when it is activated', async (t) => {
    let clock = useClock(t)
    let undone: string[] = []
    let { container, act, manager } = mount(t, { timeout: 1000 })
    let id = ''
    await act(() => {
      id = manager.add({
        title: 'Invoice archived',
        actionProps: { children: 'Undo', mix: [on('click', () => void undone.push(id))] },
      })
    })
    let undo = button(toasts(container)[0], 'Undo')
    assert.equal(undo.dataset.slot, 'toast-action')
    assert.equal(undo.type, 'button')

    // Hovering, focusing and expiring never run it.
    await act(() => pointer(toasts(container)[0], 'pointerenter'))
    await act(() => pointer(toasts(container)[0], 'pointerleave'))
    await act(() => undo.focus())
    await act(() => clock.advance(1000))
    assert.equal(undone.length, 0)

    await act(() =>
      manager.add({
        id: 'second',
        title: 'Reminder sent',
        actionProps: { children: 'Undo', mix: [on('click', () => void undone.push('second'))] },
      }),
    )
    await act(() => button(toasts(container)[0], 'Undo').click())
    assert.deepEqual(undone, ['second'])
  })

  it('keeps the toast and its timer when an action throws', async (t) => {
    let clock = useClock(t)
    // The browser reports an error thrown in an event listener on the window.
    let errors: unknown[] = []
    let report = (event: ErrorEvent) => {
      event.preventDefault()
      errors.push(event.error)
    }
    window.addEventListener('error', report)
    t.after(() => window.removeEventListener('error', report))
    let { container, act, manager } = mount(t, { timeout: 1000 })
    await act(() =>
      manager.add({
        title: 'Retry failed',
        actionProps: {
          children: 'Retry',
          mix: [
            on('click', () => {
              throw new Error('Server unavailable')
            }),
          ],
        },
      }),
    )

    await act(() => button(toasts(container)[0], 'Retry').click())
    assert.equal((errors[0] as Error)?.message, 'Server unavailable')
    assert.deepEqual(titles(container), ['Retry failed'])

    await act(() => clock.advance(1000))
    await settle({ act })
    assert.deepEqual(toasts(container), [])
  })

  it('pauses expiry while a pointer is over the stack, and expands it', async (t) => {
    let clock = useClock(t)
    let { container, act, manager } = mount(t, { timeout: 1000 })
    await act(() => manager.add({ title: 'Invoice sent' }))
    let viewport = container.querySelector<HTMLElement>('[data-slot="toast-viewport"]')!

    await act(() => clock.advance(500))
    await act(() => pointer(toasts(container)[0], 'pointerenter'))
    assert.ok(viewport.hasAttribute('data-expanded'))
    assert.ok(toasts(container)[0].hasAttribute('data-expanded'))
    await act(() => clock.advance(5000))
    assert.deepEqual(titles(container), ['Invoice sent'])

    await act(() => pointer(toasts(container)[0], 'pointerleave'))
    assert.equal(viewport.hasAttribute('data-expanded'), false)
    await act(() => clock.advance(499))
    assert.deepEqual(titles(container), ['Invoice sent'])
    await act(() => clock.advance(1))
    await settle({ act })
    assert.deepEqual(toasts(container), [])
  })

  it('pauses while a pointer presses a toast, and while the page is hidden or the window is in the background', async (t) => {
    let clock = useClock(t)
    let hidden = false
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
    t.after(() => delete (document as { hidden?: boolean }).hidden)
    let { container, act, manager } = mount(t, { timeout: 1000 })
    await act(() => manager.add({ title: 'Invoice sent' }))

    await act(() => pointer(toasts(container)[0], 'pointerdown', { pointerType: 'pen' }))
    await act(() => clock.advance(5000))
    await act(() => pointer(document.body, 'pointerup', { pointerType: 'pen' }))
    hidden = true
    await act(() => document.dispatchEvent(new Event('visibilitychange')))
    await act(() => clock.advance(5000))
    hidden = false
    await act(() => document.dispatchEvent(new Event('visibilitychange')))
    await act(() => window.dispatchEvent(new FocusEvent('blur')))
    await act(() => clock.advance(5000))
    assert.deepEqual(titles(container), ['Invoice sent'])

    await act(() => window.dispatchEvent(new FocusEvent('focus')))
    await act(() => clock.advance(1000))
    await settle({ act })
    assert.deepEqual(toasts(container), [])
  })

  it('keeps a persistent toast until it is closed', async (t) => {
    let clock = useClock(t)
    let { container, act, manager } = mount(t, { timeout: 1000 })
    let id = ''
    await act(() => void (id = manager.add({ title: 'Payment failed', timeout: 0, priority: 'high' })))

    await act(() => clock.advance(60_000))
    assert.deepEqual(titles(container), ['Payment failed'])

    await act(() => manager.close(id))
    await settle({ act })
    assert.deepEqual(toasts(container), [])
  })

  it('hides and disables toasts past the limit until newer ones close', async (t) => {
    let { container, act, manager } = mount(t, { limit: 2 })
    let newest = ''
    await act(() => {
      manager.add({ title: 'One' })
      manager.add({ title: 'Two' })
      newest = manager.add({ title: 'Three' })
    })

    let oldest = toasts(container)[2]
    assert.ok(oldest.hasAttribute('data-limited'))
    assert.equal(oldest.inert, true)

    await act(() => manager.close(newest))
    await settle({ act })
    assert.equal(oldest.hasAttribute('data-limited'), false)
    assert.equal(oldest.inert, false)
  })

  it('reads changing provider and viewport props', async (t) => {
    let first = createToastManager()
    let second = createToastManager()
    let result = render(<Harness manager={first} limit={3} position="bottom-end" />)
    t.after(result.cleanup)
    let { container, act, root } = result
    await act(() => {
      first.add({ title: 'One' })
      first.add({ title: 'Two' })
    })

    root.render(<Harness manager={second} limit={1} position="top-start" />)
    await act(() => root.flush())

    let viewport = container.querySelector<HTMLElement>('[data-slot="toast-viewport"]')!
    assert.equal(viewport.dataset.position, 'top-start')
    assert.equal(viewport.getAttribute('aria-label'), 'Updates (F6)')
    assert.ok(toasts(container)[1].hasAttribute('data-limited'))
    assert.throws(() => first.add({ title: 'Gone' }), /No ToastProvider/)
    await act(() => second.add({ title: 'Three' }))
    assert.deepEqual(titles(container), ['Three', 'Two', 'One'])
  })

  it('keeps providers apart: each shows only its own toasts, and a removed one stops its timers', async (t) => {
    let clock = useClock(t)
    let billing = mount(t, { timeout: 1000 })
    let support = mount(t, { timeout: 1000 })
    let closed: string[] = []

    await billing.act(() => billing.manager.add({ title: 'Invoice sent', onClose: () => void closed.push('invoice') }))
    await support.act(() => support.manager.add({ title: 'Ticket opened', onClose: () => void closed.push('ticket') }))
    assert.deepEqual(titles(billing.container), ['Invoice sent'])
    assert.deepEqual(titles(support.container), ['Ticket opened'])

    billing.cleanup()
    await support.act(() => clock.advance(1000))
    assert.deepEqual(closed, ['ticket'])
    assert.throws(() => billing.manager.add({ title: 'Late' }), /No ToastProvider/)
    billing.manager.update('missing', { title: 'Late' })
    billing.manager.close()
  })

  it('gives descendants their own provider through context', async (t) => {
    let page = mount(t, { children: <AddFromContext /> })
    let other = mount(t)

    await page.act(() => button(page.container, 'Add from context').click())

    assert.deepEqual(titles(page.container), ['Added in place'])
    assert.deepEqual(titles(other.container), [])
  })

  it('dismisses a toast that is swiped far enough in an allowed direction', async (t) => {
    let { container, act, manager } = mount(t)
    await act(() => {
      manager.add({ title: 'Swipe me' })
    })
    let toast = toasts(container)[0]

    await act(() => {
      pointer(toast, 'pointerdown', { clientX: 100, clientY: 100 })
      pointer(toast, 'pointermove', { clientX: 120, clientY: 100 })
    })
    assert.ok(toast.hasAttribute('data-swiping'))
    assert.equal(toast.style.getPropertyValue('--toast-swipe-movement-x'), '20px')
    await act(() => pointer(toast, 'pointerup', { clientX: 120, clientY: 100 }))
    assert.equal(toast.style.getPropertyValue('--toast-swipe-movement-x'), '0px')
    assert.deepEqual(titles(container), ['Swipe me'])

    // Up is not allowed at the bottom, so the movement is damped and nothing closes.
    await act(() => {
      pointer(toast, 'pointerdown', { clientX: 100, clientY: 100 })
      pointer(toast, 'pointermove', { clientX: 100, clientY: 0 })
      pointer(toast, 'pointerup', { clientX: 100, clientY: 0 })
    })
    assert.deepEqual(titles(container), ['Swipe me'])

    // A press on the close button never starts a swipe.
    await act(() => {
      pointer(button(toast, 'Close toast'), 'pointerdown', { clientX: 100, clientY: 100 })
      pointer(toast, 'pointerup', { clientX: 100, clientY: 200 })
    })
    assert.deepEqual(titles(container), ['Swipe me'])

    await act(() => {
      pointer(toast, 'pointerdown', { clientX: 100, clientY: 100 })
      pointer(toast, 'pointermove', { clientX: 100, clientY: 160 })
      pointer(toast, 'pointerup', { clientX: 100, clientY: 160 })
    })
    assert.equal(toast.dataset.swipeDirection, 'down')
    await settle({ act })
    assert.deepEqual(toasts(container), [])
  })

  it('moves focus to the newest toast with the hotkey, and back with it again', async (t) => {
    let { container, act, manager } = mount(t, { children: <button type="button">Send reminder</button> })
    await act(() => {
      manager.add({ title: 'Older' })
      manager.add({ title: 'Newer' })
    })
    let origin = button(container, 'Send reminder')
    origin.focus()
    let press = () =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F6', code: 'F6', bubbles: true, cancelable: true }))

    await act(press)
    assert.equal(document.activeElement, toasts(container)[0])
    await act(press)
    assert.equal(document.activeElement, origin)
  })

  it('leaves the hotkey alone when there is no toast to focus, and stops listening once removed', async (t) => {
    let { act, cleanup } = mount(t)
    let event = new KeyboardEvent('keydown', { key: 'F6', code: 'F6', bubbles: true, cancelable: true })

    await act(() => document.dispatchEvent(event))
    assert.equal(event.defaultPrevented, false)

    cleanup()
    let afterwards = new KeyboardEvent('keydown', { key: 'F6', code: 'F6', bubbles: true, cancelable: true })
    document.dispatchEvent(afterwards)
    assert.equal(afterwards.defaultPrevented, false)
  })

  it('renders custom parts from the same toast object', async (t) => {
    let manager = createToastManager()
    let result = render(
      <ToastProvider toastManager={manager}>
        <ToastViewport>
          <CustomList />
        </ToastViewport>
      </ToastProvider>,
    )
    t.after(result.cleanup)
    let { container, act } = result

    await act(() =>
      manager.add({ title: 'Invoice sent', description: 'To Acme Labs', actionProps: { children: 'View' } }),
    )

    let toast = toasts(container)[0]
    assert.equal(toast.querySelector('[data-slot="toast-title"]')?.textContent, 'Sent: Invoice sent')
    assert.equal(toast.querySelector('[data-slot="toast-description"]')?.textContent, 'To Acme Labs')
    assert.equal(button(toast, 'View').dataset.variant, 'outline')
    assert.ok(button(toast, 'Dismiss'))
    assert.equal(toast.dataset.custom, 'yes')
  })

  it('stays open when you cancel the close button click', async (t) => {
    let manager = createToastManager()
    let result = render(
      <ToastProvider toastManager={manager}>
        <ToastViewport>
          <CustomList />
        </ToastViewport>
      </ToastProvider>,
    )
    t.after(result.cleanup)
    await result.act(() => manager.add({ id: 'kept', title: 'Kept' }))

    await result.act(() => button(result.container, 'Keep').click())

    assert.equal(toasts(result.container).length, 1)
  })
})

function Harness(handle: Handle<{ manager: ToastManager; limit: number; position: ToastPosition }>) {
  return () => (
    <ToastProvider toastManager={handle.props.manager} limit={handle.props.limit}>
      <ToastViewport position={handle.props.position} label="Updates">
        <ToastList />
      </ToastViewport>
    </ToastProvider>
  )
}

function AddFromContext(handle: Handle) {
  return () => (
    <button
      type="button"
      mix={on('click', () => {
        let store = handle.context.get(ToastProvider) as ToastStore
        store.add({ title: 'Added in place' })
      })}
    >
      Add from context
    </button>
  )
}

function CustomList(handle: Handle) {
  return () => {
    let store = handle.context.get(ToastProvider) as ToastStore
    return store.toasts.map((item) => (
      <Toast key={item.id} toast={item} data-custom="yes">
        <ToastContent>
          <div>
            <ToastTitle>Sent: {item.title}</ToastTitle>
            <ToastDescription />
          </div>
          <ToastAction />
          <ToastClose aria-label="Dismiss" />
          <ToastClose aria-label="Keep" mix={on('click', (event) => event.preventDefault())} />
        </ToastContent>
      </Toast>
    ))
  }
}
