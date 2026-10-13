// World 7 — Reaction Volcano: the chemistry rules, with no screen code, so they can be tested in Node.
// A coefficient in an equation is the number of molecules, so the player balances an equation by collecting
// the right number of each reactant molecule. The cauldron then turns them into products, and every atom
// that goes in has to come out: if some would be left over, the equation is not balanced.

// ---------- formulae ----------
// parseFormula('Ca(OH)2') -> { Ca: 1, O: 2, H: 2 }. Handles brackets and numbers after them.
export function parseFormula(f) {
  let i = 0;
  const group = () => {
    const out = {};
    while (i < f.length && f[i] !== ')') {
      let part;
      if (f[i] === '(') { i++; part = group(); i++; }
      else {
        const m = /^[A-Z][a-z]?/.exec(f.slice(i));
        if (!m) throw new Error(`Cannot read formula ${f}`);
        i += m[0].length; part = { [m[0]]: 1 };
      }
      const n = /^\d+/.exec(f.slice(i)); const k = n ? +n[0] : 1; if (n) i += n[0].length;
      for (const [el, c] of Object.entries(part)) out[el] = (out[el] || 0) + c * k;
    }
    return out;
  };
  const r = group();
  if (i !== f.length) throw new Error(`Cannot read formula ${f}`);
  return r;
}

// Total atoms in a collection of molecules, e.g. { H2: 2, O2: 1 } -> { H: 4, O: 2 }
export function atomsOf(counts) {
  const out = {};
  for (const [f, n] of Object.entries(counts)) for (const [el, c] of Object.entries(parseFormula(f))) out[el] = (out[el] || 0) + c * n;
  for (const k of Object.keys(out)) if (!out[k]) delete out[k];
  return out;
}
const sameAtoms = (a, b) => { const ks = new Set([...Object.keys(a), ...Object.keys(b)]); for (const k of ks) if ((a[k] || 0) !== (b[k] || 0)) return false; return true; };
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

// Every product-count combination (each 0..max), smallest totals first.
function* productCombos(products, max = 24) {
  const n = products.length, cur = new Array(n).fill(0);
  function* rec(j) { if (j === n) { yield cur.slice(); return; } for (let k = 0; k <= max; k++) { cur[j] = k; yield* rec(j + 1); } }
  yield* rec(0);
}

// The product counts that use up exactly the atoms in the bag, or null if none can.
export function exactProducts(bagAtoms, products) {
  for (const m of productCombos(products)) {
    if (!m.some(Boolean)) continue;
    if (sameAtoms(atomsOf(Object.fromEntries(products.map((p, j) => [p, m[j]]))), bagAtoms)) return m;
  }
  return null;
}

// When atoms do not balance: the most products the cauldron can make, and the atoms left over.
export function bestFit(bagAtoms, products) {
  let best = null;
  for (const m of productCombos(products, 16)) {
    const used = atomsOf(Object.fromEntries(products.map((p, j) => [p, m[j]])));
    if (Object.entries(used).some(([el, c]) => c > (bagAtoms[el] || 0))) continue;
    const total = Object.values(used).reduce((a, b) => a + b, 0);
    if (!best || total > best.total) best = { m, total, used };
  }
  const left = {};
  for (const [el, c] of Object.entries(bagAtoms)) { const r = c - ((best && best.used[el]) || 0); if (r > 0) left[el] = r; }
  return { products: best ? best.m : products.map(() => 0), left };
}

// ---------- equations ----------
export const coeffStr = n => (n === 1 ? '' : String(n));
// Plain-text equation, e.g. equation(['H2','O2'],[2,1],['H2O'],[2]) -> '2H2 + O2 → 2H2O'
export function equation(reactants, rc, products, pc) {
  const side = (fs, cs) => fs.map((f, i) => (cs ? coeffStr(cs[i]) : '') + f).join(' + ');
  return `${side(reactants, rc)} → ${side(products, pc)}`;
}
// Subscripts for display: 'H2O' -> 'H₂O'
const SUB = '₀₁₂₃₄₅₆₇₈₉';
export const pretty = f => f.replace(/\d/g, d => SUB[d]);
// '1 O atom was', '2 H atoms were', '1 C and 2 H atoms were'
export function leftText(left) {
  const e = Object.entries(left), total = e.reduce((a, [, n]) => a + n, 0);
  return `${e.map(([el, n]) => `${n} ${el}`).join(' and ')} atom${total === 1 ? ' was' : 's were'}`;
}
export const atomList = atoms => Object.entries(atoms).map(([el, n]) => `${el} ${n}`).join(' · ');

// Is this equation (with these coefficients) balanced?
export function isBalanced(reactants, rc, products, pc) {
  return sameAtoms(atomsOf(Object.fromEntries(reactants.map((f, i) => [f, rc[i]]))), atomsOf(Object.fromEntries(products.map((f, i) => [f, pc[i]]))));
}

// ---------- the cauldron ----------
// quest: { reactants, products, coeffs: [reactant coeffs..., product coeffs...] }; bag: { formula: count }
// Returns { ok, kind, message, products?, left? }. kind: empty | stranger | missing | unbalanced | notSmallest | ok
export function checkMix(quest, bag) {
  const inBag = Object.entries(bag).filter(([, n]) => n > 0);
  if (!inBag.length) return { ok: false, kind: 'empty', message: 'Your bag is empty. Walk over the molecules on the island to collect them, then come back to the cauldron.' };
  const strangers = inBag.filter(([f]) => !quest.reactants.includes(f)).map(([f]) => f);
  if (strangers.length) {
    const prod = strangers.filter(f => quest.products.includes(f)), other = strangers.filter(f => !quest.products.includes(f));
    const it = strangers.length > 1 ? 'them' : 'it';
    const parts = [];
    if (prod.length) parts.push(`${prod.map(pretty).join(' and ')} ${prod.length > 1 ? 'are products' : 'is a product'} (right side): ${prod.length > 1 ? 'they come' : 'it comes'} out of the cauldron, not in.`);
    if (other.length) parts.push(`${other.map(pretty).join(' and ')} ${other.length > 1 ? 'are' : 'is'} not in this equation at all.`);
    return { ok: false, kind: 'stranger', strangers, message: `${parts.join(' ')} Only the reactants (left side) go in. Tap ${it} in your bag to drop ${it}.` };
  }
  const missing = quest.reactants.filter(f => !(bag[f] > 0));
  if (missing.length) return { ok: false, kind: 'missing', missing, message: `You still need ${missing.map(pretty).join(' and ')}. Every reactant on the left side must go in.` };
  const atoms = atomsOf(bag);
  const m = exactProducts(atoms, quest.products);
  if (!m) {
    const fit = bestFit(atoms, quest.products);
    const made = quest.products.map((p, j) => fit.products[j] ? `${coeffStr(fit.products[j])}${pretty(p)}` : null).filter(Boolean).join(' + ');
    return {
      ok: false, kind: 'unbalanced', left: fit.left, products: fit.products,
      message: `${made ? `The cauldron could make ${made}, but` : 'Nothing could form:'} ${leftText(fit.left)} left over. Atoms cannot appear or vanish in a reaction, so change how many of each molecule you bring.`,
    };
  }
  const all = [...quest.reactants.map(f => bag[f]), ...m], k = all.reduce(gcd);
  if (k > 1) return { ok: false, kind: 'notSmallest', products: m, factor: k, message: `Balanced, but too big! Every number divides by ${k}. Equations use the smallest whole numbers, so put some molecules back.` };
  return { ok: true, kind: 'ok', products: m, message: `Balanced: ${equation(quest.reactants.map(pretty), quest.reactants.map(f => bag[f]), quest.products.map(pretty), m)}. ${atomList(atoms)} atoms on each side.` };
}

// ---------- limiting reactant ----------
// counts: how many of each reactant molecule; coeffs: the balanced reactant coefficients.
export function limiting(reactants, coeffs, counts) {
  const ratio = reactants.map((f, i) => counts[f] / coeffs[i]);
  const lo = Math.min(...ratio), extent = Math.floor(lo);
  return {
    limiting: reactants.filter((_, i) => ratio[i] === lo),
    extent,
    leftover: Object.fromEntries(reactants.map((f, i) => [f, counts[f] - extent * coeffs[i]]).filter(([, n]) => n > 0)),
  };
}

// ---------- the island ----------
// The map is a grid of characters in data/reactions.json. Solid tiles cannot be walked through.
export const SOLID = new Set(['~', 'T', 'R', 'L', 'V', 'C', 'B', 'N']);
export function parseIsland(rows) {
  const h = rows.length, w = rows[0].length, find = ch => { for (let y = 0; y < h; y++) { const x = rows[y].indexOf(ch); if (x >= 0) return { x, y }; } return null; };
  return { w, h, rows, start: find('@'), cauldron: find('C'), npc: find('N'), solid: (x, y) => x < 0 || y < 0 || x >= w || y >= h || SOLID.has(rows[y][x]) };
}
// Walkable tiles far enough from the start, the cauldron and the quest giver for a molecule to sit on.
export function spawnTiles(island) {
  const out = [], keep = [island.start, island.cauldron, island.npc].filter(Boolean);
  for (let y = 0; y < island.h; y++) for (let x = 0; x < island.w; x++) {
    if (island.solid(x, y) || 'sg'.indexOf(island.rows[y][x]) < 0) continue;
    if (keep.some(p => Math.abs(p.x - x) + Math.abs(p.y - y) < 3)) continue;
    out.push({ x, y });
  }
  return out;
}
// The molecules to scatter for a quest: the balanced amounts, plus spares and decoys so counting matters.
export function questTokens(quest) {
  if (quest.field) return Object.entries(quest.field).flatMap(([f, n]) => Array(n).fill(f));
  const out = [];
  quest.reactants.forEach((f, i) => { for (let k = 0; k < quest.coeffs[i] + (quest.spare ?? 1); k++) out.push(f); });
  (quest.decoys || []).forEach(f => out.push(f));
  return out;
}
// Place tokens on distinct spawn tiles, spread out (rng gives 0..1).
export function scatter(tokens, tiles, rng = Math.random) {
  const pool = tiles.slice(), placed = [];
  for (const f of tokens) {
    let best = null, bestD = -1;
    for (let tries = 0; tries < 12 && pool.length; tries++) {
      const i = Math.floor(rng() * pool.length), t = pool[i];
      const d = placed.length ? Math.min(...placed.map(p => Math.abs(p.x - t.x) + Math.abs(p.y - t.y))) : 99;
      if (d > bestD) { best = i; bestD = d; }
      if (d >= 3) break;
    }
    if (best == null) break;
    const [t] = pool.splice(best, 1); placed.push({ ...t, f });
  }
  return placed;
}
