// Menus open from the start, for the screenshots and the end-to-end tests:
// client entries of the fixture, not examples to copy. They leave the page
// usable, so several can be open at once.
import { clientEntry, css } from 'remix/component'

import { buttonVariants } from '#remixcn/ui/button.tsx'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '#remixcn/ui/dropdown-menu.tsx'
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from '#remixcn/ui/menubar.tsx'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '#remixcn/ui/navigation-menu.tsx'

const menuWidth = css({ width: '14rem' })

export const OpenDropdownMenu = clientEntry(import.meta.url, function OpenDropdownMenu() {
  return () => (
    <DropdownMenu defaultOpen modal={false}>
      <DropdownMenuTrigger mix={buttonVariants({ variant: 'outline' })}>Invoice INV-2041</DropdownMenuTrigger>
      <DropdownMenuContent finalFocus={false} mix={menuWidth}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Invoice</DropdownMenuLabel>
          <DropdownMenuItem>
            Edit
            <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem disabled>Duplicate</DropdownMenuItem>
          <DropdownMenuSub defaultOpen>
            <DropdownMenuSubTrigger>Send to</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Billing contact</DropdownMenuItem>
              <DropdownMenuItem>Accounts payable</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem defaultChecked>Remind when overdue</DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">Void invoice</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
})

export const OpenMenubar = clientEntry(import.meta.url, function OpenMenubar() {
  return () => (
    <Menubar modal={false}>
      <MenubarMenu defaultOpen>
        <MenubarTrigger>View</MenubarTrigger>
        <MenubarContent finalFocus={false}>
          <MenubarRadioGroup defaultValue="month">
            <MenubarRadioItem value="week">By week</MenubarRadioItem>
            <MenubarRadioItem value="month">By month</MenubarRadioItem>
          </MenubarRadioGroup>
          <MenubarSeparator />
          <MenubarItem>
            Refresh <MenubarShortcut>⌘R</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Help</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>Guides</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  )
})

export const OpenNavigationMenu = clientEntry(import.meta.url, function OpenNavigationMenu() {
  return () => (
    <NavigationMenu aria-label="Open example" defaultValue="reports">
      <NavigationMenuList>
        <NavigationMenuItem value="reports">
          <NavigationMenuTrigger>Reports</NavigationMenuTrigger>
          <NavigationMenuContent>
            <NavigationMenuLink href="#revenue" active>
              Revenue
            </NavigationMenuLink>
            <NavigationMenuLink href="#outstanding">Outstanding</NavigationMenuLink>
            <NavigationMenuLink href="#tax">Tax</NavigationMenuLink>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink href="#settings">Settings</NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  )
})
