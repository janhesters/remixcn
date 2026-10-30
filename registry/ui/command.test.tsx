import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, tags, text } from '../../test/html.ts'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
  defaultCommandFilter,
} from './command.tsx'

describe('defaultCommandFilter', () => {
  it('keeps every item for an empty or blank search', () => {
    assert.equal(defaultCommandFilter('Calendar', ''), 1)
    assert.equal(defaultCommandFilter('Calendar', '   '), 1)
  })

  it('ranks an exact match over a prefix, a word start, a part of a word and scattered letters', () => {
    let exact = defaultCommandFilter('Calendar', 'calendar')
    let prefix = defaultCommandFilter('Calendar', 'cal')
    let wordStart = defaultCommandFilter('Search emoji', 'emo')
    let inside = defaultCommandFilter('Calculator', 'cul')
    let scattered = defaultCommandFilter('Settings', 'sttgs')

    assert.equal(exact, 1)
    assert.ok(
      exact > prefix && prefix > wordStart && wordStart > inside && inside > scattered,
      [exact, prefix, wordStart, inside, scattered].join(' > '),
    )
    assert.ok(scattered > 0)
  })

  it('hides an item none of the letters match in order', () => {
    assert.equal(defaultCommandFilter('Billing', 'xyz'), 0)
    assert.equal(defaultCommandFilter('Billing', 'gnillib'), 0)
    assert.equal(defaultCommandFilter('', 'billing'), 0)
  })

  it('ignores case, accents and repeated spaces', () => {
    assert.equal(defaultCommandFilter('Café  Crème', 'cafe creme'), 1)
    assert.equal(defaultCommandFilter('ÉTÉ', 'été'), 1)
  })

  it('treats a dash, a slash or a dot as the start of a word', () => {
    assert.equal(defaultCommandFilter('invoice-archive', 'arch'), defaultCommandFilter('Search emoji', 'emo'))
    assert.equal(defaultCommandFilter('reports/2026', '2026'), defaultCommandFilter('Search emoji', 'emo'))
  })

  it('finds every word of the search in any order', () => {
    let reordered = defaultCommandFilter('New invoice draft', 'draft new')
    assert.ok(reordered > defaultCommandFilter('New invoice draft', 'ndt'), 'words beat scattered letters')
    assert.equal(defaultCommandFilter('New invoice draft', 'draft old'), 0)
  })

  it('ranks tighter scattered letters higher', () => {
    assert.ok(defaultCommandFilter('Settings', 'set') > defaultCommandFilter('Session timeout', 'set'))
    assert.ok(defaultCommandFilter('Calendar', 'cln') > defaultCommandFilter('Cancel the plan', 'cln'))
  })

  it('matches keywords a little lower than the value', () => {
    let keyword = defaultCommandFilter('Profile', 'account', ['account', 'user'])
    let value = defaultCommandFilter('Account', 'account')

    assert.ok(keyword > 0 && keyword < value, `${keyword} < ${value}`)
    assert.ok(keyword > defaultCommandFilter('Account settings', 'account'), 'an exact keyword beats a prefix')
    assert.equal(defaultCommandFilter('Profile', 'account', ['user']), 0)
  })
})

function Palette() {
  return () => (
    <Command>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Suggestions">
          <CommandItem>Calendar</CommandItem>
          <CommandItem disabled>Search emoji</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Settings">
          <CommandItem value="profile" keywords={['account']}>
            <span>Profile</span>
            <CommandShortcut>⌘P</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  )
}

describe('Command on the server', () => {
  it('renders a disabled combobox input that names and controls its listbox', async () => {
    let html = await renderToString(<Palette />)
    let input = attributes(html, 'input')
    let list = attributes(html, 'slot:command-list')

    assert.equal(input.get('role'), 'combobox')
    assert.equal(input.get('type'), 'text')
    assert.equal(input.get('aria-autocomplete'), 'list')
    assert.equal(input.get('aria-expanded'), 'true')
    assert.equal(input.get('autocomplete'), 'off')
    assert.equal(input.get('spellcheck'), 'false')
    assert.equal(input.get('aria-label'), 'Command menu')
    assert.ok(input.has('disabled'), 'typing does nothing until the browser runs the command, so the input says so')
    assert.equal(input.get('aria-controls'), list.get('id'))
    assert.ok(list.get('id'))
    assert.equal(list.get('role'), 'listbox')
    assert.equal(list.get('aria-label'), 'Suggestions')
    assert.equal(input.has('aria-activedescendant'), false, 'nothing is highlighted before the browser runs it')
  })

  it('renders every item as an option, none of them highlighted, and leaves the empty state out', async () => {
    let html = await renderToString(<Palette />)
    let options = tags(html).filter((tag) => tag.attributes.get('role') === 'option')

    assert.equal(options.length, 3)
    for (let option of options) {
      assert.equal(option.attributes.get('aria-selected'), 'false')
      assert.equal(option.attributes.has('hidden'), false)
      assert.equal(option.attributes.has('data-selected'), false)
      assert.ok(option.attributes.get('id'))
    }
    assert.equal(new Set(options.map((option) => option.attributes.get('id'))).size, 3)
    assert.deepEqual(
      options.map((option) => option.attributes.get('data-value')),
      ['Calendar', 'Search emoji', 'profile'],
    )
    assert.equal(options[1].attributes.get('aria-disabled'), 'true')
    assert.ok(options[1].attributes.has('data-disabled'))
    assert.equal(options[0].attributes.has('aria-disabled'), false)
    assert.ok(!text(html).includes('No results found.'), html)
  })

  it('names each group by its heading and keeps shortcuts as text', async () => {
    let html = await renderToString(<Palette />)
    let groups = tags(html).filter((tag) => tag.attributes.get('role') === 'group')
    let headings = tags(html).filter((tag) => tag.attributes.get('data-slot') === 'command-group-heading')

    assert.equal(groups.length, 2)
    assert.equal(headings.length, 2)
    for (let [index, group] of groups.entries()) {
      assert.equal(group.attributes.get('aria-labelledby'), headings[index].attributes.get('id'))
      assert.equal(headings[index].attributes.get('aria-hidden'), 'true')
    }
    assert.ok(text(html).includes('Suggestions') && text(html).includes('⌘P'), html)
    assert.equal(attributes(html, 'slot:command-shortcut').get('aria-hidden'), undefined)
  })

  it('draws the separator for the eye only', async () => {
    let html = await renderToString(<Palette />)
    let separator = attributes(html, 'slot:command-separator')

    assert.equal(separator.get('aria-hidden'), 'true')
    assert.equal(separator.has('hidden'), false)
  })

  it('takes the name you give it, and an input name of its own wins', async () => {
    let labelled = await renderToString(
      <Command label="Search invoices">
        <CommandInput />
        <CommandList label="Invoices" />
      </Command>,
    )
    let own = await renderToString(
      <Command label="Search invoices">
        <CommandInput aria-label="Find an invoice" />
        <CommandList />
      </Command>,
    )

    assert.equal(attributes(labelled, 'input').get('aria-label'), 'Search invoices')
    assert.equal(attributes(labelled, 'slot:command-list').get('aria-label'), 'Invoices')
    assert.equal(attributes(own, 'input').get('aria-label'), 'Find an invoice')
  })

  it('renders the search a controlled input starts with', async () => {
    let html = await renderToString(
      <Command>
        <CommandInput value="cal" />
        <CommandList>
          <CommandItem>Calendar</CommandItem>
        </CommandList>
      </Command>,
    )

    assert.equal(attributes(html, 'input').get('value'), 'cal')
  })

  it('gives each command its own ids', async () => {
    let html = await renderToString(
      <div>
        <Palette />
        <Palette />
      </div>,
    )
    let ids = tags(html)
      .map((tag) => tag.attributes.get('id'))
      .filter((id) => id !== undefined)

    assert.equal(new Set(ids).size, ids.length, ids.join(' '))
    let [first, second] = tags(html, 'input')
    assert.notEqual(first.attributes.get('aria-controls'), second.attributes.get('aria-controls'))
  })
})

describe('CommandDialog on the server', () => {
  it('renders a closed native dialog named and described by its hidden title and description inside it', async () => {
    let html = await renderToString(
      <CommandDialog>
        <Command>
          <CommandInput />
          <CommandList>
            <CommandItem>Calendar</CommandItem>
          </CommandList>
        </Command>
      </CommandDialog>,
    )
    let dialog = attributes(html, 'dialog')
    let title = attributes(html, 'h2')
    let description = attributes(html, 'p')
    let inside = html.slice(html.indexOf('<dialog'), html.indexOf('</dialog>'))

    assert.equal(dialog.has('open'), false)
    assert.equal(dialog.get('aria-labelledby'), title.get('id'))
    assert.equal(dialog.get('aria-describedby'), description.get('id'))
    assert.ok(inside.includes('Command Palette') && inside.includes('Search for a command to run...'), inside)
    assert.equal(attributes(html, 'input').get('aria-labelledby'), title.get('id'), 'the input takes the dialog title')
    assert.equal(attributes(html, 'input').has('aria-label'), false)
    assert.equal(html.includes('data-slot="dialog-close"'), false, 'no close button unless asked')
  })

  it('takes your title, description and close button', async () => {
    let html = await renderToString(
      <CommandDialog title="Jump to" description="Find a page or an invoice." showCloseButton>
        <Command label="Search pages">
          <CommandInput />
          <CommandList />
        </Command>
      </CommandDialog>,
    )

    assert.ok(text(html).includes('Jump to') && text(html).includes('Find a page or an invoice.'), html)
    assert.ok(html.includes('data-slot="dialog-close"'))
    assert.equal(attributes(html, 'input').get('aria-label'), 'Search pages', 'a label you give wins over the title')
  })
})
