import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { readTokens } from './tokens.ts'

describe('readTokens', () => {
  it("reads each custom property's light and dark value", () => {
    let css = `
      @layer base {
        :root {
          color-scheme: light dark;
          --background: light-dark(oklch(1 0 0), oklch(0.145 0 0));
          --border: light-dark(oklch(0.922 0 0), oklch(1 0 0 / 10%));
          --radius: 0.375rem;
        }
      }
    `

    assert.deepEqual(
      readTokens(css),
      new Map([
        ['background', { light: 'oklch(1 0 0)', dark: 'oklch(0.145 0 0)' }],
        ['border', { light: 'oklch(0.922 0 0)', dark: 'oklch(1 0 0 / 10%)' }],
        ['radius', { light: '0.375rem', dark: '0.375rem' }],
      ]),
    )
  })

  it('keeps the first declaration and skips comments', () => {
    let css = `
      /* --ring: red; */
      :root { --duration-fast: 100ms; }
      @media (prefers-reduced-motion: reduce) { :root { --duration-fast: 0s; } }
    `

    assert.deepEqual(readTokens(css), new Map([['duration-fast', { light: '100ms', dark: '100ms' }]]))
  })
})
