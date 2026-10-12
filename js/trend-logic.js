// World 4 — Trend Peaks: the rules. Element values live in data/trends.json; the correct climbing order is always
// worked out from them (sorted), never stored by hand, and the tests check it against the textbook trends.
export const PROPS = {
  radius: { label: 'atomic radius', asc: 'smallest to largest', desc: 'largest to smallest', ends: ['smallest', 'largest'] },
  ie: { label: 'first ionisation energy', asc: 'lowest to highest', desc: 'highest to lowest', ends: ['lowest', 'highest'] },
  en: { label: 'electronegativity', asc: 'least to most electronegative', desc: 'most to least electronegative', ends: ['least electronegative', 'most electronegative'] },
};
export const promptFor = r => `Climb from ${PROPS[r.prop][r.dir]}`;
export const titleFor = r => PROPS[r.prop].label[0].toUpperCase() + PROPS[r.prop].label.slice(1);

// the one-line rules, per property
const RULES = {
  radius: {
    group: 'Atomic radius increases down a group: each step down adds an electron shell, so the atom is bigger.',
    period: 'Atomic radius decreases across a period: more protons pull the same shell in tighter, so the atom is smaller.',
  },
  ie: {
    group: 'Ionisation energy decreases down a group: the outer electron is further from the nucleus and better shielded, so it is easier to remove.',
    period: 'Ionisation energy increases across a period: more protons hold the outer electron more tightly, so it is harder to remove.',
  },
  en: {
    group: 'Electronegativity decreases down a group: the bonding electrons are further from the nucleus and shielded, so the atom attracts them less.',
    period: 'Electronegativity increases across a period: a higher nuclear charge attracts the bonding electrons more strongly.',
  },
};
export const ruleText = (prop, kind) => RULES[prop][kind];
export const ruleFor = r => r.kind === 'mixed' ? `${RULES[r.prop].group} ${RULES[r.prop].period}` : RULES[r.prop][r.kind];

// the correct climbing order: sorted by the data (ascending or descending)
export function orderOf(round, values) {
  const v = s => values[s][round.prop];
  return [...round.symbols].sort((a, b) => round.dir === 'asc' ? v(a) - v(b) : v(b) - v(a));
}
// the smallest relative gap between neighbours in the order (so no two platforms are nearly tied)
export function minGap(round, values) {
  const o = orderOf(round, values).map(s => values[s][round.prop]);
  let m = Infinity;
  for (let i = 1; i < o.length; i++) m = Math.min(m, Math.abs(o[i] - o[i - 1]) / Math.max(o[i], o[i - 1]));
  return m;
}
// does the pair share a group or a period?
export const relation = (a, b) => a.group === b.group ? 'group' : a.period === b.period ? 'period' : null;

// which platform the player should tap next? 'ok' or a wrong hop with an explanation
export function judge(order, done, pick) { return order[done] === pick; }
export function wrongText(round, picked, expected, byS) {
  const a = byS[picked], b = byS[expected], rel = relation(a, b), p = PROPS[round.prop];
  const want = round.dir === 'asc' ? p.ends[0] : p.ends[1];
  const next = `The next step is ${expected} (${b.name}), the ${want} of those left.`;
  const why = rel ? ` ${picked} and ${expected} are both in ${rel === 'group' ? 'group ' + a.group : 'period ' + a.period}. ${RULES[round.prop][rel]}`
    : ` ${RULES[round.prop].group} ${RULES[round.prop].period}`;
  return `${picked} (${a.name}) is not next. ${next}${why}`;
}
export const factText = (round, order, byS) => {
  const p = PROPS[round.prop], first = byS[order[0]].name, last = byS[order[order.length - 1]].name;
  return `${titleFor(round)} from ${p[round.dir]}: ${order.join(' → ')}. ${first[0].toUpperCase()}${first.slice(1)} is first and ${last} is last. ${ruleFor(round)}`;
};
export const COINS_PER_STEP = 5, ROUND_BONUS = 5, XP_PER_STEP = 6;
