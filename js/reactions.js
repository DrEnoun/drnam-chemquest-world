// World 7 — Reaction Volcano: walk round a pixel island, collect reactant molecules and mix them in the cauldron.
// The number of each molecule in your bag is its coefficient. Rules are in reaction-logic.js; quests in data/reactions.json.
import { checkMix, atomsOf, atomList, pretty, coeffStr, limiting, parseIsland, spawnTiles, questTokens, scatter } from './reaction-logic.js';
import { drawAvatar, randomAvatar, avatarCanvas, WIDTH, HEIGHT } from './avatar.js';
import { pxCanvas, crisp, shapes, shade, tint } from './pxart.js';
import * as SC from './scenery.js';
import { monsterSprite } from './monsters.js';

const TL = 16, SA = 3;                         // map units per tile; backing pixels per map unit (same 3x art as the world map)
const OUT = '#0a2236';
const AV = 0.62;                               // avatar scale on the island
const SPEED = 74;                              // map units per second
const MONSTER_OF = { H2O: 'water', CO2: 'co2', NH3: 'nh3', CH4: 'ch4', O2: 'o2', NaCl: 'nacl' };
const KEYS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0] };
const hash = (a, b = 0) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// the fact without the equation it starts with (the equation is already on screen)
const factOnly = f => f.replace(/^[^.]*→[^.]*\.\s*/, '');
const subHTML = f => f.replace(/(\d+)/g, '<sub>$1</sub>');
const fHTML = f => `<span class="rx-f">${subHTML(f)}</span>`;

// Token colours: single atoms coral, two-atom elements teal, compounds lilac.
const kindOf = f => (/^[A-Z][a-z]?$/.test(f) ? 'atom' : /^([A-Z][a-z]?)2$/.test(f) ? 'element' : 'compound');
const TOKEN = { atom: ['#fc7a7a', '#ffd0d0', '#8f2f3a'], element: ['#2dd4bf', '#c6fff5', '#0b5f5a'], compound: ['#b79cff', '#ece4ff', '#4b2f96'] };

// Formula with real subscripts on a canvas: digits sit lower and smaller.
function chem(c, text, cx, y, size, colour) {
  const small = size * 0.7, parts = [...text].map(ch => ({ ch, sub: /\d/.test(ch) }));
  c.textBaseline = 'middle'; c.fillStyle = colour; c.textAlign = 'left';
  const font = p => `800 ${p.sub ? small : size}px "League Spartan", sans-serif`;
  const width = parts.reduce((w, p) => { c.font = font(p); return w + c.measureText(p.ch).width; }, 0);
  let x = cx - width / 2;
  for (const p of parts) { c.font = font(p); c.fillText(p.ch, x, y + (p.sub ? size * 0.22 : 0)); x += c.measureText(p.ch).width; }
  return width;
}

export function createReactions({ $, data, getAvatar, says, sound, onFinish, onExit }) {
  const cv = $('rx-canvas'), ctx = cv.getContext('2d');
  const island = parseIsland(data.island), MW = island.w * TL, MH = island.h * TL;
  cv.width = MW * SA; cv.height = MH * SA;
  const tiles = spawnTiles(island);
  const at = (x, y) => (x < 0 || y < 0 || x >= island.w || y >= island.h ? '~' : island.rows[y][x]);
  const isLand = ch => ch !== '~';

  // ---------- static art: water, then the land (sand, grass, lava, cliffs) crisped into pixels with an outline ----------
  const art = (() => {
    const water = pxCanvas(MW * SA, MH * SA), w = water.getContext('2d'); w.scale(SA, SA);
    let g = w.createLinearGradient(0, 0, 0, MH); g.addColorStop(0, '#1a8fc0'); g.addColorStop(0.5, '#0f86ad'); g.addColorStop(1, '#0a5a8c'); w.fillStyle = g; w.fillRect(0, 0, MW, MH);
    for (let y = 0; y < island.h; y++) for (let x = 0; x < island.w; x++) if (isLand(at(x, y))) {   // turquoise shallows round the island
      const r = w.createRadialGradient(x * TL + 8, y * TL + 10, 4, x * TL + 8, y * TL + 10, 30); r.addColorStop(0, 'rgba(70,240,214,.30)'); r.addColorStop(1, 'rgba(45,212,191,0)'); w.fillStyle = r; w.fillRect(x * TL - 24, y * TL - 22, 64, 64);
    }
    const land = pxCanvas(MW * SA, MH * SA), c = land.getContext('2d'); c.scale(SA, SA);
    const { R, E } = shapes(c);
    // cliff faces where the land drops into the sea
    for (let y = 0; y < island.h; y++) for (let x = 0; x < island.w; x++) if (isLand(at(x, y)) && !isLand(at(x, y + 1))) {
      const cg = c.createLinearGradient(0, y * TL + 12, 0, y * TL + 25); cg.addColorStop(0, '#9a6b45'); cg.addColorStop(1, '#5c3a24');
      c.fillStyle = cg; c.beginPath(); c.roundRect(x * TL - 1, y * TL + 8, TL + 2, 16, 4); c.fill();
      c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x * TL + 3 + hash(x, y) * 8, y * TL + 17, 1.2, 5);
    }
    for (let y = 0; y < island.h; y++) for (let x = 0; x < island.w; x++) if (isLand(at(x, y))) R(x * TL - 3, y * TL - 3, TL + 6, TL + 6, 8, '#f0d49a', false);
    for (let y = 0; y < island.h; y++) for (let x = 0; x < island.w; x++) {         // speckled sand
      if (at(x, y) !== 's') continue;
      for (let k = 0; k < 4; k++) { c.fillStyle = k % 2 ? 'rgba(160,110,50,.35)' : 'rgba(255,255,255,.5)'; c.fillRect(x * TL + hash(x * 7 + k, y) * 14, y * TL + hash(x, y * 5 + k) * 14, 1.2, 1.2); }
    }
    const grass = (x, y) => !['~', 's'].includes(at(x, y));
    for (let y = 0; y < island.h; y++) for (let x = 0; x < island.w; x++) if (grass(x, y)) R(x * TL - 1.5, y * TL - 1.5, TL + 3, TL + 3, 5, '#58bd5f', false);
    for (let y = 0; y < island.h; y++) for (let x = 0; x < island.w; x++) if (grass(x, y)) {
      if (hash(x, y) < 0.45) E(x * TL + 4 + hash(x, y + 9) * 8, y * TL + 5 + hash(x + 3, y) * 6, 6, 3, '#6fce6c', false);
      if (hash(x + 5, y) < 0.35) { c.fillStyle = ['#ffffff', '#ffe27a', '#ff9bb0', '#bde0ff'][Math.floor(hash(x, y + 2) * 4)]; c.fillRect(x * TL + 3 + hash(x, y + 1) * 10, y * TL + 3 + hash(x + 1, y) * 10, 1.6, 1.6); }
      if (hash(x + 9, y) < 0.5) { c.strokeStyle = '#3f9e55'; c.lineWidth = 0.9; const gx = x * TL + hash(x, y + 4) * 14, gy = y * TL + 8 + hash(x + 2, y) * 6; c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx - 1, gy - 3); c.moveTo(gx + 2, gy); c.lineTo(gx + 3, gy - 3); c.stroke(); }
    }
    // a trodden path from the start to the cauldron
    c.strokeStyle = 'rgba(214,180,110,.75)'; c.lineWidth = 5; c.lineCap = 'round'; c.setLineDash([5, 4]);
    c.beginPath(); c.moveTo(island.start.x * TL + 8, island.start.y * TL + 8); c.quadraticCurveTo(island.start.x * TL - 20, island.cauldron.y * TL + 40, island.cauldron.x * TL + 8, island.cauldron.y * TL + 18); c.stroke(); c.setLineDash([]);
    // lava pool
    for (let y = 0; y < island.h; y++) for (let x = 0; x < island.w; x++) if (at(x, y) === 'L') R(x * TL - 1, y * TL - 1, TL + 2, TL + 2, 6, '#5c3424', false);
    for (let y = 0; y < island.h; y++) for (let x = 0; x < island.w; x++) if (at(x, y) === 'L') {     // one molten pool, not separate squares
      const l = at(x - 1, y) === 'L' ? 0 : 1.5, r = at(x + 1, y) === 'L' ? 0 : 1.5, u = at(x, y - 1) === 'L' ? 0 : 1.5, d = at(x, y + 1) === 'L' ? 0 : 1.5;
      R(x * TL + l, y * TL + u, TL - l - r, TL - u - d, Math.min(5, (l + r + u + d) * 1.6), '#ff7a2e', false);
    }
    for (let y = 0; y < island.h; y++) for (let x = 0; x < island.w; x++) if (at(x, y) === 'L') { E(x * TL + 8, y * TL + 7, 4.5, 2.4, '#ffb03a', false); E(x * TL + 6, y * TL + 6, 2, 1, '#ffe066', false); }
    crisp(land, OUT, 110, 2);
    return { water, land };
  })();

  // ---------- sprites standing on the island (drawn in depth order with the player) ----------
  const props = [];
  const firstV = (() => { for (let y = 0; y < island.h; y++) { const x = island.rows[y].indexOf('V'); if (x >= 0) return { x, y }; } return null; })();
  const palm = SC.palm(), tree = SC.roundTree(SC.TREES.teal), bush = SC.bush(['#2f9a8a', '#52d1b8']), rocks = SC.rocks(), volcano = SC.volcano(), pot = SC.cauldron();
  for (let y = 0; y < island.h; y++) for (let x = 0; x < island.w; x++) {
    const ch = at(x, y), bx = x * TL + 8, by = y * TL + 14;
    if (ch === 'T') props.push({ s: hash(x, y) < 0.5 ? palm : tree, x: bx, y: by });
    if (ch === 'B') props.push({ s: bush, x: bx, y: by });
    if (ch === 'R') props.push({ s: rocks, x: bx, y: by });
  }
  if (firstV) props.push({ s: volcano, x: (firstV.x + 1) * TL, y: (firstV.y + 2) * TL + 2, big: true });
  const potAt = { x: island.cauldron.x * TL + 8, y: island.cauldron.y * TL + 14 };
  props.push({ s: pot, x: potAt.x, y: potAt.y, pot: true });
  const npcAt = { x: island.npc.x * TL + 8, y: island.npc.y * TL + 14 };

  // ---------- state ----------
  let level = null, qi = 0, quest = null, hearts = 3, coins = 0, xp = 0, over = false, running = false, raf = 0, last = 0, t = 0;
  let me = { x: 0, y: 0, face: 1, moving: false }, target = null, keys = new Set(), stick = null, pad = { x: 0, y: 0 };
  let tokens = [], bag = {}, phase = 'collect', npc = null, fx = [], pops = [], flash = 0, hintUntil = 0, stuckT = 0;
  const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rc = () => quest.coeffs.slice(0, quest.reactants.length), pc = () => quest.coeffs.slice(quest.reactants.length);
  const near = () => Math.hypot(me.x - potAt.x, me.y - potAt.y) < 28;

  // ---------- quests ----------
  function start(levelId) {
    level = data.levels.find(l => l.id === levelId);
    hearts = 3; coins = 0; xp = 0; over = false; qi = 0;
    renderHearts();
    startQuest();
    says($('rx-says'), { text: level.tip });
    if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  function startQuest() {
    quest = level.quests[qi]; bag = {}; phase = 'collect'; pops = []; fx = []; target = null; hintUntil = 0;
    me = { x: island.start.x * TL + 8, y: island.start.y * TL + 12, face: -1, moving: false };
    tokens = scatter(questTokens(quest), tiles).map((p, i) => ({ f: p.f, x: p.x * TL + 8, y: p.y * TL + 10, ph: hash(i, qi) * 6.28, lock: false }));
    npc = { opts: randomAvatar(Math.random), mood: 'wait' };
    $('rx-meta').textContent = `Level ${level.id}: ${level.title} · Quest ${qi + 1} of ${level.quests.length}`;
    $('rx-goal').innerHTML = `“${quest.ask}”<br><b class="rx-goal-eq">${quest.reactants.map(f => subHTML(f)).join(' + ')} → ${quest.products.map(f => subHTML(f)).join(' + ')}</b>`;
    $('rx-next').hidden = true; $('rx-choices').hidden = true; $('rx-choices').innerHTML = '';
    if (qi > 0) says($('rx-says'), { text: level.limiting ? 'Collect every molecule, then mix them all.' : 'New quest! Collect the reactants and bring them to the cauldron.' });
    renderPanel();
  }
  const renderHearts = () => { $('rx-hearts').innerHTML = [0, 1, 2].map(i => `<span class="${i < hearts ? '' : 'gone'}">${i < hearts ? '♥' : '♡'}</span>`).join(''); $('rx-hearts').setAttribute('aria-label', `${hearts} of 3 hearts`); $('rx-coins').textContent = coins; };

  function renderPanel(made = null, used = null) {
    const r = quest.reactants, box = n => `<span class="rx-co${n == null ? ' is-q' : ''}">${n == null ? '?' : n}</span>`;
    const term = (n, f) => `<span class="rx-term">${box(n)}${fHTML(f)}</span>`, plus = '<span class="rx-plus">+</span>';
    $('rx-eq').innerHTML = `${r.map((f, i) => term(used ? used[i] : bag[f] || 0, f)).join(plus)}<span class="rx-arrow">→</span>${quest.products.map((f, j) => term(made ? made[j] : null, f)).join(plus)}`;
    const inside = used ? Object.fromEntries(r.map((f, i) => [f, used[i]])) : Object.fromEntries(Object.entries(bag).filter(([f]) => r.includes(f)));
    const left = atomsOf(inside);
    if (made) {
      const right = atomsOf(Object.fromEntries(quest.products.map((f, j) => [f, made[j]])));
      const key = o => JSON.stringify(Object.entries(o).sort()), same = key(left) === key(right);
      $('rx-atoms').innerHTML = `Reactant side: <b>${atomList(left) || '–'}</b><br>Product side: <b>${atomList(right) || '–'}</b> ${same ? '✓' : '✗'}`;
    } else $('rx-atoms').innerHTML = Object.keys(left).length ? `Atoms in: <b>${atomList(left)}</b>` : 'Walk over molecules to collect them.';
    const items = Object.entries(bag).filter(([, n]) => n > 0);
    $('rx-bag').innerHTML = items.length ? '' : '<p class="rx-empty">Empty</p>';
    for (const [f, n] of items) {
      const b = document.createElement('button'); b.type = 'button'; b.className = `rx-item rx-item--${kindOf(f)}`;
      b.innerHTML = `${fHTML(f)}<span>×${n}</span>`; b.setAttribute('aria-label', `${n} ${pretty(f)} in your bag. Tap to drop one.`);
      b.onclick = () => drop(f); b.disabled = phase !== 'collect';
      $('rx-bag').append(b);
    }
    const left2 = tokens.filter(k => !k.gone && !k.left).length;
    $('rx-left').textContent = level.limiting && phase === 'collect' ? `${left2} molecule${left2 === 1 ? '' : 's'} still on the island` : '';
    updateMix();
  }
  function updateMix() {
    $('rx-mix').disabled = phase !== 'collect' || !near();
    $('rx-mix').textContent = phase !== 'collect' ? 'Mixed!' : near() ? 'Mix!' : 'Walk to the cauldron';
  }

  function collect(k) {
    k.gone = true; bag[k.f] = (bag[k.f] || 0) + 1; sound.pop();
    burst(k.x, k.y - 6, TOKEN[kindOf(k.f)][0]); pops.push({ f: k.f, x: k.x, y: k.y, t: 0 });
    renderPanel();
  }
  function drop(f) {
    if (phase !== 'collect' || !(bag[f] > 0)) return;
    bag[f]--; sound.select();
    tokens.push({ f, x: me.x + me.face * 10, y: me.y - 2, ph: Math.random() * 6, lock: true });   // lands beside you; walk away before it can be picked up again
    renderPanel();
  }

  function mix() {
    if (phase !== 'collect' || over) return;
    if (!near()) { says($('rx-says'), { text: 'Walk to the cauldron first, then press Mix.' }); return; }
    sound.unlock();
    if (level.limiting) return mixAll();
    const res = checkMix(quest, bag);
    if (res.ok) {
      phase = 'made'; npc.mood = 'happy'; coins += 8; xp += 10; renderHearts();
      sound.correct(); bubbleUp(res.products);
      says($('rx-says'), { text: res.message, state: 'correct', status: '✓ Balanced! +8 coins.', fact: level.askType ? '' : factOnly(quest.fact) });
      renderPanel(res.products);
      if (level.askType) askType(); else { $('rx-next').hidden = false; $('rx-next').focus(); }
    } else if (res.kind === 'empty' || res.kind === 'notSmallest' || res.kind === 'missing') {
      sound.select(); says($('rx-says'), { text: res.message, state: res.kind === 'notSmallest' ? 'wrong' : '', status: res.kind === 'notSmallest' ? 'Almost!' : '' });
    } else {
      hearts--; flash = 0.35; renderHearts(); sound.wrong(); spit();
      says($('rx-says'), { text: res.message, state: 'wrong', status: '✗ Try again. −1 heart.' });
      if (res.kind === 'unbalanced') renderPanel(res.products);
      if (hearts <= 0) setTimeout(() => finish(false), 1400);
    }
  }
  // Limiting reactant: mix everything, then say which reactant ran out.
  function mixAll() {
    const remaining = tokens.filter(k => !k.gone).length;
    if (remaining) { sound.select(); says($('rx-says'), { text: `Collect every molecule first: ${remaining} still on the island.` }); return; }
    const L = limiting(quest.reactants, rc(), bag), made = pc().map(n => n * L.extent);
    phase = 'made'; npc.mood = 'happy'; sound.correct(); bubbleUp(made);
    for (const [f, n] of Object.entries(L.leftover)) for (let i = 0; i < n; i++) tokens.push({ f, x: potAt.x - 22 - i * 12, y: potAt.y + 10, ph: i, lock: true, left: true });
    renderPanel(made, rc().map(n => n * L.extent));
    $('rx-atoms').innerHTML += `<br>Left over (did not react): <b>${Object.entries(L.leftover).map(([f, n]) => `${n} ${subHTML(f)}`).join(', ')}</b>`;
    says($('rx-says'), { text: `${quest.reactants.map((f, i) => `${rc()[i] * L.extent} ${pretty(f)}`).join(' and ')} reacted to make ${quest.products.map((f, j) => `${made[j]} ${pretty(f)}`).join(' and ')}. Something is left over. Which reactant ran out first?`, status: 'Reaction done!' });
    choices(quest.reactants.map(pretty), pretty(L.limiting[0]), 'The limiting reactant');
  }
  function askType() { choices(data.types, quest.type, 'What type of reaction is this?'); }
  function choices(options, answer, label) {
    const host = $('rx-choices'); host.innerHTML = `<p class="rx-q">${label}</p>`; host.hidden = false;
    for (const o of options) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'chip rx-choice'; b.textContent = o;
      b.onclick = () => {
        if (o === answer) {
          host.querySelectorAll('button').forEach(x => { x.disabled = true; }); b.dataset.state = 'correct';
          coins += 6; xp += 8; renderHearts(); sound.correct();
          says($('rx-says'), { text: quest.fact, state: 'correct', status: `✓ Correct: ${answer}! +6 coins.` });
          $('rx-next').hidden = false; $('rx-next').focus();
        } else {
          b.disabled = true; b.dataset.state = 'wrong'; hearts--; flash = 0.35; renderHearts(); sound.wrong();
          says($('rx-says'), { text: quest.hint, state: 'wrong', status: `✗ Not ${o}. −1 heart.` });
          if (hearts <= 0) setTimeout(() => finish(false), 1400);
        }
      };
      host.append(b);
    }
  }
  function next() {
    sound.select();
    if (qi + 1 >= level.quests.length) return finish(true);
    qi++; startQuest();
  }
  function hint() { if (over) return; hintUntil = t + 5; sound.select(); says($('rx-says'), { text: quest.hint }); }
  function finish(win) {
    if (over) return; over = true;
    onFinish({
      win, hearts, coins, xp, levelId: level.id,
      title: win ? 'Island quests complete!' : 'Out of hearts',
      summary: win ? `You finished ${level.quests.length} reactions and earned ${coins} coins and ${xp} XP.`
        : 'You ran out of hearts. Try again: count the atoms of each element on both sides. Every atom that goes in must come out.',
    });
  }

  // ---------- effects ----------
  const burst = (x, y, col, n = 12) => { for (let i = 0; i < n; i++) { const a = (i / n) * 6.283 + Math.random(), sp = 20 + Math.random() * 30; fx.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 16, life: 0, max: 0.6 + Math.random() * 0.4, col }); } };
  function bubbleUp(made) {
    quest.products.forEach((f, j) => { for (let i = 0; i < made[j]; i++) pops.push({ f, x: potAt.x, y: potAt.y - 10, t: -i * 0.25 - j * 0.12, out: true, k: pops.length, tx: npcAt.x + 18 + ((pops.length % 3) - 1) * 13, ty: npcAt.y + 8 + Math.floor(pops.length / 3) * 12 }); });
    burst(potAt.x, potAt.y - 12, '#d4ff3a', 20);
  }
  const spit = () => { burst(potAt.x, potAt.y - 12, '#fc7a7a', 16); };

  // ---------- movement ----------
  const blocked = (x, y) => [[-4, -3], [4, -3], [-4, 1], [4, 1]].some(([dx, dy]) => island.solid(Math.floor((x + dx) / TL), Math.floor((y + dy) / TL)));
  function move(dt) {
    let vx = 0, vy = 0;
    for (const k of keys) { vx += KEYS[k][0]; vy += KEYS[k][1]; }
    vx += pad.x; vy += pad.y;
    if (stick && stick.on) { vx = stick.dx; vy = stick.dy; target = null; }
    if (vx || vy) target = null;
    else if (target) { vx = target.x - me.x; vy = target.y - me.y; if (Math.hypot(vx, vy) < 2) { target = null; vx = vy = 0; } }
    const len = Math.hypot(vx, vy);
    me.moving = len > 0.01;
    if (!me.moving) return;
    const k = Math.min(1, len) * SPEED * dt / len, ox = me.x, oy = me.y;
    if (!blocked(me.x + vx * k, me.y)) me.x += vx * k;
    if (!blocked(me.x, me.y + vy * k)) me.y += vy * k;
    if (Math.abs(vx) > 0.15) me.face = vx > 0 ? 1 : -1;
    if (target && Math.hypot(me.x - ox, me.y - oy) < 0.05) { stuckT += dt; if (stuckT > 0.25) { target = null; stuckT = 0; } } else stuckT = 0;
    $('screen-reactions').classList.add('played');
  }
  function pickups() {
    if (phase !== 'collect') return;
    for (const k of tokens) {
      if (k.gone || k.left) continue;
      const d = Math.hypot(k.x - me.x, k.y - 2 - me.y);
      if (k.lock) { if (d > 18) k.lock = false; continue; }
      if (d < 11) collect(k);
    }
  }

  // ---------- drawing ----------
  const glowCache = {};
  const glowAt = (x, y, r, rgb, a) => {
    const s = glowCache[rgb] ??= (() => { const g = pxCanvas(64, 64), c = g.getContext('2d'), gr = c.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.4, `rgba(${rgb},.4)`); gr.addColorStop(1, `rgba(${rgb},0)`); c.fillStyle = gr; c.fillRect(0, 0, 64, 64); return g; })();
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.max(0, Math.min(1, a)); ctx.drawImage(s, x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  };
  const tokenCache = {};
  function tokenSprite(f) {                  // a glossy molecule bubble with its formula, crisped like the rest of the art
    if (tokenCache[f]) return tokenCache[f];
    const [col, hi, ink] = TOKEN[kindOf(f)], m = pxCanvas(10, 10).getContext('2d');
    m.font = '800 9px "League Spartan", sans-serif'; const tw = m.measureText(f.replace(/\d/g, '')).width + f.replace(/\D/g, '').length * 4.2;
    const w = Math.max(18, tw + 9), h = 15, cvs = pxCanvas(Math.ceil(w + 4) * SA, (h + 4) * SA), c = cvs.getContext('2d'); c.scale(SA, SA);
    const g = c.createLinearGradient(0, 2, 0, h + 2); g.addColorStop(0, tint(col, 0.35)); g.addColorStop(1, shade(col, 0.12));
    c.fillStyle = g; c.beginPath(); c.roundRect(2, 2, w, h, 7.5); c.fill();
    c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(2 + w * 0.32, 5.2, w * 0.2, 1.6, 0, 0, 7); c.fill();
    chem(c, f, 2 + w / 2, 2 + h / 2 + 0.4, 9, ink);
    crisp(cvs, '#14202e', 110, 2);
    cvs.lw = w + 4; cvs.lh = h + 4;
    return (tokenCache[f] = cvs);
  }
  function drawToken(k, bob) {
    const s = tokenSprite(k.f), y = k.y - 10 + bob, hinted = t < hintUntil && quest.reactants.includes(k.f) && !k.left;
    ctx.fillStyle = 'rgba(2,14,32,.28)'; ctx.beginPath(); ctx.ellipse(k.x, k.y + 1, 7, 2.2, 0, 0, 7); ctx.fill();
    if (hinted) glowAt(k.x, y, 22, '212,255,58', 0.55 + 0.3 * Math.sin(t * 8));
    else glowAt(k.x, y, 14, '170,255,240', 0.22);
    ctx.globalAlpha = k.left ? 0.6 : 1;
    ctx.drawImage(s, k.x - s.lw / 2, y - s.lh / 2, s.lw, s.lh);
    ctx.globalAlpha = 1;
  }
  function drawPerson(opts, x, y, face, walking, extra) {
    const s = avatarCanvas(opts, extra), w = WIDTH * AV, h = HEIGHT * AV;
    const hop = walking ? -Math.abs(Math.sin(t * 13)) * 2 : Math.sin(t * 2.2) * 0.4;
    ctx.fillStyle = 'rgba(2,14,32,.3)'; ctx.beginPath(); ctx.ellipse(x, y + 1, 7, 2.3, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(x, y + hop); ctx.scale(face, 1); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(s, -w / 2, -h + 2, w, h); ctx.restore();
  }
  function draw() {
    ctx.setTransform(SA, 0, 0, SA, 0, 0); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(art.water, 0, 0, MW, MH);
    ctx.strokeStyle = 'rgba(160,230,255,.14)'; ctx.lineWidth = 1.2;
    for (let y = 8; y < MH; y += 18) { ctx.beginPath(); for (let x = 0; x <= MW; x += 8) { const yy = y + Math.sin(x * 0.08 + t * 1.3 + y) * 1.6; x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); } ctx.stroke(); }
    ctx.drawImage(art.land, 0, 0, MW, MH);
    for (let y = 0; y < island.h; y++) for (let x = 0; x < island.w; x++) if (at(x, y) === 'L') glowAt(x * TL + 8, y * TL + 8, 18, '255,140,40', 0.35 + 0.15 * Math.sin(t * 2 + x));
    // everything that stands up, sorted by its feet
    const things = [];
    props.forEach(p => things.push({ y: p.y, draw: () => {
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = 'rgba(8,40,36,.28)'; ctx.beginPath(); ctx.ellipse(p.x + 1, p.y - 0.5, p.s.lw * 0.4, Math.max(2.2, p.s.lw * 0.09), 0, 0, 7); ctx.fill();
      ctx.drawImage(p.s, p.x - p.s.lw / 2, p.y - p.s.lh, p.s.lw, p.s.lh);
      if (p.pot) glowAt(p.x, p.y - 20, near() && phase === 'collect' ? 26 : 16, '157,255,90', near() ? 0.7 + 0.2 * Math.sin(t * 5) : 0.35);
    } }));
    tokens.forEach(k => { if (!k.gone) things.push({ y: k.y, draw: () => drawToken(k, calm ? 0 : Math.sin(t * 2.6 + k.ph) * 1.5) }); });
    things.push({ y: npcAt.y, draw: () => drawPerson(npc.opts, npcAt.x, npcAt.y, -1, false, { customer: true, mood: npc.mood }) });
    things.push({ y: me.y, draw: () => drawPerson(getAvatar(), me.x, me.y, me.face, me.moving, { mood: phase === 'made' ? 'happy' : 'wait' }) });
    things.sort((a, b) => a.y - b.y).forEach(o => o.draw());
    ctx.imageSmoothingEnabled = true;
    // volcano smoke
    if (firstV && !calm) for (let i = 0; i < 5; i++) { const ph = (t * 0.35 + i / 5) % 1, x = (firstV.x + 1) * TL + Math.sin(ph * 6 + i) * 3 + ph * 8, y = firstV.y * TL - 34 - ph * 26; ctx.fillStyle = `rgba(238,240,248,${0.55 * (1 - ph)})`; ctx.beginPath(); ctx.arc(x, y, 2.4 + ph * 5, 0, 7); ctx.fill(); }
    if (firstV) glowAt((firstV.x + 1) * TL, firstV.y * TL - 22, 22, '255,150,60', 0.5 + 0.2 * Math.sin(t * 3));
    // quest bubble over the quest giver
    if (phase === 'collect') { const bx = npcAt.x, by = npcAt.y - 34 + Math.sin(t * 3) * 1.5; ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#14202e'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.roundRect(bx - 6, by - 7, 12, 12, 4); ctx.fill(); ctx.stroke(); chem(ctx, '!', bx, by - 1, 10, '#0d7f74'); }
    // collected molecules fly up into your bag; products bubble out of the cauldron to the quest giver
    for (const p of pops) {
      if (p.t < 0) continue;
      if (p.out) {
        const e = Math.min(1, p.t / 0.7), x = p.x + (p.tx - p.x) * e, y = p.y + (p.ty - p.y) * e - Math.sin(e * Math.PI) * 26;
        const mid = MONSTER_OF[p.f];
        if (mid) { const sp = monsterSprite(mid, 'cheer'); ctx.drawImage(sp, x - 12, y - 18 + (e >= 1 ? -Math.abs(Math.sin(t * 6 + p.k)) * 3 : 0), 24, 20); }
        else { const s = tokenSprite(p.f); ctx.drawImage(s, x - s.lw / 2, y - s.lh / 2, s.lw, s.lh); }
      } else if (p.t < 0.45) { const e = p.t / 0.45, s = tokenSprite(p.f); ctx.globalAlpha = 1 - e; ctx.drawImage(s, me.x - s.lw / 2, p.y - 14 - e * 18, s.lw, s.lh); ctx.globalAlpha = 1; }
    }
    for (const q of fx) { const a = 1 - q.life / q.max; ctx.fillStyle = q.col; ctx.globalAlpha = a; ctx.fillRect(q.x - 1.2, q.y - 1.2, 2.4, 2.4); ctx.globalAlpha = 1; }
    // "Mix here" sign over the cauldron when you are close with something in your bag
    if (near() && phase === 'collect' && Object.values(bag).some(Boolean)) {
      const y = potAt.y - 40 + Math.sin(t * 4) * 1.5; ctx.fillStyle = '#d4ff3a'; ctx.strokeStyle = '#14202e'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.roundRect(potAt.x - 17, y - 6, 34, 12, 4); ctx.fill(); ctx.stroke();
      ctx.font = '800 7.5px "League Spartan", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#0a1628'; ctx.fillText('MIX HERE', potAt.x, y + 0.5);
    }
    if (target) { ctx.strokeStyle = 'rgba(212,255,58,.8)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(target.x, target.y, 5 + Math.sin(t * 8), 2, 0, 0, 7); ctx.stroke(); }
    if (flash > 0) { ctx.globalAlpha = Math.min(0.35, flash); ctx.fillStyle = '#fc7a7a'; ctx.fillRect(0, 0, MW, MH); ctx.globalAlpha = 1; }
  }

  let wasNear = false;
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now; t += dt;
    if (!over) { move(dt); pickups(); }
    for (const p of pops) p.t += dt; pops = pops.filter(p => p.out || p.t < 0.5);
    for (const q of fx) { q.life += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 40 * dt; } fx = fx.filter(q => q.life < q.max);
    if (flash > 0) flash -= dt;
    const n = near(); if (n !== wasNear) { wasNear = n; if (quest) updateMix(); }
    draw();
    raf = requestAnimationFrame(frame);
  }

  // ---------- controls ----------
  addEventListener('keydown', e => {
    if ($('screen-reactions').hidden || !running || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest('button') && (e.key === 'Enter' || e.key === ' ')) return;   // let focused buttons work
    if (KEYS[e.key]) { keys.add(e.key); e.preventDefault(); }
    else if (e.key === ' ' || e.key === 'Enter' || e.key === 'e' || e.key === 'E') { if (near()) { mix(); e.preventDefault(); } }
    else if (e.key === 'h' || e.key === 'H') hint();
  });
  addEventListener('keyup', e => { keys.delete(e.key); });
  addEventListener('blur', () => keys.clear());
  // Drag on the island to steer like a joystick; a short tap walks you to that spot.
  const toMap = e => { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * MW, y: ((e.clientY - r.top) / r.height) * MH }; };
  cv.addEventListener('pointerdown', e => { sound.unlock(); cv.setPointerCapture(e.pointerId); stick = { x: e.clientX, y: e.clientY, on: false, dx: 0, dy: 0, id: e.pointerId }; e.preventDefault(); });
  cv.addEventListener('pointermove', e => {
    if (!stick || stick.id !== e.pointerId) return;
    const dx = e.clientX - stick.x, dy = e.clientY - stick.y, d = Math.hypot(dx, dy);
    if (d > 12) { stick.on = true; const m = Math.min(1, d / 40); stick.dx = (dx / d) * m; stick.dy = (dy / d) * m; }
  });
  const end = e => { if (!stick || stick.id !== e.pointerId) return; if (!stick.on) { const p = toMap(e); target = { x: p.x, y: p.y + 4 }; } stick = null; };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', () => { stick = null; });
  // on-screen arrows: hold to walk
  document.querySelectorAll('#screen-reactions [data-walk]').forEach(b => {
    const [x, y] = b.dataset.walk.split(',').map(Number);
    const on = e => { e.preventDefault(); pad = { x, y }; }, off = () => { pad = { x: 0, y: 0 }; };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
  });
  const screenEl = $('screen-reactions');
  try { screenEl.classList.toggle('show-pad', localStorage.getItem('drnam-quest:pad') === '1'); } catch (e) { /* ignore */ }
  $('rx-pad').onclick = () => { const on = screenEl.classList.toggle('show-pad'); try { localStorage.setItem('drnam-quest:pad', on ? '1' : '0'); } catch (e) { /* ignore */ } $('rx-pad').setAttribute('aria-pressed', String(on)); sound.pop(); };
  $('rx-pad').setAttribute('aria-pressed', String(screenEl.classList.contains('show-pad')));
  $('rx-mix').onclick = mix; $('rx-hint').onclick = hint; $('rx-next').onclick = next;
  $('rx-quit').onclick = () => { stop(); onExit(); };
  function stop() { running = false; cancelAnimationFrame(raf); keys.clear(); pad = { x: 0, y: 0 }; stick = null; }
  // for automated tests: jump straight to a spot, or read the state
  const debug = { get bag() { return bag; }, get tokens() { return tokens; }, get me() { return me; }, get phase() { return phase; }, teleport(x, y) { me.x = x; me.y = y; }, potAt, collectAll(f) { tokens.filter(k => !k.gone && (!f || k.f === f)).forEach(collect); } };
  return { start, stop, debug };
}
