// RemixCN Mobile breakpoint: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md

// shadcn's useIsMobile() hook keeps React state in step with the viewport.
// Here it's two plain functions: ask once, or watch until a signal aborts,
// such as a component's handle.signal. The query is in rem, as the CSS
// media queries that use the same breakpoint are, so both move together
// when the browser's text size changes.

/** The width below which a layout counts as mobile: shadcn's 768px `md` breakpoint at the default text size. */
export const MOBILE_BREAKPOINT = '48rem'

/** The media query that matches a mobile viewport. Use it in CSS too, so scripts and styles agree. */
export const mobileQuery = `(width < ${MOBILE_BREAKPOINT})`

type View = Pick<Window, 'matchMedia'>

/** Whether the viewport is narrower than the breakpoint now. `false` where there is no `matchMedia`, such as on the server. */
export function isMobile(view: Partial<View> | undefined = globalThis.window): boolean {
  return typeof view?.matchMedia === 'function' && view.matchMedia(mobileQuery).matches
}

/**
 * Calls `onChange` each time the viewport crosses the breakpoint, until
 * `signal` aborts. Returns whether it's narrower than the breakpoint now.
 */
export function watchMobile(
  onChange: (mobile: boolean) => void,
  signal: AbortSignal,
  view: View = globalThis.window,
): boolean {
  let query = view.matchMedia(mobileQuery)
  if (!signal.aborted) query.addEventListener('change', (event) => onChange(event.matches), { signal })
  return query.matches
}
