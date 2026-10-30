import { on } from 'remix/component'
import type { RemixNode } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { Bubble, BubbleContent, BubbleGroup, BubbleReactions, bubbleContentVariants } from './bubble.tsx'
import type { BubbleVariant } from './bubble.tsx'

function mount(t: TestContext, node: RemixNode) {
  let result = render(node)
  t.after(result.cleanup)
  return result
}

// Browser tests run without theme.css, so the container sets the tokens they measure.
const tokens = {
  width: '400px',
  colorScheme: 'light',
  '--spacing': '4px',
  '--radius-xl': '12px',
  '--text-sm': '14px',
  '--text-sm--line-height': '20px',
  '--primary': 'rgb(30, 30, 30)',
  '--primary-foreground': 'rgb(250, 250, 250)',
  '--secondary': 'rgb(240, 240, 240)',
  '--secondary-foreground': 'rgb(30, 30, 30)',
  '--muted': 'rgb(241, 241, 241)',
  '--foreground': 'rgb(10, 10, 10)',
  '--background': 'rgb(255, 255, 255)',
  '--border': 'rgb(220, 220, 220)',
  '--destructive': 'rgb(220, 40, 40)',
  '--card': 'rgb(255, 255, 255)',
}

function content(container: HTMLElement, index = 0) {
  return container.querySelectorAll<HTMLElement>('[data-slot="bubble-content"]')[index]
}

describe('Bubble in the browser', () => {
  it('colors the content by its bubble variant', async (t) => {
    let expected: Partial<Record<BubbleVariant, [string, string]>> = {
      default: ['rgb(30, 30, 30)', 'rgb(250, 250, 250)'],
      secondary: ['rgb(240, 240, 240)', 'rgb(30, 30, 30)'],
      muted: ['rgb(241, 241, 241)', 'rgb(10, 10, 10)'],
      outline: ['rgb(255, 255, 255)', 'rgb(10, 10, 10)'],
      ghost: ['rgba(0, 0, 0, 0)', 'rgb(10, 10, 10)'],
    }
    let variants = Object.keys(expected) as BubbleVariant[]
    let { container } = mount(
      t,
      <div style={tokens}>
        {variants.map((variant) => (
          <Bubble key={variant} variant={variant}>
            <BubbleContent>{variant}</BubbleContent>
          </Bubble>
        ))}
      </div>,
    )

    variants.forEach((variant, index) => {
      let style = getComputedStyle(content(container, index))
      assert.deepEqual([style.backgroundColor, style.color], expected[variant], variant)
    })
    assert.equal(getComputedStyle(content(container, variants.indexOf('outline'))).borderTopColor, 'rgb(220, 220, 220)')
    assert.equal(getComputedStyle(content(container, variants.indexOf('ghost'))).paddingLeft, '0px')
  })

  it('mixes the foreground into destructive text and tints its background', async (t) => {
    let { container } = mount(
      t,
      <div style={tokens}>
        <Bubble variant="destructive">
          <BubbleContent>Failed to send</BubbleContent>
        </Bubble>
      </div>,
    )
    let style = getComputedStyle(content(container))

    assert.notEqual(style.color, 'rgb(220, 40, 40)')
    assert.notEqual(style.backgroundColor, 'rgba(0, 0, 0, 0)')
  })

  it('sizes to its text up to 80% of the column, lets a ghost bubble span it, and wraps long words', async (t) => {
    let long = 'https://example.test/a-very-long-link-without-spaces-that-would-otherwise-overflow-the-row'
    let { container } = mount(
      t,
      <div style={{ ...tokens, width: '320px' }}>
        <BubbleGroup>
          <Bubble>
            <BubbleContent>Hi</BubbleContent>
          </Bubble>
          <Bubble>
            <BubbleContent>{long}</BubbleContent>
          </Bubble>
          <Bubble variant="ghost">
            <BubbleContent>{long}</BubbleContent>
          </Bubble>
        </BubbleGroup>
      </div>,
    )
    let bubbles = [...container.querySelectorAll<HTMLElement>('[data-slot="bubble"]')]

    assert.ok(bubbles[0].getBoundingClientRect().width < 60)
    assert.equal(Math.round(bubbles[1].getBoundingClientRect().width), 256)
    assert.equal(Math.round(bubbles[2].getBoundingClientRect().width), 320)
    assert.ok(bubbles.every((bubble) => bubble.scrollWidth <= bubble.clientWidth))
  })

  it('aligns an end bubble to the end of its column, also in right-to-left text', async (t) => {
    let { container } = mount(
      t,
      <div style={tokens}>
        <BubbleGroup>
          <Bubble align="end">
            <BubbleContent>Sent</BubbleContent>
          </Bubble>
        </BubbleGroup>
        <BubbleGroup dir="rtl">
          <Bubble align="end">
            <BubbleContent>أرسلت</BubbleContent>
          </Bubble>
        </BubbleGroup>
      </div>,
    )
    let [group, rtlGroup] = [...container.querySelectorAll('[data-slot="bubble-group"]')].map((element) =>
      element.getBoundingClientRect(),
    )
    let [bubble, rtlBubble] = [...container.querySelectorAll('[data-slot="bubble"]')].map((element) =>
      element.getBoundingClientRect(),
    )

    assert.equal(Math.round(bubble.right), Math.round(group.right))
    assert.equal(Math.round(rtlBubble.left), Math.round(rtlGroup.left))
  })

  it('overlaps the reactions with the chosen edge, mirrored in right-to-left text', async (t) => {
    let { container } = mount(
      t,
      <div style={{ ...tokens, padding: '40px' }}>
        <Bubble>
          <BubbleContent>Shipped the fix.</BubbleContent>
          <BubbleReactions role="img" aria-label="Reactions: thumbs up">
            <span>👍</span>
          </BubbleReactions>
        </Bubble>
        <Bubble dir="rtl">
          <BubbleContent>تم الإصلاح.</BubbleContent>
          <BubbleReactions side="top" align="start">
            <span>👍</span>
          </BubbleReactions>
        </Bubble>
      </div>,
    )
    let bubbles = [...container.querySelectorAll('[data-slot="bubble"]')].map((element) =>
      element.getBoundingClientRect(),
    )
    let reactions = [...container.querySelectorAll('[data-slot="bubble-reactions"]')].map((element) =>
      element.getBoundingClientRect(),
    )

    // Bottom end: over the lower edge, 12px from the end.
    assert.ok(reactions[0].top < bubbles[0].bottom && reactions[0].bottom > bubbles[0].bottom)
    assert.equal(Math.round(bubbles[0].right - reactions[0].right), 12)
    // Top start in right-to-left text: over the upper edge, 12px from the right.
    assert.ok(reactions[1].top < bubbles[1].top && reactions[1].bottom > bubbles[1].top)
    assert.equal(Math.round(bubbles[1].right - reactions[1].right), 12)
  })

  it('makes a native button the content, with a pointer and the bubble colors', async (t) => {
    let clicks = 0
    let { container } = mount(
      t,
      <div style={tokens}>
        <Bubble variant="secondary">
          <button type="button" mix={[bubbleContentVariants(), on('click', () => void clicks++)]}>
            I forgot my password
          </button>
        </Bubble>
      </div>,
    )
    let button = container.querySelector('button')!
    let style = getComputedStyle(button)

    button.click()
    assert.equal(clicks, 1)
    assert.equal(style.cursor, 'pointer')
    assert.equal(style.backgroundColor, 'rgb(240, 240, 240)')
    assert.equal(style.textAlign, 'start')
  })
})
