// RemixCN Direction: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css } from 'remix/component'
import type { Handle, Props } from 'remix/component'

export type Direction = 'ltr' | 'rtl'

export interface DirectionProviderProps extends Props<'div'> {
  /** The text direction of everything inside. Left to right by default. */
  direction?: Direction
}

export interface DirectionContext {
  direction: Direction
}

// The provider adds no box, so wrapping content never changes its layout.
// Its dir attribute still sets the direction its descendants inherit.
const providerRule = css({ display: 'contents' })

/**
 * Sets the text direction of its subtree with the native dir attribute, so
 * the browser lays out text, logical properties and :dir() selectors for it,
 * also before any script runs. A nested provider sets its own direction for
 * its subtree. Set dir on <html> too for a page that is right to left as a
 * whole.
 */
export function DirectionProvider(handle: Handle<DirectionProviderProps, DirectionContext>) {
  return () => {
    let { direction = 'ltr', mix, ...props } = handle.props
    handle.context.set({ direction })

    return <div dir={direction} data-slot="direction" {...props} mix={[providerRule, mix]} />
  }
}

/**
 * Reads the direction of the nearest DirectionProvider while a component
 * renders, on the server and in the browser: the native equivalent of Base
 * UI's useDirection(). It is left to right without a provider.
 */
export function getDirection(handle: Handle<any, any>): Direction {
  return handle.context.get(DirectionProvider)?.direction ?? 'ltr'
}

/**
 * Reads the direction the browser uses for an element, from any dir
 * attribute or direction style above it. Use it in event handlers, such as
 * one that maps arrow keys to onward and back.
 */
export function directionOf(element: Element): Direction {
  return getComputedStyle(element).direction === 'rtl' ? 'rtl' : 'ltr'
}
