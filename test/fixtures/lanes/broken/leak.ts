// Starts a process that outlives the lane, as a test that forgets to stop its server would.
// --keep-output: the process inherits the lane's output, as a server that logs would.
// --unmarked: it also drops the runner's marker, as a process that resets its environment would.
import { spawn } from 'node:child_process'

let keepOutput = process.argv.includes('--keep-output')
let env = { ...process.env }
if (process.argv.includes('--unmarked')) delete env.REMIXCN_CHECK_LANE

let child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30_000)'], {
  detached: true,
  env,
  stdio: keepOutput ? ['ignore', 'inherit', 'inherit'] : 'ignore',
})
child.unref()
process.stdout.write(`leaked ${child.pid}\n`)
