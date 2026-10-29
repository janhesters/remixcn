import { css, on, ref } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import {
  Collapsible,
  CollapsibleChangeEvent,
  CollapsibleContent,
  CollapsibleTrigger,
  collapsibleChangeType,
} from './collapsible.tsx'

// Browser tests run without theme.css. Without --duration-normal the panel
// moves in 0s, as with reduced motion. Pass a duration to watch it move.
function mount(t: TestContext, node: RemixNode, { duration }: { duration?: string } = {}) {
  let container = document.createElement('div')
  if (duration) container.style.setProperty('--duration-normal', duration)
  document.body.append(container)

  let result = render(node, { container })
  t.after(result.cleanup)
  return result
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve))
}

async function settle(act: (fn: () => unknown) => Promise<void>) {
  // The panel leaves after its transition, then renders once more.
  for (let i = 0; i < 3; i++) {
    await act(() => nextFrame())
  }
}

function Filters(handle: Handle<{ defaultOpen?: boolean; keepMounted?: boolean; children?: RemixNode }>) {
  return () => (
    <Collapsible id="filters" defaultOpen={handle.props.defaultOpen}>
      <CollapsibleTrigger>Filters</CollapsibleTrigger>
      <CollapsibleContent keepMounted={handle.props.keepMounted}>
        <label>
          Due within <input name="days" defaultValue="14" />
        </label>
      </CollapsibleContent>
    </Collapsible>
  )
}

describe('Collapsible in the browser', () => {
  it('opens and closes its panel from the trigger', async (t) => {
    let { $, act } = mount(t, <Filters />)
    let trigger = $('button') as HTMLButtonElement

    await act(() => trigger.click())
    let panel = $('[data-slot="collapsible-content"]') as HTMLElement

    assert.equal(trigger.getAttribute('aria-expanded'), 'true')
    assert.equal(trigger.getAttribute('aria-controls'), panel.id)
    assert.ok($('[data-slot="collapsible"]')?.hasAttribute('data-open'))
    assert.ok(panel.hasAttribute('data-open'))

    await act(() => trigger.click())
    await settle(act)

    assert.equal(trigger.getAttribute('aria-expanded'), 'false')
    assert.equal(trigger.getAttribute('aria-controls'), null)
    assert.equal($('[data-slot="collapsible-content"]'), null)
    assert.ok($('[data-slot="collapsible"]')?.hasAttribute('data-closed'))
  })

  it('hides a kept panel instead of removing it, and keeps what was typed', async (t) => {
    let { $, act } = mount(t, <Filters defaultOpen keepMounted />)
    let trigger = $('button') as HTMLButtonElement
    let input = $('input') as HTMLInputElement
    input.value = '30'

    await act(() => trigger.click())
    await settle(act)
    let panel = $('[data-slot="collapsible-content"]') as HTMLElement

    assert.equal(panel.hidden, true)
    assert.ok(panel.hasAttribute('data-closed'))

    await act(() => trigger.click())
    await settle(act)

    assert.equal(panel.hidden, false)
    assert.equal(($('input') as HTMLInputElement).value, '30')
  })

  it('announces a change before it happens, and keeps its state when the change is cancelled', async (t) => {
    let seen: boolean[] = []
    let cancel = true
    let { $, act } = mount(
      t,
      <div
        mix={on(collapsibleChangeType, (event) => {
          seen.push(event.open)
          assert.ok(event instanceof CollapsibleChangeEvent)
          if (cancel) event.preventDefault()
        })}
      >
        <Filters />
      </div>,
    )
    let trigger = $('button') as HTMLButtonElement

    await act(() => trigger.click())
    assert.equal(trigger.getAttribute('aria-expanded'), 'false')

    cancel = false
    await act(() => trigger.click())
    assert.equal(trigger.getAttribute('aria-expanded'), 'true')
    assert.deepEqual(seen, [true, true])
  })

  it('lets a click handler of the caller cancel the toggle', async (t) => {
    let { $, act } = mount(
      t,
      <Collapsible>
        <CollapsibleTrigger mix={on('click', (event) => event.preventDefault())}>Filters</CollapsibleTrigger>
        <CollapsibleContent>Due this week</CollapsibleContent>
      </Collapsible>,
    )

    await act(() => ($('button') as HTMLButtonElement).click())

    assert.equal($('button')?.getAttribute('aria-expanded'), 'false')
  })

  it('changes a controlled collapsible only when its owner renders the new state', async (t) => {
    function Controlled(handle: Handle) {
      let open = false
      let accept = false

      return () => (
        <div>
          <label>
            <input
              type="checkbox"
              aria-label="Accept"
              mix={on('change', (event) => {
                accept = event.currentTarget.checked
              })}
            />
          </label>
          <Collapsible
            open={open}
            mix={on(collapsibleChangeType, (event) => {
              if (!accept) return
              open = event.open
              void handle.update()
            })}
          >
            <CollapsibleTrigger>Filters</CollapsibleTrigger>
            <CollapsibleContent>Due this week</CollapsibleContent>
          </Collapsible>
        </div>
      )
    }
    let { $, act } = mount(t, <Controlled />)
    let trigger = $('button') as HTMLButtonElement

    await act(() => trigger.click())
    assert.equal(trigger.getAttribute('aria-expanded'), 'false')
    assert.equal($('[data-slot="collapsible-content"]'), null)

    await act(() => ($('input') as HTMLInputElement).click())
    await act(() => trigger.click())
    assert.equal(trigger.getAttribute('aria-expanded'), 'true')
    assert.ok($('[data-slot="collapsible-content"]'))
  })

  it('ignores the trigger while disabled, and follows the disabled prop', async (t) => {
    function Toggle(handle: Handle) {
      let disabled = true
      return () => (
        <div>
          <button
            type="button"
            data-action="enable"
            mix={on('click', () => {
              disabled = false
              void handle.update()
            })}
          >
            Enable
          </button>
          <Collapsible disabled={disabled}>
            <CollapsibleTrigger>Filters</CollapsibleTrigger>
            <CollapsibleContent>Due this week</CollapsibleContent>
          </Collapsible>
        </div>
      )
    }
    let { $, act } = mount(t, <Toggle />)
    let trigger = $('[data-slot="collapsible-trigger"]') as HTMLButtonElement

    assert.equal(trigger.disabled, true)
    await act(() => trigger.click())
    assert.equal(trigger.getAttribute('aria-expanded'), 'false')

    await act(() => ($('[data-action="enable"]') as HTMLButtonElement).click())
    assert.equal(trigger.disabled, false)
    await act(() => trigger.click())
    assert.equal(trigger.getAttribute('aria-expanded'), 'true')
  })

  it('keeps a closing panel until its transition ends', async (t) => {
    let { $, act } = mount(t, <Filters defaultOpen />, { duration: '150ms' })
    let trigger = $('button') as HTMLButtonElement
    let panel = $('[data-slot="collapsible-content"]') as HTMLElement

    await act(() => trigger.click())
    await settle(act)

    assert.equal(trigger.getAttribute('aria-expanded'), 'false')
    assert.equal($('[data-slot="collapsible-content"]'), panel)
    assert.ok(panel.hasAttribute('data-ending-style'))
    assert.ok(panel.getAnimations().length > 0, 'the height transitions')

    await new Promise((resolve) => setTimeout(resolve, 250))
    await settle(act)

    assert.equal($('[data-slot="collapsible-content"]'), null)
  })

  it('lets nothing in a closing panel take focus, and gives focus back when it opens again', async (t) => {
    let { $, act } = mount(t, <Filters defaultOpen />, { duration: '400ms' })
    let trigger = $('button') as HTMLButtonElement
    let panel = $('[data-slot="collapsible-content"]') as HTMLElement
    let input = $('input') as HTMLInputElement

    await act(() => trigger.click())
    await settle(act)
    input.focus()

    assert.ok(panel.hasAttribute('data-ending-style'), 'still closing')
    assert.ok(panel.inert)
    assert.notEqual(document.activeElement, input)

    await act(() => trigger.click())
    await settle(act)
    input.focus()

    assert.equal(panel.inert, false)
    assert.equal(document.activeElement, input)
  })

  it("keeps the caller's inert while the panel is open, closes and opens again", async (t) => {
    let { $, act } = mount(
      t,
      <Collapsible defaultOpen>
        <CollapsibleTrigger>Filters</CollapsibleTrigger>
        <CollapsibleContent inert keepMounted>
          <input aria-label="Due within" />
        </CollapsibleContent>
      </Collapsible>,
      { duration: '400ms' },
    )
    let trigger = $('button') as HTMLButtonElement
    let panel = $('[data-slot="collapsible-content"]') as HTMLElement

    assert.equal(panel.inert, true)
    await act(() => trigger.click())
    await settle(act)
    assert.equal(panel.inert, true, 'while it closes')
    await act(() => trigger.click())
    await settle(act)
    assert.equal(panel.inert, true, 'once it opens again')
  })

  it('keeps a closing panel that opens again, without its closing state', async (t) => {
    let { $, act } = mount(t, <Filters defaultOpen />, { duration: '150ms' })
    let trigger = $('button') as HTMLButtonElement
    let panel = $('[data-slot="collapsible-content"]') as HTMLElement

    await act(() => trigger.click())
    await settle(act)
    await act(() => trigger.click())
    await new Promise((resolve) => setTimeout(resolve, 250))
    await settle(act)

    assert.equal($('[data-slot="collapsible-content"]'), panel)
    assert.ok(!panel.hasAttribute('data-ending-style'))
    assert.ok(!panel.hasAttribute('data-animating'))
    assert.equal(panel.style.getPropertyValue('--collapsible-panel-height'), '')
    assert.equal(panel.getBoundingClientRect().height, panel.scrollHeight)
  })

  it('grows an opening panel from 0 to its content height', async (t) => {
    let { $, act } = mount(t, <Filters />, { duration: '150ms' })

    await act(() => ($('button') as HTMLButtonElement).click())
    let panel = $('[data-slot="collapsible-content"]') as HTMLElement
    let [transition] = panel.getAnimations() as CSSTransition[]

    assert.equal(transition?.transitionProperty, 'height')
    assert.ok(panel.hasAttribute('data-animating'))
    assert.ok(panel.getBoundingClientRect().height < panel.scrollHeight)

    await transition.finished
    await settle(act)

    assert.ok(!panel.hasAttribute('data-animating'))
    assert.equal(panel.style.getPropertyValue('--collapsible-panel-height'), '')
    assert.equal(panel.getBoundingClientRect().height, panel.scrollHeight)
  })

  it('moves focus from a closing panel to its trigger', async (t) => {
    function Outside(handle: Handle) {
      let open = true
      return () => (
        <div>
          <Collapsible open={open}>
            <CollapsibleTrigger>Filters</CollapsibleTrigger>
            <CollapsibleContent>
              <button
                type="button"
                mix={on('click', () => {
                  open = false
                  void handle.update()
                })}
              >
                Apply
              </button>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )
    }
    let { $, act } = mount(t, <Outside />)
    let apply = $('[data-slot="collapsible-content"] button') as HTMLButtonElement
    apply.focus()

    await act(() => apply.click())
    await settle(act)

    assert.equal(document.activeElement, $('[data-slot="collapsible-trigger"]'))
    assert.equal($('[data-slot="collapsible-content"]'), null)
  })

  it('opens a hidden-until-found panel when the browser finds text in it', async (t) => {
    let { $, act } = mount(
      t,
      <Collapsible>
        <CollapsibleTrigger>Shipping</CollapsibleTrigger>
        <CollapsibleContent hiddenUntilFound>Express delivery takes two days.</CollapsibleContent>
      </Collapsible>,
    )
    let panel = $('[data-slot="collapsible-content"]') as HTMLElement
    assert.equal(panel.getAttribute('hidden'), 'until-found')

    // The browser removes hidden itself, then fires beforematch.
    await act(() => {
      panel.removeAttribute('hidden')
      panel.dispatchEvent(new Event('beforematch', { bubbles: true }))
    })
    await settle(act)

    assert.equal($('button')?.getAttribute('aria-expanded'), 'true')
    assert.equal(panel.hasAttribute('hidden'), false)
    assert.ok(!panel.hasAttribute('data-animating'))
  })

  it('hides a found panel again when a listener cancels the change, or its owner keeps it closed', async (t) => {
    let { $$, act } = mount(
      t,
      <div>
        <Collapsible mix={on(collapsibleChangeType, (event) => event.preventDefault())}>
          <CollapsibleTrigger>Shipping</CollapsibleTrigger>
          <CollapsibleContent hiddenUntilFound>Express delivery takes two days.</CollapsibleContent>
        </Collapsible>
        <Collapsible open={false}>
          <CollapsibleTrigger>Returns</CollapsibleTrigger>
          <CollapsibleContent hiddenUntilFound>Returns are free for 30 days.</CollapsibleContent>
        </Collapsible>
      </div>,
    )
    let panels = [...$$('[data-slot="collapsible-content"]')] as HTMLElement[]

    for (let panel of panels) {
      await act(() => {
        panel.removeAttribute('hidden')
        panel.dispatchEvent(new Event('beforematch', { bubbles: true }))
      })
    }
    await settle(act)

    assert.deepEqual(
      panels.map((panel) => panel.getAttribute('hidden')),
      ['until-found', 'until-found'],
    )
  })

  it('keeps separate state per instance', async (t) => {
    let { $$, act } = mount(
      t,
      <div>
        <Filters />
        <Filters defaultOpen />
      </div>,
    )
    let [first, second] = $$('[data-slot="collapsible-trigger"]') as NodeListOf<HTMLButtonElement>

    await act(() => first.click())

    assert.equal(first.getAttribute('aria-expanded'), 'true')
    assert.equal(second.getAttribute('aria-expanded'), 'true')
    await act(() => second.click())
    await settle(act)
    assert.equal(first.getAttribute('aria-expanded'), 'true')
    assert.equal(second.getAttribute('aria-expanded'), 'false')
  })

  it("runs the caller's refs, events and styles on each part", async (t) => {
    let nodes: string[] = []
    let clicks = 0
    let { $, act } = mount(
      t,
      <Collapsible defaultOpen mix={ref((node) => nodes.push(node.dataset.slot ?? ''))}>
        <CollapsibleTrigger
          mix={[ref((node) => nodes.push(node.dataset.slot ?? '')), on('click', () => void clicks++)]}
        >
          Filters
        </CollapsibleTrigger>
        <CollapsibleContent mix={[ref((node) => nodes.push(node.dataset.slot ?? '')), css({ columnGap: '3px' })]}>
          Due this week
        </CollapsibleContent>
      </Collapsible>,
    )

    await act(() => ($('button') as HTMLButtonElement).click())

    assert.deepEqual(nodes.sort(), ['collapsible', 'collapsible-content', 'collapsible-trigger'])
    assert.equal(clicks, 1)
    assert.equal(getComputedStyle($('[data-slot="collapsible-content"]') as Element).columnGap, '3px')
  })

  it('stops its transition when it leaves the document', async (t) => {
    function Host(handle: Handle) {
      let shown = true
      return () => (
        <div>
          <button
            type="button"
            data-action="remove"
            mix={on('click', () => {
              shown = false
              void handle.update()
            })}
          >
            Remove
          </button>
          {shown ? <Filters defaultOpen /> : null}
        </div>
      )
    }
    let errors: unknown[] = []
    let onError = (event: ErrorEvent) => errors.push(event.error)
    window.addEventListener('error', onError)
    t.after(() => window.removeEventListener('error', onError))
    let { $, act } = mount(t, <Host />, { duration: '150ms' })

    await act(() => ($('[data-slot="collapsible-trigger"]') as HTMLButtonElement).click())
    await act(() => ($('[data-action="remove"]') as HTMLButtonElement).click())
    await new Promise((resolve) => setTimeout(resolve, 250))
    await settle(act)

    assert.equal($('[data-slot="collapsible"]'), null)
    assert.deepEqual(errors, [])
  })
})
