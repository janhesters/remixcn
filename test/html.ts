// Reads the opening tags of server-rendered HTML, so server tests can check
// elements and attributes without a DOM. The style elements css() adds, and
// the head that holds them, are left out.

function withoutStyles(html: string) {
  return html.replaceAll(/<style[^>]*>[\s\S]*?<\/style>/g, '').replaceAll('<head></head>', '')
}

export interface Tag {
  name: string
  attributes: Map<string, string>
}

/** Lists the opening tags in document order, or only those with this name. */
export function tags(html: string, name?: string): Tag[] {
  return [...withoutStyles(html).matchAll(/<([a-z][\w-]*)(\s[^>]*)?>/g)]
    .map(([, tagName, source = '']) => ({
      name: tagName,
      attributes: new Map(
        [...source.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].map(([, attribute, value]) => [attribute, value ?? '']),
      ),
    }))
    .filter((tag) => name === undefined || tag.name === name)
}

/** Returns the attributes of the first tag with this name, or with this data-slot when it starts with "slot:". */
export function attributes(html: string, name: string): Map<string, string> {
  let found = name.startsWith('slot:')
    ? tags(html).find((tag) => tag.attributes.get('data-slot') === name.slice(5))
    : tags(html, name)[0]
  if (!found) throw new Error(`No <${name}> in ${html}`)
  return found.attributes
}

/** Returns the text of the HTML, without style elements and tags, and with entities for <, >, & and quotes decoded. */
export function text(html: string): string {
  return withoutStyles(html)
    .replace(/<[^>]*>/g, '')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&')
}
