import { spawn } from 'node:child_process'

import * as assert from 'remix/assert'

/** Talks to shadcn's MCP server over stdio, one JSON-RPC message per line. */
export function startMcp(shadcn: string, cwd: string) {
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
    async listTools(): Promise<any[]> {
      let { result } = await request('tools/list', {})
      return result.tools
    },
    async callTool(name: string, args: object): Promise<string> {
      let { result } = await request('tools/call', { name, arguments: args })
      assert.ok(!result.isError, result.content[0].text)
      return result.content.map((part: { text: string }) => part.text).join('\n')
    },
    close: () => server.kill(),
  }
}
