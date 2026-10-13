// World 8 — Thermo Track: a three-lane runner. Grab the right energy changes, dodge the wrong ones, run through the
// right answer gate, and jump or slide past barriers. Play with keys, swipes, or your whole body through the webcam.
// Rules are in runner-logic.js; content in data/energy.json; the camera in body.js.
import { buildCourse, judgeChange, judgeGate, hits, createPoseReader, JUMP_TIME, SLIDE_TIME } from './runner-logic.js';
import { avatarBackCanvas, WIDTH, HEIGHT } from './avatar.js';
import { pxCanvas, crisp, shapes, shade, tint } from './pxart.js';
import * as SC from './scenery.js';
import { createBodyCam } from './body.js';

const VW = 320, VH = 240, SA = 3;                    // view size in art units; backing pixels per unit (the same 3x art as the map)
const HORIZON = 84, FEET = 224, F = 14, LW = 64;     // horizon line, player's feet, perspective strength, lane width at the player
const ZMAX = 120, BASE_SPEED = 17;
const proj = z => F / (F + Math.max(-F * 0.6, z));
const gy = z => HORIZON + (FEET - HORIZON) * proj(z);
const gx = (lane, z) => VW / 2 + lane * LW * proj(z);
const KEY = { ArrowLeft: 'L', a: 'L', A: 'L', ArrowRight: 'R', d: 'R', D: 'R', ArrowUp: 'J', w: 'J', W: 'J', ' ': 'J', ArrowDown: 'S', s: 'S', S: 'S' };

function text(c, str, x, y, size, col, weight = 800, align = 'center', font = '"League Spartan", sans-serif') {
  c.font = `${weight} ${size}px ${font}`; c.textAlign = align; c.textBaseline = 'middle'; c.fillStyle = col; c.fillText(str, x, y);
}
function wrap(c, str, maxW, size) {
  c.font = `800 ${size}px "League Spartan", sans-serif`;
  const words = str.split(' '), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}

export function createRunner({ $, data, getAvatar, says, sound, onFinish, onExit }) {
  const cv = $('run-canvas'), ctx = cv.getContext('2d');
  cv.width = VW * SA; cv.height = VH * SA;

  // ---------- static backdrop: dusk sky, a volcano on the hot side, snowy peaks on the cold side ----------
  const sky = (() => {
    const b = pxCanvas(VW * SA, HORIZON * SA + 6), c = b.getContext('2d'); c.scale(SA, SA);
    const { P, E } = shapes(c);
    const g = c.createLinearGradient(0, 0, 0, HORIZON); g.addColorStop(0, '#1b4f8f'); g.addColorStop(0.55, '#3f8fc8'); g.addColorStop(1, '#ffc58a'); c.fillStyle = g; c.fillRect(0, 0, VW, HORIZON + 2);
    const sun = c.createRadialGradient(160, HORIZON - 6, 2, 160, HORIZON - 6, 70); sun.addColorStop(0, 'rgba(255,240,170,.95)'); sun.addColorStop(0.2, 'rgba(255,210,130,.5)'); sun.addColorStop(1, 'rgba(255,180,120,0)'); c.fillStyle = sun; c.fillRect(60, 0, 200, HORIZON + 2);
    [[40, 22, 1.1], [250, 16, 0.9], [120, 30, 0.7]].forEach(([x, y, k]) => { [[0, 0, 14, 6], [-10, 3, 9, 5], [10, 3, 10, 5]].forEach(([dx, dy, rx, ry]) => E(x + dx * k, y + dy * k, rx * k, ry * k, 'rgba(255,255,255,.85)', false)); });
    // hot side: a volcano with a lava glow; cold side: snowy peaks and ice
    P([[-10, HORIZON + 2], [30, HORIZON - 40], [52, HORIZON - 40], [104, HORIZON + 2]], '#7a4a34'); P([[41, HORIZON - 40], [52, HORIZON - 40], [104, HORIZON + 2], [62, HORIZON + 2]], '#5a3424', false);
    E(41, HORIZON - 40, 11, 3, '#ff8a2e', false); P([[38, HORIZON - 39], [41, HORIZON - 39], [32, HORIZON - 16], [30, HORIZON - 22]], '#ff7a2e', false);
    P([[200, HORIZON + 2], [240, HORIZON - 44], [270, HORIZON - 18], [292, HORIZON - 36], [340, HORIZON + 2]], '#8aa6c4'); P([[240, HORIZON - 44], [270, HORIZON - 18], [256, HORIZON + 2], [236, HORIZON + 2]], '#6d88a8', false);
    P([[240, HORIZON - 44], [231, HORIZON - 30], [238, HORIZON - 33], [244, HORIZON - 28], [250, HORIZON - 34]], '#f4fbff', false); P([[292, HORIZON - 36], [284, HORIZON - 26], [292, HORIZON - 28], [300, HORIZON - 24]], '#f4fbff', false);
    P([[-10, HORIZON + 2], [60, HORIZON - 10], [130, HORIZON + 2]], '#3d7a5a', false); P([[180, HORIZON + 2], [260, HORIZON - 8], [330, HORIZON + 2]], '#4f86a8', false);
    crisp(b, null);
    return b;
  })();
  const sideSprites = { hot: [SC.palm(), SC.roundTree(SC.TREES.autumn), SC.rocks('#8a6a55')], cold: [SC.pine(true), SC.crystalS(), SC.crystalS(['#e8fbff', '#8fd3ff'])] };

  // ---------- state ----------
  let level = null, course = [], hearts = 3, coins = 0, xp = 0, right = 0, asked = 0, over = false, running = false, raf = 0, last = 0, t = 0;
  let state = 'ready', count = 0, dist = 0, speed = BASE_SPEED, slowUntil = 0, hurtUntil = 0, flash = 0, toast = null;
  let lane = 0, laneX = 0, jumpT = -1, slideT = -1, finishZ = 1;
  let props = [], parts = [];
  const reader = createPoseReader();
  let usingBody = false;

  const cam = createBodyCam({
    video: $('run-video'), preview: $('run-preview'),
    onFrame: lm => {
      if (!usingBody) return;
      const r = reader.read(lm);
      if (!reader.calibrated) { $('run-camstat').textContent = lm ? `Stand still in the middle… ${Math.round(reader.progress * 100)}%` : 'Step back until your shoulders and hips are in the picture.'; return; }
      if (!r) { $('run-camstat').textContent = 'I can’t see you: step back into the picture.'; return; }
      $('run-camstat').textContent = 'Lean or step left and right · jump · squat';
      if (r.lane !== lane) setLane(r.lane);
      if (r.jump) { if (state === 'ready') begin(); else jump(); }
      if (r.slide) slide();
    },
    onStatus: (s, msg) => {
      $('run-camstat').textContent = msg;
      $('run-cam').textContent = s === 'on' ? 'Camera off' : 'Use my body (camera)';
      $('run-cam').setAttribute('aria-pressed', String(s === 'on'));
      $('run-camwrap').dataset.state = s;
      usingBody = s === 'on'; if (s === 'on') reader.reset();
    },
  });

  // ---------- level ----------
  function start(levelId) {
    level = data.levels.find(l => l.id === levelId);
    course = buildCourse(level, data).map(o => ({ ...o }));
    finishZ = course[course.length - 1].z;
    hearts = 3; coins = 0; xp = 0; right = 0; asked = 0; over = false; state = 'ready'; count = 0; dist = 0;
    speed = BASE_SPEED * (level.speed || 1); lane = 0; laneX = 0; jumpT = slideT = -1; toast = null; parts = []; flash = 0; hurtUntil = 0;
    props = []; for (let z = 4; z < ZMAX; z += 9) addProps(z);
    renderHUD(); progress(); shown = null;
    $('run-meta').textContent = `${level.boss ? 'Boss' : 'Level ' + level.id}: ${level.title} · ${level.subtitle}`;
    $('run-rule').innerHTML = level.collect ? (level.collect === 'exo' ? 'Grab <b class="hot">EXOTHERMIC</b> changes (give out heat).<br>Dodge <b class="cold">ENDOTHERMIC</b> ones (take in heat).' : 'Grab <b class="cold">ENDOTHERMIC</b> changes (ΔH positive).<br>Dodge <b class="hot">EXOTHERMIC</b> ones (ΔH negative).') : 'Run through the gate with the right answer.';
    $('run-now').innerHTML = '';
    says($('run-says'), { text: level.tip });
    $('run-start').hidden = false;
    if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  function addProps(z) { for (const side of [-1, 1]) props.push({ z: z + Math.random() * 4, side, s: (side < 0 ? sideSprites.hot : sideSprites.cold)[Math.floor(Math.random() * 3)], off: 2.3 + Math.random() * 1.4 }); }
  function begin() { if (state !== 'ready' || over) return; state = 'count'; count = 3; $('run-start').hidden = true; sound.unlock(); sound.select(); }
  const renderHUD = () => { $('run-hearts').innerHTML = [0, 1, 2].map(i => `<span class="${i < hearts ? '' : 'gone'}">${i < hearts ? '♥' : '♡'}</span>`).join(''); $('run-hearts').setAttribute('aria-label', `${hearts} of 3 hearts`); $('run-coins').textContent = coins; };
  const progress = () => { const f = Math.min(1, dist / finishZ); $('run-progress').firstElementChild.style.transform = `scaleX(${f})`; $('run-progress').setAttribute('aria-valuenow', Math.round(f * 100)); };

  // ---------- moves ----------
  function setLane(l) { if (over || state === 'done') return; const n = Math.max(-1, Math.min(1, l)); if (n !== lane) { lane = n; sound.tick(); } }
  const step = d => setLane(lane + d);
  function jump() { if (state !== 'run' || jumpT >= 0) return; jumpT = 0; slideT = -1; sound.pop(); }
  function slide() { if (state !== 'run' || slideT >= 0) return; slideT = 0; jumpT = -1; sound.select(); }
  const airborne = () => jumpT >= 0 && jumpT < JUMP_TIME * 0.92;
  const sliding = () => slideT >= 0 && slideT < SLIDE_TIME;

  function hurt(msg, status) {
    hearts--; renderHUD(); flash = 0.4; hurtUntil = t + 1.1; slowUntil = t + 1.2; sound.wrong();
    says($('run-says'), { text: msg, state: 'wrong', status });
    if (hearts <= 0) { state = 'done'; setTimeout(() => finish(false), 1200); }
  }
  function judge(o) {                                       // the thing has reached the player
    if (o.kind === 'coin') { if (o.lane === lane) { o.got = true; coins++; renderHUD(); sound.tick(); burst(gx(lane, 0), FEET - 20, '#d4ff3a', 5); } return; }
    if (o.kind === 'obstacle') { if (t > hurtUntil && hits(o, { lane, airborne: airborne(), sliding: sliding() })) hurt(o.type === 'low' ? 'Jump over the low barriers: jump, press ↑ or swipe up.' : o.type === 'high' ? 'Slide under the high bars: squat, press ↓ or swipe down.' : 'Change lanes to get past the blocks: lean, press ← → or swipe sideways.', '✗ Ouch! −1 heart.'); return; }
    if (o.kind === 'change') {
      const r = judgeChange(o, level.collect);
      if (o.lane === lane) {
        o.got = true;
        if (r.good) { right++; coins += 5; xp += 6; renderHUD(); sound.correct(); burst(gx(lane, 0), FEET - 40, o.exo ? '#ff9a3c' : '#8fd3ff', 14); showToast(r.text, true); says($('run-says'), { text: o.why, state: 'correct', status: `✓ ${o.label}: ${r.kind}! +5 coins.` }); }
        else hurt(o.why, `✗ ${o.label} is ${r.kind}. −1 heart.`);
      } else if (r.good) says($('run-says'), { text: o.why, status: `You missed ${o.label}: it was ${r.kind}.` });
      return;
    }
    if (o.kind === 'gate') {
      asked++; const r = judgeGate(o, lane);
      if (r.ok) { right++; coins += 8; xp += 8; renderHUD(); sound.correct(); burst(gx(lane, 0), FEET - 50, '#d4ff3a', 18); showToast(`✓ ${r.right}`, true); says($('run-says'), { text: o.why, state: 'correct', status: `✓ Correct: ${r.right}! +8 coins.` }); }
      else hurt(o.why, `✗ Not “${r.chosen}”. The answer is “${r.right}”. −1 heart.`);
      return;
    }
    if (o.kind === 'finish') { state = 'done'; sound.correct(); setTimeout(() => finish(true), 900); }
  }
  function showToast(str, good) { toast = { str, good, t }; }
  const burst = (x, y, col, n) => { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, sp = 30 + Math.random() * 60; parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0, max: 0.7, col }); } };

  function finish(win) {
    if (over) return; over = true;
    const total = course.filter(o => o.kind === 'gate').length + course.filter(o => o.kind === 'change' && judgeChange(o, level.collect).good).length;
    onFinish({
      win, hearts, coins, xp: xp + (win ? 20 : 0), levelId: level.id,
      title: win ? 'Run complete!' : 'Out of hearts',
      summary: win ? `You made it to the finish with ${right} of ${total} energy answers right, and earned ${coins} coins.`
        : 'You ran out of hearts. Exothermic changes give out heat (ΔH negative); endothermic changes take it in (ΔH positive). Try again!',
    });
  }

  // ---------- the side card: what is coming up ----------
  let shown = null;
  function upcoming() {
    const next = course.find(o => !o.done && (o.kind === 'change' || o.kind === 'gate') && o.z < 70);
    if (next === shown) return; shown = next;
    if (!next) { $('run-now').innerHTML = ''; return; }
    if (next.kind === 'gate') $('run-now').innerHTML = `<p class="run-q">${next.q}</p><div class="run-opts">${[-1, 0, 1].map(l => `<span><small>${['Left', 'Middle', 'Right'][l + 1]}</small>${next.options[next.order[l + 1]]}</span>`).join('')}</div>`;
    else $('run-now').innerHTML = `<p class="run-q">Coming up: <b>${next.label}</b></p><p class="run-hintline">${['Left', 'Middle', 'Right'][next.lane + 1]} lane · ${level.collect === 'exo' ? 'Exothermic? Grab it!' : 'Endothermic? Grab it!'}</p>`;
  }

  // ---------- drawing ----------
  const signCache = {};
  function signSprite(label, kind) {                         // a crisp label board for an energy change or a gate option
    const key = kind + label; if (signCache[key]) return signCache[key];
    const m = pxCanvas(4, 4).getContext('2d'), size = 11, lines = wrap(m, label, 70, size);
    m.font = `800 ${size}px "League Spartan", sans-serif`;
    const w = Math.max(...lines.map(l => m.measureText(l).width)) + 12, h = lines.length * 12 + 8;
    const b = pxCanvas(Math.ceil(w + 4) * SA, (h + 4) * SA), c = b.getContext('2d'); c.scale(SA, SA);
    c.fillStyle = kind === 'gate' ? '#fffdf2' : '#ffffff'; c.beginPath(); c.roundRect(2, 2, w, h, 5); c.fill();
    c.fillStyle = kind === 'gate' ? '#d4ff3a' : '#5eead4'; c.fillRect(2, h - 1, w, 3);
    lines.forEach((l, i) => text(c, l, 2 + w / 2, 2 + 9 + i * 12, size, '#14202e'));
    crisp(b, '#14202e', 110, 2); b.lw = w + 4; b.lh = h + 4;
    return (signCache[key] = b);
  }
  let orbSprite = null;
  const orb = () => (orbSprite ??= (() => { const b = pxCanvas(24 * SA, 24 * SA), c = b.getContext('2d'); c.scale(SA, SA); const g = c.createRadialGradient(9, 8, 1, 12, 12, 11); g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, '#d4ff3a'); g.addColorStop(1, '#6f9a00'); c.fillStyle = g; c.beginPath(); c.arc(12, 12, 10, 0, 7); c.fill(); text(c, '?', 12, 12.6, 13, '#14202e'); crisp(b, '#14202e', 110, 2); return b; })());

  function drawGround() {
    // side ground in bands that slide towards you
    for (let z = ZMAX; z > -4; z -= 4) {
      const z0 = z - ((dist % 8) / 2) * 2, y0 = gy(z0), y1 = gy(z0 - 4), band = Math.floor((z0 + dist) / 4) % 2 === 0;
      ctx.fillStyle = band ? '#5cb85f' : '#52ab56'; ctx.fillRect(0, y0, VW / 2, y1 - y0 + 1);
      ctx.fillStyle = band ? '#a9d8ef' : '#9bcde8'; ctx.fillRect(VW / 2, y0, VW / 2, y1 - y0 + 1);
    }
    // track bed
    const edge = 1.6, P = (pts, col) => { ctx.fillStyle = col; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); };
    P([[gx(-edge, ZMAX), gy(ZMAX)], [gx(edge, ZMAX), gy(ZMAX)], [gx(edge, -6), gy(-6)], [gx(-edge, -6), gy(-6)]], '#7f8a9a');
    P([[gx(-edge, ZMAX), gy(ZMAX)], [gx(-edge - 0.12, ZMAX), gy(ZMAX)], [gx(-edge - 0.12, -6), gy(-6)], [gx(-edge, -6), gy(-6)]], '#ff8a3c');
    P([[gx(edge, ZMAX), gy(ZMAX)], [gx(edge + 0.12, ZMAX), gy(ZMAX)], [gx(edge + 0.12, -6), gy(-6)], [gx(edge, -6), gy(-6)]], '#8fd3ff');
    // sleepers and rails for each lane
    for (let z = Math.ceil(dist / 3) * 3 - dist + ZMAX - (ZMAX % 3); z > -6; z -= 3) {
      if (z > ZMAX) continue;
      for (const l of [-1, 0, 1]) { const y = gy(z), h = Math.max(0.6, 2.2 * proj(z)); ctx.fillStyle = '#6b4a30'; ctx.fillRect(gx(l - 0.4, z), y - h / 2, (gx(l + 0.4, z) - gx(l - 0.4, z)), h); }
    }
    ctx.strokeStyle = '#d7e2ee'; ctx.lineWidth = 1.2;
    for (const l of [-1, 0, 1]) for (const s of [-0.28, 0.28]) { ctx.beginPath(); ctx.moveTo(gx(l + s, ZMAX), gy(ZMAX)); ctx.lineTo(gx(l + s, -6), gy(-6)); ctx.stroke(); }
    // haze at the horizon
    const hz = ctx.createLinearGradient(0, HORIZON, 0, HORIZON + 16); hz.addColorStop(0, 'rgba(255,214,170,.85)'); hz.addColorStop(1, 'rgba(255,214,170,0)'); ctx.fillStyle = hz; ctx.fillRect(0, HORIZON, VW, 16);
  }
  function drawObstacle(o) {
    const s = proj(o.z), y = gy(o.z), lanes = o.lane === 'all' ? [-1, 0, 1] : [o.lane];
    const x0 = gx(lanes[0] - 0.46, o.z), x1 = gx(lanes[lanes.length - 1] + 0.46, o.z), w = x1 - x0;
    ctx.lineWidth = Math.max(0.6, 1.4 * s); ctx.strokeStyle = '#14202e';
    if (o.type === 'low') {
      const h = 16 * s; ctx.fillStyle = '#ffffff'; ctx.fillRect(x0, y - h, w, h * 0.55); ctx.strokeRect(x0, y - h, w, h * 0.55);
      ctx.fillStyle = '#fc4a4a'; for (let k = 0; k < w; k += 10 * s) ctx.fillRect(x0 + k, y - h, 5 * s, h * 0.55);
      ctx.fillStyle = '#3a4a64'; ctx.fillRect(x0 + 2 * s, y - h * 0.45, 3 * s, h * 0.45); ctx.fillRect(x1 - 5 * s, y - h * 0.45, 3 * s, h * 0.45);
    } else if (o.type === 'high') {
      const top = 54 * s, bar = 9 * s; ctx.fillStyle = '#3a4a64'; ctx.fillRect(x0, y - top, 3 * s, top); ctx.fillRect(x1 - 3 * s, y - top, 3 * s, top);
      ctx.fillStyle = '#ffd23a'; ctx.fillRect(x0, y - top, w, bar); ctx.strokeRect(x0, y - top, w, bar);
      ctx.fillStyle = '#14202e'; for (let k = 0; k < w; k += 10 * s) ctx.fillRect(x0 + k, y - top, 5 * s, bar);
    } else {
      for (const l of lanes) {
        const a = gx(l - 0.42, o.z), b = gx(l + 0.42, o.z), h = 46 * s;
        ctx.fillStyle = '#c98a4b'; ctx.fillRect(a, y - h, b - a, h); ctx.strokeRect(a, y - h, b - a, h);
        ctx.fillStyle = '#a76a33'; ctx.fillRect(a, y - h, b - a, 4 * s); ctx.strokeStyle = '#7a4a22'; ctx.beginPath(); ctx.moveTo(a, y - h); ctx.lineTo(b, y); ctx.moveTo(b, y - h); ctx.lineTo(a, y); ctx.stroke(); ctx.strokeStyle = '#14202e';
        text(ctx, '!', (a + b) / 2, y - h * 0.55, Math.max(4, 18 * s), '#fff2a8');
      }
    }
  }
  function drawChange(o) {
    const s = proj(o.z), x = gx(o.lane, o.z), y = gy(o.z) - 20 * s + Math.sin(t * 4 + o.z) * 2 * s;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x, gy(o.z), 10 * s, 3 * s, 0, 0, 7); ctx.fill();
    ctx.drawImage(orb(), x - 12 * s, y - 12 * s, 24 * s, 24 * s);
    const sg = signSprite(o.label, 'change'), k = Math.max(0.42, s * 1.15);
    ctx.drawImage(sg, x - (sg.lw * k) / 2, y - 14 * s - sg.lh * k, sg.lw * k, sg.lh * k);
  }
  function drawGate(o) {
    const s = proj(o.z), y = gy(o.z), x0 = gx(-1.55, o.z), x1 = gx(1.55, o.z), top = y - 74 * s;
    ctx.fillStyle = '#0d7f74'; ctx.fillRect(x0, top, 5 * s, y - top); ctx.fillRect(x1 - 5 * s, top, 5 * s, y - top);
    ctx.fillStyle = '#0a2236'; ctx.fillRect(x0, top - 8 * s, x1 - x0, 10 * s);
    for (const l of [-1, 0, 1]) {
      const sg = signSprite(o.options[o.order[l + 1]], 'gate'), k = Math.max(0.3, s * 1.05), cx = gx(l, o.z);
      ctx.drawImage(sg, cx - (sg.lw * k) / 2, top + 4 * s, sg.lw * k, sg.lh * k);
    }
    ctx.globalAlpha = 0.18; ctx.fillStyle = '#d4ff3a'; ctx.fillRect(x0, top + 2 * s, x1 - x0, y - top - 2 * s); ctx.globalAlpha = 1;
  }
  function drawProp(p) {
    const s = proj(p.z), x = gx(p.side * p.off, p.z), y = gy(p.z), k = s * 1.5;
    ctx.drawImage(p.s, x - (p.s.lw * k) / 2, y - p.s.lh * k, p.s.lw * k, p.s.lh * k);
  }
  function drawPlayer() {
    const x = VW / 2 + laneX * LW, jh = jumpT >= 0 ? Math.sin(Math.min(1, jumpT / JUMP_TIME) * Math.PI) * 34 : 0;
    const pose = sliding() ? 'slide' : jumpT >= 0 ? 'jump' : 'run', stepF = state === 'run' ? Math.floor(t * 9) % 2 : 0;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, FEET + 1, 13 - jh * 0.15, 3.6, 0, 0, 7); ctx.fill();
    if (t < hurtUntil && Math.floor(t * 16) % 2) return;
    const sc = 1.3, w = WIDTH * sc, h = HEIGHT * sc, bob = state === 'run' && pose === 'run' ? -Math.abs(Math.sin(t * 9)) * 2 : 0;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(avatarBackCanvas(getAvatar(), stepF, pose), x - w / 2, FEET - h + 4 - jh + bob, w, h);
  }
  function draw() {
    ctx.setTransform(SA, 0, 0, SA, 0, 0); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sky, 0, 0, VW, HORIZON + 2);
    drawGround();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    const things = [...props.map(p => ({ z: p.z, d: () => drawProp(p) })), ...course.filter(o => !o.done && !o.got && o.z < ZMAX && o.z > -5 && o.kind !== 'finish').map(o => ({ z: o.z, d: () => (o.kind === 'obstacle' ? drawObstacle(o) : o.kind === 'gate' ? drawGate(o) : o.kind === 'coin' ? drawCoin(o) : drawChange(o)) }))];
    const fin = course[course.length - 1];
    if (fin.z < ZMAX) things.push({ z: fin.z, d: () => drawFinish(fin) });
    things.sort((a, b) => b.z - a.z).forEach(o => { if (o.z > 0.5) o.d(); });
    drawPlayer();
    things.filter(o => o.z <= 0.5).forEach(o => o.d());
    for (const q of parts) { ctx.globalAlpha = 1 - q.life / q.max; ctx.fillStyle = q.col; ctx.fillRect(q.x - 1.5, q.y - 1.5, 3, 3); } ctx.globalAlpha = 1;
    // speed lines
    if (state === 'run') { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; for (let i = 0; i < 6; i++) { const a = (i * 53 + t * 260) % 120, side = i % 2 ? 1 : -1; ctx.beginPath(); ctx.moveTo(VW / 2 + side * (60 + a), HORIZON + 40 + i * 12 + a * 0.4); ctx.lineTo(VW / 2 + side * (72 + a * 1.3), HORIZON + 44 + i * 12 + a * 0.55); ctx.stroke(); } }
    // messages on the track
    if (state === 'ready') banner(usingBody && !reader.calibrated ? 'Stand still in the middle…' : usingBody ? 'Jump to start!' : 'Press Start, Space or ↑', '');
    if (state === 'count') banner(String(Math.ceil(count)), '');
    const gate = state === 'run' && course.find(o => o.kind === 'gate' && !o.done && o.z < 80);
    if (gate) { ctx.fillStyle = 'rgba(6,13,27,.72)'; ctx.fillRect(0, 0, VW, 20); text(ctx, gate.q, VW / 2, 10.5, 11, '#ffffff'); }
    if (toast && t - toast.t < 1.6) { const a = Math.min(1, (1.6 - (t - toast.t)) * 3); ctx.globalAlpha = a; pill(toast.str, VW / 2, gate ? 34 : 22, toast.good ? '#d4ff3a' : '#fc7a7a'); ctx.globalAlpha = 1; }
    if (flash > 0) { ctx.globalAlpha = Math.min(0.35, flash); ctx.fillStyle = '#fc7a7a'; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
  }
  function drawCoin(o) { const s = proj(o.z), x = gx(o.lane, o.z), y = gy(o.z) - 10 * s, r = 5 * s, sq = Math.abs(Math.cos(t * 5 + o.z)); ctx.fillStyle = '#14202e'; ctx.beginPath(); ctx.ellipse(x, y, (r + 1) * Math.max(0.25, sq), r + 1, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#d4ff3a'; ctx.beginPath(); ctx.ellipse(x, y, r * Math.max(0.2, sq), r, 0, 0, 7); ctx.fill(); }
  function drawFinish(o) { const s = proj(o.z), y = gy(o.z), x0 = gx(-1.6, o.z), x1 = gx(1.6, o.z), top = y - 70 * s; ctx.fillStyle = '#ffffff'; ctx.fillRect(x0, top, 4 * s, y - top); ctx.fillRect(x1 - 4 * s, top, 4 * s, y - top); const n = 12, cw = (x1 - x0) / n; for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? '#14202e' : '#ffffff'; ctx.fillRect(x0 + i * cw, top + j * 6 * s, cw, 6 * s); } text(ctx, 'FINISH', (x0 + x1) / 2, top + 20 * s, Math.max(4, 16 * s), '#d4ff3a'); }
  function pill(str, x, y, col) { ctx.font = '800 11px "League Spartan", sans-serif'; const w = Math.min(VW - 16, ctx.measureText(str).width + 18); ctx.fillStyle = col; ctx.strokeStyle = '#14202e'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 9, w, 18, 9); ctx.fill(); ctx.stroke(); text(ctx, str, x, y + 0.5, 11, '#0a1628'); }
  function banner(big, small) { ctx.fillStyle = 'rgba(6,13,27,.55)'; ctx.fillRect(0, 96, VW, 46); text(ctx, big, VW / 2, 119, big.length < 3 ? 30 : 18, '#d4ff3a'); if (small) text(ctx, small, VW / 2, 136, 9, '#e3eef8', 400); }

  // ---------- loop ----------
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    laneX += (lane - laneX) * Math.min(1, dt * 14);
    if (state === 'count') { count -= dt; if (count <= 0) { state = 'run'; sound.correct(); } }
    if (state === 'run') {
      const v = speed * (t < slowUntil ? 0.55 : 1) * (1 + Math.min(0.35, dist / 2400));
      const dz = v * dt; dist += dz; progress();
      for (const o of course) { if (o.done) continue; const before = o.z; o.z -= dz; if (before > 0 && o.z <= 0) { o.done = true; judge(o); } }
      for (const p of props) p.z -= dz;
      props = props.filter(p => p.z > -6); while (props.length < 26) addProps(ZMAX - Math.random() * 4);
      if (jumpT >= 0) { jumpT += dt; if (jumpT > JUMP_TIME) jumpT = -1; }
      if (slideT >= 0) { slideT += dt; if (slideT > SLIDE_TIME) slideT = -1; }
      upcoming();
    }
    for (const q of parts) { q.life += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 120 * dt; } parts = parts.filter(q => q.life < q.max);
    if (flash > 0) flash -= dt;
    draw();
    raf = requestAnimationFrame(frame);
  }

  // ---------- controls ----------
  addEventListener('keydown', e => {
    if ($('screen-runner').hidden || !running || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
    const k = KEY[e.key]; if (!k) return; e.preventDefault();
    if (state === 'ready' && (k === 'J')) { begin(); return; }
    if (k === 'L') step(-1); else if (k === 'R') step(1); else if (k === 'J') jump(); else slide();
  });
  let sw = null;
  cv.addEventListener('pointerdown', e => { sw = { x: e.clientX, y: e.clientY, done: false }; cv.setPointerCapture(e.pointerId); e.preventDefault(); sound.unlock(); });
  cv.addEventListener('pointermove', e => {
    if (!sw || sw.done) return; const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return; sw.done = true;
    if (state === 'ready') { begin(); return; }
    if (Math.abs(dx) > Math.abs(dy)) step(dx > 0 ? 1 : -1); else if (dy < 0) jump(); else slide();
  });
  cv.addEventListener('pointerup', () => { if (sw && !sw.done && state === 'ready') begin(); sw = null; });
  $('run-start').onclick = begin;
  $('run-cam').onclick = async () => { sound.unlock(); if (cam.on) cam.stop(); else await cam.start(); };
  $('run-recal').onclick = () => { reader.reset(); sound.pop(); $('run-camstat').textContent = 'Stand still in the middle…'; };
  $('run-quit').onclick = () => { stop(); onExit(); };
  function stop() { running = false; cancelAnimationFrame(raf); if (cam.on) cam.stop(); }
  const debug = { get state() { return state; }, get lane() { return lane; }, get course() { return course; }, get dist() { return dist; }, setLane, jump, slide, begin, skip(z) { for (const o of course) o.z -= z; } };
  return { start, stop, debug };
}
