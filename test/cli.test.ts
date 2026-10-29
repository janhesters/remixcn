// Checks the remixcn package as npm would ship it: packs packages/cli, runs
// the packed executable against a fixture registry on a local host, and
// proves that the Remix 3.0.0 app it sets up compiles and renders the component.
import { spawn, spawnSync } from 'node:child_process'
import {
  copyFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import * as assert from 'remix/assert'
import { createAssetServer } from 'remix/assets'
import { after, before, describe, it } from 'remix/test'

import { tsc } from '../scripts/typescript.ts'
import { startMcp } from './mcp-client.ts'
import { serveRegistry } from './static-server.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const cli = join(root, 'packages/cli')
const fixture = join(root, 'test/fixtures/registries/installable')
const shadcn = join(root, 'node_modules/shadcn/dist/index.js')

/** Runs a Node script without blocking this process, which serves the registry it fetches. */
function runNode(args: string[], cwd: string): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    let child = spawn(process.execPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk))
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk))
    child.on('close', (status) => resolve({ status, stdout, stderr }))
  })
}

describe('the packed remixcn executable', () => {
  let scratch = ''
  let bin = ''
  let packed: { filename: string; files: Array<{ path: string }> }
  let registry: Awaited<ReturnType<typeof serveRegistry>>

  async function remixcn(args: string[], cwd = scratch) {
    let result = await runNode([bin, ...args], cwd)
    assert.equal(result.status, 0, `remixcn ${args.join(' ')}\n${result.stdout}${result.stderr}`)
    return result
  }

  /** Copies the Remix 3.0.0 consumer fixture next to the workspace's installed packages. */
  function createApp(name: string, config: Record<string, unknown>) {
    let app = join(scratch, name)
    cpSync(join(root, 'test/fixtures/consumer-app'), app, { recursive: true })
    symlinkSync(join(root, 'node_modules'), join(app, 'node_modules'), 'dir')
    writeFileSync(
      join(app, 'components.json'),
      JSON.stringify({ registries: { '@remixcn': `${registry.url}{name}.json` }, ...config }),
    )
    return app
  }

  function typecheck(app: string) {
    let result = spawnSync(process.execPath, [tsc, '--noEmit', '-p', app], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stdout + result.stderr)
  }

  before(async () => {
    scratch = mkdtempSync(join(tmpdir(), 'remixcn-packed-'))

    // Build and pack a copy, so this test never races the build of packages/cli/dist.
    let pkg = join(scratch, 'package-source')
    mkdirSync(pkg)
    for (let file of ['package.json', 'LICENSE', 'README.md', 'components.schema.json'])
      copyFileSync(join(cli, file), join(pkg, file))
    let build = spawnSync(
      process.execPath,
      [tsc, '-p', join(cli, 'tsconfig.build.json'), '--outDir', join(pkg, 'dist')],
      { encoding: 'utf8' },
    )
    assert.equal(build.status, 0, build.stdout + build.stderr)

    let pack = spawnSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', scratch], {
      cwd: pkg,
      encoding: 'utf8',
    })
    assert.equal(pack.status, 0, pack.stderr)
    // npm 10 and 11 print a list of packages, npm 12 an object keyed by name.
    let report = JSON.parse(pack.stdout)
    packed = Array.isArray(report) ? report[0] : Object.values<typeof packed>(report)[0]
    let unpacked = join(scratch, 'unpacked')
    mkdirSync(unpacked)
    let extract = spawnSync('tar', ['-xzf', join(scratch, packed.filename), '-C', unpacked], { encoding: 'utf8' })
    assert.equal(extract.status, 0, extract.stderr)
    bin = join(unpacked, 'package/dist/bin.js')

    let out = join(scratch, 'site/r')
    let registryBuild = await runNode([bin, 'build', join(fixture, 'registry.json'), '--output', out], scratch)
    assert.equal(registryBuild.status, 0, registryBuild.stderr)
    registry = await serveRegistry(out, '/remixcn/r/')
  })

  after(async () => {
    await registry?.close()
    rmSync(scratch, { recursive: true, force: true })
  })

  it('ships runnable JavaScript, its metadata, the license and help, and no runtime dependency', async () => {
    let files = packed.files.map((file) => file.path).sort()
    assert.ok(files.includes('dist/bin.js'), files.join('\n'))
    assert.deepEqual(
      files.filter((file) => !file.startsWith('dist/')),
      ['LICENSE', 'README.md', 'components.schema.json', 'package.json'],
    )
    assert.deepEqual(
      files.filter((file) => file.startsWith('dist/') && !file.endsWith('.js')),
      [],
    )
    assert.ok(!files.some((file) => file.includes('.test.')), files.join('\n'))

    let manifest = JSON.parse(readFileSync(join(bin, '../../package.json'), 'utf8'))
    assert.equal(manifest.name, 'remixcn')
    assert.equal(manifest.license, 'MIT')
    assert.equal(manifest.type, 'module')
    assert.deepEqual(manifest.bin, { remixcn: './dist/bin.js' })
    assert.equal(manifest.engines.node, '>=24.3.0')
    assert.ok(manifest.keywords.includes('shadcn components for Remix V3'))
    for (let field of ['dependencies', 'peerDependencies', 'optionalDependencies'])
      assert.deepEqual(manifest[field] ?? {}, {}, field)
    assert.equal(readFileSync(join(bin, '../../LICENSE'), 'utf8'), readFileSync(join(root, 'LICENSE'), 'utf8'))

    let imports = readdirSync(join(bin, '..'))
      .filter((file) => file.endsWith('.js'))
      .flatMap((file) =>
        [...readFileSync(join(bin, '..', file), 'utf8').matchAll(/from '([^']+)'/g)].map((match) => match[1]),
      )
    assert.deepEqual(
      [...new Set(imports.filter((specifier) => !specifier.startsWith('./') && !specifier.startsWith('node:')))],
      [],
    )

    let help = await remixcn(['--help'])
    assert.match(help.stdout, /^Usage: remixcn <command>/)
    assert.match(help.stdout, /Exit codes:/)
    assert.equal((await remixcn(['--version'])).stdout, `${manifest.version}\n`)
  })

  it('sets up a Remix app whose installed component compiles and renders', { timeout: 120_000 }, async () => {
    let app = createApp('package-imports', {})
    let config = () => JSON.parse(readFileSync(join(app, 'components.json'), 'utf8'))

    await remixcn(['init', '--cwd', app])
    writeFileSync(
      join(app, 'components.json'),
      JSON.stringify({ ...config(), registries: { ...config().registries, '@acme': `${registry.url}{name}.json` } }),
    )
    let first = await remixcn(['add', 'button', '--cwd', app])
    assert.match(first.stdout, /✓ Created 2 files:/)

    for (let address of [
      '@remixcn/button',
      '@acme/button',
      `${registry.url}button.json`,
      join(scratch, 'site/r/button.json'),
    ]) {
      let again = await remixcn(['add', address, '--cwd', app])
      assert.match(again.stdout, /Nothing to change: 5 files already up to date/, address)
    }

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

    mkdirSync(join(app, 'app/actions'), { recursive: true })
    writeFileSync(
      join(app, 'app/actions/render.tsx'),
      'import { renderToString } from \'remix/component/server\'\n\nimport { Button } from \'../ui/public/components/ui/button.tsx\'\n\nprocess.stdout.write(await renderToString(<Button label="Save" variant="outline" />))\n',
    )
    typecheck(app)

    let rendered = await runNode(['--import', 'remix/node-tsx', 'app/actions/render.tsx'], app)
    assert.equal(rendered.status, 0, rendered.stderr)
    assert.match(rendered.stdout, /<button type="button" class="[^"]*button button-outline[^"]*">Save<\/button>/)

    let assets = createAssetServer({
      basePath: '/assets',
      rootDir: app,
      allowFiles: ['app/**/public/**'],
      allowPackages: ['remix'],
      watch: false,
    })
    try {
      for (let path of [
        'app/ui/public/components/ui/button.tsx',
        'app/ui/public/lib/cx.ts',
        'app/ui/public/lib/theme.css',
      ]) {
        let response = await assets.fetch(new Request(`http://localhost/assets/${path}`))
        assert.equal(response?.status, 200, path)
      }
    } finally {
      await assets.close()
    }
  })

  it('installs through aliases that resolve with tsconfig paths', { timeout: 120_000 }, async () => {
    let app = createApp('tsconfig-paths', {
      aliases: { ui: '~/ui/public/components/ui', lib: '~/ui/public/lib', components: '~/ui/public/components' },
    })
    let tsconfig = JSON.parse(readFileSync(join(app, 'tsconfig.json'), 'utf8'))
    tsconfig.compilerOptions.paths = { '~/*': ['./app/*'] }
    writeFileSync(join(app, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2))
    let packageJson = readFileSync(join(app, 'package.json'), 'utf8')

    await remixcn(['init', '--cwd', app])
    await remixcn(['add', 'button', '--cwd', app])

    assert.equal(readFileSync(join(app, 'package.json'), 'utf8'), packageJson)
    assert.match(
      readFileSync(join(app, 'app/ui/public/components/ui/button.tsx'), 'utf8'),
      /from '\.\.\/\.\.\/lib\/cx\.ts'/,
    )
    typecheck(app)
  })

  it(
    "serves the registries remixcn init configures through its MCP server, as shadcn's MCP server finds them",
    { timeout: 60_000 },
    async () => {
      let app = createApp('mcp', {})
      await remixcn(['init', '--cwd', app])
      let before = readdirSync(app, { recursive: true, encoding: 'utf8' }).sort()

      let client = new Client(
        { name: 'remixcn-smoke-test', version: '1.0.0' },
        { versionNegotiation: { mode: 'auto' } },
      )
      await client.connect(
        new StdioClientTransport({ command: process.execPath, args: [bin, 'mcp'], cwd: app, stderr: 'pipe' }),
      )
      try {
        assert.equal(client.getNegotiatedProtocolVersion(), '2026-07-28')
        assert.equal((await client.listTools()).tools.length, 7)

        let call = async (name: string, args: Record<string, unknown>) => {
          let result = await client.callTool({ name, arguments: args })
          assert.equal(result.isError, false, JSON.stringify(result))
          return (result.content as Array<{ text: string }>)[0].text
        }
        assert.match(await call('get_project_registries', {}), /- @remixcn\n/)
        assert.match(
          await call('list_items_in_registries', {}),
          /- button \(registry:ui\) - A button in the default and outline variants\. \[@remixcn\]\n {2}Add command: `npx remixcn add button`/,
        )
        assert.match(await call('view_items_in_registries', { items: ['button'] }), /export function Button\(/)
        assert.equal(
          await call('get_add_command_for_items', { items: ['button', '@remixcn/cx'] }),
          'npx remixcn add button cx',
        )
      } finally {
        await client.close()
      }
      assert.deepEqual(readdirSync(app, { recursive: true, encoding: 'utf8' }).sort(), before)

      let mcp = startMcp(shadcn, app)
      try {
        await mcp.initialize()
        let list = await mcp.callTool('list_items_in_registries', { registries: ['@remixcn'] })
        assert.ok(
          list.includes('- button (registry:ui) - A button in the default and outline variants. [@remixcn]'),
          list,
        )

        let search = await mcp.callTool('search_items_in_registries', {
          registries: ['@remixcn'],
          query: 'class names',
        })
        assert.match(search, /cx/)
      } finally {
        mcp.close()
      }
    },
  )
})
