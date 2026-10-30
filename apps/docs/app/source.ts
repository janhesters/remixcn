// Reads the source the example panes show, at build time on the server. The
// panes show it as text: Code Block escapes every string it renders.
import { readFileSync } from 'node:fs'

const root = new URL('../../../', import.meta.url)
const commentLine = /^(\/\*\*|\/\*| \*|\/\/)/

/**
 * Reads one export of a module, with the comment right above it: from
 * `export function Name` or `export const Name` to the line that closes it.
 * Prettier formats the registry, so a declaration that spans lines closes with
 * a `}` or `)` at the start of a line, and every other line inside it is
 * indented or blank.
 */
export function readExport(source: string, name: string): string {
  let lines = source.split('\n')
  let declaration = new RegExp(`^export (async function|function|const|let) ${name}\\b`)
  let start = lines.findIndex((line) => declaration.test(line))
  if (start === -1) throw new Error(`The module exports no ${name}`)

  let first = start
  while (first > 0 && commentLine.test(lines[first - 1]!)) first--

  let end = start
  for (let index = start + 1; index < lines.length; index++) {
    let line = lines[index]!
    if (line === '' || /^\s/.test(line)) continue
    if (/^[}\])]/.test(line)) end = index
    break
  }

  return lines.slice(first, end + 1).join('\n')
}

/** Reads one export of a file in `registry/examples`, such as `ButtonForm`. */
export function readExample(file: string, name: string): string {
  if (!/^registry\/examples\/[a-z0-9-]+\.tsx$/.test(file)) {
    throw new Error(`${file}: the docs show examples from registry/examples only`)
  }
  return readExport(readFileSync(new URL(file, root), 'utf8'), name)
}
