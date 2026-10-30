// Holds a page's module request, such as its entry module, and with it
// hydration, so a test can act on the server's HTML first. The hold registers
// its teardown with t.after before anything else awaits, so a test that fails
// before it releases still settles the held request before its page closes.
import type { Page } from 'playwright'
import type { TestContext } from 'remix/test'

export type HoldOutcome = 'released' | 'expired' | 'teardown'

export interface HoldOptions {
  /** How long the request may stay held (defaults to 10 s, the navigation limit). */
  limitMs?: number
  /** Records each step, such as with `phase` from phases.ts. */
  record?: (step: string) => void
}

export interface Hold {
  /** Lets held requests through, and later ones too. Safe to call more than once. */
  release(): void
  /** Starts holding the page's requests that match the pattern. */
  attach(page: Page, pattern: string): Promise<void>
  /** How the hold ended, once it did. */
  readonly outcome: HoldOutcome | undefined
}

/**
 * Creates a hold for one test. Its teardown aborts a request still held and
 * waits for it to settle. A request held longer than the limit is aborted and
 * its page closed, so whatever the test awaits on that page rejects and the
 * test fails by name instead of waiting for ever.
 */
export function createHold(t: Pick<TestContext, 'after'>, options: HoldOptions = {}): Hold {
  let { limitMs = 10_000, record = () => {} } = options
  let outcome: HoldOutcome | undefined
  let decide!: (outcome: HoldOutcome) => void
  let decided = new Promise<HoldOutcome>((resolve) => {
    decide = (next) => {
      outcome ??= next
      resolve(outcome)
    }
  })
  let handlers: Promise<void>[] = []

  t.after(async () => {
    decide('teardown')
    await Promise.all(handlers)
  })

  return {
    release: () => decide('released'),
    get outcome() {
      return outcome
    },
    async attach(page, pattern) {
      await page.route(pattern, (route) => {
        let handled = (async () => {
          let path = new URL(route.request().url()).pathname
          record(`hold: ${path} held`)
          let timer: ReturnType<typeof setTimeout> | undefined
          let expiry = new Promise<HoldOutcome>((resolve) => {
            timer = setTimeout(() => resolve('expired'), limitMs)
          })
          let result = await Promise.race([decided, expiry])
          clearTimeout(timer)
          if (result === 'expired') decide('expired')

          try {
            if (result === 'released') {
              record(`hold: ${path} released`)
              await route.continue()
              return
            }
            record(
              result === 'expired'
                ? `hold: ${path} still held after ${limitMs / 1000} s, so it is aborted and the page closed`
                : `hold: ${path} still held at teardown, so it is aborted`,
            )
            await route.abort()
            if (result === 'expired') await page.close()
          } catch (error) {
            // The page may close first, which settles the request too.
            record(`hold: ${path} ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`)
          }
        })()
        handlers.push(handled)
        return handled
      })
    },
  }
}
