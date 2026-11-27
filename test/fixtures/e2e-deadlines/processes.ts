import { existsSync, readdirSync, readFileSync } from 'node:fs'

/** Each process's parent, from Linux's /proc. Empty elsewhere. */
function readParents(): Map<number, number> {
  let parents = new Map<number, number>()
  if (!existsSync('/proc')) return parents
  for (let name of readdirSync('/proc')) {
    if (!/^\d+$/.test(name)) continue
    try {
      let stat = readFileSync(`/proc/${name}/stat`, 'utf8')
      parents.set(Number(name), Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]))
    } catch {}
  }
  return parents
}

/**
 * Prints this worker's process, every process it started, such as the
 * browser, and the servers the test opened, so the run's test can check that
 * none of them outlives the run.
 */
export function reportProcesses(servers: string[]) {
  let parents = readParents()
  let processes = [process.pid]
  for (let index = 0; index < processes.length; index++) {
    for (let [pid, parent] of parents) if (parent === processes[index]) processes.push(pid)
  }
  console.log(`fixture processes: ${JSON.stringify({ processes, servers })}`)
}
