import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { CliError } from './errors.ts'
import { inspectFiles, placeFiles } from './install.ts'
import type { Item } from './resolve.ts'

let scratch: string[] = []

afterEach(() => {
  for (let directory of scratch) rmSync(directory, { recursive: true, force: true })
  scratch = []
})

function app() {
  let root = mkdtempSync(join(tmpdir(), 'remixcn-install-'))
  scratch.push(root)
  return root
}

function directoriesOf(root: string) {
  return {
    ui: join(root, 'app/ui/public/components/ui'),
    lib: join(root, 'app/ui/public/lib'),
    components: join(root, 'app/ui/public/components'),
  }
}

function item(name: string, files: Array<[path: string, type: string, target: string, content: string]>): Item {
  return {
    name,
    type: 'registry:lib',
    registryDependencies: [],
    files: files.map(([path, type, target, content]) => ({ path, type, target, content })),
    source: `https://x/r/${name}.json`,
  }
}

const button = item('button', [
  [
    'registry/ui/button.tsx',
    'registry:ui',
    '@ui/button.tsx',
    "import { css } from 'remix/component'\nimport { cx } from '#remixcn/lib/cx.ts'\nimport type { Icon } from \"#remixcn/lib/icons.tsx\"\n",
  ],
])
const cx = item('cx', [['registry/lib/cx.ts', 'registry:lib', '@lib/cx.ts', 'export const cx = 1\n']])
const icons = item('icons', [['registry/lib/icons.tsx', 'registry:lib', '@lib/icons.tsx', 'export const Icon = 1\n']])
const licenses = item('licenses', [
  ['LICENSE', 'registry:file', '@lib/remixcn/LICENSE', 'MIT #remixcn/lib/cx.ts\n'],
  ['THIRD_PARTY_NOTICES.md', 'registry:file', '@lib/remixcn/THIRD_PARTY_NOTICES.md', 'notices\n'],
])

function failure(run: () => unknown): CliError {
  try {
    run()
  } catch (error) {
    assert.ok(error instanceof CliError, String(error))
    return error
  }
  throw new Error('expected an error')
}

describe('placeFiles', () => {
  it('installs each target in its alias directory and rewrites #remixcn imports to relative paths', () => {
    let root = app()

    let files = placeFiles([licenses, cx, icons, button], { root, directories: directoriesOf(root) })

    assert.deepEqual(
      files.map((file) => [file.item, file.path]),
      [
        ['licenses', join(root, 'app/ui/public/lib/remixcn/LICENSE')],
        ['licenses', join(root, 'app/ui/public/lib/remixcn/THIRD_PARTY_NOTICES.md')],
        ['cx', join(root, 'app/ui/public/lib/cx.ts')],
        ['icons', join(root, 'app/ui/public/lib/icons.tsx')],
        ['button', join(root, 'app/ui/public/components/ui/button.tsx')],
      ],
    )
    assert.equal(
      files[4].content,
      "import { css } from 'remix/component'\nimport { cx } from '../../lib/cx.ts'\nimport type { Icon } from \"../../lib/icons.tsx\"\n",
    )
    assert.equal(files[0].content, 'MIT #remixcn/lib/cx.ts\n')
  })

  it('puts the requested items in --path and points their imports there', () => {
    let root = app()

    let files = placeFiles([cx, icons, button], {
      root,
      directories: directoriesOf(root),
      requested: new Set(['button']),
      path: join(root, 'app/actions/public/widgets'),
    })

    assert.equal(files[2].path, join(root, 'app/actions/public/widgets/button.tsx'))
    assert.match(files[2].content, /from '\.\.\/\.\.\/\.\.\/ui\/public\/lib\/cx\.ts'/)
    assert.equal(files[0].path, join(root, 'app/ui/public/lib/cx.ts'))
  })

  it('accepts an import of a file the app already has, and rejects one nobody provides', () => {
    let root = app()
    mkdirSync(join(root, 'app/ui/public/lib'), { recursive: true })
    writeFileSync(join(root, 'app/ui/public/lib/cx.ts'), 'export const cx = 1\n')

    let files = placeFiles([button, icons], { root, directories: directoriesOf(root) })
    assert.match(files[0].content, /'\.\.\/\.\.\/lib\/cx\.ts'/)

    let error = failure(() => placeFiles([button], { root, directories: directoriesOf(root) }))
    assert.equal(error.code, 'REGISTRY')
    assert.deepEqual(error.details, [
      'button: registry/ui/button.tsx imports #remixcn/lib/icons.tsx, which neither this install nor the app provides',
    ])
  })

  it('refuses source that breaks the import and CSS rules, as the registry build does', () => {
    let root = app()
    let broken = item('broken', [
      ['registry/lib/a.ts', 'registry:lib', '@lib/a.ts', "import x from 'lodash'\nimport fs from 'node:fs'\n"],
      [
        'registry/lib/b.ts',
        'registry:lib',
        '@lib/b.ts',
        "import x from './missing.ts'\nexport const late = `${import('react')}`\n",
      ],
      ['registry/lib/c.css', 'registry:file', '@lib/c.css', "@import 'tailwindcss';\n@tailwind utilities;\n"],
      ['registry/lib/d.ts', 'registry:file', '@lib/d.ts', "import { cx } from 'clsx'\n"],
    ])

    let error = failure(() => placeFiles([broken], { root, directories: directoriesOf(root) }))

    assert.equal(error.code, 'REGISTRY')
    assert.deepEqual(error.details, [
      'broken: registry/lib/a.ts: "lodash": browser-reachable source imports only remix/component and #remixcn/ui/ or #remixcn/lib/ files',
      'broken: registry/lib/a.ts: "node:fs" is a Node built-in, which browser-reachable source must not use',
      'broken: registry/lib/b.ts: "./missing.ts": import registry files through #remixcn/ui/ or #remixcn/lib/ so the installer can rewrite the path',
      'broken: registry/lib/b.ts: "react" brings in React, which browser-reachable source must not use',
      'broken: registry/lib/c.css: "tailwindcss" brings in Tailwind, which browser-reachable source must not use',
      'broken: registry/lib/c.css: @tailwind is a Tailwind directive, which shipped CSS must not use',
      'broken: registry/lib/d.ts: "clsx": browser-reachable source imports only remix/component and #remixcn/ui/ or #remixcn/lib/ files',
    ])
  })

  it('refuses two files with one destination and a --path outside the project', () => {
    let root = app()
    let other = item('other-cx', [['registry/lib/cx.ts', 'registry:lib', '@lib/cx.ts', 'export const cx = 2\n']])

    let duplicate = failure(() => placeFiles([cx, other], { root, directories: directoriesOf(root) }))
    assert.equal(duplicate.code, 'UNSAFE_PATH')
    assert.deepEqual(duplicate.details, ['cx and other-cx both install app/ui/public/lib/cx.ts'])

    let outside = failure(() =>
      placeFiles([cx, icons, button], {
        root,
        directories: directoriesOf(root),
        requested: new Set(['button']),
        path: join(root, '..'),
      }),
    )
    assert.equal(outside.code, 'UNSAFE_PATH')
  })
})

describe('inspectFiles', () => {
  it('marks each file as created, updated or unchanged', () => {
    let root = app()
    mkdirSync(join(root, 'lib'))
    writeFileSync(join(root, 'lib/same.ts'), 'same\n')
    writeFileSync(join(root, 'lib/changed.ts'), 'mine\n')

    let planned = inspectFiles(
      [
        { path: join(root, 'lib/new.ts'), content: 'new\n' },
        { path: join(root, 'lib/same.ts'), content: 'same\n' },
        { path: join(root, 'lib/changed.ts'), content: 'theirs\n' },
      ],
      root,
    )

    assert.deepEqual(
      planned.map((file) => file.action),
      ['create', 'unchanged', 'update'],
    )
  })

  it('follows a link that stays in the project and refuses one that leaves it', () => {
    let root = app()
    let outside = app()
    mkdirSync(join(root, 'shared'))
    mkdirSync(join(root, 'app'))
    symlinkSync(join(root, 'shared'), join(root, 'app/inside'))
    symlinkSync(outside, join(root, 'app/escape'))

    inspectFiles([{ path: join(root, 'app/inside/new/cx.ts'), content: '' }], root)

    let error = failure(() => inspectFiles([{ path: join(root, 'app/escape/lib/cx.ts'), content: '' }], root))
    assert.equal(error.code, 'UNSAFE_PATH')
    assert.match(error.details[0], /app\/escape\/lib\/cx\.ts goes through a link that leaves the project/)
  })

  it('refuses to replace a link or a directory', () => {
    let root = app()
    mkdirSync(join(root, 'lib/cx.ts'), { recursive: true })
    writeFileSync(join(root, 'target.ts'), '')
    symlinkSync(join(root, 'target.ts'), join(root, 'lib/link.ts'))

    let error = failure(() =>
      inspectFiles(
        [
          { path: join(root, 'lib/cx.ts'), content: '' },
          { path: join(root, 'lib/link.ts'), content: '' },
        ],
        root,
      ),
    )

    assert.equal(error.code, 'UNSAFE_PATH')
    assert.deepEqual(error.details, [
      'lib/cx.ts is a directory, not a file',
      'lib/link.ts is a link; remixcn replaces only regular files',
    ])
  })
})
