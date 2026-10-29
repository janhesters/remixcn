#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'

import { run } from './cli.ts'

let { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

/** Asks on the terminal. Without one, remixcn never waits for an answer. */
async function confirm(question: string) {
  let terminal = createInterface({ input: process.stdin, output: process.stderr })
  try {
    return /^y(es)?$/i.test((await terminal.question(`${question} (y/N) `)).trim())
  } finally {
    terminal.close()
  }
}

// A reader that closes stdout has gone, such as an MCP client: stop reading, so remixcn mcp ends.
process.stdout.on('error', () => process.stdin.destroy())

process.exitCode = await run(process.argv.slice(2), {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  stdin: process.stdin,
  version,
  confirm: process.stdin.isTTY && process.stderr.isTTY ? confirm : undefined,
})
