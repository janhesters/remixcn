import type { RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { Toaster, toast } from './sonner.tsx'
import type { ToasterProps } from './sonner.tsx'

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

function mount(t: TestContext, props: ToasterProps = {}, children?: RemixNode) {
  let result = render(
    <div>
      {children}
      <Toaster {...props} />
    </div>,
  )
  t.after(result.cleanup)
  return result
}

type Mounted = ReturnType<typeof mount>

async function settle({ act }: Pick<Mounted, 'act'>) {
  await act(async () => {
    for (let turn = 0; turn < 10; turn++) await Promise.resolve()
  })
}

const toasts = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('[data-slot="toast"]')]
const titles = (container: HTMLElement) =>
  toasts(container).map((item) => item.querySelector('[data-slot="toast-title"]')?.textContent)

function button(scope: ParentNode, name: string) {
  let found = [...scope.querySelectorAll('button')].find(
    (element) => (element.getAttribute('aria-label') ?? element.textContent?.trim()) === name,
  )
  assert.ok(found instanceof HTMLButtonElement, `no button named ${name}`)
  return found
}

describe('Sonner in the browser', () => {
  it('shows toast(message, data) and its typed variants, newest first', async (t) => {
    let { container, act } = mount(t)

    let id = ''
    await act(() => {
      id = toast('Event has been created', { description: 'Monday, January 3rd at 6:00pm' })
      toast.success('Invoice paid')
      toast.error('Payment failed')
    })

    assert.ok(id.length > 0)
    assert.deepEqual(titles(container), ['Payment failed', 'Invoice paid', 'Event has been created'])
    assert.deepEqual(
      toasts(container).map((item) => item.dataset.type),
      ['error', 'success', undefined],
    )
    assert.equal(
      toasts(container)[2].querySelector('[data-slot="toast-description"]')?.textContent,
      'Monday, January 3rd at 6:00pm',
    )
  })

  it("closes after Sonner's 4 seconds by default, or after the duration you give it", async (t) => {
    let clock = useClock(t)
    let { container, act } = mount(t)
    await act(() => {
      toast('Default')
      toast('Longer', { duration: 8000 })
      toast('Pinned', { duration: Infinity })
    })

    await act(() => clock.advance(4000))
    await settle({ act })
    assert.deepEqual(titles(container), ['Pinned', 'Longer'])
    await act(() => clock.advance(4000))
    await settle({ act })
    assert.deepEqual(titles(container), ['Pinned'])
  })

  it("reads the Toaster's duration and toastOptions", async (t) => {
    let clock = useClock(t)
    let { container, act } = mount(t, { duration: 1000, toastOptions: { duration: 2000 } })
    await act(() => void toast('Saved'))

    await act(() => clock.advance(1999))
    assert.deepEqual(titles(container), ['Saved'])
    await act(() => clock.advance(1))
    await settle({ act })
    assert.deepEqual(titles(container), [])
  })

  it('announces an important toast as an alert, others as a status', async (t) => {
    let { container, act } = mount(t)

    await act(() => {
      toast('Saved')
      toast.error('Card declined', { important: true })
    })

    assert.equal(container.querySelector('[role="status"]')?.textContent, 'Saved')
    assert.equal(container.querySelector('[role="alert"]')?.textContent, 'Card declined')
  })

  it('runs an action or cancel button, then closes unless the handler prevents it', async (t) => {
    let calls: string[] = []
    let { container, act } = mount(t)
    await act(() => {
      toast('Archived', {
        action: { label: 'Undo', onClick: () => void calls.push('undo') },
        cancel: { label: 'Keep', onClick: () => void calls.push('keep') },
      })
      toast('Reminder sent', {
        action: {
          label: 'Details',
          onClick: (event) => {
            calls.push('details')
            event.preventDefault()
          },
        },
      })
    })

    await act(() => button(toasts(container)[0], 'Details').click())
    await settle({ act })
    assert.deepEqual(titles(container), ['Reminder sent', 'Archived'])

    await act(() => button(toasts(container)[1], 'Undo').click())
    await settle({ act })
    assert.deepEqual(titles(container), ['Reminder sent'])
    assert.deepEqual(calls, ['details', 'undo'])
  })

  it("shows no close button by default, as Sonner, and one when asked; a toast that isn't dismissible has none and ignores Escape", async (t) => {
    let { container, act } = mount(t)
    await act(() => {
      toast('Plain')
      toast('With close', { closeButton: true })
      toast('Locked', { closeButton: true, dismissible: false })
    })
    let [locked, withClose, plain] = toasts(container)

    assert.equal(plain.querySelector('[data-slot="toast-close"]'), null)
    assert.ok(button(withClose, 'Close toast'))
    assert.equal(locked.querySelector('[data-slot="toast-close"]'), null)

    await act(() =>
      locked.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })),
    )
    await settle({ act })
    assert.deepEqual(titles(container), ['Locked', 'With close', 'Plain'])
  })

  it('shows close buttons on every toast with closeButton on the Toaster, named by toastOptions', async (t) => {
    let { container, act } = mount(t, { closeButton: true, toastOptions: { closeButtonAriaLabel: 'Dismiss' } })
    await act(() => void toast('Saved'))

    await act(() => button(toasts(container)[0], 'Dismiss').click())
    await settle({ act })

    assert.deepEqual(toasts(container), [])
  })

  it('calls onAutoClose when the time runs out and onDismiss when it is dismissed', async (t) => {
    let clock = useClock(t)
    let calls: string[] = []
    let { act } = mount(t)
    let dismissed = ''
    await act(() => {
      toast('Timed', {
        onAutoClose: (item) => void calls.push(`auto ${item.title}`),
        onDismiss: () => void calls.push('wrong'),
      })
      dismissed = toast('Dismissed', {
        duration: Infinity,
        onDismiss: (item) => void calls.push(`dismiss ${item.id === dismissed}`),
      })
    })

    await act(() => clock.advance(4000))
    await act(() => toast.dismiss(dismissed))

    assert.deepEqual(calls, ['auto Timed', 'dismiss true'])
  })

  it('dismisses every toast without an id', async (t) => {
    let { container, act } = mount(t)
    await act(() => {
      toast('One')
      toast('Two')
    })

    await act(() => void toast.dismiss())
    await settle({ act })

    assert.deepEqual(toasts(container), [])
  })

  it('updates a toast in place when it is shown again with its id', async (t) => {
    let { container, act } = mount(t)

    await act(() => {
      toast('Uploading', { id: 7 })
      toast.success('Uploaded', { id: 7 })
    })

    assert.deepEqual(titles(container), ['Uploaded'])
    assert.equal(toasts(container)[0].dataset.type, 'success')
  })

  it('shows a promise as loading, then success, calls finally, and unwraps to its value', async (t) => {
    let finished = 0
    let { container, act } = mount(t)
    let resolve!: (value: { name: string }) => void
    let result!: { id: string; unwrap: () => Promise<{ name: string }> }

    await act(() => {
      result = toast.promise(new Promise<{ name: string }>((done) => (resolve = done)), {
        loading: 'Creating event…',
        success: (data) => `${data.name} created.`,
        error: 'Could not create event.',
        finally: () => void finished++,
      })
    })
    assert.deepEqual(titles(container), ['Creating event…'])
    assert.equal(toasts(container)[0].dataset.type, 'loading')

    resolve({ name: 'Event' })
    assert.deepEqual(await result.unwrap(), { name: 'Event' })
    await settle({ act })
    assert.deepEqual(titles(container), ['Event created.'])
    assert.equal(toasts(container)[0].dataset.type, 'success')
    assert.equal(finished, 1)
  })

  it('shows an error for a rejected promise or a failed Response, with extended results', async (t) => {
    let { container, act } = mount(t)
    let rejected!: { unwrap: () => Promise<unknown> }

    await act(() => {
      toast.promise(Promise.resolve(new Response('', { status: 500 })), {
        loading: 'Fetching…',
        success: 'Fetched.',
        error: 'Server error.',
      })
      rejected = toast.promise(Promise.reject(new Error('offline')), {
        loading: 'Sending…',
        error: (error) => ({ message: 'Not sent', description: (error as Error).message, important: true }),
      })
    })
    await assert.rejects(rejected.unwrap(), /offline/)
    await settle({ act })

    assert.deepEqual(titles(container), ['Not sent', 'Server error.'])
    assert.deepEqual(
      toasts(container).map((item) => item.dataset.type),
      ['error', 'error'],
    )
    assert.equal(container.querySelector('[role="alert"]')?.textContent, 'Not sentoffline')
  })

  it('shows only the outcome of a promise without a loading message, and nothing after a dismissed loading toast', async (t) => {
    let { container, act } = mount(t)
    let quiet!: { id: string; unwrap: () => Promise<string> }
    let dismissed!: { id: string; unwrap: () => Promise<string> }

    await act(() => {
      quiet = toast.promise(Promise.resolve('INV-0042'), { success: (number) => `${number} sent` })
      dismissed = toast.promise(Promise.resolve('INV-0043'), { loading: 'Sending…', success: 'Sent' })
      toast.dismiss(dismissed.id)
    })
    assert.equal(await quiet.unwrap(), 'INV-0042')
    assert.equal(await dismissed.unwrap(), 'INV-0043')
    await settle({ act })

    assert.deepEqual(titles(container), ['INV-0042 sent'])
  })

  it('renders custom content with its id in a toast frame', async (t) => {
    let { container, act } = mount(t)

    await act(() => void toast.custom((id) => <p data-custom={id}>Custom {id}</p>, { id: 'mine' }))

    assert.equal(toasts(container)[0].querySelector('[data-custom]')?.textContent, 'Custom mine')
  })

  it('names a custom toast by its content and announces it once, with its description and urgency', async (t) => {
    let { container, act } = mount(t)

    await act(() => void toast.custom(() => 'Custom invoice notification'))
    await act(
      () =>
        void toast.custom(() => <strong>Payout failed</strong>, {
          description: 'The bank rejected the transfer.',
          important: true,
        }),
    )

    let [urgent, plain] = toasts(container)
    let name = (element: HTMLElement) =>
      document.getElementById(element.getAttribute('aria-labelledby') ?? '')?.textContent
    let description = (element: HTMLElement) =>
      document.getElementById(element.getAttribute('aria-describedby') ?? '')?.textContent
    assert.equal(name(plain), 'Custom invoice notification')
    assert.equal(name(urgent), 'Payout failed')
    assert.equal(description(urgent), 'The bank rejected the transfer.')
    assert.equal(container.querySelector('[role="status"]')?.textContent, 'Custom invoice notification')
    assert.equal(container.querySelector('[role="alert"]')?.textContent, 'Payout failedThe bank rejected the transfer.')
    assert.equal(container.querySelectorAll('[data-slot="toast-announcer"] [role] > *').length, 2)
  })

  it('announces a custom toast once, with its text and description together', async (t) => {
    let { container, act } = mount(t)
    let announced: string[] = []
    let observer = new MutationObserver((records) => {
      for (let record of records) {
        for (let node of record.addedNodes) {
          let text = node.textContent?.trim()
          if (text) announced.push(text)
        }
      }
    })
    for (let region of container.querySelectorAll('[data-slot="toast-announcer"] [role]')) {
      observer.observe(region, { childList: true, subtree: true, characterData: true })
    }
    t.after(() => observer.disconnect())

    await act(
      () =>
        void toast.custom(() => 'Payout failed', { description: 'The bank rejected the transfer.', important: true }),
    )
    await act(() => void toast.custom(() => <p>Custom invoice notification</p>))
    await settle({ act })

    assert.deepEqual(announced, ['Payout failedThe bank rejected the transfer.', 'Custom invoice notification'])
  })

  it('lets go of a pending promise when its Toaster unmounts, so a new Toaster with the same ids keeps its toast', async (t) => {
    let first = render(<Toaster id="replacement" />)
    let finish!: (value: string) => void
    let result!: { unwrap: () => Promise<string> }
    await first.act(() => {
      result = toast.promise(new Promise<string>((done) => (finish = done)), {
        toasterId: 'replacement',
        id: 'sync',
        loading: 'Old operation',
        success: 'Old completed',
      })
    })
    first.cleanup()

    let second = mount(t, { id: 'replacement' })
    await second.act(() => void toast('New operation', { toasterId: 'replacement', id: 'sync', duration: Infinity }))
    finish('done')
    await result.unwrap()
    await settle(second)

    assert.deepEqual(titles(second.container), ['New operation'])
  })

  it('calls onDismiss for a custom toast', async (t) => {
    let calls: string[] = []
    let { act } = mount(t)
    let id = ''
    await act(() => void (id = toast.custom(() => 'Custom', { onDismiss: (item) => void calls.push(item.id) })))

    await act(() => void toast.dismiss(id))

    assert.deepEqual(calls, [id])
  })

  it('binds a promise to the toast it showed: once that one closes, its outcome leaves a new toast with the id alone', async (t) => {
    let { container, act } = mount(t)
    let finish!: (value: string) => void
    let end!: (value: string) => void
    let first!: { unwrap: () => Promise<string> }
    let second!: { unwrap: () => Promise<string> }

    await act(() => {
      first = toast.promise(new Promise<string>((done) => (finish = done)), {
        id: 'sync',
        loading: 'Old operation',
        success: 'Old completed',
      })
      // Without a success message, a settled promise closes its loading toast.
      second = toast.promise(new Promise<string>((done) => (end = done)), { id: 'export', loading: 'Old export' })
    })
    await act(() => {
      toast.dismiss('sync')
      toast.dismiss('export')
    })
    await settle({ act })
    await act(() => {
      toast('New operation', { id: 'sync', duration: Infinity })
      toast('New export', { id: 'export', duration: Infinity })
    })

    finish('done')
    end('done')
    await first.unwrap()
    await second.unwrap()
    await settle({ act })

    assert.deepEqual(titles(container), ['New export', 'New operation'])
  })

  it('applies the outcome to a loading toast that was updated in place with its id', async (t) => {
    let { container, act } = mount(t)
    let finish!: (value: string) => void
    let result!: { unwrap: () => Promise<string> }

    await act(() => {
      result = toast.promise(new Promise<string>((done) => (finish = done)), {
        id: 'upload',
        loading: 'Uploading',
        success: 'Uploaded',
      })
    })
    await act(() => void toast.loading('Uploading, 50%', { id: 'upload' }))

    finish('done')
    await result.unwrap()
    await settle({ act })

    assert.deepEqual(titles(container), ['Uploaded'])
  })

  it("keeps the promise's options once it settles: its duration, buttons and dismissal", async (t) => {
    let clock = useClock(t)
    let { container, act } = mount(t, { closeButton: true })
    let finish!: (value: string) => void
    let result!: { unwrap: () => Promise<string> }
    let quiet!: { unwrap: () => Promise<string> }

    await act(() => {
      result = toast.promise(new Promise<string>((done) => (finish = done)), {
        loading: 'Saving',
        success: 'Saved',
        duration: Infinity,
        dismissible: false,
        closeButton: false,
        action: { label: 'Open result', onClick() {} },
      })
      quiet = toast.promise(Promise.resolve('done'), { success: 'Exported', duration: Infinity, important: true })
    })
    finish('done')
    await result.unwrap()
    await quiet.unwrap()
    await settle({ act })

    let saved = toasts(container).find((item) => item.textContent?.includes('Saved'))!
    assert.ok(button(saved, 'Open result'))
    assert.equal(saved.querySelector('[data-slot="toast-close"]'), null)
    await act(() =>
      saved.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })),
    )
    await act(() => clock.advance(60_000))
    await settle({ act })
    assert.deepEqual(titles(container).sort(), ['Exported', 'Saved'])
    assert.equal(container.querySelector('[role="alert"]')?.textContent, 'Exported')
  })

  it('keeps Toasters apart by id', async (t) => {
    let main = mount(t)
    let side = mount(t, { id: 'side', position: 'top-left', icons: { success: <span data-icon="custom">✓</span> } })

    await main.act(() => {
      toast('Main toast')
      toast.success('Side toast', { toasterId: 'side' })
    })

    assert.deepEqual(titles(main.container), ['Main toast'])
    assert.deepEqual(titles(side.container), ['Side toast'])
    assert.ok(side.container.querySelector('[data-icon="custom"]'))
  })
})
