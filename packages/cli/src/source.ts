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

type Context =
  // parens: for each open (, whether it holds an if, while, for or with condition.
  | { kind: 'code'; braces: number; parens: boolean[] }
  | { kind: 'template' }
  | { kind: 'tag'; start: number }
  | { kind: 'children'; start: number }

interface Scan {
  /** The source with everything but code turned into spaces, at the same positions and line breaks. */
  code: string
  /** Each string literal in code, by the position of its opening quote. */
  strings: Map<number, { value: string; end: number }>
  /** The `/// <reference types="..." />` directives, by position. */
  references: Array<{ index: number; specifier: string }>
  /** Where an element starts that never closes, so it was no element. */
  unclosed?: number
}

/** Keywords an expression may follow, so a / after them starts a regular expression and a < an element. */
const expressionKeywords = new Set([
  'return',
  'yield',
  'await',
  'typeof',
  'void',
  'delete',
  'in',
  'of',
  'instanceof',
  'new',
  'case',
  'default',
  'else',
  'do',
  'throw',
])

/** Keywords whose ( holds a condition, so the statement after its ) may start with a regular expression. */
const conditionKeywords = new Set(['if', 'while', 'for', 'with'])

/** A < that opens type parameters, such as <T,>( or <T extends X>, rather than an element. */
const typeParameters = /^<\s*[A-Za-z_$][\w$]*\s*(,|extends\b|>\s*\()/

const referenceDirective = /^\/\/\/\s*<reference\s+types\s*=\s*(['"])([^'"\n]+)\1/

/**
 * Tells code from text without a compiler. Comments, the text of strings and
 * templates, regular expressions, and JSX text and attribute strings become
 * spaces. The expressions inside `${...}` and JSX `{...}` stay code. Without
 * `jsx`, as in a .ts file, a < never opens an element. A < in `notElements`
 * doesn't either.
 */
function scanOnce(source: string, jsx: boolean, notElements: Set<number>): Scan {
  let code = source.split('')
  let strings: Scan['strings'] = new Map()
  let references: Scan['references'] = []
  let stack: Context[] = [{ kind: 'code', braces: 0, parens: [] }]
  let newCode = (): Context => ({ kind: 'code', braces: 0, parens: [] })
  // The last significant code character. A literal or an element ends a value, as ) does.
  let previous = { char: '', index: -1 }
  let index = 0

  let mask = (from: number, to: number) => {
    for (let position = from; position < to; position++) if (code[position] !== '\n') code[position] = ' '
  }
  let endValue = () => (previous = { char: ')', index: -1 })

  /** The word that ends with the last significant character, if it is one. */
  function previousWord() {
    let { char, index: at } = previous
    if (!/[\w$]/.test(char)) return ''
    let start = at
    while (start > 0 && /[\w$]/.test(source[start - 1])) start--
    return source.slice(start, at + 1)
  }

  function startsExpression() {
    let { char } = previous
    if (char === '') return true
    if (/[\w$]/.test(char)) return expressionKeywords.has(previousWord())
    return char !== ')' && char !== ']'
  }

  /** The end of the regular expression at `start`, or -1 when the / divides. */
  function regexEnd(start: number) {
    let inClass = false
    for (let position = start + 1; position < source.length; position++) {
      let char = source[position]
      if (char === '\n') return -1
      if (char === '\\') position++
      else if (char === '[') inClass = true
      else if (char === ']') inClass = false
      else if (char === '/' && !inClass) {
        let end = position + 1
        while (/[a-z]/i.test(source[end] ?? '')) end++
        return end
      }
    }
    return -1
  }

  while (index < source.length) {
    let context = stack[stack.length - 1]
    let char = source[index]
    let next = source[index + 1]

    if (context.kind === 'template') {
      if (char === '\\') {
        mask(index, index + 2)
        index += 2
      } else if (char === '`') {
        stack.pop()
        endValue()
        index++
      } else if (char === '$' && next === '{') {
        stack.push(newCode())
        previous = { char: '{', index: index + 1 }
        index += 2
      } else mask(index, ++index)
      continue
    }

    if (context.kind === 'children') {
      if (char === '{') {
        stack.push(newCode())
        previous = { char: '{', index }
        index++
      } else if (char === '<' && next === '/') {
        let end = source.indexOf('>', index)
        end = end === -1 ? source.length : end + 1
        mask(index, end)
        stack.pop()
        endValue()
        index = end
      } else if (char === '<') {
        stack.push({ kind: 'tag', start: index })
        mask(index, ++index)
      } else mask(index, ++index)
      continue
    }

    if (context.kind === 'tag') {
      if (char === '"' || char === "'") {
        let end = source.indexOf(char, index + 1)
        end = end === -1 ? source.length : end + 1
        mask(index, end)
        index = end
      } else if (char === '{') {
        stack.push(newCode())
        previous = { char: '{', index }
        index++
      } else if (char === '/' && next === '>') {
        mask(index, index + 2)
        stack.pop()
        endValue()
        index += 2
      } else if (char === '>') {
        stack.pop()
        stack.push({ kind: 'children', start: context.start })
        mask(index, ++index)
      } else mask(index, ++index)
      continue
    }

    if (char === '/' && next === '/') {
      let end = source.indexOf('\n', index)
      end = end === -1 ? source.length : end
      let reference = referenceDirective.exec(source.slice(index, end))
      if (reference) references.push({ index, specifier: reference[2] })
      mask(index, end)
      index = end
    } else if (char === '/' && next === '*') {
      let end = source.indexOf('*/', index + 2)
      end = end === -1 ? source.length : end + 2
      mask(index, end)
      index = end
    } else if (char === '"' || char === "'") {
      let end = index + 1
      while (end < source.length && source[end] !== char && source[end] !== '\n') end += source[end] === '\\' ? 2 : 1
      if (source[end] === char) {
        strings.set(index, { value: source.slice(index + 1, end).replace(/\\(.)/g, '$1'), end: end + 1 })
        mask(index + 1, end)
        endValue()
        index = end + 1
      } else {
        // A quote without its partner on the line is no string, such as an apostrophe in text.
        previous = { char, index }
        index++
      }
    } else if (char === '`') {
      stack.push({ kind: 'template' })
      index++
    } else if (char === '/' && startsExpression() && regexEnd(index) !== -1) {
      let end = regexEnd(index)
      mask(index, end)
      endValue()
      index = end
    } else if (
      jsx &&
      char === '<' &&
      !notElements.has(index) &&
      startsExpression() &&
      /[A-Za-z>]/.test(next ?? '') &&
      !typeParameters.test(source.slice(index, index + 200))
    ) {
      stack.push(next === '>' ? { kind: 'children', start: index } : { kind: 'tag', start: index })
      mask(index, (index += next === '>' ? 2 : 1))
    } else if (char === '}' && context.braces === 0 && stack.length > 1) {
      stack.pop()
      index++
    } else {
      if (char === '{') context.braces++
      if (char === '}') context.braces = Math.max(0, context.braces - 1)
      if (char === '(') context.parens.push(conditionKeywords.has(previousWord()))
      // After a condition's ), a statement starts, so a / there opens a regular expression.
      if (char === ')' && context.parens.pop()) previous = { char: '(', index }
      else if (!/\s/.test(char)) previous = { char, index }
      index++
    }
  }

  let open = stack.find((entry) => entry.kind === 'tag' || entry.kind === 'children')
  return { code: code.join(''), strings, references, ...(open && 'start' in open && { unclosed: open.start }) }
}

/**
 * Scans `source`, and scans again while an element never closes, reading
 * its < as an operator. A file with too many such < reads without JSX.
 */
function scanSource(source: string, jsx: boolean): Scan {
  let notElements = new Set<number>()
  for (let attempt = 0; attempt < 20; attempt++) {
    let scan = scanOnce(source, jsx, notElements)
    if (scan.unclosed === undefined) return scan
    notElements.add(scan.unclosed)
  }
  return scanOnce(source, false, notElements)
}

const importPatterns: Array<{ pattern: RegExp; call?: boolean }> = [
  { pattern: /(?:^|[;}])\s*(?:import|export)\b[^;'"`]*?\bfrom\s*(?=['"])/gm },
  { pattern: /(?:^|[;}])\s*import\s*(?=['"])/gm },
  { pattern: /(?:^|[;}])\s*(?:export\s+)?import\s+[\w$]+\s*=\s*require\s*\(\s*(?=['"])/gm, call: true },
  // The import keyword, not a method named import: no identifier, # or single . before it.
  { pattern: /(?<![\w$#]|(?<!\.)\.\s*)import\s*\(\s*(?=['"])/g, call: true },
]

/** TypeScript reads JSX in every script but a .ts, .mts or .cts file. */
export function allowsJsx(path: string): boolean {
  return !/\.[cm]?ts$/.test(path)
}

/**
 * Lists the modules a TypeScript or JavaScript file imports, in source order,
 * without a compiler: import and export declarations, side-effect and dynamic
 * imports with a string specifier, import = require, and type reference
 * directives, as tsc resolves them. Comments, strings, template text, regular
 * expressions and JSX text don't count; the code inside template and JSX
 * expressions does. Pass `jsx: false` for a .ts file. The workspace checks
 * read imports through tsc instead.
 */
export function findScriptImports(source: string, options: { jsx?: boolean } = {}): string[] {
  let { code, strings, references } = scanSource(source, options.jsx ?? true)

  let found = importPatterns.flatMap(({ pattern, call }) =>
    [...code.matchAll(pattern)].flatMap((match) => {
      let position = match.index + match[0].length
      let literal = strings.get(position)
      if (!literal || (call && !/^\s*[,)]/.test(code.slice(literal.end)))) return []
      return [{ index: position, specifier: literal.value }]
    }),
  )

  return [
    ...new Set(
      [...references, ...found].sort((left, right) => left.index - right.index).map((entry) => entry.specifier),
    ),
  ]
}

export function tailwindDirectiveProblem(directive: string): string {
  return `${directive} is a Tailwind directive, which shipped CSS must not use`
}

const scriptPath = /\.[cm]?[jt]sx?$/

/**
 * Lists how a source file breaks the rules registry source keeps: an import
 * other than remix/component and the #remixcn aliases, or a Tailwind
 * directive in CSS. The installer checks every file it copies with it.
 */
export function checkSourceContent(path: string, content: string): string[] {
  let imports = path.endsWith('.css')
    ? findCssImports(content)
    : scriptPath.test(path)
      ? findScriptImports(content, { jsx: allowsJsx(path) })
      : []
  return [
    ...imports.flatMap((specifier) => checkImport(specifier, { allowRelative: false }) ?? []),
    ...(path.endsWith('.css') ? findTailwindDirectives(content).map(tailwindDirectiveProblem) : []),
  ]
}
