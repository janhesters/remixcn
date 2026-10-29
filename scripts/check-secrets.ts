// Checks files for credentials before they reach the public repository or a CI artifact.
// Usage: node scripts/check-secrets.ts            (the files git tracks or would add)
//        node scripts/check-secrets.ts <dir> ...  (every file in each folder, such as CI diagnostics)
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { findSecrets, isSecretFile } from './secrets.ts'

function listFiles(directory: string): string[] {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
}

let directories = process.argv.slice(2)
let files =
  directories.length > 0
    ? directories.flatMap(listFiles)
    : execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
        .split('\0')
        .filter((file) => file !== '' && existsSync(file))

let problems = files.flatMap((file) => {
  let name = directories.length > 0 ? relative(process.cwd(), file) : file
  if (isSecretFile(file)) return [`${name}: environment, key and certificate files must not be committed or uploaded`]

  // Every file is read, binary or not. Latin-1 keeps each byte as one
  // character, so NUL bytes and invalid UTF-8 can't hide a token.
  let content = readFileSync(file, 'latin1')

  return findSecrets(content).map(({ kind, line }) => `${name}:${line}: looks like ${kind}`)
})

if (problems.length > 0) {
  for (let problem of problems) process.stderr.write(`✗ ${problem}\n`)
  process.stderr.write('\nRemove the credential and use invented data. Revoke it if it was real.\n')
  process.exitCode = 1
} else {
  let scope = directories.length > 0 ? `files in ${directories.join(', ')}` : 'repository files'
  process.stdout.write(`✓ ${files.length} ${scope} hold no credentials\n`)
}
