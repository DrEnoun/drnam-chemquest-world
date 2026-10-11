// Sizes the page for the screen it is on. On a phone nothing changes (--k is 1). On a laptop or a projector the page gets
// class "wide" (columns that fill the window, no scrolling) and --k grows with the window height, so text and buttons
// stay readable from the back of a room.
const root = document.documentElement;

export function fit() {
  const w = innerWidth, h = innerHeight;
  const wide = w >= 900 && w / h >= 1.5;                     // 16:9, 16:10 and 3:2 screens get the two-column layout
  // Wide: scale with the window height. Squarer or portrait screens (4:3 projectors, tablets upright) keep the one-column layout,
  // scaled by width. A phone held sideways is short, so it stays at normal size.
  const k = wide ? Math.min(2.4, h / 720) : h < 500 ? 1 : Math.min(1.9, w / 560);
  const changed = root.classList.contains('wide') !== wide;
  root.classList.toggle('wide', wide);
  root.style.setProperty('--k', Math.max(1, k).toFixed(3));
  if (changed) dispatchEvent(new CustomEvent('drnam:layout', { detail: { wide } }));
}
fit();
addEventListener('resize', fit);
addEventListener('orientationchange', fit);

// Full screen (handy on a projector)
const btn = document.getElementById('btn-full');
if (btn) {
  if (!root.requestFullscreen) btn.hidden = true;
  else {
    const label = () => { btn.textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen'; };
    btn.onclick = () => { (document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen()).catch(() => {}); };
    document.addEventListener('fullscreenchange', label); label();
  }
}
