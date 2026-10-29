import { readFileSync } from 'node:fs'

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { contrastRatio, parseColor } from '../../scripts/color.ts'
import { readTokens } from '../../scripts/tokens.ts'

const css = readFileSync(new URL('./theme.css', import.meta.url), 'utf8')
const tokens = readTokens(css)
const schemes = ['light', 'dark'] as const

// shadcn/ui's semantic colors at the pinned commit (apps/v4/registry/themes.ts).
const colors = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'border',
  'input',
  'ring',
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  'sidebar',
  'sidebar-foreground',
  'sidebar-primary',
  'sidebar-primary-foreground',
  'sidebar-accent',
  'sidebar-accent-foreground',
  'sidebar-border',
  'sidebar-ring',
]

// WCAG 2.2 AA: 4.5:1 for text (1.4.3), 3:1 for focus rings and control boundaries (1.4.11).
const textPairs = [
  ['foreground', 'background'],
  ['card-foreground', 'card'],
  ['popover-foreground', 'popover'],
  ['primary-foreground', 'primary'],
  ['secondary-foreground', 'secondary'],
  ['muted-foreground', 'muted'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'card'],
  ['accent-foreground', 'accent'],
  ['destructive', 'background'],
  ['destructive', 'card'],
  ['destructive', 'muted'],
  ['sidebar-foreground', 'sidebar'],
  ['sidebar-primary-foreground', 'sidebar-primary'],
  ['sidebar-accent-foreground', 'sidebar-accent'],
]

const boundaryPairs = [
  ['ring', 'background'],
  ['ring', 'card'],
  ['ring', 'muted'],
  ['input', 'background'],
  ['input', 'card'],
  ['input', 'muted'],
  ['primary', 'background'],
  ['sidebar-ring', 'sidebar'],
]

function color(name: string, scheme: (typeof schemes)[number]) {
  let token = tokens.get(name)
  assert.ok(token, `--${name} is missing`)
  return parseColor(token[scheme])
}

function assertContrast(pairs: string[][], minimum: number) {
  for (let scheme of schemes) {
    for (let [foreground, background] of pairs) {
      let ratio = contrastRatio(color(foreground, scheme), color(background, scheme))
      assert.ok(ratio >= minimum, `${scheme}: --${foreground} on --${background} is ${ratio.toFixed(2)}:1`)
    }
  }
}

describe('theme.css', () => {
  it('declares the cascade layer order before any rule', () => {
    let code = css.replace(/\/\*[\s\S]*?\*\//g, '').trim()

    assert.ok(code.startsWith('@layer base, rmx, app;'), code.slice(0, 80))
  })

  it("names shadcn's semantic colors as kebab-case custom properties with light and dark values", () => {
    for (let name of colors) {
      for (let scheme of schemes) color(name, scheme)
    }
  })

  it('keeps text readable in both schemes', () => {
    assertContrast(textPairs, 4.5)
  })

  it('keeps focus rings and control borders visible in both schemes', () => {
    assertContrast(boundaryPairs, 3)
  })

  it('uses system fonts and rem-based type, spacing and radii', () => {
    assert.match(tokens.get('font-sans')?.light ?? '', /^ui-sans-serif, system-ui, sans-serif/)
    assert.match(tokens.get('font-mono')?.light ?? '', /^ui-monospace, .*monospace$/)

    for (let name of ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'spacing', 'radius']) {
      assert.match(tokens.get(name)?.light ?? '', /^[\d.]+rem$/, name)
    }
  })
})
