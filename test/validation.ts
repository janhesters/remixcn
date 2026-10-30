// Turns off the browser's own validation message in end-to-end tests that
// click on after a submit the browser refused.
//
// While WebKit shows its validation message, which stays about 5 seconds,
// Playwright's WebKit renders few frames on a busy machine. A click waits for
// frames to see its target hold still, so the next click timed out in CI
// (PR #69). A test that cancels the `invalid` event keeps the refused submit
// but shows no message, so the page renders on.
import type { Page } from 'playwright'

interface ValidationLog {
  remixcnInvalidControls: string[]
}

/**
 * Cancels the `invalid` event of every control on the page from now on, so a
 * submit that fails validation is still refused, but the browser neither
 * shows its message nor moves focus to the control. Returns a function that
 * lists the names, or ids, of the controls that failed, in order.
 */
export async function suppressValidationMessages(page: Page): Promise<() => Promise<string[]>> {
  await page.evaluate(() => {
    let failed: string[] = []
    ;(window as unknown as ValidationLog).remixcnInvalidControls = failed
    document.addEventListener(
      'invalid',
      (event) => {
        event.preventDefault()
        let control = event.target as HTMLInputElement
        failed.push(control.name || control.id)
      },
      true,
    )
  })
  return () => page.evaluate(() => [...(window as unknown as ValidationLog).remixcnInvalidControls])
}
