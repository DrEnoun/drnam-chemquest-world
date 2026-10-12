// World 4 rules for Bond Glacier: Lewis structures and VSEPR. Molecules and their layouts are in data/bonds.json.
// Everything here is plain functions so the tests can check the chemistry without a browser.
export const OCTET = e => e === 'H' ? 2 : 8;
export const SHAPES = {
  linear: { label: 'Linear', angle: '180°' },
  bent: { label: 'Bent', angle: 'under 109.5° (the lone pairs squeeze the bonds)' },
  trigonal_planar: { label: 'Trigonal planar', angle: '120°' },
  trigonal_pyramidal: { label: 'Trigonal pyramidal', angle: 'about 107° (the lone pair squeezes the bonds)' },
  tetrahedral: { label: 'Tetrahedral', angle: '109.5°' },
};
export const SHAPE_IDS = Object.keys(SHAPES);

// the molecule as plain objects: { atoms: [{ e, x, y }], links: [[a, b]] }
export function parseMolecule(raw) {
  return { ...raw, atoms: raw.atoms.map(([e, x, y]) => ({ e, x, y })) };
}
export const degree = (mol, i) => mol.links.filter(l => l.includes(i)).length;
export const centralIndex = mol => mol.atoms.reduce((best, _, i) => degree(mol, i) > degree(mol, best) ? i : best, 0);

export function valenceTotal(mol, valence) { return mol.atoms.reduce((n, a) => n + valence[a.e], 0); }
export function valenceSum(mol, valence) { return mol.atoms.map(a => `${a.e} ${valence[a.e]}`).join(' + '); }

// Electrons "around" each atom: every bond order unit is a shared pair (2 electrons), plus its own lone pairs.
export function evaluate(mol, orders, lps, valence) {
  const complete = orders.every(o => o > 0);
  const around = mol.atoms.map(() => 0);
  mol.links.forEach(([a, b], k) => { around[a] += 2 * orders[k]; around[b] += 2 * orders[k]; });
  const atoms = mol.atoms.map((a, i) => ({ i, e: a.e, have: around[i] + 2 * lps[i], need: OCTET(a.e), formal: valence[a.e] - 2 * lps[i] - around[i] / 2 }));
  const used = orders.reduce((n, o) => n + 2 * o, 0) + 2 * lps.reduce((n, l) => n + l, 0);
  const expected = valenceTotal(mol, valence);
  const bad = atoms.find(a => a.have !== a.need);
  const charged = atoms.find(a => a.formal !== 0);          // a neutral molecule: every atom should have its usual number of bonds
  return { complete, atoms, used, expected, charged, ok: complete && !bad && used === expected && !charged, bad };
}
export function explain(res, mol, valence, names) {
  if (!res.complete) return 'Fill every bond first: drag a bond onto each empty link.';
  if (res.bad) {
    const a = res.bad, nm = names[a.e][0].toUpperCase() + names[a.e].slice(1);
    const rule = a.e === 'H' ? 'Hydrogen needs 2 electrons (a duet)' : `${nm} needs 8 electrons (an octet)`;
    return `${nm} has ${a.have} electrons around it. ${rule}. ${a.have < a.need ? 'Add a lone pair, or a higher bond order.' : 'That is too many: take a lone pair away, or use a lower bond order.'}`;
  }
  if (res.used === res.expected && res.charged) {
    const a = res.charged;
    return `Every atom has a full shell and the total is right, but ${names[a.e]} would carry a charge. In a neutral molecule each atom makes its usual number of bonds (C 4, N 3, O 2, H and F 1). Try moving a bond order.`;
  }
  return `Every atom is full, but you have used ${res.used} electrons and ${mol.formula} has ${res.expected} valence electrons (${valenceSum(mol, valence)}). Check the bond orders.`;
}

// Compass slots where a lone pair can sit: the ones that do not point at a bond.
export const COMPASS = [{ id: 'N', dx: 0, dy: -1 }, { id: 'E', dx: 1, dy: 0 }, { id: 'S', dx: 0, dy: 1 }, { id: 'W', dx: -1, dy: 0 }];
export function lpSlots(mol, i) {
  const a = mol.atoms[i], dirs = [];
  for (const [p, q] of mol.links) if (p === i || q === i) { const o = mol.atoms[p === i ? q : p]; dirs.push(Math.atan2(o.y - a.y, o.x - a.x)); }
  return COMPASS.filter(c => dirs.every(d => { let diff = Math.abs(Math.atan2(c.dy, c.dx) - d); if (diff > Math.PI) diff = 2 * Math.PI - diff; return diff * 180 / Math.PI >= 46; }));
}

// Every way to choose bond orders (1 to 3) so that each atom is full, the electron total is right and no atom is charged.
export function solutions(mol, valence) {
  const out = [], n = mol.links.length, orders = new Array(n).fill(1);
  const rec = k => {
    if (k === n) {
      const lps = mol.atoms.map((a, i) => (OCTET(a.e) - 2 * mol.links.reduce((s, [p, q], j) => s + (p === i || q === i ? orders[j] : 0), 0)) / 2);
      if (lps.every(l => l >= 0 && Number.isInteger(l))) { const r = evaluate(mol, orders, lps, valence); if (r.ok) out.push({ orders: [...orders], lps }); }
      return;
    }
    for (let o = 1; o <= 3; o++) { orders[k] = o; rec(k + 1); }
  };
  rec(0); return out;
}

// VSEPR: regions = atoms bonded to the central atom (a double or triple bond counts once) + its lone pairs.
export function regionsOf(mol, lps) { const c = centralIndex(mol); return { central: c, bonds: degree(mol, c), lone: lps[c], total: degree(mol, c) + lps[c] }; }
export function shapeOf(mol, lps) {
  const { bonds, lone } = regionsOf(mol, lps);
  if (bonds === 1 || (bonds === 2 && lone === 0)) return 'linear';
  if (bonds === 2) return 'bent';
  if (bonds === 3 && lone === 0) return 'trigonal_planar';
  if (bonds === 3 && lone === 1) return 'trigonal_pyramidal';
  if (bonds === 4 && lone === 0) return 'tetrahedral';
  return null;
}
export function shapeText(mol, lps, names) {
  if (mol.atoms.length === 2) return `${mol.formula}: a molecule of only two atoms is always linear.`;
  const r = regionsOf(mol, lps), s = SHAPES[shapeOf(mol, lps)], c = names[mol.atoms[r.central].e];
  const lone = r.lone === 0 ? 'no lone pairs' : r.lone === 1 ? '1 lone pair' : `${r.lone} lone pairs`;
  const arr = { 2: 'linear', 3: 'trigonal planar', 4: 'tetrahedral' }[r.total];
  const bondWord = r.bonds === 1 ? '1 bonded atom' : `${r.bonds} bonded atoms`;
  return `${mol.formula} (${c} is the central atom): ${bondWord} and ${lone} make ${r.total} electron regions, which spread out in a ${arr} arrangement. The atoms form a ${s.label.toLowerCase()} shape, with bond angles of ${s.angle}.`;
}
export const COINS_PER_STEP = 10, ROUND_BONUS = 5, XP_PER_STEP = 12;
