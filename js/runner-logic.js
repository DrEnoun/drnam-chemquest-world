// World 8 — Thermo Track: the rules of the runner, with no screen code, so they can be tested in Node.
// The track has three lanes (-1 left, 0 middle, 1 right). Things on the track have a distance z ahead of the
// player; the track moves them towards the player, and they are judged when they reach z = 0.

export const LANES = [-1, 0, 1];
export const JUMP_TIME = 0.72, SLIDE_TIME = 0.78;          // seconds in the air / sliding
export const GAP = 24;                                      // track units between things to read or dodge

// ---------- the course ----------
// Builds the list of things on the track for a level: energy changes, question gates, barriers and coins.
// rng gives 0..1 so a course can be repeated in tests.
export function buildCourse(level, data, rng = Math.random) {
  const pick = a => a[Math.floor(rng() * a.length)];
  const content = [
    ...(level.changes || []).map(id => ({ kind: 'change', id, ...data.changes[id] })),
    ...(level.questions || []).map(id => ({ kind: 'gate', id, ...data.questions[id] })),
  ];
  // spread the gates evenly through the changes
  if (level.changes && level.questions) {
    const ch = content.filter(c => c.kind === 'change'), gs = content.filter(c => c.kind === 'gate'), step = Math.max(1, Math.floor(ch.length / (gs.length + 1)));
    content.length = 0; ch.forEach((c, i) => { content.push(c); if ((i + 1) % step === 0 && gs.length) content.push(gs.shift()); }); content.push(...gs);
  }
  const out = [];
  let z = 46, obstaclesLeft = level.obstacles || 0;
  const between = Math.max(1, content.length);
  content.forEach((c, i) => {
    // a barrier (or two) before each item, so players read and dodge at the same time
    const n = Math.round(obstaclesLeft / (between - i));
    for (let k = 0; k < n && obstaclesLeft > 0; k++, obstaclesLeft--) {
      const type = pick(['low', 'high', 'wall', 'wall']);
      if (type === 'wall') { const free = pick(LANES); LANES.filter(l => l !== free).slice(0, 1 + Math.floor(rng() * 2)).forEach(l => out.push({ kind: 'obstacle', type, lane: l, z })); }
      else out.push({ kind: 'obstacle', type, lane: type === 'low' || rng() < 0.5 ? 'all' : pick(LANES), z });
      z += GAP * 0.8;
    }
    if (c.kind === 'gate') {
      const order = shuffle([0, 1, 2], rng);             // which option sits in which lane
      out.push({ ...c, z: z + 8, order });
      z += GAP * 1.6;
    } else {
      out.push({ ...c, lane: pick(LANES), z });
      // a short row of coins in another lane, as a reward for dodging
      const cl = pick(LANES.filter(l => l !== out[out.length - 1].lane));
      for (let k = 0; k < 4; k++) out.push({ kind: 'coin', lane: cl, z: z - 10 + k * 4 });
      z += GAP;
    }
  });
  out.push({ kind: 'finish', z: z + 20 });
  return out.sort((a, b) => a.z - b.z);
}
export function shuffle(a, rng = Math.random) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---------- judging ----------
// An energy change reached the player in their lane. collect = 'exo' or 'endo'.
export function judgeChange(item, collect) {
  const wanted = collect === 'exo' ? item.exo : !item.exo;
  const kind = item.exo ? 'exothermic' : 'endothermic';
  return { good: wanted, kind, text: wanted ? `✓ ${item.label}: ${kind}.` : `✗ ${item.label} is ${kind}. ${item.why}` };
}
// The player ran through a gate in `lane`. Returns the chosen option and whether it is right.
export function judgeGate(gate, lane) {
  const opt = gate.order[lane + 1];
  return { ok: opt === gate.answer, chosen: gate.options[opt], right: gate.options[gate.answer] };
}
// Does a barrier hit the player? state: { lane, airborne, sliding }
export function hits(obstacle, state) {
  if (obstacle.lane !== 'all' && obstacle.lane !== state.lane) return false;
  if (obstacle.type === 'low') return !state.airborne;
  if (obstacle.type === 'high') return !state.sliding;
  return true;                                                 // a wall can only be dodged by changing lane
}
// A barrier that fills every lane must be jumpable or slidable, and a wall row must leave a lane free.
export function passable(course) {
  const rows = {};
  course.filter(o => o.kind === 'obstacle').forEach(o => { (rows[o.z] ??= []).push(o); });
  return Object.values(rows).every(row => row.some(o => o.type !== 'wall') ? row.length === 1 : row.length < 3);
}

// ---------- reading the body from the webcam ----------
// Turns pose landmarks into lane / jump / slide. Landmarks are MediaPipe Pose points (x, y from 0 to 1,
// already mirrored so moving right moves right). It first learns where the player stands (calibration),
// then compares: shoulders shifted sideways = lane, shoulders up = jump, shoulders down = squat (slide).
// Distances are measured in shoulder widths, so it works near or far from the camera.
export function createPoseReader({ calibrateFrames = 20, laneIn = 0.55, laneOut = 0.3, jumpUp = 0.25, squatDown = 0.4 } = {}) {
  let base = null, samples = [], lane = 0, armedJump = true, armedSlide = true;
  const mid = lm => ({ x: (lm[11].x + lm[12].x) / 2, y: (lm[11].y + lm[12].y) / 2, w: Math.hypot(lm[11].x - lm[12].x, lm[11].y - lm[12].y) });
  return {
    get calibrated() { return !!base; },
    get progress() { return base ? 1 : samples.length / calibrateFrames; },
    reset() { base = null; samples = []; lane = 0; armedJump = armedSlide = true; },
    // returns { lane, jump, slide } (jump and slide are true only on the frame they start), or null while calibrating
    read(lm) {
      if (!lm || !lm[11] || !lm[12] || (lm[11].visibility ?? 1) < 0.5 || (lm[12].visibility ?? 1) < 0.5) return null;
      const m = mid(lm);
      if (m.w < 0.04) return null;
      if (!base) {
        samples.push(m);
        if (samples.length >= calibrateFrames) {
          const med = k => samples.map(s => s[k]).sort((a, b) => a - b)[Math.floor(samples.length / 2)];
          base = { x: med('x'), y: med('y'), w: med('w') };
        }
        return null;
      }
      const dx = (m.x - base.x) / base.w, dy = (m.y - base.y) / base.w;
      if (lane === 0 && dx > laneIn) lane = 1; else if (lane === 0 && dx < -laneIn) lane = -1;
      else if (lane !== 0 && Math.abs(dx) < laneOut) lane = 0;
      else if (lane === 1 && dx < -laneIn) lane = -1; else if (lane === -1 && dx > laneIn) lane = 1;
      let jump = false, slide = false;
      if (armedJump && dy < -jumpUp) { jump = true; armedJump = false; } else if (dy > -jumpUp * 0.4) armedJump = true;
      if (armedSlide && dy > squatDown) { slide = true; armedSlide = false; } else if (dy < squatDown * 0.4) armedSlide = true;
      if (Math.abs(dx) < laneOut && Math.abs(dy) < 0.12) { base.y += (m.y - base.y) * 0.02; base.x += (m.x - base.x) * 0.01; }   // follow slow drift while standing still
      return { lane, jump, slide, dx, dy };
    },
  };
}
