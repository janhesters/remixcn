// Preloaded into check.ts by its tests, so it runs as on a system without /proc,
// where it can't list the processes a lane started.
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'

let { existsSync } = fs
fs.existsSync = (path) => path !== '/proc' && existsSync(path)
syncBuiltinESMExports()
