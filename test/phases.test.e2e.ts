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

const serveCleanup = "t.serve's own, which closes its page and server"

/** The cleanups a test's records name, each with its records, in the order they ran. */
function cleanupsOf(records: string[]) {
  let cleanups = new Map<string, string[]>()
  for (let record of records) {
    let match = /^(cleanup \d+ \(.+\)): (start|done|failed: .*)$/.exec(record)
    if (match) cleanups.set(match[1], [...(cleanups.get(match[1]) ?? []), match[2]])
  }
  return cleanups
}

describe('phase records', () => {
  it(
    "keep a failed test's actions, its assertion's output, its cleanups and the traces of both its contexts",
    runTimeout,
    async (t) => {
      let test = 'fails an assertion after typing in a second context'
      let { engine, status, output, log, diagnostics } = await runFixture(t, 'fails')
      let records = recordsOf(log, test)

      assert.equal(status, 1, output)
      assert.match(log, /^# \S+ revision [0-9a-f]{40}, node v\d+\.\d+\.\d+, command: .*fails\.test\.e2e\.ts/, log)
      for (let label of ['page', 'second']) {
        assert.ok(
          records.some((record) => new RegExp(`^${label}: opened in ${engine} \\d`).test(record)),
          log,
        )
      }
      for (let action of ["locator('#code').click()", 'second.keyboard.type("12")', "locator('#code').inputValue()"]) {
        assert.ok(records.includes(`action: ${action} start`), `${action} start\n${log}`)
        assert.ok(records.includes(`action: ${action} done`), `${action} done\n${log}`)
      }
      let failure = records.find((record) => record.startsWith('failed in phase '))
      assert.ok(failure, log)
      assert.match(failure, /^failed in phase "action: locator\('#code'\)\.inputValue\(\) done": /)
      assert.ok(
        failure.endsWith('Objects not deeply equal\n    actual: {"code":"12"}\n    expected: {"code":"123"}'),
        log,
      )
      assert.match(output, /\[last phase: action: locator\('#code'\)\.inputValue\(\) done\]/)

      // Every cleanup is named, and each finished.
      let cleanups = cleanupsOf(records)
      assert.ok(
        [...cleanups.keys()].some((name) => name.endsWith(`(${serveCleanup})`)),
        log,
      )
      for (let [name, steps] of cleanups) assert.deepEqual(steps, ['start', 'done'], `${name}\n${log}`)
      assert.equal(records.at(-1), 'teardown done', log)

      // Each context's trace is kept before that context closes.
      for (let label of ['page', 'second']) {
        let file = `fixture--${test.replaceAll(' ', '-')}--${label}--${engine}.zip`
        let saved = records.indexOf(`trace (${label}): saved to traces/${file}`)
        assert.ok(saved > records.indexOf('teardown start'), `${label} trace saved\n${log}`)
        assert.ok(saved < records.indexOf(`${label}: closed`), `${label} trace saved before its page closed\n${log}`)
        let trace = readFileSync(join(diagnostics, 'traces', file))
        assert.equal(trace.subarray(0, 2).toString('latin1'), 'PK', 'a zip file')
      }
    },
  )

  it("name a stuck test's last browser operation while it still waits", runTimeout, async (t) => {
    let stuck = 'action: page.evaluate(fn) start'
    let { log } = await runFixture(t, 'stuck', (log) => log.includes(stuck))
    let records = recordsOf(log, 'waits on an evaluation that never settles')

    assert.equal(records.at(-1), stuck, log)
    assert.ok(records.includes("action: locator('#code').click() done"), log)
    assert.ok(!records.includes('test end'), log)
  })

  it('keep the pending operation apart from the watchdog that finds its page silent', runTimeout, async (t) => {
    let { status, output, log } = await runFixture(t, 'busy')
    let records = recordsOf(log, 'fails while its page is stuck in an evaluation')
    let pending = 'action: page.evaluate(fn) start'

    assert.equal(status, 1, output)
    assert.ok(records.includes("page: main thread hasn't answered for 2 s; pending: page.evaluate(fn)"), log)
    let failure = records.find((record) => record.startsWith('failed in phase '))
    assert.equal(
      failure,
      `failed in phase "${pending}"; pending: page.evaluate(fn): the evaluation still runs after 7 s`,
      log,
    )
    assert.ok(output.includes(`[last phase: ${pending}; pending: page.evaluate(fn)]`), output)
    assert.ok(!records.includes('page: main thread answers again'), `a closed page is not an answer\n${log}`)
    assert.equal(records.at(-1), 'teardown done', log)
  })

  it("name a test's cleanup that never finishes", runTimeout, async (t) => {
    let own = /^cleanup \d+ \(registered at test\/fixtures\/phases\/stuck-cleanup\.test\.e2e\.ts:\d+\): start$/m
    let { log } = await runFixture(t, 'stuck-cleanup', (log) => own.test(log.replace(/^\S+ fixture > [^:]+: /gm, '')))
    let records = recordsOf(log, 'registers a cleanup that never finishes')

    assert.match(records.at(-1)!, own, log)
    assert.ok(records.includes('test end'), log)
  })

  it("name the runner's own cleanup when it never finishes", runTimeout, async (t) => {
    let { log } = await runFixture(
      t,
      'stuck-serve',
      (log) => log.includes(`(${serveCleanup}): start`) && log.includes('page: closed'),
    )
    let records = recordsOf(log, "waits on the runner's cleanup for ever")

    let cleanups = cleanupsOf(records)
    let serve = [...cleanups.keys()].find((name) => name.endsWith(`(${serveCleanup})`))
    assert.ok(serve, log)
    assert.deepEqual(cleanups.get(serve), ['start'], log)
    assert.ok(records.indexOf(`${serve}: start`) < records.indexOf('page: closed'), log)
    assert.ok(!records.includes('teardown done'), log)
  })
})
