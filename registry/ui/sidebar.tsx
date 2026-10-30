// RemixCN Sidebar: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { attrs, css, Fragment, on, ref } from 'remix/component'
import type { Handle, MixValue, Props, RemixElement, RemixNode } from 'remix/component'

import { isFocusable } from '#remixcn/lib/focus-scope.ts'
import { Icon } from '#remixcn/lib/icons.tsx'
import { mergeStyles, transition, visuallyHidden } from '#remixcn/lib/styles.ts'
import type { Styles } from '#remixcn/lib/styles.ts'
import { MOBILE_BREAKPOINT, watchMobile } from '#remixcn/lib/use-mobile.ts'
import { Button } from '#remixcn/ui/button.tsx'
import type { ButtonProps } from '#remixcn/ui/button.tsx'
import { getDialogContext } from '#remixcn/ui/dialog.tsx'
import type { DialogChangeReason } from '#remixcn/ui/dialog.tsx'
import { Input } from '#remixcn/ui/input.tsx'
import type { InputProps } from '#remixcn/ui/input.tsx'
import { Separator } from '#remixcn/ui/separator.tsx'
import type { SeparatorProps } from '#remixcn/ui/separator.tsx'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '#remixcn/ui/sheet.tsx'
import type { SheetContentProps } from '#remixcn/ui/sheet.tsx'
import { Skeleton } from '#remixcn/ui/skeleton.tsx'
import { Tooltip, TooltipContent, tooltipTrigger } from '#remixcn/ui/tooltip.tsx'
import type { TooltipContentProps } from '#remixcn/ui/tooltip.tsx'

// A sidebar is a column of navigation beside the page. SidebarProvider holds
// two states: whether the sidebar is expanded on a wide screen, and whether
// its sheet is open on a narrow one. Below the 48rem breakpoint the same
// parts render in a Sheet, a modal native <dialog>. Neither state is saved
// anywhere: pass `open` and `onOpenChange` to keep it, such as in a cookie of
// your own.
//
// The parts run in the browser inside your client entry, like Button. The
// server renders the wide layout. Until the sidebar runs, and without
// scripting, its links stay reachable: a narrow screen shows the parts above
// the page, and a sidebar collapsed off canvas shows expanded, at once
// without scripting and after two seconds when the script still hasn't run.

export type SidebarState = 'expanded' | 'collapsed'
export type SidebarSide = 'left' | 'right'
export type SidebarVariant = 'sidebar' | 'floating' | 'inset'
export type SidebarCollapsible = 'offcanvas' | 'icon' | 'none'

/** Why the sidebar or its sheet opens or closes. The sheet adds the reasons of Dialog, such as `'escape-key'`. */
export type SidebarChangeReason =
  'trigger-press' | 'rail-press' | 'keyboard-shortcut' | 'link-press' | 'viewport-change' | DialogChangeReason

export interface SidebarChangeDetails {
  reason: SidebarChangeReason
  /** The event that asked for the change, if any. */
  event?: Event
  /** Keeps the current state. */
  cancel(): void
  readonly isCanceled: boolean
}

export interface SidebarChangeRequest {
  reason?: SidebarChangeReason
  event?: Event
}

/** What SidebarProvider shares with the parts inside, and with parts you build on it. It takes the place of shadcn's useSidebar(). */
export interface SidebarContext {
  /** `'expanded'` or `'collapsed'`: the wide layout's state. */
  readonly state: SidebarState
  /** Whether the sidebar is expanded on a wide screen. */
  readonly open: boolean
  /** Asks to expand or collapse it on a wide screen. Returns `false` when `onOpenChange` canceled the change. */
  setOpen(open: boolean, request?: SidebarChangeRequest): boolean
  /** Whether the sheet is open on a narrow screen. */
  readonly openMobile: boolean
  /** Asks to open or close the sheet on a narrow screen. Returns `false` when `onOpenMobileChange` canceled the change. */
  setOpenMobile(open: boolean, request?: SidebarChangeRequest): boolean
  /** Whether the viewport is narrower than 48rem. `false` until the sidebar runs in the browser. */
  readonly isMobile: boolean
  /** Toggles the sheet on a narrow screen and the sidebar on a wide one. */
  toggleSidebar(request?: SidebarChangeRequest): boolean
  /** Whether the provider runs in the browser yet. */
  readonly running: boolean
}

interface ProviderApi extends SidebarContext {
  /** The id a trigger points at: the wide sidebar, or the sheet's dialog on a narrow screen. */
  readonly controls: string | undefined
  readonly sidebarId: string
  registerTrigger(element: HTMLElement, signal: AbortSignal): void
  /** Remembers the trigger that toggled last, so focus can return to it. */
  noteTrigger(element: HTMLElement): void
  /** Registers an element that holds the sidebar's parts, wide or in the sheet. */
  registerRegion(element: HTMLElement, signal: AbortSignal): void
  adoptSheetId(id: string): void
  /** Where focus goes when the part that had it hides: the trigger that toggled last, else the first one. */
  returnTarget(): HTMLElement | null
}

interface SidebarPartContext {
  side: SidebarSide
  collapsible: SidebarCollapsible
}

function getProvider(handle: Handle<any, any>, part: string): ProviderApi {
  let context = handle.context.get(SidebarProvider) as ProviderApi | undefined
  if (!context) throw new Error(`${part} must sit inside SidebarProvider`)
  return context
}

/** The context of the nearest SidebarProvider, in place of shadcn's useSidebar(). Throws outside one. */
export function getSidebarContext(handle: Handle<any, any>): SidebarContext {
  return getProvider(handle, 'getSidebarContext')
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const smallText: Styles = { fontSize: 'var(--text-sm)', lineHeight: 'var(--text-sm--line-height)' }
const tinyText: Styles = { fontSize: 'var(--text-xs)', lineHeight: 'var(--text-xs--line-height)' }

const wide = `@media (width >= ${MOBILE_BREAKPOINT})` as const
const narrow = `@media (width < ${MOBILE_BREAKPOINT})` as const
// Where a collapsed state applies: a wide screen with scripting. Without
// scripting nothing could expand the sidebar again, so it stays expanded.
const collapsing = `@media (width >= ${MOBILE_BREAKPOINT}) and (scripting: enabled)` as const
const narrowScripted = `@media (width < ${MOBILE_BREAKPOINT}) and (scripting: enabled)` as const
const unscripted = '@media (scripting: none)'
const forcedColors = '@media (forced-colors: active)'

/** Styles for a part inside a sidebar collapsed to icons. */
function inIconMode(styles: Styles): Styles {
  return { [collapsing]: { ':where([data-slot="sidebar"][data-collapsible="icon"]) &': styles } }
}

const accent: Styles = { backgroundColor: 'var(--sidebar-accent)', color: 'var(--sidebar-accent-foreground)' }
const sidebarRing: Styles = { '&:focus-visible': { outlineColor: 'var(--sidebar-ring)' } }
// Movement in the sidebar takes the normal duration, linear as in shadcn, and none for reduced motion.
const slide = (...properties: string[]): Styles => ({
  transitionProperty: properties.join(', '),
  transitionDuration: 'var(--duration-normal)',
  transitionTimingFunction: 'linear',
})

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLInputElement &&
      !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image'].includes(target.type)))

/** Whether the key press is Ctrl or Cmd with `key`, typed outside a text field and not while an input method composes. */
function isShortcut(event: KeyboardEvent, key: string) {
  return (
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey &&
    !event.isComposing &&
    event.keyCode !== 229 &&
    event.key.toLowerCase() === key.toLowerCase() &&
    !isEditable(event.target)
  )
}

export interface SidebarProviderProps extends Props<'div'> {
  /** Whether the sidebar is expanded on a wide screen, for a sidebar you control. Render the new value from `onOpenChange`. */
  open?: boolean
  /** Whether it starts expanded, for a sidebar that keeps its own state (defaults to `true`). */
  defaultOpen?: boolean
  /** Called before the sidebar expands or collapses on a wide screen. Call `details.cancel()` to keep it as it is. */
  onOpenChange?: (open: boolean, details: SidebarChangeDetails) => void
  /** Whether the sheet is open on a narrow screen, for a sheet you control. */
  openMobile?: boolean
  /** Whether the sheet starts open (defaults to `false`). */
  defaultOpenMobile?: boolean
  /** Called before the sheet opens or closes on a narrow screen. Call `details.cancel()` to keep it as it is. */
  onOpenMobileChange?: (open: boolean, details: SidebarChangeDetails) => void
  /**
   * The key that toggles the sidebar with Ctrl or Cmd (defaults to `'b'`),
   * or `false` for none. The nearest sidebar around focus owns the press,
   * also when it has no shortcut or another key, and outside every sidebar
   * the first one on the page takes it. A text field or an input method that
   * composes keeps it.
   */
  keyboardShortcut?: string | false
}

// The width and the narrow sheet's width are custom properties, so a style
// or an app rule changes them for one sidebar.
const wrapperRule = css({
  '--sidebar-width': '16rem',
  '--sidebar-width-mobile': '18rem',
  '--sidebar-width-icon': '3rem',
  display: 'flex',
  width: '100%',
  minHeight: '100svh',
  '&:has(> [data-slot="sidebar"][data-variant="inset"])': { backgroundColor: 'var(--sidebar)' },
  // The sidebar sits above the page when it shows in the page's flow.
  [narrow]: { flexDirection: 'column' },
})

/**
 * Holds the sidebar's state and shares it with the parts inside: the wide
 * layout's expanded state, the narrow layout's sheet, the viewport, and the
 * keyboard shortcut. It renders the wrapper that lays the sidebar out beside
 * SidebarInset. Put it inside your client entry.
 */
export function SidebarProvider(handle: Handle<SidebarProviderProps, ProviderApi>) {
  let uncontrolledOpen = handle.props.defaultOpen ?? true
  let uncontrolledOpenMobile = handle.props.defaultOpenMobile ?? false
  let running = false
  let mobile = false
  let wrapper: HTMLElement | null = null
  let sheetId: string | undefined
  let triggers = new Set<HTMLElement>()
  let lastTrigger: HTMLElement | null = null
  let regions = new Set<HTMLElement>()
  let renderedLayout = ''

  let isOpen = () => handle.props.open ?? uncontrolledOpen
  let isOpenMobile = () => handle.props.openMobile ?? uncontrolledOpenMobile

  function change(narrowSheet: boolean, open: boolean, request: SidebarChangeRequest = {}) {
    if (open === (narrowSheet ? isOpenMobile() : isOpen()) || handle.signal.aborted) return true

    let canceled = false
    let details: SidebarChangeDetails = {
      reason: request.reason ?? 'none',
      event: request.event,
      cancel: () => void (canceled = true),
      get isCanceled() {
        return canceled
      },
    }
    if (narrowSheet) handle.props.onOpenMobileChange?.(open, details)
    else handle.props.onOpenChange?.(open, details)
    if (canceled) return false

    if (narrowSheet && handle.props.openMobile === undefined) uncontrolledOpenMobile = open
    if (!narrowSheet && handle.props.open === undefined) uncontrolledOpen = open
    void handle.update()
    return true
  }

  function returnTarget() {
    if (lastTrigger && isFocusable(lastTrigger)) return lastTrigger
    let ordered = [...triggers].sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    )
    return ordered.find((trigger) => isFocusable(trigger)) ?? null
  }

  // The menu button of the item that held focus, or of the item around it, such as for a submenu or an action that hid.
  function itemFallback(previous: Element) {
    for (let item = previous.closest('[data-slot="sidebar-menu-item"]'); item;) {
      let button = item.querySelector(
        ':scope > [data-sidebar="menu-button"], :scope > * > [data-sidebar="menu-button"]',
      )
      if (button !== previous && isFocusable(button)) return button
      item = item.parentElement?.closest('[data-slot="sidebar-menu-item"]') ?? null
    }
    return null
  }

  // After the layout changed, focus that sat in a part that is now hidden,
  // inert or gone moves to the item's menu button, else to the trigger.
  function restoreFocus(previous: Element) {
    let doc = previous.ownerDocument
    let active = doc.activeElement
    if (active && active !== doc.body && active !== previous) return
    if (isFocusable(previous)) return
    let target = (previous.isConnected ? itemFallback(previous) : null) ?? returnTarget()
    target?.focus({ preventScroll: true })
  }

  function onKeyDown(event: KeyboardEvent) {
    let key = handle.props.keyboardShortcut ?? 'b'
    if (key === false || event.defaultPrevented || !wrapper || !isShortcut(event, key)) return
    let target = event.target instanceof Element ? event.target : null
    // A press belongs to the nearest sidebar around it, also when that one has
    // no shortcut or another key. The wrapper's listener takes its own presses,
    // and the document's those outside every sidebar.
    let nearest = target?.closest('[data-slot="sidebar-wrapper"]') ?? null
    if (nearest !== (event.currentTarget === wrapper ? wrapper : null)) return
    // A modal dialog outside this sidebar owns the keyboard.
    let modal = target?.closest('dialog')
    if (modal?.matches(':modal') && !wrapper.contains(modal)) return
    event.preventDefault()
    if (!event.repeat) api.toggleSidebar({ reason: 'keyboard-shortcut', event })
  }

  let api: ProviderApi = {
    get state() {
      return isOpen() ? 'expanded' : 'collapsed'
    },
    get open() {
      return isOpen()
    },
    get openMobile() {
      return isOpenMobile()
    },
    get isMobile() {
      return mobile
    },
    get running() {
      return running
    },
    get controls() {
      return mobile ? sheetId : api.sidebarId
    },
    sidebarId: `${handle.id}-sidebar`,
    setOpen: (open, request) => change(false, open, request),
    setOpenMobile: (open, request) => change(true, open, request),
    toggleSidebar: (request) => (mobile ? change(true, !isOpenMobile(), request) : change(false, !isOpen(), request)),
    registerTrigger(element, signal) {
      triggers.add(element)
      signal.addEventListener('abort', () => {
        triggers.delete(element)
        if (lastTrigger === element) lastTrigger = null
      })
    },
    noteTrigger(element) {
      lastTrigger = element
    },
    registerRegion(element, signal) {
      regions.add(element)
      signal.addEventListener('abort', () => regions.delete(element))
    },
    adoptSheetId(id) {
      if (sheetId === id || handle.signal.aborted) return
      sheetId = id
      void handle.update()
    },
    returnTarget,
  }
  handle.context.set(api)

  return () => {
    let {
      open: _open,
      defaultOpen: _defaultOpen,
      onOpenChange: _onOpenChange,
      openMobile: _openMobile,
      defaultOpenMobile: _defaultOpenMobile,
      onOpenMobileChange: _onOpenMobileChange,
      keyboardShortcut: _keyboardShortcut,
      mix,
      children,
      ...props
    } = handle.props

    // Tasks run only in the browser, after the first commit. Until then the sidebar renders its server HTML.
    if (!running) {
      handle.queueTask(() => {
        if (handle.signal.aborted || !wrapper) return
        let { signal } = handle
        running = true
        mobile = watchMobile(
          (next) => {
            if (next === mobile) return
            // Leaving the narrow layout closes its sheet.
            if (!next && isOpenMobile()) change(true, false, { reason: 'viewport-change' })
            mobile = next
            void handle.update()
          },
          signal,
          wrapper.ownerDocument.defaultView ?? window,
        )
        wrapper.addEventListener('keydown', onKeyDown, { signal })
        wrapper.ownerDocument.addEventListener('keydown', onKeyDown, { signal })
        void handle.update()
      })
    }

    let layout = `${mobile} ${isOpen()} ${isOpenMobile()}`
    if (running && layout !== renderedLayout) {
      let previous = wrapper?.ownerDocument.activeElement
      if (previous && [...regions].some((region) => region.contains(previous))) {
        handle.queueTask(() => restoreFocus(previous))
      }
    }
    renderedLayout = layout

    return (
      <div data-slot="sidebar-wrapper" {...props} mix={[wrapperRule, ref((node) => (wrapper = node)), mix]}>
        {children}
      </div>
    )
  }
}

export interface SidebarProps extends Omit<Props<'div'>, 'id'> {
  /** The edge the sidebar sits on (defaults to `'left'`). Physical, as for Sheet, so `'right'` stays right in right-to-left text. */
  side?: SidebarSide
  /** A column along the edge, a floating panel, or a column beside an inset page (defaults to `'sidebar'`). */
  variant?: SidebarVariant
  /** How it collapses on a wide screen: off the screen, to icons, or not at all (defaults to `'offcanvas'`). */
  collapsible?: SidebarCollapsible
}

function isElement(node: unknown): node is RemixElement {
  return typeof node === 'object' && node !== null && '$rmx' in node
}

/** Splits the direct children, through fragments, into the rails and everything else. */
function splitRails(children: RemixNode): [RemixNode[], RemixNode[]] {
  let rails: RemixNode[] = []
  let rest: RemixNode[] = []
  let visit = (node: RemixNode) => {
    if (Array.isArray(node)) node.forEach(visit)
    else if (isElement(node) && node.type === Fragment) visit(node.props.children as RemixNode)
    else if (isElement(node) && node.type === SidebarRail) rails.push(node)
    else rest.push(node)
  }
  visit(children)
  return [rails, rest]
}

// The wide layout: the sidebar sits beside the page, with its gap in the
// flow. Its order follows its side, so a right sidebar sits on the right
// wherever it comes in the markup and whichever way the text runs.
const rootRule = css({
  '@keyframes remixcn-sidebar-show': {
    to: { position: 'static', visibility: 'visible', height: 'auto', overflow: 'visible' },
  },
  display: 'block',
  flexShrink: 0,
  color: 'var(--sidebar-foreground)',
  '&[data-side="left"]:dir(ltr), &[data-side="right"]:dir(rtl)': { order: -1 },
  '&[data-side="right"]:dir(ltr), &[data-side="left"]:dir(rtl)': { order: 1 },
  [narrow]: { order: -1 },
  // Until it runs, the narrow layout's sheet doesn't exist yet: the parts wait out of sight, and show above the page after two seconds.
  [narrowScripted]: {
    '&[data-pending]': {
      position: 'absolute',
      visibility: 'hidden',
      height: 0,
      overflow: 'hidden',
      animation: 'remixcn-sidebar-show 0s 2s forwards',
    },
  },
})

const gapRule = css(
  mergeStyles(slide('width'), {
    '@keyframes remixcn-sidebar-gap-show': { to: { width: 'var(--sidebar-width)' } },
    position: 'relative',
    width: 'var(--sidebar-width)',
    [narrow]: { display: 'none' },
    [collapsing]: {
      ':where([data-collapsible="offcanvas"]) > &': { width: 0 },
      ':where([data-collapsible="offcanvas"][data-pending]) > &': {
        animation: 'remixcn-sidebar-gap-show 0s 2s forwards',
      },
      ':where([data-collapsible="icon"]) > &': { width: 'var(--sidebar-width-icon)' },
      ':where([data-collapsible="icon"]:is([data-variant="floating"], [data-variant="inset"])) > &': {
        width: `calc(var(--sidebar-width-icon) + ${space(4)})`,
      },
    },
  }),
)

const containerRule = css(
  mergeStyles(slide('translate', 'width'), {
    '@keyframes remixcn-sidebar-container-show': { to: { translate: 'none' } },
    position: 'fixed',
    insetBlock: 0,
    zIndex: 10,
    display: 'flex',
    boxSizing: 'border-box',
    width: 'var(--sidebar-width)',
    height: '100svh',
    '&[data-side="left"]': { left: 0 },
    '&[data-side="right"]': { right: 0 },
    ':where([data-variant="floating"], [data-variant="inset"]) > &': { padding: space(2) },
    ':where([data-variant="sidebar"]) > &[data-side="left"]': { borderRight: '1px solid var(--sidebar-border)' },
    ':where([data-variant="sidebar"]) > &[data-side="right"]': { borderLeft: '1px solid var(--sidebar-border)' },
    [collapsing]: {
      ':where([data-collapsible="offcanvas"]) > &[data-side="left"]': { translate: '-100%' },
      ':where([data-collapsible="offcanvas"]) > &[data-side="right"]': { translate: '100%' },
      ':where([data-collapsible="offcanvas"][data-pending]) > &': {
        animation: 'remixcn-sidebar-container-show 0s 2s forwards',
      },
      ':where([data-collapsible="icon"]) > &': { width: 'var(--sidebar-width-icon)' },
      ':where([data-collapsible="icon"]:is([data-variant="floating"], [data-variant="inset"])) > &': {
        width: `calc(var(--sidebar-width-icon) + ${space(4)} + 2px)`,
      },
    },
    // In the page's flow above the content, before the narrow layout runs or without scripting.
    [narrow]: {
      position: 'static',
      width: 'auto',
      height: 'auto',
      translate: 'none',
      '&[data-side]': { borderInline: 0, borderBottom: '1px solid var(--sidebar-border)' },
    },
  }),
)

const innerRule = css(
  mergeStyles(slide('visibility'), {
    '@keyframes remixcn-sidebar-inner-show': { to: { visibility: 'visible' } },
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    minWidth: 0,
    backgroundColor: 'var(--sidebar)',
    // shadcn's ring-1 is a border here, so forced colors keeps the edge.
    ':where([data-variant="floating"]) > * > &': {
      border: '1px solid var(--sidebar-border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-sm)',
    },
    // Off the screen, it hides once it slid out, so Tab and screen readers skip it.
    [collapsing]: {
      ':where([data-collapsible="offcanvas"]) > * > &': { visibility: 'hidden' },
      ':where([data-collapsible="offcanvas"][data-pending]) > * > &': {
        animation: 'remixcn-sidebar-inner-show 0s 2s forwards',
      },
    },
  }),
)

const staticRule = css({
  display: 'flex',
  flexDirection: 'column',
  width: 'var(--sidebar-width, 16rem)',
  maxWidth: '100%',
  height: '100%',
  backgroundColor: 'var(--sidebar)',
  color: 'var(--sidebar-foreground)',
})

// The sheet of the narrow layout: the sidebar's colors at the narrow width, with no close button.
const sheetRule = css({
  width: 'var(--sidebar-width-mobile, 18rem)',
  maxWidth: '100%',
  padding: 0,
  gap: 0,
  backgroundColor: 'var(--sidebar)',
  color: 'var(--sidebar-foreground)',
})
const sheetInnerRule = css({ display: 'flex', flexDirection: 'column', width: '100%', minHeight: '100%' })

/** Whether a click on this link navigates the current tab: the main button, no modifier keys, no other target, no download. */
function navigatesHere(event: MouseEvent, link: HTMLAnchorElement) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !link.hasAttribute('download') &&
    (link.target === '' || link.target === '_self')
  )
}
const hiddenRule = css(visuallyHidden)

/** Tells the provider the id of the sheet's dialog, so the trigger points at it. */
function SheetId(handle: Handle) {
  return () => {
    let provider = getProvider(handle, 'Sidebar')
    let id = getDialogContext(handle, 'Sidebar').ids.popup
    if (provider.controls !== id) handle.queueTask(() => provider.adoptSheetId(id))
    return null
  }
}

/**
 * The sidebar. On a wide screen, a column along one edge that expands and
 * collapses; on a narrow one, the same parts in a Sheet. Put SidebarHeader,
 * SidebarContent, SidebarFooter and SidebarRail inside.
 */
export function Sidebar(handle: Handle<SidebarProps, SidebarPartContext>) {
  return () => {
    let provider = getProvider(handle, 'Sidebar')
    let { side = 'left', variant = 'sidebar', collapsible = 'offcanvas', mix, children, ...props } = handle.props
    handle.context.set({ side, collapsible })

    if (collapsible === 'none') {
      return (
        <div data-slot="sidebar" {...props} mix={[staticRule, mix]}>
          {children}
        </div>
      )
    }

    let [rails, parts] = splitRails(children)

    if (provider.isMobile) {
      // Your props and mixins reach the sheet as they reach the wide column, but its role stays the dialog's.
      let { role: _role, ...sheetProps } = props
      return (
        <Sheet
          open={provider.openMobile}
          onOpenChange={(open, details) => {
            if (!provider.setOpenMobile(open, { reason: details.reason, event: details.event })) details.cancel()
          }}
        >
          <SheetContent
            {...(sheetProps as Omit<SheetContentProps, 'mix'>)}
            side={side}
            showCloseButton={false}
            data-sidebar="sidebar"
            data-slot="sidebar"
            data-mobile="true"
            finalFocus={() => provider.returnTarget()}
            mix={[
              sheetRule,
              mix as SheetContentProps['mix'],
              // A link that navigates in place, as Remix's runtime does, would leave the sheet over the new page.
              on('click', (event) => {
                let link = event.target instanceof Element ? event.target.closest('a[href]') : null
                if (event.defaultPrevented || !(link instanceof HTMLAnchorElement) || !navigatesHere(event, link))
                  return
                provider.setOpenMobile(false, { reason: 'link-press', event })
              }),
            ]}
          >
            <SheetHeader mix={hiddenRule}>
              <SheetTitle>Sidebar</SheetTitle>
              <SheetDescription>Displays the mobile sidebar.</SheetDescription>
            </SheetHeader>
            <SheetId />
            <div
              data-slot="sidebar-inner"
              data-sidebar="sidebar"
              mix={[sheetInnerRule, ref((node, signal) => provider.registerRegion(node, signal))]}
            >
              {parts}
            </div>
          </SheetContent>
        </Sheet>
      )
    }

    let collapsed = provider.state === 'collapsed'
    let hidden = provider.running && collapsed && collapsible === 'offcanvas'

    return (
      <div
        data-slot="sidebar"
        data-state={provider.state}
        data-collapsible={collapsed ? collapsible : ''}
        data-variant={variant}
        data-side={side}
        data-pending={provider.running ? undefined : ''}
        mix={rootRule}
      >
        <div data-slot="sidebar-gap" mix={gapRule} />
        <div
          data-slot="sidebar-container"
          data-side={side}
          id={provider.sidebarId}
          {...props}
          mix={[containerRule, mix]}
        >
          <div
            data-slot="sidebar-inner"
            data-sidebar="sidebar"
            inert={hidden ? true : undefined}
            mix={[innerRule, ref((node, signal) => provider.registerRegion(node, signal))]}
          >
            {parts}
          </div>
          {rails}
        </div>
      </div>
    )
  }
}

function PanelIcon() {
  return () => (
    <Icon>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
      <path d="M9.5 3.5v17" />
    </Icon>
  )
}

// The panel in the icon sits on the sidebar's side. Before it runs and
// without scripting, nothing could toggle the sidebar, so the trigger hides.
// A ghost Button highlights itself while aria-expanded is "true", as for a
// menu that is open. A sidebar is expanded most of the time, so the trigger
// keeps the ghost look and highlights only on hover.
const triggerRule = css({
  '&[aria-expanded="true"]:not(:hover)': { backgroundColor: 'transparent', color: 'inherit' },
  ':where([data-slot="sidebar-wrapper"]:has(> [data-slot="sidebar"][data-side="right"])) & svg': {
    transform: 'scaleX(-1)',
  },
  [unscripted]: { display: 'none' },
})

/**
 * A ghost icon Button that toggles the sidebar: the sheet on a narrow screen,
 * the column on a wide one. Its name is "Toggle Sidebar"; children replace
 * the icon and the name. It says whether the sidebar is open with
 * aria-expanded once it runs.
 */
export function SidebarTrigger(handle: Handle<ButtonProps>) {
  return () => {
    let provider = getProvider(handle, 'SidebarTrigger')
    let { variant = 'ghost', size = 'icon-sm', mix, children, ...props } = handle.props
    let { running, isMobile } = provider
    let expanded = isMobile ? provider.openMobile : provider.open

    return (
      <Button
        data-sidebar="trigger"
        data-slot="sidebar-trigger"
        aria-expanded={running ? (expanded ? 'true' : 'false') : undefined}
        aria-controls={running ? provider.controls : undefined}
        aria-haspopup={running && isMobile ? 'dialog' : undefined}
        {...props}
        variant={variant}
        size={size}
        mix={[
          triggerRule,
          ref((node, signal) => provider.registerTrigger(node, signal)),
          mix,
          on('click', (event) => {
            if (event.defaultPrevented) return
            provider.noteTrigger(event.currentTarget)
            provider.toggleSidebar({ reason: 'trigger-press', event })
          }),
        ]}
      >
        {children ?? (
          <>
            <PanelIcon />
            <span mix={hiddenRule}>Toggle Sidebar</span>
          </>
        )}
      </Button>
    )
  }
}

// A strip along the sidebar's edge that toggles it with a click. shadcn
// keeps it out of the tab order: the trigger and the shortcut are the
// keyboard's way.
const railRule = css(
  mergeStyles(transition('translate', 'background-color'), {
    position: 'absolute',
    insetBlock: 0,
    zIndex: 20,
    display: 'none',
    width: space(4),
    margin: 0,
    padding: 0,
    border: 0,
    backgroundColor: 'transparent',
    color: 'inherit',
    translate: '-50% 0',
    '&::after': {
      content: '""',
      position: 'absolute',
      insetBlock: 0,
      left: 'calc(50% - 1px)',
      width: '2px',
    },
    '&:hover::after': { backgroundColor: 'var(--sidebar-border)' },
    [forcedColors]: { '&:hover::after': { backgroundColor: 'CanvasText' } },
    '@media (width >= 40rem)': { display: 'flex' },
    ':where([data-side="left"]) > * > &': { right: '-1rem', cursor: 'w-resize' },
    ':where([data-side="right"]) > * > &': { left: 0, cursor: 'e-resize' },
    ':where([data-side="left"][data-state="collapsed"]) > * > &': { cursor: 'e-resize' },
    ':where([data-side="right"][data-state="collapsed"]) > * > &': { cursor: 'w-resize' },
    [collapsing]: {
      ':where([data-collapsible="offcanvas"]) > * > &': { translate: 'none' },
      ':where([data-collapsible="offcanvas"]) > * > &:hover': { backgroundColor: 'var(--sidebar)' },
      ':where([data-collapsible="offcanvas"]) > * > &::after': { left: '100%' },
      ':where([data-collapsible="offcanvas"][data-side="left"]) > * > &': { right: '-0.5rem' },
      ':where([data-collapsible="offcanvas"][data-side="right"]) > * > &': { left: '-0.5rem' },
    },
    [narrow]: { display: 'none' },
    [unscripted]: { display: 'none' },
  }),
)

/**
 * A strip on the sidebar's edge that toggles it with a click, out of the tab
 * order. Put it directly in Sidebar, so it stays usable while the sidebar is
 * off the screen. The sheet of a narrow screen leaves it out.
 */
export function SidebarRail(handle: Handle<Omit<Props<'button'>, 'type'>>) {
  return () => {
    let provider = getProvider(handle, 'SidebarRail')
    let { mix, ...props } = handle.props

    return (
      <button
        data-sidebar="rail"
        data-slot="sidebar-rail"
        aria-label="Toggle Sidebar"
        title="Toggle Sidebar"
        tabIndex={-1}
        {...props}
        type="button"
        mix={[
          railRule,
          mix,
          on('click', (event) => {
            if (event.defaultPrevented) return
            provider.toggleSidebar({ reason: 'rail-press', event })
          }),
        ]}
      />
    )
  }
}

const insetVariant = ':where([data-slot="sidebar-wrapper"]:has(> [data-slot="sidebar"][data-variant="inset"])) > &'
const insetRule = css({
  position: 'relative',
  display: 'flex',
  flex: '1 1 0%',
  flexDirection: 'column',
  width: '100%',
  minWidth: 0,
  backgroundColor: 'var(--background)',
  [wide]: {
    [insetVariant]: { margin: space(2), borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' },
    ':where([data-slot="sidebar-wrapper"]:has(> [data-slot="sidebar"][data-variant="inset"][data-side="left"][data-state="expanded"])) > &':
      { marginLeft: 0 },
    ':where([data-slot="sidebar-wrapper"]:has(> [data-slot="sidebar"][data-variant="inset"][data-side="right"][data-state="expanded"])) > &':
      { marginRight: 0 },
  },
})

/** The page beside the sidebar: a <main>. With the inset variant it sits in a rounded panel. */
export function SidebarInset(handle: Handle<Props<'main'>>) {
  return () => {
    let { mix, ...props } = handle.props
    return <main data-slot="sidebar-inset" {...props} mix={[insetRule, mix]} />
  }
}

const sidebarInputRule = css({
  width: '100%',
  minHeight: space(8),
  backgroundColor: 'var(--background)',
  boxShadow: 'none',
})

/** An Input in the sidebar, such as a search field. Give it a label, such as a visually hidden one. */
export function SidebarInput(handle: Handle<InputProps>) {
  return () => {
    let { mix, ...props } = handle.props
    return <Input data-slot="sidebar-input" data-sidebar="input" {...props} mix={[sidebarInputRule, mix]} />
  }
}

const sectionRule = css({ display: 'flex', flexDirection: 'column', gap: space(2), padding: space(2) })

/** The top of the sidebar, such as a workspace switcher or a search form. It stays put while the content scrolls. */
export function SidebarHeader(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props
    return <div data-slot="sidebar-header" data-sidebar="header" {...props} mix={[sectionRule, mix]} />
  }
}

/** The bottom of the sidebar, such as the account. It stays put while the content scrolls. */
export function SidebarFooter(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props
    return <div data-slot="sidebar-footer" data-sidebar="footer" {...props} mix={[sectionRule, mix]} />
  }
}

const sidebarSeparatorRule = css({ width: 'auto', marginInline: space(2), borderColor: 'var(--sidebar-border)' })

/** A line between parts of the sidebar. */
export function SidebarSeparator(handle: Handle<SeparatorProps>) {
  return () => {
    let { mix, ...props } = handle.props
    return (
      <Separator data-slot="sidebar-separator" data-sidebar="separator" {...props} mix={[sidebarSeparatorRule, mix]} />
    )
  }
}

// shadcn hides the scrollbar. A thin one stays here, so a long menu shows
// that it scrolls and a mouse without a wheel can scroll it.
const contentRule = css(
  mergeStyles(
    {
      display: 'flex',
      flex: '1 1 0%',
      flexDirection: 'column',
      gap: space(2),
      minHeight: 0,
      overflow: 'auto',
      scrollbarWidth: 'thin',
    },
    inIconMode({ overflowX: 'hidden' }),
  ),
)

/** The part between the header and the footer that scrolls. Put SidebarGroups in it. */
export function SidebarContent(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props
    return <div data-slot="sidebar-content" data-sidebar="content" {...props} mix={[contentRule, mix]} />
  }
}

const groupRule = css({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  minWidth: 0,
  padding: space(2),
})

/** A section of the sidebar with an optional label and action. */
export function SidebarGroup(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props
    return <div data-slot="sidebar-group" data-sidebar="group" {...props} mix={[groupRule, mix]} />
  }
}

const noMarker: Styles = { listStyle: 'none', '&::-webkit-details-marker': { display: 'none' } }
const iconSize: Styles = { '& svg': { flexShrink: 0, width: '1rem', height: '1rem' } }

const groupLabelRule = css(
  mergeStyles(
    slide('margin', 'opacity', 'visibility'),
    noMarker,
    iconSize,
    sidebarRing,
    {
      display: 'flex',
      flexShrink: 0,
      alignItems: 'center',
      gap: space(2),
      minHeight: space(8),
      paddingInline: space(2),
      borderRadius: 'var(--radius-md)',
      color: 'color-mix(in oklab, var(--sidebar-foreground) 70%, transparent)',
      ...tinyText,
      fontWeight: 500,
      overflowWrap: 'anywhere',
    },
    inIconMode({ marginBlockStart: space(-8), opacity: 0, visibility: 'hidden' }),
  ),
)

/** Gives another element, such as a <summary> that opens the group, the group label's look and data-slot. */
export function sidebarGroupLabelVariants(): MixValue {
  return [groupLabelRule, attrs({ 'data-slot': 'sidebar-group-label', 'data-sidebar': 'group-label' })]
}

/** The group's label. It fades out while the sidebar is collapsed to icons. */
export function SidebarGroupLabel(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props
    return <div data-slot="sidebar-group-label" data-sidebar="group-label" {...props} mix={[groupLabelRule, mix]} />
  }
}

// A small square button at the end of a row. On a narrow screen it takes
// presses a little around it, as shadcn does for touch.
const cornerAction: Styles = mergeStyles(transition('transform', 'background-color', 'color'), iconSize, sidebarRing, {
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: space(5),
  aspectRatio: '1',
  margin: 0,
  padding: 0,
  border: 0,
  borderRadius: 'var(--radius-md)',
  backgroundColor: 'transparent',
  color: 'var(--sidebar-foreground)',
  textDecoration: 'none',
  cursor: 'pointer',
  '&:hover': accent,
  '&::after': { content: '""', position: 'absolute', inset: space(-2) },
  [wide]: { '&::after': { display: 'none' } },
})

const groupActionRule = css(
  mergeStyles(cornerAction, { insetBlockStart: space(3.5), insetInlineEnd: space(3) }, inIconMode({ display: 'none' })),
)

/** Gives another element, such as a link, the group action's look and data-slot. */
export function sidebarGroupActionVariants(): MixValue {
  return [groupActionRule, attrs({ 'data-slot': 'sidebar-group-action', 'data-sidebar': 'group-action' })]
}

/** A button at the end of the group's label, such as Add project. Name it, such as with visually hidden text. */
export function SidebarGroupAction(handle: Handle<Props<'button'>>) {
  return () => {
    let { type = 'button', mix, ...props } = handle.props
    return (
      <button
        data-slot="sidebar-group-action"
        data-sidebar="group-action"
        {...props}
        type={type}
        mix={[groupActionRule, mix]}
      />
    )
  }
}

const groupContentRule = css({ width: '100%', ...smallText })

/** Holds the group's menu or other content. */
export function SidebarGroupContent(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props
    return (
      <div data-slot="sidebar-group-content" data-sidebar="group-content" {...props} mix={[groupContentRule, mix]} />
    )
  }
}

const menuRule = css({
  display: 'flex',
  flexDirection: 'column',
  gap: space(1),
  width: '100%',
  minWidth: 0,
  margin: 0,
  padding: 0,
  listStyle: 'none',
})

/** A list of menu items. */
export function SidebarMenu(handle: Handle<Props<'ul'>>) {
  return () => {
    let { mix, ...props } = handle.props
    return <ul data-slot="sidebar-menu" data-sidebar="menu" {...props} mix={[menuRule, mix]} />
  }
}

const menuItemRule = css({ position: 'relative' })

/** One item: a SidebarMenuButton, and maybe an action, a badge or a submenu. */
export function SidebarMenuItem(handle: Handle<Props<'li'>>) {
  return () => {
    let { mix, ...props } = handle.props
    return <li data-slot="sidebar-menu-item" data-sidebar="menu-item" {...props} mix={[menuItemRule, mix]} />
  }
}

export const sidebarMenuButtonVariantNames = ['default', 'outline'] as const
export const sidebarMenuButtonSizes = ['default', 'sm', 'lg'] as const
export type SidebarMenuButtonVariant = (typeof sidebarMenuButtonVariantNames)[number]
export type SidebarMenuButtonSize = (typeof sidebarMenuButtonSizes)[number]

export interface SidebarMenuButtonVariantOptions {
  /** A plain row, or one with an outline (defaults to `'default'`). */
  variant?: SidebarMenuButtonVariant
  /** The height: 2rem by default, 1.75rem small, 3rem large. */
  size?: SidebarMenuButtonSize
  /** Marks the current item, with `data-active`. SidebarMenuButton also writes aria-current="page" on a link. */
  isActive?: boolean
}

const besideEnd =
  ':where([data-slot="sidebar-menu-item"]:has(> :is([data-slot="sidebar-menu-action"], [data-slot="sidebar-menu-badge"]))) &'

// shadcn keeps labels on one line and cuts them short. Here they wrap, so a
// narrow screen or large text never hides a label. Collapsed to icons, the
// row is a 2rem square that clips its label, which then shows in a tooltip.
const menuButtonRule = css(
  mergeStyles(
    transition('width', 'height', 'padding', 'background-color', 'color'),
    noMarker,
    iconSize,
    sidebarRing,
    {
      display: 'flex',
      boxSizing: 'border-box',
      width: '100%',
      minHeight: space(8),
      alignItems: 'center',
      gap: space(2),
      overflow: 'hidden',
      margin: 0,
      paddingBlock: space(1.5),
      paddingInline: space(2),
      border: 0,
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'transparent',
      color: 'inherit',
      font: 'inherit',
      ...smallText,
      textAlign: 'start',
      textDecoration: 'none',
      overflowWrap: 'anywhere',
      cursor: 'pointer',
      '&:hover, &:active, &[data-active], &[data-popup-open]:hover, &[aria-expanded="true"]:hover': accent,
      '&[data-active]': { fontWeight: 500 },
      '&:disabled, &[aria-disabled="true"]': { pointerEvents: 'none', opacity: 0.5 },
      '&[data-variant="outline"]': {
        backgroundColor: 'var(--background)',
        boxShadow: '0 0 0 1px var(--sidebar-border)',
        '&:hover': { boxShadow: '0 0 0 1px var(--sidebar-accent)' },
      },
      '&[data-size="sm"]': { minHeight: space(7), ...tinyText },
      '&[data-size="lg"]': { minHeight: space(12) },
      [besideEnd]: { paddingInlineEnd: space(8) },
      // Forced colors drop the highlight, so the current item draws an edge.
      [forcedColors]: {
        '&[data-active]:not(:focus-visible)': { outline: '1px solid CanvasText', outlineOffset: '-1px' },
      },
    },
    inIconMode({
      width: space(8),
      height: space(8),
      minHeight: 0,
      padding: space(2),
      whiteSpace: 'nowrap',
      '&[data-size="lg"]': { padding: 0 },
    }),
  ),
)

/** Gives another element, such as a popover's trigger or a <summary>, a menu button's look and data attributes. */
export function sidebarMenuButtonVariants({
  variant = 'default',
  size = 'default',
  isActive = false,
}: SidebarMenuButtonVariantOptions = {}): MixValue {
  return [
    menuButtonRule,
    attrs({
      'data-slot': 'sidebar-menu-button',
      'data-sidebar': 'menu-button',
      'data-variant': variant,
      'data-size': size,
      ...(isActive ? { 'data-active': '' } : {}),
    }),
  ]
}

/** The tooltip of a menu button: its text, or the props of TooltipContent with the text as children. */
export type SidebarMenuButtonTooltip = string | TooltipContentProps

export interface SidebarMenuButtonProps
  extends Omit<Props<'button'>, 'type' | 'role'>, SidebarMenuButtonVariantOptions {
  /** Renders a native link to this address instead of a button. */
  href?: string
  /** The link's target, such as `_blank`. */
  target?: string
  /** The link's relationship to the page, such as `noopener`. */
  rel?: string
  /** The button's type (defaults to `'button'`). */
  type?: 'button' | 'submit' | 'reset'
  /** A tooltip that shows the label while the sidebar is collapsed to icons. */
  tooltip?: SidebarMenuButtonTooltip
}

/**
 * A row of the menu: a native link with `href`, else a native button. Put
 * an icon and the label in a <span> inside. With `tooltip`, the label shows
 * on hover and keyboard focus while the sidebar is collapsed to icons.
 */
export function SidebarMenuButton(handle: Handle<SidebarMenuButtonProps>) {
  return () => {
    let provider = getProvider(handle, 'SidebarMenuButton')
    let part = handle.context.get(Sidebar) as SidebarPartContext | undefined
    let {
      href,
      type = 'button',
      variant = 'default',
      size = 'default',
      isActive = false,
      tooltip,
      mix,
      children,
      ...props
    } = handle.props
    let tip = typeof tooltip === 'string' ? { children: tooltip } : tooltip
    let shared = {
      'data-slot': 'sidebar-menu-button',
      'data-sidebar': 'menu-button',
      'data-variant': variant,
      'data-size': size,
      'data-active': isActive ? '' : undefined,
    }
    // The label names the row; the tooltip only shows it, so it describes nothing.
    let showsTip = tip ? tooltipTrigger({ describe: false }) : undefined

    let row =
      href === undefined ? (
        <button {...shared} {...props} type={type} mix={[menuButtonRule, mix, showsTip]}>
          {children}
        </button>
      ) : (
        <a
          {...shared}
          aria-current={isActive ? 'page' : undefined}
          {...(props as Omit<Props<'a'>, 'href' | 'role'>)}
          href={href}
          mix={[menuButtonRule, mix as unknown as Props<'a'>['mix'], showsTip]}
        >
          {children}
        </a>
      )
    if (!tip) return row

    let iconsOnly = provider.state === 'collapsed' && !provider.isMobile && part?.collapsible === 'icon'
    return (
      <Tooltip disabled={!iconsOnly}>
        {row}
        <TooltipContent side={part?.side === 'right' ? 'left' : 'right'} align="center" aria-hidden="true" {...tip} />
      </Tooltip>
    )
  }
}

const atRowEnd = (top: number, small: number, large: number): Styles => ({
  insetBlockStart: space(top),
  ':where([data-sidebar="menu-button"][data-size="sm"]) ~ &': { insetBlockStart: space(small) },
  ':where([data-sidebar="menu-button"][data-size="lg"]) ~ &': { insetBlockStart: space(large) },
})

// shadcn's action is 20px. It sits over the end of its row's link, so it
// takes 24px here, the smallest target WCAG 2.5.8 allows without room around it.
const menuActionRule = css(
  mergeStyles(
    cornerAction,
    atRowEnd(1, 0.5, 3),
    {
      width: space(6),
      insetInlineEnd: space(1),
      ':where([data-sidebar="menu-button"]:hover) ~ &': { color: 'var(--sidebar-accent-foreground)' },
      '&[data-show-on-hover]': {
        ':where([data-sidebar="menu-button"][data-active]) ~ &': { color: 'var(--sidebar-accent-foreground)' },
      },
      // Hidden until the row is hovered or focused, only where a pointer can hover.
      [`${wide} and (hover: hover)` as const]: {
        '&[data-show-on-hover]': { opacity: 0 },
        ':where([data-slot="sidebar-menu-item"]:is(:hover, :focus-within)) > &[data-show-on-hover], &[data-show-on-hover]:is([aria-expanded="true"], [data-popup-open])':
          { opacity: 1 },
      },
    },
    inIconMode({ display: 'none' }),
  ),
)

export interface SidebarMenuActionVariantOptions {
  /** Shows the action only while its row is hovered or has focus, on a wide screen with a pointer that hovers. */
  showOnHover?: boolean
}

/** Gives another element, such as a popover's trigger, the menu action's look and data-slot. */
export function sidebarMenuActionVariants({ showOnHover = false }: SidebarMenuActionVariantOptions = {}): MixValue {
  return [
    menuActionRule,
    attrs({
      'data-slot': 'sidebar-menu-action',
      'data-sidebar': 'menu-action',
      ...(showOnHover ? { 'data-show-on-hover': '' } : {}),
    }),
  ]
}

export interface SidebarMenuActionProps extends Props<'button'>, SidebarMenuActionVariantOptions {}

/** A button at the end of a menu item, beside its SidebarMenuButton, never inside it. Name it, such as with visually hidden text. */
export function SidebarMenuAction(handle: Handle<SidebarMenuActionProps>) {
  return () => {
    let { showOnHover = false, type = 'button', mix, ...props } = handle.props
    return (
      <button
        data-slot="sidebar-menu-action"
        data-sidebar="menu-action"
        data-show-on-hover={showOnHover ? '' : undefined}
        {...props}
        type={type}
        mix={[menuActionRule, mix]}
      />
    )
  }
}

const menuBadgeRule = css(
  mergeStyles(
    atRowEnd(1.5, 1, 2.5),
    {
      position: 'absolute',
      insetInlineEnd: space(1),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: space(5),
      minWidth: space(5),
      paddingInline: space(1),
      borderRadius: 'var(--radius-md)',
      color: 'var(--sidebar-foreground)',
      ...tinyText,
      fontWeight: 500,
      fontVariantNumeric: 'tabular-nums',
      userSelect: 'none',
      pointerEvents: 'none',
      ':where([data-sidebar="menu-button"]:is(:hover, [data-active])) ~ &': {
        color: 'var(--sidebar-accent-foreground)',
      },
    },
    inIconMode({ display: 'none' }),
  ),
)

/** A count or short status at the end of a menu item, such as unread messages. */
export function SidebarMenuBadge(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props
    return <div data-slot="sidebar-menu-badge" data-sidebar="menu-badge" {...props} mix={[menuBadgeRule, mix]} />
  }
}

// shadcn picks a random width. Here the width follows the item's place in
// the menu, so the server and the browser draw the same, and --skeleton-width
// sets it.
const menuSkeletonRule = css({
  '--skeleton-width': '70%',
  ':where([data-slot="sidebar-menu-item"]:nth-child(3n + 1)) > &': { '--skeleton-width': '85%' },
  ':where([data-slot="sidebar-menu-item"]:nth-child(3n + 2)) > &': { '--skeleton-width': '60%' },
  display: 'flex',
  alignItems: 'center',
  gap: space(2),
  height: space(8),
  paddingInline: space(2),
  borderRadius: 'var(--radius-md)',
})
const skeletonIconRule = css({ flexShrink: 0, width: '1rem', height: '1rem', borderRadius: 'var(--radius-md)' })
const skeletonTextRule = css({ flex: '1 1 0%', maxWidth: 'var(--skeleton-width)', height: '1rem' })

export interface SidebarMenuSkeletonProps extends Props<'div'> {
  /** Draws an icon's place before the text (defaults to `false`). */
  showIcon?: boolean
}

/**
 * A placeholder for a menu item while the menu loads. It's hidden from
 * assistive technology: mark the menu aria-busy="true" and say what loads in text.
 */
export function SidebarMenuSkeleton(handle: Handle<SidebarMenuSkeletonProps>) {
  return () => {
    let { showIcon = false, mix, ...props } = handle.props
    return (
      <div
        data-slot="sidebar-menu-skeleton"
        data-sidebar="menu-skeleton"
        aria-hidden="true"
        {...props}
        mix={[menuSkeletonRule, mix]}
      >
        {showIcon ? <Skeleton data-sidebar="menu-skeleton-icon" mix={skeletonIconRule} /> : null}
        <Skeleton data-sidebar="menu-skeleton-text" mix={skeletonTextRule} />
      </div>
    )
  }
}

const menuSubRule = css(
  mergeStyles(
    {
      display: 'flex',
      flexDirection: 'column',
      gap: space(1),
      minWidth: 0,
      marginBlock: 0,
      marginInline: space(3.5),
      paddingBlock: space(0.5),
      paddingInline: space(2.5),
      borderInlineStart: '1px solid var(--sidebar-border)',
      listStyle: 'none',
    },
    inIconMode({ display: 'none' }),
  ),
)

/** A nested list under a menu item. It hides while the sidebar is collapsed to icons. */
export function SidebarMenuSub(handle: Handle<Props<'ul'>>) {
  return () => {
    let { mix, ...props } = handle.props
    return <ul data-slot="sidebar-menu-sub" data-sidebar="menu-sub" {...props} mix={[menuSubRule, mix]} />
  }
}

/** One item of a submenu. */
export function SidebarMenuSubItem(handle: Handle<Props<'li'>>) {
  return () => {
    let { mix, ...props } = handle.props
    return <li data-slot="sidebar-menu-sub-item" data-sidebar="menu-sub-item" {...props} mix={[menuItemRule, mix]} />
  }
}

export interface SidebarMenuSubButtonVariantOptions {
  /** The text size: `'md'` by default, `'sm'` smaller. */
  size?: 'sm' | 'md'
  /** Marks the current item, with `data-active`. SidebarMenuSubButton also writes aria-current="page" on a link. */
  isActive?: boolean
}

const menuSubButtonRule = css(
  mergeStyles(
    transition('background-color', 'color'),
    sidebarRing,
    {
      display: 'flex',
      minWidth: 0,
      minHeight: space(7),
      alignItems: 'center',
      gap: space(2),
      overflow: 'hidden',
      paddingBlock: space(1),
      paddingInline: space(2),
      borderRadius: 'var(--radius-md)',
      color: 'var(--sidebar-foreground)',
      textDecoration: 'none',
      overflowWrap: 'anywhere',
      ...smallText,
      '& > svg': { flexShrink: 0, width: '1rem', height: '1rem', color: 'var(--sidebar-accent-foreground)' },
      '&:hover, &:active, &[data-active]': accent,
      '&[data-size="sm"]': tinyText,
      '&[aria-disabled="true"]': { pointerEvents: 'none', opacity: 0.5 },
      [forcedColors]: {
        '&[data-active]:not(:focus-visible)': { outline: '1px solid CanvasText', outlineOffset: '-1px' },
      },
    },
    inIconMode({ display: 'none' }),
  ),
)

/** Gives another element a submenu link's look and data attributes. */
export function sidebarMenuSubButtonVariants({
  size = 'md',
  isActive = false,
}: SidebarMenuSubButtonVariantOptions = {}): MixValue {
  return [
    menuSubButtonRule,
    attrs({
      'data-slot': 'sidebar-menu-sub-button',
      'data-sidebar': 'menu-sub-button',
      'data-size': size,
      ...(isActive ? { 'data-active': '' } : {}),
    }),
  ]
}

export interface SidebarMenuSubButtonProps
  extends Omit<Props<'a'>, 'href' | 'role'>, SidebarMenuSubButtonVariantOptions {
  href?: string
}

/** A native link in a submenu. */
export function SidebarMenuSubButton(handle: Handle<SidebarMenuSubButtonProps>) {
  return () => {
    let { size = 'md', isActive = false, mix, ...props } = handle.props
    return (
      <a
        data-slot="sidebar-menu-sub-button"
        data-sidebar="menu-sub-button"
        data-size={size}
        data-active={isActive ? '' : undefined}
        aria-current={isActive && props.href !== undefined ? 'page' : undefined}
        {...props}
        mix={[menuSubButtonRule, mix]}
      />
    )
  }
}
