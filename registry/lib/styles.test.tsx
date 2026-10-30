import { css } from 'remix/component'
import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { disabledState, focusRing, invalidState, mergeStyles, shimmer, transition, visuallyHidden } from './styles.ts'

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

describe('shimmer', () => {
  it('sweeps a highlight across the text, and keeps plain text for reduced motion and forced colors', () => {
    let styles = shimmer()

    assert.equal(styles.backgroundClip, 'text')
    assert.equal(styles.WebkitTextFillColor, 'transparent')
    // The highlight sits between two text colors that both reach 4.5:1, so the sweep does too.
    assert.equal(
      styles['--remixcn-shimmer-highlight'],
      'var(--shimmer-color, color-mix(in oklab, var(--foreground), var(--muted-foreground)))',
    )
    assert.match(String(styles.backgroundImage), /var\(--remixcn-shimmer-highlight\) 50%/)
    assert.match(String(styles.animation), /^remixcn-shimmer /)
    assert.deepEqual(styles['&:dir(rtl)'], { animationDirection: 'reverse' })
    for (let query of ['@media (prefers-reduced-motion: reduce)', '@media (forced-colors: active)']) {
      assert.deepEqual(styles[query], {
        '&': { animation: 'none', backgroundImage: 'none', WebkitTextFillColor: 'currentColor' },
      })
    }
    assert.ok(styles['@keyframes remixcn-shimmer'])
  })

  it('applies only while another selector matches, such as a state on an ancestor', () => {
    let selector = ':where([data-state="uploading"]) &'
    let styles = shimmer(selector)

    assert.equal((styles[selector] as Record<string, unknown>).backgroundClip, 'text')
    assert.deepEqual(styles[`${selector}:dir(rtl)`], { animationDirection: 'reverse' })
    assert.deepEqual(Object.keys(styles['@media (prefers-reduced-motion: reduce)'] as object), [selector])
    assert.equal(styles.backgroundClip, undefined)
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
