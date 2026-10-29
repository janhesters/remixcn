import { AxeBuilder } from '@axe-core/playwright'
import type { Page } from 'playwright'

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/**
 * An element one axe rule misjudges, such as a native input that leaves the
 * pointer to its parent. A test that names one asserts the real behavior
 * itself. Every other element still fails the rule.
 */
export interface AccessibilityException {
  rule: string
  /** A CSS selector for the elements the rule misjudges. */
  selector: string
}

/**
 * Runs axe-core's WCAG 2.2 A and AA rules on the page. Lists each violation as
 * its rule, what it requires and the elements that break it, leaving out only
 * the elements an exception names for its rule.
 */
export async function findAccessibilityViolations(
  page: Page,
  { except = [] }: { except?: AccessibilityException[] } = {},
): Promise<string[]> {
  // `t.serve` pages can't open the extra page axe uses to merge cross-origin
  // frame results. Fixture pages have no cross-origin frames, so axe runs in
  // the page itself.
  let { violations } = await new AxeBuilder({ page }).withTags(wcagTags).setLegacyMode(true).analyze()

  let results: string[] = []
  for (let { id, help, nodes } of violations) {
    let selectors = except.filter((exception) => exception.rule === id).map((exception) => exception.selector)
    let kept: typeof nodes = []
    for (let node of nodes) {
      let excepted =
        selectors.length > 0 &&
        (await page
          .locator(String(node.target.at(-1)))
          .first()
          .evaluate((element, list) => list.some((selector) => element.matches(selector)), selectors))
      if (!excepted) kept.push(node)
    }
    if (kept.length > 0) results.push(`${id}: ${help} (${kept.map((node) => node.target.join(' ')).join(', ')})`)
  }
  return results
}
