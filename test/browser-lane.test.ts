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
// suite above the frame of the file that runs next. The patched runner scrolls
// that frame into the window (patches/@remix-run%2Ftest@1.0.0.patch, PR #62),
// so both lanes share one config in Playwright's default 1280 by 720 window.
describe('browser lanes', () => {
  it('runs the browser and end-to-end tests through the shared config', () => {
    let scripts = readJson('package.json').scripts as Record<string, string>
    assert.equal(scripts['test:browser'], 'remix test --type browser')
    assert.equal(scripts['test:e2e'], 'remix test --type e2e')
    assert.equal(readJson('remix.json').test.playwright.configFile, './playwright.config.ts')
  })

  it('runs in Chromium, Firefox and WebKit', async () => {
    let config = await importConfig('playwright.config.ts')

    assert.deepEqual(
      config.projects?.map((project) => [project.name, project.use?.browserName]),
      [
        ['chromium', 'chromium'],
        ['firefox', 'firefox'],
        ['webkit', 'webkit'],
      ],
    )
  })

  it('runs in the default window', async () => {
    let config = await importConfig('playwright.config.ts')

    assert.equal(config.use?.viewport, undefined)
    for (let project of config.projects ?? []) {
      assert.equal(project.use?.viewport, undefined, `${project.name} viewport`)
    }
  })
})
