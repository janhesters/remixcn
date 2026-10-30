// RemixCN Sidebar examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on, ref } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'

import { CheckIcon, ChevronRightIcon, EllipsisIcon, Icon, SearchIcon } from '#remixcn/lib/icons.tsx'
import type { IconProps } from '#remixcn/lib/icons.tsx'
import { visuallyHidden } from '#remixcn/lib/styles.ts'
import { Avatar, AvatarFallback } from '#remixcn/ui/avatar.tsx'
import { Popover, PopoverContent, popoverTrigger } from '#remixcn/ui/popover.tsx'
import { Separator } from '#remixcn/ui/separator.tsx'
import {
  getSidebarContext,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  sidebarMenuButtonVariants,
} from '#remixcn/ui/sidebar.tsx'
import type { SidebarChangeReason } from '#remixcn/ui/sidebar.tsx'
import { Switch } from '#remixcn/ui/switch.tsx'
import { Tooltip, TooltipContent, tooltipTrigger } from '#remixcn/ui/tooltip.tsx'

// Each example is a whole page: a sidebar beside a <main>. Each is a client
// entry, so the sidebar runs in the browser. Every link is a native link to
// `?page=…`, so navigation works before any script runs, and the page you
// render marks the current one with `current`.

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const hidden = css(visuallyHidden)

const styles = {
  header: css({
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space(2),
    minHeight: space(16),
    paddingInline: space(4),
    borderBottom: '1px solid var(--border)',
  }),
  separator: css({ alignSelf: 'center', height: space(4) }),
  title: css({
    margin: 0,
    fontSize: 'var(--text-base)',
    lineHeight: 'var(--text-base--line-height)',
    fontWeight: 500,
    overflowWrap: 'anywhere',
  }),
  body: css({
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: space(4),
    padding: space(4),
    '& > p': { margin: 0, maxWidth: '40rem', color: 'var(--muted-foreground)', overflowWrap: 'anywhere' },
  }),
  tiles: css({
    display: 'grid',
    gap: space(4),
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 12rem), 1fr))',
  }),
  tile: css({
    minHeight: space(24),
    borderRadius: 'var(--radius-xl)',
    backgroundColor: 'color-mix(in oklab, var(--muted) 50%, transparent)',
  }),
  menuButtonText: css({ display: 'grid', flex: '1 1 auto', minWidth: 0, lineHeight: 1.25 }),
  muted: css({ color: 'var(--muted-foreground)', fontSize: 'var(--text-xs)' }),
  endIcon: css({ marginInlineStart: 'auto' }),
  // Display only while open: the browser hides a closed popover with display: none, which any display here would beat.
  versions: css({ '&:popover-open': { display: 'grid' }, gap: space(1), padding: space(1), minWidth: '12rem' }),
  version: css({
    display: 'flex',
    alignItems: 'center',
    gap: space(2),
    paddingBlock: space(1.5),
    paddingInline: space(2),
    borderRadius: 'var(--radius-md)',
    color: 'inherit',
    fontSize: 'var(--text-sm)',
    textDecoration: 'none',
    '&:hover': { backgroundColor: 'var(--accent)' },
    '& svg': { marginInlineStart: 'auto', width: '1rem', height: '1rem' },
  }),
  search: css({
    position: 'relative',
    '& > svg': {
      position: 'absolute',
      insetInlineStart: space(2),
      top: '50%',
      translate: '0 -50%',
      width: '1rem',
      height: '1rem',
      opacity: 0.5,
      pointerEvents: 'none',
    },
  }),
  searchInput: css({ paddingInlineStart: space(8) }),
  grow: css({ flex: '1 1 auto' }),
  // The chevron points onward, and down while the disclosure is open.
  details: css({
    '& > summary > svg:last-child': { transition: 'rotate var(--duration-fast)' },
    '& > summary > svg:last-child:dir(rtl)': { scale: '-1 1' },
    '&[open] > summary > svg:last-child': { rotate: '90deg' },
    '&[open] > summary > svg:last-child:dir(rtl)': { rotate: '-90deg' },
  }),
  status: css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space(3) }),
  label: css({ fontSize: 'var(--text-sm)', fontWeight: 500 }),
  card: css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: space(6),
    maxWidth: '48rem',
    margin: space(6),
    padding: space(2),
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    '& > [data-slot="sidebar"]': { flex: '0 1 14rem', height: 'auto', borderRadius: 'var(--radius-lg)' },
  }),
  cardBody: css({
    flex: '1 1 16rem',
    minWidth: 0,
    padding: space(2),
    '& > h1': { marginTop: 0 },
    '& > p': { color: 'var(--muted-foreground)' },
  }),
}

function pageHref(page: string) {
  return `?page=${encodeURIComponent(page)}`
}

function PanelIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
      <path d="M3.5 9.5h17" />
    </Icon>
  )
}

function InboxIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M3.5 13.5 6 5h12l2.5 8.5V19h-17v-5.5Z" />
      <path d="M3.5 13.5h5l1 2h5l1-2h5" />
    </Icon>
  )
}

function ReceiptIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M5.5 3.5h13v17l-3-2-3.5 2-3.5-2-3 2v-17Z" />
      <path d="M9 8.5h6M9 12h6" />
    </Icon>
  )
}

function UsersIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.5-3.5 3-5.5 6.5-5.5s6 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c2 .5 3.2 2.5 3.5 5.5" />
    </Icon>
  )
}

function ChartIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M3.5 20.5h17M7 16.5v-5M12 16.5v-10M17 16.5v-7" />
    </Icon>
  )
}

function SettingsIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </Icon>
  )
}

function FolderIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M3.5 6.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-11Z" />
    </Icon>
  )
}

function PlusIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  )
}

function UpDownIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="m7.5 9 4.5-4.5L16.5 9M7.5 15l4.5 4.5 4.5-4.5" />
    </Icon>
  )
}

/** The bar at the top of the page: the trigger, a line and the page's title. */
function PageHeader(handle: Handle<{ title: string; children?: RemixNode }>) {
  return () => (
    <header mix={styles.header}>
      <SidebarTrigger />
      <Separator orientation="vertical" decorative mix={styles.separator} />
      <h1 mix={styles.title}>{handle.props.title}</h1>
      {handle.props.children}
    </header>
  )
}

/** Placeholder content for the page. */
function PageBody(handle: Handle<{ children?: RemixNode }>) {
  return () => (
    <div mix={styles.body}>
      {handle.props.children}
      <div mix={styles.tiles} aria-hidden="true">
        <div mix={styles.tile} />
        <div mix={styles.tile} />
        <div mix={styles.tile} />
      </div>
    </div>
  )
}

const docs = [
  { title: 'Getting Started', items: ['Installation', 'Project Structure'] },
  {
    title: 'Build Your Application',
    items: [
      'Routing',
      'Data Fetching',
      'Rendering',
      'Caching',
      'Styling',
      'Optimizing',
      'Configuring',
      'Testing',
      'Authentication',
      'Deploying',
      'Upgrading',
      'Examples',
    ],
  },
  {
    title: 'API Reference',
    items: ['Components', 'File Conventions', 'Functions', 'remix.config.ts Options', 'CLI', 'Edge Runtime'],
  },
  { title: 'Architecture', items: ['Accessibility', 'Fast Refresh', 'Remix Compiler', 'Supported Browsers'] },
]
const versions = ['1.0.1', '1.1.0-alpha', '2.0.0-beta1']
const slug = (title: string) => title.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')

export interface SidebarDocsProps {
  /** The slug of the page on screen, such as `data-fetching`. */
  current?: string
  /** The documentation version on screen. */
  version?: string
  /** Whether the sidebar starts expanded on a wide screen (defaults to `true`). */
  defaultOpen?: boolean
}

/**
 * shadcn's sidebar example: documentation with a version switcher, a search
 * form and long groups of links. The sidebar slides off the screen.
 */
export const SidebarDocs = clientEntry(import.meta.url, function SidebarDocs(handle: Handle<SidebarDocsProps>) {
  return () => {
    let { current = 'data-fetching', version = versions[0]!, defaultOpen = true } = handle.props
    let title = docs.flatMap((group) => group.items).find((item) => slug(item) === current) ?? 'Documentation'
    let withVersion = (page: string, next = version) => `${pageHref(page)}&version=${encodeURIComponent(next)}`

    return (
      <SidebarProvider defaultOpen={defaultOpen}>
        <Sidebar>
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <Popover>
                  <button type="button" mix={[sidebarMenuButtonVariants({ size: 'lg' }), popoverTrigger()]}>
                    <span mix={styles.menuButtonText}>
                      <span>Documentation</span>
                      <span mix={styles.muted}>v{version}</span>
                    </span>
                    <UpDownIcon />
                  </button>
                  <PopoverContent align="start" aria-label="Versions" mix={styles.versions}>
                    {versions.map((option) => (
                      <a
                        href={withVersion(current, option)}
                        aria-current={option === version ? 'true' : undefined}
                        mix={styles.version}
                      >
                        v{option}
                        {option === version ? <CheckIcon /> : null}
                      </a>
                    ))}
                  </PopoverContent>
                </Popover>
              </SidebarMenuItem>
            </SidebarMenu>
            <form role="search" mix={styles.search}>
              <input type="hidden" name="page" value={current} />
              <SidebarInput
                type="search"
                name="q"
                aria-label="Search the docs"
                placeholder="Search the docs…"
                mix={styles.searchInput}
              />
              <SearchIcon />
            </form>
          </SidebarHeader>
          <SidebarContent>
            <nav aria-label="Documentation">
              {docs.map((group) => (
                <SidebarGroup key={group.title}>
                  <SidebarGroupLabel id={`docs-${slug(group.title)}`}>{group.title}</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu aria-labelledby={`docs-${slug(group.title)}`}>
                      {group.items.map((item) => (
                        <SidebarMenuItem key={item}>
                          <SidebarMenuButton href={withVersion(slug(item))} isActive={slug(item) === current}>
                            {item}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              ))}
            </nav>
          </SidebarContent>
          <SidebarRail />
        </Sidebar>
        <SidebarInset>
          <PageHeader title={title} />
          <PageBody>
            <p>
              Version {version}. Show or hide the sidebar with the button above, a click on its edge, or Ctrl+B (⌘B on a
              Mac).
            </p>
          </PageBody>
        </SidebarInset>
      </SidebarProvider>
    )
  }
})

const mainNav = [
  { page: 'inbox', title: 'Inbox', icon: InboxIcon, badge: '24' },
  { page: 'invoices', title: 'Invoices', icon: ReceiptIcon },
  { page: 'customers', title: 'Customers', icon: UsersIcon },
  { page: 'reports', title: 'Reports', icon: ChartIcon },
]
const settingsPages = ['General', 'Team', 'Billing', 'Limits']

/**
 * A native disclosure as a menu item: the <summary> takes the menu button's
 * look, and its label shows in a tooltip while the sidebar is collapsed to
 * icons, as SidebarMenuButton's does.
 */
function DisclosureItem(handle: Handle<{ title: string; open?: boolean; icon: RemixNode; children?: RemixNode }>) {
  return () => {
    let sidebar = getSidebarContext(handle)
    let iconsOnly = sidebar.state === 'collapsed' && !sidebar.isMobile
    let { title, open = false, icon, children } = handle.props

    return (
      <SidebarMenuItem>
        <Tooltip disabled={!iconsOnly}>
          <details open={open} mix={styles.details}>
            <summary mix={[sidebarMenuButtonVariants(), tooltipTrigger({ describe: false })]}>
              {icon}
              <span mix={styles.grow}>{title}</span>
              <ChevronRightIcon />
            </summary>
            {children}
          </details>
          <TooltipContent side="right" aria-hidden="true">
            {title}
          </TooltipContent>
        </Tooltip>
      </SidebarMenuItem>
    )
  }
}

export interface SidebarIconsProps {
  /** The page on screen, such as `invoices` or `settings/billing`. */
  current?: string
  /** Whether the sidebar starts expanded on a wide screen (defaults to `true`). */
  defaultOpen?: boolean
}

/**
 * An app's sidebar that collapses to icons, whose labels then show in
 * tooltips: a badge, a submenu in a native disclosure, projects you add and
 * remove with actions beside their rows, and the account in the footer.
 */
export const SidebarIcons = clientEntry(import.meta.url, function SidebarIcons(handle: Handle<SidebarIconsProps>) {
  let projects = ['Atlas', 'Borealis', 'Cygnus']
  let status = ''
  let list: HTMLElement | null = null

  // The first free number from the list's next place on, so every name stays unique.
  function nextName() {
    let number = projects.length + 1
    while (projects.includes(`Project ${number}`)) number++
    return `Project ${number}`
  }

  async function addProject() {
    let name = nextName()
    projects = [...projects, name]
    status = `Added ${name}.`
    await handle.update()
  }

  // The row that took the removed one's place, else the one before it, else the add button, gets focus.
  async function removeProject(index: number) {
    let name = projects[index]
    projects = projects.filter((_, at) => at !== index)
    status = `Removed ${name}.`
    await handle.update()
    let rows = list?.querySelectorAll<HTMLElement>('[data-sidebar="menu-button"]') ?? []
    let next =
      rows[Math.min(index, rows.length - 1)] ??
      list?.closest('[data-slot="sidebar-group"]')?.querySelector<HTMLElement>('[data-slot="sidebar-group-action"]')
    next?.focus()
  }

  return () => {
    let { current = 'inbox', defaultOpen = true } = handle.props
    let title =
      mainNav.find((item) => item.page === current)?.title ??
      settingsPages.find((page) => `settings/${slug(page)}` === current) ??
      projects.find((project) => `projects/${slug(project)}` === current) ??
      'Inbox'

    return (
      <SidebarProvider defaultOpen={defaultOpen}>
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton href={pageHref('inbox')} size="lg" tooltip="Northwind Billing">
                  <Avatar>
                    <AvatarFallback>NB</AvatarFallback>
                  </Avatar>
                  <span mix={styles.menuButtonText}>
                    <span>Northwind Billing</span>
                    <span mix={styles.muted}>Team plan</span>
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            <nav aria-label="Main">
              <SidebarGroup>
                <SidebarGroupLabel id="northwind-platform">Platform</SidebarGroupLabel>
                <SidebarMenu aria-labelledby="northwind-platform">
                  {mainNav.map((item) => (
                    <SidebarMenuItem key={item.page}>
                      <SidebarMenuButton
                        href={pageHref(item.page)}
                        isActive={item.page === current}
                        tooltip={item.title}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                      {item.badge ? (
                        <SidebarMenuBadge>
                          {item.badge}
                          <span mix={hidden}> unread</span>
                        </SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  ))}
                  <DisclosureItem title="Settings" icon={<SettingsIcon />} open={current.startsWith('settings/')}>
                    <SidebarMenuSub>
                      {settingsPages.map((page) => (
                        <SidebarMenuSubItem key={page}>
                          <SidebarMenuSubButton
                            href={pageHref(`settings/${slug(page)}`)}
                            isActive={current === `settings/${slug(page)}`}
                          >
                            {page}
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </DisclosureItem>
                </SidebarMenu>
              </SidebarGroup>
              <SidebarGroup>
                <SidebarGroupLabel id="northwind-projects">Projects</SidebarGroupLabel>
                <SidebarGroupAction mix={on('click', () => void addProject())}>
                  <PlusIcon />
                  <span mix={hidden}>Add project</span>
                </SidebarGroupAction>
                <SidebarMenu aria-labelledby="northwind-projects" mix={ref((node) => (list = node))}>
                  {projects.map((project, index) => (
                    <SidebarMenuItem key={project}>
                      <SidebarMenuButton
                        href={pageHref(`projects/${slug(project)}`)}
                        isActive={current === `projects/${slug(project)}`}
                        tooltip={project}
                      >
                        <FolderIcon />
                        <span>{project}</span>
                      </SidebarMenuButton>
                      <SidebarMenuAction showOnHover mix={on('click', () => void removeProject(index))}>
                        <EllipsisIcon />
                        <span mix={hidden}>Remove {project}</span>
                      </SidebarMenuAction>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            </nav>
            <p role="status" mix={hidden}>
              {status}
            </p>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton href={pageHref('account')} size="lg" tooltip="Mia Chen">
                  <Avatar>
                    <AvatarFallback>MC</AvatarFallback>
                  </Avatar>
                  <span mix={styles.menuButtonText}>
                    <span>Mia Chen</span>
                    <span mix={styles.muted}>mia.chen@northwind.example</span>
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>
        <SidebarInset>
          <PageHeader title={title} />
          <PageBody>
            <p>Collapse the sidebar to icons with the button or Ctrl+B. Each icon then shows its label in a tooltip.</p>
          </PageBody>
        </SidebarInset>
      </SidebarProvider>
    )
  }
})

/** A short menu for the variant examples. */
function ShortMenu(handle: Handle<{ current: string; label: string }>) {
  return () => (
    <SidebarGroup>
      <SidebarGroupLabel>{handle.props.label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {mainNav.map((item) => (
            <SidebarMenuItem key={item.page}>
              <SidebarMenuButton
                href={pageHref(item.page)}
                isActive={item.page === handle.props.current}
                tooltip={item.title}
              >
                <item.icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

/** A floating sidebar on the right, which collapses to icons. */
export const SidebarFloatingRight = clientEntry(
  import.meta.url,
  function SidebarFloatingRight(handle: Handle<{ current?: string }>) {
    return () => {
      let { current = 'inbox' } = handle.props
      return (
        <SidebarProvider>
          <SidebarInset>
            <PageHeader title="Floating on the right" />
            <PageBody>
              <p>
                The sidebar floats on the right edge and collapses to icons. On a narrow screen its sheet opens from the
                right.
              </p>
            </PageBody>
          </SidebarInset>
          <Sidebar side="right" variant="floating" collapsible="icon">
            <SidebarContent>
              <nav aria-label="Main">
                <ShortMenu current={current} label="Billing" />
              </nav>
            </SidebarContent>
            <SidebarRail />
          </Sidebar>
        </SidebarProvider>
      )
    }
  },
)

/** The inset variant: the page sits in a rounded panel beside the sidebar. */
export const SidebarInsetLayout = clientEntry(
  import.meta.url,
  function SidebarInsetLayout(handle: Handle<{ current?: string }>) {
    return () => {
      let { current = 'invoices' } = handle.props
      return (
        <SidebarProvider>
          <Sidebar variant="inset">
            <SidebarHeader>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton href={pageHref('inbox')} size="lg">
                    <PanelIcon />
                    <span>Northwind Billing</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
              <nav aria-label="Main">
                <ShortMenu current={current} label="Billing" />
              </nav>
            </SidebarContent>
            <SidebarSeparator />
            <SidebarFooter>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton href={pageHref('settings/general')} size="sm">
                    <SettingsIcon />
                    <span>Settings</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarFooter>
          </Sidebar>
          <SidebarInset>
            <PageHeader title="Inset" />
            <PageBody>
              <p>The page sits in a rounded panel. Collapsed, the sidebar slides away and the panel takes the room.</p>
            </PageBody>
          </SidebarInset>
        </SidebarProvider>
      )
    }
  },
)

/**
 * A sidebar you control: a switch in the page shows and hides it, the
 * page says what changed it last, and the keyboard shortcut is off. It's
 * 20rem wide. Keep `open` wherever you like, such as in a cookie your server
 * reads, to remember it between visits.
 */
export const SidebarControlled = clientEntry(
  import.meta.url,
  function SidebarControlled(handle: Handle<{ current?: string; defaultOpen?: boolean }>) {
    let open = handle.props.defaultOpen ?? true
    let reason: SidebarChangeReason | 'switch' | undefined

    return () => {
      let { current = 'reports' } = handle.props
      return (
        <SidebarProvider
          open={open}
          keyboardShortcut={false}
          style={{ '--sidebar-width': '20rem' }}
          onOpenChange={(next, details) => {
            open = next
            reason = details.reason
            void handle.update()
          }}
        >
          <Sidebar>
            <SidebarContent>
              <nav aria-label="Main">
                <ShortMenu current={current} label="Billing" />
              </nav>
            </SidebarContent>
            <SidebarRail />
          </Sidebar>
          <SidebarInset>
            <PageHeader title="Controlled">
              <span mix={styles.status}>
                <Switch
                  id="sidebar-controlled-switch"
                  checked={open}
                  mix={on('change', (event) => {
                    open = event.currentTarget.checked
                    reason = 'switch'
                    void handle.update()
                  })}
                />
                <label for="sidebar-controlled-switch" mix={styles.label}>
                  Show sidebar
                </label>
              </span>
            </PageHeader>
            <PageBody>
              <p role="status">
                The sidebar is {open ? 'expanded' : 'collapsed'}
                {reason ? `, changed by ${reason}` : ''}. Ctrl+B does nothing here: the shortcut is off.
              </p>
            </PageBody>
          </SidebarInset>
        </SidebarProvider>
      )
    }
  },
)

const settingsNav = ['Profile', 'Billing', 'Notifications', 'Security']

/**
 * A sidebar that never collapses, as a settings page's navigation inside a
 * card, with a group whose items still load.
 */
export const SidebarSettings = clientEntry(
  import.meta.url,
  function SidebarSettings(handle: Handle<{ current?: string }>) {
    return () => {
      let { current = 'profile' } = handle.props
      let title = settingsNav.find((item) => slug(item) === current) ?? 'Profile'
      return (
        <SidebarProvider>
          <div mix={styles.card}>
            <Sidebar collapsible="none" aria-label="Settings">
              <SidebarContent>
                <SidebarGroup>
                  <SidebarGroupLabel>Account</SidebarGroupLabel>
                  <SidebarMenu>
                    {settingsNav.map((item) => (
                      <SidebarMenuItem key={item}>
                        <SidebarMenuButton href={pageHref(slug(item))} isActive={slug(item) === current}>
                          {item}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroup>
                <SidebarGroup>
                  <SidebarGroupLabel id="settings-teams">Teams</SidebarGroupLabel>
                  <SidebarMenu aria-labelledby="settings-teams" aria-busy="true">
                    {[0, 1, 2].map((index) => (
                      <SidebarMenuItem key={index}>
                        <SidebarMenuSkeleton showIcon />
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                  <p mix={hidden}>Loading teams</p>
                </SidebarGroup>
              </SidebarContent>
            </Sidebar>
            <div mix={styles.cardBody}>
              <h1 mix={styles.title}>{title}</h1>
              <p>
                A sidebar that never collapses keeps its width, also on a narrow screen, so it sits beside the content
                until the card wraps.
              </p>
            </div>
          </div>
        </SidebarProvider>
      )
    }
  },
)
