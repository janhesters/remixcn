# Carousel

Slides in a native scroll container with CSS scroll snapping, previous and next buttons, arrow keys, mouse drags, optional autoplay, and a typed API. It replaces Embla Carousel, which shadcn's Carousel wraps.

- Source: `registry/ui/carousel.tsx`. Needs `registry/ui/button.tsx`, `registry/lib/icons.tsx`, `registry/lib/styles.ts` and `registry/lib/theme.css`.
- Examples: `registry/examples/carousel-example.tsx`. Run them with `bun run carousel-examples` (http://localhost:4423/), and `bun run capture:carousel-examples` writes the screenshots in `docs/images/carousel/`.
- Upstream: shadcn/ui [`carousel.tsx`](https://github.com/shadcn-ui/ui/blob/96da9cc7f1aa10580a3741664e2a77c721206c00/apps/v4/registry/bases/base/ui/carousel.tsx), its [docs](https://ui.shadcn.com/docs/components/base/carousel), and [Embla Carousel](https://www.embla-carousel.com/get-started/react) for the behavior.

## How it runs

| Part | Element | Without JavaScript |
| --- | --- | --- |
| Carousel | `<div role="region" aria-roledescription="carousel">` | The same region, named by you |
| CarouselContent | A focusable `<div>` that scrolls, around a flex row or column of slides | Scrolls natively with its scrollbar, touch, a trackpad, and the keyboard, and stops at each slide |
| CarouselItem | `<div role="group" aria-roledescription="slide" aria-label="2 of 5">` | The same, with the position the server counted |
| CarouselPrevious, CarouselNext | Button, outline, icon size | Natively disabled |
| CarouselAutoplayToggle | Button, outline, icon size | Natively disabled; nothing rotates |

The slides scroll natively, so the page works before the script runs and on a page that never hydrates. In the browser, Carousel measures the snap positions, tracks the selected one, turns the buttons on, hides the scrollbar, and adds the keys, the mouse drag, autoplay and the announcements.

It runs inside a client entry of your app, as every example does. It isn't a client entry itself, for the reasons Resizable and Button found in `remix@3.0.0`: an entry's props must serialize to JSON, so it couldn't take your `mix`, `setApi` or `messages`, and the server would render the slides of an entry to static HTML.

## Usage

```tsx
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '#remixcn/ui/carousel.tsx'

<Carousel aria-label="Featured invoices">
  <CarouselContent>
    <CarouselItem>…</CarouselItem>
    <CarouselItem>…</CarouselItem>
    <CarouselItem>…</CarouselItem>
  </CarouselContent>
  <CarouselPrevious />
  <CarouselNext />
</Carousel>
```

## Composition

```text
Carousel
├── CarouselContent
│   ├── CarouselItem
│   └── CarouselItem
├── CarouselPrevious
├── CarouselNext
└── CarouselAutoplayToggle, with autoplay
```

- **Name.** A carousel needs `aria-label` or `aria-labelledby`. The type asks for one.
- **Slides.** Each child of CarouselContent is one slide, also through arrays, fragments and your own component that renders a CarouselItem. CarouselContent counts them on the server, so each slide is named by its position, such as "2 of 5", before any script runs. Give a slide `aria-label` to name it yourself.
- **Sizes.** shadcn sets `basis-1/3` on each item. Set `--carousel-slides` instead: the number of slides that fit the view. It's 1 by default. Set it on the carousel, the content or any ancestor, in a media query for responsive sizes: `css({ '@media (min-width: 40rem)': { '--carousel-slides': '2' } })`. `--carousel-item-size` gives every slide one size, such as `12rem`.
- **Spacing.** shadcn uses a negative margin on the content and padding on each item. Set `--carousel-gap` instead, `1rem` by default. The slide sizes take the gap into account.
- **Height of a column.** A vertical carousel scrolls inside the height you give its content: `<CarouselContent mix={css({ height: '17rem' })}>`. CarouselContent's props go to the row or column of slides, as in shadcn.
- **Nested carousels.** The custom properties inherit, so set them again on an inner carousel. The inner carousel takes its arrow keys first. Its select events bubble through the outer one, so check `event.target`.
- **Buttons.** CarouselPrevious and CarouselNext sit outside the slides, 3rem before and after them, as in shadcn. Leave room for them, such as with a margin around the carousel, or place them with your own `css()`. shadcn's examples hide them on small screens; RemixCN's examples keep them and move them below the slides when a container query finds too little room, such as on a phone with large text. They take Button's props, and `label` for their hidden name. Your children replace the chevron and the name.
- **Custom parts.** A part inside the carousel reads `handle.context.get(Carousel)` while it renders, in place of `useCarousel()`. It gets the orientation, the selected snap, the snap count, whether each button can scroll, the autoplay state, `scrollTo`, `scrollPrevious`, `scrollNext`, `play`, `pause`, and the API. It renders again on every change.

## API

### Carousel

Takes the props of `<div>`, `aria-label` or `aria-labelledby`, and:

| Prop | Type | Default |
| --- | --- | --- |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` |
| `align` | `'start' \| 'center' \| 'end'` | `'center'`, as Embla |
| `loop` | `boolean` | `false` |
| `startIndex` | `number` | `0` |
| `autoplay` | `boolean \| { delay?: number }` | off; `delay` is 4000 ms |
| `mouseDrag` | `boolean` | `true` |
| `setApi` | `(api: CarouselApi) => void` | |
| `messages` | `Partial<CarouselMessages>` | English |

It renders `data-slot="carousel"`, `data-orientation`, `data-ready` once it runs in the browser, `data-autoplay` (`running`, `paused` or `stopped`) with autoplay, and `data-dragging` while a mouse drags. A visually hidden `data-slot="carousel-status"` live region holds the announcements.

`orientation`, `align`, `loop`, `autoplay`, `mouseDrag` and `messages` may change from render to render. `startIndex` and `setApi` count once, when the carousel starts running in the browser.

### CarouselContent

Takes the props of `<div>`, which go to the row or column of slides (`data-slot="carousel-track"`). Around it, the scroll container renders `data-slot="carousel-content"` and `tabindex="0"`. The row ends with a hidden, empty `data-slot="carousel-gap"` probe as wide as `--carousel-gap`, so the carousel notices a new gap; it takes no room.

### CarouselItem

Takes the props of `<div>`. Renders `data-slot="carousel-item"`, `data-orientation`, `data-align`, and `data-selected` on the slides of the selected snap, in place of Embla's ClassNames plugin.

### CarouselPrevious and CarouselNext

Take Button's props, `variant="outline"` and `size="icon-sm"` by default, and `label` (`"Previous slide"`, `"Next slide"`). They render `data-slot="carousel-previous"` or `"carousel-next"` and `data-orientation`. At the first or last snap of a carousel that doesn't loop, they render `aria-disabled="true"` and keep focus.

### CarouselAutoplayToggle

Takes Button's props, `stopLabel` (`"Stop slide rotation"`) and `startLabel` (`"Start slide rotation"`). It shows a pause or a play icon and renders `data-slot="carousel-autoplay-toggle"` and `data-state` (`playing` or `stopped`). It's disabled without autoplay.

### CarouselApi

`setApi` receives it once the carousel runs in the browser:

| Member | Does |
| --- | --- |
| `root` | The carousel element, which dispatches the select event |
| `connected` | `false` once the carousel is removed. The methods then do nothing, and no event fires |
| `selectedIndex`, `previousIndex` | The selected snap and the one before it, from 0 |
| `snapCount` | The snap positions. With several slides in view, fewer than the slides |
| `slides`, `slidesInSnap(index)` | The slide elements, and the slides a snap shows from its start |
| `canScrollPrevious`, `canScrollNext` | Whether the buttons can move |
| `scrollTo(index, { instant })`, `scrollPrevious()`, `scrollNext()` | Scroll smoothly, or jump with `instant`. Reduced motion always jumps |
| `playing`, `autoplayState`, `play()`, `pause()` | Autoplay's state, and the rotation control's actions |

### CarouselSelectEvent

`'remixcn:carousel-select'`, exported as `carouselSelectType`, fires on the carousel once it runs, and whenever the selected snap or the number of snaps changes. It bubbles and carries `index`, `previousIndex`, `snapCount` and `reason`: `'init'`, `'user'` (buttons, keys, drags, touch, wheel and focus), `'api'`, `'autoplay'` or `'layout'` (a resize, or slides that came or went). Listen with `mix={on(carouselSelectType, …)}` on Carousel, or with `api.root.addEventListener`.

### Messages

`messages.slide(position, count)` names a slide without an `aria-label` ("2 of 5"), and `messages.selected(first, last, count)` is the announcement ("Slide 2 of 5", or "Slides 2 to 4 of 5" with several in view). Pass your own to translate them, as the right-to-left example does in Arabic.

### Snap math

The file also exports the pure functions it uses: `carouselSnaps`, `nearestSnap`, `stepSnap`, `carouselKeyStep` and `autoplayRuns`, with their types.

## Behavior

- **Snap positions.** Each slide lines up by `align` and stops at the ends of the scroll range, and slides that land on one position share a snap, as Embla's default `containScroll: 'trimSnaps'`. The snaps end where the last slide ends: content that overflows a slide, such as a long word, still scrolls into view, but makes no snap of its own. `scroll-snap-stop: always` keeps a fast swipe from skipping a snap.
- **Keys.** Left and Right move one snap in a horizontal carousel, swapped in right-to-left text, and Up and Down in a vertical one. They work from anywhere in the carousel: the scroll container, the buttons, and links in a slide. They stay with fields and widgets that use them: inputs, text areas, selects, editable content, and elements with the roles combobox, grid, listbox, menu, menubar, radiogroup, scrollbar, slider, spinbutton, tablist, textbox, tree and treegrid. Keys with a modifier, and keys a nested carousel or your own handler already handled (`defaultPrevented`), stay the browser's.
- **Pointer.** Touch, pens, trackpads and wheels scroll natively, and the carousel selects the snap the scroll stops at. A mouse drags the slides once it moves 8px along the axis: the drag ends at the nearest snap, or one snap on after 24px, and the click that ends it doesn't reach a link or button. A press on a field never starts a drag, and a press that moves across the axis is left to text selection.
- **Focus.** The carousel never moves focus, also not when autoplay advances. Every slide stays in the tab order and the accessibility tree. When focus moves to something in a slide out of view, such as with Tab, the browser scrolls it into view and the carousel selects that snap. At an end, the buttons keep focus.
- **Announcements.** After a change you make, by button, key, drag, touch, focus or the API, the live region says "Slide 2 of 5" once the scroll stops. Autoplay, the start and layout changes say nothing, so a screen reader isn't interrupted while the slides rotate. The carousel's own smooth scroll ends with the browser's `scrollend` event, not a timer, so it stays its own on a page busy for a second too. Browsers without `scrollend` count a scroll as done once its scroll events stop for a moment.
- **Resizing and slides that change.** A ResizeObserver and a MutationObserver measure again: when the scroll container, a slide or `--carousel-gap` changes size, and when slides come and go. After a window resize, the carousel also measures again when its scroll range changed, such as from padding or a gap in a media query. A new `align` or `orientation` measures again too, and the parts and `data-selected` follow. The first slide of the selected snap stays selected and in view. When it's removed, the snap keeps its index, as in Embla.
- **Loop.** `loop` lets the buttons, the keys, the API and autoplay go from the last snap to the first and back, scrolling back across the slides. Embla's seamless loop moves slides around with transforms; native scrolling can't, so a touch or wheel scroll stops at the ends.
- **Autoplay.** Off unless you pass `autoplay`. It moves on one snap each `delay`, back to the first after the last, as Embla's Autoplay. It pauses while a mouse is over the carousel, while focus is inside it, while the page is hidden, and while reduced motion is preferred, and continues once nothing holds it. A change you make starts the delay over. The toggle, `pause()` and `play()` stop and start it; starting it wins over the hover and focus that pressing the toggle took. Without reduced motion the scroll is smooth.
- **Reduced motion.** Scrolls jump instead of scrolling smoothly, and autoplay doesn't run.
- **Cleanup.** Removing the carousel or its content removes its listeners, observers and timers, and ends a drag. The API then does nothing and no event fires.

## Source and behavior map

Upstream: `apps/v4/registry/bases/base/ui/carousel.tsx`, its examples in `apps/v4/registry/bases/base/examples/carousel-example.tsx` and `apps/v4/examples/base/carousel-*.tsx`, and the Carousel page at the pinned shadcn/ui commit; Embla Carousel's documented options, API, events and Autoplay plugin. RemixCN copies no code from Embla. It maps the behavior to the platform.

| Upstream | RemixCN |
| --- | --- |
| `Carousel` with `role="region"`, `aria-roledescription="carousel"` and `data-slot` | The same, plus a required name and the live region |
| `CarouselContent`: an `overflow-hidden` viewport with Embla's ref, around a flex row | A native scroll container with `scroll-snap-type: x mandatory` or `y mandatory`, focusable, around the same row (`data-slot="carousel-track"`), which takes the props |
| `CarouselItem` with `role="group"`, `aria-roledescription="slide"`, `basis-full` | The same, named by its position, with `scroll-snap-align` from `align` |
| `CarouselPrevious`, `CarouselNext` on Button, outline `icon-sm`, `absolute -left-12`, `rotate-90` in a column, disabled at the ends | The same parts and look, with logical insets, `translate` and `rotate`. They keep focus at the ends with Button's `focusableWhenDisabled` |
| `hidden sm:inline-flex` on the buttons in the examples | The examples move them below the slides in a narrow container instead, so they stay usable |
| `IconPlaceholder` chevrons, `cn-rtl-flip` | `ChevronLeftIcon` and `ChevronRightIcon` from `icons.tsx`, mirrored in right-to-left text in a row |
| `onKeyDownCapture`: Left and Right only, also from inputs | A bubbling listener: Left and Right, swapped in right-to-left text, or Up and Down in a column; never from fields or widgets that use the arrows |
| `orientation` | The same prop. Embla's `axis` follows it |
| `opts.align`, `opts.loop`, `opts.startIndex` | The props `align`, `loop` (going back across the slides), `startIndex` |
| `opts.direction` | Read from the page's `dir`, so nothing to pass |
| `opts.containScroll: 'trimSnaps'` | Always, from native snapping and `carouselSnaps` |
| `opts.slidesToScroll`, `dragFree`, `skipSnaps`, `duration`, `inViewThreshold`, `dragThreshold`, `active` | Not ported. One snap per step, snapping is mandatory, `scroll-snap-stop: always`, the browser's smooth scroll, and a fixed 8px drag threshold |
| `opts.watchDrag`, `watchResize`, `watchSlides`, `watchFocus` | `mouseDrag` for the mouse; touch always scrolls natively. Resizes, slide changes and focus are always watched |
| `opts.breakpoints` | Media queries that set `--carousel-slides` and `--carousel-gap` |
| `basis-*` on items, `-ml-*` and `pl-*` for spacing | `--carousel-slides`, `--carousel-item-size` and `--carousel-gap` |
| `setApi` with Embla's API: `scrollPrev`, `scrollNext`, `scrollTo`, `canScrollPrev`, `canScrollNext`, `selectedScrollSnap`, `previousScrollSnap`, `scrollSnapList`, `slideNodes`, `rootNode` | `setApi` with `CarouselApi`: `scrollPrevious`, `scrollNext`, `scrollTo`, `canScrollPrevious`, `canScrollNext`, `selectedIndex`, `previousIndex`, `snapCount`, `slidesInSnap`, `slides`, `root` |
| Embla events `init`, `select`, `reInit` with `api.on()` | `CarouselSelectEvent` with `reason`, on the carousel element |
| `useCarousel()` | `handle.context.get(Carousel)` in a part's render |
| `plugins` with Embla Autoplay (`delay`, `stopOnInteraction`, `stopOnMouseEnter`, `stopOnFocusIn`, `play`, `stop`, `reset`) | The `autoplay` prop with `delay`, `CarouselAutoplayToggle`, and `play()` and `pause()`. It pauses on hover, focus, a hidden page and reduced motion, and a change you make starts the delay over |
| Other Embla plugins: Fade, Class Names, Auto Height, Auto Scroll, Wheel Gestures | Not ported. `data-selected` replaces Class Names, and wheels and trackpads scroll natively. Fade, Auto Height and Auto Scroll have no native equivalent here |
| Examples: Basic, Multiple, With Gap; demos: Sizes, Spacing, Orientation, API, Plugin, RTL | `CarouselBasic`, `CarouselSizes`, `CarouselSpacing`, `CarouselVertical`, `CarouselWithApi` (with a slide picker), `CarouselAutoplay`, `CarouselRightToLeft`, plus `CarouselLoop` and `CarouselInvoices` with links and fields. Number cards replace shadcn's Card, which isn't ported yet |

## Accessibility checks

Automated (`bun run test`, `bun run test:browser`, `bun run test:e2e`). The browser and end-to-end tests run in Chromium, Firefox and WebKit:

- axe-core: no WCAG 2.2 A or AA violations on the examples, before and after hydration, in light and dark.
- Server HTML: the named region, slides named by position from arrays, fragments and components, natively disabled buttons, and an empty live region. Hydration: no console errors or warnings.
- Keyboard: Left and Right, swapped in right-to-left text; Up and Down in a column; keys from the scroll container, the buttons and links; none from inputs, text areas or a slider; modifiers; a nested carousel; Tab into a slide out of view; focus kept on a button at an end.
- Pointer: a mouse drag, a drag from a link that doesn't follow it, a click that stays a click, no drag from a field or with `mouseDrag` off, a touch swipe in Chromium, and a sideways wheel in the other engines, since Playwright drives real touch only in Chromium.
- Snaps and changes: alignments with several slides in view, content that overflows the last slide, a new alignment, loop, `startIndex`, the API, a resize, a window resize that re-snaps, a new gap, a gap for narrower windows, slides added and removed, and two carousels that stay apart.
- Autoplay: rotation and its end, pauses on hover, focus, a hidden page (stubbed in the browser tests) and reduced motion, the toggle and the API, no announcement and no focus move while it rotates, also when the page runs its timers before the smooth scroll has moved (Playwright's clock), off by default.
- Cleanup: no events, scrolls or timers after removal.
- Without JavaScript: the region and slides, a visible scrollbar, disabled buttons, and keyboard scrolling that snaps.
- Focus: the theme's 2px outline on the scroll container and the buttons, also in forced colors, where the buttons keep their borders. Reduced motion: scrolls jump. Reflow: 320px wide without scrolling sideways, also at 200% text.

Not checked yet:

- Screen readers. Nobody has listened to the slides or the announcements in NVDA, JAWS, VoiceOver or TalkBack.
- Real touch devices, Safari itself and Windows High Contrast. Touch and forced colors were emulated, and WebKit runs in CI only.
- A hidden page in a real browser: the end-to-end tests can't hide a page, so the browser tests stub `document.visibilityState`.

These checks show how the component behaves in three browser engines. They're not an accessibility certification.
