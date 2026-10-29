/// <reference types="react" />
import{createElement}from'react'
import /* the clause */ { Button } /* and the source */ from '@base-ui/react/button'
import type { Ref } from 'react-dom'
import './badge.css'
export * from '#remixcn/ui/button.tsx'

// import { Slot } from 'radix-ui'
/* import { useFloating } from '@floating-ui/dom' */
export const usage = `
import { twMerge } from 'tailwind-merge'
`
export const quotes = /['"]/

export function Badge() {
  return <p>Don't import Tailwind from 'tailwindcss' here.</p>
}

export let loadPopover = () => import('@remix-run/ui/popover')
