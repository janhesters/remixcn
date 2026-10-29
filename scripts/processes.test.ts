import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { isRunning, waitForExit } from './processes.ts'

/** Lists the processes in a process group: all of them from /proc on Linux, only its leader elsewhere. */
function processGroup(group: number): number[] {
  if (!existsSync('/proc')) return [group]

  return readdirSync('/proc')
    .filter((name) => /^\d+$/.test(name))
    .map(Number)
    .filter((pid) => {
      try {
        // After the command name in parentheses come the state, the parent and the group.
        let stat = readFileSync(`/proc/${pid}/stat`, 'utf8')
        return Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[2]) === group
      } catch {
        return false
      }
    })
}

/**
 * Starts a command in its own process group. After the test, also when an
 * assertion fails, it stops every process in the group, including children
 * a shell keeps, and waits until they have exited, so none outlives the test.
 */
function start(t: TestContext, command: string, args: string[]) {
  let child = spawn(command, args, { detached: true, stdio: ['ignore', 'pipe', 'ignore'] })
  let group = child.pid!
  t.after(async () => {
    let members = processGroup(group)
    try {
      process.kill(-group, 'SIGKILL')
    } catch {
      // Every process in the group has exited already.
    }
    assert.deepEqual(await waitForExit(members, 5_000), [], 'a process the test started outlived it')
  })
  return child
}

describe('isRunning', () => {
  it('tells a running process from one that is gone', () => {
    let { pid } = spawnSync('true')

    assert.equal(isRunning(process.pid), true)
    assert.equal(isRunning(pid!), false)
  })

  it(
    'counts a zombie, which has exited and waits for its parent to collect it, as stopped',
    { skip: process.platform !== 'linux' },
    async (t) => {
      // The background sleep's parent becomes the long sleep, which never collects it.
      let parent = start(t, 'sh', ['-c', 'sleep 0.05 & echo $!; exec sleep 30'])
      let pid = Number(
        await new Promise<string>((resolve) => parent.stdout.once('data', (data) => resolve(String(data)))),
      )
      let state = () => (existsSync(`/proc/${pid}/stat`) ? readFileSync(`/proc/${pid}/stat`, 'utf8') : '')
      for (let attempt = 0; attempt < 100 && !/\) Z /.test(state()); attempt++) await delay(20)

      assert.match(state(), /\) Z /)
      assert.doesNotThrow(() => process.kill(pid, 0), 'the zombie is still in the process table')
      assert.equal(isRunning(pid), false)
    },
  )
})

describe('waitForExit', () => {
  it('lists the processes that still run when time is up, and none once they exit', async (t) => {
    let { pid } = start(t, 'sleep', ['30'])

    assert.deepEqual(await waitForExit([pid!], 100), [pid])
    process.kill(pid!, 'SIGKILL')
    assert.deepEqual(await waitForExit([pid!], 5_000), [])
  })
})
