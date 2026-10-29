import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { registryItemSchema, registrySchema } from 'shadcn/schema'

import type { CatalogItem } from './contracts.ts'
import { buildRegistry, checkRegistry, checkSourcePath, dependencyClosure } from './registry.ts'
import type { RegistryItem, RegistrySource } from './registry.ts'

const homepage = 'https://janhesters.github.io/remixcn/'
const shadcnFile = 'https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base'

function catalogItem(name: string, title: string, kind: CatalogItem['kind'], target: string): CatalogItem {
  return {
    name,
    title,
    kind,
    batch: 1,
    source: `${shadcnFile}/${kind === 'helper' ? 'lib' : 'ui'}/${name}.tsx`,
    dependsOn: [],
    upstreamImports: [],
    target,
  }
}

function licenses(): RegistryItem {
  return {
    name: 'licenses',
    type: 'registry:file',
    title: 'Licenses',
    description: 'The license texts of RemixCN and the projects it adapts.',
    files: [
      { path: 'LICENSE', type: 'registry:file', target: '@lib/remixcn/LICENSE' },
      { path: 'THIRD_PARTY_NOTICES.md', type: 'registry:file', target: '@lib/remixcn/THIRD_PARTY_NOTICES.md' },
    ],
  }
}

/** A button that needs a class-name helper, the theme tokens and the license texts. */
function makeSource(): RegistrySource {
  return {
    registry: {
      $schema: 'https://ui.shadcn.com/schema/registry.json',
      name: 'remixcn',
      homepage,
      items: [
        {
          name: 'button',
          type: 'registry:ui',
          title: 'Button',
          description: 'A button.',
          registryDependencies: ['@remixcn/theme', '@remixcn/cx'],
          files: [{ path: 'registry/ui/button.tsx', type: 'registry:ui', target: '@ui/button.tsx' }],
        },
        {
          name: 'cx',
          type: 'registry:lib',
          title: 'Class names',
          description: 'Joins class names.',
          registryDependencies: ['@remixcn/licenses'],
          files: [{ path: 'registry/lib/cx.ts', type: 'registry:lib', target: '@lib/cx.ts' }],
        },
        {
          name: 'theme',
          type: 'registry:style',
          title: 'Theme',
          description: 'Color, type and radius tokens.',
          registryDependencies: ['@remixcn/licenses'],
          files: [{ path: 'registry/lib/theme.css', type: 'registry:file', target: '@lib/theme.css' }],
        },
        licenses(),
      ],
    },
    catalog: {
      namespace: '@remixcn',
      homepage,
      entries: [catalogItem('button', 'Button', 'component', 'registry/ui/button.tsx')],
      helpers: [
        catalogItem('cx', 'Class names', 'helper', 'registry/lib/cx.ts'),
        catalogItem('theme', 'Theme', 'helper', 'registry/lib/theme.css'),
      ],
    },
    files: new Map([
      ['registry/ui/button.tsx', "import { cx } from '#remixcn/lib/cx.ts'\n\nexport function Button() {}\n"],
      ['registry/lib/cx.ts', 'export function cx() {}\n'],
      ['registry/lib/theme.css', ':root {\n  --radius: 0.375rem;\n}\n'],
      ['LICENSE', 'MIT License\n'],
      ['THIRD_PARTY_NOTICES.md', '# Third-party notices\n'],
    ]),
    imports: new Map([
      ['registry/ui/button.tsx', ['remix/component', 'remix/component/jsx-runtime', '#remixcn/lib/cx.ts']],
      ['registry/lib/cx.ts', []],
      ['registry/lib/theme.css', []],
    ]),
  }
}

function item(source: RegistrySource, name: string) {
  let found = source.registry.items.find((entry) => entry.name === name)
  if (!found) throw new Error(`no item ${name}`)
  return found
}

function file(source: RegistrySource, name: string) {
  let [first] = item(source, name).files ?? []
  if (!first) throw new Error(`${name} has no files`)
  return first
}

function problemsAfter(change: (source: RegistrySource) => void) {
  let source = makeSource()
  change(source)
  return checkRegistry(source)
}

describe('checkRegistry', () => {
  it('passes a registry that keeps the contracts', () => {
    assert.deepEqual(checkRegistry(makeSource()), [])
  })

  it('rejects a registry with another name or homepage, or one that includes other files', () => {
    let problems = problemsAfter((source) => {
      Object.assign(source.registry, { name: 'acme', homepage: 'https://example.com/', include: ['more.json'] })
    })

    assert.deepEqual(problems, [
      'registry name must be "remixcn", the catalog namespace without @',
      `registry homepage must be ${homepage}`,
      'registry must list its items itself, without include',
    ])
  })

  it('rejects an item listed twice', () => {
    let problems = problemsAfter((source) => source.registry.items.push(licenses()))

    assert.ok(problems.includes('licenses: listed more than once'), problems.join('\n'))
  })

  it('keeps the name registry for the index', () => {
    let problems = problemsAfter((source) => source.registry.items.push({ ...licenses(), name: 'registry', files: [] }))

    assert.ok(problems.includes('registry: the index is registry.json, so no item may take this name'), problems.join('\n'))
  })

  it('rejects two files that install to the same target', () => {
    let problems = problemsAfter((source) => {
      let notices = { ...licenses(), name: 'notices' }
      notices.files = notices.files?.slice(1)
      source.registry.items.push(notices)
    })

    assert.ok(
      problems.includes('@lib/remixcn/THIRD_PARTY_NOTICES.md: both licenses and notices install a file there'),
      problems.join('\n'),
    )
  })

  it('names the items of a dependency cycle', () => {
    let problems = problemsAfter((source) => item(source, 'cx').registryDependencies?.push('@remixcn/button'))

    assert.ok(problems.includes('dependency cycle: button → cx → button'), problems.join('\n'))
  })

  it('rejects a dependency that is missing, outside @remixcn or the item itself', () => {
    let problems = problemsAfter((source) => {
      item(source, 'button').registryDependencies?.push('@remixcn/card', 'input', '@acme/button', '@remixcn/button')
    })

    for (let problem of [
      'button: depends on @remixcn/card, which registry.json does not list',
      'button: depends on "input", but registryDependencies name @remixcn items; a bare name installs shadcn/ui\'s React component',
      'button: depends on "@acme/button", but registryDependencies name @remixcn items; a bare name installs shadcn/ui\'s React component',
      'button: depends on itself',
    ]) {
      assert.ok(problems.includes(problem), `${problem}\n\n${problems.join('\n')}`)
    }
  })

  it('rejects npm dependencies, since the app supplies remix', () => {
    let problems = problemsAfter((source) => {
      Object.assign(item(source, 'button'), { dependencies: ['react'], devDependencies: ['tailwindcss'] })
    })

    assert.deepEqual(problems, [
      'button: dependencies must stay empty: the app supplies remix and items add no npm packages (react)',
      'button: devDependencies must stay empty: the app supplies remix and items add no npm packages (tailwindcss)',
    ])
  })

  it('rejects fields RemixCN items do not ship, such as Tailwind config and env vars', () => {
    let problems = problemsAfter((source) => {
      Object.assign(item(source, 'theme'), { cssVars: { light: {} }, tailwind: {}, envVars: { SECRET: 'x' }, meta: {} })
    })

    assert.deepEqual(problems, [
      'theme: cssVars is not supported: items ship plain source files and the build writes meta',
      'theme: tailwind is not supported: items ship plain source files and the build writes meta',
      'theme: envVars is not supported: items ship plain source files and the build writes meta',
      'theme: meta is not supported: items ship plain source files and the build writes meta',
    ])
  })

  it('rejects an item name, type, title or description that does not fit', () => {
    let problems = problemsAfter((source) => {
      Object.assign(item(source, 'button'), { type: 'registry:block', description: '' })
      source.registry.items.push({ ...licenses(), name: 'Licenses_2', files: [] })
    })

    for (let problem of [
      'button: type registry:block is not one RemixCN ships (registry:ui, registry:component, registry:lib, registry:style, registry:file)',
      'button: needs a title and a description',
      'Licenses_2: item names are lowercase words joined by hyphens',
      'Licenses_2: ships no files',
    ]) {
      assert.ok(problems.includes(problem), `${problem}\n\n${problems.join('\n')}`)
    }
  })

  it('types the license texts as registry:file', () => {
    let problems = problemsAfter((source) => {
      item(source, 'licenses').type = 'registry:lib'
    })

    assert.deepEqual(problems, ['licenses: an item of license texts has type registry:file'])
  })

  for (let missing of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) {
    it(`requires the licenses item to ship ${missing}`, () => {
      let problems = problemsAfter((source) => {
        let licensesItem = item(source, 'licenses')
        licensesItem.files = licensesItem.files?.filter((file) => file.path !== missing)
      })

      assert.deepEqual(problems, [
        `licenses: ships LICENSE and THIRD_PARTY_NOTICES.md, the license texts every item installs, but misses ${missing}`,
      ])
    })
  }

  it('ships the license texts only in the licenses item', () => {
    let problems = problemsAfter((source) => {
      item(source, 'cx').files?.push({ path: 'LICENSE', type: 'registry:file', target: '@lib/remixcn/LICENSE' })
    })

    assert.ok(problems.includes('cx: only @remixcn/licenses ships LICENSE'), problems.join('\n'))
  })

  it('rejects source paths that leave the registry, and tests, server or private files', () => {
    for (let [path, problem] of [
      ['registry/ui/../../.env', 'must be a plain relative path inside the workspace'],
      ['/etc/passwd', 'must be a plain relative path inside the workspace'],
      ['registry\\ui\\button.tsx', 'must be a plain relative path inside the workspace'],
      ['registry/ui/%2e%2e/button.tsx', 'must be a plain relative path inside the workspace'],
      ['registry/ui/button.test.tsx', 'is not registry source'],
      ['apps/docs/app/server.ts', 'is not registry source'],
      ['.env', 'is not registry source'],
    ]) {
      let problems = problemsAfter((source) => {
        file(source, 'button').path = path
      })

      assert.ok(
        problems.some((text) => text.startsWith(`button: "${path}" ${problem}`)),
        `${path}\n\n${problems.join('\n')}`,
      )
    }
  })

  it('rejects targets that leave their install directory', () => {
    for (let target of ['@ui/../../button.tsx', '~/button.tsx', '/tmp/button.tsx', '@ui/./button.tsx', 'C:\\button.tsx']) {
      let problems = problemsAfter((source) => {
        file(source, 'button').target = target
      })

      assert.ok(
        problems.includes(`button: target "${target}" must stay inside the @ui/, @lib/ or @components/ directory`),
        `${target}\n\n${problems.join('\n')}`,
      )
    }
  })

  it('rejects a target or file type that does not match where the file comes from', () => {
    let problems = problemsAfter((source) => {
      Object.assign(file(source, 'button'), { type: 'registry:lib', target: '@lib/button.tsx' })
      Object.assign(file(source, 'theme'), { type: 'registry:style' })
    })

    assert.deepEqual(problems, [
      'button: registry/ui/button.tsx has type registry:ui',
      'button: registry/ui/button.tsx installs to @ui/button.tsx',
      'theme: registry/lib/theme.css has type registry:file',
    ])
  })

  it('rejects a listed file that does not exist', () => {
    let problems = problemsAfter((source) => source.files.delete('registry/lib/cx.ts'))

    assert.deepEqual(problems, ['cx: registry/lib/cx.ts does not exist'])
  })

  it('rejects a local import from an item the importer does not depend on', () => {
    let problems = problemsAfter((source) => {
      item(source, 'button').registryDependencies = ['@remixcn/theme']
    })

    assert.deepEqual(problems, [
      'button: registry/ui/button.tsx imports #remixcn/lib/cx.ts from cx, so it must list @remixcn/cx in registryDependencies',
    ])
  })

  it('rejects a local import of a file no item ships', () => {
    let problems = problemsAfter((source) => source.imports.get('registry/ui/button.tsx')?.push('#remixcn/ui/card.tsx'))

    assert.deepEqual(problems, ['button: registry/ui/button.tsx imports #remixcn/ui/card.tsx, which no item ships'])
  })

  it('rejects npm packages, Node built-ins and relative paths in shipped imports', () => {
    let problems = problemsAfter((source) => source.imports.get('registry/ui/button.tsx')?.push('lodash', 'node:fs', '../lib/cx.ts'))

    assert.deepEqual(problems, [
      'button: registry/ui/button.tsx: "lodash": browser-reachable source imports only remix/component and #remixcn/ui/ or #remixcn/lib/ files',
      'button: registry/ui/button.tsx: "node:fs" is a Node built-in, which browser-reachable source must not use',
      'button: registry/ui/button.tsx: "../lib/cx.ts": import registry files through #remixcn/ui/ or #remixcn/lib/ so the installer can rewrite the path',
    ])
  })

  it('rejects Tailwind directives in shipped CSS', () => {
    let problems = problemsAfter((source) => source.files.set('registry/lib/theme.css', '@tailwind base;\n'))

    assert.deepEqual(problems, ['theme: registry/lib/theme.css: @tailwind is a Tailwind directive, which shipped CSS must not use'])
  })

  it('requires every item with registry source to install the license texts', () => {
    let problems = problemsAfter((source) => {
      item(source, 'cx').registryDependencies = []
      item(source, 'theme').registryDependencies = []
    })

    assert.deepEqual(problems, [
      'button: installs no license texts: list @remixcn/licenses in registryDependencies, directly or through a dependency',
      'cx: installs no license texts: list @remixcn/licenses in registryDependencies, directly or through a dependency',
      'theme: installs no license texts: list @remixcn/licenses in registryDependencies, directly or through a dependency',
    ])
  })

  it('matches each item with registry source to its catalog entry', () => {
    let problems = problemsAfter((source) => {
      item(source, 'button').title = 'Push button'
      item(source, 'cx').type = 'registry:ui'
      file(source, 'theme').path = 'registry/lib/tokens.css'
      file(source, 'theme').target = '@lib/tokens.css'
      source.files.set('registry/lib/tokens.css', '')
      source.catalog.entries = []
    })

    assert.deepEqual(problems, [
      'button: not in registry/catalog.json',
      'cx: a catalog helper written in TypeScript has type registry:lib',
      'theme: ships registry/lib/tokens.css, but registry/catalog.json gives it registry/lib/theme.css',
    ])

    problems = problemsAfter((source) => {
      item(source, 'button').title = 'Push button'
    })
    assert.deepEqual(problems, ['button: title "Push button" differs from "Button" in registry/catalog.json'])
  })
})

describe('checkSourcePath', () => {
  it('accepts registry source and the license texts', () => {
    for (let path of ['registry/ui/button.tsx', 'registry/lib/cx.ts', 'registry/lib/theme.css', 'registry/examples/data-table.tsx', 'LICENSE', 'THIRD_PARTY_NOTICES.md']) {
      assert.equal(checkSourcePath(path), undefined, path)
    }
  })
})

describe('dependencyClosure', () => {
  it('lists an item after everything it needs, in the same order each time', () => {
    let { registry } = makeSource()

    assert.deepEqual(dependencyClosure(registry.items, 'button'), ['licenses', 'cx', 'theme', 'button'])
    assert.deepEqual(dependencyClosure([...registry.items].reverse(), 'button'), ['licenses', 'cx', 'theme', 'button'])
  })

  it('stops at a cycle', () => {
    let { registry } = makeSource()
    registry.items[1].registryDependencies?.push('@remixcn/button')

    assert.deepEqual(dependencyClosure(registry.items, 'cx'), ['licenses', 'theme', 'button', 'cx'])
  })
})

describe('buildRegistry', () => {
  let remix = '3.0.0'

  it('writes the index and one payload per item, sorted by name', () => {
    let output = buildRegistry(makeSource(), { remix })

    assert.deepEqual([...output.keys()], ['registry.json', 'button.json', 'cx.json', 'licenses.json', 'theme.json'])

    let index = JSON.parse(output.get('registry.json') ?? '')
    assert.equal(index.$schema, 'https://ui.shadcn.com/schema/registry.json')
    assert.equal(index.name, 'remixcn')
    assert.equal(index.homepage, homepage)
    assert.deepEqual(
      index.items.map((entry: RegistryItem) => entry.name),
      ['button', 'cx', 'licenses', 'theme'],
    )
  })

  it('inlines each file with its type and alias target, and leaves contents out of the index', () => {
    let output = buildRegistry(makeSource(), { remix })
    let button = JSON.parse(output.get('button.json') ?? '')
    let index = JSON.parse(output.get('registry.json') ?? '')

    assert.deepEqual(button, {
      $schema: 'https://ui.shadcn.com/schema/registry-item.json',
      name: 'button',
      type: 'registry:ui',
      title: 'Button',
      description: 'A button.',
      registryDependencies: ['@remixcn/cx', '@remixcn/theme'],
      files: [
        {
          path: 'registry/ui/button.tsx',
          type: 'registry:ui',
          target: '@ui/button.tsx',
          content: "import { cx } from '#remixcn/lib/cx.ts'\n\nexport function Button() {}\n",
        },
      ],
      meta: { remix: '3.0.0', license: 'MIT', source: `${shadcnFile}/ui/button.tsx` },
    })
    assert.deepEqual(index.items[0].files, [{ path: 'registry/ui/button.tsx', type: 'registry:ui', target: '@ui/button.tsx' }])
  })

  it('credits RemixCN without an upstream source on items outside the catalog', () => {
    let licensesPayload = JSON.parse(buildRegistry(makeSource(), { remix }).get('licenses.json') ?? '')

    assert.deepEqual(licensesPayload.meta, { remix: '3.0.0', license: 'MIT' })
    assert.equal(licensesPayload.registryDependencies, undefined)
  })

  it('normalizes newlines and drops a byte order mark', () => {
    let source = makeSource()
    source.files.set('registry/lib/cx.ts', '\uFEFFexport function cx() {\r\n  return ""\r}\r\n')

    let cx = JSON.parse(buildRegistry(source, { remix }).get('cx.json') ?? '')

    assert.equal(cx.files[0].content, 'export function cx() {\n  return ""\n}\n')
  })

  it('writes the same bytes whatever order the items and dependencies come in', () => {
    let reordered = makeSource()
    reordered.registry.items.reverse()
    item(reordered, 'button').registryDependencies?.reverse()

    assert.deepEqual(buildRegistry(reordered, { remix }), buildRegistry(makeSource(), { remix }))
    for (let text of buildRegistry(reordered, { remix }).values()) assert.match(text, /^\{\n {2}"\$schema".*\n\}\n$/s)
  })

  it("passes shadcn's official registry and registry-item schemas", () => {
    let output = buildRegistry(makeSource(), { remix })

    for (let [name, text] of output) {
      let schema = name === 'registry.json' ? registrySchema : registryItemSchema
      let result = schema.safeParse(JSON.parse(text))
      assert.ok(result.success, `${name}: ${result.error?.message}`)
    }
  })
})
