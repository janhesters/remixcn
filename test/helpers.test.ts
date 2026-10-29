import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { readScriptImports, tsc } from '../scripts/typescript.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
// The behavior helpers. registry/lib also holds the style helpers, which need the theme stylesheet.
const helpers = ['anchor-position.ts', 'composite.ts', 'focus-scope.ts', 'layer.ts', 'modal.ts']

describe('registry/lib behavior helpers', () => {
  it('are the focus, dismissal, modal, composite and positioning helpers', () => {
    let files = readdirSync(join(root, 'registry/lib'))

    for (let file of helpers) assert.ok(files.includes(file), file)
  })

  it('import nothing but remix/component', () => {
    let imports = readScriptImports(
      root,
      helpers.map((file) => `registry/lib/${file}`),
    )

    for (let [file, specifiers] of imports) assert.deepEqual(specifiers, ['remix/component'], file)
  })

  it('typecheck as copied source in a Remix app that has only remix', (t) => {
    let app = mkdtempSync(join(tmpdir(), 'remixcn-consumer-'))
    t.after(() => rmSync(app, { recursive: true, force: true }))
    let fixture = join(root, 'test/fixtures/consumer-app')
    let lib = join(app, 'app/public/remixcn/lib')
    mkdirSync(lib, { recursive: true })

    copyFileSync(join(fixture, 'package.json'), join(app, 'package.json'))
    copyFileSync(join(fixture, 'tsconfig.json'), join(app, 'tsconfig.json'))
    symlinkSync(join(root, 'node_modules'), join(app, 'node_modules'), 'dir')
    for (let file of helpers) {
      // What the installer does: rewrite the registry alias to a relative path.
      let source = readFileSync(join(root, 'registry/lib', file), 'utf8').replaceAll('#remixcn/lib/', './')
      writeFileSync(join(lib, file), source)
    }
    writeFileSync(
      join(app, 'app/public/menu.tsx'),
      `import { clientEntry } from 'remix/component'
import type { Handle } from 'remix/component'

import { anchorPosition } from './remixcn/lib/anchor-position.ts'
import { rovingFocus } from './remixcn/lib/composite.ts'
import { focusScope } from './remixcn/lib/focus-scope.ts'
import { dismissableLayer } from './remixcn/lib/layer.ts'
import { modal } from './remixcn/lib/modal.ts'

export const Menu = clientEntry(import.meta.url, function Menu(handle: Handle<{ open: boolean }>) {
  return () => (
    <div
      role="menu"
      popover="manual"
      mix={[
        dismissableLayer({ open: handle.props.open, onDismiss() {} }),
        focusScope({ open: handle.props.open }),
        modal({ open: handle.props.open }),
        anchorPosition({ anchor: null, open: handle.props.open, side: 'bottom', align: 'start' }),
        rovingFocus({ items: '[role=menuitem]', orientation: 'vertical', typeahead: true }),
      ]}
    />
  )
})
`,
    )

    let result = spawnSync(process.execPath, [tsc, '-p', app], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stdout + result.stderr)
  })
})
