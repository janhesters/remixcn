import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

const root = fileURLToPath(new URL('..', import.meta.url))

interface PlaywrightConfig {
  projects?: Array<{ name: string; use?: Record<string, unknown> }>
  use?: { viewport?: { width: number; height: number }; [option: string]: unknown }
}

function readJson(file: string) {
  return JSON.parse(readFileSync(`${root}/${file}`, 'utf8'))
}

async function importConfig(file: string): Promise<PlaywrightConfig> {
  let module = (await import(pathToFileURL(`${root}/${file}`).href)) as { default: PlaywrightConfig }
  return module.default
}

// remix test's browser runner lists a row for every finished test file and
// suite above the frame of the file that runs next. In Playwright's default
// 1280 by 720 window the later frames end up below the window, where WebKit
// throttles their animation frames until the lane stalls at its 90-second
// progress timeout (PR #46, CI run 57). The browser lane keeps them in view.
describe('browser lane', () => {
  it('runs the component tests in a tall window, with every other setting of the shared config', async () => {
    let scripts = readJson('package.json').scripts as Record<string, string>
    assert.equal(scripts['test:browser'], 'remix test --type browser --playwrightConfig ./playwright.browser.config.ts')
    assert.equal(scripts['test:e2e'], 'remix test --type e2e')
    assert.equal(readJson('remix.json').test.playwright.configFile, './playwright.config.ts')

    let base = await importConfig('playwright.config.ts')
    let tall = await importConfig('playwright.browser.config.ts')
    let { viewport, ...use } = tall.use ?? {}
    assert.deepEqual(tall.projects, base.projects)
    assert.deepEqual(use, base.use)
    assert.equal(viewport?.width, 1280)
    assert.ok((viewport?.height ?? 0) >= 4000, `viewport height ${viewport?.height}`)
  })

  it('leaves the end-to-end tests in the default window', async () => {
    let base = await importConfig('playwright.config.ts')

    assert.equal(base.use?.viewport, undefined)
  })
})
