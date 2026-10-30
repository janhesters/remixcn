// Serves a site build as GitHub Pages does, at http://localhost:4441/remixcn/:
// GET and HEAD only, each path segment decoded, a folder's index.html, a
// redirect for a folder without its slash, 404.html for anything missing, and
// the type from the extension alone, so a module with another extension fails
// here as it would there. Run `bun run build:site`, then `bun run preview:site`.
import { readFile, stat } from 'node:fs/promises'
import * as http from 'node:http'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createRequestListener } from 'remix/node-fetch-server'

import { basePath } from './app/site.ts'
import { staticFilePath } from './static.ts'

const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
}

async function kind(path: string) {
  try {
    return (await stat(path)).isDirectory() ? 'directory' : 'file'
  } catch {
    return 'missing'
  }
}

/** A fetch handler that serves `directory` under `base`, as a static host does. */
export function createStaticSite(directory: string, base = basePath) {
  let notFound = async () =>
    new Response(await readFile(join(directory, '404.html')).catch(() => 'Not found'), {
      status: 404,
      headers: { 'Content-Type': types['.html']! },
    })

  return async (request: Request): Promise<Response> => {
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405 })

    let { pathname } = new URL(request.url)
    if (`${pathname}/` === base) return Response.redirect(new URL(base, request.url), 301)

    let path: string
    try {
      path = staticFilePath(pathname, base)
    } catch {
      return notFound()
    }

    let file = join(directory, path)
    let found = await kind(file)
    if (found === 'missing') return notFound()
    if (found === 'directory') return Response.redirect(new URL(`${pathname}/`, request.url), 301)

    let body = request.method === 'HEAD' ? null : await readFile(file)
    return new Response(body, {
      headers: { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' },
    })
  }
}

if (import.meta.main) {
  let port = Number(process.env.PORT ?? 4441)
  let directory = resolve(process.argv[2] ?? fileURLToPath(new URL('../../dist/site', import.meta.url)))

  http.createServer(createRequestListener(createStaticSite(directory))).listen(port, 'localhost', () => {
    process.stdout.write(`RemixCN site build: http://localhost:${port}${basePath}\n`)
  })
}
