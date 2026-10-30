// The parts of every page that run in the browser: the navigation in a
// Sidebar, which turns into a menu sheet on a narrow screen, the header with
// the menu button and the search, and the theme switch. The page's content
// is the server's, beside this entry, so its examples hydrate on their own.
import { clientEntry, css, on } from 'remix/component'
import type { Handle, MixValue } from 'remix/component'

import { buttonVariants } from '../../../../registry/ui/button.tsx'
import { Field, FieldLabel } from '../../../../registry/ui/field.tsx'
import { RadioGroup, RadioGroupItem } from '../../../../registry/ui/radio-group.tsx'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  getSidebarContext,
} from '../../../../registry/ui/sidebar.tsx'

import { DocsSearch } from './search.tsx'
import type { SearchEntry } from './search.tsx'
import { pageTheme, themeChoices } from './theme.ts'
import type { ThemeChoice, ThemeKeeper } from './theme.ts'

export interface NavItem {
  title: string
  href: string
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

export interface DocsChromeProps {
  /** The URL of the page on screen, which the navigation marks as the current page. */
  current: string
  navigation: NavGroup[]
  search: SearchEntry[]
  home: string
  repository: string
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`

const brandStyles = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: space(2),
  minHeight: space(8),
  paddingInline: space(2),
  borderRadius: 'var(--radius-md)',
  color: 'inherit',
  fontWeight: 600,
  textDecoration: 'none',
})
const markStyles = css({
  display: 'inline-grid',
  placeItems: 'center',
  width: space(6),
  height: space(6),
  borderRadius: 'var(--radius-sm)',
  backgroundColor: 'var(--primary)',
  color: 'var(--primary-foreground)',
  fontSize: 'var(--text-xs)',
  lineHeight: 1,
  fontWeight: 700,
})
const headerStyles = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: space(2),
  minHeight: space(14),
  paddingInline: space(4),
  paddingBlock: space(2),
  borderBlockEnd: '1px solid var(--border)',
  backgroundColor: 'var(--background)',
})
// The header names the site where the sidebar doesn't: on a narrow screen,
// and while the sidebar is collapsed. Without scripting, the sidebar shows
// above the page with the name in it.
const headerBrandStyles = css({
  display: 'none',
  '&[data-shown]': { display: 'inline-flex' },
  '@media (width < 48rem) and (scripting: enabled)': { display: 'inline-flex' },
})
const spacerStyles = css({ flex: '1 1 0%' })
const themeStyles = css({ '@media (scripting: none)': { display: 'none' } })
const themeListStyles = css({ paddingInline: space(2), gap: space(2) })

const themeLabels: Record<ThemeChoice, string> = { light: 'Light', dark: 'Dark', system: 'System' }

function Brand(handle: Handle<{ href: string; shown?: boolean; mix?: MixValue }>) {
  return () => (
    <a href={handle.props.href} data-shown={handle.props.shown ? '' : undefined} mix={[brandStyles, handle.props.mix]}>
      <span mix={markStyles} aria-hidden="true">
        R
      </span>
      RemixCN
    </a>
  )
}

/** Light, dark or the system's theme, as three native radios. It shows once it runs, since only a script can apply it. */
function ThemeSwitch(handle: Handle) {
  let keeper: ThemeKeeper | undefined
  let starting = false

  return () => {
    if (!starting && typeof document !== 'undefined') {
      starting = true
      handle.queueTask(() => {
        keeper = pageTheme()
        keeper.addEventListener('change', () => void handle.update(), { signal: handle.signal })
        void handle.update()
      })
    }

    return (
      <SidebarGroup mix={themeStyles}>
        <SidebarGroupLabel id="docs-theme-label">Theme</SidebarGroupLabel>
        <RadioGroup
          aria-labelledby="docs-theme-label"
          value={keeper?.choice}
          disabled={keeper === undefined}
          mix={[
            themeListStyles,
            on('change', (event) => {
              let value = (event.target as HTMLInputElement).value
              let choice = themeChoices.find((option) => option === value)
              if (choice) keeper?.set(choice)
            }),
          ]}
        >
          {themeChoices.map((choice) => (
            <Field key={choice} orientation="horizontal">
              <RadioGroupItem id={`docs-theme-${choice}`} value={choice} />
              <FieldLabel for={`docs-theme-${choice}`}>{themeLabels[choice]}</FieldLabel>
            </Field>
          ))}
        </RadioGroup>
      </SidebarGroup>
    )
  }
}

function DocsHeader(handle: Handle<Pick<DocsChromeProps, 'home' | 'repository' | 'search'>>) {
  return () => {
    let sidebar = getSidebarContext(handle)
    let { home, repository, search } = handle.props

    return (
      <header data-docs-header="" mix={headerStyles}>
        <SidebarTrigger />
        <Brand
          href={home}
          shown={sidebar.running && (sidebar.isMobile || sidebar.state === 'collapsed')}
          mix={headerBrandStyles}
        />
        <span mix={spacerStyles} />
        <DocsSearch entries={search} />
        <a href={repository} mix={buttonVariants({ variant: 'ghost' })}>
          GitHub
        </a>
      </header>
    )
  }
}

export const DocsChrome = clientEntry(import.meta.url, function DocsChrome(handle: Handle<DocsChromeProps>) {
  return () => {
    let { current, navigation, home, repository, search } = handle.props

    return (
      <SidebarProvider data-docs-chrome="">
        <Sidebar>
          <SidebarHeader>
            <Brand href={home} />
          </SidebarHeader>
          <SidebarContent>
            <nav id="docs-navigation" aria-label="Docs" tabIndex={-1}>
              {navigation.map((group, index) => (
                <SidebarGroup key={group.title}>
                  <SidebarGroupLabel id={`docs-nav-${index}`}>{group.title}</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu aria-labelledby={`docs-nav-${index}`}>
                      {group.items.map((item) => (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton href={item.href} isActive={item.href === current}>
                            <span>{item.title}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              ))}
            </nav>
          </SidebarContent>
          <SidebarFooter>
            <ThemeSwitch />
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>
        <DocsHeader home={home} repository={repository} search={search} />
      </SidebarProvider>
    )
  }
})
