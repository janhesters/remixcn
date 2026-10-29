import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { readScriptImports } from './typescript.ts'

describe('readScriptImports', () => {
  it('lists imports as TypeScript parses them, ignoring strings, comments, regular expressions and JSX text', () => {
    let imports = readScriptImports('.', ['test/fixtures/imports/syntax.tsx'])

    assert.deepEqual([...imports.keys()], ['test/fixtures/imports/syntax.tsx'])
    assert.deepEqual(imports.get('test/fixtures/imports/syntax.tsx')?.sort(), [
      '#remixcn/ui/button.tsx',
      './badge.css',
      '@base-ui/react/button',
      '@remix-run/ui/popover',
      'react',
      'react-dom',
      'remix/component/jsx-runtime',
    ])
  })

  it('reads nothing when there are no files', () => {
    assert.deepEqual(readScriptImports('.', []), new Map())
  })
})
