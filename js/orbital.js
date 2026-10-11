// World 2 — Orbital Ruins: push electrons into orbital sockets. Rules are in orbital-logic.js; levels in data/orbitals.json.
import { startGame, step, check, legalTargets, configString, complete, crateCount, liveCells, newState, BOXES, AUFBAU, sup } from './orbital-logic.js';
import { drawAvatar } from './avatar.js';
import { pxCanvas } from './pxart.js';

const T = 64;                                   // backing pixels per board tile
const SUB_COLOUR = { s: '#ff8a8a', p: '#5eead4', d: '#c4b5fd' };
const AXIS = ['x', 'y', 'z'];
const DIR_OF_KEY = { ArrowUp: 'U', ArrowDown: 'D', ArrowLeft: 'L', ArrowRight: 'R', w: 'U', s: 'D', a: 'L', d: 'R', W: 'U', S: 'D', A: 'L', D: 'R' };

export function createOrbital({ $, levels, getAvatar, says, sound, starsFor, onFinish, onExit }) {
  const cv = $('orb-canvas'), ctx = cv.getContext('2d');
  let level = null, board = null, g = null, hearts = 3, coins = 0, xp = 0, history = [], live = null;
  let vis = null, pvis = null, fly = [], parts = [], shake = null, flashes = [], hintUntil = 0, over = false, running = false, raf = 0, last = 0, t = 0, deadWarned = false;
  let statics = null;

  const cx = k => (k % board.w), cy = k => Math.floor(k / board.w);

  // ----- static layer: stone floor, walls and the empty sockets -----
  function buildStatic() {
    statics = pxCanvas(board.w * T, board.h * T);
    const c = statics.getContext('2d');
    for (let y = 0; y < board.h; y++) for (let x = 0; x < board.w; x++) {
      const k = y * board.w + x, px = x * T, py = y * T;
      if (board.walls.has(k)) {
        const gr = c.createLinearGradient(px, py, px, py + T); gr.addColorStop(0, '#8a7155'); gr.addColorStop(1, '#5d4a37');
        c.fillStyle = gr; c.fillRect(px, py, T, T);
        c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(px, py, T, 5);
        c.strokeStyle = 'rgba(30,20,10,.45)'; c.lineWidth = 2;
        for (let r = 1; r < 3; r++) { c.beginPath(); c.moveTo(px, py + r * T / 3); c.lineTo(px + T, py + r * T / 3); c.stroke(); }
        const off = (y % 2) * T / 2; for (let r = 0; r < 3; r++) { const bx = px + ((off + r * 21) % T); c.beginPath(); c.moveTo(bx, py + r * T / 3); c.lineTo(bx, py + (r + 1) * T / 3); c.stroke(); }
      } else if (board.sockets.has(k)) {
        const gr = c.createLinearGradient(px, py, px, py + T); gr.addColorStop(0, '#6b5640'); gr.addColorStop(1, '#4a3b2c'); c.fillStyle = gr; c.fillRect(px, py, T, T);
        const s = board.sockets.get(k), col = SUB_COLOUR[s.sub.slice(-1)];
        c.fillStyle = '#1b1510'; c.beginPath(); c.roundRect(px + 7, py + 7, T - 14, T - 14, 12); c.fill();
        c.strokeStyle = col; c.lineWidth = 4; c.beginPath(); c.roundRect(px + 7, py + 7, T - 14, T - 14, 12); c.stroke();
        c.fillStyle = col; c.font = '800 17px "League Spartan", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        if (s.sub.endsWith('p')) { c.fillText(s.sub, px + T / 2 - 4, py + T - 17); c.font = '800 11px "League Spartan", sans-serif'; c.fillText(AXIS[s.box], px + T / 2 + 14, py + T - 14); }
        else c.fillText(s.sub, px + T / 2, py + T - 17);
      } else {
        c.fillStyle = (x + y) % 2 ? '#e4c88f' : '#dcbd80'; c.fillRect(px, py, T, T);
        c.strokeStyle = 'rgba(120,85,40,.25)'; c.lineWidth = 2; c.strokeRect(px + 1, py + 1, T - 2, T - 2);
        c.fillStyle = 'rgba(120,85,40,.12)'; for (let i = 0; i < 4; i++) c.fillRect(px + 8 + ((x * 7 + y * 13 + i * 19) % 44), py + 6 + ((x * 11 + y * 5 + i * 23) % 46), 3, 2);
      }
    }
  }

  // ----- helpers for the moving things -----
  function resetVisuals() {
    vis = new Map(g.crates.map(k => [k, { x: cx(k), y: cy(k) }]));
    pvis = { x: cx(g.player), y: cy(g.player) };
    fly = []; parts = []; shake = null; flashes = [];
  }
  const burst = (x, y, n = 14, col = '212,255,58') => { for (let i = 0; i < n; i++) { const a = (i / n) * 6.283 + Math.random(), sp = 40 + Math.random() * 90; parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, life: 0, max: 0.6 + Math.random() * 0.5, r: 3 + Math.random() * 4, col }); } };

  // ----- drawing -----
  function arrow(c, x, y, up, col) {
    c.save(); c.translate(x, y); c.scale(0.78, up ? 0.78 : -0.78);
    c.strokeStyle = '#1b1510'; c.lineWidth = 9; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(0, 15); c.lineTo(0, -14); c.moveTo(-9, -5); c.lineTo(0, -15); c.lineTo(9, -5); c.stroke();
    c.strokeStyle = col; c.lineWidth = 5; c.beginPath(); c.moveTo(0, 15); c.lineTo(0, -14); c.moveTo(-9, -5); c.lineTo(0, -15); c.lineTo(9, -5); c.stroke(); c.restore();
  }
  function glow(x, y, r, rgb, a) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
  }
  function orb(x, y, scale = 1) {                        // an electron
    const r = 17 * scale;
    glow(x, y, 36 * scale, '94,234,212', 0.55);
    const gr = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.05); gr.addColorStop(0, '#e8fffb'); gr.addColorStop(0.45, '#2dd4bf'); gr.addColorStop(1, '#0b6b64');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.strokeStyle = '#0a2a2c'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#06323a'; ctx.font = `800 ${Math.round(13 * scale)}px "League Spartan", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('e⁻', x, y + 1);
  }
  function crate(x, y) {                                 // a stone block carrying an electron
    const px = x * T, py = y * T;
    ctx.fillStyle = 'rgba(40,25,10,.3)'; ctx.beginPath(); ctx.ellipse(px + T / 2 + 3, py + T - 8, 24, 7, 0, 0, 7); ctx.fill();
    const gr = ctx.createLinearGradient(px, py, px, py + T); gr.addColorStop(0, '#9a8aa8'); gr.addColorStop(1, '#5d5470');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(px + 6, py + 6, T - 12, T - 14, 10); ctx.fill();
    ctx.strokeStyle = '#2b2438'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(px + 12, py + 9, T - 24, 4);
    orb(px + T / 2, py + T / 2 - 2, 0.95);
  }
  function socketContents(k, tNow) {
    const s = board.sockets.get(k), px = cx(k) * T, py = cy(k) * T, n = g.state.fill[s.sub][s.box], col = SUB_COLOUR[s.sub.slice(-1)];
    const given = level.given.includes(s.sub);
    if (n >= 1) { glow(px + T / 2, py + T / 2 - 8, 34, '212,255,58', 0.25); arrow(ctx, px + T / 2 - (n === 2 ? 10 : 0), py + T / 2 - 10, true, '#d4ff3a'); }
    if (n === 2) arrow(ctx, px + T / 2 + 10, py + T / 2 - 10, false, '#ffffff');
    if (tNow < hintUntil && check(g.state, s.sub, s.box).ok) {
      const pulse = 0.5 + 0.5 * Math.sin(tNow * 8); ctx.strokeStyle = `rgba(212,255,58,${0.6 + 0.4 * pulse})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(px + 3, py + 3, T - 6, T - 6, 14); ctx.stroke(); glow(px + T / 2, py + T / 2, 44, '212,255,58', 0.35 * pulse);
    }
    void col; void given;
  }
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now; t += dt;
    const k = Math.min(1, dt * 16);
    pvis.x += (cx(g.player) - pvis.x) * k; pvis.y += (cy(g.player) - pvis.y) * k;
    for (const [cell, v] of vis) { v.x += (cx(cell) - v.x) * k; v.y += (cy(cell) - v.y) * k; }
    for (const f of fly) f.t += dt / 0.28; fly = fly.filter(f => { if (f.t >= 1) { burst(f.tx * T + T / 2, f.ty * T + T / 2); return false; } return true; });
    for (const p of parts) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt; } parts = parts.filter(p => p.life < p.max);
    flashes = flashes.filter(f => t - f.t0 < 0.5);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(statics, 0, 0);
    for (const k2 of board.sockets.keys()) socketContents(k2, t);
    for (const f of flashes) { const px = cx(f.k) * T, py = cy(f.k) * T, a = 1 - (t - f.t0) / 0.5; ctx.fillStyle = `rgba(252,90,90,${0.55 * a})`; ctx.beginPath(); ctx.roundRect(px + 4, py + 4, T - 8, T - 8, 14); ctx.fill(); }
    for (const v of vis.values()) crate(v.x, v.y);
    for (const f of fly) { const e = f.t * f.t * (3 - 2 * f.t), x = (f.x + (f.tx - f.x) * e) * T + T / 2, y = (f.y + (f.ty - f.y) * e) * T + T / 2 - Math.sin(f.t * Math.PI) * 14; orb(x, y, 0.9 - 0.3 * f.t); }
    const sx = shake && t - shake.t0 < 0.3 ? Math.sin((t - shake.t0) * 60) * 5 : 0;
    const sc = T / 44 * 1.18, ax = pvis.x * T + T / 2 - 16 * sc + sx, ay = pvis.y * T + T - 44 * sc + 5;
    ctx.fillStyle = 'rgba(40,25,10,.3)'; ctx.beginPath(); ctx.ellipse(pvis.x * T + T / 2 + 2, pvis.y * T + T - 6, 20, 6, 0, 0, 7); ctx.fill();
    drawAvatar(ctx, getAvatar(), ax, ay, sc, { mood: shake && t - shake.t0 < 0.8 ? 'angry' : 'wait' });
    for (const p of parts) { const a = 1 - p.life / p.max; glow(p.x, p.y, p.r * 4, p.col, 0.8 * a); ctx.fillStyle = `rgba(${p.col},${a})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * a, 0, 7); ctx.fill(); }
    raf = requestAnimationFrame(frame);
  }

  // ----- side panel: the orbital diagram and the electron configuration -----
  function renderPanel() {
    $('orb-atom').textContent = `${level.element.name} (${level.element.symbol}), Z = ${level.element.z}`;
    const subs = Object.keys(g.state.fill).sort((a, b) => AUFBAU.indexOf(b) - AUFBAU.indexOf(a));      // highest energy on top
    $('orb-rows').innerHTML = subs.map(sub => {
      const given = level.given.includes(sub), kind = sub.slice(-1);
      const boxes = g.state.fill[sub].map(n => `<span class="orb-box" data-n="${n}" style="--c:${SUB_COLOUR[kind]}">${n >= 1 ? '<i class="up">↑</i>' : ''}${n === 2 ? '<i class="down">↓</i>' : ''}</span>`).join('');
      return `<div class="orb-row${given ? ' is-given' : ''}"><b>${sub}</b><span class="orb-boxes">${boxes}</span>${given ? '<small>given</small>' : ''}</div>`;
    }).join('');
    $('orb-config').textContent = configString(g.state);
    $('orb-count').textContent = `${g.crates.length} electron${g.crates.length === 1 ? '' : 's'} left to place`;
  }
  const renderHearts = () => { $('orb-hearts').innerHTML = [0, 1, 2].map(i => `<span class="${i < hearts ? '' : 'gone'}">${i < hearts ? '♥' : '♡'}</span>`).join(''); $('orb-hearts').setAttribute('aria-label', `${hearts} of 3 hearts`); };
  const renderStatus = () => { $('orb-coins').textContent = coins; $('orb-meta').textContent = `${level.boss ? 'Boss' : 'Level ' + level.id}: ${level.title} · ${level.subtitle}`; $('orb-goal').textContent = level.goal; };

  // ----- playing -----
  function start(levelId) {
    level = levels.find(l => l.id === levelId);
    const s = startGame(level); board = s.board; g = s.g; live = liveCells(board);
    hearts = 3; coins = 0; xp = 0; history = []; over = false; deadWarned = false; hintUntil = 0;
    cv.width = board.w * T; cv.height = board.h * T; $('orb-board').style.setProperty('--orb-ar', `${board.w} / ${board.h}`); $('orb-board').style.setProperty('--orb-w', board.w); $('orb-board').style.setProperty('--orb-h', board.h);
    buildStatic(); resetVisuals(); renderHearts(); renderStatus(); renderPanel();
    says($('orb-says'), { text: level.tip });
    if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  function restart() { if (!level || over) return; const s = startGame(level); g = s.g; history = []; deadWarned = false; resetVisuals(); renderPanel(); sound.pop(); says($('orb-says'), { text: 'Board reset. Your hearts stay as they are.' }); }
  function undo() {
    if (!level || over || !history.length) return;
    g = history.pop(); resetVisuals(); renderPanel(); sound.pop();
  }
  function hint() { if (!level || over) return; hintUntil = t + 4; sound.select(); says($('orb-says'), { text: 'The glowing sockets are the ones that may take the next electron. Which rule picks them?' }); }

  function move(dir) {
    if (!level || over) return;
    const before = g, r = step(board, g, dir);
    if (r.illegal) {
      hearts -= 1; renderHearts(); sound.wrong(); shake = { t0: t }; flashes.push({ k: r.illegal.socket, t0: t });
      says($('orb-says'), { text: r.illegal.text, state: 'wrong', status: '✗ Not that one. −1 heart.' });
      if (hearts <= 0) finish(false);
      return;
    }
    if (!r.moved) return;
    $('screen-orbital').classList.add('played');
    history.push(before); if (history.length > 200) history.shift();
    if (r.pushed) {
      const v = vis.get(r.g.player);
      vis.delete(r.g.player);
      if (r.absorbed) {
        if (v) fly.push({ x: v.x, y: v.y, tx: cx(r.absorbed.socket), ty: cy(r.absorbed.socket), t: 0 });
        sound.correct(); coins += 6; xp += 8;
        const n = r.g.state.fill[r.absorbed.sub][r.absorbed.box];
        say(`✓ Electron placed in ${r.absorbed.sub}${r.absorbed.sub.endsWith('p') ? AXIS[r.absorbed.box] : ''}.`, `${n === 2 ? 'The orbital now holds a pair with opposite spins. ' : ''}Configuration so far: ${configString(r.g.state)}`, 'correct');
      } else {
        const to = r.g.crates.find(k => !before.crates.includes(k)); if (to != null && v) vis.set(to, v);
        sound.tick();
      }
    }
    g = r.g; renderStatus(); renderPanel();
    if (!deadWarned && g.crates.some(k => !live.has(k))) { deadWarned = true; says($('orb-says'), { text: 'An electron is stuck against a wall and cannot reach any socket. Press Undo or Restart.', state: 'wrong', status: 'Stuck!' }); }
    if (complete(g.state, level)) { over = true; setTimeout(() => finish(true), 900); }
  }
  const say = (status, text, state) => says($('orb-says'), { text, state, status });

  function finish(win) {
    over = true;
    const cfg = configString(g.state);
    onFinish({
      win, hearts, coins, xp, levelId: level.id,
      title: win ? 'Level complete!' : 'Out of hearts',
      summary: win ? `${level.element.name[0].toUpperCase() + level.element.name.slice(1)} is ${cfg}. You earned ${coins} coins and ${xp} XP.`
        : 'You ran out of hearts. Try again: check the energy order, then give each orbital one electron before pairing any up.',
    });
  }

  // ----- controls: keyboard, swipe, on-screen buttons -----
  addEventListener('keydown', e => {
    if ($('screen-orbital').hidden || !running || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'z' || e.key === 'Z') { undo(); e.preventDefault(); return; }
    if (e.key === 'r' || e.key === 'R') { restart(); e.preventDefault(); return; }
    const d = DIR_OF_KEY[e.key]; if (d) { move(d); e.preventDefault(); }
  });
  // Swipe anywhere on the screen to move (phones). Keep dragging to keep walking: every STEP_PX of finger travel is one step.
  // Buttons are left alone so they still work with a tap.
  const STEP_PX = 34, screenEl = $('screen-orbital');
  let sw = null;
  const dirOf = (dx, dy) => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U'));
  screenEl.addEventListener('touchstart', e => {
    if (e.target.closest('button, a, .chip, .dpad') || e.touches.length > 1) { sw = null; return; }
    const p = e.changedTouches[0]; sw = { x: p.clientX, y: p.clientY, moved: false };
  }, { passive: true });
  screenEl.addEventListener('touchmove', e => {
    if (!sw) return;
    e.preventDefault();                                   // no scrolling or pull-to-refresh while playing
    const p = e.changedTouches[0];
    let dx = p.clientX - sw.x, dy = p.clientY - sw.y;
    while (Math.max(Math.abs(dx), Math.abs(dy)) >= STEP_PX) {
      const d = dirOf(dx, dy); move(d); sw.moved = true;
      if (d === 'R') { sw.x += STEP_PX; } else if (d === 'L') { sw.x -= STEP_PX; } else if (d === 'D') { sw.y += STEP_PX; } else { sw.y -= STEP_PX; }
      dx = p.clientX - sw.x; dy = p.clientY - sw.y;
    }
  }, { passive: false });
  screenEl.addEventListener('touchend', e => {
    if (!sw) return; const p = e.changedTouches[0], dx = p.clientX - sw.x, dy = p.clientY - sw.y, moved = sw.moved; sw = null;
    if (!moved && Math.max(Math.abs(dx), Math.abs(dy)) >= 18) move(dirOf(dx, dy));     // a short flick still counts
  }, { passive: true });
  screenEl.addEventListener('touchcancel', () => { sw = null; }, { passive: true });
  // The on-screen arrows are optional on phones: the "Pad" button shows or hides them (remembered on the device)
  try { screenEl.classList.toggle('show-pad', localStorage.getItem('drnam-quest:pad') === '1'); } catch (e) { /* ignore */ }
  $('orb-pad').onclick = () => { const on = screenEl.classList.toggle('show-pad'); try { localStorage.setItem('drnam-quest:pad', on ? '1' : '0'); } catch (e) { /* ignore */ } $('orb-pad').setAttribute('aria-pressed', String(on)); sound.pop(); };
  $('orb-pad').setAttribute('aria-pressed', String(screenEl.classList.contains('show-pad')));
  document.querySelectorAll('#screen-orbital [data-move]').forEach(b => { b.onclick = () => move(b.dataset.move); });
  $('orb-undo').onclick = undo; $('orb-restart').onclick = restart; $('orb-hint').onclick = hint;
  $('orb-quit').onclick = () => { stop(); onExit(); };
  function stop() { running = false; cancelAnimationFrame(raf); over = true; }
  return { start, stop };
}
