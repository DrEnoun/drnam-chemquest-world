// World 4 — Trend Peaks: hop up the platforms in the right order. Rules are in trend-logic.js; rounds in data/trends.json.
import { PROPS, promptFor, orderOf, judge, wrongText, factText, ruleFor, titleFor, COINS_PER_STEP, ROUND_BONUS, XP_PER_STEP } from './trend-logic.js';
import { drawAvatar } from './avatar.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const HEIGHTS = [0.66, 0.4, 0.74, 0.34, 0.6, 0.46];            // platform heights (fraction of the arena), neighbours always differ
const PROP_COL = { radius: '#8be9c0', ie: '#ffb86b', en: '#c4b5fd' };

export function createPeaks({ $, levels, values, elements, getAvatar, says, sound, onFinish, onExit }) {
  const cv = $('peak-canvas'), ctx = cv.getContext('2d'), arena = $('peak-arena');
  const byS = Object.fromEntries(elements.map(e => [e.symbol, e]));
  let level = null, ri = 0, round = null, order = [], plats = [], done = 0, parts = [], clouds = [], rings = [];
  let hearts = 3, coins = 0, xp = 0, mistakes = 0, timeLeft = 0, climbed = 0, spent = 0, last = 0, t = 0, W = 300, H = 300, dpr = 1;
  let phase = 'idle', phaseT = 0, running = false, raf = 0, anim = null, stand = { x: 0, y: 0 }, mood = 'wait', pw = 50, ph = 18, sc = 1;
  let flagUp = false;
  const seen = new Set();                                  // symbols climbed so far in this level (they fill the table)

  // ----- size: the canvas follows its box -----
  function resize() {
    const r = arena.getBoundingClientRect(); if (r.width < 10 || r.height < 10) return;
    W = Math.round(r.width); H = Math.round(r.height); dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    sc = clamp(Math.min(W / 190, H / 240), 0.7, 1.9);
    clouds = Array.from({ length: 5 }, (_, i) => ({ x: (i * 0.23) * W, y: H * (0.1 + (i * 0.17) % 0.4), s: 0.7 + (i % 3) * 0.4, v: 4 + i * 2.5 }));
    place();
  }
  new ResizeObserver(resize).observe(arena);

  // platform pixel positions from their fractions (so a resize keeps the layout)
  function place() {
    const n = plats.length || 5, span = 0.62 * W / Math.max(1, n - 1);
    pw = clamp(span * 1.12, 40, 110 * sc / 1.4); ph = clamp(pw * 0.5, 22, 52);
    for (const p of plats) { p.x = W * p.fx; p.y = H * p.fy; }
    start.x = W * 0.1; start.y = H * 0.86; flag.x = W * 0.9; flag.y = H * 0.2;
    if (!anim) stand = standingAt();
  }
  const start = { x: 0, y: 0 }, flag = { x: 0, y: 0 };
  const standingAt = () => {
    if (flagUp) return { x: flag.x - 4, y: flag.y + 4 };
    const p = plats.find(q => q.step === done && done > 0);
    return p ? topOf(p) : { ...start };
  };

  // ----- the periodic table that shows where this round's elements live -----
  function buildTable() {
    const g = $('peak-grid'); g.innerHTML = '';
    for (const e of elements) {
      const c = document.createElement('div'); c.className = 'pt-cell'; c.dataset.sym = e.symbol; c.style.gridColumn = e.group; c.style.gridRow = e.period;
      c.setAttribute('title', `${e.name}, ${e.symbol}`); g.append(c);
    }
  }
  function paintTable() {
    const inRound = new Set(round ? round.symbols : []), col = round ? PROP_COL[round.prop] : 'transparent';
    for (const c of $('peak-grid').children) {
      const s = c.dataset.sym, now = plats.find(p => p.sym === s), got = now && now.step <= done && now.step > 0 && !now.missed, past = seen.has(s);
      c.dataset.state = got ? 'got' : now && now.missed ? 'missed' : inRound.has(s) ? 'in' : past ? 'past' : 'empty';
      c.textContent = inRound.has(s) || past ? s : ''; c.style.setProperty('--c', inRound.has(s) || past ? col : 'transparent');
    }
  }

  // ----- levels and rounds -----
  function startLevel(levelId) {
    level = levels.find(l => l.id === levelId); ri = 0; hearts = 3; coins = 0; xp = 0; climbed = 0; seen.clear(); parts = []; rings = [];
    buildTable(); renderHearts(); resize();
    says($('peak-says'), { text: level.tip });
    $('trend-chain').textContent = 'Finish a climb to fill in the trend card.'; $('trend-rule').textContent = '';
    startRound();
    if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  function startRound(rng = Math.random) {
    round = level.rounds[ri]; order = orderOf(round, values); mistakes = 0; done = 0; flagUp = false; anim = null; mood = 'wait'; phase = 'play'; phaseT = 0;
    const n = round.symbols.length; let slots;
    do { slots = round.symbols.map((s, i) => [rng(), s]).sort((a, b) => a[0] - b[0]).map(x => x[1]); } while (slots.every((s, i) => s === order[i]) || slots[0] === order[0] && n > 3 && rng() < 0.7);
    plats = slots.map((sym, i) => ({ sym, fx: 0.2 + 0.62 * (n === 1 ? 0 : i / (n - 1)), fy: HEIGHTS[i % HEIGHTS.length], x: 0, y: 0, step: 0, crumble: -9, shake: 0, missed: false }));
    for (const p of plats) p.want = order.indexOf(p.sym) + 1;   // the step this platform is worth (shown only when done or missed)
    place(); stand = { ...start };
    timeLeft = round.time || 0;
    $('peak-timer').hidden = !round.time; renderStatus(); paintTable();
  }
  const renderHearts = () => { $('peak-hearts').innerHTML = [0, 1, 2].map(i => `<span class="${i < hearts ? '' : 'gone'}">${i < hearts ? '♥' : '♡'}</span>`).join(''); $('peak-hearts').setAttribute('aria-label', `${hearts} of 3 hearts`); };
  function renderStatus() {
    $('peak-coins').textContent = coins;
    $('peak-meta').textContent = `${level.boss ? 'Boss' : 'Level ' + level.id}: ${level.title} · Climb ${ri + 1} of ${level.rounds.length}`;
    $('peak-prompt').textContent = promptFor(round);
    $('peak-ends').textContent = `${titleFor(round)} · tap the ${PROPS[round.prop].ends[round.dir === 'asc' ? 0 : 1]} first`;
    $('peak-count').textContent = `${done} of ${order.length} steps`;
    $('peak-progress').firstElementChild.style.transform = `scaleX(${done / order.length})`; $('peak-progress').setAttribute('aria-valuenow', Math.round(100 * done / order.length));
    buildKeys();
  }
  function tickTimer() {
    if (!round.time) return;
    const f = Math.max(0, timeLeft / round.time), bar = $('peak-timer');
    bar.firstElementChild.style.transform = `scaleX(${f})`; bar.dataset.low = String(f < 0.25); bar.setAttribute('aria-valuenow', Math.round(f * 100));
  }
  // buttons for keyboards and screen readers: one per platform (the canvas is for pointers)
  function buildKeys() {
    const k = $('peak-keys'); k.innerHTML = '';
    for (const p of plats) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'peak-key'; b.textContent = p.sym; b.disabled = p.step > 0 || phase !== 'play';
      b.setAttribute('aria-label', `${byS[p.sym].name}, ${p.sym}`); b.onclick = () => choose(p); k.append(b);
    }
  }
  function burst(x, y, col, n = 16) { for (let i = 0; i < n; i++) { const a = (i / n) * 6.283 + Math.random(), sp = 60 + Math.random() * 140; parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0, max: 0.5 + Math.random() * 0.5, r: 2.2 + Math.random() * 3.5, col }); } }

  // ----- hopping -----
  function hopTo(x, y, dur, then, hgt = 0.3) { anim = { x0: stand.x, y0: stand.y, x1: x, y1: y, t0: t, dur, h: Math.max(26, H * hgt), then }; mood = 'wait'; }
  const topOf = p => ({ x: p.x, y: p.y - ph * 0.45 });
  function tap(x, y) {
    if (phase === 'between' && phaseT > 0.9) { nextRound(); return; }
    if (phase !== 'play') return;
    sound.unlock();
    let best = null, bd = Infinity;
    for (const p of plats) {
      const dx = Math.abs(p.x - x) / (pw / 2 + 10), dy = Math.abs(p.y - y) / (ph + sc * 22);
      const d = Math.max(dx, dy); if (d <= 1 && d < bd) { bd = d; best = p; }
    }
    if (!best) { rings.push({ x, y, t0: t }); return; }
    choose(best);
  }
  function choose(p) {
    if (phase !== 'play' || p.step > 0) return;
    sound.unlock();
    const top = topOf(p);
    if (judge(order, done, p.sym)) {
      done++; p.step = done; coins += COINS_PER_STEP; xp += XP_PER_STEP; seen.add(p.sym); phase = 'hop'; sound.pop();
      hopTo(top.x, top.y, 0.42, () => {
        burst(top.x, top.y, '212,255,58', 12); sound.correct(); renderStatus(); paintTable();
        const el = byS[p.sym];
        says($('peak-says'), { text: `${el.name[0].toUpperCase()}${el.name.slice(1)}, ${p.sym}: group ${el.group}, period ${el.period}.`, state: 'correct', status: `✓ Step ${done}!` });
        if (done >= order.length) summit(); else { phase = 'play'; mood = 'wait'; buildKeys(); }
      });
      buildKeys();
    } else {
      const prevStand = { ...stand }, expected = order[done]; hearts--; mistakes++; phase = 'hop'; renderHearts(); sound.wrong();
      hopTo(top.x, top.y, 0.34, () => {
        p.crumble = t; p.shake = 0.7; burst(top.x, top.y + 4, '252,90,90', 12); mood = 'angry';
        says($('peak-says'), { text: wrongText(round, p.sym, expected, byS), state: 'wrong', status: '✗ The ledge crumbles! −1 heart.' });
        hopTo(prevStand.x, prevStand.y, 0.4, () => {
          mood = 'wait';
          if (hearts <= 0) { phase = 'over'; mood = 'angry'; setTimeout(() => finish(false), 1500); } else { phase = 'play'; buildKeys(); }
        }, 0.2);
      }, 0.25);
      buildKeys();
    }
  }
  function summit() {
    phase = 'hop';
    hopTo(flag.x - 4, flag.y + 4, 0.7, () => {
      flagUp = true; mood = 'happy'; if (mistakes === 0) coins += ROUND_BONUS; renderStatus();
      burst(flag.x, flag.y, '255,230,109', 26); burst(flag.x, flag.y, '212,255,58', 14); sound.correct();
      climbed++;
      const fact = factText(round, order, byS);
      says($('peak-says'), { text: fact, state: 'correct', status: mistakes === 0 ? '✓ Summit! +5 bonus.' : '✓ Summit!' });
      $('trend-chain').textContent = `${titleFor(round)}: ${order.join(' → ')}`; $('trend-rule').textContent = ruleFor(round);
      phase = 'between'; phaseT = 0;
    }, 0.4);
  }
  function timeUp() {
    hearts--; renderHearts(); sound.wrong(); phase = 'between'; phaseT = 0; anim = null;
    for (const p of plats) if (p.step === 0) { p.missed = true; p.step = -1; }
    paintTable();
    says($('peak-says'), { text: `${factText(round, order, byS)} The climb order is shown on the ledges.`, state: 'wrong', status: '✗ Time’s up! −1 heart.' });
    if (hearts <= 0) { phase = 'over'; setTimeout(() => finish(false), 2000); }
  }
  function nextRound() {
    ri++;
    if (ri >= level.rounds.length) { phase = 'over'; finish(true); return; }
    startRound();
  }
  function finish(win) {
    phase = 'over';
    onFinish({
      win, hearts, coins, xp, levelId: level.id,
      title: win ? 'You reached the summit!' : hearts <= 0 ? 'Out of hearts' : 'Level over',
      summary: win ? `You climbed all ${level.rounds.length} trends, and earned ${coins} coins and ${xp} XP.`
        : 'You ran out of hearts. Try again: down a group atoms get bigger and hold their outer electrons less tightly; across a period it is the other way round.',
    });
  }
  function hint() {
    if (phase !== 'play') return;
    sound.select();
    says($('peak-says'), { text: `${ruleFor(round)} Look at the table: where is each element, in its group (column) and period (row)?` });
  }

  // ----- drawing -----
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2b1a63'); g.addColorStop(0.5, '#6a3fa8'); g.addColorStop(0.85, '#f08fb0'); g.addColorStop(1, '#ffc58a'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 26; i++) { const sx = (i * 137.5) % W, sy = ((i * 61) % (H * 0.45)), tw = 0.5 + 0.5 * Math.sin(t * 2 + i); ctx.globalAlpha = 0.25 + 0.6 * tw; ctx.fillRect(sx, sy, 2, 2); } ctx.globalAlpha = 1;
    for (const c of clouds) { const x = ((c.x + t * c.v) % (W + 120)) - 60; ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.ellipse(x, c.y, 34 * c.s, 9 * c.s, 0, 0, 7); ctx.ellipse(x + 18 * c.s, c.y - 6 * c.s, 22 * c.s, 8 * c.s, 0, 0, 7); ctx.fill(); }
    const range = (base, amp, col, snow, seed) => {
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H);
      const pts = []; for (let i = 0; i <= 6; i++) { const x = W * i / 6, y = H * base - amp * (0.4 + 0.6 * Math.abs(Math.sin(i * 1.7 + seed))); pts.push([x, y]); ctx.lineTo(x, y); }
      ctx.lineTo(W, H); ctx.fill();
      if (snow) { ctx.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 1; i < pts.length - 1; i++) { const [x, y] = pts[i]; if (pts[i - 1][1] > y && pts[i + 1][1] > y) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - W * 0.04, y + H * 0.05); ctx.lineTo(x - W * 0.01, y + H * 0.04); ctx.lineTo(x + W * 0.012, y + H * 0.055); ctx.lineTo(x + W * 0.04, y + H * 0.05); ctx.fill(); } } }
    };
    range(0.66, H * 0.3, '#5b3a8f', true, 0.3); range(0.8, H * 0.2, '#3f2a73', true, 1.9); range(0.95, H * 0.1, '#2a1b57', false, 3.1);
  }
  function drawLedge(x, y, w, h, col, glow) {
    if (glow) { ctx.save(); ctx.shadowColor = glow; ctx.shadowBlur = 14; ctx.fillStyle = col; ctx.fillRect(x - w / 2, y - h / 2, w, h); ctx.restore(); }
    ctx.fillStyle = '#4a3a5c'; ctx.beginPath(); ctx.moveTo(x - w / 2, y - h * 0.5); ctx.lineTo(x + w / 2, y - h * 0.5); ctx.lineTo(x + w * 0.4, y + h * 0.85); ctx.lineTo(x - w * 0.36, y + h * 0.7); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h * 0.5, w, h * 0.62, 4); ctx.fill();
    ctx.strokeStyle = '#231f20'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h * 0.5, w, h * 0.62, 4); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x - w / 2 + 4, y - h * 0.5 + 2, w - 8, 3);
  }
  function drawPlat(p) {
    let off = 0, a = 1, sx = 0;
    const age = t - p.crumble;
    if (age >= 0 && age < 1.2) { sx = Math.sin(t * 70) * 3 * Math.max(0, 0.6 - age); if (age > 0.5) { off = (age - 0.5) * (age - 0.5) * 400; a = Math.max(0, 1 - (age - 0.5) / 0.7); } }
    else if (age >= 1.2 && age < 1.6) { a = (age - 1.2) / 0.4; }
    ctx.save(); ctx.globalAlpha = a;
    const x = p.x + sx, y = p.y + off, cracked = age >= 0 && age < 1.2;
    const col = p.step > 0 ? '#d4ff3a' : p.missed ? '#ffd27a' : cracked ? '#ff8a8a' : '#e9dfff';
    drawLedge(x, y, pw, ph, col, p.step > 0 ? 'rgba(212,255,58,.8)' : null);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const fs = Math.round(clamp(Math.min(pw * 0.36, ph * 0.62), 12, 34));
    ctx.font = `800 ${fs}px "League Spartan", sans-serif`; ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = '#231f20'; ctx.strokeText(p.sym, x, y + ph * 0.36); ctx.fillStyle = '#fff'; ctx.fillText(p.sym, x, y + ph * 0.36);
    if (p.step > 0 || p.missed) {
      const num = p.step > 0 ? p.step : p.want, r = clamp(pw * 0.17, 8, 14);
      ctx.fillStyle = p.step > 0 ? '#231f20' : '#a3361f'; ctx.beginPath(); ctx.arc(x + pw / 2 - 2, y - ph * 0.5 - 4, r, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(r * 1.2)}px "League Spartan", sans-serif`; ctx.fillText(String(num), x + pw / 2 - 2, y - ph * 0.5 - 3);
    }
    ctx.restore();
  }
  function drawFlag() {
    const x = flag.x, y = flag.y, up = flagUp ? 1 : 0.55;
    drawLedge(x, y + 16, pw * 0.7, ph * 0.9, '#fff', flagUp ? 'rgba(255,230,109,.9)' : null);
    ctx.strokeStyle = '#231f20'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y + 10); ctx.lineTo(x, y - 34 * sc * 0.6); ctx.stroke();
    const w = Math.sin(t * 5) * 3; ctx.fillStyle = flagUp ? '#d4ff3a' : '#ffe66d'; ctx.strokeStyle = '#231f20'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y - 34 * sc * 0.6); ctx.lineTo(x - 26 * sc * 0.6 * up, y - 26 * sc * 0.6 + w); ctx.lineTo(x, y - 18 * sc * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  function avatarPos() {
    if (!anim) return stand;
    const f = clamp((t - anim.t0) / anim.dur, 0, 1), e = f;
    return { x: anim.x0 + (anim.x1 - anim.x0) * e, y: anim.y0 + (anim.y1 - anim.y0) * e - 4 * anim.h * f * (1 - f) };
  }
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now; t += dt;
    if (anim && t - anim.t0 >= anim.dur) { stand = { x: anim.x1, y: anim.y1 }; const cb = anim.then; anim = null; if (cb) cb(); }
    if (phase === 'play' && round.time) { timeLeft -= dt; tickTimer(); if (timeLeft <= 0) { timeLeft = 0; tickTimer(); timeUp(); } }
    else if (phase === 'between') { phaseT += dt; if (phaseT > 7) nextRound(); }
    for (const p of plats) p.shake = Math.max(0, p.shake - dt);
    for (const q of parts) { q.life += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 240 * dt; } parts = parts.filter(q => q.life < q.max);
    rings = rings.filter(r => t - r.t0 < 0.45);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    drawBackground();
    drawLedge(start.x, start.y, pw * 0.9, ph, '#cdbff0', null);
    drawFlag();
    for (const p of plats) drawPlat(p);
    // the player, standing on (or hopping between) the ledges
    const ap = avatarPos(), ah = 44 * sc;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(ap.x, anim ? stand.y + 2 : ap.y + 2, 14 * sc, 4 * sc, 0, 0, 7); ctx.fill();
    drawAvatar(ctx, getAvatar(), ap.x - 16 * sc, ap.y - ah + 4, sc, { mood: phase === 'over' ? 'angry' : mood });
    for (const rg of rings) { const a = 1 - (t - rg.t0) / 0.45; ctx.strokeStyle = `rgba(255,255,255,${0.7 * a})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(rg.x, rg.y, 6 + (1 - a) * 26, 0, 7); ctx.stroke(); }
    for (const q of parts) { const a = 1 - q.life / q.max; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(${q.col},${a})`; ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (0.4 + a), 0, 7); ctx.fill(); ctx.restore(); }
    if (phase === 'between') { ctx.textAlign = 'center'; ctx.font = `800 ${Math.round(clamp(W / 26, 11, 17))}px "League Spartan", sans-serif`; ctx.fillStyle = 'rgba(255,255,255,.9)'; if (phaseT > 0.9) ctx.fillText('Tap to continue', W / 2, H - 10); }
    raf = requestAnimationFrame(frame);
  }

  // ----- input and controls -----
  cv.addEventListener('pointerdown', e => { const r = cv.getBoundingClientRect(); tap((e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height)); e.preventDefault(); });
  $('peak-hint').onclick = hint;
  document.querySelector('#screen-peaks .ticket').addEventListener('click', hint);
  $('peak-quit').onclick = () => { stop(); onExit(); };
  function stop() { running = false; cancelAnimationFrame(raf); phase = 'over'; }
  // Test hook (only reachable with ?test in the address): where the platforms are and what the right order is.
  const debug = {
    snapshot: () => ({ W, H, phase, round: ri, hearts, done, timeLeft, order: [...order], plats: plats.map(p => ({ symbol: p.sym, x: p.x, y: p.y, step: p.step })) }),
    drain: sec => { timeLeft = Math.max(0.05, timeLeft - sec); },
  };
  return { start: startLevel, stop, debug };
}
