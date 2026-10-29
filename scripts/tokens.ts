export interface Token {
  light: string
  dark: string
}

const declaration = /--([a-z0-9-]+)\s*:\s*([^;]+);/g

/** Splits `light-dark(a, b)` at its top-level comma. Other values apply to both schemes. */
function splitLightDark(value: string): Token {
  let inner = /^light-dark\((.*)\)$/s.exec(value)?.[1]
  if (inner === undefined) return { light: value, dark: value }

  let depth = 0
  for (let index = 0; index < inner.length; index++) {
    let char = inner[index]
    if (char === '(') depth++
    else if (char === ')') depth--
    else if (char === ',' && depth === 0) {
      return { light: inner.slice(0, index).trim(), dark: inner.slice(index + 1).trim() }
    }
  }
  throw new Error(`light-dark() needs two values: ${value}`)
}

/**
 * Reads the custom properties a theme stylesheet declares, by name without
 * the leading dashes. The first declaration of a name is its default, so
 * later media-query overrides don't count.
 */
export function readTokens(css: string): Map<string, Token> {
  let tokens = new Map<string, Token>()

  for (let [, name, value] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(declaration)) {
    if (!tokens.has(name)) tokens.set(name, splitLightDark(value.trim()))
  }

  return tokens
}
