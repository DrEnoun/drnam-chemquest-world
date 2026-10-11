// CanvasRenderingContext2D.roundRect arrived in Safari 16 and Chrome 99. This adds it for older browsers
// (for example iPhones and iPads that cannot update), so the map and characters still draw.
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r = 0) {
    const rad = Array.isArray(r) ? r : [r, r, r, r];
    const [tl, tr, br, bl] = rad.length === 1 ? [rad[0], rad[0], rad[0], rad[0]] : rad.length === 2 ? [rad[0], rad[1], rad[0], rad[1]] : rad.length === 3 ? [rad[0], rad[1], rad[2], rad[1]] : rad;
    const cap = Math.min(Math.abs(w), Math.abs(h)) / 2, a = Math.min(tl, cap), b = Math.min(tr, cap), c = Math.min(br, cap), d = Math.min(bl, cap);
    this.moveTo(x + a, y); this.lineTo(x + w - b, y); this.arcTo(x + w, y, x + w, y + b, b);
    this.lineTo(x + w, y + h - c); this.arcTo(x + w, y + h, x + w - c, y + h, c);
    this.lineTo(x + d, y + h); this.arcTo(x, y + h, x, y + h - d, d);
    this.lineTo(x, y + a); this.arcTo(x, y, x + a, y, a); this.closePath();
  };
}
