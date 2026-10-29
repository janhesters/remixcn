import { appendFileSync, cpSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { buildRegistryFolder } from './build.ts'
import { CliError } from './errors.ts'

const fixture = fileURLToPath(new URL('../../../test/fixtures/registries/installable', import.meta.url))

let scratch: string[] = []

afterEach(() => {
  for (let directory of scratch) rmSync(directory, { recursive: true, force: true })
  scratch = []
})

/** Copies the installable fixture with `code` appended to its cx helper. */
function workspaceWith(code: string) {
  let directory = mkdtempSync(join(tmpdir(), 'remixcn-build-'))
  scratch.push(directory)
  let workspace = join(directory, 'workspace')
  cpSync(fixture, workspace, { recursive: true })
  appendFileSync(join(workspace, 'registry/lib/cx.ts'), `${code}\n`)
  return { workspace, out: join(directory, 'r') }
}

describe('buildRegistryFolder without a compiler', () => {
  it('builds a helper whose string holds import text', () => {
    let { workspace, out } = workspaceWith(`export const example = "import('react')"`)

    let names = buildRegistryFolder({ root: workspace, out, remix: '3.0.0' })

    assert.deepEqual(names, ['button', 'cx', 'licenses', 'theme'])
  })

  it('builds a helper with a method named import and a regular expression after a condition', () => {
    let { workspace, out } = workspaceWith(
      [
        'const handlers = { import: (name: string) => name }',
        "export const label = handlers.import('labels')",
        "export function matches(value: string) { if (value) return /import('react')/.test(value) }",
      ].join('\n'),
    )

    assert.deepEqual(buildRegistryFolder({ root: workspace, out, remix: '3.0.0' }), [
      'button',
      'cx',
      'licenses',
      'theme',
    ])
  })

  it('refuses a Node import after a type assertion in a .ts helper', () => {
    let { workspace, out } = workspaceWith(
      "export const initial = <unknown>{};\nimport { readFileSync } from 'node:fs'",
    )

    let error: unknown
    try {
      buildRegistryFolder({ root: workspace, out, remix: '3.0.0' })
    } catch (caught) {
      error = caught
    }

    assert.ok(error instanceof CliError, String(error))
    assert.deepEqual(error.details, [
      'registry.json: cx: registry/lib/cx.ts: "node:fs" is a Node built-in, which browser-reachable source must not use',
    ])
  })

  it('refuses a React import inside a template expression and writes nothing', () => {
    let { workspace, out } = workspaceWith("export const example = `${import('react')}`")

    let error: unknown
    try {
      buildRegistryFolder({ root: workspace, out, remix: '3.0.0' })
    } catch (caught) {
      error = caught
    }

    assert.ok(error instanceof CliError, String(error))
    assert.equal(error.code, 'REGISTRY')
    assert.deepEqual(error.details, [
      'registry.json: cx: registry/lib/cx.ts: "react" brings in React, which browser-reachable source must not use',
    ])
    assert.deepEqual(readdirSync(join(out, '..')), ['workspace'])
  })
})
