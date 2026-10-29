// Runs remixcn mcp as an AI client does: as a child process on stdio, driven
// by the pinned MCP client SDK in each way it negotiates a protocol version,
// and by hand to check what the process writes and when it exits.
import { spawn } from 'node:child_process'
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Client } from '@modelcontextprotocol/client'
import type { ClientOptions } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import * as assert from 'remix/assert'
import { after, before, describe, it } from 'remix/test'

import { serveRegistry } from '../../../test/static-server.ts'
import { buildRegistryFolder } from './build.ts'
import { legacyVersion, modernVersion } from './mcp.ts'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const bin = fileURLToPath(new URL('./bin.ts', import.meta.url))

const toolNames = [
  'get_project_registries',
  'list_items_in_registries',
  'search_items_in_registries',
  'view_items_in_registries',
  'get_item_examples_from_registries',
  'get_add_command_for_items',
  'get_audit_checklist',
]

let scratch = ''
let app = ''
let registry: Awaited<ReturnType<typeof serveRegistry>>

before(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'remixcn-mcp-stdio-'))
  buildRegistryFolder({
    root: join(root, 'test/fixtures/registries/installable'),
    out: join(scratch, 'r'),
    remix: '3.0.0',
  })
  registry = await serveRegistry(join(scratch, 'r'), '/remixcn/r/')

  app = join(scratch, 'app')
  cpSync(join(root, 'test/fixtures/consumer-app'), app, { recursive: true })
  writeFileSync(
    join(app, 'components.json'),
    JSON.stringify({ registries: { '@remixcn': `${registry.url}{name}.json` } }),
  )
})

after(async () => {
  await registry?.close()
  rmSync(scratch, { recursive: true, force: true })
})

/** Connects the pinned MCP client to remixcn mcp in `app`, negotiating as `versionNegotiation` says. */
async function connect(versionNegotiation?: ClientOptions['versionNegotiation']) {
  let client = new Client({ name: 'remixcn-test', version: '1.0.0' }, { versionNegotiation })
  let transport = new StdioClientTransport({ command: process.execPath, args: [bin, 'mcp'], cwd: app, stderr: 'pipe' })
  await client.connect(transport)
  return client
}

async function text(client: Client, name: string, args: Record<string, unknown> = {}) {
  let result = await client.callTool({ name, arguments: args })
  assert.equal(result.isError, false, JSON.stringify(result))
  return (result.content as Array<{ type: string; text: string }>).map((part) => part.text).join('\n')
}

describe('remixcn mcp with the pinned MCP client', () => {
  it(`speaks MCP ${modernVersion} to a client pinned to it`, { timeout: 30_000 }, async () => {
    let client = await connect({ mode: { pin: modernVersion } })
    try {
      assert.equal(client.getNegotiatedProtocolVersion(), modernVersion)
      assert.equal(client.getServerVersion()?.name, 'remixcn')
      assert.match(client.getInstructions() ?? '', /untrusted data/)

      let { tools } = await client.listTools()
      assert.deepEqual(
        tools.map((tool) => tool.name),
        toolNames,
      )

      let search = await text(client, 'search_items_in_registries', { query: 'button' })
      assert.match(search, /- button \(registry:ui\) - A button in the default and outline variants\. \[@remixcn\]/)
      assert.match(search, /Add command: `npx remixcn add button`/)

      let view = await text(client, 'view_items_in_registries', { items: ['button'] })
      assert.match(view, /export function Button\(/)

      let invalid = await client.callTool({ name: 'view_items_in_registries', arguments: { items: 'button' } })
      assert.equal(invalid.isError, true)
    } finally {
      await client.close()
    }
  })

  it('finds the modern protocol when the client probes with server/discover', { timeout: 30_000 }, async () => {
    let client = await connect({ mode: 'auto' })
    try {
      assert.equal(client.getNegotiatedProtocolVersion(), modernVersion)
      assert.equal((await client.listTools()).tools.length, 7)
    } finally {
      await client.close()
    }
  })

  it(`serves a legacy client that initializes with ${legacyVersion}`, { timeout: 30_000 }, async () => {
    let client = await connect()
    try {
      assert.equal(client.getNegotiatedProtocolVersion(), legacyVersion)
      assert.equal(client.getServerVersion()?.name, 'remixcn')

      let { tools } = await client.listTools()
      assert.deepEqual(
        tools.map((tool) => tool.name),
        toolNames,
      )
      assert.match(
        await text(client, 'get_add_command_for_items', { items: ['@remixcn/button'] }),
        /^npx remixcn add button$/,
      )
      assert.match(await text(client, 'list_items_in_registries', { types: ['lib'] }), /- cx \(registry:lib\)/)
    } finally {
      await client.close()
    }
  })
})

describe('the remixcn mcp process', () => {
  it(
    'writes only protocol messages to stdout, diagnostics to stderr, and exits when its input closes',
    { timeout: 30_000 },
    async () => {
      let child = spawn(process.execPath, [bin, 'mcp'], { cwd: app, stdio: ['pipe', 'pipe', 'pipe'] })
      let stdout = ''
      let stderr = ''
      let responded = Promise.withResolvers<void>()
      child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
        stdout += chunk
        if (stdout.includes('"id":3')) responded.resolve()
      })
      child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk))
      let exited = new Promise<number | null>((resolve) => child.on('close', resolve))

      let meta = {
        'io.modelcontextprotocol/protocolVersion': modernVersion,
        'io.modelcontextprotocol/clientCapabilities': {},
      }
      child.stdin.write(
        `${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'server/discover', params: { _meta: meta } })}\n`,
      )
      child.stdin.write('this is not JSON\n')
      child.stdin.write(
        `${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: { _meta: { ...meta, 'io.modelcontextprotocol/protocolVersion': '1900-01-01' } } })}\n`,
      )
      child.stdin.write(
        `${JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { _meta: meta, name: 'list_items_in_registries', arguments: {} } })}\n`,
      )
      await responded.promise
      child.stdin.end()

      assert.equal(await exited, 0)
      let messages = stdout
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
      assert.ok(messages.every((message) => message.jsonrpc === '2.0'))
      assert.deepEqual(
        messages.map((message) => [message.id, message.error?.code]),
        [
          [1, undefined],
          [undefined, -32700],
          [2, -32022],
          [3, undefined],
        ],
      )
      assert.match(messages[3].result.content[0].text, /^Found 4 items in registries @remixcn:/)
      assert.match(stderr, /^remixcn mcp: serving RemixCN's tools for .+ on stdio/m)
      assert.match(stderr, /Ignored a line that is not UTF-8 JSON/)
    },
  )
})
