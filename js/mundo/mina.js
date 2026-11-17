// Interior de la mina Fortuna (nivel 1), como una mina de 1905 excavada en roca: galerías de sección irregular con techo en
// arco rebajado (malla con desplazamiento por ruido, no cajas), marcos de entibación cada 2,5 m, piso de roca y barro,
// galerías laterales ciegas, cables y manguera de aire, polvo en el aire. Solo lo usa construirSala cuando la sala es 'roca'.
// Todo es visual: las colisiones siguen siendo las cajas de construirSala (más un techo invisible para la cámara).
import * as THREE from 'three';

// ---------------------------------------------------------------- ruido (valor, determinista)
function hash3(x, y, z) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967295;
}
const suave = t => t * t * (3 - 2 * t);
export function ruido3(x, y, z, p = 0) {   // p > 0: periódico en x e y (para texturas que se repiten sin costura)
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = suave(x - xi), fy = suave(y - yi), fz = suave(z - zi);
  const w = (a, b) => p ? ((a % p) + p) % p : a;
  let r = 0;
  for (let k = 0; k < 8; k++) {
    const dx = k & 1, dy = (k >> 1) & 1, dz = k >> 2;
    r += hash3(w(xi + dx), w(yi + dy), zi + dz) * (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz);
  }
  return r;
}
export function fbm(x, y, z, oct = 3, p = 0) {
  let s = 0, a = 0.5, n = 0;
  for (let o = 0; o < oct; o++) { s += ruido3(x, y, z + o * 7.3, p) * a; n += a; a *= 0.5; x *= 2; y *= 2; z *= 2; if (p) p *= 2; }
  return s / n;
}

// ---------------------------------------------------------------- texturas procedurales (color + normal map), una vez
const TEX = new Map();
function texturas(clave, n, alto, color, fuerza) {
  if (TEX.has(clave)) return TEX.get(clave);
  const h = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) h[y * n + x] = alto(x / n, y / n);
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = n; return c; };
  const cC = mk(), cN = mk(), dC = cC.getContext('2d').createImageData(n, n), dN = cN.getContext('2d').createImageData(n, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x, hx = h[y * n + (x + 1) % n] - h[y * n + (x + n - 1) % n], hy = h[((y + 1) % n) * n + x] - h[((y + n - 1) % n) * n + x];
    const nx = -hx * fuerza, ny = -hy * fuerza, l = Math.hypot(nx, ny, 1);
    dN.data.set([(nx / l * 0.5 + 0.5) * 255, (-ny / l * 0.5 + 0.5) * 255, (1 / l * 0.5 + 0.5) * 255, 255], i * 4);
    const [r, g, b] = color(h[i], x / n, y / n); dC.data.set([r, g, b, 255], i * 4);
  }
  cC.getContext('2d').putImageData(dC, 0, 0); cN.getContext('2d').putImageData(dN, 0, 0);
  const t = [new THREE.CanvasTexture(cC), new THREE.CanvasTexture(cN)];
  for (const x of t) { x.wrapS = x.wrapT = THREE.RepeatWrapping; x.anisotropy = 4; }
  t[0].colorSpace = THREE.SRGBColorSpace;
  TEX.set(clave, t); return t;
}
const mezcla = (a, b, t) => a.map((v, i) => v + (b[i] - v) * Math.max(0, Math.min(1, t)));
export function texRoca() {   // roca de la cordillera: gris pardo con vetas, grietas y manchas de humedad
  return texturas('roca', 256, (u, v) => {
    const f = fbm(u * 6, v * 6, 0.5, 4, 6), g = Math.abs(fbm(u * 4, v * 4, 3.1, 2, 4) - 0.5);
    return f * 0.8 + g * 0.15;
  }, (h, u, v) => {
    const m = fbm(u * 3, v * 3, 9, 2, 3), c = mezcla([78, 66, 56], [150, 136, 118], h * 1.4 - 0.2);
    return mezcla(c, [52, 58, 50], (m - 0.55) * 3).map(x => x * (0.85 + 0.3 * fbm(u * 24, v * 24, 2, 1, 24)));
  }, 4);
}
export function texBarro() {   // piso de roca y barro con piedras sueltas y charcos
  return texturas('barro', 256, (u, v) => {
    const f = fbm(u * 8, v * 8, 1.7, 3, 8), p = ruido3(u * 22, v * 22, 4.2, 22);
    return f * 0.6 + Math.max(0, p - 0.62) * 1.6;
  }, (h, u, v) => {
    const c = mezcla([58, 44, 32], [118, 104, 88], (h - 0.25) * 2.2), w = fbm(u * 4, v * 4, 6.6, 2, 4);
    return mezcla(c, [34, 28, 24], (0.42 - w) * 6);
  }, 7);
}
export function texMaderaMina() {   // madera de pino gastada y sucia, vetas a lo largo de V
  return texturas('maderaMina', 128, (u, v) => fbm(u * 24, v * 2, 0.3, 3, 2) * 0.7 + Math.max(0, ruido3(u * 9, v * 3, 8, 3) - 0.7),
    (h, u, v) => mezcla([58, 38, 22], [128, 92, 58], h * 1.3 - 0.15).map(x => x * (0.8 + 0.3 * fbm(u * 3, v * 3, 5, 2, 3))), 5);
}
const MAT = {};
function matRoca() { return MAT.roca ??= (() => { const [map, normalMap] = texRoca(); return new THREE.MeshStandardMaterial({ map, normalMap, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.78, color: 0xb4a898 }); })(); }
function matBarro() { return MAT.barro ??= (() => { const [map, normalMap] = texBarro(); return new THREE.MeshStandardMaterial({ map, normalMap, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.7, color: 0xc0b0a0 }); })(); }
export function matMadera() { return MAT.madera ??= (() => { const [map, normalMap] = texMaderaMina(); return new THREE.MeshStandardMaterial({ map, normalMap, roughness: 0.9, color: 0xc8b090 }); })(); }

// ---------------------------------------------------------------- galería: tubo de roca con sección en arco rebajado
// anillos: [{ c: [x, yPiso, z], hw, yw, yr }] a lo largo de dir (unitario en xz); yw = alto de muro, yr = alto de clave (relativos al piso)
const NW = 5, NA = 12;
function galeria(anillos, dir, { semilla = 0, hueco = () => false } = {}) {
  const lat = new THREE.Vector3(dir[0], 0, dir[1]).cross(new THREE.Vector3(0, 1, 0)).normalize();
  const pos = [], uv = [], idx = [], base = [];
  const perfil = a => {   // puntos (lateral, alto, normal lateral, normal alto) de abajo-izquierda a abajo-derecha
    const P = [], hb = -0.35;
    for (let k = 0; k <= NW; k++) P.push([-a.hw, hb + (a.yw - hb) * k / NW, -1, 0]);
    for (let k = 1; k < NA; k++) { const t = Math.PI - Math.PI * k / NA, c = Math.cos(t), s = Math.sin(t); const n = [c / a.hw, s / (a.yr - a.yw)], l = Math.hypot(...n); P.push([a.hw * c, a.yw + (a.yr - a.yw) * s, n[0] / l, n[1] / l]); }
    for (let k = NW; k >= 0; k--) P.push([a.hw, hb + (a.yw - hb) * k / NW, 1, 0]);
    return P;
  };
  let nP = 0, z0 = null, sAcum = 0;
  anillos.forEach((a, i) => {
    const P = perfil(a); nP = P.length;
    if (i) sAcum += Math.hypot(a.c[0] - anillos[i - 1].c[0], a.c[2] - anillos[i - 1].c[2]);
    let arco = 0;
    P.forEach(([px, py, nx, ny], k) => {
      if (k) arco += Math.hypot(px - P[k - 1][0], py - P[k - 1][1]);
      const wx = a.c[0] + lat.x * px, wz = a.c[2] + lat.z * px, wy = a.c[1] + py;
      // irregularidad: ruido grande y chico hacia afuera/adentro, más un nicho de vez en cuando en los muros
      const enMuro = Math.abs(nx) > 0.9, sub = py / Math.max(a.yw, 0.1);
      let d = (fbm(wx * 0.32 + semilla, wy * 0.32, wz * 0.32, 3) - 0.5) * (enMuro ? 1.6 : 1.0) + (ruido3(wx * 1.3, wy * 1.3, wz * 1.3 + semilla) - 0.5) * 0.22;
      if (enMuro) { const ni = suave(Math.max(0, Math.min(1, (ruido3(wz * 0.18 + nx * 31 + semilla, 0.5, wx * 0.18) - 0.6) * 7))); d += ni * 0.9 * Math.exp(-(((py - 1.2) / 0.8) ** 2)); }
      if (py < 0.2) d = Math.max(d, -0.15);   // al pie del muro, sin rocas que tapen el piso caminable
      const ox = (lat.x * nx) * d, oz = (lat.z * nx) * d, oy = ny * Math.min(d, a.tope ?? 9) * 0.8;
      pos.push(wx + ox, wy + oy, wz + oz); uv.push(arco / 3.2, sAcum / 3.2); base.push([px, py, a, sub]);
    });
  });
  for (let i = 0; i < anillos.length - 1; i++) for (let k = 0; k < nP - 1; k++) {
    const a = i * nP + k, b = (i + 1) * nP + k, c = a + 1, d2 = b + 1;
    const [px, py] = base[a], A = anillos[i];
    if (hueco((A.c[0] + anillos[i + 1].c[0]) / 2, (A.c[2] + anillos[i + 1].c[2]) / 2, px, py)) continue;
    idx.push(a, b, c, c, b, d2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, matRoca()); m.receiveShadow = true; m.castShadow = false; return m;
}

// frente de roca: plano desplazado por ruido hacia la sala (dir: -1 mira a -z, 1 a +z); libre(x,y) 0..1 aplana junto a puertas
function frenteRoca(xC, yC, ancho, alto, z, dir, libre, hueco = () => false) {
  const geo = new THREE.PlaneGeometry(ancho, alto, Math.round(ancho * 2), Math.round(alto * 2));
  if (dir < 0) geo.rotateY(Math.PI);
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i) + yC;
    p.setXYZ(i, xC + x, y, z + dir * (fbm(x * 0.4, y * 0.4, z * 0.1 + 7.7, 3) * 0.55 + 0.05) * libre(x, y)); uv.setXY(i, x / 3.2, y / 3.2);
  }
  if (hueco) {
    const ix = geo.index.array, nuevo = [];
    for (let t = 0; t < ix.length; t += 3) { const cx = (p.getX(ix[t]) + p.getX(ix[t + 1]) + p.getX(ix[t + 2])) / 3 - xC, cy = (p.getY(ix[t]) + p.getY(ix[t + 1]) + p.getY(ix[t + 2])) / 3; if (!hueco(cx, cy)) nuevo.push(ix[t], ix[t + 1], ix[t + 2]); }
    geo.setIndex(nuevo);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, matRoca()); m.receiveShadow = true; return m;
}

// piso de roca y barro con lomas suaves (≤ 7 cm, para no separarse de la física plana)
function piso(x0, x1, z0, z1, y) {
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, Math.round((x1 - x0) * 2), Math.round((z1 - z0) * 2)); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + (x0 + x1) / 2, z = p.getZ(i) + (z0 + z1) / 2;
    p.setXYZ(i, x, y + 0.015 + fbm(x * 0.6, 3.3, z * 0.6, 2) * 0.07 * Math.min(1, Math.abs(x) / 1.2 + 0.25), z); uv.setXY(i, x / 2.5, z / 2.5);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, matBarro()); m.receiveShadow = true; return m;
}

// ---------------------------------------------------------------- marcos de entibación (instanciados: pocas llamadas de dibujo)
function marcos(g, lista) {   // lista: [{ x, y, z, hw, alto, techo, giro }] (giro: 0 = galería a lo largo de z; π/2 = a lo largo de x)
  const md = matMadera(), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(), P = new THREE.Vector3();
  const piezas = { poste: [], somb: [], cuna: [], punt: [] };
  for (const f of lista) {
    const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), f.giro || 0);
    const at = (lx, ly, lz) => new THREE.Vector3(lx, ly, lz).applyQuaternion(rot).add(new THREE.Vector3(f.x, f.y, f.z));
    for (const s of [-1, 1]) {   // postes un poco inclinados hacia adentro (como se plantaban), hundidos 20 cm en el piso
      piezas.poste.push([at(s * (f.hw - 0.08), f.alto / 2 - 0.1, 0), new THREE.Euler(0, f.giro || 0, s * 0.045), [1, f.alto + 0.2, 1]]);
      piezas.cuna.push([at(s * (f.hw + 0.12), f.alto + 0.06, 0), new THREE.Euler(0, f.giro || 0, s * 0.3), [0.34, 0.12, 0.22]]);   // cuñas entre sombrero y roca
      piezas.cuna.push([at(s * (f.hw - 0.02), f.alto - 0.2, 0.17), new THREE.Euler(0, f.giro || 0, 0), [0.12, 0.3, 0.1]]);       // calzo del destaje
    }
    piezas.somb.push([at(0, f.alto + 0.06, 0), new THREE.Euler(0, f.giro || 0, 0), [2 * f.hw + 0.5, 0.3, 0.32]]);
    if (f.techo - f.alto > 0.5) for (const lx of [-f.hw * 0.5, 0, f.hw * 0.5]) {   // puntales de encastillado del sombrero a la roca
      const yTop = f.techo * (1 - (lx / (f.hw + 0.6)) ** 2 * 0.6) + 0.45, l = yTop - (f.alto + 0.2);
      piezas.punt.push([at(lx, f.alto + 0.2 + l / 2, 0), new THREE.Euler(0, 0, 0), [1, l, 1]]);
      piezas.cuna.push([at(lx, f.alto + 0.25, 0), new THREE.Euler(0, f.giro || 0, 0), [0.3, 0.1, 0.26]]);
    }
  }
  const geos = { poste: new THREE.CylinderGeometry(0.14, 0.16, 1, 7), somb: new THREE.BoxGeometry(1, 1, 1), cuna: new THREE.BoxGeometry(1, 1, 1), punt: new THREE.CylinderGeometry(0.09, 0.1, 1, 6) };
  for (const [k, arr] of Object.entries(piezas)) {
    if (!arr.length) continue;
    const im = new THREE.InstancedMesh(geos[k], md, arr.length);
    arr.forEach(([p, e, s], i) => im.setMatrixAt(i, M4.compose(P.copy(p), Q.setFromEuler(E.copy(e)), S.set(...s))));
    im.castShadow = false; im.receiveShadow = true; g.add(im);
  }
}

// cable o manguera que cuelga en catenaria entre puntos de apoyo
function colgante(g, apoyos, r, color, comba) {
  const pts = [];
  for (let i = 0; i < apoyos.length; i++) {
    pts.push(new THREE.Vector3(...apoyos[i]));
    if (i < apoyos.length - 1) { const a = apoyos[i], b = apoyos[i + 1]; pts.push(new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - comba, (a[2] + b[2]) / 2)); }
  }
  const curva = new THREE.CatmullRomCurve3(pts), m = new THREE.Mesh(new THREE.TubeGeometry(curva, pts.length * 4, r, 5, false), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
  m.castShadow = false; g.add(m);
}

// polvo en suspensión que flota despacio y brilla con la luz de las lámparas
function polvo(g, cajas) {
  const pp = []; let sem = 31; const az = () => ((sem = (sem * 16807) % 2147483647) / 2147483647);
  for (const [x0, x1, y0, y1, z0, z1, n] of cajas) for (let i = 0; i < n; i++) pp.push(x0 + az() * (x1 - x0), y0 + az() * (y1 - y0), z0 + az() * (z1 - z0));
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
  // shader propio: punto de 1-2 px, tenue, que se apaga a menos de 3 m de la cámara (antes manchas blancas frente a la cámara)
  const m = new THREE.ShaderMaterial({ uniforms: { t: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float t; varying float vA;
      void main() { vec3 p = position + vec3(sin(t * 0.11 + position.z) * 0.3, sin(t * 0.17 + position.x) * 0.15, cos(t * 0.07 + position.y) * 0.3);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); float d = -mv.z; vA = smoothstep(3.0, 5.0, d) * (1.0 - smoothstep(14.0, 22.0, d));
        gl_PointSize = clamp(60.0 / d, 1.0, 2.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA; void main() { if (vA < 0.01) discard; gl_FragColor = vec4(vec3(1.0, 0.85, 0.62) * 0.22 * vA, 1.0); }` });
  const p = new THREE.Points(geo, m);
  p.onBeforeRender = () => { m.uniforms.t.value = performance.now() / 1000; };
  p.frustumCulled = false; g.add(p);
}

// ---------------------------------------------------------------- túnel de la vía (N1-FORTUNA-TUNEL / TUNEL2)
// Boca en zM (frente de roca), el túnel sigue 13,5 m hacia s (+1: hacia +z, -1: hacia -z) a la altura y: tubo de roca abocinado
// en la boca, piso, capas de oscuridad progresiva (0,65^5 ≈ 11 % al fondo) y fondo negro. Devuelve los marcos (el de la boca
// sin puntales), la lámpara del poste (lado lp: -1 izquierda, 1 derecha en x) y el farol del 2.º marco (fuera del gálibo).
// La física la cierra lo que haya detrás del frente (roca maciza soloFis o el muro del fondo): Nato llega a la boca y no entra.
export const TUNEL = { hw: 1.55, alto: 2.25, arco: 0.85, largo: 13.5 };
function tunelVia(g, O, y, zM, s, lp, semilla) {
  const an = [];
  for (let t = -0.2; t < TUNEL.largo; t += 0.8) { const ab = Math.max(0, 0.9 - (t + 0.2)) / 0.9; an.push({ c: [O.x + Math.sin((t + 0.2) * 0.25) * 0.15 * (1 - ab), y, O.z + zM + s * t], hw: 1.7 + 0.25 * ab, yw: 2.3, yr: 3.25 + 0.3 * ab }); }
  g.add(galeria(an, [0, s], { semilla }));
  const za = O.z + zM - s * 0.2, zb = O.z + zM + s * TUNEL.largo; g.add(piso(O.x - 1.8, O.x + 1.8, Math.min(za, zb), Math.max(za, zb), y));
  for (let k = 0; k < 5; k++) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.4), new THREE.MeshBasicMaterial({ color: 0x020101, transparent: true, opacity: 0.35, depthWrite: false }));
    c.position.set(O.x, y + 1.8, O.z + zM + s * (6 + k * 1.6)); g.add(c);
  }
  const f = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.4), new THREE.MeshBasicMaterial({ color: 0x020101 })); f.position.set(O.x, y + 1.8, O.z + zM + s * (TUNEL.largo - 0.3)); f.userData.tapaTunel = true; g.add(f);   // tapaTunel: el paseo en vagoneta la oculta mientras viaja (paseoVagoneta.js)
  return {
    marcos: [-0.35, 2.6, 5.4, 8.2].map(dz => ({ x: O.x, y, z: O.z + zM + s * dz, hw: 1.45, alto: 2.45, techo: dz < 0 ? 2.7 : 3.1 })),
    lamp: { p: [O.x + lp * 1.12, y + 1.9, O.z + zM - s * 0.55], yaw: s > 0 ? Math.PI : 0 },
    farol: { p: [O.x - lp * 0.95, y + 2.45 - 0.09 - 0.28 - 0.25, O.z + zM + s * 2.62], cuerda: 0.25 } };
}
const huecoTunel = y => (cx, cy) => Math.abs(cx) < TUNEL.hw && cy < y + TUNEL.alto + TUNEL.arco * Math.sqrt(Math.max(0, 1 - (cx / TUNEL.hw) ** 2)) && cy > y - 1;
const planoTunel = y => (x, yy) => Math.max(0, (Math.abs(x) - 1.9) / 0.7) + Math.max(0, (yy - y - 3.4) / 0.6);

// ---------------------------------------------------------------- la mina completa
// S: definición de la sala, g: grupo, fis: física, O: origen de la sala. Devuelve datos para las lámparas.
export function vestirMina(S, g, fis, O) {
  const W = S.ancho, L = S.largo, hw = W / 2, yF5 = -8, zBaja = S.pisoHasta;   // Fortuna 5 empieza donde termina el piso de Fortuna 4
  const zCam = zBaja - 12.5;   // fin de la cámara alta de la escalera; desde ahí Fortuna 5 tiene su propio techo
  const F4 = { yw: 3.8, yr: 5.5 }, F5 = { yw: 3.8, yr: 5.5 };   // ≥ 4,5 m libres sobre el piso para la cámara (pedido de Diego)
  // anillos cada 0,7 m más dos pares en los cambios de piso y de techo (cortes netos)
  const zs = [];
  for (let z = 0.3; z > -L - 0.4; z -= 0.7) if (Math.abs(z - zBaja) > 0.35 && Math.abs(z - zCam) > 0.9) zs.push(z);
  zs.push(zBaja + 0.1, zBaja - 0.1, zCam + 0.6, zCam - 0.6); zs.sort((a, b) => b - a);
  const huecos = [{ lado: 1, z: -28, y: 0 }, { lado: -1, z: -62.5, y: yF5 }];   // bocas de las galerías laterales ciegas
  const anillos = zs.map(z => {
    const baja = z < zBaja, cam = z > zCam;
    return baja && !cam ? { c: [O.x, yF5, O.z + z], hw, ...F5 } : baja ? { c: [O.x, yF5, O.z + z], hw, yw: F4.yw + 8, yr: F4.yr + 8, tope: 0.3 } : { c: [O.x, 0, O.z + z], hw, ...F4, tope: 0.3 };
  });
  // caja negra que envuelve toda la mina: si queda una rendija entre piezas de roca, se ve negro y no el exterior
  const cas = new THREE.Mesh(new THREE.BoxGeometry(W + 32, 40, L + 8 + 2 * TUNEL.largo), new THREE.MeshBasicMaterial({ color: 0x020202, side: THREE.BackSide }));
  cas.position.set(O.x, -2, O.z - L / 2); cas.userData.cajaNegra = true; g.add(cas);   // (+ el largo del túnel del fondo, que queda detrás del muro)
  g.add(galeria(anillos, [0, -1], { semilla: 3, hueco: (x, z, px, py) => huecos.some(h => { const dz = Math.abs(z - (O.z + h.z)); return Math.sign(px) === h.lado && Math.abs(px) > hw - 0.5 && dz < 1.5 && py < 2.0 + 1.3 * Math.sqrt(1 - (dz / 1.5) ** 2); }) }));   // N1-M9: vano del alto de la galería ciega (antes 2 m: la galería asomaba 1,5 m como un «arco» suelto)
  // galerías laterales ciegas: 11 m de roca que se pierden en la oscuridad (la física del muro sigue cerrando el paso)
  for (const h of huecos) {
    const an = [];
    for (let s = -0.7; s < 11; s += 0.8) { const ab = Math.max(0, 0.9 - s) / 1.6; an.push({ c: [O.x + h.lado * (hw + s), h.y, O.z + h.z + Math.sin(s * 0.3) * 0.4 * h.lado * (1 - ab)], hw: 1.6 - s * 0.03 + 0.25 * ab, yw: 2.4 - s * 0.03, yr: 3.4 - s * 0.06 + 0.35 * ab }); }   // N1-M9: empieza en el muro (antes 1,5 m dentro de la galería principal) y se abre un poco en la boca
    g.add(galeria(an, [h.lado, 0], { semilla: 11 + h.lado }));
    const fondo = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.2), new THREE.MeshBasicMaterial({ color: 0x030202 }));
    fondo.position.set(O.x + h.lado * (hw + 10.6), h.y + 1.5, O.z + h.z); fondo.rotation.y = -h.lado * Math.PI / 2; g.add(fondo);
  }
  // frentes de roca irregular: bajo el borde de Fortuna 4 (costura con la cámara de la escalera) y delante de los dos muros
  // de los extremos (antes cajas planas con la textura de adoquín); con hueco para las puertas
  const puerta = (xp, yp) => (x, y) => Math.abs(x - xp) < 1.35 && y > yp - 0.5 && y < yp + 3.85;
  // N1-FORTUNA-TUNEL: la escalera va a un costado (x de la rampa) y la vía de Fortuna 5 sigue recta y entra en un túnel bajo
  // Fortuna 4; el frente de roca se aplana junto a la escalera y a la boca, y tiene el hueco en arco de la boca
  const ra = S.elementos.find(e => e.t === 'rampa'), xEsc = ra ? ra.x : 0;
  g.add(frenteRoca(O.x, -4.25, W + 3, 8.4, O.z + zBaja - 0.08, -1,
    (x, y) => Math.min(1, Math.max(0, (Math.abs(x - xEsc) - 1.9) / 0.8) + Math.max(0, (-y - 1.6) / 0.8), planoTunel(yF5)(x, y)), huecoTunel(yF5)));
  const tuneles = [tunelVia(g, O, yF5, zBaja, 1, -1, 23)];   // túnel bajo Fortuna 4 (las vagonetas se pierden en él)
  // N1-FORTUNA-TUNEL2: la puerta de salida va a un costado del muro del fondo y la vía entra ahí en un segundo túnel (de donde
  // salen las vagonetas); el muro del fondo de construirSala ya no se dibuja en la mina (su física cierra el túnel)
  if (S.tunelFondo) tuneles.push(tunelVia(g, O, yF5, -L, -1, 1, 37));
  g.add(frenteRoca(O.x, 2.7, W + 2, 6.6, O.z - 0.06, -1, (x, y) => Math.min(1, Math.max(0, (Math.abs(x - (S.entrada.x || 0)) - 2.0) / 0.7) + Math.max(0, (y - 4.3) / 0.6)), puerta(S.entrada.x || 0, S.entrada.y || 0)));
  if (S.salida) { const pS = puerta(S.salida.x, S.salida.y), hT = S.tunelFondo ? huecoTunel(yF5) : () => false;
    g.add(frenteRoca(O.x, yF5 + 2.8, W + 2, 6.4, O.z - L + 0.1, 1, (x, y) => Math.min(1, Math.max(0, (Math.abs(x - S.salida.x) - 2.0) / 0.7) + Math.max(0, (y - S.salida.y - 4.3) / 0.6), S.tunelFondo ? planoTunel(yF5)(x, y) : 1), (x, y) => pS(x, y) || hT(x, y))); }
  // pisos de roca y barro (Fortuna 4 arriba, Fortuna 5 abajo con la cámara de la escalera)
  g.add(piso(O.x - hw, O.x + hw, O.z + zBaja, O.z, 0)); g.add(piso(O.x - hw, O.x + hw, O.z - L, O.z + zBaja, yF5));
  for (const h of huecos) g.add(piso(O.x + (h.lado > 0 ? hw - 0.3 : -hw - 10.5), O.x + (h.lado > 0 ? hw + 10.5 : -hw + 0.3), O.z + h.z - 2.2, O.z + h.z + 2.2, h.y));
  // techo invisible a la altura de la clave: la cámara en tercera persona choca con él y no se sale por encima de la roca
  fis.caja(O.x, F4.yr + 0.35, O.z + zBaja / 2, W, 0.5, -zBaja, 0, { tipo: 'techo' });
  fis.caja(O.x, yF5 + F5.yr + 0.35, O.z + (zCam - 1 - L) / 2, W, 0.5, L + zCam - 1, 0, { tipo: 'techo' });
  // marcos de entibación cada 2,5 m (no en las bocas de las galerías ciegas: ahí va un marco propio, girado)
  const lista = [], enHueco = (z, y) => huecos.some(h => h.y === y && Math.abs(z - h.z) < 1.9);
  for (let z = -2.5; z > zBaja + 1; z -= 2.5) if (!enHueco(z, 0)) lista.push({ x: O.x, y: 0, z: O.z + z, hw: hw - 0.55, alto: 4.4, techo: F4.yr - 0.1 });
  for (let z = zCam - 2; z > -L + 1.5; z -= 2.5) if (!enHueco(z, yF5)) lista.push({ x: O.x, y: yF5, z: O.z + z, hw: hw - 0.55, alto: 4.4, techo: F5.yr - 0.1 });
  for (const h of huecos) for (const s of [0.4, 2.4]) lista.push({ x: O.x + h.lado * (hw + s), y: h.y, z: O.z + h.z, hw: 1.35, alto: 2.15, techo: 3.0, giro: Math.PI / 2 });
  marcos(g, [...lista, ...tuneles.flatMap(t => t.marcos)]);   // + marcos de las bocas de los túneles
  // cables eléctricos y manguera de aire comprimido por el muro derecho, colgados de los postes
  for (const [y, zA, zB] of [[0, -1, zBaja + 0.5], [yF5, zCam - 1, -L + 1]]) {
    const ap = []; for (let z = zA; z > zB; z -= 2.5) ap.push(z);
    colgante(g, ap.map(z => [O.x + hw - 0.75, y + 3.55, O.z + z - 0.2]), 0.022, 0x161412, 0.22);
    colgante(g, ap.map(z => [O.x + hw - 0.7, y + 3.4, O.z + z - 0.2]), 0.018, 0x2a1d14, 0.3);
    colgante(g, ap.map(z => [O.x + hw - 0.62, y + 1.05, O.z + z - 0.2]), 0.055, 0x24221f, 0.12);   // manguera de aire
  }
  polvo(g, [[O.x - hw + 1, O.x + hw - 1, 0.3, 3.5, O.z + zBaja, O.z - 1, 110], [O.x - hw + 1, O.x + hw - 1, yF5 + 0.3, yF5 + 3.5, O.z - L + 1, O.z + zBaja, 90], [O.x - 3, O.x + 3, yF5 + 3, 3, O.z + zCam, O.z + zBaja, 40]]);
  // lámparas: una cada dos marcos, alternando el muro, clavadas en la cara interior del poste; en la escalera y junto a las puertas
  const lamps = [];
  lista.filter(f => !f.giro).forEach((f, i) => { if (i % 2) return; const s = (i / 2) % 2 ? 1 : -1; lamps.push({ p: [f.x + s * (f.hw - 0.3), f.y + 2.0, f.z + 0.05], yaw: -s * Math.PI / 2 }); });
  for (const t of tuneles) lamps.push(t.lamp);   // lámpara en un poste de cada boca de túnel
  if (ra) {
    lamps.push({ p: [O.x + ra.x - 2.94, ra.y0 + 1.2, O.z + ra.z0 - 0.02], yaw: Math.PI });                                    // arriba, en la baranda del borde
    lamps.push({ p: [O.x + ra.x - (ra.ancho / 2 + 0.16), (ra.y0 + ra.y1) / 2 + 1.25, O.z + (ra.z0 + ra.z1) / 2], yaw: Math.PI / 2 });   // a media escalera
    lamps.push({ p: [O.x + ra.x + (ra.ancho / 2 + 0.16), ra.y1 + 1.0, O.z + ra.z1 + 0.05], yaw: -Math.PI / 2 });              // abajo
  }
  for (const pu of [S.entrada, S.salida].filter(Boolean)) {
    const y0 = pu.y || 0, alFondo = pu.z < -L + 3, zf = alFondo ? -L + 0.45 : -0.45;
    for (const dx of [-2.25, 2.25]) {   // si cae dentro de la roca del muro lateral (puerta a un costado), va en la cara del machón
      const x = pu.x + dx, adentro = Math.abs(x) > hw - 0.4, xl = adentro ? pu.x + Math.sign(dx) * 1.55 : x, zl = adentro ? (alFondo ? -L + 1.22 : -1.22) : zf;
      lamps.push({ p: [O.x + xl, y0 + 2.2, O.z + zl], yaw: alFondo ? 0 : Math.PI });
    }
  }
  if (S.salida && S.tunelFondo) {   // N1-FORTUNA-TUNEL2: tabla pintada «SALIDA» clavada sobre la puerta del fondo (de época: letras a pincel)
    const c = document.createElement('canvas'); c.width = 256; c.height = 72; const x = c.getContext('2d');
    x.fillStyle = '#b89668'; x.fillRect(0, 0, 256, 72); x.strokeStyle = 'rgba(70,45,20,0.35)'; x.lineWidth = 2;
    for (let i = 0; i < 9; i++) { x.beginPath(); x.moveTo(0, 6 + i * 7 + Math.sin(i) * 2); x.bezierCurveTo(80, 2 + i * 7, 170, 10 + i * 7, 256, 5 + i * 7); x.stroke(); }
    x.fillStyle = '#2a170a'; x.font = 'bold 46px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('SALIDA', 128, 39);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const tabla = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 0.05), [matMadera(), matMadera(), matMadera(), matMadera(), new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }), matMadera()]);
    tabla.position.set(O.x + S.salida.x, (S.salida.y || 0) + 3.78, O.z - L + 1.17); tabla.rotation.z = 0.025; g.add(tabla);
  }
  // N1-FORTUNA-LUZ: faroles de parafina colgados de una cadena al sombrero de cada marco que no tiene lámpara, del lado contrario
  // a la lámpara anterior (luz para el centro, el techo entibado y los rieles); la base del sombrero queda a alto - 0,09
  const faroles = [];
  lista.filter(f => !f.giro).forEach((f, i) => { if (!(i % 2)) return; const s = ((i - 1) / 2) % 2 ? -1 : 1; faroles.push({ p: [f.x + s * 2.3, f.y + f.alto - 0.09 - 0.28 - 0.38, f.z + 0.02], cuerda: 0.38 }); });
  for (const t of tuneles) faroles.push(t.farol);   // farol dentro de cada túnel
  lamparasMina(g, lamps, faroles, [O.x - hw - 12, yF5 - 1.5, O.z - L - TUNEL.largo - 1, O.x + hw + 12, 6.5, O.z + 1.5]);
  return { lista, lamps, faroles };
}

// ---------------------------------------------------------------- escalera de El Fraile (N1-M5)
// Peldaños de madera gastada sobre dos largueros, baranda de madera a los dos lados y descansos arriba y abajo.
// La física sigue siendo la rampa invisible de construirSala (a → b); aquí van las barandas sólidas para no caer por los lados
// y una baranda al borde de Fortuna 4 (antes se podía caer 8 m fuera de la escalera, N1-M8).
export function escaleraMina(g, fis, a, b, ancho, q, O, hw) {
  const md = matMadera(), d = b.clone().sub(a), largo = d.length(), caida = a.y - b.y, sz = Math.sign(d.z);
  const n = Math.round(caida / 0.2), paso = Math.abs(d.z) / n, M4 = new THREE.Matrix4(), Q0 = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1);
  const enLinea = t => a.clone().addScaledVector(d, t);
  // peldaños: tablón horizontal cuyo centro queda sobre la línea de la rampa, con un poco de desorden y color distinto cada uno
  const pel = new THREE.InstancedMesh(new THREE.BoxGeometry(ancho - 0.2, 0.07, paso + 0.06), md, n), col = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const p = enLinea((i + 0.5) / n), r = hash3(i, 7, 3);
    pel.setMatrixAt(i, M4.compose(V.set(p.x + (r - 0.5) * 0.06, p.y - 0.035, p.z), Q0.setFromEuler(new THREE.Euler(0, (r - 0.5) * 0.05, (hash3(i, 2, 9) - 0.5) * 0.03)), S));
    pel.setColorAt(i, col.setScalar(0.75 + r * 0.35));
  }
  pel.receiveShadow = true; g.add(pel);
  // largueros bajo los peldaños, a lo largo de la pendiente
  const giro = new THREE.Quaternion().copy(q), up = new THREE.Vector3(0, 1, 0).applyQuaternion(giro), lat = new THREE.Vector3(1, 0, 0).applyQuaternion(giro);
  const viga = (x, h, alto, grueso) => { const m = new THREE.Mesh(new THREE.BoxGeometry(grueso, alto, largo + 0.4), md); m.quaternion.copy(giro); m.position.copy(enLinea(0.5)).addScaledVector(lat, x).addScaledVector(up, h); g.add(m); return m; };
  for (const s of [-1, 1]) viga(s * (ancho / 2 - 0.12), -0.22, 0.34, 0.14);
  // baranda: pies derechos cada ~1,3 m, pasamanos y travesaño a media altura, a ambos lados; física de muro a lo largo
  const nP = Math.ceil(largo / 1.3), pies = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 1.15, 0.1), md, 2 * (nP + 1)); let k = 0;
  for (const s of [-1, 1]) {
    for (let i = 0; i <= nP; i++) { const p = enLinea(i / nP); pies.setMatrixAt(k++, M4.compose(V.set(p.x + s * (ancho / 2 + 0.04), p.y + 0.45, p.z), Q0.identity(), S)); }
    viga(s * (ancho / 2 + 0.04), 0.8, 0.09, 0.12); viga(s * (ancho / 2 + 0.04), 0.4, 0.07, 0.06);   // a 0,8 m perpendicular a la pendiente = ~1 m en vertical
    const c = enLinea(0.5).addScaledVector(lat, s * (ancho / 2 + 0.06)).addScaledVector(up, 0.6);
    fis.caja(c.x, c.y, c.z, 0.14, 1.3, largo, 0, { tipo: 'muro' }, { x: q.x, y: q.y, z: q.z, w: q.w });
  }
  g.add(pies);
  // descansos de tablas arriba (en el borde de Fortuna 4) y abajo (en Fortuna 5)
  for (const [p, z0, z1] of [[a, 0, -sz * 1.3], [b, 0, sz * 1.6]]) {
    const zc = p.z + (z0 + z1) / 2, lz = Math.abs(z1 - z0), nt = Math.round(lz / 0.3);
    for (let i = 0; i < nt; i++) { const t = new THREE.Mesh(new THREE.BoxGeometry(ancho + 0.3, 0.06, lz / nt - 0.02), md); t.position.set(p.x, p.y + 0.03, zc - lz / 2 + (i + 0.5) * lz / nt); t.receiveShadow = true; g.add(t); }
  }
  // baranda al borde de Fortuna 4, a los dos lados de la escalera (con física)
  for (const s of [-1, 1]) {
    const x0 = a.x + s * (ancho / 2 + 0.04), x1 = O.x + s * (hw + 0.3), xc = (x0 + x1) / 2, lx = Math.abs(x1 - x0), zb = a.z + sz * 0.1;
    for (const [h, alto] of [[1.0, 0.09], [0.5, 0.07]]) { const r = new THREE.Mesh(new THREE.BoxGeometry(lx, alto, 0.1), md); r.position.set(xc, a.y + h, zb); g.add(r); }
    for (let i = 0; i <= Math.ceil(lx / 1.4); i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.1, 0.11), md); p.position.set(x0 + s * Math.min(lx, i * 1.4), a.y + 0.55, zb); g.add(p); }
    fis.caja(xc, a.y + 0.65, zb, lx, 1.3, 0.16, 0, { tipo: 'muro' });
  }
}

// ---------------------------------------------------------------- luz de la mina (N1-C51 + N1-FORTUNA-LUZ, 15-11-2026)
// Antes: solo 4 PointLight que saltaban a las 4 lámparas más cercanas a la cámara → todo lo demás quedaba casi negro y la luz
// «aparecía conforme avanzaba» Nato. Ahora:
//  · luz horneada: al construir se calcula un volumen 3D (celdas de 0,5 m) con la luz de TODAS las lámparas y faroles
//    (caída suave 1/(1+d²/r²), corte a 14 m) y cada material de la mina lo lee como luz difusa extra (una lectura de textura,
//    se toma 0,45 m hacia afuera de la superficie: lo que mira a la llama recibe más). Toda la galería visible ya está iluminada.
//  · faroles de parafina colgados del sombrero de los marcos que no tienen lámpara (más luz en el techo, los rieles y el centro).
//  · 4 PointLight dinámicas cerca de la cámara solo para el brillo de la roca húmeda y el relieve; se funden por distancia
//    (sin saltos al cambiar de lámpara).
//  · llama y halo en sprites aditivos; vidrio del farol emisivo.
const LUZ = { K: 7, base: 0.08, r0: 1.45, corte: 14, celda: 0.5, col: new THREE.Color(1.0, 0.7, 0.42) };
const U = { uMinaLuz: { value: null }, uMinaMin: { value: new THREE.Vector3() }, uMinaTam: { value: new THREE.Vector3(1, 1, 1) }, uMinaCol: { value: new THREE.Color() }, uMinaBase: { value: 0 } };
function volumenLuz(fuentes, caja) {   // fuentes: [{ p: Vector3, k }], caja: [x0, y0, z0, x1, y1, z1]
  const [x0, y0, z0, x1, y1, z1] = caja, c = LUZ.celda, nx = Math.ceil((x1 - x0) / c) + 1, ny = Math.ceil((y1 - y0) / c) + 1, nz = Math.ceil((z1 - z0) / c) + 1;
  const v = new Float32Array(nx * ny * nz), R = LUZ.corte, r2 = LUZ.r0 * LUZ.r0;
  for (const f of fuentes) {
    const i0 = Math.max(0, Math.floor((f.p.x - R - x0) / c)), i1 = Math.min(nx - 1, Math.ceil((f.p.x + R - x0) / c));
    const j0 = Math.max(0, Math.floor((f.p.y - R - y0) / c)), j1 = Math.min(ny - 1, Math.ceil((f.p.y + R - y0) / c));
    const k0 = Math.max(0, Math.floor((f.p.z - R - z0) / c)), k1 = Math.min(nz - 1, Math.ceil((f.p.z + R - z0) / c));
    for (let k = k0; k <= k1; k++) { const dz = z0 + k * c - f.p.z;
      for (let j = j0; j <= j1; j++) { const dy = y0 + j * c - f.p.y, dyz = dy * dy + dz * dz; if (dyz > R * R) continue;
        for (let i = i0; i <= i1; i++) { const dx = x0 + i * c - f.p.x, d2 = Math.max(0.8, dx * dx + dyz); if (d2 > R * R) continue;
          const d = Math.sqrt(d2), w = 1 - Math.min(1, Math.max(0, (d - R * 0.55) / (R * 0.45)));
          v[(k * ny + j) * nx + i] += f.k * w * w * (3 - 2 * w) / (1 + d2 / r2); } } }
  }
  const h = new Uint16Array(v.length); for (let i = 0; i < v.length; i++) h[i] = THREE.DataUtils.toHalfFloat(v[i]);
  const t = new THREE.Data3DTexture(h, nx, ny, nz); t.format = THREE.RedFormat; t.type = THREE.HalfFloatType;
  t.minFilter = t.magFilter = THREE.LinearFilter; t.wrapS = t.wrapT = t.wrapR = THREE.ClampToEdgeWrapping; t.unpackAlignment = 1; t.needsUpdate = true;
  U.uMinaLuz.value = t; U.uMinaMin.value.set(x0, y0, z0); U.uMinaTam.value.set((nx - 1) * c, (ny - 1) * c, (nz - 1) * c);
  U.uMinaCol.value.copy(LUZ.col).multiplyScalar(LUZ.K); U.uMinaBase.value = LUZ.base / LUZ.K;
}
// agrega la lectura del volumen a un material con luz (Standard, Physical, Lambert, Phong); fuera de la caja de la mina no suma nada
const PROTO_KEY = THREE.Material.prototype.customProgramCacheKey;
function conLuzMina(m) {
  if (!m || m.userData.minaLuz || !(m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial)) return;
  m.userData.minaLuz = true;
  const antes = m.onBeforeCompile, kf = m.customProgramCacheKey, clave = (kf === PROTO_KEY ? antes.toString() : kf.call(m)) + '|minaLuz';
  m.onBeforeCompile = (sh, r) => {
    antes.call(m, sh, r); Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMinaW;').replace('#include <project_vertex>', `#include <project_vertex>
      vec4 mnW = vec4( transformed, 1.0 );
      #ifdef USE_BATCHING
        mnW = batchingMatrix * mnW;
      #endif
      #ifdef USE_INSTANCING
        mnW = instanceMatrix * mnW;
      #endif
      vMinaW = ( modelMatrix * mnW ).xyz;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vMinaW; uniform highp sampler3D uMinaLuz; uniform vec3 uMinaMin, uMinaTam, uMinaCol; uniform float uMinaBase;')
      .replace('#include <lights_fragment_end>', `{ vec3 qM = ( vMinaW + inverseTransformDirection( normal, viewMatrix ) * 0.45 - uMinaMin ) / uMinaTam;
        if ( all( greaterThan( qM, vec3( 0.0 ) ) ) && all( lessThan( qM, vec3( 1.0 ) ) ) ) irradiance += uMinaCol * ( texture( uMinaLuz, qM ).r + uMinaBase ); }
      #include <lights_fragment_end>`);
  };
  m.customProgramCacheKey = () => clave; m.needsUpdate = true;
}

let texLlama = null;
function spriteRadial() {
  if (texLlama) return texLlama;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,235,1)'); gr.addColorStop(0.25, 'rgba(255,214,120,0.9)'); gr.addColorStop(0.6, 'rgba(255,130,30,0.35)'); gr.addColorStop(1, 'rgba(255,90,0,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64); texLlama = new THREE.CanvasTexture(c); texLlama.colorSpace = THREE.SRGBColorSpace; return texLlama;
}
function instanciar(g, partes, lista, rotDe) {   // partes: [geo, material, [ox, oy, oz]] en el marco de cada pieza
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), Uu = new THREE.Vector3(1, 1, 1);
  for (const [geo, m, o] of partes) {
    const im = new THREE.InstancedMesh(geo, m, lista.length);
    lista.forEach((l, i) => { rotDe(l, Q); V.set(...o).applyQuaternion(Q).add(new THREE.Vector3(...l.p)); im.setMatrixAt(i, M4.compose(V, Q, Uu)); });
    im.castShadow = false; g.add(im);
  }
}
// lamps: velas en palmatoria (1905; antes lámparas de carburo) [{ p, yaw }] clavadas en los postes; faroles: faroles de parafina [{ p, cuerda }] colgados del sombrero
// (p = centro del vidrio); caja: límites del volumen de luz [x0, y0, z0, x1, y1, z1]
export function lamparasMina(g, lamps, faroles = [], caja = null) {
  const laton = new THREE.MeshStandardMaterial({ color: 0xb08a3a, metalness: 0.8, roughness: 0.35 }), hierro = new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.7 });
  const Y = new THREE.Vector3(0, 1, 0);
  // N0-FABLE-1611b: en 1905 no hay carburo (el libro habla de velas y candiles): vela de sebo en palmatoria de fierro clavada al poste
  // (placa y brazo contra el muro en -z local, platillo con asa, vela de cera cruda con pabilo); la llama queda donde estaba (y + 0,17)
  const cera = new THREE.MeshStandardMaterial({ color: 0xd9c9a0, roughness: 0.9 });
  instanciar(g, [[new THREE.BoxGeometry(0.07, 0.13, 0.012), hierro, [0, 0.04, -0.035]], [new THREE.BoxGeometry(0.014, 0.014, 0.075), hierro, [0, -0.02, -0.0]],
    [new THREE.CylinderGeometry(0.055, 0.045, 0.016, 12), hierro, [0, 0, 0.035]], [new THREE.TorusGeometry(0.022, 0.005, 4, 10).rotateX(Math.PI / 2), hierro, [0, 0.0, 0.1]],
    [new THREE.CylinderGeometry(0.016, 0.019, 0.15, 8), cera, [0, 0.083, 0.035]], [new THREE.CylinderGeometry(0.003, 0.003, 0.02, 4), hierro, [0, 0.165, 0.035]]], lamps, (l, Q) => Q.setFromAxisAngle(Y, l.yaw));
  if (faroles.length) {   // farol de parafina de 1905: base y sombrerete de hierro, vidrio que brilla, cuatro varillas, asa y cadena al sombrero del marco
    const vidrio = new THREE.MeshStandardMaterial({ color: 0x3a2412, emissive: 0xffa64a, emissiveIntensity: 1.5, roughness: 0.2 });
    const P = [[new THREE.CylinderGeometry(0.075, 0.075, 0.2, 10), vidrio, [0, 0, 0]], [new THREE.CylinderGeometry(0.1, 0.1, 0.05, 10), hierro, [0, -0.125, 0]],
      [new THREE.ConeGeometry(0.11, 0.1, 10), hierro, [0, 0.15, 0]], [new THREE.TorusGeometry(0.045, 0.007, 4, 10), hierro, [0, 0.24, 0]]];
    for (const a of [0, 1, 2, 3]) P.push([new THREE.CylinderGeometry(0.008, 0.008, 0.22, 4), hierro, [Math.cos(a * Math.PI / 2 + 0.78) * 0.085, 0, Math.sin(a * Math.PI / 2 + 0.78) * 0.085]]);
    instanciar(g, P, faroles, (l, Q) => Q.identity());
    const cad = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.01, 0.01, 1, 4), hierro, faroles.length), M4 = new THREE.Matrix4();
    faroles.forEach((f, i) => cad.setMatrixAt(i, M4.compose(new THREE.Vector3(f.p[0], f.p[1] + 0.28 + f.cuerda / 2, f.p[2]), new THREE.Quaternion(), new THREE.Vector3(1, f.cuerda, 1))));
    cad.castShadow = false; g.add(cad);
  }
  const tex = spriteRadial(), llamas = [];
  const llama = (base, fw, fh, halo, op) => {
    const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffe0a0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    f.position.copy(base); f.scale.set(fw, fh, 1); g.add(f);
    const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xff9a40, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: op }));
    h.position.copy(base); h.scale.set(halo, halo, 1); g.add(h);
    llamas.push({ f, h, p: base, fw, fh, op, ph: hash3(base.x * 10, base.z * 10, 1) * 6.28 });
  };
  for (const l of lamps) llama(new THREE.Vector3(...l.p).add(new THREE.Vector3(0, 0.17, 0)).addScaledVector(new THREE.Vector3(Math.sin(l.yaw), 0, Math.cos(l.yaw)), 0.03), 0.07, 0.13, 1.05, 0.34);
  for (const f of faroles) llama(new THREE.Vector3(f.p[0], f.p[1] - 0.02, f.p[2]), 0.05, 0.1, 1.15, 0.3);
  // luz horneada de todas las llamas (las velas alumbran algo más que los faroles, por el valor k) y relleno en todo lo que esté en la mina
  if (caja) {
    volumenLuz([...lamps.map(l => ({ p: new THREE.Vector3(...l.p).add(new THREE.Vector3(Math.sin(l.yaw) * 0.25, 0.15, Math.cos(l.yaw) * 0.25)), k: 1 })), ...faroles.map(f => ({ p: new THREE.Vector3(...f.p), k: 0.85 }))], caja);
  }
  const luces = Array.from({ length: Math.min(4, llamas.length) }, () => { const L = new THREE.PointLight(0xffa24a, 0, 9, 1.8); L.castShadow = false; g.add(L); return L; });
  // controlador invisible: titileo de todas las llamas, las 4 luces en las llamas más cercanas (fundidas por distancia) y,
  // una vez por segundo, la luz horneada para los materiales de lo que esté dentro de la mina (sala, Nato, Sewell, NPC, vagonetas)
  const ctl = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  ctl.frustumCulled = false; g.add(ctl);
  let tRev = -1; const W = new THREE.Vector3();
  const dentro = o => { o.getWorldPosition(W); return caja && W.x > caja[0] - 2 && W.x < caja[3] + 2 && W.y > caja[1] - 2 && W.y < caja[4] + 4 && W.z > caja[2] - 2 && W.z < caja[5] + 2; };
  // TIRONES-MOVIL (17-11-2026): la revisión también la llama compilarSala (principal.js) ANTES de compilar: si no, el primer cuadro dentro
  // cambiaba los materiales y se recompilaba todo otra vez después de aclarar
  const revisar = s => { if (!caja) return; tRev = performance.now() / 1000; s.traverseVisible(o => { if ((o.isMesh || o.isSkinnedMesh) && !o.isSprite && (o.parent === g || dentro(o))) (Array.isArray(o.material) ? o.material : [o.material]).forEach(conLuzMina); }); };
  ctl.userData.luzMina = revisar;
  ctl.onBeforeRender = (r, s, cam) => {
    const t = performance.now() / 1000, c = cam.position;
    if (caja && t - tRev > 1) revisar(s);
    for (const l of llamas) { const k = 1 + 0.16 * Math.sin(t * 13 + l.ph) + 0.09 * Math.sin(t * 29 + l.ph * 2.3); l.f.scale.set(l.fw * (2 - k) * 0.95 + 0.0035, l.fh * k, 1); l.d = l.p.distanceTo(c); l.h.material.opacity = l.op * (0.8 + 0.2 * k) * Math.min(1, Math.max(0, (l.d - 1.2) / 2.5)); }   // el halo se apaga junto a la cámara (si no, tiñe toda la pantalla de naranjo)
    const cerca = llamas.slice().sort((a, b) => a.d - b.d), dCorte = cerca[luces.length] ? cerca[luces.length].d : 99;
    luces.forEach((L, i) => { const l = cerca[i]; L.position.copy(l.p).y += 0.05; const fun = Math.min(1, Math.max(0, (dCorte - l.d) / 2.5));
      L.intensity = 6 * fun * (0.88 + 0.12 * Math.sin(t * 11 + l.ph) * Math.sin(t * 7.3 + l.ph)); });
  };
}
