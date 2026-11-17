// N0-MUEBLES (carril muebles, 15-11-2026): muebles FINOS de época (Sewell 1905-1967) hechos en código, sin GPU.
// TRELLIS no puede con los barrotes finos (DECISIÓN 15-11 en RELEVO_utileria.md): camas de fierro, litera, cuna, sillas de
// barrotes y de Viena, quinqué, vela en palmatoria, banca de iglesia, perchero de pie y catre de 1905.
// - Geometría con tubos barridos de verdad (curvas con radio de doblado), torneados (Lathe), tablas con bisel y telas con caída.
// - Materiales PBR compartidos por TODOS los muebles (fierro pintado gastado, bronce, madera con veta procedural, tela, lana,
//   piel, loza, cera, vidrio, llama); el color de cada pieza va en colores de vértice → un mueble = 1 geometría con grupos.
// - LOD de 2 niveles (geo / geoL). Geometría y materiales en caché por tipo → se instancian (InstancedMesh) sin costo extra.
// API (la misma que espera utileria.js en PIEZA[id]): mueble(id, op) → { geo, geoL, lod, mat (arreglo), tam, tris }.
//   FINOS = ids disponibles. muebleGrupo(id, op, lod) → THREE.Group (para piezas sueltas o móviles).
// Marco local: pivote en el piso al centro, frente hacia +z (cama: cabecera en −z; cuna: largo en x, frente +z).
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const FINOS = ['cama', 'cama_blanca', 'litera', 'cuna', 'silla', 'silla_viena', 'quinque', 'vela', 'banca', 'perchero', 'catre'];
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ ruido periódico (texturas que se repiten sin costura)
function hash(i, j, s) { let h = (i * 374761393 + j * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function ruido(x, y, s, px, py) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const m = (a, p) => ((a % p) + p) % p, i0 = m(i, px), i1 = m(i + 1, px), j0 = m(j, py), j1 = m(j + 1, py);
  const a = hash(i0, j0, s), b = hash(i1, j0, s), c = hash(i0, j1, s), d = hash(i1, j1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// fbm periódico en [0,1)²: fx, fy = frecuencias base (enteras)
function fbm(u, v, fx, fy, s = 0, o = 4) { let t = 0, a = 0.5, n = 0; for (let k = 0; k < o; k++) { const f = 1 << k; t += a * ruido(u * fx * f, v * fy * f, s + k * 31, fx * f, fy * f); n += a; a *= 0.5; } return t / n; }
const clamp01 = x => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

function lienzo(n, fn, srgb = true) {
  const c = document.createElement('canvas'); c.width = c.height = n; const cx = c.getContext('2d'), im = cx.createImageData(n, n), d = im.data;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const r = fn(x / n, y / n), k = (y * n + x) * 4; d[k] = r[0] * 255; d[k + 1] = r[1] * 255; d[k + 2] = r[2] * 255; d[k + 3] = 255; }
  cx.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = true; return t;
}
const TEXS = {};
function texturas(nombre) {
  if (TEXS[nombre]) return TEXS[nombre];
  let fn, n = 512;
  if (nombre === 'madera') fn = (u, v) => {   // veta a lo largo de v: anillos ondulados + fibras + poros
    const w = fbm(u, v, 3, 1, 1, 4), anillo = 0.5 + 0.5 * Math.sin(2 * Math.PI * (u * 28 + 1.1 * w)), fibra = fbm(u, v, 96, 4, 7, 3), poro = fbm(u, v, 160, 10, 9, 2);
    const osc = Math.pow(anillo, 3) * 0.38 + (1 - fibra) * 0.26 + smooth(0.62, 0.8, poro) * 0.12, nudo = fbm(u, v, 4, 2, 13, 3);
    const t = clamp01(osc + smooth(0.72, 0.85, nudo) * 0.25);
    return [1 - t * 0.42, 0.96 - t * 0.47, 0.9 - t * 0.5];
  };
  else if (nombre === 'tela') fn = (u, v) => {   // tejido de sábana/colchón: hilos cruzados + irregularidad
    const N = 96, iu = Math.floor(u * N), iv = Math.floor(v * N), fu = u * N - iu, fv = v * N - iv, arriba = (iu + iv) % 2;
    const hilo = arriba ? Math.sin(Math.PI * fv) : Math.sin(Math.PI * fu), g = 0.82 + 0.13 * hilo + 0.1 * (fbm(u, v, 16, 16, 3, 3) - 0.5);
    return [g, g, g];
  };
  else if (nombre === 'lana') fn = (u, v) => {   // frazada de lana: tejido grueso, pelusa y franjas suaves
    const N = 48, iu = Math.floor(u * N), iv = Math.floor(v * N), fu = u * N - iu, fv = v * N - iv, arriba = (iu + iv) % 2;
    const hilo = arriba ? Math.sin(Math.PI * fv) : Math.sin(Math.PI * fu), pel = fbm(u, v, 64, 64, 5, 3), g = 0.74 + 0.16 * hilo + 0.22 * (pel - 0.5) + 0.06 * (fbm(u, v, 6, 6, 8, 2) - 0.5);
    return [g, g, g];
  };
  else if (nombre === 'pintura') fn = (u, v) => {   // esmalte gastado: manchas, saltaduras con óxido (más oscuras y rojizas)
    const m = fbm(u, v, 6, 6, 21, 5), salto = smooth(0.73, 0.76, fbm(u, v, 16, 16, 23, 4)) * smooth(0.45, 0.6, fbm(u, v, 3, 3, 27, 2)), g = 0.92 + 0.1 * (m - 0.5);
    return [g * (1 - salto) + 0.42 * salto, g * (1 - salto) + 0.36 * salto, g * (1 - salto) + 0.31 * salto];
  };
  else if (nombre === 'bronce') fn = (u, v) => { const m = fbm(u, v, 8, 8, 31, 4), p = smooth(0.68, 0.8, fbm(u, v, 5, 5, 33, 3)); const g = 0.88 + 0.16 * (m - 0.5); return [g * (1 - p * 0.3), g * (1 - p * 0.22), g * (1 - p * 0.25)]; };
  else if (nombre === 'piel') { n = 256; fn = (u, v) => {   // vellón de oveja: mechones rizados
    const r = fbm(u, v, 24, 24, 41, 4), m = 0.5 + 0.5 * Math.sin(2 * Math.PI * (r * 6)), g = 0.62 + 0.38 * m * (0.6 + 0.4 * fbm(u, v, 64, 64, 43, 2));
    return [g, g, g]; }; }
  else fn = () => [1, 1, 1];
  return (TEXS[nombre] = lienzo(n, fn));
}

// ------------------------------------------------------------------ materiales compartidos (colores en los vértices)
const ESC_UV = { pintura: 1 / 0.35, bronce: 1 / 0.08, madera: 1 / 0.7, tela: 1 / 0.3, lana: 1 / 0.45, piel: 1 / 0.3, loza: 1, cera: 1, vidrio: 1, llama: 1, oscuro: 1 };
const MATS = {};
export function materialFino(tipo) {
  if (MATS[tipo]) return MATS[tipo];
  let m;
  const base = { vertexColors: true };
  if (tipo === 'pintura') { const t = texturas('pintura'); m = new THREE.MeshStandardMaterial({ ...base, map: t, bumpMap: t, bumpScale: 0.6, roughness: 0.5, metalness: 0.2 }); }
  else if (tipo === 'bronce') { const t = texturas('bronce'); m = new THREE.MeshStandardMaterial({ ...base, map: t, roughness: 0.32, metalness: 0.55, emissive: 0x3a2a10, emissiveIntensity: 0.35 }); }   // sin mapa de entorno: un poco de brillo propio para que se lea dorado
  else if (tipo === 'madera') { const t = texturas('madera'); m = new THREE.MeshStandardMaterial({ ...base, map: t, bumpMap: t, bumpScale: 1.2, roughness: 0.58, metalness: 0 }); }
  else if (tipo === 'tela') { const t = texturas('tela'); m = new THREE.MeshStandardMaterial({ ...base, map: t, bumpMap: t, bumpScale: 0.8, roughness: 0.92, side: THREE.DoubleSide }); }
  else if (tipo === 'lana') { const t = texturas('lana'); m = new THREE.MeshStandardMaterial({ ...base, map: t, bumpMap: t, bumpScale: 1.5, roughness: 0.97, side: THREE.DoubleSide }); }
  else if (tipo === 'piel') { const t = texturas('piel'); m = new THREE.MeshStandardMaterial({ ...base, map: t, bumpMap: t, bumpScale: 4, roughness: 1, side: THREE.DoubleSide }); }
  else if (tipo === 'loza') m = new THREE.MeshStandardMaterial({ ...base, roughness: 0.22, metalness: 0 });
  else if (tipo === 'cera') m = new THREE.MeshStandardMaterial({ ...base, roughness: 0.55, emissive: 0x4a3010, emissiveIntensity: 0.5 });
  else if (tipo === 'vidrio') m = new THREE.MeshStandardMaterial({ ...base, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide });
  else if (tipo === 'llama') m = new THREE.MeshBasicMaterial({ ...base, toneMapped: false });
  else m = new THREE.MeshStandardMaterial({ ...base, roughness: 0.7 });   // 'oscuro': mecha, rueditas
  m.name = 'fino_' + tipo;
  return (MATS[tipo] = m);
}

// ------------------------------------------------------------------ geometrías base
// Barrido de una sección a lo largo de una polilínea densa (marcos de transporte paralelo). Sección redonda (lados = n) o plana
// (plano: true, aristas vivas, para madera escuadrada). esc = [sN, sB] estira la sección (tablas curvas); rFn(t) afina.
function barrido(pts, r, lados = 8, o = {}) {
  const n = pts.length, cerrado = !!o.cerrado, sN = o.esc ? o.esc[0] : 1, sB = o.esc ? o.esc[1] : 1, a0 = o.ang0 ?? (lados === 4 ? Math.PI / 4 : 0);
  const T = [], N = [], B = [], S = [0];
  for (let i = 0; i < n; i++) {
    const a = pts[cerrado ? (i - 1 + n) % n : Math.max(0, i - 1)], b = pts[cerrado ? (i + 1) % n : Math.min(n - 1, i + 1)];
    T.push(b.clone().sub(a).normalize()); if (i) S.push(S[i - 1] + pts[i].distanceTo(pts[i - 1]));
  }
  if (cerrado) S.push(S[n - 1] + pts[0].distanceTo(pts[n - 1]));
  let ref = o.normal ? o.normal.clone() : (Math.abs(T[0].y) < 0.9 ? V3(0, 1, 0) : V3(1, 0, 0));
  N.push(ref.sub(T[0].clone().multiplyScalar(ref.dot(T[0]))).normalize()); B.push(T[0].clone().cross(N[0]));
  const q = new THREE.Quaternion();
  for (let i = 1; i < n; i++) { q.setFromUnitVectors(T[i - 1], T[i]); const nn = N[i - 1].clone().applyQuaternion(q); nn.sub(T[i].clone().multiplyScalar(nn.dot(T[i]))).normalize(); N.push(nn); B.push(T[i].clone().cross(nn)); }
  const pos = [], nor = [], uv = [], idx = [];
  const anillos = cerrado ? n + 1 : n, per = 2 * Math.PI * r * (sN + sB) / 2;
  const plano = !!o.plano, K = plano ? lados * 2 : lados + 1;
  for (let ii = 0; ii < anillos; ii++) {
    const i = ii % n, t = S[ii] / S[anillos - 1], rr = o.rFn ? r * o.rFn(t) : r, P = pts[i];
    for (let k = 0; k < K; k++) {
      let ang, nx, ny;
      if (plano) { const lado = k >> 1, e = k & 1; ang = a0 + 2 * Math.PI * (lado + e) / lados; const am = a0 + 2 * Math.PI * (lado + 0.5) / lados; nx = Math.cos(am) / sN; ny = Math.sin(am) / sB; }
      else { ang = a0 + 2 * Math.PI * k / lados; nx = Math.cos(ang) / sN; ny = Math.sin(ang) / sB; }
      const rc = plano ? rr / Math.cos(Math.PI / lados) : rr, cx = Math.cos(ang) * rc * sN, cy = Math.sin(ang) * rc * sB, nl = Math.hypot(nx, ny);
      pos.push(P.x + N[i].x * cx + B[i].x * cy, P.y + N[i].y * cx + B[i].y * cy, P.z + N[i].z * cx + B[i].z * cy);
      nor.push((N[i].x * nx + B[i].x * ny) / nl, (N[i].y * nx + B[i].y * ny) / nl, (N[i].z * nx + B[i].z * ny) / nl);
      uv.push((plano ? ((k >> 1) + (k & 1)) / lados : k / lados) * per, S[ii]);
    }
  }
  for (let ii = 0; ii < anillos - 1; ii++) for (let k = 0; k < (plano ? K : lados); k += plano ? 2 : 1) {
    const a = ii * K + k, b = a + 1, c = a + K, d = c + 1; idx.push(a, b, c, b, d, c);
  }
  if (!cerrado && o.tapas !== false) for (const [i, sg] of [[0, -1], [n - 1, 1]]) {   // tapas planas
    const c0 = pos.length / 3, P = pts[i], t = T[i]; pos.push(P.x, P.y, P.z); nor.push(t.x * sg, t.y * sg, t.z * sg); uv.push(0.5, 0.5);
    const base = i * K;
    for (let k = 0; k < K; k++) { const j = base + k; pos.push(pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2]); nor.push(t.x * sg, t.y * sg, t.z * sg); uv.push(uv[j * 2] / per, 0); }
    for (let k = 0; k < K - 1; k++) sg < 0 ? idx.push(c0, c0 + 2 + k, c0 + 1 + k) : idx.push(c0, c0 + 1 + k, c0 + 2 + k);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g;
}
// polilínea con esquinas dobladas (radio de doblado rc): curva de Bézier cuadrática en cada esquina
function doblar(esq, rc, nArco = 6, cerrado = false) {
  const out = [], n = esq.length;
  for (let i = 0; i < n; i++) {
    const b = esq[i];
    if (!cerrado && (i === 0 || i === n - 1)) { out.push(b.clone()); continue; }
    const a = esq[(i - 1 + n) % n], c = esq[(i + 1) % n], d1 = b.clone().sub(a), d2 = c.clone().sub(b), L1 = d1.length(), L2 = d2.length();
    const s = Math.min(rc, L1 * 0.49, L2 * 0.49), p0 = b.clone().addScaledVector(d1.normalize(), -s), p1 = b.clone().addScaledVector(d2.normalize(), s);
    for (let k = 0; k <= nArco; k++) { const t = k / nArco, u = 1 - t; out.push(V3(u * u * p0.x + 2 * u * t * b.x + t * t * p1.x, u * u * p0.y + 2 * u * t * b.y + t * t * p1.y, u * u * p0.z + 2 * u * t * b.z + t * t * p1.z)); }
  }
  return out;
}
function densificar(pts, paso) { const out = [pts[0]]; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], k = Math.max(1, Math.ceil(a.distanceTo(b) / paso)); for (let j = 1; j <= k; j++) out.push(a.clone().lerp(b, j / k)); } return out; }
const curva = (f, n) => Array.from({ length: n + 1 }, (_, i) => f(i / n));

// bloque redondeado subdividido (colchones, almohadas, tablas con bisel): caja → esquinas esféricas → deformación libre
function bloque(w, h, d, r, seg, deformar) {
  const [sx, sy, sz] = seg; let g = new THREE.BoxGeometry(w, h, d, sx, sy, sz); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g);
  const p = g.attributes.position, hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r, v = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); c.set(Math.max(-hx, Math.min(hx, v.x)), Math.max(-hy, Math.min(hy, v.y)), Math.max(-hz, Math.min(hz, v.z)));
    const dd = v.clone().sub(c); if (dd.lengthSq() > 1e-12) v.copy(c).addScaledVector(dd.normalize(), r);
    if (deformar) deformar(v, w, h, d); p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); return g;
}
// UV en metros, con la veta (v) a lo largo del eje 'x' | 'y' | 'z'
function uvMetros(g, eje = 'y') {
  const p = g.attributes.position, nr = g.attributes.normal, n = p.count, uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const P = [p.getX(i), p.getY(i), p.getZ(i)], A = [Math.abs(nr.getX(i)), Math.abs(nr.getY(i)), Math.abs(nr.getZ(i))];
    const ax = A[0] >= A[1] && A[0] >= A[2] ? 0 : A[1] >= A[2] ? 1 : 2, e = { x: 0, y: 1, z: 2 }[eje];
    let uA, vA; if (ax === e) { [uA, vA] = [0, 1, 2].filter(k => k !== ax); } else { vA = e; uA = [0, 1, 2].find(k => k !== ax && k !== e); }
    uv[i * 2] = P[uA]; uv[i * 2 + 1] = P[vA];
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g;
}
// torneado: perfil [[r, y], ...] de abajo hacia arriba; UV v = altura en metros
function torno(perfil, seg) {
  const g = new THREE.LatheGeometry(perfil.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), seg);
  const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, uv.getX(i) * 0.25, p.getY(i)); return g;
}
// tela que cae: cubre el colchón (ancho W, tope y0) entre z0 y z1 y cuelga 'caida' por los lados, con pliegues
function manta(W, y0, z0, z1, caida, rb, o = {}) {
  const nu = o.nu || 36, nv = o.nv || 26, borde = rb * Math.PI / 2, S = W / 2 + borde + caida, g = new THREE.PlaneGeometry(1, 1, nu, nv), p = g.attributes.position, uv = g.attributes.uv;
  const amp = o.amp ?? 0.025, ond = o.ondas ?? 7, fase = o.fase ?? 0.7, lados = o.lados ?? [1, 1];
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) + 0.5, v = p.getY(i) + 0.5, sg = u < 0.5 ? -1 : 1;
    let s = (u * 2 - 1) * S; const L = lados[sg < 0 ? 0 : 1]; if (!L) s = Math.sign(s) * Math.min(Math.abs(s), W / 2 + borde * 0.6);
    const z = z1 + (z0 - z1) * v, a = Math.abs(s); let x, y;   // v invertido: la cara de la tela mira hacia arriba
    if (a <= W / 2) { x = s; y = y0 + (o.bulto ? o.bulto(s, z) : 0); }
    else if (a <= W / 2 + borde) { const an = (a - W / 2) / rb; x = sg * (W / 2 + rb * Math.sin(an)); y = y0 - rb * (1 - Math.cos(an)); }
    else { const h = a - W / 2 - borde, f = h / caida, pl = Math.sin(2 * Math.PI * (z * ond / (z1 - z0)) + fase * sg) + 0.4 * Math.sin(2 * Math.PI * z * ond * 2.3 / (z1 - z0) + 1.3 * sg);
      x = sg * (W / 2 + rb + amp * f * (1 + pl)); y = y0 - rb - h + 0.006 * f * pl + 0.008 * f * Math.sin(z * 23 + sg); }
    // el borde de los pies también cae un poco (si toca)
    if (o.pie && v < 0.03) y -= (0.03 - v) / 0.03 * o.pie;
    p.setXYZ(i, x, y, z); uv.setXY(i, s, z);
  }
  g.computeVertexNormals(); return g;
}

// ------------------------------------------------------------------ armador: junta todo por material, color en vértices
class Armador {
  constructor(q) { this.q = q; this.P = {}; }
  add(m, g, color = 0xffffff, mat4) {
    if (mat4) g.applyMatrix4(mat4);
    if (g.index) g = g.toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    const e = ESC_UV[m] || 1, uv = g.attributes.uv; if (e !== 1) for (let i = 0; i < n; i++) uv.setXY(i, uv.getX(i) * e, uv.getY(i) * e);
    const c = new THREE.Color(color), a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.clearGroups(); g.morphAttributes = {};
    (this.P[m] ||= []).push(g); return g;
  }
  // atajos
  tubo(m, pts, r, color, o = {}) { return this.add(m, barrido(pts, r, o.lados ?? (this.q ? 10 : 5), o), color); }
  torno(m, perfil, x, y, z, color, seg, rotar) { const g = torno(perfil, seg ?? (this.q ? 18 : 8)); if (rotar) g.applyMatrix4(rotar); g.translate(x, y, z); return this.add(m, g, color); }
  bloque(m, w, h, d, r, x, y, z, color, o = {}) {
    const k = this.q ? 1 : 0.5, seg = (o.seg || [2, 2, 2]).map(s => Math.max(1, Math.round(s * k)));
    const g = bloque(w, h, d, r, seg, o.def); uvMetros(g, o.veta || (w >= d ? (w >= h ? 'x' : 'y') : (d >= h ? 'z' : 'y')));
    if (o.rx) g.rotateX(o.rx); if (o.rz) g.rotateZ(o.rz); if (o.ry) g.rotateY(o.ry); g.translate(x, y, z); return this.add(m, g, color);
  }
  esfera(m, r, x, y, z, color, sy = 1) { const g = new THREE.SphereGeometry(r, this.q ? 14 : 6, this.q ? 10 : 4); g.scale(1, sy, 1); g.translate(x, y, z); return this.add(m, g, color); }
  // orden: nombres de material del LOD alto (el LOD bajo usa el MISMO arreglo de materiales)
  fin(orden) {
    const todos = orden || Object.keys(this.P).sort((a, b) => (a === 'vidrio' || a === 'llama') - (b === 'vidrio' || b === 'llama'));   // transparentes al final
    const ms = todos.filter(m => this.P[m]);
    const geo = mergeGeometries(ms.map(m => mergeGeometries(this.P[m], false)), true);
    geo.groups.forEach((g, i) => { g.materialIndex = todos.indexOf(ms[i]); });
    geo.computeBoundingBox(); geo.computeBoundingSphere(); return { geo, mats: todos.map(materialFino), orden: todos };
  }
}
const rotX = a => new THREE.Matrix4().makeRotationX(a), rotZ = a => new THREE.Matrix4().makeRotationZ(a), rotY = a => new THREE.Matrix4().makeRotationY(a);

// ------------------------------------------------------------------ piezas comunes
// colchón con sábana (bulto al centro) + almohada mullida
function colchon(A, W, L, yb, h, zc, color = 0xebe6da) {
  A.bloque('tela', W, h, L, 0.045, 0, yb + h / 2, zc, color, { seg: [10, 3, 20], veta: 'z', def: (v, w, hh, d) => { if (v.y > 0) v.y += 0.018 * (1 - Math.pow(2 * v.x / w, 4)) * (1 - Math.pow(2 * v.z / d, 4)); else v.y -= 0.004 * (1 - Math.pow(2 * v.x / w, 2)); } });
}
function almohada(A, w, d, x, y, z, color = 0xf3f0e8, incl = 0.35) {
  const g = bloque(w, 0.16, d * 1.15, 0.05, A.q ? [12, 3, 10] : [5, 2, 4], (v, ww, h, dd) => {   // funda rectangular, relleno al centro
    const fx = 1 - Math.pow(2 * v.x / ww, 6), fz = 1 - Math.pow(2 * v.z / dd, 2), f = Math.pow(Math.max(0, fx), 0.4) * Math.pow(Math.max(0, fz), 0.7);
    v.y *= 0.12 + 0.88 * f; v.x *= 1 - 0.035 * (1 - Math.pow(2 * v.z / dd, 2)); v.z *= 1 - 0.05 * (1 - Math.pow(2 * v.x / ww, 2)); if (v.y > 0) v.y -= 0.012 * Math.exp(-((v.x * v.x) / 0.02 + (v.z * v.z) / 0.01));   // hundida donde va la cabeza
  });
  uvMetros(g, 'x'); g.rotateX(-incl); g.translate(x, y, z); A.add('tela', g, color);
}
function manta3(A, W, y0, z0, z1, caida, color, mat = 'lana', o = {}) { A.add(mat, manta(W, y0, z0, z1, caida, 0.035, { nu: A.q ? 40 : 14, nv: A.q ? 28 : 8, ...o }), color); }
// barrotes con remate de bronce
function perilla(A, x, y, z, r = 0.03) {   // pomo de bronce torneado sobre un poste
  A.torno('bronce', [[0.0, 0], [r * 0.75, 0], [r * 0.8, r * 0.25], [r * 0.5, r * 0.45], [r * 0.55, r * 0.7], [r * 0.98, r * 1.3], [r * 1.0, r * 1.6], [r * 0.85, r * 2.1], [r * 0.5, r * 2.45], [r * 0.25, r * 2.6], [0, r * 2.65]], x, y, z, 0xc79a45);
}
function anillo(A, x, y, z, r, h = 0.03, eje) {   // collar de bronce en una unión
  const g = torno([[r * 0.8, -h / 2], [r, -h / 2 + 0.004], [r * 1.08, 0], [r, h / 2 - 0.004], [r * 0.8, h / 2]], A.q ? 14 : 6);
  if (eje === 'x') g.rotateZ(Math.PI / 2); if (eje === 'z') g.rotateX(Math.PI / 2); g.translate(x, y, z); A.add('bronce', g, 0xc79a45);
}
function angulo(A, x, y, z0, z1, color, haciaDentro) {   // larguero de fierro en L
  const L = z1 - z0, zc = (z0 + z1) / 2;
  A.bloque('pintura', 0.004, 0.04, L, 0.0015, x, y - 0.02, zc, color, { seg: [1, 1, 4], veta: 'z' });
  A.bloque('pintura', 0.04, 0.004, L, 0.0015, x + haciaDentro * 0.02, y, zc, color, { seg: [1, 1, 4], veta: 'z' });
}

// ------------------------------------------------------------------ CAMA de fierro (ancho x 0,95, largo z 2,0; cabecera en −z)
function cama(A, op) {
  const F = op.fierro ?? 0x3d5c46, X = 0.45, Zc = -0.95, Zp = 0.95, R = 0.018, r = 0.0085, q = A.q;
  const poste = (x, z, h) => { A.tubo('pintura', [V3(x, 0.02, z), V3(x, h, z)], R, F); perilla(A, x, h - 0.002, z, 0.024); if (q) A.esfera('bronce', 0.021, x, 0.025, z, 0xb88c3c, 0.8); };
  const panel = (z, hT, arco, nb) => {   // cabecera o piecera: travesaño curvo (tubo doblado), travesaño bajo y barrotes con collares
    const yArc = x => hT + arco * Math.cos(Math.PI * x / (2 * X));   // curva del tubo de arriba
    const top = curva(t => V3(-X + 2 * X * t, yArc(-X + 2 * X * t), z), q ? 24 : 10);
    // el tubo de arriba entra a los postes doblándose: arranca 0,1 m más abajo y sube en curva
    const yIni = hT - 0.11, ent = [V3(-X, yIni, z), ...doblar([V3(-X, yIni + 0.05, z), V3(-X + 0.02, hT, z), V3(-X + 0.12, yArc(-X + 0.12), z)], 0.05, q ? 5 : 2).slice(1)];
    const sal = ent.map(p => V3(-p.x, p.y, p.z)).reverse();
    const camino = [...ent, ...top.filter(p => p.x > -X + 0.14 && p.x < X - 0.14), ...sal];
    A.tubo('pintura', camino, R * 0.85, F);
    A.tubo('pintura', [V3(-X, 0.34, z), V3(X, 0.34, z)], R * 0.8, F);
    for (let i = 1; i < nb; i++) {
      const x = -X + 2 * X * i / nb, y1 = yArc(x) - 0.005, central = i === nb / 2;
      A.tubo('pintura', [V3(x, 0.34, z), V3(x, y1, z)], central ? r * 1.3 : r, F, { lados: q ? 8 : 4 });
      if (q) { anillo(A, x, 0.36, z, r * 1.5, 0.018); anillo(A, x, y1 - 0.025, z, r * 1.5, 0.018); A.esfera('bronce', r * 2.1, x, (0.34 + y1) / 2, z, 0xc79a45, 1.25); }
    }
    if (q) for (const s of [-1, 1]) { anillo(A, s * X, 0.34, z, R * 1.25, 0.04); anillo(A, s * X, yIni + 0.02, z, R * 1.25, 0.04); }
  };
  poste(-X, Zc, 1.16); poste(X, Zc, 1.16); poste(-X, Zp, 0.9); poste(X, Zp, 0.9);
  panel(Zc, 1.0, 0.1, 8); panel(Zp, 0.78, 0.05, 8);
  for (const s of [-1, 1]) angulo(A, s * (X - 0.012), 0.4, Zc + 0.02, Zp - 0.02, F, -s);
  for (let i = 0; i < (q ? 7 : 3); i++) A.bloque('pintura', 2 * X - 0.05, 0.004, 0.035, 0.001, 0, 0.398, Zc + 0.2 + i * (Zp - Zc - 0.4) / ((q ? 7 : 3) - 1), 0x2a2a28, { seg: [3, 1, 1] });   // flejes del somier
  colchon(A, 0.86, 1.86, 0.404, 0.17, 0, op.sabana ?? 0xece8dd);
  almohada(A, 0.62, 0.36, 0, 0.62, -0.7, 0xf4f1ea);
  const yT = 0.404 + 0.17 + 0.016;
  manta3(A, 0.88, yT + 0.006, -0.42, 0.93, 0.25, op.frazada ?? 0x8e2b22, 'lana', { amp: 0.03, ondas: 6, bulto: (s) => -0.004 * Math.pow(2 * s / 0.88, 4) });
  manta3(A, 0.885, yT + 0.014, -0.52, -0.36, 0.05, op.sabana ?? 0xefebe2, 'tela', { amp: 0, ondas: 1 });   // embozo de la sábana doblada sobre la frazada
  return [0.95, 1.2, 2.0];
}

// ------------------------------------------------------------------ LITERA de fierro (2 camas, escalerita al lado +x de los pies)
function litera(A, op) {
  const F = op.fierro ?? 0x3d5c46, X = 0.45, Zc = -0.95, Zp = 0.95, R = 0.019, r = 0.0085, H = 1.74, q = A.q;
  for (const x of [-X, X]) for (const z of [Zc, Zp]) { A.tubo('pintura', [V3(x, 0.02, z), V3(x, H, z)], R, F); perilla(A, x, H - 0.002, z, 0.022); if (q) A.esfera('bronce', 0.021, x, 0.025, z, 0xb88c3c, 0.8); }
  const niveles = [[0.3, 0.72], [1.12, 1.6]];
  for (const z of [Zc, Zp]) for (const [y0, y1] of niveles) {
    A.tubo('pintura', [V3(-X, y0, z), V3(X, y0, z)], R * 0.8, F); A.tubo('pintura', [V3(-X, y1, z), V3(X, y1, z)], R * 0.8, F);
    for (let i = 1; i < 7; i++) { const x = -X + 2 * X * i / 7; A.tubo('pintura', [V3(x, y0, z), V3(x, y1, z)], r, F, { lados: q ? 8 : 4 }); if (q) A.esfera('bronce', r * 2, x, (y0 + y1) / 2, z, 0xc79a45, 1.3); }
    if (q) for (const s of [-1, 1]) { anillo(A, s * X, y0, z, R * 1.25, 0.04); anillo(A, s * X, y1, z, R * 1.25, 0.04); }
  }
  for (const [y0] of niveles) {
    for (const s of [-1, 1]) angulo(A, s * (X - 0.012), y0 + 0.06, Zc + 0.02, Zp - 0.02, F, -s);
    for (let i = 0; i < (q ? 6 : 3); i++) A.bloque('pintura', 2 * X - 0.05, 0.004, 0.035, 0.001, 0, y0 + 0.058, Zc + 0.2 + i * (Zp - Zc - 0.4) / ((q ? 6 : 3) - 1), 0x2a2a28, { seg: [3, 1, 1] });
    colchon(A, 0.86, 1.86, y0 + 0.064, 0.15, 0, 0xebe7dc);
    almohada(A, 0.6, 0.34, 0, y0 + 0.064 + 0.15 + 0.045, -0.72, 0xf4f1ea, 0.25);
    const yT = y0 + 0.064 + 0.15 + 0.016;
    manta3(A, 0.88, yT + 0.006, -0.25, 0.92, y0 > 1 ? 0.2 : 0.17, op.frazada ?? 0x7a7670, 'lana', { amp: 0.025, ondas: 5, fase: y0 > 1 ? 1.9 : 0.6 });
    manta3(A, 0.885, yT + 0.014, -0.34, -0.2, 0.05, 0xefebe2, 'tela', { amp: 0, ondas: 1 });
  }
  // escalerita colgada del larguero alto, al costado +x cerca de los pies
  const xe0 = X + 0.24, xe1 = X + 0.035, ys = 1.18;
  for (const z of [0.5, 0.86]) {
    const p = [V3(xe0, 0.01, z), V3(xe1 + 0.02, ys, z), V3(xe1 + 0.02, ys + 0.07, z), V3(xe1 - 0.04, ys + 0.09, z), V3(xe1 - 0.05, ys + 0.03, z)];
    A.tubo('pintura', doblar(p, 0.03, q ? 4 : 2), 0.012, F, { lados: q ? 8 : 5 });
    if (q) A.esfera('oscuro', 0.016, xe0, 0.01, z, 0x1c1c1a, 0.6);
  }
  for (const t of [0.26, 0.52, 0.78]) { const y = t * ys, x = xe0 + (xe1 + 0.02 - xe0) * (y - 0.01) / (ys - 0.01); A.tubo('pintura', [V3(x, y, 0.5), V3(x, y, 0.86)], 0.011, F, { lados: q ? 8 : 4 }); }
  return [1.25, 1.8, 2.0];
}

// ------------------------------------------------------------------ CUNA de barrotes torneados (largo en x 1,25; frente +z)
function cuna(A, op) {
  const P = op.pintura ?? 0xe8e4d8, X = 0.6, Z = 0.3, q = A.q;
  const balaustre = (x, z, y0, y1, r) => {   // barrote torneado: base, cuerpo con bulbo y anillos
    const h = y1 - y0, pf = q ? [[r * 1.1, 0], [r * 1.1, 0.06 * h], [r * 0.75, 0.1 * h], [r * 0.8, 0.2 * h], [r * 1.35, 0.42 * h], [r * 1.3, 0.55 * h], [r * 0.75, 0.72 * h], [r * 1.05, 0.8 * h], [r * 0.8, 0.86 * h], [r * 1.1, 0.94 * h], [r * 1.1, h]]
      : [[r, 0], [r * 1.2, 0.5 * h], [r, h]];
    A.torno('pintura', pf, x, y0, z, P, q ? 8 : 5);
  };
  const posteT = (x, z, H) => {   // poste de esquina torneado con pomo
    const pf = [[0.017, 0], [0.022, 0.01], [0.022, 0.05], [0.017, 0.08], [0.019, 0.12], [0.027, 0.15], [0.027, 0.2], [0.02, 0.23], [0.022, 0.3],
      [0.024, H - 0.24], [0.02, H - 0.2], [0.026, H - 0.17], [0.026, H - 0.12], [0.018, H - 0.09], [0.012, H - 0.07], [0.022, H - 0.045], [0.024, H - 0.025], [0.016, H - 0.006], [0, H]];
    A.torno('pintura', pf, x, 0, z, P, q ? 14 : 6);
  };
  for (const x of [-X, X]) for (const z of [-Z, Z]) posteT(x, z, x < 0 ? 1.0 : 0.94);
  // cabeceras con tabla arqueada (Extrude con bisel) y barrotes
  for (const sx of [-1, 1]) {
    const x = sx * X, alto = sx < 0 ? 0.92 : 0.86, s = new THREE.Shape();
    s.moveTo(-Z + 0.02, alto - 0.13); s.lineTo(Z - 0.02, alto - 0.13); s.lineTo(Z - 0.02, alto - 0.06); s.quadraticCurveTo(0, alto + 0.06, -Z + 0.02, alto - 0.06); s.lineTo(-Z + 0.02, alto - 0.13);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: q ? 2 : 1, curveSegments: q ? 16 : 6 });
    g.translate(0, 0, -0.009); g.computeVertexNormals(); uvMetros(g, 'z'); g.rotateY(Math.PI / 2); g.translate(x, 0, 0); A.add('pintura', g, P);
    A.bloque('pintura', 0.03, 0.04, 2 * Z, 0.006, x, 0.29, 0, P, { veta: 'z' });
    for (let i = 1; i < 6; i++) balaustre(x, -Z + 2 * Z * i / 6, 0.31, alto - 0.13, 0.009);
  }
  // costados: pasamano redondeado arriba, larguero abajo y 13 barrotes
  for (const sz of [-1, 1]) {
    const z = sz * Z; A.bloque('pintura', 2 * X, 0.035, 0.045, 0.012, 0, 0.795, z, P, { veta: 'x', seg: [6, 2, 2] }); A.bloque('pintura', 2 * X, 0.05, 0.03, 0.006, 0, 0.3, z, P, { veta: 'x' });
    for (let i = 1; i < 14; i++) balaustre(-X + 2 * X * i / 14, z, 0.325, 0.778, 0.009);
  }
  A.bloque('madera', 2 * X - 0.04, 0.02, 2 * Z - 0.03, 0.003, 0, 0.32, 0, 0x9c7a55, { veta: 'x' });   // fondo de tablas
  A.bloque('tela', 2 * X - 0.06, 0.09, 2 * Z - 0.05, 0.03, 0, 0.375, 0, 0xeeeae0, { seg: [8, 2, 4], veta: 'x', def: (v, w, h, d) => { if (v.y > 0) v.y += 0.01 * (1 - Math.pow(2 * v.x / w, 4)) * (1 - Math.pow(2 * v.z / d, 4)); } });
  almohada(A, 0.36, 0.26, 0, 0.44, 0, 0xf6f3ec, 0); A.P.tela[A.P.tela.length - 1].applyMatrix4(rotY(Math.PI / 2)).translate(-0.4, 0, 0);
  // frazadita celeste doblada en los pies, con un pliegue suelto
  const fz = manta(0.5, 0.43, -0.02, 0.42, 0.06, 0.02, { nu: q ? 20 : 8, nv: q ? 14 : 6, amp: 0.012, ondas: 3 }); fz.rotateY(Math.PI / 2); fz.translate(0.03, 0, 0); A.add('lana', fz, op.frazada ?? 0x9fb8d4);
  return [1.3, 1.0, 0.7];
}

// ------------------------------------------------------------------ SILLA de madera, respaldo de barrotes (asiento 0,45)
function silla(A, op) {
  const M = op.madera ?? 0x4d2f1d, q = A.q, Ls = q ? 4 : 4, ys = 0.45, xf = 0.175, zf = 0.165, zb = -0.17;
  // patas delanteras: escuadradas, algo más finas abajo
  for (const s of [-1, 1]) A.tubo('madera', [V3(s * xf, 0, zf), V3(s * xf, ys - 0.02, zf)], 0.0175, M, { lados: Ls, plano: true, rFn: t => 0.82 + 0.18 * t });
  // patas traseras que suben como parantes del respaldo, con la inclinación hacia atrás
  for (const s of [-1, 1]) {
    const p = doblar([V3(s * xf, 0, zb + 0.02), V3(s * xf, ys - 0.02, zb), V3(s * 0.17, 0.93, zb - 0.075)], 0.12, q ? 6 : 2);
    A.tubo('madera', densificar(p, 0.08), 0.0175, M, { lados: Ls, plano: true, rFn: t => t < 0.45 ? 0.85 + 0.15 * t / 0.45 : 1 - 0.18 * (t - 0.45), normal: V3(1, 0, 0) });
  }
  // respaldo: travesaño de arriba curvo (cóncavo hacia quien se sienta), travesaño medio y 4 barrotes
  const zr = y => zb + (y - ys) / (0.93 - ys) * -0.075;
  const trav = (y, alto, grueso) => { const pts = curva(t => { const x = -0.17 + 0.34 * t; return V3(x, y, zr(y) - 0.022 * (1 - Math.pow(x / 0.17, 2))); }, q ? 14 : 5); A.tubo('madera', pts, grueso / 2, M, { lados: 4, plano: true, esc: [alto / grueso, 1], normal: V3(0, 1, 0), ang0: Math.PI / 4 }); };
  trav(0.86, 0.075, 0.022); trav(0.615, 0.035, 0.02);
  for (let i = 0; i < 4; i++) { const x = -0.105 + i * 0.07, c = -0.022 * (1 - Math.pow(x / 0.17, 2)); A.tubo('madera', [V3(x, 0.632, zr(0.632) + c), V3(x, 0.823, zr(0.823) + c)], 0.009, M, { lados: 4, plano: true, esc: [0.7, 1.4], normal: V3(0, 0, 1) }); }
  // asiento de tabla con canto redondeado y un leve hundido
  A.bloque('madera', 0.44, 0.026, 0.42, 0.009, 0, ys + 0.013, -0.002, M, { seg: [6, 1, 6], veta: 'x', def: (v, w, h, d) => { if (v.y > 0) v.y -= 0.006 * (1 - Math.pow(2 * v.x / w, 2)) * (1 - Math.pow(2 * (v.z + 0.03) / d, 2)); if (v.z > d / 2 - 0.02) v.x *= 1; } });
  // faldón bajo el asiento y travesaños entre patas (en H)
  A.bloque('madera', 2 * xf - 0.02, 0.06, 0.018, 0.003, 0, ys - 0.045, zf - 0.004, M, { veta: 'x' }); A.bloque('madera', 2 * xf - 0.02, 0.06, 0.018, 0.003, 0, ys - 0.045, zb + 0.006, M, { veta: 'x' });
  for (const s of [-1, 1]) { A.bloque('madera', 0.018, 0.06, zf - zb - 0.03, 0.003, s * (xf - 0.004), ys - 0.045, (zf + zb) / 2, M, { veta: 'z' }); A.tubo('madera', [V3(s * xf, 0.17, zf), V3(s * xf, 0.17, zb + 0.016)], 0.0095, M, { lados: q ? 8 : 5 }); }
  A.tubo('madera', [V3(-xf, 0.17, 0.0), V3(xf, 0.17, 0.0)].map(p => (p.z = (zf + zb) / 2 + 0.01, p)), 0.009, M, { lados: q ? 8 : 5 });
  A.tubo('madera', [V3(-xf, 0.22, zf), V3(xf, 0.22, zf)], 0.0095, M, { lados: q ? 8 : 5 });
  return [0.42, 0.95, 0.46];
}

// ------------------------------------------------------------------ SILLA DE VIENA (madera curvada al vapor, asiento de rejilla)
function sillaViena(A, op) {
  const M = op.madera ?? 0x3a2213, q = A.q, ys = 0.46, Rs = 0.205, lados = q ? 10 : 5;
  // aro del asiento (anillo de madera) y rejilla de esterilla
  A.tubo('madera', curva(t => V3(Rs * Math.sin(2 * Math.PI * t), ys - 0.015, Rs * Math.cos(2 * Math.PI * t) * 0.95), q ? 40 : 14), 0.016, M, { lados: 4, plano: true, esc: [1.7, 0.8], cerrado: true, normal: V3(0, 1, 0), ang0: Math.PI / 4 });
  const rej = new THREE.CircleGeometry(Rs - 0.012, q ? 32 : 12); rej.rotateX(-Math.PI / 2); rej.scale(1, 1, 0.95); rej.translate(0, ys - 0.002, 0);
  { const uv = rej.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.4, uv.getY(i) * 0.4); }
  A.add('tela', rej, op.rejilla ?? 0xc49a5c);
  // patas delanteras torneadas, algo abiertas
  for (const s of [-1, 1]) { const a = s * 0.75, top = V3(Math.sin(a) * (Rs - 0.03), ys - 0.03, Math.cos(a) * (Rs - 0.03) * 0.95); A.tubo('madera', [V3(top.x * 1.22, 0, top.z * 1.18), top], 0.016, M, { lados, rFn: t => 0.75 + 0.25 * t }); }
  // patas traseras que suben y se cierran en el arco del respaldo (una sola pieza curvada)
  const izq = doblar([V3(-0.16, 0, -0.27), V3(-0.155, ys - 0.03, -0.17), V3(-0.165, 0.7, -0.215), V3(-0.16, 0.8, -0.24)], 0.1, q ? 6 : 2);
  const arco = curva(t => { const a = Math.PI * (1 - t); return V3(0.16 * Math.cos(a), 0.8 + 0.12 * Math.sin(a), -0.24 - 0.025 * Math.sin(a)); }, q ? 18 : 7).slice(1, -1);
  const der = izq.map(p => V3(-p.x, p.y, p.z)).reverse();
  A.tubo('madera', densificar([...izq, ...arco, ...der], 0.06), 0.016, M, { lados, rFn: t => (t < 0.18 || t > 0.82) ? 0.78 + 0.22 * Math.min(t, 1 - t) / 0.18 : 1 });
  // lazo interior del respaldo
  A.tubo('madera', [V3(-0.075, ys - 0.01, -0.175), ...curva(t => { const a = Math.PI * (1 - t); return V3(0.075 * Math.cos(a), 0.6 + 0.13 * Math.sin(a), -0.205 - 0.015 * Math.sin(a)); }, q ? 18 : 7), V3(0.075, ys - 0.01, -0.175)], 0.011, M, { lados: q ? 8 : 4 });   // arco interior del respaldo (nace del asiento)
  // aro de refuerzo entre las patas
  A.tubo('madera', curva(t => { const a = 2 * Math.PI * t; return V3(0.2 * Math.sin(a), 0.2, 0.2 * Math.cos(a) * 0.95 - 0.02); }, q ? 36 : 12), 0.009, M, { lados: q ? 8 : 4, cerrado: true });
  return [0.44, 0.93, 0.52];
}

// ------------------------------------------------------------------ QUINQUÉ de parafina (bronce, tubo de vidrio, llama)
function quinque(A, op) {
  const B = op.bronce ?? 0xc39443, q = A.q;
  A.torno('bronce', [[0, 0], [0.056, 0], [0.06, 0.004], [0.06, 0.009], [0.052, 0.014], [0.036, 0.022], [0.026, 0.034], [0.018, 0.05], [0.015, 0.068], [0.021, 0.078],
    [0.023, 0.084], [0.016, 0.09], [0.017, 0.1], [0.03, 0.11], [0.052, 0.124], [0.064, 0.145], [0.065, 0.165], [0.058, 0.185], [0.04, 0.2], [0.025, 0.207], [0.022, 0.212], [0.022, 0.222], [0, 0.222]], 0, 0, 0, B, q ? 28 : 10);
  // quemador: collar roscado, campana de bronce calada (galería) y botón de la mecha
  A.torno('bronce', [[0.02, 0.222], [0.026, 0.224], [0.026, 0.232], [0.022, 0.236], [0.03, 0.24], [0.033, 0.255], [0.031, 0.258], [0.024, 0.262], [0.009, 0.262]], 0, 0, 0, B, q ? 20 : 8);
  if (q) for (let i = 0; i < 10; i++) { const a = 2 * Math.PI * i / 10; A.bloque('bronce', 0.004, 0.022, 0.0025, 0.0008, Math.cos(a) * 0.034, 0.262, Math.sin(a) * 0.034, B, { ry: -a, seg: [1, 1, 1] }); }
  A.tubo('bronce', [V3(0.022, 0.244, 0), V3(0.05, 0.244, 0)], 0.0035, B, { lados: q ? 8 : 4 }); A.torno('bronce', [[0, -0.003], [0.009, -0.003], [0.01, 0], [0.009, 0.003], [0, 0.003]], 0.052, 0.244, 0, B, q ? 14 : 6, rotZ(Math.PI / 2));
  // tubo de vidrio (chimenea) abombado
  A.torno('vidrio', [[0.029, 0.255], [0.031, 0.268], [0.04, 0.29], [0.046, 0.315], [0.045, 0.335], [0.036, 0.36], [0.024, 0.385], [0.021, 0.41], [0.021, 0.448], [0.023, 0.455]], 0, 0, 0, 0xf0f5f1, q ? 24 : 10);
  // mecha y llama
  A.bloque('oscuro', 0.012, 0.006, 0.002, 0.0005, 0, 0.265, 0, 0x2a2420, { seg: [1, 1, 1] });
  A.torno('llama', [[0, 0], [0.006, 0.004], [0.0085, 0.012], [0.0065, 0.024], [0.003, 0.034], [0, 0.04]], 0, 0.266, 0, 0xffc45e, q ? 12 : 6);
  if (q) A.torno('llama', [[0, 0], [0.004, 0.004], [0.0045, 0.01], [0, 0.016]], 0, 0.264, 0, 0x6f8cff, 8);   // pie azul de la llama
  return [0.13, 0.46, 0.13];
}

// ------------------------------------------------------------------ VELA en palmatoria de enlozado (con asa)
function vela(A, op) {
  const E = op.enlozado ?? 0xeceae2, Az = 0x23436e, q = A.q;
  A.torno('loza', [[0, 0.004], [0.058, 0.002], [0.066, 0.008], [0.07, 0.018], [0.072, 0.022], [0.066, 0.02], [0.06, 0.012], [0.05, 0.011], [0.022, 0.012], [0.02, 0.016], [0.021, 0.042], [0.024, 0.046], [0.018, 0.046], [0.017, 0.03], [0, 0.03]], 0, 0, 0, E, q ? 28 : 10);
  A.torno('loza', [[0.0705, 0.0175], [0.0735, 0.0215], [0.071, 0.024], [0.068, 0.021]], 0, 0, 0, Az, q ? 28 : 10);   // filete azul del borde
  A.torno('loza', [[0.0225, 0.042], [0.0255, 0.045], [0.0235, 0.048], [0.019, 0.046]], 0, 0, 0, Az, q ? 16 : 8);
  // asa de cinta curvada
  A.tubo('loza', curva(t => { const a = -Math.PI * 0.62 + 2 * Math.PI * 0.86 * t; return V3(0.092 + 0.022 * Math.cos(a), 0.038 + 0.02 * Math.sin(a), 0); }, q ? 20 : 8), 0.004, E, { lados: 4, plano: true, esc: [1.7, 0.8], normal: V3(0, 0, 1) });   // asa de anillo para el dedo
  // vela de cera (gastada, con la boca derretida y chorreados)
  const h = 0.105, y0 = 0.03;
  A.torno('cera', [[0.0115, y0], [0.0118, y0 + h * 0.6], [0.0116, y0 + h - 0.006], [0.0105, y0 + h - 0.001], [0.008, y0 + h + 0.001], [0.006, y0 + h - 0.004], [0.002, y0 + h - 0.005], [0, y0 + h - 0.005]], 0, 0, 0, op.cera ?? 0xefe6cc, q ? 16 : 8);
  if (q) for (const [a, l] of [[0.4, 0.035], [2.2, 0.06], [4.1, 0.022]]) A.bloque('cera', 0.006, l, 0.004, 0.0019, Math.cos(a) * 0.0115, y0 + h - l / 2 - 0.002, Math.sin(a) * 0.0115, op.cera ?? 0xefe6cc, { ry: -a + Math.PI / 2, seg: [1, 3, 1] });
  if (q) A.torno('cera', [[0, 0.046], [0.02, 0.046], [0.016, 0.05], [0, 0.051]], 0.004, 0, 0.003, op.cera ?? 0xefe6cc, 12);   // cera caída en el plato
  A.tubo('oscuro', [V3(0, y0 + h - 0.005, 0), V3(0.001, y0 + h + 0.006, 0), V3(0.003, y0 + h + 0.01, 0)], 0.0011, 0x1a1512, { lados: 4 });
  A.torno('llama', [[0, 0], [0.005, 0.005], [0.0065, 0.013], [0.005, 0.022], [0.002, 0.03], [0, 0.034]], 0.002, y0 + h + 0.004, 0, 0xffc35a, q ? 12 : 6);
  return [0.19, 0.18, 0.15];
}

// ------------------------------------------------------------------ BANCA de iglesia (2,6 m; asiento hacia +z, mira al altar)
function banca(A, op) {
  const M = op.madera ?? 0x9a6235, q = A.q, Lx = 2.6, xe = Lx / 2 - 0.025;
  // costados: tablón recortado con brazo de voluta y respaldo alto
  const s = new THREE.Shape();
  s.moveTo(-0.27, 0); s.lineTo(-0.17, 0); s.quadraticCurveTo(-0.12, 0.07, -0.02, 0.07); s.lineTo(0.08, 0.07); s.quadraticCurveTo(0.17, 0.07, 0.2, 0); s.lineTo(0.27, 0);   // pie con arco recortado
  s.lineTo(0.27, 0.06); s.quadraticCurveTo(0.22, 0.2, 0.23, 0.42);   // canto delantero
  s.quadraticCurveTo(0.24, 0.55, 0.28, 0.6); s.absarc(0.245, 0.62, 0.045, -0.3, Math.PI * 1.25, false);   // voluta del brazo
  s.quadraticCurveTo(0.12, 0.6, 0.0, 0.6); s.quadraticCurveTo(-0.12, 0.6, -0.17, 0.8);   // brazo y subida al respaldo
  s.lineTo(-0.2, 0.92); s.absarc(-0.245, 0.93, 0.05, 0.1, Math.PI * 1.1, false);   // voluta del respaldo
  s.lineTo(-0.3, 0.88); s.quadraticCurveTo(-0.27, 0.5, -0.27, 0);
  for (const sx of [-1, 1]) {
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.045, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: q ? 2 : 1, curveSegments: q ? 12 : 4 });
    g.translate(0, 0, -0.0225); uvMetros(g, 'y'); g.rotateY(-Math.PI / 2); g.translate(sx * xe, 0, 0.0); A.add('madera', g, M);
  }
  const L = Lx - 0.07;
  A.bloque('madera', L, 0.035, 0.4, 0.012, 0, 0.445, 0.035, M, { veta: 'x', seg: [10, 1, 3], def: (v, w, h, d) => { if (v.y > 0) v.y -= 0.004 * (1 - Math.pow(2 * v.z / d, 2)); } });   // asiento
  A.bloque('madera', L, 0.07, 0.025, 0.006, 0, 0.395, 0.215, M, { veta: 'x' });   // faldón delantero
  A.bloque('madera', L, 0.36, 0.022, 0.005, 0, 0.68, -0.215, M, { veta: 'x', rx: 0.17 });   // tablero del respaldo (inclinado)
  A.bloque('madera', L, 0.06, 0.05, 0.015, 0, 0.885, -0.25, M, { veta: 'x', rx: 0.17, seg: [6, 2, 2] });   // cabezal
  A.bloque('madera', L, 0.045, 0.03, 0.008, 0, 0.495, -0.18, M, { veta: 'x', rx: 0.17 });
  if (q) {   // molduras del tablero por delante y largueros de división (3 paños)
    for (const y of [0.53, 0.83]) A.bloque('madera', L, 0.02, 0.012, 0.004, 0, y, -0.2 + (y - 0.53) * -0.17, M, { veta: 'x', rx: 0.17 });
    for (const x of [-0.42, 0.42]) A.bloque('madera', 0.045, 0.32, 0.012, 0.004, x, 0.68, -0.2, M, { veta: 'y', rx: 0.17 });
    A.bloque('madera', L, 0.02, 0.11, 0.004, 0, 0.74, -0.33, M, { veta: 'x' }); A.bloque('madera', L, 0.05, 0.015, 0.004, 0, 0.76, -0.39, M, { veta: 'x' });   // repisa del libro (detrás, para la fila de atrás)
  }
  A.bloque('madera', L, 0.08, 0.035, 0.006, 0, 0.11, -0.12, M, { veta: 'x' });   // travesaño bajo
  return [2.62, 0.98, 0.62];
}

// ------------------------------------------------------------------ PERCHERO de pie (madera torneada y ganchos curvados)
function perchero(A, op) {
  const M = op.madera ?? 0x3f2817, q = A.q, H = 1.82;
  A.torno('madera', [[0.03, 0.2], [0.034, 0.22], [0.028, 0.25], [0.026, 0.3], [0.03, 0.33], [0.024, 0.37], [0.022, 0.6], [0.026, 0.62], [0.021, 0.65], [0.02, 1.2],
    [0.024, 1.22], [0.019, 1.25], [0.019, H - 0.3], [0.025, H - 0.28], [0.025, H - 0.22], [0.02, H - 0.2], [0.02, H - 0.08], [0.028, H - 0.06], [0.03, H - 0.035], [0.022, H - 0.012], [0.008, H - 0.002], [0, H]], 0, 0, 0, M, q ? 16 : 7);
  // 4 patas curvadas en S
  for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2, d = (r, y) => V3(Math.cos(a) * r, y, Math.sin(a) * r);
    A.tubo('madera', curva(t => d(0.02 + 0.33 * t, 0.29 * Math.pow(1 - t, 1.6) + 0.04 * Math.sin(Math.PI * t) + 0.012), q ? 12 : 5), 0.016, M, { lados: q ? 8 : 5, rFn: t => 1 - 0.3 * t });
    if (q) A.esfera('madera', 0.017, Math.cos(a) * 0.35, 0.012, Math.sin(a) * 0.35, M, 0.7); }
  // ganchos: 4 grandes arriba y 4 chicos más abajo (girados 45°)
  for (const [y, n0, l, rr] of [[H - 0.14, 0, 0.17, 0.011], [H - 0.31, Math.PI / 4, 0.12, 0.009]]) for (let i = 0; i < 4; i++) {
    const a = n0 + i * Math.PI / 2, d = (r, yy) => V3(Math.cos(a) * r, yy, Math.sin(a) * r);
    const p = curva(t => { const ang = Math.PI * 1.25 * t; const r = 0.02 + l * (0.55 * t + 0.45 * Math.sin(ang * 0.8)); return d(r, y - 0.02 + l * 0.6 * Math.sin(ang * 0.6) - l * 0.35 * t + l * 0.5 * t * t); }, q ? 12 : 5);
    A.tubo('madera', p, rr, M, { lados: q ? 8 : 5, rFn: t => 1 - 0.2 * t }); if (q) A.esfera('madera', rr * 1.4, p[p.length - 1].x, p[p.length - 1].y, p[p.length - 1].z, M);
  }
  if (op.ropa) {   // un abrigo y un sombrero colgados (ropa de minero)
    const a = 0, d = (r, yy) => V3(Math.cos(a) * r, yy, Math.sin(a) * r);
    const ab = bloque(0.34, 0.75, 0.12, 0.05, A.q ? [6, 10, 3] : [3, 5, 2], (v, w, h, dd) => { const t = (v.y + h / 2) / h; v.x *= 0.55 + 0.45 * (1 - t) + 0.2 * Math.sin(v.y * 30) * 0.05; v.z *= 0.6 + 0.6 * (1 - t); v.z += 0.04 * Math.sin(v.x * 12) * (1 - t); });
    uvMetros(ab, 'y'); ab.rotateY(Math.PI / 2); ab.translate(0.17, H - 0.55, 0.0); A.add('lana', ab, 0x3e3a33);
    A.torno('lana', [[0, 0], [0.13, 0], [0.135, 0.008], [0.08, 0.012], [0.075, 0.08], [0.06, 0.11], [0, 0.115]], 0, 0, 0, 0x2e2a26, A.q ? 18 : 8, new THREE.Matrix4().makeRotationZ(-0.5).setPosition(d(0.2, H - 0.12).x, H - 0.12, 0));
    void d;
  }
  return [0.72, 1.82, 0.72];
}

// ------------------------------------------------------------------ CATRE / camastro de 1905: tablones rústicos, jergón de saco, frazada y piel
function catre(A, op) {
  const M = op.madera ?? 0x6a4a30, q = A.q, X = 0.4, Z = 0.93;
  const rustico = (k) => (v) => { v.x += 0.003 * Math.sin(v.y * 40 + k) ; v.z += 0.003 * Math.sin(v.y * 31 + k * 2); };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) A.bloque('madera', 0.075, sz < 0 ? 0.62 : 0.42, 0.075, 0.008, sx * X, (sz < 0 ? 0.62 : 0.42) / 2, sz * Z, M, { veta: 'y', seg: [1, 4, 1], def: rustico(sx + sz * 3) });
  for (const sx of [-1, 1]) A.bloque('madera', 0.045, 0.12, 2 * Z + 0.06, 0.008, sx * (X - 0.005), 0.31, 0, M, { veta: 'z', seg: [1, 1, 6], def: (v) => { v.y += 0.004 * Math.sin(v.z * 5 + sx); } });
  for (const sz of [-1, 1]) A.bloque('madera', 2 * X - 0.02, 0.1, 0.04, 0.008, 0, 0.3, sz * (Z - 0.005), M, { veta: 'x' });
  A.bloque('madera', 2 * X - 0.02, 0.08, 0.035, 0.006, 0, 0.52, -Z, M, { veta: 'x' });   // tabla alta de la cabecera
  for (let i = 0; i < (q ? 7 : 4); i++) A.bloque('madera', 2 * X - 0.06, 0.02, 0.09, 0.004, 0, 0.36, -Z + 0.18 + i * (2 * Z - 0.36) / ((q ? 7 : 4) - 1), 0x7a5a3c, { veta: 'x' });   // tablillas
  // jergón de saco relleno de paja: abultado e irregular
  A.bloque('lana', 0.76, 0.13, 1.8, 0.05, 0, 0.435, 0, op.saco ?? 0x9a835f, { seg: [8, 3, 16], veta: 'z', def: (v, w, h, d) => {
    const n = Math.sin(v.z * 9.3) * Math.sin(v.x * 11 + 1) * 0.5 + Math.sin(v.z * 23 + v.x * 7) * 0.25; if (v.y > 0) v.y += 0.016 * n + 0.012 * (1 - Math.pow(2 * v.x / w, 4)); v.x *= 1 + 0.03 * Math.sin(v.z * 6); } });
  A.bloque('lana', 0.5, 0.11, 0.26, 0.05, 0, 0.545, -0.72, 0x8d7856, { seg: [6, 2, 3], veta: 'x', rx: -0.2, def: (v, w) => { v.y *= 0.6 + 0.4 * (1 - Math.pow(2 * v.x / w, 2)); } });   // almohada de saco
  // frazada de lana gruesa (oscura) y piel de oveja encima
  manta3(A, 0.78, 0.53, -0.5, 0.88, 0.2, op.frazada ?? 0x5e5044, 'lana', { amp: 0.035, ondas: 5, fase: 2.1, bulto: (s, z) => 0.01 * Math.sin(z * 7) });
  const sh = new THREE.Shape(), np = q ? 40 : 14;
  for (let i = 0; i <= np; i++) { const a = 2 * Math.PI * i / np, r = 1 + 0.12 * Math.sin(5 * a + 1) + 0.07 * Math.sin(11 * a) + (Math.abs(Math.sin(a)) > 0.92 ? 0.15 : 0); const x = Math.cos(a) * 0.3 * r, y = Math.sin(a) * 0.4 * r; i ? sh.lineTo(x, y) : sh.moveTo(x, y); }
  const pg = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: q ? 2 : 1, curveSegments: 4 });
  pg.rotateX(-Math.PI / 2); { const p = pg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); const fuera = Math.max(0, Math.abs(x) - 0.36); p.setY(i, p.getY(i) - fuera * 1.6 + 0.008 * Math.sin(x * 30) * Math.sin(z * 26)); } }
  pg.computeVertexNormals(); uvMetros(pg, 'z'); pg.rotateY(0.25); pg.translate(0.08, 0.56, 0.38); A.add('piel', pg, op.piel ?? 0xd4c8b0);
  return [0.9, 0.62, 1.95];
}

const FABRICA = {
  cama: (A, op) => cama(A, op), cama_blanca: (A, op) => cama(A, { fierro: 0xe6e3da, frazada: 0xb7ab92, ...op }), litera, cuna, silla, silla_viena: sillaViena,
  quinque, vela, banca, perchero, catre,
};
// UTIL-T0: puente común. Cada tanda FINO escribe SOLO en su archivo mueblesFinos_<edificio>.js (nuevo), que exporta FABRICA_<EDIFICIO> = { id: (A, op) => [ancho, alto, largo] }
// y llama registrarFabrica(FABRICA_X) al cargarse (utileria.js lo importa: una línea por archivo). Los ids nuevos entran a FINOS y los instancia el Colocador igual que los demás.
export function registrarFabrica(tabla) { for (const [id, f] of Object.entries(tabla)) { FABRICA[id] = f; if (!FINOS.includes(id)) FINOS.push(id); } }
// C4 (finos C, 16-11-2026): materiales extra para los archivos mueblesFinos_<edificio>.js (tulipas, globos, cromo, laca, terciopelo, vidrio de color…).
// fn(base, texturas) → material (base = { vertexColors: true }); escUV = metros por repetición de su textura. No pisa un material ya existente.
export function registrarMaterial(tipo, fn, escUV = 1) { if (!MATS[tipo]) { const m = fn({ vertexColors: true }, texturas); m.name = 'fino_' + tipo; MATS[tipo] = m; } ESC_UV[tipo] = escUV; }
export const fabricaFina = id => FABRICA[id];   // C2: para variantes (cama de hospital = cama de fierro blanco + ficha)
export const HERRAMIENTAS_FINAS = { Armador, barrido, doblar, densificar, curva, bloque, uvMetros, torno, manta, manta3, colchon, almohada, perilla, anillo, angulo };   // para los archivos mueblesFinos_<edificio>.js
const CACHE = {};
// mueble(id, op) → { geo, geoL, lod, mat, tam, tris }: geometría y materiales COMPARTIDOS (misma clave = mismo objeto)
export function mueble(id, op = {}) {
  const f = FABRICA[id]; if (!f) return null;
  const clave = id + JSON.stringify(op);
  if (CACHE[clave]) return CACHE[clave];
  const A1 = new Armador(1), tam = f(A1, op), a = A1.fin();
  const A0 = new Armador(0); f(A0, op); const gl = A0.fin(a.orden).geo;
  const tris = g => (g.index ? g.index.count : g.attributes.position.count) / 3;
  return (CACHE[clave] = { geo: a.geo, geoL: gl, lod: gl, mat: a.mats, tam, tris: [tris(a.geo), tris(gl)] });
}
// Grupo listo para poner suelto (o mover): Mesh con la geometría compartida
export function muebleGrupo(id, op = {}, lod = 0) {
  const m = mueble(id, op); if (!m) return null;
  const g = new THREE.Group(), me = new THREE.Mesh(lod ? m.geoL : m.geo, m.mat); me.receiveShadow = true; g.add(me); g.userData.tam = m.tam; return g;
}
