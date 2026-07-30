/**
 * Page shell behaviour: fullscreen, orientation, and the browser gestures that fight a game.
 *
 * GDD refs: 17.6 (accessibility), 18.2 (16:9 with safe-area support), 4.3 (the room is the
 *           frame), R-TEC-001 (runs in a browser with no install step).
 *
 * Kept out of main.js on purpose. Everything here is about the *page* — the document, the
 * viewport, the orientation, the browser's own gestures — and none of it is about the game.
 * main.js owns the simulation; this owns the box it is displayed in. Mixing the two is how a
 * fullscreen call ends up buried inside a render loop.
 *
 * ## Orientation is presentation, not a precondition
 *
 * There is no portrait gate. Renderer.resize() turns the canvas a quarter turn when the viewport
 * is portrait, so the game always presents landscape and a player holding the phone upright sees
 * it lying on its side — which asks them to turn it more plainly than a notice would, while
 * costing nothing if they don't.
 *
 * ## Why a first-tap gate on mobile
 *
 * Two browser policies land on the same gesture: audio cannot start without one, and neither
 * can fullscreen. Asking twice would be clumsy, so the tap buys both at once. Desktop needs
 * neither to start playing, so the button never appears there.
 *
 * ## Why so much gesture suppression
 *
 * A twin-stick game means two thumbs on the glass, which mobile browsers are entitled to read
 * as pinch-zoom. Sustained dragging looks like a scroll, a quick double-tap looks like
 * double-tap-to-zoom, and a downward drag near the top looks like pull-to-refresh. Every one of
 * those is a lost run rather than a cosmetic annoyance, and each needs suppressing separately
 * because they come from different parts of the browser.
 */

const canvas = document.getElementById('game');
const enterButton = document.getElementById('enter');

/** Touch-primary device? The tap gate and orientation lock are only meaningful there. */
const isTouchPrimary = globalThis.matchMedia?.('(hover: none) and (pointer: coarse)')?.matches
  ?? ('ontouchstart' in globalThis);

// ---------------------------------------------------------------------------
// Fullscreen and orientation
// ---------------------------------------------------------------------------

async function goFullscreen() {
  const target = document.documentElement;
  try {
    if (!document.fullscreenElement) {
      await (target.requestFullscreen?.({ navigationUI: 'hide' })
        // Safari on iOS still has no Element.requestFullscreen on iPhone; the webkit form
        // exists on iPad. Both are attempted and neither is required to succeed.
        ?? target.webkitRequestFullscreen?.());
    }
  } catch {
    // Refused fullscreen is survivable: the game is still playable in the browser viewport,
    // just with less of it. Never let this stop the run from starting.
  }
}

async function lockLandscape() {
  try {
    // Best effort, and genuinely better when it works: if the OS rotates the viewport, the game
    // is landscape natively and needs no canvas transform at all. Requires fullscreen, and in
    // practice only Android honours it — iOS Safari has no Screen Orientation lock.
    //
    // Nothing depends on it. When the lock is refused the renderer turns the canvas a quarter
    // turn instead, so a portrait phone is playing either way.
    await globalThis.screen?.orientation?.lock?.('landscape');
  } catch {
    // Expected on iOS and on desktop. Renderer.resize() covers it.
  }
}

// ---------------------------------------------------------------------------
// The first-tap gate
// ---------------------------------------------------------------------------

if (isTouchPrimary && enterButton) {
  enterButton.hidden = false;
  enterButton.addEventListener('click', async () => {
    enterButton.hidden = true;
    await goFullscreen();
    await lockLandscape();
    // The click itself is the user gesture the audio engine is waiting for; main.js unlocks
    // audio off the first input it sees, and the canvas gets focus so keys work if a physical
    // keyboard is attached to the phone or tablet.
    canvas?.focus?.();
  }, { once: true });
}

// ---------------------------------------------------------------------------
// Gesture suppression
// ---------------------------------------------------------------------------

// Pinch-zoom and double-tap-to-zoom. `touch-action: none` in CSS covers the canvas, but iOS
// Safari also fires these gesture events on the document and ignores touch-action for them.
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}

// Double-tap-to-zoom on browsers without the gesture events: two taps under 300ms apart.
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = e.timeStamp;
  if (now - lastTouchEnd < 300) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });

// Pull-to-refresh and rubber-band scrolling. The document never scrolls — the game is one
// fixed viewport — so any touchmove that reaches the document is unwanted.
document.addEventListener('touchmove', (e) => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

// The long-press context menu, which on a canvas is never useful and interrupts a held stick.
canvas?.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------------------------------------------------------------------------
// Viewport changes
// ---------------------------------------------------------------------------

/**
 * Re-fit on anything that can change the usable area.
 *
 * `visualViewport` is the one that matters on mobile: rotating, the URL bar sliding away, and
 * entering fullscreen all change the visible height without necessarily firing `resize`, and a
 * stale canvas size is a game drawn half off the screen.
 */
function refit() {
  globalThis.dispatchEvent(new Event('resize'));
}

globalThis.visualViewport?.addEventListener('resize', refit);
globalThis.visualViewport?.addEventListener('scroll', refit);
globalThis.screen?.orientation?.addEventListener?.('change', () => {
  // A frame after the change: the new dimensions are not reliably readable until the browser
  // has finished reflowing, and measuring too early bakes in the old orientation's height.
  requestAnimationFrame(() => requestAnimationFrame(refit));
});
document.addEventListener('fullscreenchange', refit);
