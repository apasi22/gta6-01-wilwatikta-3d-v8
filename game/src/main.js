// Wilwatikta main: boot, cameras, input, the render loop, staged
// screenshots, and every screen (title, pause, map, garage, saves).
import { createRenderer, MB, C, matIdentity, matPersp, matLook, matModel, matModelS } from "./gl.js";
import { buildCity, ROADS, districtNameAt } from "./city.js";
import { buildHeroCar, buildSedan, buildHeli, buildRotor, buildBlurDisc, buildSearchCone, buildPoolDisc, buildRoadblock, drawHeli } from "./vehicles.js";
import { buildPerson, buildMarker, buildFlash, drawPerson } from "./people.js";
import { createWorld, updateWorld, shoot, reload, hireCrew, enterExitCar, setWanted, spawnEnemies, say, dispatch, popup, paletteAt, saveGame, loadGame, hasSave, respawn, routePoints, WEAPONS, CREW, MISSIONS } from "./world.js";
import { buildWeaponBar, buildCrewCards, updateHUD, drawMapScreen } from "./hud.js";
import { audio, STATIONS } from "./audio.js";
import { clamp, lerp, TAU } from "./rng.js";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const SHOT = params.get("shot") || "";
const canvas = $("game-canvas");
const renderer = createRenderer(canvas);
const SEED = 20261118;
const city = buildCity(SEED);
let s = createWorld(SEED, city);

function up(mb) { return renderer.upload(mb); }
const gpu = {};
gpu.city = up(city.opaque); gpu.cityTrans = up(city.trans);
gpu.heroCar = up(buildHeroCar(0xe83050));
gpu.heroCarGold = up(buildHeroCar(0xe8c83f));
gpu.policeCar = up(buildSedan(0xf0f0f2, true));
const TRAFFIC_PAINTS = [0x3f7fd8, 0xe8c83f, 0x3fb88a, 0xd8d8e0, 0x8a5fc0, 0xe8703f];
gpu.traffic = TRAFFIC_PAINTS.map((p) => up(buildSedan(p, false)));
gpu.heliBody = up(buildHeli()); gpu.rotor = up(buildRotor());
gpu.blur = up(buildBlurDisc()); gpu.cone = up(buildSearchCone()); gpu.pool = up(buildPoolDisc());
gpu.roadblock = up(buildRoadblock());
const heroParts = buildPerson({ pistol: true });
const enemyParts = buildPerson({ shirt: 0x8a2a2a, pants: 0x2a2a34, glasses: false, stripe: false });
const pedShirts = [0x3f7fd8, 0xd84a6a, 0xe8a83f, 0x7a5fc0, 0x3fb88a, 0xd8d8d8];
const pedParts = pedShirts.map((sh) => buildPerson({ shirt: sh, pants: 0x4a4a58, glasses: false, stripe: false }));
function upPerson(parts) {
  const g = {};
  for (const k of ["torso", "head", "armL", "armR", "legL", "legR", "pistol"]) g[k] = up(parts[k]);
  return g;
}
gpu.hero = upPerson(heroParts); gpu.enemy = upPerson(enemyParts);
gpu.peds = pedParts.map(upPerson);
gpu.marker = up(buildMarker()); gpu.flash = up(buildFlash());
const beaconMb = new MB();
beaconMb.prism(0, 0, 0, 0.55, 15, 8, C(0xffd84f), 0.85, 0.55);
beaconMb.cone(0, 15, 0, 0.8, 16.2, 6, C(0xffd84f), 0.95);
gpu.beacon = up(beaconMb);
const ballMb = new MB(); ballMb.ball(0, 0, 0, 1, 6, C(0xffffff), 0.8);
gpu.puff = up(ballMb);
const tracerMb = new MB(); tracerMb.box(0, 0, 0, 0.07, 0.07, 1, C(0xffe890), 1);
gpu.tracer = up(tracerMb);
// Per-person GPU bundles referenced by drawPerson's `gpu` argument.
gpu.hero.marker = gpu.marker; gpu.hero.flash = gpu.flash;
gpu.enemy.marker = gpu.marker; gpu.enemy.flash = gpu.flash;
for (const g of gpu.peds) { g.marker = gpu.marker; g.flash = gpu.flash; }

const cam = { x: 0, y: 4, z: 0, tx: 0, ty: 1, tz: 0, fov: 1.05 };
const input = { up: false, down: false, left: false, right: false, shoot: false };
let saveContext = "load";
let howtoFrom = "title";

function showOnly(id) {
  for (const o of document.querySelectorAll(".overlay")) o.style.display = "none";
  if (id) $(id).style.display = "flex";
  $("hud").style.display = s.mode === "play" ? "block" : "none";
  document.body.className = "mode-" + s.mode + (SHOT ? " shot" : "");
}
function startGame(fresh) {
  if (fresh) s = createWorld(SEED, city);
  s.mode = "play";
  window.__game = s;
  showOnly(null);
  say(s, "Agus", "Selamat datang di Wilwatikta, Sugeng. Misi pertama menunggumu di Alun-Alun.");
  audio.unlock();
}
function openTitle() { s.mode = "title"; showOnly("title-screen"); }

// --- Input ---
const KEYMAP = { KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down", KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right", KeyJ: "shoot" };
addEventListener("keydown", (e) => {
  if (KEYMAP[e.code] !== undefined) { input[KEYMAP[e.code]] = true; e.preventDefault(); }
  audio.unlock();
  if (s.mode === "title" && (e.code === "Enter" || e.code === "Space")) { startGame(false); return; }
  if (e.code === "KeyP" || e.code === "Escape") {
    if (s.mode === "play") { s.mode = "pause"; showOnly("pause-screen"); }
    else if (s.mode === "pause" || s.mode === "map" || s.mode === "garage" || s.mode === "howto") { s.mode = "play"; showOnly(null); }
    return;
  }
  if (e.code === "KeyM" && s.mode === "map") { s.mode = "play"; showOnly(null); return; }
  if (s.mode !== "play") return;
  if (e.code === "KeyE") enterExitCar(s);
  if (e.code === "KeyR") reload(s);
  if (e.code >= "Digit1" && e.code <= "Digit5") {
    const i = +e.code.slice(5) - 1;
    if (!WEAPONS[i].locked) { s.weapon = i; audio.blip(520 + i * 90); }
  }
  if (e.code === "KeyZ") hireCrew(s, 0);
  if (e.code === "KeyX") hireCrew(s, 1);
  if (e.code === "KeyC") hireCrew(s, 2);
  if (e.code === "KeyT") { s.radio = (s.radio + 1) % STATIONS.length; audio.setStation(s.radio); $("radio-name").textContent = STATIONS[s.radio].name; $("radio-track").textContent = STATIONS[s.radio].track; }
  if (e.code === "KeyM") { s.mode = "map"; showOnly("map-screen"); drawMapScreen(s, city.pois); }
  if (e.code === "KeyG") {
    const d = Math.hypot(s.px - city.garage.x, s.pz - city.garage.z);
    if (d < 16) { s.mode = "garage"; showOnly("garage-screen"); refreshGarage(); }
    else say(s, "Bambang", "Bengkelku di Lorong Emas. Bawa mobilmu ke sana.");
  }
});
addEventListener("keyup", (e) => { if (KEYMAP[e.code] !== undefined) input[KEYMAP[e.code]] = false; });
canvas.addEventListener("mousedown", () => {
  audio.unlock();
  if (s.mode === "title") { startGame(false); return; }
  if (s.mode === "play") { input.shoot = true; setTimeout(() => { input.shoot = false; }, 120); }
});
function refreshGarage() {
  $("garage-info").innerHTML =
    "<div>ENGINE LV <b>" + s.car.engine + "</b> — $500</div><div>ARMOR LV <b>" + s.car.armorLv + "</b> — $400</div>" +
    "<div>PAINT — $250</div><div>CASH <b>$" + s.cash.toLocaleString("en-US") + "</b></div><div>DAMAGE <b>" + Math.round(s.car.damage) + "%</b></div>";
}
// Menu buttons.
$("btn-new").onclick = () => startGame(true);
$("btn-continue").onclick = () => { if (loadGame(s, 0)) { s.mode = "play"; showOnly(null); } else startGame(true); };
$("btn-howto").onclick = () => { howtoFrom = "title"; s.mode = "howto"; showOnly("howto-screen"); };
$("btn-load").onclick = () => { saveContext = "load"; s.mode = "save"; showOnly("save-screen"); refreshSaves(); };
$("btn-resume").onclick = () => { s.mode = "play"; showOnly(null); };
$("btn-save").onclick = () => { saveContext = "save"; s.mode = "save"; showOnly("save-screen"); refreshSaves(); };
$("btn-pause-howto").onclick = () => { howtoFrom = "pause"; s.mode = "howto"; showOnly("howto-screen"); };
$("btn-quit").onclick = () => openTitle();
$("btn-howto-back").onclick = () => { if (howtoFrom === "title") openTitle(); else { s.mode = "pause"; showOnly("pause-screen"); } };
$("btn-map-close").onclick = () => { s.mode = "play"; showOnly(null); };
$("btn-garage-close").onclick = () => { s.mode = "play"; showOnly(null); };
$("btn-save-back").onclick = () => { s.mode = "play"; showOnly(null); };
$("btn-busted").onclick = () => respawn(s, true);
$("btn-wasted").onclick = () => respawn(s, false);
$("btn-engine").onclick = () => { if (s.cash >= 500 && s.car.engine < 3) { s.cash -= 500; s.car.engine++; audio.blip(880); } refreshGarage(); };
$("btn-armor").onclick = () => { if (s.cash >= 400 && s.car.armorLv < 3) { s.cash -= 400; s.car.armorLv++; s.armor = 100; audio.blip(880); } refreshGarage(); };
$("btn-paint").onclick = () => {
  if (s.cash >= 250) {
    s.cash -= 250;
    const paints = [0xe83038, 0x3f7fd8, 0xe8c83f, 0x3fb88a, 0x8a5fc0];
    s.car.paint = paints[(paints.indexOf(s.car.paint) + 1) % paints.length];
    gpu.heroCar = up(buildHeroCar(s.car.paint)); audio.blip(880);
  }
  refreshGarage();
};
function refreshSaves() {
  $("save-slots").innerHTML = "";
  for (let i = 0; i < 3; i++) {
    const b = document.createElement("button");
    b.className = "menu-btn";
    b.textContent = "SLOT " + (i + 1) + (hasSave(i) ? " — SAVED" : " — EMPTY");
    b.onclick = () => {
      if (saveContext === "save") { saveGame(s, i); refreshSaves(); }
      else if (loadGame(s, i)) { s.mode = "play"; showOnly(null); }
    };
    $("save-slots").appendChild(b);
  }
  $("save-title").textContent = saveContext === "save" ? "SAVE GAME" : "LOAD GAME";
}

// --- Staging for screenshots ---
// Title composition: hero on the beach road facing the camera, slightly
// left of center; the hero car parked at a slant behind him to the right;
// palms, warehouses, sea and sunset behind.
const TITLE_SPOT = { hx: -118, hz: 20, cx: -118.5, cz: 15.8, carHeading: 0.85, eye: [-115.2, 1.5, 22.0], tgt: [-118.9, 1.05, 18.6], heroHeading: 0.95 };
function stageShot() {
  document.body.classList.add("shot");
  if (SHOT === "cover") {
    s.mode = "play"; s.clock = 18.6; s.mission = 8; s.missionT = 149; s.missionDone = 8;
    s.cash = 12480; s.rep = 1320;
    s.car.x = -40; s.car.z = 40; s.car.heading = -Math.PI / 2; s.car.speed = 17; s.car.damage = 8;
    s.onFoot = false; s.px = -40; s.pz = 40; s.heading = -Math.PI / 2; s.speed = 17;
    setWanted(s, 4);
    s.police[0].x = -64; s.police[0].z = 40; s.police[0].heading = -Math.PI / 2;
    s.police[1].x = -58; s.police[1].z = 44; s.police[1].heading = -Math.PI / 2;
    s.police[2].x = -72; s.police[2].z = 37; s.police[2].heading = -Math.PI / 2;
    s.heli.x = -68; s.heli.z = 36; s.heli.y = 13;
    s.roadblocks = [{ x: -78, z: 40, heading: 0 }];
    say(s, "Agus", "Roadblock on Pantai road! Ram it or cut through the sand — your call, Sugeng.", 999);
    dispatch(s, "WPD DISPATCH: All units, suspect heading west on Jl. Pantai Utara. Air support on scene.");
    popup(s, "+300 DRIFT · COMBO x2", "STUNT COMBO x2 · $450");
    s.weapon = 2;
    for (let k = 0; k < 5; k++) updateWorld(s, { up: true }, 1 / 60);
    s.car.speed = 17; s.speed = 17;
  } else if (SHOT === "map") {
    s.mode = "map"; s.clock = 18.8; s.mission = 11; s.missionT = 199; s.missionDone = 11;
    s.cash = 13230; s.rep = 1320; s.px = 20; s.pz = 20;
    setWanted(s, 4);
    showOnly("map-screen"); drawMapScreen(s, city.pois);
  } else if (SHOT === "title") {
    s.mode = "title"; s.clock = 18.6;
    showOnly("title-screen");
  } else if (SHOT === "night") {
    s.mode = "play"; s.clock = 21.3; s.mission = 11; s.missionT = 199; s.missionDone = 11;
    s.cash = 15230; s.rep = 1320;
    s.onFoot = true; s.px = 0; s.pz = 24; s.heading = Math.PI; s.walkPhase = 0.6;
    s.car.x = -6; s.car.z = 28; s.car.heading = Math.PI + 0.4;
    setWanted(s, 5);
    spawnEnemies(s, 3, 0, 6);
    s.enemies[0].x = -5; s.enemies[0].z = 8; s.enemies[1].x = 2; s.enemies[1].z = 4; s.enemies[2].x = 7; s.enemies[2].z = 9;
    s.police[0].x = -8; s.police[0].z = -2; s.police[1].x = 8; s.police[1].z = -4;
    s.heli.x = 4; s.heli.z = 14; s.heli.y = 24;
    s.weapon = 1; s.aimT = 999; s.flashT = 0.09;
    s.particles.push({ tracer: true, x: 0.3, y: 1.35, z: 23, heading: Math.PI, len: 16, life: 9, maxLife: 9, col: C(0xffe890), glow: 1, size: 1 });
    say(s, "Wanto", "Sugeng Wibowo, pull over! The whole city is watching tonight.", 999);
    dispatch(s, "WPD DISPATCH: All units, five stars — suspect in Alun-Alun. Helicopter has the spotlight.");
    for (let k = 0; k < 5; k++) updateWorld(s, {}, 1 / 60);
    s.aimT = 999; s.flashT = 0.09;
  }
  showOnly(s.mode === "play" ? null : s.mode === "map" ? "map-screen" : s.mode === "title" ? "title-screen" : null);
  if (SHOT === "map") { showOnly("map-screen"); drawMapScreen(s, city.pois); }
}

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.resize(w, h);
}
addEventListener("resize", resize);
resize();
buildWeaponBar(); buildCrewCards();
$("radio-name").textContent = STATIONS[0].name;
$("radio-track").textContent = STATIONS[0].track;

let lastT = performance.now(), frames = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (s.mode === "play" && !SHOT) {
    if (input.shoot) shoot(s);
    updateWorld(s, input, dt);
    audio.engine(s.onFoot ? 0 : s.car.speed, input.up);
    audio.siren(s.wanted > 0 && s.police.length > 0, s.t);
  }
  if (s.mode === "busted") showOnly("busted-screen");
  if (s.mode === "wasted") showOnly("wasted-screen");
  render();
  if (s.mode === "play" || s.mode === "map") updateHUD(s);
  frames++;
  if (SHOT && frames === 8) window.__ready = true;
  if (!SHOT && frames === 3) window.__ready = true;
  requestAnimationFrame(frame);
}

function computeCamera() {
  const w = innerWidth, h = innerHeight, aspect = w / h;
  let eye, tgt, fov = 1.05;
  if (s.mode === "title") {
    const sp = TITLE_SPOT;
    eye = [sp.eye[0], sp.eye[1], sp.eye[2]]; tgt = [sp.tgt[0], sp.tgt[1], sp.tgt[2]]; fov = 0.96;
  } else if (SHOT === "cover") {
    // Rear-three-quarter chase view: behind and to the car's left so the
    // wedge profile, canopy and gloss read instead of a flat rear face.
    const fx = Math.sin(s.car.heading), fz = Math.cos(s.car.heading);
    const lx = Math.cos(s.car.heading), lz = -Math.sin(s.car.heading);
    eye = [s.car.x - fx * 8.8 + lx * 2.8, 3.4, s.car.z - fz * 8.8 + lz * 2.8];
    tgt = [s.car.x + fx * 6, 1.2, s.car.z + fz * 6]; fov = 1.08;
  } else if (SHOT === "night") {
    const fx = Math.sin(s.heading), fz = Math.cos(s.heading);
    eye = [s.px - fx * 6.2, 2.9, s.pz - fz * 6.2];
    tgt = [s.px + fx * 8, 1.2, s.pz + fz * 8]; fov = 1.02;
  } else if (SHOT === "map") {
    // Fixed aerial view behind the map overlay (deterministic capture).
    eye = [70, 55, 70]; tgt = [-10, 0, -10]; fov = 1.05;
  } else if (!s.onFoot) {
    const fx = Math.sin(s.car.heading), fz = Math.cos(s.car.heading);
    const ex = s.car.x - fx * 8.6, ez = s.car.z - fz * 8.6;
    cam.x = lerp(cam.x, ex, 0.09); cam.z = lerp(cam.z, ez, 0.09); cam.y = lerp(cam.y, 3.4, 0.09);
    cam.tx = lerp(cam.tx, s.car.x + fx * 6, 0.14); cam.tz = lerp(cam.tz, s.car.z + fz * 6, 0.14); cam.ty = lerp(cam.ty, 1.2, 0.14);
    eye = [cam.x, cam.y, cam.z]; tgt = [cam.tx, cam.ty, cam.tz];
    fov = 1.02 + Math.abs(s.car.speed) * 0.006;
  } else {
    const fx = Math.sin(s.heading), fz = Math.cos(s.heading);
    const ex = s.px - fx * 5.6, ez = s.pz - fz * 5.6;
    cam.x = lerp(cam.x, ex, 0.12); cam.z = lerp(cam.z, ez, 0.12); cam.y = lerp(cam.y, 2.7, 0.12);
    cam.tx = lerp(cam.tx, s.px + fx * 4, 0.16); cam.tz = lerp(cam.tz, s.pz + fz * 4, 0.16); cam.ty = lerp(cam.ty, 1.4, 0.16);
    eye = [cam.x, cam.y, cam.z]; tgt = [cam.tx, cam.ty, cam.tz];
  }
  if (s.shake > 0 && !SHOT) {
    eye[0] += (Math.random() - 0.5) * s.shake; eye[1] += (Math.random() - 0.5) * s.shake;
  }
  const view = matLook(eye, tgt, [0, 1, 0]);
  const proj = matPersp(fov, aspect, 0.1, 700);
  return { eye, tgt, view, proj, aspect, fov };
}
function render() {
  const pal = paletteAt(s.clock);
  const { view, proj, aspect, eye, tgt, fov } = computeCamera();
  // Sun disc placement from the camera orientation: azimuth from the
  // camera's right vector, elevation from the camera's pitch so the disc
  // sits at the horizon instead of hiding behind the buildings.
  const fwdX = -view[2], fwdZ = -view[10], rightX = view[0], rightZ = view[8];
  const sunXZ = [-0.85, -0.25], sl = Math.hypot(sunXZ[0], sunXZ[1]);
  const sunDot = (fwdX * sunXZ[0] + fwdZ * sunXZ[1]) / sl;
  const sunSide = (rightX * sunXZ[0] + rightZ * sunXZ[1]) / sl;
  const pitch = Math.atan2(tgt[1] - eye[1], Math.hypot(tgt[0] - eye[0], tgt[2] - eye[2]));
  // +0.18 artistic lift: the disc sits in open sky above the rooflines
  // instead of hiding behind the buildings at the geometric horizon.
  const sunY = clamp(Math.tan(-pitch) / Math.tan(fov / 2) + 0.2, -0.4, 0.7);
  const sunScreen = [clamp(-sunSide * 1.5, -0.92, 0.92), sunY];
  const sunI = s.clock > 19.5 || s.clock < 6.5 ? 0.25 : clamp(0.3 + sunDot * 0.9, 0.05, 1);
  renderer.begin(pal, view, proj, sunScreen, sunI, aspect);
  renderer.draw(gpu.city, matIdentity(), 1);
  renderer.draw(gpu.cityTrans, matIdentity(), 0.32);
  const titleMode = s.mode === "title";
  // Hero car + tilted title car.
  if (titleMode) {
    const sp = TITLE_SPOT;
    renderer.draw(gpu.heroCar, matModel(sp.cx, 0, sp.cz, sp.carHeading, 0, 1), 1);
  } else {
    renderer.draw(gpu.heroCar, matModel(s.car.x, 0, s.car.z, s.car.heading, 0, 1), 1);
  }
  // Traffic.
  for (const tr of s.traffic) {
    const mesh = gpu.traffic[TRAFFIC_PAINTS.indexOf(tr.paint)] || gpu.traffic[0];
    renderer.draw(mesh, matModel(tr.x || 0, 0, tr.z || 0, tr.heading || 0, 0, 1), 1);
  }
  // Police + roadblocks.
  for (const pc of s.police) renderer.draw(gpu.policeCar, matModel(pc.x, 0, pc.z, pc.heading, 0, 1), 1);
  for (const rb of s.roadblocks) renderer.draw(gpu.roadblock, matModel(rb.x, 0, rb.z, rb.heading, 0, 1), 1);
  // People.
  if (titleMode) {
    const sp = TITLE_SPOT;
    drawPerson(renderer, gpu.hero, heroParts, sp.hx, 0, sp.hz, sp.heroHeading, { armed: true, headYaw: -0.28, phase: 0 });
  } else {
    if (s.onFoot) drawPerson(renderer, gpu.hero, heroParts, s.px, 0, s.pz, s.heading, { walk: s.speed > 0.5 ? 1 : 0, phase: s.walkPhase, aim: s.aimT > 0, armed: s.weapon > 0, flash: s.flashT > 0 });
    for (const e of s.enemies) {
      if (e.fall >= 1) continue;
      drawPerson(renderer, gpu.enemy, enemyParts, e.x, 0, e.z, e.heading, { marker: !e.dead, flash: (e.flashT || 0) > 0, armed: true, aim: true, phase: 0 });
    }
    s.peds.forEach((p, i) => {
      drawPerson(renderer, gpu.peds[i % gpu.peds.length], pedParts[i % pedParts.length], p.x, 0, p.z, p.heading, { walk: 1, phase: p.phase });
    });
  }
  // Helicopter.
  if (s.heli.active || SHOT === "cover" || SHOT === "night") {
    drawHeli(renderer, { body: gpu.heliBody, rotor: gpu.rotor, blur: gpu.blur, cone: gpu.cone, pool: gpu.pool }, s.heli, s.t);
  }
  // Mission beacon + route dots (play mode only).
  if (s.mode === "play" && s.mission < 12) {
    const m = MISSIONS[s.mission];
    const pulse = 1 + Math.sin(s.beaconPulse * 3) * 0.12;
    renderer.draw(gpu.beacon, matModelS(m.tx, 0, m.tz, 0, 0, pulse, 1, pulse), 0.4);
    renderer.draw(gpu.pool, matModelS(m.tx, 0.1, m.tz, 0, 0, 2.6, 1, 2.6), 0.4);
    const pts = routePoints(s);
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const segLen = Math.hypot(bx - ax, bz - az), n = Math.floor(segLen / 5);
      for (let k = 1; k < n; k++) {
        const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        renderer.draw(gpu.pool, matModelS(x, 0.09, z, 0, 0, 0.55, 1, 0.55), 0.3 + 0.15 * Math.sin(s.beaconPulse * 3 + k));
      }
    }
  }
  // Headlight pools at dusk/night.
  if (s.clock > 17.5 || s.clock < 7) {
    const cars = [{ x: s.car.x, z: s.car.z, heading: s.car.heading }, ...s.police];
    for (const c of cars) {
      const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
      renderer.draw(gpu.pool, matModelS(c.x + fx * 4.5, 0.08, c.z + fz * 4.5, 0, 0, 2.4, 1, 3.4), 0.22);
    }
  }
  // Particles.
  for (const p of s.particles) {
    const a = clamp(p.life / p.maxLife, 0, 1);
    if (p.tracer) {
      renderer.draw(gpu.tracer, matModelS(p.x + Math.sin(p.heading) * p.len / 2, p.y, p.z + Math.cos(p.heading) * p.len / 2, p.heading, 0, 1, 1, p.len), 0.9);
    } else {
      renderer.draw(gpu.puff, matModelS(p.x, p.y, p.z, 0, 0, p.size, p.size, p.size), a * 0.8);
    }
  }
  renderer.finish();
}

if (SHOT) stageShot();
else openTitle();
window.__game = s;
requestAnimationFrame(frame);
