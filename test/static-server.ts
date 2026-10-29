import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'

/**
 * Serves the JSON files of `directory` under `basePath` on a free local port,
 * as a static host such as GitHub Pages serves the built registry: GET only,
 * no listings, nothing outside the directory.
 */
export async function serveRegistry(directory: string, basePath: string) {
  let server = createServer(async (request, response) => {
    let { pathname } = new URL(request.url ?? '/', 'http://localhost')
    let name = pathname.startsWith(basePath) ? pathname.slice(basePath.length) : ''

    if (request.method !== 'GET' || !/^[a-z0-9-]+\.json$/.test(name)) {
      response.writeHead(404).end()
      return
    }

    try {
      let body = await readFile(join(directory, name))
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' }).end(body)
    } catch {
      response.writeHead(404).end()
    }
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  let { port } = server.address() as AddressInfo

  return {
    url: `http://127.0.0.1:${port}${basePath}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}
