// RemixCN Native Select: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css, on, ref } from 'remix/component'
import type { Handle, Props, RemixNode } from 'remix/component'

import { ariaStates } from '#remixcn/lib/aria.ts'
import { ChevronDownIcon } from '#remixcn/lib/icons.tsx'
import { fieldItem, invalidState, mergeStyles, transition } from '#remixcn/lib/styles.ts'

export type NativeSelectSize = 'sm' | 'default'

export interface NativeSelectProps extends Omit<Props<'select'>, 'size' | 'value' | 'defaultValue' | 'mix' | 'role'> {
  /** The height: 2.25rem by default, or 2rem. It replaces the native size attribute, as in shadcn. */
  size?: NativeSelectSize
  /**
   * The starting choice, or choices of a multiple select. Its option is
   * selected in the server HTML, and a form reset returns to it. A choice the
   * user makes before the page's script runs stays. Changing it later writes
   * the options' selected attributes again, which the browser shows unless
   * the user picked that option.
   */
  defaultValue?: string | readonly string[]
  /**
   * The controlled choice. Every render selects its options, and after a
   * change the select returns to it, so it shows only this value: change it
   * when the select fires change.
   */
  value?: string | readonly string[]
  /** Mixins for the wrapper, which sizes the select; class and style go there too. */
  mix?: Props<'div'>['mix']
}

interface SelectState {
  values?: readonly string[]
  controlled: boolean
}

const onServer = typeof document === 'undefined'
const space = (steps: number) => `calc(var(--spacing) * ${steps})`

function list(value: string | readonly string[] | undefined) {
  return typeof value === 'string' ? [value] : value
}

// An option without a value submits its text, with whitespace collapsed, as the browser does.
function optionText(children: RemixNode): string | undefined {
  let parts = Array.isArray(children) ? children : [children]
  if (!parts.every((part) => typeof part === 'string' || typeof part === 'number')) return undefined
  return parts.join('').trim().replace(/\s+/g, ' ')
}

const wrapperRule = css(
  mergeStyles(
    {
      position: 'relative',
      width: 'fit-content',
      maxWidth: '100%',
      minWidth: 0,
      '&:has(> select:disabled)': { opacity: 0.5 },
    },
    fieldItem,
  ),
)

const selectRule = css(
  mergeStyles(
    {
      display: 'block',
      width: '100%',
      minWidth: 0,
      minHeight: space(9),
      margin: 0,
      paddingBlock: space(1),
      paddingInlineStart: space(2.5),
      paddingInlineEnd: space(8),
      appearance: 'none',
      border: '1px solid var(--input)',
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'light-dark(transparent, color-mix(in oklab, var(--input) 30%, transparent))',
      boxShadow: 'var(--shadow-xs)',
      fontSize: 'var(--text-sm)',
      lineHeight: 'var(--text-sm--line-height)',
      userSelect: 'none',
      '&[data-size="sm"]': { minHeight: space(8) },
      '&[multiple]': { paddingInlineEnd: space(2.5) },
      '&:hover:not(:disabled)': {
        backgroundColor: 'light-dark(transparent, color-mix(in oklab, var(--input) 50%, transparent))',
      },
      '&:focus-visible': { borderColor: 'var(--ring)' },
      // The wrapper dims a disabled select, so the select only changes its cursor.
      // Chromium dims a disabled select itself too, so its own opacity stays 1.
      '&:disabled': { cursor: 'not-allowed', opacity: 1 },
    },
    transition('color', 'background-color', 'border-color', 'box-shadow'),
    invalidState,
  ),
)

const iconRule = css({
  position: 'absolute',
  insetBlockStart: '50%',
  insetInlineEnd: space(2.5),
  display: 'flex',
  translate: '0 -50%',
  color: 'var(--muted-foreground)',
  pointerEvents: 'none',
  userSelect: 'none',
  '& > svg': { width: '1rem', height: '1rem' },
  // A multiple select is a list box, without a menu to point at.
  ':where([data-slot="native-select-wrapper"]:has(> select[multiple])) > &': { display: 'none' },
})

// Options take the system colors, so the browser's list of them stays readable in either scheme.
const optionRule = css({ backgroundColor: 'Canvas', color: 'CanvasText' })

/**
 * A native select with a chevron. The browser draws its list, so it works
 * with the keyboard, on touch screens and before any script runs. Native
 * attributes, ids and ARIA go to the select; mix, class and style go to the
 * wrapper, which sizes it.
 */
export function NativeSelect(handle: Handle<NativeSelectProps, SelectState>) {
  let controlledValues: readonly string[] | undefined

  // The browser has already moved the choice when change fires. After the
  // owner's handlers ran, the options go back to the latest controlled value:
  // a choice the owner took renders next and selects them again, and one it
  // declined is gone. Remix's own reflection covers only a single value.
  let restore = on<HTMLSelectElement, 'change'>('change', (event) => {
    let select = event.currentTarget
    queueMicrotask(() => {
      if (!controlledValues) return
      for (let option of select.options) option.selected = controlledValues.includes(option.value)
    })
  })

  return () => {
    let { size = 'default', value, defaultValue, mix, class: className, style, children, ...props } = handle.props
    let controlled = value !== undefined
    controlledValues = controlled ? list(value) : undefined
    handle.context.set({ values: list(controlled ? value : defaultValue), controlled })

    return (
      <div data-slot="native-select-wrapper" data-size={size} class={className} style={style} mix={[wrapperRule, mix]}>
        <select data-slot="native-select" data-size={size} {...ariaStates(props)} mix={[selectRule, restore]}>
          {children}
        </select>
        <span data-slot="native-select-icon" aria-hidden="true" mix={iconRule}>
          <ChevronDownIcon />
        </span>
      </div>
    )
  }
}

/**
 * An option. Inside a NativeSelect with a value or defaultValue, it is
 * selected when its value, or its text without one, matches. Its own
 * selected prop wins.
 */
export function NativeSelectOption(handle: Handle<Props<'option'>>) {
  let element: HTMLOptionElement | undefined
  let rememberElement = ref<HTMLOptionElement>((node) => (element = node))

  return () => {
    let { mix, ...props } = handle.props
    let select = handle.context.get(NativeSelect)
    let own = props.value === undefined ? optionText(props.children) : String(props.value)
    let matches =
      props.selected === undefined && select?.values && own !== undefined ? select.values.includes(own) : undefined
    let selected = matches !== undefined && (select?.controlled || onServer) ? { selected: matches } : {}

    // A default in the browser writes the selected attribute only when it
    // differs. So hydration leaves the server's attribute, and the choice a
    // user or the browser's autofill made before it, as they are.
    if (matches !== undefined && !select?.controlled && !onServer) {
      handle.queueTask(() => {
        if (element && element.defaultSelected !== matches) element.defaultSelected = matches
      })
    }

    return <option data-slot="native-select-option" {...props} {...selected} mix={[optionRule, rememberElement, mix]} />
  }
}

/** A labelled group of options. */
export function NativeSelectOptGroup(handle: Handle<Props<'optgroup'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <optgroup data-slot="native-select-optgroup" {...props} mix={[optionRule, mix]} />
  }
}
