// The fixture's own theme pickers: one open from the start for the theme
// panels and screenshots, and others for two instances, a form, the window's
// edges and right-to-left text. Each counts the choices it was told about, so
// the tests can check that a choice is reported once. They are client entries
// of the fixture, not examples to copy.
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { buttonVariants } from '#remixcn/ui/button.tsx'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  dropdownMenuValueChangeType,
} from '#remixcn/ui/dropdown-menu.tsx'

const stack = css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', justifyItems: 'start', gap: '0.5rem' })
const status = css({ margin: 0, color: 'var(--muted-foreground)', fontSize: 'var(--text-sm)' })

export interface ThemeMenuProps {
  /** The trigger's text. */
  name: string
  /** The three choices' labels, in the order light, dark, system. */
  labels?: [string, string, string]
  defaultValue?: string
  defaultOpen?: boolean
  modal?: boolean
  align?: 'start' | 'center' | 'end'
}

const values = ['light', 'dark', 'system'] as const

export const ThemeMenu = clientEntry(import.meta.url, function ThemeMenu(handle: Handle<ThemeMenuProps>) {
  let value = handle.props.defaultValue ?? 'system'
  let reports = 0

  return () => {
    let { name, labels = ['Light', 'Dark', 'System'], defaultOpen, modal, align } = handle.props

    return (
      <div mix={stack}>
        <DropdownMenu defaultOpen={defaultOpen} modal={modal}>
          <DropdownMenuTrigger mix={buttonVariants({ variant: 'outline' })}>{name}</DropdownMenuTrigger>
          <DropdownMenuContent align={align}>
            <DropdownMenuRadioGroup
              aria-label={name}
              value={value}
              mix={on(dropdownMenuValueChangeType, (event) => {
                value = event.value
                reports += 1
                void handle.update()
              })}
            >
              {values.map((option, index) => (
                <DropdownMenuRadioItem key={option} value={option}>
                  {labels[index]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <p mix={status} data-status={value} data-reports={String(reports)}>
          {name}: {labels[values.indexOf(value as (typeof values)[number])]}
        </p>
      </div>
    )
  }
})
