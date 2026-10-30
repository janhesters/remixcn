// Named phase records for end-to-end tests, so a test that fails or never
// finishes says where it was, down to the browser operation or the cleanup it
// waited on. Each record is appended at once from the test's own process, so it
// survives a page that stopped answering and a lane that check stops at its
// deadline. When check runs a lane with --diagnostics, the records go to
// phases-<file>.log in that folder, and a failed test's browser traces to
// traces/, which CI checks for credentials and uploads after a failed lane. A
// failed test's error also names the last phase it reached and the operations
// still pending.
import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

import type { BrowserContext, Page } from 'playwright'
import { it as runnerIt } from 'remix/test'
import type { TestContext } from 'remix/test'

type TestFn = (t: TestContext) => void | Promise<void>
type Options = Exclude<Parameters<typeof runnerIt>[1], TestFn>

interface Recorder {
  file: string
  test: string
  /** The last phase recorded. Status records, such as the watchdog's, leave it as it is. */
  last: string
  /** The browser operations that started and haven't settled yet, by number. */
  pending: Map<number, string>
  failed: boolean
  /** Records a phase of the test. */
  record(phase: string): void
  /** Records a status, such as a page event or the watchdog's, without changing the last phase. */
  note(status: string): void
}

const recorders = new WeakMap<TestContext, Recorder>()
const directory = () => process.env.REMIXCN_DIAGNOSTICS

/** Records a phase of the running test. Outside a probed test it does nothing. */
export function phase(t: TestContext, name: string) {
  recorders.get(t)?.record(name)
}

function note(t: TestContext, status: string) {
  recorders.get(t)?.note(status)
}

/** The operations still pending, as a record's suffix, or nothing when none is. */
function pendingOf(recorder: Recorder | undefined) {
  let pending = [...(recorder?.pending.values() ?? [])]
  return pending.length > 0 ? `; pending: ${pending.join(', ')}` : ''
}

/** Longest value an assertion's record shows. */
const valueLimit = 4_000

function show(value: unknown) {
  let text: string
  try {
    text = JSON.stringify(value) ?? String(value)
  } catch {
    text = String(value)
  }
  return text.length > valueLimit ? `${text.slice(0, valueLimit)}…` : text
}

/** An assertion's actual and expected values, which a message such as "Objects not deeply equal" leaves out. */
function assertionValues(error: unknown) {
  if (!(error instanceof Error) || !('actual' in error) || !('expected' in error)) return ''
  return `\nactual: ${show(error.actual)}\nexpected: ${show(error.expected)}`
}

function firstLine(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0]
}

function revision() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return process.env.GITHUB_SHA ?? 'unknown'
  }
}

/**
 * The command that ran the tests. remix test runs each end-to-end file in a
 * worker process it starts, so that is the runner's command, where the system
 * lists it.
 */
function command() {
  let own = process.argv
  if (own[1]?.endsWith('worker-process.js')) {
    try {
      own = readFileSync(`/proc/${process.ppid}/cmdline`, 'utf8').split('\0').filter(Boolean)
    } catch {
      // Without /proc, the worker's own command says which runner ran it.
    }
  }
  return own.join(' ').replaceAll(`${process.cwd()}/`, '')
}

// Playwright objects whose operations are recorded, and whose results are followed.
const followed = new Set(['Page', 'Frame', 'Locator', 'FrameLocator', 'Keyboard', 'Mouse', 'Touchscreen'])

function describeArgument(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value.length > 40 ? `${value.slice(0, 40)}…` : value)
  if (typeof value === 'function') return 'fn'
  if (value === null || typeof value !== 'object') return String(value)
  return Array.isArray(value) ? '[…]' : '{…}'
}

/** A Playwright class's name, without the underscores and digits its bundle adds, such as `_Locator` or `Keyboard2`. */
function className(value: object) {
  return (value.constructor?.name ?? '').replace(/^_+|\d+$/g, '')
}

function follow(t: TestContext, value: unknown, label: string): unknown {
  if (typeof value !== 'object' || value === null || !followed.has(className(value))) return value
  let own = String(value)
  return recordActions(t, value, className(value) === 'Locator' && !own.startsWith('[object') ? own : label)
}

/** Numbers each recorded operation, so two of the same call stay apart while pending. */
let actions = 0

/**
 * Wraps a Playwright page, frame, locator, keyboard, mouse or touchscreen, so
 * each operation that waits on the browser records its start, and its end or
 * its error, as a phase of the running test. A test stuck on an operation
 * leaves its start as its last record.
 */
export function recordActions<T extends object>(t: TestContext, target: T, label: string): T {
  return new Proxy(target, {
    get(object, key) {
      let value: unknown = Reflect.get(object, key, object)
      if (typeof key === 'symbol') return value
      if (typeof value !== 'function') return follow(t, value, `${label}.${key}`)
      let method = value as (...args: unknown[]) => unknown
      return (...args: unknown[]) => {
        let call = `${label}.${key}(${args.map(describeArgument).join(', ')})`
        let result = method.apply(object, args)
        if (!(result instanceof Promise)) return follow(t, result, call)
        let recorder = recorders.get(t)
        let number = (actions += 1)
        recorder?.pending.set(number, call)
        phase(t, `action: ${call} start`)
        result.then(
          () => {
            recorder?.pending.delete(number)
            phase(t, `action: ${call} done`)
          },
          (error: unknown) => {
            recorder?.pending.delete(number)
            phase(t, `action: ${call} failed: ${firstLine(error)}`)
          },
        )
        return result.then((resolved) => follow(t, resolved, call))
      }
    },
  })
}

/** How long a page may take to answer before the watchdog records that it stopped answering. */
const answerMs = 2_000

/**
 * Records a page's lifecycle for the running test: its browser and version,
 * navigations, load, crashes, page errors, console errors, failed requests and
 * closing. With `watchdog`, it also records every two seconds whether the
 * page's main thread still answers; leave it off for a page without
 * JavaScript, which never answers an evaluation. Returns the page with its
 * operations recorded, as `recordActions` does: use that page in the test.
 */
export function watchPage(t: TestContext, page: Page, { label = 'page', watchdog = true } = {}): Page {
  let record = (name: string) => note(t, `${label}: ${name}`)
  let browser = page.context().browser()
  record(`opened in ${browser?.browserType().name() ?? 'an unknown engine'} ${browser?.version() ?? ''}`.trim())
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

  if (watchdog) {
    let stopped = false
    let silent = false
    let watch = async () => {
      while (!stopped && !page.isClosed()) {
        let answer = await Promise.race([
          page
            .evaluate(() => true)
            .then(
              () => 'answered',
              () => 'failed',
            ),
          delay(answerMs, 'silent', { ref: false }),
        ])
        if (stopped || page.isClosed()) return
        // A check that failed, such as on a page that closes or navigates, says nothing about its main thread.
        if (answer !== 'failed') {
          if (answer === 'silent' && !silent) {
            record(`main thread hasn't answered for ${answerMs / 1000} s${pendingOf(recorders.get(t))}`)
          }
          if (answer === 'answered' && silent) record('main thread answers again')
          silent = answer === 'silent'
        }
        await delay(answerMs, undefined, { ref: false })
      }
    }
    void watch()
    t.after(function stopWatchdog() {
      stopped = true
    })
  }
  return recordActions(t, page, label)
}

function slug(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

/** How long stopping a trace may take, as long as a navigation may. */
const traceStopMs = 10_000

/**
 * Traces one browser context of the test, and keeps the trace of a failed test
 * in the diagnostics folder's traces/, named by the test and the `label`. Call
 * it before anything registers the context's cleanup, such as before
 * t.serve() or before the context's close, so its teardown stops the trace
 * before the context closes. Trace each context a test exercises with its own
 * label. A trace holds every browser operation with its timing and DOM
 * snapshots, but not the test's own assertions, which the phase log and the
 * lane's log keep.
 */
export function traceOnFailure(t: TestContext, { label = 'page' } = {}) {
  let context: BrowserContext | undefined
  let record = (name: string) => phase(t, `trace (${label}): ${name}`)
  t.after(async function stopTrace() {
    let recorder = recorders.get(t)
    if (!context || !recorder) return
    let folder = directory()
    let engine = context.browser()?.browserType().name() ?? 'browser'
    let path =
      recorder.failed && folder
        ? join(folder, 'traces', `${recorder.file}--${slug(recorder.test)}--${label}--${engine}.zip`)
        : undefined
    try {
      if (path) mkdirSync(join(folder!, 'traces'), { recursive: true })
      // Bounded like a navigation, so a browser that stopped answering can't hold the teardown.
      let stopped = await Promise.race([
        context.tracing.stop(path ? { path } : {}).then(() => true),
        delay(traceStopMs, false, { ref: false }),
      ])
      if (!stopped) record(`not saved: stopping it took longer than ${traceStopMs / 1000} s`)
      else if (path) record(`saved to traces/${path.split('/').at(-1)}`)
    } catch (error) {
      record(`not saved: ${firstLine(error)}`)
    }
  })
  return {
    /** Starts tracing the page's context, when there is a diagnostics folder to keep a trace in. */
    async start(page: Page) {
      if (!directory()) return
      context = page.context()
      let title = `${recorders.get(t)?.test ?? 'test'} (${label})`
      await context.tracing.start({ title, screenshots: true, snapshots: true })
    },
  }
}

/** Where a cleanup was registered: the file and line of the call to t.after. */
function registeredAt(stack: string | undefined) {
  let frame = stack?.split('\n')[2] ?? ''
  let match = /\(?(?:file:\/\/)?([^()\s?]+?)(?:\?[^:()\s]*)?:(\d+)(?::\d+)*\)?$/.exec(frame.trim())
  return match ? `${relative(process.cwd(), match[1])}:${match[2]}` : 'an unknown place'
}

/**
 * The test's context, with each cleanup recorded by its number and identity
 * when it starts and when it ends or fails: the function's name, if it has
 * one, and where it was registered. t.serve() registers the runner's own
 * cleanup, which closes its page and server, so that one is recorded too.
 */
function recordCleanups(t: TestContext, recorder: Recorder): TestContext {
  let count = 0
  let run = async (name: string, fn: () => unknown) => {
    recorder.record(`${name}: start`)
    try {
      await fn()
      recorder.record(`${name}: done`)
    } catch (error) {
      recorder.record(`${name}: failed: ${firstLine(error)}`)
      throw error
    }
  }
  return new Proxy(t, {
    get(target, key) {
      if (key === 'after') {
        return (fn: () => unknown) => {
          let place = registeredAt(new Error().stack)
          let name = `cleanup ${(count += 1)} (${fn.name ? `${fn.name}, ` : ''}registered at ${place})`
          target.after(() => run(name, fn))
        }
      }
      if (key === 'serve') {
        return async (server: Parameters<TestContext['serve']>[0]) => {
          let name = `cleanup ${(count += 1)} (t.serve's own, which closes its page and server)`
          let served = false
          // The runner registers its cleanup as t.serve() returns, so it runs between these two.
          target.after(() => served && recorder.record(`${name}: start`))
          let page = await target.serve(server)
          served = true
          target.after(() => recorder.record(`${name}: done`))
          return page
        }
      }
      return Reflect.get(target, key, target)
    },
  })
}

/**
 * Wraps remix test's `it` for one test file, so each test records its start,
 * its end or its error with the assertion's full output and the operations
 * still pending, each cleanup, and its teardown, and a failure names its last
 * phase. The log starts with the revision, the Node version and the command.
 */
export function probe(file: string): typeof runnerIt {
  let folder = directory()
  let path = folder ? join(folder, `phases-${file}.log`) : undefined
  let headed = false
  let write = (line: string) => {
    if (!path) return
    if (!headed) {
      headed = true
      appendFileSync(
        path,
        `# ${new Date().toISOString()} revision ${revision()}, node ${process.version}, command: ${command()}\n`,
      )
    }
    appendFileSync(path, `${line}\n`)
  }

  let wrap =
    (name: string, fn: TestFn): TestFn =>
    async (t) => {
      let line = (text: string) => write(`${new Date().toISOString()} ${file} > ${name}: ${text}`)
      let recorder: Recorder = {
        file,
        test: name,
        last: 'test start',
        pending: new Map(),
        failed: false,
        record(phase_) {
          recorder.last = phase_
          line(phase_)
        },
        note: line,
      }
      let probed = recordCleanups(t, recorder)
      recorders.set(t, recorder)
      recorders.set(probed, recorder)
      recorder.record('test start')
      try {
        await fn(probed)
        recorder.record('test end')
      } catch (error) {
        recorder.failed = true
        let message = error instanceof Error ? error.message : String(error)
        let last = recorder.last
        let pending = pendingOf(recorder)
        let output = `${message}${assertionValues(error)}`
        recorder.record(`failed in phase "${last}"${pending}: ${output.replaceAll('\n', '\n    ')}`)
        if (error instanceof Error) error.message = `${message}\n[last phase: ${last}${pending}]`
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
