import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { checkWorkflow } from '../scripts/contracts.ts'
import { supportedNode } from '../scripts/lanes.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const workflowFiles = readdirSync(`${root}/.github/workflows`).map((file) => `.github/workflows/${file}`)

function read(file: string) {
  return readFileSync(`${root}/${file}`, 'utf8')
}

function lines(pattern: RegExp) {
  return workflowFiles.flatMap((file) => [...read(file).matchAll(pattern)].map((match) => match[1]))
}

describe('CI', () => {
  it('keeps every workflow within the CI contract', () => {
    assert.deepEqual(workflowFiles, ['.github/workflows/ci.yml'])
    for (let file of workflowFiles) assert.deepEqual(checkWorkflow(read(file)), [], file)
  })

  it('runs on the Node versions the workspace supports', () => {
    let { engines } = JSON.parse(read('package.json'))

    assert.equal(engines.node, `>=${supportedNode.oldest}`)
    assert.deepEqual([...new Set(lines(/^\s*node-version:\s*(.+)$/gm))], [supportedNode.oldest, '${{ matrix.node }}'])
  })

  it('installs the pinned Bun from the frozen lockfile', () => {
    let { packageManager } = JSON.parse(read('package.json'))

    assert.match(packageManager, /^bun@\d+\.\d+\.\d+$/)
    assert.deepEqual([...new Set(lines(/^\s*bun-version-file:\s*(.+)$/gm))], ['package.json'])
    assert.equal(lines(/uses: (oven-sh\/setup-bun)@/g).length, lines(/bun-version-file: (package\.json)/g).length)
    assert.deepEqual([...new Set(lines(/^\s*- run: (bun install.*)$/gm))], ['bun install --frozen-lockfile'])
  })

  it('keys each cache by the lockfile or the Playwright version it holds', () => {
    let keys = lines(/^\s*key:\s*(.+)$/gm)

    assert.ok(keys.length > 0)
    for (let key of keys) {
      assert.match(key, /hashFiles\('bun\.lock'\)|steps\.playwright\.outputs\.version/, key)
    }
  })
})
