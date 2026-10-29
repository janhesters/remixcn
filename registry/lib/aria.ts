// RemixCN ARIA states: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md

// Remix's server writes a boolean attribute as a bare name, so aria-invalid={true}
// becomes aria-invalid="", which ARIA reads as false, and false leaves the
// attribute out. The browser writes "true" or "false" instead. ARIA states take
// the strings, so a control that passes your ARIA props through writes them
// as strings on both.

/** Returns the props with each boolean aria-* value written as "true" or "false". Other props stay as they are. */
export function ariaStates<P extends object>(props: P): P {
  let result = { ...props } as Record<string, unknown>

  for (let [name, value] of Object.entries(props)) {
    if (name.startsWith('aria-') && typeof value === 'boolean') result[name] = String(value)
  }

  return result as P
}
