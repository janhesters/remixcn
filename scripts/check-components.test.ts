import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

const root = fileURLToPath(new URL('..', import.meta.url))

function checkComponents(directory: string) {
  return spawnSync(process.execPath, ['scripts/check-components.ts', directory], { cwd: root, encoding: 'utf8' })
}

describe('check:components', () => {
  it('passes the workspace', () => {
    let result = checkComponents('.')

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /registry\/catalog\.json: 67 entries and 3 helpers in 8 batches/)
  })

  it('passes a registry that keeps the contracts', () => {
    let result = checkComponents('test/fixtures/registries/clean')

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /3 browser-reachable files/)
  })

  it('fails a registry that breaks them, naming each problem', () => {
    let result = checkComponents('test/fixtures/registries/forbidden')

    assert.equal(result.status, 1)
    for (let problem of [
      /registry\/ui\/badge\.tsx: "react" brings in React/,
      /registry\/ui\/badge\.tsx: "@base-ui\/react\/use-render" brings in Base UI/,
      /registry\/ui\/badge\.tsx: "\.\.\/lib\/cx\.ts": import registry files through #remixcn/,
      /registry\/ui\/banner\.tsx: not a target in registry\/catalog\.json/,
      /apps\/docs\/app\/public\/theme\.css: "tailwindcss" brings in Tailwind/,
      /apps\/docs\/app\/public\/theme\.css: @apply is a Tailwind directive/,
      /apps\/docs\/package\.json: @remixcn\/docs: dependencies may only list remix \(tailwindcss\)/,
    ]) {
      assert.match(result.stderr, problem)
    }
  })
})
