// World 5 — Bond Glacier: build Lewis structures and name VSEPR shapes by dragging chips onto an ice board.
// The rules are in bond-logic.js; molecules and rounds in data/bonds.json.
// Input: drag a chip onto a slot, or tap a chip (it stays selected) and tap slots. Slots are also focusable buttons.
import { parseMolecule, evaluate, explain, lpSlots, shapeOf, shapeText, valenceTotal, valenceSum, SHAPES, SHAPE_IDS, COINS_PER_STEP, ROUND_BONUS, XP_PER_STEP } from './bond-logic.js';

const ATOM_COL = { H: '#ffffff', B: '#ffc6a0', C: '#aab4c0', N: '#8fb4ff', O: '#ff8a8a', F: '#9be58b', P: '#ffb86b', S: '#ffe66d', Cl: '#7ee3a0' };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const BOND_NAME = { 1: 'single bond', 2: 'double bond', 3: 'triple bond' };

export function createBonds({ $, levels, data, says, sound, onFinish, onExit }) {
  const mols = Object.fromEntries(Object.entries(data.molecules).map(([id, m]) => [id, parseMolecule(m)]));
  const V = data.valence, NAMES = data.names;
  const board = $('bond-board'), tray = $('bond-tray');
  let level = null, ri = 0, round = null, mol = null, key = null, orders = [], filled = new Set(), lps = [];
  let hearts = 3, coins = 0, xp = 0, mistakes = 0, timeLeft = 0, phase = 'idle', phaseT = 0, running = false, raf = 0, last = 0;
  let selected = null, wrongShapes = new Set(), builtOK = false, solved = false, vb = [0, 0, 200, 120];
  const hasShapeStep = () => level.kind === 'shape' || level.kind === 'boss';
  const hasBuildStep = () => level.kind !== 'shape';
  const ns = 'http://www.w3.org/2000/svg';

  // ----- levels and rounds -----
  function startLevel(levelId) {
    $('bond-next').hidden = true; level = levels.find(l => l.id === levelId); ri = 0; hearts = 3; coins = 0; xp = 0; renderHearts();
    says($('bond-says'), { text: level.tip });
    startRound();
    if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  function startRound() {
    round = level.rounds[ri]; mol = mols[round.mol]; key = data.molecules[round.mol].key; mistakes = 0; selected = null; wrongShapes = new Set(); solved = false; phaseT = 0;
    lps = mol.atoms.map(() => 0); filled = new Set(); $('bond-card-text').textContent = '';
    orders = level.kind === 'lone' ? mol.links.map(() => 1) : level.kind === 'shape' ? [...key.orders] : mol.links.map(() => 0);
    if (level.kind === 'shape') { mol.atoms.forEach((_, i) => { lps[i] = key.lps[i]; }); fillFromKey(); }
    phase = hasBuildStep() ? 'build' : 'shape';
    timeLeft = round.time || 0; $('bond-timer').hidden = !round.time;
    computeBox(); renderAll();
  }
  function fillFromKey() {
    filled = new Set();
    mol.atoms.forEach((_, i) => { lpSlots(mol, i).slice(0, key.lps[i]).forEach(s => filled.add(`${i}:${s.id}`)); });
  }
  const renderHearts = () => { $('bond-hearts').innerHTML = [0, 1, 2].map(i => `<span class="${i < hearts ? '' : 'gone'}">${i < hearts ? '♥' : '♡'}</span>`).join(''); $('bond-hearts').setAttribute('aria-label', `${hearts} of 3 hearts`); };
  const lpCount = () => { const c = mol.atoms.map(() => 0); for (const k of filled) c[+k.split(':')[0]]++; return c; };
  const usedNow = () => orders.reduce((n, o) => n + 2 * o, 0) + 2 * [...filled].length;
  function renderStatus() {
    $('bond-coins').textContent = coins;
    $('bond-meta').textContent = `${level.boss ? 'Boss' : 'Level ' + level.id}: ${level.title} · Molecule ${ri + 1} of ${level.rounds.length}`;
    const m = data.molecules[round.mol];
    $('bond-prompt').textContent = phase === 'between' ? `${m.formula} ${solved ? '✓' : ''}`.trim() : phase === 'shape' ? `What shape is ${m.formula}?` : `Build ${m.formula}`;
    $('bond-count').textContent = m.name;
    const total = valenceTotal(mol, V), hide = level.kind === 'boss';
    $('bond-ends').textContent = phase === 'shape' ? 'Count the electron regions on the central atom' : hide ? `Electrons drawn: ${usedNow()} · work out the total yourself` : `Valence electrons: ${total} (${valenceSum(mol, V)}) · drawn: ${usedNow()}`;
    const pos = level.rounds.length;
    $('bond-progress').firstElementChild.style.transform = `scaleX(${(ri + (phase === 'between' ? 1 : 0)) / pos})`; $('bond-progress').setAttribute('aria-valuenow', Math.round(100 * ri / pos));
    $('bond-total').textContent = hide && phase === 'build' ? 'Total valence electrons: ? (count them)' : `Total valence electrons: ${total} = ${valenceSum(mol, V)}`;
    $('screen-bonds').dataset.phase = phase;
    $('bond-check').hidden = phase !== 'build'; $('bond-clear').hidden = phase !== 'build' || level.kind === 'shape';
  }
  function tickTimer() {
    if (!round.time) return;
    const f = Math.max(0, timeLeft / round.time), bar = $('bond-timer');
    bar.firstElementChild.style.transform = `scaleX(${f})`; bar.dataset.low = String(f < 0.25); bar.setAttribute('aria-valuenow', Math.round(f * 100));
  }

  // ----- drawing the board (SVG) -----
  function computeBox() {
    const xs = mol.atoms.map(a => a.x), ys = mol.atoms.map(a => a.y), pad = 30;
    let x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
    const w = Math.max(124, x1 - x0), h = Math.max(88, y1 - y0), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    vb = [cx - w / 2, cy - h / 2, w, h];
  }
  const el = (tag, attrs = {}, inner = '') => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}>${inner}</${tag}>`;
  function bondLines(a, b, n) {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, px = -uy, py = ux;
    const ra = a.e === 'H' ? 9 : 11, rb = b.e === 'H' ? 9 : 11, sx = a.x + ux * ra, sy = a.y + uy * ra, ex = b.x - ux * rb, ey = b.y - uy * rb;
    const offs = n === 1 ? [0] : n === 2 ? [-2.6, 2.6] : [-4.6, 0, 4.6];
    return offs.map(o => el('line', { x1: sx + px * o, y1: sy + py * o, x2: ex + px * o, y2: ey + py * o, class: 'bd-bond' })).join('');
  }
  function renderBoard() {
    const editBonds = phase === 'build' && level.kind !== 'lone', editLP = phase === 'build' && level.kind !== 'shape';
    let s = '';
    mol.links.forEach(([p, q], k) => {
      const a = mol.atoms[p], b = mol.atoms[q], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (orders[k] > 0) s += bondLines(a, b, orders[k]);
      else s += el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'bd-ghost' });
      if (editBonds) s += el('circle', { cx: mx, cy: my, r: 11, class: 'bd-slot' + (orders[k] ? ' has' : ''), 'data-slot': `bond:${k}`, tabindex: 0, role: 'button', 'aria-label': `Bond between ${a.e} and ${b.e}: ${orders[k] ? BOND_NAME[orders[k]] : 'empty'}` }) + (orders[k] ? '' : el('text', { x: mx, y: my + 3.4, class: 'bd-q' }, '?'));
    });
    mol.atoms.forEach((a, i) => {
      const r = a.e === 'H' ? 9 : 11;
      for (const sl of lpSlots(mol, i)) {
        const on = filled.has(`${i}:${sl.id}`), d = r + 8, cx = a.x + sl.dx * d, cy = a.y + sl.dy * d;
        if (!on && !editLP) continue;
        const px = -sl.dy, py = sl.dx;
        s += el('circle', { cx, cy, r: 8.4, class: 'bd-slot lp' + (on ? ' has' : ''), ...(editLP ? { 'data-slot': `lp:${i}:${sl.id}`, tabindex: 0, role: 'button' } : {}), 'aria-label': `Lone pair spot beside ${a.e}: ${on ? 'filled' : 'empty'}` });
        if (on) s += el('circle', { cx: cx + px * 2.6, cy: cy + py * 2.6, r: 1.9, class: 'bd-dot' }) + el('circle', { cx: cx - px * 2.6, cy: cy - py * 2.6, r: 1.9, class: 'bd-dot' });
        else s += el('circle', { cx, cy, r: 4.2, class: 'bd-empty' });
      }
    });
    mol.atoms.forEach((a, i) => {
      const r = a.e === 'H' ? 9 : 11;
      s += el('circle', { cx: a.x, cy: a.y, r, class: 'bd-atom', fill: ATOM_COL[a.e] }) + el('text', { x: a.x, y: a.y + 4, class: 'bd-sym' }, a.e);
    });
    const dropShape = phase === 'shape' ? ' data-slot="shape" tabindex="0" role="button" aria-label="Drop zone: drag a shape here"' : '';
    board.innerHTML = `<svg xmlns="${ns}" viewBox="${vb.join(' ')}" class="bond-svg" role="group" aria-label="${data.molecules[round.mol].name}"${dropShape}>${phase === 'shape' ? el('rect', { x: vb[0] + 2, y: vb[1] + 2, width: vb[2] - 4, height: vb[3] - 4, rx: 8, class: 'bd-zone' }) : ''}${s}</svg>`;
  }
  const shapeIcon = id => {
    const P = {
      linear: [[0, 0, -16, 0], [0, 0, 16, 0]], bent: [[0, -5, -14, 8], [0, -5, 14, 8]],
      trigonal_planar: [[0, 0, 0, -16], [0, 0, -14, 8], [0, 0, 14, 8]], trigonal_pyramidal: [[0, -6, -15, 10], [0, -6, 15, 10], [0, -6, 0, 14]],
      tetrahedral: [[0, 0, 0, -16], [0, 0, -15, 10], [0, 0, 15, 10], [0, 0, 5, 16]],
    }[id];
    const ends = P.map(([, , x, y]) => `<circle cx="${x}" cy="${y}" r="4.2" fill="#8fd3ff" stroke="#231f20" stroke-width="1.3"/>`).join('');
    return `<svg viewBox="-22 -22 44 44" width="40" height="40" aria-hidden="true">${P.map(([x1, y1, x2, y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#231f20" stroke-width="2"/>`).join('')}${ends}<circle cx="0" cy="${id === 'bent' || id === 'trigonal_pyramidal' ? -5 : 0}" r="5.2" fill="#d4ff3a" stroke="#231f20" stroke-width="1.3"/></svg>`;
  };
  function renderTray() {
    tray.innerHTML = '';
    const add = (type, value, html, label) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'bond-chip'; b.dataset.type = type; b.dataset.value = value; b.innerHTML = html; b.setAttribute('aria-label', label); b.setAttribute('aria-pressed', 'false');
      if (type === 'shape' && wrongShapes.has(value)) b.disabled = true;
      tray.append(b);
    };
    if (phase === 'build') {
      if (level.kind !== 'lone') for (let n = 1; n <= 3; n++) add('bond', String(n), `<svg viewBox="0 0 40 24" width="40" height="24" aria-hidden="true">${[[-0],[-3.2, 3.2],[-5.4, 0, 5.4]][n - 1].map(o => `<line x1="5" y1="${12 + o}" x2="35" y2="${12 + o}" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`).join('')}</svg>`, `${BOND_NAME[n]} chip`);
      add('lp', 'lp', '<svg viewBox="0 0 40 24" width="40" height="24" aria-hidden="true"><circle cx="14" cy="12" r="5" fill="currentColor"/><circle cx="26" cy="12" r="5" fill="currentColor"/></svg>', 'lone pair chip');
    } else if (phase === 'shape') {
      for (const id of SHAPE_IDS) add('shape', id, `${shapeIcon(id)}<span>${SHAPES[id].label}</span>`, `${SHAPES[id].label} shape`);
    }
    syncSelection();
  }
  function syncSelection() {
    for (const b of tray.children) { const on = !!selected && selected.type === b.dataset.type && selected.value === b.dataset.value; b.setAttribute('aria-pressed', String(on)); b.dataset.on = String(on); }
    board.dataset.armed = String(!!selected);
  }
  function renderAll() { renderStatus(); renderBoard(); renderTray(); }

  // ----- placing chips -----
  function place(token, slot) {
    if (phase !== 'build' && phase !== 'shape') return;
    sound.unlock();
    if (token && token.type === 'shape' && slot === 'shape' && phase === 'shape') return answerShape(token.value);
    const parts = slot.split(':');
    if (phase !== 'build') return;
    if (parts[0] === 'bond') {
      const k = +parts[1];
      if (token && token.type === 'bond') { orders[k] = +token.value; sound.pop(); }
      else if (!token) { if (orders[k]) { orders[k] = 0; sound.select(); } }
      else { says($('bond-says'), { text: 'That chip is for lone pairs. Drag a single, double or triple bond onto the bond.' }); return; }
    } else if (parts[0] === 'lp') {
      const id = `${parts[1]}:${parts[2]}`;
      if (token && token.type === 'lp') { if (!filled.has(id)) { filled.add(id); sound.pop(); } }
      else if (!token) { if (filled.has(id)) { filled.delete(id); sound.select(); } }
      else { says($('bond-says'), { text: 'That chip is for bonds. Drag a lone pair onto an atom, or a bond onto a link.' }); return; }
    }
    renderStatus(); renderBoard(); syncSelection();
  }
  function check() {
    if (phase !== 'build') return;
    sound.unlock();
    const counts = lpCount(), res = evaluate(mol, orders, counts, V);
    if (!res.complete) { sound.select(); says($('bond-says'), { text: explain(res, mol, V, NAMES) }); return; }
    if (res.ok) {
      coins += COINS_PER_STEP; xp += XP_PER_STEP; sound.correct();
      const m = data.molecules[round.mol];
      if (hasShapeStep()) {
        key = { orders: [...orders], lps: counts }; phase = 'shape'; selected = null; renderAll();
        says($('bond-says'), { text: `${m.fact} Now: what shape is ${m.formula}?`, state: 'correct', status: '✓ Lewis structure built!' });
      } else finishRound(true, `${m.fact}`, '✓ Lewis structure built!');
    } else {
      hearts--; mistakes++; renderHearts(); sound.wrong();
      says($('bond-says'), { text: explain(res, mol, V, NAMES), state: 'wrong', status: '✗ Not quite. −1 heart.' });
      if (hearts <= 0) { phase = 'over'; setTimeout(() => finish(false), 1600); }
    }
  }
  function answerShape(id) {
    const right = shapeOf(mol, key.lps), m = data.molecules[round.mol];
    if (id === right) {
      coins += COINS_PER_STEP; xp += XP_PER_STEP; sound.correct();
      finishRound(true, shapeText(mol, key.lps, NAMES), `✓ ${SHAPES[id].label}!`);
    } else {
      wrongShapes.add(id); hearts--; mistakes++; renderHearts(); sound.wrong(); selected = null;
      says($('bond-says'), { text: `${SHAPES[id].label} is not right for ${m.formula}. Count the regions on the central atom (each bonded atom is one region, a double bond counts once, and a lone pair counts too), then picture them spreading as far apart as possible.`, state: 'wrong', status: '✗ Not that shape. −1 heart.' });
      renderTray();
      if (hearts <= 0) { phase = 'over'; setTimeout(() => finish(false), 1600); }
    }
  }
  function showSolution() {
    orders = [...key.orders]; mol.atoms.forEach((_, i) => { lps[i] = key.lps[i]; }); fillFromKey(); phase = 'between'; computeBox();
  }
  function finishRound(ok, text, status) {
    if (ok && mistakes === 0) coins += ROUND_BONUS;
    showSolution(); phase = 'between'; phaseT = 0; selected = null; solved = ok; renderAll(); showNext();
    cardText();
    says($('bond-says'), { text: text, state: 'correct', status: ok && mistakes === 0 ? `${status} +5 bonus.` : status });
  }
  const cardText = () => { $('bond-card-text').textContent = hasShapeStep() ? shapeText(mol, key.lps, NAMES) : ''; };
  function timeUp() {
    hearts--; renderHearts(); sound.wrong();
    key = data.molecules[round.mol].key; showSolution(); phaseT = 0; selected = null; renderAll();
    cardText();
    says($('bond-says'), { text: `${data.molecules[round.mol].fact} ${shapeText(mol, key.lps, NAMES)} The finished structure is on the board.`, state: 'wrong', status: '✗ Time’s up! −1 heart.' });
    if (hearts <= 0) { phase = 'over'; setTimeout(() => finish(false), 2000); } else showNext();
  }
  function showNext() { const n = $('bond-next'); n.textContent = ri + 1 >= level.rounds.length ? 'Finish ›' : 'Next molecule ›'; n.hidden = false; }
  function nextRound() { $('bond-next').hidden = true; ri++; if (ri >= level.rounds.length) { phase = 'over'; finish(true); return; } startRound(); }
  function finish(win) {
    phase = 'over'; $('bond-next').hidden = true;
    onFinish({
      win, hearts, coins, xp, levelId: level.id,
      title: win ? 'Glacier conquered!' : hearts <= 0 ? 'Out of hearts' : 'Level over',
      summary: win ? `You finished all ${level.rounds.length} molecules, and earned ${coins} coins and ${xp} XP.`
        : 'You ran out of hearts. Try again: count the valence electrons first, give every atom an octet (hydrogen a duet), and remember that a double bond counts as one region for the shape.',
    });
  }
  function hint() {
    if (phase === 'build') { sound.select(); const m = data.molecules[round.mol]; says($('bond-says'), { text: `Start with the electron count: ${m.formula} has ${valenceTotal(mol, V)} valence electrons (${valenceSum(mol, V)}). Each bond uses 2 per bond order, and each lone pair uses 2. Every atom needs 8 around it (hydrogen 2).` }); }
    else if (phase === 'shape') { sound.select(); says($('bond-says'), { text: `Count the regions on the central atom: one for each bonded atom (a double bond is one region) plus one for each lone pair. Then picture them spreading as far apart as they can.` }); }
  }

  // ----- drag and tap -----
  let drag = null;
  tray.addEventListener('pointerdown', e => {
    const b = e.target.closest('.bond-chip'); if (!b || b.disabled) return;
    drag = { token: { type: b.dataset.type, value: b.dataset.value }, btn: b, x0: e.clientX, y0: e.clientY, ghost: null, moved: false };
    b.setPointerCapture(e.pointerId); e.preventDefault();
  });
  tray.addEventListener('pointermove', e => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 7) {
      drag.moved = true; drag.ghost = drag.btn.cloneNode(true); drag.ghost.classList.add('bond-ghost'); document.body.append(drag.ghost); drag.btn.classList.add('dragging');
    }
    if (drag.ghost) { drag.ghost.style.left = `${e.clientX}px`; drag.ghost.style.top = `${e.clientY}px`; highlight(e.clientX, e.clientY); }
  });
  const slotAt = (x, y) => { for (const n of document.elementsFromPoint(x, y)) { const s = n.closest && n.closest('[data-slot]'); if (s && board.contains(s)) return s; } return null; };
  function highlight(x, y) { board.querySelectorAll('.over').forEach(n => n.classList.remove('over')); const s = slotAt(x, y); if (s) s.classList.add('over'); }
  const endDrag = e => {
    if (!drag) return; const d = drag; drag = null;
    if (d.ghost) { d.ghost.remove(); d.btn.classList.remove('dragging'); board.querySelectorAll('.over').forEach(n => n.classList.remove('over')); const s = slotAt(e.clientX, e.clientY); if (s) place(d.token, s.dataset.slot); else if (e.type === 'pointerup') sound.select(); }
    else if (e.type === 'pointerup') { selected = selected && selected.type === d.token.type && selected.value === d.token.value ? null : d.token; sound.select(); syncSelection(); }
  };
  tray.addEventListener('pointerup', endDrag); tray.addEventListener('pointercancel', endDrag);
  board.addEventListener('click', e => {
    if (phase === 'between') { if (phaseT > 0.8) nextRound(); return; }
    const s = e.target.closest('[data-slot]'); if (!s) return;
    if (s.dataset.slot === 'shape') { if (selected && selected.type === 'shape') place(selected, 'shape'); else { sound.select(); says($('bond-says'), { text: 'Drag a shape chip from below onto the molecule, or tap a shape chip first and then tap the molecule.' }); } return; }
    place(selected, s.dataset.slot);
  });
  board.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-slot]')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
  tray.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { const b = e.target.closest('.bond-chip'); if (b) { e.preventDefault(); selected = selected && selected.type === b.dataset.type && selected.value === b.dataset.value ? null : { type: b.dataset.type, value: b.dataset.value }; sound.select(); syncSelection(); } } });
  $('bond-check').onclick = check;
  $('bond-clear').onclick = () => { if (phase !== 'build') return; sound.select(); filled = new Set(); if (level.kind !== 'lone') orders = mol.links.map(() => 0); renderAll(); };
  $('bond-hint').onclick = hint;
  $('bond-next').onclick = () => { if (phase === 'between') { sound.unlock(); sound.select(); nextRound(); } };
  document.querySelector('#screen-bonds .ticket').addEventListener('click', hint);
  $('bond-quit').onclick = () => { stop(); onExit(); };
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if ((phase === 'build' || phase === 'shape') && round.time) { timeLeft -= dt; tickTimer(); if (timeLeft <= 0) { timeLeft = 0; tickTimer(); timeUp(); } }
    else if (phase === 'between') { phaseT += dt; }
    raf = requestAnimationFrame(frame);
  }
  function stop() { running = false; cancelAnimationFrame(raf); phase = 'over'; $('bond-next').hidden = true; }
  // Test hook (only reachable with ?test in the address)
  const debug = {
    snapshot: () => ({ phase, round: ri, hearts, mol: round && round.mol, timeLeft, orders: [...orders], lps: lpCount(), kind: level && level.kind }),
    drain: sec => { timeLeft = Math.max(0.05, timeLeft - sec); },
  };
  return { start: startLevel, stop, debug };
}
