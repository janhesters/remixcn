// RemixCN Toast: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { TypedEventTarget, clientEntry, css, on, ref } from 'remix/component'
import type { Handle, Props, RemixNode } from 'remix/component'

import { CircleCheckIcon, InfoIcon, LoaderIcon, OctagonXIcon, TriangleAlertIcon, XIcon } from '#remixcn/lib/icons.tsx'
import { mergeStyles, visuallyHidden } from '#remixcn/lib/styles.ts'
import type { Styles } from '#remixcn/lib/styles.ts'
import { Button } from '#remixcn/ui/button.tsx'

/** The types the built-in icon knows. Any other string styles a toast through data-type. */
export const toastTypes = ['success', 'info', 'warning', 'error', 'loading'] as const
/** Where the viewport sits. Start and end follow the text direction. */
export const toastPositions = [
  'top-start',
  'top-center',
  'top-end',
  'bottom-start',
  'bottom-center',
  'bottom-end',
] as const

export type ToastType = (typeof toastTypes)[number]
export type ToastPosition = (typeof toastPositions)[number]
/** low is announced politely, as a status. high is announced at once, as an alert. */
export type ToastPriority = 'low' | 'high'
export type ToastSwipeDirection = 'up' | 'down' | 'left' | 'right'
/** Why a toast closed: its timeout ran out, or a person or your code dismissed it. */
export type ToastCloseReason = 'timeout' | 'dismiss'
/** Why the timers wait. Each source pauses and resumes on its own. */
export type ToastPauseReason = 'hover' | 'focus' | 'interaction' | 'hidden' | 'blur'

/** The action button's props: its label as children, and your on('click') in mix. */
export type ToastActionProps = Props<'button'>

export interface ToastUpdate<Data = unknown> {
  title?: RemixNode
  description?: RemixNode
  /** One of toastTypes, or your own. A loading toast waits until you update or close it. */
  type?: ToastType | (string & {})
  /** Milliseconds before it closes by itself. 0 or Infinity keeps it until it's closed. Defaults to the provider's timeout. */
  timeout?: number
  priority?: ToastPriority
  /** Renders an action button. It runs only when someone activates it. */
  actionProps?: ToastActionProps
  /** Runs once when the toast starts to close. */
  onClose?: (reason: ToastCloseReason) => void
  /** Runs once the toast has left the screen and the list. */
  onRemove?: () => void
  /** Your own data. An update replaces it as a whole. */
  data?: Data
}

export interface ToastOptions<Data = unknown> extends ToastUpdate<Data> {
  /** A stable id. Adding a toast with the id of an open one updates it in place and restarts its timer. */
  id?: string
}

export interface ToastObject<Data = unknown> extends ToastUpdate<Data> {
  readonly id: string
  /** Counts the updates and upserts, from 0. */
  readonly updateKey: number
  /** Changes when the toast should be announced again: when it's added, upserted, or its text or priority changes. */
  readonly announcement: number
  /** Marks a toast that is closing. It stays in the list until its exit finishes. */
  readonly transitionStatus?: 'ending'
  readonly closeReason?: ToastCloseReason
  /** Marks a toast past the provider's limit: hidden and inert until newer toasts close. */
  readonly limited: boolean
}

export type ToastPromiseOption<Value, Data> =
  string | ToastUpdate<Data> | ((value: Value) => string | ToastUpdate<Data>)

export interface ToastPromiseOptions<Value, Data = unknown> {
  /** A string is the description. */
  loading: string | ToastUpdate<Data>
  success: ToastPromiseOption<Value, Data>
  error: ToastPromiseOption<unknown, Data>
}

// Ids count up per page. On the server no toast is ever added, so this never
// holds anything about a request.
let lastId = 0
const nextId = () => `toast-${++lastId}`

const isPersistent = (timeout: number) => !Number.isFinite(timeout) || timeout <= 0

/**
 * Marks the open toasts past `limit` as limited. Toasts come newest first, so
 * the newest stay visible. Closing toasts don't count. Returns the same object
 * for a toast whose flag doesn't change.
 */
export function applyLimit<Data>(toasts: readonly ToastObject<Data>[], limit: number): ToastObject<Data>[] {
  let open = 0
  return toasts.map((toast) => {
    if (toast.transitionStatus === 'ending') return toast
    let limited = open++ >= limit
    return toast.limited === limited ? toast : { ...toast, limited }
  })
}

/** Turns a promise option into update options: a string is the description. */
export function resolvePromiseOption<Value, Data>(
  option: ToastPromiseOption<Value, Data>,
  value: Value,
): ToastUpdate<Data> {
  let resolved = typeof option === 'function' ? option(value) : option
  return typeof resolved === 'string' ? { description: resolved } : resolved
}

export interface ToastLayout {
  /** The place in the stack: 0 is the front. A closing toast keeps its place in the list. */
  index: number
  /** Pixels from the edge when the stack is expanded: the heights of the newer toasts. */
  offsetY: number
}

/** Where each toast sits in the stack, from the measured heights. */
export function layoutToasts(toasts: readonly ToastObject<unknown>[], heights: ReadonlyMap<string, number>) {
  let layout = new Map<string, ToastLayout>()
  let visible = 0
  let offsetY = 0

  toasts.forEach((toast, index) => {
    let ending = toast.transitionStatus === 'ending'
    layout.set(toast.id, { index: ending ? index : visible, offsetY })
    if (!ending) {
      visible++
      offsetY += heights.get(toast.id) ?? 0
    }
  })
  return layout
}

/** Runs a caller's callback, and reports an error without stopping the store's own work. */
function runCallback(callback: () => void) {
  try {
    callback()
  } catch (error) {
    if (typeof reportError === 'function') reportError(error)
    else
      queueMicrotask(() => {
        throw error
      })
  }
}

interface Timer {
  remaining: number
  startedAt: number
  handle?: ReturnType<typeof setTimeout>
}

export interface ToastStoreOptions {
  /** The default timeout in milliseconds. 0 keeps toasts until they're closed. */
  timeout?: number
  /** How many toasts show at once. Older ones are limited until newer ones close. */
  limit?: number
}

/**
 * The toasts of one provider and their timers. ToastProvider creates one per
 * mounted provider, in the browser, and gives it to its descendants: read it
 * with handle.context.get(ToastProvider). It dispatches change after every
 * change, so a component can listen and update.
 */
export class ToastStore<Data = unknown> extends TypedEventTarget<{ change: Event }> {
  /** The element focused before focus entered the viewport. The viewport sets it, and closing toasts return focus there. */
  returnFocus: HTMLElement | null = null

  #toasts: ToastObject<Data>[] = []
  #heights = new Map<string, number>()
  #timers = new Map<string, Timer>()
  #elements = new Map<string, HTMLElement>()
  #pauses = new Set<ToastPauseReason>()
  #announcements = 0
  #timeout: number
  #limit: number
  #disposed = false

  constructor({ timeout = 5000, limit = 3 }: ToastStoreOptions = {}) {
    super()
    this.#timeout = timeout
    this.#limit = limit
  }

  /** Newest first, closing toasts included until their exit ends. */
  get toasts(): readonly ToastObject<Data>[] {
    return this.#toasts
  }

  get timeout() {
    return this.#timeout
  }

  get limit() {
    return this.#limit
  }

  /** Whether the timers wait, for any reason. */
  get paused() {
    return this.#pauses.size > 0
  }

  /** Whether the stack is open: a pointer is over it, or keyboard focus is in it. */
  get expanded() {
    return this.#pauses.has('hover') || this.#pauses.has('focus')
  }

  get disposed() {
    return this.#disposed
  }

  /** The measured height of a toast in pixels, once its element reported it. */
  height(id: string) {
    return this.#heights.get(id)
  }

  /** Where each toast sits in the stack. */
  layout() {
    return layoutToasts(this.#toasts, this.#heights)
  }

  /** Applies a provider's changed timeout and limit. A new timeout counts for timers that start later. */
  configure({ timeout = this.#timeout, limit = this.#limit }: ToastStoreOptions) {
    if (this.#disposed || (timeout === this.#timeout && limit === this.#limit)) return
    this.#timeout = timeout
    this.#limit = limit
    this.#set(applyLimit(this.#toasts, limit))
  }

  /** Shows a toast and returns its id. With the id of an open toast, it updates that toast in place. */
  add(options: ToastOptions<Data>): string {
    let { id: given, ...fields } = options
    let id = given || nextId()
    if (this.#disposed) return id

    let existing = this.#find(id)
    if (existing && existing.transitionStatus !== 'ending') {
      this.#change(id, fields, true)
      return id
    }

    // A closing toast with the same id makes room at once, without onRemove.
    let rest = existing ? this.#toasts.filter((toast) => toast.id !== id) : this.#toasts
    this.#heights.delete(id)
    let toast: ToastObject<Data> = { ...fields, id, updateKey: 0, announcement: ++this.#announcements, limited: false }
    this.#set(applyLimit([toast, ...rest], this.#limit))
    this.#schedule(toast)
    return id
  }

  /** Changes an open toast. Ignores a closing or unknown toast, and never runs the updater for one. */
  update(id: string, updates: ToastUpdate<Data> | ((toast: ToastObject<Data>) => ToastUpdate<Data>)) {
    let toast = this.#find(id)
    if (this.#disposed || !toast || toast.transitionStatus === 'ending') return
    this.#change(id, typeof updates === 'function' ? updates(toast) : updates, false)
  }

  /** Closes one toast, or every open toast without an id. */
  close(id?: string) {
    if (this.#disposed) return
    let closing = this.#toasts.filter(
      (toast) => toast.transitionStatus !== 'ending' && (id === undefined || toast.id === id),
    )
    this.#close(closing, 'dismiss')
  }

  /** Shows a loading toast while the promise runs, then its success or error. Returns the same outcome as the promise. */
  promise<Value>(promise: Promise<Value>, options: ToastPromiseOptions<Value, Data>): Promise<Value> {
    let id = this.add({ ...resolvePromiseOption(options.loading, undefined), type: 'loading' })
    return promise.then(
      (value) => {
        this.update(id, { timeout: undefined, ...resolvePromiseOption(options.success, value), type: 'success' })
        return value
      },
      (error: unknown) => {
        this.update(id, { timeout: undefined, ...resolvePromiseOption(options.error, error), type: 'error' })
        throw error
      },
    )
  }

  /** Takes a toast out of the list at once. A Toast calls it when its exit ends. */
  remove(id: string) {
    let toast = this.#find(id)
    if (this.#disposed || !toast) return
    this.#clearTimer(id)
    this.#heights.delete(id)
    this.#set(
      applyLimit(
        this.#toasts.filter((item) => item.id !== id),
        this.#limit,
      ),
    )
    if (toast.onRemove) runCallback(toast.onRemove)
  }

  /** Records the measured height of a toast, which places the toasts after it. */
  setHeight(id: string, height: number) {
    if (this.#disposed || this.#heights.get(id) === height || !this.#find(id)) return
    this.#heights.set(id, height)
    this.dispatchEvent(new Event('change'))
  }

  /**
   * Connects a toast's element until the signal aborts. A closing toast
   * without one leaves the list at once, and so does one whose element goes
   * away before its exit ends.
   */
  attach(id: string, element: HTMLElement, signal: AbortSignal) {
    this.#elements.set(id, element)
    signal.addEventListener('abort', () => {
      if (this.#elements.get(id) !== element) return
      this.#elements.delete(id)
      if (this.#find(id)?.transitionStatus === 'ending') this.remove(id)
    })
  }

  /** Stops every timer for this reason, keeping their remaining time. */
  pause(reason: ToastPauseReason) {
    if (this.#disposed || this.#pauses.has(reason)) return
    let { paused, expanded } = this
    this.#pauses.add(reason)
    if (!paused) for (let timer of this.#timers.values()) this.#stop(timer)
    if (this.expanded !== expanded) this.dispatchEvent(new Event('change'))
  }

  /** Lifts this reason. The timers go on once no reason is left. */
  resume(reason: ToastPauseReason) {
    if (this.#disposed || !this.#pauses.delete(reason)) return
    if (!this.paused) for (let [id, timer] of this.#timers) this.#start(id, timer)
    if (reason === 'hover' || reason === 'focus') this.dispatchEvent(new Event('change'))
  }

  /**
   * Stops every timer, empties the list and ignores later calls. ToastProvider
   * calls it when it unmounts. Its toasts have then left the screen, so each
   * one's onRemove runs once; onClose doesn't, since nobody closed them.
   */
  dispose() {
    if (this.#disposed) return
    this.#disposed = true
    for (let timer of this.#timers.values()) clearTimeout(timer.handle)
    this.#timers.clear()
    this.#elements.clear()
    // Empty the list first, so each toast is told once, whatever its callback calls.
    let toasts = this.#toasts
    this.#toasts = []
    for (let toast of toasts) if (toast.onRemove) runCallback(toast.onRemove)
  }

  #find(id: string) {
    return this.#toasts.find((toast) => toast.id === id)
  }

  #set(toasts: ToastObject<Data>[]) {
    this.#toasts = toasts
    this.dispatchEvent(new Event('change'))
  }

  #change(id: string, fields: ToastUpdate<Data> & { id?: string }, upsert: boolean) {
    // An updater may have changed the store, so read the toast again.
    let previous = this.#find(id)
    if (!previous || previous.transitionStatus === 'ending') return

    let { id: _ignored, ...updates } = fields
    let textChanged = (['title', 'description', 'priority'] as const).some(
      (key) => key in updates && updates[key] !== previous[key],
    )
    let next: ToastObject<Data> = {
      ...previous,
      ...updates,
      updateKey: previous.updateKey + 1,
      announcement: upsert || textChanged ? ++this.#announcements : previous.announcement,
    }
    this.#set(this.#toasts.map((toast) => (toast.id === id ? next : toast)))

    let timeout = this.#duration(next)
    if (timeout === 0) this.#clearTimer(id)
    else if (upsert || 'timeout' in updates || previous.type === 'loading' || !this.#timers.has(id))
      this.#schedule(next)
  }

  #close(closing: ToastObject<Data>[], reason: ToastCloseReason) {
    if (closing.length === 0) return
    let ids = new Set(closing.map((toast) => toast.id))
    for (let id of ids) this.#clearTimer(id)

    let next = this.#toasts.map((toast) =>
      ids.has(toast.id) ? { ...toast, transitionStatus: 'ending' as const, closeReason: reason } : toast,
    )
    this.#set(applyLimit(next, this.#limit))

    for (let toast of closing) {
      if (toast.onClose) runCallback(() => toast.onClose?.(reason))
    }
    // Without an element to animate, a closing toast leaves at once, unless
    // an onClose callback already showed a new toast with its id.
    for (let id of ids) {
      if (!this.#elements.has(id) && this.#find(id)?.transitionStatus === 'ending') this.remove(id)
    }
  }

  #duration(toast: ToastObject<Data>) {
    let timeout = toast.timeout ?? this.#timeout
    return toast.type === 'loading' || isPersistent(timeout) ? 0 : timeout
  }

  #schedule(toast: ToastObject<Data>) {
    this.#clearTimer(toast.id)
    let remaining = this.#duration(toast)
    if (remaining === 0) return
    let timer: Timer = { remaining, startedAt: 0 }
    this.#timers.set(toast.id, timer)
    if (!this.paused) this.#start(toast.id, timer)
  }

  #start(id: string, timer: Timer) {
    timer.startedAt = performance.now()
    timer.handle = setTimeout(() => {
      this.#timers.delete(id)
      let toast = this.#find(id)
      if (toast && toast.transitionStatus !== 'ending') this.#close([toast], 'timeout')
    }, timer.remaining)
  }

  #stop(timer: Timer) {
    if (timer.handle === undefined) return
    clearTimeout(timer.handle)
    timer.handle = undefined
    timer.remaining = Math.max(0, timer.remaining - (performance.now() - timer.startedAt))
  }

  #clearTimer(id: string) {
    clearTimeout(this.#timers.get(id)?.handle)
    this.#timers.delete(id)
  }
}

export interface ToastManager<Data = unknown> {
  /** Shows a toast in every provider this manager reaches and returns its id. Throws when no provider is mounted. */
  add(options: ToastOptions<Data>): string
  /** Changes an open toast. Does nothing for a closed or unknown one. */
  update(id: string, updates: ToastUpdate<Data> | ((toast: ToastObject<Data>) => ToastUpdate<Data>)): void
  /** Closes one toast, or all of them without an id. */
  close(id?: string): void
  /** Shows a loading toast while the promise runs, then its success or error. */
  promise<Value>(promise: Promise<Value>, options: ToastPromiseOptions<Value, Data>): Promise<Value>
  /** Connects a provider's store and returns the function that disconnects it. ToastProvider calls it. */
  subscribe(store: ToastStore<Data>): () => void
}

/**
 * Creates a manager that reaches the providers it's given to, so code outside
 * them can show toasts. It holds no toasts itself: each mounted provider keeps
 * its own, and a manager no provider uses throws on add().
 */
export function createToastManager<Data = unknown>(): ToastManager<Data> {
  let stores = new Set<ToastStore<Data>>()

  let manager: ToastManager<Data> = {
    add(options) {
      if (stores.size === 0) {
        throw new Error(
          'No ToastProvider is mounted for this toast manager. Render <Toaster /> on the page, and show toasts from browser code, such as an event handler.',
        )
      }
      let id = options.id || nextId()
      for (let store of stores) store.add({ ...options, id })
      return id
    },
    update(id, updates) {
      for (let store of stores) store.update(id, updates)
    },
    close(id) {
      for (let store of stores) store.close(id)
    },
    promise(promise, options) {
      let id = manager.add({ ...resolvePromiseOption(options.loading, undefined), type: 'loading' })
      return promise.then(
        (value) => {
          manager.update(id, { timeout: undefined, ...resolvePromiseOption(options.success, value), type: 'success' })
          return value
        },
        (error: unknown) => {
          manager.update(id, { timeout: undefined, ...resolvePromiseOption(options.error, error), type: 'error' })
          throw error
        },
      )
    },
    subscribe(store) {
      stores.add(store)
      return () => void stores.delete(store)
    },
  }
  return manager
}

/** The manager every Toaster uses: call toast.add() from browser code to show a toast in it. */
export const toast: ToastManager = createToastManager()

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const text = (size: 'xs' | 'sm'): Styles => ({
  fontSize: `var(--text-${size})`,
  lineHeight: `var(--text-${size}--line-height)`,
})
// shadcn animates the stack over 500ms. Deriving it from the motion token
// keeps it at 0s for reduced motion.
const stackDuration = 'calc(var(--duration-normal) * 2.5)'
const stackEase = 'cubic-bezier(0.22, 1, 0.36, 1)'

export interface ToastProviderProps extends ToastStoreOptions {
  /** A manager whose add(), update() and close() reach this provider. Without one, only its descendants reach it, through context. */
  toastManager?: ToastManager
  children?: RemixNode
}

/**
 * Keeps the toasts of everything inside it. Its descendants read its store
 * with handle.context.get(ToastProvider). It runs in the browser inside a
 * client entry, such as Toaster: on the server it holds nothing.
 */
export function ToastProvider(handle: Handle<ToastProviderProps, ToastStore>) {
  let store = new ToastStore({ timeout: handle.props.timeout, limit: handle.props.limit })
  let subscribed: ToastManager | undefined
  let unsubscribe: (() => void) | undefined
  handle.context.set(store)

  handle.signal.addEventListener('abort', () => {
    unsubscribe?.()
    store.dispose()
  })

  return () => {
    let { toastManager, timeout, limit, children } = handle.props

    // Tasks run only in the browser, so the server never subscribes.
    handle.queueTask(() => {
      store.configure({ timeout, limit })
      if (subscribed === toastManager) return
      unsubscribe?.()
      subscribed = toastManager
      unsubscribe = toastManager?.subscribe(store)
    })

    return children
  }
}

function useStore(handle: Handle<any, any>, part: string): ToastStore {
  let store = handle.context.get(ToastProvider)
  if (!store) throw new Error(`${part} must be inside a ToastProvider.`)
  return store
}

const modifierNames: Record<string, string> = { altKey: 'Alt', ctrlKey: 'Ctrl', metaKey: 'Meta', shiftKey: 'Shift' }

/** Names a hotkey for people, such as F6 or Alt+T. */
export function describeHotkey(hotkey: readonly string[]) {
  return hotkey.map((key) => modifierNames[key] ?? key.replace(/^Key|^Digit/, '')).join('+')
}

/** Whether a key press matches a hotkey: every entry is a pressed modifier, such as altKey, or the key's code or key. */
export function matchesHotkey(event: KeyboardEvent, hotkey: readonly string[]) {
  return (
    hotkey.length > 0 &&
    hotkey.every((key) =>
      key in modifierNames ? Boolean(event[key as 'altKey']) : event.code === key || event.key === key,
    )
  )
}

const isKeyboardFocus = (element: Element | null) => {
  try {
    return element?.matches(':focus-visible') ?? false
  } catch {
    return true
  }
}

export interface ToastViewportProps extends Props<'section'> {
  /** The corner or edge it sits at. Start and end follow the text direction. Defaults to bottom-end. */
  position?: ToastPosition
  /** The region's name. The hotkey is added to it. Defaults to Notifications. */
  label?: string
  /** The keys that move focus to the newest toast and back. Each entry is a modifier, such as altKey, or a key code. Defaults to F6. */
  hotkey?: string[]
  /** Keeps the stack open, as hover and keyboard focus do. */
  expanded?: boolean
}

interface ViewportContext {
  position: ToastPosition
  expanded: boolean
}

const viewportStyles = css({
  position: 'fixed',
  zIndex: 50,
  insetInline: space(4),
  marginInline: 'auto',
  maxWidth: '24rem',
  pointerEvents: 'none',
  '&[data-position^="bottom"]': { bottom: space(4) },
  '&[data-position^="top"]': { top: space(4) },
  '@media (min-width: 40rem)': {
    width: '100%',
    '&[data-position$="-start"]': { insetInlineEnd: 'auto', marginInline: 0 },
    '&[data-position$="-end"]': { insetInlineStart: 'auto', marginInline: 0 },
  },
})

const announcerStyles = css(visuallyHidden)

/**
 * The fixed region the toasts show in, named Notifications (F6). It pauses
 * the timers while a pointer is over it, keyboard focus is in it, the page is
 * hidden or the window lost focus, and expands the stack on hover and focus.
 * The hotkey moves focus to the newest toast and back. Two hidden live
 * regions beside it announce each toast once: a status for low priority, an
 * alert for high.
 */
export function ToastViewport(handle: Handle<ToastViewportProps, ViewportContext>) {
  let section: HTMLElement | undefined
  let touchOutside: AbortController | undefined

  handle.queueTask(() => {
    let store = useStore(handle, 'ToastViewport')
    let { signal } = handle
    let doc = section?.ownerDocument ?? document
    let win = doc.defaultView ?? window
    store.addEventListener('change', () => void handle.update(), { signal })

    let syncHidden = () => (doc.hidden ? store.pause('hidden') : store.resume('hidden'))
    syncHidden()
    doc.addEventListener('visibilitychange', syncHidden, { signal })
    win.addEventListener('blur', (event) => event.target === win && store.pause('blur'), { signal })
    win.addEventListener('focus', (event) => event.target === win && store.resume('blur'), { signal })

    doc.addEventListener(
      'keydown',
      (event) => {
        if (event.defaultPrevented || !section || !matchesHotkey(event, handle.props.hotkey ?? ['F6'])) return
        if (section.contains(doc.activeElement)) {
          // The hotkey again returns to where you were.
          event.preventDefault()
          returnFocus(store, doc)
          return
        }
        let front = [...section.querySelectorAll<HTMLElement>('[data-slot="toast"]')].find(
          (toast) => !toast.inert && !toast.hasAttribute('data-ending-style'),
        )
        if (!front) return
        event.preventDefault()
        store.returnFocus = doc.activeElement instanceof win.HTMLElement ? doc.activeElement : null
        front.focus()
      },
      { signal },
    )
  })

  return () => {
    let store = useStore(handle, 'ToastViewport')
    let {
      position = 'bottom-end',
      label = 'Notifications',
      hotkey = ['F6'],
      expanded,
      children,
      mix,
      ...props
    } = handle.props
    let open = Boolean(expanded) || store.expanded
    handle.context.set({ position, expanded: open })

    let front = store.toasts.find((toast) => toast.transitionStatus !== 'ending')
    let frontHeight = front ? store.height(front.id) : undefined
    // A toast without text has nothing to announce yet, such as custom content before it's measured.
    let announced = store.toasts.filter(
      (toast) => toast.transitionStatus !== 'ending' && (toast.title != null || toast.description != null),
    )

    return (
      <>
        <section
          data-slot="toast-viewport"
          data-position={position}
          data-expanded={open ? '' : undefined}
          aria-label={hotkey.length > 0 ? `${label} (${describeHotkey(hotkey)})` : label}
          {...props}
          style={
            {
              '--toast-frontmost-height': frontHeight === undefined ? null : `${frontHeight}px`,
            } as Props<'div'>['style']
          }
          mix={[
            viewportStyles,
            mix,
            ref((node) => (section = node)),
            on('pointerenter', (event) => {
              if (event.pointerType !== 'touch') store.pause('hover')
            }),
            on('pointermove', (event) => {
              if (event.pointerType !== 'touch') store.pause('hover')
            }),
            on('pointerleave', (event) => {
              if (event.pointerType !== 'touch') store.resume('hover')
            }),
            on('pointerdown', (event) => {
              let target = event.target as Element
              if (!target.closest('[data-slot="toast"]')) return
              store.pause('interaction')
              let doc = event.currentTarget.ownerDocument
              let release = new AbortController()
              let end = () => {
                release.abort()
                store.resume('interaction')
              }
              handle.signal.addEventListener('abort', () => release.abort(), { signal: release.signal })
              doc.addEventListener('pointerup', end, { signal: release.signal })
              doc.addEventListener('pointercancel', end, { signal: release.signal })

              // There is no hover on a touch screen: a tap opens the stack until a tap lands outside it.
              if (event.pointerType !== 'touch') return
              store.pause('hover')
              touchOutside?.abort()
              touchOutside = new AbortController()
              let outside = touchOutside
              handle.signal.addEventListener('abort', () => outside.abort(), { signal: outside.signal })
              doc.addEventListener(
                'pointerdown',
                (next) => {
                  if (section?.contains(next.target as Node)) return
                  outside.abort()
                  store.resume('hover')
                },
                { capture: true, signal: outside.signal },
              )
            }),
            on('focusin', (event) => {
              let from = event.relatedTarget
              if (from instanceof HTMLElement && !event.currentTarget.contains(from)) store.returnFocus = from
              if (isKeyboardFocus(event.target as Element)) store.pause('focus')
            }),
            on('focusout', (event) => {
              let viewport = event.currentTarget
              // Chromium reports a focused element that is being removed as a blur
              // to nowhere. Decide once the removal is done.
              queueMicrotask(() => {
                if (!viewport.contains(viewport.ownerDocument.activeElement)) store.resume('focus')
              })
            }),
          ]}
        >
          {children}
        </section>
        <div data-slot="toast-announcer" mix={announcerStyles}>
          <div role="status" aria-live="polite" aria-atomic="false">
            {announced
              .filter((toast) => toast.priority !== 'high')
              .map((toast) => (
                <Announcement
                  key={`${toast.id}:${toast.announcement}`}
                  title={toast.title}
                  description={toast.description}
                />
              ))}
          </div>
          <div role="alert" aria-live="assertive" aria-atomic="false">
            {announced
              .filter((toast) => toast.priority === 'high')
              .map((toast) => (
                <Announcement
                  key={`${toast.id}:${toast.announcement}`}
                  title={toast.title}
                  description={toast.description}
                />
              ))}
          </div>
        </div>
      </>
    )
  }
}

// One added element per announcement. It keeps its node while the toast
// renders again, so screen readers don't hear it twice.
function Announcement(handle: Handle<{ title?: RemixNode; description?: RemixNode }>) {
  return () => (
    <div>
      {handle.props.title != null ? <div>{handle.props.title}</div> : null}
      {handle.props.description != null ? <div>{handle.props.description}</div> : null}
    </div>
  )
}

export interface ToastProps extends Props<'div'> {
  /** The toast to show, from the provider's store. */
  toast: ToastObject<any>
  /** The directions a swipe dismisses it in. Defaults to toward the screen edge and toward the end of the line. An empty list turns swiping off. */
  swipeDirection?: ToastSwipeDirection | ToastSwipeDirection[]
  /** Whether Escape and swipes close it. Defaults to true. */
  dismissible?: boolean
}

interface ToastContext {
  toast: ToastObject<any>
  store: ToastStore
  titleId: string
  descriptionId: string
  front: boolean
  expanded: boolean
}

const swipeThreshold = 40
const swipeIgnore = 'button, a, input, select, textarea, [role="button"], [data-swipe-ignore]'

const toastStyles = css(
  mergeStyles({
    '--gap': '0.75rem',
    '--peek': '0.75rem',
    '--lift': '-1',
    '--index': 'var(--toast-index, 0)',
    '--swipe-x': 'var(--toast-swipe-movement-x, 0px)',
    '--swipe-y': 'var(--toast-swipe-movement-y, 0px)',
    '--own-height': 'var(--toast-height, auto)',
    '--height': 'var(--toast-frontmost-height, var(--own-height))',
    '--scale': 'max(0, 1 - var(--index) * 0.1)',
    '--shrink': 'calc(1 - var(--scale))',
    '--offset-y': 'calc(var(--lift) * (var(--toast-offset-y, 0px) + var(--index) * var(--gap)) + var(--swipe-y))',
    pointerEvents: 'auto',
    position: 'absolute',
    insetInlineEnd: 0,
    bottom: 0,
    zIndex: 'calc(1000 - var(--index))',
    boxSizing: 'border-box',
    width: '100%',
    height: 'var(--height)',
    transformOrigin: 'bottom',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    backgroundColor: 'var(--popover)',
    color: 'var(--popover-foreground)',
    boxShadow: 'var(--shadow-lg)',
    userSelect: 'none',
    touchAction: 'none',
    transform:
      'translateX(var(--swipe-x)) translateY(calc(var(--swipe-y) + var(--lift) * (var(--index) * var(--peek) + var(--shrink) * var(--toast-height, 0px)))) scale(var(--scale))',
    transition: `transform ${stackDuration} ${stackEase}, opacity ${stackDuration}, height calc(var(--duration-normal) * 0.75)`,
    '@starting-style': { transform: 'translateY(calc(var(--lift) * -150%))' },
    // Bridges the gap between expanded toasts, so the pointer stays over the stack.
    '&::after': {
      content: '""',
      position: 'absolute',
      top: '100%',
      insetInlineStart: 0,
      width: '100%',
      height: 'calc(var(--gap) + 1px)',
    },
    ':where([data-position^="top"]) > &': {
      '--lift': '1',
      top: 0,
      bottom: 'auto',
      transformOrigin: 'top',
      '&::after': { top: 'auto', bottom: '100%' },
    },
    '&[data-expanded]': {
      height: 'var(--own-height)',
      transform: 'translateX(var(--swipe-x)) translateY(var(--offset-y))',
    },
    '&[data-swiping]': { transition: 'none' },
    '&[data-limited]': { opacity: 0 },
    '&[data-ending-style]': { pointerEvents: 'none' },
    '&[data-ending-style]:not([data-limited]):not([data-swipe-direction])': {
      opacity: 0,
      transform: 'translateY(calc(var(--lift) * -150%))',
    },
    '&[data-ending-style][data-swipe-direction="down"]': { transform: 'translateY(calc(var(--swipe-y) + 150%))' },
    '&[data-ending-style][data-swipe-direction="up"]': { transform: 'translateY(calc(var(--swipe-y) - 150%))' },
    '&[data-ending-style][data-swipe-direction="left"]': {
      transform: 'translateX(calc(var(--swipe-x) - 150%)) translateY(var(--offset-y))',
    },
    '&[data-ending-style][data-swipe-direction="right"]': {
      transform: 'translateX(calc(var(--swipe-x) + 150%)) translateY(var(--offset-y))',
    },
  }),
)

function defaultSwipeDirections(position: ToastPosition, element: Element): ToastSwipeDirection[] {
  let rtl = getComputedStyle(element).direction === 'rtl'
  return [position.startsWith('top') ? 'up' : 'down', rtl ? 'left' : 'right']
}

/** Measures the height a toast takes without the stack's clamp. */
function naturalHeight(element: HTMLElement) {
  let height = element.style.height
  element.style.height = 'auto'
  let natural = element.offsetHeight
  element.style.height = height
  return natural
}

/**
 * Returns focus to where it was before it entered the viewport. When that was
 * the page itself, or the element is gone, focus goes back to the page.
 */
function returnFocus(store: ToastStore, doc: Document) {
  let target = store.returnFocus
  store.returnFocus = null
  if (target?.isConnected && target !== doc.body) target.focus()
  else (doc.activeElement as HTMLElement | null)?.blur()
}

/** Moves focus out of a closing toast: to the next open toast, the previous one, or where it was before. */
function moveFocusOut(element: HTMLElement, store: ToastStore) {
  let doc = element.ownerDocument
  if (!element.contains(doc.activeElement)) return
  let toasts = [
    ...(element.closest('[data-slot="toast-viewport"]') ?? doc).querySelectorAll<HTMLElement>('[data-slot="toast"]'),
  ]
  let open = (toast: HTMLElement) => toast !== element && !toast.inert && !toast.hasAttribute('data-ending-style')
  let index = toasts.indexOf(element)
  let next = toasts.slice(index + 1).find(open) ?? toasts.slice(0, Math.max(index, 0)).reverse().find(open)
  if (next) next.focus()
  else returnFocus(store, doc)
}

/**
 * One toast: a non-modal dialog, or an alertdialog for high priority, named
 * by its title. It's focusable, Escape closes it, and a swipe toward an
 * allowed direction dismisses it. Limited and closing toasts can't be used.
 */
export function Toast(handle: Handle<ToastProps, ToastContext>) {
  let element: HTMLElement | undefined
  let exiting: string | undefined
  let swipedTo: ToastSwipeDirection | undefined
  // Set once focus has left a closing toast: it then turns inert for the rest of its exit.
  let handedOff = false
  let drag: { x: number; y: number; pointerId: number; directions: ToastSwipeDirection[] } | undefined

  function setMovement(x: number, y: number) {
    element?.style.setProperty('--toast-swipe-movement-x', `${x}px`)
    element?.style.setProperty('--toast-swipe-movement-y', `${y}px`)
  }

  function endDrag() {
    drag = undefined
    element?.removeAttribute('data-swiping')
  }

  return () => {
    let store = useStore(handle, 'Toast')
    let viewport = handle.context.get(ToastViewport) as ViewportContext | undefined
    let { toast: item, swipeDirection, dismissible = true, mix, ...props } = handle.props
    let ending = item.transitionStatus === 'ending'
    let layout = store.layout().get(item.id) ?? { index: 0, offsetY: 0 }
    let height = store.height(item.id)
    let expanded = viewport?.expanded ?? false
    let titleId = `${handle.id}-title`
    let descriptionId = `${handle.id}-description`
    let high = item.priority === 'high'
    handle.context.set({ toast: item, store, titleId, descriptionId, front: layout.index === 0, expanded })

    if (!ending) {
      exiting = undefined
      swipedTo = undefined
      handedOff = false
    } else if (exiting !== item.id) {
      exiting = item.id
      let id = item.id
      handle.queueTask(() => {
        if (!element) return
        let node = element
        // Move focus first: an element that turns inert while it has focus drops it to the page.
        moveFocusOut(node, store)
        handedOff = true
        void handle.update()
        // Wait for the exit transitions. Reduced motion has none, so the toast leaves at once.
        void Promise.allSettled(node.getAnimations().map((animation) => animation.finished)).then(() => {
          if (
            node.isConnected &&
            store.toasts.some((toast) => toast.id === id && toast.transitionStatus === 'ending')
          ) {
            store.remove(id)
          }
        })
      })
    }

    handle.queueTask(() => {
      if (element && !ending) store.setHeight(item.id, naturalHeight(element))
    })

    let directions = swipeDirection === undefined ? undefined : [swipeDirection].flat()

    return (
      <div
        data-slot="toast"
        data-type={item.type}
        data-priority={high ? 'high' : 'low'}
        data-front={layout.index === 0 ? '' : undefined}
        data-expanded={expanded ? '' : undefined}
        data-limited={item.limited ? '' : undefined}
        data-ending-style={ending ? '' : undefined}
        data-swipe-direction={ending ? swipedTo : undefined}
        role={high ? 'alertdialog' : 'dialog'}
        aria-modal="false"
        aria-labelledby={item.title != null ? titleId : item.description != null ? descriptionId : undefined}
        aria-describedby={item.title != null && item.description != null ? descriptionId : undefined}
        tabIndex={0}
        inert={item.limited || (ending && handedOff)}
        {...props}
        style={
          {
            '--toast-index': String(layout.index),
            '--toast-offset-y': `${layout.offsetY}px`,
            '--toast-height': height === undefined ? null : `${height}px`,
          } as Props<'div'>['style']
        }
        mix={[
          toastStyles,
          mix,
          ref((node, signal) => {
            element = node
            store.attach(item.id, node, signal)
            let observer = new ResizeObserver(() => {
              if (!node.hasAttribute('data-ending-style')) store.setHeight(item.id, naturalHeight(node))
            })
            observer.observe(node)
            signal.addEventListener('abort', () => observer.disconnect())
          }),
          on('keydown', (event) => {
            if (event.key !== 'Escape' || event.defaultPrevented || !dismissible || ending) return
            event.preventDefault()
            store.close(item.id)
          }),
          on('pointerdown', (event) => {
            if (!dismissible || ending || !event.isPrimary || event.button !== 0) return
            if ((event.target as Element).closest(swipeIgnore)) return
            let node = event.currentTarget
            let allowed = directions ?? defaultSwipeDirections(viewport?.position ?? 'bottom-end', node)
            if (allowed.length === 0) return
            drag = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, directions: allowed }
            try {
              node.setPointerCapture(event.pointerId)
            } catch {
              // A synthetic pointer can't be captured. The drag still follows its events.
            }
          }),
          on('pointermove', (event) => {
            if (!drag || event.pointerId !== drag.pointerId) return
            let dx = event.clientX - drag.x
            let dy = event.clientY - drag.y
            // Movement toward a direction that doesn't dismiss is damped.
            let x = drag.directions.includes(dx < 0 ? 'left' : 'right') ? dx : dx * 0.2
            let y = drag.directions.includes(dy < 0 ? 'up' : 'down') ? dy : dy * 0.2
            if (Math.abs(dx) + Math.abs(dy) > 1) element?.setAttribute('data-swiping', '')
            setMovement(x, y)
          }),
          on('pointerup', (event) => {
            if (!drag || event.pointerId !== drag.pointerId) return
            let dx = event.clientX - drag.x
            let dy = event.clientY - drag.y
            let horizontal = Math.abs(dx) >= Math.abs(dy)
            let direction: ToastSwipeDirection = horizontal ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down'
            let distance = horizontal ? Math.abs(dx) : Math.abs(dy)
            let dismissed = drag.directions.includes(direction) && distance >= swipeThreshold
            endDrag()
            if (dismissed) {
              swipedTo = direction
              store.close(item.id)
            } else {
              setMovement(0, 0)
            }
          }),
          on('pointercancel', () => {
            if (!drag) return
            endDrag()
            setMovement(0, 0)
          }),
        ]}
      />
    )
  }
}

function useToast(handle: Handle<any, any>, part: string): ToastContext {
  let context = handle.context.get(Toast) as ToastContext | undefined
  if (!context) throw new Error(`${part} must be inside a Toast.`)
  return context
}

const contentStyles = css(
  mergeStyles({
    display: 'flex',
    // On a narrow screen or with large text, the buttons wrap below the text.
    flexWrap: 'wrap',
    boxSizing: 'border-box',
    height: '100%',
    alignItems: 'center',
    gap: space(3),
    overflow: 'hidden',
    padding: space(4),
    transitionProperty: 'opacity',
    transitionDuration: 'calc(var(--duration-normal) * 1.25)',
    transitionTimingFunction: stackEase,
    '&[data-behind]': { opacity: 0 },
  }),
)

/** Lays out a toast's icon, text and buttons in a row. Behind the front toast of a closed stack it fades out. */
export function ToastContent(handle: Handle<Props<'div'>>) {
  return () => {
    let { front, expanded } = useToast(handle, 'ToastContent')
    let { mix, ...props } = handle.props
    return (
      <div
        data-slot="toast-content"
        data-behind={!front && !expanded ? '' : undefined}
        data-expanded={expanded ? '' : undefined}
        {...props}
        mix={[contentStyles, mix]}
      />
    )
  }
}

const titleStyles = css({ ...text('sm'), margin: 0, fontWeight: 500, overflowWrap: 'anywhere' })

/** The toast's title, which names it. Renders the toast's title unless you give children, and nothing without either. */
export function ToastTitle(handle: Handle<Props<'h2'>>) {
  return () => {
    let { toast: item, titleId } = useToast(handle, 'ToastTitle')
    let { children, mix, ...props } = handle.props
    let content = children ?? item.title
    if (content == null) return null
    return (
      <h2 id={titleId} data-slot="toast-title" data-type={item.type} {...props} mix={[titleStyles, mix]}>
        {content}
      </h2>
    )
  }
}

const descriptionStyles = css({ ...text('sm'), margin: 0, color: 'var(--muted-foreground)', overflowWrap: 'anywhere' })

/** The toast's description. Renders the toast's description unless you give children, and nothing without either. */
export function ToastDescription(handle: Handle<Props<'p'>>) {
  return () => {
    let { toast: item, descriptionId } = useToast(handle, 'ToastDescription')
    let { children, mix, ...props } = handle.props
    let content = children ?? item.description
    if (content == null) return null
    return (
      <p
        id={descriptionId}
        data-slot="toast-description"
        data-type={item.type}
        {...props}
        mix={[descriptionStyles, mix]}
      >
        {content}
      </p>
    )
  }
}

const actionStyles = css({ flexShrink: 0 })

/**
 * The toast's action button: an outline Button with the toast's actionProps.
 * Their children win over yours, as in Base UI. It renders nothing without a
 * label, and runs only your click handlers, when someone activates it.
 */
export function ToastAction(handle: Handle<Props<'button'>>) {
  return () => {
    let { toast: item } = useToast(handle, 'ToastAction')
    let { mix: actionMix, children: actionChildren, ...action } = item.actionProps ?? {}
    let { mix, children, ...props } = handle.props
    let label = actionChildren ?? children
    if (label == null) return null
    return (
      <Button
        variant="outline"
        size="sm"
        data-slot="toast-action"
        data-type={item.type}
        {...props}
        {...action}
        mix={[actionStyles, mix, actionMix]}
      >
        {label}
      </Button>
    )
  }
}

const closeStyles = css({
  position: 'relative',
  flexShrink: 0,
  color: 'var(--muted-foreground)',
  '&:hover': { color: 'var(--foreground)' },
  // A larger hit area, as shadcn's after:-inset-2.
  '&::after': { content: '""', position: 'absolute', inset: '-0.5rem' },
})

/** Closes its toast. A ghost icon Button named Close toast, with an X unless you give children. */
export function ToastClose(handle: Handle<Props<'button'>>) {
  return () => {
    let { toast: item, store } = useToast(handle, 'ToastClose')
    let { mix, children, ...props } = handle.props
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        data-slot="toast-close"
        data-type={item.type}
        aria-label="Close toast"
        {...props}
        mix={[
          closeStyles,
          mix,
          on('click', (event) => {
            if (!event.defaultPrevented) store.close(item.id)
          }),
        ]}
      >
        {children ?? <XIcon />}
      </Button>
    )
  }
}

const iconStyles = css({
  display: 'inline-flex',
  flexShrink: 0,
  '& svg': { width: '1rem', height: '1rem', pointerEvents: 'none' },
  '&[data-type="error"]': { color: 'var(--destructive)' },
  '&[data-type="loading"] svg': {
    animation: 'remixcn-toast-spin 1s linear infinite',
    // Reduced motion keeps the ring still; the text still says it's loading.
    '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
  },
  '@keyframes remixcn-toast-spin': { to: { transform: 'rotate(360deg)' } },
})

const typeIcons: Record<ToastType, () => RemixNode> = {
  success: () => <CircleCheckIcon />,
  info: () => <InfoIcon />,
  warning: () => <TriangleAlertIcon />,
  error: () => <OctagonXIcon />,
  loading: () => <LoaderIcon />,
}

/** The icon of a known toast type, hidden from assistive technology. Renders nothing for other types. */
export function ToastIcon(handle: Handle<{ type?: string }>) {
  return () => {
    let { type } = handle.props
    let icon = type && (toastTypes as readonly string[]).includes(type) ? typeIcons[type as ToastType]() : null
    if (!icon) return null
    return (
      <span data-slot="toast-icon" data-type={type} mix={iconStyles}>
        {icon}
      </span>
    )
  }
}

const textColumnStyles = css({
  display: 'flex',
  flex: '1 1 7rem',
  minWidth: 0,
  flexDirection: 'column',
  gap: space(1),
})
// Keeps the buttons together at the end, also when they wrap below the text.
const buttonsStyles = css({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  alignItems: 'center',
  gap: space(2),
  maxWidth: '100%',
  marginInlineStart: 'auto',
})

/** Renders every toast of its provider with the default parts. Put it in a ToastViewport, which renders it again on every change. */
export function ToastList(handle: Handle<{ closeLabel?: string }>) {
  return () => {
    let store = useStore(handle, 'ToastList')
    return store.toasts.map((item) => (
      <Toast key={item.id} toast={item}>
        <ToastContent>
          <ToastIcon type={item.type} />
          <div mix={textColumnStyles}>
            <ToastTitle />
            <ToastDescription />
          </div>
          <div mix={buttonsStyles}>
            <ToastAction />
            <ToastClose aria-label={handle.props.closeLabel ?? 'Close toast'} />
          </div>
        </ToastContent>
      </Toast>
    ))
  }
}

export interface ToasterProps {
  position?: ToastPosition
  /** The default timeout in milliseconds. Defaults to 5000; 0 keeps toasts until they're closed. */
  timeout?: number
  /** How many toasts show at once. Defaults to 3. */
  limit?: number
  /** The region's name. Defaults to Notifications. */
  label?: string
  /** Defaults to F6. */
  hotkey?: string[]
  /** Keeps the stack open. */
  expanded?: boolean
  /** The close buttons' name. Defaults to Close toast. */
  closeLabel?: string
}

/**
 * Shows the toasts of the toast manager: a client entry with a ToastProvider,
 * a ToastViewport and a ToastList. Render it once, at the end of <body>, and
 * call toast.add() from browser code.
 */
export const Toaster = clientEntry(import.meta.url, function Toaster(handle: Handle<ToasterProps>) {
  return () => {
    let { timeout, limit, closeLabel, ...viewport } = handle.props
    return (
      <ToastProvider toastManager={toast} timeout={timeout} limit={limit}>
        <ToastViewport {...viewport}>
          <ToastList closeLabel={closeLabel} />
        </ToastViewport>
      </ToastProvider>
    )
  }
})
