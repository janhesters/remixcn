# Agent notes for RemixCN

Lessons engineers learned while working on RemixCN, moved here from their
private memory on 21 November 2026. Check a note against the current code
before relying on it, and list corrections under **Lessons** in your PR.

<a id="ci-fonts-reproduce-locally"></a>

## Ci fonts reproduce locally

_CI (ubuntu-24.04) renders sans-serif as DejaVu Sans, wider than Jan's Liberation Sans; how to reproduce font-dependent layout failures locally_

remixcn's CI runners resolve `sans-serif`/`system-ui` to DejaVu Sans. Jan's machine resolves them to Liberation Sans, which is narrower. So reflow tests (320px at 200% text) can pass locally and fail in CI in every engine.

To reproduce locally without touching system fonts:
- Download the DejaVu TTFs into $TMPDIR/fonts. Drop DejaVuMathTeXGyre.ttf, or `sans-serif` resolves to it.
- Write a fonts.conf with only that `<dir>`, a `<cachedir>` in $TMPDIR, and strong aliases mapping sans-serif, system-ui, serif and monospace to DejaVu.
- Run with `FONTCONFIG_FILE=$TMPDIR/fonts.conf`. Firefox also needs `MOZ_DISABLE_CONTENT_SANDBOX=1`: its sandbox can't read fonts in /tmp and silently renders 1em boxes, so the measurements are garbage.
- Never set `FONTCONFIG_FILE=` to an empty string. That breaks font lookup and causes fake failures.

- Ubuntu's `fonts-dejavu-core_2.37-8_all.deb` has no DejaVu Sans Mono (newer Ubuntu splits it into `fonts-dejavu-mono`). Without it, Code Block's wrapping and keyboard-scroll e2e tests fail in local WebKit on main too; fetch the mono package as well before trusting code-block results (PR #60, 2026-10-30).

Related: [Webkit not runnable locally](#webkit-not-runnable-locally).

<a id="e2e-axe-and-hangs"></a>

## E2e axe and hangs

_remixcn e2e: axe hangs on JS-disabled pages, t.serve contexts can't open pages, and how to find a hanging remix e2e test_

Found while porting Carousel (remixcn ticket #23, 2026-10-29), Playwright 1.64.1, remix test 1.0.0:

- `findAccessibilityViolations` (axe) never returns on a page from a `newContext({ javaScriptEnabled: false })`: axe injects its script with `page.evaluate`. For an axe check "before hydration", open a page in `browser.newContext()` and `page.route()` abort every `/assets/` request except CSS, so the module entry never loads.
- `page.context().newPage()` on a `t.serve` page throws "Please use browser.newContext()". Make your own context and close it in `t.after`.
- `remix test` prints a suite only when it ends, so a hanging test shows nothing, also through `| grep` (and a `timeout` kills it silently). Write the output to a file in `$TMPDIR`, then run tests one by one with `--only '<name part>'` and a short `timeout` to find the hang.
- `locator.boundingBox()` of an element below the fold gives coordinates outside the window; `page.mouse` then hits `<html>`. Call `scrollIntoViewIfNeeded()` first.
- `remix test`'s browser runner never removes a finished file's iframe (only `display: none`) and lists a failed test's error above the iframes. In WebKit that pushes the next file's iframe below the window, where WebKit throttles rAF: after any failure, later files crawl (Resizable 0.1s to 20s) and the lane dies on its 90s progress timeout. So a WebKit "stall" after one failure is a knock-on effect; fix the first failure. A 4000px-tall runner viewport removed it in an experiment (PR #56).
- Not only failures push the frame down (PR #58, 2026-10-30): the runner adds one summary row per finished *suite* (each nested `describe` is its own row) above the next file's iframe. Message Scroller's eight nested describes pushed the `registry/lib` files below the 1280x720 window, and the WebKit lane stalled at 13/18 files with "tests 1, fail 1" and no failing test named. That "1 failed" is the run-level progress timeout, not a test. Fix in the file: one `describe` per test file. Main itself sits near the limit, so judge it with CI's fonts ([Ci fonts reproduce locally](#ci-fonts-reproduce-locally); local Liberation fonts make main's own files stall), and run files in the lane's order: `remix test` without arguments runs `registry/ui` before `registry/lib`, while explicit `git ls-files` arguments run lib first.
- CI runs the e2e files of a lane at the same time, so WebKit there can pause a smooth scroll for over 500ms (PR #56, 2026-10-30: "smooth ends at 202" of 230). Never end a recording on a quiet period or a frame count: wait for the expected state (the target position), then a short settle, with a hard cap, and assert what the component controls (such as the `behavior` passed to `scrollTo`).
- Other agents run their own `remix test` processes on the same machine: stop only process groups you started, found by their working directory (`readlink /proc/<pid>/cwd`), never by a name pattern. See Never kill processes by name.

Related: [Playwright scrollbars and touch](#playwright-scrollbars-and-touch), [Webkit not runnable locally](#webkit-not-runnable-locally).
- Fix for the WebKit browser-lane stall (PR #57, 2026-10-30): when main reached 21 suites, Toast and Sonner's two files made 23 and the lane stalled at 17/22 in CI. The browser lane now runs `remix test --type browser --playwrightConfig ./playwright.browser.config.ts`, which spreads the shared config and sets `use.viewport` to 1280x4000. Only the browser lane uses it (e2e pages keep 720px). Reproduced locally with the scratch-WebKit recipe: stall without, 312/312 with. If that config is on main, a new browser test file shouldn't stall the lane anymore.
- PR #46 (Checkbox…Toggle Group, 2026-10-30) hit the same stall at 20/25 after its five test files and carries the same fix: `test:browser` = `remix test --type browser --playwrightConfig ./playwright.browser.config.ts` (the flag overrides remix.json's configFile), plus `test/browser-lane.test.ts` pinning the script, the shared projects/options and a >=4000px window. Whichever of #46 and #57 merges second should take main's version of these files on rebase.
- Root fix (PR #62, ticket #61, 2026-10-30): a Bun patch, `patches/@remix-run%2Ftest@1.0.0.patch`, makes the runner `scrollIntoView` each file's iframe after attaching it; main's WebKit lane went from a stall at 15/20 to 269/269. It overlaps #46/#57's 4000px window; the PM decides which stays. What actually throttles (measured): WebKit stops rAF in an offscreen iframe only once it shows content (an empty iframe kept 60 fps; appending any button dropped it to 0), timers stay normal; Firefox runs offscreen iframes at 1 fps; Chromium doesn't throttle same-origin ones. A rAF probe must render something first.
- Running the installed runner on fixtures: `node node_modules/remix/dist/cli-entry.js --config <fixture>/remix.json test --project <p> --reporter tap <file> <file>` from the repo root. Globs in a `--config` file resolve from that file's folder, cwd stays the repo root (the browser runner's rootDir is cwd, so it must be), and positional files keep their order. `test/browser-runner.test.e2e.ts` does this per engine.
- Dialog keyboard flakes in WebKit, root cause found (PR #60 round 2, 2026-10-30): `createFocusScope` moves focus on the popup's first rAF, and WebKit delays rAF for a page it treats as inactive (several pages of one browser at once, as the e2e runner has). A Tab before that frame got undone. Reproduce by driving the sequence on 3 pages with `Promise.all`; log `focusin` and `keydown` in the page. Fixed in focus-scope.ts (a key/pointer press inside before the first frame keeps the user's focus), and Dialog's `openFrom()` waits two rAFs after opening. Any test asserting a popup's initial focus must wait for that frame. PR #62 (round 2) carries #60's two test-only hunks in `test/dialog.test.e2e.ts` byte for byte (blob 595ae85), so they merge in either order; measured there: focus on the action at the assert, Cancel two frames later, two frames 100 to 190ms in local WebKit.
- `remix test --only` takes a regular expression: `Shift+Tab` in the pattern matches nothing. Use a plain phrase.
- PR #59 (2026-10-30) hit the same stall at 19/24 (4 new files) and carries #57's `playwright.browser.config.ts` byte for byte, so rebases resolve to main's copy. The scratch-WebKit recipe plus CI fonts reproduced 19/24 and then 334/334 with the window.
- An e2e contrast check with motion on (`reducedMotion: 'no-preference'`) right after `page.emulateMedia({ colorScheme })` reads backgrounds mid-transition (fake 1.04:1). Await `document.getAnimations().filter(a => a instanceof CSSTransition).map(a => a.finished)` before measuring.
- Cleanup (ticket #64, PR #65, 2026-10-30): `playwright.browser.config.ts` and the `--playwrightConfig` flag are removed; both lanes use `playwright.config.ts` via remix.json at the default 1280x720, relying on the #62 runner patch. With it, all six lanes passed locally (browser 420/420, e2e 199/199 per engine, WebKit via the scratch recipe). #65 merged into main on 2026-10-30 (128d780): notes above about the 4000px window are history.
- 2026-10-30: main dropped `playwright.browser.config.ts` (commit "Run both test lanes in the shared config at the default window") once #62's runner patch landed; `test:browser` is plain `remix test --type browser` again and `bun install` applies `patches/@remix-run%2Ftest@1.0.0.patch`. After rebasing onto it, reinstall so the patch is in node_modules. Local WebKit then ran the full browser lane (43 files) and Dialog e2e 3/3 green.
- Never wait in e2e with `locator.evaluate(() => new Promise(... requestAnimationFrame loop ...))`: when the condition never holds the test hangs silently until the lane dies (PR #70). Use `page.waitForFunction(fn, arg, { timeout: 5000 })` so it fails with a stack line. A test that drags with the mouse must scroll its target to mid-window first, or an item-aligned list near the window's bottom puts items outside it.
- WebKit validation message starves clicks (PR #69, 2026-10-30, root cause found): while WebKit shows its own validation message (~5s, after a refused submit or reportValidity()), Playwright's WebKit renders few frames on a busy machine, so the next click's rAF-based "stable" check never finishes: the log shows only "waiting for element to be visible, enabled and stable" with no "element is not stable" retry. Reproduced with a probe: `taskset -c 0` plus 3 pages spinning rAF in the same browser (separate busy processes or the runner alone did NOT reproduce). Escape/blur/refocus don't hide the message. Fix: `test/validation.ts` `suppressValidationMessages(page)` cancels `invalid` (capture) and lists failed controls; assert `field !== document.activeElement` as the deterministic regression check (fails in all 3 engines without it). Use it in any e2e test that clicks on after a refused submit.
- Firefox delays a page's `load` event until a module script's top-level await settles; Chromium doesn't (PR #73 round 2, 2026-10-30). Every remixcn fixture entry ends with `await app.ready()`, so in Firefox `page.goto()` (waitUntil load) includes hydrating every client entry and spends the 10s `navigationTimeout` on it; in Chromium the following `html[data-ready]` wait spends the 5s `actionTimeout`. A long page (Questionnaire, 18+ entries) timed out in a full Firefox lane: `page.goto: Timeout 10000ms exceeded`. Reproduce by holding a client entry's module with `page.route` for 11s. Fix in setup: `goto(path, { waitUntil: 'domcontentloaded' })`, then `waitFor({ state: 'attached', timeout: 30_000 })` on `html[data-ready]`; keep `load` for no-JS pages (no hydration, and load waits for the stylesheet). The Questionnaire and Sidebar e2e files do this; other e2e files still use plain `goto`.
- Recording Playwright calls with a Proxy (`test/phases.ts`, PR #71 round 6, 2026-10-30): the bundle names classes `_Page`, `_Locator`, `Keyboard2`, `Mouse2`, so match `constructor.name.replace(/^_+|\d+$/g, '')`; `String(locator)` gives `locator('#x')`. AxeBuilder accepts the proxied page and its evaluations get recorded. remix test runs each e2e file in `worker-process.js`, so `process.argv` there isn't the command: read `/proc/<ppid>/cmdline`. The runner passes only `headless`/`channel` launch options (no `tracesDir`), so a test that never finishes can't keep a trace; only its phase log names the stuck call.
- Runner cleanup internals (PR #71 round 7, 2026-10-30): `t.serve()` pushes its own cleanup (page.close() then server.close()) straight into the runner's list, not through `t.after`, so a wrapped `t.after` can't see it; register a marker via `t.after` just before calling serve and another just after it returns. `createTestServer(...).close()` waits for open connections, so closing the server before the page hangs until the page closes. WebKit rejects a pending `page.evaluate` before `page.isClosed()` turns true, so treat a failed watchdog check as "no news", not an answer. remix assert's `deepEqual` message is just "Objects not deeply equal"; the AssertionError keeps `actual`/`expected`.
- check.ts lanes run `detached` (own process group) on POSIX since PR #71: the terminal's Ctrl+C no longer reaches them, so check forwards SIGINT/SIGTERM/SIGHUP; `process.kill(-pgid, 0)` tells whether the group still has members without /proc.
- WebKit in the e2e runner (PR #79, 2026-10-30): `locator.focus()` on an input below the 720px window doesn't scroll it into view, and anchor-position.ts sets `visibility: hidden` on a popup whose anchor is out of view, so its items fail `isFocusableItem` and nothing can be highlighted. A standalone probe script scrolled and passed, which hid the cause. Call `scrollIntoViewIfNeeded()` before `focus()` for anything the test opens. To debug inside the runner, `console.error('DBG …')` from the component and throw the collected `errors` from the test.
- CI WebKit e2e on PR #79 (2026-10-30): a flipped Combobox list sampled at x=5 instead of its input's x. anchor-position.ts measured the popup before writing `--anchor-width`, so a popup with `width: var(--anchor-width, auto)` was measured window-wide and shifted to the padding; a ResizeObserver pass fixed it ~140ms later. Chromium/Firefox fix it within the frame; WebKit in the runner (late rAF) shows the transient. Fix: write the anchor-size variables before measuring (same hunk as PR #72). Trace a popup's box per rAF plus a style MutationObserver to see transient placements.

<a id="layout-svg-and-hidden-table-gotchas"></a>

## Layout svg and hidden table gotchas

_Browser layout traps found porting Chart (ticket #22): aspect-ratio flex boxes don't grow, hidden tables widen the page, SVG keeps colors in forced colors, WebKit taps don't focus, computePosition doesn't clamp the main axis_

Measured in Chromium, Firefox and WebKit (Playwright 1.64.1) while porting Chart (remixcn #22, 2026-10-30):

- An `aspect-ratio` box that is a **flex container** doesn't grow to fit taller content in Chromium (the aspect-ratio content minimum doesn't apply through flex). A legend at 320px/200% text took the whole box and the plot got 0px. Fix: make the ratio box a plain block and give its child `min-height: 100%` (a flex column inside fills it, and taller content grows the box).
- `visuallyHidden` (1px, overflow hidden, clip-path) on a `<table>` doesn't hide its width: table boxes ignore `overflow`, so its cells widened the page to 632px at 320px. Put the hidden styles on a block wrapper around the table.
- SVG `fill`/`stroke` (attributes or CSS) keep author colors in forced colors in Chromium and Firefox (`forced-color-adjust: preserve-parent-color` on SVG). Draw edges and focus marks explicitly in `CanvasText`/`Highlight` inside `@media (forced-colors: active)`.
- WebKit doesn't focus a `tabindex` element on a touch tap (Playwright `touchscreen.tap`), so "keep until focus moves away" never ends there. Also close on a document `pointerdown` (capture) outside the element, registered with `handle.signal`.
- `computePosition` in `registry/lib/anchor-position.ts` flips and shifts only along the cross axis; a floating box wider than the room on both sides overflows. Clamp x/y yourself when it must stay inside a box.
- `Intl.ListFormat(locale, { type: 'unit', style: 'short' })` is "A, B" in English but "A, B und C" in German and joins with و in Arabic; fine for announcements, but don't assert commas in other locales.
- Node's `de-CH` grouping separator is `'` (U+0027), not `’`.

Added while porting Trace (remixcn #29, PR #74, 2026-10-30):

- Rotating an icon box that is 1rem wide but `1lh` tall (to sit on a wrapped title's first line) makes its turned box stick out sideways, which can make a 320px page scroll. Rotate the square `svg` inside, not the box.
- A flex row of icon + title + description squeezed the title to one letter per line at 200% text. Fix: `flex-wrap: wrap` on the row, and on the title a `max-width: calc(100% - (icon + gap))` keyed to its icon siblings (`[data-slot=icon] ~ &`, `&:has(~ [data-slot=icon])`), so the leading icon stays beside it and the description wraps below. Percentages resolved fine in all engines even inside `fit-content` wrappers.
- Interpolating a sum into `calc()` needs brackets: `calc(100% - ${'1rem + gap'})` subtracts 1rem and *adds* the gap. Write the constant as `(1rem + …)`. A browser test at several widths and root font sizes (16, 21, 32px) caught it.

**Why:** each cost a debugging round; reviewers check reflow at 320px/200%, forced colors and touch in all engines.
**How to apply:** for any chart, plot or fixed-ratio component, test a legend/caption at 320px with text at 200%; wrap hidden tables; test touch in WebKit via the scratch copy ([Webkit not runnable locally](#webkit-not-runnable-locally)). Related: [Remix 3 rendering gotchas](#remix-3-rendering-gotchas), [Ci fonts reproduce locally](#ci-fonts-reproduce-locally).

<a id="native-scroll-snap-controller"></a>

## Native scroll snap controller

_Event-order traps when a script tracks a CSS scroll-snap container (Carousel, #23): stale scrollend, re-snap scroll events, stale pending targets_

Learned building remixcn's Carousel (ticket #23, 2026-10-29) on native `scroll-snap-type: x mandatory`:

- A `scrollend` can belong to an earlier scroll (a mouse drag's last instant scroll) and arrive after you start your own smooth `scrollTo`. Settle your own scroll only when it reached its target, or once scroll events stop.
- A "no scroll events" fallback timer can fire before a smooth scroll starts moving under Playwright's `page.clock`, at 150ms or 1s alike (#75: the 1s one fired inside one `runFor` on a busy machine). End your own smooth scrolls on `scrollend`, keep the timer only for a short `scrollend` and engines without it, and hand the scroll to the user on a wheel along the axis or `touchmove`. See [Playwright clock vs native scroll](#playwright-clock-vs-native-scroll).
- After DOM or size changes, the browser re-snaps and sends scroll events before a rAF. Measure synchronously in the MutationObserver/ResizeObserver callback. On a window resize the re-snap's scroll event even comes before the ResizeObserver: the scroll handler compares the container's client/scroll sizes and slide count with the last measurement and measures first when they differ.
- After a layout change, drop any in-flight target index: it points into the old snap list. Re-align to the snap of the slide that was selected (by element identity).
- Restore `scroll-snap-type` after a drag only once the follow-up smooth scroll settles; restoring mid-animation re-snaps elsewhere.
- A gap change on fixed-size slides moves them without resizing any observed box (review finding on PR #56). Watch a hidden, absolutely positioned probe whose `inline-size` is the gap custom property.
- A window `resize` event fires before media queries apply, so a layout read inside it is stale. Check in the next `requestAnimationFrame`.
- A ResizeObserver delivers a first notification a frame after `observe()`. A browser test that changes styles right after "ready" races it and passes for the wrong reason: wait two frames first, then confirm the test fails without the fix.
- In browser tests, `window.frameElement.style.width` resizes the frame's window: the real resize and re-snap event order.

**Why:** each caused a real test failure that looked like flakiness.
**How to apply:** any remixcn part that watches native scrolling (Carousel, Scroll Area, later Sidebar or Command lists). Related: [Remix 3 rendering gotchas](#remix-3-rendering-gotchas), [Playwright scrollbars and touch](#playwright-scrollbars-and-touch).

<a id="playwright-clock-vs-native-scroll"></a>

## Playwright clock vs native scroll

_Playwright's clock flows with real time until runFor, which fires every due page timer back to back before native smooth scrolls move; how to probe and test that_

Learned on remixcn #75 / PR #78 (2026-10-30), Carousel autoplay announcing "Slide 2 of 5" under load:

- `page.clock.install()` without `pauseAt` lets the fake clock follow real time. A timer set at hydration fires inside a later `runFor(n)` only if real time already used up part of its delay, so slow steps before `runFor` change which timers it fires. `runFor` pauses real-time sync and fires every due timer back to back (one real `setTimeout(0)` between them).
- Native smooth scrolls (scrollTo `behavior: 'smooth'`, wheel, touch) run on the engine's clock, which Playwright can't fake. A page timer meant as "the scroll stopped" can fire before the first scroll event. End your own smooth scrolls on `scrollend` (Chromium, Firefox 157, and Playwright's WebKit 27.2 all send it, also for instant scrolls), and keep timers only as a fallback.
- `document.timeline.currentTime` isn't faked: use it as an "engine time" column in event records next to `performance.now()`.
- For a deterministic e2e order, `install()` then `pauseAt(Date.now() + 1000)` before `goto`: hydration works, and page timers then run only inside `runFor`.
- Headless Chromium: a `mouse.wheel` during a programmatic smooth scroll doesn't cancel it; the scroll carries on to its target. Firefox cancels it; WebKit's wheel can rest 1–13px off a mandatory snap. Assert "announces where it rests", not a fixed slide.
- Attributing a native scroll to the user by input (PR #78 round 1, Kent I): a bare `touchmove` or any non-zero wheel delta is too broad. A vertical page swipe over a horizontal carousel, a trackpad's sideways noise, or a gesture a child cancelled then counted as the user's. Decide a swipe once from its first ~8px, as the browser latches the direction: along > across, single finger, `touchstart`/`touchmove` not `defaultPrevented`. A wheel counts only if its along-axis delta is the larger one and it isn't cancelled. When a takeover happens, announce where it rests even if the selection didn't change: the rotation had chosen that slide silently.
- Round 2 (Kent I): a native wheel or swipe that scrolls a scroll container inside a slide still bubbles to the carousel uncancelled. Before treating input as "scrolls this container", walk from event.target to the container: an ancestor with overflow auto/scroll and range along the axis that can still move the gesture's way keeps it (browser gives it to the innermost), and one at its end with overscroll-behavior != auto keeps it too. RTL scrollLeft runs from -range to 0; a finger moving right asks for a scroll left.
- WebKit (WPE) scrolls an element even for a script-dispatched `WheelEvent`, so synthetic wheels in browser tests can change the scroll state they test; reset it between phases. WebKit may also scroll a nested scroller after the outer smooth scroll ended: wait with eventually, don't read once. An extra round trip before `runFor` (a toggle detour) made WebKit's wheel land only after the rotation arrived.
- Round 3 (Kent I): read overscroll-behavior before skipping a container. Overflow auto/scroll/hidden are scroll containers; a contained one keeps a wheel even with zero range or hidden overflow (Chromium 156 and WebKit 27.2 at rest, per the CSS Overscroll spec). clip/visible don't contain. Playwright's Firefox 157 passes every wheel on past contained boxes, even at a scroller's end, in a probe with the carousel at rest.
- WebKit's smooth scroll lasts ~220ms whatever its length (Chromium 300-550ms, Firefox 650-760ms), and Playwright's wheel reaches WebKit 50-230+ms after a `runFor` that starts a rotation, so "rotation, then wheel" is a race there; a non-passive wheel listener or a toggle detour makes it later. Round 4 (Kent I) rejected early returns for engines: force the order instead. Wrap the page's fake `setTimeout` to capture the autoplay callback, and fire it from a capturing `wheel` listener on document, so the rotation starts as the real wheel arrives and native routing stays. Resume autoplay under a resting pointer via the toggle's stop/start (play wins over hover), and measure the target after: WebKit can scroll the page to press a button.
- With that order, Playwright's Firefox passes a wheel through a contained box that can't scroll, and WebKit sometimes hands it to the running smooth scroll: the outer moves past its target. Detect it in the component: an own smooth scroll only moves from its start toward its target, so past the target, or turning back after headway, means something else moved it. Firefox carries a running scroll's speed into the next for a few px, so require headway before "turned back". Assert per outcome (on path: silent; past: announced) with each engine's allowed outcome explicit.
- Never run a single tool call longer than ~60 min of silence: the harness stops a run after 67 min without activity (a 90-min repeat loop killed run 9cda9ac6). Batch repetitions into ~5-10 min calls. Sample WebKit gesture tests 15+ times; 6/6 hid a 4/18 flake.
- Timing-dependent e2e gestures can pass vacuously: WebKit's wheel often lands after a smooth scroll's midpoint. Record where each gesture found the scroll and assert the precondition; force the order (see above) rather than returning early, except where Playwright lacks the input itself (real touch outside Chromium, Drawer's `isChromium` pattern); browser tests with synthetic events (a plain `Event` with a `touches` property works in Firefox, which has no desktop TouchEvent).
- `remix test` (Bun's glob) skips dot folders: a probe in `.diagnostics/` isn't picked up by the lanes, so keep it there and copy it into `test/` only to run it.

**Why:** the failure looked like a load flake, but a forced order reproduced it in all three engines in minutes.
**How to apply:** any remixcn part that times native scrolling or animation with page timers under `page.clock`. Related: [Native scroll snap controller](#native-scroll-snap-controller), [E2e axe and hangs](#e2e-axe-and-hangs), [Webkit not runnable locally](#webkit-not-runnable-locally).

<a id="playwright-scrollbars-and-touch"></a>

## Playwright scrollbars and touch

_Playwright harness quirks in remixcn: hidden scrollbars in screenshots, touch scrolling, and keyboard-only :focus-visible across engines_

Found while porting Scroll Area (remixcn PR #49, 2026-10-29), Playwright 1.64.1 headless Chromium:

- Playwright launches Chromium with `--hide-scrollbars`, so native scrollbars never show in screenshots. Launch with `chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] })`.
- Even then, `fullPage: true` screenshots drop the scrollbars of inner scroll containers. Set the viewport height to `document.documentElement.scrollHeight` and take a normal (clip) screenshot instead.
- CDP `Input.synthesizeScrollGesture` with `gestureSourceType: 'touch'` scrolls nothing there. A sequence of `Input.dispatchTouchEvent` touchStart/touchMove/touchEnd does scroll (and drives Pointer Events with pointerType touch).

- Focus-ring assertions (PR #46): `locator.focus()` on a checkbox or button matched `:focus-visible` in Chromium and Firefox, but script focus may not count as keyboard focus in WebKit (unverified; WebKit only runs in CI). To be safe, focus it, then press Tab and Shift+Tab. Don't press Shift+Tab first: from the page's first control, focus leaves the document and the test fails.

- Firefox's `remix test --type browser` frame doesn't update `location.hash` synchronously after `link.click()` (PR #45). Assert that a document click listener sees `defaultPrevented === false` instead, and test real navigation end to end.

- Playwright's Firefox (PR #49 cleanup): `getComputedStyle(el).scrollbarWidth` is `none` for every element, even unstyled ones, so compare a scroller with `document.body` instead of `'auto'`. Mouse moves outside the viewport arrive at clientX/Y 0, so keep drags inside the window. Firefox latches a wheel to the element it last scrolled for a moment, so test "page scrolls on at the edge" on a fresh page. CDP (`newCDPSession`) is Chromium-only: branch on `page.context().browser()?.browserType().name()`.

**Why:** without these, a "native scrollbar fallback" looks broken in review screenshots and touch-scroll tests fail for harness reasons.
**How to apply:** use them in any remixcn capture script or e2e test about scrolling. Related: [Webkit not runnable locally](#webkit-not-runnable-locally), [Remix 3 rendering gotchas](#remix-3-rendering-gotchas).

Added in PR #54 (overlays, 2026-10-29):

- Holding back module scripts with `page.route` blocks DOMContentLoaded (module scripts are deferred): navigate with `waitUntil: 'commit'`.
- With `javaScriptEnabled: false`, `page.evaluate(() => new Promise(requestAnimationFrame…))` never resolves; skip frame waits there.
- `pkill -f <path>` in a Bash call kills that very shell when the command line contains the path (exit 144). Don't.
- Firefox's CSS anchor positioning (`position-area`) misplaces every placement in right-to-left containers; anchor-position.ts now measures instead.

Added in PR #57 (Toast, 2026-10-29):

- After `page.clock.install()` + `pauseAt(...)`, the page's `setTimeout` and `requestAnimationFrame` stand still. `page.waitForFunction` (polls with rAF) and axe-core (`AxeBuilder.analyze`, uses page timers) then hang until the lane times out, with no output if piped. Poll from Node (`page.evaluate` in a loop with Node's setTimeout), and run axe on a page without a paused clock.
- `remix/test`'s `t.useFakeTimers()` fakes only setTimeout/setInterval, not `performance.now()` or `Date.now()`. Code that measures remaining time needs `t.mock.method(performance, 'now', () => now)` moved together with `timers.advance`.
- Fixed toasts cover example buttons, so Playwright clicks time out ("subtree intercepts pointer events"). Trigger example buttons with `locator.dispatchEvent('click')` in captures and tests.
- Fixture server ports: style-reference 4400, button 4401, layout 4402, toast 4403 (and #46's controls), code-block 4428, dialog 4413. Newer PRs pick 4400 + ticket number (4405, 4407, 4410, 4413, 4420, 4423, 4428). Check main and the open PRs before picking one.

Added in PR #58 (Message Scroller, 2026-10-29):

- axe hangs without JavaScript: see [E2e axe and hangs](#e2e-axe-and-hangs).
- `@media (scripting: none)` matches in a `javaScriptEnabled: false` context in Chromium and Firefox, but not when scripts are only aborted by `page.route` (scripting stays on).
- `content-visibility: auto` rows get guessed heights: a programmatic jump to a far row landed 520px off (Chromium) / 112px off (Firefox), and Firefox doesn't resize a skipped row above the view until it comes near. Don't use it on rows a scroller measures.
- A `page.mouse.wheel(0, -2000)` in Firefox doesn't reach the top of an inner scroller within ~3s; use focus + Home in e2e tests.

Added in PR #54 round 2: a check that a delayed popup is "not open yet" must wait with a plain `setTimeout` shorter than the delay (timers fire in deadline order), never a helper that also awaits animation frames: under a loaded full-lane run, frames lag past the delay and the check flakes. In e2e, after any action that moves focus on a frame (focus scopes) or closes in a render, wait for the exact element to own focus (`page.waitForFunction(el => document.activeElement === el, handle)`) before asserting.

Added in PR #60 (Field, 2026-10-30):

- `locator.screenshot()` crops to the element's box, so an outline with an offset isn't in it. To prove a focus ring in forced colors (where the border stops changing), screenshot the surrounding container. Fixture port 4408 is Field's.
- Fixture ports (2026-10-30): agents now pick 44 plus the ticket number (Toast moved to 4425 after controls took 4403). Before choosing, grep main's `test/fixtures/*/server.tsx` and open PRs' diffs for `PORT ?? `.
- Fixture port 4417 is Select's (PR #70).

Added in PR #73 (Sidebar, 2026-10-30):

- `remix test --type browser`'s test frame is 800px wide in Chromium and Firefox, so `@media (width >= 48rem)` styles apply in browser tests; assert them directly instead of guarding on `innerWidth`.
- Playwright's mouse starts at (0, 0) and hovers whatever sits in the top-left corner (a sidebar rail showed its hover line in screenshots). Move it away, such as `page.mouse.move(width - 1, 1)`, before capturing.
- An element whose box is empty, such as a sidebar root holding only a zero-width gap and a fixed child, is "hidden" to `locator.waitFor()`; wait with `{ state: 'attached' }`.

Added in PR #73 round 1 (2026-10-30):

- Playwright's `keyboard.type()` in Firefox types a character that isn't on the keyboard layout (such as full-width `３`) as an input method composition: `compositionstart`, `compositionupdate`, `beforeinput insertCompositionText` (isComposing), `compositionend`, then `input insertCompositionText`. Chromium fires a plain `insertText`. A component that cleans up composed text in the next task (Input OTP) then races an immediate `inputValue()` read on a loaded CI machine. Reproduce by wrapping the page's `setTimeout` to fire 50ms late; fix by waiting for the cleaned state (`waitForFunction`) before asserting.
- A nested component's keyboard shortcut must belong to its nearest wrapper (`closest(wrapper) === own`), not just "not handled yet": a provider that opts out never calls preventDefault, so the outer wrapper's listener would take the press (Kent's finding on #73).

Added in PR #77 (Questionnaire refused send, 2026-10-30):

- Playwright 1.64.1's clock fakes timers, rAF, requestIdleCallback, `Date`, `performance`, `Intl`, `AbortSignal.timeout`, `Temporal` and `Event.timeStamp`. A held page has no public real-time source, so a "slow page" stall can't live in a suite test that holds the clock. Remix's scheduler uses `queueMicrotask`, so `handle.update()` renders still run with the clock paused.
- `locator.click({ force: true })` measures the target, then presses there with no hit check. A real-time timer (such as an example's 800ms send) that ends in between can re-layout the page, so the press lands elsewhere. Hold the clock and release the work with `runFor` after the duplicate actions.
- CDP `Input.dispatchTouchEvent` (Chromium) resolves touchStart, touchMove and touchEnd only once the page handled them (measured: about 300ms with 300ms page handlers), but `touchCancel` at once (12ms): a cancel can't be prevented, so the browser doesn't wait. A read right after a touchCancel races the page's pointercancel; on a loaded CI runner Slider read the move's value (PR #73 round 4, run 41023358039). Reproduce by sending the read in `Promise.all` with the cancel (10 of 10 stale). Fix: a capture `pointercancel` listener sets a flag, and the test `waitForFunction`s it before asserting.

<a id="pointer-gestures-and-dialog-focus"></a>

## Pointer gestures and dialog focus

_Engine quirks found porting Drawer (remixcn #14): implicit capture loss bubbles, touch-action pan-down support, WebKit focus ignores scroll-padding, dialog autofocus, nested dialog var inheritance, slow CDP touch and instant WebKit mouse steps_

Found while porting Drawer (remixcn ticket #14, 2026-10-30), Playwright 1.64.1:

- **Implicit capture loss bubbles.** A touch pointer is implicitly captured to the touched element. When an ancestor calls `setPointerCapture`, the touched element fires `lostpointercapture`, which bubbles to the ancestor's listener and looks like losing its own capture. Only treat it as a cancel when `event.target === host`. Synthetic pointers can't be captured, so browser tests never show this; real CDP touch did.
- **Mouse pointerup outside an uncaptured element never arrives.** A pending (not yet captured) mouse drag must drop itself on a move with `(event.buttons & 1) === 0`.
- **touch-action directional pans:** `CSS.supports('touch-action', 'pan-down')` is true in Chromium, false in Firefox. Safari unverified. Fall back to native scrolling both ways.
- **WebKit ignores `scroll-padding` when focus scrolls an element into view**; Chromium and Firefox honor it. Fix it in a `focusin` listener (runs before the browser's own scroll-into-view, which then finds the element visible).
- **`autofocus` on a `<dialog>` itself:** Firefox and WebKit focus the dialog in `showModal()`; Chromium focuses its first control. focus-scope.ts sets initial focus one frame later and overrides a Tab pressed within that frame; Drawer remembers where `showModal()` put focus and steps aside only when it moved since.
- **Nested `<dialog>`s inherit CSS variables through the DOM**, top layer or not. A parent drawer's inline `--nested-drawers` scaled the child too. Declare per-popup defaults in the popup's rule (inline values still win).
- `dialog` has UA `width: fit-content`; an edge-to-edge drawer needs `width: auto` with both insets.
- **Velocity in e2e:** CDP `Input.dispatchTouchEvent` moves take ~48ms each (so a 12-step drag is slow); WebKit delivers `page.mouse.move({ steps })` back to back (reads as a fast flick). Pace mouse drags with `waitForTimeout(16)` per step and make touch drags go past the distance threshold.

**Why:** each one cost a debugging loop; three only showed in WebKit or with real input.
**How to apply:** any remixcn gesture, drag or focus-on-open work (Toast swipe, Carousel, Sheet-like popups). Related: [Playwright scrollbars and touch](#playwright-scrollbars-and-touch), [Remix 3 rendering gotchas](#remix-3-rendering-gotchas), [Webkit not runnable locally](#webkit-not-runnable-locally).

Added while porting Questionnaire (ticket #31, 2026-10-30):

- Playwright WebKit (WPE, webkit-2370) can scroll the page on a mouse press that focuses a RemixCN Button, because Button's `:active` style moves it (`translateY(1px)`). The release then lands on the element below, and the click never reaches the button. It depends on the layout (a button 40px below the viewport center, after an error grew the form, scrolled to center); plain HTML with the same transform didn't reproduce it, and `:active { transform: none }` removed it. No script scrolled (hooks on focus/scrollIntoView/scrollTo stayed silent). Workaround in tests: press the button with the keyboard (`locator.press('Enter')`). Button-wide, outside #31; reported to the PM in the PR.

<a id="rebuild-commits-before-rebasing"></a>

## Rebuild commits before rebasing

_When folding fixes by restoring whole trees from old commits, rebuild on the commits' own base, then rebase; origin/main can move mid-run_

When cleaning up a PR's history by rebuilding commits with `git restore --source=<old commit> :/`, rebuild them on the base those old commits were made on, and only then `git rebase origin/main`. In remixcn PR #48 (2026-10-29), origin/main moved during the run (the shared clone fetches in the background), and resetting to the new origin/main before restoring whole trees from the old commits silently reverted main's five newest commits inside the first rebuilt commit.

When main has moved a lot (PR #46 cleanup, 2026-10-29), rebuilding on the new base worked well:
- `git reset --hard origin/main`, then `git checkout <accepted> -- <files only the PR changed>`.
- Three-way merge the files both sides changed with `git merge-file` (base = old base's version, theirs = accepted head's version).
- Save `git write-tree`, `git reset origin/main`, and stage file sets commit by commit. Then check that `HEAD^{tree}` equals the saved tree.
- Check each intermediate commit in a scratch `git worktree` under `~/.cache/ocl-build-$OCL_RUN_ID`, and remove it afterwards.

Also adopt conventions main gained since review, such as `exampleTarget` and `docs/components/`. That's changed code, so it goes back to the reviewer, and `submit_for_review` then says to keep the PR a draft.

Without touching the working tree (PR #50 cleanup, 2026-10-29): build each commit with a temporary index, `GIT_INDEX_FILE=$TMPDIR/idx git read-tree <old commit>`, then `git update-index --cacheinfo 100644,$(git rev-parse <accepted>:<file>),<file>` for the files a fix touched, then `git write-tree` and `git commit-tree <tree> -p <parent>`. End with `git reset --soft <last>` and `git rebase origin/main`. A docs conflict resolved during that rebase is changed content too, so the harness queues another review round.

**Why:** a whole-tree restore from a commit on an older base writes the older base's files too.

**How to apply:** check `git diff --stat origin/main <first rebuilt commit>` before pushing; it must list only that commit's own files. Compare `HEAD^{tree}` with the accepted head's tree to confirm a pure history cleanup. Related: [Webkit not runnable locally](#webkit-not-runnable-locally).

- A PR that main makes conflicting gets no CI run on pull_request, so WebKit goes unchecked. When fixing review findings and GitHub shows `mergeable: CONFLICTING`, rebase in a scratch worktree (`git worktree add --detach ~/.cache/ocl-build-$OCL_RUN_ID/rebase HEAD`), take main's version of shared docs and reapply your own edits, check the result's tree for your files with `git diff <old head> HEAD -- <your files>`, then `git reset --hard` the real worktree to it and force-push with `--force-with-lease=<branch>:<old sha>` (PR #57, 2026-10-29).

PR #58 round 1 (2026-10-30): when main keeps adding rows to the same shared files (AGENTS.md, README.md, SOURCES.md, registry.json, package.json, icons.tsx), resolve each conflict by taking main's file and re-adding your own rows, extracted from your old commit with `git show <old>:<file>`. Never reuse a file saved in `$TMPDIR` by an earlier run: each run gets a new `$TMPDIR`, and a missing file there once dropped the SOURCES rows from a rebased commit. Afterwards, compare `git diff` of each rebased fix commit with the original's to prove nothing else changed.
- When main adds an export your PR also adds (Dialog's XIcon vs Toast's, PR #57, 2026-10-30), git can auto-merge both copies at different places in icons.tsx without a conflict marker. After every rebase that touches shared helpers, grep the merged file for duplicate `export function` names before continuing, and reword the commit if it no longer adds that export.

PR #60 cleanup (2026-10-30): a cleanup run whose rebase onto main needed conflict resolutions (shared lists in registry.json, icons, package.json, docs) is changed content for the harness: submit_for_review queued another round and said to keep the PR a draft. So in that case push, call submit_for_review first, and mark the PR ready only when the tool says the tree needs no review. I had marked it ready first and had to `gh pr ready --undo`. The CI run of the draft push still ran.

PR for #11 (Input Group, 2026-10-30): it happened again with `git reset --soft origin/main` while splitting a WIP commit. origin/main had moved during the run, so the commits landed on the new main with my old-base AGENTS.md and package.json, silently reverting main's edits there. Never reset to `origin/main` to split work: reset to the SHA you built on (`git merge-base HEAD <that sha>`), then rebase. The temporary-index recipe above rebuilt the four commits on the old base without touching the working tree while tests ran.

PR #68 cleanup (2026-10-30): when rebuilding a commit from an original with `git checkout <commit> -- .`, every file of that commit's TREE comes back, including files later commits changed, so it silently reverted the folded fixes. Check out only the commit's own files: `git checkout <c> -- $(git show --format= --name-only <c>)`, then the final versions of the folded files from the accepted head, and verify `HEAD^{tree} == accepted^{tree}` before rebasing. The rebase onto main (shared-list conflicts only) again queued a new review round; screenshots recaptured byte-identical.

PR #54, 2026-10-30: when both sides change the same line to the same text (here a helper count 11 to 12 in scripts/check-components.test.ts), git merges it silently, but the right value may now be different (13). After a rebase, rerun `node scripts/check-components.ts` and the count test before trusting the merge. Also: rfind(", and ") on a long AGENTS.md list row can hit a phrase inside the last item; diff the row against main's afterwards.

Long-lived PRs (remixcn #51, 2026-10-30): while it waited, main added the same icons (same names) and its own `test/html.ts` with another API. On rebase, take main's version, drop the now-empty commit with `git rebase --skip`, and convert your tests to main's helpers with a small script; add only what main lacks. Run `bun install --frozen-lockfile` after the first conflict stop if main changed `bun.lock`.

2026-10-30 (PR #73): git 2.56 here runs `git rebase --autosquash <base>` without `-i`, so `git commit --fixup <sha>` + that folds fixes non-interactively. To split one file's change across commits (catalog dependsOn in one commit, exampleTarget in the next), write the intermediate version with `git hash-object -w` and stage it with `git update-index --cacheinfo 100644,<blob>,<path>`.

<a id="registry-json-hand-formatted"></a>

## Registry json hand formatted

_remixcn's registry.json keeps compact one-line arrays; rewriting it with json.dumps churns every item, so insert items as text_

`registry.json` in remixcn is hand-formatted: `registryDependencies` and `files` sit on one line each (`[{ "path": … }]`). Prettier accepts both that and fully expanded JSON, so `bun run check:format` won't catch a reformat. Loading it with Python's `json.load` and writing it back with `json.dumps(indent=2)` expanded all 25 items and made the PR's diff huge, and it conflicted with every other PR adding items (#27, 2026-10-30).

`registry/catalog.json` is the opposite: it already is `json.dumps(indent=2)` style, so a load-and-dump edit there leaves a clean diff.

**Why:** a whole-file reformat hides the real change in review and turns every rebase into a conflict.
**How to apply:** add registry items by inserting text blocks in main's compact style after the right neighbor, then check `git diff --stat origin/main -- registry.json` shows only your lines. Related: [Rebuild commits before rebasing](#rebuild-commits-before-rebasing).

<a id="remix-3-rendering-gotchas"></a>

## Remix 3 rendering gotchas

_remix@3.0.0 server/hydration quirks that shape RemixCN component design (clientEntry children, aria booleans, indeterminate, forced-colors backplate, undefined props strip attributes)_

Measured in remix@3.0.0 (component 1.1.0) while porting the controls (PR #46, ticket #9, 2026-10-29):

- A `clientEntry` serializes props to JSON: mixins (`mix`) and functions are dropped, and the server renders **component children** of an entry to static host HTML. A compound root (e.g. Toggle Group) as an entry hydrates with frozen items. A nested entry inside a live island does get live props (`owner.root.render(jsx(type, props))`).
- Server renders `aria-pressed={false}` / `{true}` as an empty `aria-pressed` attribute: pass the strings `'true'`/`'false'`.
- Server renders `indeterminate` as an invalid HTML attribute; set the IDL property from a mixin's `handle.queueTask` instead. ARIA in HTML forbids `aria-checked` on native checkboxes, so mixed can't exist before hydration.
- Chrome forced colors draws a Canvas backplate behind text: `background: Highlight; color: HighlightText` makes button labels vanish. Use borders (system colors in borders are kept).
- Playwright `click()` on a `<label>` of a disabled input waits forever (retargets to the control); use `{ force: true }`.

Added while porting Resizable and Scroll Area (PR #49, ticket #24):

- An object `style` prop is patched property by property, so CSS variables a component writes with `style.setProperty` between renders survive. A string `style` replaces the whole attribute.
- Listeners in a `mix` array run in array order. Put the caller's `mix` before a part's own `on(...)` handlers so the caller can `preventDefault()` first.
- Drags: when the element holding pointer capture is removed, Chrome fires `lostpointercapture` at the document, not the element. End a drag from the dragged part's `ref` abort signal (and from a sub-part's unregister), not only from its own listeners (review finding on PR #49).
- A "done/changed" event after a change a controlled owner must render: dispatch it from `handle.queueTask(...)` + `handle.update()`, not right after the change event, or it compares against the old props.
- A compound group can read its direct children's JSX (`node.type === ResizablePanel`, `node.props`) during render, so the server knows the full layout; a tiny slot provider component then hands each child its place via `handle.context`.

Added while porting Button (PR #45, ticket #6):

- A plain component that takes caller mixins (Button) can't be a clientEntry, and a server-only page never runs its code. Reviewers flag browser-only behavior there. Make its server HTML safe on its own: Button renders `disabled` for both `disabled` and `aria-disabled` until a `handle.queueTask` marks it running after its first browser commit (tasks are dropped on the server).
- Chromium moves focus off a disabled element only at its next rendering step. A `disabled` attribute that is set and cleared inside one flush doesn't move focus in a test, so check it with a MutationObserver. Collect the records in the observer callback: an awaited `act()` delivers them before `takeRecords()` runs.

Added in review round 1 of PR #46:

- Remix's controlled-input restore puts back only the input whose `change` fired. In a controlled radio group whose owner declines a change, the browser has already unchecked the selected radio, so nothing ends up checked. The group must re-check the radio of its value itself (a `change` listener that restores in a microtask).
- A part whose behavior depends on its items (roving tab stops) must watch them: a child component can update its own items without rendering the group (MutationObserver on the host). A style sheet outside the group can hide an item with `visibility: hidden`, which no observer sees (no attribute in the subtree, no size change). Round 2's fix: resync on a document `keydown` Tab listener in the capture phase, which runs before the browser moves focus.
- Native radio arrows at the ends of a group: Chromium and Firefox wrap, WebKit stays put (confirmed: PR #46's per-engine test passed in WebKit CI at 857fb38). Keep radios native and assert per engine (`page.context().browser()?.browserType().name()`).
- PM decision on #9: interactive parts use the shared `registry/lib/composite.ts` helpers (`rovingFocus`), extended there if needed. A local focus engine gets no exception.

**Why:** these drove the "plain components + app island" design and several test fixes; later batches (Tabs, Accordion, Select…) will hit the same walls.
**How to apply:** check these before choosing clientEntry boundaries or ARIA rendering in a new RemixCN component; see `docs/controls.md` in the repo. Related: [Webkit not runnable locally](#webkit-not-runnable-locally).

Added while porting Slider (PR #48, ticket #10):

- Rendering `value` on an input makes the runtime restore it on hydration, over a value the user set before the script loaded. Render `defaultValue` (the server writes it as the `value` attribute) and write `input.value` yourself after each render.
- Chromium's accessibility tree honors `aria-valuemin`/`aria-valuemax` over a native range input's `min`/`max`, so stacked multi-thumb inputs can keep the shared track's `min`/`max` and still report each thumb's bounds.
- axe-core's target-size rule flags range inputs stacked on one track (it can't see the drawn thumbs). The slider's e2e axe test skips only that rule, with the reason in a comment and the docs.
- `preventDefault()` + `setPointerCapture` on a parent's `pointerdown` stops a native range input's own drag in Chromium and Firefox. `setPointerCapture` throws for a script's synthetic pointer, so wrap it.

Added while porting Dialog, Alert Dialog and Sheet (ticket #13, 2026-10-29):

- `patchHostProps` removes the attribute of every prop key present in the previous props whose next value is null/undefined, on **every render**, even when it was undefined before too. So `open={cond ? true : undefined}` on a `<dialog>` strips the `open` attribute that `showModal()` set, and Chrome closes the dialog without calling `close()`. Leave browser-owned attributes out of the props entirely (conditional spread `{...(cond ? { open: true } : {})}`).
- Hydration (`patchHostProps({}, props)`) never removes attributes the server wrote but the client omits, so a server-only attribute can hand over to browser code.
- Invoker commands (`commandfor` + `command="show-modal"`/`"close"`) work in Playwright's Chromium and Firefox, are typed in Remix's JSX, and a `preventDefault()` in the button's click handler cancels the command. `css()` accepts `&::backdrop` and a top-level `'@starting-style'` key.

Added while porting Accordion, Collapsible, Tabs and Pagination (PR #51, ticket #12):

- `handle.id` of a nested component differs between server (`s<scope>-<n>`) and client (`c<n>`); only a client entry's root keeps its server id. Hydration patches every attribute (`patchHostProps({}, props, node)`), so ids derived from one handle stay paired with their aria references after hydration.
- `handle.context.get(Self)` inside the provider itself returns the nearest *ancestor* provider (an outer instance when nested), not its own value. Keep the value you `set()` in a local variable.
- Parts that render later (tab panels after the tab list) can't inform earlier siblings in the same pass, also on the server. For `aria-controls`, let panels register with the root from a `queueTask` and have the root re-render; the server HTML then has no `aria-controls`.
- `<select defaultValue>` isn't rendered by the server; put `selected` on the `<option>`.
- `Props<'a'>` is a union (href with link roles | no href), so `interface X extends Props<'a'>` loses `href`. Use `Omit<Props<'a'>, 'href' | 'role'> & { href?: string }`.
- Chromium fires `focusout` synchronously while it removes a focused element, with the target still connected and `relatedTarget` null, so it looks like the user blurring. Decide in a microtask (`isConnected` by then tells removal apart). Firefox fires nothing.
- Remix's scheduler restores focus and selection around updates, so keyed reorders keep focus.
- Exit transitions: keep a "closing" state in the component, run the DOM work in `handle.queueTask` with your own AbortController (the task's own signal aborts on any re-render), and await `element.getAnimations()` finished; 0s durations (reduced motion, or no theme in browser tests) create no animations and resolve at once.

Added while porting the display and feedback families (PR #52, ticket #7):

- `css()` and `style` append `px` to every plain number except a short unitless list (z-index, opacity, flex-grow/shrink, grid-row, grid-column, font-weight, line-height, order, aspect-ratio…). `gridColumnStart: 2` silently becomes an invalid `2px`. Write such values as strings ('2'). Same for `WebkitLineClamp: 3` (a clamp that silently does nothing, PR for #27).
- `renderToString` puts the css() rules in `<style>` tags inside a leading `<head>`; `test/html.ts` (tags/attributes/text) strips them for server tests.
- axe flags `aria-label` on `<kbd>` (generic role) and any non-dt/dd child of `<dl>`, including a `role="none"` separator. Use visually hidden text, and separate `<dl>`s.
- Computed selector keys in css() objects must be literal types (`<S extends Size>(s: S) => \`…${s}…\` as const`), or TS infers an index signature that fails CSSProps.

Added while porting Popover, Hover Card and Tooltip (PR #54, ticket #15):

- A mixin's render gets `(...descriptor.args, hostProps)`. A mixin with an optional options arg called without it receives the host props as `options`. Export a wrapper that always passes `{}`, or declare no args at all.
- Mixins can read an ancestor's context (`handle.context.get(Root)`) and re-run whenever the root re-renders (Remix re-renders child components with the parent; no memo). Returning `<handle.element aria-x=… mix={[…]} />` patches attributes and nests mixins; `attrs()` only fills attributes the host doesn't set (keeps a Button's `data-slot`).
- `[popover]` elements: any author `display` beats the UA rule that hides a closed popover. Set display only under `&:popover-open`. `css()` supports nested `'@starting-style'` for entry fades.
- A mixin that syncs `showPopover()`/`hidePopover()` to state on the first browser commit will close a popover the browser opened natively (popovertarget) before hydration. Leave it alone until the component "runs".

**How to apply (popups):** see `registry/ui/popover.tsx` for the root + context + trigger mixin pattern, and AGENTS.md's popover notes.

Added while porting Code Block (PR #55, ticket #28):

- The server writes style-object values unescaped (`serializeStyleObject`: `${key}: ${value};`), so a caller string like `red; background: url(...)` injects declarations. Validate caller-supplied CSS values (Code Block's token colors use anchored color patterns).
- Firefox's `Selection.toString()` puts no line break between `display: block`/`grid` spans inside `<pre><code>`; Chromium does. Ending every line span with a `'\n'` text node gives the exact source in both, with no extra visual line (an empty trailing line box has zero height).
- RemixCN's dark `--input` (oklch .556) at 30% over the background equals `--muted`, so anything tinted `--muted` on an `input/30` surface vanishes in dark mode. Use ~15% for surfaces that hold muted highlights.
- `remix test --type browser` doesn't forward the page's `console.log`; throw an Error with the data to see it.
- Review findings on PR #51 (round 1): a panel that animates closed is still visible and focusable, so render `inert` while it closes; and a roving tab stop must follow the selection while focus is outside the list (a controlled Tabs selecting another tab), not only on focusout. Kent tests both with native Tab presses, so add an e2e that presses Tab during a slow (3s `--duration-normal`) transition.

Added in PR #57 review round 1 (Toast, 2026-10-29):

- A closing element that still takes no pointer (`pointer-events: none`) stays in the tab order during its exit; a reviewer reproduced Shift+Tab back into a dismissed toast's action. Move focus out first in the exit's `queueTask`, then set a local "handed off" flag and `handle.update()` so the next render adds `inert`. Rendering `inert` together with the closing state would drop focus to the page before the handoff.
- To test an exit in a browser test (no theme there, so no transitions), wrap the tree in `<div style="--duration-normal: 1s">`: the token gives the component its transition, so the element stays in the DOM while you assert.

Added in review round 2 of PR #53 (Alert Dialog):

- Enter in a form field presses the form's default button (its first submit button), even before hydration. A browser-only keydown guard can't protect server HTML. Native fix: render a hidden, disabled `<button type="submit">` (same `form` attribute) right before the button to protect. By the HTML standard a disabled default button makes implicit submission do nothing; verified with `javaScriptEnabled: false` in Chromium and Firefox. Reviewers check the no-JS path of every keyboard rule.

Added while porting Message Scroller (PR #58, ticket #30):

- Remix's scheduler flushes in microtasks (`queueMicrotask`), so every `requestAnimationFrame`/`setTimeout` scheduled synchronously by a click comes from component code. A cleanup test can wrap those globals around `click()` and assert each id is cancelled after `cleanup()`.
- `css()` supports a top-level `'@keyframes name'` key (emitted before the rule) and `'@media (scripting: none)'`; a delayed keyframe `to { visibility: visible }` is a fail-safe for content hidden until hydration.
- Kent tests live regions by recording every nonempty `addedNodes` with a MutationObserver, not only the final nodes (PR #57 round 2). Anything that fills in a toast's text after mount (measured custom content) must hold the announcement until the text and description are set in one update, or the region gets two additions.
- Bookkeeping keyed by id in module scope (pending Sonner promises) must also end when the provider unmounts, not only on close: a remounted provider with the same ids would otherwise inherit stale updates. ToastStore.dispose() runs onRemove for that.
- Playwright WebKit (CI) matches `(forced-colors: active)` under emulateMedia but does NOT force colors: transparent borders stay transparent and body background stays transparent. Draw forced-colors visibility explicitly (`@media (forced-colors: active) { border-color: CanvasText }`) and compare against a `Canvas` system-color probe, not the body background. Reproduce in Chromium with `html { forced-color-adjust: none }` in a scratch script (PR #52 round 3).

Added in PR #54 review round 1:

- Closing a popup from a `focusout` listener during a keyboard Tab/Shift+Tab: in Chromium, microtasks (Remix's flush, focus-scope's return-focus microtask) run between focusout and the new element's focus. The focus scope sees no focused element and returns focus to the trigger, which cancels the Tab. Firefox doesn't. Close in a `setTimeout` and re-check `document.activeElement` (popover.tsx `focusOut`).
- WebKit (Playwright CI) matches `(forced-colors: active)` but doesn't recolor transparent or faint borders and outlines. Set edges to `CanvasText` inside the media query; test against a `CanvasText` probe.
- An id learned in `ref` goes stale when the prop changes (ref runs on insert only). Compare during each render and `queueTask` the sync.
- Focus after a removal: a `ref` callback can't move focus to an element that already exists (it runs on insert only). Use `await handle.update()` (it resolves after the commit), then query the target inside a root element kept by `ref` and `focus()` it (attachment-example.tsx `focusAfterUpdate`).

Added while fixing Carousel CI (PR #56):

- WebKit updates an existing `MediaQueryList`'s `matches`, and sends its `change` event, only at its next rendering step. After `page.emulateMedia()`, a press in the same task still sees the old preference. Ask `matchMedia(query).matches` anew when you need it, and in tests wait with `page.waitForFunction(() => matchMedia(q).matches)`.
- A carousel or any scroller sized from slides: text wider than a narrow slide (DejaVu Sans in CI) widens `scrollWidth` by a pixel or two. Bound snap math by the slides, not the scroll range.

Added while porting Field, Input, Label, Native Select and Textarea (PR #60, ticket #8, 2026-10-30):

- Remix's server writes no `selected` option for `<select value>` or `defaultValue`. Mark options from the select's context. On the client, a `selected` prop on an option is the property: hydration then overrides a choice made before scripts ran. Write `option.defaultSelected` from a queued task only when it differs. Even then, adding the attribute to a non-dirty option moves the current choice (per-option dirtiness), so a changed default can replace a user's pick.
- Chromium's UA stylesheet dims a disabled `<select>` itself (opacity < 1), which stacks with a wrapper's opacity.
- Remix's runtime intercepts form submissions and navigates client-side: the URL changes before the answer renders, and the document diff drops `html[data-ready]` set by the entry. In e2e tests wait for an element of the answer, not for the URL or data-ready.
- `overflow-wrap: anywhere` shrinks min-content to one character, so flex text with `min-width: auto` (or 0) collapses beside a wide control. A text floor (`min(100%, 8rem)`) plus `flex-wrap` fixes rows, but apply it only beside text-like controls: beside a checkbox it pushes the label onto its own line at 200% text.
- A parent rule that styles a child (`& [data-slot=x]`) wins or loses by which rule rendered first on the page; it looked fine in one screenshot only because another example rendered the child first.

Added in PR #60 round 2 (2026-10-30):

- A RemixElement is `{ $rmx: true, type, props, key }`; `isRemixElement` isn't exported from `remix/component`, but `Fragment` is. To tell blank children from text (FieldError), recurse into host (`typeof type === 'string'`) and Fragment elements; a component's text is unknown before it renders.
- Remix's controlled `value` reflection only restores single values. For a controlled `<select multiple>`, restore option selectedness yourself in a microtask queued from the select's own `change` listener: it runs after the owner's handlers (on ancestors) and before the owner's re-render.
- `flex: 1 1 0%` doesn't give equal widths to items with padding (an input's padding+border stays in its base size). For aligned columns give text and control the same nonzero basis, such as `calc(50% - gap/2)`.

Added while porting Command (PR #66, ticket #19, 2026-10-30):

- `diffVNodes` compares a lone child by kind and type only, never its key: a component returning `<Fragment key={n}>` doesn't remount when `n` changes. Return `[<Fragment key={n}>…</Fragment>]` so `diffChildren` sees the key (CommandDialog's fresh command per opening).
- A root that computes from children that register while they render is a render behind. Count changes in a version, remember the version each compute saw, and in the root's `queueTask` re-render while they differ, before acting on the result. Acting on the stale result (picking the first item) caused wrong highlights in 3 tests; a microtask `flush()` from an unregister can run before the root's task.
- axe `aria-required-children` fails a `listbox` holding any non-option text, such as an empty-state message (`role="presentation"` doesn't help). An empty listbox passes. Make the message `aria-hidden` and say it from a `role="status"` outside the listbox.
- RemixCN's light `--input` is oklch(0.62), so shadcn's `bg-input/30` reads as a gray bar in light; `light-dark(var(--muted), color-mix(--input 30%))` matches shadcn's look.
- A form `reset` listener runs before the elements reset; a microtask still runs too early after a user's click on a reset button. Read the reset value in a `setTimeout`.
- CSS `order` sorts results without moving Remix-owned DOM nodes; set `aria-posinset`/`aria-setsize` while sorted so assistive technology hears the order on screen.

Added while porting Input Group and Input OTP (ticket #11, 2026-10-30):

- `autocorrect="off"` is written as a property on hydration; Chrome's `autocorrect` IDL is boolean, so "off" becomes `autocorrect="on"`. Leave it out (or pass a boolean). `spellcheck` and `autocapitalize` strings are fine.
- Button makes its css() rule per variant and size lazily, the first time it renders them. A wrapper's single override rule (InputGroupButton) loses to a variant first rendered later on the page. Fix: one override rule per variant and size, keyed by `&[data-variant][data-size]` so each has its own content hash and renders right after Button's. Rules are removed when no mounted element uses them, so a test must keep the earlier element mounted and add the new variant in a later update to reproduce it.
- Forced colors repaint `color: transparent` text, its selection and caret. An invisible overlay input (Input OTP) needs `opacity: 0` inside `@media (forced-colors: active)` instead of `forced-color-adjust: none` (AGENTS.md forbids that).
- WebKit places the caret by the pointer after a click's listeners ran, undoing a `setSelectionRange` done in `click`. Apply it again in a `setTimeout` (guarded by "still focused, value unchanged").
- Firefox ignores `clipboardData` in `new ClipboardEvent('paste', { clipboardData })`; set it with `Object.defineProperty(event, 'clipboardData', { value })` in tests.
- Playwright: a held `page.route` for the entry module doesn't hold a second `goto` in WebKit, which reuses the cached module; route before the first navigation and `goto(..., { waitUntil: 'commit' })`, since a held module script also holds `load`.
- Flex wraps before it shrinks: a `flex-wrap: wrap` row of fixed-width slots wraps instead of shrinking them. Use `nowrap` with `minWidth: 0` items when shrinking is wanted.

Added while porting Questionnaire (PR #68, ticket #31, 2026-10-30):

- Server and client render depth-first in tree order, also through caller components: a root can hand a fresh "pass" object to its context each render, and parts register into it as they render, so parts rendered *after* them (actions after items, an Input after its choices) know them on the server. Parts rendered before (a progress above the items) can't; the browser fills those in after a DOM scan in a `queueTask`.
- A rule a part passes in Button's `mix` can lose to Button's own `display` when that variant's rule first renders later on the page (layer order). For "hide until the script runs" rules use `display: 'none !important'`, as theme.css's `[hidden]` does.
- `@media (scripting: none)` matches in Playwright Chromium and Firefox with `javaScriptEnabled: false`; `(scripting: enabled)` hides parts until hydration while a no-JS page shows them. theme.css's `[hidden] { display: none !important }` means server HTML must hide such parts by data attribute + CSS, never by the `hidden` attribute, or CSS can't show them without a script.
- Caller-owned names (question names) must not go into ids: a space breaks `aria-describedby` lists. Derive ids from `handle.id` only.

Added in PR #66 review round 1 (Command, 2026-10-30):

- Firefox shrinks the `auto` rows of a grid with a `max-height` to fit it when the items are scroll containers (`overflow: hidden` groups, automatic minimum 0): each group clips its items and the grid never scrolls. Chromium sizes the rows to content. Set `grid-auto-rows: max-content`. `scrollIntoView()` had hidden it by scrolling inside the clipped group.
- `scrollIntoView()` scrolls every ancestor, including the page and parent frames: a list highlight scrolled the page when a command hydrated below the fold. Adjust the list's own `scrollTop`. In a browser test, check the scroll position of every frame up to `window.top`: the runner's frame grows with its content, so a frame-only check passed against the bug.
- Reviewer-found reflow failures in CI came from the fixture page, not the component: a one-word `text-3xl` title is 327px in DejaVu Sans Bold at 200% text, and Firefox finds no break in `shouldFilter={false}`. Give fixture headers `minmax(0, 1fr)` columns and `overflow-wrap: anywhere`, and run reflow e2e with the DejaVu fontconfig ([Ci fonts reproduce locally](#ci-fonts-reproduce-locally)) before handing over.
- Round 2 of the same: ResizeObserver misses `visibility: hidden` and `inert` (no size change), and "check before the next key" left a stale `aria-activedescendant` that Kent flagged. Watch `class`, `style`, `hidden`, `inert` and `open` with a MutationObserver on the widget's subtree and on each ancestor (attributes only), and make the test helper assert the highlighted option is rendered, visible and not inert, checked before any key press.
- Review round 1 of PR #68 (Kent II): a compound root that keeps state for its parts must read every flag from ONE source in every path (flow, validation, actions, snapshot): the part's own resolved props (this render's pass, else the DOM scan), with the root's `items` only as fallback. Reviewers also probe: edits while an async submit check runs (abort the check, drop the submit), controlled text that a caller declines or clears (write the box back, also to ''), and answers whose choice was removed (stop counting once the full choice list is known), so snapshot and FormData agree. A correction of the current item on load must not move focus (guard with a "settled" flag).

Added in PR #67 round 1 (Input OTP, 2026-10-30):

- Writing `input.value` (or `setRangeText`) makes the value a script's: every engine stops checking `minLength` (tooShort) and fires no native `change` on blur. `document.execCommand('insertText')` with the input focused fires `change` on blur and adds an undo step in all three; Firefox and WebKit count it for `tooShort`, Chromium does not, even inside a real user paste. So: leave clean pastes to the browser, cancel refused typed characters in `beforeinput`, route the component's own edits through execCommand, and in Chromium report a short value with `setCustomValidity` (with a translatable message prop).
- Real clipboard paste in Playwright, all three engines, no permissions: put the text in a scratch textarea, select all, ControlOrMeta+C, focus the target, ControlOrMeta+V.
- A render between `compositionend` and a deferred cleanup can write stale state over the committed text; keep the component's "composing" state until the cleanup runs.
- Negative margins on a flex item (shadcn's `-mr-1` beside a button) push its box past the container when a wrapped line ends with it; use a smaller padding.
- Shrink-before-wrap groups: make the group a grid, `grid-auto-flow: column; grid-auto-columns: minmax(<min>, max-content)`, with `flex: 1 1 0%; max-width: max-content` and `flex-wrap: wrap` on the parent; items get `width: X; max-width: 100%; min-width: 0`. The grid's min/max-content then come from the items actually rendered. Counting children in JSX (PR #67 round 2) missed slots a helper component renders, which Kent caught in round 2.
- Round 2 of PR #68: cancel-on-change must cover controlled prop updates too, not only the component's own setter (record what a check saw, compare by content after each commit and after the check). A children scan can't see what caller components render: report "unknown", never "absent", and treat unknown in the data-preserving direction. Adopt pre-hydration input only from controls whose `checked !== defaultChecked` / `value !== defaultValue`. Browser tests can hydrate real server HTML: `container.innerHTML = renderToString(node)` (strip the leading `<head>`), then `render(node, { container })` hydrates in place.
- Field `orientation="horizontal"` (main, PR #60) splits its row 50/50 with an 8rem minimum per part and wraps, so in a `fit-content` or small width the label stacks above the control. For a compact "Rows per page" row, use `Label` + `NativeSelect` (size its wrapper with `mix`) in your own flex row (PR #51).

Added while porting Calendar and Date Picker (ticket #20, 2026-10-30):

- Node 26's ICU and Playwright's browsers format the same Intl call differently: `formatRange` puts U+2009 thin spaces around the dash in Node, plain spaces in Chromium/Firefox. That is a real hydration mismatch ("Hydration mismatch: text mismatch" console error). civil-date.ts normalizes U+2009/U+202F to ' '. Catch these with an e2e that collects console errors after hydration.
- Intl `weekday: 'short'` is a whole word in ar, he ("יום א׳"), fa, pl, hi, th: it overlaps in a one-cell column. calendar.tsx falls back to 'narrow' when any short name is over 4 code points (same answer on server and browser).
- Keying a repeated block by its content (`key={month}`) remounts it when the content changes, including a <select> the user is operating: focus is lost. Key by position.
- Hydration re-sets every attribute, so a MutationObserver sees attribute records even when nothing changed; compare `oldValue` with the current value.
- Chromium forced colors paints `border: transparent` as a visible edge on every button. Use `border: none` and add borders only for states inside the media query (box-sizing keeps the size).
- A month grid can't reflow into 320px at 200% text; cells keep a min width and the calendar root scrolls sideways (`overflow-x: auto`, months `min-width: max-content`), page doesn't. WCAG 1.4.10 exempts 2D content.
- axe label-content-name-mismatch fires when a button with aria-label shows extra text (prices under days); put the visible text at the start of the name.

Added while porting Select (PR #70, ticket #17, 2026-10-30):

- `selected={undefined}` on an `<option>` in a client render isn't harmless: Remix clears the option's selection on every render (the "undefined prop" removal hits the property), so a single select jumps back to its first option after each render. Leave the key out entirely in the browser (`{...(onServer ? { selected } : {})}`) and write `option.selected` yourself after the render.
- A fresh client mount (no server HTML) of a single `<select>` without `selected` attributes has the browser auto-select the first option before any task runs; that looks like a "user choice before hydration". Mark server HTML (`data-served` rendered only when `typeof document === 'undefined'`) and adopt pre-hydration choices only from marked selects.
- `renderToString` inside a browser test sees `document`, so module-level `onServer` branches never run there: such a test can't emulate server-only output. Test those paths end to end against the fixture server (hold the entry module).
- Chromium keeps the native validation bubble when the invalid control's `focus` handler moves focus elsewhere; it anchors to the control's box. A hidden form control can be moved over the visible one in its `invalid` handler (before the browser focuses it), so the message points there. Firefox and WebKit draw the bubble outside the page, so screenshots can't show it.
- Firefox runs Tab's default action before Remix's queued tasks release `inert` (modal.ts), so Tab out of a modal popup that keeps focus on its trigger goes nowhere; Chromium moved on. Prevent Tab, close, and focus the next/previous `getTabbableElements()` stop in a `setTimeout`.

Added while porting Dropdown Menu, Context Menu, Menubar and Navigation Menu (ticket #16, 2026-10-30):

- Firefox skips its default Tab navigation when focus changed during the keydown (also from microtasks the listener queued, such as a popover closing and returning focus). Chromium moves on from the new focus. For "Tab closes the menu and moves on", preventDefault and move focus yourself in a setTimeout after the close (dropdown-menu.tsx `moveFocusOn`).
- A `[popover]` is `width: fit-content` with `inset: 0` from the UA sheet. An author `width: auto` stretches it across the window until the positioning sets its insets, so the first measurement of `anchor-position.ts` was wrong for a frame (a context menu at x−1280). Keep fit-content; the helper now sets `--anchor-width/height` before measuring.
- Chromium's CSS anchor positioning remembers the last successful `position-try` fallback: a popup positioned before the page reached its final size stays flipped after a resize. Screenshot scripts reload after setting the tall viewport.
- `hoverIntent({ disabled: true })` means "wants closed": any pointer event closes an open popup. To keep a press-opened popup open, leave the mixin out of `mix` instead.
- Several menus open by default each move focus into themselves, and focus-out closes the previous ones. A popup open from the start shouldn't take focus (`api.focus = 'none'` until an interaction).
- Playwright `getByRole(..., { name })` is a case-insensitive substring match: "Edit" also matched "New credit note". Use `exact: true` for short names.
- A submenu anchored to its item with sideOffset 0 overlaps the outer menu's padding (shadcn's design); compare its edge with the item's, not the menu's.
- Review round 1 of PR #69 (Kent I): a shape-changing prop (Calendar `mode`) changed on the same instance left uncontrolled and reset state in the old shape and threw on the next press. Normalize own state from any shape whenever such a prop changes. And with several grids, a per-grid control (year dropdown of grid 2) must convert to the first grid's month before clamping to bounds, and offer only options that grid can show.

Added while porting Sidebar (PR #73, ticket #26, 2026-10-30):

- A delayed fail-safe keyframe can't animate `display`: an element with `display: none` runs no animation at all (Chromium 156 and Firefox 157 both stay `none`). Hide the pending part with `position: absolute; visibility: hidden; height: 0; overflow: hidden` and let `@keyframes … { to: { position: static; visibility: visible; height: auto; overflow: visible } }` (0s, 2s delay, forwards) flip them; all four animate discretely in both engines.
- Remix's runtime navigates same-origin links in place and keeps a client entry's local state, so an open sheet or popup stays open over the new page and focus falls to `<body>`. Close it on a plain left click of an `a[href]` inside it (no modifiers, no `download`, target `_self`).
- `flex-wrap: wrap` doesn't wrap an item whose basis is 0 (`flex: 1 1 0%`): the line's bases fit, so it shrinks to nothing beside a full-width sibling. Use `flex-direction: column` for a stacked fallback.
- A ghost Button highlights itself while `aria-expanded="true"` (Button's open-menu look). A toggle that's usually expanded (sidebar trigger) needs its own rule to keep the plain look.
- axe's `target-size` flags a 20px button that sits over another target's box (a row action over its row's link); 24px passes.

Added in PR #70 review round 1 (Select, Kent II, 2026-10-30):

- Chromium doesn't mark an unselected option dirty when a script sets `option.selected = false` on it, so writing `defaultSelected = true` afterwards still selects it. Write the defaults first, then the current choice (`option.selected`), and never rely on "dirtiness" tricks.
- A part that registers with a root during the root's render pass also re-renders on its own when a caller component between them updates (`handle.update()` on that component): the root's earlier parts (trigger, a native select rendered later) stay stale. Count the root's renders (`pass++` in its render), let each part remember the pass it last saw, and when it renders again in the same pass, `queueTask(() => root.update())`. Round 2: that misses a part's *first* mount by such a component (a child that returns null, then loads items): on a first render, queue a version check instead (`if (version !== renderedVersion) root.update()`), which is a no-op during the root's own pass.
- State reset in a root's render (`typeahead.reset()` while closed) runs on every render the state itself causes: a typed "b" that chooses Banana re-renders and wipes the buffer before "l". Reset only on transitions, or let the buffer's own timeout clear it.
- A disabled `<optgroup>` keeps its selected option out of FormData even when that option isn't disabled. Leave the optgroup enabled while it holds the chosen option and disable its other options one by one.
- A control that hides at hydration while it holds focus fires no new focus event: hand focus to its replacement explicitly in the start task (after `await handle.update()`), only when it was the active element.
- shadcn's `whitespace-nowrap` triggers overflow 320px at 200% text with CI's DejaVu Sans (14px in "With a button"); let the value wrap once the control has no room.

Added while porting Combobox (PR #79, ticket #18, 2026-10-30):

- Remix flattens a fragment's children and diffs them by index when no child is keyed. shadcn's chips JSX (`values.map(chip with key)` then `<ChipsInput />`) keeps the unkeyed input while any keyed chip exists, but remounts it when the last chip goes (1→0): focus falls to body. A part that may be rendered anew must hand focus to its replacement. A `ref` signal aborts after the element left the document (activeElement is already body), so track focus with focusin/focusout (null relatedTarget: decide in a microtask by `isConnected`) and refocus `api.input` in a microtask.
- `assert.deepEqual` from remix/assert treats two different DOM elements as equal (no own enumerable fields): `[li0, li0]` deep-equals `[li0, li1]`. Compare ids or use `assert.equal` per element. A composite test had passed against the bug this way.
- layer.ts counts a programmatic `.click()` (detail 0) on a button outside an open popup as an outside press, so test buttons that change props close the list. In browser tests, change state through a function the test captures from the component's setup instead.
- A key pressed while a popup opens (before the render that shows it) found no visible items and no rendered `aria-activedescendant`, so a fast second ArrowDown restarted at the top. Fix: resolve the first highlight synchronously when the keys open the list, count the closed list's rendered items as navigable until the popover is open, and give `activeDescendant` a `current: () => element` from state (composite.ts option added in PR #79).
- Fixture ports follow 4400 + ticket number (Select #17 → 4417, Combobox #18 → 4418).
- PR #79 round 5: a part that forwards `style={style}` (undefined) to an element that anchor-position.ts uses as the anchor loses the inline `anchor-name` on its next render (Remix strips undefined props every render), so a popup placed by CSS anchor positioning jumps to its static spot (Chromium: window corner; Firefox: over the anchor) until something resizes it. Forward `class`/`style` only when given (conditional spread). Typing hid it (a size change re-measures); moving only the highlight showed it.
- Firefox: `getComputedStyle()` on an element placed through a `position-try-fallbacks` fallback (e.g. a popup flipped above its anchor) keeps the background it had before an `emulateMedia({ colorScheme })` change, for seconds, while the page paints the new one and its children report new colors. Contrast checks then measure ~1.1:1. Sample popups that open on their requested side (scroll the anchor up first) and assert `data-side`.

<a id="remix-test-takes-globs"></a>

## Remix test takes globs

_remix test needs file paths or globs; a directory argument fails with \"Directory import ... is not supported\"_

`npx remix test --type server packages/cli/src` fails: remix test tries to import the directory as a module ("Directory import ... is not supported"). Pass files or a quoted glob instead, such as `npx remix test --type server 'packages/cli/src/*.test.ts'`.

When checking each commit in a scratch worktree, symlink the worktree's `node_modules` into it; `npx tsc --noEmit` and the glob above then run there. Related: [Ci fonts reproduce locally](#ci-fonts-reproduce-locally).

Also (PR #54, 2026-10-30): browser and e2e tests can't run from a scratch worktree with a symlinked `node_modules`: remix test refuses with "Harness scripts ... are outside rootDir". Only tsc, oxlint, check-components and server tests run there; run browser lanes on the final tree in the real worktree. And `git cherry-pick` has no `-q` flag (it prints usage and does nothing; `set -e` in a for loop didn't stop it).

<a id="static-docs-site-build"></a>

## Static docs site build

_apps/docs static build traps (PR #80): .ts URLs need .js names, relative imports, .bun mount, client entry children static, grid sticky, html attrs dropped on in-place nav_

Facts found building the RemixCN docs shell (#34, PR #80, 2026-10-30) that #35–#37 build on:

- Remix's asset server serves compiled JS at `.ts`/`.tsx` URLs. GitHub Pages types by extension, so the static build (`apps/docs/build.ts`) renames them `*.tsx.js` and rewrites every reference: absolute asset URLs in HTML/JS/CSS, and relative imports, which the asset server keeps as authored (`./theme.ts`).
- Bun puts packages under `node_modules/.bun`; mounting that folder directly as `npm` keeps dot dirs out of asset URLs. URLs still hold `%40`/`%2B`; write files at decoded paths.
- `#remixcn/` aliases don't resolve from `apps/docs` files (nearest package.json is apps/docs's); docs public files import the registry relatively (allowed by check:components).
- A client entry renders its component children as static HTML, so page content with live examples can't sit inside the Sidebar's entry; the chrome entry sits beside the content and the provider wrapper gets `display: contents`.
- `position: sticky` on a grid item is confined to its grid area, so the header in its own row can't stick (header left non-sticky).
- Remix's in-place navigation diffs `<html>` attributes and drops client-set ones (`data-theme`, `data-ready`); a MutationObserver restores the theme.
- The runtime adds later pages' import maps as extra maps; one site-wide import map per page avoids needing multiple-import-map support (the polyfill import isn't on the docs allowlist).
- Example previews must be safe before their guard client entry runs (Kent, PR #80 round 1): the server renders the canvas `inert` + `data-pending`, the guard lifts both after attaching listeners, and a MutationObserver lifts them again because an in-place navigation to the same page re-applies server attributes while the guard instance keeps running.
- Real-mouse checks of inert content: `page.mouse.click` at a boundingBox outside the viewport does nothing, so scroll the target into view first, or the test passes vacuously. Mutation-check new tests by removing the fix.
- Remix escapes `<` in text but not quotes, so `href="` appears in escaped source text; check links with a tag regex.

Found building the landing page (#37, PR #81, 2026-10-30):

- The docs chrome's Sidebar takes Ctrl+B / Cmd+B on every page (Sidebar's default `keyboardShortcut='b'`, preventDefault outside text fields). A test that a showcase or example "leaves shortcuts alone" must use other keys (Ctrl+I, Ctrl+U); PR #81 flagged Ctrl+B for Jan instead of changing #34's chrome.
- A frame reload (in-place navigation, also to the same page) leaves the DOM a client entry rendered itself alone: a showcase entry that renders `inert` on its own canvas until a `queueTask` flips it stayed released (MutationObserver saw nothing). Only server-rendered attributes outside an entry (the example canvas) come back.
- A "stays still without JS" check that clicks submit on an empty required form is vacuous (native validation blocks it either way): type into the fields first, then click (`assertShowcaseStill` in test/site.test.e2e.ts).
- `apps/docs/server.ts` loads modules once: restart it after edits. A scratch Playwright script in $TMPDIR must import `<repo>/node_modules/playwright/index.mjs` by absolute path.
- `flex-wrap` wraps by flex base size, so a `width: 16rem` search box wraps the header instead of shrinking; `flex: 100 1 0%` with min/max widths shrinks it first.

**How to apply:** reuse `createDocsSite`, `buildSite` and `createStaticSite` (preview types by extension like Pages) instead of re-deriving; e2e reads the build through the preview. Related: [Remix 3 rendering gotchas](#remix-3-rendering-gotchas), [Webkit not runnable locally](#webkit-not-runnable-locally).

<a id="webkit-not-runnable-locally"></a>

## Webkit not runnable locally

_Playwright WebKit lacks Ubuntu libs on Jan's Arch machine; a scratch copy with Ubuntu 24.04 libs runs it without installing anything_

Playwright's WebKit (1.64.1, used by remixcn's browser/e2e lanes) fails to launch on Jan's machine: it needs Ubuntu libraries (libicu74, libxml2.so.2, libflite1) that this Omarchy/Arch system lacks. Chromium and Firefox run fine locally. Docker can't help: the user may not use the Docker socket.

A recipe that worked (Carousel PR #56, 2026-10-29) without installing anything system-wide:
- In a scratch build folder `~/.cache/ocl-build-$OCL_RUN_ID`, download Ubuntu 24.04 (noble, CI's OS) debs from archive.ubuntu.com: `main/i/icu/libicu74_74.2-1ubuntu3.1_amd64.deb`, `main/libx/libxml2/libxml2_2.9.14+dfsg-1.3ubuntu3.10_amd64.deb`, `universe/f/flite/libflite1_2.2-6build3_amd64.deb`. Unpack with `ar x` + `tar -xf data.tar.*`.
- `LD_LIBRARY_PATH` doesn't reach it: `minibrowser-wpe/MiniBrowser` overwrites it. Copy `~/.cache/ms-playwright/webkit-<n>` (about 300 MB) into the scratch folder, put the `.so` files into the copy's `minibrowser-wpe/sys/lib/`, and run with `PLAYWRIGHT_BROWSERS_PATH=<scratch>/ms-playwright ... --project webkit`. That folder holds only WebKit, so run Chromium and Firefox without the variable.
- Find the WebKit revision in `node_modules/.bun/playwright-core@<version>/node_modules/playwright-core/browsers.json` (bun's isolated layout: `require.resolve('playwright-core')` from the repo fails). 1.64.1 = webkit-2370.
- Never write into the shared `~/.cache/ms-playwright`. Delete the scratch folder at the end of the run.

**Why:** WebKit-only CI failures (a stall, timing differences) need a local reproduction; installing system packages isn't an engineer's call.
**How to apply:** use the recipe when CI's WebKit lane fails and the logs don't explain it, and before handing over a gesture or focus change (Drawer #14: it found three WebKit-only failures in ~10 minutes, webkit-2370); otherwise run Chromium and Firefox locally and rely on CI for WebKit, and say which in the PR. Related: [Ci fonts reproduce locally](#ci-fonts-reproduce-locally), [E2e axe and hangs](#e2e-axe-and-hangs).
