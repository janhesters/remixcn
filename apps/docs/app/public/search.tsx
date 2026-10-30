// The site search: a command palette over the pages, in the browser only. It
// searches the titles and keywords the build passes in, so nothing leaves the
// page. Without scripting, the button hides and the navigation lists every page.
import { css, navigate, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { SearchIcon } from '../../../../registry/lib/icons.tsx'
import { Button } from '../../../../registry/ui/button.tsx'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../../../../registry/ui/command.tsx'
import { Kbd, KbdGroup } from '../../../../registry/ui/kbd.tsx'

export interface SearchEntry {
  title: string
  href: string
  group: string
  keywords: string[]
}

export interface DocsSearchProps {
  entries: SearchEntry[]
}

const triggerStyles = css({
  justifyContent: 'flex-start',
  minWidth: 0,
  color: 'var(--muted-foreground)',
  fontWeight: 400,
  '@media (width >= 40rem)': { width: '16rem' },
  '@media (scripting: none)': { display: 'none' },
})
const labelStyles = css({
  flex: '1 1 auto',
  minWidth: 0,
  textAlign: 'start',
  // Below 40rem only the icon shows; the label still names the button.
  '@media (width < 40rem)': {
    position: 'absolute',
    width: '1px',
    height: '1px',
    overflow: 'hidden',
    clipPath: 'inset(50%)',
    whiteSpace: 'nowrap',
  },
})
const shortcutStyles = css({ '@media (width < 40rem)': { display: 'none' } })
/** Whether a key press belongs to the page, not to a text field or a component example. */
function belongsToPage(event: KeyboardEvent) {
  let target = event.target instanceof Element ? event.target : null
  if (target?.closest('[data-docs-preview]')) return false
  if (target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'))) {
    return false
  }
  return true
}

function isApple() {
  return /Mac|iPhone|iPad/.test(navigator.platform)
}

/**
 * A button that opens the search, and Ctrl+K or ⌘K anywhere but in a text
 * field or an example. Choosing a page closes the palette and opens the page.
 */
export function DocsSearch(handle: Handle<DocsSearchProps>) {
  let open = false
  let running = false
  let apple = false

  let setOpen = (next: boolean) => {
    open = next
    void handle.update()
  }

  if (typeof document !== 'undefined') {
    document.addEventListener(
      'keydown',
      (event) => {
        if (event.defaultPrevented || event.altKey || event.shiftKey || !(event.metaKey || event.ctrlKey)) return
        if (event.key.toLowerCase() !== 'k' || !belongsToPage(event)) return
        event.preventDefault()
        setOpen(!open)
      },
      { signal: handle.signal },
    )
  }

  return () => {
    if (!running) {
      handle.queueTask(() => {
        running = true
        apple = isApple()
        void handle.update()
      })
    }

    let groups = Map.groupBy(handle.props.entries, (entry) => entry.group)

    return (
      <>
        <Button
          variant="outline"
          disabled={!running}
          aria-haspopup="dialog"
          aria-keyshortcuts="Control+K Meta+K"
          mix={[triggerStyles, on('click', () => setOpen(true))]}
        >
          <SearchIcon data-icon="inline-start" />
          <span mix={labelStyles}>Search the docs…</span>
          <KbdGroup mix={shortcutStyles} aria-hidden="true">
            <Kbd>{apple ? '⌘' : 'Ctrl'}</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </Button>
        <CommandDialog
          open={open}
          onOpenChange={setOpen}
          title="Search the docs"
          description="Find a component or a guide by its name."
        >
          <Command loop>
            <CommandInput placeholder="Search components and guides…" />
            <CommandList label="Pages">
              <CommandEmpty>No page matches.</CommandEmpty>
              {[...groups].map(([group, entries]) => (
                <CommandGroup key={group} heading={group}>
                  {entries.map((entry) => (
                    <CommandItem
                      key={entry.href}
                      value={entry.title}
                      keywords={[group, ...entry.keywords]}
                      onSelect={() => {
                        setOpen(false)
                        void navigate(entry.href)
                      }}
                    >
                      {entry.title}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </CommandDialog>
      </>
    )
  }
}
