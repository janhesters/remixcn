import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { stripVTControlCharacters } from 'node:util'

import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

const root = fileURLToPath(new URL('..', import.meta.url))
const remix = fileURLToPath(new URL('../node_modules/remix/dist/cli-entry.js', import.meta.url))
const fixtures = 'test/fixtures/phases'

/** The engine this test runs in. Its Playwright project has the same name. */
async function currentEngine(t: TestContext) {
  let page = await t.serve(await createTestServer(() => new Response()))
  return page.context().browser()!.browserType().name()
}

/**
 * Runs a probed fixture file through the installed `remix test` runner, in the
 * current engine, with its own diagnostics folder, as check gives a lane one.
 * `until` ends the run early, once the phase log says so, as check ends a lane
 * at its deadline.
 */
async function runFixture(t: TestContext, name: string, until?: (log: string) => boolean) {
  let engine = await currentEngine(t)
  let diagnostics = mkdtempSync(join(tmpdir(), 'remixcn-phases-'))
  let log = join(diagnostics, 'phases-fixture.log')
  let readLog = () => (existsSync(log) ? readFileSync(log, 'utf8') : '')
  let args = [
    remix,
    '--config',
    `${fixtures}/remix.json`,
    'test',
    '--project',
    engine,
    `${fixtures}/${name}.test.e2e.ts`,
  ]
  // In its own process group, so stopping it stops its workers and browser too.
  let child = spawn(process.execPath, args, {
    cwd: root,
    detached: true,
    env: { ...process.env, REMIXCN_DIAGNOSTICS: diagnostics },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let running = () => child.exitCode === null && child.signalCode === null
  t.after(() => {
    if (running()) process.kill(-child.pid!, 'SIGKILL')
    rmSync(diagnostics, { recursive: true, force: true })
  })

  let output = ''
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => (output += chunk))
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => (output += chunk))
  let closed = new Promise<number | null>((resolve) => child.on('close', resolve))
  if (until) {
    // Checks the log until it holds what the test waits for, or the run ends.
    while (running() && !until(readLog())) await delay(100)
    if (running()) process.kill(-child.pid!, 'SIGKILL')
  }
  let status = await closed
  return { engine, status, output: stripVTControlCharacters(output), log: readLog(), diagnostics }
}

/** The records of one test, without their time stamps. */
function recordsOf(log: string, test: string) {
  let prefix = `fixture > ${test}: `
  return log
    .trimEnd()
    .split(/\n(?=\S)/)
    .map((line) => line.replace(/^\S+ /, ''))
    .filter((line) => line.startsWith(prefix))
    .map((line) => line.slice(prefix.length))
}

const runTimeout = { timeout: 60_000 }

describe('phase records', () => {
  it("keep a failed test's actions, its assertion's output and its trace", runTimeout, async (t) => {
    let { engine, status, output, log, diagnostics } = await runFixture(t, 'fails')
    let records = recordsOf(log, 'fails an assertion after typing')

    assert.equal(status, 1, output)
    assert.match(log, /^# \S+ revision [0-9a-f]{40}, node v\d+\.\d+\.\d+, command: .*fails\.test\.e2e\.ts/, log)
    assert.match(records[1], new RegExp(`^page: opened in ${engine} \\d`), log)
    for (let action of ["locator('#code').click()", 'page.keyboard.type("12")', "locator('#code').inputValue()"]) {
      assert.ok(records.includes(`action: ${action} start`), `${action} start\n${log}`)
      assert.ok(records.includes(`action: ${action} done`), `${action} done\n${log}`)
    }
    let failure = records.find((record) => record.startsWith('failed in phase '))
    assert.ok(failure, log)
    assert.match(failure, /^failed in phase "action: locator\('#code'\)\.inputValue\(\) done": /)
    assert.match(failure, /"12" !== "123"$/)
    // The trace is kept before the runner closes the page.
    let teardown = records.slice(records.indexOf('teardown start'))
    assert.deepEqual(teardown, [
      'teardown start',
      `trace saved to traces/fixture--fails-an-assertion-after-typing--${engine}.zip`,
      'page: closed',
      'teardown done',
    ])
    assert.match(output, /\[last phase: action: locator\('#code'\)\.inputValue\(\) done\]/)

    let trace = readFileSync(join(diagnostics, 'traces', `fixture--fails-an-assertion-after-typing--${engine}.zip`))
    assert.equal(trace.subarray(0, 2).toString('latin1'), 'PK', 'a zip file')
  })

  it("name a stuck test's last browser operation while it still waits", runTimeout, async (t) => {
    let stuck = 'action: page.evaluate(fn) start'
    let { log } = await runFixture(t, 'stuck', (log) => log.includes(stuck))
    let records = recordsOf(log, 'waits on an evaluation that never settles')

    assert.equal(records.at(-1), stuck, log)
    assert.ok(records.includes("action: locator('#code').click() done"), log)
    assert.ok(!records.includes('test end'), log)
  })
})
