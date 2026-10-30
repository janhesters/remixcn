# Attachment

A file or an image attached to a message or a form: its media, name and details, its upload state, and actions such as Remove.

- Source: `registry/ui/attachment.tsx`. Needs `registry/lib/theme.css`, `registry/lib/styles.ts` and `registry/ui/button.tsx`.
- Examples: `registry/examples/attachment-example.tsx`. Run them with `bun run conversation-examples`.
- Upstream: shadcn/ui [`attachment.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/attachment.tsx) and its [docs](https://ui.shadcn.com/docs/components/base/attachment).

## Usage

```tsx
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentImage,
  AttachmentMedia,
  AttachmentTitle,
} from '#remixcn/ui/attachment.tsx'

<Attachment state="idle">
  <AttachmentMedia variant="image">
    <ImageIcon />
    <AttachmentImage file={file} alt="" />
  </AttachmentMedia>
  <AttachmentContent>
    <AttachmentTitle>{file.name}</AttachmentTitle>
    <AttachmentDescription>PNG · 820 KB · Ready to send</AttachmentDescription>
  </AttachmentContent>
  <AttachmentActions>
    <AttachmentAction aria-label={`Remove ${file.name}`} mix={on('click', remove)}>
      <XIcon />
    </AttachmentAction>
  </AttachmentActions>
</Attachment>
```

## API

| Part | Renders | Notes |
| --- | --- | --- |
| `Attachment` | `<div>` | `state`: `'idle'`, `'uploading'`, `'processing'`, `'error'` or `'done'` (default). `size`: `'default'`, `'sm'` or `'xs'`. `orientation`: `'horizontal'` (default) or `'vertical'`. Sets `data-state`, `data-size` and `data-orientation` |
| `AttachmentGroup` | `<div>` | A row that scrolls sideways and snaps to each attachment. Give a row without controls `tabIndex={0}`, `role="group"` and an `aria-label` |
| `AttachmentMedia` | `<div>` | `variant`: `'icon'` (default) or `'image'`. An image covers the icon next to it and dims until the state is `idle` or `done` |
| `AttachmentImage` | `<img>`, or nothing | `src` and `srcSet`, or `file`: a `Blob` it previews through an object URL. `alt` is required, as for every Remix `<img>`. `onLoadingStatusChange` reports `'loading'`, `'loaded'` and `'error'`. Sets `data-status`, and `hidden` when the image fails |
| `AttachmentContent` | `<div>` | Takes the room the card has. On a card too narrow for 6rem beside the media, it wraps onto its own line |
| `AttachmentTitle` | `<span>` | The name. Shimmers while `uploading` or `processing`, keeping 4.5:1 through the sweep; still for reduced motion and in forced colors |
| `AttachmentDescription` | `<span>` | The type, the size, the progress or why it failed. Red in the `error` state |
| `AttachmentActions` | `<div>` | Above the trigger. Over the top end of a vertical attachment, on its own surface |
| `AttachmentAction` | `Button` | `variant="ghost"` and `size="icon-xs"` by default, and every Button prop. Always `type="button"` unless you say otherwise |
| `AttachmentTrigger` | `<button type="button">` | Covers the card, under the actions. Name it with `aria-label` |
| `attachmentTriggerVariants()` | Mixins | The trigger's look and `data-slot` for a native `<a>`, in place of `render` |
| `safeAttachmentUrl(value)` | A string or `undefined` | Keeps `http:`, `https:`, `blob:` and relative URLs, and drops everything else, such as `javascript:`, `data:` and `file:` URLs |

Every part takes its native element's props and `mix`. `attachmentStates`, `attachmentSizes` and `attachmentOrientations` list the options.

## Composition

- **State in text.** The dashed border, the shimmer and the red aren't enough on their own. Say the state in `AttachmentDescription`, such as "Uploading · 64%" or "Upload failed: larger than 25 MB". For a state that changes, announce it in a status outside the card, as the Upload example does.
- **Labels.** Name every icon action with the action and the file, such as `aria-label="Remove report.pdf"`, and the trigger with what it opens, such as "Preview report.pdf".
- **Focus after a change.** When an action removes its own button, move focus to the control that takes its place once the update is on the page: `await handle.update()`, then `focus()`. The Files, Triggers, Composer and Upload examples do so.
- **Local previews.** `AttachmentImage file={file}` creates one object URL per file, in the browser only, and releases it when the file changes or the image leaves the page. A load or error that arrives later changes nothing. The server renders no image for a file, so put an icon beside it.
- **Failed images.** Put an icon next to the image. A failed image hides, so the icon shows instead of a broken picture. Without JavaScript, a broken image's alt text is transparent, so it doesn't draw over the icon.
- **Uploads.** Attachment never uploads, fetches or downloads by itself. Your code sets `state` and the description, and cancels its own work: the Upload example stops its timers with an `AbortController` on Cancel, on Remove, and when it leaves the page. The Composer example uploads nothing until its form is sent, and removes a file from the file input too.
- **Triggers.** Use `attachmentTriggerVariants()` on an `<a>` to open the file, or on a `DialogTrigger` with `data-slot="attachment-trigger"` to open a Dialog, as the Triggers example does. `AttachmentTrigger` is the plain button, for a click handler of your own.

### URL handling

File names, details and URLs that come from users are data. Remix escapes text, so a name such as `"><img src=x onerror=alert(1)>` shows as text. A link runs whatever URL it gets, so pass a user's URL through `safeAttachmentUrl()` and render no link when it returns `undefined`, as the Untrusted example does. The examples use only invented local content: inline SVG images, a made-up text file the fixture serves at `/files/contract-review.txt`, `#` links on the page, and `blob:` URLs for files you pick.

## Source and behavior map

| Upstream | RemixCN | Notes |
| --- | --- | --- |
| `Attachment` with `state`, `size`, `orientation` | Same | Same data attributes and measures |
| `has-[>a,>button]:hover:bg-muted/50` | Same, for a trigger | |
| `focus-within:ring-1` on the card, `outline-none` on the trigger | The theme's 2px outline on the card while the trigger has keyboard focus | Stays visible in forced colors. Actions keep their own ring |
| `AttachmentMedia` `variant` | Same | The image covers an icon behind it, absolutely positioned |
| `<img>` in the media | `AttachmentImage`, or your own `<img>` | New: a local file preview that releases its object URL, a hidden failed image, and status from the element, so a late event for a replaced source changes nothing |
| `AttachmentTitle` `truncate` with `shimmer` | Wraps, with `shimmer()` from `styles.ts` | So a long name shows in full and the actions stay in view |
| `AttachmentDescription` `truncate`, `text-destructive/80` | Wraps; red mixed with 25% `--foreground` | Reaches 4.5:1 |
| `AttachmentContent` `flex-1 min-w-0` | Also a minimum of 6rem | So a narrow card with large text wraps instead of squeezing the name |
| `AttachmentActions` `z-20` | Same; vertical actions get a `--card` surface | Keeps the icons visible over a photo |
| `AttachmentAction` on Button | Same | |
| `AttachmentTrigger` with `render` | `AttachmentTrigger` and `attachmentTriggerVariants()` | |
| `AttachmentGroup` `scroll-fade-x scrollbar-none` | A thin scrollbar, no fade | The fade isn't ported, so the scrollbar shows that the row scrolls. Padding keeps the first and last focus rings in view |
| `left`/`right` positions | Logical insets | Mirrors in right-to-left text |
| — | `safeAttachmentUrl()` | New: drops URLs that could run script |
| Docs and examples: Files, Content only, States, Images, Image states, Sizes, Scrollable group, Triggers | `AttachmentFiles`, `AttachmentContentOnly`, `AttachmentStates`, `AttachmentImages`, `AttachmentImagePicker`, `AttachmentSizes`, `AttachmentScrollableGroup`, `AttachmentTriggers` | Plus `AttachmentUntrusted`, `AttachmentComposer`, `AttachmentUpload` and `AttachmentRtl` |
| Example: `DialogTrigger render={<AttachmentTrigger />}` | `<DialogTrigger data-slot="attachment-trigger" mix={attachmentTriggerVariants()}>` | |

## Accessibility checks

Automated: server HTML escapes names and details and drops unsafe URLs; actions and triggers are `type="button"` before JavaScript runs; the composer posts its files without JavaScript; Remove moves focus to the next file or to Restore; a failed image hides and its icon shows, also after a replaced image; a local preview releases its object URL when it's replaced or removed and reports nothing afterwards; a canceled or removed upload makes no more progress; the card shows a focus ring around a focused trigger, also in forced colors; a Dialog opened from the card returns focus to its trigger; text reaches 4.5:1 in both themes; the shimmer keeps 4.5:1 through the sweep with motion on, stops for reduced motion, and leaves the text readable in forced colors; actions mirror in right-to-left text; the page passes axe-core's WCAG 2.2 A and AA rules and fits 320px with text at 200%, with every remove action inside its card. This isn't an accessibility certification.

Manual gaps: screen reader announcements of the upload status and the composer's file count were not checked with a screen reader, only through their `role="status"` regions. Touch scrolling of a group and Windows High Contrast themes other than Chromium's emulation were not checked.
