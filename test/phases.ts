// Named phase records for end-to-end tests, so a test that fails or never
// finishes says where it was. Each record is appended at once, so it survives
// a lane that check stops at its deadline. When check runs a lane with
// --diagnostics, the records go to phases-<file>.log in that folder, which CI
// checks for credentials and uploads after a failed lane. A failed test's
// error also names the last phase it reached.
import { appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

import type { Page } from 'playwright'
import { it as runnerIt } from 'remix/test'
import type { TestContext } from 'remix/test'

type TestFn = (t: TestContext) => void | Promise<void>
type Options = Exclude<Parameters<typeof runnerIt>[1], TestFn>

interface Recorder {
  /** Records a phase of the test that runs now, such as "entry: request held". */
  record(phase: string): void
  last: string
}

const recorders = new WeakMap<TestContext, Recorder>()

/** Records a phase of the running test. Outside a probed test it does nothing. */
export function phase(t: TestContext, name: string) {
  recorders.get(t)?.record(name)
}

/** How long a page may take to answer before the watchdog records that it stopped answering. */
const answerMs = 2_000

/**
 * Records a page's lifecycle for the running test: navigations, load, crashes,
 * page errors, console errors, failed requests and closing, and, every two
 * seconds, whether its main thread still answers. Only for a page that runs
 * scripts: a page without JavaScript never answers an evaluation.
 */
export function watchPage(t: TestContext, page: Page, label = 'page') {
  let record = (name: string) => phase(t, `${label}: ${name}`)
  let engine = page.context().browser()?.browserType().name() ?? 'unknown engine'
  record(`opened in ${engine}`)
  page.on(
    'framenavigated',
    (frame) => frame === page.mainFrame() && record(`navigated to ${new URL(frame.url()).pathname}`),
  )
  page.on('load', () => record('load'))
  page.on('crash', () => record('crashed'))
  page.on('close', () => record('closed'))
  page.on('pageerror', (error) => record(`page error: ${error.message}`))
  page.on('console', (message) => message.type() === 'error' && record(`console error: ${message.text()}`))
  page.on('requestfailed', (request) => {
    record(`request failed: ${new URL(request.url()).pathname} (${request.failure()?.errorText ?? 'no reason'})`)
  })

  let stopped = false
  let silent = false
  let watch = async () => {
    while (!stopped && !page.isClosed()) {
      let answered = await Promise.race([
        page.evaluate(() => true).catch(() => true),
        delay(answerMs, false, { ref: false }),
      ])
      if (stopped) return
      if (!answered && !silent) record(`main thread hasn't answered for ${answerMs / 1000} s`)
      if (answered && silent) record('main thread answers again')
      silent = !answered
      await delay(answerMs, undefined, { ref: false })
    }
  }
  void watch()
  t.after(() => {
    stopped = true
  })
}

/**
 * Wraps remix test's `it` for one test file, so each test records its start,
 * its end or its error, and its teardown, and a failure names its last phase.
 */
export function probe(file: string): typeof runnerIt {
  let directory = process.env.REMIXCN_DIAGNOSTICS
  let path = directory ? join(directory, `phases-${file}.log`) : undefined

  let wrap =
    (name: string, fn: TestFn): TestFn =>
    async (t) => {
      let recorder: Recorder = {
        last: 'test start',
        record(name_) {
          recorder.last = name_
          if (path) appendFileSync(path, `${new Date().toISOString()} ${file} > ${name}: ${name_}\n`)
        },
      }
      recorders.set(t, recorder)
      recorder.record('test start')
      try {
        await fn(t)
        recorder.record('test end')
      } catch (error) {
        let message = error instanceof Error ? error.message : String(error)
        let last = recorder.last
        recorder.record(`failed in phase "${last}": ${message.split('\n')[0]}`)
        if (error instanceof Error) error.message = `${message}\n[last phase: ${last}]`
        throw error
      } finally {
        // Registered last, so it runs after the test's own cleanups.
        t.after(() => recorder.record('teardown done'))
        recorder.record('teardown start')
      }
    }

  let probed = (name: string, ...rest: [TestFn] | [Options, TestFn]) =>
    rest.length === 1 ? runnerIt(name, wrap(name, rest[0])) : runnerIt(name, rest[0], wrap(name, rest[1]))
  return Object.assign(probed as typeof runnerIt, {
    skip: runnerIt.skip,
    only: (name: string, fn: TestFn) => runnerIt.only(name, wrap(name, fn)),
    todo: runnerIt.todo,
  })
}
