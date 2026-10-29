import { readFileSync } from 'node:fs'

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { findScriptImports } from './source.ts'

describe('findScriptImports', () => {
  it('finds static, type-only, re-exported, side-effect and dynamic imports', () => {
    let source = [
      "import { css } from 'remix/component'",
      'import type { Handle } from "remix/component"',
      'import {',
      '  cx,',
      '  type Names,',
      "} from '#remixcn/lib/cx.ts'",
      "import * as icons from '#remixcn/lib/icons.tsx'",
      "import './side-effect.css'",
      "export { Button } from '#remixcn/ui/button.tsx'",
      "export * from '#remixcn/ui/badge.tsx'",
      "const lazy = () => import('#remixcn/ui/dialog.tsx')",
      'export const label = \'import x from "not-an-import"\'',
      "export function from() { return 'from' }",
    ].join('\n')

    assert.deepEqual(findScriptImports(source), [
      'remix/component',
      '#remixcn/lib/cx.ts',
      '#remixcn/lib/icons.tsx',
      './side-effect.css',
      '#remixcn/ui/button.tsx',
      '#remixcn/ui/badge.tsx',
      '#remixcn/ui/dialog.tsx',
    ])
  })

  it('skips imports inside comments and template literals', () => {
    let source = [
      "// import { a } from 'commented'",
      "/* import { b } from 'blocked'",
      "   import { c } from 'still-blocked' */",
      "const code = `import { d } from 'templated'`",
      "import { e } from 'real'",
    ].join('\n')

    assert.deepEqual(findScriptImports(source), ['real'])
  })

  it('reads import text inside strings as text, and imports inside template expressions as code', () => {
    let source = [
      'export const example = "import(\'react\')"',
      'export const other = \'export * from "lodash"\'',
      "export const shown = `${import('#remixcn/ui/dialog.tsx')} and ${`nested ${import('#remixcn/ui/sheet.tsx')}`}`",
      'export const plain = `import x from "not-code"`',
    ].join('\n')

    assert.deepEqual(findScriptImports(source), ['#remixcn/ui/dialog.tsx', '#remixcn/ui/sheet.tsx'])
  })

  it('reads JSX text and attribute strings as text, and JSX expressions as code', () => {
    let source = [
      "import { css } from 'remix/component'",
      'export function Note() {',
      '  return () => (',
      '    <p title="import x from \'title\'" data-note=\'say import("x")\'>',
      "      Don't \"import('react')\" here. It's {import('#remixcn/lib/cx.ts')} there.",
      "      <>{cond ? <b>it's</b> : <i/>}</>",
      '    </p>',
      '  )',
      '}',
      "const late = () => import('#remixcn/ui/badge.tsx')",
    ].join('\n')

    assert.deepEqual(findScriptImports(source), ['remix/component', '#remixcn/lib/cx.ts', '#remixcn/ui/badge.tsx'])
  })

  it('tells regular expressions from division and type parameters from JSX', () => {
    let source = [
      'const quote = /[\'"]/g',
      'const half = total / 2 / count',
      "const identity = <T,>(value: T) => import('#remixcn/lib/a.ts')",
      "function wrap<T extends object>(value: T) { return import('#remixcn/lib/b.ts') }",
      "const done = /it's/.test(text) && import('#remixcn/lib/c.ts')",
    ].join('\n')

    assert.deepEqual(findScriptImports(source), ['#remixcn/lib/a.ts', '#remixcn/lib/b.ts', '#remixcn/lib/c.ts'])
  })

  it('reads .ts files without JSX, so a type assertion hides no later import', () => {
    let source = ['export const initial = <unknown>{};', "import { readFileSync } from 'node:fs'"].join('\n')

    assert.deepEqual(findScriptImports(source, { jsx: false }), ['node:fs'])
    // In a .tsx file, an element that never closes was no element either.
    assert.deepEqual(findScriptImports(source), ['node:fs'])
  })

  it('reads a method named import as a method, not as a module import', () => {
    let source = [
      'const handlers = { import: (name: string) => name }',
      "handlers.import('labels')",
      "handlers?.import('more')",
      "handlers\n  .import('chained')",
      "class Loader { #import(name: string) { return name } load() { return this.#import('private') } }",
      "const loaded = await import('#remixcn/lib/a.ts')",
    ].join('\n')

    assert.deepEqual(findScriptImports(source), ['#remixcn/lib/a.ts'])
  })

  it('reads a slash after a condition as a regular expression, and after a value as division', () => {
    let source = [
      "export function matches(value: string) { if (value) /import('react')/.test(value) }",
      'while (next()) /import("lodash")/.exec(text)',
      "for (;;) /import('clsx')/.test(text)",
      "const ratio = (total) / 2 + import('#remixcn/lib/d.ts') / 3",
    ].join('\n')

    assert.deepEqual(findScriptImports(source), ['#remixcn/lib/d.ts'])
  })

  it('reads the other forms TypeScript resolves: import = require and type references', () => {
    let source = ['/// <reference types="node" />', "import fs = require('node:fs')"].join('\n')

    assert.deepEqual(findScriptImports(source), ['node', 'node:fs'])
  })

  it('reads the import-syntax fixture as TypeScript does, apart from the implicit JSX runtime', () => {
    let syntax = readFileSync(new URL('../../../test/fixtures/imports/syntax.tsx', import.meta.url), 'utf8')

    assert.deepEqual(findScriptImports(syntax), [
      'react',
      '@base-ui/react/button',
      'react-dom',
      './badge.css',
      '#remixcn/ui/button.tsx',
      '@remix-run/ui/popover',
    ])
  })

  it('reads the fixture component the way TypeScript does', () => {
    let button = readFileSync(
      new URL('../../../test/fixtures/registries/installable/registry/ui/button.tsx', import.meta.url),
      'utf8',
    )

    assert.deepEqual(findScriptImports(button), ['remix/component', '#remixcn/lib/cx.ts'])
  })
})
