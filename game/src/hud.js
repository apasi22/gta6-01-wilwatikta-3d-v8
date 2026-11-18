// HUD for Wilwatikta: mission panel, cash and stars, the BLUE WPD response
// list, crew cards, weapon bar, speedometer, circular minimap, dialogue
// with painted portraits, popups, and the full city-map overlay.
import { WEAPONS, CREW, MISSIONS } from "./world.js";
import { ROADS, DISTRICTS, districtNameAt } from "./city.js";
import { clamp } from "./rng.js";

const $ = (id) => document.getElementById(id);
const PORTRAITS = {
  Agus: { bg: "#e8912d", shirt: "#e8912d", hair: "#2a2a2a", skin: "#d8a878", stripe: false, cap: false },
  Wanto: { bg: "#4a7fd8", shirt: "#2a4a8a", hair: "#1a1a1a", skin: "#c89878", stripe: false, cap: true },
  Ratna: { bg: "#d83a6a", shirt: "#d83a6a", hair: "#181818", skin: "#e0b088", stripe: false, cap: false },
  Bambang: { bg: "#4a7fd8", shirt: "#3a6ab8", hair: "#2a2a2a", skin: "#c89068", stripe: false, cap: true },
  Sugeng: { bg: "#1f9e6a", shirt: "#1f9e6a", hair: "#181818", skin: "#d8a878", stripe: true, cap: false },
};
export function drawPortrait(canvas, speaker) {
  const p = PORTRAITS[speaker] || PORTRAITS.Sugeng, g = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  g.fillStyle = p.bg; g.fillRect(0, 0, W, H);
  // Shoulders + shirt, bold white stripe for Sugeng.
  g.fillStyle = p.shirt;
  g.beginPath(); g.moveTo(W * 0.1, H); g.quadraticCurveTo(W * 0.5, H * 0.52, W * 0.9, H); g.closePath(); g.fill();
  if (p.stripe) { g.fillStyle = "#f4f4f0"; g.fillRect(W * 0.46, H * 0.62, W * 0.08, H * 0.38); }
  // Round head, short black hair, sunglasses.
  g.fillStyle = p.skin;
  g.beginPath(); g.arc(W * 0.5, H * 0.38, W * 0.26, 0, Math.PI * 2); g.fill();
  g.fillStyle = p.hair;
  g.beginPath(); g.arc(W * 0.5, H * 0.32, W * 0.27, Math.PI, Math.PI * 2); g.fill();
  g.fillRect(W * 0.24, H * 0.3, W * 0.06, H * 0.14); g.fillRect(W * 0.7, H * 0.3, W * 0.06, H * 0.14);
  if (p.cap) { g.fillStyle = "#223a5e"; g.fillRect(W * 0.22, H * 0.08, W * 0.56, H * 0.12); g.fillRect(W * 0.2, H * 0.18, W * 0.6, H * 0.05); }
  g.fillStyle = "#14141c";
  g.fillRect(W * 0.3, H * 0.34, W * 0.16, H * 0.07); g.fillRect(W * 0.54, H * 0.34, W * 0.16, H * 0.07);
  g.fillRect(W * 0.46, H * 0.36, W * 0.08, H * 0.03);
}
const SPEAKER_ROLE = { Agus: "FIXER", Wanto: "WPD", Ratna: "CREW", Bambang: "MEKANIK", Sugeng: "SUGENG WIBOWO" };

// Weapon slot icons as inline SVG silhouettes (no font dependency).
const ICONS = [
  '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="3" height="8" rx="1.5" fill="#fff"/><rect x="10" y="3" width="3" height="9" rx="1.5" fill="#fff"/><rect x="14" y="4" width="3" height="8" rx="1.5" fill="#fff"/><rect x="5" y="10" width="14" height="10" rx="4" fill="#fff"/><rect x="16" y="12" width="5" height="4" rx="2" fill="#fff"/></svg>',
  '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="16" height="5" rx="1" fill="#fff"/><rect x="14" y="11" width="4" height="8" rx="1" fill="#fff"/><rect x="17" y="8" width="4" height="3" fill="#fff"/></svg>',
  '<svg viewBox="0 0 24 24"><rect x="2" y="7" width="18" height="4" rx="1" fill="#fff"/><rect x="9" y="11" width="4" height="7" rx="1" fill="#fff"/><rect x="15" y="11" width="3" height="6" rx="1" fill="#fff"/><rect x="18" y="8" width="4" height="2" fill="#fff"/></svg>',
  '<svg viewBox="0 0 24 24"><rect x="1" y="8" width="20" height="3.5" rx="1" fill="#fff"/><rect x="10" y="11.5" width="4" height="7" rx="1" fill="#fff"/><rect x="17" y="11.5" width="3" height="5" rx="1" fill="#fff"/><rect x="5" y="5" width="5" height="3" rx="1" fill="#fff"/></svg>',
  '<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2" fill="#ffd84f"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="#ffd84f" stroke-width="2.5"/></svg>',
];
export function buildWeaponBar() {
  const bar = $("weapon-bar");
  bar.innerHTML = "";
  WEAPONS.forEach((w, i) => {
    const d = document.createElement("div");
    d.className = "wslot" + (w.locked ? " locked" : "");
    d.innerHTML = "<span class='wnum'>" + (i + 1) + "</span><span class='wicon'>" + ICONS[i] + "</span><span class='wammo'></span><span class='wname'>" + w.name.split(" ")[0] + "</span>";
    bar.appendChild(d);
  });
}
export function buildCrewCards() {
  const panel = $("crew-panel");
  panel.innerHTML = "";
  CREW.forEach((c, i) => {
    const d = document.createElement("div");
    d.className = "crew-card";
    d.innerHTML = "<span class='crew-badge' style='background:" + c.col + "'>" + c.name[0] + "</span><span class='crew-info'><b>" + c.name + "</b><i>" + c.role + "</i><em>$" + c.cost + " · " + c.key + "</em></span><span class='crew-cd'></span>";
    panel.appendChild(d);
  });
}
function fmtTime(sec) {
  const m = Math.floor(Math.max(0, sec) / 60), s = Math.floor(Math.max(0, sec) % 60);
  return m + ":" + String(s).padStart(2, "0");
}
export function updateHUD(s) {
  const m = MISSIONS[Math.min(s.mission, 11)];
  const dist = Math.round(Math.hypot(m.tx - s.px, m.tz - s.pz));
  $("m-name").textContent = "MISSION " + Math.min(s.mission + 1, 12) + "/12 — " + m.name;
  $("m-obj").textContent = m.obj;
  $("m-time").textContent = "◷ " + fmtTime(s.missionT);
  $("m-dist").textContent = "▲ " + dist + "m";
  $("m-bar").style.width = clamp((1 - dist / 220) * 100, 4, 100) + "%";
  $("m-next").textContent = "NEXT: " + (s.mission + 1 < 12 ? MISSIONS[s.mission + 1].name.toUpperCase() : "FREE ROAM");
  $("mission-title").textContent = "MISSION " + Math.min(s.mission + 1, 12) + "/12 — " + m.name.toUpperCase();
  $("district-banner").textContent = districtNameAt(s.px, s.pz).toUpperCase();
  $("cash").textContent = "$" + s.cash.toLocaleString("en-US");
  $("stars").textContent = "★".repeat(s.wanted) + "☆".repeat(5 - s.wanted);
  const hh = Math.floor(s.clock), mm = Math.floor((s.clock - hh) * 60);
  $("clock").textContent = String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0") + " · DAY " + s.day;
  // WPD panel (blue heading + blue unit labels).
  const wpd = $("wpd-panel");
  if (s.wanted > 0) {
    wpd.style.display = "block";
    const rows = [];
    const units = [["UNIT 7 · WPD", 0], ["UNIT 12 · WPD", 1], ["UNIT 5 · WPD", 2], ["HELI-1 · WPD AIR", -1]];
    units.forEach(([label, idx], k) => {
      let d = 0, st = "PURSUIT";
      if (idx >= 0 && s.police[idx]) { d = Math.round(Math.hypot(s.police[idx].x - s.px, s.police[idx].z - s.pz)); st = s.police[idx].status; }
      if (idx === -1) { d = Math.round(Math.hypot(s.heli.x - s.px, s.heli.z - s.pz)); st = s.heli.active ? "SPOTLIGHT" : "STANDBY"; }
      rows.push("<div class='wpd-row'><span class='wpd-unit'>" + label + "</span><span class='wpd-dist'>" + d + "m</span><span class='wpd-status st-" + st + "'>" + st + "</span></div>");
    });
    if (s.roadblocks.length) rows.push("<div class='wpd-row'><span class='wpd-unit'>ROADBLOCK</span><span class='wpd-dist'>" + Math.round(Math.hypot(s.roadblocks[0].x - s.px, s.roadblocks[0].z - s.pz)) + "m</span><span class='wpd-status st-ROADBLOCK'>ROADBLOCK</span></div>");
    $("wpd-rows").innerHTML = rows.join("");
  } else wpd.style.display = "none";
  // Crew cooldowns.
  [...$("crew-panel").children].forEach((card, i) => {
    card.querySelector(".crew-cd").textContent = s.crewCd[i] > 0 ? Math.ceil(s.crewCd[i]) + "s" : "";
    card.classList.toggle("cooling", s.crewCd[i] > 0);
    card.classList.toggle("poor", s.cash < CREW[i].cost);
  });
  // Weapon bar.
  const w = WEAPONS[s.weapon], ammo = s.weapons[s.weapon];
  [...$("weapon-bar").children].forEach((slot, i) => {
    slot.classList.toggle("sel", i === s.weapon);
    const a = s.weapons[i];
    slot.querySelector(".wammo").textContent = a.mag === Infinity ? "∞" : a.mag + " / " + a.reserve;
  });
  $("weapon-name").textContent = w.name;
  $("weapon-ammo").textContent = ammo.mag === Infinity ? "∞ ROUNDS" : ammo.mag + " / " + ammo.reserve + " ROUNDS";
  // Speedometer.
  const kmh = Math.round(Math.abs(s.speed) * 4.2);
  $("speed-num").textContent = kmh;
  $("speed-gear").textContent = s.onFoot ? "–" : String(clamp(Math.floor(kmh / 24) + 1, 1, 5));
  $("car-name").textContent = s.onFoot ? "ON FOOT" : s.car.model.toUpperCase();
  $("condition-bar").style.width = (100 - s.car.damage) + "%";
  $("condition-bar").style.background = s.car.damage > 60 ? "#e84a3a" : "#3fd84a";
  // Vitals.
  $("hp-bar").style.width = s.health + "%";
  $("armor-bar").style.width = s.armor + "%";
  $("rep-label").textContent = "REP " + s.repTitle + " · " + s.rep;
  $("mini-district").textContent = districtNameAt(s.px, s.pz);
  $("mini-street").textContent = "Jl. " + (Math.abs(s.px) < Math.abs(s.pz) ? "Pantai Utara" : "Merdeka");
  // Dialogue + dispatch + popups.
  const dlg = $("dialogue");
  if (s.dialogue) {
    dlg.style.display = "flex";
    drawPortrait($("dlg-portrait"), s.dialogue.speaker);
    $("dlg-name").textContent = s.dialogue.speaker === "Wanto" ? "KOMISARIS WANTO" : s.dialogue.speaker.toUpperCase();
    $("dlg-role").textContent = SPEAKER_ROLE[s.dialogue.speaker] || "";
    $("dlg-text").textContent = s.dialogue.line;
  } else dlg.style.display = "none";
  $("dispatch").textContent = s.dispatch || "";
  $("dispatch").style.display = s.dispatch ? "block" : "none";
  $("popups").innerHTML = s.popups.map((p) => "<div class='popup'><b>" + p.text + "</b>" + (p.sub ? "<i>" + p.sub + "</i>" : "") + "</div>").join("");
  $("vignette").style.opacity = s.health < 30 ? String(0.55 - s.health * 0.012) : "0";
  drawMinimap(s);
}
function drawMinimap(s) {
  const cv = $("minimap-canvas"), g = cv.getContext("2d"), W = cv.width;
  g.clearRect(0, 0, W, W);
  g.save();
  g.beginPath(); g.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2); g.clip();
  g.fillStyle = "#1a2438"; g.fillRect(0, 0, W, W);
  const scale = W / 300, px = (x) => (x + 150) * scale, pz = (z) => (z + 150) * scale;
  // District blocks.
  for (let bx = 0; bx < 6; bx++) for (let bz = 0; bz < 6; bz++) {
    const cx = -100 + bx * 40, cz = -100 + bz * 40;
    g.fillStyle = "#" + DISTRICTS[Math.abs((bx * 7 + bz * 3) % 6)].col.toString(16).padStart(6, "0");
    g.globalAlpha = 0.55;
    g.fillRect(px(cx - 14), pz(cz - 14), 28 * scale, 28 * scale);
  }
  g.globalAlpha = 1;
  g.strokeStyle = "#0e1420"; g.lineWidth = 12 * scale;
  for (const r of ROADS) {
    g.beginPath(); g.moveTo(px(-140), pz(r)); g.lineTo(px(140), pz(r)); g.stroke();
    g.beginPath(); g.moveTo(px(r), pz(-140)); g.lineTo(px(r), pz(140)); g.stroke();
  }
  // Route to the mission target.
  const m = MISSIONS[Math.min(s.mission, 11)];
  g.strokeStyle = "#ffd84f"; g.lineWidth = 2; g.setLineDash([4, 3]);
  g.beginPath(); g.moveTo(px(s.px), pz(s.pz)); g.lineTo(px(m.tx), pz(m.tz)); g.stroke();
  g.setLineDash([]);
  // Blips.
  const dot = (x, z, col, r) => { g.fillStyle = col; g.beginPath(); g.arc(px(x), pz(z), r, 0, Math.PI * 2); g.fill(); };
  for (const tr of s.traffic) dot(tr.x || 0, tr.z || 0, "#8a8a96", 1.6);
  for (const pc of s.police) dot(pc.x, pc.z, "#4a9aff", 2.4);
  if (s.heli.active) dot(s.heli.x, s.heli.z, "#ffffff", 2.6);
  dot(m.tx, m.tz, "#ffd84f", 3.4);
  // Player arrow.
  g.save();
  g.translate(px(s.px), pz(s.pz)); g.rotate(Math.atan2(Math.sin(s.heading), -Math.cos(s.heading)) + Math.PI);
  g.fillStyle = "#ffd84f";
  g.beginPath(); g.moveTo(0, -6); g.lineTo(4.4, 5); g.lineTo(-4.4, 5); g.closePath(); g.fill();
  g.restore();
  g.restore();
  g.strokeStyle = "#ffd84f"; g.lineWidth = 2;
  g.beginPath(); g.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#fff"; g.font = "bold 11px Verdana"; g.textAlign = "center";
  g.fillText("N", W / 2, 14);
}
export function drawMapScreen(s, pois) {
  const cv = $("map-canvas"), g = cv.getContext("2d"), W = cv.width, H = cv.height;
  g.fillStyle = "#0d1322"; g.fillRect(0, 0, W, H);
  const scale = W / 300, px = (x) => (x + 150) * scale, pz = (z) => (z + 150) * scale;
  for (let bx = 0; bx < 6; bx++) for (let bz = 0; bz < 6; bz++) {
    const cx = -100 + bx * 40, cz = -100 + bz * 40;
    const di = [0, 0, 4, 4, 5, 5][bx] + [0, 0, 0, 0, 0, 0][bz];
    const dcol = ["#2a4a68", "#3a4a78", "#2a6a5e", "#8a5a30", "#5a4a78", "#8a7430"][(bx + bz * 2) % 6];
    g.fillStyle = dcol; g.globalAlpha = 0.8;
    g.fillRect(px(cx - 14), pz(cz - 14), 28 * scale, 28 * scale);
  }
  g.globalAlpha = 1;
  g.strokeStyle = "#060a12"; g.lineWidth = 12 * scale;
  for (const r of ROADS) {
    g.beginPath(); g.moveTo(px(-140), pz(r)); g.lineTo(px(140), pz(r)); g.stroke();
    g.beginPath(); g.moveTo(px(r), pz(-140)); g.lineTo(px(r), pz(140)); g.stroke();
  }
  // Sea + beach labels.
  g.fillStyle = "#1a4a6a"; g.fillRect(0, 0, px(-132), H);
  g.fillStyle = "#c8a878"; g.fillRect(px(-150), 0, px(-132) - px(-150), H);
  g.save(); g.translate(16, H / 2); g.rotate(-Math.PI / 2);
  g.fillStyle = "#7fb0d8"; g.font = "bold 15px Verdana"; g.textAlign = "center";
  g.fillText("L A U T   J A W A", 0, 0); g.restore();
  // Dashed search zones.
  g.strokeStyle = "#ffd84f"; g.lineWidth = 1.6; g.setLineDash([6, 5]);
  for (const [cx, cz, r] of [[-100, -80, 34], [-20, -40, 30], [60, 40, 32], [-60, 80, 30]]) {
    g.beginPath(); g.arc(px(cx), pz(cz), r * scale, 0, Math.PI * 2); g.stroke();
  }
  g.setLineDash([]);
  // Route.
  const m = MISSIONS[Math.min(s.mission, 11)];
  g.strokeStyle = "#ffd84f"; g.lineWidth = 2.5; g.setLineDash([8, 6]);
  g.beginPath(); g.moveTo(px(s.px), pz(s.pz)); g.lineTo(px(m.tx), pz(m.tz)); g.stroke();
  g.setLineDash([]);
  // POI logos; labels stagger above/below so neighbours never collide.
  g.textAlign = "center";
  pois.forEach((p, i) => {
    g.fillStyle = "#0d1322";
    g.beginPath(); g.arc(px(p.x), pz(p.z), 11, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#ffd84f"; g.lineWidth = 2;
    g.beginPath(); g.arc(px(p.x), pz(p.z), 11, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "#ffd84f"; g.font = "bold 12px Verdana";
    g.fillText(p.logo, px(p.x), pz(p.z) + 4);
    g.fillStyle = "#fff"; g.font = "bold 10px Verdana";
    g.fillText(p.label, px(p.x), pz(p.z) + (i % 2 === 0 ? 24 : -16));
  });
  // Player marker + north.
  g.fillStyle = "#ffd84f";
  g.beginPath(); g.moveTo(px(s.px), pz(s.pz) - 8); g.lineTo(px(s.px) + 6, pz(s.pz) + 6); g.lineTo(px(s.px) - 6, pz(s.pz) + 6); g.closePath(); g.fill();
  g.fillStyle = "#fff"; g.font = "bold 12px Verdana"; g.textAlign = "right";
  g.fillText("N ↑", 548, 20);
  // Right column: stats + mission list.
  const pct = Math.round((s.missionDone / 12) * 100);
  $("map-pct").textContent = pct + "%";
  $("map-ring").style.background = "conic-gradient(#ffd84f " + pct + "%, #2a2a3a " + pct + "%)";
  $("map-stats").innerHTML =
    "<div>REP <b>" + s.repTitle + " · " + s.rep + "</b></div><div>CASH <b>$" + s.cash.toLocaleString("en-US") + "</b></div>" +
    "<div>TIME <b>" + String(Math.floor(s.clock)).padStart(2, "0") + ":" + String(Math.floor((s.clock % 1) * 60)).padStart(2, "0") + " · DAY " + s.day + "</b></div>" +
    "<div>WANTED <b>" + "★".repeat(s.wanted) + "☆".repeat(5 - s.wanted) + "</b></div>" +
    "<div>TAKEDOWNS <b>" + s.stats.takedowns + "</b></div><div>CARS STOLEN <b>" + s.stats.carsStolen + "</b></div>" +
    "<div>STUNTS <b>$" + s.stats.stunts.toLocaleString("en-US") + "</b></div>";
  $("map-missions").innerHTML = MISSIONS.map((mm, i) =>
    "<div class='map-mission'><span>" + (i + 1) + ". " + mm.name + "</span><b class='" + (i < s.missionDone ? "done" : i === s.mission ? "active" : "") + "'>" + (i < s.missionDone ? "DONE" : i === s.mission ? "ACTIVE" : "—") + "</b></div>").join("");
}
