import { AxeBuilder } from '@axe-core/playwright'
import type { Page } from 'playwright'

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/**
 * Runs axe-core's WCAG 2.2 A and AA rules on the page. Lists each violation as
 * its rule, what it requires and the elements that break it.
 */
export async function findAccessibilityViolations(page: Page): Promise<string[]> {
  // `t.serve` pages can't open the extra page axe uses to merge cross-origin
  // frame results. Fixture pages have no cross-origin frames, so axe runs in
  // the page itself.
  let { violations } = await new AxeBuilder({ page }).withTags(wcagTags).setLegacyMode(true).analyze()

  return violations.map(
    ({ id, help, nodes }) => `${id}: ${help} (${nodes.map((node) => node.target.join(' ')).join(', ')})`,
  )
}
