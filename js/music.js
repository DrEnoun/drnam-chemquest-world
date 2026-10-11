// Background music, generated in the browser (no audio files, so it is free of licences and works offline).
// Three short original loops, one per kind of screen. Each loop is 4 bars of 4/4 in a major key, built from the
// chords I - vi - IV - V (or I - vi - IV - V style), so it can repeat forever without feeling like it restarts.
// The notes are plain data (TRACKS) so they can be checked in tests; scheduleStep() turns one eighth-note step
// into sound and is shared by the live player and the offline renderer used for testing.
import { getContext } from './sound.js';

const TRIAD = { maj: [0, 4, 7, 12], min: [0, 3, 7, 12] };
export const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];

// roots are MIDI note numbers in the bass range. Pads sound an octave up, arpeggios and stabs two octaves up.
// bass: 0 root, 1 fifth, 2 octave (or null). arp: chord-tone index 0-3 (root, third, fifth, octave) or null. stab / kick / hat: 1 = hit.
// melody[bar][step]: MIDI note, or null to hold the previous note. kick / hat: 1 = hit.
export const TRACKS = {
  map: {
    name: 'Island Voyage', bpm: 92, tonic: 0, level: 0.9,
    chords: [{ root: 48, q: 'maj' }, { root: 45, q: 'min' }, { root: 53, q: 'maj' }, { root: 55, q: 'maj' }],
    bass: [0, null, null, null, 1, null, null, null],
    arp: [0, 1, 2, 3, 2, 1, 2, 1],
    melody: [
      [76, null, 79, null, 81, null, 79, null],
      [76, null, 72, null, 76, 79, 76, null],
      [77, null, 76, null, 72, null, 74, null],
      [74, null, 79, null, 71, null, 74, null],
    ],
    kick: [0, 0, 0, 0, 0, 0, 0, 0], hat: [0, 0, 1, 0, 0, 0, 1, 0], stab: [0, 0, 0, 0, 0, 0, 0, 0],
    lead: 'triangle', arpVoice: 'sine',
  },
  diner: {
    name: 'Ion Diner Jive', bpm: 122, tonic: 5, level: 0.85,
    chords: [{ root: 53, q: 'maj' }, { root: 50, q: 'min' }, { root: 46, q: 'maj' }, { root: 48, q: 'maj' }],
    bass: [0, null, 0, 1, 0, null, 1, 2],
    arp: [null, null, null, null, null, null, null, null],
    melody: [
      [77, null, 81, 79, 77, null, 72, null],
      [74, null, 77, 76, 74, null, 77, null],
      [77, 76, 74, null, 72, null, 70, null],
      [72, null, 76, 79, 76, null, 74, null],
    ],
    kick: [1, 0, 0, 0, 1, 0, 0, 0], hat: [0, 1, 0, 1, 0, 1, 0, 1], stab: [1, 0, 0, 1, 0, 0, 1, 0],
    lead: 'square', arpVoice: 'triangle',
  },
  falls: {
    name: 'Falls Fanfare', bpm: 112, tonic: 4, level: 0.85,
    chords: [{ root: 52, q: 'maj' }, { root: 49, q: 'min' }, { root: 45, q: 'maj' }, { root: 47, q: 'maj' }],
    bass: [0, null, 1, null, 0, null, 2, null],
    arp: [0, 1, 2, 3, 2, 1, 2, 3],
    melody: [
      [76, null, 80, 83, 80, null, 76, null],
      [80, null, 76, null, 80, null, 85, null],
      [81, null, 85, null, 81, null, 78, null],
      [83, null, 78, null, 80, null, 83, null],
    ],
    kick: [1, 0, 0, 0, 1, 0, 0, 1], hat: [0, 1, 0, 1, 0, 1, 0, 1], stab: [0, 0, 0, 0, 0, 0, 0, 0],
    lead: 'square', arpVoice: 'triangle',
  },
  ruins: {
    name: 'Ruins Riddle', bpm: 100, tonic: 2, level: 0.85,
    chords: [{ root: 50, q: 'maj' }, { root: 47, q: 'min' }, { root: 55, q: 'maj' }, { root: 57, q: 'maj' }],
    bass: [0, null, null, 1, 0, null, null, null],
    arp: [0, 2, 1, 3, 0, 2, 1, 3],
    melody: [
      [78, null, 74, null, 78, null, 81, null],
      [79, null, 78, null, 74, null, 71, null],
      [79, null, 83, null, 81, null, 79, null],
      [76, null, 81, null, 78, null, 76, null],
    ],
    kick: [1, 0, 0, 0, 0, 0, 0, 0], hat: [0, 0, 1, 0, 0, 0, 1, 0], stab: [0, 0, 0, 0, 0, 0, 0, 0],
    lead: 'triangle', arpVoice: 'triangle',
  },
  memory: {
    name: 'Meadow Puzzle', bpm: 80, tonic: 7, level: 0.9,
    chords: [{ root: 55, q: 'maj' }, { root: 52, q: 'min' }, { root: 48, q: 'maj' }, { root: 50, q: 'maj' }],
    bass: [0, null, null, null, 1, null, null, null],
    arp: [0, null, 1, null, 2, null, 3, null],
    melody: [
      [79, null, 83, null, 81, null, 79, null],
      [76, null, 79, null, 83, null, 79, null],
      [76, null, 79, null, 84, null, 79, null],
      [78, null, 81, null, 78, null, 74, null],
    ],
    kick: [0, 0, 0, 0, 0, 0, 0, 0], hat: [0, 0, 0, 0, 0, 0, 0, 0], stab: [0, 0, 0, 0, 0, 0, 0, 0],
    lead: 'sine', arpVoice: 'sine',
  },
};

// bass index -> chord tone: 0 root, 1 fifth, 2 octave
const BASS_TONE = [0, 2, 3];
export const STEPS_PER_BAR = 8, BARS = 4, LOOP_STEPS = STEPS_PER_BAR * BARS;
export const eighth = track => 60 / track.bpm / 2;
export const midiFreq = m => 440 * 2 ** ((m - 69) / 12);
export const chordTones = c => TRIAD[c.q].map(i => c.root + i);

// Which of the three loops each screen plays.
export const SCREEN_TRACK = { menu: 'map', shifts: 'map', avatar: 'map', game: 'diner', memory: 'memory', orbital: 'ruins', falls: 'falls' };

// ---------- sound building blocks ----------
const noiseCache = new WeakMap();
function noise(ctx) {
  if (!noiseCache.has(ctx)) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, buf);
  }
  return noiseCache.get(ctx);
}

// `hold` keeps the note at full volume until the last moment (for pads); otherwise it fades away like a plucked note.
function voice(ctx, dest, { type = 'triangle', freq, t, dur, vol, attack = 0.01, lp = 0, hold = false }) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  if (hold) { g.gain.setValueAtTime(vol, t + Math.max(attack, dur - 0.5)); g.gain.linearRampToValueAtTime(0.0001, t + dur); }
  else g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, attack + 0.03));
  let out = o;
  if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); out = f; }
  out.connect(g).connect(dest);
  o.start(t); o.stop(t + dur + 0.05);
}
function kick(ctx, dest, t) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  g.gain.setValueAtTime(0.32, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  o.connect(g).connect(dest); o.start(t); o.stop(t + 0.22);
}
function hat(ctx, dest, t, vol) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noise(ctx); f.type = 'highpass'; f.frequency.value = 7000;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  s.connect(f).connect(g).connect(dest); s.start(t); s.stop(t + 0.08);
}

// Plays everything that starts on one eighth-note step. `step` counts up forever; the loop wraps itself.
export function scheduleStep(ctx, dest, track, step, t) {
  const e = eighth(track), pos = step % STEPS_PER_BAR, bar = Math.floor(step / STEPS_PER_BAR) % BARS;
  const chord = track.chords[bar], tones = chordTones(chord);
  const bi = track.bass[pos];
  if (bi != null) voice(ctx, dest, { type: 'triangle', freq: midiFreq(tones[BASS_TONE[bi]]), t, dur: e * (track.bpm > 100 ? 1.6 : 3.2), vol: 0.2, attack: 0.012 });
  const ai = track.arp[pos];
  if (ai != null) voice(ctx, dest, { type: track.arpVoice, freq: midiFreq(tones[ai] + 24), t, dur: e * 1.8, vol: 0.075, attack: 0.006, lp: 3600 });
  if (track.stab[pos]) tones.slice(0, 3).forEach(n => voice(ctx, dest, { type: 'square', freq: midiFreq(n + 12), t, dur: e * 0.7, vol: 0.022, attack: 0.004, lp: 1800 }));
  const m = track.melody[bar][pos];
  if (m != null) {
    let len = 1; while (pos + len < STEPS_PER_BAR && track.melody[bar][pos + len] == null) len++;
    voice(ctx, dest, { type: track.lead, freq: midiFreq(m), t, dur: e * len * 0.95, vol: track.lead === 'square' ? 0.04 : 0.085, attack: 0.012, lp: track.lead === 'square' ? 2600 : 0 });
  }
  if (pos === 0) tones.slice(0, 3).forEach(n => voice(ctx, dest, { type: 'sine', freq: midiFreq(n + 12), t, dur: e * STEPS_PER_BAR * 1.02, vol: 0.035, attack: 0.3, hold: true }));
  if (track.kick[pos]) kick(ctx, dest, t);
  if (track.hat[pos]) hat(ctx, dest, t, 0.035);
}

// Renders `loops` repeats of a loop into an OfflineAudioContext (used by the tests to check it is audible and not clipping).
export function renderLoops(ctx, trackId, loops = 1) {
  const track = TRACKS[trackId], bus = ctx.createGain(); bus.gain.value = track.level * 0.6; bus.connect(ctx.destination);
  for (let s = 0; s < LOOP_STEPS * loops; s++) scheduleStep(ctx, bus, track, s, 0.05 + s * eighth(track));
  return LOOP_STEPS * loops * eighth(track) + 0.5;
}

// ---------- live player ----------
const MASTER = 0.6;
let enabled = true, desired = null, cur = null;

function tick() {
  const a = getContext();
  if (!cur || !a) return;
  if (a.state !== 'running') { cur.next = a.currentTime + 0.12; return; }   // wait for the first tap
  const track = TRACKS[cur.id];
  while (cur.next < a.currentTime + 0.3) { scheduleStep(a, cur.bus, track, cur.step, cur.next); cur.next += eighth(track); cur.step++; }
}
function begin(id) {
  const a = getContext();
  if (!a) return;
  const bus = a.createGain();
  bus.gain.setValueAtTime(0.0001, a.currentTime);
  bus.gain.linearRampToValueAtTime(TRACKS[id].level * MASTER, a.currentTime + 1.2);
  bus.connect(a.destination);
  cur = { id, bus, step: 0, next: a.currentTime + 0.12, timer: setInterval(tick, 90) };
  tick();
}
function end() {
  if (!cur) return;
  const { bus, timer } = cur, a = getContext();
  clearInterval(timer); cur = null;
  if (a) { bus.gain.cancelScheduledValues(a.currentTime); bus.gain.setValueAtTime(bus.gain.value, a.currentTime); bus.gain.linearRampToValueAtTime(0.0001, a.currentTime + 0.7); }
  setTimeout(() => { try { bus.disconnect(); } catch (e) { /* already gone */ } }, 1500);
}

export const music = {
  get enabled() { return enabled; },
  get playing() { return cur ? cur.id : null; },
  setEnabled(on) { enabled = !!on; if (!enabled) end(); else if (desired) this.play(desired); },
  // Ask for a loop. Playing the same loop again does nothing; a different one fades the old one out.
  play(id) {
    desired = id;
    if (!enabled || !TRACKS[id] || (typeof document !== 'undefined' && document.hidden)) return;
    if (cur && cur.id === id) return;
    end(); begin(id);
  },
  stop() { desired = null; end(); },
};

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.hidden) end(); else if (enabled && desired) music.play(desired); });
}
