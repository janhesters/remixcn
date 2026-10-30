import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { readExample, readExport } from './source.ts'

const source = `import { css } from 'remix/component'

const rowStyles = css({ display: 'flex' })

/** A row of buttons. */
export function Row() {
  return () => (
    <div mix={rowStyles}>
      <button type="button">Save</button>
    </div>
  )
}

// A form that keeps its own count.
export const Counter = clientEntry(import.meta.url, function Counter(handle: Handle) {
  let count = 0

  return () => <button type="button">{count}</button>
})

export const sizes = ['sm', 'lg'] as const
export const Loading = clientEntry(
  import.meta.url,
  function Loading() {
    return () => <p>Loading</p>
  },
)
`

describe('readExport', () => {
  it('reads an exported function with the comment above it, up to the brace that closes it', () => {
    assert.equal(
      readExport(source, 'Row'),
      `/** A row of buttons. */
export function Row() {
  return () => (
    <div mix={rowStyles}>
      <button type="button">Save</button>
    </div>
  )
}`,
    )
  })

  it('reads an exported client entry, with its line comment and its blank lines inside', () => {
    assert.equal(
      readExport(source, 'Counter'),
      `// A form that keeps its own count.
export const Counter = clientEntry(import.meta.url, function Counter(handle: Handle) {
  let count = 0

  return () => <button type="button">{count}</button>
})`,
    )
  })

  it('stops a one-line export at its own line, and closes a call on a line of its own', () => {
    assert.equal(readExport(source, 'sizes'), `export const sizes = ['sm', 'lg'] as const`)
    assert.equal(
      readExport(source, 'Loading'),
      `export const Loading = clientEntry(
  import.meta.url,
  function Loading() {
    return () => <p>Loading</p>
  },
)`,
    )
  })

  it('throws for a name the file does not export', () => {
    assert.throws(() => readExport(source, 'rowStyles'), /exports no rowStyles/)
    assert.throws(() => readExport(source, 'Ro'), /exports no Ro/)
  })
})

describe('readExample', () => {
  it('reads an export of a registry example file', () => {
    let code = readExample('registry/examples/button-example.tsx', 'ButtonForm')
    assert.match(code, /^\/\*\*\n \* Submit, reset and action buttons in one form\./)
    assert.match(code, /export const ButtonForm = clientEntry\(/)
    assert.match(code, /\n\}\)$/)
  })

  it('reads only files in registry/examples', () => {
    assert.throws(() => readExample('registry/ui/button.tsx', 'Button'), /registry\/examples/)
    assert.throws(() => readExample('registry/examples/../ui/button.tsx', 'Button'), /registry\/examples/)
  })
})
