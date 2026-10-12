// World 3 — Periodic Falls: pop the element bubbles that match the sign. Rules are in pop-logic.js; rounds in data/falls.json.
import { buildRound, matches, wrongText, COINS_PER_POP, ROUND_BONUS, XP_PER_POP } from './pop-logic.js';
import { drawAvatar } from './avatar.js';

const CAT_COL = { metal: '#9fc3ff', nonmetal: '#8be9c0', metalloid: '#e3f27a' };
const FAM_COL = { alkali: '#ff8a8a', alkaline: '#ffb86b', halogen: '#ffe66d', noble: '#c4b5fd' };
const colourOf = el => FAM_COL[el.family] || CAT_COL[el.category];
const rgbOf = hex => { const n = parseInt(hex.slice(1), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createFalls({ $, levels, elements, getAvatar, says, sound, onFinish, onExit }) {
  const cv = $('fall-canvas'), ctx = cv.getContext('2d'), arena = $('fall-arena');
  let level = null, ri = 0, round = null, bubbles = [], parts = [], rings = [], beams = [], streaks = [];
  let hearts = 3, coins = 0, xp = 0, popped = 0, mistakes = 0, timeLeft = 0, hintUntil = 0, hintSym = null;
  let phase = 'idle', phaseT = 0, running = false, raf = 0, last = 0, t = 0, W = 300, H = 300, dpr = 1, R = 28;
  const known = new Set();                              // symbols popped correctly so far in this level (they fill the table)
  const reveal = new Set();                             // symbols shown after a time-out

  // ----- size: the canvas follows its box -----
  function resize() {
    const r = arena.getBoundingClientRect(); if (r.width < 10 || r.height < 10) return;
    const nw = Math.round(r.width), nh = Math.round(r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const b of bubbles) { b.x *= nw / W; b.y *= nh / H; }
    W = nw; H = nh; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    R = clamp(Math.min(W, H) * 0.085, 17, 80); floor = H - Math.max(46, R * 1.9);
    streaks = Array.from({ length: 16 }, (_, i) => ({ x: W * (0.22 + 0.56 * ((i * 0.618) % 1)), y: (i * 97) % H, len: 30 + (i * 13) % 60, sp: 90 + (i * 29) % 90 }));
  }
  let floor = 200;
  new ResizeObserver(resize).observe(arena);

  // ----- the periodic table that fills in as the player pops -----
  function buildTable() {
    const g = $('fall-grid'); g.innerHTML = '';
    for (const e of elements) {
      const c = document.createElement('div'); c.className = 'pt-cell'; c.dataset.sym = e.symbol; c.style.gridColumn = e.group; c.style.gridRow = e.period;
      c.setAttribute('title', `${e.name}, ${e.symbol}`); g.append(c);
    }
  }
  function paintTable() {
    for (const c of $('fall-grid').children) {
      const e = elements.find(x => x.symbol === c.dataset.sym), got = known.has(e.symbol), rev = reveal.has(e.symbol);
      c.dataset.state = got ? 'got' : rev ? 'missed' : 'empty'; c.textContent = got || rev ? e.symbol : '';
      c.style.setProperty('--c', got || rev ? colourOf(e) : 'transparent');
    }
  }

  // ----- rounds -----
  function startLevel(levelId) {
    $('fall-next').hidden = true; level = levels.find(l => l.id === levelId); ri = 0; hearts = 3; coins = 0; xp = 0; known.clear(); reveal.clear(); parts = []; rings = []; beams = [];
    buildTable(); paintTable(); renderHearts(); resize();
    says($('fall-says'), { text: level.tip });
    startRound();
    if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  function startRound() {
    round = level.rounds[ri]; mistakes = 0; popped = 0; phase = 'play'; reveal.clear(); hintUntil = 0;
    const b = buildRound(round, elements);
    const sp = Math.min(W, H) * level.speed;
    bubbles = b.bubbles.map((el, i) => {
      const a = Math.random() * 6.283, v = sp * (0.7 + Math.random() * 0.6);
      return { el, x: R + Math.random() * (W - 2 * R), y: R + Math.random() * Math.max(10, floor - 2 * R), vx: Math.cos(a) * v, vy: Math.sin(a) * v, ph: Math.random() * 6.283, bad: false, shake: 0, target: matches(el, round.rule), born: t + i * 0.05 };
    });
    timeLeft = round.time || 0;
    $('fall-timer').hidden = !round.time; renderStatus(); paintTable();
  }
  const renderHearts = () => { $('fall-hearts').innerHTML = [0, 1, 2].map(i => `<span class="${i < hearts ? '' : 'gone'}">${i < hearts ? '♥' : '♡'}</span>`).join(''); $('fall-hearts').setAttribute('aria-label', `${hearts} of 3 hearts`); };
  function renderStatus() {
    $('fall-coins').textContent = coins;
    $('fall-meta').textContent = `${level.boss ? 'Boss' : 'Level ' + level.id}: ${level.title} · Round ${ri + 1} of ${level.rounds.length}`;
    $('fall-prompt').textContent = round.prompt; $('fall-count').textContent = `${popped} of ${round.targets} popped`;
    $('fall-progress').firstElementChild.style.transform = `scaleX(${popped / round.targets})`; $('fall-progress').setAttribute('aria-valuenow', Math.round(100 * popped / round.targets));
  }
  function tickTimer() {
    if (!round.time) return;
    const f = Math.max(0, timeLeft / round.time), bar = $('fall-timer');
    bar.firstElementChild.style.transform = `scaleX(${f})`; bar.dataset.low = String(f < 0.25); bar.setAttribute('aria-valuenow', Math.round(f * 100));
  }
  function burst(x, y, col, n = 18) { for (let i = 0; i < n; i++) { const a = (i / n) * 6.283 + Math.random(), sp = 70 + Math.random() * 150; parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0, max: 0.55 + Math.random() * 0.5, r: 2.5 + Math.random() * 4, col }); } }

  function tap(x, y) {
    if (phase !== 'play') return;
    sound.unlock();
    beams.push({ x, y, t0: t });
    let best = null, bd = R + 14;
    for (const b of bubbles) { const d = Math.hypot(b.x - x, b.y - y); if (d < bd) { bd = d; best = b; } }
    if (!best) { rings.push({ x, y, t0: t }); return; }
    if (best.bad) return;
    if (best.target) {
      bubbles = bubbles.filter(b => b !== best); popped++; coins += COINS_PER_POP; xp += XP_PER_POP; known.add(best.el.symbol);
      burst(best.x, best.y, rgbOf(colourOf(best.el))); sound.correct(); paintTable(); renderStatus();
      says($('fall-says'), { text: `${best.el.name[0].toUpperCase()}${best.el.name.slice(1)} is ${describeShort(best.el)}.`, state: 'correct', status: `✓ ${best.el.symbol}!` });
      if (popped >= round.targets) endRound(true);
    } else {
      best.bad = true; best.shake = 0.5; hearts--; mistakes++; renderHearts(); sound.wrong(); burst(best.x, best.y, '252,90,90', 10);
      says($('fall-says'), { text: wrongText(best.el, round), state: 'wrong', status: '✗ Not that one. −1 heart.' });
      if (hearts <= 0) { phase = 'over'; setTimeout(() => finish(false), 1400); }
    }
  }
  const describeShort = el => `${el.family ? { alkali: 'an alkali metal', alkaline: 'an alkaline earth metal', halogen: 'a halogen', noble: 'a noble gas' }[el.family] : { metal: 'a metal', nonmetal: 'a nonmetal', metalloid: 'a metalloid' }[el.category]} in group ${el.group}, period ${el.period}`;

  function endRound(ok, why) {
    phase = 'between'; phaseT = 0;
    if (ok && mistakes === 0) { coins += ROUND_BONUS; }
    renderStatus();
    if (ok) { sound.correct(); says($('fall-says'), { text: round.fact, state: 'correct', status: mistakes === 0 ? '✓ Round clear! +5 bonus.' : '✓ Round clear!' }); }
    else {
      const left = bubbles.filter(b => b.target).map(b => b.el);
      left.forEach(e => reveal.add(e.symbol)); paintTable();
      says($('fall-says'), { text: `${round.fact} The ones you missed: ${left.map(e => e.symbol).join(', ')}.`, state: 'wrong', status: why === 'time' ? '✗ Time’s up! −1 heart.' : '✗ Round over.' });
    }
    for (const b of bubbles) burst(b.x, b.y, rgbOf(b.target ? '#d4ff3a' : '#ffffff'), 6);
    bubbles = [];
    showNext();
  }
  function showNext() { const b = $('fall-next'); b.textContent = ri + 1 >= level.rounds.length ? 'Finish ›' : 'Next ›'; b.hidden = false; }
  function nextRound() {
    $('fall-next').hidden = true;
    ri++;
    if (ri >= level.rounds.length) { phase = 'over'; finish(true); return; }
    startRound();
  }
  function finish(win) {
    phase = 'over'; $('fall-next').hidden = true;
    const n = known.size;
    onFinish({
      win, hearts, coins, xp, levelId: level.id,
      title: win ? 'Level complete!' : hearts <= 0 ? 'Out of hearts' : 'Level over',
      summary: win ? `You cleared all ${level.rounds.length} rounds, popped ${n} different elements, and earned ${coins} coins and ${xp} XP.`
        : 'You ran out of hearts. Try again: read the sign carefully, and remember that a group is a column and a period is a row.',
    });
  }
  function hint() {
    if (phase !== 'play') return;
    const left = bubbles.filter(b => b.target); if (!left.length) return;
    hintSym = left[Math.floor(Math.random() * left.length)].el.symbol; hintUntil = t + 2.6; sound.select();
    says($('fall-says'), { text: 'Look for the ring: that bubble matches the sign. Which family, group or period does it belong to?' });
  }

  // ----- drawing -----
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0f7fa6'); g.addColorStop(0.55, '#0b5b84'); g.addColorStop(1, '#083a5e'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // rock walls
    const rock = (x0, dir) => { ctx.fillStyle = '#4a3a2e'; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + dir * W * 0.2, 0); ctx.lineTo(x0 + dir * W * 0.13, H * 0.45); ctx.lineTo(x0 + dir * W * 0.2, H); ctx.lineTo(x0, H); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(Math.min(x0, x0 + dir * 16), 0, 16, H); };
    rock(0, 1); rock(W, -1);
    // the falls: a pale band with moving streaks
    const fx = W * 0.24, fw = W * 0.52, fg = ctx.createLinearGradient(fx, 0, fx + fw, 0); fg.addColorStop(0, 'rgba(180,240,255,0)'); fg.addColorStop(0.5, 'rgba(180,240,255,.22)'); fg.addColorStop(1, 'rgba(180,240,255,0)'); ctx.fillStyle = fg; ctx.fillRect(fx, 0, fw, H);
    ctx.strokeStyle = 'rgba(235,252,255,.35)'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    for (const s of streaks) { const y = (s.y + t * s.sp) % (H + s.len) - s.len; ctx.beginPath(); ctx.moveTo(s.x, y); ctx.lineTo(s.x, y + s.len); ctx.stroke(); }
    // pool and mist
    const pg = ctx.createLinearGradient(0, floor, 0, H); pg.addColorStop(0, '#1aa6c4'); pg.addColorStop(1, '#0a5a7c'); ctx.fillStyle = pg; ctx.fillRect(0, floor + 14, W, H - floor - 14);
    ctx.fillStyle = 'rgba(235,252,255,.35)'; for (let i = 0; i < 7; i++) { const mx = W * (0.12 + i * 0.13) + Math.sin(t * 0.8 + i) * 8; ctx.beginPath(); ctx.ellipse(mx, floor + 12, 38, 9, 0, 0, 7); ctx.fill(); }
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); for (let x = 0; x <= W; x += 10) { const y = floor + 28 + i * 14 + Math.sin(x * 0.05 + t * 1.6 + i) * 2.4; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
  }
  function drawBubble(b) {
    const age = Math.min(1, Math.max(0, (t - b.born) * 5)), wob = 1 + Math.sin(t * 2.4 + b.ph) * 0.03, r = R * wob * (0.4 + 0.6 * age);
    const sx = b.shake > 0 ? Math.sin(t * 60) * 5 * b.shake * 2 : 0, x = b.x + sx, y = b.y;
    const col = b.bad ? '252,90,90' : '120,215,255';
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r); g.addColorStop(0, 'rgba(255,255,255,.7)'); g.addColorStop(0.35, `rgba(${col},.28)`); g.addColorStop(1, `rgba(${col},.55)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.strokeStyle = b.bad ? 'rgba(255,170,170,.95)' : 'rgba(255,255,255,.85)'; ctx.lineWidth = 2.6; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r * 0.8, Math.PI * 1.15, Math.PI * 1.5); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.font = `800 ${Math.round(r * 0.52)}px "League Spartan", sans-serif`; ctx.fillStyle = 'rgba(6,50,58,.85)'; ctx.fillText(String(b.el.z), x, y - r * 0.52);
    ctx.font = `800 ${Math.round(r * 0.86)}px "League Spartan", sans-serif`; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.strokeText(b.el.symbol, x, y + r * 0.1); ctx.fillStyle = '#06323a'; ctx.fillText(b.el.symbol, x, y + r * 0.1);
    if (b.bad) { ctx.strokeStyle = 'rgba(200,30,30,.9)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - r * 0.6, y - r * 0.6); ctx.lineTo(x + r * 0.6, y + r * 0.6); ctx.moveTo(x + r * 0.6, y - r * 0.6); ctx.lineTo(x - r * 0.6, y + r * 0.6); ctx.stroke(); }
    if (hintSym === b.el.symbol && t < hintUntil) { const p = 0.5 + 0.5 * Math.sin(t * 9); ctx.strokeStyle = `rgba(212,255,58,${0.55 + 0.45 * p})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y, r + 7 + p * 4, 0, 7); ctx.stroke(); }
  }
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now; t += dt;
    if (phase === 'play') {
      for (const b of bubbles) {
        b.x += b.vx * dt; b.y += b.vy * dt; b.shake = Math.max(0, b.shake - dt);
        if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx); } if (b.x > W - R) { b.x = W - R; b.vx = -Math.abs(b.vx); }
        if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy); } if (b.y > floor - R) { b.y = floor - R; b.vy = -Math.abs(b.vy); }
      }
      for (let i = 0; i < bubbles.length; i++) for (let j = i + 1; j < bubbles.length; j++) {            // soft bump so bubbles do not stack
        const a = bubbles[i], c = bubbles[j], dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy) || 1, min = R * 1.7;
        if (d < min) { const push = (min - d) / 2, nx = dx / d, ny = dy / d; a.x -= nx * push; a.y -= ny * push; c.x += nx * push; c.y += ny * push; const dvx = a.vx - c.vx, dvy = a.vy - c.vy, dot = dvx * nx + dvy * ny; if (dot > 0) { a.vx -= dot * nx; a.vy -= dot * ny; c.vx += dot * nx; c.vy += dot * ny; } }
      }
      if (round.time) { timeLeft -= dt; tickTimer(); if (timeLeft <= 0) { timeLeft = 0; tickTimer(); hearts--; renderHearts(); sound.wrong(); if (hearts <= 0) { phase = 'over'; endRound(false, 'time'); setTimeout(() => finish(false), 1800); } else endRound(false, 'time'); } }
    } else if (phase === 'between') { phaseT += dt; }
    for (const p of parts) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 220 * dt; } parts = parts.filter(p => p.life < p.max);
    beams = beams.filter(b => t - b.t0 < 0.16); rings = rings.filter(r => t - r.t0 < 0.45);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    drawBackground();
    for (const b of bubbles) drawBubble(b);
    // the shooter: the player's avatar on a rock at the foot of the falls
    const ax = W / 2, sc = clamp(H / 170, 0.8, 3.4), ah = 44 * sc;
    ctx.fillStyle = '#5a4838'; ctx.beginPath(); ctx.ellipse(ax, H - 8, 44 * sc * 0.8, 14, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#7a6450'; ctx.beginPath(); ctx.ellipse(ax, H - 12, 40 * sc * 0.8, 11, 0, 0, 7); ctx.fill();
    drawAvatar(ctx, getAvatar(), ax - 16 * sc, H - 12 - ah + 4, sc, { mood: phase === 'between' && hearts > 0 ? 'happy' : 'wait' });
    for (const bm of beams) { const a = 1 - (t - bm.t0) / 0.16; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(212,255,58,${0.9 * a})`; ctx.lineWidth = 5 * a + 1; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ax, H - 12 - ah * 0.55); ctx.lineTo(bm.x, bm.y); ctx.stroke(); ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.beginPath(); ctx.arc(bm.x, bm.y, 8 * a + 2, 0, 7); ctx.fill(); ctx.restore(); }
    for (const rg of rings) { const a = 1 - (t - rg.t0) / 0.45; ctx.strokeStyle = `rgba(255,255,255,${0.7 * a})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(rg.x, rg.y, 6 + (1 - a) * 26, 0, 7); ctx.stroke(); }
    for (const p of parts) { const a = 1 - p.life / p.max; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(${p.col},${a})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.4 + a), 0, 7); ctx.fill(); ctx.restore(); }
    raf = requestAnimationFrame(frame);
  }

  // ----- input and controls -----
  cv.addEventListener('pointerdown', e => { const r = cv.getBoundingClientRect(); tap((e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height)); e.preventDefault(); });
  $('fall-hint').onclick = hint;
  $('fall-next').onclick = () => { if (phase === 'between') { sound.unlock(); sound.select(); nextRound(); } };
  document.querySelector('#screen-falls .ticket').addEventListener('click', hint);       // on phones the sign doubles as the hint button
  $('fall-quit').onclick = () => { stop(); onExit(); };
  function stop() { running = false; cancelAnimationFrame(raf); phase = 'over'; $('fall-next').hidden = true; }
  // Test hook (only reachable with ?test in the address): where the bubbles are, and a way to burn round time.
  const debug = {
    snapshot: () => ({ W, H, R, phase, round: ri, hearts, timeLeft, bubbles: bubbles.map(b => ({ symbol: b.el.symbol, x: b.x, y: b.y, target: b.target, bad: b.bad })) }),
    drain: sec => { timeLeft = Math.max(0.05, timeLeft - sec); },
  };
  return { start: startLevel, stop, debug };
}
