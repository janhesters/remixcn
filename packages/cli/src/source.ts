// The source contracts the registry build, the installer and the workspace
// checks share: which imports and CSS a registry file may use.
import { isBuiltin } from 'node:module'

/** Lists a stylesheet's at-rules with their preludes, skipping comments and strings. */
function findCssAtRules(css: string): Array<{ name: string; prelude: string }> {
  let rules: Array<{ name: string; prelude: string }> = []
  let index = 0

  function skipComment() {
    let end = css.indexOf('*/', index + 2)
    index = end === -1 ? css.length : end + 2
  }

  function readString() {
    let quote = css[index]
    let start = index++
    while (index < css.length && css[index] !== quote && css[index] !== '\n') {
      index += css[index] === '\\' ? 2 : 1
    }
    index++
    return css.slice(start, index)
  }

  while (index < css.length) {
    let char = css[index]

    if (css.startsWith('/*', index)) skipComment()
    else if (char === '"' || char === "'") readString()
    else if (char === '@') {
      let name = /^[\w-]+/.exec(css.slice(index + 1))?.[0] ?? ''
      index += name.length + 1

      let prelude = ''
      while (index < css.length && css[index] !== ';' && css[index] !== '{') {
        if (css.startsWith('/*', index)) skipComment()
        else if (css[index] === '"' || css[index] === "'") prelude += readString()
        else prelude += css[index++]
      }
      rules.push({ name, prelude: prelude.trim() })
    } else index++
  }

  return rules
}

export function findCssImports(css: string): string[] {
  return findCssAtRules(css)
    .filter((rule) => rule.name === 'import')
    .flatMap((rule) => /^(?:url\(\s*)?["']?([^"')\s]+)/.exec(rule.prelude)?.[1] ?? [])
}

const tailwindDirectives = new Set([
  'tailwind',
  'apply',
  'theme',
  'utility',
  'variant',
  'custom-variant',
  'plugin',
  'config',
  'source',
  'reference',
])

export function findTailwindDirectives(css: string): string[] {
  let names = findCssAtRules(css)
    .map((rule) => rule.name)
    .filter((name) => tailwindDirectives.has(name))
  return [...new Set(names)].map((name) => `@${name}`)
}

/** Counts @font-face rules. Registry and docs CSS use system fonts, so they load no font file. */
export function findFontFaces(css: string): number {
  return findCssAtRules(css).filter((rule) => rule.name === 'font-face').length
}

const forbiddenFamilies: Array<[RegExp, string]> = [
  [/^(react|react-dom|scheduler)(\/|$)/, 'React'],
  [/^(tailwindcss|tailwind-merge)(\/|$)|^@tailwindcss\//, 'Tailwind'],
  [/^@base-ui(-components)?\//, 'Base UI'],
  [/^@radix-ui\/|^radix-ui(\/|$)/, 'Radix'],
  [/^@floating-ui\//, 'Floating UI'],
  [/^@remix-run\/ui(\/|$)/, '@remix-run/ui'],
]

const allowedPackageImports = new Set([
  'remix/component',
  'remix/component/jsx-runtime',
  'remix/component/jsx-dev-runtime',
])

const registryAliasPattern = /^#remixcn\/(ui|lib)\/[a-z0-9-]+\.tsx?$/

/**
 * Checks one import of browser-reachable source. Registry files reach each
 * other only through the #remixcn aliases, so the installer can rewrite them;
 * the docs app may also use relative imports.
 */
export function checkImport(specifier: string, options: { allowRelative: boolean }): string | undefined {
  let family = forbiddenFamilies.find(([pattern]) => pattern.test(specifier))?.[1]
  if (family) return `"${specifier}" brings in ${family}, which browser-reachable source must not use`

  if (isBuiltin(specifier)) return `"${specifier}" is a Node built-in, which browser-reachable source must not use`

  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    return options.allowRelative
      ? undefined
      : `"${specifier}": import registry files through #remixcn/ui/ or #remixcn/lib/ so the installer can rewrite the path`
  }

  if (allowedPackageImports.has(specifier) || registryAliasPattern.test(specifier)) return undefined

  return `"${specifier}": browser-reachable source imports only remix/component and #remixcn/ui/ or #remixcn/lib/ files`
}
