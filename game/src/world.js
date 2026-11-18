// Wilwatikta game state and rules: the 12-mission story chain, the WPD
// wanted system with pursuit cars, roadblocks and the spotlight helicopter,
// combat, traffic, pedestrians, crew hires, garage upgrades, saves, and
// the day/dusk/night palette cycle.
import { C } from "./gl.js";
import { makeRng, clamp, lerp, angDiff, TAU } from "./rng.js";
import { ROADS, districtNameAt } from "./city.js";

export const WEAPONS = [
  { name: "FIST", mag: Infinity, reserve: Infinity, dmg: 12, rate: 0.45, range: 3 },
  { name: "PISTOL P-9", mag: 12, reserve: 48, dmg: 18, rate: 0.28, range: 34 },
  { name: "SMG KANCIL", mag: 30, reserve: 90, dmg: 11, rate: 0.09, range: 30 },
  { name: "AR-9", mag: 24, reserve: 60, dmg: 22, rate: 0.16, range: 40 },
  { name: "RIFLE", mag: 6, reserve: 18, dmg: 55, rate: 0.8, range: 55, locked: true },
];
export const CREW = [
  { name: "AGUS", role: "INFO DALAM", cost: 100, key: "Z", col: "#e8912d", desc: "Wanted turun 1 bintang" },
  { name: "BAMBANG", role: "SERVIS CEPAT", cost: 150, key: "X", col: "#4a7fd8", desc: "Mobil diperbaiki penuh" },
  { name: "RATNA", role: "JALUR TIKUS", cost: 200, key: "C", col: "#d83a6a", desc: "Roadblock dibersihkan" },
];
export const MISSIONS = [
  { name: "Selamat Datang", obj: "Temui Agus di Alun-Alun.", tx: -20, tz: 0, time: 180, stars: 0 },
  { name: "Hot Wheels", obj: "Curi Kencana S di showroom.", tx: 100, tz: 40, time: 200, stars: 1 },
  { name: "Antar Paket", obj: "Antar paket ke Pelabuhan Segara.", tx: -100, tz: -120, time: 200, stars: 0 },
  { name: "Tagihan Pasar", obj: "Tagih utang di Pasar Senja.", tx: -20, tz: 120, time: 220, stars: 1 },
  { name: "Mata-Mata", obj: "Awasi pertemuan di Lorong Emas.", tx: 100, tz: -40, time: 200, stars: 2 },
  { name: "Balapan Senja", obj: "Menangi balapan pantai.", tx: -120, tz: 100, time: 180, stars: 1 },
  { name: "Gudang Segara", obj: "Amankan gudang di pelabuhan.", tx: -120, tz: -60, time: 240, stars: 2, foes: 3 },
  { name: "Kabur dari WPD", obj: "Lepas dari kejaran polisi.", tx: 60, tz: 40, time: 200, stars: 3 },
  { name: "Heat Wave", obj: "Outrun the helicopter — reach the docks!", tx: -120, tz: -100, time: 170, stars: 4 },
  { name: "Kencana Hilang", obj: "Temukan Kencana S yang dicuri.", tx: 60, tz: 0, time: 220, stars: 2 },
  { name: "Double Cross", obj: "Hadapi pengkhianat di kasino.", tx: 100, tz: -40, time: 240, stars: 3, foes: 4 },
  { name: "The Last Ride", obj: "Cross the city and vanish into the sunset.", tx: -120, tz: 100, time: 240, stars: 5, foes: 3 },
];
const DIALOGUE = {
  Agus: ["Roadblock on Pantai road! Ram it or cut through the sand — your call, Sugeng.", "Kencana S-nya sudah menunggu. Jangan sampai lecet, ya.", "Komisaris Wanto makin gencar. Hati-hati di Alun-Alun."],
  Wanto: ["Sugeng Wibowo, pull over! The whole city is watching tonight.", "Semua unit, tersangka menuju Jl. Pantai Utara. Helikopter sudah di udara.", "Kau tidak bisa kabur selamanya, Wibowo!"],
  Ratna: ["Jalur tikus lewat Kampung Batik masih aman. Ikuti aku.", "Pasar Senja ramai malam ini. Bagus untuk menghilang."],
  Bambang: ["Mesinmu sudah kutenaga. Jangan ditabrak lagi, Sugeng.", "Bengkel buka sampai pagi. Bawa saja mobilnya ke sini."],
};
const DISPATCH = [
  "WPD DISPATCH: All units, suspect heading west on Jl. Pantai Utara. Air support on scene.",
  "WPD DISPATCH: Roadblock requested at the Alun-Alun junction.",
  "WPD DISPATCH: Helicopter has the spotlight. Ground units converge.",
  "WPD DISPATCH: Suspect vehicle is a red Garuda GT. Approach with caution.",
  "WPD DISPATCH: All units, five stars — suspect in Alun-Alun. Helicopter has the spotlight.",
];
const PALETTES = {
  day: { skyTop: C(0x3a6ad8), skyMid: C(0x7fb0e8), skyHor: C(0xe8d8b0), sunCol: C(0xfff2d8), sunDir: [-0.6, 0.7, 0.2], amb: [0.55, 0.55, 0.6], fog: C(0xd8c8a8), fogNear: 90, fogFar: 380, sunR: 0.05 },
  dusk: { skyTop: C(0x5a3a9e), skyMid: C(0xc85a9e), skyHor: C(0xffb060), sunCol: C(0xffd8a0), sunDir: [-0.85, 0.22, 0.12], amb: [0.46, 0.4, 0.48], fog: C(0xe89878), fogNear: 70, fogFar: 330, sunR: 0.08 },
  night: { skyTop: C(0x0a1030), skyMid: C(0x1a2450), skyHor: C(0x3a3a68), sunCol: C(0xa8b8d8), sunDir: [-0.4, 0.8, 0.2], amb: [0.34, 0.34, 0.46], fog: C(0x2a2a4a), fogNear: 50, fogFar: 260, sunR: 0.04 },
};
function mixPal(a, b, t) {
  const o = {};
  for (const k of ["skyTop", "skyMid", "skyHor", "sunCol", "sunDir", "amb", "fog"]) {
    o[k] = a[k].map((v, i) => lerp(v, b[k][i], t));
  }
  for (const k of ["fogNear", "fogFar", "sunR"]) o[k] = lerp(a[k], b[k], t);
  return o;
}
export function paletteAt(clock) {
  const stops = [[0, "night"], [6, "night"], [8, "day"], [16, "day"], [18.5, "dusk"], [20, "night"], [24, "night"]];
  for (let s = 0; s < stops.length - 1; s++) {
    if (clock >= stops[s][0] && clock <= stops[s + 1][0]) {
      const t = (clock - stops[s][0]) / (stops[s + 1][0] - stops[s][0]);
      return mixPal(PALETTES[stops[s][1]], PALETTES[stops[s + 1][1]], t);
    }
  }
  return PALETTES.night;
}
function collideCircle(colliders, x, z, r) {
  for (const [x0, z0, x1, z1] of colliders) {
    const nx = clamp(x, x0, x1), nz = clamp(z, z0, z1);
    const dx = x - nx, dz = z - nz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      const d = Math.sqrt(d2) || 0.001;
      if (d < 0.01) { x = x0 - r; }
      else { x = nx + (dx / d) * r; z = nz + (dz / d) * r; }
    }
  }
  return [clamp(x, -150, 138), clamp(z, -138, 138)];
}
export function createWorld(seed, city) {
  const rng = makeRng(seed);
  const s = {
    seed, city, rng, t: 0, clock: 18.6, day: 1, mode: "title",
    cash: 12480, health: 100, armor: 60, wanted: 0, rep: 1320, repTitle: "FIXER",
    onFoot: false, px: -20, pz: 40, heading: Math.PI, walkPhase: 0, speed: 0,
    car: { x: -20, z: 40, heading: Math.PI, speed: 0, damage: 0, paint: 0xe83038, model: "Garuda GT", engine: 0, armorLv: 0 },
    weapons: WEAPONS.map((w) => ({ mag: w.mag, reserve: w.reserve })), weapon: 2,
    reloadT: 0, fireT: 0, flashT: 0, aimT: 0,
    mission: 8, missionT: 149, missionDone: 8, passedT: 0,
    crewCd: [0, 0, 0], radio: 0, radioOn: true,
    dialogue: null, dispatch: null, dispatchT: 0, popups: [],
    driftCombo: 0, driftT: 0, driftScore: 0,
    police: [], heli: { x: -60, z: 20, y: 27, heading: 0, active: false },
    roadblocks: [], traffic: [], peds: [], enemies: [], particles: [],
    stats: { takedowns: 14, carsStolen: 6, stunts: 2150, kills: 0 },
    bustedT: 0, wastedT: 0, garageSel: 0, saveMsg: "",
    beaconPulse: 0, shake: 0,
  };
  const paints = [0x3f7fd8, 0xe8c83f, 0x3fb88a, 0xd8d8e0, 0x8a5fc0, 0xe8703f];
  for (let k = 0; k < 20; k++) {
    const alongX = rng.chance(0.5), road = rng.pick(ROADS);
    const tr = { road, alongX, d: rng.range(-130, 130), dir: rng.sign(), speed: rng.range(7, 11), paint: rng.pick(paints), model: rng.pick(["Arjuna", "Srikandi", "Bima", "Kencana S"]) };
    tr.x = alongX ? tr.d : road; tr.z = alongX ? road : tr.d;
    tr.heading = alongX ? (tr.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (tr.dir > 0 ? 0 : Math.PI);
    s.traffic.push(tr);
  }
  const shirts = [0x3f7fd8, 0xd84a6a, 0xe8a83f, 0x7a5fc0, 0x3fb88a, 0xd8d8d8];
  for (let k = 0; k < 14; k++) {
    s.peds.push({ x: rng.range(-120, 120), z: rng.range(-120, 120), heading: rng.range(0, TAU), speed: rng.range(1.2, 2), shirt: rng.pick(shirts), phase: rng.range(0, TAU), scatter: 0, tx: 0, tz: 0 });
  }
  return s;
}
export function say(s, speaker, line, dur) {
  s.dialogue = { speaker, line, t: dur || 6 };
}
export function dispatch(s, line) {
  s.dispatch = line; s.dispatchT = 7;
}
export function popup(s, text, sub) {
  s.popups.push({ text, sub: sub || "", t: 2.2 });
  if (s.popups.length > 3) s.popups.shift();
}
function spawnPolice(s, n) {
  while (s.police.length < n) {
    const a = s.rng.range(0, TAU), d = s.rng.range(35, 60);
    s.police.push({ x: s.px + Math.cos(a) * d, z: s.pz + Math.sin(a) * d, heading: 0, speed: 0, siren: s.rng.range(0, TAU), status: "PURSUIT" });
  }
  s.police.length = n;
}
function spawnRoadblocks(s, n) {
  while (s.roadblocks.length < n) {
    const a = s.heading + s.rng.range(-0.5, 0.5), d = s.rng.range(30, 55);
    s.roadblocks.push({ x: s.px + Math.sin(a) * d, z: s.pz + Math.cos(a) * d, heading: a + Math.PI / 2 });
  }
  s.roadblocks.length = n;
}
export function setWanted(s, n) {
  s.wanted = clamp(n, 0, 5);
  spawnPolice(s, s.wanted === 0 ? 0 : s.wanted + 1);
  spawnRoadblocks(s, s.wanted >= 3 ? s.wanted - 2 : 0);
  s.heli.active = s.wanted >= 3;
  if (s.wanted > 0) dispatch(s, s.rng.pick(DISPATCH));
}
export function spawnEnemies(s, n, cx, cz) {
  s.enemies = [];
  for (let k = 0; k < n; k++) {
    s.enemies.push({ x: cx + s.rng.range(-8, 8), z: cz + s.rng.range(-8, 8), heading: s.rng.range(0, TAU), hp: 40, fireT: s.rng.range(0.5, 2), dead: false, fall: 0 });
  }
}
function burst(s, x, y, z, n, col, glow, spd, life, size) {
  for (let k = 0; k < n; k++) {
    const a = s.rng.range(0, TAU), b = s.rng.range(-1, 1);
    s.particles.push({ x, y, z, vx: Math.cos(a) * spd, vy: b * spd * 0.7 + 1.5, vz: Math.sin(a) * spd, life: s.rng.range(0.4, 1) * life, maxLife: life, col, glow, size: size * s.rng.range(0.7, 1.3) });
  }
}
export function shoot(s) {
  const w = WEAPONS[s.weapon], ammo = s.weapons[s.weapon];
  if (s.fireT > 0 || s.reloadT > 0) return;
  if (ammo.mag <= 0) { reload(s); return; }
  s.fireT = w.rate; s.flashT = 0.09; s.aimT = 0.5;
  if (ammo.mag !== Infinity) ammo.mag--;
  const ox = s.px + Math.sin(s.heading) * 0.6, oz = s.pz + Math.cos(s.heading) * 0.6;
  // Hitscan: nearest living enemy in the forward cone.
  let best = null, bestD = w.range;
  for (const e of s.enemies) {
    if (e.dead) continue;
    const dx = e.x - s.px, dz = e.z - s.pz, d = Math.hypot(dx, dz);
    if (d > w.range) continue;
    const facing = (dx * Math.sin(s.heading) + dz * Math.cos(s.heading)) / (d || 1);
    if (facing > 0.86 && d < bestD) { best = e; bestD = d; }
  }
  const endD = best ? bestD : w.range;
  s.particles.push({ tracer: true, x: ox, y: 1.35, z: oz, heading: s.heading, len: endD, life: 0.07, maxLife: 0.07, col: C(0xffe890), glow: 1, size: 1 });
  if (best) {
    best.hp -= w.dmg;
    burst(s, best.x, 1.2, best.z, 6, C(0xffd890), 0.9, 3, 0.5, 0.12);
    if (best.hp <= 0) { best.dead = true; s.stats.kills++; s.stats.takedowns++; popup(s, "TAKEDOWN +$150", ""); s.cash += 150; }
  }
  if (s.weapon > 0 && s.wanted < 5 && s.rng.chance(0.4)) setWanted(s, s.wanted + 1);
  s.shake = Math.min(0.25, s.shake + 0.12);
}
export function reload(s) {
  const w = WEAPONS[s.weapon], ammo = s.weapons[s.weapon];
  if (ammo.mag === Infinity || ammo.mag === w.mag || ammo.reserve <= 0 || s.reloadT > 0) return;
  s.reloadT = 1.1;
}
function finishReload(s) {
  const w = WEAPONS[s.weapon], ammo = s.weapons[s.weapon];
  const need = w.mag - ammo.mag, take = Math.min(need, ammo.reserve);
  ammo.mag += take; ammo.reserve -= take;
}
export function hireCrew(s, i) {
  const c = CREW[i];
  if (s.crewCd[i] > 0 || s.cash < c.cost) return false;
  s.cash -= c.cost; s.crewCd[i] = 20;
  if (i === 0) { setWanted(s, Math.max(0, s.wanted - 1)); say(s, "Agus", "Sudah kubereskan. Polisi kehilangan jejakmu — untuk sekarang."); }
  if (i === 1) { s.car.damage = 0; s.armor = 100; say(s, "Bambang", "Mobil kinclong lagi. Hati-hati di jalan, Sugeng."); }
  if (i === 2) { s.roadblocks = []; say(s, "Ratna", "Jalur tikus bersih. Roadblock sudah dialihkan."); }
  return true;
}
export function enterExitCar(s) {
  if (s.onFoot) {
    const d = Math.hypot(s.car.x - s.px, s.car.z - s.pz);
    if (d < 4.5) { s.onFoot = false; s.px = s.car.x; s.pz = s.car.z; s.heading = s.car.heading; s.stats.carsStolen++; }
  } else {
    s.onFoot = true;
    s.px = s.car.x + Math.cos(s.car.heading) * 2.2; s.pz = s.car.z - Math.sin(s.car.heading) * 2.2;
    s.speed = 0;
  }
}
function missionTarget(s) {
  const m = MISSIONS[Math.min(s.mission, 11)];
  return m;
}
export function updateWorld(s, input, dt) {
  s.t += dt; s.beaconPulse += dt;
  s.clock += dt / 120; if (s.clock >= 24) { s.clock -= 24; s.day++; }
  s.fireT = Math.max(0, s.fireT - dt); s.flashT = Math.max(0, s.flashT - dt); s.aimT = Math.max(0, s.aimT - dt);
  s.shake = Math.max(0, s.shake - dt * 0.8);
  if (s.reloadT > 0) { s.reloadT -= dt; if (s.reloadT <= 0) finishReload(s); }
  for (let i = 0; i < 3; i++) s.crewCd[i] = Math.max(0, s.crewCd[i] - dt);
  if (s.dialogue) { s.dialogue.t -= dt; if (s.dialogue.t <= 0) s.dialogue = null; }
  if (s.dispatchT > 0) { s.dispatchT -= dt; if (s.dispatchT <= 0) s.dispatch = null; }
  for (const p of s.popups) p.t -= dt;
  s.popups = s.popups.filter((p) => p.t > 0);
  // --- Player movement ---
  const maxSpeed = 26 + s.car.engine * 4;
  if (!s.onFoot) {
    const car = s.car;
    if (input.up) car.speed += 15 * dt;
    else if (input.down) car.speed -= 20 * dt;
    else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
    car.speed = clamp(car.speed, -8, maxSpeed * (1 - car.damage * 0.003));
    const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const steerRate = 1.9 * clamp(Math.abs(car.speed) / 10, 0.3, 1) * (car.speed >= 0 ? 1 : -1);
    car.heading += steer * steerRate * dt;
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    let nx = car.x + fx * car.speed * dt, nz = car.z + fz * car.speed * dt;
    [nx, nz] = collideCircle(s.city.colliders, nx, nz, 1.3);
    if ((nx !== car.x + fx * car.speed * dt || nz !== car.z + fz * car.speed * dt) && Math.abs(car.speed) > 8) {
      car.damage = Math.min(100, car.damage + Math.abs(car.speed) * dt * 3);
      burst(s, car.x, 0.6, car.z, 3, C(0xcccccc), 0.2, 2, 0.6, 0.25);
      car.speed *= 0.55; s.shake = Math.min(0.4, s.shake + 0.2);
    }
    car.x = nx; car.z = nz;
    s.px = car.x; s.pz = car.z; s.heading = car.heading; s.speed = car.speed;
    // Drift + combo scoring.
    if (Math.abs(steer) > 0 && Math.abs(car.speed) > 13) {
      s.driftT += dt;
      if (s.driftT > 0.7) {
        s.driftCombo++; s.driftScore += 150 * s.driftCombo; s.stats.stunts += 150 * s.driftCombo;
        popup(s, "+" + 150 * s.driftCombo + " DRIFT · COMBO x" + s.driftCombo, "STUNT COMBO x" + s.driftCombo + " · $" + s.driftScore);
        burst(s, car.x - fx * 1.6, 0.3, car.z - fz * 1.6, 4, C(0xdddddd), 0.15, 1.5, 0.7, 0.3);
        s.driftT = 0;
      }
    } else { s.driftT = Math.max(0, s.driftT - dt * 2); if (s.driftT === 0) s.driftCombo = 0; }
    if (car.damage >= 100) { car.speed = 0; }
  } else {
    const mx = (input.right ? 1 : 0) - (input.left ? 1 : 0), mz = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const moving = mx !== 0 || mz !== 0;
    if (moving) {
      // Camera-relative: forward is -Z of the chase camera (behind heading).
      const camH = s.heading;
      const wx = mx * Math.cos(camH) - mz * Math.sin(camH), wz = mx * Math.sin(camH) + mz * Math.cos(camH);
      const target = Math.atan2(wx, wz);
      s.heading += angDiff(s.heading, target) * Math.min(1, dt * 10);
      const sp = 5.5;
      let nx = s.px + Math.sin(s.heading) * sp * dt, nz = s.pz + Math.cos(s.heading) * sp * dt;
      [nx, nz] = collideCircle(s.city.colliders, nx, nz, 0.5);
      s.px = nx; s.pz = nz; s.walkPhase += dt * 9; s.speed = sp;
    } else s.speed = 0;
  }
  // --- Traffic ---
  for (const tr of s.traffic) {
    tr.d += tr.dir * tr.speed * dt;
    if (tr.d > 135) tr.d = -135; if (tr.d < -135) tr.d = 135;
    tr.x = tr.alongX ? tr.d : tr.road; tr.z = tr.alongX ? tr.road : tr.d;
    tr.heading = tr.alongX ? (tr.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (tr.dir > 0 ? 0 : Math.PI);
  }
  // --- Pedestrians ---
  for (const p of s.peds) {
    const pd = Math.hypot(p.x - s.px, p.z - s.pz);
    if (pd < 8 && Math.abs(s.speed) > 6) p.scatter = 2;
    if (p.scatter > 0) {
      p.scatter -= dt;
      p.heading = Math.atan2(p.x - s.px, p.z - s.pz);
      p.x += Math.sin(p.heading) * 4 * dt; p.z += Math.cos(p.heading) * 4 * dt;
    } else {
      if (Math.hypot(p.tx - p.x, p.tz - p.z) < 3 || (p.tx === 0 && p.tz === 0)) {
        p.tx = clamp(p.x + s.rng.range(-30, 30), -130, 130); p.tz = clamp(p.z + s.rng.range(-30, 30), -130, 130);
      }
      const target = Math.atan2(p.tx - p.x, p.tz - p.z);
      p.heading += angDiff(p.heading, target) * Math.min(1, dt * 4);
      p.x += Math.sin(p.heading) * p.speed * dt; p.z += Math.cos(p.heading) * p.speed * dt;
    }
    p.phase += dt * 7;
    [p.x, p.z] = collideCircle(s.city.colliders, p.x, p.z, 0.4);
  }
  // --- Police pursuit ---
  for (const pc of s.police) {
    const dx = s.px - pc.x, dz = s.pz - pc.z, d = Math.hypot(dx, dz) || 1;
    const target = Math.atan2(dx, dz);
    pc.heading += angDiff(pc.heading, target) * Math.min(1, dt * 2.2);
    pc.speed = lerp(pc.speed, d > 10 ? 19 : 12, dt * 1.5);
    pc.siren += dt * 6;
    let nx = pc.x + Math.sin(pc.heading) * pc.speed * dt, nz = pc.z + Math.cos(pc.heading) * pc.speed * dt;
    [nx, nz] = collideCircle(s.city.colliders, nx, nz, 1.3);
    pc.x = nx; pc.z = nz;
    pc.status = d < 14 ? "RAMMING" : "PURSUIT";
    if (d < 3.2 && !s.onFoot) {
      s.car.damage = Math.min(100, s.car.damage + 6 * dt);
      s.car.speed *= 1 - dt * 0.5;
      burst(s, pc.x, 0.6, pc.z, 2, C(0xffd890), 0.6, 2, 0.4, 0.15);
    }
  }
  // --- Helicopter ---
  const h = s.heli;
  if (h.active) {
    const ta = s.t * 0.35;
    h.x = lerp(h.x, s.px + Math.cos(ta) * 17, dt * 1.2);
    h.z = lerp(h.z, s.pz + Math.sin(ta) * 17, dt * 1.2);
    h.heading = Math.atan2(s.px - h.x, s.pz - h.z);
  }
  // --- Wanted decay (blocked while the heli spotlight is overhead) ---
  if (s.wanted > 0 && !h.active) {
    const nearPolice = s.police.some((pc) => Math.hypot(pc.x - s.px, pc.z - s.pz) < 28);
    if (!nearPolice) {
      s.decayT = (s.decayT || 0) + dt;
      if (s.decayT > 12) { setWanted(s, s.wanted - 1); s.decayT = 0; }
    } else s.decayT = 0;
  }
  // --- Enemies ---
  for (const e of s.enemies) {
    if (e.dead) { e.fall = Math.min(1, e.fall + dt * 3); continue; }
    e.heading = Math.atan2(s.px - e.x, s.pz - e.z);
    e.fireT -= dt;
    const d = Math.hypot(e.x - s.px, e.z - s.pz);
    if (e.fireT <= 0 && d < 30) {
      e.fireT = s.rng.range(1.2, 2.4);
      e.flashT = 0.09;
      if (s.rng.chance(0.45)) {
        const dmg = s.rng.range(5, 9);
        if (s.armor > 0) { s.armor = Math.max(0, s.armor - dmg * 0.6); s.health -= dmg * 0.4; }
        else s.health -= dmg;
        s.shake = Math.min(0.3, s.shake + 0.15);
      }
    }
    e.flashT = Math.max(0, (e.flashT || 0) - dt);
  }
  // --- Particles ---
  for (const p of s.particles) {
    p.life -= dt;
    if (!p.tracer) { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= 3 * dt; }
  }
  s.particles = s.particles.filter((p) => p.life > 0);
  // --- Mission ---
  const m = missionTarget(s);
  if (s.mode === "play" && s.mission < 12) {
    s.missionT -= dt;
    const d = Math.hypot(m.tx - s.px, m.tz - s.pz);
    if (d < 7) {
      const reward = 400 + s.mission * 150;
      s.cash += reward; s.stats.missionsDone = (s.stats.missionsDone || 0) + 1;
      s.missionDone = Math.max(s.missionDone, s.mission + 1);
      popup(s, "MISSION PASSED", "+" + "$" + reward + " · " + m.name);
      say(s, "Agus", DIALOGUE.Agus[s.mission % DIALOGUE.Agus.length]);
      s.mission++;
      if (s.mission < 12) {
        const nm = MISSIONS[s.mission];
        s.missionT = nm.time; setWanted(s, nm.stars);
        if (nm.foes) spawnEnemies(s, nm.foes, nm.tx, nm.tz);
      } else {
        say(s, "Agus", "Semua misi selesai, Sugeng. Wilwatikta milikmu sekarang.");
      }
    } else if (s.missionT <= 0) {
      s.missionT = m.time;
      say(s, "Agus", "Waktu habis! Coba lagi — targetnya masih di sana.");
    }
  }
  // --- Busted / wasted ---
  if (s.health <= 0) { s.mode = "wasted"; s.wastedT = 0; }
  if (s.wanted > 0 && !s.onFoot && Math.abs(s.speed) < 1) {
    const near = s.police.some((pc) => Math.hypot(pc.x - s.px, pc.z - s.pz) < 6);
    if (near) { s.bustedT += dt; if (s.bustedT > 3) { s.mode = "busted"; } } else s.bustedT = 0;
  }
  if (s.dialogue === null && s.rng.chance(dt * 0.02) && s.wanted > 0) say(s, "Wanto", s.rng.pick(DIALOGUE.Wanto));
}
export function respawn(s, busted) {
  if (busted) s.cash = Math.max(0, s.cash - 500);
  s.health = 100; s.armor = 60; setWanted(s, 0);
  s.px = -100; s.pz = 100; s.car.x = -100; s.car.z = 100; s.car.damage = 0;
  s.onFoot = false; s.mode = "play"; s.bustedT = 0;
  say(s, "Agus", busted ? "Aku yang menebusmu. Jangan ulangi, Sugeng." : "Bangun, Sugeng. Kota ini masih menunggumu.");
}
export function saveGame(s, slot) {
  try {
    const data = { cash: s.cash, mission: s.mission, missionDone: s.missionDone, rep: s.rep, car: { paint: s.car.paint, engine: s.car.engine, armorLv: s.car.armorLv }, stats: s.stats, clock: s.clock, day: s.day };
    localStorage.setItem("wilwatikta-save-" + slot, JSON.stringify(data));
    s.saveMsg = "Tersimpan di slot " + (slot + 1);
  } catch (e) { s.saveMsg = "Penyimpanan tidak tersedia"; }
}
export function loadGame(s, slot) {
  try {
    const raw = localStorage.getItem("wilwatikta-save-" + slot);
    if (!raw) return false;
    const d = JSON.parse(raw);
    s.cash = d.cash; s.mission = d.mission; s.missionDone = d.missionDone; s.rep = d.rep;
    s.car.paint = d.car.paint; s.car.engine = d.car.engine; s.car.armorLv = d.car.armorLv;
    s.stats = d.stats; s.clock = d.clock; s.day = d.day;
    s.missionT = MISSIONS[Math.min(s.mission, 11)].time;
    return true;
  } catch (e) { return false; }
}
export function hasSave(slot) {
  try { return !!localStorage.getItem("wilwatikta-save-" + slot); } catch (e) { return false; }
}
export function routePoints(s) {
  // Manhattan route along the road grid from the player to the mission target.
  const m = missionTarget(s), pts = [];
  const gx = (v) => ROADS.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
  let x = s.px, z = s.pz;
  const rx = gx(s.px), rz = gx(m.tz);
  pts.push([x, z], [rx, z], [rx, m.tz], [m.tx, m.tz]);
  return pts;
}
