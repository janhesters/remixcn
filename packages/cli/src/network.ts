// Loads registry JSON over the network or from disk, within fixed bounds: HTTPS
// only (loopback HTTP for local fixtures), a time limit, a size limit and a few
// redirects. It sends no credentials, cookies or telemetry and runs nothing.
import { readFileSync, statSync } from 'node:fs'

import { CliError } from './errors.ts'

export interface FetchLimits {
  timeoutMs: number
  maxBytes: number
  maxRedirects: number
}

export const defaultLimits: FetchLimits = { timeoutMs: 15_000, maxBytes: 5 * 1024 * 1024, maxRedirects: 5 }

export type FetchJson = (url: string) => Promise<unknown>

const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]'])

function isLoopback(url: URL) {
  return loopbackHosts.has(url.hostname)
}

/** Says why remixcn won't load `input`, or returns undefined when it may. */
export function checkRegistryUrl(input: string): string | undefined {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    return `"${input}" is not a URL`
  }

  if (url.username || url.password) return `${url.host}: the URL carries credentials, and remixcn sends none`
  if (url.protocol === 'https:' || (url.protocol === 'http:' && isLoopback(url))) return undefined
  return `${input}: registries load over HTTPS. Plain HTTP works only for localhost, 127.0.0.1 and [::1]`
}

function tooLarge(source: string, maxBytes: number) {
  return new CliError(
    'REGISTRY',
    `${source} is larger than ${maxBytes} bytes, the most remixcn reads for one registry file`,
  )
}

function parseJson(text: string, source: string): unknown {
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new CliError('REGISTRY', `${source} is not valid JSON: ${(error as Error).message}`)
  }
}

async function readBody(response: Response, url: string, maxBytes: number) {
  if (Number(response.headers.get('content-length')) > maxBytes) throw tooLarge(url, maxBytes)

  let chunks: Uint8Array[] = []
  let size = 0
  let reader = response.body?.getReader()
  while (reader) {
    let { done, value } = await reader.read()
    if (done || value === undefined) break
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel()
      throw tooLarge(url, maxBytes)
    }
    chunks.push(value)
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))
  } catch {
    throw new CliError('REGISTRY', `${url} is not UTF-8 text`)
  }
}

function networkError(error: unknown, url: string, timeoutMs: number) {
  if (error instanceof CliError) return error
  if (error instanceof Error && error.name === 'TimeoutError') {
    return new CliError(
      'NETWORK',
      `${url} did not answer within ${timeoutMs / 1000} s. Try again, or check the registry URL.`,
    )
  }

  let cause = (error as { cause?: { code?: string; message?: string } })?.cause
  let reason = cause?.code ?? cause?.message ?? (error as Error)?.message ?? String(error)
  return new CliError(
    'NETWORK',
    `Could not reach ${new URL(url).host} (${reason}). Check your connection and the registry URL in components.json.`,
  )
}

/**
 * Creates the function that loads one registry JSON document. Each redirect
 * goes through the same URL check, and no redirect leads from a remote host to
 * the local machine.
 */
export function createFetcher(options: {
  fetch?: typeof globalThis.fetch
  userAgent: string
  limits?: Partial<FetchLimits>
}): FetchJson {
  let fetch = options.fetch ?? globalThis.fetch
  let limits = { ...defaultLimits, ...options.limits }

  return async function fetchJson(input: string) {
    let problem = checkRegistryUrl(input)
    if (problem) throw new CliError('REGISTRY', problem)

    let signal = AbortSignal.timeout(limits.timeoutMs)
    let url = input

    try {
      for (let redirects = 0; ; redirects++) {
        let response = await fetch(url, {
          method: 'GET',
          redirect: 'manual',
          signal,
          headers: { accept: 'application/json', 'user-agent': options.userAgent },
        })

        let location = response.headers.get('location')
        if (response.status >= 300 && response.status < 400 && location) {
          if (redirects >= limits.maxRedirects) {
            throw new CliError('NETWORK', `${input} led through more than ${limits.maxRedirects} redirects`)
          }
          let next = new URL(location, url)
          let nextProblem = checkRegistryUrl(next.href)
          if (nextProblem)
            throw new CliError(
              'REGISTRY',
              `${url} redirects to ${next.href}, which remixcn won't follow: ${nextProblem}`,
            )
          if (isLoopback(next) && !isLoopback(new URL(url))) {
            throw new CliError(
              'REGISTRY',
              `${url} redirects to ${next.href} on the local machine, which remixcn won't follow`,
            )
          }
          url = next.href
          continue
        }

        if (response.status === 404 || response.status === 410) {
          throw new CliError(
            'REGISTRY',
            `Nothing at ${url} (${response.status}). Check the item name and the registry URL.`,
          )
        }
        if (!response.ok) {
          throw new CliError(
            'NETWORK',
            `${url} answered ${response.status} ${response.statusText}`.trimEnd() +
              '. Try again later, or check the registry URL.',
          )
        }

        return parseJson(await readBody(response, url, limits.maxBytes), url)
      }
    } catch (error) {
      throw networkError(error, url, limits.timeoutMs)
    }
  }
}

/** Reads a registry JSON document from a local path, within the same size limit. */
export function readJsonFile(path: string, maxBytes = defaultLimits.maxBytes): unknown {
  let stats
  try {
    stats = statSync(path)
  } catch {
    throw new CliError('REGISTRY', `No file at ${path}`)
  }
  if (!stats.isFile()) throw new CliError('REGISTRY', `${path} is not a file`)
  if (stats.size > maxBytes) throw tooLarge(path, maxBytes)

  return parseJson(readFileSync(path, 'utf8'), path)
}
