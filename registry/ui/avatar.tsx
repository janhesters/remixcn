// RemixCN Avatar: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn) and Base UI (MIT, Copyright (c) 2019 Material-UI SAS).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css, ref } from 'remix/component'
import type { Handle, Props } from 'remix/component'

export type AvatarSize = 'default' | 'sm' | 'lg'
export type ImageLoadingStatus = 'idle' | 'loading' | 'loaded' | 'error'

export interface AvatarProps extends Props<'span'> {
  /** 2rem by default, 1.5rem when small, or 2.5rem when large. */
  size?: AvatarSize
}

export type AvatarImageProps = Props<'img'> & {
  /** Runs in the browser each time the image starts loading, loads or fails. */
  onLoadingStatusChange?: (status: ImageLoadingStatus) => void
}

export interface AvatarFallbackProps extends Props<'span'> {
  /**
   * Waits this many milliseconds before showing the fallback, so a fast
   * image doesn't flash it first. CSS keeps it hidden, so it shows after the
   * delay also without JavaScript.
   */
  delay?: number
}

/**
 * The status of an avatar's image, shared with its fallback. The image
 * reports it; the fallback updates when it changes.
 */
class AvatarImageState extends EventTarget {
  status: ImageLoadingStatus = 'idle'
  #image: HTMLImageElement | undefined

  report(image: HTMLImageElement, status: ImageLoadingStatus) {
    // An image that left the page can't change the avatar any more.
    if (!image.isConnected) return
    this.#image = image
    this.#set(status)
  }

  release(image: HTMLImageElement) {
    if (this.#image !== image) return
    this.#image = undefined
    this.#set('idle')
  }

  #set(status: ImageLoadingStatus) {
    if (status === this.status) return
    this.status = status
    this.dispatchEvent(new Event('change'))
  }
}

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const inGroup = ':where([data-slot="avatar-group"]) >'
const groupItem = {
  // Avatars in a group overlap, each with a ring in the page color.
  [`${inGroup} &`]: { boxShadow: '0 0 0 2px var(--background)' },
  [`${inGroup} &:not(:first-child)`]: { marginInlineStart: space(-2) },
}

const avatarRule = css({
  position: 'relative',
  display: 'flex',
  flexShrink: 0,
  width: space(8),
  height: space(8),
  borderRadius: '9999px',
  userSelect: 'none',
  '&[data-size="sm"]': { width: space(6), height: space(6) },
  '&[data-size="lg"]': { width: space(10), height: space(10) },
  // A faint edge, so a light photo keeps its shape on a light page. A border
  // instead of shadcn's blend mode, so it follows data-theme and forced colors.
  '&::after': {
    content: '""',
    position: 'absolute',
    inset: 0,
    border: '1px solid color-mix(in oklab, var(--foreground) 10%, transparent)',
    borderRadius: 'inherit',
    pointerEvents: 'none',
  },
  ...groupItem,
})

/**
 * Shows a person or an entity as an image, with a fallback such as their
 * initials while the image loads or when it fails. The box has a fixed size,
 * so nothing moves when the image arrives.
 */
export function Avatar(handle: Handle<AvatarProps, AvatarImageState>) {
  let state = new AvatarImageState()

  return () => {
    let { size = 'default', mix, ...props } = handle.props
    handle.context.set(state)

    return <span data-slot="avatar" data-size={size} {...props} mix={[avatarRule, mix]} />
  }
}

function subscribe(handle: Handle<any>, state: AvatarImageState | undefined, subscribed: Set<AvatarImageState>) {
  if (!state || subscribed.has(state)) return
  subscribed.add(state)
  state.addEventListener('change', () => void handle.update(), { signal: handle.signal })
}

const imageRule = css({
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  aspectRatio: '1',
  objectFit: 'cover',
  borderRadius: '9999px',
  // Without JavaScript, a broken image draws its alt text over the fallback.
  // Transparent text keeps the fallback readable; the fallback names the
  // avatar until the image loads.
  color: 'transparent',
})

/**
 * The image. It is in the server HTML, so the browser loads it right away
 * and paints it over the fallback, also without JavaScript. In the browser,
 * it reads whether the image loaded from the element itself: a loaded image
 * replaces the fallback and takes over the name with its alt text, and a
 * failed one hides, so the fallback shows instead of a broken image.
 */
export function AvatarImage(handle: Handle<AvatarImageProps>) {
  let image: HTMLImageElement | undefined
  let source: string | undefined
  let status: ImageLoadingStatus = 'idle'
  let avatar: AvatarImageState | undefined

  function report(element: HTMLImageElement, next: ImageLoadingStatus) {
    avatar?.report(element, next)
    if (next === status) return
    status = next
    handle.props.onLoadingStatusChange?.(next)
    void handle.update()
  }

  // Reads the element, not the event, so a late event for a source the image
  // no longer shows can't mark it loaded.
  function check(element: HTMLImageElement) {
    if (element !== image) return
    report(element, !element.complete ? 'loading' : element.naturalWidth > 0 ? 'loaded' : 'error')
  }

  let track = ref<HTMLImageElement>((element, signal) => {
    image = element
    element.addEventListener('load', () => check(element), { signal })
    element.addEventListener('error', () => check(element), { signal })
    signal.addEventListener('abort', () => {
      if (image === element) image = undefined
      avatar?.release(element)
    })
    // It may have loaded or failed before this code ran, such as before hydration.
    queueMicrotask(() => check(element))
  })

  return () => {
    let { src, srcSet, sizes, onLoadingStatusChange: _onLoadingStatusChange, mix, ...props } = handle.props
    avatar = handle.context.get(Avatar)

    let next = [src, srcSet, sizes, props.crossOrigin, props.referrerPolicy].join('\n')
    if (source !== undefined && next !== source && image) {
      // The browser starts on the new source when this render commits.
      let element = image
      handle.queueTask(() => check(element))
    }
    source = next

    if (!src && !srcSet) return null

    return (
      <img
        data-slot="avatar-image"
        aria-hidden={status === 'loaded' ? undefined : 'true'}
        hidden={status === 'error'}
        {...props}
        sizes={sizes}
        srcSet={srcSet}
        src={src}
        mix={[imageRule, track, mix]}
      />
    )
  }
}

const fallbackRule = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
  borderRadius: '9999px',
  backgroundColor: 'var(--muted)',
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  ':where([data-slot="avatar"][data-size="sm"]) > &': {
    fontSize: 'var(--text-xs)',
    lineHeight: 'var(--text-xs--line-height)',
  },
  '&[data-delayed]': { animationName: 'remixcn-avatar-fallback-delay', animationTimingFunction: 'step-end' },
  '@keyframes remixcn-avatar-fallback-delay': { '0%, 100%': { visibility: 'hidden' } },
})

/** Puts the delay before the caller's style, in either form, so the caller's own declarations still win. */
function withAnimationDuration(duration: string, style: Props<'span'>['style']) {
  return typeof style === 'string'
    ? `animation-duration: ${duration}; ${style}`
    : { animationDuration: duration, ...style }
}

/** Shows while the image loads, when it fails, or when there is none, such as initials or an icon. */
export function AvatarFallback(handle: Handle<AvatarFallbackProps>) {
  let subscribed = new Set<AvatarImageState>()

  return () => {
    let { delay = 0, style, mix, ...props } = handle.props
    let state = handle.context.get(Avatar)
    subscribe(handle, state, subscribed)
    if (state?.status === 'loaded') return null

    let delayed = delay > 0

    return (
      <span
        data-slot="avatar-fallback"
        data-delayed={delayed ? '' : undefined}
        {...props}
        style={delayed ? withAnimationDuration(`${delay}ms`, style) : style}
        mix={[fallbackRule, mix]}
      />
    )
  }
}

const badgeRule = css({
  position: 'absolute',
  insetInlineEnd: 0,
  insetBlockEnd: 0,
  zIndex: 10,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: space(2.5),
  height: space(2.5),
  // Forced colors drop the fill but draw a transparent border, so the dot stays visible.
  border: '1px solid transparent',
  borderRadius: '9999px',
  backgroundColor: 'var(--primary)',
  color: 'var(--primary-foreground)',
  boxShadow: '0 0 0 2px var(--background)',
  userSelect: 'none',
  '& > svg': { width: space(2), height: space(2) },
  ':where([data-slot="avatar"][data-size="sm"]) > &': {
    width: space(2),
    height: space(2),
    '& > svg': { display: 'none' },
  },
  ':where([data-slot="avatar"][data-size="lg"]) > &': { width: space(3), height: space(3) },
})

/**
 * A dot in the corner, such as a presence status. Say what it means in text
 * too, for example with role="img" and aria-label="Online".
 */
export function AvatarBadge(handle: Handle<Props<'span'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <span data-slot="avatar-badge" {...props} mix={[badgeRule, mix]} />
  }
}

const groupRule = css({ display: 'flex', flexWrap: 'wrap', rowGap: space(1) })

/** Overlaps avatars in a row. */
export function AvatarGroup(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <div data-slot="avatar-group" {...props} mix={[groupRule, mix]} />
  }
}

const groupSize = <Size extends AvatarSize>(size: Size) =>
  `:where([data-slot="avatar-group"]:has([data-slot="avatar"][data-size="${size}"])) > &` as const

const countRule = css({
  position: 'relative',
  display: 'flex',
  flexShrink: 0,
  alignItems: 'center',
  justifyContent: 'center',
  width: space(8),
  height: space(8),
  border: '1px solid transparent',
  borderRadius: '9999px',
  backgroundColor: 'var(--muted)',
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
  '& > svg': { width: '1rem', height: '1rem' },
  [groupSize('lg')]: { width: space(10), height: space(10), '& > svg': { width: '1.25rem', height: '1.25rem' } },
  [groupSize('sm')]: { width: space(6), height: space(6), '& > svg': { width: '0.75rem', height: '0.75rem' } },
  ...groupItem,
})

/** Counts the avatars a group leaves out, such as +3. It takes the size of the group's avatars. */
export function AvatarGroupCount(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props

    return <div data-slot="avatar-group-count" {...props} mix={[countRule, mix]} />
  }
}
