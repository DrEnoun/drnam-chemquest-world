// World 9 — Puzzle Pier: match-the-edges jigsaws (Tarsia puzzles). Pure rules, no screen code, so they can be tested in Node.
// A 3 × 2 board of square pieces. Where two pieces meet, one edge shows half of a pair (e.g. "SO₄²⁻") and the
// touching edge shows the other half ("sulfate"). Outside edges carry decoys. Pieces never rotate.
export const COLS = 3, ROWS = 2, SIDES = ['t', 'r', 'b', 'l'];
const OPP = { t: 'b', b: 't', l: 'r', r: 'l' };

// Every place where two slots touch: [slotA, sideA, slotB, sideB]. Slot = row * COLS + col.
export function joints(cols = COLS, rows = ROWS) {
  const out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const s = r * cols + c;
    if (c + 1 < cols) out.push([s, 'r', s + 1, 'l']);
    if (r + 1 < rows) out.push([s, 'b', s + cols, 't']);
  }
  return out;
}
export const shuffle = (a, rng = Math.random) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Build the pieces for a level. piece.home is the slot it belongs in; piece.edges[side] = { text, pair, half } or null.
export function buildPuzzle(level, rng = Math.random) {
  const J = joints(), n = COLS * ROWS;
  if (level.pairs.length !== J.length) throw new Error(`Level ${level.id} needs ${J.length} pairs`);
  const ids = shuffle([...Array(n).keys()], rng);           // ids are shuffled so the tray order gives nothing away
  const pieces = Array.from({ length: n }, (_, home) => ({ id: ids[home], home, edges: { t: null, r: null, b: null, l: null } }));
  const order = shuffle(level.pairs.map((_, i) => i), rng);
  J.forEach(([a, sa, b, sb], k) => {
    const p = order[k], flip = rng() < 0.5, pair = level.pairs[p];
    pieces[a].edges[sa] = { text: pair[flip ? 1 : 0], pair: p, half: flip ? 1 : 0 };
    pieces[b].edges[sb] = { text: pair[flip ? 0 : 1], pair: p, half: flip ? 0 : 1 };
  });
  const outside = [];
  pieces.forEach(pc => SIDES.forEach(s => { if (!pc.edges[s]) outside.push([pc, s]); }));
  shuffle(outside, rng).slice(0, (level.decoys || []).length).forEach(([pc, s], i) => { pc.edges[s] = { text: level.decoys[i], decoy: true }; });
  pieces.sort((x, y) => x.id - y.id);
  return { pieces, anchor: pieces.find(p => p.home === 0).id };        // the top-left piece starts in place, to show which way up the board goes
}

// placement: slot -> piece id (or null). Returns every joint with both slots filled and whether it matches.
export function checkJoints(puzzle, placement) {
  const byId = Object.fromEntries(puzzle.pieces.map(p => [p.id, p]));
  return joints().map(([a, sa, b, sb]) => {
    const A = byId[placement[a]], B = byId[placement[b]];
    if (!A || !B) return { a, sa, b, sb, state: 'open' };
    const ea = A.edges[sa], eb = B.edges[sb];
    const ok = !!(ea && eb && !ea.decoy && !eb.decoy && ea.pair === eb.pair && ea.half !== eb.half);
    return { a, sa, b, sb, state: ok ? 'match' : 'clash' };
  });
}
export const solved = (puzzle, placement) => placement.every(x => x != null) && checkJoints(puzzle, placement).every(j => j.state === 'match');

// How many full arrangements (with the anchor fixed) match on every joint? A fair puzzle has exactly one.
export function countSolutions(puzzle) {
  const ids = puzzle.pieces.map(p => p.id).filter(id => id !== puzzle.anchor), n = COLS * ROWS;
  let count = 0;
  const place = Array(n).fill(null); place[0] = puzzle.anchor;
  (function rec(slot, left) {
    if (slot === n) { if (solved(puzzle, place)) count++; return; }
    for (const id of left) { place[slot] = id; rec(slot + 1, left.filter(x => x !== id)); }
    place[slot] = null;
  })(1, ids);
  return count;
}
// For the Hint button: the first slot that is empty or wrong, and the piece that belongs there.
export function hintFor(puzzle, placement) {
  for (let s = 0; s < placement.length; s++) { const want = puzzle.pieces.find(p => p.home === s).id; if (placement[s] !== want) return { slot: s, piece: want }; }
  return null;
}
