// Synthesized audio for Wilwatikta: two radio stations (gamelan-style
// pentatonic plucks and a bass-driven kroncong groove), engine hum, siren,
// gunshots and pickups. Everything is generated with WebAudio — no files,
// no network. Silent until the first key or click (browser autoplay rules)
// and a safe no-op when audio is unavailable.
export const STATIONS = [
  { name: "GAMELAN FM 101.1", track: "Bonang Malam", scale: [0, 2, 4, 7, 9, 12, 14], base: 220, tempo: 132 },
  { name: "RADIO WILWATIKTA 98.5", track: "Keroncong Senja", scale: [0, 3, 5, 7, 10, 12, 15], base: 174, tempo: 104 },
];
const MELODY = [0, 2, 4, 3, 1, 0, 2, 5, 4, 2, 1, 0, 3, 4, 6, 4];
let ctx = null, master = null, musicGain = null, engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null;
let station = 0, step = 0, nextNoteT = 0, timer = null, started = false;

function init() {
  if (ctx) return true;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.16; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.7; musicGain.connect(master);
    engineOsc = ctx.createOscillator(); engineOsc.type = "sawtooth"; engineOsc.frequency.value = 42;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 220;
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    engineOsc.connect(lp); lp.connect(engineGain); engineGain.connect(master); engineOsc.start();
    sirenOsc = ctx.createOscillator(); sirenOsc.type = "triangle"; sirenOsc.frequency.value = 700;
    sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain); sirenGain.connect(master); sirenOsc.start();
    return true;
  } catch (e) { return false; }
}
function pluck(freq, t, dur, vol) {
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
  o.type = "sine"; o.frequency.value = freq;
  o2.type = "sine"; o2.frequency.value = freq * 2.76;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  const g2 = ctx.createGain(); g2.gain.value = 0.35;
  o.connect(g); o2.connect(g2); g2.connect(g); g.connect(musicGain);
  o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
}
function scheduler() {
  if (!ctx) return;
  const st = STATIONS[station], beat = 60 / st.tempo / 2;
  while (nextNoteT < ctx.currentTime + 0.25) {
    const deg = MELODY[step % MELODY.length];
    const f = st.base * Math.pow(2, st.scale[deg % st.scale.length] / 12);
    pluck(f, nextNoteT, 0.5, step % 4 === 0 ? 0.5 : 0.3);
    if (step % 8 === 0) pluck(st.base / 2, nextNoteT, 0.9, 0.4);
    if (step % 2 === 1) pluck(f * 2, nextNoteT + beat * 0.5, 0.3, 0.12);
    step++; nextNoteT += beat;
  }
}
export const audio = {
  unlock() {
    if (started) { if (ctx && ctx.state === "suspended") ctx.resume(); return; }
    if (!init()) return;
    started = true; nextNoteT = ctx.currentTime + 0.1;
    timer = setInterval(scheduler, 80);
  },
  setStation(i) { station = i % STATIONS.length; step = 0; },
  toggleMusic(on) { if (musicGain) musicGain.gain.value = on ? 0.7 : 0; },
  engine(speed, throttle) {
    if (!ctx) return;
    engineOsc.frequency.setTargetAtTime(40 + Math.abs(speed) * 3.2, ctx.currentTime, 0.1);
    engineGain.gain.setTargetAtTime(throttle ? 0.05 + Math.abs(speed) * 0.002 : 0.02, ctx.currentTime, 0.15);
  },
  siren(on, t) {
    if (!ctx) return;
    sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.2);
    if (on) sirenOsc.frequency.setTargetAtTime(650 + Math.sin(t * 5) * 120, ctx.currentTime, 0.05);
  },
  shot() {
    if (!ctx) return;
    const len = ctx.sampleRate * 0.09, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = 0.5;
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 1800;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  },
  blip(freq) {
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = freq || 660;
    g.gain.setValueAtTime(0.25, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + 0.2);
  },
};
