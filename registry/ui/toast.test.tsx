import * as assert from 'remix/assert'
import { renderToString } from 'remix/component/server'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import {
  ToastStore,
  Toaster,
  applyLimit,
  createToastManager,
  describeHotkey,
  layoutToasts,
  matchesHotkey,
  resolvePromiseOption,
} from './toast.tsx'
import type { ToastObject } from './toast.tsx'

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

const open = (store: ToastStore<any>) => store.toasts.filter((toast) => toast.transitionStatus !== 'ending')
const titles = (store: ToastStore<any>) => open(store).map((toast) => toast.title)

/** Reads the attributes of the first tag with this name. */
function attributes(html: string, tag: string) {
  let source = new RegExp(`<${tag}(\\s[^>]*)?>`).exec(html)?.[1] ?? ''
  return new Map([...source.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].map(([, name, value]) => [name, value ?? '']))
}

describe('ToastStore', () => {
  it('shows the newest toast first, each with its own stable id', () => {
    let store = new ToastStore()
    let first = store.add({ title: 'Invoice sent' })
    let second = store.add({ title: 'Reminder scheduled' })
    let third = store.add({ id: 'export', title: 'Export ready' })

    assert.deepEqual(titles(store), ['Export ready', 'Reminder scheduled', 'Invoice sent'])
    assert.notEqual(first, second)
    assert.equal(third, 'export')
    assert.deepEqual(
      store.toasts.map((toast) => toast.id),
      [third, second, first],
    )
  })

  it('updates a toast in place when it is added again with its id, and restarts its timer', (t) => {
    let clock = useClock(t)
    let store = new ToastStore({ timeout: 1000 })
    store.add({ id: 'copy', title: 'Copied' })
    store.add({ title: 'Invoice sent' })
    let before = store.toasts.find((toast) => toast.id === 'copy')!

    clock.advance(800)
    store.add({ id: 'copy', title: 'Copied again' })
    let after = store.toasts.find((toast) => toast.id === 'copy')!

    assert.deepEqual(titles(store), ['Invoice sent', 'Copied again'])
    assert.equal(after.updateKey, before.updateKey + 1)
    assert.notEqual(after.announcement, before.announcement)

    clock.advance(800)
    assert.deepEqual(titles(store), ['Copied again'])
    clock.advance(200)
    assert.deepEqual(titles(store), [])
  })

  it('closes each toast after its timeout, the provider default otherwise', (t) => {
    let clock = useClock(t)
    let store = new ToastStore()
    store.add({ title: 'Default' })
    store.add({ title: 'Short', timeout: 1000 })

    clock.advance(999)
    assert.deepEqual(titles(store), ['Short', 'Default'])
    clock.advance(1)
    assert.deepEqual(titles(store), ['Default'])
    clock.advance(4000)
    assert.deepEqual(titles(store), [])
  })

  it('keeps persistent and loading toasts until they are closed or updated', (t) => {
    let clock = useClock(t)
    let store = new ToastStore({ timeout: 1000 })
    store.add({ title: 'No timeout', timeout: 0 })
    store.add({ title: 'Forever', timeout: Infinity })
    let loading = store.add({ title: 'Uploading', type: 'loading' })

    clock.advance(60_000)
    assert.deepEqual(titles(store), ['Uploading', 'Forever', 'No timeout'])

    store.update(loading, { title: 'Uploaded', type: 'success' })
    clock.advance(1000)
    assert.deepEqual(titles(store), ['Forever', 'No timeout'])
  })

  it('pauses the timers for every reason at once, and resumes with the time that was left', (t) => {
    let clock = useClock(t)
    let store = new ToastStore({ timeout: 1000 })
    store.add({ title: 'Invoice sent' })

    clock.advance(600)
    store.pause('hover')
    store.pause('hidden')
    clock.advance(5000)
    store.resume('hover')
    clock.advance(5000)
    assert.deepEqual(titles(store), ['Invoice sent'], 'the hidden page still holds it')

    store.resume('hidden')
    clock.advance(399)
    assert.deepEqual(titles(store), ['Invoice sent'])
    clock.advance(1)
    assert.deepEqual(titles(store), [])
  })

  it('starts the timer of a toast added while paused only when the pause ends', (t) => {
    let clock = useClock(t)
    let store = new ToastStore({ timeout: 1000 })
    store.pause('focus')
    store.add({ title: 'Invoice sent' })

    clock.advance(10_000)
    store.resume('focus')
    clock.advance(999)
    assert.deepEqual(titles(store), ['Invoice sent'])
    clock.advance(1)
    assert.deepEqual(titles(store), [])
  })

  it('expands only for hover and keyboard focus, and tells its listeners', () => {
    let store = new ToastStore()
    let changes = 0
    store.addEventListener('change', () => changes++)

    store.pause('hidden')
    store.pause('interaction')
    assert.equal(store.expanded, false)
    assert.equal(store.paused, true)

    store.pause('hover')
    assert.equal(store.expanded, true)
    assert.equal(changes, 1)
    store.resume('hover')
    assert.equal(store.expanded, false)
    assert.equal(changes, 2)
  })

  it('limits the visible toasts to the newest ones, and shows older ones again when newer ones close', () => {
    let store = new ToastStore({ limit: 2 })
    let oldest = store.add({ title: 'One' })
    store.add({ title: 'Two' })
    let newest = store.add({ title: 'Three' })

    let limited = () => store.toasts.filter((toast) => toast.limited).map((toast) => toast.title)
    assert.deepEqual(limited(), ['One'])

    store.close(newest)
    assert.deepEqual(limited(), [])

    store.configure({ limit: 1 })
    assert.deepEqual(limited(), ['One'])
    assert.equal(store.toasts.find((toast) => toast.id === oldest)?.limited, true)
  })

  it('applies an update to an open toast, and passes an updater the current toast', () => {
    let store = new ToastStore()
    let id = store.add({ title: 'Uploading', description: '1 of 3', data: { done: 1 } })

    store.update(id, (toast: ToastObject<any>) => ({ description: `${toast.data.done + 1} of 3`, data: { done: 2 } }))

    let toast = store.toasts[0]
    assert.equal(toast.title, 'Uploading')
    assert.equal(toast.description, '2 of 3')
    assert.deepEqual(toast.data, { done: 2 })
    assert.equal(toast.updateKey, 1)
  })

  it('announces a toast again only when its text or priority changes', () => {
    let store = new ToastStore()
    let id = store.add({ title: 'Uploading', description: '1 of 3' })
    let announcement = () => store.toasts[0].announcement
    let first = announcement()

    store.update(id, { data: { progress: 0.5 }, timeout: 8000 })
    store.update(id, { description: '1 of 3' })
    assert.equal(announcement(), first)

    store.update(id, { description: '2 of 3' })
    assert.notEqual(announcement(), first)
    let second = announcement()

    store.update(id, { priority: 'high' })
    assert.notEqual(announcement(), second)
  })

  it('restarts the timer when an update changes the timeout', (t) => {
    let clock = useClock(t)
    let store = new ToastStore({ timeout: 1000 })
    let id = store.add({ title: 'Invoice sent' })

    clock.advance(900)
    store.update(id, { timeout: 2000 })
    clock.advance(1999)
    assert.deepEqual(titles(store), ['Invoice sent'])
    clock.advance(1)
    assert.deepEqual(titles(store), [])

    let pinned = store.add({ title: 'Pinned' })
    store.update(pinned, { timeout: 0 })
    clock.advance(60_000)
    assert.deepEqual(titles(store), ['Pinned'])
  })

  it('closes one toast or all, calls onClose once with the reason, and onRemove once it leaves', (t) => {
    let clock = useClock(t)
    let store = new ToastStore({ timeout: 1000 })
    let calls: string[] = []
    let track = (name: string) => ({
      onClose: (reason: string) => calls.push(`${name} closed: ${reason}`),
      onRemove: () => calls.push(`${name} removed`),
    })
    let invoice = store.add({ title: 'Invoice', ...track('invoice') })
    store.add({ title: 'Reminder', timeout: 0, ...track('reminder') })
    store.add({ title: 'Export', timeout: 0, ...track('export') })

    store.close(invoice)
    store.close(invoice)
    clock.advance(2000)
    store.close()
    store.close()

    assert.deepEqual(calls, [
      'invoice closed: dismiss',
      'invoice removed',
      'export closed: dismiss',
      'reminder closed: dismiss',
      'export removed',
      'reminder removed',
    ])
    assert.deepEqual(store.toasts, [])
  })

  it('reports timeout as the reason when the timer closes it', (t) => {
    let clock = useClock(t)
    let store = new ToastStore({ timeout: 1000 })
    let reasons: string[] = []
    store.add({ title: 'Saved', onClose: (reason) => reasons.push(reason) })

    clock.advance(1000)

    assert.deepEqual(reasons, ['timeout'])
  })

  it('keeps a closing toast with an element until its exit ends, and ignores updates to it', () => {
    let store = new ToastStore()
    let removed = 0
    let id = store.add({ title: 'Invoice sent', onRemove: () => removed++ })
    let element = { tagName: 'DIV' } as unknown as HTMLElement
    let mounted = new AbortController()
    store.attach(id, element, mounted.signal)

    store.close(id)
    let updater = 0
    store.update(id, () => {
      updater++
      return { title: 'Changed' }
    })
    store.update(id, { title: 'Changed' })

    assert.equal(store.toasts[0].transitionStatus, 'ending')
    assert.equal(store.toasts[0].title, 'Invoice sent')
    assert.equal(updater, 0)
    assert.equal(removed, 0)

    // The element went away before its exit ended.
    mounted.abort()
    assert.deepEqual(store.toasts, [])
    assert.equal(removed, 1)
  })

  it('replaces a closing toast at once when a toast with its id is added again', () => {
    let store = new ToastStore()
    let removed = 0
    store.add({ id: 'sync', title: 'Syncing', onRemove: () => removed++ })
    store.attach('sync', {} as HTMLElement, new AbortController().signal)
    store.close('sync')

    store.add({ id: 'sync', title: 'Syncing again' })

    assert.deepEqual(
      store.toasts.map((toast) => [toast.title, toast.transitionStatus]),
      [['Syncing again', undefined]],
    )
    assert.equal(removed, 0)
  })

  it('keeps a toast that an onClose callback shows again with the same id', () => {
    let store = new ToastStore()
    store.add({ id: 'retry', title: 'Failed', onClose: () => void store.add({ id: 'retry', title: 'Retrying' }) })

    store.close('retry')

    assert.deepEqual(titles(store), ['Retrying'])
  })

  it('reports an error in a callback and keeps working', (t) => {
    let reported: unknown[] = []
    t.mock.method(globalThis, 'reportError', (error: unknown) => void reported.push(error))
    let store = new ToastStore()
    let failing = store.add({
      title: 'Failing',
      onClose: () => {
        throw new Error('onClose failed')
      },
    })
    store.add({ title: 'Other' })

    store.close(failing)

    assert.equal((reported[0] as Error).message, 'onClose failed')
    assert.deepEqual(titles(store), ['Other'])
  })

  it('shows a loading toast for a promise, then its success with a timer', async (t) => {
    let clock = useClock(t)
    let store = new ToastStore({ timeout: 1000 })
    let resolve!: (value: { name: string }) => void
    let result = store.promise(new Promise<{ name: string }>((done) => (resolve = done)), {
      loading: 'Sending invoice…',
      success: (value) => ({ title: `${value.name} sent` }),
      error: 'Could not send the invoice.',
    })

    assert.deepEqual(
      store.toasts.map((toast) => [toast.type, toast.description]),
      [['loading', 'Sending invoice…']],
    )
    clock.advance(10_000)
    assert.equal(open(store).length, 1)

    resolve({ name: 'INV-0042' })
    assert.deepEqual(await result, { name: 'INV-0042' })
    assert.deepEqual(
      store.toasts.map((toast) => [toast.type, toast.title]),
      [['success', 'INV-0042 sent']],
    )
    clock.advance(1000)
    assert.deepEqual(open(store), [])
  })

  it('shows the error of a rejected promise and rejects the same way', async () => {
    let store = new ToastStore()
    let failure = new Error('Network down')

    let result = store.promise(Promise.reject(failure), {
      loading: { title: 'Sending…' },
      success: 'Sent.',
      error: (error) => ({ title: 'Not sent', description: (error as Error).message, priority: 'high' }),
    })

    await assert.rejects(result, (error: unknown) => error === failure)
    assert.deepEqual(
      store.toasts.map((toast) => [toast.type, toast.title, toast.description, toast.priority]),
      [['error', 'Not sent', 'Network down', 'high']],
    )
  })

  it('leaves a toast closed when its promise settles after it closed', async () => {
    let store = new ToastStore()
    let resolve!: (value: string) => void
    let result = store.promise(new Promise<string>((done) => (resolve = done)), {
      loading: 'Exporting…',
      success: 'Exported.',
      error: 'Export failed.',
    })

    store.close()
    resolve('done')

    assert.equal(await result, 'done')
    assert.deepEqual(store.toasts, [])
  })

  it('records heights and places the stack from them', () => {
    let store = new ToastStore()
    let changes = 0
    let one = store.add({ title: 'One' })
    let two = store.add({ title: 'Two' })
    store.addEventListener('change', () => changes++)

    store.setHeight(two, 60)
    store.setHeight(two, 60)
    store.setHeight(one, 80)
    store.setHeight('unknown', 10)

    assert.equal(changes, 2)
    assert.equal(store.height(two), 60)
    assert.deepEqual(store.layout().get(two), { index: 0, offsetY: 0 })
    assert.deepEqual(store.layout().get(one), { index: 1, offsetY: 60 })
  })

  it('stops its timers and ignores calls once disposed', (t) => {
    let clock = useClock(t)
    let store = new ToastStore({ timeout: 1000 })
    let closed = 0
    store.add({ title: 'Invoice sent', onClose: () => closed++ })

    store.dispose()
    clock.advance(10_000)
    store.add({ title: 'Late' })
    store.close()

    assert.equal(closed, 0)
    // Its toasts left with it, and the late one never arrived.
    assert.deepEqual(store.toasts, [])
  })

  it('tells each toast it left once its provider goes away, without closing it', () => {
    let store = new ToastStore()
    let calls: string[] = []
    store.add({ title: 'Open', onClose: () => calls.push('open closed'), onRemove: () => calls.push('open removed') })
    let closing = store.add({ title: 'Closing', onRemove: () => calls.push('closing removed') })
    store.attach(closing, {} as HTMLElement, new AbortController().signal)
    store.close(closing)

    store.dispose()
    store.dispose()

    // Newest first, as in the list.
    assert.deepEqual(calls, ['closing removed', 'open removed'])
  })

  it('runs onRemove only once across disposal, also for a late remove or a callback that removes another toast', () => {
    let store = new ToastStore()
    let calls: string[] = []
    let older = store.add({ title: 'Older', onRemove: () => calls.push('Older') })
    store.add({
      title: 'Newer',
      onRemove: () => {
        calls.push('Newer')
        store.remove(older)
      },
    })

    store.dispose()
    store.remove(older)

    assert.deepEqual(calls, ['Newer', 'Older'])
    assert.deepEqual(store.toasts, [])
  })
})

describe('applyLimit and layoutToasts', () => {
  let toast = (id: string, extra: Partial<ToastObject> = {}): ToastObject => ({
    id,
    updateKey: 0,
    announcement: 0,
    limited: false,
    ...extra,
  })

  it('limits only open toasts, and keeps unchanged toasts as they were', () => {
    let toasts = [toast('a'), toast('b', { transitionStatus: 'ending' }), toast('c'), toast('d')]
    let limited = applyLimit(toasts, 2)

    assert.deepEqual(
      limited.map((item) => item.limited),
      [false, false, false, true],
    )
    assert.equal(limited[0], toasts[0])
  })

  it('stacks open toasts by their heights, and keeps a closing toast at its place in the list', () => {
    let layout = layoutToasts(
      [toast('a'), toast('b', { transitionStatus: 'ending' }), toast('c')],
      new Map([
        ['a', 50],
        ['b', 70],
        ['c', 60],
      ]),
    )

    assert.deepEqual(Object.fromEntries(layout), {
      a: { index: 0, offsetY: 0 },
      b: { index: 1, offsetY: 50 },
      c: { index: 1, offsetY: 50 },
    })
  })
})

describe('createToastManager', () => {
  it('refuses to add a toast while no provider is mounted, so the call fails visibly', () => {
    let manager = createToastManager()

    assert.throws(() => manager.add({ title: 'Invoice sent' }), /No ToastProvider is mounted/)
    // Changes to toasts that don't exist are harmless.
    manager.update('missing', { title: 'Changed' })
    manager.close('missing')
    manager.close()
  })

  it('reaches every provider it is given to, with one id, and stops when one unsubscribes', () => {
    let manager = createToastManager()
    let page = new ToastStore()
    let panel = new ToastStore()
    let stopPage = manager.subscribe(page)
    manager.subscribe(panel)

    let id = manager.add({ title: 'Invoice sent' })
    manager.update(id, { description: 'To Acme Labs' })
    stopPage()
    manager.close(id)

    assert.deepEqual(
      page.toasts.map((toast) => [toast.id, toast.description, toast.transitionStatus]),
      [[id, 'To Acme Labs', undefined]],
    )
    assert.deepEqual(panel.toasts, [])
  })

  it('keeps the toasts of different managers apart', () => {
    let billing = createToastManager()
    let support = createToastManager()
    let billingStore = new ToastStore()
    let supportStore = new ToastStore()
    billing.subscribe(billingStore)
    support.subscribe(supportStore)

    billing.add({ id: 'shared', title: 'Invoice sent' })
    support.add({ id: 'shared', title: 'Ticket opened' })
    support.close('shared')

    assert.deepEqual(titles(billingStore), ['Invoice sent'])
    assert.deepEqual(titles(supportStore), [])
  })

  it('runs a promise through its providers', async () => {
    let manager = createToastManager()
    let store = new ToastStore()
    manager.subscribe(store)

    assert.equal(
      await manager.promise(Promise.resolve(3), {
        loading: 'Counting…',
        success: (n) => `${n} invoices`,
        error: 'Failed',
      }),
      3,
    )
    assert.deepEqual(
      store.toasts.map((toast) => [toast.type, toast.description]),
      [['success', '3 invoices']],
    )
  })
})

describe('promise options, hotkeys', () => {
  it('turns a string into a description and calls a function with the value', () => {
    assert.deepEqual(resolvePromiseOption('Saved.', undefined), { description: 'Saved.' })
    assert.deepEqual(
      resolvePromiseOption((n: number) => ({ title: `${n} saved` }), 2),
      { title: '2 saved' },
    )
  })

  it('names and matches hotkeys', () => {
    // The server has no KeyboardEvent; the check reads only these fields.
    let press = (init: Partial<KeyboardEvent>) => ({ altKey: false, ...init }) as KeyboardEvent

    assert.equal(describeHotkey(['F6']), 'F6')
    assert.equal(describeHotkey(['altKey', 'KeyT']), 'Alt+T')
    assert.ok(matchesHotkey(press({ key: 'F6', code: 'F6' }), ['F6']))
    assert.ok(matchesHotkey(press({ key: 't', code: 'KeyT', altKey: true }), ['altKey', 'KeyT']))
    assert.ok(!matchesHotkey(press({ key: 't', code: 'KeyT' }), ['altKey', 'KeyT']))
    assert.ok(!matchesHotkey(press({ key: 'F6', code: 'F6' }), []))
  })
})

describe('Toaster on the server', () => {
  it('renders the named region and the empty live regions, and no toast', async () => {
    let html = await renderToString(<Toaster />)
    let region = attributes(html, 'section')

    assert.equal(region.get('data-slot'), 'toast-viewport')
    assert.equal(region.get('aria-label'), 'Notifications (F6)')
    assert.equal(region.get('data-position'), 'bottom-end')
    assert.match(html, /<div role="status" aria-live="polite" aria-atomic="false"><\/div>/)
    assert.match(html, /<div role="alert" aria-live="assertive" aria-atomic="false"><\/div>/)
    assert.doesNotMatch(html, /data-slot="toast"/)
  })

  it('reads its position, label and hotkey', async () => {
    let html = await renderToString(
      <Toaster position="top-center" label="Billing updates" hotkey={['altKey', 'KeyN']} />,
    )
    let region = attributes(html, 'section')

    assert.equal(region.get('data-position'), 'top-center')
    assert.equal(region.get('aria-label'), 'Billing updates (Alt+N)')
  })

  it('holds no toast between requests: the shared manager refuses toasts on the server', async () => {
    let { toast } = await import('./toast.tsx')
    await renderToString(<Toaster />)

    assert.throws(() => toast.add({ title: 'Leaked' }), /No ToastProvider is mounted/)
  })
})
