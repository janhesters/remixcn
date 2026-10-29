// RemixCN Sheet: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css } from 'remix/component'
import type { Handle, Props } from 'remix/component'

import { XIcon } from '#remixcn/lib/icons.tsx'
import { mergeStyles, visuallyHidden } from '#remixcn/lib/styles.ts'
import type { Styles } from '#remixcn/lib/styles.ts'
import { buttonVariants } from '#remixcn/ui/button.tsx'
import {
  Dialog,
  DialogClose,
  DialogPopup,
  DialogTrigger,
  dialogSurfaceStyles,
  getDialogContext,
} from '#remixcn/ui/dialog.tsx'
import type { DialogCloseProps, DialogPopupProps, DialogProps, DialogTriggerProps } from '#remixcn/ui/dialog.tsx'

// A Sheet is a Dialog that slides in from an edge of the screen, for content
// that complements the page, such as filters or details. Everything a Dialog
// does, it does: modal or not, controlled or not, nested, with the same
// focus, Escape and outside-press rules.

export interface SheetProps extends Omit<DialogProps, 'role'> {}

/** Holds the open state of a sheet. It renders no element of its own. */
export function Sheet(handle: Handle<SheetProps>) {
  return () => <Dialog {...handle.props} />
}

/** A native button that opens the sheet. Unstyled; give it a look with `buttonVariants()`. */
export function SheetTrigger(handle: Handle<DialogTriggerProps>) {
  return () => <DialogTrigger data-slot="sheet-trigger" {...handle.props} />
}

/** A native button that closes the sheet. Unstyled; give it a look with `buttonVariants()`. */
export function SheetClose(handle: Handle<DialogCloseProps>) {
  return () => <DialogClose data-slot="sheet-close" {...handle.props} />
}

export type SheetSide = 'top' | 'right' | 'bottom' | 'left'

export interface SheetContentProps extends DialogPopupProps {
  /** The edge the sheet slides in from (defaults to `right`). Physical, so `right` stays right in right-to-left text. */
  side?: SheetSide
  /** Shows a close button in the corner, named "Close" (defaults to `true`). */
  showCloseButton?: boolean
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const border = '1px solid var(--border)'

// The panel scrolls when its content is taller than the screen. A scroll
// region of your own inside it, as in the examples, keeps the header and
// footer in place instead.
const panel: Styles = mergeStyles(dialogSurfaceStyles, {
  transitionProperty: 'opacity, translate, display, overlay',
  transitionDuration: 'var(--duration-normal)',
  transitionTimingFunction: 'var(--ease-in-out)',
  position: 'fixed',
  margin: 0,
  padding: 0,
  border: 0,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  backgroundColor: 'var(--popover)',
  backgroundClip: 'padding-box',
  color: 'var(--popover-foreground)',
  boxShadow: 'var(--shadow-lg)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  '&[open]': { display: 'flex', flexDirection: 'column', gap: space(4), translate: 'none' },
})

const sideStyles: Record<SheetSide, Styles> = {
  top: {
    inset: '0 0 auto 0',
    width: '100%',
    maxWidth: '100%',
    height: 'auto',
    maxHeight: '100%',
    borderBottom: border,
  },
  right: {
    inset: '0 0 0 auto',
    width: '75%',
    maxWidth: '100%',
    height: '100%',
    maxHeight: '100%',
    borderLeft: border,
    '@media (min-width: 40rem)': { maxWidth: '24rem' },
  },
  bottom: {
    inset: 'auto 0 0 0',
    width: '100%',
    maxWidth: '100%',
    height: 'auto',
    maxHeight: '100%',
    borderTop: border,
  },
  left: {
    inset: '0 auto 0 0',
    width: '75%',
    maxWidth: '100%',
    height: '100%',
    maxHeight: '100%',
    borderRight: border,
    '@media (min-width: 40rem)': { maxWidth: '24rem' },
  },
}

// Where each side starts and ends its slide: 2.5rem past its edge.
const offsets: Record<SheetSide, string> = {
  top: '0 -2.5rem',
  right: '2.5rem 0',
  bottom: '0 2.5rem',
  left: '-2.5rem 0',
}

// One css() rule per side, so the side's position and slide merge with the panel.
const contentRules = Object.fromEntries(
  (Object.keys(sideStyles) as SheetSide[]).map((side) => [
    side,
    css(
      mergeStyles(panel, sideStyles[side], {
        translate: offsets[side],
        '@starting-style': { '&[open]': { translate: offsets[side] } },
      }),
    ),
  ]),
) as Record<SheetSide, ReturnType<typeof css>>

// The close button comes last, so Tab reaches it after the content, but it
// shows first in the panel's column and sticks to the top corner while the
// panel scrolls, on the panel's own background, so text doesn't show through.
// Its negative margin takes back the room it would push the header down by:
// its own height, its top margin and the panel's gap.
const closeRule = css({
  backgroundColor: 'var(--popover)',
  '&:hover': { backgroundColor: 'light-dark(var(--muted), color-mix(in oklab, var(--muted) 50%, var(--popover)))' },
  order: -1,
  position: 'sticky',
  insetBlockStart: space(4),
  zIndex: 1,
  flexShrink: 0,
  alignSelf: 'flex-end',
  marginBlockStart: space(4),
  marginBlockEnd: space(-16),
  marginInlineEnd: space(4),
})
const hiddenTextRule = css(visuallyHidden)

/**
 * The sheet itself: a native <dialog> along one edge of the screen, over a
 * dimmed page. Put SheetHeader with SheetTitle and SheetDescription in it,
 * so the sheet has a name and a description.
 */
export function SheetContent(handle: Handle<SheetContentProps>) {
  return () => {
    let { side = 'right', showCloseButton = true, mix, children, ...props } = handle.props

    return (
      <DialogPopup
        data-slot="sheet-content"
        data-side={side}
        data-close-button={showCloseButton ? '' : undefined}
        {...props}
        mix={[contentRules[side], mix]}
      >
        {children}
        {showCloseButton ? (
          <DialogClose data-slot="sheet-close" mix={[buttonVariants({ variant: 'ghost', size: 'icon-sm' }), closeRule]}>
            <XIcon />
            <span mix={hiddenTextRule}>Close</span>
          </DialogClose>
        ) : null}
      </DialogPopup>
    )
  }
}

// The close button sits over the header's end, so a long title wraps before it.
const headerRule = css({
  display: 'flex',
  flexDirection: 'column',
  gap: space(1.5),
  padding: space(4),
  ':where([data-close-button]) > &': { paddingInlineEnd: space(12) },
})

/** Groups the title and description at the top of the sheet. */
export function SheetHeader(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props
    return <div data-slot="sheet-header" {...props} mix={[headerRule, mix]} />
  }
}

const footerRule = css({
  display: 'flex',
  flexDirection: 'column',
  gap: space(2),
  marginTop: 'auto',
  padding: space(4),
})

/** Holds the sheet's actions at the bottom, or after the content when it scrolls. */
export function SheetFooter(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props
    return <div data-slot="sheet-footer" {...props} mix={[footerRule, mix]} />
  }
}

const titleRule = css({ margin: 0, color: 'var(--foreground)', fontSize: 'inherit', fontWeight: 500 })

/** The sheet's name: an <h2> the sheet points to with aria-labelledby. */
export function SheetTitle(handle: Handle<Omit<Props<'h2'>, 'id'>>) {
  return () => {
    let dialog = getDialogContext(handle, 'SheetTitle')
    let { mix, ...props } = handle.props
    return <h2 data-slot="sheet-title" {...props} id={dialog.ids.title} mix={[titleRule, mix]} />
  }
}

const descriptionRule = css({
  margin: 0,
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
})

/** The sheet's description: a paragraph the sheet points to with aria-describedby. */
export function SheetDescription(handle: Handle<Omit<Props<'p'>, 'id'>>) {
  return () => {
    let dialog = getDialogContext(handle, 'SheetDescription')
    let { mix, ...props } = handle.props
    return <p data-slot="sheet-description" {...props} id={dialog.ids.description} mix={[descriptionRule, mix]} />
  }
}
