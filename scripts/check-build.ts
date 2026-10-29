// Builds packages/cli and checks the remixcn executable against its package contract.
// Usage: node scripts/check-build.ts
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { checkCliImport, checkCliPackage, checkPackageMetadata } from './contracts.ts'
import type { PackageJson } from './contracts.ts'
import { readScriptImports, tsc } from './typescript.ts'
import { listPackageFiles } from './workspace.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const cli = join(root, 'packages/cli')

function readJson(file: string) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

function fail(problems: string[]): never {
  for (let problem of problems) process.stderr.write(`✗ ${problem}\n`)
  process.exit(1)
}

let build = spawnSync(process.execPath, [tsc, '-p', join(cli, 'tsconfig.build.json')], { encoding: 'utf8' })
if (build.status !== 0) fail([`tsc -p packages/cli/tsconfig.build.json failed:\n${build.stdout}${build.stderr}`])

let packageFiles = listPackageFiles(root)
let workspace = readJson(join(root, 'package.json')) as PackageJson
let pkg = readJson(join(cli, 'package.json')) as PackageJson & { version: string }
let sourceFiles = readdirSync(join(cli, 'src'), { recursive: true, encoding: 'utf8' })
  .filter((file) => /\.tsx?$/.test(file) && !file.includes('.test.'))
  .map((file) => `packages/cli/src/${file.replaceAll('\\', '/')}`)
let imports = readScriptImports(root, sourceFiles)
let problems = [
  ...packageFiles.flatMap((file) => checkPackageMetadata(readJson(join(root, file)) as PackageJson)),
  ...checkCliPackage(pkg, workspace),
  ...sourceFiles.flatMap((file) =>
    (imports.get(file) ?? [])
      .flatMap((specifier) => checkCliImport(file, specifier) ?? [])
      .map((problem) => `${file}: ${problem}`),
  ),
]

let bin = join(cli, pkg.bin?.remixcn ?? 'dist/bin.js')
if (!existsSync(bin)) problems.push(`packages/cli: the build did not emit ${pkg.bin?.remixcn}`)
else if (!readFileSync(bin, 'utf8').startsWith('#!/usr/bin/env node\n')) {
  problems.push(`packages/cli: ${pkg.bin?.remixcn} must start with #!/usr/bin/env node`)
}

let tests = readdirSync(join(cli, 'dist'), { recursive: true, encoding: 'utf8' }).filter((file) =>
  file.includes('.test.'),
)
if (tests.length > 0) problems.push(`packages/cli/dist must not ship tests (${tests.join(', ')})`)

if (
  !existsSync(join(cli, 'LICENSE')) ||
  readFileSync(join(cli, 'LICENSE'), 'utf8') !== readFileSync(join(root, 'LICENSE'), 'utf8')
) {
  problems.push('packages/cli/LICENSE must be a copy of the root LICENSE, so the package ships it')
}

if (problems.length > 0) fail(problems)

let version = spawnSync(process.execPath, [bin, '--version'], { encoding: 'utf8' })
if (version.status !== 0 || version.stdout !== `${pkg.version}\n`) {
  fail([
    `remixcn --version printed ${JSON.stringify(version.stdout)} (exit ${version.status}), expected ${pkg.version}`,
  ])
}

let help = spawnSync(process.execPath, [bin, '--help'], { encoding: 'utf8' })
if (help.status !== 0 || !help.stdout.startsWith('Usage: remixcn ')) {
  fail([`remixcn --help printed ${JSON.stringify(help.stdout)} (exit ${help.status}), expected its usage`])
}

process.stdout.write(`✓ ${packageFiles.join(', ').replace(/, ([^,]+)$/, ' and $1')} carry the approved metadata\n`)
process.stdout.write(`✓ ${pkg.name} has no runtime dependencies and ships the MIT license\n`)
process.stdout.write('✓ packages/cli/src imports only Node built-ins and its own files\n')
process.stdout.write(
  `✓ packages/cli/dist/bin.js runs as remixcn ${pkg.version} on Node ${process.versions.node} and prints its help\n`,
)
