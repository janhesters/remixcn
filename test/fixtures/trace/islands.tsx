// A client entry of the Trace fixture page only: a row with long content, so
// the tests can check that long titles, long words and a long detail wrap,
// and that a link at the end of the detail takes focus only while it shows.
import { clientEntry, css } from 'remix/component'

import { CircleAlertIcon } from '#remixcn/lib/icons.tsx'
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from '#remixcn/ui/trace.tsx'

const widthStyles = css({ width: '100%', maxWidth: '24rem' })
const logStyles = css({ whiteSpace: 'pre-wrap' })

const log = [
  'GET https://status.example.com/api/v2/incidents?component=checkout-deploy&include=updates,affected_components returned 504 after 30 seconds.',
  'The deploy waited for image optimization, which processed 1,284 images because the cache key changed with every commit.',
  'Retrying with the lockfile and the image directory as the cache key skipped 1,270 of them, and the step finished in 41 seconds.',
  'The remaining 14 images were new in this commit, so they had to be processed either way.',
  'Nothing else in the build changed its timing by more than two seconds.',
].join('\n\n')

/** A failed fetch whose title, description and detail are all long. */
export const TraceLongContent = clientEntry(import.meta.url, function TraceLongContent() {
  return () => (
    <Trace mix={widthStyles}>
      <TraceCollapsible defaultOpen>
        <TraceCollapsibleTrigger>
          <TraceLine status="error">
            <TraceIcon>
              <CircleAlertIcon />
            </TraceIcon>
            <TraceTitle>
              Failed to fetch status.example.com/incidents/2026/10/30/checkout-deploy-image-optimization-cache-key
            </TraceTitle>
            <TraceDescription>HTTP 504 after 30s</TraceDescription>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent mix={logStyles}>
          {log}
          {'\n\n'}
          <a href="#full-log">Open the full log</a>
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  )
})
