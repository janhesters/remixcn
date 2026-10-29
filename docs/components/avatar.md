# Avatar

Shows a person or an entity as an image, with a fallback while the image loads or when it fails, a corner badge, groups and a count.

- Source: `registry/ui/avatar.tsx`. Needs `registry/lib/theme.css`.
- Examples: `registry/examples/avatar-example.tsx`. Run them with `bun run display-examples`.
- Upstream: shadcn/ui [`avatar.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/avatar.tsx), its [docs](https://ui.shadcn.com/docs/components/base/avatar), and [Base UI Avatar](https://base-ui.com/react/components/avatar.md).

## Usage

```tsx
import { Avatar, AvatarFallback, AvatarImage } from '#remixcn/ui/avatar.tsx'

<Avatar>
  <AvatarImage src="/avatars/ada.png" alt="Ada Lovelace" />
  <AvatarFallback>AL</AvatarFallback>
</Avatar>
```

## API

### `Avatar`

A `<span>` of a fixed size that takes every native `<span>` prop, `mix`, and `size`: `'default'` (2rem), `'sm'` (1.5rem) or `'lg'` (2.5rem). It renders `data-slot="avatar"` and `data-size`, and shares the image's status with the fallback.

### `AvatarImage`

An `<img>` that takes every native `<img>` prop and `onLoadingStatusChange(status)`, where `status` is `'loading'`, `'loaded'` or `'error'`. Without `src` and `srcSet` it renders nothing.

- **Server HTML.** The image is in the HTML, so the browser loads it at once and paints it over the fallback, also without JavaScript. It is `aria-hidden` until the browser has seen it load, so the fallback names the avatar until then, as in Base UI's `keepMounted` mode.
- **In the browser.** It reads the element's own `complete` and `naturalWidth`, on its first commit and after each `load`, `error` or source change. A loaded image drops `aria-hidden`, so its alt text names the avatar, and the fallback leaves. A failed one gets `hidden`, so no broken image or alt text shows. Because it reads the element, not the event, a late `load` event for a source it no longer shows can't mark it loaded, and an image that was replaced or removed can't change the avatar any more.
- **Where it runs.** This runs inside your client entry. On a page that only renders on the server, a failed image stays: its alt text is transparent, so the initials under it stay readable, and Chromium may draw its small broken-image icon.

### `AvatarFallback`

A `<span>` that shows while the image loads, when it fails or when there is none. It leaves once the image loaded. `delay`, in milliseconds, keeps it hidden for that long with a CSS animation, so a fast image doesn't flash it first, and so it shows after the delay also without JavaScript. A `style` you pass, as an object or a string, keeps the delay, unless it sets an animation duration itself.

### `AvatarBadge`

A `<span>` dot in the end corner, such as a presence status. It says nothing to assistive technology by itself: give it `role="img"` and `aria-label="Online"`, or text. An icon inside shows in the default and large sizes.

### `AvatarGroup` and `AvatarGroupCount`

`AvatarGroup` is a `<div>` that overlaps the avatars in it, each with a ring in the page color. `AvatarGroupCount` is a `<div>` for the people left out, such as `+3`, and takes the size of the group's avatars. Give it text that makes sense read aloud, such as a visually hidden "and 3 more people".

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| Base UI `Avatar.Root` with `size` | `Avatar` | The status lives in the root and reaches the fallback through Remix context and an event |
| Base UI `Avatar.Image` preloads with `new Image()` and renders only once loaded | `AvatarImage` is always in the HTML, like Base UI's `keepMounted` | So the image shows without JavaScript and loads before hydration. `aria-hidden` until loaded, `hidden` when it fails |
| `onLoadingStatusChange` | Same | Runs in the browser |
| `keepMounted` | Always on | |
| `Avatar.Fallback` with `delay` (a timer) | `AvatarFallback` with `delay` (a CSS animation) | Works on the server HTML without JavaScript |
| `render` | Not ported | Pass `mix` to style or wrap the elements |
| `AvatarBadge`, `AvatarGroup`, `AvatarGroupCount` | Same | Positioned with logical properties, so the badge sits in the end corner in right-to-left text |
| Root `after:` border with `mix-blend-darken` | A border in `--foreground` at 10% | Follows `data-theme`, which a blend mode keyed to `dark:` can't |
| Group `-space-x-2` and `ring-2 ring-background` | The avatar's own rule reacts to the group | |
| Docs: Basic, Badge, Badge with Icon, Avatar Group, Group Count, Group with Icon, Sizes, RTL | `AvatarSizes`, `AvatarWithBadge`, `AvatarGroupExample`, the fixture's Right to left section | |
| Docs: Dropdown | Waits for Dropdown Menu | |
| — | `AvatarFallbacks`, `AvatarPicker` | A failed image, no image, a delayed fallback, and a changing source |

## Accessibility checks

Automated:

- Server HTML: the image is `aria-hidden` and the fallback names the avatar; no image without a source; `srcset`, `sizes`, `loading` and `referrerpolicy` reach the image.
- In Chromium, Firefox and WebKit: a loaded image is named by its alt text and the fallback leaves; a failed one hides and the fallback shows; a changed source is followed both ways; a late `load` event for a replaced image or an earlier source changes nothing; removing the image brings the fallback back; each instance keeps its own status through renders; the box keeps its size.
- Without JavaScript, the fallback names a failed avatar and the box keeps its size.
- Fallback and count text are 4.5:1 or more in both themes. The badge stays visible in forced colors and sits in the end corner in right-to-left text.

Not checked, so not claimed: screen readers weren't run. This isn't an accessibility certification.
