// Wilwatikta city generation: seeded procedural buildings with real facade
// depth (window grids, balconies, cornices, setbacks, awnings, rooftop
// clutter), layered palms with ringed segmented trunks, street trees with
// branched layered canopies, roads, beach, sea, and a skyline ring.
import { MB, C } from "./gl.js";
import { makeRng } from "./rng.js";

export const ROADS = [-120, -80, -40, 0, 40, 80, 120];
export const ROAD_W = 12, BLOCK = 28, PITCH = 40;

export const DISTRICTS = [
  { name: "Pelabuhan Segara", short: "PELABUHAN", col: 0x3f6d8e, fac: [0x8fa8b8, 0x6f8fa3, 0xa8bcc8, 0x7d99a8], h: [7, 14] },
  { name: "Alun-Alun", short: "ALUN-ALUN", col: 0x6f7fb8, fac: [0xf2e8d8, 0xe8dcc8, 0xf8f0e0, 0xdccfb8], h: [14, 34] },
  { name: "Pantai Kidul", short: "PANTAI KIDUL", col: 0x3f9e8e, fac: [0xf8c8b8, 0xf0b8a8, 0xf8d8c8, 0xe8a898], h: [6, 12] },
  { name: "Pasar Senja", short: "PASAR SENJA", col: 0xd87f3f, fac: [0xe8a878, 0xd89868, 0xf0b888, 0xc88858], h: [6, 13] },
  { name: "Kampung Batik", short: "KAMPUNG BATIK", col: 0x9a6fb8, fac: [0xc8a8d8, 0xb898cc, 0xd8b8e8, 0xa888c0], h: [8, 18] },
  { name: "Lorong Emas", short: "LORONG EMAS", col: 0xd8b83f, fac: [0xf0d888, 0xe8cc78, 0xf8e098, 0xd8bc68], h: [10, 26] },
];
function districtAt(bx, bz) {
  if (bx <= 0) return bz <= 2 ? DISTRICTS[0] : DISTRICTS[2];
  if (bx === 1) return bz <= 1 ? DISTRICTS[0] : bz >= 4 ? DISTRICTS[2] : DISTRICTS[4];
  if (bx <= 3) return bz <= 1 ? DISTRICTS[4] : bz >= 4 ? DISTRICTS[3] : DISTRICTS[1];
  if (bx === 4) return bz <= 2 ? DISTRICTS[5] : bz >= 4 ? DISTRICTS[3] : DISTRICTS[1];
  return bz <= 1 ? DISTRICTS[5] : bz >= 4 ? DISTRICTS[3] : DISTRICTS[5];
}
export function districtNameAt(x, z) {
  const bx = Math.max(0, Math.min(5, Math.floor((x + 120) / PITCH)));
  const bz = Math.max(0, Math.min(5, Math.floor((z + 120) / PITCH)));
  return districtAt(bx, bz).name;
}

// A box beam between two points (branches, struts, crane arms).
function beam(mb, a, b, w, col, glow) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz) || 1, ux = dx / len, uy = dy / len, uz = dz / len;
  let px = -uz, py = 0, pz = ux;
  const pl = Math.hypot(px, py, pz) || 1; px /= pl; py /= pl; pz /= pl;
  const qx = uy * pz - uz * py, qy = uz * px - ux * pz, qz = ux * py - uy * px;
  const h = w / 2, c = [];
  for (const [s, t] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    c.push([a[0] + (px * s + qx * t) * h, a[1] + (py * s + qy * t) * h, a[2] + (pz * s + qz * t) * h]);
    c.push([b[0] + (px * s + qx * t) * h, b[1] + (py * s + qy * t) * h, b[2] + (pz * s + qz * t) * h]);
  }
  const n = [ux, uy, uz];
  for (let k = 0; k < 4; k++) {
    const m = (k + 1) % 4;
    mb.face([c[k * 2], c[m * 2], c[m * 2 + 1], c[k * 2 + 1]], [px, py, pz], col, glow);
  }
  mb.face([c[0], c[2], c[4], c[6]], [-n[0], -n[1], -n[2]], col, glow);
  mb.face([c[1], c[3], c[5], c[7]], n, col, glow);
}

function windowQuad(mb, x, y, z, nx, nz, w, h, lit) {
  const col = lit ? C(0xffd890) : C(0x2a3a55), glow = lit ? 0.9 : 0.08;
  const tx = nz, tz = -nx; // tangent along the face
  const hw = w / 2, hh = h / 2;
  mb.face([
    [x - tx * hw, y - hh, z - tz * hw], [x + tx * hw, y - hh, z + tz * hw],
    [x + tx * hw, y + hh, z + tz * hw], [x - tx * hw, y + hh, z - tz * hw],
  ], [nx, 0, nz], col, glow);
}
// Window grids on all four faces of a footprint; ground floor left bare for storefronts.
function facadeWindows(mb, cx, cz, w, d, y0, y1, rng, litRatio) {
  const floors = Math.max(1, Math.floor((y1 - y0) / 3.1));
  const colsX = Math.max(2, Math.floor(w / 3.0)), colsZ = Math.max(2, Math.floor(d / 3.0));
  for (let f = 0; f < floors; f++) {
    const y = y0 + 1.9 + f * 3.1;
    if (y + 0.9 > y1 - 0.5) break;
    for (let k = 0; k < colsX; k++) {
      const x = cx - w / 2 + (k + 0.5) * (w / colsX);
      windowQuad(mb, x, y, cz + d / 2 + 0.07, 0, 1, 1.35, 1.7, rng.chance(litRatio));
      windowQuad(mb, x, y, cz - d / 2 - 0.07, 0, -1, 1.35, 1.7, rng.chance(litRatio));
    }
    for (let k = 0; k < colsZ; k++) {
      const z = cz - d / 2 + (k + 0.5) * (d / colsZ);
      windowQuad(mb, cx + w / 2 + 0.07, y, z, 1, 0, 1.35, 1.7, rng.chance(litRatio));
      windowQuad(mb, cx - w / 2 - 0.07, y, z, -1, 0, 1.35, 1.7, rng.chance(litRatio));
    }
  }
}
function balcony(mb, x, y, z, nx, nz, w, col) {
  const tx = nz, tz = -nx, ox = nx * 0.7, oz = nz * 0.7;
  mb.box(x + ox, y, z + oz, Math.abs(tx) * w + 0.3, 0.22, Math.abs(tz) * w + 0.3, col, 0);
  const rx = x + nx * 1.3, rz = z + nz * 1.3;
  mb.box(rx, y + 0.55, rz, Math.abs(tx) * w + 0.12, 0.1, Math.abs(tz) * w + 0.12, C(0x3a3a48), 0);
  mb.box(rx - tx * w / 2, y + 0.3, rz - tz * w / 2, 0.1, 0.6, 0.1, C(0x3a3a48), 0);
  mb.box(rx + tx * w / 2, y + 0.3, rz + tz * w / 2, 0.1, 0.6, 0.1, C(0x3a3a48), 0);
}
function rooftop(mb, cx, y, cz, w, d, rng) {
  const n = rng.int(1, 3);
  for (let k = 0; k < n; k++) {
    const x = cx + rng.range(-w / 4, w / 4), z = cz + rng.range(-d / 4, d / 4), kind = rng.int(0, 2);
    if (kind === 0) { // water tank on legs with a cone roof
      mb.box(x - 0.6, y + 0.5, z - 0.6, 0.18, 1, 0.18, C(0x555560), 0);
      mb.box(x + 0.6, y + 0.5, z - 0.6, 0.18, 1, 0.18, C(0x555560), 0);
      mb.box(x - 0.6, y + 0.5, z + 0.6, 0.18, 1, 0.18, C(0x555560), 0);
      mb.box(x + 0.6, y + 0.5, z + 0.6, 0.18, 1, 0.18, C(0x555560), 0);
      mb.prism(x, y + 1, z, 1.0, y + 2.6, 8, C(0x9aa4ac), 0);
      mb.cone(x, y + 2.6, z, 1.15, y + 3.4, 8, C(0x7d8890), 0);
    } else if (kind === 1) { // AC units
      mb.box(x, y + 0.4, z, 1.6, 0.8, 1.1, C(0xb8bcc0), 0);
      mb.box(x + 1.2, y + 0.3, z + 0.4, 1.0, 0.6, 0.8, C(0x9aa0a4), 0);
    } else { // antenna mast with crossbars
      mb.box(x, y + 2.2, z, 0.16, 4.4, 0.16, C(0x404048), 0);
      mb.box(x, y + 3.4, z, 1.2, 0.1, 0.1, C(0x404048), 0);
      mb.box(x, y + 4.1, z, 0.8, 0.1, 0.1, C(0x404048), 0);
      mb.box(x, y + 4.45, z, 0.22, 0.22, 0.22, C(0xff5040), 0.9);
    }
  }
}
function storefront(mb, cx, cz, w, d, rng, district) {
  // Ground-floor shop band on the south face + a slanted awning + a neon sign.
  const band = C(0x4a3a50);
  mb.box(cx, 1.5, cz + d / 2 + 0.05, w * 0.9, 3.0, 0.15, band, 0);
  const nWin = Math.max(2, Math.floor(w / 4));
  for (let k = 0; k < nWin; k++) {
    const x = cx - w * 0.4 + k * (w * 0.8 / Math.max(1, nWin - 1));
    windowQuad(mb, x, 1.5, cz + d / 2 + 0.16, 0, 1, 2.0, 2.0, rng.chance(0.75));
  }
  // Slanted awning: striped by alternating quad segments.
  const ax0 = cx - w * 0.42, ax1 = cx + w * 0.42, z0 = cz + d / 2 + 0.1, z1 = cz + d / 2 + 1.7;
  const stripes = 5, awnA = rng.pick([C(0xe8503f), C(0x3f90d8), C(0xe8a83f), C(0x3fb88a)]);
  for (let k = 0; k < stripes; k++) {
    const xa = ax0 + (k / stripes) * (ax1 - ax0), xb = ax0 + ((k + 1) / stripes) * (ax1 - ax0);
    mb.face([[xa, 3.4, z0], [xb, 3.4, z0], [xb, 2.8, z1], [xa, 2.8, z1]], [0, 0.9, 0.4], k % 2 ? C(0xf2ead8) : awnA, 0);
  }
  // Neon sign box above the shop.
  const signCol = rng.pick([C(0xff5fa8), C(0x4fd8ff), C(0xffd84f), C(0x7dff6a)]);
  mb.box(cx, 4.4, cz + d / 2 + 0.35, Math.min(5, w * 0.5), 0.8, 0.3, signCol, 0.95);
  if (district.name === "Pasar Senja") {
    // Market stall in front: posts + flat striped canopy.
    const sx = cx + w / 2 + 3.2, sz = cz + d / 2 + 2.4;
    for (const [px, pz] of [[-1.2, -1], [1.2, -1], [-1.2, 1], [1.2, 1]]) mb.box(sx + px, 1.1, sz + pz, 0.14, 2.2, 0.14, C(0x6a4a30), 0);
    mb.box(sx, 2.35, sz, 3.2, 0.14, 2.6, rng.pick([C(0xe8503f), C(0xe8a83f)]), 0);
    mb.box(sx, 0.55, sz, 2.6, 1.1, 1.8, C(0x8a6a48), 0);
    mb.box(sx - 0.6, 1.25, sz, 0.7, 0.35, 0.7, C(0xe8c83f), 0.2);
    mb.box(sx + 0.6, 1.25, sz, 0.7, 0.35, 0.7, C(0x7dc83f), 0.2);
  }
}
function building(mb, trans, cx, cz, w, d, h, rng, district) {
  const facade = C(rng.pick(district.fac));
  const roof = C(0x6a5a58);
  mb.box(cx, h / 2, cz, w, h, d, facade, 0, roof);
  // Cornice slab + parapet rim.
  mb.box(cx, h + 0.25, cz, w + 0.7, 0.5, d + 0.7, C(0xe8e0d0), 0);
  mb.box(cx, h + 0.7, cz + d / 2 + 0.2, w + 0.5, 0.5, 0.25, facade, 0);
  mb.box(cx, h + 0.7, cz - d / 2 - 0.2, w + 0.5, 0.5, 0.25, facade, 0);
  mb.box(cx + w / 2 + 0.2, h + 0.7, cz, 0.25, 0.5, d + 0.5, facade, 0);
  mb.box(cx - w / 2 - 0.2, h + 0.7, cz, 0.25, 0.5, d + 0.5, facade, 0);
  facadeWindows(mb, cx, cz, w, d, 3.2, h - 0.6, rng, district.name === "Lorong Emas" ? 0.55 : 0.4);
  // Setback upper tower on tall buildings.
  if (h >= 17 && rng.chance(0.7)) {
    const w2 = w * rng.range(0.55, 0.7), d2 = d * rng.range(0.55, 0.7), h2 = rng.range(4, 8);
    mb.box(cx, h + h2 / 2, cz, w2, h2, d2, C(rng.pick(district.fac)), 0, roof);
    mb.box(cx, h + h2 + 0.2, cz, w2 + 0.5, 0.4, d2 + 0.5, C(0xe8e0d0), 0);
    facadeWindows(mb, cx, cz, w2, d2, h + 0.4, h + h2 - 0.4, rng, 0.45);
    rooftop(mb, cx, h + h2 + 0.4, cz, w2, d2, rng);
  } else {
    rooftop(mb, cx, h + 0.5, cz, w, d, rng);
  }
  // Balconies on some mid/high buildings, on two faces.
  if (h >= 10 && rng.chance(0.6)) {
    const rows = Math.floor((h - 5) / 6);
    for (let r = 0; r < rows; r++) {
      const y = 6.5 + r * 6;
      balcony(mb, cx - w / 4, y, cz + d / 2, 0, 1, 2.4, facade);
      balcony(mb, cx + w / 4, y, cz + d / 2, 0, 1, 2.4, facade);
      if (rng.chance(0.5)) balcony(mb, cx + w / 2, y, cz, 1, 0, 2.4, facade);
    }
  }
  storefront(mb, cx, cz, w, d, rng, district);
  // Long fake shadow stretching east, away from the western sun.
  const shLen = h * 1.1;
  trans.face([[cx - w / 2, 0.06, cz - d / 2], [cx + w / 2 + shLen, 0.06, cz - d / 2 + 2],
    [cx + w / 2 + shLen, 0.06, cz + d / 2 - 2], [cx - w / 2, 0.06, cz + d / 2]], [0, 1, 0], C(0x1a1030), 0);
}
// Palm: segmented ringed trunk with lean, three drooping frond layers, coconuts.
function palm(mb, trans, x, z, rng, scale) {
  const h = rng.range(7, 11) * scale, lean = rng.range(0.4, 1.2) * rng.sign();
  const leanZ = rng.range(-0.5, 0.5), segs = 7;
  const barkA = C(0x7a5232), barkB = C(0x8d6240), ring = C(0x5e3d24);
  let px = x, pz = z;
  for (let s = 0; s < segs; s++) {
    const y0 = (s / segs) * h, y1 = ((s + 1) / segs) * h;
    const nx = x + lean * (s / segs), nz = z + leanZ * (s / segs);
    const r = 0.34 * scale * (1 - (s / segs) * 0.35);
    mb.prism((px + nx) / 2, y0, (pz + nz) / 2, r * 1.05, y1, 6, s % 2 ? barkA : barkB, 0, r * 0.95);
    mb.prism((px + nx) / 2, y1 - 0.12, (pz + nz) / 2, r * 1.14, y1, 6, ring, 0, r * 1.14);
    px = nx; pz = nz;
  }
  const topX = px, topZ = pz, topY = h;
  const frondCols = [C(0x2e8a3f), C(0x3aa84f), C(0x277a38)];
  const layers = [[6, -0.15, 3.4], [8, -0.55, 4.2], [6, -1.0, 3.6]];
  layers.forEach(([count, droop, len], li) => {
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 + li * 0.5 + rng.range(-0.1, 0.1);
      const dx = Math.cos(a), dz = Math.sin(a), col = frondCols[(k + li) % 3];
      let bx = topX, by = topY, bz = topZ, w = 0.55 * scale;
      const parts = 3;
      for (let p = 0; p < parts; p++) {
        const t = (p + 1) / parts, segLen = (len * scale) / parts;
        const ex = bx + dx * segLen, ez = bz + dz * segLen;
        const ey = by + (droop - t * 0.9) * segLen * 0.8;
        const w2 = w * (1 - t * 0.75);
        const px2 = -dz, pz2 = dx;
        mb.face([
          [bx - px2 * w / 2, by, bz - pz2 * w / 2], [bx + px2 * w / 2, by, bz + pz2 * w / 2],
          [ex + px2 * w2 / 2, ey, ez + pz2 * w2 / 2], [ex - px2 * w2 / 2, ey, ez - pz2 * w2 / 2],
        ], [0, 1, 0], col, 0);
        bx = ex; by = ey; bz = ez; w = w2;
      }
    }
  });
  mb.ball(topX, topY + 0.2, topZ, 0.5 * scale, 6, C(0x4a7a2e), 0);
  if (rng.chance(0.6)) {
    for (let k = 0; k < 3; k++) {
      const a = rng.range(0, Math.PI * 2);
      mb.ball(topX + Math.cos(a) * 0.5 * scale, topY - 0.35, topZ + Math.sin(a) * 0.5 * scale, 0.24 * scale, 5, C(0x6a4a28), 0);
    }
  }
  trans.disc(x + lean * 0.5, 0.05, z + leanZ * 0.5, 3.2 * scale, 10, C(0x1a1030), 0);
}
// Street tree: visible branch structure + rounded layered canopies + canopy shadow.
function streetTree(mb, trans, x, z, rng, scale) {
  const h = rng.range(3.5, 5) * scale, bark = C(0x6a4a30);
  mb.prism(x, 0, z, 0.3 * scale, h * 0.7, 6, bark, 0, 0.2 * scale);
  const greens = [C(0x3f9a4a), C(0x55b05a), C(0x2f8a42)];
  const nBr = 3;
  for (let k = 0; k < nBr; k++) {
    const a = (k / nBr) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const tx = x + Math.cos(a) * 1.4 * scale, tz = z + Math.sin(a) * 1.4 * scale;
    beam(mb, [x, h * 0.6, z], [tx, h + 0.4 * scale, tz], 0.16 * scale, bark, 0);
    mb.ball(tx, h + 0.9 * scale, tz, rng.range(1.2, 1.7) * scale, 7, greens[k % 3], 0, 0.62);
  }
  mb.ball(x, h + 1.5 * scale, z, rng.range(1.5, 1.9) * scale, 8, greens[rng.int(0, 2)], 0, 0.66);
  mb.ball(x, h + 0.7 * scale, z, 1.1 * scale, 7, C(0x2a7a3a), 0, 0.6);
  trans.disc(x, 0.05, z, 2.6 * scale, 10, C(0x1a1030), 0);
}
function lampPost(mb, x, z) {
  mb.box(x, 2.2, z, 0.18, 4.4, 0.18, C(0x2a2a34), 0);
  mb.box(x, 4.5, z, 0.5, 0.22, 0.5, C(0x3a3a44), 0);
  mb.box(x, 4.32, z, 0.34, 0.18, 0.34, C(0xffe8a8), 0.9);
}
function shrub(mb, x, z, rng) {
  mb.ball(x, 0.4, z, rng.range(0.5, 0.8), 6, C(rng.pick([0x3f9a4a, 0x55b05a, 0x2f8a42])), 0, 0.7);
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const mb = new MB(), trans = new MB();
  const colliders = [];
  const pois = [];
  // Ground: grass base, sand strip, sea plane with sun streaks.
  mb.face([[-320, -0.1, -320], [320, -0.1, -320], [320, -0.1, 320], [-320, -0.1, 320]], [0, 1, 0], C(0x7a8a5a), 0);
  mb.face([[-320, 0, -320], [-132, 0, -320], [-132, 0, 320], [-320, 0, 320]], [0, 1, 0], C(0xe8c898), 0);
  mb.face([[-320, -0.2, -320], [-150, -0.2, -320], [-150, -0.2, 320], [-320, -0.2, 320]], [0, 1, 0], C(0x4f7fa8), 0.25);
  for (let k = 0; k < 8; k++) {
    const z = rng.range(-160, 160), w = rng.range(14, 30);
    mb.face([[-320, -0.15, z - 1.2], [-150, -0.15, z - 1.2], [-150, -0.15, z + 1.2], [-320, -0.15, z + 1.2]], [0, 1, 0], C(0xffd890), 0.55);
  }
  // Roads: asphalt strips + dashed center lines + puddles.
  for (const r of ROADS) {
    mb.face([[-140, 0.02, r - ROAD_W / 2], [140, 0.02, r - ROAD_W / 2], [140, 0.02, r + ROAD_W / 2], [-140, 0.02, r + ROAD_W / 2]], [0, 1, 0], C(0x3a3a44), 0);
    mb.face([[r - ROAD_W / 2, 0.02, -140], [r + ROAD_W / 2, 0.02, -140], [r + ROAD_W / 2, 0.02, 140], [r - ROAD_W / 2, 0.02, 140]], [0, 1, 0], C(0x3a3a44), 0);
    for (let d = -132; d < 132; d += 8) {
      // No center dashes through intersections (real roads leave them
      // bare, and close-up dashes read as giant planks).
      if (ROADS.some((r2) => Math.abs(d + 1.3 - r2) < 7)) continue;
      mb.face([[d, 0.05, r - 0.18], [d + 2.6, 0.05, r - 0.18], [d + 2.6, 0.05, r + 0.18], [d, 0.05, r + 0.18]], [0, 1, 0], C(0xd8c860), 0.15);
      mb.face([[r - 0.18, 0.05, d], [r + 0.18, 0.05, d], [r + 0.18, 0.05, d + 2.6], [r - 0.18, 0.05, d + 2.6]], [0, 1, 0], C(0xd8c860), 0.15);
    }
  }
  for (let k = 0; k < 26; k++) {
    const x = rng.pick(ROADS) + rng.range(-4, 4), z = rng.range(-130, 130);
    trans.face([[x - 0.9, 0.07, z - 0.6], [x + 0.9, 0.07, z - 0.6], [x + 0.9, 0.07, z + 0.6], [x - 0.9, 0.07, z + 0.6]], [0, 1, 0], C(0xffc890), 0.3);
  }
  // Blocks: sidewalks, buildings, trees, lamps.
  // Blocks sit BETWEEN the roads: centers at -100, -60, ..., 100, so the
  // 12-wide road strips stay clear of sidewalks and buildings.
  for (let bx = 0; bx < 6; bx++) for (let bz = 0; bz < 6; bz++) {
    const cx = -100 + bx * PITCH, cz = -100 + bz * PITCH;
    const district = districtAt(bx, bz);
    mb.box(cx, 0.18, cz, BLOCK + 4, 0.36, BLOCK + 4, C(0x9a948a), 0);
    const nB = (bx === 5 && bz === 3) ? 0 : rng.int(1, 2); // garage block stays open
    for (let b = 0; b < nB; b++) {
      const w = rng.range(11, nB === 1 ? 24 : 13), d = rng.range(11, nB === 1 ? 24 : 13);
      const ox = nB === 1 ? 0 : (b === 0 ? -6.5 : 6.5), oz = nB === 1 ? 0 : rng.range(-3, 3);
      const h = rng.range(district.h[0], district.h[1]);
      const px = cx + ox, pz = cz + oz;
      building(mb, trans, px, pz, w, d, h, rng, district);
      colliders.push([px - w / 2, pz - d / 2, px + w / 2, pz + d / 2]);
    }
    // Block-edge trees: palms near the beach, street trees elsewhere.
    const nT = rng.int(2, 4);
    for (let t = 0; t < nT; t++) {
      const side = rng.int(0, 3), tx = cx + (side === 0 ? -15 : side === 1 ? 15 : rng.range(-14, 14));
      const tz = cz + (side === 2 ? -15 : side === 3 ? 15 : rng.range(-14, 14));
      if (bx === 0) palm(mb, trans, tx, tz, rng, rng.range(0.9, 1.2));
      else if (rng.chance(0.4)) palm(mb, trans, tx, tz, rng, rng.range(0.8, 1.05));
      else streetTree(mb, trans, tx, tz, rng, rng.range(0.9, 1.2));
    }
    if (rng.chance(0.7)) shrub(mb, cx + rng.range(-12, 12), cz + rng.range(-12, 12), rng);
    lampPost(mb, cx - 15, cz - 15); lampPost(mb, cx + 15, cz + 15);
  }
  // Beach palms + umbrellas along the sand.
  for (let k = 0; k < 14; k++) {
    const z = -150 + k * 23 + rng.range(-6, 6);
    palm(mb, trans, rng.range(-146, -134), z, rng, rng.range(1.0, 1.35));
  }
  for (let k = 0; k < 5; k++) {
    const x = rng.range(-142, -134), z = rng.range(-120, 120);
    mb.box(x, 1.1, z, 0.14, 2.2, 0.14, C(0x8a6a48), 0);
    mb.cone(x, 2.2, z, 2.4, 3.1, 8, C(rng.pick([0xe8503f, 0x3f90d8, 0xe8a83f])), 0);
  }
  // Fixed palms framing the title shot: tall crowns whose fronds overlap
  // the top of the frame behind the title lettering.
  palm(mb, trans, -129, 12, rng, 1.3);
  palm(mb, trans, -129, 32, rng, 1.15);
  palm(mb, trans, -112, 4, rng, 1.05);
  // Docks: pier, boats, crane, round lighthouse tower.
  mb.box(-146, 0.4, -100, 16, 0.8, 30, C(0x8a7a68), 0);
  for (let k = 0; k < 3; k++) {
    const bx = -158 - k * 8, bz = -110 + k * 14;
    mb.box(bx, 0.5, bz, 7, 1.2, 3, C(0x7a5a40), 0);
    mb.box(bx - 1, 1.5, bz, 2.4, 1.4, 2.2, C(0xe8e0d0), 0);
    mb.box(bx + 2, 1.2, bz, 1.2, 0.8, 1.6, C(0x3f6d8e), 0);
  }
  beam(mb, [-138, 0, -96], [-138, 20, -96], 0.9, C(0xd87f3f), 0);
  beam(mb, [-150, 19, -96], [-128, 19, -96], 0.7, C(0xd87f3f), 0);
  beam(mb, [-150, 19, -96], [-150, 13, -96], 0.25, C(0x3a3a44), 0);
  mb.box(-150, 12.2, -96, 1.6, 1.6, 1.6, C(0x4a5a68), 0);
  // Lighthouse: tall ringed tower with gallery + lamp room.
  const lx = -128, lz = -128;
  mb.prism(lx, 0, lz, 3.2, 22, 12, C(0xf2e8d8), 0, 2.4);
  mb.prism(lx, 7, lz, 3.0, 7.8, 12, C(0xd86a4a), 0, 2.9);
  mb.prism(lx, 14, lz, 2.8, 14.8, 12, C(0xd86a4a), 0, 2.7);
  mb.prism(lx, 22, lz, 3.4, 23, 12, C(0x4a4a58), 0, 3.4);
  mb.prism(lx, 23, lz, 2.0, 25.5, 8, C(0xffe8a8), 0.95, 2.0);
  mb.cone(lx, 25.5, lz, 2.5, 27, 8, C(0x8a3030), 0);
  colliders.push([lx - 3.4, lz - 3.4, lx + 3.4, lz + 3.4]);
  // Garage: distinct large structure with open front + sign, in Lorong Emas.
  const gx = 100, gz = 20;
  mb.box(gx, 3, gz, 20, 6, 14, C(0x7a8a98), 0, C(0x5a6a78));
  mb.box(gx, 3, gz + 7.1, 12, 4.4, 0.3, C(0x1c222c), 0);
  mb.box(gx, 5.6, gz + 7.2, 13, 0.5, 0.4, C(0xe8a83f), 0.3);
  mb.box(gx, 7.2, gz + 7.2, 10, 1.4, 0.5, C(0x3fb88a), 0.85);
  mb.box(gx - 8, 1.2, gz + 8.5, 1.4, 2.4, 1.4, C(0xd84a3a), 0);
  colliders.push([gx - 10, gz - 7, gx - 6, gz + 7], [gx + 6, gz - 7, gx + 10, gz + 7]);
  // Skyline ring: low hazy silhouettes on the horizon, fog-blended.
  for (let k = 0; k < 36; k++) {
    const a = (k / 36) * Math.PI * 2, r = rng.range(195, 245);
    const x = Math.cos(a) * r, z = Math.sin(a) * r, w = rng.range(12, 22), h = rng.range(14, 34);
    mb.box(x, h / 2 - 2, z, w, h, w, C(rng.pick([0xc8a898, 0xd0a890, 0xc0a8a8, 0xd8b098])), 0);
  }
  // Points of interest for the map overlay.
  pois.push(
    { x: -120, z: -100, label: "DOCKS", logo: "D" }, { x: -100, z: -100, label: "WAREHOUSE", logo: "W" },
    { x: -20, z: -60, label: "HOTEL", logo: "H" }, { x: 100, z: -60, label: "CASINO", logo: "C" },
    { x: 60, z: -20, label: "MANSION", logo: "M" }, { x: 100, z: 20, label: "GARAGE", logo: "G" },
    { x: 100, z: 60, label: "SHOWROOM", logo: "S" }, { x: -60, z: 60, label: "MARKET", logo: "M" },
    { x: -100, z: 100, label: "SAFEHOUSE", logo: "S" }, { x: -20, z: -20, label: "ALUN-ALUN", logo: "A" },
  );
  return { opaque: mb, trans, colliders, pois, garage: { x: gx, z: gz } };
}
