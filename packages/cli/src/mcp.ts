// The protocol of remixcn mcp: newline-delimited JSON-RPC 2.0 on stdin and
// stdout. It serves modern MCP (2026-07-28: every request carries its version
// and capabilities in _meta) and legacy MCP (2025-11-25: an initialize
// handshake first), offers tools only, and checks every message and argument
// before a tool runs. Stdout carries protocol messages only; diagnostics go to
// stderr through `log`.
import { CliError } from './errors.ts'

export const modernVersion = '2026-07-28'
export const legacyVersion = '2025-11-25'

const metaKey = {
  protocolVersion: 'io.modelcontextprotocol/protocolVersion',
  clientCapabilities: 'io.modelcontextprotocol/clientCapabilities',
  clientInfo: 'io.modelcontextprotocol/clientInfo',
  serverInfo: 'io.modelcontextprotocol/serverInfo',
}

const code = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  unsupportedVersion: -32022,
}

/** How long a client may cache the discovery result and the tool list, which change only with remixcn. */
const ttlMs = 3_600_000

export interface McpLimits {
  /** The longest message the server reads, in bytes. A longer line is dropped. */
  maxLineBytes: number
  /**
   * The largest response the server sends: the whole JSON-RPC message, in
   * bytes. Leave room, a kilobyte is plenty, for an error with the longest id.
   */
  maxResultBytes: number
}

export const defaultMcpLimits: McpLimits = { maxLineBytes: 1024 * 1024, maxResultBytes: 1024 * 1024 }

/** The longest string id a request may carry, in bytes, so every response that echoes it stays small. */
export const maxIdBytes = 256

/** The part of JSON Schema 2020-12 the tools' arguments use. */
export type JsonSchema =
  | { type: 'string'; description?: string; minLength?: number; maxLength?: number }
  | { type: 'integer'; description?: string; minimum?: number; maximum?: number }
  | { type: 'array'; description?: string; items: JsonSchema; minItems?: number; maxItems?: number }
  | ObjectSchema

export interface ObjectSchema {
  type: 'object'
  description?: string
  properties: Record<string, JsonSchema>
  required?: string[]
  additionalProperties: false
}

export interface ToolAnnotations {
  readOnlyHint: boolean
  destructiveHint?: boolean
  idempotentHint?: boolean
  openWorldHint: boolean
}

export interface ToolResult {
  text: string
  isError?: boolean
}

export interface McpTool {
  name: string
  title: string
  description: string
  inputSchema: ObjectSchema
  annotations: ToolAnnotations
  /** Runs the tool with arguments that match inputSchema. The server aborts `signal` when the client cancels. */
  call: (args: Record<string, any>, signal: AbortSignal) => Promise<ToolResult>
}

export interface Implementation {
  name: string
  title?: string
  version: string
  description?: string
  websiteUrl?: string
}

export interface McpServer {
  info: Implementation
  instructions: string
  tools: McpTool[]
}

export interface ServeOptions {
  input: AsyncIterable<Uint8Array | string>
  server: McpServer
  /** Writes protocol messages, one per line. */
  write: (text: string) => void
  /** Writes diagnostics, which never reach stdout. */
  log: (text: string) => void
  limits?: Partial<McpLimits>
}

type Id = string | number
type Era = 'modern' | 'legacy'
type JsonObject = Record<string, unknown>

class ProtocolError extends Error {
  code: number
  data?: unknown

  constructor(errorCode: number, message: string, data?: unknown) {
    super(message)
    this.code = errorCode
    this.data = data
  }
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isId(value: unknown): value is Id {
  return typeof value === 'string' || Number.isSafeInteger(value)
}

function isImplementation(value: unknown) {
  return isRecord(value) && typeof value.name === 'string' && typeof value.version === 'string'
}

function describeType(schema: JsonSchema) {
  return { string: 'a string', integer: 'a whole number', array: 'a list', object: 'an object' }[schema.type]
}

/** Lists how `value` breaks `schema`, one problem per line, such as "limit: must be at least 0". */
export function checkArguments(schema: JsonSchema, value: unknown, path: string, tool: string): string[] {
  let at = path === '' ? '' : `${path}: `
  let valid =
    schema.type === 'string'
      ? typeof value === 'string'
      : schema.type === 'integer'
        ? Number.isSafeInteger(value)
        : schema.type === 'array'
          ? Array.isArray(value)
          : isRecord(value)
  if (!valid) return [`${at || 'arguments: '}must be ${describeType(schema)}`]

  switch (schema.type) {
    case 'string': {
      let text = value as string
      if (schema.minLength !== undefined && text.length < schema.minLength)
        return [`${at}must be at least ${schema.minLength} characters`]
      if (schema.maxLength !== undefined && text.length > schema.maxLength)
        return [`${at}must be at most ${schema.maxLength} characters`]
      return []
    }
    case 'integer': {
      let number = value as number
      if (schema.minimum !== undefined && number < schema.minimum) return [`${at}must be at least ${schema.minimum}`]
      if (schema.maximum !== undefined && number > schema.maximum) return [`${at}must be at most ${schema.maximum}`]
      return []
    }
    case 'array': {
      let list = value as unknown[]
      if (schema.minItems !== undefined && list.length < schema.minItems)
        return [`${at}must have at least ${schema.minItems} item${schema.minItems === 1 ? '' : 's'}`]
      if (schema.maxItems !== undefined && list.length > schema.maxItems)
        return [`${at}must have at most ${schema.maxItems} items`]
      return list.flatMap((item, index) => checkArguments(schema.items, item, `${path}[${index}]`, tool))
    }
    case 'object': {
      let object = value as JsonObject
      let prefix = path === '' ? '' : `${path}.`
      return [
        ...(schema.required ?? [])
          .filter((name) => object[name] === undefined)
          .map((name) => `${prefix}${name}: is required`),
        ...Object.keys(object)
          .filter((name) => !Object.hasOwn(schema.properties, name))
          .map((name) => `${prefix}${name}: is not an argument of ${tool}`),
        ...Object.entries(schema.properties).flatMap(([name, property]) =>
          object[name] === undefined ? [] : checkArguments(property, object[name], `${prefix}${name}`, tool),
        ),
      ]
    }
  }
}

/**
 * Untrusted text on one line: no control or direction characters, single
 * spaces, at most `max` characters. Registry text and the errors that quote it
 * pass through here, so they can't start a heading or a paragraph of their own.
 */
export function singleLine(text: string, max = 500): string {
  let clean = text
    .replace(/[\p{Cc}\u2028\u2029]/gu, ' ')
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}

/** A copy of `value` with every string at most 200 characters, for an error too large to send. */
function shorten(value: unknown): unknown {
  if (typeof value === 'string') return singleLine(value, 200)
  if (Array.isArray(value)) return value.map(shorten)
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, shorten(item)]))
  return value
}

/** A failed tool's error, whose message and details may quote registry fields, one line each. */
function describeFailure(error: unknown): string {
  if (error instanceof CliError) {
    let details = error.details.map((detail) => `- ${singleLine(detail)}`)
    return [`Error (${error.code}): ${singleLine(error.message)}`, ...details].join('\n')
  }
  return `Error: ${singleLine(error instanceof Error ? error.message : String(error))}`
}

/**
 * Splits a byte stream into lines. A line longer than `maxBytes` is never
 * buffered: the reader skips to its end and reports it with `onTooLong`.
 */
function createLineReader(maxBytes: number, onLine: (line: Buffer) => void, onTooLong: () => void) {
  let parts: Buffer[] = []
  let size = 0
  let skipping = false

  return {
    push(chunk: Buffer) {
      for (let start = 0; start < chunk.length;) {
        let end = chunk.indexOf(0x0a, start)
        let piece = chunk.subarray(start, end === -1 ? chunk.length : end)
        size += piece.length
        if (size > maxBytes) skipping = true
        if (skipping) parts = []
        else parts.push(piece)

        if (end === -1) return
        if (skipping) onTooLong()
        else onLine(Buffer.concat(parts))
        parts = []
        size = 0
        skipping = false
        start = end + 1
      }
    },
    get pending() {
      return size > 0
    },
  }
}

/**
 * Serves `options.server` until its input ends. At the end it aborts the
 * tools still running and writes nothing more.
 */
export async function serveMcp(options: ServeOptions): Promise<void> {
  let { server, log } = options
  let limits = { ...defaultMcpLimits, ...options.limits }
  let tools = new Map(server.tools.map((tool) => [tool.name, tool]))
  let running = new Map<string, AbortController>()
  let initialized = false
  let closed = false

  let decoder = new TextDecoder('utf-8', { fatal: true })
  let serverMeta = { [metaKey.serverInfo]: server.info }
  let capabilities = { tools: { listChanged: false } }

  function writeLine(line: string) {
    if (!closed) options.write(`${line}\n`)
  }

  /**
   * Sends an error. Its message and data may echo what the client sent, such
   * as a method name, so an error that would pass maxResultBytes goes out with
   * those strings shortened. Ids are at most maxIdBytes, so it then fits.
   */
  function sendError(id: Id | undefined, errorCode: number, message: string, data?: unknown) {
    let build = (text: string, detail: unknown) =>
      JSON.stringify({
        jsonrpc: '2.0',
        ...(id !== undefined && { id }),
        error: { code: errorCode, message: text, ...(detail !== undefined && { data: detail }) },
      })
    let line = build(message, data)
    if (Buffer.byteLength(line) > limits.maxResultBytes) line = build(singleLine(message, 200), shorten(data))
    writeLine(line)
  }

  function resultMessage(id: Id, era: Era, result: JsonObject) {
    return {
      jsonrpc: '2.0',
      id,
      result: era === 'modern' ? { resultType: 'complete', ...result, _meta: serverMeta } : result,
    }
  }

  function sendResult(id: Id, era: Era, result: JsonObject) {
    writeLine(JSON.stringify(resultMessage(id, era, result)))
  }

  /** Sends a tool's result, or an error result, which always fits, when the whole response would pass maxResultBytes. */
  function sendToolResult(id: Id, era: Era, result: JsonObject) {
    let line = JSON.stringify(resultMessage(id, era, result))
    if (Buffer.byteLength(line) > limits.maxResultBytes) {
      let text = `The result is larger than ${limits.maxResultBytes} bytes, the most this server sends. Ask for fewer items, a lower limit or a narrower query.`
      line = JSON.stringify(resultMessage(id, era, { content: [{ type: 'text', text }], isError: true }))
    }
    writeLine(line)
  }

  /** Says which protocol a request speaks, or throws the error that rejects it. */
  function eraOf(params: JsonObject): Era {
    let meta = params._meta
    let version = isRecord(meta) ? meta[metaKey.protocolVersion] : undefined
    if (version === undefined && initialized) return 'legacy'

    if (!isRecord(meta) || typeof version !== 'string') {
      throw new ProtocolError(
        code.invalidParams,
        `Invalid params: _meta needs ${metaKey.protocolVersion} and ${metaKey.clientCapabilities} (MCP ${modernVersion}), or the client must initialize first (MCP ${legacyVersion})`,
      )
    }
    if (version !== modernVersion) {
      throw new ProtocolError(code.unsupportedVersion, `Unsupported protocol version: ${version}`, {
        supported: [modernVersion],
        requested: version,
      })
    }
    if (!isRecord(meta[metaKey.clientCapabilities])) {
      throw new ProtocolError(
        code.invalidParams,
        `Invalid params: _meta needs ${metaKey.clientCapabilities}, an object`,
      )
    }
    if (meta[metaKey.clientInfo] !== undefined && !isImplementation(meta[metaKey.clientInfo])) {
      throw new ProtocolError(code.invalidParams, `Invalid params: ${metaKey.clientInfo} needs a name and a version`)
    }
    return 'modern'
  }

  function initialize(params: JsonObject): JsonObject {
    if (typeof params.protocolVersion !== 'string' || !isRecord(params.capabilities)) {
      throw new ProtocolError(code.invalidParams, 'Invalid params: initialize needs protocolVersion and capabilities')
    }
    if (params.clientInfo !== undefined && !isImplementation(params.clientInfo)) {
      throw new ProtocolError(code.invalidParams, 'Invalid params: clientInfo needs a name and a version')
    }
    initialized = true
    // A legacy server answers with the version it speaks; a client that can't speak it disconnects.
    return { protocolVersion: legacyVersion, capabilities, serverInfo: server.info, instructions: server.instructions }
  }

  function listTools(params: JsonObject, era: Era): JsonObject {
    if (params.cursor !== undefined) {
      throw new ProtocolError(code.invalidParams, 'Invalid params: unknown cursor. tools/list has one page')
    }
    let list = server.tools.map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: { title: tool.title, ...tool.annotations },
    }))
    return era === 'modern' ? { tools: list, ttlMs, cacheScope: 'public' } : { tools: list }
  }

  async function callTool(tool: McpTool, args: JsonObject, signal: AbortSignal): Promise<JsonObject> {
    let problems = checkArguments(tool.inputSchema, args, '', tool.name)
    let result: ToolResult
    if (problems.length > 0) {
      result = {
        text: `Invalid arguments for ${tool.name}:\n${problems.map((problem) => `- ${singleLine(problem)}`).join('\n')}`,
        isError: true,
      }
    } else {
      try {
        result = await tool.call(args, signal)
      } catch (error) {
        if (!(error instanceof CliError))
          log(`remixcn mcp: ${tool.name} failed: ${(error as Error)?.stack ?? String(error)}\n`)
        result = { text: describeFailure(error), isError: true }
      }
    }

    return { content: [{ type: 'text', text: result.text }], isError: result.isError === true }
  }

  function runTool(id: Id, key: string, era: Era, params: JsonObject) {
    if (typeof params.name !== 'string')
      throw new ProtocolError(code.invalidParams, 'Invalid params: tools/call needs a tool name')
    if (params.arguments !== undefined && !isRecord(params.arguments)) {
      throw new ProtocolError(code.invalidParams, 'Invalid params: arguments must be an object')
    }
    let tool = tools.get(params.name)
    if (tool === undefined) throw new ProtocolError(code.invalidParams, `Unknown tool: ${params.name}`)

    let controller = new AbortController()
    running.set(key, controller)
    void callTool(tool, params.arguments ?? {}, controller.signal).then((result) => {
      if (running.get(key) === controller) running.delete(key)
      if (!controller.signal.aborted) sendToolResult(id, era, result)
    })
  }

  function handleRequest(id: Id, method: string, params: JsonObject) {
    let key = `${typeof id}:${id}`
    if (running.has(key)) return sendError(id, code.invalidRequest, `Request id ${id} is already in use`)

    try {
      if (method === 'initialize') return sendResult(id, 'legacy', initialize(params))

      let era = eraOf(params)
      switch (`${era} ${method}`) {
        case 'modern server/discover':
          return sendResult(id, era, {
            supportedVersions: [modernVersion],
            capabilities,
            instructions: server.instructions,
            ttlMs,
            cacheScope: 'public',
          })
        case 'legacy ping':
          return sendResult(id, era, {})
        case 'modern tools/list':
        case 'legacy tools/list':
          return sendResult(id, era, listTools(params, era))
        case 'modern tools/call':
        case 'legacy tools/call':
          return runTool(id, key, era, params)
        default:
          throw new ProtocolError(code.methodNotFound, `Method not found: ${method}`)
      }
    } catch (error) {
      if (!(error instanceof ProtocolError)) throw error
      sendError(id, error.code, error.message, error.data)
    }
  }

  function handleNotification(method: string, params: unknown) {
    if (method !== 'notifications/cancelled' || !isRecord(params) || !isId(params.requestId)) return

    let key = `${typeof params.requestId}:${params.requestId}`
    let controller = running.get(key)
    if (controller === undefined) return
    running.delete(key)
    controller.abort()
    let reason = typeof params.reason === 'string' ? `: ${params.reason}` : ''
    log(`remixcn mcp: Cancelled request ${params.requestId}${reason}\n`)
  }

  function handleLine(line: Buffer) {
    let text: string
    let message: unknown
    try {
      text = decoder.decode(line.at(-1) === 0x0d ? line.subarray(0, -1) : line)
      if (text.trim() === '') return
      message = JSON.parse(text)
    } catch {
      log('remixcn mcp: Ignored a line that is not UTF-8 JSON\n')
      return sendError(undefined, code.parse, 'Parse error: a message must be one line of JSON')
    }

    if (!isRecord(message)) {
      return sendError(undefined, code.invalidRequest, 'Invalid request: a message must be a JSON-RPC 2.0 object')
    }
    let id = isId(message.id) && Buffer.byteLength(String(message.id)) <= maxIdBytes ? message.id : undefined

    if (!('method' in message) && ('result' in message || 'error' in message)) {
      log('remixcn mcp: Ignored a response; this server sends no requests\n')
      return
    }
    if (message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
      return sendError(id, code.invalidRequest, 'Invalid request: a message needs "jsonrpc": "2.0" and a method')
    }
    if (!('id' in message)) return handleNotification(message.method, message.params)
    if (id === undefined) {
      return sendError(
        undefined,
        code.invalidRequest,
        `Invalid request: the id must be a whole number or a string of at most ${maxIdBytes} bytes`,
      )
    }
    if (message.params !== undefined && !isRecord(message.params)) {
      return sendError(id, code.invalidParams, 'Invalid params: params must be an object')
    }
    handleRequest(id, message.method, (message.params ?? {}) as JsonObject)
  }

  let reader = createLineReader(limits.maxLineBytes, handleLine, () =>
    sendError(undefined, code.invalidRequest, `Message is longer than ${limits.maxLineBytes} bytes`),
  )

  try {
    for await (let chunk of options.input) {
      reader.push(
        typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength),
      )
    }
  } catch (error) {
    log(`remixcn mcp: Could not read the input: ${(error as Error).message}\n`)
  } finally {
    if (reader.pending) log('remixcn mcp: The input ended in the middle of a message, which was ignored\n')
    closed = true
    for (let controller of running.values()) controller.abort()
    running.clear()
  }
}
