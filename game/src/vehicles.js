// Vehicles for Wilwatikta: the lofted wedge hero car (glass canopy, gloss
// streak, 5-spoke wheels, light bar, spoiler), white WPD sedans, traffic,
// the police helicopter with searchlight, and roadblocks. All meshes are
// procedural; cars face +Z in local space.
import { MB, C, matModel, matModelS } from "./gl.js";
import { clamp, lerp } from "./rng.js";

// Cylinder with its axis along X (for wheels).
function cylX(mb, cx, cy, cz, r, w, sides, col, glow) {
  const left = [], right = [];
  for (let k = 0; k < sides; k++) {
    const a = (k / sides) * Math.PI * 2, y = cy + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    left.push(mb.v(cx - w / 2, y, z, 0, Math.cos(a), Math.sin(a), col, glow));
    right.push(mb.v(cx + w / 2, y, z, 0, Math.cos(a), Math.sin(a), col, glow));
  }
  for (let k = 0; k < sides; k++) {
    const n = (k + 1) % sides;
    mb.quad(left[k], left[n], right[n], right[k]);
  }
  const lc = mb.v(cx - w / 2, cy, cz, -1, 0, 0, col, glow), rc = mb.v(cx + w / 2, cy, cz, 1, 0, 0, col, glow);
  for (let k = 0; k < sides; k++) {
    const n = (k + 1) % sides;
    mb.tri(lc, left[n], left[k]); mb.tri(rc, right[k], right[n]);
  }
}
function wheel(mb, cx, cy, cz, bright) {
  cylX(mb, cx, cy, cz, 0.38, 0.3, 10, C(0x18181c), 0);
  // Bright rim face + 5 spokes on the outer side.
  const side = cx > 0 ? 1 : -1, fx = cx + side * 0.16;
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2, a2 = a + 0.22;
    const x0 = fx, y0 = cy + Math.cos(a) * 0.1, z0 = cz + Math.sin(a) * 0.1;
    const x1 = fx, y1 = cy + Math.cos(a) * 0.3, z1 = cz + Math.sin(a) * 0.3;
    const x2 = fx, y2 = cy + Math.cos(a2) * 0.3, z2 = cz + Math.sin(a2) * 0.3;
    const x3 = fx, y3 = cy + Math.cos(a2) * 0.1, z3 = cz + Math.sin(a2) * 0.1;
    mb.face([[x0, y0, z0], [x1, y1, z1], [x2, y2, z2], [x3, y3, z3]], [side, 0, 0], bright ? C(0xe8e8f0) : C(0x9aa0a8), 0.15);
  }
  mb.box(fx, cy, cz, 0.06, 0.14, 0.14, C(0xd8d8e0), 0.2);
}
function section(z, hw, yb, yt, hwTop) {
  return { z, pts: [[-hw, yb], [hw, yb], [hwTop, yt], [-hwTop, yt]] };
}
export function buildHeroCar(paintHex) {
  const mb = new MB(), paint = C(paintHex);
  const stations = [
    section(-2.3, 0.85, 0.28, 0.62, 0.78), section(-1.9, 0.95, 0.24, 0.68, 0.85),
    section(-1.2, 1.0, 0.22, 0.72, 0.88), section(-0.6, 1.0, 0.22, 0.76, 0.8),
    section(0, 0.98, 0.22, 0.78, 0.7), section(0.5, 0.95, 0.22, 0.8, 0.62),
    section(1.0, 0.92, 0.22, 0.72, 0.6), section(1.6, 0.88, 0.24, 0.6, 0.55),
    section(2.1, 0.8, 0.28, 0.5, 0.5), section(2.35, 0.62, 0.32, 0.45, 0.45),
  ];
  // Gradient gloss paint: deep shadow tone low on the body flowing into a
  // bright sunlit highlight over the curves, like glossy showroom paint.
  const gradPaint = (st, p) => {
    const f = clamp((p[1] - 0.2) / 0.6, 0, 1);
    return [
      lerp(paint[0] * 0.55, Math.min(1, paint[0] * 1.2 + 0.22), f),
      lerp(paint[1] * 0.55, Math.min(1, paint[1] * 1.2 + 0.14), f),
      lerp(paint[2] * 0.55, Math.min(1, paint[2] * 1.2 + 0.1), f),
    ];
  };
  mb.loft(stations, paint, 0.12, gradPaint);
  // Glass canopy: dark glossy loft hugging the cabin stations.
  const glass = C(0x1a2438);
  mb.loft([
    section(-0.75, 0.72, 0.74, 1.06, 0.6), section(-0.1, 0.66, 0.76, 1.1, 0.52),
    section(0.6, 0.6, 0.78, 1.02, 0.46), section(1.0, 0.5, 0.72, 0.8, 0.4),
  ], glass, 0.4);
  // Gloss streak on the canopy + side gloss strip.
  mb.face([[-0.68, 0.95, -0.5], [-0.66, 1.02, 0.1], [-0.6, 0.98, 0.5], [-0.62, 0.9, -0.1]], [-1, 0.3, 0], C(0xd8ecff), 0.85);
  mb.face([[-1.0, 0.5, -1.0], [-1.0, 0.5, 0.9], [-0.97, 0.62, 0.9], [-0.97, 0.62, -1.0]], [-1, 0, 0], C(0xffffff), 0.5);
  mb.face([[1.0, 0.5, -1.0], [1.0, 0.5, 0.9], [0.97, 0.62, 0.9], [0.97, 0.62, -1.0]], [1, 0, 0], C(0xffffff), 0.5);
  // Headlights, rear light bar, spoiler, fender lips.
  mb.box(-0.55, 0.48, 2.36, 0.42, 0.14, 0.06, C(0xfff2c8), 0.95);
  mb.box(0.55, 0.48, 2.36, 0.42, 0.14, 0.06, C(0xfff2c8), 0.95);
  mb.box(0, 0.6, -2.32, 1.5, 0.12, 0.06, C(0xff2a3a), 0.95);
  mb.box(-0.7, 0.72, -2.28, 0.1, 0.5, 0.1, C(0x222226), 0);
  mb.box(0.7, 0.72, -2.28, 0.1, 0.5, 0.1, C(0x222226), 0);
  mb.box(0, 1.0, -2.3, 1.8, 0.09, 0.5, paint, 0.15);
  mb.box(-0.95, 0.34, 1.45, 0.14, 0.2, 0.9, C(0x222226), 0);
  mb.box(0.95, 0.34, 1.45, 0.14, 0.2, 0.9, C(0x222226), 0);
  mb.box(-0.95, 0.34, -1.45, 0.14, 0.2, 0.9, C(0x222226), 0);
  mb.box(0.95, 0.34, -1.45, 0.14, 0.2, 0.9, C(0x222226), 0);
  for (const [wx, wz] of [[-0.88, 1.45], [0.88, 1.45], [-0.88, -1.45], [0.88, -1.45]]) wheel(mb, wx, 0.38, wz, true);
  return mb;
}
export function buildSedan(paintHex, police) {
  const mb = new MB(), paint = C(paintHex);
  mb.loft([
    section(-2.1, 0.88, 0.3, 0.7, 0.8), section(-1.2, 0.94, 0.28, 0.74, 0.84),
    section(-0.3, 0.94, 0.28, 0.78, 0.72), section(0.7, 0.92, 0.28, 0.74, 0.68),
    section(1.6, 0.88, 0.3, 0.62, 0.62), section(2.15, 0.74, 0.34, 0.52, 0.5),
  ], paint, police ? 0.08 : 0.1);
  mb.loft([
    section(-0.6, 0.7, 0.76, 1.04, 0.58), section(0.2, 0.66, 0.78, 1.06, 0.52),
    section(0.9, 0.6, 0.74, 0.86, 0.46),
  ], C(0x1c2638), 0.35);
  mb.box(-0.55, 0.5, 2.16, 0.4, 0.13, 0.06, C(0xfff2c8), 0.9);
  mb.box(0.55, 0.5, 2.16, 0.4, 0.13, 0.06, C(0xfff2c8), 0.9);
  mb.box(0, 0.62, -2.12, 1.4, 0.11, 0.06, C(0xff2a3a), 0.9);
  if (police) {
    mb.box(0, 1.14, -0.1, 1.1, 0.16, 0.34, C(0x222226), 0);
    mb.box(-0.3, 1.28, -0.1, 0.48, 0.14, 0.3, C(0xff2a3a), 1);
    mb.box(0.3, 1.28, -0.1, 0.48, 0.14, 0.3, C(0x2a6aff), 1);
    mb.box(0, 0.62, -0.2, 1.9, 0.2, 0.02, C(0x1a1a20), 0); // door band hint
    mb.box(0, 0.45, 2.2, 1.5, 0.22, 0.12, C(0x222226), 0); // push bar
  }
  for (const [wx, wz] of [[-0.86, 1.35], [0.86, 1.35], [-0.86, -1.35], [0.86, -1.35]]) wheel(mb, wx, 0.38, wz, false);
  return mb;
}
function octSection(z, r, y, squash) {
  const pts = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    pts.push([Math.cos(a) * r, y + Math.sin(a) * r * squash]);
  }
  return { z, pts };
}
export function buildHeli() {
  const mb = new MB(), white = C(0xf0f0f2);
  mb.loft([
    octSection(-3.4, 0.22, 0, 1), octSection(-2.2, 0.34, 0, 1), octSection(-1.2, 0.62, 0, 1),
    octSection(-0.2, 0.85, 0, 1), octSection(0.8, 0.9, 0, 1.05), octSection(1.6, 0.7, 0, 1),
    octSection(2.1, 0.4, 0, 1), octSection(2.35, 0.16, 0, 1),
  ], white, 0.1);
  // Glass cockpit nose + blue cheatline + white belly panel.
  mb.loft([octSection(0.9, 0.86, 0.05, 1), octSection(1.7, 0.62, 0.05, 1), octSection(2.1, 0.34, 0.05, 1)], C(0x20344e), 0.5);
  mb.box(0, 0.12, 0.1, 1.86, 0.22, 2.4, C(0x2a5aa8), 0.2);
  mb.box(0, -0.82, 0.2, 1.2, 0.12, 2.2, C(0xffffff), 0.15);
  // Tail fin + stabilizer, skids, mast.
  mb.face([[-0.06, 0.2, -3.3], [0.06, 0.2, -3.3], [0.06, 1.5, -2.9], [-0.06, 1.5, -2.9]], [0, 0, 1], C(0x2a5aa8), 0.1);
  mb.box(0, 0.1, -2.6, 1.5, 0.08, 0.4, white, 0);
  mb.box(-0.75, -1.25, 0.2, 0.12, 0.12, 2.6, C(0x303038), 0);
  mb.box(0.75, -1.25, 0.2, 0.12, 0.12, 2.6, C(0x303038), 0);
  for (const [sx, sz] of [[-0.75, 1.0], [0.75, 1.0], [-0.75, -0.7], [0.75, -0.7]]) {
    mb.box(sx, -0.95, sz, 0.1, 0.6, 0.1, C(0x303038), 0);
  }
  mb.box(0, 1.05, 0.1, 0.22, 0.4, 0.22, C(0x303038), 0);
  return mb;
}
export function buildRotor() {
  const mb = new MB();
  mb.box(0, 0, 0, 7.4, 0.07, 0.3, C(0x222228), 0);
  mb.box(0, 0.02, 0, 0.3, 0.07, 7.4, C(0x222228), 0);
  mb.box(0, -0.06, 0, 0.5, 0.12, 0.5, C(0x3a3a42), 0);
  return mb;
}
export function buildBlurDisc() {
  const mb = new MB();
  mb.disc(0, 0, 0, 3.8, 20, C(0xd8d8e0), 0.1);
  return mb;
}
export function buildSearchCone() {
  const mb = new MB();
  // Open cone: apex at origin, opening downward (drawn apex-up at the heli).
  const segs = 12, r = 3.4, h = 1;
  const apex = mb.v(0, 0, 0, 0, -1, 0, C(0xfff2c8), 0.7);
  const ring = [];
  for (let k = 0; k < segs; k++) {
    const a = (k / segs) * Math.PI * 2;
    ring.push(mb.v(Math.cos(a) * r, -h, Math.sin(a) * r, Math.cos(a), 0, Math.sin(a), C(0xfff2c8), 0.7));
  }
  for (let k = 0; k < segs; k++) mb.tri(apex, ring[k], ring[(k + 1) % segs]);
  return mb;
}
export function buildPoolDisc() {
  const mb = new MB();
  mb.disc(0, 0, 0, 1, 16, C(0xfff2c8), 0.85);
  return mb;
}
export function buildRoadblock() {
  const mb = new MB();
  for (let k = -1; k <= 1; k++) {
    const x = k * 2.6;
    for (let s = 0; s < 4; s++) {
      mb.box(x - 1.0 + s * 0.62, 0.75, 0, 0.62, 0.5, 0.3, s % 2 ? C(0xf0f0f0) : C(0xe86a20), 0.25);
    }
    mb.box(x - 1.0, 0.3, 0, 0.24, 0.6, 0.24, C(0x3a3a44), 0);
    mb.box(x + 1.0, 0.3, 0, 0.24, 0.6, 0.24, C(0x3a3a44), 0);
  }
  mb.cone(-3.6, 0, 0.8, 0.4, 0.9, 8, C(0xe86a20), 0.2);
  mb.cone(3.6, 0, 0.8, 0.4, 0.9, 8, C(0xe86a20), 0.2);
  mb.box(0, 1.5, 0, 3.4, 0.6, 0.2, C(0x2a5aa8), 0.5);
  return mb;
}
export function drawCar(r, mesh, car, t) {
  r.draw(mesh, matModel(car.x, 0, car.z, car.heading, 0, 1), 1);
}
export function drawHeli(r, meshes, heli, t) {
  const bob = Math.sin(t * 1.7) * 0.25;
  r.draw(meshes.body, matModel(heli.x, heli.y + bob, heli.z, heli.heading, 0, 1), 1);
  r.draw(meshes.rotor, matModel(heli.x, heli.y + bob + 1.28, heli.z, t * 14, 0, 1), 1);
  r.draw(meshes.blur, matModel(heli.x, heli.y + bob + 1.26, heli.z, 0, 0, 1), 0.22);
  // Searchlight cone from the heli belly to the ground + pool.
  const gy = 0.12, hgt = heli.y + bob - gy;
  r.draw(meshes.cone, matModelS(heli.x, heli.y + bob - 0.8, heli.z, 0, 0, 1, hgt, 1), 0.16);
  r.draw(meshes.pool, matModelS(heli.x, gy, heli.z, 0, 0, 3.6, 1, 3.6), 0.4);
}
