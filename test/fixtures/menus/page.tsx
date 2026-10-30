// The Dropdown Menu, Context Menu, Menubar and Navigation Menu examples on
// one synthetic page, with right-to-left text and parts the server renders
// outside any client entry, and a second page with menus open from the start
// in both themes. It is a test fixture for browser tests and UI reviews, not
// the public site.
import { css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'
import type { ImportMapData } from 'remix/component/server'

import {
  ContextMenuBasic,
  ContextMenuOnRows,
  ContextMenuSides,
  ContextMenuWithGroups,
  ContextMenuWithIcons,
} from '../../../registry/examples/context-menu-example.tsx'
import {
  DropdownMenuBasic,
  DropdownMenuComplex,
  DropdownMenuInDialog,
  DropdownMenuSides,
  DropdownMenuWithAvatar,
  DropdownMenuWithCheckboxes,
  DropdownMenuWithDestructive,
  DropdownMenuWithIcons,
  DropdownMenuWithInset,
  DropdownMenuWithRadio,
  DropdownMenuWithSubmenu,
} from '../../../registry/examples/dropdown-menu-example.tsx'
import { MenubarBasic, MenubarSides, MenubarVertical } from '../../../registry/examples/menubar-example.tsx'
import {
  NavigationMenuBasic,
  NavigationMenuVertical,
  NavigationMenuWithIndicator,
} from '../../../registry/examples/navigation-menu-example.tsx'
import { buttonVariants } from '#remixcn/ui/button.tsx'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#remixcn/ui/dropdown-menu.tsx'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '#remixcn/ui/navigation-menu.tsx'
import { OpenDropdownMenu, OpenMenubar, OpenNavigationMenu } from './open.tsx'

interface ScriptEntry {
  href: string
  importMap: ImportMapData
  preloads: readonly string[]
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const shrinkingColumn = 'minmax(0, 1fr)'

const pageStyles = css({
  maxWidth: '72rem',
  marginInline: 'auto',
  padding: space(6),
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  gap: space(12),
  '@media (max-width: 40rem)': { padding: space(4), gap: space(10) },
})
const headerStyles = css({
  display: 'grid',
  gap: space(2),
  '& p': { margin: 0, maxWidth: '40rem', overflowWrap: 'anywhere' },
})
const titleStyles = css({
  margin: 0,
  fontSize: 'var(--text-3xl)',
  lineHeight: 'var(--text-3xl--line-height)',
  fontWeight: 600,
  letterSpacing: '-0.025em',
  overflowWrap: 'anywhere',
})
const sectionStyles = css({ display: 'grid', gridTemplateColumns: shrinkingColumn, gap: space(6) })
const sectionTitleStyles = css({
  margin: 0,
  fontSize: 'var(--text-xl)',
  lineHeight: 'var(--text-xl--line-height)',
  fontWeight: 600,
})
const gridStyles = css({
  display: 'grid',
  gap: space(6),
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 22rem), 1fr))',
})
const exampleStyles = css({
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  alignContent: 'start',
  justifyItems: 'start',
  gap: space(3),
  margin: 0,
  padding: space(5),
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  '& > h3': { margin: 0, fontSize: 'var(--text-base)', lineHeight: 'var(--text-base--line-height)', fontWeight: 600 },
  '& > :last-child': { justifySelf: 'stretch' },
})
const wideStyles = css({ gridColumn: '1 / -1' })
const mutedStyles = css({
  margin: 0,
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
})
// Room below the trigger for the menu that is open from the start.
const roomBelow = (rem: number) => css({ minHeight: `${rem}rem` })
const themesStyles = css({
  display: 'grid',
  gap: space(6),
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 30rem), 1fr))',
})
const themePanelStyles = css({
  display: 'grid',
  gridTemplateColumns: shrinkingColumn,
  gap: space(5),
  alignContent: 'start',
  padding: space(6),
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  backgroundColor: 'var(--background)',
  color: 'var(--foreground)',
  '& h3': { margin: 0, fontSize: 'var(--text-base)', fontWeight: 600 },
})

function Section(handle: Handle<{ id: string; title: string; description: string; children?: RemixNode }>) {
  return () => {
    let { id, title, description, children } = handle.props

    return (
      <section aria-labelledby={id} mix={sectionStyles}>
        <h2 id={id} mix={sectionTitleStyles}>
          {title}
        </h2>
        <p mix={mutedStyles}>{description}</p>
        {children}
      </section>
    )
  }
}

function Example(
  handle: Handle<{ title: string; name: string; description?: string; wide?: boolean; children?: RemixNode }>,
) {
  return () => {
    let { title, name, description, wide, children } = handle.props

    return (
      <figure mix={[exampleStyles, wide ? wideStyles : null]} data-example={name}>
        <h3>{title}</h3>
        {description ? <p mix={mutedStyles}>{description}</p> : null}
        {children}
      </figure>
    )
  }
}

function Document(handle: Handle<{ title: string; stylesheets: string[]; script: ScriptEntry; children?: RemixNode }>) {
  return () => {
    let { title, stylesheets, script, children } = handle.props

    return (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content="light dark" />
          {stylesheets.map((href) => (
            <link key={href} rel="stylesheet" href={href} />
          ))}
          <title>{title}</title>
          <ImportMap value={script.importMap} />
          {script.preloads.map((href) => (
            <link key={href} rel="modulepreload" href={href} />
          ))}
          <script type="module" src={script.href}></script>
        </head>
        <body>{children}</body>
      </html>
    )
  }
}

function Header(handle: Handle<{ children?: RemixNode }>) {
  return () => (
    <header mix={headerStyles}>
      <h1 mix={titleStyles}>Dropdown Menu, Context Menu, Menubar and Navigation Menu</h1>
      {handle.props.children}
      <p mix={mutedStyles}>A synthetic test fixture with invented data, not the public site.</p>
    </header>
  )
}

export function MenuExamples(handle: Handle<{ stylesheets: string[]; script: ScriptEntry }>) {
  return () => (
    <Document
      title="RemixCN Dropdown Menu, Context Menu, Menubar and Navigation Menu examples"
      stylesheets={handle.props.stylesheets}
      script={handle.props.script}
    >
      <main mix={pageStyles}>
        <Header>
          <p>Every example from registry/examples, rendered on the server and hydrated as client entries.</p>
        </Header>

        <Section
          id="dropdown-menu"
          title="Dropdown Menu"
          description="A click, Enter, Space or Arrow Down opens it. The arrows, Home, End and typing move; Escape, Tab and a press elsewhere close it."
        >
          <div mix={gridStyles}>
            <Example title="Basic" name="dropdown-basic">
              <DropdownMenuBasic />
            </Example>
            <Example title="Sides" name="dropdown-sides" wide>
              <DropdownMenuSides />
            </Example>
            <Example title="With icons and shortcuts" name="dropdown-icons">
              <DropdownMenuWithIcons />
            </Example>
            <Example title="With submenu" name="dropdown-submenu" description="Hover, a click or Arrow Right opens it.">
              <DropdownMenuWithSubmenu />
            </Example>
            <Example title="With checkboxes" name="dropdown-checkboxes">
              <DropdownMenuWithCheckboxes />
            </Example>
            <Example title="With radio group" name="dropdown-radio">
              <DropdownMenuWithRadio />
            </Example>
            <Example title="With destructive item" name="dropdown-destructive">
              <DropdownMenuWithDestructive />
            </Example>
            <Example title="With avatar" name="dropdown-avatar">
              <DropdownMenuWithAvatar />
            </Example>
            <Example title="With inset" name="dropdown-inset">
              <DropdownMenuWithInset />
            </Example>
            <Example title="Complex" name="dropdown-complex">
              <DropdownMenuComplex />
            </Example>
            <Example title="In dialog" name="dropdown-dialog" description="Escape closes the menu, then the dialog.">
              <DropdownMenuInDialog />
            </Example>
          </div>
        </Section>

        <Section
          id="context-menu"
          title="Context Menu"
          description="A right click, Shift+F10, the Context Menu key or a held touch opens it where it happened."
        >
          <div mix={gridStyles}>
            <Example title="Basic" name="context-basic">
              <ContextMenuBasic />
            </Example>
            <Example title="With icons and shortcuts" name="context-icons">
              <ContextMenuWithIcons />
            </Example>
            <Example title="With groups" name="context-groups">
              <ContextMenuWithGroups />
            </Example>
            <Example title="Sides" name="context-sides" wide>
              <ContextMenuSides />
            </Example>
            <Example title="On table rows" name="context-rows" wide>
              <ContextMenuOnRows />
            </Example>
          </div>
        </Section>

        <Section
          id="menubar"
          title="Menubar"
          description="The arrows move between the buttons and from menu to menu. Once a menu is open, the pointer opens the others."
        >
          <div mix={gridStyles}>
            <Example title="Basic" name="menubar-basic" wide>
              <MenubarBasic />
            </Example>
            <Example title="Sides" name="menubar-sides" wide>
              <MenubarSides />
            </Example>
            <Example title="Vertical" name="menubar-vertical">
              <MenubarVertical />
            </Example>
          </div>
        </Section>

        <Section
          id="navigation-menu"
          title="Navigation Menu"
          description="Resting the pointer on a button, a click or Enter shows its panel. The links stay links."
        >
          <div mix={gridStyles}>
            <Example title="Basic" name="navigation-basic" wide>
              <NavigationMenuBasic />
            </Example>
            <Example title="With indicator" name="navigation-indicator">
              <NavigationMenuWithIndicator />
            </Example>
            <Example title="Vertical" name="navigation-vertical">
              <NavigationMenuVertical />
            </Example>
          </div>
        </Section>

        <Section
          id="right-to-left"
          title="Right to left"
          description="Submenus open to the left, and the arrows that open and close them swap."
        >
          <div dir="rtl" lang="ar" mix={gridStyles}>
            <Example title="قائمة فرعية" name="rtl-dropdown-submenu">
              <DropdownMenuWithSubmenu />
            </Example>
            <Example title="قائمة السياق" name="rtl-context-basic">
              <ContextMenuBasic />
            </Example>
            <Example title="شريط القوائم" name="rtl-menubar-basic" wide>
              <MenubarBasic />
            </Example>
            <Example title="التنقل" name="rtl-navigation-basic" wide>
              <NavigationMenuBasic />
            </Example>
          </div>
        </Section>

        <Section
          id="server-only"
          title="Server only"
          description="Rendered by the page, outside any client entry, so no component code runs in the browser."
        >
          <div mix={gridStyles}>
            <Example
              title="Dropdown Menu"
              name="server-dropdown"
              description="The browser opens it natively, in the middle of the screen, and its links work."
            >
              <DropdownMenu>
                <DropdownMenuTrigger mix={buttonVariants({ variant: 'outline' })}>Help</DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLinkItem href="#guides">Guides</DropdownMenuLinkItem>
                  <DropdownMenuLinkItem href="#contact">Contact us</DropdownMenuLinkItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Keyboard shortcuts</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </Example>
            <Example
              title="Navigation Menu"
              name="server-navigation"
              description="Its links work, and its button opens the panel natively."
            >
              <NavigationMenu aria-label="Server only">
                <NavigationMenuList>
                  <NavigationMenuItem>
                    <NavigationMenuTrigger>Reports</NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <NavigationMenuLink href="#revenue">Revenue</NavigationMenuLink>
                      <NavigationMenuLink href="#tax">Tax</NavigationMenuLink>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                  <NavigationMenuItem>
                    <NavigationMenuLink href="#settings">Settings</NavigationMenuLink>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>
            </Example>
          </div>
        </Section>
      </main>
    </Document>
  )
}

/** A menu of each family open from the start, with room below it for the menu. */
function OpenSet(handle: Handle<{ prefix: string }>) {
  return () => {
    let { prefix } = handle.props

    return (
      <div mix={gridStyles}>
        <Example title="Dropdown Menu" name={`${prefix}-dropdown`}>
          <div mix={roomBelow(17)}>
            <OpenDropdownMenu />
          </div>
        </Example>
        <Example title="Menubar" name={`${prefix}-menubar`}>
          <div mix={roomBelow(10)}>
            <OpenMenubar />
          </div>
        </Example>
        <Example title="Navigation Menu" name={`${prefix}-navigation`}>
          <div mix={roomBelow(10)}>
            <OpenNavigationMenu />
          </div>
        </Example>
      </div>
    )
  }
}

export function OpenMenus(handle: Handle<{ stylesheets: string[]; script: ScriptEntry }>) {
  return () => (
    <Document title="RemixCN menus, open" stylesheets={handle.props.stylesheets} script={handle.props.script}>
      <main mix={pageStyles}>
        <Header>
          <p>A menu of each family, open from the start, in both themes and in right-to-left text.</p>
        </Header>

        <Section id="open" title="Open" description="They show in the top layer, next to their triggers.">
          <OpenSet prefix="open" />
        </Section>

        <Section id="themes" title="Themes" description="data-theme overrides the system preference inside it.">
          <div mix={themesStyles}>
            {(['light', 'dark'] as const).map((theme) => (
              <div key={theme} data-theme={theme} mix={themePanelStyles}>
                <h3>{theme === 'light' ? 'Light' : 'Dark'}</h3>
                <OpenSet prefix={theme} />
              </div>
            ))}
          </div>
        </Section>

        <Section id="right-to-left" title="Right to left" description="Submenus open to the left of their items.">
          <div dir="rtl" lang="ar">
            <OpenSet prefix="rtl" />
          </div>
        </Section>
      </main>
    </Document>
  )
}
