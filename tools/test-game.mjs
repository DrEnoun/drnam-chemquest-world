// ChemQuest checks: every Diner Dash order has the right name and formula, the serve checker
// gives the right verdicts, and every avatar sprite row is the same width.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formulaOf, checkServe, buildOrders, orderPool, buildTray, orderName, starsFor, tipFor } from '../js/diner-logic.js';
import { worldProgress, worldStates, walkPath, starKey } from '../js/progress.js';
import { EMBLEMS } from '../js/badges.js';
import { newGame, flip, clearPending, pickSets, starsForHearts } from '../js/memory-logic.js';
import { SHAPES } from '../js/shapes.js';
import { TRACKS, SCREEN_TRACK, MAJOR_SCALE, STEPS_PER_BAR, BARS, LOOP_STEPS, midiFreq, chordTones, eighth } from '../js/music.js';
import { AUFBAU, BOXES, newState, check, legalTargets, place, configString, electronCount, crateCount, complete, lowestOpen, parseGrid, step, startGame, solve, liveCells } from '../js/orbital-logic.js';
import { matches, matching, buildRound, describe, wrongText } from '../js/pop-logic.js';
import { PROPS, promptFor, orderOf, minGap, relation, judge, wrongText as trendWrong, factText, ruleFor } from '../js/trend-logic.js';
import { parseMolecule, evaluate, explain, lpSlots, solutions, shapeOf, shapeText, regionsOf, valenceTotal, centralIndex, SHAPE_IDS } from '../js/bond-logic.js';
import { MONSTERS, GEOMETRY, ATOM, MOODS } from '../js/monsters.js';
import { OPTIONS, DEFAULT_AVATAR, randomAvatar, WIDTH, HEIGHT } from '../js/avatar.js';
import { buildCourse, judgeChange, judgeGate, hits, passable, createPoseReader, LANES } from '../js/runner-logic.js';
import { parseFormula, atomsOf, pretty, equation, isBalanced, checkMix, limiting, parseIsland, spawnTiles, questTokens, scatter } from '../js/reaction-logic.js';

const d = JSON.parse(readFileSync('data/diner.json', 'utf8'));
const byId = Object.fromEntries(d.ions.map(i => [i.id, i]));

// Independent answer key (written out by hand, not computed): name -> formula
const KEY = {
  'sodium chloride': 'NaCl', 'potassium bromide': 'KBr', 'lithium fluoride': 'LiF', 'magnesium oxide': 'MgO',
  'calcium sulfide': 'CaS', 'silver chloride': 'AgCl',
  'magnesium chloride': 'MgCl2', 'calcium bromide': 'CaBr2', 'sodium oxide': 'Na2O', 'potassium sulfide': 'K2S',
  'aluminium chloride': 'AlCl3', 'aluminium oxide': 'Al2O3', 'lithium sulfide': 'Li2S', 'calcium fluoride': 'CaF2',
  'sodium hydroxide': 'NaOH', 'potassium nitrate': 'KNO3', 'calcium carbonate': 'CaCO3', 'sodium sulfate': 'Na2SO4',
  'magnesium nitrate': 'Mg(NO3)2', 'calcium hydroxide': 'Ca(OH)2', 'aluminium hydroxide': 'Al(OH)3',
  'ammonium sulfate': '(NH4)2SO4', 'ammonium chloride': 'NH4Cl', 'calcium phosphate': 'Ca3(PO4)2',
  'aluminium sulfate': 'Al2(SO4)3', 'sodium phosphate': 'Na3PO4', 'potassium carbonate': 'K2CO3',
  'magnesium hydroxide': 'Mg(OH)2',
};
// British spellings required by the brief
const NAMES = new Set(d.ions.map(i => i.name));
['aluminium', 'sulfate', 'sulfide'].forEach(n => assert.ok(NAMES.has(n), `${n} missing`));
['aluminum', 'sulphate', 'sulphide'].forEach(n => assert.ok(!NAMES.has(n), `use British spelling, not ${n}`));

// Ions: ids unique, id = symbol + charge, sign matches the id
const ids = new Set();
for (const i of d.ions) {
  assert.ok(!ids.has(i.id), `duplicate ion ${i.id}`); ids.add(i.id);
  const mag = Math.abs(i.charge);
  assert.equal(i.id, `${i.sym}${mag > 1 ? mag : ''}${i.charge > 0 ? '+' : '-'}`, `${i.id}: id does not match symbol and charge`);
  assert.ok(i.charge !== 0 && mag <= 3);
  assert.equal(!!i.poly, /[A-Z][a-z]?\d|[A-Z]{2}/.test(i.sym), `${i.id}: poly flag`);
}

let orders = 0;
for (const lv of d.levels) {
  const pool = orderPool(lv, d.levels);
  assert.ok(pool.length >= lv.customers, `level ${lv.id}: needs at least ${lv.customers} orders`);
  assert.ok(lv.decoys + 2 <= d.ions.length);
  const seen = new Set(), cats = {};
  if (lv.mixFrom) lv.mixFrom.forEach(id => assert.ok(d.levels.some(l => l.id === id && !l.mixFrom), `level ${lv.id}: mixFrom ${id} must be an ordinary shift`));
  for (const o of pool) {
    const cat = byId[o.cation], an = byId[o.anion];
    assert.ok(cat && an, `level ${lv.id}: unknown ion in ${JSON.stringify(o)}`);
    assert.ok(cat.charge > 0 && an.charge < 0, `${cat.id}/${an.id}: cation must be + and anion −`);
    const name = orderName(cat, an), f = formulaOf(cat, an);
    assert.ok(!seen.has(name), `level ${lv.id}: ${name} listed twice`); seen.add(name);
    if (lv.boss) { cats.simple ||= f.nc === 1 && f.na === 1 && !cat.poly && !an.poly; cats.unequal ||= (f.nc !== 1 || f.na !== 1) && !cat.poly && !an.poly; cats.poly ||= cat.poly || an.poly; }
    assert.equal(f.text, KEY[name], `${name}: expected ${KEY[name]}, got ${f.text}`);
    assert.equal(f.nc * cat.charge + f.na * an.charge, 0, `${name}: charges do not cancel`);
    // level shape: 1 = all 1:1 monatomic, 2 = unequal monatomic, 3 = at least one polyatomic ion
    if (lv.id === 1) assert.ok(f.nc === 1 && f.na === 1 && !cat.poly && !an.poly, `${name}: level 1 must be simple 1:1`);
    if (lv.id === 2) assert.ok((f.nc !== 1 || f.na !== 1) && !cat.poly && !an.poly, `${name}: level 2 must be unequal monatomic`);
    if (lv.id === 3) assert.ok(cat.poly || an.poly, `${name}: level 3 must include a polyatomic ion`);
    orders++;
  }
  if (lv.boss) assert.ok(cats.simple && cats.unequal && cats.poly, `boss shift ${lv.id} must mix all three kinds of order`);
  // Every order can be served correctly, and tricks are caught
  for (const o of buildOrders(lv, d.ions, Math.random, d.levels)) {
    const f = formulaOf(o.cat, o.an);
    const good = { [o.cat.id]: f.nc, [o.an.id]: f.na };
    assert.equal(checkServe(o, good).ok, true);
    const tray = buildTray(o, d.ions, lv.decoys);
    assert.equal(tray.length, lv.decoys + 2); assert.equal(new Set(tray.map(i => i.id)).size, tray.length);
    assert.ok(tray.includes(o.cat) && tray.includes(o.an));
    assert.equal(checkServe(o, { [o.cat.id]: f.nc + 1, [o.an.id]: f.na }).kind, 'unbalanced');
    assert.equal(checkServe(o, { [o.cat.id]: f.nc * 2, [o.an.id]: f.na * 2 }).kind, 'not-simplest');
    assert.equal(checkServe(o, { [o.cat.id]: f.nc }).kind, 'wrong-ions');
    assert.equal(checkServe(o, { ...good, [d.ions.find(i => i.id !== o.cat.id && i.id !== o.an.id).id]: 1 }).kind, 'wrong-ions');
    assert.equal(checkServe(o, {}).kind, 'empty');
  }
}

// Worked example from the brief: aluminium oxide = 2 Al3+ : 3 O2-
const alO = { cat: byId['Al3+'], an: byId['O2-'] };
assert.deepEqual(formulaOf(alO.cat, alO.an), { nc: 2, na: 3, text: 'Al2O3' });
assert.equal(checkServe(alO, { 'Al3+': 1, 'O2-': 1 }).kind, 'unbalanced');
assert.equal(checkServe(alO, { 'Al3+': 4, 'O2-': 6 }).kind, 'not-simplest');
assert.match(checkServe(alO, { 'Al3+': 2, 'O2-': 3 }).message, /Al₂O₃/);

assert.deepEqual([1, 2, 3, 0].map(starsFor), [1, 2, 3, 1]);
assert.ok(tipFor(1) > tipFor(0) && tipFor(0) >= 5);

// Avatar options: every list non-empty, sensible defaults, sprite size matches the layout the scene and map expect
assert.equal(WIDTH, 32); assert.equal(HEIGHT, 44);
for (const k of ['skin', 'hairStyle', 'hair', 'coat']) assert.ok(OPTIONS[k].length >= 3, `${k}: needs at least 3 choices`);
assert.ok(OPTIONS.hairStyle.includes('tudung'));
[...OPTIONS.skin, ...OPTIONS.hair, ...OPTIONS.coat].forEach(c => assert.match(c, /^#[0-9a-f]{6}$/i));
assert.ok(DEFAULT_AVATAR.skin < OPTIONS.skin.length && DEFAULT_AVATAR.hair < OPTIONS.hair.length && DEFAULT_AVATAR.coat < OPTIONS.coat.length);
for (let i = 0; i < 50; i++) {
  const a = randomAvatar();
  assert.ok(a.skin < OPTIONS.skin.length && a.hair < OPTIONS.hair.length && a.coat < OPTIONS.coat.length && OPTIONS.hairStyle.includes(a.hairStyle));
}

// Overworld: eight worlds in order, pins on the map, unique badges, sensible unlock rules
const wd = JSON.parse(readFileSync('data/worlds.json', 'utf8'));
const W = wd.worlds;
const mem = JSON.parse(readFileSync('data/memory.json', 'utf8'));
const orb = JSON.parse(readFileSync('data/orbitals.json', 'utf8'));
const fal = JSON.parse(readFileSync('data/falls.json', 'utf8'));
const trn = JSON.parse(readFileSync('data/trends.json', 'utf8'));
const bnd = JSON.parse(readFileSync('data/bonds.json', 'utf8'));
const EL = JSON.parse(readFileSync('data/elements.json', 'utf8')).elements;
const rxd = JSON.parse(readFileSync('data/reactions.json', 'utf8'));
const end = JSON.parse(readFileSync('data/energy.json', 'utf8'));
assert.deepEqual(W.map(w => w.id), [1, 2, 3, 4, 5, 6, 7, 8]);
assert.equal(new Set(W.map(w => w.badge)).size, 8, 'badge names must be unique');
assert.equal(new Set(W.map(w => w.accent)).size, 8, 'world colours must be unique');
for (const w of W) {
  assert.ok(EMBLEMS[w.emblem], `world ${w.id}: unknown emblem ${w.emblem}`);
  assert.ok(w.pin[0] > 56 && w.pin[0] < wd.map.width - 56 && w.pin[1] > 60 && w.pin[1] < wd.map.height - 40, `world ${w.id}: pin too close to the map edge`);
  assert.ok(w.tip && w.topic && w.gameplay && w.callout);
  if (w.playable) { assert.ok(w.blurb); w.levelIds.forEach(id => assert.ok((w.id === 6 ? d.levels : w.id === 2 ? orb.levels : w.id === 3 ? fal.levels : w.id === 4 ? trn.levels : w.id === 5 ? bnd.levels : w.id === 7 ? rxd.levels : w.id === 8 ? end.levels : mem.levels).some(l => l.id === id), `world ${w.id}: unknown level ${id}`)); }
  else assert.ok(!w.levelIds, `world ${w.id}: unbuilt worlds have no levels yet`);
}
for (let i = 1; i < W.length; i++) assert.ok(W[i].pin[1] < W[i - 1].pin[1], 'worlds climb the map from bottom to top');
// landscape layout for wide screens: every world has a position, they run left to right, and nothing touches the edges
assert.deepEqual(wd.mapWide, { width: 800, height: 360 });
for (const w of W) assert.ok(w.pinWide[0] >= 60 && w.pinWide[0] <= wd.mapWide.width - 60 && w.pinWide[1] >= 110 && w.pinWide[1] <= wd.mapWide.height - 60, `world ${w.id}: landscape pin too close to the edge`);
for (let i = 1; i < W.length; i++) { assert.ok(W[i].pinWide[0] - W[i - 1].pinWide[0] >= 95, 'landscape islands need room for a bridge between them'); assert.notEqual(W[i].pinWide[1], W[i - 1].pinWide[1], 'landscape islands zigzag so bridges are diagonal'); }
// Fresh save: only World 1 is open (Ion Diner opens after World 5)
assert.deepEqual(worldStates(W, {}).map(s => s.unlocked), [true, false, false, false, false, false, false, false]);
assert.equal(starKey(6, 2), '6.2');
assert.equal(worldStates(W, {}).filter(s => s.earned).length, 0);
assert.ok(worldStates(W, {}, true).every(s => s.unlocked), 'Zen mode opens every world');
assert.equal(worldStates(W, {}, true).filter(s => s.earned).length, 0, 'Zen mode earns no badges by itself');
assert.deepEqual(worldStates(W, {}, false).map(s => s.unlocked), [true, false, false, false, false, false, false, false], 'Arcade is the default');
assert.equal(worldStates(W, { '1.1': 3, '1.2': 3, '1.3': 3, '1.4': 3, '2.1': 3, '2.2': 3, '2.3': 3, '2.4': 3, '3.1': 3, '3.2': 3, '3.3': 3, '3.4': 3, '4.1': 3, '4.2': 3, '4.3': 3, '4.4': 3 })[5].unlocked, false, 'Ion Diner stays shut until World 5 is cleared');
assert.equal(worldStates(W, { '5.1': 1, '5.2': 1, '5.3': 1, '5.4': 1 })[5].unlocked, true, 'clearing World 5 opens World 6');
assert.equal(worldStates(W, { '5.1': 1, '5.2': 1, '5.3': 1, '5.4': 1 })[6].unlocked, false, 'Reaction Volcano waits for Ion Diner');
assert.equal(worldStates(W, { '6.1': 1, '6.2': 1, '6.3': 1, '6.4': 1 })[6].unlocked, true, 'clearing World 6 opens World 7');
assert.equal(worldStates(W, { '7.1': 1, '7.2': 1, '7.3': 1, '7.4': 1 })[7].unlocked, true, 'clearing World 7 opens World 8');
// Clearing every Ion Diner shift earns the World 6 badge; one shift is not enough
assert.equal(worldProgress(W[5], { '6.1': 3, '6.2': 2 }).cleared, false);
assert.equal(worldProgress(W[5], { '6.1': 3, '6.2': 2, '6.3': 1 }).cleared, false, 'the boss shift must be cleared too');
const done = worldProgress(W[5], { '6.1': 3, '6.2': 2, '6.3': 1, '6.4': 2 });
assert.deepEqual([done.cleared, done.starSum, done.got, done.total], [true, 8, 4, 4]);
assert.equal(worldStates(W, { '6.1': 3, '6.2': 2, '6.3': 1, '6.4': 2 })[5].earned, true);
// World 1's levels do not collide with Ion Diner's stars
assert.equal(worldProgress(W[0], { '6.1': 3, '6.2': 3, '6.3': 3, '6.4': 3 }).got, 0);
assert.equal(worldStates(W, { '1.1': 3, '1.2': 3, '1.3': 3, '1.4': 1 })[1].unlocked, true, 'clearing World 1 opens World 2');
// A world opens when the one before it is cleared
const fake = [{ id: 1, levelIds: [1] }, { id: 2, levelIds: [2] }, { id: 3, levelIds: [3] }];
assert.deepEqual(worldStates(fake, {}).map(s => s.unlocked), [true, false, false]);
assert.deepEqual(worldStates(fake, { '1.1': 1 }).map(s => s.unlocked), [true, true, false]);
assert.deepEqual(walkPath(1, 4), [1, 2, 3, 4]);
assert.deepEqual(walkPath(6, 5), [6, 5]);

// Molecule monsters: each one is a real molecule with a correct, British-spelt fact; geometry matches the chemistry
assert.equal(new Set(MONSTERS.map(m => m.id)).size, MONSTERS.length);
for (const m of MONSTERS) { assert.ok(m.name && m.fact.length > 40, `${m.id}: needs a name and a fact`); assert.ok(!/color|center|polariz/i.test(m.fact), `${m.id}: use British spelling`); }
assert.deepEqual(GEOMETRY, { water: 104.5, co2: 180, nh3: 107, ch4: 109.5 });
assert.match(MONSTERS.find(m => m.id === 'water').fact, /104\.5/); assert.match(MONSTERS.find(m => m.id === 'co2').fact, /180/);
assert.match(MONSTERS.find(m => m.id === 'nh3').fact, /107/); assert.match(MONSTERS.find(m => m.id === 'ch4').fact, /109\.5/);
for (const a of ['H', 'O', 'C', 'N', 'Na', 'Cl']) assert.ok(ATOM[a].r > 0 && /^#[0-9a-f]{6}$/i.test(ATOM[a].col));
assert.deepEqual(MOODS, ['happy', 'cheer', 'sad', 'shock']);
assert.ok(ATOM.Cl.r > ATOM.Na.r, 'Cl⁻ is larger than Na⁺');

// ---------- World 1 memory match: every card is checked against an independent answer key ----------
const NAME_FORMULA = {
  sulfate: 'SO4^2-', nitrate: 'NO3^-', carbonate: 'CO3^2-', phosphate: 'PO4^3-', hydroxide: 'OH^-', ammonium: 'NH4^+', chloride: 'Cl^-', oxide: 'O^2-', sulfide: 'S^2-',
  'sodium chloride': 'NaCl', 'magnesium oxide': 'MgO', 'calcium carbonate': 'CaCO3', 'aluminium oxide': 'Al2O3', 'magnesium chloride': 'MgCl2',
  'calcium hydroxide': 'Ca(OH)2', 'sodium sulfate': 'Na2SO4', 'ammonium chloride': 'NH4Cl',
  water: 'H2O', 'carbon dioxide': 'CO2', ammonia: 'NH3', methane: 'CH4', 'boron trifluoride': 'BF3',
};
const FORMULA_SHAPE = { H2O: 'bent', CO2: 'linear', NH3: 'trigonal pyramidal', CH4: 'tetrahedral', BF3: 'trigonal planar' };
const SHAPE_ANGLE = { bent: '104.5°', linear: '180°', 'trigonal pyramidal': '≈107°', tetrahedral: '109.5°', 'trigonal planar': '120°' };
assert.deepEqual(mem.levels.map(l => l.id), [1, 2, 3, 4]);
for (const lv of mem.levels) {
  assert.ok(lv.tip && lv.title && lv.subtitle);
  assert.ok(lv.group === 2 || lv.group === 3);
  assert.equal(lv.boss === true, lv.id === 4, 'only the last level is the boss');
  if (lv.boss) assert.ok(lv.time >= 60, 'the boss is timed');
  const uniq = new Set(lv.sets.map(x => x.uniq));
  assert.ok(uniq.size >= lv.pick, `level ${lv.id}: needs ${lv.pick} sets with different uniq keys`);
  assert.equal(new Set(lv.sets.map(x => x.id)).size, lv.sets.length, `level ${lv.id}: duplicate set id`);
  for (const set of lv.sets) {
    assert.equal(set.cards.length, lv.group, `${lv.id}/${set.id}: ${lv.group} cards per set`);
    assert.equal(new Set(set.cards.map(c => c.kind)).size, lv.group, `${set.id}: one card of each kind`);
    assert.ok(set.fact.length > 30 && !/sulphate|sulphide|color|center/i.test(set.fact), `${set.id}: fact`);
    const by = Object.fromEntries(set.cards.map(c => [c.kind, c]));
    if (by.name && by.formula) assert.equal(by.formula.text, NAME_FORMULA[by.name.text], `${set.id}: ${by.name.text} should be ${NAME_FORMULA[by.name.text]}`);
    if (by.formula && by.shape) {
      assert.equal(by.shape.shape, FORMULA_SHAPE[by.formula.text], `${set.id}: ${by.formula.text} should be ${FORMULA_SHAPE[by.formula.text]}`);
      assert.equal(by.shape.angle, SHAPE_ANGLE[by.shape.shape]);
      assert.equal(set.uniq, by.shape.shape, `${set.id}: shape sets must use the shape as their uniq key`);
      assert.ok(SHAPES[by.shape.shape], `${set.id}: no pictogram for ${by.shape.shape}`);
    }
    if (by.name && !by.formula) assert.fail(`${set.id}: a name card needs its formula`);
  }
}
assert.equal(SHAPES.bent.angle, '104.5°'); assert.equal(SHAPES.tetrahedral.angle, '109.5°');
// bond angle in the pictogram matches the real angle: the two outer atoms of "bent" are 104.5° apart
{ const [a, b] = SHAPES.bent.atoms, [cx, cy] = SHAPES.bent.centre, ang = Math.abs(Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx)) * 180 / Math.PI; assert.ok(Math.abs(ang - 104.5) < 1, `bent pictogram angle ${ang}`); }
// pickSets never deals two sets with the same uniq key
const seeded = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
for (let i = 1; i <= 60; i++) for (const lv of mem.levels) { const sets = pickSets(lv, seeded(i)); assert.equal(sets.length, lv.pick); assert.equal(new Set(sets.map(x => x.uniq)).size, sets.length); }
{ // rules: exploring is free, remembering is not
  const lv = mem.levels[0], g = newGame(lv, seeded(7));
  assert.equal(g.cards.length, lv.pick * 2); assert.equal(new Set(g.cards.map(c => c.uid)).size, g.cards.length);
  const find = (setId, not) => g.cards.filter(c => c.setId === setId && c.uid !== not)[0];
  const [A, B] = g.sets;
  const a1 = find(A.id), b1 = find(B.id);
  assert.equal(flip(g, a1.uid).type, 'open'); assert.equal(flip(g, a1.uid).type, 'ignore', 'cannot flip an open card twice');
  let r = flip(g, b1.uid); assert.equal(r.type, 'mismatch'); assert.equal(r.careless, false, 'first look costs nothing'); assert.equal(g.hearts, 3); assert.equal(r.facts.length, 2);
  assert.equal(flip(g, find(A.id, a1.uid).uid).type, 'ignore', 'locked while the mismatch is showing');
  clearPending(g);
  flip(g, a1.uid); r = flip(g, b1.uid); assert.equal(r.careless, true, 'both already seen'); assert.equal(g.hearts, 2); clearPending(g);
  flip(g, a1.uid); r = flip(g, find(A.id, a1.uid).uid); assert.equal(r.type, 'match'); assert.equal(g.matches, 1); assert.equal(g.streak, 1); assert.ok(r.coins >= 8);
  assert.equal(flip(g, a1.uid).type, 'ignore', 'matched cards stay');
  // perfect play wins with the hearts that are left
  for (const s of g.sets.slice(1)) { const [x, y] = g.cards.filter(c => c.setId === s.id); flip(g, x.uid); r = flip(g, y.uid); assert.equal(r.type, 'match'); }
  assert.equal(g.won, true); assert.equal(g.over, true); assert.equal(g.total, lv.pick);
  assert.equal(starsForHearts(g.hearts), 2);
}
{ // three hearts gone ends the level
  const g = newGame(mem.levels[0], seeded(3)), [A, B] = g.sets, a = g.cards.find(c => c.setId === A.id), b = g.cards.find(c => c.setId === B.id);
  flip(g, a.uid); flip(g, b.uid); clearPending(g);
  for (let i = 0; i < 3; i++) { flip(g, a.uid); flip(g, b.uid); if (!g.over) clearPending(g); }
  assert.equal(g.hearts, 0); assert.equal(g.over, true); assert.equal(g.won, false);
}
{ // boss: three cards per molecule; a wrong second card ends the attempt at once
  const g = newGame(mem.levels[3], seeded(11)), [A, B] = g.sets;
  assert.equal(g.cards.length, 12); assert.equal(g.group, 3);
  const ca = g.cards.filter(c => c.setId === A.id), cb = g.cards.find(c => c.setId === B.id);
  assert.equal(flip(g, ca[0].uid).type, 'open'); assert.equal(flip(g, ca[1].uid).type, 'open');
  const r = flip(g, ca[2].uid); assert.equal(r.type, 'match'); assert.equal(r.cards.length, 3); assert.equal(g.matches, 1);
  flip(g, cb.uid); const bad = flip(g, g.cards.find(c => c.setId !== B.id && !g.matched.has(c.uid)).uid); assert.equal(bad.type, 'mismatch'); assert.equal(bad.cards.length, 2);
}

// ---------- Background music: the notes are data, so check the music theory ----------
const inKey = (midi, tonic) => MAJOR_SCALE.includes(((midi - tonic) % 12 + 12) % 12);
assert.deepEqual(Object.keys(TRACKS).sort(), ['diner', 'falls', 'glacier', 'map', 'memory', 'peaks', 'ruins']);
assert.equal(LOOP_STEPS, 32);
for (const [id, t] of Object.entries(TRACKS)) {
  assert.ok(t.name && t.bpm >= 76 && t.bpm <= 130, `${id}: tempo`);
  assert.ok(t.level > 0 && t.level <= 1);
  assert.equal(t.chords.length, BARS, `${id}: one chord per bar`);
  for (const k of ['bass', 'arp', 'kick', 'hat', 'stab']) assert.equal(t[k].length, STEPS_PER_BAR, `${id}.${k} needs ${STEPS_PER_BAR} steps`);
  assert.equal(t.melody.length, BARS);
  t.chords.forEach((c, i) => {
    assert.ok(c.root >= 40 && c.root <= 58, `${id} bar ${i + 1}: bass root ${c.root} out of range`);
    chordTones(c).forEach(n => assert.ok(inKey(n, t.tonic), `${id} bar ${i + 1}: chord tone ${n} is not in the key`));
  });
  assert.ok(inKey(t.chords[0].root, t.tonic) && (t.chords[0].root - t.tonic) % 12 === 0, `${id}: starts on the tonic chord`);
  t.melody.forEach((bar, b) => {
    assert.equal(bar.length, STEPS_PER_BAR, `${id} melody bar ${b + 1}`);
    assert.ok(bar[0] != null, `${id} melody bar ${b + 1} must start on the beat`);
    bar.filter(n => n != null).forEach(n => { assert.ok(inKey(n, t.tonic), `${id} melody note ${n} is not in the key`); assert.ok(n >= 70 && n <= 86, `${id}: melody note ${n} out of a comfortable range`); });
  });
  t.bass.forEach(i => assert.ok(i === null || [0, 1, 2].includes(i)));
  t.arp.forEach(i => assert.ok(i === null || [0, 1, 2, 3].includes(i)));
  assert.ok(t.chords[3].root !== t.chords[0].root, `${id}: the last chord leads back to the first`);
  assert.ok(eighth(t) > 0.2 && eighth(t) < 0.45);
}
assert.ok(Math.abs(midiFreq(69) - 440) < 1e-9 && Math.abs(midiFreq(81) - 880) < 1e-9);
// every screen has a track, and the three kinds of screen do not all play the same loop
for (const screen of ['menu', 'shifts', 'avatar', 'game', 'memory', 'orbital', 'falls', 'peaks', 'bonds', 'reactions', 'runner']) assert.ok(TRACKS[SCREEN_TRACK[screen]], `${screen}: no track`);
assert.equal(new Set(Object.values(SCREEN_TRACK)).size, 7);

// ---------- World 2 Orbital Ruins: chemistry answer key, rules, and proof that every level can be solved ----------
// Independent ground truth (written by hand from the periodic table, not computed): full ground-state configurations
const FULL = { Li: '1s² 2s¹', N: '1s² 2s² 2p³', O: '1s² 2s² 2p⁴', P: '1s² 2s² 2p⁶ 3s² 3p³' };
assert.deepEqual(AUFBAU.slice(0, 5), ['1s', '2s', '2p', '3s', '3p'], 'Aufbau energy order');
assert.deepEqual([BOXES('1s'), BOXES('2p'), BOXES('3d')], [1, 3, 5]);
assert.deepEqual(orb.levels.map(l => l.id), [1, 2, 3, 4]);
for (const lv of orb.levels) {
  const id = `${lv.element.name}`;
  assert.ok(lv.tip && lv.goal && lv.title && lv.subtitle, `${id}: texts`);
  assert.equal(lv.boss === true, lv.id === 4);
  assert.ok(FULL[lv.element.symbol], `${id}: no answer key`);
  // the electrons given plus the electrons to place add up to the atomic number
  const st0 = newState(lv);
  assert.equal(electronCount(st0) + crateCount(lv), lv.element.z, `${id}: electrons do not add up to Z = ${lv.element.z}`);
  // the grid has exactly as many electrons to push as the level asks for, one player, and every socket is used by this level
  const board = parseGrid(lv);
  assert.equal(board.crates.length, crateCount(lv), `${id}: electrons on the board`);
  assert.ok(board.player != null && board.walls.size > 0);
  for (const s of board.sockets.values()) assert.ok(lv.subshells.includes(s.sub) && s.box < BOXES(s.sub), `${id}: bad socket`);
  assert.equal(new Set([...board.sockets.values()].map(s => `${s.sub}${s.box}`)).size, board.sockets.size, `${id}: duplicate socket`);
  for (const sub of lv.subshells) assert.equal([...board.sockets.values()].filter(s => s.sub === sub).length, BOXES(sub), `${id}: every ${sub} orbital needs a socket`);
  // placing the electrons only where the rules allow gives exactly the known configuration (greedy, any legal choice)
  let st = st0;
  for (let i = 0; i < crateCount(lv); i++) { const legal = legalTargets(st); assert.ok(legal.length > 0, `${id}: stuck`); const t = legal[legal.length - 1]; st = place(st, t.sub, t.box); }
  assert.equal(configString(st), FULL[lv.element.symbol], `${id}: configuration`);
  assert.ok(complete(st, lv));
  // rule-by-rule: every wrong placement is refused, with the right rule named
  assert.ok(liveCells(board).size > 0);
  // the level can be completed (shortest solution found by search)
  const sol = solve(lv, 2_000_000);
  assert.ok(sol.moves && sol.moves.length >= 12, `${id}: not solvable (${sol.states} states searched)`);
  // replay the solution with the real step() function
  let r = startGame(lv), g = r.g;
  for (const m of sol.moves) { const out = step(r.board, g, m); assert.ok(out.moved, `${id}: replay failed`); g = out.g; }
  assert.equal(g.crates.length, 0); assert.ok(complete(g.state, lv)); assert.equal(configString(g.state), FULL[lv.element.symbol]);
}
{ // the three rules, one at a time, on nitrogen's 2p subshell (1s and 2s given)
  let st = newState(orb.levels[1]);
  assert.equal(lowestOpen(st), '2p'); assert.deepEqual(legalTargets(st).length, 3);
  assert.equal(check(st, '2p', 0).ok, true);
  st = place(st, '2p', 0);
  assert.equal(check(st, '2p', 0).rule, 'hund', 'second electron into the same p orbital while others are empty');
  assert.equal(check(st, '2p', 1).ok, true); assert.equal(check(st, '2p', 2).ok, true);
  assert.equal(check(st, '1s', 0).rule, 'pauli', 'a full orbital refuses another electron');
  st = place(place(st, '2p', 1), '2p', 2);
  assert.equal(check(st, '2p', 0).ok, true, 'once every orbital has one, pairing is allowed');
  st = place(st, '2p', 0);
  assert.equal(check(st, '2p', 0).rule, 'pauli', 'no third electron in one orbital');
  assert.equal(configString(st), '1s² 2s² 2p⁴');
}
{ // Aufbau on lithium
  const st = newState(orb.levels[0]);
  assert.equal(check(st, '2s', 0).rule, 'aufbau'); assert.match(check(st, '2s', 0).text, /1s is lower in energy than 2s/);
  const st1 = place(place(st, '1s', 0), '1s', 0);
  assert.equal(check(st1, '1s', 0).rule, 'pauli'); assert.equal(check(st1, '2s', 0).ok, true);
  assert.equal(configString(place(st1, '2s', 0)), '1s² 2s¹');
}
{ // pushing into the wrong socket is refused and costs nothing on the board; into the right socket is absorbed
  const lv = orb.levels[0], { board, g } = startGame(lv); const w = board.w;
  const cellOf = (x, y) => y * w + x;
  const bSocket = cellOf(6, 1), crate = cellOf(6, 3);
  assert.ok(board.sockets.has(bSocket) && g.crates.includes(crate));
  let cur = { ...g, player: cellOf(6, 4) };
  let r = step(board, cur, 'U'); assert.ok(r.moved && r.pushed && !r.absorbed); cur = r.g;
  r = step(board, cur, 'U'); assert.ok(!r.moved && r.blocked && r.illegal && r.illegal.rule === 'aufbau', 'pushing into 2s first is refused');
  assert.equal(r.g, cur, 'a refused push changes nothing');
}
console.log('Orbital Ruins OK');
// ---------- World 3 Periodic Falls: element data checked two independent ways, then every round ----------
{
  // (1) group, period and block derived from the electron configuration (simple Aufbau filling), not copied from the data
  const ORDER = [['1s', 2], ['2s', 2], ['2p', 6], ['3s', 2], ['3p', 6], ['4s', 2], ['3d', 10], ['4p', 6], ['5s', 2], ['4d', 10], ['5p', 6], ['6s', 2], ['4f', 14], ['5d', 10], ['6p', 6]];
  const derive = z => {
    let left = z; const occ = [];
    for (const [sub, cap] of ORDER) { if (left <= 0) break; const n = Math.min(cap, left); occ.push([sub, n]); left -= n; }
    const last = occ[occ.length - 1], block = last[0].slice(-1), period = Math.max(...occ.map(([sub]) => +sub[0]));
    const count = sub => (occ.find(([x]) => x === sub) || [0, 0])[1];
    let group;
    if (z === 2) group = 18;
    else if (block === 's') group = last[1];
    else if (block === 'p') group = 12 + last[1];
    else group = 2 + count(last[0]);                       // d-block: s electrons (2) + d electrons
    return { group, period, block };
  };
  assert.equal(new Set(EL.map(e => e.z)).size, EL.length, 'duplicate element');
  for (const e of EL) {
    const d = derive(e.z);
    assert.deepEqual({ group: e.group, period: e.period, block: e.block }, d, `${e.symbol} (Z=${e.z}): group, period or block is wrong`);
    assert.ok(['metal', 'nonmetal', 'metalloid'].includes(e.category) && ['alkali', 'alkaline', 'halogen', 'noble', null].includes(e.family));
    assert.ok(/^[A-Z][a-z]?$/.test(e.symbol) && e.name === e.name.toLowerCase());
  }
  assert.ok(!EL.some(e => ['aluminum', 'cesium', 'sulphur'].includes(e.name)), 'use British spellings');
  assert.deepEqual([EL.find(e => e.z === 13).name, EL.find(e => e.z === 55).name, EL.find(e => e.z === 16).name], ['aluminium', 'caesium', 'sulfur']);
  // (2) hand-written answer sets for the families and categories
  const sym = list => list.map(e => e.symbol).sort().join(' ');
  const KEY = {
    alkali: 'Cs K Li Na', alkaline: 'Ba Be Ca Mg', halogen: 'Br Cl F I', noble: 'Ar He Kr Ne Xe',
  };
  for (const [fam, set] of Object.entries(KEY)) assert.equal(sym(EL.filter(e => e.family === fam)), set, `family ${fam}`);
  assert.equal(sym(EL.filter(e => e.category === 'metalloid')), 'As B Ge Si');
  assert.equal(sym(EL.filter(e => e.category === 'nonmetal')), 'Ar Br C Cl F H He I Kr N Ne O P S Se Xe');
  assert.ok(EL.find(e => e.symbol === 'H').family === null, 'hydrogen is not an alkali metal');
  assert.ok(EL.filter(e => e.family === 'alkali').every(e => e.group === 1 && e.category === 'metal'));
  assert.ok(EL.filter(e => e.family === 'halogen').every(e => e.group === 17) && EL.filter(e => e.family === 'noble').every(e => e.group === 18));
  assert.ok(EL.filter(e => e.family === 'alkaline').every(e => e.group === 2));
  // (3) every prompt, checked against hand-written answers
  const ANSWER = {
    'Pop the alkali metals': 'Cs K Li Na', 'Pop the halogens': 'Br Cl F I', 'Pop the noble gases': 'Ar He Kr Ne Xe', 'Pop the alkaline earth metals': 'Ba Be Ca Mg',
    'Pop the metalloids': 'As B Ge Si', 'Pop the nonmetals': 'Ar Br C Cl F H He I Kr N Ne O P S Se Xe',
    'Pop the metals': 'Ag Al Au Ba Be Ca Co Cr Cs Cu Fe Ga Hg K Li Mg Mn Na Ni Pb Sc Sn Ti V Zn', 'Pop the metals in period 3': 'Al Mg Na', 'Pop the elements in group 17': 'Br Cl F I',
    'Pop the elements in group 14': 'C Ge Pb Si Sn', 'Pop the elements in period 3': 'Ar Al Cl Mg Na P S Si', 'Pop the elements in group 1': 'Cs H K Li Na',
    'Pop the d-block elements': 'Ag Au Co Cr Cu Fe Hg Mn Ni Sc Ti V Zn', 'Pop the elements in group 15': 'As N P', 'Pop the nonmetals in period 3': 'Ar Cl P S',
    'Pop the elements in group 2': 'Ba Be Ca Mg', 'Pop the metals in group 13': 'Al Ga',
  };
  assert.deepEqual(fal.levels.map(l => l.id), [1, 2, 3, 4]);
  const seeded = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const prompts = new Set();
  for (const lv of fal.levels) {
    assert.ok(lv.tip && lv.title && lv.subtitle && lv.speed > 0.05 && lv.speed < 0.3);
    assert.equal(lv.boss === true, lv.id === 4); assert.ok(lv.rounds.length >= 4);
    for (const r of lv.rounds) {
      const id = `level ${lv.id} "${r.prompt}"`;
      assert.ok(!prompts.has(r.prompt) || lv.id === 4 || r.prompt === 'Pop the metalloids', `${id}: repeated prompt`); prompts.add(r.prompt);
      assert.ok(r.fact.length > 40 && r.noun && r.prompt.startsWith('Pop '), id);
      assert.ok(ANSWER[r.prompt], `${id}: add the correct answer to ANSWER`);
      assert.equal(sym(matching(EL, r.rule)), ANSWER[r.prompt].split(' ').sort().join(' '), `${id}: the matching elements are wrong`);
      const yes = matching(EL, r.rule).length;
      assert.ok(r.targets >= 2 && r.targets <= yes, `${id}: ${r.targets} targets but only ${yes} elements match`);
      assert.ok(r.total > r.targets && r.total - r.targets <= EL.length - yes && r.total <= 14, `${id}: bubble counts`);
      assert.equal(!!r.time, lv.id === 4, `${id}: only the boss is timed`);
      for (let k = 1; k <= 60; k++) {
        const b = buildRound(r, EL, seeded(k)), sy = b.bubbles.map(e => e.symbol);
        assert.equal(b.bubbles.length, r.total, `${id}: bubble count`); assert.equal(new Set(sy).size, sy.length, `${id}: duplicate bubble`);
        assert.equal(b.targets.length, r.targets); assert.ok(b.targets.every(e => matches(e, r.rule) && sy.includes(e.symbol)));
        assert.equal(b.bubbles.filter(e => matches(e, r.rule)).length, r.targets, `${id}: a decoy matches the rule`);
      }
    }
  }
  // explanations name the element's real family, group and period
  const na = EL.find(e => e.symbol === 'Na'), ar = EL.find(e => e.symbol === 'Ar'), h = EL.find(e => e.symbol === 'H');
  assert.equal(describe(na), 'an alkali metal in group 1, period 3'); assert.equal(describe(ar), 'a noble gas in group 18, period 3');
  assert.equal(wrongText(na, { noun: 'a halogen' }), 'Sodium (Na) is an alkali metal in group 1, period 3, so it is not a halogen.');
  assert.match(wrongText(h, { noun: 'an alkali metal' }), /Hydrogen sits in group 1 but is a nonmetal/);
}
console.log('Periodic Falls OK');
// ---------- World 4 Trend Peaks: climbing orders checked against position in the table, not against themselves ----------
{
  const bySym = Object.fromEntries(EL.map(e => [e.symbol, e]));
  assert.deepEqual(trn.levels.map(l => l.id), [1, 2, 3, 4]);
  // the value tables hold every element used, with positive numbers
  for (const [s, v] of Object.entries(trn.values)) { assert.ok(bySym[s], `${s}: not in elements.json`); assert.ok(v.radius > 0 && v.ie > 0 && v.en > 0); }
  // direction of each trend when moving DOWN a group (+1 = increases) and ACROSS a period left to right
  const DOWN = { radius: 1, ie: -1, en: -1 }, ACROSS = { radius: -1, ie: 1, en: 1 };
  const MAIN = [1, 2, 13, 14, 15, 16, 17];                       // the groups used (main-group elements; the data only uses these)
  const seenPrompts = new Set();
  for (const lv of trn.levels) {
    assert.ok(lv.tip && lv.title && lv.subtitle); assert.equal(lv.boss === true, lv.id === 4); assert.ok(lv.rounds.length >= 4);
    for (const r of lv.rounds) {
      const id = `level ${lv.id} ${r.prop} ${r.dir} ${r.symbols.join(',')}`;
      assert.ok(PROPS[r.prop] && ['asc', 'desc'].includes(r.dir) && ['group', 'period', 'mixed'].includes(r.kind), id);
      assert.ok(r.symbols.length >= 4 && r.symbols.length <= 6 && new Set(r.symbols).size === r.symbols.length, `${id}: platform count`);
      if (lv.id < 4) assert.equal(r.kind, ['group', 'period', 'mixed'][lv.id - 1], `${id}: wrong kind for this level`);
      assert.equal(!!r.time, lv.id === 4, `${id}: only the boss is timed`);
      assert.ok(minGap(r, trn.values) >= 0.06, `${id}: two neighbours are nearly tied (${(minGap(r, trn.values) * 100).toFixed(1)}%)`);
      const els = r.symbols.map(s => bySym[s]), order = orderOf(r, trn.values).map(s => bySym[s]);
      els.forEach(e => assert.ok(MAIN.includes(e.group), `${id}: ${e.symbol} is not a main-group element`));
      // independent expectation from the position in the table
      const sign = r.dir === 'asc' ? 1 : -1;
      if (r.kind === 'group') {
        assert.equal(new Set(els.map(e => e.group)).size, 1, `${id}: not one group`);
        order.forEach((e, i) => { if (i) assert.ok((e.period - order[i - 1].period) * DOWN[r.prop] * sign > 0, `${id}: ${e.symbol} should not follow ${order[i - 1].symbol} down the group`); });
      } else if (r.kind === 'period') {
        assert.equal(new Set(els.map(e => e.period)).size, 1, `${id}: not one period`);
        order.forEach((e, i) => { if (i) assert.ok((MAIN.indexOf(e.group) - MAIN.indexOf(order[i - 1].group)) * ACROSS[r.prop] * sign > 0, `${id}: ${e.symbol} should not follow ${order[i - 1].symbol} across the period`); });
      } else {
        order.forEach((e, i) => {
          if (!i) return; const p = order[i - 1], rel = relation(p, e);
          assert.ok(rel, `${id}: ${p.symbol} and ${e.symbol} share neither a group nor a period`);
          const move = rel === 'group' ? (e.period - p.period) * DOWN[r.prop] : (MAIN.indexOf(e.group) - MAIN.indexOf(p.group)) * ACROSS[r.prop];
          assert.ok(move * sign > 0, `${id}: the ${rel} rule disagrees with ${p.symbol} → ${e.symbol}`);
        });
      }
      // prompts and texts
      assert.match(promptFor(r), /^Climb from /); assert.ok(ruleFor(r).length > 60);
      const f = factText(r, order.map(e => e.symbol), bySym); assert.ok(f.includes(order.map(e => e.symbol).join(' → ')), id);
      // judging: only the next one in order is right
      const o = order.map(e => e.symbol);
      o.forEach((s, i) => r.symbols.forEach(x => assert.equal(judge(o, i, x), x === s)));
      // a wrong hop explains the rule that applies to the pair
      const w = trendWrong(r, o[1], o[0], bySym); assert.ok(w.includes(bySym[o[1]].name) && w.includes(bySym[o[0]].name) && /group|period/.test(w), id);
    }
  }
  // spot checks written by hand from the textbook
  const R = (prop, dir, symbols) => ({ prop, dir, symbols });
  assert.deepEqual(orderOf(R('radius', 'asc', ['I', 'F', 'Br', 'Cl']), trn.values), ['F', 'Cl', 'Br', 'I']);
  assert.deepEqual(orderOf(R('ie', 'desc', ['Cs', 'Li', 'K', 'Na']), trn.values), ['Li', 'Na', 'K', 'Cs']);
  assert.deepEqual(orderOf(R('en', 'asc', ['Cl', 'Na', 'S', 'Al']), trn.values), ['Na', 'Al', 'S', 'Cl']);
  assert.match(trendWrong(R('radius', 'asc', []), 'Br', 'Cl', bySym), /group 17.*increases down a group/s);
  assert.match(trendWrong(R('ie', 'asc', []), 'Si', 'Na', bySym), /period 3.*increases across a period/s);
}
console.log('Trend Peaks OK');
// ---------- World 5 Bond Glacier: Lewis structures and VSEPR, checked against hand-written chemistry ----------
{
  // Hand-written ground truth (not computed): valence-electron totals and shapes
  const TOTAL = { HF: 8, H2O: 8, NH3: 8, CH4: 8, H2S: 8, CO2: 16, HCN: 10, O2: 12, CH2O: 12, C2H4: 12, BF3: 24, NF3: 26, CCl4: 32 };
  const SHAPE = { HF: 'linear', H2O: 'bent', NH3: 'trigonal_pyramidal', CH4: 'tetrahedral', H2S: 'bent', CO2: 'linear', HCN: 'linear', O2: 'linear', CH2O: 'trigonal_planar', C2H4: 'trigonal_planar', BF3: 'trigonal_planar', NF3: 'trigonal_pyramidal', CCl4: 'tetrahedral' };
  const V = bnd.valence, N = bnd.names;
  assert.deepEqual(V, { H: 1, B: 3, C: 4, N: 5, O: 6, F: 7, P: 5, S: 6, Cl: 7 });
  assert.deepEqual([...SHAPE_IDS].sort(), ['bent', 'linear', 'tetrahedral', 'trigonal_planar', 'trigonal_pyramidal']);
  assert.deepEqual(Object.keys(bnd.molecules).sort(), Object.keys(TOTAL).sort());
  for (const [id, raw] of Object.entries(bnd.molecules)) {
    const mol = parseMolecule(raw), key = raw.key;
    assert.equal(valenceTotal(mol, V), TOTAL[id], `${id}: valence electrons`);
    assert.equal(raw.shape, SHAPE[id], `${id}: shape in data`);
    assert.equal(shapeOf(mol, key.lps), SHAPE[id], `${id}: shape worked out from the structure`);
    assert.ok(raw.fact.length > 50 && raw.name && raw.formula);
    assert.equal(new Set(mol.atoms.map(a => `${a.x},${a.y}`)).size, mol.atoms.length, `${id}: two atoms on one spot`);
    mol.atoms.forEach(a => assert.ok(V[a.e] && N[a.e], `${id}: unknown element ${a.e}`));
    mol.links.forEach(([a, b]) => assert.ok(a !== b && a < mol.atoms.length && b < mol.atoms.length));
    // the key is a complete, correct structure: octets (duet for H), the right total, and no charged atoms
    const res = evaluate(mol, key.orders, key.lps, V);
    if (raw.build === false) { assert.ok(res.used === TOTAL[id] && !res.charged, `${id}: key`); continue; }
    assert.equal(res.ok, true, `${id}: the key is not a valid Lewis structure`);
    assert.equal(res.used, TOTAL[id]);
    // and it is the ONLY valid structure, so a player who builds a valid one has built the key
    const sols = solutions(mol, V);
    assert.equal(sols.length, 1, `${id}: ${sols.length} valid structures`);
    assert.deepEqual(sols[0], { orders: key.orders, lps: key.lps }, `${id}: solver and key disagree`);
    // every atom has room on the board for the lone pairs it needs
    mol.atoms.forEach((a, i) => assert.ok(lpSlots(mol, i).length >= key.lps[i], `${id}: ${a.e}${i} has ${lpSlots(mol, i).length} slots for ${key.lps[i]} lone pairs`));
  }
  // levels
  assert.deepEqual(bnd.levels.map(l => l.id), [1, 2, 3, 4]);
  const used = new Set();
  for (const lv of bnd.levels) {
    assert.ok(lv.tip && lv.title && lv.subtitle && ['lone', 'bonds', 'shape', 'boss'].includes(lv.kind)); assert.equal(lv.boss === true, lv.id === 4); assert.ok(lv.rounds.length >= 5);
    for (const r of lv.rounds) {
      const m = bnd.molecules[r.mol]; assert.ok(m, `unknown molecule ${r.mol}`); assert.equal(!!r.time, lv.id === 4, 'only the boss is timed');
      if (lv.kind !== 'shape') assert.notEqual(m.build, false, `${r.mol} cannot be built (octet exception)`);
      if (lv.kind === 'lone') assert.ok(m.key.orders.every(o => o === 1), `${r.mol}: level 1 has single bonds only`);
      if (lv.kind === 'bonds') assert.ok(m.key.orders.some(o => o > 1), `${r.mol}: level 2 needs a double or triple bond`);
      used.add(r.mol);
    }
    assert.equal(new Set(lv.rounds.map(r => r.mol)).size, lv.rounds.length, 'no repeated molecule inside a level');
  }
  assert.ok(['tetrahedral', 'trigonal_pyramidal', 'bent', 'linear', 'trigonal_planar'].every(s => bnd.levels[2].rounds.some(r => SHAPE[r.mol] === s)), 'the shapes level covers all five shapes');
  // the checker: right answer passes, and each mistake gets the right explanation
  const co2 = parseMolecule(bnd.molecules.CO2), kk = bnd.molecules.CO2.key;
  assert.equal(evaluate(co2, [0, 0], [0, 0, 0], V).complete, false); assert.match(explain(evaluate(co2, [0, 0], [0, 0, 0], V), co2, V, N), /Fill every bond/);
  let r = evaluate(co2, [1, 1], [3, 0, 3], V);
  assert.equal(r.ok, false); assert.match(explain(r, co2, V, N), /Carbon has 4 electrons.*needs 8.*Add a lone pair, or a higher bond order/);
  r = evaluate(co2, [2, 2], [2, 1, 2], V); assert.match(explain(r, co2, V, N), /Carbon has 10 electrons.*too many/);
  r = evaluate(co2, [3, 3], [0, 0, 0], V); assert.match(explain(r, co2, V, N), /Oxygen has 6 electrons around it/);
  r = evaluate(co2, [1, 3], [3, 0, 1], V); assert.equal(r.ok, false); assert.match(explain(r, co2, V, N), /would carry a charge/);
  const o2 = parseMolecule(bnd.molecules.O2); r = evaluate(o2, [1], [3, 3], V);
  assert.equal(r.used, 14); assert.match(explain(r, o2, V, N), /used 14 electrons and O₂ has 12 valence electrons \(O 6 \+ O 6\)/);
  const hf = parseMolecule(bnd.molecules.HF); r = evaluate(hf, [1], [1, 3], V); assert.match(explain(r, hf, V, N), /Hydrogen has 4 electrons around it\. Hydrogen needs 2 electrons \(a duet\)/);
  assert.equal(evaluate(co2, kk.orders, kk.lps, V).ok, true);
  // VSEPR wording
  const nh3 = parseMolecule(bnd.molecules.NH3), t = shapeText(nh3, bnd.molecules.NH3.key.lps, N);
  assert.match(t, /3 bonded atoms and 1 lone pair make 4 electron regions.*tetrahedral arrangement.*trigonal pyramidal shape.*about 107°/);
  assert.match(shapeText(co2, kk.lps, N), /2 bonded atoms and no lone pairs make 2 electron regions.*linear arrangement.*180°/);
  assert.deepEqual(regionsOf(parseMolecule(bnd.molecules.H2O), [2, 0, 0]), { central: 0, bonds: 2, lone: 2, total: 4 });
  assert.equal(shapeOf(parseMolecule(bnd.molecules.H2O), [2, 0, 0]), 'bent');
  assert.equal(centralIndex(parseMolecule(bnd.molecules.CH4)), 0);
}
console.log('Bond Glacier OK');

// ---------- World 7 Reaction Volcano: equations, the cauldron, limiting reactants and the island ----------
{
  const rx = JSON.parse(readFileSync('data/reactions.json', 'utf8'));
  assert.deepEqual(parseFormula('Ca(OH)2'), { Ca: 1, O: 2, H: 2 });
  assert.deepEqual(parseFormula('Al2(SO4)3'), { Al: 2, S: 3, O: 12 });
  assert.deepEqual(parseFormula('C3H8'), { C: 3, H: 8 });
  assert.deepEqual(atomsOf({ H2: 2, O2: 1 }), { H: 4, O: 2 });
  assert.equal(pretty('C3H8'), 'C₃H₈');
  // Independent answer key, balanced by hand: reactants → products with the smallest whole-number coefficients
  const KEY = {
    'H2+O2>H2O': '2H2 + O2 → 2H2O', 'N2+H2>NH3': 'N2 + 3H2 → 2NH3', 'Na+Cl2>NaCl': '2Na + Cl2 → 2NaCl',
    'CH4+O2>CO2+H2O': 'CH4 + 2O2 → CO2 + 2H2O', 'Mg+O2>MgO': '2Mg + O2 → 2MgO', 'C3H8+O2>CO2+H2O': 'C3H8 + 5O2 → 3CO2 + 4H2O',
    'H2O2>H2O+O2': '2H2O2 → 2H2O + O2', 'Zn+HCl>ZnCl2+H2': 'Zn + 2HCl → ZnCl2 + H2',
    'H2SO4+NaOH>Na2SO4+H2O': 'H2SO4 + 2NaOH → Na2SO4 + 2H2O', 'Fe+O2>Fe2O3': '4Fe + 3O2 → 2Fe2O3',
  };
  const TYPE = { 'H2O2>H2O+O2': 'Decomposition', 'Zn+HCl>ZnCl2+H2': 'Single displacement', 'H2SO4+NaOH>Na2SO4+H2O': 'Neutralisation', 'Fe+O2>Fe2O3': 'Synthesis' };
  const LIMIT = { 'H2+O2>H2O': 'O2', 'N2+H2>NH3': 'H2', 'CH4+O2>CO2+H2O': 'O2' };
  assert.deepEqual(rx.levels.map(l => l.id), [1, 2, 3, 4]);
  rx.types.forEach(t => assert.ok(typeof t === 'string'));
  let quests = 0;
  for (const lv of rx.levels) {
    assert.ok(lv.title && lv.subtitle && lv.tip && lv.quests.length >= 3, `reactions level ${lv.id}`);
    for (const q of lv.quests) {
      quests++;
      const sig = `${q.reactants.join('+')}>${q.products.join('+')}`, rc = q.coeffs.slice(0, q.reactants.length), pc = q.coeffs.slice(q.reactants.length);
      assert.equal(q.coeffs.length, q.reactants.length + q.products.length, `${sig}: one coefficient per formula`);
      assert.equal(equation(q.reactants, rc, q.products, pc), KEY[sig], `${sig}: coefficients disagree with the answer key`);
      assert.ok(isBalanced(q.reactants, rc, q.products, pc), `${sig}: not balanced`);
      assert.ok(q.ask && q.hint && q.fact, `${sig}: needs ask, hint and fact`);
      // the cauldron accepts exactly the balanced amounts, and works out the same products
      const bag = Object.fromEntries(q.reactants.map((f, i) => [f, rc[i]]));
      const ok = checkMix(q, bag);
      assert.ok(ok.ok, `${sig}: balanced bag rejected: ${ok.message}`); assert.deepEqual(ok.products, pc, `${sig}: wrong products`);
      // doubled amounts balance but are not the smallest numbers
      assert.equal(checkMix(q, Object.fromEntries(q.reactants.map((f, i) => [f, rc[i] * 2]))).kind, 'notSmallest', `${sig}: doubled`);
      assert.equal(checkMix(q, {}).kind, 'empty');
      if (q.reactants.length > 1) {
        assert.equal(checkMix(q, { [q.reactants[0]]: rc[0] }).kind, 'missing', `${sig}: missing`);
        const off = { ...bag, [q.reactants[0]]: rc[0] + 1 }, r = checkMix(q, off);
        assert.equal(r.kind, 'unbalanced', `${sig}: one extra ${q.reactants[0]} must not balance`);
        assert.ok(Object.keys(r.left).length && /left over/.test(r.message), `${sig}: says which atoms are left over`);
      }
      (q.decoys || []).forEach(f => { assert.ok(!q.reactants.includes(f), `${sig}: decoy ${f} is a reactant`); assert.equal(checkMix(q, { ...bag, [f]: 1 }).kind, 'stranger'); });
      if (lv.askType) { assert.equal(q.type, TYPE[sig], `${sig}: reaction type`); assert.ok(rx.types.includes(q.type)); }
      if (lv.limiting) {
        assert.ok(q.field, `${sig}: limiting quests list the field`);
        const L = limiting(q.reactants, rc, q.field);
        assert.deepEqual(L.limiting, [LIMIT[sig]], `${sig}: limiting reactant`);
        assert.ok(L.extent >= 1 && Object.keys(L.leftover).length === 1, `${sig}: exactly one reactant is left over`);
        const made = Object.fromEntries(q.products.map((p, j) => [p, pc[j] * L.extent]));
        assert.deepEqual(atomsOf({ ...made, ...L.leftover }), atomsOf(q.field), `${sig}: atoms conserved with leftovers`);
      }
    }
  }
  assert.ok(checkMix({ reactants: ['C3H8', 'O2'], products: ['CO2', 'H2O'] }, { C3H8: 1, O2: 5, CO2: 1 }).message.includes('is a product'));
  // the island: a rectangle with one start, one cauldron and one quest giver, and room for every molecule
  const isl = parseIsland(rx.island);
  rx.island.forEach((row, i) => assert.equal(row.length, isl.w, `island row ${i}`));
  ['@', 'C', 'N'].forEach(ch => assert.equal(rx.island.join('').split(ch).length - 1, 1, `island needs exactly one ${ch}`));
  rx.island[0].split('').concat(rx.island[isl.h - 1].split('')).forEach(ch => assert.equal(ch, '~', 'island is surrounded by water'));
  const tiles = spawnTiles(isl);
  for (const lv of rx.levels) for (const q of lv.quests) assert.ok(questTokens(q).length <= tiles.length, 'room for every molecule');
  // every spawn tile can be reached on foot from the start
  const seen = new Set([`${isl.start.x},${isl.start.y}`]), todo = [isl.start];
  while (todo.length) { const p = todo.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = p.x + dx, y = p.y + dy, k = `${x},${y}`; if (!seen.has(k) && !isl.solid(x, y)) { seen.add(k); todo.push({ x, y }); } } }
  tiles.forEach(t => assert.ok(seen.has(`${t.x},${t.y}`), `spawn tile ${t.x},${t.y} cannot be reached`));
  assert.ok([[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dx, dy]) => seen.has(`${isl.cauldron.x + dx},${isl.cauldron.y + dy}`)), 'the cauldron can be reached');
  const placed = scatter(questTokens(rx.levels[1].quests[2]), tiles, () => 0.37);
  assert.equal(placed.length, questTokens(rx.levels[1].quests[2]).length);
  assert.equal(new Set(placed.map(p => `${p.x},${p.y}`)).size, placed.length, 'one molecule per tile');
  console.log(`Reaction Volcano OK (${quests} quests)`);
}

// ---------- World 8 Thermo Track: energy facts, the course, and reading the body ----------
{
  const en = JSON.parse(readFileSync('data/energy.json', 'utf8'));
  // Independent answer key, written by hand: true = exothermic (gives out heat)
  const EXO = { wood: true, freeze: true, respire: true, warmer: true, condense: true, neutral: true, melt: false, boil: false, photo: false, coldpack: false, sweat: false, bake: false,
    ch4: true, carbon: true, h2: true, naoh: true, icemelt: false, waterboil: false, caco3: false, nh4no3: false };
  // Standard enthalpy changes (kJ/mol), rounded: combustion of CH4, C, H2 (to liquid water); dissolving NaOH and NH4NO3; fusion and vaporisation of water; decomposition of CaCO3
  const DH = { ch4: -890, carbon: -394, h2: -286, naoh: -44, icemelt: 6, waterboil: 41, caco3: 178, nh4no3: 26 };
  const ANSWER = { breakbond: 'Takes in energy', makebond: 'Gives out energy', exoprod: 'Less energy', exosurr: 'Warmer', endosign: 'Positive (+)', activation: 'Needed to start' };
  for (const [id, c] of Object.entries(en.changes)) {
    assert.equal(c.exo, EXO[id], `${id}: exothermic or endothermic?`);
    if (c.dh != null) { assert.equal(c.dh, DH[id], `${id}: ΔH value`); assert.equal(c.dh < 0, c.exo, `${id}: ΔH sign must match`); assert.ok(c.why.includes(String(Math.abs(c.dh))), `${id}: explanation quotes ΔH`); }
    assert.ok(c.label.length <= 16, `${id}: label too long for the sign`);
    assert.match(c.why, c.exo ? /exothermic/ : /endothermic/, `${id}: explanation names the right kind`);
  }
  for (const [id, q] of Object.entries(en.questions)) {
    assert.equal(q.options.length, 3, `${id}: one option per lane`); assert.equal(q.options[q.answer], ANSWER[id], `${id}: answer`);
    q.options.forEach(o => assert.ok(o.length <= 16, `${id}: option "${o}" too long for a gate panel`));
  }
  assert.deepEqual(en.levels.map(l => l.id), [1, 2, 3, 4]);
  for (const lv of en.levels) {
    assert.ok(lv.title && lv.subtitle && lv.tip);
    (lv.changes || []).forEach(id => assert.ok(en.changes[id], `level ${lv.id}: unknown change ${id}`));
    (lv.questions || []).forEach(id => assert.ok(en.questions[id], `level ${lv.id}: unknown question ${id}`));
    if (lv.changes) { assert.ok(['exo', 'endo'].includes(lv.collect)); const ex = lv.changes.filter(id => en.changes[id].exo).length; assert.ok(ex >= 3 && lv.changes.length - ex >= 3, `level ${lv.id}: needs both kinds`); }
    for (let s = 1; s <= 25; s++) {                               // many random courses: every item appears once, nothing impossible
      let seed = s * 7919; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const course = buildCourse(lv, en, rng);
      assert.equal(course.filter(o => o.kind === 'change').length, (lv.changes || []).length);
      assert.equal(course.filter(o => o.kind === 'gate').length, (lv.questions || []).length);
      assert.equal(course.filter(o => o.kind === 'obstacle' && o.lane !== 'all').length + course.filter(o => o.kind === 'obstacle' && o.lane === 'all').length >= Math.min(1, lv.obstacles), true);
      assert.ok(passable(course), `level ${lv.id}: impossible barrier row`);
      assert.equal(course[course.length - 1].kind, 'finish');
      for (const g of course.filter(o => o.kind === 'gate')) {
        assert.deepEqual([...g.order].sort(), [0, 1, 2]);
        assert.ok(!course.some(o => o.kind === 'obstacle' && Math.abs(o.z - g.z) < 8), 'no barrier right at a gate');
        assert.equal(LANES.filter(l => judgeGate(g, l).ok).length, 1, 'exactly one right lane');
      }
      for (const c of course.filter(o => o.kind === 'change')) assert.ok(!course.some(o => o.kind === 'obstacle' && Math.abs(o.z - c.z) < 6), 'no barrier on top of a change');
    }
  }
  // judging
  assert.equal(judgeChange(en.changes.wood, 'exo').good, true); assert.equal(judgeChange(en.changes.melt, 'exo').good, false);
  assert.equal(judgeChange(en.changes.caco3, 'endo').good, true); assert.match(judgeChange(en.changes.ch4, 'endo').text, /exothermic.*−890/);
  assert.equal(hits({ type: 'low', lane: 'all' }, { lane: 0, airborne: true }), false); assert.equal(hits({ type: 'low', lane: 'all' }, { lane: 0 }), true);
  assert.equal(hits({ type: 'high', lane: 1 }, { lane: 1, sliding: true }), false); assert.equal(hits({ type: 'high', lane: 1 }, { lane: 0 }), false);
  assert.equal(hits({ type: 'wall', lane: -1 }, { lane: -1, airborne: true }), true);
  // the pose reader: calibrate standing still, then lean, jump and squat (y grows downwards)
  const body = (x, y) => { const lm = []; lm[11] = { x: x - 0.1, y, visibility: 0.9 }; lm[12] = { x: x + 0.1, y, visibility: 0.9 }; return lm; };
  const pr = createPoseReader({ calibrateFrames: 5 });
  for (let i = 0; i < 5; i++) assert.equal(pr.read(body(0.5, 0.4)), null);
  assert.ok(pr.calibrated);
  assert.deepEqual([pr.read(body(0.5, 0.4)).lane, pr.read(body(0.64, 0.4)).lane, pr.read(body(0.6, 0.4)).lane, pr.read(body(0.52, 0.4)).lane], [0, 1, 1, 0], 'lean right with hysteresis');
  assert.equal(pr.read(body(0.36, 0.4)).lane, -1, 'lean left');
  pr.read(body(0.5, 0.4));
  const j1 = pr.read(body(0.5, 0.32)), j2 = pr.read(body(0.5, 0.31));
  assert.deepEqual([j1.jump, j2.jump], [true, false], 'a jump fires once');
  pr.read(body(0.5, 0.4)); assert.equal(pr.read(body(0.5, 0.5)).slide, true, 'squat to slide');
  assert.equal(pr.read([]), null, 'no person, no action');
  console.log('Thermo Track OK');
}


console.log(`ChemQuest data OK (${orders} orders, ${d.ions.length} ions)`);
