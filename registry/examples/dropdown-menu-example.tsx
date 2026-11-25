// RemixCN Dropdown Menu examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md

// A theme picker, after shadcn's Radio Group example in
// dropdown-menu-example.tsx. It's a client entry, so its menu runs in the
// browser. Until then, and without JavaScript, the trigger opens the menu
// natively in the middle of the screen, where the choices do nothing.
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { Icon } from '#remixcn/lib/icons.tsx'
import type { IconProps } from '#remixcn/lib/icons.tsx'
import { buttonVariants } from '#remixcn/ui/button.tsx'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  dropdownMenuValueChangeType,
} from '#remixcn/ui/dropdown-menu.tsx'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const styles = {
  stack: css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', justifyItems: 'start', gap: space(2) }),
  status: css({
    margin: 0,
    color: 'var(--muted-foreground)',
    fontSize: 'var(--text-sm)',
    lineHeight: 'var(--text-sm--line-height)',
  }),
}

function SunIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon label={handle.props.label}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </Icon>
  )
}

function MoonIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon label={handle.props.label}>
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </Icon>
  )
}

function ScreenIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon label={handle.props.label}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8.5 20h7M12 16v4" />
    </Icon>
  )
}

const themes = [
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon },
  { value: 'system', label: 'System', icon: ScreenIcon },
] as const

/**
 * A theme picker on an icon button: Light, Dark or System, with a check mark
 * on the current one. Choosing one closes the menu and returns focus to the
 * button. An app would save the choice and set the theme; this one only
 * shows it.
 */
export const DropdownMenuThemePicker = clientEntry(import.meta.url, function DropdownMenuThemePicker(handle: Handle) {
  let theme = 'system'

  return () => {
    let current = themes.find((option) => option.value === theme) ?? themes[2]
    let CurrentIcon = current.icon

    return (
      <div mix={styles.stack}>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Theme: ${current.label}`}
            mix={buttonVariants({ variant: 'outline', size: 'icon' })}
          >
            <CurrentIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              aria-label="Theme"
              value={theme}
              mix={on(dropdownMenuValueChangeType, (event) => {
                theme = event.value
                void handle.update()
              })}
            >
              {themes.map(({ value, label, icon: ThemeIcon }) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  <ThemeIcon />
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <p mix={styles.status}>Theme: {current.label}</p>
      </div>
    )
  }
})
