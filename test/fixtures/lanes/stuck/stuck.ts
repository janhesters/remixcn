// Never exits, as a lane does whose test waits on a promise that never settles.
// It also starts a process of its own, which inherits the lane's marker.
import { spawn } from 'node:child_process'

let child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1_000)'], { stdio: 'ignore' })
process.stdout.write(`stuck ${process.pid} ${child.pid}\n`)
setInterval(() => {}, 1_000)
