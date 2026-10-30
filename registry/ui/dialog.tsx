// RemixCN Dialog: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { createMixin, css, on, ref } from 'remix/component'
import type { Handle, MixinFactory, Props, RemixNode } from 'remix/component'

import { focusScope, getTabbableElements } from '#remixcn/lib/focus-scope.ts'
import type { FocusScopeOptions } from '#remixcn/lib/focus-scope.ts'
import { XIcon } from '#remixcn/lib/icons.tsx'
import { dismissableLayer, getOpenLayers } from '#remixcn/lib/layer.ts'
import { modal as modalBehavior } from '#remixcn/lib/modal.ts'
import { mergeStyles, transition, visuallyHidden } from '#remixcn/lib/styles.ts'
import type { Styles } from '#remixcn/lib/styles.ts'
import { buttonVariants } from '#remixcn/ui/button.tsx'

// The dialog is a native <dialog>. showModal() puts it in the browser's top
// layer, above every stacking context, so it needs no portal. It makes the
// rest of the page inert and keeps Tab inside, and its ::backdrop is the
// overlay. The shared helpers add what the element lacks: one Escape and
// outside press for the topmost layer (layer.ts), initial and return focus
// with a fallback (focus-scope.ts), and the scroll lock (modal.ts).
//
// The server renders a closed <dialog>, which takes no space, no tab stop
// and no place in the accessibility tree. Its trigger and close buttons
// carry invoker commands (commandfor and command), so in browsers that
// support them the dialog opens and closes before any script runs. Once the
// dialog runs in the browser, inside your client entry, its open state comes
// from the Dialog root, and the native commands step aside.

/** Why the dialog opens or closes, as Base UI names it, plus the native close paths. */
export type DialogChangeReason =
  | 'trigger-press'
  | 'close-press'
  | 'action-press'
  | 'outside-press'
  | 'escape-key'
  | 'close-request'
  | 'focus-out'
  | 'parent-dismissed'
  | 'swipe'
  | 'none'

export interface DialogChangeDetails {
  reason: DialogChangeReason
  /** The event that asked for the change, if any. */
  event?: Event
  /** The trigger that opened the dialog, if a trigger did. */
  trigger?: HTMLElement
  /** Keeps the current state: a dialog that would close stays open, and the other way round. */
  cancel(): void
  readonly isCanceled: boolean
}

export interface DialogProps {
  /** Whether the dialog is open, for a dialog you control. Render the new value from onOpenChange. */
  open?: boolean
  /** Whether the dialog starts open, for a dialog that keeps its own state (defaults to `false`). */
  defaultOpen?: boolean
  /** Called before the dialog opens or closes. Call `details.cancel()` to keep the current state. */
  onOpenChange?: (open: boolean, details: DialogChangeDetails) => void
  /** Called once the dialog finished opening or closing, after its transitions. */
  onOpenChangeComplete?: (open: boolean) => void
  /**
   * Whether the rest of the page is inert while the dialog is open, with Tab
   * kept inside and page scrolling stopped (defaults to `true`). A dialog that
   * isn't modal lets the page work beside it, and closes when focus leaves it.
   */
  modal?: boolean
  /** Keeps the dialog open on presses outside it, and, when it isn't modal, when focus leaves it. */
  disablePointerDismissal?: boolean
  /** The dialog's role. Alert Dialog sets `alertdialog`. */
  role?: 'dialog' | 'alertdialog'
  children?: RemixNode
}

type FocusTarget = FocusScopeOptions['initialFocus']

export interface DialogChangeRequest {
  reason: DialogChangeReason
  event?: Event
  /** The trigger that opens the dialog. Focus returns to it when the dialog closes. */
  trigger?: HTMLElement
  /** The pointer that pressed the trigger, such as `touch`. */
  pointerType?: string
}

/** What the Dialog root shares with its parts, and with parts you build on it. */
export interface DialogContext {
  readonly open: boolean
  readonly modal: boolean
  readonly role: 'dialog' | 'alertdialog'
  /** Whether presses outside, and focus leaving a dialog that isn't modal, close it. */
  readonly pointerDismissal: boolean
  /** Whether the dialog sits inside another dialog. */
  readonly nested: boolean
  /** The ids of the native dialog, its title and its description. */
  readonly ids: { readonly popup: string; readonly title: string; readonly description: string }
  /** The trigger that opened the dialog last, if it's still there. */
  readonly trigger: HTMLElement | null
  /** Whether the last opening came from a touch, so focus shouldn't open a virtual keyboard. */
  readonly openedByTouch: boolean
  /** Asks the root to open or close the dialog. Returns `false` when `onOpenChange` canceled the change. */
  setOpen(open: boolean, request: DialogChangeRequest): boolean
  /** Tells the root that the dialog finished opening or closing. */
  complete(open: boolean): void
}

/** The context of the nearest Dialog. Throws when `part` sits outside one. */
export function getDialogContext(handle: Handle<any, any>, part: string): DialogContext {
  let context = handle.context.get(Dialog) as DialogContext | undefined
  if (!context) throw new Error(`${part} must sit inside Dialog, Alert Dialog, Sheet or Drawer`)
  return context
}

/**
 * Holds the open state of a dialog and shares it with its trigger, content
 * and close buttons. It renders no element of its own. Without `open`, it
 * keeps its own state, starting from `defaultOpen`.
 */
export function Dialog(handle: Handle<DialogProps, DialogContext>) {
  let uncontrolledOpen = handle.props.defaultOpen ?? false
  let trigger: HTMLElement | null = null
  let openedByTouch = false
  let nested = handle.context.get(Dialog) !== undefined
  let ids = { popup: `${handle.id}-dialog`, title: `${handle.id}-title`, description: `${handle.id}-description` }

  function isOpen() {
    return handle.props.open ?? uncontrolledOpen
  }

  function setOpen(open: boolean, { reason, event, pointerType, ...request }: DialogChangeRequest) {
    if (open === isOpen()) return true

    let canceled = false
    let details: DialogChangeDetails = {
      reason,
      event,
      trigger: request.trigger ?? trigger ?? undefined,
      cancel: () => void (canceled = true),
      get isCanceled() {
        return canceled
      },
    }
    handle.props.onOpenChange?.(open, details)
    if (canceled) return false

    if (open) {
      trigger = request.trigger ?? null
      openedByTouch = pointerType === 'touch'
    }
    if (handle.props.open === undefined) uncontrolledOpen = open
    void handle.update()
    return true
  }

  return () => {
    let { modal = true, disablePointerDismissal = false, role = 'dialog' } = handle.props

    handle.context.set({
      open: isOpen(),
      modal,
      role,
      pointerDismissal: !disablePointerDismissal,
      nested,
      ids,
      trigger: trigger?.isConnected ? trigger : null,
      openedByTouch,
      setOpen,
      complete: (open) => handle.props.onOpenChangeComplete?.(open),
    })

    return handle.props.children
  }
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`

export interface DialogTriggerProps extends Omit<Props<'button'>, 'type' | 'command' | 'commandfor' | 'commandFor'> {}

/**
 * A native button that opens the dialog, as many as you need. It renders
 * unstyled, like Base UI's trigger: give it a button's look with
 * `mix={buttonVariants({ variant: 'outline' })}`.
 */
export function DialogTrigger(handle: Handle<DialogTriggerProps>) {
  let pointerType = ''

  return () => {
    let dialog = getDialogContext(handle, 'DialogTrigger')
    let { mix, ...props } = handle.props

    return (
      <button
        data-slot="dialog-trigger"
        aria-haspopup="dialog"
        aria-expanded={dialog.open ? 'true' : 'false'}
        aria-controls={dialog.ids.popup}
        data-popup-open={dialog.open ? '' : undefined}
        data-disabled={props.disabled ? '' : undefined}
        {...props}
        type="button"
        commandfor={dialog.ids.popup}
        command="show-modal"
        mix={[
          mix,
          on('pointerdown', (event) => void (pointerType = event.pointerType)),
          on('click', (event) => {
            // The caller may cancel the opening. Either way the native command stays out of it.
            if (event.defaultPrevented) return
            event.preventDefault()
            let opening = !dialog.open
            // A click from the keyboard has no pointer.
            let pointer = event.detail > 0 ? pointerType : ''
            pointerType = ''
            // A dialog that isn't modal leaves its trigger reachable, so the trigger toggles it.
            if (!opening && dialog.modal) return
            // Safari doesn't focus a button on click. Focus it, so the native dialog returns focus to it.
            if (opening) event.currentTarget.focus({ preventScroll: true })
            dialog.setOpen(opening, {
              reason: 'trigger-press',
              event,
              trigger: event.currentTarget,
              pointerType: pointer,
            })
          }),
        ]}
      />
    )
  }
}

export interface DialogCloseProps extends Omit<Props<'button'>, 'type' | 'command' | 'commandfor' | 'commandFor'> {}

/** A native button that closes the dialog. Unstyled; give it a look with `buttonVariants()`. */
export function DialogClose(handle: Handle<DialogCloseProps>) {
  return () => {
    let dialog = getDialogContext(handle, 'DialogClose')
    let { mix, ...props } = handle.props

    return (
      <button
        data-slot="dialog-close"
        data-disabled={props.disabled ? '' : undefined}
        {...props}
        type="button"
        commandfor={dialog.ids.popup}
        command="close"
        mix={[
          mix,
          on('click', (event) => {
            if (event.defaultPrevented) return
            event.preventDefault()
            dialog.setOpen(false, { reason: 'close-press', event })
          }),
        ]}
      />
    )
  }
}

interface NativeDialogOptions {
  open: boolean
  modal: boolean
  /** Called when the dialog closed without the root asking, such as a form with method="dialog". */
  onNativeClose: (event: Event) => void
  /** Called once the transitions of an opening or closing finished. */
  onSettled: (open: boolean) => void
}

// Dialogs that are closing and opening again to switch between modal and
// not. Closing moves focus out, which isn't the user leaving the dialog.
const switching = new WeakSet<HTMLDialogElement>()

/**
 * Opens and closes the native dialog to match `open`: showModal() for a
 * modal dialog, show() for one that isn't. A dialog the server rendered with
 * the open attribute becomes modal here. Switching an open dialog between
 * modal and not keeps focus where it was.
 */
const nativeDialog: MixinFactory<HTMLDialogElement, [options: NativeDialogOptions]> = createMixin<
  HTMLDialogElement,
  [options: NativeDialogOptions]
>(
  (handle) => {
    let host: HTMLDialogElement | null = null
    let options: NativeDialogOptions
    let settled: boolean | undefined
    let generation = 0

    function settle(open: boolean) {
      let current = ++generation
      let animations = host?.getAnimations({ subtree: true }) ?? []
      void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
        if (current !== generation || settled === open) return
        settled = open
        options.onSettled(open)
      })
    }

    function sync() {
      if (!host?.isConnected) return
      let { open, modal } = options

      if (open) {
        if (host.open && host.matches(':modal') === modal) return
        // Switching between modal and not, or the open attribute from the server.
        let active = host.ownerDocument.activeElement
        let focused = host.open && active instanceof HTMLElement && host.contains(active) ? active : null
        switching.add(host)
        try {
          if (host.open) host.close()
          if (modal) host.showModal()
          else host.show()
          focused?.focus({ preventScroll: true })
        } finally {
          switching.delete(host)
        }
        settle(true)
      } else if (host.open) {
        host.close()
        settle(false)
      }
    }

    handle.addEventListener('insert', (event) => {
      host = event.node
      settled = host.open
      host.addEventListener(
        'close',
        (event) => {
          // Our own close() fires this later; by then the dialog is closed in our state, or open again.
          if (host?.open || !options.open) return
          options.onNativeClose(event)
        },
        { signal: handle.signal },
      )
      sync()
    })

    handle.addEventListener('remove', () => {
      host = null
      generation++
    })

    return (nextOptions) => {
      options = nextOptions
      if (host) handle.queueTask(sync)
      return handle.element
    }
  },
  { ssr: false },
)

/** Whether `target` sits in an open layer that `dialog` owns, such as a popover inside it. */
function isInChildLayer(dialog: HTMLElement, target: Element) {
  return getOpenLayers(dialog.ownerDocument).some((layer) => {
    for (let parent = layer.parent; parent; parent = parent.parent) {
      if (parent.element === dialog) return layer.element.contains(target)
    }
    return false
  })
}

/**
 * Only the server writes the open attribute, so a dialog that starts open
 * reads without a script. In the browser, showModal() owns it, and the prop
 * must be absent: Remix removes an attribute whose prop is undefined on every
 * render, which would close the dialog.
 */
function serverOpen(open: boolean): { open?: true } {
  return typeof document === 'undefined' && open ? { open: true } : {}
}

export interface DialogPopupProps extends Omit<Props<'dialog'>, 'open' | 'id' | 'role'> {
  /**
   * What to focus when the dialog opens, or `false` to leave focus alone. By
   * default, the first `[autofocus]` or tabbable element inside, and the
   * dialog itself when it opened from a touch, so no virtual keyboard opens.
   */
  initialFocus?: FocusTarget
  /** What to focus when the dialog closes, or `false` to leave focus alone (defaults to the trigger that opened it, else its first trigger, else a neighbor). */
  finalFocus?: FocusScopeOptions['returnFocus']
}

/**
 * The unstyled native <dialog> that DialogContent, AlertDialogContent and
 * SheetContent style. Use it for a surface of your own: it brings the
 * dialog's open state, ids, dismissal, focus and modal behavior.
 */
export function DialogPopup(handle: Handle<DialogPopupProps>) {
  let dialog = getDialogContext(handle, 'DialogPopup')
  let element: HTMLDialogElement | null = null

  // The trigger that opened the dialog, else the first one that names it, such as for a dialog that starts open.
  function defaultFinalFocus() {
    return (
      dialog.trigger ??
      element?.ownerDocument.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(dialog.ids.popup)}"]`) ??
      null
    )
  }

  function defaultInitialFocus() {
    if (!element) return null
    if (dialog.openedByTouch) return element
    let autofocus = element.querySelector<HTMLElement>('[autofocus]')
    return autofocus ?? getTabbableElements(element)[0] ?? null
  }

  return () => {
    dialog = getDialogContext(handle, 'DialogPopup')
    let { initialFocus, finalFocus, mix, children, ...props } = handle.props
    let { open, modal, ids } = dialog
    let named = props['aria-label'] !== undefined || props['aria-labelledby'] !== undefined

    return (
      <dialog
        data-slot="dialog-popup"
        id={ids.popup}
        role={dialog.role === 'alertdialog' ? 'alertdialog' : undefined}
        aria-labelledby={named ? undefined : ids.title}
        aria-describedby={ids.description}
        data-open={open ? '' : undefined}
        data-closed={open ? undefined : ''}
        data-nested={dialog.nested ? '' : undefined}
        {...serverOpen(open)}
        {...props}
        mix={[
          nativeDialog({
            open,
            modal,
            onNativeClose: (event) => {
              dialog.setOpen(false, { reason: 'none', event })
              // A controlled owner may keep it open: render again, so the native dialog follows.
              void handle.update()
            },
            onSettled: (settledOpen) => dialog.complete(settledOpen),
          }),
          ref((node) => (element = node)),
          mix,
          on('focusout', (event) => {
            let target = event.relatedTarget
            let host = event.currentTarget
            if (dialog.modal || !dialog.open || !dialog.pointerDismissal || !(target instanceof Element)) return
            if (switching.has(host)) return
            if (host.contains(target) || dialog.trigger?.contains(target) || isInChildLayer(host, target)) return
            dialog.setOpen(false, { reason: 'focus-out', event })
          }),
          dismissableLayer({
            open,
            modal,
            trigger: () => dialog.trigger,
            dismissOnOutsidePress: dialog.pointerDismissal,
            onDismiss: ({ reason, event }) => dialog.setOpen(false, { reason, event }),
          }),
          focusScope({
            open,
            trapFocus: modal,
            initialFocus: initialFocus ?? defaultInitialFocus,
            returnFocus: finalFocus ?? defaultFinalFocus,
          }),
          modalBehavior({ open: open && modal }),
        ]}
      >
        {children}
      </dialog>
    )
  }
}

/**
 * The overlay, which shadcn renders as DialogOverlay: a modal dialog's native
 * ::backdrop, which covers the page right below the dialog in the top layer.
 * A dialog inside another one draws none, so the page dims once. Merge it
 * into a surface's own style, as DialogContent does.
 */
export const dialogOverlayStyles: Styles = {
  '&::backdrop': mergeStyles(transition('opacity', 'display', 'overlay'), {
    transitionBehavior: 'allow-discrete',
    opacity: 0,
    backgroundColor: 'oklch(0 0 0 / 10%)',
    backdropFilter: 'blur(4px)',
  }),
  '&[open]::backdrop': { opacity: 1 },
  '&[data-nested]::backdrop': { backgroundColor: 'transparent', backdropFilter: 'none' },
  '@starting-style': { '&[open]::backdrop': { opacity: 0 } },
}

/**
 * What every dialog surface shares: the overlay, hidden until open, a fade in
 * and out that reduced motion turns off, no presses while it fades out, and
 * no ring on the surface itself, which takes focus only when nothing inside
 * can. A dialog that isn't modal sits in the page, so it stacks above it.
 * Each surface adds its own movement and lists it in its transition.
 */
export const dialogSurfaceStyles: Styles = mergeStyles(dialogOverlayStyles, {
  transitionBehavior: 'allow-discrete',
  zIndex: 50,
  opacity: 0,
  '&[open]': { opacity: 1 },
  '&:not([open])': { pointerEvents: 'none' },
  '&:focus-visible': { outline: 'none' },
  '@starting-style': { '&[open]': { opacity: 0 } },
})

/**
 * A dialog surface in the middle of the screen, as Dialog and Alert Dialog
 * draw it. shadcn's ring-1 ring-foreground/10 is a border here, so forced
 * colors keeps the edge. Content taller than the screen scrolls inside, so
 * text at 200% still reaches every part.
 */
export const centeredDialogStyles: Styles = mergeStyles(
  dialogSurfaceStyles,
  transition('opacity', 'scale', 'display', 'overlay'),
  {
    scale: '0.95',
    '@starting-style': { '&[open]': { scale: '0.95' } },
    position: 'fixed',
    inset: 0,
    margin: 'auto',
    width: '100%',
    maxWidth: 'calc(100% - 2rem)',
    height: 'fit-content',
    maxHeight: 'calc(100% - 2rem)',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    padding: space(6),
    border: '1px solid color-mix(in oklab, var(--foreground) 10%, transparent)',
    borderRadius: 'var(--radius-xl)',
    backgroundColor: 'var(--popover)',
    color: 'var(--popover-foreground)',
    '&[open]': { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(6), scale: '1' },
  },
)

const contentRule = css(
  mergeStyles(centeredDialogStyles, {
    fontSize: 'var(--text-sm)',
    lineHeight: 'var(--text-sm--line-height)',
    '@media (min-width: 40rem)': { maxWidth: '28rem' },
  }),
)

const cornerCloseRule = css({ position: 'absolute', insetBlockStart: space(4), insetInlineEnd: space(4) })
const hiddenTextRule = css(visuallyHidden)

/** The close button in the corner of DialogContent. Its name is "Close". */
function CornerClose(handle: Handle<{ slot: string }>) {
  return () => (
    <DialogClose
      data-slot={handle.props.slot}
      mix={[buttonVariants({ variant: 'ghost', size: 'icon-sm' }), cornerCloseRule]}
    >
      <XIcon />
      <span mix={hiddenTextRule}>Close</span>
    </DialogClose>
  )
}

export interface DialogContentProps extends DialogPopupProps {
  /** Shows a close button in the corner, named "Close" (defaults to `true`). */
  showCloseButton?: boolean
}

/**
 * The dialog itself: a native <dialog> in the middle of the screen, over a
 * dimmed page. Put DialogHeader with DialogTitle and DialogDescription in
 * it, so the dialog has a name and a description.
 */
export function DialogContent(handle: Handle<DialogContentProps>) {
  return () => {
    let { showCloseButton = true, mix, children, ...props } = handle.props

    return (
      <DialogPopup
        data-slot="dialog-content"
        data-close-button={showCloseButton ? '' : undefined}
        {...props}
        mix={[contentRule, mix]}
      >
        {children}
        {showCloseButton ? <CornerClose slot="dialog-close" /> : null}
      </DialogPopup>
    )
  }
}

// The corner close button sits over the header's end, so a long title wraps before it.
const headerRule = css({
  display: 'flex',
  flexDirection: 'column',
  gap: space(2),
  ':where([data-close-button]) > &': { paddingInlineEnd: space(6) },
})

/** Groups the title and description at the top of the dialog. */
export function DialogHeader(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props
    return <div data-slot="dialog-header" {...props} mix={[headerRule, mix]} />
  }
}

// A column on a narrow screen, with the first action at the bottom, and a row at the end from 40rem.
const footerRule = css({
  display: 'flex',
  flexDirection: 'column-reverse',
  gap: space(2),
  '@media (min-width: 40rem)': { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end' },
})

export interface DialogFooterProps extends Props<'div'> {
  /** Adds an outline Close button after the footer's own actions (defaults to `false`). */
  showCloseButton?: boolean
}

/** Holds the dialog's actions at the bottom. */
export function DialogFooter(handle: Handle<DialogFooterProps>) {
  return () => {
    let { showCloseButton = false, mix, children, ...props } = handle.props

    return (
      <div data-slot="dialog-footer" {...props} mix={[footerRule, mix]}>
        {children}
        {showCloseButton ? <DialogClose mix={buttonVariants({ variant: 'outline' })}>Close</DialogClose> : null}
      </div>
    )
  }
}

const titleRule = css({ margin: 0, fontSize: 'inherit', lineHeight: 1, fontWeight: 500 })

/** The dialog's name: an <h2> the dialog points to with aria-labelledby. */
export function DialogTitle(handle: Handle<Omit<Props<'h2'>, 'id'>>) {
  return () => {
    let dialog = getDialogContext(handle, 'DialogTitle')
    let { mix, ...props } = handle.props
    return <h2 data-slot="dialog-title" {...props} id={dialog.ids.title} mix={[titleRule, mix]} />
  }
}

/** The links in a description underline, and turn to the text color on hover. */
export const descriptionLinkStyles: Styles = {
  '& > a': { color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '3px' },
  '& > a:hover': { color: 'var(--foreground)' },
}

const descriptionRule = css(
  mergeStyles(
    {
      margin: 0,
      color: 'var(--muted-foreground)',
      fontSize: 'var(--text-sm)',
      lineHeight: 'var(--text-sm--line-height)',
    },
    descriptionLinkStyles,
  ),
)

/** The dialog's description: a paragraph the dialog points to with aria-describedby. */
export function DialogDescription(handle: Handle<Omit<Props<'p'>, 'id'>>) {
  return () => {
    let dialog = getDialogContext(handle, 'DialogDescription')
    let { mix, ...props } = handle.props
    return <p data-slot="dialog-description" {...props} id={dialog.ids.description} mix={[descriptionRule, mix]} />
  }
}
