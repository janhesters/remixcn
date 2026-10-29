// Checks the built registry with the tools that consume it: a static host
// under /remixcn/r/, shadcn's pinned schema, validator, MCP server and CLI,
// and a Remix 3.0.0 app that installs a component and compiles.
import { spawn, spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as assert from 'remix/assert'
import { createAssetServer } from 'remix/assets'
import { after, before, describe, it } from 'remix/test'
import { registryItemSchema, registrySchema } from 'shadcn/schema'

import { tsc } from '../scripts/typescript.ts'
import { serveRegistry } from './static-server.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const fixture = join(root, 'test/fixtures/registries/installable')
const shadcn = join(root, 'node_modules/shadcn/dist/index.js')

/** Where the test app keeps what it installs, for each target placeholder. */
const directories: Record<string, string> = {
  '@ui/': 'app/ui/public/components/ui/',
  '@lib/': 'app/ui/public/lib/',
  '@components/': 'app/ui/public/components/',
}

interface Payload {
  name: string
  registryDependencies?: string[]
  files: Array<{ path: string; type: string; target: string; content: string }>
}

async function fetchJson(url: string) {
  let response = await fetch(url)
  assert.equal(response.status, 200, url)
  assert.match(response.headers.get('content-type') ?? '', /^application\/json/)
  return response.json()
}

function installPath(target: string) {
  let prefix = Object.keys(directories).find((key) => target.startsWith(key))
  if (!prefix) throw new Error(`no directory for ${target}`)
  return directories[prefix] + target.slice(prefix.length)
}

/**
 * Installs `name` and everything it depends on from the served registry, as
 * the remixcn installer will: each file goes to the directory of its target's
 * alias, and each #remixcn/ import becomes a relative path to the installed file.
 */
async function install(registryUrl: string, name: string, app: string) {
  let payloads = new Map<string, Payload>()

  async function collect(item: string) {
    if (payloads.has(item)) return
    let payload: Payload = await fetchJson(`${registryUrl}${item}.json`)
    payloads.set(item, payload)
    for (let dependency of payload.registryDependencies ?? []) await collect(dependency.replace(/^@remixcn\//, ''))
  }
  await collect(name)

  for (let payload of payloads.values()) {
    for (let file of payload.files) {
      let path = installPath(file.target)
      let content = file.content.replace(/(['"])#remixcn\/(ui|lib)\/([^'"]+)\1/g, (_match, quote, alias, rest) => {
        let relative = posix.relative(posix.dirname(path), installPath(`@${alias}/${rest}`))
        return `${quote}${relative.startsWith('.') ? relative : `./${relative}`}${quote}`
      })
      mkdirSync(dirname(join(app, path)), { recursive: true })
      writeFileSync(join(app, path), content)
    }
  }

  return [...payloads.keys()].sort()
}

/** Runs a Node script without blocking this process, which serves the registry it may fetch. */
function runNode(args: string[], cwd: string): Promise<{ status: number | null; output: string }> {
  return new Promise((resolve) => {
    let child = spawn(process.execPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => (output += chunk))
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => (output += chunk))
    child.on('close', (status) => resolve({ status, output }))
  })
}

function typecheck(app: string) {
  return spawnSync(process.execPath, [tsc, '--noEmit', '-p', app], { encoding: 'utf8' })
}

/** Talks to shadcn's MCP server over stdio, one JSON-RPC message per line. */
function startMcp(cwd: string) {
  let server = spawn(process.execPath, [shadcn, 'mcp'], { cwd, stdio: ['pipe', 'pipe', 'ignore'] })
  let pending = new Map<number, (message: any) => void>()
  let buffer = ''
  let id = 0

  server.stdout.setEncoding('utf8').on('data', (chunk: string) => {
    buffer += chunk
    let lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (let line of lines.filter(Boolean)) {
      let message = JSON.parse(line)
      pending.get(message.id)?.(message)
      pending.delete(message.id)
    }
  })

  function send(method: string, params?: object) {
    server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`)
  }

  function request(method: string, params: object): Promise<any> {
    return new Promise((resolve) => {
      pending.set(++id, resolve)
      server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
    })
  }

  return {
    async initialize() {
      let { result } = await request('initialize', {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'remixcn-test', version: '0.0.0' },
      })
      send('notifications/initialized')
      return result
    },
    async callTool(name: string, args: object): Promise<string> {
      let { result } = await request('tools/call', { name, arguments: args })
      assert.ok(!result.isError, result.content[0].text)
      return result.content.map((part: { text: string }) => part.text).join('\n')
    },
    close: () => server.kill(),
  }
}

describe('the built registry', () => {
  let scratch = ''
  let out = ''
  let registry: Awaited<ReturnType<typeof serveRegistry>>

  /** Copies the Remix 3.0.0 consumer fixture next to the workspace's installed packages. */
  function createApp(name: string, shadcnSetup = false) {
    let app = join(scratch, name)
    cpSync(join(root, 'test/fixtures/consumer-app'), app, { recursive: true })
    symlinkSync(join(root, 'node_modules'), join(app, 'node_modules'), 'dir')
    if (!shadcnSetup) return app

    let pkg = JSON.parse(readFileSync(join(app, 'package.json'), 'utf8'))
    pkg.imports = {
      '#remixcn/ui/*': './app/ui/public/components/ui/*',
      '#remixcn/lib/*': './app/ui/public/lib/*',
      '#remixcn/components/*': './app/ui/public/components/*',
    }
    writeFileSync(join(app, 'package.json'), JSON.stringify(pkg, null, 2))
    writeFileSync(
      join(app, 'components.json'),
      JSON.stringify({
        $schema: 'https://ui.shadcn.com/schema.json',
        style: 'remixcn',
        rsc: false,
        tsx: true,
        tailwind: { css: '', baseColor: '', cssVariables: true },
        aliases: {
          components: '#remixcn/components',
          utils: '#remixcn/lib/utils',
          ui: '#remixcn/ui',
          lib: '#remixcn/lib',
        },
        registries: { '@remixcn': `${registry.url}{name}.json` },
      }),
    )
    return app
  }

  before(async () => {
    scratch = mkdtempSync(join(tmpdir(), 'remixcn-registry-'))
    out = join(scratch, 'site/r')
    let build = spawnSync(process.execPath, ['scripts/build-registry.ts', fixture, '--out', out], {
      cwd: root,
      encoding: 'utf8',
    })
    assert.equal(build.status, 0, build.stderr)
    registry = await serveRegistry(out, '/remixcn/r/')
  })

  after(async () => {
    await registry?.close()
    rmSync(scratch, { recursive: true, force: true })
  })

  it("serves the index and each item under /remixcn/r/ in shadcn's official format", async () => {
    let index = await fetchJson(`${registry.url}registry.json`)
    assert.ok(registrySchema.safeParse(index).success)
    assert.deepEqual(
      index.items.map((item: Payload) => item.name),
      ['button', 'cx', 'licenses', 'theme'],
    )

    for (let { name } of index.items) {
      let item = await fetchJson(`${registry.url}${name}.json`)
      assert.ok(registryItemSchema.safeParse(item).success, name)
      assert.equal(item.name, name)
    }
    assert.equal((await fetch(`${registry.url}../registry.json`)).status, 404)
  })

  it("passes shadcn's registry validator, as does the workspace registry.json", { timeout: 60_000 }, () => {
    for (let workspace of [fixture, root]) {
      let result = spawnSync(process.execPath, [shadcn, 'registry', 'validate', '--cwd', workspace], {
        encoding: 'utf8',
      })

      assert.equal(result.status, 0, result.stdout + result.stderr)
      assert.match(result.stdout + result.stderr, /Registry is valid/)
    }
  })

  it("lets shadcn's MCP server list, search and view the items", { timeout: 60_000 }, async () => {
    let mcp = startMcp(createApp('mcp', true))
    try {
      assert.equal((await mcp.initialize()).serverInfo.name, 'shadcn')

      let list = await mcp.callTool('list_items_in_registries', { registries: ['@remixcn'] })
      for (let line of [
        '- button (registry:ui) - A button in the default and outline variants. [@remixcn]',
        '- cx (registry:lib) - Joins class names and skips empty ones. [@remixcn]',
        '- theme (registry:style) - The cascade layers and the color and radius tokens, in light and dark. [@remixcn]',
        '- licenses (registry:file)',
      ]) {
        assert.ok(list.includes(line), `${line}\n\n${list}`)
      }

      let search = await mcp.callTool('search_items_in_registries', { registries: ['@remixcn'], query: 'button' })
      assert.match(search, /Found 1 items matching "button"/)
      assert.match(search, /npx shadcn@latest add @remixcn\/button/)

      let view = await mcp.callTool('view_items_in_registries', { items: ['@remixcn/button'] })
      assert.match(view, /## button\n\nA button in the default and outline variants\./)
      assert.match(view, /\*\*Type:\*\* registry:ui/)
    } finally {
      mcp.close()
    }
  })

  it(
    'installs a component with its helper, tokens and license texts into a Remix app that compiles',
    { timeout: 60_000 },
    async () => {
      let app = createApp('remixcn-install')

      let installed = await install(registry.url, 'button', app)

      assert.deepEqual(installed, ['button', 'cx', 'licenses', 'theme'])
      let button = readFileSync(join(app, 'app/ui/public/components/ui/button.tsx'), 'utf8')
      assert.match(button, /^\/\/ RemixCN Button: https:\/\/janhesters\.github\.io\/remixcn\/\n/)
      assert.match(button, /import \{ cx \} from '\.\.\/\.\.\/lib\/cx\.ts'/)
      for (let [path, source] of [
        ['app/ui/public/lib/theme.css', 'registry/lib/theme.css'],
        ['app/ui/public/lib/remixcn/LICENSE', 'LICENSE'],
        ['app/ui/public/lib/remixcn/THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_NOTICES.md'],
      ]) {
        assert.equal(readFileSync(join(app, path), 'utf8'), readFileSync(join(fixture, source), 'utf8'), path)
      }

      mkdirSync(join(app, 'app/actions/public'), { recursive: true })
      writeFileSync(
        join(app, 'app/actions/public/save-button.tsx'),
        'import { Button } from \'../../ui/public/components/ui/button.tsx\'\n\nexport function SaveButton() {\n  return () => <Button label="Save" variant="outline" />\n}\n',
      )
      let result = typecheck(app)
      assert.equal(result.status, 0, result.stdout + result.stderr)

      let assets = createAssetServer({
        basePath: '/assets',
        rootDir: app,
        allowFiles: ['app/**/public/**'],
        allowPackages: ['remix'],
        watch: false,
      })
      async function compile(url: string) {
        let response = await assets.fetch(new Request(new URL(url, 'http://localhost/')))
        assert.equal(response?.status, 200, url)
        return (await response?.text()) ?? ''
      }
      try {
        let button = await compile('/assets/app/ui/public/components/ui/button.tsx')
        let helper = /from\s*["']([^"']*\/lib\/cx\.ts[^"']*)["']/.exec(button)?.[1]
        assert.ok(helper, button)
        await compile(new URL(helper, 'http://localhost/assets/app/ui/public/components/ui/').pathname)
        await compile('/assets/app/ui/public/lib/theme.css')
      } finally {
        await assets.close()
      }
    },
  )

  it(
    "installs with shadcn's CLI, which drops the license header and keeps the #remixcn/ imports",
    { timeout: 120_000 },
    async () => {
      let app = createApp('shadcn-add', true)
      let source = (path: string) => readFileSync(join(fixture, path), 'utf8')

      let result = await runNode([shadcn, 'add', '@remixcn/button', '--yes'], app)

      assert.equal(result.status, 0, result.output)
      let button = readFileSync(join(app, 'app/ui/public/components/ui/button.tsx'), 'utf8')
      let buttonSource = source('registry/ui/button.tsx')
      assert.equal(button, buttonSource.slice(buttonSource.indexOf('import ')))
      assert.equal(
        readFileSync(join(app, 'app/ui/public/lib/cx.ts'), 'utf8'),
        source('registry/lib/cx.ts').replace(/^(\/\/.*\n)+/, ''),
      )
      assert.equal(readFileSync(join(app, 'app/ui/public/lib/theme.css'), 'utf8'), source('registry/lib/theme.css'))
      assert.equal(readFileSync(join(app, 'app/ui/public/lib/remixcn/LICENSE'), 'utf8'), source('LICENSE'))
      assert.equal(
        readFileSync(join(app, 'app/ui/public/lib/remixcn/THIRD_PARTY_NOTICES.md'), 'utf8'),
        source('THIRD_PARTY_NOTICES.md'),
      )

      let strict = typecheck(app)
      assert.match(strict.stdout, /button\.tsx\(\d+,\d+\): error TS2877/)

      let tsconfig = readFileSync(join(app, 'tsconfig.json'), 'utf8')
      writeFileSync(join(app, 'tsconfig.json'), tsconfig.replace(/\s*"rewriteRelativeImportExtensions": true,/, ''))
      let relaxed = typecheck(app)
      assert.equal(relaxed.status, 0, relaxed.stdout + relaxed.stderr)
    },
  )
})
