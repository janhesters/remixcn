import { css } from 'remix/component'
import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { disabledState, focusRing, invalidState, mergeStyles, transition, visuallyHidden } from './styles.ts'

describe('mergeStyles', () => {
  it('merges nested selectors and lets later declarations win', () => {
    let merged = mergeStyles(
      { color: 'black', '&:hover': { color: 'gray', borderColor: 'gray' } },
      { '&:hover': { color: 'white' }, padding: '1rem' },
    )

    assert.deepEqual(merged, { color: 'black', '&:hover': { color: 'white', borderColor: 'gray' }, padding: '1rem' })
  })

  it('leaves its inputs unchanged', () => {
    let base = { '&:hover': { color: 'gray' } }
    mergeStyles(base, { '&:hover': { color: 'white' } })

    assert.deepEqual(base, { '&:hover': { color: 'gray' } })
  })
})

describe('focusRing', () => {
  it('draws the ring on keyboard focus, or on another state the component names', () => {
    assert.deepEqual(focusRing(), { '&:focus-visible': { outline: '2px solid var(--ring)', outlineOffset: '2px' } })
    assert.deepEqual(Object.keys(focusRing('&:has(input:focus-visible)')), ['&:has(input:focus-visible)'])
  })
})

describe('transition', () => {
  it('times the named properties with the motion tokens', () => {
    assert.deepEqual(transition('color', 'border-color'), {
      transitionProperty: 'color, border-color',
      transitionDuration: 'var(--duration-fast)',
      transitionTimingFunction: 'var(--ease-out)',
    })
  })
})

describe('server output', () => {
  it("renders a component's composed conventions as one rule in one rmx layer", async () => {
    let field = css(
      mergeStyles(
        { border: '1px solid var(--input)', borderRadius: 'var(--radius-md)' },
        focusRing(),
        invalidState,
        disabledState,
        transition('border-color'),
      ),
    )
    let hidden = css(visuallyHidden)

    let html = await renderToString(
      <html>
        <head />
        <body>
          <label for="email">
            Email <span mix={hidden}>(required)</span>
          </label>
          <input id="email" mix={field} aria-invalid="true" />
        </body>
      </html>,
    )

    let styles = [...html.matchAll(/<style data-rmx-style="([^"]+)">(.*?)<\/style>/gs)]
    assert.equal(styles.length, 2)

    let [, selector, rule] = styles.find(([, , text]) => text.includes('var(--input)')) ?? []
    assert.ok(rule.startsWith(`@layer rmx.${selector} {`), rule)
    for (let part of [
      'outline: 2px solid var(--ring)',
      '&[aria-invalid="true"] {\n    border-color: var(--destructive);',
      '&:disabled, &[aria-disabled="true"]',
      'transition-duration: var(--duration-fast)',
    ]) {
      assert.ok(rule.includes(part), part)
    }
  })
})
