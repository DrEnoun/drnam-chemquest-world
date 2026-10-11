// World 3 — Periodic Falls rules (no screen code, so they can be tested in Node).
// A round asks the player to pop every element that matches a rule ("the halogens", "group 14", "metals in period 3"...).
// An element is a plain record: { z, symbol, name, group, period, block, category, family }.

export const FAMILY_LABEL = { alkali: 'an alkali metal', alkaline: 'an alkaline earth metal', halogen: 'a halogen', noble: 'a noble gas' };
export const CATEGORY_LABEL = { metal: 'a metal', nonmetal: 'a nonmetal', metalloid: 'a metalloid' };

// What kind of element is this? e.g. "a halogen in group 17, period 3"
export const describe = el => `${FAMILY_LABEL[el.family] || CATEGORY_LABEL[el.category]} in group ${el.group}, period ${el.period}`;

// A rule is { type: 'family' | 'category' | 'group' | 'period' | 'block', value } or { all: [rule, rule, ...] }.
export function matches(el, rule) {
  if (rule.all) return rule.all.every(r => matches(el, r));
  switch (rule.type) {
    case 'family': return el.family === rule.value;
    case 'category': return el.category === rule.value;
    case 'group': return el.group === rule.value;
    case 'period': return el.period === rule.value;
    case 'block': return el.block === rule.value;
    default: throw new Error(`unknown rule type ${rule.type}`);
  }
}
export const matching = (elements, rule) => elements.filter(e => matches(e, rule));

// The sentence Dr. NAM says after a wrong pop.
export function wrongText(el, round) {
  let t = `${el.name[0].toUpperCase()}${el.name.slice(1)} (${el.symbol}) is ${describe(el)}, so it is not ${round.noun}.`;
  if (el.z === 1) t += ' Hydrogen sits in group 1 but is a nonmetal, not an alkali metal.';
  return t;
}

function shuffle(arr, rng) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Chooses the bubbles for a round: `targets` matching elements and (total - targets) decoys. About half the decoys are
// "near misses" (same period or next-door group as a target) so the player has to think instead of guess.
export function buildRound(round, elements, rng = Math.random) {
  const right = shuffle(matching(elements, round.rule), rng).slice(0, round.targets);
  const wrong = elements.filter(e => !matches(e, round.rule));
  const near = shuffle(wrong.filter(e => right.some(t => t.period === e.period || (e.group && t.group && Math.abs(e.group - t.group) === 1))), rng);
  const need = round.total - round.targets, picked = near.slice(0, Math.ceil(need / 2));
  const rest = shuffle(wrong.filter(e => !picked.includes(e)), rng).slice(0, need - picked.length);
  return { targets: right, bubbles: shuffle([...right, ...picked, ...rest], rng) };
}

// Stars for a finished level come from the hearts left (the same rule as the other worlds).
export const COINS_PER_POP = 5, ROUND_BONUS = 5, XP_PER_POP = 6;
