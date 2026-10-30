import { css, on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { getOpenLayers } from '#remixcn/lib/layer.ts'
import { mobileQuery } from '#remixcn/lib/use-mobile.ts'
import {
  getSidebarContext,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from './sidebar.tsx'
import type { SidebarChangeReason, SidebarProps, SidebarProviderProps } from './sidebar.tsx'

// Browser tests run without theme.css, so the tokens the layout reads are set
// here. Without the duration tokens nothing transitions.
const tokens = css({ '--spacing': '0.25rem', '--radius-md': '0.25rem', '--text-sm': '0.875rem' })

function mount(t: TestContext, node: RemixNode) {
  let result = render(<div mix={tokens}>{node}</div>)
  t.after(() => {
    result.cleanup()
    for (let layer of getOpenLayers(document)) layer.release()
  })
  return result
}

function wait(ms = 20) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Waits for the provider's first task, the render it causes, and the frames that move focus. */
async function settle() {
  await wait()
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  await wait()
}

/** Pretends the viewport is narrow or wide for the sidebar's media query, and lets the test change it. */
function viewport(t: TestContext, narrow: boolean) {
  let listeners = new Set<(event: { matches: boolean }) => void>()
  let original = window.matchMedia.bind(window)
  let state = { narrow }
  t.mock.method(window, 'matchMedia', (query: string) => {
    if (query !== mobileQuery) return original(query)
    return {
      media: query,
      get matches() {
        return state.narrow
      },
      addEventListener(
        _type: string,
        listener: (event: { matches: boolean }) => void,
        options?: AddEventListenerOptions,
      ) {
        listeners.add(listener)
        options?.signal?.addEventListener('abort', () => listeners.delete(listener))
      },
      removeEventListener(_type: string, listener: (event: { matches: boolean }) => void) {
        listeners.delete(listener)
      },
    } as unknown as MediaQueryList
  })
  return {
    listeners,
    set(next: boolean) {
      state.narrow = next
      for (let listener of listeners) listener({ matches: next })
    },
  }
}

function press(target: EventTarget, init: KeyboardEventInit) {
  let event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

const ctrlB = { key: 'b', ctrlKey: true }

function pointer(type: string, target: Element) {
  let rect = target.getBoundingClientRect()
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: type !== 'pointerenter' && type !== 'pointerleave',
      cancelable: true,
      pointerId: 1,
      isPrimary: true,
      pointerType: 'mouse',
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }),
  )
}

function root(container: ParentNode) {
  let element = container.querySelector<HTMLElement>('[data-slot="sidebar"]')
  assert.ok(element, 'no sidebar')
  return element
}

function slot(container: ParentNode, name: string, index = 0) {
  let element = container.querySelectorAll<HTMLElement>(`[data-slot="${name}"]`)[index]
  assert.ok(element, `no ${name}`)
  return element
}

function link(container: ParentNode, name: string) {
  let found = [...container.querySelectorAll<HTMLElement>('a, button')].find(
    (element) => element.textContent?.trim() === name,
  )
  assert.ok(found, `no link or button named ${name}`)
  return found
}

function InboxIcon() {
  return () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4h16v16H4z" />
    </svg>
  )
}

interface AppProps {
  provider?: Omit<SidebarProviderProps, 'children'>
  sidebar?: Omit<SidebarProps, 'children'>
  items?: string[]
}

/** A sidebar with a menu of links, a submenu, an action and a rail, beside a page with the trigger. */
function App(handle: Handle<AppProps>) {
  return () => {
    let { provider = {}, sidebar = {}, items = ['Inbox', 'Drafts', 'Sent'] } = handle.props
    return (
      <SidebarProvider {...provider}>
        <Sidebar {...sidebar}>
          <SidebarHeader>
            <input aria-label="Search" />
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Mail</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item, index) => (
                    <SidebarMenuItem key={item}>
                      <SidebarMenuButton href={`#${item.toLowerCase()}`} isActive={index === 0} tooltip={item}>
                        <InboxIcon />
                        <span>{item}</span>
                      </SidebarMenuButton>
                      <SidebarMenuAction showOnHover>
                        <span>More for {item}</span>
                      </SidebarMenuAction>
                      {index === 0 ? (
                        <SidebarMenuSub>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton href="#unread">Unread</SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        </SidebarMenuSub>
                      ) : null}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>Signed in</SidebarFooter>
          <SidebarRail />
        </Sidebar>
        <SidebarInset>
          <SidebarTrigger />
          <textarea aria-label="Notes" />
          <p contenteditable="true">Draft</p>
        </SidebarInset>
      </SidebarProvider>
    )
  }
}

describe('Sidebar in the browser', () => {
  it('toggles the expanded state with the trigger, and says so with aria-expanded and aria-controls', async (t) => {
    viewport(t, false)
    let { container, act } = mount(t, <App />)
    await settle()
    let trigger = slot(container, 'sidebar-trigger')

    assert.equal(trigger.getAttribute('aria-expanded'), 'true')
    assert.equal(trigger.getAttribute('aria-controls'), slot(container, 'sidebar-container').id)
    assert.ok(!trigger.hasAttribute('aria-haspopup'))
    assert.ok(!root(container).hasAttribute('data-pending'))

    await act(() => trigger.click())
    assert.equal(root(container).dataset.state, 'collapsed')
    assert.equal(root(container).dataset.collapsible, 'offcanvas')
    assert.equal(trigger.getAttribute('aria-expanded'), 'false')

    await act(() => trigger.click())
    assert.equal(root(container).dataset.state, 'expanded')
    assert.equal(root(container).dataset.collapsible, '')
  })

  it('toggles with the rail, which stays out of the tab order and outside the inert parts', async (t) => {
    viewport(t, false)
    let { container, act } = mount(t, <App />)
    await settle()
    let rail = slot(container, 'sidebar-rail')

    await act(() => rail.click())
    assert.equal(root(container).dataset.state, 'collapsed')
    assert.ok(slot(container, 'sidebar-inner').inert)
    assert.ok(!rail.closest('[inert]'))
    assert.equal(rail.tabIndex, -1)

    await act(() => rail.click())
    assert.equal(root(container).dataset.state, 'expanded')
    assert.ok(!slot(container, 'sidebar-inner').inert)
  })

  it('reports each change with its reason, and a canceled change keeps the state', async (t) => {
    viewport(t, false)
    let changes: [boolean, SidebarChangeReason][] = []
    let cancel = true
    let { container, act } = mount(
      t,
      <App
        provider={{
          onOpenChange: (open, details) => {
            changes.push([open, details.reason])
            if (cancel) details.cancel()
          },
        }}
      />,
    )
    await settle()

    await act(() => slot(container, 'sidebar-trigger').click())
    assert.equal(root(container).dataset.state, 'expanded')
    cancel = false
    await act(() => slot(container, 'sidebar-rail').click())
    await act(() => press(document.body, ctrlB))

    assert.deepEqual(changes, [
      [false, 'trigger-press'],
      [false, 'rail-press'],
      [true, 'keyboard-shortcut'],
    ])
    assert.equal(root(container).dataset.state, 'expanded')
  })

  it("follows the caller's open state, also when it changes without a press", async (t) => {
    viewport(t, false)
    let asked: boolean[] = []
    let props = (open: boolean) => ({ open, onOpenChange: (next: boolean) => void asked.push(next) })
    let { container, root: app, act } = mount(t, <App provider={props(false)} />)
    await settle()

    assert.equal(root(container).dataset.state, 'collapsed')
    await act(() => slot(container, 'sidebar-trigger').click())
    assert.deepEqual(asked, [true])
    assert.equal(root(container).dataset.state, 'collapsed')

    await act(() =>
      app.render(
        <div mix={tokens}>
          <App provider={props(true)} />
        </div>,
      ),
    )
    assert.equal(root(container).dataset.state, 'expanded')
    assert.equal(slot(container, 'sidebar-trigger').getAttribute('aria-expanded'), 'true')
  })

  it('toggles with Ctrl+B or Cmd+B, but not from a text field, while an input method composes, or with Shift or Alt', async (t) => {
    viewport(t, false)
    let { container, act } = mount(t, <App />)
    await settle()
    let state = () => root(container).dataset.state

    let event = press(document.body, ctrlB)
    await act(() => {})
    assert.ok(event.defaultPrevented)
    assert.equal(state(), 'collapsed')
    await act(() => press(slot(container, 'sidebar-trigger'), { key: 'B', metaKey: true }))
    assert.equal(state(), 'expanded')

    for (let target of [
      container.querySelector('input')!,
      container.querySelector('textarea')!,
      container.querySelector('[contenteditable]')!,
    ]) {
      let ignored = press(target, ctrlB)
      await act(() => {})
      assert.equal(state(), 'expanded', `toggled from ${target.tagName}`)
      assert.ok(!ignored.defaultPrevented)
    }
    for (let init of [
      { ...ctrlB, isComposing: true },
      { ...ctrlB, shiftKey: true },
      { ...ctrlB, altKey: true },
      { key: 'b' },
    ]) {
      press(document.body, init)
      await act(() => {})
      assert.equal(state(), 'expanded', JSON.stringify(init))
    }
  })

  it('takes another key, or none, and follows a change of either', async (t) => {
    viewport(t, false)
    let { container, root: app, act } = mount(t, <App provider={{ keyboardShortcut: 'k' }} />)
    await settle()
    let state = () => root(container).dataset.state

    await act(() => press(document.body, ctrlB))
    assert.equal(state(), 'expanded')
    await act(() => press(document.body, { key: 'k', ctrlKey: true }))
    assert.equal(state(), 'collapsed')

    await act(() =>
      app.render(
        <div mix={tokens}>
          <App provider={{ keyboardShortcut: false }} />
        </div>,
      ),
    )
    let event = press(document.body, { key: 'k', ctrlKey: true })
    await act(() => press(document.body, ctrlB))
    assert.equal(state(), 'collapsed')
    assert.ok(!event.defaultPrevented)
  })

  it('gives the shortcut to the sidebar around focus, and outside every sidebar to the first one', async (t) => {
    viewport(t, false)
    let { container, act } = mount(
      t,
      <>
        <button type="button">Outside</button>
        <App />
        <App provider={{ keyboardShortcut: false }} items={['Calendar']} />
        <App items={['Contacts']} />
      </>,
    )
    await settle()
    let states = () => [0, 1, 2].map((index) => slot(container, 'sidebar', index).dataset.state)

    await act(() => press(link(container, 'Contacts'), ctrlB))
    assert.deepEqual(states(), ['expanded', 'expanded', 'collapsed'])
    await act(() => press(container.querySelector('button')!, ctrlB))
    assert.deepEqual(states(), ['collapsed', 'expanded', 'collapsed'])
    // A sidebar without the shortcut keeps the press to itself.
    await act(() => press(link(container, 'Calendar'), ctrlB))
    assert.deepEqual(states(), ['collapsed', 'expanded', 'collapsed'])
  })

  it("keeps a nested sidebar's shortcut, or its lack of one, from reaching the sidebar around it", async (t) => {
    viewport(t, false)
    function Nested(handle: Handle<{ inner: string | false }>) {
      return () => (
        <SidebarProvider>
          <Sidebar>
            <a href="#outer">Outer link</a>
          </Sidebar>
          <SidebarInset>
            <SidebarProvider keyboardShortcut={handle.props.inner}>
              <Sidebar>
                <a href="#inner">Inner link</a>
              </Sidebar>
            </SidebarProvider>
          </SidebarInset>
        </SidebarProvider>
      )
    }
    let { container, root: app, act } = mount(t, <Nested inner={false} />)
    await settle()
    let states = () => [0, 1].map((index) => slot(container, 'sidebar', index).dataset.state)
    let inner = () => link(container, 'Inner link')

    let ignored = press(inner(), ctrlB)
    await act(() => {})
    assert.deepEqual(states(), ['expanded', 'expanded'], 'Ctrl+B in a sidebar without a shortcut toggled one')
    assert.ok(!ignored.defaultPrevented)

    await act(() =>
      app.render(
        <div mix={tokens}>
          <Nested inner="k" />
        </div>,
      ),
    )
    await act(() => press(inner(), ctrlB))
    assert.deepEqual(states(), ['expanded', 'expanded'], 'Ctrl+B in a sidebar with another key toggled one')
    await act(() => press(inner(), { key: 'k', ctrlKey: true }))
    assert.deepEqual(states(), ['expanded', 'collapsed'])
    await act(() => press(link(container, 'Outer link'), ctrlB))
    assert.deepEqual(states(), ['collapsed', 'collapsed'])
  })

  it('stops listening to the keyboard and the viewport once it unmounts', async (t) => {
    let screen = viewport(t, false)
    let changes = 0
    let result = render(<App provider={{ onOpenChange: () => void changes++ }} />)
    await settle()
    assert.equal(screen.listeners.size, 1)

    result.cleanup()
    let event = press(document.body, ctrlB)
    screen.set(true)
    await settle()

    assert.equal(changes, 0)
    assert.ok(!event.defaultPrevented)
    assert.equal(screen.listeners.size, 0)
  })

  it('collapses off canvas to inert parts, and moves focus that was inside to the trigger', async (t) => {
    viewport(t, false)
    let { container, act } = mount(t, <App />)
    await settle()
    let drafts = link(container, 'Drafts')
    drafts.focus()

    await act(() => press(drafts, ctrlB))
    await settle()

    assert.ok(slot(container, 'sidebar-inner').inert)
    assert.equal(document.activeElement, slot(container, 'sidebar-trigger'))
  })

  it("keeps focus on a row collapsed to icons, and moves it from an action that hides to the action's row", async (t) => {
    viewport(t, false)
    let { container, act } = mount(t, <App sidebar={{ collapsible: 'icon' }} />)
    await settle()
    let drafts = link(container, 'Drafts')
    drafts.focus()

    await act(() => press(drafts, ctrlB))
    await settle()
    assert.equal(document.activeElement, drafts)
    assert.ok(!slot(container, 'sidebar-inner').inert)

    await act(() => press(drafts, ctrlB))
    let action = link(container, 'More for Sent')
    action.focus()
    await act(() => press(action, ctrlB))
    await settle()

    // The runner's frame is 800px wide, so the wide layout's styles apply.
    assert.equal(getComputedStyle(action).display, 'none')
    assert.equal(document.activeElement, link(container, 'Sent'))
  })

  it('shows each label in a tooltip only while collapsed to icons, also for items added later', async (t) => {
    viewport(t, false)
    let { container, root: app, act } = mount(t, <App sidebar={{ collapsible: 'icon' }} />)
    await settle()
    let tip = (name: string) => {
      let row = link(container, name)
      return row.parentElement!.querySelector<HTMLElement>('[data-slot="tooltip-content"]')!
    }

    pointer('pointerenter', link(container, 'Inbox'))
    await settle()
    assert.ok(!tip('Inbox').matches(':popover-open'))
    pointer('pointerleave', link(container, 'Inbox'))

    await act(() => slot(container, 'sidebar-trigger').click())
    await settle()
    pointer('pointerenter', link(container, 'Inbox'))
    await settle()
    assert.ok(tip('Inbox').matches(':popover-open'))
    assert.equal(tip('Inbox').textContent, 'Inbox')
    assert.ok(!link(container, 'Inbox').hasAttribute('aria-describedby'))
    pointer('pointerleave', link(container, 'Inbox'))
    await settle()

    await act(() =>
      app.render(
        <div mix={tokens}>
          <App sidebar={{ collapsible: 'icon' }} items={['Inbox', 'Drafts', 'Sent', 'Archive']} />
        </div>,
      ),
    )
    await settle()
    let archive = link(container, 'Archive')
    archive.focus()
    archive.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await settle()
    assert.ok(tip('Archive').matches(':popover-open') || !archive.matches(':focus-visible'))
    pointer('pointerenter', archive)
    await settle()
    assert.ok(tip('Archive').matches(':popover-open'))
  })

  it('opens a modal sheet on a narrow screen, and Escape closes it with focus back on the trigger', async (t) => {
    viewport(t, true)
    let changes: [boolean, SidebarChangeReason][] = []
    let { container, act } = mount(
      t,
      <App provider={{ onOpenMobileChange: (open, details) => void changes.push([open, details.reason]) }} />,
    )
    await settle()
    let trigger = slot(container, 'sidebar-trigger')
    let sheet = container.querySelector<HTMLDialogElement>('dialog[data-slot="sidebar"]')

    assert.ok(sheet, 'no sheet')
    assert.equal(sheet.dataset.mobile, 'true')
    assert.ok(!sheet.open)
    assert.equal(container.querySelectorAll('[data-slot="sidebar-container"]').length, 0)
    assert.equal(container.querySelectorAll('[data-slot="sidebar-rail"]').length, 0)
    assert.equal(trigger.getAttribute('aria-haspopup'), 'dialog')
    assert.equal(trigger.getAttribute('aria-controls'), sheet.id)
    assert.equal(trigger.getAttribute('aria-expanded'), 'false')

    trigger.focus()
    await act(() => trigger.click())
    await settle()
    assert.ok(sheet.matches(':modal'))
    assert.ok(sheet.contains(document.activeElement))
    assert.equal(trigger.getAttribute('aria-expanded'), 'true')
    assert.match(sheet.textContent ?? '', /^Sidebar/)

    await act(() => press(document.activeElement!, { key: 'Escape' }))
    await settle()
    assert.ok(!sheet.open)
    assert.equal(document.activeElement, trigger)
    assert.deepEqual(changes, [
      [true, 'trigger-press'],
      [false, 'escape-key'],
    ])
  })

  it('closes the sheet when a link in it navigates this tab, unless the caller keeps it open', async (t) => {
    viewport(t, true)
    let keep = false
    let changes: [boolean, SidebarChangeReason][] = []
    let { container, act } = mount(
      t,
      <App
        provider={{
          onOpenMobileChange: (open, details) => {
            changes.push([open, details.reason])
            if (keep) details.cancel()
          },
        }}
      />,
    )
    await settle()
    let trigger = slot(container, 'sidebar-trigger')
    let sheet = container.querySelector<HTMLDialogElement>('dialog[data-slot="sidebar"]')!
    let click = (target: Element, init: MouseEventInit = {}) =>
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }))
    // Keeps the test's frame where it is.
    let stay = (event: Event) => event.preventDefault()

    await act(() => trigger.click())
    await settle()
    sheet.addEventListener('click', stay)
    await act(() => click(link(sheet, 'Drafts'), { ctrlKey: true }))
    await act(() => click(sheet.querySelector('input')!))
    assert.ok(sheet.open, 'a ctrl-click or a press beside a link closed the sheet')
    sheet.removeEventListener('click', stay)

    keep = true
    await act(() => click(link(sheet, 'Drafts')))
    assert.ok(sheet.open, 'a canceled close closed the sheet')
    keep = false
    await act(() => click(link(sheet, 'Sent')))
    await settle()

    assert.ok(!sheet.open)
    assert.equal(document.activeElement, trigger)
    assert.deepEqual(changes, [
      [true, 'trigger-press'],
      [false, 'link-press'],
      [false, 'link-press'],
    ])
  })

  it('keeps the wide and narrow states apart', async (t) => {
    let screen = viewport(t, false)
    let wide: boolean[] = []
    let { container, act } = mount(
      t,
      <App provider={{ defaultOpen: false, onOpenChange: (open) => void wide.push(open) }} />,
    )
    await settle()
    screen.set(true)
    await settle()

    await act(() => press(document.body, ctrlB))
    await settle()
    let sheet = container.querySelector<HTMLDialogElement>('dialog[data-slot="sidebar"]')!
    assert.ok(sheet.open, 'the shortcut opened no sheet')
    // Focus starts in the search field, which keeps the shortcut; a link in the sheet passes it on.
    assert.equal(document.activeElement, sheet.querySelector('input'))
    let drafts = link(sheet, 'Drafts')
    drafts.focus()
    await act(() => press(drafts, ctrlB))
    await settle()
    assert.ok(!sheet.open, 'the shortcut in the sheet left it open')

    screen.set(false)
    await settle()
    assert.deepEqual(wide, [])
    assert.equal(root(container).dataset.state, 'collapsed')
  })

  it("keeps the caller's props and mixins on the sidebar across the breakpoint", async (t) => {
    let screen = viewport(t, false)
    let clicks: string[] = []
    let callerRule = css({ outline: '3px dotted red' })
    let { container } = mount(
      t,
      <SidebarProvider>
        <Sidebar
          aria-label="Main navigation"
          data-caller="yes"
          style={{ '--caller-gap': '7px' }}
          mix={[callerRule, on('click', (event) => void clicks.push(event.currentTarget.localName))]}
        >
          <a href="#inbox">Inbox</a>
        </Sidebar>
        <SidebarTrigger />
      </SidebarProvider>,
    )
    await settle()
    let check = (element: HTMLElement, layout: string) => {
      assert.equal(element.dataset.caller, 'yes', `${layout}: data-caller`)
      assert.equal(element.getAttribute('aria-label'), 'Main navigation', `${layout}: aria-label`)
      assert.equal(element.style.getPropertyValue('--caller-gap'), '7px', `${layout}: style`)
      assert.equal(getComputedStyle(element).outlineStyle, 'dotted', `${layout}: mixed-in css()`)
    }

    let wide = slot(container, 'sidebar-container')
    check(wide, 'wide')
    link(container, 'Inbox').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    screen.set(true)
    await settle()
    let sheet = container.querySelector<HTMLDialogElement>('dialog[data-slot="sidebar"]')!
    check(sheet, 'narrow')
    assert.equal(sheet.dataset.mobile, 'true')
    assert.ok(!sheet.hasAttribute('aria-labelledby'), 'the caller names the sheet')
    slot(container, 'sidebar-trigger').click()
    await settle()
    let event = new MouseEvent('click', { bubbles: true, cancelable: true })
    event.preventDefault()
    link(sheet, 'Inbox').dispatchEvent(event)

    assert.deepEqual(clicks, ['div', 'dialog'])
  })

  it('turns into the sheet when the viewport narrows, and focus inside goes to the trigger', async (t) => {
    let screen = viewport(t, false)
    let { container } = mount(t, <App />)
    await settle()
    link(container, 'Sent').focus()

    screen.set(true)
    await settle()

    assert.ok(container.querySelector('dialog[data-slot="sidebar"]'))
    assert.equal(document.activeElement, slot(container, 'sidebar-trigger'))
  })

  it('closes the sheet when the viewport widens, and focus goes back to the trigger', async (t) => {
    let screen = viewport(t, true)
    let changes: [boolean, SidebarChangeReason][] = []
    let { container, act } = mount(
      t,
      <App provider={{ onOpenMobileChange: (open, details) => void changes.push([open, details.reason]) }} />,
    )
    await settle()
    await act(() => slot(container, 'sidebar-trigger').click())
    await settle()

    screen.set(false)
    await settle()

    assert.equal(container.querySelectorAll('dialog').length, 0)
    assert.equal(root(container).dataset.state, 'expanded')
    assert.equal(document.activeElement, slot(container, 'sidebar-trigger'))
    assert.deepEqual(changes.at(-1), [false, 'viewport-change'])
    assert.ok(!document.documentElement.matches('[inert], :has(> body[inert])'))
  })

  it('saves its state nowhere, leaving persistence to the caller', async (t) => {
    viewport(t, false)
    let cookies = document.cookie
    let stored = localStorage.length + sessionStorage.length
    let { container, act } = mount(t, <App />)
    await settle()

    await act(() => slot(container, 'sidebar-trigger').click())
    await act(() => press(document.body, ctrlB))

    assert.equal(document.cookie, cookies)
    assert.equal(localStorage.length + sessionStorage.length, stored)
  })

  it('takes its widths from --sidebar-width and --sidebar-width-icon', async (t) => {
    viewport(t, false)
    let { container, act } = mount(
      t,
      <App
        provider={{ style: { '--sidebar-width': '20rem', '--sidebar-width-icon': '4rem' } }}
        sidebar={{ collapsible: 'icon' }}
      />,
    )
    await settle()
    let width = () => slot(container, 'sidebar-container').getBoundingClientRect().width
    let rem = parseFloat(getComputedStyle(document.documentElement).fontSize)

    assert.equal(width(), 20 * rem)
    await act(() => slot(container, 'sidebar-trigger').click())
    assert.equal(width(), 4 * rem)
  })

  it('updates the current page as isActive changes', async (t) => {
    viewport(t, false)
    function Menu(handle: Handle<{ current: string }>) {
      return () => (
        <SidebarProvider>
          <SidebarMenu>
            {['Inbox', 'Sent'].map((item) => (
              <SidebarMenuItem key={item}>
                <SidebarMenuButton href={`#${item}`} isActive={handle.props.current === item}>
                  {item}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarProvider>
      )
    }
    let { container, root: app, act } = mount(t, <Menu current="Inbox" />)
    await settle()

    await act(() =>
      app.render(
        <div mix={tokens}>
          <Menu current="Sent" />
        </div>,
      ),
    )

    assert.ok(!link(container, 'Inbox').hasAttribute('aria-current'))
    assert.ok(!link(container, 'Inbox').hasAttribute('data-active'))
    assert.equal(link(container, 'Sent').getAttribute('aria-current'), 'page')
    assert.ok(link(container, 'Sent').hasAttribute('data-active'))
  })

  it('shares its state with parts built on it, in place of useSidebar()', async (t) => {
    viewport(t, false)
    function Status(handle: Handle) {
      return () => {
        let sidebar = getSidebarContext(handle)
        return (
          <button type="button" mix={on('click', () => void sidebar.setOpen(!sidebar.open))}>
            {sidebar.state} {String(sidebar.isMobile)}
          </button>
        )
      }
    }
    let { container, act } = mount(
      t,
      <SidebarProvider>
        <Sidebar>Parts</Sidebar>
        <Status />
      </SidebarProvider>,
    )
    await settle()
    let status = container.querySelector('button')!

    assert.equal(status.textContent, 'expanded false')
    await act(() => status.click())
    assert.equal(status.textContent, 'collapsed false')
    assert.equal(root(container).dataset.state, 'collapsed')
  })
})
