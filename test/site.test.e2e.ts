import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { afterAll, beforeAll, describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { pages } from '../apps/docs/app/pages.ts'
import { href, repository } from '../apps/docs/app/site.ts'
import { readExample } from '../apps/docs/app/source.ts'
import { buildSite } from '../apps/docs/build.ts'
import { createStaticSite } from '../apps/docs/preview.ts'
import { findAccessibilityViolations } from './accessibility.ts'
import { suppressValidationMessages } from './validation.ts'

// Every test reads the static build, served as GitHub Pages serves it, so a
// module the build left out or named wrong fails here as it would there.
let site = ''

beforeAll(
  async () => {
    site = mkdtempSync(join(tmpdir(), 'remixcn-site-'))
    await buildSite(site)
  },
  { timeout: 60_000 },
)

afterAll(() => rmSync(site, { recursive: true, force: true }))

type Clipboard = 'resolve' | 'reject'

interface OpenOptions {
  width?: number
  javaScript?: boolean
  clipboard?: Clipboard
  colorScheme?: 'light' | 'dark'
  reducedMotion?: 'reduce' | 'no-preference'
  /** A glob of the scripts that never load. The page then isn't waited on to hydrate. */
  block?: string
}

async function open(
  t: TestContext,
  path: string,
  {
    width = 1280,
    javaScript = true,
    clipboard = 'resolve',
    colorScheme = 'light',
    reducedMotion = 'reduce',
    block,
  }: OpenOptions = {},
) {
  let server = await createTestServer(createStaticSite(site))
  let page = await t.serve(server)
  if (!javaScript) {
    let context = await page.context().browser()!.newContext({ javaScriptEnabled: false, baseURL: server.baseUrl })
    t.after(() => context.close())
    page = await context.newPage()
  }
  await page.setViewportSize({ width, height: 800 })
  await page.emulateMedia({ colorScheme, reducedMotion })

  if (block) await page.route(block, (route) => route.abort())

  // Requests that fail and errors the page throws, apart from a 404 page itself.
  let problems: string[] = []
  page.on('response', (response) => {
    if (response.status() >= 400 && response.request().resourceType() !== 'document') {
      problems.push(`${response.status()} ${response.url()}`)
    }
  })
  page.on('pageerror', (error) => problems.push(error.message))

  await page.addInitScript((answer) => {
    let writes: string[] = []
    Object.assign(window, { clipboardWrites: writes })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        async writeText(text: string) {
          writes.push(text)
          if (answer === 'reject') throw new DOMException('Write permission denied.', 'NotAllowedError')
        },
      },
    })
  }, clipboard)

  // Every request to leave the site, such as an example's form or link going to its app's route.
  let departures: string[] = []
  page.on('request', (request) => {
    let { pathname } = new URL(request.url())
    if (!pathname.startsWith(href())) departures.push(`${request.method()} ${pathname}`)
  })

  await page.goto(path)
  if (javaScript && !block) await page.locator('html[data-ready]').waitFor({ state: 'attached' })
  return { page, problems, departures }
}

type Page = Awaited<ReturnType<typeof open>>['page']

function heading(page: Page) {
  return page.getByRole('heading', { level: 1 })
}

function example(page: Page, name: string) {
  return page.locator(`[data-docs-example="${name}"]`)
}

function exampleStatus(page: Page, name: string) {
  return example(page, name).locator('[data-docs-example-status]')
}

async function waitForText(locator: ReturnType<Page['locator']>, text: string | RegExp) {
  await locator.filter({ hasText: text }).first().waitFor()
}

const button = href('docs/components/button/')
const home = href()

describe('the static site', () => {
  for (let page of pages) {
    let url = href(page.path)

    it(`loads ${url} directly, with every module it asks for`, async (t) => {
      let opened = await open(t, url)

      assert.equal(await heading(opened.page).textContent(), page.title)
      assert.deepEqual(opened.problems, [])
      if (page.path !== '') {
        let current = opened.page.locator('#docs-navigation [aria-current="page"]')
        assert.equal(await current.getAttribute('href'), url)
      }
    })
  }

  it('redirects a page without its slash, and shows the not-found page with the chrome for a missing one', async (t) => {
    let { page, problems } = await open(t, '/remixcn/docs/components/button')
    assert.equal(new URL(page.url()).pathname, button)

    await page.goto('/remixcn/docs/missing/')
    await page.locator('html[data-ready]').waitFor({ state: 'attached' })
    assert.equal(await heading(page).textContent(), 'Page not found')
    await page.getByRole('button', { name: /Search the docs/ }).waitFor()
    assert.deepEqual(problems, [])
  })

  it('opens a page from the navigation, and its examples run there', async (t) => {
    let { page, problems } = await open(t, href('docs/'), { clipboard: 'resolve' })

    await page.locator('#docs-navigation').getByRole('link', { name: 'Button' }).click()
    await waitForText(heading(page), 'Button')
    assert.equal(new URL(page.url()).pathname, button)
    assert.equal(await page.locator('#docs-navigation [aria-current="page"]').getAttribute('href'), button)

    let copy = example(page, 'ButtonForm').getByRole('button', { name: 'Copy the ButtonForm source' })
    await copy.click()
    await waitForText(example(page, 'ButtonForm').getByRole('status'), 'Copied the ButtonForm source')
    await example(page, 'ButtonForm').getByRole('button', { name: 'Send reminder' }).click()
    await waitForText(exampleStatus(page, 'ButtonForm'), 'intent=send')
    assert.equal(new URL(page.url()).pathname, button)
    assert.deepEqual(problems, [])
  })

  it('keeps the examples running when the page opens itself in place again', async (t) => {
    let { page, departures } = await open(t, button)

    await page.locator('#docs-navigation').getByRole('link', { name: 'Button' }).click()
    await page.waitForURL((url) => url.pathname === button)
    await example(page, 'ButtonForm').getByRole('button', { name: 'Send reminder' }).click()
    await waitForText(exampleStatus(page, 'ButtonForm'), 'intent=send')
    await example(page, 'ButtonAsLink').getByRole('link', { name: 'View invoices' }).click()
    await waitForText(exampleStatus(page, 'ButtonAsLink'), 'It goes to #invoices.')
    assert.equal(new URL(page.url()).pathname, button)
    assert.deepEqual(departures, [])
  })
})

/** Clicks the middle of an element with the real mouse, as a reader would, whatever covers it or keeps it from events. */
async function clickWithMouse(page: Page, locator: ReturnType<Page['locator']>) {
  await locator.scrollIntoViewIfNeeded({ timeout: 5_000 })
  let box = await locator.boundingBox()
  assert.ok(box, 'the element shows')
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
}

/**
 * Clicks an example's submit button and link with the mouse, then opens
 * another page from the navigation. A form or link that got through would
 * have left the site before that page opened.
 */
async function assertExamplesStayStill(page: Page, departures: string[]) {
  let form = example(page, 'ButtonForm')
  await clickWithMouse(page, form.getByRole('button', { name: 'Send reminder' }))
  await clickWithMouse(page, form.getByRole('button', { name: 'Save draft' }))
  await clickWithMouse(page, example(page, 'ButtonAsLink').getByRole('link', { name: 'View invoices' }))

  await page.locator('#docs-navigation').getByRole('link', { name: 'CLI' }).click()
  await waitForText(heading(page), 'CLI')
  assert.equal(new URL(page.url()).pathname, href('docs/cli/'))
  assert.deepEqual(departures, [])
}

describe('keyboard', () => {
  it('starts with skip links to the content and the navigation', async (t) => {
    let { page } = await open(t, button)

    await page.keyboard.press('Tab')
    let skip = page.getByRole('link', { name: 'Skip to content' })
    assert.ok(await skip.evaluate((link) => link === document.activeElement))
    assert.ok(((await skip.boundingBox())?.width ?? 0) > 50, 'the focused skip link shows')
    await page.keyboard.press('Enter')
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'main-content')

    await page.getByRole('link', { name: 'Skip to navigation' }).focus()
    await page.keyboard.press('Enter')
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'docs-navigation')
  })

  it('opens the search with Ctrl+K, finds a page as you type, and opens it with Enter', async (t) => {
    let { page } = await open(t, href('docs/'))

    await page.keyboard.press('Control+k')
    let search = page.getByRole('dialog', { name: 'Search the docs' })
    await search.waitFor()
    await page.keyboard.type('butt')
    await waitForText(search.getByRole('option', { selected: true }), 'Button')
    await page.keyboard.press('Enter')

    await waitForText(heading(page), 'Button')
    assert.equal(new URL(page.url()).pathname, button)
    assert.equal(await search.isVisible(), false)
  })

  it('leaves Ctrl+K to an example and a text field', async (t) => {
    let { page } = await open(t, button)

    await example(page, 'ButtonForm').getByLabel('Billing email').focus()
    await page.keyboard.press('Control+k')
    assert.equal(await page.getByRole('dialog', { name: 'Search the docs' }).isVisible(), false)
  })

  it('says when the search finds nothing, and closes with Escape back on its button', async (t) => {
    let { page } = await open(t, button)

    let trigger = page.getByRole('button', { name: /Search the docs/ })
    await trigger.click()
    await page.keyboard.type('zzzz')
    await waitForText(page.getByRole('status'), 'No page matches.')
    await page.keyboard.press('Escape')

    await page.getByRole('dialog', { name: 'Search the docs' }).waitFor({ state: 'hidden' })
    assert.ok(await trigger.evaluate((element) => element === document.activeElement))
  })
})

describe('the theme', () => {
  it('follows the system until the reader picks one, and keeps the pick across pages and visits', async (t) => {
    let { page } = await open(t, button, { colorScheme: 'dark' })
    // The color light-dark() picks on the page tells which scheme it renders in.
    let scheme = () =>
      page.evaluate(() => {
        let probe = document.createElement('span')
        probe.style.color = 'light-dark(rgb(0, 0, 1), rgb(0, 0, 2))'
        document.body.append(probe)
        let color = getComputedStyle(probe).color
        probe.remove()
        return color === 'rgb(0, 0, 1)' ? 'light' : 'dark'
      })

    assert.equal(await scheme(), 'dark')
    assert.ok(await page.getByRole('radio', { name: 'System' }).isChecked())

    await page.getByRole('radio', { name: 'Light' }).check()
    assert.equal(await scheme(), 'light')

    await page.locator('#docs-navigation').getByRole('link', { name: 'CLI' }).click()
    await waitForText(heading(page), 'CLI')
    assert.equal(await page.getAttribute('html', 'data-theme'), 'light')
    assert.ok(await page.getByRole('radio', { name: 'Light' }).isChecked())

    await page.reload()
    assert.equal(await page.getAttribute('html', 'data-theme'), 'light')
    await page.locator('html[data-ready]').waitFor({ state: 'attached' })
    assert.ok(await page.getByRole('radio', { name: 'Light' }).isChecked())

    await page.getByRole('radio', { name: 'System' }).check()
    assert.equal(await page.getAttribute('html', 'data-theme'), null)
    assert.equal(await scheme(), 'dark')
  })
})

describe('the narrow layout', () => {
  it('opens the navigation in a menu that marks the current page, and closes it on a link', async (t) => {
    let { page, problems } = await open(t, button, { width: 390 })

    let trigger = page.getByRole('button', { name: 'Toggle Sidebar' })
    await trigger.click()
    let menu = page.getByRole('dialog', { name: 'Sidebar' })
    await menu.waitFor()
    assert.equal(await menu.locator('[aria-current="page"]').getAttribute('href'), button)

    await page.keyboard.press('Escape')
    await menu.waitFor({ state: 'hidden' })
    assert.ok(await trigger.evaluate((element) => element === document.activeElement))

    await trigger.click()
    await menu.getByRole('link', { name: 'Registry' }).click()
    await waitForText(heading(page), 'Registry')
    await menu.waitFor({ state: 'hidden' })
    assert.deepEqual(problems, [])
  })

  for (let page of pages) {
    let url = href(page.path)

    it(`reflows ${url} to 320px without scrolling sideways, also with text at 200%`, async (t) => {
      let opened = await open(t, url, { width: 320 })

      for (let fontSize of ['', '32px']) {
        await opened.page.evaluate((size) => (document.documentElement.style.fontSize = size), fontSize)
        let width = await opened.page.evaluate(() => document.documentElement.scrollWidth)
        assert.equal(width, 320, `${url} at ${fontSize || 'the default size'}`)
      }
    })
  }
})

describe('the examples', () => {
  it('keep their forms and links on the page and never touch each other', async (t) => {
    let { page } = await open(t, button)
    let path = new URL(page.url()).href

    await example(page, 'ButtonLoading').getByRole('button', { name: 'Save template' }).click()
    await waitForText(example(page, 'ButtonLoading').getByRole('status').first(), 'Template saved.')

    let form = example(page, 'ButtonForm')
    let email = form.getByLabel('Billing email')
    await email.fill('ops@acme.example')
    await form.getByRole('button', { name: 'Send reminder' }).click()
    await waitForText(exampleStatus(page, 'ButtonForm'), 'email=ops@acme.example, intent=send')
    assert.equal(page.url(), path)

    await form.getByRole('button', { name: 'Reset' }).click()
    assert.equal(await email.inputValue(), 'billing@acme.example')
    assert.match((await example(page, 'ButtonLoading').textContent()) ?? '', /Template saved\./)

    await example(page, 'ButtonAsLink').getByRole('link', { name: 'View invoices' }).click()
    await waitForText(exampleStatus(page, 'ButtonAsLink'), 'It goes to #invoices.')
    assert.equal(page.url(), path)
  })

  it('show their source as text, exactly as the copy button copies it', async (t) => {
    let { page } = await open(t, button)
    let code = readExample('registry/examples/button-example.tsx', 'ButtonForm')

    let source = example(page, 'ButtonForm').locator('[data-docs-source] pre')
    assert.equal(await source.evaluate((pre) => pre.textContent), code)
    assert.equal(await page.locator('form').count(), 1, 'the <form> in the source stays text')

    await example(page, 'ButtonForm').getByRole('button', { name: 'Copy the ButtonForm source' }).click()
    await waitForText(example(page, 'ButtonForm').getByRole('status'), 'Copied the ButtonForm source')
    assert.deepEqual(await page.evaluate(() => (window as unknown as { clipboardWrites: string[] }).clipboardWrites), [
      code,
    ])
  })

  it('say when the browser refuses a copy', async (t) => {
    let { page } = await open(t, button, { clipboard: 'reject' })

    await page.getByRole('button', { name: 'Copy the install command' }).click()
    await waitForText(page.getByRole('status'), "Couldn't copy the install command")
  })
})

describe('without JavaScript', () => {
  for (let width of [1280, 390]) {
    it(`shows the navigation at ${width}px and opens pages through it`, async (t) => {
      let { page } = await open(t, button, { width, javaScript: false })

      assert.equal(await page.getByRole('button', { name: /Search the docs/ }).isVisible(), false)
      assert.equal(await page.getByRole('radiogroup', { name: 'Theme' }).isVisible(), false)
      assert.equal(await page.getByText('npx remixcn add button').first().isVisible(), true)

      await page.locator('#docs-navigation').getByRole('link', { name: 'CLI' }).click()
      await waitForText(heading(page), 'CLI')
      assert.equal(new URL(page.url()).pathname, href('docs/cli/'))
    })
  }

  it('keeps the examples still and says they run with JavaScript, while their source shows', async (t) => {
    let { page, departures } = await open(t, button, { javaScript: false })

    let form = example(page, 'ButtonForm')
    assert.ok(await form.getByText('This example runs with JavaScript.').isVisible())
    assert.ok(await form.locator('[data-docs-source] pre').isVisible())
    await assertExamplesStayStill(page, departures)
  })
})

describe('with the example guard blocked', () => {
  it('keeps the examples still and says so once the guard is late', async (t) => {
    let { page, departures } = await open(t, button, { block: '**/example-guard.tsx.js' })

    await example(page, 'ButtonForm').getByText('This example runs with JavaScript.').waitFor({ timeout: 10_000 })
    await assertExamplesStayStill(page, departures)
  })
})

describe('accessibility', () => {
  for (let [label, options] of [
    ['wide and light', { width: 1280, colorScheme: 'light' }],
    ['wide and dark', { width: 1280, colorScheme: 'dark' }],
    ['narrow and dark', { width: 390, colorScheme: 'dark' }],
  ] as const) {
    it(`finds no WCAG 2.2 A or AA violations on the Button page, ${label}`, async (t) => {
      let { page } = await open(t, button, options)
      assert.deepEqual(await findAccessibilityViolations(page), [])
    })
  }

  it('finds none with the narrow menu and the search open', async (t) => {
    let { page } = await open(t, button, { width: 390 })

    await page.getByRole('button', { name: 'Toggle Sidebar' }).click()
    await page.getByRole('dialog', { name: 'Sidebar' }).waitFor()
    assert.deepEqual(await findAccessibilityViolations(page), [])
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: /Search the docs/ }).click()
    await page.getByRole('dialog', { name: 'Search the docs' }).waitFor()
    assert.deepEqual(await findAccessibilityViolations(page), [])
  })
})

function region(page: Page, name: string) {
  return page.getByRole('region', { name, exact: true })
}

function isFocused(locator: ReturnType<Page['locator']>) {
  return locator.evaluate((element) => element === document.activeElement)
}

/** Sends the invite form with made-up details, and waits for what it says it would send. */
async function sendInvite(page: Page) {
  let invite = region(page, 'Invite a teammate')
  await invite.getByLabel('Name', { exact: true }).fill('Ada Lovelace')
  await invite.getByLabel('Email', { exact: true }).fill('ada@northwind.example')
  await invite.getByRole('button', { name: 'Send invite' }).click()
  await waitForText(invite.getByRole('status'), 'Ada Lovelace would get an invite at ada@northwind.example.')
}

/** The transition durations, in seconds, of every element in the showcase. */
function showcaseTransitions(page: Page) {
  return page.locator('[data-docs-showcase]').evaluate((root) =>
    [root, ...root.querySelectorAll('*')].flatMap((element) =>
      getComputedStyle(element)
        .transitionDuration.split(',')
        .map((duration) => Number.parseFloat(duration)),
    ),
  )
}

/**
 * Types into the invite form, sends it and presses a toggle, all with the
 * real mouse and keyboard, as a reader would. A showcase that took any of it
 * would hold the text, press the toggle, or send the form to the page's URL.
 */
async function assertShowcaseStill(page: Page) {
  let invite = region(page, 'Invite a teammate')
  let italic = region(page, 'Format a note').getByRole('button', { name: 'Italic' })
  let before = page.url()

  for (let [label, value] of [
    ['Name', 'Ada Lovelace'],
    ['Email', 'ada@northwind.example'],
  ]) {
    await clickWithMouse(page, invite.getByLabel(label!, { exact: true }))
    await page.keyboard.type(value!)
    assert.equal(await invite.getByLabel(label!, { exact: true }).inputValue(), '')
  }
  await clickWithMouse(page, invite.getByRole('button', { name: 'Send invite' }))
  await clickWithMouse(page, italic)
  assert.equal(await italic.getAttribute('aria-pressed'), 'false')
  assert.equal(page.url(), before)
}

describe('the home page', () => {
  it('leads with the phrase and opens the components, the docs and GitHub from its links', async (t) => {
    let { page, problems } = await open(t, home)

    assert.equal(await heading(page).textContent(), 'shadcn components for Remix V3')
    let nav = page.getByRole('navigation', { name: 'Main' })
    assert.equal(await nav.getByRole('link', { name: 'GitHub' }).getAttribute('href'), repository)

    await page.locator('main').getByRole('link', { name: 'Browse components' }).click()
    await waitForText(heading(page), 'Components')
    assert.equal(new URL(page.url()).pathname, href('docs/components/'))

    await nav.getByRole('link', { name: 'Docs', exact: true }).click()
    await waitForText(heading(page), 'Introduction')
    await nav.getByRole('link', { name: 'Components', exact: true }).click()
    await waitForText(heading(page), 'Components')
    assert.equal(new URL(page.url()).pathname, href('docs/components/'))

    await page.locator('#docs-navigation').getByRole('link', { name: 'Introduction' }).click()
    await waitForText(heading(page), 'Introduction')
    await page.locator('[data-slot="sidebar"]').getByRole('link', { name: 'RemixCN' }).click()
    await waitForText(heading(page), 'shadcn components for Remix V3')
    await page.locator('main').getByRole('link', { name: 'Read the docs' }).click()
    await waitForText(heading(page), 'Introduction')
    assert.equal(new URL(page.url()).pathname, href('docs/'))
    assert.deepEqual(problems, [])
  })

  it('starts the content with its links and the copy button, each with a visible focus ring', async (t) => {
    let { page } = await open(t, home)

    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter')
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'main-content')
    for (let name of ['Browse components', 'Read the docs', 'Copy the setup commands']) {
      await page.keyboard.press('Tab')
      let focused = page.locator(':focus')
      assert.equal((await focused.getAttribute('aria-label')) ?? (await focused.textContent())?.trim(), name)
      assert.ok(
        await focused.evaluate((element) => {
          let style = getComputedStyle(element)
          return element.matches(':focus-visible') && style.outlineStyle !== 'none' && style.outlineWidth === '2px'
        }),
        `${name} shows its focus ring`,
      )
    }
  })

  it('copies the setup commands', async (t) => {
    let { page } = await open(t, home)

    await page.getByRole('button', { name: 'Copy the setup commands' }).click()
    await waitForText(page.getByRole('status'), 'Copied the setup commands')
    assert.deepEqual(await page.evaluate(() => (window as unknown as { clipboardWrites: string[] }).clipboardWrites), [
      'npx remixcn init\nnpx remixcn add button',
    ])
  })

  it('says when the browser refuses to copy the setup commands', async (t) => {
    let { page } = await open(t, home, { clipboard: 'reject' })

    await page.getByRole('button', { name: 'Copy the setup commands' }).click()
    await waitForText(page.getByRole('status'), "Couldn't copy the setup commands")
  })

  it('checks the invite form natively, says what it would send, and stays on the page', async (t) => {
    let { page, departures } = await open(t, home)
    let failed = await suppressValidationMessages(page)
    let invite = region(page, 'Invite a teammate')
    let status = invite.getByRole('status')
    let name = invite.getByLabel('Name', { exact: true })
    let email = invite.getByLabel('Email', { exact: true })

    await invite.getByRole('button', { name: 'Send invite' }).click()
    assert.deepEqual(await failed(), ['name', 'email'])
    await name.fill('Ada Lovelace')
    await email.fill('not an email')
    await invite.getByRole('button', { name: 'Send invite' }).click()
    assert.deepEqual(await failed(), ['name', 'email', 'email'])
    assert.equal(await status.textContent(), '')

    await email.fill('ada@northwind.example')
    await invite.getByLabel('Make them an admin').check()
    await email.press('Enter')
    await waitForText(
      status,
      'Ada Lovelace would get an invite at ada@northwind.example, as an admin. Nothing was sent.',
    )
    assert.equal(page.url(), new URL(home, page.url()).href)

    await invite.getByRole('button', { name: 'Clear' }).click()
    assert.equal(await name.inputValue(), '')
    assert.equal(await invite.getByLabel('Make them an admin').isChecked(), false)
    await waitForText(invite.locator('[data-docs-showcase-status]:empty'), '')
    assert.deepEqual(departures, [])
  })

  it('switches the notification tabs with the keyboard, and each tab keeps its own choices', async (t) => {
    let { page } = await open(t, home)
    let card = region(page, 'Notifications')
    let summary = card.locator('[data-docs-showcase-summary]')
    let email = card.getByRole('tab', { name: 'Email' })
    let mobile = card.getByRole('tab', { name: 'Mobile' })

    await email.scrollIntoViewIfNeeded()
    await email.focus()
    await page.keyboard.press('ArrowRight')
    assert.ok(await isFocused(mobile))
    assert.equal(await mobile.getAttribute('aria-selected'), 'false')
    await page.keyboard.press('Enter')
    let panel = card.getByRole('tabpanel', { name: 'Mobile' })
    await panel.waitFor()
    assert.equal(await mobile.getAttribute('aria-selected'), 'true')

    await page.keyboard.press('Tab')
    assert.ok(await isFocused(panel.getByLabel('Someone mentions me')))
    await page.keyboard.press('Tab')
    await page.keyboard.press('Space')
    assert.ok(await panel.getByLabel('A teammate joins').isChecked())
    await waitForText(summary, 'On: 2 by email, 2 on mobile.')

    await email.click()
    let emailPanel = card.getByRole('tabpanel', { name: 'Email' })
    await emailPanel.waitFor()
    assert.deepEqual(
      await Promise.all(
        ['Someone mentions me', 'A teammate joins', 'The weekly summary is ready'].map((label) =>
          emailPanel.getByLabel(label).isChecked(),
        ),
      ),
      [true, false, true],
    )
  })

  it('formats the note with toggles from the mouse and the keyboard, and leaves browser shortcuts alone', async (t) => {
    let { page } = await open(t, home)
    let card = region(page, 'Format a note')
    let note = card.locator('[data-docs-showcase-note]')
    let bold = card.getByRole('button', { name: 'Bold' })
    let italic = card.getByRole('button', { name: 'Italic' })

    assert.equal(await bold.getAttribute('aria-pressed'), 'true')
    assert.equal(await note.evaluate((element) => getComputedStyle(element).fontWeight), '700')
    await bold.click()
    assert.equal(await bold.getAttribute('aria-pressed'), 'false')
    assert.equal(await note.evaluate((element) => getComputedStyle(element).fontWeight), '400')

    await italic.focus()
    await page.keyboard.press('Space')
    assert.equal(await italic.getAttribute('aria-pressed'), 'true')
    assert.equal(await note.evaluate((element) => getComputedStyle(element).fontStyle), 'italic')

    await page.evaluate(() => {
      let log: string[] = []
      Object.assign(window, { shortcutLog: log })
      window.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.key !== 'Control') log.push(`${event.key}:${event.defaultPrevented}`)
      })
    })
    // Ctrl+B is left out: the docs' Sidebar takes it on every page, as Sidebar does by default.
    await page.keyboard.press('Control+i')
    await page.keyboard.press('Control+u')
    assert.deepEqual(await page.evaluate(() => (window as unknown as { shortcutLog: string[] }).shortcutLog), [
      'i:false',
      'u:false',
    ])
    assert.equal(await bold.getAttribute('aria-pressed'), 'false')
    assert.equal(await italic.getAttribute('aria-pressed'), 'true')
  })

  it('keeps the showcase running when a page opens in place, the home page itself too', async (t) => {
    let { page, departures } = await open(t, home)
    let brand = page.locator('[data-slot="sidebar"]').getByRole('link', { name: 'RemixCN' })

    await brand.click()
    await page.waitForURL((url) => url.pathname === home)
    await sendInvite(page)
    assert.equal(await page.locator('[data-docs-showcase-canvas]').getAttribute('inert'), null)

    await page.locator('#docs-navigation').getByRole('link', { name: 'CLI' }).click()
    await waitForText(heading(page), 'CLI')
    await brand.click()
    await waitForText(heading(page), 'shadcn components for Remix V3')
    await sendInvite(page)
    assert.deepEqual(departures, [])
  })

  for (let reducedMotion of ['reduce', 'no-preference'] as const) {
    it(`animates the showcase only without a request for less motion (${reducedMotion})`, async (t) => {
      let { page } = await open(t, home, { reducedMotion })

      await region(page, 'Notifications').getByRole('tab', { name: 'Mobile' }).click()
      await region(page, 'Format a note').getByRole('button', { name: 'Italic' }).click()
      let longest = Math.max(...(await showcaseTransitions(page)))
      if (reducedMotion === 'reduce') assert.equal(longest, 0)
      else assert.ok(longest > 0, 'the controls animate when motion is welcome')
    })
  }

  it('follows the theme the reader picks, and the system again', async (t) => {
    let { page } = await open(t, home, { colorScheme: 'dark' })
    let card = region(page, 'Invite a teammate')
    let colors = () =>
      card.evaluate((element) => {
        let style = getComputedStyle(element)
        return `${style.backgroundColor} ${style.color}`
      })

    let dark = await colors()
    await page.getByRole('radio', { name: 'Light' }).check()
    let light = await colors()
    assert.notEqual(light, dark)
    await page.getByRole('radio', { name: 'Dark' }).check()
    assert.equal(await colors(), dark)
    await page.getByRole('radio', { name: 'System' }).check()
    assert.equal(await colors(), dark)
  })

  it('keeps GitHub in the narrow header, the docs and the components in the menu, and the hero links', async (t) => {
    let { page } = await open(t, home, { width: 390 })
    let nav = page.getByRole('navigation', { name: 'Main' })

    assert.ok(await nav.getByRole('link', { name: 'GitHub' }).isVisible())
    assert.equal(await nav.getByRole('link', { name: 'Docs', exact: true }).isVisible(), false)
    assert.equal(await nav.getByRole('link', { name: 'Components', exact: true }).isVisible(), false)
    assert.ok(await page.locator('main').getByRole('link', { name: 'Browse components' }).isVisible())
    assert.ok(await page.locator('main').getByRole('link', { name: 'Read the docs' }).isVisible())

    await page.getByRole('button', { name: 'Toggle Sidebar' }).click()
    let menu = page.getByRole('dialog', { name: 'Sidebar' })
    await menu.getByRole('link', { name: 'All components' }).click()
    await waitForText(heading(page), 'Components')
  })

  for (let width of [1280, 390]) {
    it(`reads and links without JavaScript at ${width}px, and keeps the showcase still with a note`, async (t) => {
      let { page, departures } = await open(t, home, { width, javaScript: false })

      assert.equal(await heading(page).textContent(), 'shadcn components for Remix V3')
      assert.ok(await page.getByText('npx remixcn add button').first().isVisible())
      assert.ok(await page.getByText('The showcase runs with JavaScript.').isVisible())

      await assertShowcaseStill(page)

      await page.locator('main').getByRole('link', { name: 'Browse components' }).click()
      await waitForText(heading(page), 'Components')
      assert.equal(new URL(page.url()).pathname, href('docs/components/'))
      assert.equal(new URL(page.url()).search, '')
      assert.deepEqual(departures, [])
    })
  }

  it('keeps the showcase still and says so once its script is late', async (t) => {
    let { page, departures } = await open(t, home, { block: '**/showcase.tsx.js' })

    await page.getByText('The showcase runs with JavaScript.').waitFor({ timeout: 10_000 })
    await assertShowcaseStill(page)
    assert.deepEqual(departures, [])
  })

  for (let [label, options] of [
    ['wide and light', { width: 1280, colorScheme: 'light' }],
    ['wide and dark', { width: 1280, colorScheme: 'dark' }],
    ['narrow and dark', { width: 390, colorScheme: 'dark' }],
  ] as const) {
    it(`finds no WCAG 2.2 A or AA violations, ${label}`, async (t) => {
      let { page } = await open(t, home, options)
      assert.deepEqual(await findAccessibilityViolations(page), [])
    })
  }

  it('finds none after the showcase was used', async (t) => {
    let { page } = await open(t, home, { colorScheme: 'dark' })

    await sendInvite(page)
    await region(page, 'Notifications').getByRole('tab', { name: 'Mobile' }).click()
    await region(page, 'Format a note').getByRole('button', { name: 'Italic' }).click()
    assert.deepEqual(await findAccessibilityViolations(page), [])
  })
})
