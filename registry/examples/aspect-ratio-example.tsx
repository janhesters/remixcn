// RemixCN Aspect Ratio examples: https://janhesters.github.io/remixcn/
// Copyright (c) 2026 Jan Hesters. MIT License.
// Adapted from shadcn/ui (MIT, Copyright (c) 2023 shadcn).
// License texts: https://github.com/janhesters/remixcn/blob/main/THIRD_PARTY_NOTICES.md
import { css } from 'remix/component'

import { AspectRatio } from '#remixcn/ui/aspect-ratio.tsx'

const space = (steps: number) => `calc(var(--spacing) * ${steps})`
const rowStyles = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 7rem), 1fr))',
  alignItems: 'start',
  gap: space(4),
})
const frameStyles = css({ overflow: 'hidden', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--muted)' })
const fillStyles = css({ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' })
const captionStyles = css({
  margin: 0,
  marginBlockStart: space(2),
  color: 'var(--muted-foreground)',
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--text-sm--line-height)',
})

// An invented chart, drawn inline, so the example loads no image file.
const chart = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"><rect width="160" height="90" fill="#e5e5e5"/><path d="M0 70 30 55 60 62 90 35 120 42 160 15V90H0Z" fill="#737373"/><path d="M0 70 30 55 60 62 90 35 120 42 160 15" fill="none" stroke="#171717" stroke-width="3"/></svg>',
)}`

/** The common ratios. Each box takes its shape before the image loads. */
export function AspectRatioRatios() {
  let ratios = [
    { label: '16:9', ratio: 16 / 9 },
    { label: '1:1', ratio: 1 },
    { label: '9:16', ratio: 9 / 16 },
    { label: '21:9', ratio: 21 / 9 },
  ]

  return () => (
    <div mix={rowStyles}>
      {ratios.map(({ label, ratio }) => (
        <figure key={label} style={{ margin: 0 }}>
          <AspectRatio ratio={ratio} mix={frameStyles}>
            <img src={chart} alt={`Revenue chart in ${label}`} mix={fillStyles} />
          </AspectRatio>
          <figcaption mix={captionStyles}>{label}</figcaption>
        </figure>
      ))}
    </div>
  )
}

/** A video frame keeps its 16:9 shape at every width. */
export function AspectRatioVideo() {
  return () => (
    <AspectRatio ratio={16 / 9} mix={frameStyles}>
      <img src={chart} alt="Monthly revenue, rising from January to June" mix={fillStyles} />
    </AspectRatio>
  )
}
