import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { stripVTControlCharacters } from 'node:util'

import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

const root = fileURLToPath(new URL('..', import.meta.url))
const remix = fileURLToPath(new URL('../node_modules/remix/dist/cli-entry.js', import.meta.url))
const fixtures = 'test/fixtures/browser-runner'

/** The engine this test runs in. Its Playwright project has the same name. */
async function currentEngine(t: TestContext) {
  let page = await t.serve(await createTestServer(() => new Response()))
  return page.context().browser()!.browserType().name()
}

/**
 * Runs fixture files, in this order, through the installed `remix test`
 * browser runner, in the current engine with the lanes' Playwright config and
 * its default window. Returns each test's TAP result line without its number.
 */
async function runFixtures(t: TestContext, names: string[]) {
  let engine = await currentEngine(t)
  let files = names.map((name) => `${fixtures}/${name}.test.browser.ts`)
  let args = [remix, '--config', `${fixtures}/remix.json`, 'test', '--project', engine, '--reporter', 'tap', ...files]
  // In its own process group, so a run this test abandons stops with it.
  let child = spawn(process.execPath, args, { cwd: root, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
  t.after(() => {
    if (child.exitCode === null && child.signalCode === null) process.kill(-child.pid!, 'SIGKILL')
  })

  let output = ''
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => (output += chunk))
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => (output += chunk))
  let status = await new Promise<number | null>((resolve) => child.on('close', resolve))
  output = stripVTControlCharacters(output)
  let results = [...output.matchAll(/^(ok|not ok) \d+ - (.+) # browser:\w+$/gm)].map(([, result, name]) => {
    return `${result} ${name}`
  })
  return { status, output, results }
}

// Longer than the runner's 90-second progress timeout, so a stalled run ends
// with the runner's own report.
const runTimeout = { timeout: 120_000 }

const frameChecks = [
  'ok after a window of results > sits below the first window of the page',
  'ok after a window of results > shows the whole frame in the window',
  'ok after a window of results > renders a control and gets 30 animation frames within 5 seconds',
]

describe('the browser test runner', () => {
  it('keeps the running file in view below a window of finished suites', runTimeout, async (t) => {
    let { status, output, results } = await runFixtures(t, ['many-suites', 'animation-frames'])

    assert.equal(status, 0, output)
    assert.deepEqual(
      results,
      [...Array.from({ length: 60 }, (_, index) => `ok finished group ${index + 1} > passes`), ...frameChecks],
      output,
    )
  })

  it('keeps the running file in view below a long failure, and reports that failure', runTimeout, async (t) => {
    let { status, output, results } = await runFixtures(t, ['long-failure', 'animation-frames'])

    assert.equal(status, 1, output)
    assert.deepEqual(results, ['not ok long failure > fails with a 300-line report', ...frameChecks], output)
    assert.match(output, /^invented report line 300$/m)
    assert.doesNotMatch(output, /Timed out waiting/)
  })
})
