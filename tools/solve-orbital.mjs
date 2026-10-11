// Prints a shortest solution for every Orbital Ruins level, or says it cannot be solved.
// Use it when you edit data/orbitals.json:  node tools/solve-orbital.mjs
import { readFileSync } from 'node:fs';
import { solve } from '../js/orbital-logic.js';
const d = JSON.parse(readFileSync(new URL('../data/orbitals.json', import.meta.url), 'utf8'));
for (const lv of d.levels) {
  const t = Date.now(), r = solve(lv);
  console.log(`Level ${lv.id} ${lv.element.name}:`, r.moves ? `${r.moves.length} moves (${r.states} states, ${Date.now() - t} ms)` : `NOT SOLVABLE (searched ${r.states} states)`);
  if (r.moves && process.argv.includes('-v')) console.log('  ', r.moves);
}
