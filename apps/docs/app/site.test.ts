import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { homepage as approvedHomepage, seoPhrase as approvedPhrase } from '../../../scripts/contracts.ts'
import { basePath, canonicalUrl, homepage, href, pageTitle, seoPhrase, siteTitle } from './site.ts'

describe('the site identity', () => {
  it('keeps the approved phrase and homepage (C-976, C-981)', () => {
    assert.equal(seoPhrase, approvedPhrase)
    assert.equal(homepage, approvedHomepage)
    assert.equal(siteTitle, 'RemixCN - shadcn components for Remix V3')
    assert.equal(basePath, '/remixcn/')
  })

  it('titles the home page with the site title and every other page with its own title first', () => {
    assert.equal(pageTitle(), 'RemixCN - shadcn components for Remix V3')
    assert.equal(pageTitle('Button'), 'Button - RemixCN - shadcn components for Remix V3')
  })
})

describe('href', () => {
  it('puts every page under the project path, ending in a slash so a static host serves its index.html', () => {
    assert.equal(href(), '/remixcn/')
    assert.equal(href('docs/'), '/remixcn/docs/')
    assert.equal(href('docs/components/button/'), '/remixcn/docs/components/button/')
  })

  it('keeps a fragment and refuses paths that would leave the project path or skip the slash', () => {
    assert.equal(href('docs/#install'), '/remixcn/docs/#install')
    assert.throws(() => href('/docs/'), /docs\//)
    assert.throws(() => href('../other/'), /\.\.\/other\//)
    assert.throws(() => href('docs'), /end in a slash/)
    assert.throws(() => href('https://example.com/'), /example\.com/)
  })

  it('makes canonical URLs on the approved homepage', () => {
    assert.equal(canonicalUrl(''), 'https://janhesters.github.io/remixcn/')
    assert.equal(canonicalUrl('docs/cli/'), 'https://janhesters.github.io/remixcn/docs/cli/')
  })
})
