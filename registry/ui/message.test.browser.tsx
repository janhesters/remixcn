import type { RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { Bubble, BubbleContent } from './bubble.tsx'
import { Message, MessageAvatar, MessageContent, MessageFooter, MessageHeader } from './message.tsx'

function mount(t: TestContext, node: RemixNode) {
  let result = render(node)
  t.after(result.cleanup)
  return result
}

// Browser tests run without theme.css, so the container sets the tokens they measure.
const tokens = {
  width: '400px',
  '--spacing': '4px',
  '--text-xs': '12px',
  '--text-xs--line-height': '16px',
  '--text-sm': '14px',
  '--text-sm--line-height': '20px',
}

function box(root: Element, slot: string) {
  return root.querySelector(`[data-slot="${slot}"]`)!.getBoundingClientRect()
}

async function waitFor(condition: () => boolean, message: () => string) {
  let deadline = performance.now() + 3000
  while (!condition()) {
    if (performance.now() > deadline) throw new Error(`Timed out: ${message()}`)
    await new Promise((resolve) => requestAnimationFrame(resolve))
  }
}

function Row(handle: {
  props: {
    align?: 'start' | 'end'
    footer?: boolean
    footerHeight?: number
    gap?: string
    variant?: 'default' | 'ghost'
  }
}) {
  return () => {
    let { align, footer, footerHeight = 24, gap, variant } = handle.props
    return (
      <Message align={align}>
        <MessageAvatar>
          <span style={{ display: 'block', width: '32px', height: '32px' }} />
        </MessageAvatar>
        <MessageContent style={gap ? { gap } : undefined}>
          <MessageHeader>Olivia</MessageHeader>
          <Bubble variant={variant}>
            <BubbleContent>The retry finished.</BubbleContent>
          </Bubble>
          {footer ? (
            <MessageFooter>
              <span style={{ display: 'block', height: `${footerHeight}px` }}>Delivered</span>
            </MessageFooter>
          ) : null}
        </MessageContent>
      </Message>
    )
  }
}

describe('Message in the browser', () => {
  it('puts the avatar at the start of a start row and at the end of an end row, mirrored in right-to-left text', async (t) => {
    let { container } = mount(
      t,
      <div style={tokens}>
        <Row />
        <Row align="end" />
        <div dir="rtl">
          <Row align="end" />
        </div>
      </div>,
    )
    let [start, end, rtlEnd] = [...container.querySelectorAll('[data-slot="message"]')]

    assert.ok(box(start, 'message-avatar').right <= box(start, 'bubble').left)
    assert.ok(box(end, 'message-avatar').left >= box(end, 'bubble').right)
    assert.equal(Math.round(box(end, 'message-avatar').right), Math.round(end.getBoundingClientRect().right))
    assert.equal(Math.round(box(rtlEnd, 'message-avatar').left), Math.round(rtlEnd.getBoundingClientRect().left))
    // Every part of an end row moves to the end: the header and the bubble too.
    assert.equal(Math.round(box(end, 'message-header').right), Math.round(box(end, 'message-content').right))
    assert.equal(Math.round(box(end, 'bubble').right), Math.round(box(end, 'message-content').right))
  })

  it('aligns the avatar with the bottom of the bubble, also when a footer follows it', async (t) => {
    let { container } = mount(
      t,
      <div style={tokens}>
        <Row />
        <Row footer />
      </div>,
    )
    let [plain, withFooter] = [...container.querySelectorAll('[data-slot="message"]')]

    assert.equal(Math.round(box(plain, 'message-avatar').bottom), Math.round(box(plain, 'bubble').bottom))
    let gap = box(withFooter, 'bubble').bottom - box(withFooter, 'message-avatar').bottom
    assert.ok(Math.abs(gap) <= 2, `avatar ends ${gap}px from the bubble`)
  })

  it('lines the avatar up with the bubble above a footer of any height, also when the footer grows, leaves or comes back', async (t) => {
    let { container, root } = mount(
      t,
      <div style={tokens}>
        <Row footer footerHeight={100} />
      </div>,
    )
    let message = () => container.querySelector('[data-slot="message"]')!
    let offset = () => Math.round(box(message(), 'bubble').bottom - box(message(), 'message-avatar').bottom)
    let aligned = (label: string) =>
      waitFor(
        () => Math.abs(offset()) <= 1,
        () => `${label}: ${offset()}px apart`,
      )

    // A footer that wraps onto several rows, as at 320px with text at 200%.
    await aligned('a 100px footer')

    for (let footerHeight of [150, 40]) {
      root.render(
        <div style={tokens}>
          <Row footer footerHeight={footerHeight} />
        </div>,
      )
      root.flush()
      await aligned(`a footer that becomes ${footerHeight}px`)
    }

    root.render(
      <div style={tokens}>
        <Row />
      </div>,
    )
    root.flush()
    await aligned('no footer')

    root.render(
      <div style={tokens}>
        <Row footer footerHeight={70} />
      </div>,
    )
    root.flush()
    await aligned('a footer that comes back')
  })

  it('keeps the avatar beside the bubble when the gap above the footer changes but the footer keeps its size', async (t) => {
    // A density setting on an ancestor, which changes the layout without rendering the message again.
    let density = document.createElement('style')
    density.textContent = '[data-density="loose"] [data-slot="message-content"] { gap: 50px; }'
    document.head.append(density)
    t.after(() => density.remove())
    let { container, root } = mount(
      t,
      <div style={tokens}>
        <Row footer />
      </div>,
    )
    let wrapper = container.firstElementChild as HTMLElement
    let message = () => container.querySelector('[data-slot="message"]')!
    let footer = () => box(message(), 'message-footer').height
    let offset = () => Math.round(box(message(), 'bubble').bottom - box(message(), 'message-avatar').bottom)
    let aligned = (label: string) =>
      waitFor(
        () => Math.abs(offset()) <= 1,
        () => `${label}: ${offset()}px apart`,
      )

    await aligned('the default gap')
    let height = footer()

    wrapper.dataset.density = 'loose'
    await aligned('a 50px gap from an ancestor rule')
    assert.equal(footer(), height)

    delete wrapper.dataset.density
    await aligned('the default gap again')

    root.render(
      <div style={tokens}>
        <Row footer gap="30px" />
      </div>,
    )
    root.flush()
    await aligned('a 30px gap from a style prop')
    assert.equal(footer(), height)
  })

  it('ends the footer at the end of an end row, and drops the header padding next to a ghost bubble', async (t) => {
    let { container } = mount(
      t,
      <div style={tokens}>
        <Row align="end" footer />
        <Row variant="ghost" footer />
      </div>,
    )
    let [end, ghost] = [...container.querySelectorAll('[data-slot="message"]')]
    let footer = end.querySelector('[data-slot="message-footer"]') as HTMLElement

    assert.equal(getComputedStyle(footer).justifyContent, 'flex-end')
    assert.equal(getComputedStyle(end.querySelector('[data-slot="message-header"]')!).paddingLeft, '12px')
    assert.equal(getComputedStyle(ghost.querySelector('[data-slot="message-header"]')!).paddingLeft, '0px')
    assert.equal(getComputedStyle(ghost.querySelector('[data-slot="message-footer"]')!).paddingLeft, '0px')
  })

  it('wraps a long header and text on a narrow screen without scrolling sideways', async (t) => {
    let { container } = mount(
      t,
      <div style={{ ...tokens, width: '320px' }}>
        <Message>
          <MessageAvatar />
          <MessageContent>
            <MessageHeader>
              <span>Workspace-automation-notifier-for-the-billing-team</span>
              <span>12:04</span>
            </MessageHeader>
            <Bubble>
              <BubbleContent>{'x'.repeat(200)}</BubbleContent>
            </Bubble>
          </MessageContent>
        </Message>
      </div>,
    )
    let message = container.querySelector('[data-slot="message"]') as HTMLElement

    assert.ok(message.scrollWidth <= 320, `message is ${message.scrollWidth}px wide`)
    assert.ok(box(message, 'message-header').height > 16, 'the header wraps')
  })
})
