import { existsSync, readFileSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'

/**
 * Whether a process still runs. A zombie has exited and only waits for its
 * parent to collect it, so it doesn't count, although signal 0 still finds
 * it. Reads /proc on Linux, and asks the system elsewhere.
 */
export function isRunning(pid: number): boolean {
  if (existsSync('/proc')) {
    try {
      // The state follows the command name, which sits in parentheses and may hold any character.
      let stat = readFileSync(`/proc/${pid}/stat`, 'utf8')
      let state = stat.slice(stat.lastIndexOf(')') + 2).charAt(0)
      return state !== 'Z' && state !== 'X'
    } catch {
      return false
    }
  }

  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** Waits until none of the processes runs, for at most `timeoutMs`. Returns the ones that still run. */
export async function waitForExit(pids: number[], timeoutMs: number): Promise<number[]> {
  let deadline = Date.now() + timeoutMs
  let running = pids.filter(isRunning)
  while (running.length > 0 && Date.now() < deadline) {
    await delay(20)
    running = running.filter(isRunning)
  }
  return running
}
