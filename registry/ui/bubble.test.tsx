import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, tags, text } from '../../test/html.ts'
import {
  Bubble,
  BubbleContent,
  BubbleGroup,
  BubbleReactions,
  bubbleContentVariants,
  bubbleVariantNames,
} from './bubble.tsx'

describe('Bubble', () => {
  it('renders the group, bubble, content and reactions with their data-slot, in order', async () => {
    let html = await renderToString(
      <BubbleGroup>
        <Bubble>
          <BubbleContent>I checked the registry output.</BubbleContent>
          <BubbleReactions role="img" aria-label="Reactions: thumbs up">
            <span>👍</span>
          </BubbleReactions>
        </Bubble>
      </BubbleGroup>,
    )

    assert.deepEqual(
      tags(html).map((tag) => `${tag.name}:${tag.attributes.get('data-slot') ?? ''}`),
      ['div:bubble-group', 'div:bubble', 'div:bubble-content', 'div:bubble-reactions', 'span:'],
    )
    let bubble = attributes(html, 'slot:bubble')
    assert.equal(bubble.get('data-variant'), 'default')
    assert.equal(bubble.get('data-align'), 'start')
    let reactions = attributes(html, 'slot:bubble-reactions')
    assert.equal(reactions.get('data-side'), 'bottom')
    assert.equal(reactions.get('data-align'), 'end')
    assert.equal(reactions.get('aria-label'), 'Reactions: thumbs up')
    assert.equal(text(html), 'I checked the registry output.👍')
  })

  it('renders each variant and alignment, and each side and alignment of the reactions', async () => {
    for (let variant of bubbleVariantNames) {
      for (let align of ['start', 'end'] as const) {
        let bubble = attributes(await renderToString(<Bubble variant={variant} align={align} />), 'div')

        assert.equal(bubble.get('data-variant'), variant)
        assert.equal(bubble.get('data-align'), align)
      }
    }
    for (let side of ['top', 'bottom'] as const) {
      for (let align of ['start', 'end'] as const) {
        let reactions = attributes(await renderToString(<BubbleReactions side={side} align={align} />), 'div')

        assert.equal(reactions.get('data-side'), side)
        assert.equal(reactions.get('data-align'), align)
      }
    }
  })

  it('makes a native link or button the content, in place of render', async () => {
    let html = await renderToString(
      <>
        <Bubble variant="muted">
          <a href="/invoices/42" mix={bubbleContentVariants()}>
            Open invoice 42
          </a>
        </Bubble>
        <Bubble variant="outline" align="end">
          <button type="button" mix={bubbleContentVariants()}>
            I forgot my password
          </button>
        </Bubble>
      </>,
    )

    assert.equal(attributes(html, 'a').get('data-slot'), 'bubble-content')
    assert.equal(attributes(html, 'a').get('href'), '/invoices/42')
    assert.equal(attributes(html, 'button').get('data-slot'), 'bubble-content')
    assert.equal(attributes(html, 'button').get('type'), 'button')
  })

  it('escapes message text, so untrusted content never becomes markup', async () => {
    let html = await renderToString(
      <Bubble>
        <BubbleContent>{'</div><script>alert(1)</script>'}</BubbleContent>
      </Bubble>,
    )

    assert.equal(tags(html, 'script').length, 0)
    assert.equal(text(html), '</div><script>alert(1)</script>')
  })

  it("keeps a caller's attributes", async () => {
    let html = await renderToString(
      <Bubble id="reply" aria-describedby="reply-time">
        <BubbleContent lang="de">Hallo</BubbleContent>
      </Bubble>,
    )

    assert.equal(attributes(html, 'slot:bubble').get('id'), 'reply')
    assert.equal(attributes(html, 'slot:bubble').get('aria-describedby'), 'reply-time')
    assert.equal(attributes(html, 'slot:bubble-content').get('lang'), 'de')
  })
})
