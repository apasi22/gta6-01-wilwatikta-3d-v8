// People for Wilwatikta: one consistent stylized character model — round
// head, short black hair, sunglasses, smooth capsule limbs, tan skin —
// worn by Sugeng Wibowo everywhere (title screen, on-foot play, portraits)
// with per-character shirt, trousers and skin colors. Limbs are separate
// meshes pivoted at shoulder and hip so they swing while walking.
import { MB, C, matModel } from "./gl.js";

const SKIN = 0xd8a878;
export function buildPerson(opts) {
  const o = Object.assign({ shirt: 0x1f9e6a, pants: 0xc8b890, skin: SKIN, hair: 0x181818, stripe: true, glasses: true, pistol: false }, opts || {});
  const shirt = C(o.shirt), pants = C(o.pants), skin = C(o.skin);
  // Torso: ROUNDED loft — an 8-point soft section, pinched at the front
  // and back stations so the chest reads smooth and capsule-like, not boxy.
  // Bold white stripe down the front, belt at the waist.
  const torso = new MB();
  const secBase = [[-0.20, 0.78], [0.20, 0.78], [0.28, 0.88], [0.29, 1.28], [0.22, 1.38], [-0.22, 1.38], [-0.29, 1.28], [-0.28, 0.88]];
  const sec = (z, sc) => ({ z, pts: secBase.map(([x, y]) => [x * sc, 1.08 + (y - 1.08) * sc]) });
  torso.loft([sec(-0.16, 0.78), sec(0, 1), sec(0.16, 0.78)], shirt, 0);
  torso.ball(-0.27, 1.36, 0, 0.12, 6, shirt, 0);
  torso.ball(0.27, 1.36, 0, 0.12, 6, shirt, 0);
  if (o.stripe) torso.box(0, 1.08, 0.17, 0.14, 0.42, 0.03, C(0xf4f4f0), 0.05);
  torso.box(0, 0.85, 0, 0.56, 0.09, 0.34, C(0x8a7a5a), 0); // belt
  // Head group, pivot at the neck (0, 1.44, 0). Big round head, short
  // black hair, two-lens sunglasses, small nose.
  const head = new MB();
  head.ball(0, 0.02, 0, 0.09, 6, skin, 0); // neck
  head.ball(0, 0.26, 0, 0.24, 10, skin, 0);
  head.ball(0, 0.31, -0.05, 0.245, 10, C(o.hair), 0, 0.75); // hair cap
  head.box(0, 0.24, -0.19, 0.34, 0.28, 0.1, C(o.hair), 0); // back hair
  if (o.glasses) {
    // Two lenses + bridge, sized to the face (not a full visor bar).
    head.box(-0.10, 0.28, 0.22, 0.12, 0.085, 0.04, C(0x14141c), 0.3);
    head.box(0.10, 0.28, 0.22, 0.12, 0.085, 0.04, C(0x14141c), 0.3);
    head.box(0, 0.28, 0.215, 0.06, 0.03, 0.03, C(0x14141c), 0.3);
    head.box(-0.21, 0.28, 0.16, 0.05, 0.04, 0.1, C(0x14141c), 0.3);
    head.box(0.21, 0.28, 0.16, 0.05, 0.04, 0.1, C(0x14141c), 0.3);
  }
  head.box(0, 0.18, 0.235, 0.05, 0.07, 0.03, C(0xc89068), 0); // nose hint
  // Arms: pivot at the shoulder, sleeve + forearm capsule + hand.
  function arm(side) {
    const m = new MB(), sx = side * 0.32;
    m.capsule(sx, 0, 0, 0.10, 0.2, 6, shirt, 0);
    m.capsule(sx, -0.2, 0, 0.085, 0.3, 6, skin, 0);
    m.ball(sx, -0.52, 0, 0.09, 6, skin, 0);
    return m;
  }
  const armL = arm(-1), armR = arm(1);
  // Legs: pivot at the hip, khaki capsules + dark shoes.
  function leg(side) {
    const m = new MB(), sx = side * 0.13;
    m.capsule(sx, 0, 0, 0.11, 0.6, 6, pants, 0);
    m.box(sx, -0.72, 0.04, 0.16, 0.1, 0.3, C(0x2a2a30), 0);
    return m;
  }
  const legL = leg(-1), legR = leg(1);
  // Pistol in arm-local space: chunky grip + gunmetal slide, barrel
  // pointing down at the side — big enough to read at title distance.
  const pistol = new MB();
  pistol.box(0.32, -0.55, 0.03, 0.09, 0.16, 0.11, C(0x1c1c22), 0.1);
  pistol.box(0.32, -0.70, 0.06, 0.07, 0.18, 0.07, C(0x3c3c48), 0.2);
  pistol.box(0.32, -0.60, 0.09, 0.08, 0.05, 0.06, C(0x565664), 0.25);
  return { torso, head, armL, armR, legL, legR, pistol, hasPistol: !!o.pistol };
}
export function buildMarker() {
  const mb = new MB();
  mb.box(0, 0, 0, 0.3, 0.3, 0.06, C(0xff2a3a), 0.9);
  return mb;
}
export function buildFlash() {
  const mb = new MB();
  const col = C(0xffe890);
  mb.face([[-0.3, 0, 0], [0.3, 0, 0], [0, 0.3, 0]], [0, 0, 1], col, 1);
  mb.face([[-0.3, 0, 0], [0.3, 0, 0], [0, -0.3, 0]], [0, 0, 1], col, 1);
  mb.face([[0, 0, -0.3], [0, 0, 0.3], [0, 0.3, 0]], [1, 0, 0], col, 1);
  mb.face([[0, 0, -0.3], [0, 0, 0.3], [0, -0.3, 0]], [1, 0, 0], col, 1);
  return mb;
}
// Draw a person. opts: walk (0..1 swing), aim (right arm forward), headYaw,
// marker (red box above head), armed (pistol visible), flash (muzzle flash).
export function drawPerson(r, gpu, parts, x, y, z, heading, opts) {
  const o = opts || {}, swing = Math.sin((o.phase || 0)) * 0.55 * (o.walk || 0);
  const bob = Math.abs(Math.cos(o.phase || 0)) * 0.03 * (o.walk || 0);
  const py = y + bob;
  r.draw(gpu.torso, matModel(x, py, z, heading, 0, 1), 1);
  r.draw(gpu.head, matModel(x, py + 1.44, z, heading + (o.headYaw || 0), 0, 1), 1);
  const armSwing = swing * 0.7;
  r.draw(gpu.armL, matModel(x, py + 1.38, z, heading, -armSwing, 1), 1);
  const aimRx = o.aim ? -1.4 : armSwing;
  r.draw(gpu.armR, matModel(x, py + 1.38, z, heading, aimRx, 1), 1);
  r.draw(gpu.legL, matModel(x, py + 0.78, z, heading, swing, 1), 1);
  r.draw(gpu.legR, matModel(x, py + 0.78, z, heading, -swing, 1), 1);
  if (o.armed && parts.hasPistol) r.draw(gpu.pistol, matModel(x, py + 1.38, z, heading, aimRx, 1), 1);
  if (o.marker) r.draw(gpu.marker, matModel(x, py + 2.15, z, heading, 0, 1), 1);
  if (o.flash) {
    // Muzzle flash at the raised right hand, ahead of the body.
    const fx = x + Math.sin(heading) * 0.55, fz = z + Math.cos(heading) * 0.55;
    r.draw(gpu.flash, matModel(fx, py + 1.32, fz, heading, 0, 1), 0.95);
  }
}
