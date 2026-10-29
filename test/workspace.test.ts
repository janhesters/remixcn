import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { checkCatalog, checkPackageMetadata, homepage, seoPhrase } from '../scripts/contracts.ts'
import type { Catalog } from '../scripts/contracts.ts'
import { listPackageFiles } from '../scripts/workspace.ts'

const root = fileURLToPath(new URL('..', import.meta.url))

function read(file: string) {
  return readFileSync(`${root}/${file}`, 'utf8')
}

function readJson(file: string) {
  return JSON.parse(read(file))
}

// bun.lock is JSON with trailing commas.
function readLockfile() {
  return JSON.parse(read('bun.lock').replace(/,(\s*[}\]])/g, '$1'))
}

const packageFiles = listPackageFiles(root)

describe('workspace', () => {
  it('finds the root, docs and CLI packages', () => {
    assert.deepEqual(packageFiles, ['package.json', 'apps/docs/package.json', 'packages/cli/package.json'])
  })

  it('locks every workspace with the dependencies its package.json lists', () => {
    let lock = readLockfile()
    let workspaces = Object.fromEntries(packageFiles.map((file) => [file.replace(/\/?package\.json$/, ''), file]))

    assert.deepEqual(Object.keys(lock.workspaces).sort(), Object.keys(workspaces).sort())
    for (let [path, file] of Object.entries(workspaces)) {
      let pkg = readJson(file)
      let locked = lock.workspaces[path]
      assert.equal(locked.name, pkg.name, path)
      assert.deepEqual(locked.dependencies ?? {}, pkg.dependencies ?? {}, `${path} dependencies`)
      assert.deepEqual(locked.devDependencies ?? {}, pkg.devDependencies ?? {}, `${path} devDependencies`)
    }
  })

  it('pins remix to 3.0.0 and supports Node 24.3.0 and later everywhere', () => {
    let lock = readLockfile()

    assert.equal(lock.packages.remix[0], 'remix@3.0.0')
    assert.equal(readJson('package.json').devDependencies.remix, '3.0.0')
    assert.equal(readJson('apps/docs/package.json').dependencies.remix, '3.0.0')
    for (let file of packageFiles) assert.equal(readJson(file).engines.node, '>=24.3.0', file)
  })

  it('pins every development tool to an exact version', () => {
    for (let [name, version] of Object.entries<string>(readJson('package.json').devDependencies)) {
      assert.match(version, /^\d+\.\d+\.\d+$/, name)
    }
  })

  it('typechecks strictly with Remix JSX', () => {
    let { compilerOptions } = readJson('tsconfig.json')

    assert.equal(compilerOptions.strict, true)
    assert.equal(compilerOptions.module, 'NodeNext')
    assert.equal(compilerOptions.jsx, 'react-jsx')
    assert.equal(compilerOptions.jsxImportSource, 'remix/component')
  })

  it('maps the registry aliases to the registry folders', () => {
    assert.deepEqual(readJson('package.json').imports, {
      '#remixcn/ui/*': './registry/ui/*',
      '#remixcn/lib/*': './registry/lib/*',
    })
  })
})

describe('metadata', () => {
  it('carries the approved names, phrase, homepage and keywords in every package', () => {
    for (let file of packageFiles) assert.deepEqual(checkPackageMetadata(readJson(file)), [], file)
    assert.equal(readJson('package.json').name, '@remixcn/workspace')
    assert.equal(readJson('apps/docs/package.json').name, '@remixcn/docs')
  })

  it('keeps the phrase and homepage in the README', () => {
    let readme = read('README.md')

    assert.match(readme, /^# RemixCN$/m)
    assert.ok(readme.includes(seoPhrase))
    assert.ok(readme.includes(homepage))
  })

  it('keeps the CLI unpublished until Jan releases it', () => {
    assert.equal(readJson('packages/cli/package.json').private, true)
  })
})

describe('catalog', () => {
  let catalog = readJson('registry/catalog.json') as Catalog

  it('passes its own checks', () => {
    assert.deepEqual(checkCatalog(catalog), [])
  })

  it('lists all 64 base UI files and the three recipes', () => {
    let components = catalog.entries.filter((entry) => entry.kind === 'component')
    let recipes = catalog.entries.filter((entry) => entry.kind === 'recipe').map((entry) => entry.name)

    assert.equal(components.length, 64)
    assert.deepEqual(recipes, ['data-table', 'date-picker', 'typography'])
    assert.equal(catalog.namespace, '@remixcn')
  })

  it('keeps charts, complex selection and the newer message, code and trace components', () => {
    let names = new Set(catalog.entries.map((entry) => entry.name))

    for (let name of ['chart', 'combobox', 'command', 'select', 'message', 'message-scroller', 'code-block', 'trace']) {
      assert.ok(names.has(name), name)
    }
  })

  it('maps Sonner to Toast', () => {
    let sonner = catalog.entries.find((entry) => entry.name === 'sonner')

    assert.equal(sonner?.compatibleWith, 'toast')
    assert.ok(sonner?.dependsOn.includes('toast'))
  })

  it('leaves AI Elements patterns and Blocks out of the first release', () => {
    assert.deepEqual(
      catalog.outOfScope.map((item) => item.name),
      ['AI Elements patterns', 'Blocks'],
    )
    assert.ok(!catalog.entries.some((entry) => /\/(blocks|ai-elements)\//.test(entry.source)))
  })
})

describe('contributor docs and credits', () => {
  it('records the contracts and each accepted card decision', () => {
    let agents = read('AGENTS.md')

    for (let fact of ['C-976', 'C-977', 'C-978', 'C-979', 'C-980', 'C-981', '#remixcn/ui/', '#remixcn/lib/']) {
      assert.ok(agents.includes(fact), fact)
    }
    assert.ok(agents.includes('node_modules/remix/INDEX.md'))
  })

  it('keeps the requested remix skill as remix 3.0.0 ships it', () => {
    let fromRemix = createRequire(fileURLToPath(import.meta.resolve('remix/package.json')))
    let template = dirname(fromRemix.resolve('@remix-run/cli/package.json'))

    assert.equal(
      read('.agents/skills/remix/SKILL.md'),
      readFileSync(`${template}/template/.agents/skills/remix/SKILL.md`, 'utf8'),
    )
  })

  it("keeps Jan's license and adds the upstream notices", () => {
    let notices = read('THIRD_PARTY_NOTICES.md')

    assert.match(read('LICENSE'), /^Copyright \(c\) 2026 Jan Hesters$/m)
    for (let copyright of ['Copyright (c) 2023 shadcn', 'Copyright (c) 2019 Material-UI SAS', 'Copyright (c) 2025 Shopify Inc.']) {
      assert.ok(notices.includes(copyright), copyright)
    }
  })

  it('credits the pinned sources', () => {
    let sources = read('SOURCES.md')
    let { upstream } = readJson('registry/catalog.json') as Catalog

    for (let { commit } of Object.values(upstream)) assert.ok(sources.includes(commit), commit)
    assert.ok(sources.includes('remix@3.0.0'))
  })
})

describe('consumer fixture', () => {
  it('is a Remix 3.0.0 app that installs no RemixCN runtime package', () => {
    let pkg = readJson('test/fixtures/consumer-app/package.json')
    let { compilerOptions } = readJson('test/fixtures/consumer-app/tsconfig.json')

    assert.deepEqual(pkg.dependencies, { remix: '3.0.0' })
    assert.equal(compilerOptions.jsxImportSource, 'remix/component')
  })
})
