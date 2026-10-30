// Serves the site on demand, rendering each page as it's asked for, at
// http://localhost:4440/remixcn/. Run `bun run docs`. `bun run build:site`
// writes the static files GitHub Pages serves, and `bun run preview:site`
// serves those.
import * as http from 'node:http'

import { createRequestListener } from 'remix/node-fetch-server'

import { createDocsSite } from './app/router.tsx'
import { basePath } from './app/site.ts'

let port = Number(process.env.PORT ?? 4440)
let site = await createDocsSite()

http.createServer(createRequestListener(site.fetch)).listen(port, 'localhost', () => {
  process.stdout.write(`RemixCN docs: http://localhost:${port}${basePath}\n`)
})
