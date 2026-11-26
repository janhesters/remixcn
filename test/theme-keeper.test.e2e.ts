import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { themeStorageKey } from '../registry/lib/theme-keeper.ts'
import { createThemeKeeperPages } from './fixtures/theme-keeper/server.tsx'

type Scheme = 'light' | 'dark'

interface Sample {
  theme: string | null
  scheme: string
  background: string
}

interface ThemeRecord {
  /** The document at its first animation frame, which runs before the browser paints it. */
  first: Sample | null
  /** data-theme after each delivery of mutations, with the frame it fell in. */
  changes: Array<{ frame: number; theme: string | null }>
}

// Runs in every document before its own scripts: it samples <html> at the
// first animation frame, and logs each change of data-theme with the number
// of frames so far. Its observer is the page's first, so it sees a change
// before the keeper's observer answers it.
function recordTheme() {
  let record: ThemeRecord = { first: null, changes: [] }
  Object.assign(window, { themeRecord: record })
  let frame = 0
  let sample = (): Sample => {
    let html = document.documentElement
    let style = getComputedStyle(html)
    return { theme: html.getAttribute('data-theme'), scheme: style.colorScheme, background: style.backgroundColor }
  }
  requestAnimationFrame(function tick() {
    frame += 1
    if (frame === 1) record.first = sample()
    requestAnimationFrame(tick)
  })
  new MutationObserver(() => {
    record.changes.push({ frame, theme: document.documentElement.getAttribute('data-theme') })
  }).observe(document, { subtree: true, attributeFilter: ['data-theme'] })
}

async function open(t: TestContext, { colorScheme = 'light' as Scheme, javaScriptEnabled = true } = {}) {
  let pages = await createThemeKeeperPages()
  t.after(() => void pages.close())

  let server = await createTestServer(pages.fetch)
  let page = await t.serve(server)
  if (!javaScriptEnabled) {
    let context = await page.context().browser()!.newContext({ javaScriptEnabled: false, baseURL: server.baseUrl })
    t.after(() => context.close())
    page = await context.newPage()
  }

  let errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
  if (javaScriptEnabled) await page.addInitScript(recordTheme)
  await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
  await visit(page, '/', javaScriptEnabled)
  return { page, server, errors }
}

type Page = Awaited<ReturnType<typeof open>>['page']

async function visit(page: Page, path: string, hydrates = true) {
  await page.goto(path)
  if (hydrates) await page.locator('html[data-ready]').waitFor({ state: 'attached' })
}

function themeRecord(page: Page) {
  return page.evaluate(() => (window as unknown as { themeRecord: ThemeRecord }).themeRecord)
}

/** The background a data-theme panel of each scheme paints, which the page should match. */
function backgrounds(page: Page) {
  return page.evaluate(() => {
    let paint = (theme: string) => {
      let probe = document.createElement('div')
      probe.dataset.theme = theme
      document.body.append(probe)
      let background = getComputedStyle(probe).backgroundColor
      probe.remove()
      return background
    }
    return { light: paint('light'), dark: paint('dark') }
  })
}

/** The scheme <html> renders in, and its background. */
function current(page: Page) {
  return page.evaluate(() => {
    let style = getComputedStyle(document.documentElement)
    return {
      theme: document.documentElement.getAttribute('data-theme'),
      scheme: style.colorScheme,
      background: style.backgroundColor,
    }
  })
}

function choose(page: Page, choice: 'light' | 'dark' | 'system') {
  return page.getByLabel('Theme').selectOption(choice)
}

describe('the theme keeper', () => {
  for (let [system, saved] of [
    ['light', 'dark'],
    ['dark', 'light'],
  ] as const) {
    it(`paints a saved ${saved} choice from the first frame on a visit and a reload, with the system in ${system}`, async (t) => {
      let { page, errors } = await open(t, { colorScheme: system })
      let colors = await backgrounds(page)
      assert.notEqual(colors.light, colors.dark)
      assert.deepEqual(await current(page), { theme: null, scheme: 'light dark', background: colors[system] })

      await choose(page, saved)
      assert.deepEqual(await current(page), { theme: saved, scheme: saved, background: colors[saved] })

      await visit(page, '/')
      assert.deepEqual((await themeRecord(page)).first, { theme: saved, scheme: saved, background: colors[saved] })
      assert.equal(await page.getByLabel('Theme').inputValue(), saved)

      await page.reload()
      await page.locator('html[data-ready]').waitFor({ state: 'attached' })
      assert.deepEqual((await themeRecord(page)).first, { theme: saved, scheme: saved, background: colors[saved] })
      assert.deepEqual(errors, [])
    })
  }

  it('puts the choice back within an in-place update, before the next frame', async (t) => {
    let { page, errors } = await open(t, { colorScheme: 'light' })
    let colors = await backgrounds(page)
    await choose(page, 'dark')
    await visit(page, '/')
    await page.evaluate(() => Object.assign(window, { sameDocument: true }))
    let before = (await themeRecord(page)).changes.length

    await page.getByRole('link', { name: 'Clients' }).click()
    await page.getByRole('heading', { name: 'Clients' }).waitFor()

    assert.equal(await page.evaluate(() => 'sameDocument' in window), true, 'the link opened in place')
    let changes = (await themeRecord(page)).changes.slice(before)
    // Remix's runtime drops the attribute the server never renders; the keeper puts it back in the same frame.
    assert.ok(
      changes.some((change) => change.theme !== 'dark'),
      `the update kept data-theme itself: ${JSON.stringify(changes)}`,
    )
    changes.forEach((change, index) => {
      if (change.theme === 'dark') return
      let restored = changes.slice(index + 1).find((later) => later.theme === 'dark')
      assert.equal(restored?.frame, change.frame, `restored in frame ${change.frame}: ${JSON.stringify(changes)}`)
    })
    assert.deepEqual(await current(page), { theme: 'dark', scheme: 'dark', background: colors.dark })
    assert.deepEqual(errors, [])
  })

  it('follows the device while System is chosen', async (t) => {
    let { page, errors } = await open(t, { colorScheme: 'light' })
    let colors = await backgrounds(page)
    await choose(page, 'dark')
    await choose(page, 'system')
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), themeStorageKey), 'system')

    await page.emulateMedia({ colorScheme: 'dark' })
    assert.deepEqual(await current(page), { theme: null, scheme: 'light dark', background: colors.dark })

    await page.emulateMedia({ colorScheme: 'light' })
    assert.deepEqual(await current(page), { theme: null, scheme: 'light dark', background: colors.light })
    assert.deepEqual(errors, [])
  })

  it("follows another tab's choice, and resets to System when that tab removes it", async (t) => {
    let { page: start, server } = await open(t)
    let context = await start.context().browser()!.newContext({ baseURL: server.baseUrl })
    t.after(() => context.close())
    let page = await context.newPage()
    let other = await context.newPage()
    let errors: string[] = []
    for (let tab of [page, other]) tab.on('pageerror', (error) => errors.push(error.message))
    await visit(page, '/')
    await visit(other, '/other')

    await choose(page, 'dark')
    await other.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'dark')

    await visit(other, '/')
    await choose(other, 'light')
    await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'light')
    assert.equal(await page.getByLabel('Theme').inputValue(), 'light')

    await other.evaluate((key) => localStorage.removeItem(key), themeStorageKey)
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-theme'))
    assert.equal(await page.getByLabel('Theme').inputValue(), 'system')
    assert.deepEqual(errors, [])
  })

  it('leaves the theme to the system without JavaScript', async (t) => {
    let { page } = await open(t, { colorScheme: 'dark', javaScriptEnabled: false })
    let colors = await backgrounds(page)

    assert.deepEqual(await current(page), { theme: null, scheme: 'light dark', background: colors.dark })
    await page.emulateMedia({ colorScheme: 'light' })
    assert.deepEqual(await current(page), { theme: null, scheme: 'light dark', background: colors.light })
  })
})
