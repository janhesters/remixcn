// The remixcn command line: parses arguments, runs a command, and prints its
// result as text or, with --json, as one JSON document on stdout. Every
// failure ends with the exit code its kind documents (errors.ts).
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import type { ParseArgsConfig } from 'node:util'

import { add } from './add.ts'
import type { Context, FileResult } from './add.ts'
import { buildRegistryFolder } from './build.ts'
import { registriesAt, search, view } from './discover.ts'
import { CliError, exitCodes } from './errors.ts'
import { init, nextSteps } from './init.ts'
import { createFetcher } from './network.ts'
import type { FetchJson } from './network.ts'
import { majorVersion, readProject, remixVersion, supportedRemix } from './project.ts'
import type { FileSystem } from './transaction.ts'

export interface CliEnvironment {
  stdout: (text: string) => void
  stderr: (text: string) => void
  version: string
  /** The directory remixcn runs in. Defaults to process.cwd(). */
  cwd?: string
  fetch?: typeof globalThis.fetch
  confirm?: (question: string) => Promise<boolean>
  fs?: FileSystem
}

const docs = 'https://janhesters.github.io/remixcn/'

const usage = `Usage: remixcn <command> [options]

shadcn components for Remix V3. remixcn copies component source from a
registry into your Remix 3 app, where you own it.

Commands:
  init [items...]          Set up components.json and the theme in a Remix 3 app
  add [items...]           Add items and everything they depend on
  list [registries...]     List the items of registries
  search [registries...]   Search the items of registries
  view <items...>          Show items as the registry serves them
  build [registry]         Build registry.json into one JSON file per item
  mcp                      Reserved for the RemixCN MCP server
  version                  Show the version
  help [command]           Show help for a command

Items: a name (button), @namespace/name, an https:// URL, or a path to an
item's JSON file. Plain http:// works only for localhost.

Options:
  -c, --cwd <dir>  The app's directory (default: the current directory)
  --json           Print the result or the error as JSON on stdout
  -h, --help       Show help
  -v, --version    Show the version

Exit codes:
  0 success           4 network       7 conflict
  1 internal error    5 registry      8 write failed
  2 usage             6 unsafe path   9 not available yet
  3 project

Docs: ${docs}
`

const commandHelp: Record<string, string> = {
  init: `Usage: remixcn init [items...] [options]

Prepares an existing Remix 3 app: writes components.json, maps the default
#remixcn aliases in package.json imports, and installs @remixcn/theme with the
license texts, plus any items you name. It installs no npm package, keeps
every other setting, and changes no existing file without --overwrite.

Options:
  -c, --cwd <dir>   The app's directory
  -y, --yes         Don't ask before overwriting; fail on a conflict instead
  -o, --overwrite   Replace files and settings that differ
  --dry-run         Show every change without writing
  --json            Print the result as JSON
`,
  add: `Usage: remixcn add [items...] [options]

Adds items and everything they depend on: the source, the shared helpers, the
theme tokens and the license texts. It checks every file before it writes
any, and a failure undoes the whole change. Running it again changes nothing.

Options:
  -c, --cwd <dir>   The app's directory
  -a, --all         Add every item of the @remixcn registry
  -p, --path <dir>  Put the named items' component files in <dir>
  -y, --yes         Don't ask before overwriting; fail on a conflict instead
  -o, --overwrite   Replace files that differ from the registry
  --dry-run         Show every change without writing
  --json            Print the result as JSON
`,
  list: `Usage: remixcn list [registries...] [options]

Lists the items of the registries: namespaces such as @remixcn, registry.json
URLs or paths. Without one, it lists every registry in components.json and
@remixcn.

Options:
  -c, --cwd <dir>       The app's directory
  -t, --type <types>    Only these types, such as ui or ui,lib
  -l, --limit <number>  Show at most this many items (default: 100)
  -o, --offset <number> Skip this many items (default: 0)
  --json                Print the items as JSON
`,
  search: `Usage: remixcn search [registries...] --query <text> [options]

Searches the names, titles and descriptions of the registries' items.

Options:
  -c, --cwd <dir>       The app's directory
  -q, --query <text>    The words to look for
  -t, --type <types>    Only these types, such as ui or ui,lib
  -l, --limit <number>  Show at most this many items (default: 100)
  -o, --offset <number> Skip this many items (default: 0)
  --json                Print the items as JSON
`,
  view: `Usage: remixcn view <items...> [options]

Prints the items as JSON, as the registry serves them, after checking that
remixcn can install them. It writes nothing.

Options:
  -c, --cwd <dir>  The app's directory
`,
  build: `Usage: remixcn build [registry] [options]

Builds a RemixCN registry: checks registry.json and registry/catalog.json
next to it, then writes registry.json and one <name>.json per item. A failed
build writes nothing, and the build replaces only an earlier build.

Options:
  -c, --cwd <dir>      The directory to work in
  -o, --output <dir>   Where to write (default: dist/r)
  --json               Print the result as JSON
`,
  mcp: `Usage: remixcn mcp

Reserved for the RemixCN MCP server, which arrives in a later release.
shadcn's MCP server already reads the registries in components.json.
`,
}

const common = {
  cwd: { type: 'string', short: 'c' },
  json: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
} as const

const write = {
  yes: { type: 'boolean', short: 'y' },
  overwrite: { type: 'boolean', short: 'o' },
  'dry-run': { type: 'boolean' },
} as const

const listing = {
  query: { type: 'string', short: 'q' },
  type: { type: 'string', short: 't' },
  limit: { type: 'string', short: 'l' },
  offset: { type: 'string', short: 'o' },
} as const

const commandOptions: Record<string, ParseArgsConfig['options']> = {
  init: { ...common, ...write },
  add: { ...common, ...write, all: { type: 'boolean', short: 'a' }, path: { type: 'string', short: 'p' } },
  list: { ...common, ...listing },
  search: { ...common, ...listing },
  view: { ...common },
  build: { ...common, output: { type: 'string', short: 'o' } },
  mcp: { ...common },
  version: { ...common },
  help: { ...common },
}

const aliases: Record<string, string> = { '--version': 'version', '-v': 'version', '--help': 'help', '-h': 'help' }

function parse(command: string, args: string[]) {
  try {
    return parseArgs({ args, options: commandOptions[command], allowPositionals: true, strict: true })
  } catch (error) {
    throw new CliError('USAGE', `${(error as Error).message}. Run remixcn help ${command}.`)
  }
}

function count(value: string | undefined, fallback: number, flag: string) {
  if (value === undefined) return fallback
  if (!/^\d+$/.test(value)) throw new CliError('USAGE', `${flag} needs a whole number, not "${value}"`)
  return Number(value)
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

/** Describes what an install did, or would do with --dry-run. */
function describeFiles(files: FileResult[], dryRun: boolean): string {
  let groups: Array<[label: string, matches: (file: FileResult) => boolean]> = [
    [dryRun ? 'Would create' : 'Created', (file) => file.action === 'create'],
    [dryRun ? 'Would update' : 'Updated', (file) => file.action === 'update' && !file.overwrite],
    [dryRun ? 'Would overwrite' : 'Overwrote', (file) => file.action === 'update' && !!file.overwrite],
  ]

  let lines = groups.flatMap(([label, matches]) => {
    let matching = files.filter(matches)
    if (matching.length === 0) return []
    return [
      `${dryRun ? '•' : '✓'} ${label} ${plural(matching.length, 'file')}:`,
      ...matching.map((file) => `    ${file.path}`),
    ]
  })

  let unchanged = files.filter((file) => file.action === 'unchanged').length
  if (lines.length === 0) return `✓ Nothing to change: ${plural(unchanged, 'file')} already up to date.\n`
  if (unchanged > 0) lines.push(`  ${plural(unchanged, 'file')} already up to date`)
  if (dryRun) lines.unshift('Dry run: nothing was written.')
  return `${lines.join('\n')}\n`
}

function printError(error: CliError, json: boolean, environment: CliEnvironment) {
  if (json) {
    let body = { error: { code: error.code, exitCode: error.exitCode, message: error.message, details: error.details } }
    environment.stdout(`${JSON.stringify(body, null, 2)}\n`)
    return
  }
  let details = error.details.map((detail) => `  - ${detail}\n`).join('')
  environment.stderr(`remixcn: ${error.message}\n${details}`)
}

function context(environment: CliEnvironment, json: boolean): Context {
  let fetchJson: FetchJson = createFetcher({ fetch: environment.fetch, userAgent: `remixcn/${environment.version}` })
  // A script that reads JSON can't answer a question, so --json never asks.
  return {
    cwd: environment.cwd ?? process.cwd(),
    fetchJson,
    confirm: json ? undefined : environment.confirm,
    fs: environment.fs,
  }
}

async function runCommand(
  command: string,
  args: string[],
  environment: CliEnvironment,
  print: (text: string, json: unknown) => void,
) {
  let { values, positionals } = parse(command, args)
  let options = values as Record<string, string | boolean | undefined>
  let cwd = resolve(environment.cwd ?? process.cwd(), (options.cwd as string | undefined) ?? '.')
  let commandContext = context(environment, !!options.json)

  if (options.help) return print(commandHelp[command] ?? usage, { help: commandHelp[command] ?? usage })

  switch (command) {
    case 'version':
      return print(`${environment.version}\n`, { version: environment.version })

    case 'help': {
      let [topic] = positionals
      if (topic !== undefined && !(topic in commandHelp))
        throw new CliError('USAGE', `No help for "${topic}". Run remixcn help.`)
      let text = topic === undefined ? usage : commandHelp[topic]
      return print(text, { help: text })
    }

    case 'mcp':
      throw new CliError(
        'UNAVAILABLE',
        "remixcn mcp arrives in a later release. Until then, shadcn's MCP server reads the registries in components.json: npx shadcn@latest mcp",
      )

    case 'init': {
      let result = await init(
        {
          root: cwd,
          items: positionals,
          yes: !!options.yes,
          overwrite: !!options.overwrite,
          dryRun: !!options['dry-run'],
        },
        commandContext,
      )
      let steps = nextSteps(result.theme)
      let text = describeFiles(result.files, result.dryRun)
      text += result.warnings.map((warning) => `⚠ ${warning}\n`).join('')
      if (!result.dryRun) text += `\nNext steps:\n${steps.map((step, index) => `  ${index + 1}. ${step}\n`).join('')}`
      return print(text, { ...result, nextSteps: steps })
    }

    case 'add': {
      let result = await add(
        {
          root: cwd,
          items: positionals,
          all: !!options.all,
          path: options.path as string | undefined,
          yes: !!options.yes,
          overwrite: !!options.overwrite,
          dryRun: !!options['dry-run'],
        },
        commandContext,
      )
      let text = describeFiles(result.files, result.dryRun)
      if (result.docs.length > 0) text += `\n${result.docs.join('\n')}\n`
      return print(text, result)
    }

    case 'list':
    case 'search': {
      let result = await search(
        {
          registries: positionals,
          query: options.query as string | undefined,
          types: (options.type as string | undefined)
            ?.split(',')
            .map((type) => type.trim())
            .filter(Boolean),
          limit: count(options.limit as string | undefined, 100, '--limit'),
          offset: count(options.offset as string | undefined, 0, '--offset'),
        },
        { registries: registriesAt(cwd), cwd: commandContext.cwd, fetchJson: commandContext.fetchJson },
      )
      let lines = result.items.map(
        (item) => `${item.addCommandArgument} (${item.type})${item.description ? ` - ${item.description}` : ''}`,
      )
      let { total, offset, hasMore } = result.pagination
      if (total === 0) lines.push(options.query ? `No items match "${options.query}".` : 'No items.')
      if (hasMore)
        lines.push(
          `\nShowing ${offset + 1}-${offset + result.items.length} of ${total}. Pass --offset ${offset + result.items.length} for more.`,
        )
      return print(`${lines.join('\n')}\n`, result)
    }

    case 'view': {
      let payloads = await view(positionals, {
        registries: registriesAt(cwd),
        cwd: commandContext.cwd,
        fetchJson: commandContext.fetchJson,
      })
      let text = `${JSON.stringify(payloads, null, 2)}\n`
      return print(text, payloads)
    }

    case 'build': {
      if (positionals.length > 1)
        throw new CliError('USAGE', 'remixcn build takes one registry.json path. Run remixcn help build.')
      let registryFile = resolve(cwd, positionals[0] ?? 'registry.json')
      if (!registryFile.endsWith('registry.json'))
        throw new CliError('USAGE', `${positionals[0]} is not a registry.json file`)
      let root = resolve(registryFile, '..')
      let out = resolve(cwd, (options.output as string | undefined) ?? join('dist', 'r'))
      let names = buildRegistryFolder({ root, out, remix: buildRemix(root) })
      return print(
        `✓ Built ${plural(names.length, 'item')}: ${names.join(', ')}\n✓ ${out} holds registry.json and one <name>.json per item\n`,
        {
          items: names,
          output: out,
        },
      )
    }
  }
}

/** The Remix version a registry's items are written for: its package.json's, or the one remixcn supports. */
function buildRemix(root: string) {
  try {
    let version = remixVersion(readProject(root))
    if (version !== undefined && majorVersion(version) !== undefined) return version.replace(/^[\^~=v]+/, '')
  } catch {
    // A registry folder without package.json is written for the Remix remixcn supports.
  }
  return supportedRemix
}

/** Runs remixcn with `argv` and returns its exit code. */
export async function run(argv: readonly string[], environment: CliEnvironment): Promise<number> {
  let [first, ...rest] = argv
  let command = first === undefined ? 'help' : (aliases[first] ?? first)
  let json = argv.includes('--json')

  let print = (text: string, value: unknown) => environment.stdout(json ? `${JSON.stringify(value, null, 2)}\n` : text)

  try {
    if (!(command in commandOptions)) {
      if (json) throw new CliError('USAGE', `Unknown command "${first}". Run remixcn help.`)
      environment.stderr(`remixcn: unknown command "${first}"\n\n${usage}`)
      return exitCodes.USAGE
    }
    await runCommand(command, rest, environment, print)
    return 0
  } catch (error) {
    let failure =
      error instanceof CliError
        ? error
        : new CliError(
            'INTERNAL',
            `remixcn hit a bug: ${(error as Error)?.stack ?? String(error)}\nPlease report it at https://github.com/janhesters/remixcn/issues`,
          )
    printError(failure, json, environment)
    return failure.exitCode
  }
}
