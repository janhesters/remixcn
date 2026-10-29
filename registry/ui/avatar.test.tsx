import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { attributes, tags, text } from '../../test/html.ts'
import { Avatar, AvatarBadge, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from './avatar.tsx'

describe('Avatar', () => {
  it('renders the image and the fallback, and lets the fallback name the avatar until the image loads', async () => {
    let html = await renderToString(
      <Avatar>
        <AvatarImage src="/avatars/ada.png" alt="Ada Lovelace" />
        <AvatarFallback>AL</AvatarFallback>
      </Avatar>,
    )
    let image = attributes(html, 'img')

    assert.equal(attributes(html, 'slot:avatar').get('data-size'), 'default')
    assert.equal(image.get('data-slot'), 'avatar-image')
    assert.equal(image.get('src'), '/avatars/ada.png')
    assert.equal(image.get('alt'), 'Ada Lovelace')
    // The browser paints the image over the fallback once it arrives, also
    // without JavaScript. Until it runs and sees the image load, the fallback's
    // text is the avatar's name, as in Base UI's keepMounted mode.
    assert.equal(image.get('aria-hidden'), 'true')
    assert.equal(image.has('hidden'), false)
    assert.equal(attributes(html, 'slot:avatar-fallback').has('hidden'), false)
    assert.equal(text(html), 'AL')
  })

  it('renders the small and large sizes', async () => {
    for (let size of ['sm', 'lg'] as const) {
      let avatar = attributes(await renderToString(<Avatar size={size} />), 'span')

      assert.equal(avatar.get('data-size'), size)
    }
  })

  it('renders no image without a source, so only the fallback shows', async () => {
    let html = await renderToString(
      <Avatar>
        <AvatarImage alt="Grace Hopper" />
        <AvatarFallback>GH</AvatarFallback>
      </Avatar>,
    )

    assert.deepEqual(tags(html, 'img'), [])
    assert.equal(text(html), 'GH')
  })

  it('keeps srcset, sizes, loading and referrer settings on the image', async () => {
    let image = attributes(
      await renderToString(
        <AvatarImage
          src="/avatars/ada.png"
          srcSet="/avatars/ada@2x.png 2x"
          sizes="2rem"
          loading="lazy"
          referrerPolicy="no-referrer"
          alt="Ada Lovelace"
        />,
      ),
      'img',
    )

    assert.equal(image.get('srcset'), '/avatars/ada@2x.png 2x')
    assert.equal(image.get('sizes'), '2rem')
    assert.equal(image.get('loading'), 'lazy')
    assert.equal(image.get('referrerpolicy'), 'no-referrer')
  })

  it('delays the fallback with CSS, so it shows after the delay also without JavaScript', async () => {
    let fallback = attributes(await renderToString(<AvatarFallback delay={600}>AL</AvatarFallback>), 'span')

    assert.equal(fallback.get('data-delayed'), '')
    assert.equal(fallback.get('style'), 'animation-duration: 600ms;')
    assert.equal(
      attributes(
        await renderToString(
          <AvatarFallback delay={600} style="color: red">
            AL
          </AvatarFallback>,
        ),
        'span',
      ).get('style'),
      'animation-duration: 600ms; color: red',
    )
    assert.equal(
      attributes(await renderToString(<AvatarFallback>AL</AvatarFallback>), 'span').has('data-delayed'),
      false,
    )
  })

  it('renders the badge, group and count parts', async () => {
    let html = await renderToString(
      <AvatarGroup>
        <Avatar>
          <AvatarFallback>AL</AvatarFallback>
          <AvatarBadge role="img" aria-label="Online" />
        </Avatar>
        <AvatarGroupCount>+3</AvatarGroupCount>
      </AvatarGroup>,
    )

    assert.deepEqual(
      tags(html).map((tag) => `${tag.name} ${tag.attributes.get('data-slot')}`),
      ['div avatar-group', 'span avatar', 'span avatar-fallback', 'span avatar-badge', 'div avatar-group-count'],
    )
    assert.equal(attributes(html, 'slot:avatar-badge').get('aria-label'), 'Online')
  })
})
