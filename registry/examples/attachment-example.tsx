// RemixCN Attachment examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { clientEntry, css, on, ref } from 'remix/component'
import type { Handle } from 'remix/component'

import { Icon } from '#remixcn/lib/icons.tsx'
import type { IconProps } from '#remixcn/lib/icons.tsx'
import { visuallyHidden } from '#remixcn/lib/styles.ts'
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentImage,
  AttachmentMedia,
  AttachmentTitle,
  attachmentTriggerVariants,
  safeAttachmentUrl,
} from '#remixcn/ui/attachment.tsx'
import type { AttachmentImageStatus, AttachmentState } from '#remixcn/ui/attachment.tsx'
import { Button, buttonVariants } from '#remixcn/ui/button.tsx'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#remixcn/ui/dialog.tsx'
import { Spinner } from '#remixcn/ui/spinner.tsx'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const stackStyles = css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: space(3) })
const rowStyles = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: space(3) })
const fullStyles = css({ width: '100%' })
const cardStyles = css({ width: 'min(100%, 16rem)' })
const labelStyles = css({
  margin: 0,
  paddingInline: space(1),
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-xs)',
  lineHeight: 'var(--text-xs--line-height)',
  fontWeight: 500,
})
const hintStyles = css({
  margin: 0,
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
})
const hiddenStyles = css(visuallyHidden)
const fileInputStyles = css({ maxWidth: '100%', fontSize: 'var(--text-sm)' })

/**
 * Moves focus once the next render is on the page, to the control that took
 * the place of a removed one, so keyboard users keep their place.
 */
async function focusAfterUpdate(handle: Handle<any>, root: () => HTMLElement | undefined, selector: string) {
  await handle.update()
  root()?.querySelector<HTMLElement>(selector)?.focus()
}

const keepRoot = (keep: (element: HTMLElement) => void) => ref<HTMLElement>((element) => keep(element))

export function FileTextIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5L14 3.5Z" />
      <path d="M14 3.5v5h5M9 13h6M9 16.5h6" />
    </Icon>
  )
}

export function SheetIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 10h16M4 15h16M10 10v10" />
    </Icon>
  )
}

export function FileCodeIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5L14 3.5Z" />
      <path d="M14 3.5v5h5M10 12.5l-2 2 2 2M14 12.5l2 2-2 2" />
    </Icon>
  )
}

export function FileAlertIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5L14 3.5Z" />
      <path d="M14 3.5v5h5M12 11v3.5M12 17.5h.01" />
    </Icon>
  )
}

export function ImageIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <circle cx="9" cy="9.5" r="1.5" />
      <path d="m20 15.5-4.5-4.5L6 20" />
    </Icon>
  )
}

export function ClockIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Icon>
  )
}

export function XIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
    </Icon>
  )
}

export function DownloadIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14" />
    </Icon>
  )
}

export function UploadIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M12 15V4M7 8.5l5-5 5 5M5 19.5h14" />
    </Icon>
  )
}

export function RetryIcon(handle: Handle<IconProps>) {
  return () => (
    <Icon {...handle.props}>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9" />
      <path d="M4.5 4.5V9H9" />
    </Icon>
  )
}

/** Draws an invented scene inline, a sun over hills on a colored sky, so the examples load no photo. */
export function scene(sky: string, hills: string) {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" fill="${sky}"/><circle cx="84" cy="36" r="14" fill="#fafafa"/><path d="M0 92c22-24 44-30 66-14s38 6 54-6v48H0Z" fill="${hills}"/></svg>`,
  )}`
}

// A source that never loads, for the failure examples.
export const brokenImage = 'data:image/png;base64,AAAA'

export const images = {
  harbor: { src: scene('#7dd3fc', '#0f766e'), alt: 'Drawing of green hills under a pale blue sky' },
  dusk: { src: scene('#fca5a5', '#7c2d12'), alt: 'Drawing of brown hills under a pink evening sky' },
  meadow: { src: scene('#bef264', '#3f6212'), alt: 'Drawing of dark green hills under a yellow-green sky' },
}

interface FileEntry {
  name: string
  details: string
  icon: 'text' | 'sheet' | 'code' | 'image'
  image?: keyof typeof images
}

const files: FileEntry[] = [
  { name: 'sales-dashboard.pdf', details: 'PDF · 2.4 MB', icon: 'text' },
  { name: 'customer-import.csv', details: 'CSV · 18 KB', icon: 'sheet' },
  { name: 'message-renderer.tsx', details: 'TypeScript · 12 KB', icon: 'code' },
]

function FileIcon(handle: Handle<{ icon: FileEntry['icon'] }>) {
  return () => {
    let { icon } = handle.props
    return icon === 'sheet' ? (
      <SheetIcon />
    ) : icon === 'code' ? (
      <FileCodeIcon />
    ) : icon === 'image' ? (
      <ImageIcon />
    ) : (
      <FileTextIcon />
    )
  }
}

/**
 * Remove takes a file off the list. Focus moves to the next file's Remove
 * button, or to Restore once the list is empty, so keyboard users keep
 * their place.
 */
export const AttachmentFiles = clientEntry(import.meta.url, function AttachmentFiles(handle: Handle) {
  let shown = files.map((file) => file.name)
  let root: HTMLElement | undefined
  let keep = keepRoot((element) => (root = element))

  return () => {
    let list = files.filter((file) => shown.includes(file.name))

    return (
      <div mix={[stackStyles, keep]}>
        {list.length === 0 ? (
          <Button
            variant="outline"
            data-action="restore"
            mix={on('click', () => {
              shown = files.map((file) => file.name)
              void focusAfterUpdate(handle, () => root, '[data-action="remove"]')
            })}
          >
            Restore files
          </Button>
        ) : null}
        {list.map((file, index) => (
          <Attachment key={file.name} mix={fullStyles}>
            <AttachmentMedia>
              <FileIcon icon={file.icon} />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>{file.name}</AttachmentTitle>
              <AttachmentDescription>{file.details}</AttachmentDescription>
            </AttachmentContent>
            <AttachmentActions>
              <AttachmentAction
                aria-label={`Remove ${file.name}`}
                data-action="remove"
                data-file={file.name}
                mix={on('click', () => {
                  shown = shown.filter((name) => name !== file.name)
                  let next = list[index + 1] ?? list[index - 1]
                  let target = next ? `[data-file="${next.name}"]` : '[data-action="restore"]'
                  void focusAfterUpdate(handle, () => root, target)
                })}
              >
                <XIcon />
              </AttachmentAction>
            </AttachmentActions>
          </Attachment>
        ))}
      </div>
    )
  }
})

/** Text attachments without media, such as saved links: a title, details, and a link that is the whole card. */
export function AttachmentContentOnly() {
  return () => (
    <div mix={stackStyles}>
      <Attachment mix={fullStyles}>
        <AttachmentContent>
          <AttachmentTitle>Remix component guide</AttachmentTitle>
        </AttachmentContent>
      </Attachment>
      <Attachment mix={fullStyles}>
        <AttachmentContent>
          <AttachmentTitle>Building accessible components</AttachmentTitle>
          <AttachmentDescription>docs.example.test · 8 min read</AttachmentDescription>
        </AttachmentContent>
      </Attachment>
      <Attachment size="sm" mix={cardStyles}>
        <AttachmentContent>
          <AttachmentTitle>Export guide</AttachmentTitle>
        </AttachmentContent>
        <a href="#attachment" aria-label="Open the export guide" mix={attachmentTriggerVariants()} />
      </Attachment>
    </div>
  )
}

interface StateExample {
  state: AttachmentState
  name: string
  details: string
}

const states: StateExample[] = [
  { state: 'idle', name: 'selected-file.pdf', details: 'Ready to upload' },
  { state: 'uploading', name: 'design-system.zip', details: 'Uploading · 64%' },
  { state: 'processing', name: 'market-research.pdf', details: 'Processing document' },
  { state: 'error', name: 'too-large-video.mov', details: 'Upload failed: larger than 25 MB' },
  { state: 'done', name: 'final-report.pdf', details: 'PDF · 1.1 MB' },
]

function StateMedia(handle: Handle<{ state: AttachmentState }>) {
  return () => {
    let { state } = handle.props
    return (
      <AttachmentMedia>
        {state === 'idle' ? (
          <ClockIcon />
        ) : state === 'uploading' ? (
          <Spinner decorative />
        ) : state === 'error' ? (
          <FileAlertIcon />
        ) : (
          <FileTextIcon />
        )}
      </AttachmentMedia>
    )
  }
}

/**
 * The upload states. Each one says what is happening in its description, so
 * the dashed border, the shimmer and the red aren't the only signs.
 */
export function AttachmentStates(handle: Handle<{ orientation?: 'horizontal' | 'vertical' }>) {
  return () => {
    let vertical = handle.props.orientation === 'vertical'

    return (
      <div mix={vertical ? rowStyles : stackStyles}>
        {states.map(({ state, name, details }) => (
          <Attachment
            key={state}
            state={state}
            orientation={handle.props.orientation}
            mix={vertical ? null : fullStyles}
          >
            <StateMedia state={state} />
            <AttachmentContent>
              <AttachmentTitle>{name}</AttachmentTitle>
              <AttachmentDescription>{details}</AttachmentDescription>
            </AttachmentContent>
          </Attachment>
        ))}
      </div>
    )
  }
}

/** The three sizes. */
export function AttachmentSizes() {
  return () => (
    <div mix={stackStyles}>
      {(['default', 'sm', 'xs'] as const).map((size) => (
        <Attachment key={size} size={size} mix={fullStyles}>
          <AttachmentMedia>
            <FileTextIcon />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>
              {size === 'default'
                ? 'Default attachment'
                : size === 'sm'
                  ? 'Small attachment'
                  : 'Extra small attachment'}
            </AttachmentTitle>
            {size === 'xs' ? null : <AttachmentDescription>PDF · 2.4 MB</AttachmentDescription>}
          </AttachmentContent>
        </Attachment>
      ))}
    </div>
  )
}

/**
 * Image attachments beside and above their content. Each image covers an
 * icon, which shows instead when the image fails.
 */
export const AttachmentImages = clientEntry(import.meta.url, function AttachmentImages() {
  let entries = [
    { name: 'harbor.png', details: 'PNG · 820 KB', image: images.harbor },
    { name: 'dusk.jpg', details: 'JPEG · 1.2 MB', image: images.dusk },
    { name: 'missing.png', details: 'PNG · preview unavailable', image: { src: brokenImage, alt: '' } },
  ]

  return () => (
    <div mix={stackStyles}>
      <p mix={labelStyles}>Horizontal</p>
      {entries.map(({ name, details, image }) => (
        <Attachment key={name} mix={fullStyles}>
          <AttachmentMedia variant="image">
            <ImageIcon />
            <AttachmentImage src={image.src} alt={image.alt} />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>{name}</AttachmentTitle>
            <AttachmentDescription>{details}</AttachmentDescription>
          </AttachmentContent>
          <AttachmentActions>
            <AttachmentAction aria-label={`Remove ${name}`}>
              <XIcon />
            </AttachmentAction>
          </AttachmentActions>
        </Attachment>
      ))}
      <p mix={labelStyles}>Vertical</p>
      <div mix={rowStyles}>
        {entries.map(({ name, image }, index) => (
          <Attachment key={name} orientation="vertical" state={index === 1 ? 'uploading' : 'done'}>
            <AttachmentMedia variant="image">
              <ImageIcon />
              <AttachmentImage src={image.src} alt={image.alt} />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>{name}</AttachmentTitle>
              {index === 1 ? <AttachmentDescription>Uploading</AttachmentDescription> : null}
            </AttachmentContent>
            <AttachmentActions>
              <AttachmentAction aria-label={`Remove ${name}`}>
                <XIcon />
              </AttachmentAction>
            </AttachmentActions>
          </Attachment>
        ))}
      </div>
    </div>
  )
})

const choices = { harbor: images.harbor, meadow: images.meadow, broken: { src: brokenImage, alt: '' } }

/**
 * Replaces the image, as a composer does when you pick another one. A failed
 * image shows the icon, and a late result for an image it replaced changes
 * nothing.
 */
export const AttachmentImagePicker = clientEntry(import.meta.url, function AttachmentImagePicker(handle: Handle) {
  let choice: keyof typeof choices = 'harbor'
  let status: AttachmentImageStatus = 'idle'

  let pick = (next: keyof typeof choices) =>
    on<HTMLButtonElement, 'click'>('click', () => {
      choice = next
      void handle.update()
    })

  return () => {
    let image = choices[choice]

    return (
      <div mix={stackStyles}>
        <Attachment mix={fullStyles}>
          <AttachmentMedia variant="image">
            <ImageIcon />
            <AttachmentImage
              src={image.src}
              alt={image.alt}
              onLoadingStatusChange={(next) => {
                status = next
                void handle.update()
              }}
            />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>cover-image.png</AttachmentTitle>
            <AttachmentDescription>
              {status === 'error' ? 'Preview unavailable' : status === 'loaded' ? 'PNG · 640 KB' : 'Loading preview'}
            </AttachmentDescription>
          </AttachmentContent>
        </Attachment>
        <div mix={rowStyles}>
          <Button size="sm" variant="outline" aria-pressed={choice === 'harbor'} mix={pick('harbor')}>
            Harbor
          </Button>
          <Button size="sm" variant="outline" aria-pressed={choice === 'meadow'} mix={pick('meadow')}>
            Meadow
          </Button>
          <Button size="sm" variant="outline" aria-pressed={choice === 'broken'} mix={pick('broken')}>
            Use a broken link
          </Button>
        </div>
        <p mix={hintStyles}>Preview: {status}.</p>
      </div>
    )
  }
})

const groupFiles: FileEntry[] = [
  { name: 'briefing-notes.pdf', details: 'PDF · 1.4 MB', icon: 'text' },
  { name: 'harbor.png', details: 'PNG · 820 KB', icon: 'image', image: 'harbor' },
  { name: 'pricing-model.csv', details: 'CSV · 32 KB', icon: 'sheet' },
  { name: 'dusk.jpg', details: 'JPEG · 1.2 MB', icon: 'image', image: 'dusk' },
  { name: 'api-client.ts', details: 'TypeScript · 9 KB', icon: 'code' },
  { name: 'meadow.png', details: 'PNG · 560 KB', icon: 'image', image: 'meadow' },
]

/** A row that scrolls sideways and snaps to each attachment. Tab moves through their actions. */
export const AttachmentScrollableGroup = clientEntry(
  import.meta.url,
  function AttachmentScrollableGroup(handle: Handle) {
    let shown = groupFiles.map((file) => file.name)

    return () => (
      <AttachmentGroup role="group" aria-label="Attached files">
        {groupFiles
          .filter((file) => shown.includes(file.name))
          .map((file) => (
            <Attachment key={file.name} mix={cardStyles}>
              <AttachmentMedia variant={file.image ? 'image' : 'icon'}>
                <FileIcon icon={file.icon} />
                {file.image ? <AttachmentImage src={images[file.image].src} alt="" /> : null}
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>{file.name}</AttachmentTitle>
                <AttachmentDescription>{file.details}</AttachmentDescription>
              </AttachmentContent>
              <AttachmentActions>
                <AttachmentAction
                  aria-label={`Remove ${file.name}`}
                  mix={on('click', () => {
                    shown = shown.filter((name) => name !== file.name)
                    void handle.update()
                  })}
                >
                  <XIcon />
                </AttachmentAction>
              </AttachmentActions>
            </Attachment>
          ))}
      </AttachmentGroup>
    )
  },
)

/**
 * A link trigger opens the file, and a DialogTrigger with the trigger's look
 * opens a preview. The actions sit above the trigger, so each one is its own
 * control.
 */
export const AttachmentTriggers = clientEntry(
  import.meta.url,
  function AttachmentTriggers(handle: Handle<{ href: string }>) {
    let visible = true
    let root: HTMLElement | undefined
    let keep = keepRoot((element) => (root = element))

    return () => {
      let href = safeAttachmentUrl(handle.props.href)

      return (
        <div mix={[stackStyles, keep]}>
          {visible ? (
            <Attachment mix={fullStyles}>
              <AttachmentMedia>
                <FileTextIcon />
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>contract-review.txt</AttachmentTitle>
                <AttachmentDescription>Text · 2 KB</AttachmentDescription>
              </AttachmentContent>
              <AttachmentActions>
                {href ? (
                  <a
                    href={href}
                    download="contract-review.txt"
                    aria-label="Download contract-review.txt"
                    mix={buttonVariants({ variant: 'ghost', size: 'icon-xs' })}
                  >
                    <DownloadIcon />
                  </a>
                ) : null}
                <AttachmentAction
                  aria-label="Remove contract-review.txt"
                  data-action="remove"
                  mix={on('click', () => {
                    visible = false
                    void focusAfterUpdate(handle, () => root, '[data-action="restore"]')
                  })}
                >
                  <XIcon />
                </AttachmentAction>
              </AttachmentActions>
              {href ? <a href={href} aria-label="Open contract-review.txt" mix={attachmentTriggerVariants()} /> : null}
            </Attachment>
          ) : (
            <Button
              variant="outline"
              data-action="restore"
              mix={on('click', () => {
                visible = true
                void focusAfterUpdate(handle, () => root, '[data-action="remove"]')
              })}
            >
              Restore attachment
            </Button>
          )}
          <Dialog>
            <Attachment mix={fullStyles}>
              <AttachmentMedia>
                <FileTextIcon />
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>research-summary.pdf</AttachmentTitle>
                <AttachmentDescription>Open the preview dialog</AttachmentDescription>
              </AttachmentContent>
              <AttachmentActions>
                <AttachmentAction aria-label="Remove research-summary.pdf">
                  <XIcon />
                </AttachmentAction>
              </AttachmentActions>
              <DialogTrigger
                data-slot="attachment-trigger"
                aria-label="Preview research-summary.pdf"
                mix={attachmentTriggerVariants()}
              />
            </Attachment>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>research-summary.pdf</DialogTitle>
                <DialogDescription>
                  A made-up summary. Attachment triggers can open dialogs while their actions stay reachable.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose mix={buttonVariants({ variant: 'outline' })}>Done</DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )
    }
  },
)

/**
 * Names, details and URLs that come from users are data. The text renders
 * escaped, and safeAttachmentUrl drops a URL that could run script, so this
 * file gets no link.
 */
export function AttachmentUntrusted() {
  return () => {
    let name = '"><img src=x onerror="alert(1)">.pdf'
    let details = '<script>alert("owned")</script>'
    let href = safeAttachmentUrl('javascript:alert(1)')

    return (
      <Attachment mix={fullStyles}>
        <AttachmentMedia>
          <FileAlertIcon />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>{name}</AttachmentTitle>
          <AttachmentDescription>{details}</AttachmentDescription>
          <AttachmentDescription>{href ? 'Opens in a new tab' : 'No link: the URL was not safe'}</AttachmentDescription>
        </AttachmentContent>
        {href ? <a href={href} aria-label={`Open ${name}`} mix={attachmentTriggerVariants()} /> : null}
      </Attachment>
    )
  }
}

interface Picked {
  id: number
  file: File
}

function kind(file: File) {
  let extension = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]
  return extension ? extension.toUpperCase() : 'File'
}

function size(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Files you pick show as idle attachments with local previews. Nothing
 * uploads until you send the form. Remove takes a file out of the input
 * too, and its preview releases its object URL; Clear resets the form.
 */
export const AttachmentComposer = clientEntry(
  import.meta.url,
  function AttachmentComposer(handle: Handle<{ action: string }>) {
    let picked: Picked[] = []
    let nextId = 0
    let input: HTMLInputElement | undefined
    let root: HTMLElement | undefined
    let keep = keepRoot((element) => (root = element))

    function syncInput() {
      if (!input) return
      let transfer = new DataTransfer()
      for (let { file } of picked) transfer.items.add(file)
      input.files = transfer.files
    }

    return () => {
      let field = `${handle.id}-files`
      let status = picked.length === 1 ? '1 file ready to send' : `${picked.length} files ready to send`

      return (
        <form
          action={handle.props.action}
          method="post"
          enctype="multipart/form-data"
          mix={[
            stackStyles,
            keep,
            on('reset', () => {
              picked = []
              void handle.update()
            }),
          ]}
        >
          <label for={field} mix={hintStyles}>
            Add files
          </label>
          <input
            id={field}
            name="files"
            type="file"
            multiple
            mix={[
              fileInputStyles,
              ref((element) => {
                input = element
              }),
              on('change', (event) => {
                picked = [...(event.currentTarget.files ?? [])].map((file) => ({ id: nextId++, file }))
                void handle.update()
              }),
            ]}
          />
          {picked.length > 0 ? (
            <AttachmentGroup role="group" aria-label="Files to send">
              {picked.map(({ id, file }, index) => {
                let image = file.type.startsWith('image/')
                return (
                  <Attachment key={id} state="idle" mix={cardStyles}>
                    <AttachmentMedia variant={image ? 'image' : 'icon'}>
                      {image ? <ImageIcon /> : <FileTextIcon />}
                      {image ? <AttachmentImage file={file} alt="" /> : null}
                    </AttachmentMedia>
                    <AttachmentContent>
                      <AttachmentTitle>{file.name}</AttachmentTitle>
                      <AttachmentDescription>
                        {kind(file)} · {size(file.size)} · Ready to send
                      </AttachmentDescription>
                    </AttachmentContent>
                    <AttachmentActions>
                      <AttachmentAction
                        aria-label={`Remove ${file.name}`}
                        data-picked={id}
                        mix={on('click', () => {
                          let next = picked[index + 1] ?? picked[index - 1]
                          picked = picked.filter((entry) => entry.id !== id)
                          syncInput()
                          void focusAfterUpdate(handle, () => root, next ? `[data-picked="${next.id}"]` : 'input')
                        })}
                      >
                        <XIcon />
                      </AttachmentAction>
                    </AttachmentActions>
                  </Attachment>
                )
              })}
            </AttachmentGroup>
          ) : null}
          <p role="status" mix={picked.length > 0 ? hintStyles : hiddenStyles}>
            {picked.length > 0 ? status : ''}
          </p>
          <div mix={rowStyles}>
            <Button type="submit" name="intent" value="send-files">
              Send
            </Button>
            <Button type="reset" variant="outline">
              Clear
            </Button>
          </div>
        </form>
      )
    }
  },
)

type UploadState = 'idle' | 'uploading' | 'processing' | 'done' | 'error' | 'removed'

const uploadLabels: Record<UploadState, string> = {
  idle: 'Ready to upload',
  uploading: 'Uploading',
  processing: 'Processing',
  done: 'Uploaded',
  error: 'Upload canceled',
  removed: 'Removed',
}

/**
 * A simulated upload, which sends nothing: the progress comes from a timer.
 * Cancel stops it, Retry starts over, and Remove stops it too. Every timer
 * stops when the example leaves the page. A status announces each step.
 */
export const AttachmentUpload = clientEntry(import.meta.url, function AttachmentUpload(handle: Handle) {
  let name = 'quarterly-report.pdf'
  let state: UploadState = 'idle'
  let progress = 0
  let run: AbortController | undefined
  let root: HTMLElement | undefined
  let keep = keepRoot((element) => (root = element))

  handle.signal.addEventListener('abort', () => run?.abort())

  function set(next: UploadState, focus?: string) {
    state = next
    if (focus) void focusAfterUpdate(handle, () => root, `[data-action="${focus}"]`)
    else void handle.update()
  }

  function start() {
    run?.abort()
    let controller = new AbortController()
    run = controller
    progress = 0
    set('uploading', 'cancel')

    let tick = setInterval(() => {
      progress = Math.min(100, progress + 20)
      if (progress < 100) return void handle.update()
      clearInterval(tick)
      // Keeps focus on the attachment while Cancel stays, and on Remove once it's done.
      set('processing')
      let finish = setTimeout(() => {
        let focused = root?.contains(document.activeElement)
        set('done', focused ? 'remove' : undefined)
      }, 800)
      controller.signal.addEventListener('abort', () => clearTimeout(finish))
    }, 400)
    controller.signal.addEventListener('abort', () => clearInterval(tick))
  }

  function stop(next: UploadState, focus: string) {
    run?.abort()
    run = undefined
    set(next, focus)
  }

  return () => {
    if (state === 'removed') {
      return (
        <div mix={[stackStyles, keep]}>
          <Button variant="outline" data-action="restore" mix={on('click', () => set('idle', 'start'))}>
            Restore {name}
          </Button>
          <p role="status" mix={hiddenStyles}>
            {name} removed
          </p>
        </div>
      )
    }

    let busy = state === 'uploading' || state === 'processing'
    let details =
      state === 'uploading'
        ? `Uploading · ${progress}%`
        : state === 'done'
          ? 'PDF · 3.2 MB · Uploaded'
          : uploadLabels[state]

    return (
      <div mix={[stackStyles, keep]}>
        <Attachment state={state} mix={fullStyles}>
          <AttachmentMedia>
            {busy ? <Spinner decorative /> : state === 'error' ? <FileAlertIcon /> : <FileTextIcon />}
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>{name}</AttachmentTitle>
            <AttachmentDescription>{details}</AttachmentDescription>
          </AttachmentContent>
          <AttachmentActions>
            {state === 'idle' ? (
              <AttachmentAction key="start" aria-label={`Upload ${name}`} data-action="start" mix={on('click', start)}>
                <UploadIcon />
              </AttachmentAction>
            ) : null}
            {busy ? (
              <AttachmentAction
                key="cancel"
                aria-label={`Cancel upload of ${name}`}
                data-action="cancel"
                mix={on('click', () => stop('error', 'retry'))}
              >
                <XIcon />
              </AttachmentAction>
            ) : null}
            {state === 'error' ? (
              <AttachmentAction
                key="retry"
                aria-label={`Retry upload of ${name}`}
                data-action="retry"
                mix={on('click', start)}
              >
                <RetryIcon />
              </AttachmentAction>
            ) : null}
            {busy ? null : (
              <AttachmentAction
                key="remove"
                aria-label={`Remove ${name}`}
                data-action="remove"
                mix={on('click', () => stop('removed', 'restore'))}
              >
                <XIcon />
              </AttachmentAction>
            )}
          </AttachmentActions>
        </Attachment>
        <p role="status" mix={hiddenStyles}>
          {state === 'idle' ? '' : `${name}: ${uploadLabels[state]}`}
        </p>
      </div>
    )
  }
})

/** In right-to-left text, the media, the content and the actions mirror. */
export function AttachmentRtl() {
  return () => (
    <div dir="rtl" lang="ar" mix={stackStyles}>
      <Attachment mix={fullStyles}>
        <AttachmentMedia>
          <FileTextIcon />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>تقرير-المبيعات.pdf</AttachmentTitle>
          <AttachmentDescription>PDF · 2.4 ميغابايت</AttachmentDescription>
        </AttachmentContent>
        <AttachmentActions>
          <AttachmentAction aria-label="إزالة تقرير-المبيعات.pdf">
            <XIcon />
          </AttachmentAction>
        </AttachmentActions>
      </Attachment>
      <Attachment orientation="vertical">
        <AttachmentMedia variant="image">
          <ImageIcon />
          <AttachmentImage src={images.harbor.src} alt="رسم لتلال خضراء تحت سماء زرقاء" />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>الميناء.png</AttachmentTitle>
        </AttachmentContent>
        <AttachmentActions>
          <AttachmentAction aria-label="إزالة الميناء.png">
            <XIcon />
          </AttachmentAction>
        </AttachmentActions>
      </Attachment>
    </div>
  )
}
