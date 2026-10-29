import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

const root = fileURLToPath(new URL('..', import.meta.url))

describe('check:build', () => {
  it('builds the remixcn executable and runs it', { timeout: 60_000 }, () => {
    let result = spawnSync(process.execPath, ['scripts/check-build.ts'], { cwd: root, encoding: 'utf8' })

    assert.equal(result.status, 0, result.stderr)
    assert.match(
      result.stdout,
      /✓ package\.json, apps\/docs\/package\.json and packages\/cli\/package\.json carry the approved metadata/,
    )
    assert.match(result.stdout, /✓ packages\/cli\/src imports only Node built-ins and its own files/)
    assert.match(result.stdout, /✓ packages\/cli\/dist\/bin\.js runs as remixcn 0\.0\.0/)
  })
})
