import * as fs from 'node:fs'
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, relative } from 'node:path'
import { PassThrough } from 'node:stream'
import { fileURLToPath } from 'node:url'

import * as assert from 'remix/assert'
import { after, before, describe, it } from 'remix/test'

import { serveRegistry } from '../../../test/static-server.ts'
import { buildRegistryFolder } from './build.ts'
import { run } from './cli.ts'
import type { CliEnvironment } from './cli.ts'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const fixture = join(root, 'test/fixtures/registries/installable')

let scratch = ''
let registry: Awaited<ReturnType<typeof serveRegistry>>

before(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'remixcn-cli-'))
  buildRegistryFolder({ root: fixture, out: join(scratch, 'r'), remix: '3.0.0' })
  registry = await serveRegistry(join(scratch, 'r'), '/remixcn/r/')
})

after(async () => {
  await registry?.close()
  rmSync(scratch, { recursive: true, force: true })
})

async function remixcn(argv: string[], environment: Partial<CliEnvironment> = {}) {
  let output = { stdout: '', stderr: '' }
  let code = await run(argv, {
    stdout: (text) => (output.stdout += text),
    stderr: (text) => (output.stderr += text),
    version: '1.2.3',
    cwd: scratch,
    ...environment,
  })
  return { code, ...output }
}

let apps = 0

/** Copies the Remix 3.0.0 consumer fixture and points @remixcn at the local registry. */
function createApp(config: Record<string, unknown> = {}) {
  let app = join(scratch, `app-${++apps}`)
  cpSync(join(root, 'test/fixtures/consumer-app'), app, { recursive: true })
  writeFileSync(
    join(app, 'components.json'),
    JSON.stringify({ registries: { '@remixcn': `${registry.url}{name}.json` }, ...config }, null, 2),
  )
  return app
}

async function initializedApp() {
  let app = createApp()
  let result = await remixcn(['init', '--cwd', app])
  assert.equal(result.code, 0, result.stderr)
  return app
}

/** Every file and directory under `directory`, with each file's content. */
function snapshot(directory: string) {
  return Object.fromEntries(
    readdirSync(directory, { recursive: true, encoding: 'utf8' })
      .sort()
      .map((path) => {
        let full = join(directory, path)
        return [path, statSync(full).isDirectory() ? '<dir>' : readFileSync(full, 'utf8')]
      }),
  )
}

const read = (app: string, path: string) => readFileSync(join(app, path), 'utf8')
const ui = 'app/ui/public/components/ui'
const lib = 'app/ui/public/lib'

describe('remixcn', () => {
  it('prints its version for --version and version', async () => {
    for (let argv of [['--version'], ['-v'], ['version']]) {
      let result = await remixcn(argv)
      assert.equal(result.code, 0)
      assert.equal(result.stdout, '1.2.3\n')
    }
  })

  it('prints usage with the commands and exit codes', async () => {
    for (let argv of [[], ['--help'], ['help']]) {
      let result = await remixcn(argv)
      assert.equal(result.code, 0)
      assert.match(result.stdout, /^Usage: remixcn <command>/m)
      assert.match(result.stdout, /shadcn components for Remix V3/)
      for (let command of ['init', 'add', 'list', 'search', 'view', 'build', 'mcp'])
        assert.match(result.stdout, new RegExp(`^  ${command} `, 'm'))
      assert.match(result.stdout, /Exit codes:/)
      assert.match(result.stdout, /https:\/\/janhesters\.github\.io\/remixcn\//)
    }

    let add = await remixcn(['add', '--help'])
    assert.match(add.stdout, /^Usage: remixcn add/)
    assert.match(add.stdout, /--dry-run/)
  })

  it('rejects an unknown command and an unknown option with exit code 2', async () => {
    let command = await remixcn(['install', 'button'])
    assert.equal(command.code, 2)
    assert.match(command.stderr, /^remixcn: unknown command "install"/)

    let option = await remixcn(['add', 'button', '--force'])
    assert.equal(option.code, 2)
    assert.match(option.stderr, /Unknown option '--force'/)
  })

  it('serves MCP on stdin and stdout for the app in --cwd, until its input ends', async () => {
    let app = createApp()
    let input = new PassThrough()
    let running = remixcn(['mcp', '--cwd', app], { stdin: input })

    let meta = {
      'io.modelcontextprotocol/protocolVersion': '2026-07-28',
      'io.modelcontextprotocol/clientCapabilities': {},
    }
    input.end(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'server/discover', params: { _meta: meta } })}\n`)
    let result = await running

    assert.equal(result.code, 0)
    let [response, ...rest] = result.stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
    assert.deepEqual(rest, [])
    assert.equal(response.id, 1)
    assert.deepEqual(response.result.supportedVersions, ['2026-07-28'])
    assert.deepEqual(response.result._meta['io.modelcontextprotocol/serverInfo'], {
      name: 'remixcn',
      title: 'RemixCN',
      version: '1.2.3',
      description: 'shadcn components for Remix V3',
      websiteUrl: 'https://janhesters.github.io/remixcn/',
    })
    assert.match(
      result.stderr,
      new RegExp(`^remixcn mcp: serving RemixCN's tools for ${app.replaceAll('/', '\\/')} on stdio`),
    )
  })

  it('prints how to add the MCP server to Claude Code, Codex, Cursor and VS Code', async () => {
    let result = await remixcn(['help', 'mcp'])

    assert.equal(result.code, 0)
    assert.match(result.stdout, /^Usage: remixcn mcp \[options\]/)
    for (let config of ['.mcp.json', '~/.codex/config.toml', '.cursor/mcp.json', '.vscode/mcp.json'])
      assert.ok(result.stdout.includes(config), config)
    assert.match(result.stdout, /"command": "npx", "args": \["-y", "remixcn", "mcp"\]/)
    assert.match(result.stdout, /\[mcp_servers\.remixcn\]\n\s+command = "npx"\n\s+args = \["-y", "remixcn", "mcp"\]/)

    let extra = await remixcn(['mcp', 'button'])
    assert.equal(extra.code, 2)
    assert.match(extra.stderr, /remixcn mcp takes no arguments/)
  })

  it('prints errors as JSON with --json', async () => {
    let result = await remixcn(['add', 'button', '--json', '--cwd', join(scratch, 'missing')])

    assert.equal(result.code, 3)
    assert.equal(result.stderr, '')
    let { error } = JSON.parse(result.stdout)
    assert.equal(error.code, 'PROJECT')
    assert.equal(error.exitCode, 3)
    assert.match(error.message, /is not a directory/)
  })
})

describe('remixcn init', () => {
  it('writes components.json, maps the aliases and installs the theme with the license texts', async () => {
    let app = createApp()
    let packageJson = JSON.parse(read(app, 'package.json'))

    let result = await remixcn(['init', '--cwd', app])

    assert.equal(result.code, 0, result.stderr)
    assert.deepEqual(JSON.parse(read(app, 'components.json')), {
      registries: { '@remixcn': `${registry.url}{name}.json` },
      $schema: 'https://janhesters.github.io/remixcn/schema/components.json',
      version: 1,
      rsc: false,
      tsx: true,
      aliases: { ui: '#remixcn/ui', lib: '#remixcn/lib', components: '#remixcn/components' },
      css: `${lib}/theme.css`,
    })
    assert.deepEqual(JSON.parse(read(app, 'package.json')), {
      ...packageJson,
      imports: {
        '#remixcn/ui/*': `./${ui}/*`,
        '#remixcn/lib/*': `./${lib}/*`,
        '#remixcn/components/*': './app/ui/public/components/*',
      },
    })
    assert.equal(read(app, `${lib}/theme.css`), read(fixture, 'registry/lib/theme.css'))
    assert.equal(read(app, `${lib}/remixcn/LICENSE`), read(fixture, 'LICENSE'))
    assert.equal(read(app, `${lib}/remixcn/THIRD_PARTY_NOTICES.md`), read(fixture, 'THIRD_PARTY_NOTICES.md'))
    assert.match(result.stdout, /✓ Created 3 files:\n {4}app\/ui\/public\/lib\/remixcn\/LICENSE\n/)
    assert.match(result.stdout, /✓ Updated 2 files:\n {4}components\.json\n {4}package\.json\n/)
    assert.match(result.stdout, /Next steps:/)
    assert.match(result.stdout, /assetServer\.getHref\('app\/ui\/public\/lib\/theme\.css'\)/)
    assert.match(result.stdout, /<link rel="stylesheet" href=\{themeHref\} \/>/)
    assert.match(result.stdout, /run\(\) in app\/actions\/public\/entry\.ts/)
  })

  it('creates components.json for the public @remixcn registry in a new app', async () => {
    let app = createApp()
    rmSync(join(app, 'components.json'))
    let requested: string[] = []
    let published = (async (input: string | URL | Request, init?: RequestInit) => {
      requested.push(String(input))
      return fetch(String(input).replace('https://janhesters.github.io/remixcn/r/', registry.url), init)
    }) as typeof globalThis.fetch

    let result = await remixcn(['init', '--cwd', app], { fetch: published })

    assert.equal(result.code, 0, result.stderr)
    assert.deepEqual(
      requested,
      ['theme', 'licenses'].map((name) => `https://janhesters.github.io/remixcn/r/${name}.json`),
    )
    assert.equal(
      read(app, 'components.json'),
      `{
  "$schema": "https://janhesters.github.io/remixcn/schema/components.json",
  "version": 1,
  "rsc": false,
  "tsx": true,
  "css": "app/ui/public/lib/theme.css",
  "aliases": {
    "ui": "#remixcn/ui",
    "lib": "#remixcn/lib",
    "components": "#remixcn/components"
  },
  "registries": {
    "@remixcn": "https://janhesters.github.io/remixcn/r/{name}.json"
  }
}
`,
    )

    let schema = JSON.parse(readFileSync(join(root, 'packages/cli/components.schema.json'), 'utf8'))
    let config = JSON.parse(read(app, 'components.json'))
    assert.equal(config.$schema, schema.$id)
    for (let field of schema.required) assert.ok(field in config, field)
    for (let [field, rule] of Object.entries<{ const?: unknown }>(schema.properties)) {
      if ('const' in rule) assert.equal(config[field], rule.const, field)
    }
    assert.deepEqual(Object.keys(config.aliases), schema.properties.aliases.required)
    for (let url of Object.values<string>(config.registries)) {
      assert.match(url, new RegExp(schema.properties.registries.additionalProperties.pattern))
    }
  })

  it('changes nothing when it runs again', async () => {
    let app = await initializedApp()
    let before = snapshot(app)

    let result = await remixcn(['init', '--cwd', app])

    assert.equal(result.code, 0, result.stderr)
    assert.match(result.stdout, /Nothing to change: 4 files already up to date/)
    assert.deepEqual(snapshot(app), before)
  })

  it('keeps unrelated settings and aliases that resolve through tsconfig paths', async () => {
    let app = createApp({
      iconLibrary: 'remixcn',
      aliases: { ui: '~/ui/public/ui', lib: '~/ui/public/lib', components: '~/ui/public' },
    })
    let tsconfig = JSON.parse(read(app, 'tsconfig.json'))
    tsconfig.compilerOptions.paths = { '~/*': ['./app/*'] }
    writeFileSync(join(app, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2))
    let packageJson = read(app, 'package.json')

    let result = await remixcn(['init', '--cwd', app])

    assert.equal(result.code, 0, result.stderr)
    let config = JSON.parse(read(app, 'components.json'))
    assert.equal(config.iconLibrary, 'remixcn')
    assert.deepEqual(config.aliases, { ui: '~/ui/public/ui', lib: '~/ui/public/lib', components: '~/ui/public' })
    assert.equal(read(app, 'package.json'), packageJson)
    assert.equal(read(app, 'app/ui/public/lib/theme.css'), read(fixture, 'registry/lib/theme.css'))
  })

  it('refuses an app that is not Remix 3 and writes nothing', async () => {
    let app = createApp()
    writeFileSync(join(app, 'package.json'), JSON.stringify({ name: 'web', dependencies: { react: '19.0.0' } }))
    let before = snapshot(app)

    let result = await remixcn(['init', '--cwd', app])

    assert.equal(result.code, 3)
    assert.match(result.stderr, /isn't a Remix app/)
    assert.deepEqual(snapshot(app), before)
  })

  it('changes a conflicting setting only with --overwrite', async () => {
    let app = createApp({ rsc: true })
    let before = snapshot(app)

    let refused = await remixcn(['init', '--cwd', app])
    assert.equal(refused.code, 7)
    assert.match(refused.stderr, /components\.json sets rsc to true; RemixCN needs false/)
    assert.deepEqual(snapshot(app), before)

    let overwritten = await remixcn(['init', '--cwd', app, '--overwrite'])
    assert.equal(overwritten.code, 0, overwritten.stderr)
    assert.equal(JSON.parse(read(app, 'components.json')).rsc, false)
  })

  it('never replaces a changed theme without approval', async () => {
    let app = await initializedApp()
    writeFileSync(join(app, `${lib}/theme.css`), '/* my theme */\n')

    let result = await remixcn(['init', '--cwd', app])

    assert.equal(result.code, 7)
    assert.match(result.stderr, /app\/ui\/public\/lib\/theme\.css/)
    assert.equal(read(app, `${lib}/theme.css`), '/* my theme */\n')
  })
})

describe('remixcn add', () => {
  it('installs a component with its helper, tokens and license texts, rewriting imports', async () => {
    let app = await initializedApp()

    let result = await remixcn(['add', 'button', '--cwd', app])

    assert.equal(result.code, 0, result.stderr)
    assert.match(
      result.stdout,
      /✓ Created 2 files:\n {4}app\/ui\/public\/lib\/cx\.ts\n {4}app\/ui\/public\/components\/ui\/button\.tsx\n {2}3 files already up to date/,
    )
    let button = read(app, `${ui}/button.tsx`)
    assert.match(button, /^\/\/ RemixCN Button: https:\/\/janhesters\.github\.io\/remixcn\/\n/)
    assert.match(button, /import \{ cx \} from '\.\.\/\.\.\/lib\/cx\.ts'/)
    assert.equal(read(app, `${lib}/cx.ts`), read(fixture, 'registry/lib/cx.ts'))
  })

  it('changes nothing when it runs again', async () => {
    let app = await initializedApp()
    await remixcn(['add', 'button', '--cwd', app])
    let before = snapshot(app)

    let result = await remixcn(['add', 'button', '--cwd', app])

    assert.equal(result.code, 0, result.stderr)
    assert.match(result.stdout, /Nothing to change: 5 files already up to date/)
    assert.deepEqual(snapshot(app), before)
  })

  it('writes nothing with --dry-run and says what it would do', async () => {
    let app = await initializedApp()
    let before = snapshot(app)

    let result = await remixcn(['add', 'button', '--dry-run', '--cwd', app])

    assert.equal(result.code, 0, result.stderr)
    assert.match(result.stdout, /^Dry run: nothing was written\.\n• Would create 2 files:/)
    assert.deepEqual(snapshot(app), before)

    let json = JSON.parse((await remixcn(['add', 'button', '--dry-run', '--json', '--cwd', app])).stdout)
    assert.equal(json.dryRun, true)
    assert.deepEqual(json.items, ['licenses', 'cx', 'theme', 'button'])
    assert.deepEqual(
      json.files.map((file: { path: string; action: string }) => [file.path, file.action]),
      [
        [`${lib}/remixcn/LICENSE`, 'unchanged'],
        [`${lib}/remixcn/THIRD_PARTY_NOTICES.md`, 'unchanged'],
        [`${lib}/cx.ts`, 'create'],
        [`${lib}/theme.css`, 'unchanged'],
        [`${ui}/button.tsx`, 'create'],
      ],
    )
    assert.deepEqual(snapshot(app), before)
  })

  it('overwrites a changed file only with --overwrite or a yes, and writes nothing otherwise', async () => {
    let app = await initializedApp()
    mkdirSync(join(app, ui), { recursive: true })
    writeFileSync(join(app, `${lib}/cx.ts`), 'export const cx = "mine"\n')
    let before = snapshot(app)

    let refused = await remixcn(['add', 'button', '--cwd', app])
    assert.equal(refused.code, 7)
    assert.match(refused.stderr, /1 file\(s\) already exist with other content, so nothing was written/)
    assert.match(refused.stderr, /- app\/ui\/public\/lib\/cx\.ts/)
    assert.deepEqual(snapshot(app), before)

    let questions: string[] = []
    let declined = await remixcn(['add', 'button', '--cwd', app], {
      confirm: async (question) => (questions.push(question), false),
    })
    assert.equal(declined.code, 7)
    assert.match(questions[0], /app\/ui\/public\/lib\/cx\.ts\nOverwrite them\?/)
    assert.deepEqual(snapshot(app), before)

    let unasked = await remixcn(['add', 'button', '--yes', '--cwd', app], {
      confirm: async () => assert.fail('--yes never asks'),
    })
    assert.equal(unasked.code, 7)

    let approved = await remixcn(['add', 'button', '--cwd', app], { confirm: async () => true })
    assert.equal(approved.code, 0, approved.stderr)
    assert.equal(read(app, `${lib}/cx.ts`), read(fixture, 'registry/lib/cx.ts'))

    writeFileSync(join(app, `${lib}/cx.ts`), 'export const cx = "mine"\n')
    let overwritten = await remixcn(['add', 'button', '--overwrite', '--cwd', app])
    assert.equal(overwritten.code, 0, overwritten.stderr)
    assert.match(overwritten.stdout, /✓ Overwrote 1 file:\n {4}app\/ui\/public\/lib\/cx\.ts/)
  })

  it('reads names, namespaces, URLs and local paths', async () => {
    let app = await initializedApp()
    let config = JSON.parse(read(app, 'components.json'))
    config.registries['@acme'] = `${registry.url}{name}.json`
    writeFileSync(join(app, 'components.json'), JSON.stringify(config, null, 2))
    let expected = read(app, 'components.json')

    let installed: string[] = []
    for (let address of [
      'button',
      '@remixcn/button',
      '@acme/button',
      `${registry.url}button.json`,
      join(scratch, 'r/button.json'),
    ]) {
      rmSync(join(app, `${ui}/button.tsx`), { force: true })
      let result = await remixcn(['add', address, '--cwd', app])
      assert.equal(result.code, 0, `${address}: ${result.stderr}`)
      installed.push(read(app, `${ui}/button.tsx`))
    }

    assert.equal(new Set(installed).size, 1)
    assert.equal(read(app, 'components.json'), expected)

    let relativePath = await remixcn(['add', './r/button.json', '--cwd', app, '--dry-run'])
    assert.equal(relativePath.code, 0, relativePath.stderr)
  })

  it('puts the named component in --path', async () => {
    let app = await initializedApp()

    let result = await remixcn(['add', 'button', '--path', 'app/actions/public/widgets', '--cwd', app])

    assert.equal(result.code, 0, result.stderr)
    assert.match(read(app, 'app/actions/public/widgets/button.tsx'), /from '\.\.\/\.\.\/\.\.\/ui\/public\/lib\/cx\.ts'/)
  })

  it('needs components.json from remixcn init', async () => {
    let app = createApp()
    rmSync(join(app, 'components.json'))

    let result = await remixcn(['add', 'button', '--cwd', app])

    assert.equal(result.code, 3)
    assert.match(result.stderr, /No components\.json in .*Run remixcn init first/)
  })

  it('reports an unreachable registry with exit code 4 and writes nothing', async () => {
    let app = await initializedApp()
    let before = snapshot(app)

    let result = await remixcn(['add', 'button', '--cwd', app], {
      fetch: (async () => {
        throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } })
      }) as typeof globalThis.fetch,
    })

    assert.equal(result.code, 4)
    assert.match(result.stderr, /Could not reach 127\.0\.0\.1:\d+ \(ECONNREFUSED\)/)
    assert.deepEqual(snapshot(app), before)
  })

  /** Serves the fixture registry, with `items` replacing or adding payloads by name. */
  function registryWith(items: Record<string, unknown>) {
    return (async (input: string | URL | Request) => {
      let name = /\/([a-z0-9-]+)\.json$/.exec(String(input))?.[1] ?? ''
      if (name in items) {
        let body = items[name]
        if (body instanceof Response) return body
        return new Response(typeof body === 'string' ? body : JSON.stringify(body))
      }
      return fetch(input)
    }) as typeof globalThis.fetch
  }

  const payload = (name: string) => JSON.parse(readFileSync(join(scratch, `r/${name}.json`), 'utf8'))

  for (let [name, items, code, message] of [
    ['invalid JSON', () => ({ cx: '{ "name": ' }), 5, /cx\.json is not valid JSON/],
    [
      'a dependency cycle',
      () => ({ cx: { ...payload('cx'), registryDependencies: ['@remixcn/button'] } }),
      5,
      /dependency cycle: button → cx → button/,
    ],
    [
      'a target that leaves the app',
      () => ({
        cx: { ...payload('cx'), files: [{ ...payload('cx').files[0], target: '@lib/../../../../outside.ts' }] },
      }),
      6,
      /would write outside the install directories/,
    ],
    [
      'an npm dependency',
      () => ({ cx: { ...payload('cx'), dependencies: ['clsx'] } }),
      5,
      /needs the npm packages clsx/,
    ],
    [
      'Tailwind config',
      () => ({ theme: { ...payload('theme'), tailwind: { config: {} } } }),
      5,
      /tailwind is not supported/,
    ],
    ...(
      [
        [
          'an npm import',
          "import { clsx } from 'clsx'",
          /"clsx": browser-reachable source imports only remix\/component/,
        ],
        ['a Node import', "import fs from 'node:fs'", /"node:fs" is a Node built-in/],
        [
          'a relative import',
          "import { x } from './missing.ts'",
          /"\.\/missing\.ts": import registry files through #remixcn/,
        ],
        ['a hidden React import', "export const late = `${import('react')}`", /"react" brings in React/],
        [
          'a Node import after a type assertion',
          "export const initial = <unknown>{};\nimport fs from 'node:fs'",
          /"node:fs" is a Node built-in/,
        ],
      ] as const
    ).map(([name, line, message]): [string, () => Record<string, unknown>, number, RegExp] => [
      name,
      () => ({
        cx: {
          ...payload('cx'),
          files: [{ ...payload('cx').files[0], content: `${line}\n${payload('cx').files[0].content}` }],
        },
      }),
      5,
      message,
    ]),
    [
      'a Tailwind directive',
      () => ({
        theme: { ...payload('theme'), files: [{ ...payload('theme').files[0], content: '@tailwind utilities;\n' }] },
      }),
      5,
      /@tailwind is a Tailwind directive/,
    ],
    ['a missing item', () => ({ cx: new Response('', { status: 404 }) }), 5, /Nothing at .*cx\.json \(404\)/],
  ] as Array<[string, () => Record<string, unknown>, number, RegExp]>) {
    it(`refuses ${name} with exit code ${code} and writes nothing`, async () => {
      let app = await initializedApp()
      let before = snapshot(app)

      let result = await remixcn(['add', 'button', '--cwd', app], { fetch: registryWith(items()) })

      assert.equal(result.code, code, result.stderr)
      assert.match(result.stderr, message)
      assert.deepEqual(snapshot(app), before)
    })
  }

  it('refuses aliases that resolve into another project, which stays as it was', async () => {
    let app = await initializedApp()
    let other = await initializedApp()
    let packageJson = JSON.parse(read(app, 'package.json'))
    packageJson.imports['#remixcn/lib/*'] = `../${basename(other)}/${lib}/*`
    writeFileSync(join(app, 'package.json'), JSON.stringify(packageJson, null, 2))
    let before = { app: snapshot(app), other: snapshot(other) }

    let result = await remixcn(['add', 'button', '--cwd', app])

    assert.equal(result.code, 6)
    assert.match(result.stderr, /aliases\.lib "#remixcn\/lib" resolves to .*, outside the project/)
    assert.deepEqual({ app: snapshot(app), other: snapshot(other) }, before)
  })

  it('installs a helper whose import text, import method and regular expressions are no imports', async () => {
    let app = await initializedApp()
    let code = [
      'export const example = "import(\'react\')"',
      'const handlers = { import: (name: string) => name }',
      "export const label = handlers.import('labels')",
      "export function matches(value: string) { if (value) return /import('react')/.test(value) }",
    ].join('\n')
    let cx = payload('cx')
    cx.files[0].content += `${code}\n`

    let result = await remixcn(['add', 'button', '--cwd', app], { fetch: registryWith({ cx }) })

    assert.equal(result.code, 0, result.stderr)
    assert.equal(read(app, `${lib}/cx.ts`), cx.files[0].content)
  })

  it('refuses a directory that links into another project, which stays as it was', async () => {
    let app = await initializedApp()
    let other = createApp()
    mkdirSync(join(other, 'shared'), { recursive: true })
    rmSync(join(app, 'app/ui/public/components'), { recursive: true, force: true })
    symlinkSync(join(other, 'shared'), join(app, 'app/ui/public/components'))
    let before = { app: snapshot(app), other: snapshot(other) }

    let result = await remixcn(['add', 'button', '--cwd', app])

    assert.equal(result.code, 6)
    assert.match(result.stderr, /goes through a link that leaves the project/)
    assert.deepEqual({ app: snapshot(app), other: snapshot(other) }, before)
  })

  it('undoes every change when a write fails', async () => {
    let app = await initializedApp()
    let before = snapshot(app)
    let renames = 0
    let failing = {
      ...fs,
      renameSync: (from: fs.PathLike, to: fs.PathLike) => {
        if (++renames === 2) throw new Error('ENOSPC: no space left on device')
        fs.renameSync(from, to)
      },
    }

    let result = await remixcn(['add', 'button', '--cwd', app], { fs: failing })

    assert.equal(result.code, 8)
    assert.match(result.stderr, /no space left on device.*undid every change/)
    assert.deepEqual(snapshot(app), before)
  })
})

describe('remixcn list, search and view', () => {
  it('lists the items of the configured registries', async () => {
    let app = createApp()

    let result = await remixcn(['list', '--cwd', app])

    assert.equal(result.code, 0, result.stderr)
    assert.equal(
      result.stdout,
      [
        '@remixcn/button (registry:ui) - A button in the default and outline variants.',
        '@remixcn/cx (registry:lib) - Joins class names and skips empty ones.',
        "@remixcn/licenses (registry:file) - The fixture's MIT license and the license texts of the project it adapts.",
        '@remixcn/theme (registry:style) - The cascade layers and the color and radius tokens, in light and dark.',
        '',
      ].join('\n'),
    )
  })

  it('addresses the items of a registry URL or file by their own JSON, so add installs them from there', async () => {
    let app = await initializedApp()

    let url = JSON.parse((await remixcn(['search', `${registry.url}registry.json`, '-q', 'cx', '--json'])).stdout)
    assert.equal(url.items[0].addCommandArgument, `${registry.url}cx.json`)

    let file = JSON.parse((await remixcn(['search', './r/registry.json', '-q', 'cx', '--json'])).stdout)
    assert.equal(file.items[0].addCommandArgument, join(scratch, 'r/cx.json'))

    let added = await remixcn(['add', url.items[0].addCommandArgument, '--cwd', app, '--dry-run'])
    assert.equal(added.code, 0, added.stderr)
  })

  it('searches, filters and pages, as text and as JSON', async () => {
    let app = createApp()

    let search = await remixcn(['search', '-q', 'class names', '--cwd', app])
    assert.equal(search.stdout, '@remixcn/cx (registry:lib) - Joins class names and skips empty ones.\n')

    let typed = JSON.parse((await remixcn(['list', '-t', 'ui,style', '--json', '--cwd', app])).stdout)
    assert.deepEqual(
      typed.items.map((item: { name: string }) => item.name),
      ['button', 'theme'],
    )

    let paged = await remixcn(['list', '--limit', '1', '--offset', '1', '--cwd', app])
    assert.match(paged.stdout, /^@remixcn\/cx /)
    assert.match(paged.stdout, /Showing 2-2 of 4\. Pass --offset 2 for more\./)

    let json = JSON.parse((await remixcn(['search', '--query', 'button', '--json', '--cwd', app])).stdout)
    assert.deepEqual(json.pagination, { total: 1, offset: 0, limit: 100, hasMore: false })
    assert.deepEqual(json.items[0], {
      name: 'button',
      type: 'registry:ui',
      title: 'Button',
      description: 'A button in the default and outline variants.',
      registry: '@remixcn',
      addCommandArgument: '@remixcn/button',
    })

    let none = await remixcn(['search', '-q', 'calendar', '--cwd', app])
    assert.equal(none.code, 0)
    assert.equal(none.stdout, 'No items match "calendar".\n')

    let badLimit = await remixcn(['list', '--limit', 'ten', '--cwd', app])
    assert.equal(badLimit.code, 2)
  })

  it('views items as the registry serves them', async () => {
    let app = createApp()

    let result = await remixcn(['view', 'button', '@remixcn/cx', '--cwd', app])

    assert.equal(result.code, 0, result.stderr)
    assert.deepEqual(JSON.parse(result.stdout), [
      JSON.parse(read(scratch, 'r/button.json')),
      JSON.parse(read(scratch, 'r/cx.json')),
    ])

    let unknown = await remixcn(['view', '@nowhere/button', '--cwd', app])
    assert.equal(unknown.code, 5)
    assert.match(unknown.stderr, /Unknown registry @nowhere/)
  })
})

describe('remixcn build', () => {
  it('builds a registry folder and refuses a broken registry with exit code 5', async () => {
    let workspace = join(scratch, 'workspace')
    cpSync(fixture, workspace, { recursive: true })

    let built = await remixcn(['build', '--cwd', workspace, '--output', 'public/r'])
    assert.equal(built.code, 0, built.stderr)
    assert.match(built.stdout, /✓ Built 4 items: button, cx, licenses, theme/)
    for (let name of ['registry', 'button', 'cx', 'licenses', 'theme']) {
      assert.equal(read(workspace, `public/r/${name}.json`), read(scratch, `r/${name}.json`), name)
    }

    let registryJson = JSON.parse(read(workspace, 'registry.json'))
    registryJson.items[0].registryDependencies.push('@remixcn/missing')
    writeFileSync(join(workspace, 'registry.json'), JSON.stringify(registryJson))
    let broken = await remixcn(['build', join(workspace, 'registry.json'), '--output', join(workspace, 'public/r')])
    assert.equal(broken.code, 5)
    assert.match(broken.stderr, /button: depends on @remixcn\/missing, which registry\.json does not list/)
    assert.equal(relative(workspace, join(workspace, 'public/r')), 'public/r')
    assert.equal(read(workspace, 'public/r/button.json'), read(scratch, 'r/button.json'))
  })
})
