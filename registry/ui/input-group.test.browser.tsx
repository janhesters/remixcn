import { css, on, ref } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from './input-group.tsx'

function mount(t: TestContext, node: RemixNode) {
  let result = render(node)
  t.after(result.cleanup)
  return result
}

// The browser tests run without theme.css, so the container sets the tokens they measure.
const tokens = {
  '--input': 'rgb(120, 120, 120)',
  '--ring': 'rgb(0, 0, 200)',
  '--destructive': 'rgb(200, 0, 0)',
  '--muted-foreground': 'rgb(90, 90, 90)',
  '--spacing': '4px',
  '--radius-md': '6px',
  '--radius-sm': '2px',
  '--text-xs': '12px',
  '--text-xs--line-height': '16px',
  '--text-sm': '14px',
  '--text-sm--line-height': '20px',
  '--text-base': '16px',
  '--text-base--line-height': '24px',
  width: '320px',
}
// theme.css sizes every box by its border and gives controls the page's font.
const reset = css({ '&, & *': { boxSizing: 'border-box' }, '& :where(button, input, textarea)': { font: 'inherit' } })

function find<T extends Element>(container: Element, selector: string, type: new () => T): T {
  let found = container.querySelector(selector)
  assert.ok(found instanceof type, `no ${selector}`)
  return found
}

function group(container: Element, index = 0) {
  let found = container.querySelectorAll('[data-slot="input-group"]')[index]
  assert.ok(found instanceof HTMLElement, `no input group ${index}`)
  return found
}

function rect(element: Element) {
  return element.getBoundingClientRect()
}

// Shows an error under the amount while it is empty, as a form owner would.
function AmountWithError(handle: Handle) {
  let amount = ''

  return () => {
    let invalid = amount === ''

    return (
      <div>
        <InputGroup>
          <InputGroupInput
            id="input-group-test-amount"
            name="amount"
            inputMode="decimal"
            aria-invalid={invalid}
            aria-describedby={invalid ? 'input-group-test-hint input-group-test-error' : 'input-group-test-hint'}
            mix={on('input', (event) => {
              amount = event.currentTarget.value
              void handle.update()
            })}
          />
          <InputGroupAddon>
            <InputGroupText>CHF</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
        <p id="input-group-test-hint">Without VAT.</p>
        {invalid ? <p id="input-group-test-error">Enter an amount.</p> : null}
      </div>
    )
  }
}

// Button makes the rule of a variant and size the first time it renders
// them. The link button, which no other test here renders, shows up after the
// ghost button, so its rule comes after the one Input Group used for the ghost.
function LateLink(handle: Handle) {
  let shown = false

  return () => (
    <div style={tokens} mix={reset}>
      <InputGroup>
        <InputGroupInput aria-label="Reference" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            mix={on('click', () => {
              shown = true
              void handle.update()
            })}
          >
            More
          </InputGroupButton>
          {shown ? <InputGroupButton variant="link">Details</InputGroupButton> : null}
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}

describe('InputGroup in the browser', () => {
  it("runs the caller's events, refs and styles on the native input and button", async (t) => {
    let typed: string[] = []
    let pressed: string[] = []
    let inputNode: HTMLInputElement | undefined
    let buttonNode: HTMLButtonElement | undefined
    let { container, act } = mount(
      t,
      <InputGroup>
        <InputGroupInput
          name="q"
          aria-label="Search"
          mix={[
            ref((element) => (inputNode = element)),
            on('input', (event) => void typed.push(event.currentTarget.value)),
            css({ letterSpacing: '3px' }),
          ]}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            aria-label="Clear"
            mix={[
              ref((element) => (buttonNode = element)),
              on('click', (event) => void pressed.push(event.currentTarget.type)),
            ]}
          >
            ×
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>,
    )
    let input = find(container, 'input', HTMLInputElement)
    let button = find(container, 'button', HTMLButtonElement)

    await act(() => {
      input.value = 'Acme'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      button.click()
    })

    assert.equal(inputNode, input)
    assert.equal(buttonNode, button)
    assert.deepEqual(typed, ['Acme'])
    assert.deepEqual(pressed, ['button'])
    assert.equal(getComputedStyle(input).letterSpacing, '3px')
  })

  it('focuses its own control on a press of an addon, but not of a control inside it', async (t) => {
    let { container, act } = mount(
      t,
      <div>
        <InputGroup>
          <InputGroupInput name="first" aria-label="First" />
          <InputGroupAddon>
            <svg data-test="icon" width="16" height="16" />
            <InputGroupText>https://</InputGroupText>
            <InputGroupButton aria-label="Info">i</InputGroupButton>
            <a href="#help">Help</a>
          </InputGroupAddon>
        </InputGroup>
        <InputGroup>
          <InputGroupTextarea name="second" aria-label="Second" />
          <InputGroupAddon align="block-end">
            <InputGroupText>0/280</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      </div>,
    )
    let first = find(container, 'input[name="first"]', HTMLInputElement)
    let second = find(container, 'textarea[name="second"]', HTMLTextAreaElement)
    let [firstAddon, secondAddon] = container.querySelectorAll<HTMLElement>('[data-slot="input-group-addon"]')

    await act(() =>
      find(firstAddon, '[data-test="icon"]', SVGElement).dispatchEvent(new MouseEvent('click', { bubbles: true })),
    )
    assert.equal(document.activeElement, first)

    await act(() => secondAddon.click())
    assert.equal(document.activeElement, second, 'a textarea is a control too')

    let button = find(firstAddon, 'button', HTMLButtonElement)
    await act(() => {
      button.focus()
      button.click()
    })
    assert.equal(document.activeElement, button)

    let link = find(firstAddon, 'a', HTMLAnchorElement)
    await act(() => {
      link.focus()
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    assert.equal(document.activeElement, link)
  })

  it("leaves focus where it is when the caller's click listener prevents it", async (t) => {
    let { container, act } = mount(
      t,
      <InputGroup>
        <InputGroupInput name="q" aria-label="Search" />
        <InputGroupAddon mix={on('click', (event) => event.preventDefault())}>
          <InputGroupText>Search</InputGroupText>
        </InputGroupAddon>
      </InputGroup>,
    )

    await act(() => find(container, '[data-slot="input-group-addon"]', HTMLElement).click())

    assert.notEqual(document.activeElement, find(container, 'input', HTMLInputElement))
  })

  it('draws the ring and the border on the group while its control is focused, red when invalid', async (t) => {
    let { container, act } = mount(
      t,
      <div style={tokens} mix={reset}>
        <InputGroup>
          <InputGroupInput name="valid" aria-label="Valid" />
        </InputGroup>
        <InputGroup>
          <InputGroupInput name="invalid" aria-label="Invalid" aria-invalid={true} />
        </InputGroup>
      </div>,
    )
    let valid = find(container, 'input[name="valid"]', HTMLInputElement)
    let invalid = find(container, 'input[name="invalid"]', HTMLInputElement)

    assert.equal(getComputedStyle(group(container, 0)).borderTopColor, 'rgb(120, 120, 120)')
    assert.equal(getComputedStyle(group(container, 1)).borderTopColor, 'rgb(200, 0, 0)')
    assert.equal(getComputedStyle(valid).borderTopWidth, '0px', 'the control draws no border of its own')

    await act(() => valid.focus())
    assert.equal(getComputedStyle(group(container, 0)).borderTopColor, 'rgb(0, 0, 200)')
    assert.equal(getComputedStyle(group(container, 0)).outlineStyle, 'solid')
    assert.equal(getComputedStyle(group(container, 0)).outlineColor, 'rgb(0, 0, 200)')
    assert.equal(getComputedStyle(valid).outlineStyle, 'none', 'the ring moves to the group')

    await act(() => invalid.focus())
    assert.equal(getComputedStyle(group(container, 0)).outlineStyle, 'none')
    assert.equal(getComputedStyle(group(container, 1)).outlineColor, 'rgb(200, 0, 0)')
  })

  it('dims the addons with a disabled control or a disabled group', async (t) => {
    let { container } = mount(
      t,
      <div style={tokens} mix={reset}>
        <InputGroup>
          <InputGroupInput aria-label="Enabled" />
          <InputGroupAddon>A</InputGroupAddon>
        </InputGroup>
        <InputGroup>
          <InputGroupInput aria-label="Disabled" disabled />
          <InputGroupAddon>B</InputGroupAddon>
        </InputGroup>
        <InputGroup data-disabled="true">
          <InputGroupInput aria-label="Loading" />
          <InputGroupAddon>C</InputGroupAddon>
        </InputGroup>
        <fieldset disabled>
          <InputGroup>
            <InputGroupInput aria-label="In a disabled fieldset" />
            <InputGroupAddon>D</InputGroupAddon>
          </InputGroup>
        </fieldset>
      </div>,
    )
    let opacities = [...container.querySelectorAll('[data-slot="input-group-addon"]')].map(
      (addon) => getComputedStyle(addon).opacity,
    )

    assert.deepEqual(opacities, ['1', '0.5', '0.5', '0.5'])
    assert.equal(getComputedStyle(container.querySelectorAll('input')[1]).opacity, '0.5')
  })

  it("gives an outline button the foreground, since the addon's muted text misses 4.5:1 on its tint", async (t) => {
    let { container } = mount(
      t,
      <div style={{ ...tokens, '--foreground': 'rgb(10, 10, 10)' }} mix={reset}>
        <InputGroup>
          <InputGroupInput aria-label="Coupon" />
          <InputGroupAddon>
            <InputGroupButton variant="outline">Apply</InputGroupButton>
            <InputGroupButton>Clear</InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>,
    )
    let [outline, ghost] = container.querySelectorAll('button')

    assert.equal(getComputedStyle(outline).color, 'rgb(10, 10, 10)')
    assert.equal(getComputedStyle(ghost).color, 'rgb(90, 90, 90)', 'a ghost button keeps the muted text')
  })

  it('keeps its size when a button variant first renders after it', async (t) => {
    let { container, act } = mount(t, <LateLink />)
    await act(() => container.querySelector('button')!.click())
    let link = container.querySelectorAll('button')[1]

    assert.equal(link.textContent, 'Details')
    assert.equal(getComputedStyle(link).fontSize, '14px')
    assert.equal(getComputedStyle(link).paddingInlineStart, '6px')
  })

  it('places each addon by its alignment, and mirrors the line in right-to-left text', async (t) => {
    let { container } = mount(
      t,
      <div style={tokens} mix={reset}>
        <InputGroup>
          <InputGroupInput aria-label="Both" />
          <InputGroupAddon align="inline-end">End</InputGroupAddon>
          <InputGroupAddon>Start</InputGroupAddon>
        </InputGroup>
        <div dir="rtl">
          <InputGroup>
            <InputGroupInput aria-label="Mirrored" />
            <InputGroupAddon align="inline-end">End</InputGroupAddon>
            <InputGroupAddon>Start</InputGroupAddon>
          </InputGroup>
        </div>
        <InputGroup>
          <InputGroupTextarea aria-label="Stacked" />
          <InputGroupAddon align="block-end">Below</InputGroupAddon>
          <InputGroupAddon align="block-start">Above</InputGroupAddon>
        </InputGroup>
      </div>,
    )
    let parts = (index: number) => {
      let root = group(container, index)
      let [end, start] = root.querySelectorAll('[data-slot="input-group-addon"]')
      return {
        control: rect(root.querySelector('[data-slot="input-group-control"]')!),
        end: rect(end),
        start: rect(start),
      }
    }

    let ltr = parts(0)
    assert.ok(ltr.start.right <= ltr.control.left + 0.5, 'start addon before the input')
    assert.ok(ltr.end.left >= ltr.control.right - 0.5, 'end addon after the input')

    let rtl = parts(1)
    assert.ok(rtl.start.left >= rtl.control.right - 0.5, 'start addon on the right')
    assert.ok(rtl.end.right <= rtl.control.left + 0.5, 'end addon on the left')

    let stacked = parts(2)
    assert.ok(stacked.start.bottom <= stacked.control.top + 0.5, 'block-start addon above')
    assert.ok(stacked.end.top >= stacked.control.bottom - 0.5, 'block-end addon below')
    assert.equal(Math.round(stacked.control.width), Math.round(stacked.start.width), 'stacked parts share the width')
  })

  it('is as tall as a plain input, and wraps its parts inside the box in a narrow container', async (t) => {
    let website = (
      <InputGroup>
        <InputGroupInput aria-label="Website" />
        <InputGroupAddon>
          <InputGroupText>https://</InputGroupText>
        </InputGroupAddon>
        <InputGroupAddon align="inline-end">
          <InputGroupButton>Copy</InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    )
    let { container } = mount(
      t,
      <div style={tokens} mix={reset}>
        {website}
        <div style={{ width: '120px' }}>{website}</div>
      </div>,
    )
    let wide = group(container, 0)
    let narrow = group(container, 1)
    let input = narrow.querySelector('input')!

    // Each part's box, padding included, stays inside the group's border, so nothing reaches past it on a narrow line.
    let outside = (root: HTMLElement) => {
      let box = rect(root)
      let [left, right] = [box.left + root.clientLeft, box.left + root.clientLeft + root.clientWidth]
      return [...root.children]
        .filter((part) => rect(part).left < left - 0.5 || rect(part).right > right + 0.5)
        .map((part) => part.getAttribute('data-slot'))
    }

    assert.equal(Math.round(rect(wide).height), 36)
    assert.deepEqual(outside(wide), [])
    assert.ok(rect(narrow).width <= 120.5, `${rect(narrow).width}`)
    assert.deepEqual(outside(narrow), [])
    assert.ok(narrow.scrollWidth <= narrow.clientWidth + 1, 'nothing overflows the group')
    assert.ok(
      rect(input).width >= 64 - 0.5 || rect(input).width >= narrow.clientWidth - 0.5,
      'the input keeps room to type in',
    )
  })

  it('keeps focus and its description links while the owner changes its value and error', async (t) => {
    let { container, act } = mount(t, <AmountWithError />)
    let input = find(container, 'input', HTMLInputElement)
    let references = () =>
      (input.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .map((id) => document.getElementById(id)?.textContent ?? `missing ${id}`)

    await act(() => input.focus())
    assert.equal(input.getAttribute('aria-invalid'), 'true')
    assert.deepEqual(references(), ['Without VAT.', 'Enter an amount.'])

    await act(() => {
      input.value = '120'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    assert.equal(document.activeElement, input)
    assert.equal(input.getAttribute('aria-invalid'), 'false')
    assert.deepEqual(references(), ['Without VAT.'])
    assert.equal(find(container, 'input', HTMLInputElement), input, 'the same input element stays')

    await act(() => {
      input.value = ''
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    assert.equal(document.activeElement, input)
    assert.deepEqual(references(), ['Without VAT.', 'Enter an amount.'])
  })

  it('submits and resets its form through its buttons, and sends the native value', async (t) => {
    let sent: string[] = []
    let { container, act } = mount(
      t,
      <form
        mix={on('submit', (event) => {
          event.preventDefault()
          sent = [...new FormData(event.currentTarget, event.submitter)].map(([name, value]) => `${name}=${value}`)
        })}
      >
        <InputGroup>
          <InputGroupInput name="q" aria-label="Search" defaultValue="0042" />
          <InputGroupAddon align="inline-end">
            <InputGroupButton type="reset">Clear</InputGroupButton>
            <InputGroupButton type="submit" name="intent" value="search">
              Search
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>,
    )
    let input = find(container, 'input', HTMLInputElement)
    let [reset, submit] = container.querySelectorAll('button')

    await act(() => {
      input.value = '0042-A'
      submit.click()
    })
    assert.deepEqual(sent, ['q=0042-A', 'intent=search'])

    await act(() => reset.click())
    assert.equal(input.value, '0042')
  })
})
