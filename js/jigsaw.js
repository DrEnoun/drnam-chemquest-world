// World 9 — Puzzle Pier: match-the-edges jigsaws, one per ChemQuest topic. Drag a piece (or tap it, then tap a
// space) onto the board; pieces fit where the touching edges make a matching pair. The finished board shows a picture.
// Rules are in jigsaw-logic.js; puzzles in data/jigsaw.json.
import { buildPuzzle, checkJoints, solved, hintFor, COLS, ROWS, SIDES } from './jigsaw-logic.js';
import { pxCanvas, crisp, shade, tint } from './pxart.js';
import * as SC from './scenery.js';
import { monsterSprite } from './monsters.js';

const PW = 240, PH = 160, SA = 3;                    // picture size in art units (3 x 2 pieces of 80 units)
const SCENES = {                                       // [sprite maker, x, y(bottom), scale] for each world's picture
  1: { sky: ['#8fd8ff', '#e8fbff'], ground: '#58bd5f', items: [[SC.cottage, 150, 128, 1.6], [() => SC.roundTree(SC.TREES.blossom), 62, 132, 1.5], [() => SC.roundTree(), 210, 136, 1.2], [SC.fence, 104, 138, 1]], monster: 'water' },
  2: { sky: ['#ffd9a8', '#fff3e0'], ground: '#e6c681', items: [[SC.ziggurat, 140, 132, 1.5], [SC.palm, 50, 136, 1.4], [SC.pillar, 214, 136, 1.4]], monster: 'o2' },
  3: { sky: ['#7fdcf5', '#e8fbff'], ground: '#46a85f', items: [[SC.tableWall, 150, 126, 1.6], [() => SC.roundTree(SC.TREES.teal), 54, 134, 1.4], [() => SC.pine(false), 214, 136, 1.3]], monster: 'nh3' },
  4: { sky: ['#b9a8ff', '#efe8ff'], ground: '#8b9caf', items: [[() => SC.mountain(80, 70), 70, 130, 1.3], [SC.castle, 168, 134, 1.3]], monster: 'ch4' },
  5: { sky: ['#7fb8ff', '#e6f6ff'], ground: '#d6f3ff', items: [[SC.crystal, 60, 132, 1.3], [SC.iceHall, 160, 132, 1.5], [() => SC.pine(true), 222, 136, 1.2]], monster: 'co2' },
  6: { sky: ['#1b4f8f', '#5aa6d8'], ground: '#33b9ad', items: [[SC.diner, 140, 132, 1.5], [SC.lamp, 40, 136, 1.5], [() => SC.pylon(), 222, 136, 1.4]], monster: 'nacl' },
  7: { sky: ['#ff9f7a', '#ffe1c4'], ground: '#5fb862', items: [[SC.volcano, 92, 128, 1.6], [SC.cauldron, 176, 136, 1.6], [SC.palm, 222, 138, 1.3]], monster: 'water' },
  8: { sky: ['#3f8fc8', '#ffc58a'], ground: '#9cc9e8', items: [[SC.gateArch, 120, 132, 1.8], [() => SC.crystalS(), 210, 138, 1.6], [SC.palm, 40, 138, 1.3]], monster: 'co2' },
};
const pictureCache = {};
function picture(world) {
  if (pictureCache[world]) return pictureCache[world];
  const sc = SCENES[world] || SCENES[1], cv = pxCanvas(PW * SA, PH * SA), c = cv.getContext('2d'); c.scale(SA, SA);
  const g = c.createLinearGradient(0, 0, 0, PH); g.addColorStop(0, sc.sky[0]); g.addColorStop(0.7, sc.sky[1]); c.fillStyle = g; c.fillRect(0, 0, PW, PH);
  c.fillStyle = 'rgba(255,255,255,.85)'; [[40, 26, 16], [182, 18, 12], [120, 34, 9]].forEach(([x, y, r]) => { c.beginPath(); c.ellipse(x, y, r, r * 0.45, 0, 0, 7); c.ellipse(x + r * 0.7, y + 2, r * 0.7, r * 0.35, 0, 0, 7); c.fill(); });
  c.fillStyle = sc.ground; c.beginPath(); c.ellipse(PW / 2, PH + 34, PW * 0.78, 64, 0, 0, 7); c.fill();
  c.fillStyle = shade(sc.ground, 0.12); c.beginPath(); c.ellipse(PW / 2, PH + 44, PW * 0.7, 60, 0, 0, 7); c.fill();
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  for (const [make, x, y, k] of sc.items) { const s = make(); c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(x, y, s.lw * k * 0.4, 3, 0, 0, 7); c.fill(); c.drawImage(s, x - (s.lw * k) / 2, y - s.lh * k, s.lw * k, s.lh * k); }
  const m = monsterSprite(sc.monster, 'cheer'); c.drawImage(m, 96, 104, 48, 40);
  return (pictureCache[world] = cv.toDataURL());
}
const SIDE_NAME = { t: 'top', r: 'right', b: 'bottom', l: 'left' };

export function createJigsaw({ $, data, says, sound, onFinish, onExit }) {
  const board = $('jig-board'), tray = $('jig-tray');
  let level = null, pz = null, place = [], hearts = 3, coins = 0, xp = 0, over = false, done = false, selected = null, hints = 0;

  function start(levelId) {
    level = data.levels.find(l => l.id === levelId);
    pz = buildPuzzle(level);
    place = Array(COLS * ROWS).fill(null); place[0] = pz.anchor;
    hearts = 3; coins = 0; xp = 0; over = false; done = false; selected = null; hints = 0;
    $('jig-meta').textContent = `Puzzle ${level.id}: ${level.title}`;
    $('jig-goal').textContent = level.subtitle;
    $('jig-finish').hidden = true; board.classList.remove('is-solved');
    board.style.setProperty('--pic', `url(${picture(level.picture)})`);
    says($('jig-says'), { text: `${level.tip} The top-left piece is pinned in place to get you started.` });
    renderHearts(); render();
  }
  const renderHearts = () => { $('jig-hearts').innerHTML = [0, 1, 2].map(i => `<span class="${i < hearts ? '' : 'gone'}">${i < hearts ? '♥' : '♡'}</span>`).join(''); $('jig-hearts').setAttribute('aria-label', `${hearts} of 3 hearts`); $('jig-coins').textContent = coins; };

  // ----- one piece: four edge labels round a square sticker -----
  function pieceEl(p, where) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'jig-piece'; b.dataset.id = p.id;
    const fixed = where === 'board' && p.id === pz.anchor;
    if (fixed) { b.classList.add('is-anchor'); b.setAttribute('aria-disabled', 'true'); }
    if (selected === p.id) b.classList.add('is-selected');
    const label = SIDES.map(s => p.edges[s] ? `${SIDE_NAME[s]}: ${p.edges[s].text}` : `${SIDE_NAME[s]}: blank`).join('; ');
    b.setAttribute('aria-label', `${fixed ? 'Pinned piece. ' : 'Piece. '}${label}`);
    b.innerHTML = SIDES.map(s => `<span class="jig-edge jig-edge--${s}${p.edges[s] && p.edges[s].decoy ? ' is-decoy' : ''}">${p.edges[s] ? p.edges[s].text : ''}</span>`).join('') + (fixed ? '<i class="jig-pin" aria-hidden="true"></i>' : '');
    if (where === 'board' && done) { const slot = place.indexOf(p.id); b.style.setProperty('--px', `${(slot % COLS) * 50}%`); b.style.setProperty('--py', `${Math.floor(slot / COLS) * 100}%`); }
    if (!fixed) {
      b.addEventListener('click', e => {
        if (dragMoved) return;
        if (where === 'board' && selected != null && selected !== p.id) { e.stopPropagation(); dropOn(place.indexOf(p.id)); return; }   // swap with the selected piece
        select(p.id);
      });
      b.addEventListener('pointerdown', e => startDrag(e, p.id, b));
    }
    return b;
  }
  function render(marks = null) {
    board.innerHTML = ''; tray.innerHTML = '';
    for (let s = 0; s < COLS * ROWS; s++) {
      const cell = document.createElement('div'); cell.className = 'jig-slot'; cell.dataset.slot = s;
      if (place[s] != null) cell.append(pieceEl(pz.pieces.find(p => p.id === place[s]), 'board'));
      else { const t = document.createElement('button'); t.type = 'button'; t.className = 'jig-empty'; t.setAttribute('aria-label', `Empty space, row ${Math.floor(s / COLS) + 1}, column ${(s % COLS) + 1}`); t.onclick = () => dropOn(s); cell.append(t); }
      board.append(cell);
    }
    if (marks) for (const j of marks) {
      if (j.state === 'open') continue;
      const m = document.createElement('span'); m.className = `jig-mark jig-mark--${j.state}`; m.textContent = j.state === 'match' ? '✓' : '✗';
      const ra = Math.floor(j.a / COLS), ca = j.a % COLS;
      if (j.sa === 'r') { m.style.left = `${((ca + 1) / COLS) * 100}%`; m.style.top = `${((ra + 0.5) / ROWS) * 100}%`; }
      else { m.style.left = `${((ca + 0.5) / COLS) * 100}%`; m.style.top = `${((ra + 1) / ROWS) * 100}%`; }
      board.append(m);
    }
    const loose = pz.pieces.filter(p => !place.includes(p.id));
    for (const p of loose) tray.append(pieceEl(p, 'tray'));
    if (!loose.length) tray.innerHTML = `<p class="jig-trayempty">${done ? 'Puzzle complete! Press Finish.' : 'All pieces are on the board. Press Check!'}</p>`;
    $('jig-check').hidden = $('jig-hint').hidden = done;
    $('jig-count').textContent = done ? 'Solved!' : `${loose.length} piece${loose.length === 1 ? '' : 's'} left in the tray`;
  }

  // ----- moving pieces -----
  function select(id) { if (over || done) return; sound.select(); selected = selected === id ? null : id; render(); if (selected != null) says($('jig-says'), { text: 'Now tap a space on the board for this piece (or drag it there). Tap a placed piece and then the tray to take it back.' }); }
  function dropOn(slot) {
    if (over || done || selected == null || slot === 0) return;
    const from = place.indexOf(selected);
    const occupant = place[slot];
    if (from >= 0) place[from] = occupant ?? null; else if (occupant != null) { /* occupant goes back to the tray */ }
    place[slot] = selected; selected = null; sound.pop(); render(); autoCheck();
  }
  function toTray(id) { const i = place.indexOf(id); if (i > 0) { place[i] = null; sound.pop(); } selected = null; render(); }
  tray.addEventListener('click', e => { if (e.target === tray && selected != null && place.includes(selected)) toTray(selected); });
  board.addEventListener('click', e => { const cell = e.target.closest('.jig-slot'); if (!cell || selected == null) return; if (e.target.closest('.jig-piece') && +e.target.closest('.jig-piece').dataset.id === selected) return; dropOn(+cell.dataset.slot); });

  // drag with mouse or finger: the piece follows the pointer and lands on the space under it (or back in the tray)
  let drag = null, dragMoved = false;
  function startDrag(e, id, el) {
    if (over || done) return;
    dragMoved = false;
    const r = el.getBoundingClientRect();
    drag = { id, el, dx: e.clientX - r.left, dy: e.clientY - r.top, x0: e.clientX, y0: e.clientY, ghost: null, w: r.width };
    el.setPointerCapture(e.pointerId);
  }
  addEventListener('pointermove', e => {
    if (!drag) return;
    if (!drag.ghost) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 8) return;
      dragMoved = true; drag.ghost = drag.el.cloneNode(true); drag.ghost.classList.add('jig-ghost'); drag.ghost.style.width = drag.w + 'px'; document.body.append(drag.ghost); drag.el.classList.add('is-dragging');
    }
    drag.ghost.style.transform = `translate(${e.clientX - drag.dx}px, ${e.clientY - drag.dy}px) rotate(-3deg)`;
    document.querySelectorAll('.jig-slot.is-over').forEach(s => s.classList.remove('is-over'));
    const under = document.elementsFromPoint(e.clientX, e.clientY).find(n => n.classList && n.classList.contains('jig-slot'));
    if (under && under.dataset.slot !== '0') under.classList.add('is-over');
  });
  addEventListener('pointerup', e => {
    if (!drag) return;
    const d = drag; drag = null;
    document.querySelectorAll('.jig-slot.is-over').forEach(s => s.classList.remove('is-over'));
    if (!d.ghost) return;                                   // a tap: the click handler selects it
    d.ghost.remove();
    const hit = document.elementsFromPoint(e.clientX, e.clientY);
    const slot = hit.find(n => n.classList && n.classList.contains('jig-slot'));
    if (slot && slot.dataset.slot !== '0') { selected = d.id; dropOn(+slot.dataset.slot); }
    else if (hit.includes(tray) || hit.some(n => n.closest && n.closest('#jig-tray'))) toTray(d.id);
    else render();
    setTimeout(() => { dragMoved = false; }, 0);
  });

  // ----- checking -----
  function autoCheck() { if (place.every(x => x != null) && solved(pz, place)) win(); }
  function check() {
    if (over || done) return;
    const marks = checkJoints(pz, place), closed = marks.filter(j => j.state !== 'open');
    if (!closed.length) { says($('jig-says'), { text: 'Put at least two pieces next to each other first, then press Check.' }); return; }
    const bad = closed.filter(j => j.state === 'clash');
    render(marks);
    if (solved(pz, place)) return win();
    if (bad.length) {
      hearts--; renderHearts(); sound.wrong();
      says($('jig-says'), { text: `${closed.length - bad.length} of ${closed.length} touching edges match. The ✗ marks show edges that do not belong together: swap those pieces around.`, state: 'wrong', status: '✗ Not yet. −1 heart.' });
      if (hearts <= 0) { over = true; setTimeout(() => finish(false), 1400); }
    } else { sound.correct(); coins += 2; renderHearts(); says($('jig-says'), { text: `All ${closed.length} touching edges match so far. Keep going!`, state: 'correct', status: '✓ Good so far! +2 coins.' }); }
  }
  function hint() {
    if (over || done) return;
    const h = hintFor(pz, place); if (!h) return;
    hints++; sound.select();
    const p = pz.pieces.find(x => x.id === h.piece), side = Object.entries(p.edges).find(([, e]) => e && !e.decoy);
    selected = h.piece; render();
    const cell = board.querySelector(`[data-slot="${h.slot}"]`); if (cell) { cell.classList.add('is-hint'); setTimeout(() => cell.classList.remove('is-hint'), 2500); }
    says($('jig-says'), { text: `The glowing space needs the piece with “${side[1].text}” on it. It is selected: tap the glowing space.${hints > 2 ? ' (Try matching a few on your own too!)' : ''}` });
  }
  function win() {
    done = true; selected = null; coins += 10 + hearts * 5; xp += 20; renderHearts(); sound.correct();
    board.classList.add('is-solved'); render();
    says($('jig-says'), { text: `Every edge matches. Here is the ${level.subtitle.split(' · ')[0]} picture!`, state: 'correct', status: '✓ Solved!' });
    $('jig-finish').hidden = false; $('jig-finish').focus();
  }
  function finish(win) {
    if (over && win) return; over = true;
    onFinish({
      win, hearts, coins, xp, levelId: level.id,
      title: win ? 'Puzzle solved!' : 'Out of hearts',
      summary: win ? `You matched all 7 pairs in “${level.title}” and earned ${coins} coins.` : 'You ran out of hearts. Start with one edge you are sure about, build out from the pinned piece, and press Check only when a few pieces are in.',
    });
  }
  $('jig-check').onclick = check; $('jig-hint').onclick = hint; $('jig-finish').onclick = () => finish(true);
  $('jig-quit').onclick = () => { onExit(); };
  const debug = { get puzzle() { return pz; }, get place() { return place; }, set(p) { place = p.slice(); render(); autoCheck(); } };
  return { start, stop() { drag = null; }, debug };
}
