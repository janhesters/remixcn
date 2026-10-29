import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

const root = fileURLToPath(new URL('..', import.meta.url))
const fixture = join(root, 'test/fixtures/registries/installable')

let scratch: string[] = []

function scratchDirectory() {
  let directory = mkdtempSync(join(tmpdir(), 'remixcn-build-'))
  scratch.push(directory)
  return directory
}

function build(workspace: string, out: string) {
  return spawnSync(process.execPath, ['scripts/build-registry.ts', workspace, '--out', out], {
    cwd: root,
    encoding: 'utf8',
  })
}

function readTree(directory: string) {
  return new Map(
    readdirSync(directory)
      .sort()
      .map((name) => [name, readFileSync(join(directory, name), 'utf8')]),
  )
}

/**
 * Copies the installable fixture, changes it, and builds it over an existing
 * output. A change that returns text replaces registry.json with it.
 */
function buildChanged(change: (workspace: string, registry: { items: Array<Record<string, any>> }) => string | void) {
  let directory = scratchDirectory()
  let workspace = join(directory, 'workspace')
  let out = join(directory, 'public/r')
  cpSync(fixture, workspace, { recursive: true })

  let registry = JSON.parse(readFileSync(join(workspace, 'registry.json'), 'utf8'))
  writeFileSync(join(workspace, 'registry.json'), change(workspace, registry) ?? JSON.stringify(registry))

  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, 'registry.json'), 'the previous build\n')

  return { result: build(workspace, out), out, parent: join(directory, 'public') }
}

function item(registry: { items: Array<Record<string, any>> }, name: string) {
  return registry.items.find((entry) => entry.name === name) as Record<string, any>
}

afterEach(() => {
  for (let directory of scratch) rmSync(directory, { recursive: true, force: true })
  scratch = []
})

describe('build:registry', () => {
  it('builds the index and one payload per item', { timeout: 60_000 }, () => {
    let out = join(scratchDirectory(), 'r')

    let result = build(fixture, out)

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /✓ Built 4 items: button, cx, licenses, theme/)
    assert.deepEqual(
      [...readTree(out).keys()],
      ['button.json', 'cx.json', 'licenses.json', 'registry.json', 'theme.json'],
    )

    let theme = JSON.parse(readFileSync(join(out, 'theme.json'), 'utf8'))
    assert.equal(theme.files[0].content, readFileSync(join(fixture, 'registry/lib/theme.css'), 'utf8'))
    assert.deepEqual(theme.meta, {
      remix: '3.0.0',
      license: 'MIT',
      source:
        'https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/themes.ts',
    })
  })

  it('writes the same bytes on every build and replaces the previous output', { timeout: 60_000 }, () => {
    let directory = scratchDirectory()
    let first = join(directory, 'first')
    let second = join(directory, 'second')
    mkdirSync(second)
    writeFileSync(join(second, 'removed-item.json'), '{}\n')

    assert.equal(build(fixture, first).status, 0)
    assert.equal(build(fixture, second).status, 0)
    assert.equal(build(fixture, second).status, 0)

    assert.deepEqual(readTree(second), readTree(first))
    assert.deepEqual(readdirSync(directory).sort(), ['first', 'second'])
  })

  it('builds the workspace registry with the license texts', { timeout: 60_000 }, () => {
    let out = join(scratchDirectory(), 'r')

    let result = build(root, out)

    assert.equal(result.status, 0, result.stderr)
    let licenses = JSON.parse(readFileSync(join(out, 'licenses.json'), 'utf8'))
    assert.deepEqual(
      licenses.files.map((file: { path: string; target: string }) => [file.path, file.target]),
      [
        ['LICENSE', '@lib/remixcn/LICENSE'],
        ['THIRD_PARTY_NOTICES.md', '@lib/remixcn/THIRD_PARTY_NOTICES.md'],
      ],
    )
    assert.equal(licenses.files[1].content, readFileSync(join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8'))
  })

  it('refuses to replace an output folder that holds anything but a registry build', { timeout: 60_000 }, () => {
    let out = join(scratchDirectory(), 'site')
    mkdirSync(join(out, 'assets'), { recursive: true })
    writeFileSync(join(out, 'index.html'), '<h1>Site</h1>\n')

    let result = build(fixture, out)

    assert.equal(result.status, 1)
    assert.match(
      result.stderr,
      /site holds assets and index\.html, not just a registry build, so the build won't replace it/,
    )
    assert.deepEqual(readdirSync(out).sort(), ['assets', 'index.html'])
  })

  for (let [name, change, problem] of [
    [
      'a dependency cycle',
      (_workspace, registry) => {
        item(registry, 'cx').registryDependencies.push('@remixcn/button')
      },
      /dependency cycle: button → cx → button/,
    ],
    [
      'two files with one target',
      (_workspace, registry) => {
        item(registry, 'theme').files[0].target = '@lib/cx.ts'
      },
      /@lib\/cx\.ts: both cx and theme install a file there/,
    ],
    ['malformed JSON', () => '{ "items": [ }', /registry\.json is not valid JSON/],
    [
      "a registry.json that shadcn's schema rejects",
      (_workspace, registry) => {
        delete item(registry, 'licenses').files[0].target
      },
      /registry\.json does not match shadcn's registry schema at items\.3\.files\.0\.target/,
    ],
    [
      'a path that leaves the workspace',
      (_workspace, registry) => {
        item(registry, 'cx').files[0].path = 'registry/lib/../../../secrets.ts'
      },
      /cx: "registry\/lib\/\.\.\/\.\.\/\.\.\/secrets\.ts" must be a plain relative path inside the workspace/,
    ],
    [
      'a registry file that links outside the workspace',
      (workspace) => {
        rmSync(join(workspace, 'registry/lib/cx.ts'))
        symlinkSync(join(root, 'scripts/contracts.ts'), join(workspace, 'registry/lib/cx.ts'))
      },
      /cx: registry\/lib\/cx\.ts must be a file inside the workspace, not a link/,
    ],
    [
      'a registry folder that links outside the workspace',
      (workspace) => {
        let outside = join(workspace, '../outside')
        cpSync(join(workspace, 'registry/lib'), outside, { recursive: true })
        rmSync(join(workspace, 'registry/lib'), { recursive: true })
        symlinkSync(outside, join(workspace, 'registry/lib'), 'dir')
      },
      /cx: registry\/lib\/cx\.ts must be a file inside the workspace, not a link/,
    ],
    ...['LICENSE', 'THIRD_PARTY_NOTICES.md'].map((missing) => [
      `a licenses item without ${missing}`,
      (_workspace: string, registry: { items: Array<Record<string, any>> }) => {
        let licenses = item(registry, 'licenses')
        licenses.files = licenses.files.filter((file: { path: string }) => file.path !== missing)
      },
      new RegExp(
        `licenses: ships LICENSE and THIRD_PARTY_NOTICES\\.md, the license texts every item installs, but misses ${missing.replace('.', '\\.')}`,
      ),
    ]),
    [
      'a missing file',
      (workspace) => rmSync(join(workspace, 'registry/lib/cx.ts')),
      /cx: registry\/lib\/cx\.ts does not exist/,
    ],
    [
      'an undeclared local import',
      (_workspace, registry) => {
        item(registry, 'button').registryDependencies = ['@remixcn/theme']
      },
      /button: registry\/ui\/button\.tsx imports #remixcn\/lib\/cx\.ts from cx, so it must list @remixcn\/cx/,
    ],
    [
      'an npm dependency',
      (_workspace, registry) => {
        item(registry, 'button').dependencies = ['class-variance-authority']
      },
      /button: dependencies must stay empty/,
    ],
    [
      'an npm import',
      (workspace) => {
        let file = join(workspace, 'registry/lib/cx.ts')
        writeFileSync(file, `import { clsx } from 'clsx'\n${readFileSync(file, 'utf8')}`)
      },
      /cx: registry\/lib\/cx\.ts: "clsx": browser-reachable source imports only remix\/component/,
    ],
  ] as Array<[string, Parameters<typeof buildChanged>[0], RegExp]>) {
    it(`fails on ${name} without touching the output`, { timeout: 60_000 }, () => {
      let { result, out, parent } = buildChanged(change)

      assert.equal(result.status, 1, result.stdout)
      assert.match(result.stderr, problem)
      assert.deepEqual(readTree(out), new Map([['registry.json', 'the previous build\n']]))
      assert.deepEqual(readdirSync(parent), ['r'])
    })
  }
})
