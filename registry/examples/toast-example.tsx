// RemixCN Toast examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { Button } from '#remixcn/ui/button.tsx'
import { ToastList, ToastProvider, ToastViewport, toast } from '#remixcn/ui/toast.tsx'
import type { ToastStore } from '#remixcn/ui/toast.tsx'

// Each example shows toasts in the page's <Toaster />, through the shared
// toast manager. Render <Toaster /> once, at the end of <body>.

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const rowStyles = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space(2) })

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

/** A title and a description, closed after five seconds. */
export const ToastBasic = clientEntry(import.meta.url, function ToastBasic() {
  return () => (
    <Button
      variant="outline"
      mix={on('click', () => {
        toast.add({ title: 'Invoice sent', description: 'INV-0042 to Acme Labs, due Friday 14 November.' })
      })}
    >
      Show toast
    </Button>
  )
})

const typeExamples = [
  { type: 'success', label: 'Success', title: 'Payment received', description: '€1,240.00 from Acme Labs.' },
  { type: 'info', label: 'Info', title: 'Reminder scheduled', description: 'It goes out on Monday at 9:00.' },
  { type: 'warning', label: 'Warning', title: 'Invoice overdue', description: 'INV-0038 is 12 days late.' },
  {
    type: 'error',
    label: 'Error',
    title: 'Export failed',
    description: 'The file was too large. Try a shorter range.',
  },
  { type: 'loading', label: 'Loading', title: 'Importing customers…', description: 'This takes a few seconds.' },
] as const

/** The type sets the icon. A loading toast stays until you update or close it. */
export const ToastTypes = clientEntry(import.meta.url, function ToastTypes() {
  return () => (
    <div mix={rowStyles}>
      {typeExamples.map(({ type, label, title, description }) => (
        <Button
          key={type}
          variant="outline"
          mix={on('click', () => {
            let id = toast.add({ type, title, description })
            // The import finishes after a while, as a real one would.
            if (type === 'loading') {
              void wait(3000).then(() =>
                toast.update(id, { type: 'success', title: 'Customers imported', description: '42 new customers.' }),
              )
            }
          })}
        >
          {label}
        </Button>
      ))}
    </div>
  )
})

/** An Undo action. It runs only when someone activates it, and closes the toast itself. */
export const ToastWithAction = clientEntry(import.meta.url, function ToastWithAction() {
  return () => (
    <Button
      variant="outline"
      mix={on('click', () => {
        let id = toast.add({
          title: 'Invoice archived',
          description: 'INV-0042 moved to the archive.',
          actionProps: {
            children: 'Undo',
            mix: [
              on('click', () => {
                toast.close(id)
                toast.add({ description: 'INV-0042 is back in your invoices.' })
              }),
            ],
          },
        })
      })}
    >
      Archive invoice
    </Button>
  )
})

/** One toast follows a task: loading while it runs, then success or error. */
export const ToastPromise = clientEntry(
  import.meta.url,
  function ToastPromise(handle: Handle<{ duration?: number; fail?: boolean }>) {
    return () => (
      <Button
        variant="outline"
        mix={on('click', () => {
          let { duration = 2000, fail = false } = handle.props
          let task = wait(duration).then(() => {
            if (fail) throw new Error('The mail server did not answer.')
            return { number: 'INV-0043' }
          })
          toast
            .promise(task, {
              loading: 'Sending invoice…',
              success: (invoice) => ({ title: `${invoice.number} sent`, description: 'Acme Labs has it now.' }),
              error: (error) => ({ title: 'Invoice not sent', description: (error as Error).message }),
            })
            // The toast already shows the failure.
            .catch(() => {})
        })}
      >
        Send invoice
      </Button>
    )
  },
)

/**
 * An urgent message that stays: high priority is announced at once, as an
 * alert, and timeout 0 keeps it until someone closes it or retries.
 */
export const ToastPersistent = clientEntry(import.meta.url, function ToastPersistent() {
  return () => (
    <Button
      variant="outline"
      mix={on('click', () => {
        let id = toast.add({
          type: 'error',
          priority: 'high',
          timeout: 0,
          title: 'Card declined',
          description: 'The payment for INV-0040 failed. Nothing was charged.',
          actionProps: { children: 'Retry', mix: [on('click', () => toast.close(id))] },
        })
      })}
    >
      Decline payment
    </Button>
  )
})

/** The same id updates one toast instead of stacking copies, and restarts its timer. */
export const ToastDeduplicated = clientEntry(import.meta.url, function ToastDeduplicated(handle: Handle) {
  let copies = 0
  return () => (
    <Button
      variant="outline"
      mix={on('click', () => {
        copies++
        toast.add({
          id: `${handle.id}-copied`,
          title: 'Payment link copied',
          description: `Copied ${copies === 1 ? 'once' : `${copies} times`}.`,
        })
      })}
    >
      Copy payment link
    </Button>
  )
})

/** Closes every open toast. */
export const ToastCloseAll = clientEntry(import.meta.url, function ToastCloseAll() {
  return () => (
    <Button variant="ghost" mix={on('click', () => toast.close())}>
      Dismiss all
    </Button>
  )
})

/**
 * A provider of its own, with a viewport at the bottom start: its toasts stay
 * apart from the page's Toaster. Its descendants reach it through context,
 * without a manager.
 */
export const ToastOwnProvider = clientEntry(import.meta.url, function ToastOwnProvider() {
  return () => (
    <ToastProvider timeout={4000}>
      <AddDraftSaved />
      <ToastViewport position="bottom-start" label="Editor notifications" hotkey={['altKey', 'KeyE']}>
        <ToastList />
      </ToastViewport>
    </ToastProvider>
  )
})

function AddDraftSaved(handle: Handle) {
  return () => (
    <Button
      variant="outline"
      mix={on('click', () => {
        let store = handle.context.get(ToastProvider) as ToastStore
        store.add({ type: 'success', title: 'Draft saved', description: 'Only this editor shows it.' })
      })}
    >
      Save draft
    </Button>
  )
}

/** In right-to-left text the viewport's start is on the right, and the parts mirror. */
export const ToastRightToLeft = clientEntry(import.meta.url, function ToastRightToLeft() {
  return () => (
    <div dir="rtl" lang="ar">
      <ToastProvider>
        <AddArabicToast />
        <ToastViewport position="top-start" label="الإشعارات" hotkey={['altKey', 'KeyR']}>
          <ToastList closeLabel="إغلاق" />
        </ToastViewport>
      </ToastProvider>
    </div>
  )
})

function AddArabicToast(handle: Handle) {
  return () => (
    <Button
      variant="outline"
      mix={on('click', () => {
        let store = handle.context.get(ToastProvider) as ToastStore
        store.add({
          type: 'success',
          title: 'تم إرسال الفاتورة',
          description: 'أُرسلت الفاتورة INV-0042 إلى Acme Labs.',
          actionProps: { children: 'تراجع', mix: [on('click', () => store.close())] },
        })
      })}
    >
      إظهار إشعار
    </Button>
  )
}
