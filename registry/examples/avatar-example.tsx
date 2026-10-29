// RemixCN Avatar examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { CheckIcon, Icon } from '#remixcn/lib/icons.tsx'
import type { IconProps } from '#remixcn/lib/icons.tsx'
import { visuallyHidden } from '#remixcn/lib/styles.ts'
import { Avatar, AvatarBadge, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from '#remixcn/ui/avatar.tsx'
import type { AvatarSize, ImageLoadingStatus } from '#remixcn/ui/avatar.tsx'
import { Button } from '#remixcn/ui/button.tsx'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const rowStyles = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space(4) })
const stackStyles = css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(4) })
const hiddenStyles = css(visuallyHidden)
const hintStyles = css({
  margin: 0,
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
})
const onlineStyles = css({ backgroundColor: 'light-dark(oklch(0.52 0.14 150), oklch(0.72 0.17 150))' })

/** Draws an invented portrait inline, a head and shoulders on a colored tile, so the examples load no photo. */
export function portrait(background: string) {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" fill="${background}"/><circle cx="40" cy="32" r="14" fill="#fafafa"/><path d="M14 80c2-16 12-24 26-24s24 8 26 24Z" fill="#fafafa"/></svg>`,
  )}`
}

// A source that never loads, for the failure examples.
export const brokenImage = 'data:image/png;base64,AAAA'

const people = [
  { name: 'Ada Lovelace', initials: 'AL', photo: portrait('#4f46e5') },
  { name: 'Grace Hopper', initials: 'GH', photo: portrait('#0f766e') },
  { name: 'Katherine Johnson', initials: 'KJ', photo: portrait('#b45309') },
]

export function PlusIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M12 4.5v15M4.5 12h15" />
    </Icon>
  )
}

/** Small, default and large, each with an image and a fallback. */
export function AvatarSizes() {
  let sizes: AvatarSize[] = ['sm', 'default', 'lg']

  return () => (
    <div mix={rowStyles}>
      {sizes.map((size) => (
        <Avatar key={size} size={size}>
          <AvatarImage src={people[0].photo} alt={people[0].name} />
          <AvatarFallback>{people[0].initials}</AvatarFallback>
        </Avatar>
      ))}
      {sizes.map((size) => (
        <Avatar key={`fallback-${size}`} size={size}>
          <AvatarFallback>{people[1].initials}</AvatarFallback>
        </Avatar>
      ))}
    </div>
  )
}

/** A dot in the corner says it in text too: role="img" with a name. */
export function AvatarWithBadge() {
  let sizes: AvatarSize[] = ['sm', 'default', 'lg']

  return () => (
    <div mix={rowStyles}>
      {sizes.map((size) => (
        <Avatar key={size} size={size}>
          <AvatarImage src={people[1].photo} alt={people[1].name} />
          <AvatarFallback>{people[1].initials}</AvatarFallback>
          <AvatarBadge role="img" aria-label="Online" mix={onlineStyles} />
        </Avatar>
      ))}
      <Avatar size="lg">
        <AvatarFallback>{people[2].initials}</AvatarFallback>
        <AvatarBadge role="img" aria-label="Verified">
          <CheckIcon />
        </AvatarBadge>
      </Avatar>
    </div>
  )
}

/** Overlapping avatars, with a count of the people the group leaves out. */
export function AvatarGroupExample() {
  let sizes: AvatarSize[] = ['sm', 'default', 'lg']

  return () => (
    <div mix={stackStyles}>
      {sizes.map((size) => (
        <AvatarGroup key={size}>
          {people.map((person) => (
            <Avatar key={person.name} size={size}>
              <AvatarImage src={person.photo} alt={person.name} />
              <AvatarFallback>{person.initials}</AvatarFallback>
            </Avatar>
          ))}
          <AvatarGroupCount>
            <span aria-hidden="true">+3</span>
            <span mix={hiddenStyles}>and 3 more people</span>
          </AvatarGroupCount>
        </AvatarGroup>
      ))}
      <AvatarGroup>
        {people.slice(0, 2).map((person) => (
          <Avatar key={person.name}>
            <AvatarFallback>{person.initials}</AvatarFallback>
          </Avatar>
        ))}
        <AvatarGroupCount>
          <PlusIcon />
          <span mix={hiddenStyles}>and more people</span>
        </AvatarGroupCount>
      </AvatarGroup>
    </div>
  )
}

/**
 * The fallback shows when an image fails, when there is none, and after a
 * delay while one loads. Swapping a failed image for the fallback runs in
 * the browser, so this example is a client entry.
 */
export const AvatarFallbacks = clientEntry(import.meta.url, function AvatarFallbacks() {
  return () => (
    <div mix={rowStyles}>
      <Avatar data-example-avatar="broken">
        <AvatarImage src={brokenImage} alt="Ada Lovelace" />
        <AvatarFallback>AL</AvatarFallback>
      </Avatar>
      <Avatar data-example-avatar="none">
        <AvatarFallback>GH</AvatarFallback>
      </Avatar>
      <Avatar data-example-avatar="delayed">
        <AvatarImage src={people[2].photo} alt={people[2].name} />
        <AvatarFallback delay={600}>KJ</AvatarFallback>
      </Avatar>
    </div>
  )
})

const sources = { photo: people[0].photo, broken: brokenImage, none: undefined }

/**
 * Swaps the image, as a profile form does after an upload. A failed or
 * removed image shows the fallback, and a late result for an image it
 * replaced can't bring that image back.
 */
export const AvatarPicker = clientEntry(import.meta.url, function AvatarPicker(handle: Handle) {
  let source: keyof typeof sources = 'photo'
  let status: ImageLoadingStatus = 'idle'

  let pick = (next: keyof typeof sources) =>
    on<HTMLButtonElement, 'click'>('click', () => {
      source = next
      void handle.update()
    })

  return () => (
    <div mix={stackStyles}>
      <div mix={rowStyles}>
        <Avatar size="lg">
          <AvatarImage
            src={sources[source]}
            alt="Ada Lovelace"
            onLoadingStatusChange={(next) => {
              status = next
              void handle.update()
            }}
          />
          <AvatarFallback>AL</AvatarFallback>
        </Avatar>
        <p mix={hintStyles} data-avatar-status>
          {source === 'none' ? 'No photo.' : `Photo: ${status}.`}
        </p>
      </div>
      <div mix={rowStyles} role="group" aria-label="Photo">
        <Button size="sm" variant="outline" aria-pressed={source === 'photo' ? 'true' : 'false'} mix={pick('photo')}>
          Use photo
        </Button>
        <Button size="sm" variant="outline" aria-pressed={source === 'broken' ? 'true' : 'false'} mix={pick('broken')}>
          Use a broken link
        </Button>
        <Button size="sm" variant="outline" aria-pressed={source === 'none' ? 'true' : 'false'} mix={pick('none')}>
          Remove photo
        </Button>
      </div>
    </div>
  )
})
