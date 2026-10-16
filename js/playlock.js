// Keeps the page still while a game is being played: no scrolling, pull-to-refresh bounce, pinch zoom or double-tap zoom.
// Swipe games on a phone need this, otherwise an over-swipe moves or zooms the whole page.
const root = document.documentElement;
let locked = false;
const block = e => { if (!e.target.closest || !e.target.closest('.overlay, [data-scroll]')) e.preventDefault(); };
const noGesture = e => e.preventDefault();
export function lockPlay(on) {
  on = !!on; if (on === locked) return; locked = on;
  root.classList.toggle('playing', on);
  const fn = on ? 'addEventListener' : 'removeEventListener';
  document[fn]('touchmove', block, { passive: false });
  for (const g of ['gesturestart', 'gesturechange', 'gestureend']) document[fn](g, noGesture);
  if (on) scrollTo(0, 0);
}
