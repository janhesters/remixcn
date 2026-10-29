// RemixCN Sonner: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on, ref } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'

import { visuallyHidden } from '#remixcn/lib/styles.ts'
import { Button } from '#remixcn/ui/button.tsx'
import {
  Toast,
  ToastClose,
  ToastContent,
  ToastDescription,
  ToastIcon,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  createToastManager,
} from '#remixcn/ui/toast.tsx'
import type {
  ToastManager,
  ToastObject,
  ToastOptions as ToastAddOptions,
  ToastPosition,
  ToastSwipeDirection,
} from '#remixcn/ui/toast.tsx'

// Sonner's names on top of RemixCN's Toast: the same Toaster and toast()
// calls, without the sonner and next-themes packages. Each Toaster keeps its
// own toasts in the browser; the managers here only reach mounted Toasters.

export type ToasterPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
export type ToastTypes = 'normal' | 'action' | 'success' | 'info' | 'warning' | 'error' | 'loading' | 'default'
export type SwipeDirection = 'top' | 'right' | 'bottom' | 'left'

/** A button in a toast. The toast closes after onClick unless it calls event.preventDefault(). */
export interface Action {
  label: RemixNode
  onClick: (event: MouseEvent) => void
}

/** What toast() shows, as Sonner's ToastT: the id, the message as title, and the options. */
export interface ToastT extends Omit<ExternalToast, 'id'> {
  id: string
  title?: RemixNode
  type?: ToastTypes
}

export interface ExternalToast {
  id?: string | number
  /** Shows the toast in the Toaster with this id, instead of the one without an id. */
  toasterId?: string
  description?: RemixNode
  /** Milliseconds before it closes by itself. Infinity keeps it. Defaults to the Toaster's duration. */
  duration?: number
  /** Announces it at once, as an alert, instead of politely. */
  important?: boolean
  /** Whether a person can close it: its close button, Escape and swipes. Defaults to true. */
  dismissible?: boolean
  closeButton?: boolean
  icon?: RemixNode
  action?: Action
  cancel?: Action
  onDismiss?: (toast: ToastT) => void
  onAutoClose?: (toast: ToastT) => void
}

export interface ToastIcons {
  success?: RemixNode
  info?: RemixNode
  warning?: RemixNode
  error?: RemixNode
  loading?: RemixNode
  close?: RemixNode
}

export interface ToastOptions {
  duration?: number
  closeButton?: boolean
  closeButtonAriaLabel?: string
}

export interface ToasterProps {
  /** Shows only toasts sent with this toasterId. */
  id?: string
  /** Defaults to bottom-right. Left and right follow the text direction, so they mirror in right-to-left text. */
  position?: ToasterPosition
  /** Keeps the stack open. */
  expand?: boolean
  /** Shows a close button on every toast. Defaults to false, as in Sonner. */
  closeButton?: boolean
  /** Milliseconds before a toast closes by itself. Defaults to 4000. */
  duration?: number
  /** How many toasts show at once. Defaults to 3. */
  visibleToasts?: number
  /** Moves focus to the newest toast and back. Defaults to Alt+T. */
  hotkey?: string[]
  /** Defaults to Notifications. */
  containerAriaLabel?: string
  /** light or dark sets data-theme on the region; system follows the page. */
  theme?: 'light' | 'dark' | 'system'
  dir?: 'ltr' | 'rtl' | 'auto'
  swipeDirections?: SwipeDirection[]
  toastOptions?: ToastOptions
  icons?: ToastIcons
}

interface SonnerData {
  sonner: Omit<ExternalToast, 'id' | 'toasterId' | 'description' | 'duration' | 'important'> & {
    custom?: (id: string) => RemixNode
    /** A custom toast's description, which joins it once its content's text is known. */
    customDescription?: RemixNode
  }
}

const positions: Record<ToasterPosition, ToastPosition> = {
  'top-left': 'top-start',
  'top-center': 'top-center',
  'top-right': 'top-end',
  'bottom-left': 'bottom-start',
  'bottom-center': 'bottom-center',
  'bottom-right': 'bottom-end',
}

const swipes: Record<SwipeDirection, ToastSwipeDirection> = { top: 'up', bottom: 'down', left: 'left', right: 'right' }

// One manager per Toaster id. They hold no toasts: each mounted Toaster does.
const managers = new Map<string, ToastManager<SonnerData>>()

function managerFor(toasterId = '') {
  let manager = managers.get(toasterId)
  if (!manager) {
    manager = createToastManager<SonnerData>()
    managers.set(toasterId, manager)
  }
  return manager
}

let lastId = 0

const keyOf = (toasterId: string | undefined, id: string) => `${toasterId ?? ''}\n${id}`

interface PromiseToast {
  id: string
  /** The options of the promise, which its outcome keeps unless the outcome sets its own. */
  rest: Omit<ExternalToast, 'description'>
  /** Whether a loading toast is showing, which the outcome then updates. */
  loading: boolean
  /** Set once that loading toast closes: the outcome then leaves its id alone. */
  detached: boolean
}

// The promises waiting on each open toast, by Toaster and id. Closing the
// toast detaches them, so they never change a later toast with the same id.
const pending = new Map<string, Set<PromiseToast>>()

function detach(key: string) {
  for (let target of pending.get(key) ?? []) target.detached = true
  pending.delete(key)
}

/** Turns Sonner's message and options into Toast's options. */
function toToast(
  message: RemixNode,
  data: ExternalToast,
  type?: ToastTypes,
): ToastAddOptions<SonnerData> & { id: string } {
  let { id, toasterId, description, duration, important, ...sonner } = data
  let key = id === undefined ? `sonner-${++lastId}` : String(id)
  let snapshot = (): ToastT => ({ ...data, id: key, title: message, type })
  return {
    id: key,
    title: message,
    description,
    type: type === 'normal' || type === 'default' || type === 'action' ? undefined : type,
    timeout: duration,
    priority: important ? 'high' : 'low',
    data: { sonner },
    onClose: (reason) => {
      detach(keyOf(toasterId, key))
      ;(reason === 'timeout' ? data.onAutoClose : data.onDismiss)?.(snapshot())
    },
    // A toast leaves without closing when its Toaster unmounts. Its promises let go then too.
    onRemove: () => detach(keyOf(toasterId, key)),
  }
}

function show(message: RemixNode, data: ExternalToast = {}, type?: ToastTypes) {
  return managerFor(data.toasterId).add(toToast(message, data, type))
}

export type PromiseResult<Value> = RemixNode | ((value: Value) => RemixNode | Promise<RemixNode>)
export type PromiseExtendedResult<Value> =
  | (ExternalToast & { message: RemixNode })
  | ((value: Value) => (ExternalToast & { message: RemixNode }) | Promise<ExternalToast & { message: RemixNode }>)

export interface PromiseData<Value> extends Omit<ExternalToast, 'description'> {
  loading?: RemixNode
  success?: PromiseResult<Value> | PromiseExtendedResult<Value>
  error?: PromiseResult<unknown> | PromiseExtendedResult<unknown>
  description?: PromiseResult<Value>
  finally?: () => void | Promise<void>
}

const isExtended = (value: unknown): value is ExternalToast & { message: RemixNode } =>
  typeof value === 'object' && value !== null && 'message' in value

/** Drops the options an outcome leaves unset, so the promise's own options stay. */
function defined(options: ExternalToast): ExternalToast {
  return Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined))
}

async function settleResult<Value>(
  target: PromiseToast,
  type: 'success' | 'error',
  result: PromiseResult<Value> | PromiseExtendedResult<Value> | undefined,
  description: PromiseResult<Value> | undefined,
  value: Value,
) {
  let manager = managerFor(target.rest.toasterId)
  let resolved = typeof result === 'function' ? await result(value) : result
  let text = typeof description === 'function' ? await description(value) : description
  pending.get(keyOf(target.rest.toasterId, target.id))?.delete(target)
  // The loading toast closed while the promise ran: its id may belong to another toast now.
  if (target.loading && target.detached) return

  if (resolved === undefined) {
    // Without a message, a loading toast closes, and nothing else shows.
    if (target.loading) manager.close(target.id)
    return
  }
  let { message, ...outcome }: ExternalToast & { message: RemixNode } = isExtended(resolved)
    ? resolved
    : { message: resolved, description: text }
  let options = toToast(message, { ...target.rest, ...defined(outcome), id: target.id }, type)

  if (target.loading) {
    let { id, ...update } = options
    manager.update(id, update)
    return
  }
  // As in Sonner, a promise without a loading message shows only its outcome.
  try {
    manager.add(options)
  } catch (failure) {
    // The Toaster went away while the promise ran: unwrap() still settles as the promise did.
    reportError(failure)
  }
}

/**
 * Shows a loading toast while the promise runs, then the success or error
 * message, with the promise's options. A Response that isn't ok counts as an
 * error, as in Sonner. Once its loading toast closes, the outcome changes
 * nothing. Returns the toast's id and unwrap(), which settles as the promise did.
 */
function promise<Value>(input: Promise<Value> | (() => Promise<Value>), data: PromiseData<Value> = {}) {
  let { loading, success, error, description, finally: onFinally, ...rest } = data
  let running = typeof input === 'function' ? input() : input
  let id = rest.id === undefined ? `sonner-${++lastId}` : String(rest.id)
  let target: PromiseToast = { id, rest, loading: loading !== undefined, detached: false }
  if (loading !== undefined) {
    show(loading, { ...rest, id, description: typeof description === 'function' ? undefined : description }, 'loading')
    let key = keyOf(rest.toasterId, id)
    pending.set(key, (pending.get(key) ?? new Set()).add(target))
  }

  let outcome = running.then(
    async (value) => {
      if (typeof Response !== 'undefined' && value instanceof Response && !value.ok) {
        await settleResult(target, 'error', error, undefined, value as unknown)
      } else {
        await settleResult(target, 'success', success, description, value)
      }
      return value
    },
    async (reason: unknown) => {
      await settleResult(target, 'error', error, undefined, reason)
      throw reason
    },
  )
  let settled = outcome.finally(() => onFinally?.())
  // The toast shows the failure; unwrap() hands it to you.
  settled.catch(() => {})
  return { id, unwrap: () => settled }
}

/** Dismisses one toast, or every toast of every Toaster without an id. */
function dismiss(id?: string | number) {
  let key = id === undefined ? undefined : String(id)
  for (let manager of managers.values()) manager.close(key)
  return key
}

/**
 * Shows content you render, with the id, in a toast frame. Its text names the
 * toast and is announced, with the description, as for any toast.
 */
function custom(render: (id: string) => RemixNode, data: ExternalToast = {}) {
  let { description, ...rest } = data
  let options = toToast(undefined, rest)
  options.data = { sonner: { ...options.data?.sonner, custom: render, customDescription: description } }
  return managerFor(data.toasterId).add(options)
}

type Show = (message: RemixNode, data?: ExternalToast) => string

/**
 * Sonner's toast(): toast(message, data) shows a toast and returns its id.
 * Call it from browser code while a Toaster is on the page; without one, it
 * throws instead of keeping the toast for later.
 */
export const toast = Object.assign((message: RemixNode, data?: ExternalToast) => show(message, data), {
  message: ((message, data) => show(message, data)) as Show,
  success: ((message, data) => show(message, data, 'success')) as Show,
  info: ((message, data) => show(message, data, 'info')) as Show,
  warning: ((message, data) => show(message, data, 'warning')) as Show,
  error: ((message, data) => show(message, data, 'error')) as Show,
  loading: ((message, data) => show(message, data, 'loading')) as Show,
  custom,
  promise,
  dismiss,
})

const textColumnStyles = css({
  display: 'flex',
  flex: '1 1 7rem',
  minWidth: 0,
  flexDirection: 'column',
  gap: 'calc(var(--spacing) * 0.5)',
})
const buttonStyles = css({ flexShrink: 0 })
// Keeps the buttons together at the end, also when they wrap below the text.
const buttonsStyles = css({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  alignItems: 'center',
  maxWidth: '100%',
  gap: 'calc(var(--spacing) * 2)',
  marginInlineStart: 'auto',
})
const iconStyles = css({
  display: 'inline-flex',
  flexShrink: 0,
  '& svg': { width: '1rem', height: '1rem', pointerEvents: 'none' },
})

const hiddenStyles = css(visuallyHidden)

/**
 * Renders a custom toast's content as its title: the toast is named by it,
 * and its text is announced. A description stays for screen readers only, as
 * the content replaces the toast's own text. The toast gets its text and
 * description together, once the content has rendered, so it's announced once.
 */
function CustomContent(handle: Handle<{ render: (id: string) => RemixNode; description?: RemixNode }>) {
  let element: HTMLElement | undefined
  return () => {
    let { toast: item, store, titleId } = handle.context.get(Toast)
    let { render, description } = handle.props
    handle.queueTask(() => {
      let text = element?.textContent?.replace(/\s+/g, ' ').trim() || undefined
      if (text !== item.title || description !== item.description) {
        store.update(item.id, { title: text, description })
      }
    })
    return (
      <>
        <div id={titleId} data-slot="toast-custom" mix={ref((node) => (element = node))}>
          {render(item.id)}
        </div>
        <ToastDescription mix={hiddenStyles} />
      </>
    )
  }
}

function SonnerList(
  handle: Handle<{ closeButton: boolean; closeLabel: string; icons?: ToastIcons; swipe?: ToastSwipeDirection[] }>,
) {
  return () => {
    let store = handle.context.get(ToastProvider)
    let { closeButton, closeLabel, icons, swipe } = handle.props

    return store.toasts.map((item) => {
      let options = (item as ToastObject<SonnerData>).data?.sonner ?? {}
      let dismissible = options.dismissible !== false
      // As in Sonner: an action closes its toast unless onClick prevents it,
      // and a cancel button does nothing on a toast that isn't dismissible.
      let runAction = (event: MouseEvent) => {
        options.action?.onClick(event)
        if (!event.defaultPrevented) store.close(item.id)
      }
      let runCancel = (event: MouseEvent) => {
        if (!dismissible) return
        options.cancel?.onClick(event)
        store.close(item.id)
      }
      let icon = options.icon ?? (item.type ? icons?.[item.type as keyof ToastIcons] : undefined)

      return (
        <Toast key={item.id} toast={item} dismissible={dismissible} swipeDirection={swipe} data-sonner-toast="">
          {options.custom ? (
            <CustomContent render={options.custom} description={options.customDescription} />
          ) : (
            <ToastContent>
              {icon !== undefined ? (
                <span data-slot="toast-icon" aria-hidden="true" mix={iconStyles}>
                  {icon}
                </span>
              ) : (
                <ToastIcon type={item.type} />
              )}
              <div mix={textColumnStyles}>
                <ToastTitle />
                <ToastDescription />
              </div>
              <div mix={buttonsStyles}>
                {options.cancel ? (
                  <Button
                    size="xs"
                    variant="secondary"
                    data-slot="toast-cancel"
                    mix={[buttonStyles, on('click', (event) => runCancel(event))]}
                  >
                    {options.cancel.label}
                  </Button>
                ) : null}
                {options.action ? (
                  <Button
                    size="xs"
                    data-slot="toast-action"
                    mix={[buttonStyles, on('click', (event) => runAction(event))]}
                  >
                    {options.action.label}
                  </Button>
                ) : null}
                {(options.closeButton ?? closeButton) && dismissible ? (
                  <ToastClose aria-label={closeLabel}>{icons?.close}</ToastClose>
                ) : null}
              </div>
            </ToastContent>
          )}
        </Toast>
      )
    })
  }
}

/**
 * Sonner's Toaster as a client entry over RemixCN's Toast. Render it once, at
 * the end of <body>, and call toast() from browser code.
 */
export const Toaster = clientEntry(import.meta.url, function Toaster(handle: Handle<ToasterProps>) {
  return () => {
    let {
      id,
      position = 'bottom-right',
      expand,
      closeButton = false,
      duration = 4000,
      visibleToasts = 3,
      hotkey = ['altKey', 'KeyT'],
      containerAriaLabel = 'Notifications',
      theme = 'system',
      dir,
      swipeDirections,
      toastOptions = {},
      icons,
    } = handle.props

    return (
      <ToastProvider
        toastManager={managerFor(id) as ToastManager}
        timeout={toastOptions.duration ?? duration}
        limit={visibleToasts}
      >
        <ToastViewport
          position={positions[position]}
          label={containerAriaLabel}
          hotkey={hotkey}
          expanded={expand}
          dir={dir}
          data-theme={theme === 'system' ? undefined : theme}
          data-sonner-toaster=""
        >
          <SonnerList
            closeButton={toastOptions.closeButton ?? closeButton}
            closeLabel={toastOptions.closeButtonAriaLabel ?? 'Close toast'}
            icons={icons}
            swipe={swipeDirections?.map((direction) => swipes[direction])}
          />
        </ToastViewport>
      </ToastProvider>
    )
  }
})
