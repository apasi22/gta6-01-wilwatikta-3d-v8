// Raw WebGL1 forward renderer for Wilwatikta: one lit program with
// per-vertex color and glow plus a sky-gradient program, a mesh builder for
// procedural low-poly geometry, and column-major matrix helpers.
export function C(hex) {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}
export function matIdentity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}
export function matMul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return o;
}
export function matPersp(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2), o = new Float32Array(16);
  o[0] = f / aspect; o[5] = f; o[10] = (far + near) / (near - far);
  o[11] = -1; o[14] = (2 * far * near) / (near - far);
  return o;
}
export function matLook(eye, tgt, up) {
  let fx = tgt[0] - eye[0], fy = tgt[1] - eye[1], fz = tgt[2] - eye[2];
  const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  let sx = fy * up[2] - fz * up[1], sy = fz * up[0] - fx * up[2], sz = fx * up[1] - fy * up[0];
  const sl = Math.hypot(sx, sy, sz) || 1; sx /= sl; sy /= sl; sz /= sl;
  const ux = sy * fz - sz * fy, uy = sz * fx - sx * fz, uz = sx * fy - sy * fx;
  const o = matIdentity();
  o[0] = sx; o[4] = sy; o[8] = sz;
  o[1] = ux; o[5] = uy; o[9] = uz;
  o[2] = -fx; o[6] = -fy; o[10] = -fz;
  o[12] = -(sx * eye[0] + sy * eye[1] + sz * eye[2]);
  o[13] = -(ux * eye[0] + uy * eye[1] + uz * eye[2]);
  o[14] = fx * eye[0] + fy * eye[1] + fz * eye[2];
  return o;
}
// Model matrix: translate, rotate about Y (heading), then rotate about X (pitch), then scale.
export function matModel(x, y, z, ry, rx, s) {
  const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx);
  const sc = s === undefined ? 1 : s, o = matIdentity();
  o[0] = cy * sc; o[1] = 0; o[2] = -sy * sc;
  o[4] = sy * sx * sc; o[5] = cx * sc; o[6] = cy * sx * sc;
  o[8] = sy * cx * sc; o[9] = -sx * sc; o[10] = cy * cx * sc;
  o[12] = x; o[13] = y; o[14] = z;
  return o;
}
// Model matrix with non-uniform scale: translate * rotY * rotX * scale.
export function matModelS(x, y, z, ry, rx, sx, sy, sz) {
  const cy = Math.cos(ry), syy = Math.sin(ry), cx = Math.cos(rx), sxr = Math.sin(rx);
  const o = matIdentity();
  o[0] = cy * sx; o[1] = 0; o[2] = -syy * sx;
  o[4] = syy * sxr * sy; o[5] = cx * sy; o[6] = cy * sxr * sy;
  o[8] = syy * cx * sz; o[9] = -sxr * sz; o[10] = cy * cx * sz;
  o[12] = x; o[13] = y; o[14] = z;
  return o;
}
export class MB {
  constructor() { this.p = []; this.n = []; this.c = []; this.g = []; this.i = []; }
  get count() { return this.i.length; }
  v(x, y, z, nx, ny, nz, col, glow) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz);
    this.c.push(col[0], col[1], col[2]); this.g.push(glow || 0);
    return this.p.length / 3 - 1;
  }
  tri(a, b, c) { this.i.push(a, b, c); }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  face(pts, n, col, glow) {
    const ids = pts.map((p) => this.v(p[0], p[1], p[2], n[0], n[1], n[2], col, glow));
    for (let k = 1; k < ids.length - 1; k++) this.tri(ids[0], ids[k], ids[k + 1]);
    return ids;
  }
  // Axis-aligned box; topCol overrides the top face color.
  box(cx, cy, cz, sx, sy, sz, col, glow, topCol) {
    const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
    this.face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], col, glow);
    this.face([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], col, glow);
    this.face([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], col, glow);
    this.face([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], col, glow);
    this.face([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], topCol || col, glow);
    this.face([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], col, glow);
  }
  // Vertical prism with `sides` sides, centered at (cx, cz), base y0, top y1.
  prism(cx, y0, cz, r, y1, sides, col, glow, rTop) {
    const rt = rTop === undefined ? r : rTop, bot = [], top = [];
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      bot.push(this.v(cx + ca * r, y0, cz + sa * r, ca, 0, sa, col, glow));
      top.push(this.v(cx + ca * rt, y1, cz + sa * rt, ca, 0, sa, col, glow));
    }
    for (let k = 0; k < sides; k++) {
      const n = (k + 1) % sides;
      this.quad(bot[k], bot[n], top[n], top[k]);
    }
    const bc = this.v(cx, y0, cz, 0, -1, 0, col, glow), tc = this.v(cx, y1, cz, 0, 1, 0, col, glow);
    for (let k = 0; k < sides; k++) {
      const n = (k + 1) % sides;
      this.tri(bc, bot[n], bot[k]); this.tri(tc, top[k], top[n]);
    }
  }
  cone(cx, y0, cz, r, y1, sides, col, glow) { this.prism(cx, y0, cz, r, y1, sides, col, glow, 0.001); }
  // Flat disc facing up at height y.
  disc(cx, y, cz, r, sides, col, glow) {
    const c = this.v(cx, y, cz, 0, 1, 0, col, glow), ring = [];
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      ring.push(this.v(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r, 0, 1, 0, col, glow));
    }
    for (let k = 0; k < sides; k++) this.tri(c, ring[k], ring[(k + 1) % sides]);
  }
  // Low-poly sphere: rings of latitude, `seg` segments around.
  ball(cx, cy, cz, r, seg, col, glow, squashY) {
    const sy = squashY === undefined ? 1 : squashY, rings = Math.max(3, Math.floor(seg / 2));
    const grid = [];
    for (let j = 0; j <= rings; j++) {
      const phi = (j / rings) * Math.PI, y = Math.cos(phi) * r * sy, rr = Math.sin(phi) * r, row = [];
      for (let k = 0; k < seg; k++) {
        const a = (k / seg) * Math.PI * 2, nx = Math.cos(a) * Math.sin(phi), nz = Math.sin(a) * Math.sin(phi);
        row.push(this.v(cx + Math.cos(a) * rr, cy + y, cz + Math.sin(a) * rr, nx, Math.cos(phi), nz, col, glow));
      }
      grid.push(row);
    }
    for (let j = 0; j < rings; j++) for (let k = 0; k < seg; k++) {
      const n = (k + 1) % seg;
      this.quad(grid[j][k], grid[j][n], grid[j + 1][n], grid[j + 1][k]);
    }
  }
  // Capsule along Y: cylinder plus ball caps, pivot at the top (for limbs).
  capsule(x, yTop, z, r, len, seg, col, glow) {
    this.prism(x, yTop - len, z, r, yTop, seg, col, glow);
    this.ball(x, yTop, z, r, seg, col, glow);
    this.ball(x, yTop - len, z, r, seg, col, glow);
  }
  // Loft: cross-section polygons extruded along Z. Each station: {z, pts:[[x,y],...]}
  // with matching point counts; quads connect consecutive stations, ends capped.
  loft(stations, col, glow, colFn) {
    const grids = stations.map((st) => st.pts.map((p) => {
      const c = colFn ? colFn(st, p) : col;
      return this.v(p[0], p[1], st.z, 0, 0, 1, c, glow);
    }));
    const n = stations[0].pts.length;
    for (let s = 0; s < stations.length - 1; s++) {
      for (let k = 0; k < n; k++) {
        const m = (k + 1) % n;
        // Outward-ish normal from the section edge, in the XY plane.
        const p0 = stations[s].pts[k], p1 = stations[s].pts[m];
        let nx = p1[1] - p0[1], ny = -(p1[0] - p0[0]);
        const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
        const a = grids[s][k], b = grids[s][m], c2 = grids[s + 1][m], d = grids[s + 1][k];
        this.n[a * 3] = nx; this.n[a * 3 + 1] = ny; this.n[a * 3 + 2] = 0;
        this.n[b * 3] = nx; this.n[b * 3 + 1] = ny; this.n[b * 3 + 2] = 0;
        this.n[c2 * 3] = nx; this.n[c2 * 3 + 1] = ny; this.n[c2 * 3 + 2] = 0;
        this.n[d * 3] = nx; this.n[d * 3 + 1] = ny; this.n[d * 3 + 2] = 0;
        this.quad(a, b, c2, d);
      }
    }
    // End caps: fresh ring vertices facing ±Z so caps light correctly.
    const cap = (st, nz) => {
      const cx = st.pts.reduce((s, p) => s + p[0], 0) / n;
      const cy = st.pts.reduce((s, p) => s + p[1], 0) / n;
      const ring = st.pts.map((p) => this.v(p[0], p[1], st.z, 0, 0, nz, col, glow));
      const cc = this.v(cx, cy, st.z, 0, 0, nz, col, glow);
      for (let k = 0; k < n; k++) {
        const m = (k + 1) % n;
        if (nz > 0) this.tri(cc, ring[k], ring[m]); else this.tri(cc, ring[m], ring[k]);
      }
    };
    cap(stations[0], -1); cap(stations[stations.length - 1], 1);
  }
  merge(other) {
    const base = this.p.length / 3;
    this.p.push(...other.p); this.n.push(...other.n);
    this.c.push(...other.c); this.g.push(...other.g);
    for (const idx of other.i) this.i.push(idx + base);
  }
}

const SCENE_VS = `attribute vec3 aPos;attribute vec3 aNrm;attribute vec3 aCol;attribute float aGlow;
uniform mat4 uP;uniform mat4 uV;uniform mat4 uM;
varying vec3 vCol;varying float vGlow;varying vec3 vN;varying float vDist;
void main(){vec4 wp=uM*vec4(aPos,1.0);vec4 vp=uV*wp;gl_Position=uP*vp;vDist=-vp.z;vN=mat3(uM)*aNrm;vCol=aCol;vGlow=aGlow;}`;
const SCENE_FS = `precision mediump float;
varying vec3 vCol;varying float vGlow;varying vec3 vN;varying float vDist;
uniform vec3 uSunDir;uniform vec3 uSunCol;uniform vec3 uAmb;uniform vec3 uFogCol;uniform float uFogNear;uniform float uFogFar;uniform float uAlpha;
void main(){vec3 n=normalize(vN);float d=max(dot(n,uSunDir),0.0);vec3 lit=vCol*(uAmb+uSunCol*d);vec3 col=mix(lit,vCol*1.5+vec3(0.22),vGlow);float f=clamp((vDist-uFogNear)/(uFogFar-uFogNear),0.0,1.0);col=mix(col,uFogCol,f);gl_FragColor=vec4(col,uAlpha);}`;
const SKY_VS = `attribute vec2 aXY;varying vec2 vXY;void main(){vXY=aXY;gl_Position=vec4(aXY,0.999,1.0);}`;
const SKY_FS = `precision mediump float;varying vec2 vXY;
uniform vec3 uTop;uniform vec3 uMid;uniform vec3 uHor;uniform vec2 uSun;uniform vec3 uSunCol;uniform float uSunR;uniform float uSunI;uniform float uAspect;
void main(){float y=vXY.y*0.5+0.5;vec3 col=mix(uHor,uMid,clamp(y*1.9,0.0,1.0));col=mix(col,uTop,clamp((y-0.45)*2.2,0.0,1.0));float d=length((vXY-uSun)*vec2(uAspect,1.0));float disc=smoothstep(uSunR,uSunR*0.55,d);float glow=exp(-d*4.2)*0.75;col+=uSunCol*(disc*1.4+glow)*uSunI;gl_FragColor=vec4(col,1.0);}`;

export function createRenderer(canvas) {
  const gl = canvas.getContext("webgl", { antialias: true, alpha: false });
  if (!gl) return null;
  // Meshes exceed 65k vertices, so 32-bit indices are mandatory.
  if (!gl.getExtension("OES_element_index_uint")) throw new Error("OES_element_index_uint unavailable");
  function prog(vs, fs) {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
  const scene = prog(SCENE_VS, SCENE_FS), sky = prog(SKY_VS, SKY_FS);
  const U = {};
  for (const n of ["uP", "uV", "uM", "uSunDir", "uSunCol", "uAmb", "uFogCol", "uFogNear", "uFogFar", "uAlpha"]) U[n] = gl.getUniformLocation(scene, n);
  const SU = {};
  for (const n of ["uTop", "uMid", "uHor", "uSun", "uSunCol", "uSunR", "uSunI", "uAspect"]) SU[n] = gl.getUniformLocation(sky, n);
  const skyBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.disable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0, 0, 0, 1);
  let proj = matIdentity(), view = matIdentity();
  return {
    gl,
    resize(w, h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); },
    upload(mb) {
      const vb = gl.createBuffer(), ib = gl.createBuffer();
      const pos = new Float32Array(mb.p), nrm = new Float32Array(mb.n), col = new Float32Array(mb.c), glow = new Float32Array(mb.g);
      const inter = new Float32Array(mb.p.length / 3 * 10);
      for (let v = 0; v < mb.p.length / 3; v++) {
        inter.set([pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2], nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2], col[v * 3], col[v * 3 + 1], col[v * 3 + 2], glow[v]], v * 10);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.bufferData(gl.ARRAY_BUFFER, inter, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(mb.i), gl.STATIC_DRAW);
      return { vb, ib, count: mb.i.length };
    },
    begin(pal, viewMat, projMat, sunScreen, sunI, aspect) {
      proj = projMat; view = viewMat;
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.depthMask(false); gl.disable(gl.BLEND);
      gl.useProgram(sky);
      gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf);
      const aXY = gl.getAttribLocation(sky, "aXY");
      gl.enableVertexAttribArray(aXY);
      gl.vertexAttribPointer(aXY, 2, gl.FLOAT, false, 0, 0);
      gl.uniform3fv(SU.uTop, pal.skyTop); gl.uniform3fv(SU.uMid, pal.skyMid); gl.uniform3fv(SU.uHor, pal.skyHor);
      gl.uniform2fv(SU.uSun, sunScreen); gl.uniform3fv(SU.uSunCol, pal.sunCol); gl.uniform1f(SU.uSunR, pal.sunR);
      gl.uniform1f(SU.uSunI, sunI === undefined ? 1 : sunI); gl.uniform1f(SU.uAspect, aspect || 1.78);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.depthMask(true);
      gl.useProgram(scene);
      gl.uniformMatrix4fv(U.uP, false, proj);
      gl.uniformMatrix4fv(U.uV, false, view);
      gl.uniform3fv(U.uSunDir, pal.sunDir); gl.uniform3fv(U.uSunCol, pal.sunCol);
      gl.uniform3fv(U.uAmb, pal.amb); gl.uniform3fv(U.uFogCol, pal.fog);
      gl.uniform1f(U.uFogNear, pal.fogNear); gl.uniform1f(U.uFogFar, pal.fogFar);
    },
    draw(mesh, model, alpha) {
      const a = alpha === undefined ? 1 : alpha;
      if (a < 1) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); }
      else { gl.disable(gl.BLEND); gl.depthMask(true); }
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vb);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ib);
      const stride = 40;
      for (const [name, size, off] of [["aPos", 3, 0], ["aNrm", 3, 12], ["aCol", 3, 24], ["aGlow", 1, 36]]) {
        const loc = gl.getAttribLocation(scene, name);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, off);
      }
      gl.uniformMatrix4fv(U.uM, false, model);
      gl.uniform1f(U.uAlpha, a);
      gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);
    },
    finish() { gl.disable(gl.BLEND); gl.depthMask(true); gl.flush(); },
  };
}
