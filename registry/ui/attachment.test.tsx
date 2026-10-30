import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, tags, text } from '../../test/html.ts'
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
  AttachmentTrigger,
  attachmentOrientations,
  attachmentSizes,
  attachmentStates,
  attachmentTriggerVariants,
  safeAttachmentUrl,
} from './attachment.tsx'

describe('Attachment', () => {
  it('renders every part with its data-slot, in order', async () => {
    let html = await renderToString(
      <AttachmentGroup>
        <Attachment>
          <AttachmentMedia>
            <svg />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>sales-dashboard.pdf</AttachmentTitle>
            <AttachmentDescription>PDF · 2.4 MB</AttachmentDescription>
          </AttachmentContent>
          <AttachmentActions>
            <AttachmentAction aria-label="Remove sales-dashboard.pdf">
              <svg />
            </AttachmentAction>
          </AttachmentActions>
          <AttachmentTrigger aria-label="Open sales-dashboard.pdf" />
        </Attachment>
      </AttachmentGroup>,
    )

    assert.deepEqual(
      tags(html)
        .map((tag) => `${tag.name}:${tag.attributes.get('data-slot') ?? ''}`)
        .filter((tag) => !tag.endsWith(':')),
      [
        'div:attachment-group',
        'div:attachment',
        'div:attachment-media',
        'div:attachment-content',
        'span:attachment-title',
        'span:attachment-description',
        'div:attachment-actions',
        'button:attachment-action',
        'button:attachment-trigger',
      ],
    )
    assert.equal(text(html), 'sales-dashboard.pdfPDF · 2.4 MB')
  })

  it('renders done, default and horizontal unless told otherwise, and each state, size and orientation', async () => {
    let root = attributes(await renderToString(<Attachment />), 'div')
    assert.equal(root.get('data-state'), 'done')
    assert.equal(root.get('data-size'), 'default')
    assert.equal(root.get('data-orientation'), 'horizontal')

    for (let state of attachmentStates) {
      for (let size of attachmentSizes) {
        for (let orientation of attachmentOrientations) {
          let html = await renderToString(<Attachment state={state} size={size} orientation={orientation} />)
          let attachment = attributes(html, 'div')

          assert.equal(attachment.get('data-state'), state)
          assert.equal(attachment.get('data-size'), size)
          assert.equal(attachment.get('data-orientation'), orientation)
        }
      }
    }
  })

  it('renders icon media unless told otherwise', async () => {
    assert.equal(attributes(await renderToString(<AttachmentMedia />), 'div').get('data-variant'), 'icon')
    assert.equal(
      attributes(await renderToString(<AttachmentMedia variant="image" />), 'div').get('data-variant'),
      'image',
    )
  })

  it('renders actions as ghost icon Buttons that never submit a form, with the label the caller gives', async () => {
    let action = attributes(
      await renderToString(<AttachmentAction aria-label="Remove workspace.png" />),
      'slot:attachment-action',
    )

    assert.equal(action.get('type'), 'button')
    assert.equal(action.get('data-variant'), 'ghost')
    assert.equal(action.get('data-size'), 'icon-xs')
    assert.equal(action.get('aria-label'), 'Remove workspace.png')

    let outline = attributes(
      await renderToString(<AttachmentAction variant="outline" size="icon-sm" aria-label="Retry" />),
      'button',
    )
    assert.equal(outline.get('data-variant'), 'outline')
    assert.equal(outline.get('data-size'), 'icon-sm')
  })

  it('renders the trigger as a button that never submits a form, and gives a link its look in place of render', async () => {
    let html = await renderToString(
      <>
        <AttachmentTrigger aria-label="Preview research-summary.pdf" />
        <a href="/files/contract.pdf" aria-label="Open contract.pdf" mix={attachmentTriggerVariants()} />
      </>,
    )

    let trigger = attributes(html, 'button')
    assert.equal(trigger.get('type'), 'button')
    assert.equal(trigger.get('data-slot'), 'attachment-trigger')
    assert.equal(trigger.get('aria-label'), 'Preview research-summary.pdf')
    let link = attributes(html, 'a')
    assert.equal(link.get('data-slot'), 'attachment-trigger')
    assert.equal(link.get('href'), '/files/contract.pdf')
  })

  it('escapes file names and metadata, so untrusted text never becomes markup', async () => {
    let html = await renderToString(
      <Attachment>
        <AttachmentContent>
          <AttachmentTitle>{'"><img src=x onerror=alert(1)>.png'}</AttachmentTitle>
          <AttachmentDescription>{'<script>alert(1)</script>'}</AttachmentDescription>
        </AttachmentContent>
      </Attachment>,
    )

    assert.equal(tags(html, 'img').length, 0)
    assert.equal(tags(html, 'script').length, 0)
    assert.equal(text(html), '"><img src=x onerror=alert(1)>.png<script>alert(1)</script>')
  })
})

describe('AttachmentImage', () => {
  it('renders an image with a source on the server, with its alt text, so it loads without JavaScript', async () => {
    let html = await renderToString(
      <AttachmentMedia variant="image">
        <AttachmentImage src="/files/workspace.png" alt="A desk with two monitors" loading="lazy" />
      </AttachmentMedia>,
    )
    let image = attributes(html, 'img')

    assert.equal(image.get('data-slot'), 'attachment-image')
    assert.equal(image.get('src'), '/files/workspace.png')
    assert.equal(image.get('alt'), 'A desk with two monitors')
    assert.equal(image.get('loading'), 'lazy')
    assert.equal(image.has('hidden'), false)
  })

  it('renders nothing on the server for a local file, which only the browser can preview', async () => {
    let file = new Blob(['not an image'], { type: 'image/png' })
    let html = await renderToString(<AttachmentImage file={file} alt="screenshot.png" />)

    assert.equal(tags(html, 'img').length, 0)
  })

  it('renders nothing without a source', async () => {
    assert.equal(tags(await renderToString(<AttachmentImage alt="" />), 'img').length, 0)
  })
})

describe('safeAttachmentUrl', () => {
  it('keeps web, blob and relative URLs', () => {
    for (let url of [
      'https://files.example.test/report.pdf',
      'http://localhost:4427/files/a.png',
      'blob:http://localhost:4427/0b7c4b4e-6c8a-4d1e-9f53-2c2f0f0c1a11',
      '/files/report.pdf',
      'files/report.pdf',
      '?download=1',
      '#preview',
    ]) {
      assert.equal(safeAttachmentUrl(url), url)
    }
  })

  it('drops URLs that could run script or show other content, in any case and with any whitespace', () => {
    for (let url of [
      'javascript:alert(1)',
      ' JaVaScRiPt:alert(1)',
      'java\tscript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      '',
      undefined,
      null,
    ]) {
      assert.equal(safeAttachmentUrl(url), undefined, String(url))
    }
  })
})
