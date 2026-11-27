import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { stripVTControlCharacters } from 'node:util'

import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

const root = fileURLToPath(new URL('..', import.meta.url))
const remix = fileURLToPath(new URL('../node_modules/remix/dist/cli-entry.js', import.meta.url))
const fixtures = 'test/fixtures/e2e-deadlines'

// Short deadlines for the fixture runs, set through the patched runner's
// environment. The lanes run with its defaults: 60 seconds for each setup hook
// and test body, 30 for a test's cleanup and for closing the browser at the
// end of a file, and 5 to release what a stalled cleanup left open. Only the
// fixtures whose browser never closes shorten the close: a real browser on a
// busy CI machine can take longer than 5 seconds to close.
const deadlines = { run: 15_000, cleanup: 5_000, release: 5_000, browserClose: 5_000 }

// The longest a stalled file may keep the command open: its body and cleanup
// deadlines, the release, and a browser close that stalls, plus starting the
// runner and a browser on a busy CI machine.
const bound = deadlines.run + deadlines.cleanup + deadlines.release + deadlines.browserClose + 30_000

/** The engine this test runs in. Its Playwright project has the same name. */
async function currentEngine(t: TestContext) {
  let page = await t.serve(await createTestServer(() => new Response()))
  return page.context().browser()!.browserType().name()
}

/** Whether a process runs, on Linux. An exited process that waits for its parent to collect it doesn't. */
function isRunning(pid: number) {
  if (!existsSync(`/proc/${pid}/stat`)) return false
  try {
    let stat = readFileSync(`/proc/${pid}/stat`, 'utf8')
    return stat.slice(stat.lastIndexOf(')') + 2)[0] !== 'Z'
  } catch {
    return false
  }
}

async function accepts(url: string) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(2_000) })
    return true
  } catch {
    return false
  }
}

/**
 * What the fixture's stalled test left running once the command ended: the
 * processes it reported, its worker and the browser among them, and its
 * servers that still answer.
 */
async function findLeftovers(output: string) {
  let report = /^fixture processes: (.+)$/m.exec(output)
  assert.ok(report, `the fixture reported no processes\n${output}`)
  let { processes, servers } = JSON.parse(report[1]) as { processes: number[]; servers: string[] }
  if (existsSync('/proc')) assert.ok(processes.length > 1, `no browser among the fixture's processes\n${output}`)

  let running = processes.filter(isRunning)
  for (let attempt = 0; running.length > 0 && attempt < 20; attempt++) {
    await delay(100)
    running = running.filter(isRunning)
  }
  let answering = []
  for (let server of servers) if (await accepts(server)) answering.push(server)
  return [...running.map((pid) => `process ${pid}`), ...answering.map((server) => `server ${server}`)]
}

/**
 * Runs one fixture file through the installed `remix test` end-to-end runner,
 * in the current engine with the lanes' Playwright config, the fixtures' cleanup
 * deadline or the one given, and the default browser-close deadline unless one
 * is given. Returns its exit status, its output, how long it ran, and the
 * processes it left behind.
 */
async function runFixture(
  t: TestContext,
  name: string,
  { cleanup = deadlines.cleanup, browserClose }: { cleanup?: number; browserClose?: number } = {},
) {
  let engine = await currentEngine(t)
  let args = [remix, '--config', `${fixtures}/remix.json`, 'test', '--project', engine, '--reporter', 'tap']
  let started = performance.now()
  // In its own process group, so a run this test abandons stops with it.
  let child = spawn(process.execPath, [...args, `${fixtures}/${name}.test.e2e.ts`], {
    cwd: root,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      REMIXCN_E2E_RUN_DEADLINE_MS: String(deadlines.run),
      REMIXCN_E2E_CLEANUP_DEADLINE_MS: String(cleanup),
      ...(browserClose ? { REMIXCN_E2E_BROWSER_CLOSE_DEADLINE_MS: String(browserClose) } : {}),
    },
  })
  t.after(() => {
    if (child.exitCode === null && child.signalCode === null) process.kill(-child.pid!, 'SIGKILL')
  })

  let output = ''
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => (output += chunk))
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => (output += chunk))
  let status = await new Promise<number | null>((resolve) => child.on('close', resolve))
  let elapsed = performance.now() - started

  output = stripVTControlCharacters(output)
  let leftovers = await findLeftovers(output)
  let results = [...output.matchAll(/^(ok|not ok) \d+ - (.+?) # e2e:\w+( # SKIP)?/gm)].map(
    ([, result, test, skip]) => `${result} ${test}${skip ?? ''}`,
  )
  // A file's own failure, such as a browser that never closed, has no test name.
  let fileFailures = [...output.matchAll(/^not ok \d+ - {2}# e2e:\w+\n {2}---\n {2}message: (.+)$/gm)].map(
    ([, message]) => message,
  )
  return { status, output, elapsed, leftovers, results, fileFailures }
}

function stalled(phase: string, file: string, test: string, ms: number) {
  return `Stalled in ${phase}: ${fixtures}/${file}.test.e2e.ts > ${test} gave no result within its ${ms}ms deadline`
}

function stalledFile(phase: string, file: string, ms: number) {
  return `Stalled in ${phase}: ${fixtures}/${file}.test.e2e.ts gave no result within its ${ms}ms deadline`
}

// Longer than a fixture run's bound, so a run that overstays it fails here.
const runTimeout = { timeout: 120_000 }

describe('the end-to-end runner deadlines', () => {
  it('fails a test that stalls in its body, names it and its phase, and runs the next', runTimeout, async (t) => {
    let { status, output, elapsed, leftovers, results } = await runFixture(t, 'body-stall')

    assert.equal(status, 1, output)
    assert.deepEqual(
      results,
      ['not ok body stall > waits on a page script that never settles', 'ok body stall > runs after the stalled test'],
      output,
    )
    assert.ok(
      output.includes(
        stalled('test body', 'body-stall', 'body stall > waits on a page script that never settles', deadlines.run),
      ),
      output,
    )
    assert.ok(elapsed < bound, `ran ${Math.round(elapsed)}ms\n${output}`)
    assert.deepEqual(leftovers, [])
  })

  it('fails a test whose cleanup stalls, names it and the cleanup, and runs the next', runTimeout, async (t) => {
    let { status, output, elapsed, leftovers, results } = await runFixture(t, 'cleanup-stall')

    assert.equal(status, 1, output)
    assert.deepEqual(
      results,
      [
        'not ok cleanup stall > registers a cleanup that never settles',
        'ok cleanup stall > runs after the stalled cleanup',
      ],
      output,
    )
    assert.ok(
      output.includes(
        stalled(
          't.after() callback 1',
          'cleanup-stall',
          'cleanup stall > registers a cleanup that never settles',
          deadlines.cleanup,
        ),
      ),
      output,
    )
    assert.ok(elapsed < bound, `ran ${Math.round(elapsed)}ms\n${output}`)
    assert.deepEqual(leftovers, [])
  })

  it(
    'starts no cleanup or hook of an expired teardown when its stalled cleanup resumes during the next test',
    runTimeout,
    async (t) => {
      let { status, output, elapsed, leftovers, results } = await runFixture(t, 'late-cleanup')
      let test = 'late cleanup > registers a cleanup that resumes during the next test'

      assert.equal(status, 1, output)
      assert.deepEqual(results, [`not ok ${test}`, 'ok late cleanup > runs while the stalled cleanup resumes'], output)
      assert.ok(output.includes(stalled('t.after() callback 1', 'late-cleanup', test, deadlines.cleanup)), output)
      assert.ok(!output.includes('Retired the test worker'), output)
      assert.ok(elapsed < bound, `ran ${Math.round(elapsed)}ms\n${output}`)
      assert.deepEqual(leftovers, [])
    },
  )

  it('starts no later afterAll hook once a stalled one resumes after its deadline', runTimeout, async (t) => {
    let { status, output, elapsed, leftovers, results, fileFailures } = await runFixture(t, 'late-after-all', {
      browserClose: deadlines.browserClose,
    })

    assert.equal(status, 1, output)
    assert.deepEqual(
      results,
      ['ok late afterAll > passes, and holds the browser open', 'not ok late afterAll > afterAll'],
      output,
    )
    assert.ok(
      output.includes(
        `afterAll failed: Stalled in afterAll hook 1: ${fixtures}/late-after-all.test.e2e.ts > late afterAll gave no result within its ${deadlines.cleanup}ms deadline`,
      ),
      output,
    )
    assert.deepEqual(fileFailures, [stalledFile('browser.close()', 'late-after-all', deadlines.browserClose)], output)
    assert.ok(!output.includes('late afterAll hook started'), output)
    assert.match(output, /^Retired the test worker for test\/fixtures\/e2e-deadlines\/late-after-all\.test\.e2e\.ts/m)
    assert.ok(elapsed < bound, `ran ${Math.round(elapsed)}ms\n${output}`)
    assert.deepEqual(leftovers, [])
  })

  it('stops a teardown whose step overruns its deadline before the deadline’s timer fires', runTimeout, async (t) => {
    let cleanup = 1_000
    let { status, output, elapsed, leftovers, results } = await runFixture(t, 'overdue-teardown', { cleanup })
    let test = 'overdue cleanup > registers a cleanup that overruns its deadline'
    let chains = [1, 2, 3, 4, 5, 6, 7, 8].map(
      (length) => `overdue afterEach > overruns ${length} microtasks after its first afterEach hook returns`,
    )
    let throwing = 'overdue afterEach that throws > overruns in an afterEach hook that throws'

    assert.equal(status, 1, output)
    assert.deepEqual(
      results,
      [
        `not ok ${test}`,
        'ok overdue cleanup > runs after the overdue cleanup',
        ...chains.map((chain) => `not ok ${chain}`),
        `not ok ${throwing}`,
        'ok overdue afterEach that throws > runs after the throwing afterEach hook',
        'ok overdue afterAll > passes',
        'not ok overdue afterAll > afterAll',
      ],
      output,
    )
    assert.ok(output.includes(stalled('t.after() callback 1', 'overdue-teardown', test, cleanup)), output)
    for (let chain of chains) {
      assert.match(
        output,
        new RegExp(
          `Stalled in afterEach hook [12]: ${fixtures}/overdue-teardown\\.test\\.e2e\\.ts > ${chain} gave no result within its ${cleanup}ms deadline`,
        ),
      )
    }
    assert.ok(output.includes(stalled('afterEach hook', 'overdue-teardown', throwing, cleanup)), output)
    assert.ok(!output.includes('late afterEach failure'), output)
    assert.ok(
      output.includes(
        `afterAll failed: Stalled in afterAll hook 1: ${fixtures}/overdue-teardown.test.e2e.ts > overdue afterAll gave no result within its ${cleanup}ms deadline`,
      ),
      output,
    )
    assert.doesNotMatch(output, /^late .+ started$/m)
    assert.ok(elapsed < bound, `ran ${Math.round(elapsed)}ms\n${output}`)
    assert.deepEqual(leftovers, [])
  })

  it(
    'fails an afterAll hook that overruns its deadline and throws as stalled, and retires its worker',
    runTimeout,
    async (t) => {
      let cleanup = 1_000
      let { status, output, elapsed, leftovers, results } = await runFixture(t, 'overdue-after-all-throws', {
        cleanup,
      })

      assert.equal(status, 1, output)
      assert.deepEqual(
        results,
        [
          'ok overdue afterAll that throws > passes',
          'not ok overdue afterAll that throws > afterAll',
          'ok after the overdue afterAll > never runs once its worker retires # SKIP',
        ],
        output,
      )
      assert.ok(
        output.includes(
          `afterAll failed: Stalled in afterAll hook: ${fixtures}/overdue-after-all-throws.test.e2e.ts > overdue afterAll that throws gave no result within its ${cleanup}ms deadline`,
        ),
        output,
      )
      assert.ok(!output.includes('late afterAll failure'), output)
      assert.match(
        output,
        /^Retired the test worker for test\/fixtures\/e2e-deadlines\/overdue-after-all-throws\.test\.e2e\.ts/m,
      )
      assert.ok(elapsed < bound, `ran ${Math.round(elapsed)}ms\n${output}`)
      assert.deepEqual(leftovers, [])
    },
  )

  it(
    'fails a file whose tests pass but whose browser never closes, and keeps the test results',
    runTimeout,
    async (t) => {
      let { status, output, elapsed, leftovers, results, fileFailures } = await runFixture(t, 'browser-close-stall', {
        browserClose: deadlines.browserClose,
      })

      assert.equal(status, 1, output)
      assert.deepEqual(
        results,
        [
          'ok browser close stall > passes, and keeps its browser from closing',
          'ok browser close stall > passes after it',
        ],
        output,
      )
      assert.deepEqual(
        fileFailures,
        [stalledFile('browser.close()', 'browser-close-stall', deadlines.browserClose)],
        output,
      )
      assert.match(output, /^# pass 2\n# fail 1$/m)
      assert.match(
        output,
        /^Retired the test worker for test\/fixtures\/e2e-deadlines\/browser-close-stall\.test\.e2e\.ts/m,
      )
      assert.ok(elapsed < bound, `ran ${Math.round(elapsed)}ms\n${output}`)
      assert.deepEqual(leftovers, [])
    },
  )

  it(
    'frees a server whose close waits on the test’s own context, and runs the next test in the same worker',
    runTimeout,
    async (t) => {
      let { status, output, elapsed, leftovers, results } = await runFixture(t, 'held-connection')
      let test = 'held connection > closes its server while its own context still holds a request'

      assert.equal(status, 1, output)
      assert.deepEqual(
        results,
        [`not ok ${test}`, 'ok held connection > runs after the held connection closed'],
        output,
      )
      assert.match(
        output,
        new RegExp(
          `Stalled in t\\.serve\\(\\) server close \\(http://[^)]+\\): ${fixtures}/held-connection\\.test\\.e2e\\.ts > ${test} gave no result within its ${deadlines.cleanup}ms deadline`,
        ),
      )
      assert.ok(!output.includes('Stalled in the release'), output)
      assert.ok(!output.includes('Retired the test worker'), output)
      assert.ok(elapsed < bound, `ran ${Math.round(elapsed)}ms\n${output}`)
      assert.deepEqual(leftovers, [])
    },
  )

  it(
    'fails a passing test whose leftovers never close, with the release phase, and retires its worker',
    runTimeout,
    async (t) => {
      let { status, output, elapsed, leftovers, results } = await runFixture(t, 'release-stall')
      let test = 'release stall > leaves a context open that never closes'

      assert.equal(status, 1, output)
      assert.deepEqual(
        results,
        [`not ok ${test}`, 'ok release stall > never runs once its worker retires # SKIP'],
        output,
      )
      assert.ok(
        output.includes(
          stalled('the release of its open contexts and t.serve() servers', 'release-stall', test, deadlines.release),
        ),
        output,
      )
      assert.match(output, /^Retired the test worker for test\/fixtures\/e2e-deadlines\/release-stall\.test\.e2e\.ts/m)
      assert.ok(elapsed < bound, `ran ${Math.round(elapsed)}ms\n${output}`)
      assert.deepEqual(leftovers, [])
    },
  )

  it(
    'closes the server a test gave t.serve() when its page never opened, before the next test',
    runTimeout,
    async (t) => {
      let { status, output, elapsed, leftovers, results } = await runFixture(t, 'serve-stall')

      assert.equal(status, 1, output)
      assert.deepEqual(
        results,
        [
          'ok serve stall > opens a page, so the next test can reach the browser',
          'not ok serve stall > stalls while t.serve() opens its page',
          'ok serve stall > finds the stalled test’s server closed',
        ],
        output,
      )
      assert.ok(
        output.includes(
          stalled('test body', 'serve-stall', 'serve stall > stalls while t.serve() opens its page', deadlines.run),
        ),
        output,
      )
      assert.ok(elapsed < bound, `ran ${Math.round(elapsed)}ms\n${output}`)
      assert.deepEqual(leftovers, [])
    },
  )

  it(
    'keeps the body failure first when cleanup stalls too, and retires a worker it cannot free',
    runTimeout,
    async (t) => {
      let { status, output, elapsed, leftovers, results } = await runFixture(t, 'retired-worker')
      let test = 'stall that retires its worker > stalls in its body, then in closing its server'

      assert.equal(status, 1, output)
      assert.deepEqual(
        results,
        [`not ok ${test}`, 'ok stall that retires its worker > never runs once its worker retires # SKIP'],
        output,
      )
      let body = output.indexOf(stalled('test body', 'retired-worker', test, deadlines.run))
      let cleanup = output.search(
        new RegExp(
          `Stalled in t\\.serve\\(\\) server close \\(http://[^)]+\\): ${fixtures}/retired-worker\\.test\\.e2e\\.ts > ${test} gave no result within its ${deadlines.cleanup}ms deadline`,
        ),
      )
      let release = output.indexOf(
        stalled('the release of its open contexts and t.serve() servers', 'retired-worker', test, deadlines.release),
      )
      assert.ok(body >= 0 && cleanup > body && release > cleanup, output)
      assert.match(output, /^Retired the test worker for test\/fixtures\/e2e-deadlines\/retired-worker\.test\.e2e\.ts/m)
      assert.ok(elapsed < bound, `ran ${Math.round(elapsed)}ms\n${output}`)
      assert.deepEqual(leftovers, [])
    },
  )
})
