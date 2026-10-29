// RemixCN Alert Dialog: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css, on, ref } from 'remix/component'
import type { Handle, Props } from 'remix/component'

import { getTabbableElements } from '#remixcn/lib/focus-scope.ts'
import { mergeStyles } from '#remixcn/lib/styles.ts'
import type { Styles } from '#remixcn/lib/styles.ts'
import { Button } from '#remixcn/ui/button.tsx'
import type { ButtonProps } from '#remixcn/ui/button.tsx'
import {
  centeredDialogStyles,
  descriptionLinkStyles,
  Dialog,
  DialogPopup,
  DialogTrigger,
  getDialogContext,
} from '#remixcn/ui/dialog.tsx'
import type { DialogPopupProps, DialogProps, DialogTriggerProps } from '#remixcn/ui/dialog.tsx'

// An Alert Dialog is a modal Dialog with the alertdialog role that waits for
// an answer: no press outside closes it, Escape cancels, and it has no corner
// close button. AlertDialogCancel closes it, natively too, and
// AlertDialogAction confirms, then closes it.

export interface AlertDialogProps extends Omit<DialogProps, 'modal' | 'role'> {
  /** Keeps the alert dialog open on presses outside it (defaults to `true`). */
  disablePointerDismissal?: boolean
}

/** Holds the open state of an alert dialog. It's always modal. */
export function AlertDialog(handle: Handle<AlertDialogProps>) {
  return () => {
    let { disablePointerDismissal = true, ...props } = handle.props
    return <Dialog {...props} role="alertdialog" modal disablePointerDismissal={disablePointerDismissal} />
  }
}

/** A native button that opens the alert dialog. Unstyled; give it a look with `buttonVariants()`. */
export function AlertDialogTrigger(handle: Handle<DialogTriggerProps>) {
  return () => <DialogTrigger data-slot="alert-dialog-trigger" {...handle.props} />
}

export type AlertDialogSize = 'default' | 'sm'

export interface AlertDialogContentProps extends DialogPopupProps {
  /** `sm` keeps it narrow at every width and puts the two actions side by side (defaults to `default`). */
  size?: AlertDialogSize
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const sm = '@media (min-width: 40rem)'
const md = '@media (min-width: 48rem)'
const inContent = (size: AlertDialogSize) => `:where([data-slot="alert-dialog-content"][data-size="${size}"])`
const hasMedia = ':has([data-slot="alert-dialog-media"])'

/** Nests styles under a selector or at-rule, which a computed key alone can't type. */
function under(selector: string, styles: Styles): Styles {
  let nested: Styles = {}
  nested[selector] = styles
  return nested
}

// shadcn's max-w-xs is 20rem, the whole width of a 320px screen, so it keeps a 1rem margin.
const contentRule = css(
  mergeStyles(centeredDialogStyles, {
    maxWidth: 'min(20rem, calc(100% - 2rem))',
    ...under(sm, { '&[data-size="default"]': { maxWidth: 'min(32rem, calc(100% - 2rem))' } }),
  }),
)

/**
 * The alert dialog itself, in the middle of the screen over a dimmed page.
 * Focus starts on AlertDialogCancel, the answer that changes nothing.
 */
export function AlertDialogContent(handle: Handle<AlertDialogContentProps>) {
  let element: HTMLDialogElement | null = null

  function cancelFirst() {
    if (!element) return null
    let cancel = element.querySelector<HTMLElement>('[data-slot="alert-dialog-cancel"]:not(:disabled)')
    return cancel ?? element.querySelector<HTMLElement>('[autofocus]') ?? getTabbableElements(element)[0] ?? null
  }

  return () => {
    let { size = 'default', initialFocus, mix, ...props } = handle.props

    return (
      <DialogPopup
        data-slot="alert-dialog-content"
        data-size={size}
        initialFocus={initialFocus ?? cancelFirst}
        {...props}
        mix={[contentRule, ref((node) => (element = node as HTMLDialogElement)), mix]}
      />
    )
  }
}

const headerRule = css({
  display: 'grid',
  gridTemplateRows: 'auto 1fr',
  placeItems: 'center',
  gap: space(1.5),
  textAlign: 'center',
  ...under(`&${hasMedia}`, { gridTemplateRows: 'auto auto 1fr', columnGap: space(6) }),
  ...under(
    sm,
    mergeStyles(
      under(`${inContent('default')} &`, { placeItems: 'start', textAlign: 'start' }),
      under(`${inContent('default')} &${hasMedia}`, { gridTemplateRows: 'auto 1fr' }),
    ),
  ),
})

/** Groups the media, title and description. Centered, and aligned to the start in a wide default alert dialog. */
export function AlertDialogHeader(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props
    return <div data-slot="alert-dialog-header" {...props} mix={[headerRule, mix]} />
  }
}

// A column on a narrow screen, with the first action at the bottom. A small
// alert dialog puts both actions side by side, and a row ends at the end from 40rem.
const footerRule = css({
  display: 'flex',
  flexDirection: 'column-reverse',
  gap: space(2),
  ...under(`${inContent('sm')} &`, { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }),
  ...under(sm, { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end' }),
})

/** Holds AlertDialogCancel and AlertDialogAction. */
export function AlertDialogFooter(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props
    return <div data-slot="alert-dialog-footer" {...props} mix={[footerRule, mix]} />
  }
}

const mediaRule = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: space(16),
  height: space(16),
  marginBottom: space(2),
  borderRadius: 'var(--radius-md)',
  backgroundColor: 'var(--muted)',
  '& svg': { width: space(8), height: space(8) },
  ...under(sm, under(`${inContent('default')} &`, { gridRow: 'span 2' })),
})

/** An icon or image above the title, or beside it in a wide default alert dialog. */
export function AlertDialogMedia(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props
    return <div data-slot="alert-dialog-media" {...props} mix={[mediaRule, mix]} />
  }
}

const titleRule = css({
  margin: 0,
  fontSize: 'var(--text-lg)',
  lineHeight: 'var(--text-lg--line-height)',
  fontWeight: 500,
  ...under(
    sm,
    under(`:where([data-slot="alert-dialog-content"][data-size="default"]${hasMedia}) &`, { gridColumnStart: '2' }),
  ),
})

/** The alert dialog's name: an <h2> the dialog points to with aria-labelledby. */
export function AlertDialogTitle(handle: Handle<Omit<Props<'h2'>, 'id'>>) {
  return () => {
    let dialog = getDialogContext(handle, 'AlertDialogTitle')
    let { mix, ...props } = handle.props
    return <h2 data-slot="alert-dialog-title" {...props} id={dialog.ids.title} mix={[titleRule, mix]} />
  }
}

const descriptionRule = css(
  mergeStyles(
    {
      margin: 0,
      color: 'var(--muted-foreground)',
      fontSize: 'var(--text-sm)',
      lineHeight: 'var(--text-sm--line-height)',
      textWrap: 'balance',
      ...under(md, { textWrap: 'pretty' }),
    },
    descriptionLinkStyles,
  ),
)

/** What the answer means: a paragraph the dialog points to with aria-describedby. */
export function AlertDialogDescription(handle: Handle<Omit<Props<'p'>, 'id'>>) {
  return () => {
    let dialog = getDialogContext(handle, 'AlertDialogDescription')
    let { mix, ...props } = handle.props
    return (
      <p data-slot="alert-dialog-description" {...props} id={dialog.ids.description} mix={[descriptionRule, mix]} />
    )
  }
}

/**
 * A Button that confirms: your click handlers run first, then the alert
 * dialog closes with the reason `action-press`. Call `preventDefault()` in
 * your handler to keep it open while the confirmation runs, and close it
 * from your owner. As a submit button, it posts its form when pressed.
 * Nothing else presses it: neither a key held down before the action had
 * focus, such as the Enter that opened the dialog, nor Enter in a field of
 * its form, also before any script runs.
 */
export function AlertDialogAction(handle: Handle<ButtonProps>) {
  // Whether the key that is down was pressed on this button.
  let pressedHere = false

  return () => {
    let dialog = getDialogContext(handle, 'AlertDialogAction')
    let { mix, ...props } = handle.props
    let action = (
      <Button
        data-slot="alert-dialog-action"
        {...props}
        mix={[
          on('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            if (!event.repeat) pressedHere = true
            else if (!pressedHere) event.preventDefault()
          }),
          on('keyup', () => void (pressedHere = false)),
          on('blur', () => void (pressedHere = false)),
          mix,
          on('click', (event) => {
            if (event.defaultPrevented) return
            dialog.setOpen(false, { reason: 'action-press', event })
          }),
        ]}
      />
    )
    if (props.type !== 'submit') return action

    // Enter in a field of a form presses the form's default button, its
    // first submit button, which would confirm. A disabled submit button
    // right before the action becomes the default button instead, and the
    // HTML standard has a disabled default button submit nothing. So it
    // holds in the server's HTML too, before any script runs.
    return (
      <>
        <button type="submit" disabled hidden form={props.form} data-slot="alert-dialog-enter-guard" />
        {action}
      </>
    )
  }
}

/**
 * A Button that cancels: it closes the alert dialog with the reason
 * `close-press`, natively too before any script runs. Outline by default.
 */
export function AlertDialogCancel(handle: Handle<Omit<ButtonProps, 'type' | 'command' | 'commandfor' | 'commandFor'>>) {
  return () => {
    let dialog = getDialogContext(handle, 'AlertDialogCancel')
    let { variant = 'outline', mix, ...props } = handle.props

    return (
      <Button
        data-slot="alert-dialog-cancel"
        variant={variant}
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
