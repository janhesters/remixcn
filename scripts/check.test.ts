import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { isRunning } from './processes.ts'

const check = fileURLToPath(new URL('check.ts', import.meta.url))
const fixtures = fileURLToPath(new URL('../test/fixtures/lanes/', import.meta.url))

function runCheck(fixture: string, args: string[], env: Record<string, string> = {}) {
  let result = spawnSync(process.execPath, [check, ...args], {
    cwd: join(fixtures, fixture),
    encoding: 'utf8',
    env: { ...process.env, GITHUB_ACTIONS: '', GITHUB_OUTPUT: '', GITHUB_STEP_SUMMARY: '', ...env },
    // A runner that hangs fails its test instead of stalling the suite.
    timeout: 30_000,
  })
  return { status: result.status, stdout: result.stdout, output: result.stdout + result.stderr }
}

function scratchDirectory(t: { after: (fn: () => void) => void }) {
  let directory = mkdtempSync(join(tmpdir(), 'remixcn-check-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  return directory
}

/** Reads the pid a leak fixture prints, and stops that process after the test if the runner didn't. */
function leakedPid(t: TestContext, stdout: string) {
  let pid = Number(/^leaked (\d+)$/m.exec(stdout)?.[1])
  t.after(() => {
    if (pid > 0 && isRunning(pid)) process.kill(pid, 'SIGKILL')
  })
  return pid
}

describe('check', () => {
  it('fails the typecheck lane on a type error', { timeout: 60_000 }, () => {
    let { status, stdout, output } = runCheck('broken', ['typecheck'])

    assert.equal(status, 1)
    assert.match(output, /error TS2322/)
    assert.match(stdout, /^ {2}✗ typecheck: exited with code 1$/m)
  })

  it('fails the test lane on a failing test', { timeout: 60_000 }, () => {
    let { status, stdout, output } = runCheck('broken', ['test'])

    assert.equal(status, 1)
    assert.match(output, /200 !== 210/)
    assert.match(stdout, /^ {2}✗ test: exited with code 1$/m)
  })

  it('fails a test lane that passes no tests', { timeout: 60_000 }, () => {
    let { status, stdout } = runCheck('empty', ['test'])

    assert.equal(status, 1)
    assert.match(stdout, /^ {2}✗ test: ran no passing tests, so it proves nothing$/m)
  })

  it(
    'stops the processes a lane leaves running and fails it',
    { skip: process.platform !== 'linux', timeout: 60_000 },
    (t) => {
      let { status, stdout } = runCheck('broken', ['lint'])
      let pid = leakedPid(t, stdout)

      assert.equal(status, 1)
      assert.match(stdout, /^ {2}✗ lint: left 1 process running, now stopped:/m)
      assert.ok(pid > 0, stdout)
      assert.ok(!isRunning(pid), `process ${pid} still runs`)
    },
  )

  it(
    "stops a leftover process that holds the lane's output open",
    { skip: process.platform !== 'linux', timeout: 60_000 },
    (t) => {
      let { status, stdout } = runCheck('broken', ['format'])
      let pid = leakedPid(t, stdout)

      assert.equal(status, 1)
      assert.match(stdout, /^ {2}✗ format: left 1 process running, now stopped:/m)
      assert.ok(pid > 0, stdout)
      assert.ok(!isRunning(pid), `process ${pid} still runs`)
    },
  )

  it("stops waiting for output that a process it can't find keeps open", { timeout: 60_000 }, (t) => {
    let { status, stdout } = runCheck('broken', ['secrets'])
    leakedPid(t, stdout)

    assert.equal(status, 1)
    assert.match(stdout, /^ {2}✗ secrets: exited, but a process it started still holds its output open$/m)
  })

  it('tells an unbuilt lane apart from a passing one', { timeout: 60_000 }, () => {
    let { status, stdout } = runCheck('empty', ['format', 'e2e'])

    assert.equal(status, 0)
    assert.match(stdout, /^ {2}✓ format$/m)
    assert.match(stdout, /^ {2}○ e2e: not built yet, no "test:e2e" script yet$/m)
    assert.match(stdout, /^1 passed, 0 failed, 1 not built yet$/m)
  })

  it("writes each lane's output to the diagnostics folder", { timeout: 60_000 }, (t) => {
    let diagnostics = scratchDirectory(t)

    let { status } = runCheck('empty', ['format', '--diagnostics', diagnostics])

    assert.equal(status, 0)
    assert.match(readFileSync(join(diagnostics, 'format.log'), 'utf8'), /^formatted$/m)
  })

  it(
    'stops a lane that runs past its deadline, with every process it started, and keeps its log',
    { skip: process.platform !== 'linux', timeout: 60_000 },
    (t) => {
      let diagnostics = scratchDirectory(t)
      let started = performance.now()

      let { status, stdout } = runCheck('stuck', ['e2e', '--diagnostics', diagnostics], {
        REMIXCN_LANE_DEADLINE_MS: '1000',
      })
      let pids = (/^stuck (\d+) (\d+)$/m.exec(stdout) ?? []).slice(1).map(Number)
      t.after(() => {
        for (let pid of pids) if (pid > 0 && isRunning(pid)) process.kill(pid, 'SIGKILL')
      })

      assert.equal(status, 1)
      assert.match(
        stdout,
        /^ {2}✗ e2e: ran past its deadline of 1 s; check stopped 3 processes: \d+ bun run test:e2e; /m,
      )
      assert.equal(pids.length, 2, stdout)
      for (let pid of pids) assert.ok(!isRunning(pid), `process ${pid} still runs`)
      assert.ok(performance.now() - started < 20_000, 'stopped soon after the deadline')
      let log = readFileSync(join(diagnostics, 'e2e.log'), 'utf8')
      assert.match(log, /^stuck \d+ \d+$/m)
      assert.match(log, /^e2e ran past its deadline of 1 s, so check stops it\.$/m)
    },
  )

  it('rejects a lane it does not know', () => {
    let { status, output } = runCheck('empty', ['docs'])

    assert.equal(status, 1)
    assert.match(output, /unknown lane "docs"; the lanes are format, lint, typecheck, test, browser, e2e/)
  })
})

describe('check --plan', () => {
  it('lists the built lanes as the CI matrix and says why the others are not built', { timeout: 60_000 }, (t) => {
    let directory = scratchDirectory(t)
    let outputFile = join(directory, 'output')
    let summaryFile = join(directory, 'summary.md')
    writeFileSync(outputFile, '')
    writeFileSync(summaryFile, '')

    let { status, stdout } = runCheck('broken', ['--plan'], {
      GITHUB_ACTIONS: 'true',
      GITHUB_OUTPUT: outputFile,
      GITHUB_STEP_SUMMARY: summaryFile,
    })

    assert.equal(status, 0)
    let matrix = JSON.parse(/^matrix=(.*)$/m.exec(readFileSync(outputFile, 'utf8'))?.[1] ?? 'null')
    assert.deepEqual(
      matrix.map((entry: { name: string }) => entry.name),
      ['format', 'lint', 'typecheck', 'test (Node 24.3.0)', 'test (Node 26.13.0)', 'secrets'],
    )
    assert.match(
      readFileSync(summaryFile, 'utf8'),
      /^\| e2e \| end-to-end tests against local servers \| not built yet, no "test:e2e" script yet \|$/m,
    )
    assert.match(stdout, /^::notice title=Lane e2e is not built yet::no "test:e2e" script yet$/m)
  })
})
