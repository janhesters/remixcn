import { on, ref } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { Tabs, TabsChangeEvent, TabsContent, TabsList, TabsTrigger, tabsChangeType } from './tabs.tsx'
import type { TabsListProps, TabsProps } from './tabs.tsx'

function mount(t: TestContext, node: RemixNode) {
  let container = document.createElement('div')
  document.body.append(container)
  let result = render(node, { container })
  t.after(result.cleanup)
  return result
}

function press(key: string) {
  let target = document.activeElement ?? document.body
  let event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  target.dispatchEvent(event)
  return event
}

function tick() {
  return new Promise((resolve) => setTimeout(resolve))
}

const sections = [
  { value: 'account', label: 'Account', text: 'Profile details' },
  { value: 'password', label: 'Password', text: 'Change your password' },
  { value: 'alerts', label: 'Alerts', text: 'Choose your alerts' },
]

interface SettingsProps extends TabsProps {
  items?: typeof sections
  disabledTab?: string
  list?: TabsListProps
}

function Settings(handle: Handle<SettingsProps>) {
  return () => {
    let { items = sections, disabledTab, list, ...props } = handle.props
    return (
      <Tabs {...props}>
        <TabsList aria-label="Settings" {...list}>
          {items.map((item) => (
            <TabsTrigger key={item.value} value={item.value} disabled={item.value === disabledTab}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {items.map((item) => (
          <TabsContent key={item.value} value={item.value}>
            {item.text}
            <button type="button">Edit {item.label}</button>
          </TabsContent>
        ))}
      </Tabs>
    )
  }
}

function tab(container: HTMLElement, name: string) {
  let found = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
    (node) => node.textContent === name,
  )
  if (!found) throw new Error(`No tab named ${name}`)
  return found
}

function selectedTabs(container: HTMLElement) {
  return [...container.querySelectorAll('[role="tab"][aria-selected="true"]')].map((node) => node.textContent)
}

function visiblePanels(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>('[role="tabpanel"]')]
    .filter((panel) => !panel.hidden)
    .map((panel) => panel.firstChild?.textContent)
}

function tabStops(container: HTMLElement) {
  return [...container.querySelectorAll('[role="tab"]')]
    .filter((node) => node.getAttribute('tabindex') === '0')
    .map((node) => node.textContent)
}

describe('Tabs in the browser', () => {
  it('selects a tab on click and shows only its panel', async (t) => {
    let { container, act } = mount(t, <Settings />)

    await act(() => tab(container, 'Password').click())

    assert.deepEqual(selectedTabs(container), ['Password'])
    assert.deepEqual(visiblePanels(container), ['Change your password'])
    let panel = container.querySelector('[role="tabpanel"]') as HTMLElement
    assert.equal(tab(container, 'Password').getAttribute('aria-controls'), panel.id)
    assert.equal(panel.getAttribute('aria-labelledby'), tab(container, 'Password').id)
  })

  it('points a tab at its panel only while the panel is there', async (t) => {
    function Segmented(handle: Handle) {
      let withPanels = false
      return () => (
        <div>
          <Tabs defaultValue="day">
            <TabsList aria-label="Range">
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
            </TabsList>
            {withPanels ? <TabsContent value="day">Today</TabsContent> : null}
            {withPanels ? <TabsContent value="week">This week</TabsContent> : null}
          </Tabs>
          <button
            type="button"
            data-action="toggle"
            mix={on('click', () => {
              withPanels = !withPanels
              void handle.update()
            })}
          >
            Panels
          </button>
        </div>
      )
    }
    let { container, act } = mount(t, <Segmented />)
    let toggle = container.querySelector('[data-action="toggle"]') as HTMLButtonElement

    await act(() => tick())
    assert.equal(tab(container, 'Day').getAttribute('aria-controls'), null)

    await act(() => toggle.click())
    await act(() => tick())
    let panel = container.querySelector('[role="tabpanel"]') as HTMLElement
    assert.equal(tab(container, 'Day').getAttribute('aria-controls'), panel.id)

    await act(() => tab(container, 'Week').click())
    assert.equal(tab(container, 'Day').getAttribute('aria-controls'), null)
    assert.equal(
      tab(container, 'Week').getAttribute('aria-controls'),
      (container.querySelector('[role="tabpanel"]') as HTMLElement).id,
    )

    await act(() => toggle.click())
    await act(() => tick())
    assert.equal(tab(container, 'Week').getAttribute('aria-controls'), null)
  })

  it('shows the panel of the first tab without a value, also when the panels come before the list', async (t) => {
    let { container, act } = mount(
      t,
      <Tabs>
        <TabsContent value="inbox">Inbox panel</TabsContent>
        <TabsContent value="sent">Sent panel</TabsContent>
        <TabsList aria-label="Mail">
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
        </TabsList>
      </Tabs>,
    )
    await act(() => tick())

    assert.deepEqual(selectedTabs(container), ['Inbox'])
    assert.deepEqual(visiblePanels(container), ['Inbox panel'])
  })

  it('moves focus with the arrow keys and selects with a click, Enter or Space, by default', async (t) => {
    let { container, act } = mount(t, <Settings />)
    tab(container, 'Account').focus()

    assert.deepEqual(tabStops(container), ['Account'])
    await act(() => press('ArrowRight'))
    assert.equal(document.activeElement, tab(container, 'Password'))
    assert.deepEqual(selectedTabs(container), ['Account'])

    await act(() => press('End'))
    assert.equal(document.activeElement, tab(container, 'Alerts'))
    await act(() => press('ArrowRight'))
    assert.equal(document.activeElement, tab(container, 'Account'), 'wraps around')
    await act(() => press('Home'))
    await act(() => press('ArrowLeft'))
    assert.equal(document.activeElement, tab(container, 'Alerts'))

    // Enter and Space activate a native button with a click.
    await act(() => (document.activeElement as HTMLButtonElement).click())
    assert.deepEqual(selectedTabs(container), ['Alerts'])
  })

  it('selects a tab as focus reaches it with activateOnFocus', async (t) => {
    let { container, act } = mount(t, <Settings list={{ activateOnFocus: true }} />)
    tab(container, 'Account').focus()

    await act(() => press('ArrowRight'))

    assert.deepEqual(selectedTabs(container), ['Password'])
    assert.deepEqual(visiblePanels(container), ['Change your password'])
  })

  it('moves up and down in a vertical list, and stops at the ends without loopFocus', async (t) => {
    let { container, act } = mount(t, <Settings orientation="vertical" list={{ loopFocus: false }} />)
    tab(container, 'Account').focus()

    await act(() => press('ArrowRight'))
    assert.equal(document.activeElement, tab(container, 'Account'))
    await act(() => press('ArrowDown'))
    assert.equal(document.activeElement, tab(container, 'Password'))
    await act(() => press('End'))
    await act(() => press('ArrowDown'))
    assert.equal(document.activeElement, tab(container, 'Alerts'))
  })

  it('swaps the left and right arrows in right-to-left text', async (t) => {
    let { container, act } = mount(
      t,
      <div dir="rtl">
        <Settings />
      </div>,
    )
    tab(container, 'Account').focus()

    await act(() => press('ArrowLeft'))

    assert.equal(document.activeElement, tab(container, 'Password'))
  })

  it('skips a disabled tab with the arrows and ignores clicks on it', async (t) => {
    let { container, act } = mount(t, <Settings disabledTab="password" />)
    tab(container, 'Account').focus()

    await act(() => press('ArrowRight'))
    assert.equal(document.activeElement, tab(container, 'Alerts'))
    await act(() => tab(container, 'Password').click())
    assert.deepEqual(selectedTabs(container), ['Account'])
  })

  it('announces a change before it happens, and keeps the tab when cancelled', async (t) => {
    let seen: Array<[string | null, string]> = []
    let cancel = true
    let { container, act } = mount(
      t,
      <div
        mix={on(tabsChangeType, (event) => {
          assert.ok(event instanceof TabsChangeEvent)
          seen.push([event.value, event.reason])
          if (cancel) event.preventDefault()
        })}
      >
        <Settings />
      </div>,
    )

    await act(() => tab(container, 'Alerts').click())
    assert.deepEqual(selectedTabs(container), ['Account'])

    cancel = false
    await act(() => tab(container, 'Alerts').click())
    assert.deepEqual(selectedTabs(container), ['Alerts'])
    assert.deepEqual(seen, [
      ['alerts', 'none'],
      ['alerts', 'none'],
    ])
  })

  it('changes controlled tabs only when their owner renders the new value', async (t) => {
    function Controlled(handle: Handle) {
      let value = 'account'
      let accept = false
      return () => (
        <div>
          <button type="button" data-action="accept" mix={on('click', () => void (accept = true))}>
            Accept
          </button>
          <Settings
            value={value}
            mix={on(tabsChangeType, (event) => {
              if (!accept || event.value === null) return
              value = event.value
              void handle.update()
            })}
          />
        </div>
      )
    }
    let { container, act } = mount(t, <Controlled />)

    await act(() => tab(container, 'Alerts').click())
    assert.deepEqual(selectedTabs(container), ['Account'])

    await act(() => (container.querySelector('[data-action="accept"]') as HTMLButtonElement).click())
    await act(() => tab(container, 'Alerts').click())
    assert.deepEqual(selectedTabs(container), ['Alerts'])
  })

  it('moves to the first enabled tab when the selected tab is removed or disabled, and keeps focus in the list', async (t) => {
    let reasons: string[] = []
    function Changing(handle: Handle) {
      let items = sections
      let disabledTab: string | undefined
      return () => (
        <div mix={on(tabsChangeType, (event) => void reasons.push(`${event.value} ${event.reason}`))}>
          <Settings defaultValue="password" items={items} disabledTab={disabledTab} />
          <button
            type="button"
            data-action="remove"
            mix={on('click', () => {
              items = sections.filter((item) => item.value !== 'password')
              void handle.update()
            })}
          >
            Remove
          </button>
          <button
            type="button"
            data-action="disable"
            mix={on('click', () => {
              disabledTab = 'account'
              void handle.update()
            })}
          >
            Disable
          </button>
        </div>
      )
    }
    let { container, act } = mount(t, <Changing />)
    let password = tab(container, 'Password')
    password.focus()

    await act(() => {
      ;(container.querySelector('[data-action="remove"]') as HTMLButtonElement).dispatchEvent(new MouseEvent('click'))
    })
    await tick()
    await act(() => tick())

    assert.deepEqual(selectedTabs(container), ['Account'])
    assert.deepEqual(visiblePanels(container), ['Profile details'])
    assert.equal(document.activeElement, tab(container, 'Account'))

    await act(() => {
      ;(container.querySelector('[data-action="disable"]') as HTMLButtonElement).dispatchEvent(new MouseEvent('click'))
    })
    await tick()
    await act(() => tick())

    assert.deepEqual(selectedTabs(container), ['Alerts'])
    assert.equal(document.activeElement, tab(container, 'Alerts'))
    assert.deepEqual(reasons, ['account missing', 'alerts disabled'])
  })

  it('keeps the value of controlled tabs when their tab goes away', async (t) => {
    function Owner(handle: Handle) {
      let items = sections
      return () => (
        <div>
          <Settings value="alerts" items={items} />
          <button
            type="button"
            data-action="remove"
            mix={on('click', () => {
              items = sections.slice(0, 2)
              void handle.update()
            })}
          >
            Remove
          </button>
        </div>
      )
    }
    let { container, act } = mount(t, <Owner />)

    await act(() => (container.querySelector('[data-action="remove"]') as HTMLButtonElement).click())
    await act(() => tick())

    assert.deepEqual(selectedTabs(container), [])
    assert.deepEqual(visiblePanels(container), [])
    assert.deepEqual(tabStops(container), ['Account'])
  })

  it('keeps the selection and focus with a tab when tabs are reordered', async (t) => {
    function Reordering(handle: Handle) {
      let items = sections
      return () => (
        <div>
          <Settings defaultValue="password" items={items} />
          <button
            type="button"
            data-action="reverse"
            mix={on('click', () => {
              items = [...sections].reverse()
              void handle.update()
            })}
          >
            Reverse
          </button>
        </div>
      )
    }
    let { container, act } = mount(t, <Reordering />)
    let password = tab(container, 'Password')
    let alerts = tab(container, 'Alerts')
    alerts.focus()

    await act(() => (container.querySelector('[data-action="reverse"]') as HTMLButtonElement).click())
    await act(() => tick())

    assert.deepEqual(
      [...container.querySelectorAll('[role="tab"]')].map((node) => node.textContent),
      ['Alerts', 'Password', 'Account'],
    )
    assert.deepEqual(selectedTabs(container), ['Password'])
    assert.equal(tab(container, 'Password'), password)
    assert.equal(document.activeElement, alerts)
  })

  it('moves focus from a panel that hides to the newly selected tab', async (t) => {
    function Wizard(handle: Handle) {
      let value = 'account'
      return () => (
        <Tabs value={value}>
          <TabsList aria-label="Steps">
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
          </TabsList>
          <TabsContent value="account">
            <button
              type="button"
              mix={on('click', () => {
                value = 'password'
                void handle.update()
              })}
            >
              Next
            </button>
          </TabsContent>
          <TabsContent value="password">Choose a password</TabsContent>
        </Tabs>
      )
    }
    let { container, act } = mount(t, <Wizard />)
    let next = container.querySelector('[role="tabpanel"] button') as HTMLButtonElement
    next.focus()

    await act(() => next.click())

    assert.equal(document.activeElement, tab(container, 'Password'))
  })

  it('moves the tab stop to the tab its owner selects while focus is outside the list', async (t) => {
    function Owner(handle: Handle) {
      let value = 'account'
      return () => (
        <div>
          <button
            type="button"
            data-action="alerts"
            mix={on('click', () => {
              value = 'alerts'
              void handle.update()
            })}
          >
            Show alerts
          </button>
          <Settings value={value} />
        </div>
      )
    }
    let { container, act } = mount(t, <Owner />)
    let before = container.querySelector('[data-action="alerts"]') as HTMLButtonElement
    before.focus()

    await act(() => before.click())
    await act(() => tick())

    assert.deepEqual(selectedTabs(container), ['Alerts'])
    assert.deepEqual(tabStops(container), ['Alerts'])
  })

  it('returns the tab stop to the selected tab when focus leaves the list', async (t) => {
    let { container, act } = mount(t, <Settings />)
    tab(container, 'Account').focus()

    await act(() => press('ArrowRight'))
    assert.deepEqual(tabStops(container), ['Password'])
    ;(container.querySelector('[role="tabpanel"] button') as HTMLButtonElement).focus()

    assert.deepEqual(tabStops(container), ['Account'])
  })

  it('keeps separate state per instance, also when nested in a panel', async (t) => {
    let { container, act } = mount(
      t,
      <Tabs defaultValue="outer-a">
        <TabsList aria-label="Outer">
          <TabsTrigger value="outer-a">Outer A</TabsTrigger>
          <TabsTrigger value="outer-b">Outer B</TabsTrigger>
        </TabsList>
        <TabsContent value="outer-a">
          <Tabs>
            <TabsList aria-label="Inner">
              <TabsTrigger value="inner-a">Inner A</TabsTrigger>
              <TabsTrigger value="inner-b">Inner B</TabsTrigger>
            </TabsList>
            <TabsContent value="inner-a">Inner first</TabsContent>
            <TabsContent value="inner-b">Inner second</TabsContent>
          </Tabs>
        </TabsContent>
        <TabsContent value="outer-b">Outer second</TabsContent>
      </Tabs>,
    )

    await act(() => tab(container, 'Inner B').click())
    await act(() => tick())

    assert.deepEqual(selectedTabs(container), ['Outer A', 'Inner B'])
    let ids = [...container.querySelectorAll('[id]')].map((node) => node.id)
    assert.equal(new Set(ids).size, ids.length)
  })

  it("runs the caller's refs and events on each part, and lets a click handler cancel", async (t) => {
    let slots: string[] = []
    let record = ref((node: HTMLElement) => void slots.push(node.dataset.slot ?? ''))
    let { container, act } = mount(
      t,
      <Tabs mix={record} defaultValue="a">
        <TabsList mix={record}>
          <TabsTrigger value="a" mix={record}>
            A
          </TabsTrigger>
          <TabsTrigger value="b" mix={on('click', (event) => event.preventDefault())}>
            B
          </TabsTrigger>
        </TabsList>
        <TabsContent value="a" mix={record}>
          First
        </TabsContent>
      </Tabs>,
    )

    await act(() => tab(container, 'B').click())

    assert.deepEqual(selectedTabs(container), ['A'])
    assert.deepEqual(slots.sort(), ['tabs', 'tabs-content', 'tabs-list', 'tabs-trigger'])
  })
})
