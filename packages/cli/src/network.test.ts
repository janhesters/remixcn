import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { CliError } from './errors.ts'
import { checkRegistryUrl, createFetcher, readJsonFile } from './network.ts'

type Answer = (url: string, init: RequestInit) => Response | Promise<Response>

/** A fetch that answers from `answer` and records each URL it was asked for. */
function fakeFetch(answer: Answer) {
  let requests: Array<{ url: string; init: RequestInit }> = []
  let fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    let url = String(input)
    requests.push({ url, init })
    return answer(url, init)
  }) as typeof globalThis.fetch
  return { fetch, requests }
}

function json(value: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' }, ...init })
}

async function rejection(promise: Promise<unknown>): Promise<CliError> {
  try {
    await promise
  } catch (error) {
    assert.ok(error instanceof CliError, String(error))
    return error
  }
  throw new Error('expected the promise to reject')
}

describe('checkRegistryUrl', () => {
  it('accepts HTTPS and loopback HTTP', () => {
    for (let url of [
      'https://janhesters.github.io/remixcn/r/button.json',
      'http://localhost:4000/r/button.json',
      'http://127.0.0.1:4000/r/button.json',
      'http://[::1]:4000/r/button.json',
    ]) {
      assert.equal(checkRegistryUrl(url), undefined, url)
    }
  })

  it('rejects plain HTTP to other hosts, other schemes and credentials', () => {
    assert.match(checkRegistryUrl('http://example.com/r/button.json') ?? '', /HTTPS/)
    assert.match(checkRegistryUrl('http://10.0.0.1/r/button.json') ?? '', /HTTPS/)
    assert.match(checkRegistryUrl('file:///etc/passwd') ?? '', /HTTPS/)
    assert.match(checkRegistryUrl('https://user:secret@example.com/r.json') ?? '', /credentials/)
    assert.match(checkRegistryUrl('not a url') ?? '', /not a URL/)
  })
})

describe('createFetcher', () => {
  it('returns the parsed JSON and identifies itself without sending anything else', async () => {
    let { fetch, requests } = fakeFetch(() => json({ name: 'button' }))
    let fetchJson = createFetcher({ fetch, userAgent: 'remixcn/1.2.3' })

    assert.deepEqual(await fetchJson('https://example.com/r/button.json'), { name: 'button' })
    assert.equal(requests.length, 1)
    let headers = new Headers(requests[0].init.headers)
    assert.equal(headers.get('user-agent'), 'remixcn/1.2.3')
    assert.equal(requests[0].init.method ?? 'GET', 'GET')
    assert.equal(requests[0].init.redirect, 'manual')
  })

  it('refuses a URL it may not load before asking the network', async () => {
    let { fetch, requests } = fakeFetch(() => json({}))
    let fetchJson = createFetcher({ fetch, userAgent: 'remixcn' })

    let error = await rejection(fetchJson('http://example.com/r/button.json'))

    assert.equal(error.code, 'REGISTRY')
    assert.equal(requests.length, 0)
  })

  it('follows a few redirects, each checked like the first URL', async () => {
    let { fetch, requests } = fakeFetch((url) =>
      url.endsWith('/old.json')
        ? new Response(null, { status: 301, headers: { location: '/new.json' } })
        : json({ name: 'moved' }),
    )
    let fetchJson = createFetcher({ fetch, userAgent: 'remixcn' })

    assert.deepEqual(await fetchJson('https://example.com/old.json'), { name: 'moved' })
    assert.deepEqual(
      requests.map((request) => request.url),
      ['https://example.com/old.json', 'https://example.com/new.json'],
    )
  })

  it('stops at a redirect loop, a downgrade to HTTP and a jump to the local machine', async () => {
    let loop = createFetcher({
      fetch: fakeFetch(() => new Response(null, { status: 302, headers: { location: '/again.json' } })).fetch,
      userAgent: 'remixcn',
      limits: { maxRedirects: 3 },
    })
    let looped = await rejection(loop('https://example.com/again.json'))
    assert.equal(looped.code, 'NETWORK')
    assert.match(looped.message, /more than 3 redirects/)

    let downgrade = createFetcher({
      fetch: fakeFetch(() => new Response(null, { status: 302, headers: { location: 'http://example.com/r.json' } }))
        .fetch,
      userAgent: 'remixcn',
    })
    assert.match((await rejection(downgrade('https://example.com/r.json'))).message, /HTTPS/)

    let local = createFetcher({
      fetch: fakeFetch(() => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1:9/r.json' } }))
        .fetch,
      userAgent: 'remixcn',
    })
    assert.match((await rejection(local('https://example.com/r.json'))).message, /local machine/)
  })

  it('reports a missing item as a registry problem and a failing server as a network problem', async () => {
    let missing = createFetcher({
      fetch: fakeFetch(() => new Response('', { status: 404 })).fetch,
      userAgent: 'remixcn',
    })
    let notFound = await rejection(missing('https://example.com/r/nope.json'))
    assert.equal(notFound.code, 'REGISTRY')
    assert.match(notFound.message, /Nothing at https:\/\/example\.com\/r\/nope\.json \(404\)/)

    let broken = createFetcher({
      fetch: fakeFetch(() => new Response('', { status: 503 })).fetch,
      userAgent: 'remixcn',
    })
    let unavailable = await rejection(broken('https://example.com/r/button.json'))
    assert.equal(unavailable.code, 'NETWORK')
    assert.match(unavailable.message, /answered 503/)
  })

  it('turns an unreachable host and a timeout into actionable network errors', async () => {
    let offline = createFetcher({
      fetch: (async () => {
        throw new TypeError('fetch failed', {
          cause: Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' }),
        })
      }) as typeof globalThis.fetch,
      userAgent: 'remixcn',
    })
    let unreachable = await rejection(offline('https://registry.invalid/r/button.json'))
    assert.equal(unreachable.code, 'NETWORK')
    assert.match(unreachable.message, /Could not reach registry\.invalid \(ENOTFOUND\)/)
    assert.match(unreachable.message, /connection/)

    let slow = createFetcher({
      // An open request keeps the process alive, as a real socket would.
      fetch: ((_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          let pending = setTimeout(() => {}, 10_000)
          init.signal?.addEventListener('abort', () => {
            clearTimeout(pending)
            reject(init.signal?.reason)
          })
        })) as typeof globalThis.fetch,
      userAgent: 'remixcn',
      limits: { timeoutMs: 20 },
    })
    let timedOut = await rejection(slow('https://example.com/r/button.json'))
    assert.equal(timedOut.code, 'NETWORK')
    assert.match(timedOut.message, /did not answer within 0\.02 s/)
  })

  it('stops reading a response larger than the limit', async () => {
    let fetchJson = createFetcher({
      fetch: fakeFetch(() => new Response(JSON.stringify({ content: 'x'.repeat(2000) }))).fetch,
      userAgent: 'remixcn',
      limits: { maxBytes: 1000 },
    })

    let error = await rejection(fetchJson('https://example.com/r/huge.json'))

    assert.equal(error.code, 'REGISTRY')
    assert.match(error.message, /larger than 1000 bytes/)
  })

  it('rejects a body that is not JSON', async () => {
    let fetchJson = createFetcher({ fetch: fakeFetch(() => new Response('<html>')).fetch, userAgent: 'remixcn' })

    let error = await rejection(fetchJson('https://example.com/r/button.json'))

    assert.equal(error.code, 'REGISTRY')
    assert.match(error.message, /is not valid JSON/)
  })
})

describe('readJsonFile', () => {
  it('reads a local item and rejects a missing, oversized or invalid one', async () => {
    let directory = mkdtempSync(join(tmpdir(), 'remixcn-network-'))
    try {
      writeFileSync(join(directory, 'button.json'), '{"name":"button"}')
      writeFileSync(join(directory, 'broken.json'), '{"name":')
      writeFileSync(join(directory, 'huge.json'), JSON.stringify({ content: 'x'.repeat(2000) }))

      assert.deepEqual(readJsonFile(join(directory, 'button.json')), { name: 'button' })
      assert.match(
        (await rejection(Promise.resolve().then(() => readJsonFile(join(directory, 'nope.json'))))).message,
        /No file at/,
      )
      assert.match(
        (await rejection(Promise.resolve().then(() => readJsonFile(join(directory, 'broken.json'))))).message,
        /not valid JSON/,
      )
      assert.match(
        (await rejection(Promise.resolve().then(() => readJsonFile(join(directory, 'huge.json'), 1000)))).message,
        /larger than 1000 bytes/,
      )
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
