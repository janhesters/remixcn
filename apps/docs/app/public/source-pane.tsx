// A source pane: code as text in a Code Block, with a copy button that says
// whether the copy worked. The code arrives as a string prop, so it renders
// as text on the server and in the browser and never runs.
import { clientEntry, css } from 'remix/component'
import type { Handle } from 'remix/component'

import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from '../../../../registry/ui/code-block.tsx'

export interface SourcePaneProps {
  /** The pane's title, such as the file or the example's name. */
  title: string
  /** The text it shows and copies, exactly. */
  code: string
  /** What the copy button copies, for its name, such as "the ButtonForm source". */
  label: string
}

// Long code scrolls inside the pane, so the page keeps its place.
const contentStyles = css({ maxHeight: '24rem' })

export const SourcePane = clientEntry(import.meta.url, function SourcePane(handle: Handle<SourcePaneProps>) {
  return () => {
    let { title, code, label } = handle.props

    return (
      <CodeBlock data-docs-source="">
        <CodeBlockHeader>
          <CodeBlockTitle>{title}</CodeBlockTitle>
          <CodeBlockActions>
            <CodeBlockCopyButton
              value={code}
              aria-label={`Copy ${label}`}
              copiedLabel={`Copied ${label}`}
              failedLabel={`Couldn't copy ${label}`}
            />
          </CodeBlockActions>
        </CodeBlockHeader>
        <CodeBlockContent aria-label={title} mix={contentStyles}>
          {code}
        </CodeBlockContent>
      </CodeBlock>
    )
  }
})
