// World 2 — Orbital Ruins rules (no screen code, so they can be tested in Node).
// An atom's electrons go into orbitals ("sockets"). Three rules decide where the next electron may go:
//   Aufbau: fill the lowest-energy subshell first.   Pauli: an orbital holds at most 2 electrons (opposite spins).
//   Hund:   inside a subshell, give every orbital one electron (same spin) before pairing any of them up.

export const AUFBAU = ['1s', '2s', '2p', '3s', '3p', '4s', '3d'];          // energy order (lowest first)
export const BOXES = sub => ({ s: 1, p: 3, d: 5 }[sub.slice(-1)] || 0);
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
export const sup = n => String(n).replace(/\d/g, d => SUP[d]);

const RULE_TEXT = {
  aufbau: (open, sub) => `Aufbau principle: ${open} is lower in energy than ${sub}, so ${open} must fill up first.`,
  hund: sub => `Hund’s rule: spread the electrons across the empty ${sub} orbitals first, all spinning the same way. Pair up only when every ${sub} orbital has one.`,
  pauli: () => 'Pauli exclusion principle: an orbital holds at most two electrons, and they must spin in opposite directions.',
};

// state.fill[sub] = electrons in each orbital of that subshell, e.g. { '2p': [1, 1, 0] }
export function newState(level) {
  const fill = {};
  for (const sub of [...level.given, ...level.subshells]) fill[sub] = Array(BOXES(sub)).fill(level.given.includes(sub) ? 2 : 0);
  return { fill };
}
export const clone = st => ({ fill: Object.fromEntries(Object.entries(st.fill).map(([k, v]) => [k, v.slice()])) });
const ordered = subs => [...subs].sort((a, b) => AUFBAU.indexOf(a) - AUFBAU.indexOf(b));
const total = arr => arr.reduce((a, b) => a + b, 0);

// The subshell that has to be filled next: the lowest one that still has room.
export function lowestOpen(st) {
  return ordered(Object.keys(st.fill)).find(sub => st.fill[sub].some(n => n < 2)) || null;
}

// May the next electron go into orbital `box` of subshell `sub`? If not, which rule says no?
export function check(st, sub, box) {
  const orbs = st.fill[sub];
  if (!orbs || orbs[box] === undefined) return { ok: false, rule: 'none', text: 'That is not an orbital of this atom.' };
  if (orbs[box] >= 2) return { ok: false, rule: 'pauli', text: RULE_TEXT.pauli() };
  const open = lowestOpen(st);
  if (open !== sub) return { ok: false, rule: 'aufbau', text: RULE_TEXT.aufbau(open, sub) };
  if (orbs[box] === 1 && orbs.some(n => n === 0)) return { ok: false, rule: 'hund', text: RULE_TEXT.hund(sub) };
  return { ok: true };
}

// All orbitals that would accept the next electron.
export function legalTargets(st) {
  const out = [];
  for (const sub of Object.keys(st.fill)) st.fill[sub].forEach((_, box) => { if (check(st, sub, box).ok) out.push({ sub, box }); });
  return out;
}

// Returns the new state. The spin is up for the first electron in an orbital and down for the second.
export function place(st, sub, box) {
  const next = clone(st); next.fill[sub][box] += 1; return next;
}
export const spinOf = (count, index) => (index === 0 ? 'up' : 'down');     // index 0 = first electron in that orbital

export function configString(st) {
  return ordered(Object.keys(st.fill)).map(sub => [sub, total(st.fill[sub])]).filter(([, n]) => n > 0).map(([sub, n]) => `${sub}${sup(n)}`).join(' ');
}
export const electronCount = st => Object.values(st.fill).reduce((a, arr) => a + total(arr), 0);
export const crateCount = level => Object.values(level.target).reduce((a, b) => a + b, 0);

// True when every subshell on the board holds exactly the electrons the level asks for.
export function complete(st, level) {
  return Object.entries(level.target).every(([sub, n]) => total(st.fill[sub]) === n);
}

// ---------- the board (a Sokoban grid) ----------
// '#' wall, '.' floor, '@' player, '$' electron, a-z orbital socket (see level.cells). Sockets are only entered by pushing an electron in.
export function parseGrid(level) {
  const rows = level.grid, h = rows.length, w = Math.max(...rows.map(r => r.length));
  const walls = new Set(), floor = new Set(), sockets = new Map(); let player = null; const crates = [];
  rows.forEach((row, y) => [...row.padEnd(w, '#')].forEach((ch, x) => {
    const k = y * w + x;
    if (ch === '#') walls.add(k);
    else if (/[a-z]/.test(ch)) { sockets.set(k, level.cells[ch]); }
    else { floor.add(k); if (ch === '@') player = k; if (ch === '$') crates.push(k); }
  }));
  return { w, h, walls, floor, sockets, player, crates: crates.sort((a, b) => a - b) };
}

const DIRS = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
export const DIR_KEYS = Object.keys(DIRS);

// One step. Returns { moved, pushed, absorbed:{sub,box}, blocked, illegal:{rule,text,sub,box} } and the next game state.
export function step(board, g, dir) {
  const [dx, dy] = DIRS[dir], w = board.w, px = g.player % w, py = Math.floor(g.player / w);
  const nx = px + dx, ny = py + dy;
  if (nx < 0 || ny < 0 || nx >= w || ny >= board.h) return { g, blocked: true };
  const to = ny * w + nx;
  if (board.walls.has(to) || board.sockets.has(to)) return { g, blocked: true };
  const ci = g.crates.indexOf(to);
  if (ci < 0) return { g: { ...g, player: to }, moved: true };
  const bx = nx + dx, by = ny + dy;
  if (bx < 0 || by < 0 || bx >= w || by >= board.h) return { g, blocked: true };
  const beyond = by * w + bx;
  if (board.walls.has(beyond) || g.crates.includes(beyond)) return { g, blocked: true };
  if (board.sockets.has(beyond)) {
    const { sub, box } = board.sockets.get(beyond), verdict = check(g.state, sub, box);
    if (!verdict.ok) return { g, blocked: true, illegal: { ...verdict, sub, box, socket: beyond } };
    const crates = g.crates.filter((_, i) => i !== ci);
    return { g: { player: to, crates, state: place(g.state, sub, box) }, moved: true, pushed: true, absorbed: { sub, box, socket: beyond } };
  }
  const crates = g.crates.slice(); crates[ci] = beyond;
  return { g: { ...g, player: to, crates: crates.sort((a, b) => a - b) }, moved: true, pushed: true };
}

export function startGame(level) {
  const board = parseGrid(level);
  return { board, g: { player: board.player, crates: board.crates.slice(), state: newState(level) } };
}

// Breadth-first search for a shortest solution (used by the tests to prove every level can be completed).
// Cells from which an electron can still be pushed into some socket (ignoring other electrons). An electron anywhere else is stuck for good.
export function liveCells(board) {
  const w = board.w, free = k => board.floor.has(k), live = new Set();
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= board.h ? -1 : y * w + x);
  const work = [];
  for (const sk of board.sockets.keys()) for (const [dx, dy] of Object.values(DIRS)) {
    const x = sk % w, y = Math.floor(sk / w), p = at(x - dx, y - dy), behind = at(x - 2 * dx, y - 2 * dy);
    if (p >= 0 && free(p) && behind >= 0 && free(behind)) { live.add(p); work.push(p); }
  }
  while (work.length) {
    const r = work.pop(), rx = r % w, ry = Math.floor(r / w);
    for (const [dx, dy] of Object.values(DIRS)) {
      const q = at(rx - dx, ry - dy), stand = at(rx - 2 * dx, ry - 2 * dy);
      if (q >= 0 && free(q) && stand >= 0 && free(stand) && !live.has(q)) { live.add(q); work.push(q); }
    }
  }
  return live;
}

export function solve(level, limit = 3_000_000) {
  const { board, g: g0 } = startGame(level), live = liveCells(board);
  const key = g => `${g.player}|${g.crates.join(',')}|${Object.values(g.state.fill).map(a => a.join('')).join('.')}`;
  const seen = new Map([[key(g0), null]]); let frontier = [g0]; const parent = new Map();
  for (let depth = 0; frontier.length && seen.size < limit; depth++) {
    const next = [];
    for (const g of frontier) {
      for (const d of DIR_KEYS) {
        const r = step(board, g, d);
        if (!r.moved) continue;
        const k = key(r.g);
        if (seen.has(k) || r.g.crates.some(c => !live.has(c))) continue;
        seen.set(k, null); parent.set(k, { from: key(g), d });
        if (r.g.crates.length === 0 && complete(r.g.state, level)) {
          const path = []; let cur = k; while (parent.has(cur)) { const p = parent.get(cur); path.push(p.d); cur = p.from; }
          return { moves: path.reverse().join(''), states: seen.size };
        }
        next.push(r.g);
      }
    }
    frontier = next;
  }
  return { moves: null, states: seen.size };
}
